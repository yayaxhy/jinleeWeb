import { NextRequest } from 'next/server';
import { isAdminDiscordId } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { buildGiftIdentityPayload, GiftRequestIdentityError, GIFT_RESULT_UNCONFIRMED } from '@/lib/gift-request-identity';
import { postVoucherUseRequest } from '@/lib/voucher-internal-request';
import { getServerSession } from '@/lib/session';
import { TargetConfirmationError } from '@/lib/target-confirmation';
import { readTargetConfirmationCaller } from '@/lib/target-confirmation-service';
import { targetConfirmationService } from '@/lib/target-confirmation-server';
import { GiftForwardRejected, handleGiftExecutionForward } from '@/lib/gift-execution-forward';
import { assertPreparedGiftRecovery, buildGiftRecoveryPreparation, GiftRecoveryConflict } from '@/lib/gift-execution-recovery';

export async function POST(request: NextRequest) {
  return handleGiftExecutionForward(request, {
    prepare: async body => {
      const session = await getServerSession();
      if (!session?.discordId || !isAdminDiscordId(session.discordId)) throw new GiftForwardRejected('无权访问', 403);
      try {
        const dlmId = String(body?.dlmId ?? '').trim();
        const caller = await readTargetConfirmationCaller(prisma, session);
        const proof = await targetConfirmationService().verify(body?.confirmationToken, caller, {
          purpose: 'delegated-gift', target: body?.peiwanId, payerDlmId: dlmId, giftName: body?.giftName, quantity: body?.quantity,
        });
        const prepared = buildGiftRecoveryPreparation(proof, 'DELEGATED_GIFT', session.username);
        await prisma.$transaction(tx => assertPreparedGiftRecovery(tx, session, body.requestId, prepared.intent), { isolationLevel: 'RepeatableRead' });
        const identity = { ...buildGiftIdentityPayload(proof.payer!, proof.target, true), peiwanId: String(proof.target.peiwanId) };
        const host = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
        const port = process.env.INTERNAL_API_PORT;
        const token = process.env.INTERNAL_API_TOKEN;
        if (!port || !token) throw new GiftForwardRejected('内部打赏接口暂不可用，本次尚未转发', 503);
        return { endpoint: `http://${host}:${port}/internal/gift-execution/v1/delegated-gift`, token, payload: {
          dlmId,
          ...identity,
          giftName: proof.scope.giftName,
          quantity: proof.scope.quantity,
          operatorDiscordId: session.discordId,
        } };
      } catch (error) {
        if (error instanceof GiftRecoveryConflict) throw new GiftForwardRejected(error.message, error.status);
        if (error instanceof TargetConfirmationError) throw new GiftForwardRejected(error.message, error.status, error.code);
        if (error instanceof GiftRequestIdentityError) throw new GiftForwardRejected(error.message, 409);
        throw error;
      }
    },
    send: (prepared, requestId) => postVoucherUseRequest({ ...prepared, unconfirmedMessage: GIFT_RESULT_UNCONFIRMED, payload: { ...prepared.payload, requestId } }),
  });
}
