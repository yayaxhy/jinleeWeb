import { voucherFailureMessage } from './public-error-messages';
export const VOUCHER_USE_UNCONFIRMED = '使用结果未确认，请先核对券状态和权益，勿重复提交。';

export class VoucherInternalRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'VoucherInternalRequestError';
  }
}

/** Send once. A timeout, transport failure or unreadable success response cannot
 * prove that Bot rolled back, so the caller must not recommend another use. */
export async function postVoucherUseRequest(input: {
  endpoint: string; token: string; payload: Record<string, unknown>;
  fetchImpl?: typeof fetch; timeoutMs?: number; unconfirmedMessage?: string;
}): Promise<Record<string, unknown>> {
  const unconfirmedMessage = input.unconfirmedMessage ?? VOUCHER_USE_UNCONFIRMED;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 8000);
  try {
    const response = await (input.fetchImpl ?? fetch)(input.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-Token': input.token },
      body: JSON.stringify(input.payload), signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    const object = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null;
    if (!response.ok) {
      console.error('[voucher.use] upstream rejected', { status: response.status, error: object?.error });
      // 5xx may be emitted after a commit or by a proxy, so its outcome remains unknown.
      if (response.status >= 500) throw new VoucherInternalRequestError(unconfirmedMessage, response.status);
      const message = voucherFailureMessage(object?.error);
      throw new VoucherInternalRequestError(message, response.status);
    }
    if (!object || object.ok !== true) {
      console.error('[voucher.use] invalid acknowledgement', { status: response.status, error: object?.error });
      throw new VoucherInternalRequestError(unconfirmedMessage, 502);
    }
    return object;
  } catch (error) {
    if (error instanceof VoucherInternalRequestError) throw error;
    console.error('[voucher.use] request failed', error);
    throw new VoucherInternalRequestError(unconfirmedMessage, 502);
  } finally {
    clearTimeout(timeout);
  }
}
