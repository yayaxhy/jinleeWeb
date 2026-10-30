import { Prisma } from '@prisma/client';
import { newEntityOnlyTime } from '@/lib/operating-entity-cutover';

/** C980's historical rebate was verified in the wallet ledger and explicitly
 * accepted as an expense. This exception is for reporting only; callers still
 * require USED status and consumption in the reporting period. */
export const revenueCouponIssueWhere = (): Prisma.CouponWhereInput => ({
  OR: [
    { issuedAt: newEntityOnlyTime() },
    { id: 'C980' },
  ],
});
