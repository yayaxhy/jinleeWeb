import { existsSync } from 'node:fs';

import { config } from 'dotenv';
import type { Names, ReaderModel } from '@maxmind/geoip2-node';

const BATCH_SIZE = 250;
const DEFAULT_GEOIP_DB_PATH = '/usr/share/GeoIP/GeoLite2-City.mmdb';
const SHOULD_APPLY = process.argv.includes('--apply');
const SHOULD_SHOW_HELP = process.argv.includes('--help') || process.argv.includes('-h');

const printHelp = () => {
  console.log(`Usage: npm run auth-login-location:backfill -- [--apply]

Reads encrypted historical login IP addresses and resolves coarse country, region, and city data from a local GeoLite2-City database.

Without --apply, this command is a read-only dry run. Add --apply to update only records that have an encrypted IP address and at least one missing location field.

Environment:
  AUTH_LOGIN_AUDIT_ENCRYPTION_KEY  Required to decrypt historical login IP addresses.
  AUTH_LOGIN_GEOIP_DB_PATH         Optional; defaults to ${DEFAULT_GEOIP_DB_PATH}
`);
};

const getName = (names?: Names) => names?.['zh-CN']?.trim() || names?.en?.trim() || null;

const getLocation = (reader: ReaderModel, ipAddress: string) => {
  try {
    const record = reader.city(ipAddress);
    return {
      country: getName(record.country?.names),
      region: getName(record.subdivisions?.[0]?.names),
      city: getName(record.city?.names),
    };
  } catch {
    return null;
  }
};

const main = async () => {
  if (SHOULD_SHOW_HELP) {
    printHelp();
    return;
  }

  config({ path: '.env.local', quiet: true });

  const geoipDatabasePath = process.env.AUTH_LOGIN_GEOIP_DB_PATH?.trim() || DEFAULT_GEOIP_DB_PATH;
  if (!process.env.AUTH_LOGIN_AUDIT_ENCRYPTION_KEY?.trim()) {
    throw new Error('AUTH_LOGIN_AUDIT_ENCRYPTION_KEY must be configured to backfill encrypted login IP records');
  }
  if (!existsSync(geoipDatabasePath)) {
    throw new Error(`GeoLite2-City database not found at ${geoipDatabasePath}`);
  }

  const [{ Reader }, { decryptAuthAuditIp }, { prisma }] = await Promise.all([
    import('@maxmind/geoip2-node'),
    import('../lib/auth-login-audit'),
    import('../lib/prisma'),
  ]);
  const reader = await Reader.open(geoipDatabasePath);

  let cursor: string | undefined;
  let scanned = 0;
  let resolved = 0;
  let updated = 0;
  let unableToDecrypt = 0;
  let locationNotFound = 0;

  try {
    while (true) {
      const events = await prisma.authLoginEvent.findMany({
        where: {
          ipAddressEncrypted: { not: null },
          OR: [{ ipCountry: null }, { ipRegion: null }, { ipCity: null }],
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          ipAddressEncrypted: true,
        },
      });
      if (events.length === 0) break;
      cursor = events.at(-1)?.id;

      for (const event of events) {
        scanned += 1;
        const ipAddress = decryptAuthAuditIp(event.ipAddressEncrypted);
        if (!ipAddress) {
          unableToDecrypt += 1;
          continue;
        }

        const location = getLocation(reader, ipAddress);
        if (!location || (!location.country && !location.region && !location.city)) {
          locationNotFound += 1;
          continue;
        }
        resolved += 1;

        if (SHOULD_APPLY) {
          await prisma.authLoginEvent.update({
            where: { id: event.id },
            data: {
              ipCountry: location.country,
              ipRegion: location.region,
              ipCity: location.city,
            },
          });
          updated += 1;
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    JSON.stringify(
      {
        mode: SHOULD_APPLY ? 'apply' : 'dry-run',
        database: geoipDatabasePath,
        scanned,
        resolved,
        updated,
        unableToDecrypt,
        locationNotFound,
      },
      null,
      2,
    ),
  );

  if (!SHOULD_APPLY) {
    console.log('Dry run only. Re-run with --apply to write the resolved locations.');
  }
};

main().catch((error) => {
  console.error('[auth-login-location-backfill] failed', error);
  process.exitCode = 1;
});
