import { Prisma } from '@prisma/client';
import {
  createWalletLedgerEntryData,
  isWalletLedgerWriteEnabled,
  type WalletLedgerMetadata,
} from './wallet-ledger';

/** The caller's wallet mutation, receipt and ledger must share this transaction.
 * Existing business idempotency checks must run BEFORE changing the wallet.
 * A duplicate ledger key is deliberately an error, rolling back the entire
 * transaction; it must never be swallowed after applying a second wallet delta.
 */
export async function recordWalletTransaction(
  tx: Prisma.TransactionClient,
  data: Prisma.IndividualTransactionUncheckedCreateInput,
  metadata: WalletLedgerMetadata = {},
) {
  if ('$transaction' in tx) throw new Error('wallet_ledger_transaction_required');
  const receipt = await tx.individualTransaction.create({ data });
  if (isWalletLedgerWriteEnabled()) {
    await tx.walletLedgerEntry.create({ data: createWalletLedgerEntryData(receipt, metadata) });
  }
  return receipt;
}
