import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const WECHAT_PROGRAM_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const sessionWithDlmUser = {
  dlmUser: {
    include: {
      member: true,
    },
  },
  providerAccount: true,
} satisfies Prisma.WechatProgramSessionInclude;

export type WechatProgramSessionRecord = Prisma.WechatProgramSessionGetPayload<{
  include: typeof sessionWithDlmUser;
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

export const createWechatProgramSession = async ({
  dlmId,
  providerAccountId,
}: {
  dlmId: string;
  providerAccountId?: string | null;
}) => {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + WECHAT_PROGRAM_SESSION_TTL_MS);

  await prisma.wechatProgramSession.create({
    data: {
      tokenHash: hashToken(token),
      dlmId,
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

export const revokeWechatProgramSession = async (request: Request) => {
  const token = extractBearerToken(request);
  if (!token) return;

  await prisma.wechatProgramSession
    .deleteMany({
      where: {
        tokenHash: hashToken(token),
      },
    })
    .catch(() => {});
};

export const getWechatProgramSessionFromRequest = async (
  request: Request,
): Promise<WechatProgramSessionRecord | null> => {
  const token = extractBearerToken(request);
  if (!token) return null;

  const session = await prisma.wechatProgramSession.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: sessionWithDlmUser,
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.wechatProgramSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  await prisma.wechatProgramSession
    .update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return session;
};
