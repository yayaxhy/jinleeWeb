import type { CopyImageBinding, CopyImageOnlyUnit } from './editable-copy-images';

export const BOT_IMAGE_BINDINGS: readonly CopyImageBinding[] = [
  {
    "unitId": "bot:ui.orderEmbeds:invite_successfully_inDiscord_embed",
    "images": [
      {
        "key": "bot.image.order.inviteSuccess",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/18-thankBoss.gif"
      }
    ]
  },
  {
    "unitId": "bot:ui.orderEmbeds:anon_invite_successfully_inDiscord_embed",
    "images": [
      {
        "key": "bot.image.order.inviteSuccess",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/18-thankBoss.gif"
      }
    ]
  },
  {
    "unitId": "bot:services.autoCommissionBuffService:notifyLuckyStarExpiryReminder",
    "images": [
      {
        "key": "bot.image.luckyStar.reminder",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/DLMLOGO.png"
      }
    ]
  },
  {
    "unitId": "bot:ui.scratchEmbeds:buildScratchPendingEmbed:voucher",
    "images": [
      {
        "key": "bot.image.scratch.thumbnail",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/05-scratch-thumbnail.png"
      },
      {
        "key": "bot.image.scratch.pending",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/06-scratch-pending.png"
      }
    ]
  },
  {
    "unitId": "bot:ui.scratchEmbeds:buildScratchPendingEmbed:paid",
    "images": [
      {
        "key": "bot.image.scratch.thumbnail",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/05-scratch-thumbnail.png"
      },
      {
        "key": "bot.image.scratch.pending",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/06-scratch-pending.png"
      }
    ]
  },
  {
    "unitId": "bot:ui.scratchEmbeds:buildScratchRevealedEmbed:thanks",
    "images": [
      {
        "key": "bot.image.scratch.thumbnail",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/05-scratch-thumbnail.png"
      },
      {
        "key": "bot.image.scratch.thanks",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/07-scratch-thanks.png"
      }
    ]
  },
  {
    "unitId": "bot:ui.scratchEmbeds:buildScratchRevealedEmbed:prize",
    "variantId": "P5",
    "examples": {
      "prizeText": "5"
    },
    "images": [
      {
        "key": "bot.image.scratch.thumbnail",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/05-scratch-thumbnail.png"
      },
      {
        "key": "bot.image.scratch.prize5",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/08-scratch-5.png"
      }
    ]
  },
  {
    "unitId": "bot:ui.scratchEmbeds:buildScratchRevealedEmbed:prize",
    "variantId": "P20",
    "examples": {
      "prizeText": "20"
    },
    "images": [
      {
        "key": "bot.image.scratch.thumbnail",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/05-scratch-thumbnail.png"
      },
      {
        "key": "bot.image.scratch.prize20",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/09-scratch-20.png"
      }
    ]
  },
  {
    "unitId": "bot:ui.scratchEmbeds:buildScratchRevealedEmbed:prize",
    "variantId": "P30",
    "examples": {
      "prizeText": "30"
    },
    "images": [
      {
        "key": "bot.image.scratch.thumbnail",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/05-scratch-thumbnail.png"
      },
      {
        "key": "bot.image.scratch.prize30",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/10-scratch-30.png"
      }
    ]
  },
  {
    "unitId": "bot:ui.scratchEmbeds:buildScratchRevealedEmbed:prize",
    "variantId": "P50",
    "examples": {
      "prizeText": "50"
    },
    "images": [
      {
        "key": "bot.image.scratch.thumbnail",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/05-scratch-thumbnail.png"
      },
      {
        "key": "bot.image.scratch.prize50",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/11-scratch-50.png"
      }
    ]
  },
  {
    "unitId": "bot:ui.scratchEmbeds:buildScratchRevealedEmbed:prize",
    "variantId": "P99",
    "examples": {
      "prizeText": "99"
    },
    "images": [
      {
        "key": "bot.image.scratch.thumbnail",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/05-scratch-thumbnail.png"
      },
      {
        "key": "bot.image.scratch.prize99",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/12-scratch-99.png"
      }
    ]
  },
  {
    "unitId": "bot:ui.scratchEmbeds:buildScratchRevealedEmbed:prize",
    "variantId": "P200",
    "examples": {
      "prizeText": "150"
    },
    "images": [
      {
        "key": "bot.image.scratch.thumbnail",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/05-scratch-thumbnail.png"
      },
      {
        "key": "bot.image.scratch.prize150",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/13-scratch-150.png"
      }
    ]
  },
  {
    "unitId": "bot:services.redEnvelopeService:buildRedEnvelopeMessagePayload:keyword-active",
    "images": [
      {
        "key": "bot.image.redEnvelope",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/02-guild-red-envelope.png"
      }
    ]
  },
  {
    "unitId": "bot:services.redEnvelopeService:buildRedEnvelopeMessagePayload:keyword-finished",
    "images": [
      {
        "key": "bot.image.redEnvelope",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/02-guild-red-envelope.png"
      }
    ]
  },
  {
    "unitId": "bot:services.redEnvelopeService:buildRedEnvelopeMessagePayload:keyword-refunded",
    "images": [
      {
        "key": "bot.image.redEnvelope",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/02-guild-red-envelope.png"
      }
    ]
  },
  {
    "unitId": "bot:services.redEnvelopeService:buildRedEnvelopeMessagePayload:reaction-active",
    "images": [
      {
        "key": "bot.image.redEnvelope",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/02-guild-red-envelope.png"
      }
    ]
  },
  {
    "unitId": "bot:services.redEnvelopeService:buildRedEnvelopeMessagePayload:reaction-finished",
    "images": [
      {
        "key": "bot.image.redEnvelope",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/02-guild-red-envelope.png"
      }
    ]
  },
  {
    "unitId": "bot:services.redEnvelopeService:buildRedEnvelopeMessagePayload:reaction-refunded",
    "images": [
      {
        "key": "bot.image.redEnvelope",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/02-guild-red-envelope.png"
      }
    ]
  },
  {
    "unitId": "bot:ui.blockStackEmbeds:buildBlockStackEmbed:active",
    "images": [
      {
        "key": "bot.image.blockStack.thumbnail",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/DLMLOGO.png"
      }
    ]
  },
  {
    "unitId": "bot:ui.blockStackEmbeds:buildBlockStackEmbed:collapsed",
    "images": [
      {
        "key": "bot.image.blockStack.thumbnail",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/DLMLOGO.png"
      }
    ]
  },
  {
    "unitId": "bot:ui.blockStackEmbeds:buildBlockStackEmbed:settled",
    "images": [
      {
        "key": "bot.image.blockStack.thumbnail",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/DLMLOGO.png"
      }
    ]
  },
  {
    "unitId": "bot:dispatch:public",
    "images": [
      {
        "key": "bot.image.dispatch",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/01-order-dispatch.png"
      }
    ]
  },
  {
    "unitId": "bot:dispatch:anonymous",
    "images": [
      {
        "key": "bot.image.dispatch",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/01-order-dispatch.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:false:false",
    "variantId": "NORMAL",
    "examples": {
      "actualCostLabel": "29"
    },
    "images": [
      {
        "key": "bot.image.lottery.normal",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/14-lottery-silver.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:false:false",
    "variantId": "MEDIUM",
    "examples": {
      "actualCostLabel": "29"
    },
    "images": [
      {
        "key": "bot.image.lottery.medium",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/15-lottery-gold.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:false:false",
    "variantId": "ADVANCED",
    "examples": {
      "actualCostLabel": "29"
    },
    "images": [
      {
        "key": "bot.image.lottery.advanced",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/16-lottery-advanced.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:false:false",
    "variantId": "SPECIAL",
    "examples": {
      "actualCostLabel": "29"
    },
    "images": [
      {
        "key": "bot.image.lottery.special",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/17-lottery-special.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:false:true",
    "variantId": "NORMAL",
    "examples": {
      "actualCostLabel": "0"
    },
    "images": [
      {
        "key": "bot.image.lottery.normal",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/14-lottery-silver.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:false:true",
    "variantId": "MEDIUM",
    "examples": {
      "actualCostLabel": "0"
    },
    "images": [
      {
        "key": "bot.image.lottery.medium",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/15-lottery-gold.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:false:true",
    "variantId": "ADVANCED",
    "examples": {
      "actualCostLabel": "0"
    },
    "images": [
      {
        "key": "bot.image.lottery.advanced",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/16-lottery-advanced.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:false:true",
    "variantId": "SPECIAL",
    "examples": {
      "actualCostLabel": "0"
    },
    "images": [
      {
        "key": "bot.image.lottery.special",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/17-lottery-special.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:true:false",
    "variantId": "NORMAL",
    "examples": {
      "actualCostLabel": "29"
    },
    "images": [
      {
        "key": "bot.image.lottery.normal",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/14-lottery-silver.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:true:false",
    "variantId": "MEDIUM",
    "examples": {
      "actualCostLabel": "29"
    },
    "images": [
      {
        "key": "bot.image.lottery.medium",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/15-lottery-gold.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:true:false",
    "variantId": "ADVANCED",
    "examples": {
      "actualCostLabel": "29"
    },
    "images": [
      {
        "key": "bot.image.lottery.advanced",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/16-lottery-advanced.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:true:false",
    "variantId": "SPECIAL",
    "examples": {
      "actualCostLabel": "29"
    },
    "images": [
      {
        "key": "bot.image.lottery.special",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/17-lottery-special.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:true:true",
    "variantId": "NORMAL",
    "examples": {
      "actualCostLabel": "0"
    },
    "images": [
      {
        "key": "bot.image.lottery.normal",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/14-lottery-silver.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:true:true",
    "variantId": "MEDIUM",
    "examples": {
      "actualCostLabel": "0"
    },
    "images": [
      {
        "key": "bot.image.lottery.medium",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/15-lottery-gold.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:true:true",
    "variantId": "ADVANCED",
    "examples": {
      "actualCostLabel": "0"
    },
    "images": [
      {
        "key": "bot.image.lottery.advanced",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/16-lottery-advanced.png"
      }
    ]
  },
  {
    "unitId": "bot:lottery:start:true:true",
    "variantId": "SPECIAL",
    "examples": {
      "actualCostLabel": "0"
    },
    "images": [
      {
        "key": "bot.image.lottery.special",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/17-lottery-special.png"
      }
    ]
  },
  {
    "unitId": "bot:inline-card:2a0e3ffde412",
    "images": [
      {
        "key": "bot.image.gift.success",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/18-thankBoss.gif"
      }
    ]
  },
  {
    "unitId": "bot:inline-card:c3a23adaf816",
    "images": [
      {
        "key": "bot.image.voicePoints.thumbnail",
        "placement": "thumbnail",
        "defaultSrc": "https://dlmclub.com/DLMLOGO.png"
      }
    ]
  },
  {
    "unitId": "bot:leaderboard:spend:0:false",
    "images": [
      {
        "key": "bot.image.leaderboard.spending",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/03-spending-leaderboard.png"
      }
    ]
  },
  {
    "unitId": "bot:leaderboard:spend:0:true",
    "images": [
      {
        "key": "bot.image.leaderboard.spending",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/03-spending-leaderboard.png"
      }
    ]
  },
  {
    "unitId": "bot:leaderboard:spend:1:false",
    "images": [
      {
        "key": "bot.image.leaderboard.spending",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/03-spending-leaderboard.png"
      }
    ]
  },
  {
    "unitId": "bot:leaderboard:spend:1:true",
    "images": [
      {
        "key": "bot.image.leaderboard.spending",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/03-spending-leaderboard.png"
      }
    ]
  },
  {
    "unitId": "bot:leaderboard:spend:2:false",
    "images": [
      {
        "key": "bot.image.leaderboard.spending",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/03-spending-leaderboard.png"
      }
    ]
  },
  {
    "unitId": "bot:leaderboard:spend:2:true",
    "images": [
      {
        "key": "bot.image.leaderboard.spending",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/03-spending-leaderboard.png"
      }
    ]
  },
  {
    "unitId": "bot:leaderboard:income:0:false",
    "images": [
      {
        "key": "bot.image.leaderboard.income",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/04-income-leaderboard.png"
      }
    ]
  },
  {
    "unitId": "bot:leaderboard:income:0:true",
    "images": [
      {
        "key": "bot.image.leaderboard.income",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/04-income-leaderboard.png"
      }
    ]
  },
  {
    "unitId": "bot:leaderboard:income:1:false",
    "images": [
      {
        "key": "bot.image.leaderboard.income",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/04-income-leaderboard.png"
      }
    ]
  },
  {
    "unitId": "bot:leaderboard:income:1:true",
    "images": [
      {
        "key": "bot.image.leaderboard.income",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/04-income-leaderboard.png"
      }
    ]
  },
  {
    "unitId": "bot:leaderboard:income:2:false",
    "images": [
      {
        "key": "bot.image.leaderboard.income",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/04-income-leaderboard.png"
      }
    ]
  },
  {
    "unitId": "bot:leaderboard:income:2:true",
    "images": [
      {
        "key": "bot.image.leaderboard.income",
        "placement": "image",
        "defaultSrc": "https://dlmclub.com/brand/dlm-v1/operations/04-income-leaderboard.png"
      }
    ]
  }
];

export const BOT_IMAGE_ONLY_UNITS: readonly CopyImageOnlyUnit[] = [
  {
    "id": "bot:image:bot.image.vip.1",
    "title": "VIP1",
    "source": "src/services/spentRoleService.ts:242",
    "imageKey": "bot.image.vip.1"
  },
  {
    "id": "bot:image:bot.image.vip.2",
    "title": "VIP2",
    "source": "src/services/spentRoleService.ts:242",
    "imageKey": "bot.image.vip.2"
  },
  {
    "id": "bot:image:bot.image.vip.3",
    "title": "VIP3",
    "source": "src/services/spentRoleService.ts:242",
    "imageKey": "bot.image.vip.3"
  },
  {
    "id": "bot:image:bot.image.vip.4",
    "title": "VIP4",
    "source": "src/services/spentRoleService.ts:242",
    "imageKey": "bot.image.vip.4"
  },
  {
    "id": "bot:image:bot.image.vip.5",
    "title": "VIP5",
    "source": "src/services/spentRoleService.ts:242",
    "imageKey": "bot.image.vip.5"
  },
  {
    "id": "bot:image:bot.image.vip.6",
    "title": "VIP6",
    "source": "src/services/spentRoleService.ts:242",
    "imageKey": "bot.image.vip.6"
  },
  {
    "id": "bot:image:bot.image.vip.7",
    "title": "VIP7",
    "source": "src/services/spentRoleService.ts:242",
    "imageKey": "bot.image.vip.7"
  },
  {
    "id": "bot:image:bot.image.vip.8",
    "title": "VIP8",
    "source": "src/services/spentRoleService.ts:242",
    "imageKey": "bot.image.vip.8"
  },
  {
    "id": "bot:image:bot.image.vip.9",
    "title": "VIP9",
    "source": "src/services/spentRoleService.ts:242",
    "imageKey": "bot.image.vip.9"
  },
  {
    "id": "bot:image:bot.image.vip.10",
    "title": "VIP10",
    "source": "src/services/spentRoleService.ts:242",
    "imageKey": "bot.image.vip.10"
  },
  {
    "id": "bot:image:bot.image.vip.11",
    "title": "VIP11",
    "source": "src/services/spentRoleService.ts:242",
    "imageKey": "bot.image.vip.11"
  },
  {
    "id": "bot:image:bot.image.vip.12",
    "title": "VIP12",
    "source": "src/services/spentRoleService.ts:242",
    "imageKey": "bot.image.vip.12"
  },
  {
    "id": "bot:image:bot.image.prize.01-cupcake-voucher",
    "title": "小蛋糕代金券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.01-cupcake-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.02-lollipop-voucher",
    "title": "棒棒糖代金券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.02-lollipop-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.03-champagne-voucher",
    "title": "香槟代金券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.03-champagne-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.04-butterfly-voucher",
    "title": "蝴蝶代金券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.04-butterfly-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.05-piano-voucher",
    "title": "钢琴代金券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.05-piano-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.06-airplane-voucher",
    "title": "飞机代金券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.06-airplane-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.07-deep-sea-chest-voucher",
    "title": "深海宝箱代金券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.07-deep-sea-chest-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.08-lottery-voucher",
    "title": "抽奖代金券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.08-lottery-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.09-block-game-voucher",
    "title": "抽积木代金券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.09-block-game-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.10-7-zhe-voucher",
    "title": "7折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.10-7-zhe-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.11-8-zhe-voucher",
    "title": "8折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.11-8-zhe-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.12-lottery-9-zhe-voucher",
    "title": "抽奖9折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.12-lottery-9-zhe-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.13-special-9-zhe-voucher",
    "title": "特殊九折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.13-special-9-zhe-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.14-day-crown-95-voucher",
    "title": "一日冠95折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.14-day-crown-95-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.15-day-crown-92-voucher",
    "title": "一日冠92折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.15-day-crown-92-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.16-day-crown-9-voucher",
    "title": "一日冠9折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.16-day-crown-9-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.17-day-crown-75-voucher",
    "title": "一日冠75折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.17-day-crown-75-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.18-three-day-crown-92-voucher",
    "title": "三日冠92折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.18-three-day-crown-92-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.19-three-day-crown-9-voucher",
    "title": "三日冠9折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.19-three-day-crown-9-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.20-week-crown-92-voucher",
    "title": "一周冠92折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.20-week-crown-92-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.21-week-crown-9-voucher",
    "title": "一周冠9折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.21-week-crown-9-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.22-three-digit-card",
    "title": "3位数靓号券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.22-three-digit-card"
  },
  {
    "id": "bot:image:bot.image.prize.23-four-digit-card",
    "title": "4位数靓号券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.23-four-digit-card"
  },
  {
    "id": "bot:image:bot.image.prize.24-five-digit-card",
    "title": "5位数靓号券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.24-five-digit-card"
  },
  {
    "id": "bot:image:bot.image.prize.25-custom-tag-voucher",
    "title": "自定义tag券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.25-custom-tag-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.26-custom-gift-voucher",
    "title": "自定义礼物券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.26-custom-gift-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.27-commission-minus-one",
    "title": "抽成降1%",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.27-commission-minus-one"
  },
  {
    "id": "bot:image:bot.image.prize.28-double-flow-5000",
    "title": "双倍流水5000券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.28-double-flow-5000"
  },
  {
    "id": "bot:image:bot.image.prize.29-double-spend-5000",
    "title": "双倍消费5000券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.29-double-spend-5000"
  },
  {
    "id": "bot:image:bot.image.prize.30-peiwan-review-voucher",
    "title": "陪玩评语券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.30-peiwan-review-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.31-perfume-voucher",
    "title": "香水代金券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.31-perfume-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.32-carousel-voucher",
    "title": "旋转木马代金券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.32-carousel-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.33-pumpkin-car-voucher",
    "title": "南瓜车代金券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.33-pumpkin-car-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.34-phonograph-voucher",
    "title": "留声机代金券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.34-phonograph-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.35-month-crown-92-voucher",
    "title": "月冠名92折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.35-month-crown-92-voucher"
  },
  {
    "id": "bot:image:bot.image.prize.36-month-crown-9-voucher",
    "title": "月冠名9折券",
    "source": "src/config/brandArtwork.ts:8",
    "imageKey": "bot.image.prize.36-month-crown-9-voucher"
  }
];
