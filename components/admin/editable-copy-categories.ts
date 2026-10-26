import type { EditableCopyEntry } from '@/lib/editable-copy-contract';

/** UI-only business categories. Publication keys, defaults and saved overrides stay unchanged. */
export const COPY_CATEGORIES = [
  { id: 'home', label: '首页与通用' },
  { id: 'account', label: '账号与个人中心' },
  { id: 'onboarding', label: '入会、入职与邀请' },
  { id: 'peiwan', label: '陪玩资料与展示' },
  { id: 'orders', label: '派单与订单' },
  { id: 'audition', label: '真人试音' },
  { id: 'gifts', label: '打赏与心动' },
  { id: 'wallet', label: '充值、余额与提现' },
  { id: 'benefits', label: 'VIP、积分与权益' },
  { id: 'games', label: '抽奖与小游戏' },
  { id: 'farm', label: '农场' },
  { id: 'support', label: '客服与通知' },
  { id: 'assistant', label: '智能助手与百科' },
  { id: 'policies', label: '协议与规则' },
] as const;
export type CopyCategoryId = (typeof COPY_CATEGORIES)[number]['id'];

/** Mixed pages need key-level routing: never infer category from editable text or line numbers. */
const MIXED_PAGE_KEYS: readonly { prefix: string; categories: Partial<Record<CopyCategoryId, readonly string[]>> }[] = [
  { prefix: 'site.components.profile.giftandselfusebuttons.', categories: {
    benefits: ['004f7ff59bfb', '0e2d3a3c09c2', '19b6a1bf9fca', '68ec92b4d10f', 'de2f8ef86e4d'],
  } },
  { prefix: 'bot.server.internalwebhookserver.', categories: {
    benefits: [
      '15b9fe99c', '445fd97cb', '705cc3bd2', '90548a678', 'adc712051',
    ],
    support: [
      '19ee94304', '2e3bd40ac', '4a573ce62', '4c2cf5eff', '63dabc428', 'fca2b207f',
    ],
    orders: [
      '1cccbc141', '21c121933', '45c45a3b0', '58ebd9659', '6b57e39cd', '7389faadc',
      'a6b50f4d2', 'b392f8f1b', 'c587147b8', 'f5609e4c0',
    ],
    peiwan: [
      '1e264f19f',
    ],
    wallet: [
      '70f5d3ae4',
    ],
  } },
  { prefix: 'bot.services.publicerrormessages.', categories: {
    games: [
      '027291dd9', '37fffbf8f', '4b4a5bf09', '59509288e', '64fa152c1', '892e169e9',
      'a1168ea19', 'e7adf2a6f',
    ],
    wallet: [
      '3660c89e6', 'c20229c47',
    ],
    gifts: [
      '36ead190a', '4e1b8ee78', '71603cd5e', '97afc588c', 'ac77176f6', 'b384442fe',
      'b7051ef35', 'be98d9e65', 'bed9f7c1b', 'ca64b9aeb', 'e004da92d', 'fe8c7fd8c',
    ],
    home: [
      '601a1fef6', 'cc437dc37',
    ],
  } },
  { prefix: 'bot.sqlnotifications.', categories: {
    wallet: [
      'balancebody', 'balancetitle',
    ],
    peiwan: [
      'profilebody', 'profiletitle',
    ],
  } },
  { prefix: 'bot.ui.orderembeds.', categories: {
    benefits: [
      '038fbb3cb', '1df8eabb4', '2c33f9c1e', '36f91b5b1', '3f6a3a0cd', '7e716f2ef',
      'fc31c6c43',
    ],
    gifts: [
      '2e2f60b3d', '69234b829', '7f8fdc741', '99b00df69', 'dae625146',
    ],
    peiwan: [
      '32f6b5da9', '480c25ef2', '816394792', '8fdb1ac7f', '96dcb130e', '98578da60',
      'c267198fe', 'c6b630ae5', 'c86d896c7', 'd58c2a8db', 'quotationq1', 'quotationq10',
      'quotationq2', 'quotationq3', 'quotationq4', 'quotationq5', 'quotationq6', 'quotationq7',
      'quotationq8', 'quotationq9',
    ],
    onboarding: [
      'activitiesheading',
    ],
  } },
  { prefix: 'site.app.console.guildconsole.', categories: {
    orders: [
      '03b53d95839f', '0a2be4f74596', '0e37f83ddbf1', '1084763b7b72', '1714ab14a246', '17bb9d37b41d',
      '1b32775b5c3c', '2305ee3ca36f', '308738e3d0ad', '368d0da8f2dc', '3726b0278076', '3dcc333c18ae',
      '3eedd32d80a7', '3feb2e0b5a23', '45d6e44323fa', '4997ae7b55dc', '4a40171aa6b8', '4c3e812e29b0',
      '4d0b4688c787', '4dee259ff613', '4f65b69b2420', '5138491a19ed', '6166a8e466a5', '63b2603c5b9d',
      '66c222005555', '6cd874d08ee0', '6e9a5a1e370e', '77c17065a4fc', '7f5c1e504305', '7fdf5ceea0bc',
      '81b3798bebc6', '827116d51b43', '84e3802f60a7', '891900f1dfe6', '8c577dc72c73', '8d6ce5ecd24a',
      '94dbe5b69027', '97af7c1153cd', '9a94b37da8b6', '9bb6a2c7d3dd', '9c4ebb4cf104', 'a35075d1d72f',
      'a83cf20d4ff4', 'a8d2cbdece97', 'ce1433a194e2', 'd039fba21b1c', 'd04bff542dab', 'd4e7c45d21e2',
      'd98167d36dbd', 'dd8804496a6d', 'e127aad189b9', 'e520d3ed2f5e', 'ed6fc7161df0', 'f210fb64816c',
      'f2f40abb3602', 'f4c78c75e914', 'f844a48dbc62', 'f85c8f0232ac', 'feec35d97553',
    ],
    peiwan: [
      '03f65b0e6715', '0bdcf2dbe62f', '0cce497b8787', '0d0b95894332', '11a785d2bca3', '1d61b82ec64b',
      '2a5c8543f795', '3024dfeed9df', '33fe173d3bd2', '50a1ce2c6ed6', '5e51e6fe8f22', '64728a772742',
      '6da1634e1997', '7bb590a949c0', 'b5db739ac671', 'd0a85d251066', 'd82d647fc0f1', 'e44a0ea17d03',
      'e4e46c7235d1', 'f278457a2633', 'fc5d56cf98af', 'fe58c849a9c4',
    ],
    support: [
      '07e53c974f6c', '1214d633a448', '65fdaa364aae', '8ddbac6fed90', '924dce2cf2b6', '9e636642d6d4',
      'b139d74c0170', 'b77b641ed679', 'cf71a3d560a6', 'dc6de3fa868f', 'f1702b468627', 'f7d21fc5cf14',
    ],
    wallet: [
      '0ea094eec581', '239d15857adb', '37b2775cbce6', '51cc55073eb6', '5842c3627374', '84f1b5486dc0',
      '89b4aa6364ce', '904685b6da57', 'a1c9954f263e', 'a471daf080b6', 'ae1abe750af6', 'b51a6fde063d',
      'b60862f4855a', 'b846e12540e7', 'b9c09c1da358', 'bd94a6639088', 'cb2139e2f68b', 'e6459cd00f2c',
      'fa03c4625313',
    ],
    account: [
      '312a5af9aee2', '8e38717a5747', 'a514d78eab6f', 'c3d92b20c8a3',
    ],
    home: [
      '38108eaa1d32', '53297f595ad5', '578009897502', '6c14bd7f6f9e', '7531950c3521', '7a183c580075',
      '8483cd2b088b', '94f6c750bf77', 'c2e430c82801', 'ce0e936c16bd', 'd47379f917ec', 'f0f1a64cfeb3',
      'f46a1a9e7576',
    ],
    benefits: [
      '3b1b41c2da72',
    ],
  } },
  { prefix: 'site.app.profile.personalpage.', categories: {
    wallet: [
      '04a3cbd65606', '0a2dde4c65fb', '10b10e5e7f6b', '1646bf2ec192', '21b089f693c7', '3e7beeb7a940',
      '67a246a344ae', '7ca84917a2e1', '870c0ab88bd9', '89b4aa6364ce', '90e514a4b554', '96aafce775c3',
      'a471daf080b6', 'b41561d80765', 'c098616830c3', 'c6cf7722be48', 'e0361480e3a5', 'e4e46c7235d1',
      'f495347d6acf', 'fa03c4625313',
    ],
    benefits: [
      '067503a5bf3e', '0f1a2515abc3', '116933e3696f', '1354374f768e', '154b6700190e', '1c5a3e03faf1',
      '25083e17b076', '3b1b41c2da72', '3d7c3fd5d46e', '54bc5b3c8e00', '573a35fddacf', '5973e83a84e4',
      '6478dde45436', '667c954567ae', '6d423aa04d58', '78590270ab59', '7b703872538d', '8b72cdeed06b',
      '9273cc90ea18', '97d9a08ccd40', '9af2298dbec5', '9dd0d5dcd086', '9e2f8bf3a735', 'a058296dde28',
      'a915eccf00ee', 'a9619c37b67c', 'aa9fe6bd2cc4', 'af526b515416', 'afc3a43e5b41', 'b3a30e12e871',
      'b4c2c5bfe153', 'b6a30c352fcf', 'bd94a6639088', 'c09cac686059', 'cc13fb8a957b', 'd083aba29cec',
      'e4501732e2af', 'e91365cf9ed9', 'f0da1c7b4ef1', 'f1ebc7eeb432', 'f787b08b6067',
    ],
    gifts: [
      '06bbcfc46c2a', '1e972bb1a1ad', 'b608cf1b2121',
    ],
    peiwan: [
      '11ee30062d3d', '1d9a8790ecf5', '497064be1f41', '51abd6d878b8', '62c9aa371d93', '975c61b3f8c8',
      'aaf9c9ab96b9', 'bce2ef61514a', 'c3dacb1c2a59', 'ff65e0488282',
    ],
    home: [
      '20b6e2fcece9',
    ],
    account: [
      '343ea874e81a', '41de4204b04a', '7776c1b4f720', '79799fc6ec78', '97f42f9ab44f', '9ba8d391c59a',
      'b903e2ade79b', 'c241ef1b935c', 'cd4994e50397', 'd04c1f47483e',
    ],
    games: [
      '3d2b0543df8f',
    ],
  } },
  { prefix: 'site.components.profile.dlmreadonlyprofile.', categories: {
    account: [
      '094774b4a77b', '86c67464ba78', '9ba8d391c59a', '9bd3d635c012', 'a66f25b36f20', 'c241ef1b935c',
      'cf807aad82ef', 'f8864e421b6b',
    ],
    wallet: [
      '10b10e5e7f6b', '1646bf2ec192', '372545bb9e8e', '7ca84917a2e1', '870c0ab88bd9', '89b4aa6364ce',
      '8e9dc075e770', '90e514a4b554', '94d9ca770bce', '96aafce775c3', 'e0361480e3a5', 'e4e46c7235d1',
    ],
    home: [
      '20b6e2fcece9',
    ],
    orders: [
      '558072a553aa', '637a63ce5122', '69742bfe5140', '71d6df4130ec', '81b3798bebc6', '8c34454926c1',
      'd395e3f6edae',
    ],
    benefits: [
      'a915eccf00ee', 'b3e2659e5f12', 'bd94a6639088',
    ],
    support: [
      'b8649fa6bedb',
    ],
  } },
  { prefix: 'site.lib.mini.program.', categories: {
    support: [
      '1211c69ea1e3', '1a04757d8865', '3609dd5b2141', '3936495bb492', '73a6d5ca9a24', 'b5bdca8f7459',
      'f95050a48426',
    ],
    orders: [
      '3a065da4e327', '5998ae0a745a', '62654406bef2', 'b957d6787ad5', 'd3cbf5422972', 'dd6f43c04bcf',
      'e3a97d4749e3', 'f5663df6ff1c', 'f773ec73dfe0',
    ],
    peiwan: [
      '96c347102cfd',
    ],
  } },
  { prefix: 'site.lib.mini.program.account.', categories: {
    support: [
      '2976c8101251', '352879e3aadc', '75cf4e020143', 'c09f04a55ddc', 'ff8e77d2f0c6',
    ],
  } },
  { prefix: 'site.lib.public.error.messages.', categories: {
    wallet: [
      '125b9db0e4a7', '22965d14e8eb', '5f63d4c8e86d', '8cb61e287cc0', '92b2703596e5', 'a1addb280f20',
    ],
    account: [
      '20d730c7886e', '312b9647b2f3', '61968605cceb', '70cfff94ffc5', '9c3e92a3b2e2', 'cf9312e6c7de',
      'd003f2d35ea1', 'f7af82cff3c4',
    ],
    benefits: [
      '26a9d077cbeb', '589b325db1c9', '609e3671fcfc', '7d01425e8b64', '9de511b917a6', 'cddc6b104550',
    ],
    peiwan: [
      '5e4f22bc1ad9',
    ],
    gifts: [
      '8ae971be9456', 'c47460e42f5d',
    ],
    home: [
      '9bed1591086e', 'd6ee913e2aca',
    ],
  } },
];
const categoryByKey = new Map<string, CopyCategoryId>();
for (const { prefix, categories } of MIXED_PAGE_KEYS) {
  for (const [category, suffixes] of Object.entries(categories)) {
    for (const suffix of suffixes) categoryByKey.set(prefix + suffix, category as CopyCategoryId);
  }
}

