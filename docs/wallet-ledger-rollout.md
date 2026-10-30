# 钱包标准账本：上线与历史回填

本文对应 `20261030120000_add_wallet_ledger`。代码和迁移文件可先审查、测试；**执行正式数据库迁移或 `--apply` 回填前，需要用户按本次约定确认具体目标数据库、SQL 和回滚步骤**。本文件不代表已经执行过正式迁移、回填或上线。

## 数据含义与边界

`IndividualTransaction` 保留原有兼容记录和 `amountChange` 语义。机器人旧入口通常写金额绝对值，网站部分入口写带正负号的金额；本次不统一改写该字段，因为订单、打赏撤销还依赖它验证原始业务金额。

`WalletLedgerEntry` 保存不可修改的余额事实，一条来源流水至多对应一条标准账本记录。核心恒等式为：

```text
walletDelta = balanceAfter - balanceBefore
businessAmount = abs(IndividualTransaction.amountChange)
direction = CREDIT / DEBIT / NONE
```

金额使用 PostgreSQL `DECIMAL(19,4)` 和 Prisma Decimal，统计保持四位小数精度。`incomeDelta`、`rechargeDelta`、`totalSpentDelta`、`loyaltyPointsDelta` 只有提供真实前后快照时才填写。历史记录缺少这些快照时保留 `NULL`，含义是未知，不是零。

`VERIFIED` 仅表示金额绝对值与余额变化在算术上相符且有身份信息，**不代表已经完成银行对账、流水连续性检查或业务资格审计**。此前 87,529 条流水中 87,528 条金额匹配的统计也仅说明这一点，不能称为全量历史账务已验证。实际行数以执行时的只读审计为准。

`REQUIRES_REVIEW` 保留金额不一致的历史事实，例如旧“订单撤销”业务面额 ¥52、实际余额减少 ¥0.02。原记录和钱包不变。没有可用身份的记录标记为 `UNVERIFIABLE`。异常清单只输出到运维审计结果，本次不新增用户页面提示或人工核实业务流程。

用户钱包增加不等于平台收入，钱包减少不等于平台支出。充值、陪玩收入、退款、分红、Coupon 成本等继续遵循既有财务报表分类。不得把所有 `walletDelta` 直接相加作为收入、支出或净利润；不得通过本次回填重开订单、补发券、重新通知、重新结算或覆盖已确认月报。

## 原子写入与账号合并

新的应用写入器在原有业务事务内先写兼容流水，再写 `LIVE` 标准记录。钱包更新、兼容流水和标准记录一起提交或一起回滚；校验失败不能吞掉异常后继续提交。业务原有的支付回调、订单状态、券状态及请求幂等检查必须发生在变动钱包前。账本 `idempotencyKey` 唯一约束提供额外保护，不代替这些业务检查。

网站充值、优惠返利、积分兑换和提现在同一事务中按 `DlmUser → Member` 顺序锁定当前钱包、复核账号归属，再读取余额/分项快照并执行限额或余额判断。这样并发操作记录的是锁定后的真实前后余额。隔离测试验证了同一账号 6 笔并发充值形成连续余额链，以及余额不足以支付两笔时仅有一笔并发扣款提交。

迁移还安装延迟到事务提交时运行的来源流水 INSERT 触发器。旧版网站、机器人、批量 INSERT 或未改造入口提交来源流水时，会自动生成 `COMPATIBILITY` 记录；如果应用已经写入 `LIVE` 记录，则校验一致性而不重复创建。触发器不会扫描或回填旧记录。

标准账本中的 `dlmId`、`discordId`、`counterpartyId` 是历史身份快照，没有指向 `DlmUser` 或 `Member` 的外键。当前账号归属通过 `sourceTransactionId` 关联原流水来读取，完整账号合并仍可重分配原流水归属并删除旧账号。不得把标准账本快照当作账号合并后的当前 owner，也不得批量重写它。审计单独列出身份快照变更数，不把合理账号合并判成金额不一致。

标准记录禁止 UPDATE、DELETE 和 TRUNCATE。历史修正需要另行确定独立调整记录；本次脚本不会修改原账、钱包或旧的账本项。`reversalOfSourceTransactionId` 可在原账本项尚未回填时保留来源关联，`reversalOfLedgerId` 只引用已存在的标准账本项。

## 后续金额功能的开发约定

