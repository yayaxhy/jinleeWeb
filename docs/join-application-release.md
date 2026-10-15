# 入职申请正式版

官网入口为 `/join`，首页「申请陪玩入职」按钮已指向该页面。原 `/join/preview` 重定向至正式页。

## 部署顺序

1. 先部署 Bot 仓库中的入职接收接口，再部署网站。两边均运行 `npm run build`，按现有进程管理方式重启。
2. 网站继续使用现有 `INTERNAL_API_HOST`、`INTERNAL_API_PORT`、`INTERNAL_API_TOKEN`。Token 必须与实际目标 Bot 一致；Bot 的 `INTERNAL_ALLOWED_IPS` 必须允许网站服务器。
3. `NEXTAUTH_URL` 使用官网的正式 HTTPS 地址。登录复用现有 Discord OAuth 和签名会话。
4. Bot 默认发送至 HR 频道 `1560201774172995605`；可通过 `RECRUITMENT_HR_CHANNEL_ID` 显式覆盖。机器人需要查看频道、发送消息、嵌入链接、添加附件权限。
5. Bot 可配置 `RECRUITMENT_RECEIPTS_DIR` 为持久、私有、可写目录，默认工作目录下 `.recruitment-receipts`。不要放在静态资源目录，也不要在部署时删除。该接口由一个 Bot 进程处理；不要为同一接口启用多实例或滚动重叠运行。

本功能不新增数据库表，也不需要数据库迁移。网站和 Bot 均需更新，只更新网站不会启用接收功能。

## 行为与数据

- 必须登录 Discord；申请人的 Discord ID 取自服务器验证的会话，不能由表单冒用。
- 尚未考核、平移考核记录、已考核通过三选一。段位截图选填；名片图片必填；后两种申请分别要求相应记录。平移还要求来源公会。
- 个人简介保留 20 字、两行；原有表格内容与排版保留。
- 每栏仅一张图，不限制用户选择的原文件大小。浏览器会缩放、压缩后发送；每张传输图片最多 200 KiB，完整 JSON 请求最多 1 MiB。原文件不会另外上传或落盘。
- HR 收到表格 Embed、图片，以及包含全部文字资料的 `application.txt`。网页只有在 Bot 确认发送后显示成功提示，成功页面不显示申请编号。
- 同一内容重复提交会复用回执；同一账号更改内容后须间隔 10 分钟。发送失败保留当前页面资料，刷新或重新登录不会保留表单。
- 回执只记录账号 ID、内容摘要、状态、时间和 Discord 消息 ID；不保存申请正文或照片。申请正文和照片保存在 HR 的 Discord 消息中。

## 异常处理

出现「暂时无法确认发送结果」时，请申请人提供 `JOIN-…` 编号，由维护者查找私有回执中的 Discord ID、时间及消息 ID（若已保存），再与 HR 频道记录核对。Discord 消息和附件不显示申请编号。不要直接删除回执或自动补发，否则可能重复发送。网络中断后的短时间重试使用相同 Discord nonce 去重；超过 60 秒的未确认记录会转为人工核对。处理完成后，由维护者根据实际 Discord 消息更新对应回执。

接收服务不可用时，检查 Bot 是否运行、两端内部接口配置是否对应、频道权限和回执目录权限。日志不会输出申请正文和图片。

## 验证

网站：`node --import tsx --test lib/join-application.test.ts`、针对变更文件的 ESLint、`npm run build`。

Bot：`node --import tsx --test scripts/verify-recruitment.ts`、`npm run build`。

本地端到端验证使用模拟 Discord 会话和模拟 HR 发送器，覆盖未登录、必填错误、大图压缩、失败保留资料、重试成功和手机布局。测试不会启动 Bot 的数据库 watcher，也不会向 HR 频道发送测试资料。