/** Specific namespaces precede broad page/module fallbacks. */
const NAMESPACE_CATEGORIES: readonly { category: CopyCategoryId; prefixes: readonly string[] }[] = [
  { category: 'policies', prefixes: [
    'site.app.privacy.',
    'site.app.terms.',
    'site.app.recharge.policy.',
    'site.components.legal.',
  ] },
  { category: 'audition', prefixes: [
    'site.app.api.profile.audition.',
    'site.components.profile.auditioninvitepreferencetoggle.',
    'bot.services.audition',
  ] },
  { category: 'farm', prefixes: [
    'site.app.farm.',
    'site.app.api.farm.',
    'site.components.farm.',
    'site.lib.farmconfig.',
  ] },
  { category: 'account', prefixes: [
    'site.app.accounts.',
    'site.app.api.discord.',
    'site.app.api.dlm.login.',
    'site.app.api.wechat.bind.',
    'site.app.discord.migration.',
    'site.app.dlm.login.',
    'site.app.profile.account.migrations.',
    'site.app.api.profile.account.migrations.',
    'site.app.api.profile.blacklist.',
    'site.app.api.profile.member.search.',
    'site.app.profile.personalpage.',
    'site.components.loginbutton.',
    'site.components.profile.blacklistmanager.',
    'site.components.profile.dlmreadonlyprofile.',
    'site.lib.account.migration.labels.',
    'site.lib.discord.binding.feedback.',
    'site.lib.mini.program.account.',
  ] },
  { category: 'onboarding', prefixes: [
    'site.app.join.',
    'site.app.api.opening.benefits.',
    'site.components.opening.',
    'site.components.home.openingbenefits',
    'bot.services.recruitmentapplicationservice.',
    'bot.services.inviterewardservice.',
    'bot.ui.welcomemessage.',
    'bot.presentation.welcomegreeting',
    'bot.presentation.welcomeintro',
    'bot.commands.registerpeiwanslash.',
  ] },
  { category: 'peiwan', prefixes: [
    'site.app.oufu.peiwan.',
    'site.app.peiwanlist.',
    'site.app.api.profile.peiwan.',
    'site.app.api.profile.voice.preview.',
    'site.components.profile.peiwanreviewmanager.',
    'site.components.profile.sentpeiwanreviewhistory.',
    'site.components.profile.voicepreviewmanager.',
    'site.components.home.peiwanrecommendations.',
    'site.constants.peiwan.',
    'bot.services.peiwanrolesyncservice.',
    'bot.services.peiwanreviewdisplayservice.',
    'bot.services.dlmpeiwancardsyncservice.',
    'bot.commands.lookselfslash.',
    'bot.commands.viewcardslash.',
    'bot.commands.getavatarslash.',
    'bot.interactions.buttons.lookselfdelete.',
  ] },
  { category: 'orders', prefixes: [
    'site.app.api.orders.',
    'site.components.home.dispatchticker.',
    'bot.ui.orderembeds.',
    'bot.dispatch.',
    'bot.presentation.completionnote',
    'bot.events.messagecreate.',
    'bot.services.order',
    'bot.services.timerservice.',
    'bot.interactions.buttons.minidispatch.',
    'bot.interactions.buttons.play.',
    'bot.interactions.buttons.acceptorder.',
    'bot.interactions.buttons.declineorder.',
    'bot.interactions.buttons.cancelorder.',
    'bot.interactions.buttons.endorder.',
    'bot.interactions.buttons.orderpriceselect.',
    'bot.commands.revertorderslash.',
  ] },
  { category: 'gifts', prefixes: [
    'site.app.profile.giftwall.',
    'site.app.profile.heart.',
    'site.app.api.profile.target.confirmation.',
    'site.components.profile.giftandselfusebuttons.',
    'site.components.profile.giftexecutionrecovery.',
    'site.components.profile.targetconfirmation.',
    'bot.services.gift',
    'bot.commands.gifting.',
    'bot.commands.giftslash.',
    'bot.commands.revertgiftslash.',
    'bot.features.giftfeedhelper.',
    'bot.interactions.selects.giftingselect.',
  ] },
  { category: 'wallet', prefixes: [
    'site.app.api.stripe.recharge.',
    'site.app.api.wechat.pay.',
    'site.app.recharge.',
    'site.app.wechat.pay.',
    'site.app.profile.withdraw.',
    'site.components.profile.withdraw',
    'site.lib.manual.wechat.',
    'site.lib.recharge.',
    'site.lib.withdrawaccounts.',
    'site.lib.transaction.display.',
    'bot.commands.cash.',
    'bot.commands.balancecommands.',
    'bot.commands.totalearn.',
    'bot.services.withdrawalnotificationservice.',
    'bot.services.adminwallettransactions.',
  ] },
  { category: 'benefits', prefixes: [
    'site.app.api.voucher.',
    'site.app.api.profile.vip.',
    'site.app.profile.bag.',
    'site.app.profile.point.shop.',
    'site.components.profile.discountusagebutton.',
    'site.components.profile.pointshopclient.',
    'site.components.profile.vip',
    'site.components.profile.voucherusebuttons.',
    'site.lib.vouchercatalog.',
    'bot.services.autocommissionbuffservice.',
    'bot.services.vipbenefitservice.',
    'bot.services.spentroleservice.',
    'bot.services.voicepointservice.',
    'bot.services.chatvoucherdropservice.',
    'bot.interactions.selects.discountselect.',
    'bot.commands.loyaltypoints.',
    'bot.commands.totalspent.',
    'bot.commands.grantcouponslash.',
    'bot.commands.renamecard.',
  ] },
  { category: 'games', prefixes: [
    'site.app.api.lottery.',
    'site.app.profile.lottery.fusion.',
    'site.components.profile.lotteryfusionclient.',
    'bot.services.lottery',
    'bot.services.redenvelopeservice.',
    'bot.commands.lottery',
    'bot.commands.redenvelope',
    'bot.commands.keywordredenvelope',
    'bot.commands.scratch',
    'bot.commands.blockstack.',
    'bot.ui.scratch',
    'bot.ui.blockstack',
    'bot.interactions.buttons.scratch.',
    'bot.interactions.buttons.blockstack.',
  ] },
  { category: 'support', prefixes: [
    'site.app.kefu.',
    'site.components.notifications.',
    'site.components.profile.noticebanner.',
    'site.components.siteannouncement.',
    'bot.commands.bulkdm.',
    'bot.commands.channelmessageslash.',
    'bot.commands.customergangslash.',
    'bot.services.notificationoutboxruntime.',
    'bot.services.guildnotificationdm.',
    'bot.server.internalwebhookserver.',
  ] },
  { category: 'assistant', prefixes: [
    'bot.assistant.',
    'bot.knowledge.',
  ] },
  { category: 'home', prefixes: [
    'site.app.page.',
    'site.app.console.',
    'site.components.footer.',
    'site.components.navbar.',
    'site.components.home.dlmhoverletters.',
    'site.components.home.rankingperiodcard.',
    'site.lib.home.page.data.',
    'site.lib.site.',
    'site.lib.public.error.messages.',
    'site.lib.mini.program.',
    'bot.services.publicerrormessages.',
    'bot.services.leaderboardservice.',
    'bot.services.bossdisplay.',
  ] },
];