- 写入使用网站 `recordWalletTransaction` 或机器人 `recordIndividualTransaction`，并与钱包更新放在同一事务中。先按既有业务行顺序锁定钱包，再读取前后快照；不能用事务外读到的余额拼接流水。
- 新功能读取收支方向使用 `resolveWalletDelta`，查询时带 `walletLedgerRelationSelection`。不得直接用旧 `amountChange` 的正负判断收入/消费，也不得仅凭“余额减少”把提现、资产转出计为活动消费；业务类型、退款和活动时间规则仍需单独筛选。
- 新数据默认要求业务金额绝对值等于钱包变动绝对值。确有两者不同的已确定业务时才提供 `expectedWalletDelta`，不能把它作为绕过校验或掩盖陈旧快照的方式。
- 真实未知的分账户变化保留 `NULL`。新增分账户功能必须明确它的审计来源；不能因为总余额未变就认为没有需要记录的分账户变化。
- 支付回调或请求重试先检查原业务状态；幂等键碰撞必须使整笔事务回滚。不要捕获数据库写入异常后继续提交钱包，也不要通过重新执行历史业务来生成账本。
- 当前账户查询沿用来源流水归属，历史身份快照只用于审计。新增报表应明确使用钱包变动、充值现金、经营收入或券成本中的哪一种口径，并分别测试正常、退款、重试与账号合并场景。

## 发布开关

网站与机器人分别配置以下环境变量。未设置、空字符串或 `0` 都按关闭处理，只有 `1` 开启。

| 开关 | 关闭时 | 开启时 |
| --- | --- | --- |
| `WALLET_LEDGER_WRITE_ENABLED` | 应用仍只写原流水；已迁移的数据库在提交时自动生成兼容标准记录 | 应用在同一事务主动生成含可用分项快照、关联信息的标准记录 |
| `WALLET_LEDGER_READ_ENABLED` | 共享金额函数从原流水前后余额推导实际变动，不查询新表 | 查询来源流水关联的标准记录；尚未回填的历史行仍按前后余额兼容读取 |

迁移前两端必须保持两个开关关闭。新表不存在时不得打开任一开关。生成 Prisma Client 不需要数据库迁移，但生成后仍需保持开关关闭；普通查询不会因为新增一个关系字段而自动读取新表。

读开关迁移的是已接入的金额读取点，不意味着银行现金流、完整经营报表和月结历史数据全部改成对新表直接汇总。

其中，月结的余额链重建仍明确依据原流水的前后余额；Expense、Coupon 等经营收支的既有分类和统计口径保留。机器人 `!realcash` 只调整收入/充值分项、不改变总余额且原来不生成流水，本次触发器无法捕获没有来源流水的分项变动。把这一入口也纳入完整分项账本，需要另行确认可见流水类型与文案后改造；不能因此宣称所有钱包分项已经完整记账。

## 测试与准备

1. 保存网站、机器人当前发布版本和环境配置；按现有备份流程建立可恢复的正式库备份，并核对目标数据库名。
2. 审阅唯一 DDL 文件：`prisma/migrations/20261030120000_add_wallet_ledger/migration.sql`。它只增加新表、约束、索引和相关函数/触发器，不修改钱包、不回填历史。
3. 比较两仓库新增账本模型及本次迁移文件。两仓库原有迁移历史可能不同，不得覆盖完整 schema，也不得为了同步而直接执行两边全部 pending migrations。
4. 在全新、隔离的 PostgreSQL 测试容器执行迁移和并发/回滚测试。不要用机器人启动程序准备测试库。

本地纯函数和写入器测试按当前仓库脚本运行，例如：

```bash
node --import tsx --test lib/wallet-ledger.test.ts lib/wallet-ledger-backfill.test.ts
node scripts/test-wallet-ledger-postgres.mjs
```

PostgreSQL 测试脚本自行创建临时容器，仅运行该容器内的 `psql`；不读取应用 `.env` 或 `DATABASE_URL`，并在结束时删除该临时容器。生产服务、现有库、现有容器不作为测试目标。

应用 Prisma 写入器和真实审计/回填 CLI 另有可重复执行的集成测试。先专门创建一个本地测试容器，等待 `pg_isready` 成功并从 `docker port` 取得实际随机端口：

```bash
docker run -d --name codex-wallet-ledger-test-local --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_USER=ledger_test -e POSTGRES_PASSWORD=ledger_test_only \
  -e POSTGRES_DB=ledger_test -p 127.0.0.1::5432 postgres:16-alpine
docker exec codex-wallet-ledger-test-local pg_isready -U ledger_test -d ledger_test
docker port codex-wallet-ledger-test-local 5432/tcp
```

将下面的 `TEST_PORT` 替换为该容器实际端口后执行两个测试。它们要求显式测试变量，拒绝非本地地址、默认生产端口或与容器端口不符的目标；每次创建独立随机 schema，结束时只移除自身 schema：

