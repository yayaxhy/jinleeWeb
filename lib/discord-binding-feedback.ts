const bindingReviewMessages: Record<string, string> = {
  last_login_method_forbidden: '请先关联微信，确保解除 Discord 后仍可登录原账户。',
  detached_identity_conflict: '账户已有解绑保管记录，需要先核实原记录。当前资产没有转移。',
  role_plan_changed: '账号角色归属已变化，请刷新后重新操作。',
  channel_not_bound: '此登录方式已经解除关联，请刷新账号状态。',
  account_merge_pending_operation: '账号有正在处理的管理员操作，请等待处理完成后再绑定。此次绑定未修改账号资料或余额。',
  account_merge_manual_boss_conflict: '两个账号分别有人工维护的客户资料，请联系客服核实归属后再绑定。原资料和余额已保留。',
  account_merge_legacy_mirror_conflict: '账号仍有关联旧 Discord 的积分或收款资料，请联系客服核实归属后再绑定。',
  account_merge_claim_conflict: '两个账号存在同一活动周期的领取记录，需要客服核实后再绑定。原领取记录和已发权益已保留。',
  account_merge_point_shop_conflict: '两个账号的积分商城记录无法自动合并，请联系客服核实。原订单、权益和余额已保留。',
  account_merge_conversation_conflict: '账号包含无法自动合并的聊天记录，请联系客服核实后再绑定。原聊天记录和账号资料已保留。',
  account_merge_relations_remaining: '账号仍有未完成迁移的关联记录，本次绑定已撤回。请联系客服核实，原资料和余额已保留。',
  incoming_discord_already_bound: '此微信账号已关联 Discord，不能直接合并两个 Discord 账号。请联系客服核实账号与资产归属。',
  discord_unbind_requires_asset_review: '账号存在资产、消费记录或待处理业务，请联系客服核实归属后再解绑。',
  discord_binding_changed: '账号绑定状态已变化，请重新登录并刷新绑定状态后再试。',
  binding_state_changed: '账号绑定状态已变化，请重新登录并刷新绑定状态后再试。',
};

export const getBindingReviewMessage = (code: string | undefined): string | null =>
  code && Object.prototype.hasOwnProperty.call(bindingReviewMessages, code) ? bindingReviewMessages[code] : null;