const GROUP_CATEGORIES: Readonly<Record<string, CopyCategoryId>> = {
  '网站 · 登录绑定与换号': 'account',
  '网站 · 操作反馈': 'home',
  '网站 · 公会控制台与通知': 'support',
  '网站 · 农场': 'farm',
  '网站 · 入会与活动': 'onboarding',
  '网站 · 首页与公共导航': 'home',
  '网站 · 陪玩列表': 'peiwan',
  '网站 · 服务协议': 'policies',
  '网站 · 个人中心与资产': 'account',
  '网站 · 充值': 'wallet',
  '网站 · 通知与动态': 'support',
  '网站 · 入驻申请': 'onboarding',
  '网站 · 提现': 'wallet',
  '网站 · 首页': 'home',
  '派单与订单': 'orders',
  '名片、资料与入职': 'peiwan',
  '积分、券与权益': 'benefits',
  '真人试音': 'audition',
  '操作失败提示': 'home',
  '抽奖、刮卡与积木': 'games',
  '赠礼与撤销': 'gifts',
  '打赏与撤销': 'gifts',
  '充值、余额与提现': 'wallet',
  '智能助手与百科': 'assistant',
  '红包': 'games',
  '客服与运营工具': 'support',
  '网站与私信通知': 'support',
  '入群与邀请': 'onboarding',
  '名片与个人资料': 'peiwan',
  '赠礼与打赏': 'gifts',
  '打赏': 'gifts',
  '充值与余额': 'wallet',
  '名片与资料': 'peiwan',
  '会员与权益': 'benefits',
};

