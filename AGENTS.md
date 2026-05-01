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
