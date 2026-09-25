# 点了么娱乐公会 / DLMClub 品牌切换

## 本次代码变更

- 主域名：`https://dlmclub.com`；品牌常量集中在 `lib/site.ts`。
- 首页、七字母动态标题 `DLMCLUB`、导航、页脚、个人中心、管理后台、积分与福星文案、协议页、陪玩列表、加入我们页面同步改名。
- 网站标题、描述、Open Graph / Twitter、Organization / WebSite 结构化数据、canonical、sitemap 和 robots 改用新品牌与域名。
- 原始 Logo：`public/DLMLOGO.png`。用于导航、匿名头像、重铸页面和结构化数据。
- 分享图：`public/og-dlmclub-logo.png`（1200×630）；浏览器图标：`app/favicon.ico`；Apple 图标：`app/apple-icon.png`。
- `npm run brand:assets` 只做原图的等比例尺寸和格式导出，不重绘、不裁切。旧 favicon 保存在 `docs/branding/legacy/favicon-jinlee.ico`，旧分享图及其他素材没有删除。
- Discord 邀请：`https://discord.gg/7zrsT2ysYd`。
- Discord 客服：`1552030874076315777`；桌面客户端唤起失败时转到同一用户的网页版资料页，而不是旧邀请链接。陪玩入职联系人单独保留。
- 微信支付默认描述：`点了么娱乐公会账户充值`；ZPay 默认站点名：`DLMClub`。显式环境变量仍有优先权。
- Bot 的感谢、积分、虚拟币、福星及客服通知改名；网站入口改用新域名；福星通知附件改用新 Logo；客服提及默认指向新客服。

## 明确保留的内容

不修改数据库结构、会员 ID、`jinleeId` / `JinleeUser` 等内部字段、会话 Cookie 名称、金额、抽成、奖励数值、业务权限和 Discord 角色 ID。

“锦鲤”等 VIP 等级、恋爱等级、作物“锦鲤花”和“锦鲤附体”祝福语不是本次品牌字段，暂时保留。数据库里的历史订单、礼物及图片不做批量改写。

运营主体、统一社会信用代码、备案号、微信客服、负责人邮箱及协议的业务条款均未变更。域名的备案或商户平台登记状态未在此次代码调整中核实。

Bot 的其他通知动图、VIP 图片和临时 Discord 附件地址不在这次 Logo 替换内；相关待处理项见 Bot 仓库已有的 `docs/discord-guild-image-replacement-list.md`。

## 2026-09-25 线上环境只读核对

检查对象：网站服务器 `43.131.41.173` 上 `/root/jinleeWeb/.env` 的以下公开配置项；未读取或输出密钥、商户私钥、数据库连接串。这里记录的是文件内容，不等同于已验证运行进程的实时环境。

| 配置 | 线上文件当前值 | 新域名正式切换时的目标 |
| --- | --- | --- |
| `NEXTAUTH_URL` | `https://jinleeclub.vip` | `https://dlmclub.com` |
| `SITE_ORIGIN` | `https://jinleeclub.vip` | `https://dlmclub.com` |
| `ZPAY_PRODUCTION_ORIGIN` | `https://jinleeclub.vip` | `https://dlmclub.com` |
| `ZPAY_NOTIFY_URL` | `https://jinleeclub.vip/api/payment/zpay/notify` | `https://dlmclub.com/api/payment/zpay/notify` |
| `ZPAY_RETURN_URL` | `https://jinleeclub.vip/recharge/result` | `https://dlmclub.com/recharge/result` |
| `WECHAT_PAY_NOTIFY_URL` | `https://jinleeclub.vip/api/payment/wechat/notify` | `https://dlmclub.com/api/payment/wechat/notify` |
| `WECHAT_PAY_ORDER_DESCRIPTION_PREFIX` | `锦鲤俱乐部账户充值` | `点了么娱乐公会账户充值` |
| `ZPAY_SITE_NAME` | 文件未显式设置 | `DLMClub`（或使用新代码默认值） |

本地 `.env` 和 `.env.local` 的微信支付展示名已更新。其他本地回调/域名配置没有自动切换。生产环境没有写入或重启，Bot 的生产环境覆盖值也尚未核对。

## 发布前与发布后检查

1. 两个仓库均有本次任务之前的未提交修改。先确认要发布的改动范围，不能直接把整个脏工作区覆盖到服务器；保存现有代码和配置备份。
2. 新域名 HTTPS 已单独配置，旧域名证书和站点仍保留。不要直接把旧域名所有请求重定向到新域名：待完成的支付回调仍可能投递到旧地址。
3. 在 Discord 应用后台登记实际使用的新域名回调地址，再切换 `NEXTAUTH_URL`。项目包含登录、绑定和迁移等入口，应逐一核对代码中的 redirect URI；此文不表示后台白名单已配置。
4. 核对微信/ZPay/Stripe 后台域名、回调及展示名称。不要改商户号、AppID、密钥、订单号前缀或支付金额；支付平台上的产品名称和收款主体不是网站文案，需单独审核。
5. 按上表备份并逐项更新网站生产环境；核对 Bot 的 `SUPPORT_STAFF_USER_ID=1552030874076315777` 和 `PROFILE_PERSONALISATION_URL=https://dlmclub.com/profile?tab=profile-personalisation` 等显式覆盖值。当前没有修改 Bot 线上配置。
6. 网站需要重新构建并按实际部署方式重启 PM2 进程（线上观察到名称为 `jinlee`，不能直接照搬文档中的 `jinlee-web`）。Bot 需要编译和发布新图片；不要在未获明确许可时运行 Bot 启动流程，其 watcher 可能创建数据库触发器。
7. 验证首页、个人中心、后台、客服入口、邀请链接、分享图片、favicon 和 sitemap；使用授权测试账号完成登录及支付回调验证，不凭页面展示断言支付已打通。
8. 旧域名及支付回调兼容应保留到旧订单和旧入口不再依赖后再单独安排下线。

## 验证状态

- 网站单元测试和品牌回归测试：26 项通过；Bot：20 项通过。
- 网站生产构建、Bot TypeScript 构建通过；没有启动 Bot 或执行数据库迁移。
- 本次修改文件的 ESLint：无错误，农场组件有两条原有未使用函数警告。
- 全量 ESLint 仍有原有错误：`components/admin/RevenueTimeRangeActions.tsx:50` 使用 `<a>` 导航到站内页面；该文件不在本次修改范围内。
- 本地页面预览使用不可连接的本地数据库地址，避免触碰真实业务数据；排行榜为空，不能视作数据链路验证。