/** Stable source-path fallback for new entries whose key namespace is not yet mapped. */
const SOURCE_CATEGORIES: readonly [RegExp, CopyCategoryId][] = [
  [/(?:^|\/)(?:privacy|terms|recharge-policy|legal)(?:\/|\.)/, 'policies'],
  [/audition/i, 'audition'],
  [/(?:^|\/)farm(?:\/|config\.)/i, 'farm'],
  [/(?:\/accounts?\/|account[-_]?migration|discord[-_]?binding|mini-program-account|login|blacklist)/i, 'account'],
  [/(?:\/join\/|recruitment|inviteReward|welcomeMessage|openingBenefits)/i, 'onboarding'],
  [/(?:gift|\/heart\/)/i, 'gifts'],
  [/(?:recharge|withdraw|wallet|balanceCommands|transaction-display)/i, 'wallet'],
  [/(?:vip|voucher|coupon|pointShop|loyalty|commission|spentRole)/i, 'benefits'],
  [/(?:lottery|scratch|blockStack|redEnvelope)/i, 'games'],
  [/(?:\/assistant\/|\/knowledge\/)/i, 'assistant'],
  [/(?:order|dispatch|timerService)/i, 'orders'],
  [/(?:peiwan|voicePreview|viewCard|lookSelf)/i, 'peiwan'],
  [/(?:notification|\/kefu\/|noticeBanner|bulkDm|channelMessage|customerGang)/i, 'support'],
];

/** Only catalogue identity is read; customized draft strings never move an item between tabs. */
export function classifyCopyEntry(entry: EditableCopyEntry): CopyCategoryId {
  const key = entry.key.toLowerCase();
  const exact = categoryByKey.get(key);
  if (exact) return exact;
  for (const { category, prefixes } of NAMESPACE_CATEGORIES) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) return category;
  }
  const source = (entry.source ?? '').split(':', 1)[0];
  for (const [pattern, category] of SOURCE_CATEGORIES) {
    if (pattern.test(source)) return category;
  }
  return Object.hasOwn(GROUP_CATEGORIES, entry.group) ? GROUP_CATEGORIES[entry.group] : 'home';
}
