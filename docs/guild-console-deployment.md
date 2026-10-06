# 公会工作台上线清单

`/console` 使用现有 Discord 账户会话和同一套 DLM 钱包、订单、派单、聊天数据；它不是独立的测试账户系统。

## 数据库

`20261005000000_guild_notification_center` 同时存在于 Web 和 Bot 仓库，因为两者共用同一个数据库。对生产数据库**只部署一次**，任选一个仓库执行迁移即可；不要在两个服务中重复执行。

该迁移增加通知中心表、浏览器订阅表、通知邮箱设置，以及 `SUPPORT` 客服会话类型。先完成迁移，再部署 Web 与 Bot 代码。

## Web 环境变量

- `SITE_ORIGIN`：正式站点 URL，例如 `https://dlmclub.com`。
- `INTERNAL_API_TOKEN`：与 Bot 内部 API 一致的强随机密钥。
- `WEB_INTERNAL_NOTIFY_TOKEN`：Bot 向 Web 写入通知事件的密钥；可以独立设置，未设置时 Web 回退使用 `INTERNAL_API_TOKEN`。
- `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT`：PWA Push 使用。通过 `npx web-push generate-vapid-keys --json` 生成；`NEXT_PUBLIC_VAPID_PUBLIC_KEY` 必须与 `VAPID_PUBLIC_KEY` 相同。
- `RESEND_API_KEY`、`NOTIFICATION_FROM_EMAIL`：启用通知邮件所需。未配置时，邮件投递会在通知中心明确标为跳过，不会影响订单或入账。

### 微信网页扫码登录

网页端登录使用微信开放平台的“网站应用”，不是小程序 AppID 或微信支付 AppID。上线前需要：

1. 在微信开放平台创建/启用网站应用，将网站授权回调域配置为正式 HTTPS 域名（例如 `dlmclub.com`）；本系统实际回调地址为 `https://dlmclub.com/api/auth/callback/wechat`。
2. 将该网站应用和当前小程序绑定到同一个微信开放平台主体/账号体系，以便两端登录返回相同的 `unionid`。
3. 在 Web 服务设置 `WECHAT_WEB_APP_ID` 和 `WECHAT_WEB_APP_SECRET`，并保留正确的 `SITE_ORIGIN`。

系统只在首次网页登录拿到 `unionid` 时才会创建或关联 DLM 账户：已有小程序账户会自动复用余额、订单和资料；若微信没有返回 `unionid`，页面会停止登录并提示配置问题，绝不会新建一个余额分离的账户。Bot 不需要这两个密钥，但 Web 与 Bot 都必须更新 Prisma Client，以识别新增的 `WECHAT_WEB` 身份提供方。

## Bot 环境变量

- `WEB_INTERNAL_NOTIFY_URL=https://你的站点/api/internal/notifications/events`
- `WEB_INTERNAL_NOTIFY_TOKEN`：与 Web 的同名变量一致；未设置时 Bot 回退使用 `INTERNAL_API_TOKEN`。
- 已有的 `INTERNAL_API_TOKEN`、`INTERNAL_API_BIND_HOST`、`INTERNAL_API_PORT` 继续用于 Web 调用 Bot 的正式订单流与 Discord DM 投递。

## 部署顺序与验收

1. 备份生产数据库并部署一次共享 Prisma 迁移。
2. 将 Web 和 Bot 的内部通知密钥与 URL 配对，再部署两端。
3. 配置微信开放平台和上述两个网页登录环境变量；用已有小程序老板扫码，确认进入同一份余额和订单，再用未绑定 Discord 的微信账号验证可进入 `/console`。
4. 用一个已绑定 Discord 的测试老板和陪玩，完整验证：创建订单、陪玩接受、老板取消、人工余额入账与 Stripe 充值。
5. 在 `/console` 点击“通知”开启浏览器推送，并设置通知邮箱；分别确认 Discord DM、网页 Push、邮件和通知中心记录。
6. 使用 `/admin/support` 回复一次客服会话，确认用户工作台消息与小程序订阅通知均收到；同一页面的“通知投递异常”面板应为空。

为处理短暂的 Discord、邮件或 Push 服务不可用，请以部署平台的安全定时任务每 5 分钟调用一次 `POST /api/internal/notifications/retry`，并在 `X-Internal-Token` 中传入 `WEB_INTERNAL_NOTIFY_TOKEN`（或回退的 `INTERNAL_API_TOKEN`）。该任务最多重试 24 小时内、每个渠道少于三次的失败投递。

任何单个通知渠道失败都不会回滚订单状态或余额账本；对应失败原因会保留在投递记录中。客服可在 `/admin/support` 查看近 24 小时的失败或待投递渠道，并手动触发一次受权限保护的重试。
