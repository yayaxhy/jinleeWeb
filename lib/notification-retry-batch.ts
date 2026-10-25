import type { runClaimedDelivery } from './notification-delivery';

type ChannelResult = Awaited<ReturnType<typeof runClaimedDelivery>>;
export type NotificationDeliveryResults = PromiseSettledResult<ChannelResult>[] | undefined;
export type RetryBatchSummary = {
  ok: boolean;
  attempted: number;
  uncertain: number;
  channelErrors: number;
  notificationErrors: number;
  batchErrors: number;
  processingErrors: number;
  error?: 'notification_retry_incomplete';
};

export function summarizeDeliveryResults(
  results: PromiseSettledResult<NotificationDeliveryResults>[],
  batchErrors = 0,
): RetryBatchSummary {
  let attempted = 0;
  let uncertain = 0;
  let channelErrors = 0;
  let notificationErrors = 0;
  for (const notification of results) {
    if (notification.status === 'rejected') {
      notificationErrors++;
      continue;
    }
    for (const channel of notification.value ?? []) {
      if (channel.status === 'rejected') channelErrors++;
      else if (channel.value !== 'not_claimed') {
        attempted++;
        if (channel.value === 'uncertain') uncertain++;
      }
    }
  }
  const processingErrors = channelErrors + notificationErrors + batchErrors;
  return {
    ok: processingErrors === 0,
    attempted, uncertain, channelErrors, notificationErrors, batchErrors, processingErrors,
    ...(processingErrors ? { error: 'notification_retry_incomplete' as const } : {}),
  };
}

/** Report counts only: underlying DB/provider errors may contain private data. */
export function reportRetryFailure(summary: RetryBatchSummary, log: (message: string) => void = console.error) {
  if (summary.processingErrors) {
    log(`[notification-retry] processing failed: batchErrors=${summary.batchErrors} notificationErrors=${summary.notificationErrors} channelErrors=${summary.channelErrors} attempted=${summary.attempted} uncertain=${summary.uncertain}`);
  }
}

export async function runNotificationRetryBatch(deps: {
  list: () => Promise<Array<{ id: string }>>;
  deliver: (id: string) => Promise<NotificationDeliveryResults>;
  log?: (message: string) => void;
}): Promise<RetryBatchSummary> {
  let notifications: Array<{ id: string }>;
  try {
    notifications = await deps.list();
  } catch {
    const summary = summarizeDeliveryResults([], 1);
    reportRetryFailure(summary, deps.log);
    return summary;
  }
  const results = await Promise.allSettled(notifications.map(async ({ id }) => deps.deliver(id)));
  const summary = summarizeDeliveryResults(results);
  reportRetryFailure(summary, deps.log);
  return summary;
}
