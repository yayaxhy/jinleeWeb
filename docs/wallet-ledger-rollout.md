# 原流水新增 deltaAmount：实施与历史回填

本方案只在现有 `IndividualTransaction` 增加可空的 `deltaAmount DECIMAL(19,4)`。不另建账本表，也不改写旧 `amountChange` 的金额、正负号或含义。正式执行数据库迁移、历史回填前，仍需按本次约定确认具体目标、SQL 和恢复步骤；代码完成不等于已经在业务库执行。

## 字段含义与旧数据

唯一新增的持久化金额字段：

```text
deltaAmount = balanceAfter - balanceBefore
```

正值表示该用户钱包增加，负值表示减少，零表示没有变动。旧行的 `NULL` 表示尚未回填，不能当作零；读端先取已有 `deltaAmount`，缺失时按原前后余额计算。

| 旧 amountChange | balanceBefore → balanceAfter | 新 deltaAmount | 旧字段处理 |
| --- | --- | --- | --- |
| 50 | 100 → 50 | -50 | 原样保留 50 |
| -50 | 100 → 50 | -50 | 原样保留 -50 |
| 50 | 50 → 100 | 50 | 原样保留 50 |
| 52 | 0.02 → 0 | -0.02 | 原样保留 52，报告面额差异 |

旧的 ¥52 面额与 ¥0.02 实际变化不一致，不妨碍填入真实差额；回填不会猜测 ¥52 应改成什么，也不会补扣、补款或重放原业务。原钱包、订单、券、身份、原流水时间和其他金额字段均保留。收入/充值分项、业务关联和幂等键不新增数据库列，也不把无法证明的历史分项填成零。

算术相符只表示字段之间一致，不代表银行对账、流水连续性、消费资格或平台财务全部正确。此前审计数字只能在核对数据库目标摘要后归属于相应环境；不得把回填完成等同于全账审计完成。

## 新流水与消费统计

数据库 BEFORE INSERT 触发器自动为所有新来源填入 `deltaAmount`，覆盖旧机器人、旧网站、直接 SQL 和批量 INSERT。已接入的应用写入器仍在原业务事务中执行钱包变动、流水写入及快照校验，失败整体回滚。充值、点单、券使用等原有业务状态和幂等检查继续负责防重复；新字段没有额外的持久化幂等键。

当旧程序修改前后余额并保持原 delta 未动时，触发器重新推导差额；显式提供与余额不一致的非空 delta 会失败。只改身份的账号合并不触发历史补齐。可空 CHECK 约束先以 NOT VALID 添加，以免迁移扫描全部历史；它仍约束随后写入或更新的行。回填完成后的全表约束验证属于独立、需确认的数据库操作。

网站充值、优惠返利、积分兑换及提现使用同事务的钱包锁与前后快照，防止并发操作记录过期余额。机器人现金充值/扣款的原有报表与钱包操作保持原子提交。

`deltaAmount` 是钱包变动，不直接等于消费。消费读取必须同时满足对应业务类型和实际扣款方向；同名“点单”“打赏”的陪玩收入不能计入老板消费。退款、返利只在相应场景的既定规则内冲减消费。充值、提现、收入、账户迁移也不能仅因金额符号被归类为消费。开业活动与榜单等场景按其各自已确认的范围读取，不能用全表负数总和替代规则。

个人页/VIP/邀请资格使用的持久化 `totalSpent` 不会因本次回填被重新计算。月结余额链重建仍依据原前后余额，Expense、Coupon 等经营报表保持原有口径；不得将所有 delta 汇总为平台收入、支出或利润。机器人 `!realcash` 只调整分项、没有原流水，本次字段不能补出这类缺失的历史分项记录。

### 读取端与最终口径清单

网站 `lib/transaction-activity.ts` 与机器人 `src/services/transactionActivity.ts` 采用相同分类规则；各自查询的类型白名单也来自对应 policy，避免数据库漏取返利撤销后再计算。下表列出当前实际接入点，时间窗口、账号排除和既有权益判断仍由各调用方处理。

