export const migrationModelLabel = (model: string) => ({
  DlmUser: '账户', Member: 'Discord 钱包', PEIWAN: '陪玩资料', IndividualTransaction: '个人流水', Transaction: '交易凭据',
  Coupon: '优惠券', LotteryDraw: '刮刮卡', LotteryPity: '抽奖进度', HeartCounter: '心动关系', Blacklist: '黑名单',
  FarmProfile: '农场资产', FarmPlot: '农场种植进度', FarmPlotCareEvent: '农场照料记录', FarmActionLog: '农场操作记录',
  FarmVisit: '农场访问', VoicePointSession: '语音计分活动', VoicePointLedger: '语音积分记录', PointShopCart: '购物车', PointShopCartItem: '购物车商品',
  PointShopOrder: '积分商城订单', PointShopGrant: '兑换权益', VipBenefitGrant: 'VIP 福利领取记录', VipBenefitGrantInstance: '已发 VIP 福利',
  Referral: '邀请关系', ReferralPayout: '历史邀请提成', WithdrawalAccount: '默认收款账户', Withdraw: '提现记录', Recharge: '充值记录',
  ManualQuotaBatch: '普通双倍额度', ManualQuotaRestoration: '退回双倍额度', FlowBuff: '双倍流水额度', SpendBuff: '双倍消费额度',
  CommissionBuff: '抽成券权益', AutoCommissionBuff: '福星权益', VipBenefitProfile: 'VIP 设置', PeiwanGameProfile: '陪玩游戏标签',
  MiniConversation: '聊天记录', MiniMessage: '聊天消息', Order: '订单', StripePayment: 'Stripe 支付记录', ZPayRechargeOrder: 'ZPay 支付记录',
  WechatNativePayment: '微信支付记录', BlockStackPlayer: '积木游戏进度', BlockStackDraw: '积木奖励记录',
} as Record<string, string>)[model] ?? '历史记录';
export const migrationDispositionLabel = (value: string) => value.startsWith('ARCHIVED_NOT_ACTIVE:') ? '不兼容活动，已归档停用' : ({
  OWNERSHIP_OR_STATE_UPDATED: '已合并，保留原始记录', SELF_RELATION_HISTORY_ONLY: '合并后仅保留历史',
  SELF_VISIT_HISTORY_ONLY: '合并后仅保留历史', RETIRED_ACCOUNT: '旧账号已删除', RETIRED_MEMBER: '旧钱包已合并',
  DUPLICATE_STATE_ORIGINAL_EVIDENCE_PRESERVED: '重复状态已合并，原始记录保留', MERGED_CHAT_MESSAGES_PRESERVED: '会话已合并，消息保留',
  EXPIRED_NOT_REACTIVATED: '已过期，不重新生效', OLD_PROGRESS_NOT_INHERITED: '旧号进度仅保留历史',
  MOVED_TO_INDEPENDENT_ORDINARY_BATCH: '已转为独立到期额度', OLD_INVITATION_RELATION_ENDED: '旧邀请关系已结束',
  OLD_INVITATION_POLICY_ENDED: '旧邀请规则已结束', MERGED_SINGLETON: '已合并', MERGED_FARM: '农场资产已合并',
} as Record<string, string>)[value] ?? '已保留原始记录';
export const migrationRolesLabel = (value: string) => ({ COMPLETED: '已完成', PENDING: '等待处理', PROCESSING: '处理中', FAILED: '待重试' } as Record<string,string>)[value] ?? '待核实';
