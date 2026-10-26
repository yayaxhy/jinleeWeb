# Project Context

## Repo Role
- This repo is a Next.js app. `package.json` name: `jinlee-club`
- Related bot repo: `/Users/user/Documents/GitHub/Bot`

## Verified Structure
- App routes and pages live under `app/`
- Shared UI lives under `components/`
- Server/business logic lives under `lib/`
- Prisma schema lives under `prisma/schema.prisma`

## Verified Cross-Repo Facts
- `/Users/user/Documents/GitHub/jinleeWeb/prisma/schema.prisma` and `/Users/user/Documents/GitHub/Bot/prisma/schema.prisma` are currently identical
- Both schema files use PostgreSQL with `env("DATABASE_URL")`
- The two repos' `prisma/migrations/` directories are not identical; do not assume full migration parity
- The bot starts `startInternalWebhookServer()`, `startPeiwanWatcher()`, and `startRechargeWatcher()` from `/Users/user/Documents/GitHub/Bot/src/index.ts`
- `rechargeWatcher` resolves DB in this order: `RECHARGE_DATABASE_URL` -> `WITHDRAW_DATABASE_URL` -> `DATABASE_URL`
- `peiwanWatcher` resolves DB in this order: `PEIWAN_DATABASE_URL` -> `WITHDRAW_DATABASE_URL` -> `DATABASE_URL`

## Verified Web Areas
- Discord login and binding: `app/api/discord/*`, `app/api/auth/callback/discord/route.ts`, `app/accounts/discord/*`, `lib/discord.ts`, `lib/discord-binding.ts`
- WeChat payment: `lib/wechat-pay.ts`, `app/wechat/pay/*`
- Recharge/ZPay: `app/api/recharge/order/route.ts`, `lib/zpay.ts`
- Withdrawals: `app/api/withdraw/route.ts`
- Voucher and lottery use: `app/api/voucher/use/route.ts`, `app/api/lottery/use/route.ts`
- Admin peiwan role sync: `app/api/admin/peiwan/[discordId]/sync-roles/route.ts`, `app/api/admin/peiwan/sync-roles-all/route.ts`

## Verified Internal API Usage
- `app/api/withdraw/route.ts`
- `app/api/voucher/use/route.ts`
- `app/api/lottery/use/route.ts`
- `app/api/admin/peiwan/[discordId]/sync-roles/route.ts`
- `app/api/admin/peiwan/sync-roles-all/route.ts`
- These routes read `INTERNAL_API_HOST`, `INTERNAL_API_PORT`, and `INTERNAL_API_TOKEN`
- In the web repo, `INTERNAL_API_HOST` defaults to `127.0.0.1` where used

## Verified Env Usage
- Local env file present in this repo: `.env.local`
- Discord auth code reads `NEXTAUTH_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `DISCORD_GUILD_ID`
- WeChat payment code reads `WECHAT_PAY_*`
- ZPay code reads `ZPAY_*`
- Admin Discord IDs are currently hardcoded in `lib/admin.ts`; they are not read from `ADMIN_DISCORD_IDS`

## Verified Commands
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## Deployment Files
- `ecosystem.config.cjs` runs the production app with `npm start -- --hostname 127.0.0.1 --port 3000`
- `docs/deploy-next-behind-nginx.md` documents the PM2 + Nginx setup

## User Rule
- Without explicit user permission, treat database access as read-only
- Do not run migrations, seed scripts, mutation scripts, or bot startup paths that create or alter database objects without explicit user permission

## 用户文案审批规则

- 所有面向用户的文案展示，包括网页、Discord 消息、私信、按钮、标题、提示和错误信息，在新增、修改、删除或改变展示条件前，必须先向用户提供具体文案及展示场景，并取得用户明确同意。
- 用户在当前任务中明确指定或已经确认的具体文案，视为已获同意；严格按确认内容执行，无需重复询问，不得自行扩展或改写。
- 功能开发、问题修复、测试或推送授权，不等于文案修改授权。未获同意时保留原有文案，不得自行增加“演示”“测试”“仅展示”等提示或其他说明。
- 恢复旧文案时，只恢复明确对应的原文，不自行创作替代内容。新增功能没有原文或旧文案与已确认规则冲突时，先列出具体内容交由用户决定。
- 陪玩资料更新私信保留用户已确认的粗体标题“陪玩资料已更新”、标题后的空行及原正文。

## 当前实施范围

- 按用户 2026-10-26 的最新决定，恢复原有日常业务流程，仅保留新增的可自定义文案功能；不再以商业化为由扩展业务判定、管理入口或人工核实步骤。
- 用户随后明确保留后台完整账号合并：恢复该后台功能及必要的历史、权益和角色配套，仅允许 Discord 用户 `525770714574225408` 使用；个人页自助换号及迁移历史入口继续撤下。
- 已持久化额度、账号归属和账务记录的最小兼容读取必须保留，不删除历史业务数据，不重新执行旧请求。
- 其他任务的改动、独立修复及用户直接指定的既有业务规则不随功能收缩覆盖。