| 读取场景 | 实际读取与分类 | 明确保留的边界 |
| --- | --- | --- |
| 开业活动周消费：`lib/opening-benefits.ts` | `OPENING_SPEND_POLICY`：点单、打赏、客服代打赏、红包发出、试音花费 5 类的实际扣款；减去订单撤销、打赏撤销、红包退回、优惠返利的到账；加回优惠返利撤销的实际扣款 | 不含抽奖消费；陪玩收入及其撤销不算老板消费；按原活动周窗口累计，最终不低于零 |
| Web/Bot 日、周、月消费榜：`lib/home-page-data.ts`、`src/services/leaderboardService.ts` | `NET_LEADERBOARD_SPEND_POLICY`：上述 5 类加抽奖消费，共 6 类；退款、返利及返利撤销与开业活动采用同一净额方向规则 | 开业活动排除抽奖的规则不扩展到榜单；充值、提现、迁移、邀请提成和未知扣款不纳入消费 |
| 未绑定 Discord 的微信老板榜：同上两个榜单模块 | 按 `dlmId` 汇总相同的 6 类净消费 policy | 不因没有 Discord 丢掉消费；已绑定账号仍按既有规则避免重复展示 |
| 陪玩收入榜：同上两个榜单模块 | `LEADERBOARD_INCOME_POLICY`：点单、打赏、客服代打赏、红包收入、试音收入 5 类到账；减去订单/打赏撤销对陪玩的扣回 | 自己购买服务的扣款不算收入；充值、优惠返利不算工作收入；与消费榜分别计算 |
| 自动佣金福利：个人页及 Bot `src/services/autoCommissionEvaluation.ts` | `AUTO_COMMISSION_INCOME_POLICY`：点单、打赏、客服代打赏、红包收入 4 类到账，减去订单/打赏撤销扣回 | 不含试音收入；原资格窗口、继承权益和已排除的迁移流水继续生效，不改成消费达标活动 |
| 个人/后台流水、导出与小程序流水 | 通过 `resolveWalletDelta` 读有符号 delta；旧空值回退前后余额差 | 这是收支展示，不应用消费白名单；小程序旧 `amount` 保留原值，另给出 `walletDelta` |
| 财务页面、财务导出与月结检查 | 已接入的优惠返利、刮刮乐购卡、月结钱包变动和提现对账使用 delta | 不重写已确认月报；原余额链、Expense/Coupon 分类和经营利润计算不替换成全量 delta 汇总 |

例如，同一个陪玩账号本期接单收入 ¥3,000、自己点单实际支付 ¥1,000、收到优惠返利 ¥50，开业活动和净消费榜只计 **¥1,000 − ¥50 = ¥950**。若这笔订单随后全额退回 ¥1,000，并扣回该返利 ¥50，则净消费为 **¥1,000 − ¥50 − ¥1,000 + ¥50 = ¥0**；接单赚到的 ¥3,000 始终不混入消费。例子假定这些事件均在同一统计窗口内，跨窗口仍按原窗口规则处理。

持久化 `totalSpent`、VIP、邀请资格、原 bonus/奖励发放和奖励核销范围不因以上读取归一化被重算或扩大。此清单也不表示所有历史累计字段都已按新口径追溯重建。

## 旧方案归档与环境边界

新的迁移为：

```text
prisma/migrations/20261030130000_add_transaction_delta_amount/migration.sql
```

之前的独立 `WalletLedgerEntry` 方案未在已核对的目标应用，其 SQL 原样保存在：

```text
docs/archive/20261030120000_add_wallet_ledger.sql
```

归档文件不再是待执行迁移，不应手工运行。新迁移遇到已存在 `WalletLedgerEntry` 的环境会中止；它不会删除、清空或自动转换已应用旧方案的其他环境。此类环境应单独核对历史和数据后制定转换计划，不能套用本说明的直接上线顺序。

