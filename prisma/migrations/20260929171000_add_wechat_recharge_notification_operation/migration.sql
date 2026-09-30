-- The original manual-WeChat migration may already be applied in production.
-- Add the notification operation kind separately so deployed databases can
-- record idempotent Discord-channel notifications.
ALTER TYPE "DlmAdminOperationType"
  ADD VALUE IF NOT EXISTS 'WECHAT_RECHARGE_NOTIFICATION';
