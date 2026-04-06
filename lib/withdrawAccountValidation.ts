import {
  isDiscordCdnHost,
  normalizeWithdrawDetail,
  parseHttpUrl,
  shouldValidateWithdrawImageLink,
} from './withdrawAccounts';

const WITHDRAW_ACCOUNT_CHECK_TIMEOUT_MS = 10_000;

export class WithdrawAccountValidationError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export async function validateWithdrawAccountDetail(method: string, detail: string) {
  const normalizedDetail = normalizeWithdrawDetail(detail);
  if (!normalizedDetail) {
    throw new WithdrawAccountValidationError('detail_required');
  }

  if (!shouldValidateWithdrawImageLink(method, normalizedDetail)) {
    return normalizedDetail;
  }

  const parsed = parseHttpUrl(normalizedDetail);
  if (!parsed) {
    throw new WithdrawAccountValidationError('wechat_detail_invalid_url');
  }
  if (!isDiscordCdnHost(parsed)) {
    throw new WithdrawAccountValidationError('wechat_detail_invalid_host');
  }

  let response: Response;
  try {
    response = await fetch(parsed, {
      method: 'GET',
      signal: AbortSignal.timeout(WITHDRAW_ACCOUNT_CHECK_TIMEOUT_MS),
    });
  } catch {
    throw new WithdrawAccountValidationError('wechat_detail_unreachable');
  }

  try {
    if (!response.ok) {
      throw new WithdrawAccountValidationError('wechat_detail_unreachable');
    }

    const finalUrl = parseHttpUrl(response.url || parsed.toString());
    if (!finalUrl || !isDiscordCdnHost(finalUrl)) {
      throw new WithdrawAccountValidationError('wechat_detail_invalid_host');
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.startsWith('image/')) {
      throw new WithdrawAccountValidationError('wechat_detail_not_image');
    }
  } finally {
    await response.body?.cancel().catch(() => undefined);
  }

  return normalizedDetail;
}
