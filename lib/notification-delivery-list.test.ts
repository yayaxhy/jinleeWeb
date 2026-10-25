import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";

import { DELIVERY_HOLD_PREFIX } from "./notification-delivery";
import { listNotificationDeliveries, parseDeliveryPagination } from "./notification-delivery-list";

import { matches } from './notification-test-support';

const NOW = Date.parse("2026-10-21T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function row(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    notificationId: `notification-${id}`,
    channel: "DISCORD",
    status: "PENDING",
    attempts: 0,
    error: null,
    updatedAt: new Date(NOW - 1000),
    notification: {
      title: "通知",
      event: "RECHARGE",
      dlmId: "user-1",
      createdAt: new Date(NOW - 1000),
      dlmUser: { dlmId: "user-1", discordDisplayName: "用户", wechatDisplayName: null, member: null },
    },
    ...patch,
  };
}

function fixture(rows: ReturnType<typeof row>[]) {
  const db = { guildNotificationDelivery: {
    count: async ({ where }: Prisma.GuildNotificationDeliveryCountArgs) => rows.filter((entry) => matches(entry, where)).length,
    findMany: async ({ where, orderBy, skip = 0, take }: Prisma.GuildNotificationDeliveryFindManyArgs) => {
      assert.deepEqual(orderBy, [{ updatedAt: "desc" }, { id: "desc" }]);
      assert.ok(take && take <= 100);
      return rows.filter((entry) => matches(entry, where))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id))
        .slice(skip, skip + (take ?? 100));
    },
  } } as unknown as Pick<PrismaClient, "guildNotificationDelivery">;
  return db;
}

test("pagination keeps old holds reachable and reports eligible channels beyond the first 100 holds", async () => {
  const held = Array.from({ length: 105 }, (_, index) => row(`held-${String(index).padStart(3, "0")}`, {
    attempts: 1, error: `${DELIVERY_HOLD_PREFIX}secret-${index}`,
  }));
  const db = fixture([
    ...held,
    row("old-held", { attempts: 1, notification: { ...row("template").notification, createdAt: new Date(NOW - 4 * DAY) }, updatedAt: new Date(NOW - 3 * DAY), error: `${DELIVERY_HOLD_PREFIX}old-secret` }),
    row("retryable", { updatedAt: new Date(NOW - 2000) }),
  ]);

  const first = await listNotificationDeliveries(db, { page: 1, pageSize: 100 }, NOW);
  assert.equal(first.deliveries.length, 100);
  assert.equal(first.total, 107);
  assert.equal(first.totalPages, 2);
  assert.equal(first.retryableCount, 1);
  assert.ok(first.deliveries.every((delivery) => delivery.status === "UNCERTAIN" && !delivery.canRetry));
  assert.equal(first.deliveries[0].id, "held-104");

  const second = await listNotificationDeliveries(db, { page: 2, pageSize: 100 }, NOW);
  assert.equal(second.deliveries.length, 7);
  assert.equal(second.retryableCount, 1);
  assert.ok(second.deliveries.some((delivery) => delivery.id === "retryable" && delivery.canRetry));
  assert.ok(second.deliveries.some((delivery) => delivery.id === "old-held" && delivery.status === "UNCERTAIN"));
  assert.equal(new Set([...first.deliveries, ...second.deliveries].map((delivery) => delivery.id)).size, 107);
  assert.ok(!JSON.stringify([first, second]).includes(DELIVERY_HOLD_PREFIX));
  assert.ok(!JSON.stringify([first, second]).includes("secret"));
});

test("global retry count matches status, attempt, hold and notification-age limits", async () => {
  const oldNotification = { ...row("template").notification, createdAt: new Date(NOW - 2 * DAY) };
  const boundaryNotification = { ...row("template").notification, createdAt: new Date(NOW - DAY + 1) };
  const db = fixture([
    row("eligible-pending"),
    row("eligible-failed", { status: "FAILED", error: "rejected", notification: boundaryNotification }),
    row("old-recently-updated", { notification: oldNotification }),
    row("old-failure", { notification: oldNotification, updatedAt: new Date(NOW - 2 * DAY), status: "FAILED" }),
    row("exhausted", { attempts: 3, status: "FAILED" }),
    row("held", { attempts: 1, error: `${DELIVERY_HOLD_PREFIX}token` }),
    row("sent", { status: "SENT" }),
    row("skipped", { status: "SKIPPED" }),
  ]);
  const result = await listNotificationDeliveries(db, { page: 1, pageSize: 100 }, NOW);
  assert.equal(result.total, 5);
  assert.equal(result.retryableCount, 2);
  assert.deepEqual(result.deliveries.filter((delivery) => delivery.canRetry).map((delivery) => delivery.id).sort(), ["eligible-failed", "eligible-pending"]);
});

test("out-of-range pages clamp after rows are resolved, and an empty list remains on page one", async () => {
  const db = fixture([row("only", { attempts: 1, error: `${DELIVERY_HOLD_PREFIX}token` })]);
  const result = await listNotificationDeliveries(db, { page: 5, pageSize: 100 }, NOW);
  assert.equal(result.page, 1);
  assert.equal(result.deliveries[0].id, "only");
  const empty = await listNotificationDeliveries(fixture([]), { page: 5, pageSize: 100 }, NOW);
  assert.equal(empty.page, 1);
  assert.equal(empty.totalPages, 1);
  assert.equal(empty.total, 0);
});

test("query pagination accepts positive integers, caps page size, and rejects invalid or oversized offsets", () => {
  const parse = (query: string) => parseDeliveryPagination(new URLSearchParams(query));
  assert.deepEqual(parse(""), { page: 1, pageSize: 100 });
  assert.deepEqual(parse("page=2&pageSize=25"), { page: 2, pageSize: 25 });
  assert.deepEqual(parse("pageSize=500"), { page: 1, pageSize: 100 });
  for (const query of ["page=0", "page=-1", "page=1.5", "page=NaN", "page=", "pageSize=0", "pageSize=1e2", "page=9007199254740992", "page=2147483647&pageSize=100"]) {
    assert.equal(parse(query), null, query);
  }
});


test("unknown claims count as retryable only after five minutes; stopped channels remain historical", async () => {
  const db = fixture([
    row('stale-unknown', { attempts: 1, updatedAt: new Date(NOW - 300000), error: `${DELIVERY_HOLD_PREFIX}old` }),
    row('fresh-unknown', { attempts: 1, error: `${DELIVERY_HOLD_PREFIX}fresh` }),
    row('old-email', { channel: 'EMAIL' }),
    row('old-push', { channel: 'WEB_PUSH' }),
    row('age-boundary', { notification: { ...row('template').notification, createdAt: new Date(NOW - DAY) } }),
  ]);
  const result = await listNotificationDeliveries(db, { page: 1, pageSize: 100 }, NOW);
  assert.equal(result.retryableCount, 1);
  assert.deepEqual(result.deliveries.filter(row => row.canRetry).map(row => row.id), ['stale-unknown']);
  assert.ok(result.deliveries.filter(row => row.channel !== 'DISCORD').every(row => /已停用/.test(row.error!)));
});