网站和机器人共享数据库时，新迁移只执行一次。两仓库既有迁移历史不同，不覆盖完整 schema，不直接部署两边所有 pending migrations。

## 上线顺序

### 1. 确认目标与只读审计

保存当前发布版本、配置和可恢复的数据库备份，核对网站、机器人及 watcher 实际连接的库。不要把 watcher 的替代连接自动当成主要账务库。

```bash
node --import tsx scripts/wallet-ledger-audit.ts --env-file .env.local
node --import tsx scripts/wallet-ledger-backfill.ts --env-file .env.local
```

第二条未传 `--apply` 只预览。两者在 READ ONLY、REPEATABLE READ 事务内审计，有语句和锁等待超时；迁移前也可运行，报告 `deltaColumnPresent=false`。

脚本在导入 Prisma 前选择配置：真正从启动环境继承的 `DATABASE_URL` 优先，否则只读取指定文件，未指定则读取 `.env.local`。不回退到 Prisma 隐式加载的 `.env`。既有 `psql 'postgresql://…'` 包装只提取 URL，不执行命令；校验后显式传给 Prisma。空值或坏值直接失败，不尝试其他数据库。

输出 `target` 只含主机、端口、数据库名、schema、配置来源，不含用户名、密码或连接串。审计输出包括精确十进制字符串、按类型分组、身份链接数量、原金额异常及对应行 ID；不是用户账户明细。

必须检查：

- `invalidSourceMoney=0`：无非有限金额或超出 DECIMAL(19,4) 的派生差额。
- 加列后 `compatibleColumnType=true`，触发器与约束处于预期状态。
- `coverage.deltaMismatch=0`：已有非空 delta 与前后差一致。
- `magnitudeMismatch` 仅报告旧 amountChange 面额差异，不据此重写旧值或拒绝填入正确差额。

NaN、无限值或溢出需要单独核对原业务事实，不能改为零或截断。存在这类值时 `--apply` 在第一批前失败；每批锁定后会再次检查。已有错误非空 delta 也立即失败并提供对应 ID，绝不覆盖。

### 2. 执行经过确认的定向迁移

**必须先加列，再部署使用新 Prisma Client 的代码。** 新标量会被 Prisma 默认查询选中，关闭旧开关不能避免缺列错误。本方案不再使用 `WALLET_LEDGER_READ_ENABLED` 或 `WALLET_LEDGER_WRITE_ENABLED`。

Prisma 原生命令不会剥离 psql 包装。以下 `APPROVED_PLAIN_URL_ENV` 须替换为已审查、仅保存纯 URL 的配置文件路径；文件应仅允许操作者读取，不输出连接串。清除继承的 DATABASE_URL，避免目标被外部变量替换：

```bash
env -u DATABASE_URL node --env-file=APPROVED_PLAIN_URL_ENV node_modules/prisma/build/index.js db execute \
  --schema prisma/schema.prisma \
  --file prisma/migrations/20261030130000_add_transaction_delta_amount/migration.sql
```

此 DDL 只加列、函数、触发器及约束，不回填旧行。完成后只登记这一条迁移：

```bash
env -u DATABASE_URL node --env-file=APPROVED_PLAIN_URL_ENV node_modules/prisma/build/index.js migrate resolve \
  --schema prisma/schema.prisma \
  --applied 20261030130000_add_transaction_delta_amount
```

`migrate resolve` 也写数据库，属于同次需确认的操作。不得用它跳过失败的 DDL、登记归档的旧方案或标记其他未审查迁移。

### 3. 生成客户端并发布

加列成功后，两端使用对应 schema 生成 Prisma Client，发布兼容新字段的代码。旧程序在滚动发布期间仍可正常写原流水，数据库触发器会填入 delta。新程序对尚未回填的旧行按原余额差读取，不要求先一次性改完历史。

检查正常充值、消费、返利、退款、提现与重试：新行 delta 符合前后差、旧 amountChange 未改变、重复请求未多扣或多充，失败操作钱包与流水一同回滚。