```bash
export WALLET_LEDGER_TEST_CONTAINER=codex-wallet-ledger-test-local
export WALLET_LEDGER_TEST_DATABASE_URL='postgresql://ledger_test:ledger_test_only@127.0.0.1:TEST_PORT/ledger_test'
node scripts/test-wallet-ledger-prisma.mjs
node scripts/test-wallet-ledger-cli.mjs
```

CLI 测试覆盖迁移前只读审计、默认预览、数据库确认拦截、有限批次和断点续跑、重复回填不新增、原流水及钱包不变、未知分项保留空值、非有限金额/超范围差额预检，以及提交时延迟校验失败后的正确游标。测试结束后可移除本节刚创建的测试容器；不得把已有业务容器用于该步骤。

本次验证记录（2026-10-30）：网站相关回归测试 46 项、机器人与 cash 相关测试 116 项通过；SQL 约束、Prisma 实际写入及审计/回填 CLI 均通过隔离 PostgreSQL 16 测试。这些结果验证代码与合成场景，不等于验证正式库全部历史账务。

Prisma 模型生成和校验可以在不访问正式库的情况下进行：

```bash
node node_modules/prisma/build/index.js validate --schema prisma/schema.prisma
node node_modules/prisma/build/index.js generate --schema prisma/schema.prisma
```

这一步不执行 `migrate deploy`、`db push` 或 seed。

## 正式执行顺序（需最终确认后执行）

### 1. 迁移前只读审计

```bash
node --import tsx scripts/wallet-ledger-audit.ts --env-file .env.local
node --import tsx scripts/wallet-ledger-backfill.ts --env-file .env.local
```

以上两条都是只读；第二条未传 `--apply` 时仅预览。脚本以 `READ ONLY`、`REPEATABLE READ` 事务读取审计，并设置语句及锁等待超时。在导入 Prisma 前先选择配置：真正从启动环境继承的 `DATABASE_URL` 优先；否则只读取 `--env-file` 指定文件，未指定时读取 `.env.local`，不回退到 Prisma 隐式加载的 `.env`。支持把既有 `psql 'postgresql://…'` 包装提取成 URL，但不会执行包装命令；验证后显式传入 Prisma datasource。空值或坏配置直接报错，不尝试其他数据库。

报告的 `target` 仅显示主机、端口、数据库名、schema 和配置来源，供核对执行目标；不打印连接串、密码或用户账户明细。新表尚未迁移时仍可审计原流水，报告 `ledgerTablePresent=false`。历史审计数字只有在核对该安全目标摘要后，才能归属于相应环境，不能仅凭数据条数判断是正式库。

记录原流水总笔数、按类型的实际余额净变动、业务面额合计、异常行 ID、身份缺失与可能归属差异。把这次结果作为上线基线；不要复用之前会话中的旧数字。

同时检查 `nonFiniteSourceMoney`、`deltaOutOfRange` 和合计 `invalidSourceMoney`：即使各个旧余额都符合 `DECIMAL(19,4)`，两端相减仍可能超出新字段范围；旧表也可能含 `NaN`。审计列出对应异常 ID，`--apply` 会在写入第一批前以 `ledger_invalid_source_money` 停止，并在每批锁定后再次校验。这类记录不能自动改为零或截断，需单独审查原始业务事实和处理方案，解决后重新只读审计。

### 2. 在共享数据库只执行本次 DDL 一次

待确认的 SQL 是上面的完整迁移文件。Prisma 原生命令不会像审计工具一样移除 `psql` 包装，因此此处必须使用经确认、仅含纯 URL 的专用配置文件。不要把命令包装值直接交给 Prisma，也不要在终端输出连接串。下面的 `APPROVED_PLAIN_URL_ENV` 须替换为该文件路径；显式清除继承的 `DATABASE_URL`，保证只采用已审查文件中的目标：

DDL 事务设置 5 秒锁等待和 60 秒语句超时，超过限制会回滚整份迁移。失败时先确认原事务已回滚、排查占用，再决定重试，不能提前标记迁移已应用。

```bash
env -u DATABASE_URL node --env-file=APPROVED_PLAIN_URL_ENV node_modules/prisma/build/index.js db execute \
  --schema prisma/schema.prisma \
  --file prisma/migrations/20261030120000_add_wallet_ledger/migration.sql
```

网站和机器人若连接同一个数据库，只执行一次。若它们实际连接不同数据库，需要分别确认数据库及审计结果，不能假设相同。检查 `DATABASE_URL`、`RECHARGE_DATABASE_URL`、`WITHDRAW_DATABASE_URL`、`PEIWAN_DATABASE_URL` 的实际用途；不要把只用于 watcher 的库误当成统一账务库。

如果使用上述定向 SQL 而非 Prisma 部署，在确认 DDL 完整成功后，将**这一条**迁移记为已应用：

