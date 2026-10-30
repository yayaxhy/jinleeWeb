import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

export type WalletLedgerToolOptions = {
  apply: boolean;
  help: boolean;
  envFile?: string;
  confirmDatabase?: string;
  batchSize: number;
  maxBatches: number;
  afterId?: string;
  throughId?: string;
};

const readValue = (args: string[], index: number) => {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error('ledger_tool_option_value_required');
  return value;
};

const boundedInteger = (raw: string, maximum: number) => {
  if (!/^[1-9]\d*$/.test(raw)) throw new Error('ledger_tool_invalid_limit');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) throw new Error('ledger_tool_invalid_limit');
  return value;
};

export function parseWalletLedgerToolOptions(args: string[], allowApply: boolean): WalletLedgerToolOptions {
  const options: WalletLedgerToolOptions = { apply: false, help: false, batchSize: 1000, maxBatches: 100 };
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (seen.has(option)) throw new Error('ledger_tool_duplicate_option');
    seen.add(option);
    switch (option) {
      case '--help':
      case '-h': options.help = true; break;
      case '--apply':
        if (!allowApply) throw new Error('ledger_audit_is_read_only');
        options.apply = true;
        break;
      case '--env-file': options.envFile = readValue(args, index++); break;
      case '--confirm-database': options.confirmDatabase = readValue(args, index++); break;
      case '--batch-size': options.batchSize = boundedInteger(readValue(args, index++), 5000); break;
      case '--max-batches': options.maxBatches = boundedInteger(readValue(args, index++), 1000); break;
      case '--after-id': options.afterId = readValue(args, index++); break;
      case '--through-id': options.throughId = readValue(args, index++); break;
      default: throw new Error('ledger_tool_unknown_option');
    }
  }
  if (!options.help && options.afterId && !options.throughId) throw new Error('ledger_resume_requires_through_id');
  if (!options.help && options.apply && !options.confirmDatabase) throw new Error('ledger_apply_requires_database_confirmation');
  return options;
}

export function normalizeWalletLedgerDatabaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error('ledger_database_url_required');
  if (trimmed.startsWith('postgresql://') || trimmed.startsWith('postgres://')) return trimmed;
  const matched = trimmed.match(/(postgres(?:ql)?:\/\/[^'"\s]+)/i)?.[1];
  if (!matched) throw new Error('ledger_database_url_invalid');
  return matched;
}

export function validateWalletLedgerDatabaseTarget(rawUrl: string | undefined, options: WalletLedgerToolOptions) {
  const normalized = normalizeWalletLedgerDatabaseUrl(rawUrl);
  let url: URL;
  try { url = new URL(normalized); } catch { throw new Error('ledger_database_url_invalid'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('ledger_database_url_invalid');
  let database: string;
  try { database = decodeURIComponent(url.pathname.slice(1)); } catch { throw new Error('ledger_database_url_invalid'); }
  if (!database) throw new Error('ledger_database_name_required');
  if (options.apply && database !== options.confirmDatabase) throw new Error('ledger_database_confirmation_mismatch');
  return database;
}

/** Call before importing Prisma: its generated entry point can load .env implicitly.
 * Only this selected URL is passed to Prisma. No database is opened here. */
export function loadWalletLedgerToolDatabase(options: WalletLedgerToolOptions, externalUrl = process.env.DATABASE_URL) {
  let raw = externalUrl;
  const configurationSource = raw === undefined ? 'env-file' : 'environment';
  if (raw === undefined) {
    let content: string;
    try { content = readFileSync(options.envFile ?? '.env.local', 'utf8'); }
    catch { throw new Error('ledger_env_file_unreadable'); }
    raw = parse(content).DATABASE_URL;
  }
  const normalizedUrl = normalizeWalletLedgerDatabaseUrl(raw);
  const database = validateWalletLedgerDatabaseTarget(normalizedUrl, options);
  // The URL has already been parsed safely. Never return its user/password as report metadata.
  const parsed = new URL(normalizedUrl);
  return {
    normalizedUrl,
    target: { host: parsed.hostname, port: parsed.port || '5432', database,
      schema: parsed.searchParams.get('schema') || 'public', configurationSource },
  };
}

/** Only bounded internal codes are printed. Prisma messages may contain connection URLs or row values. */
export function walletLedgerToolErrorCode(error: unknown) {
  if (error instanceof Error && /^ledger_[a-z_]+$/.test(error.message)) return error.message;
  if (error && typeof error === 'object' && 'code' in error && /^P\d{4}$/.test(String(error.code))) {
    return `ledger_database_error_${String(error.code)}`;
  }
  return 'ledger_tool_failed';
}