### 4. 有界历史回填

从预览结果取得高水位，再用已确认的数据库名执行小批量：

```bash
node --import tsx scripts/wallet-ledger-backfill.ts \
  --env-file .env.local \
  --apply --confirm-database DATABASE_NAME \
  --batch-size 1000 --max-batches 5 \
  --through-id APPROVED_HIGH_WATER_ID
```

占位符必须替换为实际审查值。脚本再次核对 current_database()、列类型与数据库保护，再按 ID 有序锁定每批来源行。唯一数据写入为：

```sql
UPDATE "IndividualTransaction"
SET "deltaAmount" = "balanceAfter" - "balanceBefore"
WHERE "transactionId" IN (本批参数化ID)
  AND "deltaAmount" IS NULL;
```

已有非空正确 delta 保留；原金额差异仅报告。脚本不更新钱包、旧金额、前后余额、归属、订单或券。相同批次重跑会跳过已填字段，不新增流水。

每批提交成功后才输出 `filled`、`afterId` 和 `throughId`。Ctrl-C 等待当前批次结束再给出续跑位置；提交阶段失败只报告此前已提交游标。

```bash
node --import tsx scripts/wallet-ledger-backfill.ts \
  --env-file .env.local \
  --apply --confirm-database DATABASE_NAME \
  --batch-size 1000 --max-batches 5 \
  --after-id LAST_COMMITTED_ID --through-id APPROVED_HIGH_WATER_ID
```

`complete=false` 表示被中断或达到批次上限，需要续跑。高水位仅限制本轮扫描范围，不代表业务时间顺序；新增流水由触发器填值。回填结束重新全量只读审计，要求 missingCount=0、deltaMismatch=0、storedDeltaAmount 与 derivedDeltaAmount 一致，并核对原流水和钱包没有改变。

## 验证与恢复

本轮代码回归记录：Web 共 72 项独立测试通过，Bot 共 129 项通过。当前原表方案的隔离 SQL 套件 8 组、真实 Prisma 套件 7 组及回填 CLI 套件 6 组均通过，测试容器已清理。用户已明确确认各功能保留各自消费项目，统一按扣除退款和返利后的净消费统计。本次验证没有执行业务库迁移或回填。

纯测试不连接数据库：

```bash
node --import tsx --test lib/wallet-ledger.test.ts lib/wallet-ledger-backfill.test.ts
```

隔离 PostgreSQL 测试需要明确授权测试夹具写入，不能指向实际业务库：

- `node scripts/test-transaction-delta-postgres.mjs`：新建隔离容器验证 SQL 约束与触发器。
- `node scripts/test-transaction-delta-prisma.mjs`：新建隔离容器验证真实客户端、并发锁及事务回滚。
- `node scripts/test-wallet-ledger-cli.mjs`：需要显式 `WALLET_LEDGER_TEST_CONTAINER`、`WALLET_LEDGER_TEST_DATABASE_URL`。只接受专用 ledger_test 库、127.0.0.1 非默认端口，并核对实际 Docker 端口，建立独立 schema 后清理。

CLI 场景覆盖迁移前预览、配置优先级、错误目标拦截、仅填新列、批次续跑、重复执行、提交失败游标、旧面额不变、异常非空 delta 拒绝覆盖。取得用户仅限一次性本地 PostgreSQL 测试库的明确授权后，本版本 CLI 套件已实际运行并全部通过；原字段及模拟钱包的前后快照一致，测试 schema、临时配置文件和整个测试容器均已删除。该授权不包含任何业务数据库写入。

回滚优先恢复原兼容代码，保留新增列和已填数据。旧客户端不要求新列消失，触发器仍能维护新写入。不要删除字段、清空旧流水、回放旧请求或重新结算来回滚。若要停用触发器、修正原财务事实或转换已应用旧方案的环境，先提出独立 SQL 和恢复计划。
