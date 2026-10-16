-- Preserve the current Discord dropdown order on rollout. Runtime code never creates this column.
ALTER TABLE "Gift" ADD COLUMN "discordMenuOrder" INTEGER;

CREATE INDEX "Gift_discordMenuOrder_idx" ON "Gift"("discordMenuOrder");

UPDATE "Gift" AS gift
SET "discordMenuOrder" = defaults.position
FROM (VALUES
  ('冰淇淋', 0), ('棒棒糖', 1), ('小蛋糕', 2), ('香水', 3),
  ('旋转木马', 4), ('南瓜车', 5), ('留声机', 6), ('一日冠', 7),
  ('三日冠', 8), ('一周冠', 9), ('月冠名', 10), ('季冠名', 11), ('年冠名', 12)
) AS defaults(name, position)
WHERE gift."GiftName" = defaults.name;
