type ManualOperationResult = { dlmId?: string };

/** Historical result JSON stays immutable; the FK identifies its current owner. */
export function manualOperationResultForCurrentAccount<T extends ManualOperationResult>(operation: {
  dlmId: string;
  result: T;
}): T & { dlmId: string } {
  return { ...operation.result, dlmId: operation.dlmId };
}

export async function replayManualWechatRechargeResult<T extends ManualOperationResult>(
  operation: { dlmId: string; requestId: string; result: T },
  readCurrentBalance: (dlmId: string) => Promise<string | null>,
) {
  const result = manualOperationResultForCurrentAccount(operation);
  return {
    ...result,
    rechargeRequestId: operation.requestId,
    currentBalance: await readCurrentBalance(operation.dlmId),
  };
}