```bash
env -u DATABASE_URL node --env-file=APPROVED_PLAIN_URL_ENV node_modules/prisma/build/index.js migrate resolve \
  --schema prisma/schema.prisma \
  --applied 20261030120000_add_wallet_ledger
```

此命令写入迁移历史，也属于需确认的正式库操作。不得用它跳过失败的 DDL 或标记其他未审查迁移。两仓库共享同一 `_prisma_migrations` 表时，同一迁移不需要重复标记。

### 3. 发布兼容版本并逐步打开新写入

先发布生成了对应 Prisma Client 的网站和机器人，保持读开关为 `0`。迁移后的触发器会为普通业务的新流水自动建立标准记录，所以滚动发布期间不会留下只由旧程序写入的缺口。

分别开启写开关，检查正常充值、点单、打赏、退款/返利、提现等原有业务：来源流水与标准账本是否一一对应、已知分项是否相符、幂等回调/重试是否仍只有一次钱包变动。通过只读审计确认没有 `baseFactMismatch`；启用新写入后新增 `REQUIRES_REVIEW`、未知分项和 `COMPATIBILITY` 数量要能解释。

### 4. 分批回填历史

先 dry-run 获取 `throughId` 高水位，再使用审查确认的数据库名运行小批量：

```bash
node --import tsx scripts/wallet-ledger-backfill.ts \
  --env-file .env.local \
  --apply --confirm-database DATABASE_NAME \
  --batch-size 1000 --max-batches 5 \
  --through-id APPROVED_HIGH_WATER_ID
```

`DATABASE_NAME` 和 `APPROVED_HIGH_WATER_ID` 必须替换为经确认的实际目标，不要原样执行示例。脚本还会核对 `current_database()`，并要求新增流水捕获、事实校验和禁止篡改的触发器处于启用状态。

每批锁定选中的来源流水以便读取稳定事实，只向新表插入缺失行。已有标准记录必须与原流水金额、时间、类型一致，发现不同立即中止，绝不覆盖。批次在数据库提交成功后才输出新的 `afterId`；执行过程中按 Ctrl-C 会等待当前批次完成并打印续跑位置。

续跑携带相同高水位和上一笔已提交的游标：

```bash
node --import tsx scripts/wallet-ledger-backfill.ts \
  --env-file .env.local \
  --apply --confirm-database DATABASE_NAME \
  --batch-size 1000 --max-batches 5 \
  --after-id LAST_COMMITTED_ID --through-id APPROVED_HIGH_WATER_ID
```

`complete=false` 表示本次受批次数限制或被中断，需要继续执行；不代表失败批次已提交。错误发生在提交阶段时，也只报告此前已提交的游标。重复从旧游标开始仍安全，因为 `sourceTransactionId` 唯一约束和 `ON CONFLICT DO NOTHING` 不会重复创建同一笔账。

高水位只是本轮扫描范围，不是业务时间排序或用户流水顺序。实时新增流水由触发器覆盖；回填完成后必须重新审计完整范围。

### 5. 核对后切换读端

再次运行全量只读审计，要求标准记录覆盖与本次范围的原流水笔数一致、`baseFactMismatch=0`、新旧实际余额净变动相同，历史异常清单可追溯且未被改写。合理的账号合并允许 `ownershipSnapshotChanges` 大于零。

对同一账号、同一时间范围对比读开关关闭和开启时的活动消费、流水列表、账务导出等结果，保留既有自然周、实际净消费、退款/优惠冲减和权益规则。对照业务原始单据和现有月结连续性检查，确认充值、扣款、提现、返利与钱包余额可解释后，逐步启用读开关。

运行期间继续观察 1–2 个结算周期。历史异常未完成业务核对前，不得因为标记为 `VERIFIED` 或“回填完成”而宣称全账已经完成财务对账。

## 回滚与恢复

常规回滚关闭两个开关并回到已保存的兼容代码版本；旧 `IndividualTransaction` 与原钱包字段始终保留，因此不依赖删除新表恢复业务。迁移后的捕获触发器仍会为旧版入口自动记账。

回填中断只影响当前未提交批次；已提交记录保留，从输出游标继续。不得删除已写账本、清空表或重新执行历史业务来“回滚”。

如确需停用数据库捕获触发器，应先停止受影响的写入、保留备份与审计范围，单独审查停用和补齐计划。关闭应用写开关不会关闭数据库触发器，不能把它当成触发器故障的修复方法。正式库不运行测试清库、reset 或 drop 命令。

历史记录的真实业务错误需另案确认修正金额和对应业务关联；修正时新增可追踪调整账，本次方案不猜测或重写旧事实。
