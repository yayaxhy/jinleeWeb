import { Prisma } from '@prisma/client';
import {
  validateWalletTransaction,
  type WalletLedgerMetadata,
} from './wallet-ledger';

/** The wallet mutation and receipt must share a transaction. The DB trigger
 * writes deltaAmount for every writer. Existing business idempotency checks
 * must run BEFORE changing the wallet; no new table stores an operation key.
 */
export async function recordWalletTransaction(
  tx: Prisma.TransactionClient,
  data: Prisma.IndividualTransactionUncheckedCreateInput,
  metadata: WalletLedgerMetadata = {},
) {
  if ('$transaction' in tx) throw new Error('wallet_ledger_transaction_required');
  const receipt = await tx.individualTransaction.create({ data });
  validateWalletTransaction(receipt, metadata);
  return receipt;
}
