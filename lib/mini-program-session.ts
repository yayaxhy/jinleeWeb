import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const MINI_PROGRAM_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const sessionWithUser = {
  user: {
    include: {
      member: true,
    },
  },
  providerAccount: true,
} satisfies Prisma.MiniProgramSessionInclude;

export type MiniProgramSessionRecord = Prisma.MiniProgramSessionGetPayload<{
  include: typeof sessionWithUser;
}>;

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const extractBearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization');
  if (!authorization) return null;

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token.trim();
};

export const createMiniProgramSession = async ({
  userId,
  providerAccountId,
}: {
  userId: string;
  providerAccountId?: string | null;
}) => {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + MINI_PROGRAM_SESSION_TTL_MS);

  await prisma.miniProgramSession.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      providerAccountId: providerAccountId ?? null,
      expiresAt,
      lastUsedAt: new Date(),
    },
  });

  return {
    token,
    expiresAt,
  };
};

export const revokeMiniProgramSession = async (request: Request) => {
  const token = extractBearerToken(request);
  if (!token) return;

  await prisma.miniProgramSession
    .deleteMany({
      where: {
        tokenHash: hashToken(token),
      },
    })
    .catch(() => {});
};

export const getMiniProgramSessionFromRequest = async (
  request: Request,
): Promise<MiniProgramSessionRecord | null> => {
  const token = extractBearerToken(request);
  if (!token) return null;

  const session = await prisma.miniProgramSession.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: sessionWithUser,
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.miniProgramSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  await prisma.miniProgramSession
    .update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return session;
};
