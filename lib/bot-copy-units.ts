import type { CopyUnitDefinition } from './editable-copy-units';

/** Presentation-only grouping of existing Bot templates. Shared keys intentionally
 * appear in more than one message; storage and runtime defaults are unchanged. */
export const BOT_COPY_UNITS: readonly CopyUnitDefinition[] = [
  {
    "id": "bot:ui.orderEmbeds:order_request_sent_successfully_embed",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.fc96d727c",
    "keys": [
      "bot.ui.orderEmbeds.fc96d727c",
      "bot.ui.orderEmbeds.2bb206370",
      "bot.ui.orderEmbeds.4fc4239f8",
      "bot.ui.orderEmbeds.dbe84914d",
      "bot.ui.orderEmbeds.bd761afaf",
      "bot.ui.orderEmbeds.ab240a732",
      "bot.ui.orderEmbeds.59e0a3929"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.fc96d727c",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.2bb206370",
        "role": "text",
        "examples": {
          "fixed1": "<a:44:1552516059641159714>"
        },
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.4fc4239f8",
        "role": "text",
        "examples": {
          "fixed2": "<a:36:1552515993182412812>",
          "fixed3": "`订单号`"
        },
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.dbe84914d",
        "role": "text",
        "examples": {
          "fixed1": "<a:36:1552515993182412812>"
        },
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.bd761afaf",
        "role": "text",
        "examples": {
          "fixed1": "<a:191:1552040519264116938>"
        },
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.ab240a732",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.59e0a3929",
        "role": "button",
        "separator": "\n\n"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:208"
  },
  {
    "id": "bot:ui.orderEmbeds:invitation_embed",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.4913131f4",
    "keys": [
      "bot.ui.orderEmbeds.4913131f4",
      "bot.ui.orderEmbeds.dc6365589",
      "bot.ui.orderEmbeds.4a04ac0af",
      "bot.ui.orderEmbeds.fb1c13b93",
      "bot.ui.orderEmbeds.8416e84f9",
      "bot.ui.orderEmbeds.4b70aded7",
      "bot.ui.orderEmbeds.7ffaf7697",
      "bot.ui.orderEmbeds.8015bc495",
      "bot.ui.orderEmbeds.a327939c3",
      "bot.ui.orderEmbeds.6bbefe78b",
      "bot.ui.orderEmbeds.c1100eb2f",
      "bot.ui.orderEmbeds.b8a9344d2"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.4913131f4",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.dc6365589",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.4a04ac0af",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.fb1c13b93",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.8416e84f9",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.4b70aded7",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.7ffaf7697",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.8015bc495",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.a327939c3",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "!yes.{displayNo}",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.6bbefe78b",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "!no.{displayNo}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.c1100eb2f",
        "role": "button",
        "separator": "\n\n"
      },
      {
        "key": "bot.ui.orderEmbeds.b8a9344d2",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:474"
  },
  {
    "id": "bot:ui.orderEmbeds:discount_prompt_embed",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.66b254bd0",
    "keys": [
      "bot.ui.orderEmbeds.66b254bd0",
      "bot.ui.orderEmbeds.038fbb3cb",
      "bot.ui.orderEmbeds.8416e84f9",
      "bot.ui.orderEmbeds.2c33f9c1e",
      "bot.ui.orderEmbeds.3f6a3a0cd",
      "bot.ui.orderEmbeds.fc31c6c43",
      "bot.ui.orderEmbeds.1df8eabb4",
      "bot.ui.orderEmbeds.7e716f2ef",
      "bot.ui.orderEmbeds.36f91b5b1"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.66b254bd0",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.038fbb3cb",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.8416e84f9",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.2c33f9c1e",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "key": "bot.ui.orderEmbeds.3f6a3a0cd",
        "role": "label",
        "examples": {
          "fixed2": "9"
        },
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.fc31c6c43",
        "role": "text",
        "examples": {
          "fixed1": "20"
        }
      },
      {
        "key": "bot.ui.orderEmbeds.1df8eabb4",
        "role": "label",
        "examples": {
          "fixed2": "8"
        },
        "separator": "\n"
      },
      {
        "text": "​",
        "role": "text"
      },
      {
        "key": "bot.ui.orderEmbeds.7e716f2ef",
        "role": "label",
        "examples": {
          "fixed2": "7"
        },
        "separator": "\n"
      },
      {
        "text": "​",
        "role": "text"
      },
      {
        "key": "bot.ui.orderEmbeds.36f91b5b1",
        "role": "label",
        "examples": {
          "fixed2": "9"
        },
        "separator": "\n"
      },
      {
        "text": "​",
        "role": "text"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:527"
  },
  {
    "id": "bot:ui.orderEmbeds:PW_accept_embed",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.c88b67f57",
    "keys": [
      "bot.ui.orderEmbeds.c88b67f57",
      "bot.ui.orderEmbeds.1e19f8708",
      "bot.ui.orderEmbeds.39084fa3a",
      "bot.ui.orderEmbeds.8416e84f9",
      "bot.ui.orderEmbeds.01361b502",
      "bot.ui.orderEmbeds.90cba4582"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.c88b67f57",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.1e19f8708",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.39084fa3a",
        "role": "text",
        "examples": {
          "fixed2": "5"
        },
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.8416e84f9",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.01361b502",
        "role": "text",
        "examples": {
          "fixed1": "!陪玩结单",
          "fixed2": "!老板结单"
        },
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.90cba4582",
        "role": "button",
        "separator": "\n\n"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:620"
  },
  {
    "id": "bot:ui.orderEmbeds:PW_decline_embed",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.302314426",
    "keys": [
      "bot.ui.orderEmbeds.302314426",
      "bot.ui.orderEmbeds.b9cc6f83a",
      "bot.ui.orderEmbeds.49f5b4dd2",
      "bot.ui.orderEmbeds.9e49e719c",
      "bot.ui.orderEmbeds.b5ebbbf19"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.302314426",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.b9cc6f83a",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.49f5b4dd2",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.9e49e719c",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.b5ebbbf19",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:648"
  },
  {
    "id": "bot:ui.orderEmbeds:invite_success_boss_embed",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.62a10e343",
    "keys": [
      "bot.ui.orderEmbeds.62a10e343",
      "bot.ui.orderEmbeds.14cde25a3",
      "bot.ui.orderEmbeds.d1c0532bb",
      "bot.ui.orderEmbeds.77b71d47e",
      "bot.ui.orderEmbeds.bcc1a255f",
      "bot.ui.orderEmbeds.170c60fa6",
      "bot.ui.orderEmbeds.90cba4582"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.62a10e343",
        "role": "title",
        "examples": {
          "fixed1": "<a:a1:1552516034647302187>"
        },
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.14cde25a3",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.d1c0532bb",
        "role": "text",
        "separator": "\n\n"
      },
      {
        "key": "bot.ui.orderEmbeds.77b71d47e",
        "role": "text",
        "examples": {
          "fixed1": "<a:191:1552040519264116938>"
        },
        "separator": "\n\n"
      },
      {
        "key": "bot.ui.orderEmbeds.bcc1a255f",
        "role": "text",
        "examples": {
          "fixed1": "5"
        },
        "separator": "\n\n"
      },
      {
        "key": "bot.ui.orderEmbeds.170c60fa6",
        "role": "text",
        "examples": {
          "fixed1": "<a:47:1552516013780631552>",
          "fixed2": "!陪玩结单",
          "fixed3": "!老板结单"
        },
        "separator": "\n\n"
      },
      {
        "key": "bot.ui.orderEmbeds.90cba4582",
        "role": "button",
        "separator": "\n\n"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:661"
  },
  {
    "id": "bot:ui.orderEmbeds:order_end_boss_embed",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.804124806",
    "keys": [
      "bot.ui.orderEmbeds.e020f8fd4",
      "bot.ui.orderEmbeds.804124806",
      "bot.ui.orderEmbeds.8416e84f9",
      "bot.ui.orderEmbeds.d10ddc00f",
      "bot.ui.orderEmbeds.9cd161a69",
      "bot.ui.orderEmbeds.10b5ca666",
      "bot.ui.orderEmbeds.85051d68c",
      "bot.ui.orderEmbeds.90dd604af",
      "bot.ui.orderEmbeds.953a5f507",
      "bot.ui.orderEmbeds.f3770b5d6",
      "bot.ui.orderEmbeds.7a1388bbc",
      "bot.ui.orderEmbeds.9b47014f5",
      "bot.ui.orderEmbeds.c6a43cfef",
      "bot.presentation.completionNote"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.e020f8fd4",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.804124806",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.8416e84f9",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.d10ddc00f",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.9cd161a69",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.10b5ca666",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.85051d68c",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.90dd604af",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.953a5f507",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.f3770b5d6",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.7a1388bbc",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.9b47014f5",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.c6a43cfef",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.presentation.completionNote",
        "role": "footer",
        "separator": "\n"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:683"
  },
  {
    "id": "bot:ui.orderEmbeds:order_end_pw_embed",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.8d1b37610",
    "keys": [
      "bot.ui.orderEmbeds.e020f8fd4",
      "bot.ui.orderEmbeds.afbdade05",
      "bot.ui.orderEmbeds.8d1b37610",
      "bot.ui.orderEmbeds.8416e84f9",
      "bot.ui.orderEmbeds.63723191b",
      "bot.ui.orderEmbeds.10b5ca666",
      "bot.ui.orderEmbeds.1a807c87f",
      "bot.ui.orderEmbeds.27e0a634a",
      "bot.ui.orderEmbeds.9b47014f5",
      "bot.ui.orderEmbeds.6daccb89c",
      "bot.presentation.completionNote"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.e020f8fd4",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.afbdade05",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.8d1b37610",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.8416e84f9",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.63723191b",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.10b5ca666",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.1a807c87f",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.27e0a634a",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.9b47014f5",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.6daccb89c",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.presentation.completionNote",
        "role": "footer",
        "separator": "\n"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:724"
  },
  {
    "id": "bot:ui.orderEmbeds:refuse_order_request_embed",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.89ae1fa15",
    "keys": [
      "bot.ui.orderEmbeds.89ae1fa15",
      "bot.ui.orderEmbeds.a0ea0e0ee",
      "bot.ui.orderEmbeds.50907d255"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.89ae1fa15",
        "role": "title",
        "separator": ""
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.a0ea0e0ee",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.50907d255",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:754"
  },
  {
    "id": "bot:ui.orderEmbeds:invite_successfully_inDiscord_embed",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.d3690ddce",
    "keys": [
      "bot.ui.orderEmbeds.d36dbaa90",
      "bot.ui.orderEmbeds.d3690ddce",
      "bot.ui.orderEmbeds.ffdacd78f"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.d36dbaa90",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.d3690ddce",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.ffdacd78f",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "\n<:_001_:1556053152917094562> https://dlmclub.com",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:775"
  },
  {
    "id": "bot:ui.orderEmbeds:anon_invite_successfully_inDiscord_embed",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.1c8b22a0a",
    "keys": [
      "bot.ui.orderEmbeds.d36dbaa90",
      "bot.ui.orderEmbeds.1c8b22a0a",
      "bot.ui.orderEmbeds.ffdacd78f"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.d36dbaa90",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.1c8b22a0a",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.ffdacd78f",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "\n<:_001_:1556053152917094562> https://dlmclub.com",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:794"
  },
  {
    "id": "bot:services.auditionService:buildWorkerDmPayload",
    "kind": "card",
    "titleKey": "bot.services.auditionService.4abd08523",
    "keys": [
      "bot.services.auditionService.4abd08523",
      "bot.services.auditionService.5fbc7dd65",
      "bot.services.auditionService.b2976253d",
      "bot.services.auditionService.3d20c22e3",
      "bot.services.auditionService.3fca989f6",
      "bot.services.auditionService.6e0ede19b",
      "bot.services.auditionService.40f5d0f7a"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.4abd08523",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.5fbc7dd65",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.b2976253d",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3d20c22e3",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3fca989f6",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.6e0ede19b",
        "role": "button",
        "separator": "\n\n"
      },
      {
        "key": "bot.services.auditionService.40f5d0f7a",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:120"
  },
  {
    "id": "bot:services.autoCommissionBuffService:notifyLuckyStarPromotion",
    "kind": "card",
    "titleKey": "bot.services.autoCommissionBuffService.3b9d9c89e",
    "keys": [
      "bot.services.autoCommissionBuffService.3b9d9c89e",
      "bot.services.autoCommissionBuffService.980c8f80d",
      "bot.services.autoCommissionBuffService.f37f2b695",
      "bot.services.autoCommissionBuffService.4e27403e9"
    ],
    "parts": [
      {
        "key": "bot.services.autoCommissionBuffService.3b9d9c89e",
        "role": "text",
        "examples": {
          "LUCKY_STAR_EMOJI": "<:chatVoucherEmoji:1552516059641159714>",
          "CONGRATS_EMOJI": "<:congrats:1552516027022057554>"
        },
        "separator": "\n"
      },
      {
        "key": "bot.services.autoCommissionBuffService.980c8f80d",
        "role": "text",
        "examples": {
          "fixed1": "30",
          "fixed2": "12",
          "fixed3": "000"
        },
        "separator": "\n"
      },
      {
        "key": "bot.services.autoCommissionBuffService.f37f2b695",
        "role": "text",
        "examples": {
          "LUCKY_STAR_EMOJI": "<:chatVoucherEmoji:1552516059641159714>",
          "fixed3": "91%"
        },
        "separator": "\n"
      },
      {
        "key": "bot.services.autoCommissionBuffService.4e27403e9",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/autoCommissionBuffService.ts:105"
  },
  {
    "id": "bot:services.autoCommissionBuffService:notifyLuckyStarExpiryReminder",
    "kind": "card",
    "titleKey": "bot.services.autoCommissionBuffService.d596684bd",
    "keys": [
      "bot.services.autoCommissionBuffService.d596684bd",
      "bot.services.autoCommissionBuffService.185bad761",
      "bot.services.autoCommissionBuffService.bb319725b"
    ],
    "parts": [
      {
        "key": "bot.services.autoCommissionBuffService.d596684bd",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.autoCommissionBuffService.185bad761",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.autoCommissionBuffService.bb319725b",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/autoCommissionBuffService.ts:127"
  },
  {
    "id": "bot:ui.scratchEmbeds:buildScratchPendingEmbed:voucher",
    "kind": "card",
    "titleKey": "bot.ui.scratchEmbeds.c31d755ca",
    "keys": [
      "bot.ui.scratchEmbeds.c73e4cd24",
      "bot.ui.scratchEmbeds.c31d755ca",
      "bot.ui.scratchEmbeds.3578fd46a",
      "bot.ui.scratchEmbeds.389b4c398",
      "bot.ui.scratchEmbeds.701892c46",
      "bot.ui.scratchEmbeds.c236ea228",
      "bot.ui.scratchEmbeds.7baf1c6b9",
      "bot.ui.scratchEmbeds.c360e1cc1",
      "bot.ui.scratchEmbeds.c592fb322",
      "bot.ui.scratchEmbeds.f22afbc9b"
    ],
    "parts": [
      {
        "key": "bot.ui.scratchEmbeds.c73e4cd24",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.scratchEmbeds.c31d755ca",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.3578fd46a",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "<@{buyerId}>",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.389b4c398",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.701892c46",
        "role": "text",
        "examples": {
          "fixed3": "!刮刮乐",
          "fixed4": "!刮刮乐",
          "fixed5": "!刮刮乐",
          "fixed6": "!刮刮乐"
        },
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.c236ea228",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.7baf1c6b9",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.c360e1cc1",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.c592fb322",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.f22afbc9b",
        "role": "button",
        "separator": "\n\n\n"
      }
    ],
    "source": "src/ui/scratchEmbeds.ts:37"
  },
  {
    "id": "bot:ui.scratchEmbeds:buildScratchPendingEmbed:paid",
    "kind": "card",
    "titleKey": "bot.ui.scratchEmbeds.436982dd2",
    "keys": [
      "bot.ui.scratchEmbeds.c73e4cd24",
      "bot.ui.scratchEmbeds.436982dd2",
      "bot.ui.scratchEmbeds.3578fd46a",
      "bot.ui.scratchEmbeds.389b4c398",
      "bot.ui.scratchEmbeds.701892c46",
      "bot.ui.scratchEmbeds.c236ea228",
      "bot.ui.scratchEmbeds.7baf1c6b9",
      "bot.ui.scratchEmbeds.c360e1cc1",
      "bot.ui.scratchEmbeds.c592fb322",
      "bot.ui.scratchEmbeds.f22afbc9b"
    ],
    "parts": [
      {
        "key": "bot.ui.scratchEmbeds.c73e4cd24",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.scratchEmbeds.436982dd2",
        "role": "text",
        "examples": {
          "amount": "19.00"
        },
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.3578fd46a",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "<@{buyerId}>",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.389b4c398",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.701892c46",
        "role": "text",
        "examples": {
          "fixed3": "!刮刮乐",
          "fixed4": "!刮刮乐",
          "fixed5": "!刮刮乐",
          "fixed6": "!刮刮乐"
        },
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.c236ea228",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.7baf1c6b9",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.c360e1cc1",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.c592fb322",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.f22afbc9b",
        "role": "button",
        "separator": "\n\n\n"
      }
    ],
    "source": "src/ui/scratchEmbeds.ts:37"
  },
  {
    "id": "bot:ui.scratchEmbeds:buildScratchRevealedEmbed:thanks",
    "kind": "card",
    "titleKey": "bot.ui.scratchEmbeds.705417213",
    "keys": [
      "bot.ui.scratchEmbeds.7810dc9ef",
      "bot.ui.scratchEmbeds.705417213",
      "bot.ui.scratchEmbeds.3578fd46a",
      "bot.ui.scratchEmbeds.389b4c398",
      "bot.ui.scratchEmbeds.701892c46",
      "bot.ui.scratchEmbeds.c360e1cc1",
      "bot.ui.scratchEmbeds.c592fb322"
    ],
    "parts": [
      {
        "key": "bot.ui.scratchEmbeds.7810dc9ef",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.scratchEmbeds.705417213",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.3578fd46a",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "<@{buyerId}>",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.389b4c398",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.701892c46",
        "role": "text",
        "examples": {
          "fixed3": "!刮刮乐",
          "fixed4": "!刮刮乐",
          "fixed5": "!刮刮乐",
          "fixed6": "!刮刮乐"
        },
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.c360e1cc1",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.c592fb322",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/ui/scratchEmbeds.ts:83"
  },
  {
    "id": "bot:ui.scratchEmbeds:buildScratchRevealedEmbed:prize",
    "kind": "card",
    "titleKey": "bot.ui.scratchEmbeds.3f9912213",
    "keys": [
      "bot.ui.scratchEmbeds.7810dc9ef",
      "bot.ui.scratchEmbeds.3f9912213",
      "bot.ui.scratchEmbeds.3578fd46a",
      "bot.ui.scratchEmbeds.389b4c398",
      "bot.ui.scratchEmbeds.701892c46",
      "bot.ui.scratchEmbeds.c360e1cc1",
      "bot.ui.scratchEmbeds.c592fb322"
    ],
    "parts": [
      {
        "key": "bot.ui.scratchEmbeds.7810dc9ef",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.scratchEmbeds.3f9912213",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.3578fd46a",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "<@{buyerId}>",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.389b4c398",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.701892c46",
        "role": "text",
        "examples": {
          "fixed3": "!刮刮乐",
          "fixed4": "!刮刮乐",
          "fixed5": "!刮刮乐",
          "fixed6": "!刮刮乐"
        },
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.c360e1cc1",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.scratchEmbeds.c592fb322",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/ui/scratchEmbeds.ts:83"
  },
  {
    "id": "bot:services.redEnvelopeService:buildRedEnvelopeMessagePayload:keyword-active",
    "kind": "card",
    "titleKey": "bot.services.redEnvelopeService.77d4fdd09",
    "keys": [
      "bot.services.redEnvelopeService.827e317e2",
      "bot.services.redEnvelopeService.dac271ab2",
      "bot.services.redEnvelopeService.77d4fdd09",
      "bot.services.redEnvelopeService.03d5b1abc",
      "bot.services.redEnvelopeService.14a0a5dba",
      "bot.services.redEnvelopeService.d028af822"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.827e317e2",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.redEnvelopeService.dac271ab2",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.77d4fdd09",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.03d5b1abc",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.14a0a5dba",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.d028af822",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "{value}",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:589"
  },
  {
    "id": "bot:services.redEnvelopeService:buildRedEnvelopeMessagePayload:keyword-finished",
    "kind": "card",
    "titleKey": "bot.services.redEnvelopeService.9cf67288a",
    "keys": [
      "bot.services.redEnvelopeService.827e317e2",
      "bot.services.redEnvelopeService.dac271ab2",
      "bot.services.redEnvelopeService.77d4fdd09",
      "bot.services.redEnvelopeService.03d5b1abc",
      "bot.services.redEnvelopeService.14a0a5dba",
      "bot.services.redEnvelopeService.d028af822",
      "bot.services.redEnvelopeService.b2d3e400e",
      "bot.services.redEnvelopeService.31cb2928d",
      "bot.services.redEnvelopeService.7cde15b87",
      "bot.services.redEnvelopeService.060835446",
      "bot.services.redEnvelopeService.9cf67288a"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.827e317e2",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.redEnvelopeService.dac271ab2",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.77d4fdd09",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.03d5b1abc",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.14a0a5dba",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.d028af822",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "{value}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.b2d3e400e",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.31cb2928d",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.7cde15b87",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.060835446",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.9cf67288a",
        "role": "footer",
        "separator": "\n"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:589"
  },
  {
    "id": "bot:services.redEnvelopeService:buildRedEnvelopeMessagePayload:keyword-refunded",
    "kind": "card",
    "titleKey": "bot.services.redEnvelopeService.9af722670",
    "keys": [
      "bot.services.redEnvelopeService.827e317e2",
      "bot.services.redEnvelopeService.dac271ab2",
      "bot.services.redEnvelopeService.77d4fdd09",
      "bot.services.redEnvelopeService.03d5b1abc",
      "bot.services.redEnvelopeService.14a0a5dba",
      "bot.services.redEnvelopeService.d028af822",
      "bot.services.redEnvelopeService.9af722670"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.827e317e2",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.redEnvelopeService.dac271ab2",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.77d4fdd09",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.03d5b1abc",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.14a0a5dba",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.d028af822",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "{value}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.9af722670",
        "role": "footer",
        "separator": "\n"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:589"
  },
  {
    "id": "bot:services.redEnvelopeService:buildRedEnvelopeMessagePayload:reaction-active",
    "kind": "card",
    "titleKey": "bot.services.redEnvelopeService.cd87ab3a8",
    "keys": [
      "bot.services.redEnvelopeService.827e317e2",
      "bot.services.redEnvelopeService.dac271ab2",
      "bot.services.redEnvelopeService.14a0a5dba",
      "bot.services.redEnvelopeService.cd87ab3a8",
      "bot.services.redEnvelopeService.d028af822"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.827e317e2",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.redEnvelopeService.dac271ab2",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.14a0a5dba",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.cd87ab3a8",
        "role": "text",
        "examples": {
          "CLAIM_EMOJI": "🧧"
        },
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.d028af822",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "{value}",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:589"
  },
  {
    "id": "bot:services.redEnvelopeService:buildRedEnvelopeMessagePayload:reaction-finished",
    "kind": "card",
    "titleKey": "bot.services.redEnvelopeService.9cf67288a",
    "keys": [
      "bot.services.redEnvelopeService.827e317e2",
      "bot.services.redEnvelopeService.dac271ab2",
      "bot.services.redEnvelopeService.14a0a5dba",
      "bot.services.redEnvelopeService.cd87ab3a8",
      "bot.services.redEnvelopeService.d028af822",
      "bot.services.redEnvelopeService.b2d3e400e",
      "bot.services.redEnvelopeService.31cb2928d",
      "bot.services.redEnvelopeService.7cde15b87",
      "bot.services.redEnvelopeService.060835446",
      "bot.services.redEnvelopeService.9cf67288a"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.827e317e2",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.redEnvelopeService.dac271ab2",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.14a0a5dba",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.cd87ab3a8",
        "role": "text",
        "examples": {
          "CLAIM_EMOJI": "🧧"
        },
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.d028af822",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "{value}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.b2d3e400e",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.31cb2928d",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.7cde15b87",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.060835446",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.9cf67288a",
        "role": "footer",
        "separator": "\n"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:589"
  },
  {
    "id": "bot:services.redEnvelopeService:buildRedEnvelopeMessagePayload:reaction-refunded",
    "kind": "card",
    "titleKey": "bot.services.redEnvelopeService.9af722670",
    "keys": [
      "bot.services.redEnvelopeService.827e317e2",
      "bot.services.redEnvelopeService.dac271ab2",
      "bot.services.redEnvelopeService.14a0a5dba",
      "bot.services.redEnvelopeService.cd87ab3a8",
      "bot.services.redEnvelopeService.d028af822",
      "bot.services.redEnvelopeService.9af722670"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.827e317e2",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.redEnvelopeService.dac271ab2",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.14a0a5dba",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.cd87ab3a8",
        "role": "text",
        "examples": {
          "CLAIM_EMOJI": "🧧"
        },
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.d028af822",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "{value}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.9af722670",
        "role": "footer",
        "separator": "\n"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:589"
  },
  {
    "id": "bot:ui.blockStackEmbeds:buildBlockStackEmbed:active",
    "kind": "card",
    "titleKey": "bot.ui.blockStackEmbeds.bd3401416",
    "keys": [
      "bot.ui.blockStackEmbeds.d9e9ae68c",
      "bot.ui.blockStackEmbeds.9ea02b96b",
      "bot.ui.blockStackEmbeds.f0b8704fc",
      "bot.ui.blockStackEmbeds.1a6e6dd6e",
      "bot.ui.blockStackEmbeds.6c04c213c",
      "bot.ui.blockStackEmbeds.639a125d7",
      "bot.ui.blockStackEmbeds.0fc1e8d6a",
      "bot.ui.blockStackEmbeds.f2e998ee2",
      "bot.ui.blockStackEmbeds.6bbaa4e8d",
      "bot.ui.blockStackEmbeds.bd3401416",
      "bot.ui.blockStackEmbeds.5ba228651",
      "bot.ui.blockStackEmbeds.22c72ab80",
      "bot.ui.blockStackEmbeds.5878f19d0",
      "bot.ui.blockStackEmbeds.46e971850",
      "bot.ui.blockStackEmbeds.10df3ca1d"
    ],
    "parts": [
      {
        "key": "bot.ui.blockStackEmbeds.d9e9ae68c",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.9ea02b96b",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.f0b8704fc",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.1a6e6dd6e",
        "role": "text",
        "examples": {
          "fixed1": "10"
        },
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.6c04c213c",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.639a125d7",
        "role": "text",
        "separator": ""
      },
      {
        "text": "\n",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.0fc1e8d6a",
        "role": "text",
        "examples": {
          "fixed1": "!抽积木"
        },
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.f2e998ee2",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "<@{creatorId}>",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.6bbaa4e8d",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.bd3401416",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.5ba228651",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{totalBlocks}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.22c72ab80",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "**{lastAction}**",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.5878f19d0",
        "role": "button",
        "separator": "\n\n\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.46e971850",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.10df3ca1d",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/ui/blockStackEmbeds.ts:71"
  },
  {
    "id": "bot:ui.blockStackEmbeds:buildBlockStackEmbed:collapsed",
    "kind": "card",
    "titleKey": "bot.ui.blockStackEmbeds.720bfe571",
    "keys": [
      "bot.ui.blockStackEmbeds.d9e9ae68c",
      "bot.ui.blockStackEmbeds.9ea02b96b",
      "bot.ui.blockStackEmbeds.f0b8704fc",
      "bot.ui.blockStackEmbeds.1a6e6dd6e",
      "bot.ui.blockStackEmbeds.6c04c213c",
      "bot.ui.blockStackEmbeds.639a125d7",
      "bot.ui.blockStackEmbeds.0fc1e8d6a",
      "bot.ui.blockStackEmbeds.f2e998ee2",
      "bot.ui.blockStackEmbeds.6bbaa4e8d",
      "bot.ui.blockStackEmbeds.720bfe571",
      "bot.ui.blockStackEmbeds.5ba228651",
      "bot.ui.blockStackEmbeds.22c72ab80"
    ],
    "parts": [
      {
        "key": "bot.ui.blockStackEmbeds.d9e9ae68c",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.9ea02b96b",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.f0b8704fc",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.1a6e6dd6e",
        "role": "text",
        "examples": {
          "fixed1": "10"
        },
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.6c04c213c",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.639a125d7",
        "role": "text",
        "separator": ""
      },
      {
        "text": "\n",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.0fc1e8d6a",
        "role": "text",
        "examples": {
          "fixed1": "!抽积木"
        },
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.f2e998ee2",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "<@{creatorId}>",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.6bbaa4e8d",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.720bfe571",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.5ba228651",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{totalBlocks}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.22c72ab80",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "**{lastAction}**",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/ui/blockStackEmbeds.ts:71"
  },
  {
    "id": "bot:ui.blockStackEmbeds:buildBlockStackEmbed:settled",
    "kind": "card",
    "titleKey": "bot.ui.blockStackEmbeds.49f6f39fa",
    "keys": [
      "bot.ui.blockStackEmbeds.d9e9ae68c",
      "bot.ui.blockStackEmbeds.9ea02b96b",
      "bot.ui.blockStackEmbeds.f0b8704fc",
      "bot.ui.blockStackEmbeds.1a6e6dd6e",
      "bot.ui.blockStackEmbeds.6c04c213c",
      "bot.ui.blockStackEmbeds.639a125d7",
      "bot.ui.blockStackEmbeds.0fc1e8d6a",
      "bot.ui.blockStackEmbeds.f2e998ee2",
      "bot.ui.blockStackEmbeds.6bbaa4e8d",
      "bot.ui.blockStackEmbeds.49f6f39fa",
      "bot.ui.blockStackEmbeds.5ba228651",
      "bot.ui.blockStackEmbeds.b6abe5f45",
      "bot.ui.blockStackEmbeds.f83a89e7e",
      "bot.ui.blockStackEmbeds.22c72ab80"
    ],
    "parts": [
      {
        "key": "bot.ui.blockStackEmbeds.d9e9ae68c",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.9ea02b96b",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.f0b8704fc",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.1a6e6dd6e",
        "role": "text",
        "examples": {
          "fixed1": "10"
        },
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.6c04c213c",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.639a125d7",
        "role": "text",
        "separator": ""
      },
      {
        "text": "\n",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.0fc1e8d6a",
        "role": "text",
        "examples": {
          "fixed1": "!抽积木"
        },
        "separator": ""
      },
      {
        "key": "bot.ui.blockStackEmbeds.f2e998ee2",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "<@{creatorId}>",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.6bbaa4e8d",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.49f6f39fa",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.5ba228651",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{totalBlocks}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.b6abe5f45",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.f83a89e7e",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.blockStackEmbeds.22c72ab80",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "**{lastAction}**",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/ui/blockStackEmbeds.ts:71"
  },
  {
    "id": "bot:welcome",
    "kind": "message",
    "titleKey": "bot.presentation.welcomeGreeting",
    "keys": [
      "bot.presentation.welcomeGreeting",
      "bot.presentation.welcomeIntro",
      "bot.ui.welcomeMessage.3e2811eb4",
      "bot.ui.welcomeMessage.ee18cff1e",
      "bot.ui.welcomeMessage.ddfff64b6",
      "bot.ui.welcomeMessage.46d69afa2",
      "bot.ui.welcomeMessage.f3d707462"
    ],
    "parts": [
      {
        "key": "bot.presentation.welcomeGreeting",
        "role": "text",
        "separator": ""
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.presentation.welcomeIntro",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.welcomeMessage.3e2811eb4",
        "role": "text",
        "examples": {
          "fixed1": "1",
          "fixed2": "9"
        },
        "separator": "\n"
      },
      {
        "key": "bot.ui.welcomeMessage.ee18cff1e",
        "role": "text",
        "examples": {
          "fixed1": "50"
        },
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.welcomeMessage.ddfff64b6",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.welcomeMessage.46d69afa2",
        "role": "text",
        "examples": {
          "fixed1": "https://dlmclub.com/join"
        },
        "separator": "\n"
      },
      {
        "key": "bot.ui.welcomeMessage.f3d707462",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/ui/welcomeMessage.ts:7"
  },
  {
    "id": "bot:dispatch:public",
    "kind": "card",
    "titleKey": "bot.dispatch.title",
    "keys": [
      "bot.dispatch.requestHint",
      "bot.dispatch.title",
      "bot.dispatch.description",
      "bot.ui.orderEmbeds.activitiesHeading",
      "bot.ui.orderEmbeds.4f3d31785"
    ],
    "parts": [
      {
        "key": "bot.dispatch.requestHint",
        "role": "text"
      },
      {
        "key": "bot.dispatch.title",
        "role": "title",
        "separator": "\n"
      },
      {
        "key": "bot.dispatch.description",
        "role": "text",
        "separator": "\n",
        "examples": {
          "caller": "{caller}"
        }
      },
      {
        "text": "<a:41:1552515993182412812> {mentionLinePlain}",
        "role": "text",
        "separator": "\n\n"
      },
      {
        "key": "bot.ui.orderEmbeds.activitiesHeading",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "{activities}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.4f3d31785",
        "role": "button",
        "separator": "\n",
        "examples": {
          "value": 0
        }
      }
    ],
    "source": "src/ui/orderEmbeds.ts:133"
  },
  {
    "id": "bot:dispatch:anonymous",
    "kind": "card",
    "titleKey": "bot.dispatch.title",
    "keys": [
      "bot.dispatch.requestHint",
      "bot.dispatch.title",
      "bot.dispatch.description",
      "bot.ui.orderEmbeds.activitiesHeading",
      "bot.ui.orderEmbeds.4f3d31785"
    ],
    "parts": [
      {
        "key": "bot.dispatch.requestHint",
        "role": "text"
      },
      {
        "key": "bot.dispatch.title",
        "role": "title",
        "separator": "\n"
      },
      {
        "key": "bot.dispatch.description",
        "role": "text",
        "separator": "\n",
        "examples": {
          "caller": "匿名老板"
        }
      },
      {
        "text": "<a:41:1552515993182412812> {mentionLinePlain}",
        "role": "text",
        "separator": "\n\n"
      },
      {
        "key": "bot.ui.orderEmbeds.activitiesHeading",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "{activities}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.4f3d31785",
        "role": "button",
        "separator": "\n",
        "examples": {
          "value": 0
        }
      }
    ],
    "source": "src/ui/orderEmbeds.ts:171"
  },
  {
    "id": "bot:message:cf4873918cc3",
    "kind": "message",
    "titleKey": "bot.services.orderInteractionManager.791479a05",
    "keys": [
      "bot.services.orderInteractionManager.791479a05"
    ],
    "parts": [
      {
        "key": "bot.services.orderInteractionManager.791479a05",
        "role": "text",
        "examples": {
          "fixed2": "10"
        }
      }
    ],
    "source": "src/services/orderInteractionManager.ts:286"
  },
  {
    "id": "bot:message:76ed8661b54f",
    "kind": "message",
    "titleKey": "bot.services.spentRoleService.a72c3a5f0",
    "keys": [
      "bot.services.spentRoleService.a72c3a5f0",
      "bot.services.spentRoleService.9a39a9e57",
      "bot.services.spentRoleService.7138920f5"
    ],
    "parts": [
      {
        "key": "bot.services.spentRoleService.a72c3a5f0",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.spentRoleService.9a39a9e57",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "- {missingBenefits}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.spentRoleService.7138920f5",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/spentRoleService.ts:182"
  },
  {
    "id": "bot:message:46fde3659824",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.play.0086fe276",
    "keys": [
      "bot.interactions.buttons.play.0086fe276"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.play.0086fe276",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/play.ts:296"
  },
  {
    "id": "bot:message:89d632636dcd",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.play.52a0e6d8e",
    "keys": [
      "bot.interactions.buttons.play.52a0e6d8e"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.play.52a0e6d8e",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/play.ts:540"
  },
  {
    "id": "bot:message:9dc70e2e0cd5",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.play.a795828d9",
    "keys": [
      "bot.interactions.buttons.play.a795828d9"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.play.a795828d9",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/play.ts:555"
  },
  {
    "id": "bot:message:c9a807285e3d",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.play.49273498c",
    "keys": [
      "bot.interactions.buttons.play.49273498c"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.play.49273498c",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/play.ts:558"
  },
  {
    "id": "bot:message:fa8d05b90e40",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.play.21806934b",
    "keys": [
      "bot.interactions.buttons.play.21806934b"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.play.21806934b",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/play.ts:589"
  },
  {
    "id": "bot:message:1ee739a28a9b",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.miniDispatch.c6e6ba8d2",
    "keys": [
      "bot.interactions.buttons.miniDispatch.c6e6ba8d2"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.miniDispatch.c6e6ba8d2",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/miniDispatch.ts:18"
  },
  {
    "id": "bot:message:be9d807013e8",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.miniDispatch.f3ba8f4a9",
    "keys": [
      "bot.interactions.buttons.miniDispatch.f3ba8f4a9"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.miniDispatch.f3ba8f4a9",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/miniDispatch.ts:26"
  },
  {
    "id": "bot:message:89ef92a95b90",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.miniDispatch.0871b9758",
    "keys": [
      "bot.interactions.buttons.miniDispatch.0871b9758"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.miniDispatch.0871b9758",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/miniDispatch.ts:30"
  },
  {
    "id": "bot:message:624896185fb9",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.miniDispatch.69e18746d",
    "keys": [
      "bot.interactions.buttons.miniDispatch.69e18746d"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.miniDispatch.69e18746d",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/miniDispatch.ts:66"
  },
  {
    "id": "bot:message:d3eda426fb3e",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.miniDispatch.255f4a21e",
    "keys": [
      "bot.interactions.buttons.miniDispatch.255f4a21e"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.miniDispatch.255f4a21e",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/miniDispatch.ts:69"
  },
  {
    "id": "bot:message:9c5f8d05d5db",
    "kind": "message",
    "titleKey": "bot.services.timerService.a0105f104",
    "keys": [
      "bot.services.timerService.a0105f104"
    ],
    "parts": [
      {
        "key": "bot.services.timerService.a0105f104",
        "role": "text"
      }
    ],
    "source": "src/services/timerService.ts:91"
  },
  {
    "id": "bot:message:2334bc3767a1",
    "kind": "message",
    "titleKey": "bot.services.timerService.70437b3c0",
    "keys": [
      "bot.services.timerService.70437b3c0"
    ],
    "parts": [
      {
        "key": "bot.services.timerService.70437b3c0",
        "role": "text"
      }
    ],
    "source": "src/services/timerService.ts:99"
  },
  {
    "id": "bot:message:3f777e42301a",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.acceptOrder.d035817c6",
    "keys": [
      "bot.interactions.buttons.acceptOrder.d035817c6"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.acceptOrder.d035817c6",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/acceptOrder.ts:208"
  },
  {
    "id": "bot:message:f220635acdbb",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.acceptOrder.292b5f105",
    "keys": [
      "bot.interactions.buttons.acceptOrder.292b5f105"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.acceptOrder.292b5f105",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/acceptOrder.ts:213"
  },
  {
    "id": "bot:message:f36e08b8e492",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.declineOrder.363b595c3",
    "keys": [
      "bot.interactions.buttons.declineOrder.363b595c3"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.declineOrder.363b595c3",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/declineOrder.ts:150"
  },
  {
    "id": "bot:message:5fe6ea5e9720",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.declineOrder.40e6cb5e1",
    "keys": [
      "bot.interactions.buttons.declineOrder.40e6cb5e1"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.declineOrder.40e6cb5e1",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/declineOrder.ts:155"
  },
  {
    "id": "bot:message:89364e74ce67",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.declineOrder.bc28f1780",
    "keys": [
      "bot.interactions.buttons.declineOrder.bc28f1780"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.declineOrder.bc28f1780",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/declineOrder.ts:175"
  },
  {
    "id": "bot:message:8c78bba79dd1",
    "kind": "message",
    "titleKey": "bot.commands.lottery.9b93ba6f4",
    "keys": [
      "bot.commands.lottery.9b93ba6f4"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.9b93ba6f4",
        "role": "text",
        "examples": {
          "fixed1": "`!抽奖`",
          "fixed2": "`!抽奖 @用户`"
        }
      }
    ],
    "source": "src/commands/lottery.ts:76"
  },
  {
    "id": "bot:message:d4caf374e707",
    "kind": "message",
    "titleKey": "bot.commands.lottery.b27618240",
    "keys": [
      "bot.commands.lottery.b27618240"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.b27618240",
        "role": "text"
      }
    ],
    "source": "src/commands/lottery.ts:95"
  },
  {
    "id": "bot:message:b22a55f29248",
    "kind": "message",
    "titleKey": "bot.commands.lottery.7dfc9680d",
    "keys": [
      "bot.commands.lottery.7dfc9680d"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.7dfc9680d",
        "role": "text"
      }
    ],
    "source": "src/commands/lottery.ts:99"
  },
  {
    "id": "bot:message:f57ede13d9bc",
    "kind": "message",
    "titleKey": "bot.commands.lottery.472a8c5a0",
    "keys": [
      "bot.commands.lottery.472a8c5a0"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.472a8c5a0",
        "role": "text"
      }
    ],
    "source": "src/commands/lottery.ts:104"
  },
  {
    "id": "bot:message:e59cd8c9defd",
    "kind": "message",
    "titleKey": "bot.commands.lottery.5c7007dc5",
    "keys": [
      "bot.commands.lottery.5c7007dc5"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.5c7007dc5",
        "role": "text"
      }
    ],
    "source": "src/commands/lottery.ts:158"
  },
  {
    "id": "bot:message:8f1a1319bfd9",
    "kind": "message",
    "titleKey": "bot.commands.lottery.711d5938e",
    "keys": [
      "bot.commands.lottery.711d5938e"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.711d5938e",
        "role": "text"
      }
    ],
    "source": "src/commands/lottery.ts:169"
  },
  {
    "id": "bot:message:2b11d4012383",
    "kind": "message",
    "titleKey": "bot.commands.lottery.4e3928592",
    "keys": [
      "bot.commands.lottery.4e3928592"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.4e3928592",
        "role": "text",
        "examples": {
          "fixed3": "150",
          "fixed4": "600",
          "fixed5": "700"
        }
      }
    ],
    "source": "src/commands/lottery.ts:179"
  },
  {
    "id": "bot:message:7ed92d4c4d5d",
    "kind": "message",
    "titleKey": "bot.commands.renameCard.80cca201a",
    "keys": [
      "bot.commands.renameCard.80cca201a"
    ],
    "parts": [
      {
        "key": "bot.commands.renameCard.80cca201a",
        "role": "text"
      }
    ],
    "source": "src/commands/renameCard.ts:94"
  },
  {
    "id": "bot:message:93ffed684a45",
    "kind": "message",
    "titleKey": "bot.commands.renameCard.ea223dd10",
    "keys": [
      "bot.commands.renameCard.ea223dd10"
    ],
    "parts": [
      {
        "key": "bot.commands.renameCard.ea223dd10",
        "role": "text"
      }
    ],
    "source": "src/commands/renameCard.ts:102"
  },
  {
    "id": "bot:message:5968abfdf5d7",
    "kind": "message",
    "titleKey": "bot.commands.renameCard.67e3e8065",
    "keys": [
      "bot.commands.renameCard.67e3e8065"
    ],
    "parts": [
      {
        "key": "bot.commands.renameCard.67e3e8065",
        "role": "text"
      }
    ],
    "source": "src/commands/renameCard.ts:115"
  },
  {
    "id": "bot:message:6a53eb7072e9",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.e07c43f05",
    "keys": [
      "bot.events.messageCreate.e07c43f05"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.e07c43f05",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:348"
  },
  {
    "id": "bot:message:876673b39e93",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.5e16f9671",
    "keys": [
      "bot.events.messageCreate.5e16f9671"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.5e16f9671",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:351"
  },
  {
    "id": "bot:message:ea8729aa7ef6",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.c9072d958",
    "keys": [
      "bot.events.messageCreate.c9072d958"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.c9072d958",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:354"
  },
  {
    "id": "bot:message:eb9bbb6aa5ad",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.58847a171",
    "keys": [
      "bot.events.messageCreate.58847a171"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.58847a171",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:357"
  },
  {
    "id": "bot:message:66c98d3b8fe6",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.867205bb2",
    "keys": [
      "bot.events.messageCreate.867205bb2"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.867205bb2",
        "role": "text",
        "examples": {
          "fixed2": "!陪玩结单",
          "fixed3": "!老板结单"
        }
      }
    ],
    "source": "src/events/messageCreate.ts:361"
  },
  {
    "id": "bot:message:a618d64a2ace",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.34deaff5b",
    "keys": [
      "bot.events.messageCreate.34deaff5b"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.34deaff5b",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:384"
  },
  {
    "id": "bot:message:ea8ca5156d10",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.b37967522",
    "keys": [
      "bot.events.messageCreate.b37967522"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.b37967522",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:388"
  },
  {
    "id": "bot:message:e8a7d590d764",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.e3a7fe449",
    "keys": [
      "bot.events.messageCreate.e3a7fe449"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.e3a7fe449",
        "role": "text",
        "examples": {
          "fixed1": "`!点单 <陪玩编号>`",
          "fixed2": "`!点单 1101`"
        }
      }
    ],
    "source": "src/events/messageCreate.ts:408"
  },
  {
    "id": "bot:message:a721dfc14ba0",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.25b62b24a",
    "keys": [
      "bot.events.messageCreate.25b62b24a"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.25b62b24a",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:414"
  },
  {
    "id": "bot:message:40a8c039ec98",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.07d32a658",
    "keys": [
      "bot.events.messageCreate.07d32a658"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.07d32a658",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:428"
  },
  {
    "id": "bot:message:635692a75a9f",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.f7e8375fb",
    "keys": [
      "bot.events.messageCreate.f7e8375fb"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.f7e8375fb",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:457"
  },
  {
    "id": "bot:message:c791b05a4f6e",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.9ab3eb1f0",
    "keys": [
      "bot.events.messageCreate.9ab3eb1f0"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.9ab3eb1f0",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:461"
  },
  {
    "id": "bot:message:023b963e701a",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.844c17663",
    "keys": [
      "bot.events.messageCreate.844c17663"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.844c17663",
        "role": "text",
        "examples": {
          "fixed2": "100"
        }
      }
    ],
    "source": "src/events/messageCreate.ts:479"
  },
  {
    "id": "bot:message:0e04d9a4dc8e",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.d899b7139",
    "keys": [
      "bot.events.messageCreate.d899b7139"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.d899b7139",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:481"
  },
  {
    "id": "bot:message:904ed4eb0172",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.34890a17d",
    "keys": [
      "bot.events.messageCreate.34890a17d"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.34890a17d",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:498"
  },
  {
    "id": "bot:message:f8eea61a81d0",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.99d486e7e",
    "keys": [
      "bot.events.messageCreate.99d486e7e"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.99d486e7e",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:532"
  },
  {
    "id": "bot:message:b2aca59d305e",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.0a7986e1d",
    "keys": [
      "bot.events.messageCreate.0a7986e1d"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.0a7986e1d",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:538"
  },
  {
    "id": "bot:message:d11a2a394c72",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.29fbea65e",
    "keys": [
      "bot.events.messageCreate.29fbea65e"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.29fbea65e",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:547"
  },
  {
    "id": "bot:message:ee0d39761a65",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.ad8061329",
    "keys": [
      "bot.events.messageCreate.ad8061329"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.ad8061329",
        "role": "text",
        "examples": {
          "fixed1": "`!yes.12345`"
        }
      }
    ],
    "source": "src/events/messageCreate.ts:563"
  },
  {
    "id": "bot:message:54d523d141f0",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.100a616d6",
    "keys": [
      "bot.events.messageCreate.100a616d6"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.100a616d6",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:569"
  },
  {
    "id": "bot:message:8330e7ff096b",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.0efbac7ce",
    "keys": [
      "bot.events.messageCreate.0efbac7ce"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.0efbac7ce",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:592"
  },
  {
    "id": "bot:message:335809d94b71",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.fad899a20",
    "keys": [
      "bot.events.messageCreate.fad899a20"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.fad899a20",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:597"
  },
  {
    "id": "bot:message:b3c9b1f44f33",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.93f2c41d7",
    "keys": [
      "bot.events.messageCreate.93f2c41d7"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.93f2c41d7",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:602"
  },
  {
    "id": "bot:message:01d315b96df9",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.4c3d28d86",
    "keys": [
      "bot.events.messageCreate.4c3d28d86"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.4c3d28d86",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:607"
  },
  {
    "id": "bot:message:9196e0558913",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.f2eec437b",
    "keys": [
      "bot.events.messageCreate.f2eec437b"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.f2eec437b",
        "role": "text",
        "examples": {
          "fixed2": "5"
        }
      }
    ],
    "source": "src/events/messageCreate.ts:617"
  },
  {
    "id": "bot:message:171b4edd9daf",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.72f7853d0",
    "keys": [
      "bot.events.messageCreate.72f7853d0"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.72f7853d0",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:630"
  },
  {
    "id": "bot:message:69d26ac95e78",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.4e6894d8e",
    "keys": [
      "bot.events.messageCreate.4e6894d8e"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.4e6894d8e",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:642"
  },
  {
    "id": "bot:message:21800cf906c5",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.e954b7cba",
    "keys": [
      "bot.events.messageCreate.e954b7cba"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.e954b7cba",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:651"
  },
  {
    "id": "bot:message:becced0f758a",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.553cad4d8",
    "keys": [
      "bot.events.messageCreate.553cad4d8"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.553cad4d8",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:660"
  },
  {
    "id": "bot:message:840712b4bde6",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.d28a26cd7",
    "keys": [
      "bot.events.messageCreate.d28a26cd7"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.d28a26cd7",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:774"
  },
  {
    "id": "bot:message:705a929319ba",
    "kind": "message",
    "titleKey": "bot.features.giftFeedHelper.3c1cdcb6c",
    "keys": [
      "bot.features.giftFeedHelper.3c1cdcb6c"
    ],
    "parts": [
      {
        "key": "bot.features.giftFeedHelper.3c1cdcb6c",
        "role": "text",
        "examples": {
          "fixed4": "!打赏"
        }
      }
    ],
    "source": "src/features/giftFeedHelper.ts:260"
  },
  {
    "id": "bot:message:48f718980033",
    "kind": "message",
    "titleKey": "bot.features.giftFeedHelper.2974fb660",
    "keys": [
      "bot.features.giftFeedHelper.2974fb660"
    ],
    "parts": [
      {
        "key": "bot.features.giftFeedHelper.2974fb660",
        "role": "text"
      }
    ],
    "source": "src/features/giftFeedHelper.ts:264"
  },
  {
    "id": "bot:message:969dbef56dde",
    "kind": "message",
    "titleKey": "bot.commands.cash.9738b62a3",
    "keys": [
      "bot.commands.cash.9738b62a3"
    ],
    "parts": [
      {
        "key": "bot.commands.cash.9738b62a3",
        "role": "text"
      }
    ],
    "source": "src/commands/cash.ts:77"
  },
  {
    "id": "bot:message:9d059de24145",
    "kind": "message",
    "titleKey": "bot.commands.cash.70b8329a1",
    "keys": [
      "bot.commands.cash.70b8329a1"
    ],
    "parts": [
      {
        "key": "bot.commands.cash.70b8329a1",
        "role": "text",
        "examples": {
          "fixed1": "`!cash +金额 @用户`",
          "fixed2": "`!cash -金额 @用户`"
        }
      }
    ],
    "source": "src/commands/cash.ts:84"
  },
  {
    "id": "bot:message:64a97c6fde9e",
    "kind": "message",
    "titleKey": "bot.commands.cash.0f9456744",
    "keys": [
      "bot.commands.cash.0f9456744"
    ],
    "parts": [
      {
        "key": "bot.commands.cash.0f9456744",
        "role": "text"
      }
    ],
    "source": "src/commands/cash.ts:153"
  },
  {
    "id": "bot:message:d3f2bfa5b89e",
    "kind": "message",
    "titleKey": "bot.commands.cash.4ad19fe16",
    "keys": [
      "bot.commands.cash.4ad19fe16"
    ],
    "parts": [
      {
        "key": "bot.commands.cash.4ad19fe16",
        "role": "text"
      }
    ],
    "source": "src/commands/cash.ts:157"
  },
  {
    "id": "bot:message:761d5891b5ae",
    "kind": "message",
    "titleKey": "bot.commands.cash.c68e0f68b",
    "keys": [
      "bot.commands.cash.c68e0f68b"
    ],
    "parts": [
      {
        "key": "bot.commands.cash.c68e0f68b",
        "role": "text"
      }
    ],
    "source": "src/commands/cash.ts:228"
  },
  {
    "id": "bot:message:fb162c347394",
    "kind": "message",
    "titleKey": "bot.commands.cash.853f0bffd",
    "keys": [
      "bot.commands.cash.853f0bffd"
    ],
    "parts": [
      {
        "key": "bot.commands.cash.853f0bffd",
        "role": "text"
      }
    ],
    "source": "src/commands/cash.ts:231"
  },
  {
    "id": "bot:message:06c4e9dc1f43",
    "kind": "message",
    "titleKey": "bot.commands.cash.7c71b9e65",
    "keys": [
      "bot.commands.cash.7c71b9e65"
    ],
    "parts": [
      {
        "key": "bot.commands.cash.7c71b9e65",
        "role": "text"
      }
    ],
    "source": "src/commands/cash.ts:239"
  },
  {
    "id": "bot:message:bca46a5136f7",
    "kind": "message",
    "titleKey": "bot.commands.gifting.b79f7ee3c",
    "keys": [
      "bot.commands.gifting.b79f7ee3c"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.b79f7ee3c",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:362"
  },
  {
    "id": "bot:message:353452c20a00",
    "kind": "message",
    "titleKey": "bot.commands.gifting.95dc2f9c2",
    "keys": [
      "bot.commands.gifting.95dc2f9c2"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.95dc2f9c2",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:370"
  },
  {
    "id": "bot:message:7d327c4fd5e1",
    "kind": "message",
    "titleKey": "bot.commands.gifting.f8abdc233",
    "keys": [
      "bot.commands.gifting.f8abdc233",
      "bot.commands.gifting.bf63f1b9e",
      "bot.commands.gifting.717948589",
      "bot.commands.gifting.61100fb89",
      "bot.commands.gifting.a191d3981"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.f8abdc233",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.commands.gifting.bf63f1b9e",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.gifting.717948589",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.gifting.61100fb89",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.gifting.a191d3981",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/commands/gifting.ts:393"
  },
  {
    "id": "bot:message:379b6d7550e8",
    "kind": "message",
    "titleKey": "bot.commands.gifting.af3b523ad",
    "keys": [
      "bot.commands.gifting.af3b523ad"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.af3b523ad",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:1008"
  },
  {
    "id": "bot:message:9e003f9d2ff7",
    "kind": "message",
    "titleKey": "bot.commands.gifting.cc5bed10b",
    "keys": [
      "bot.commands.gifting.cc5bed10b"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.cc5bed10b",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:1271"
  },
  {
    "id": "bot:message:c27eb6aa3d28",
    "kind": "message",
    "titleKey": "bot.commands.gifting.a13e30e3b",
    "keys": [
      "bot.commands.gifting.a13e30e3b"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.a13e30e3b",
        "role": "text",
        "examples": {
          "fixed1": "`!匿名打赏 数量/礼物名 PEIWANID`"
        }
      }
    ],
    "source": "src/commands/gifting.ts:1322"
  },
  {
    "id": "bot:message:ef7b1d9463ea",
    "kind": "message",
    "titleKey": "bot.commands.gifting.ee83c161b",
    "keys": [
      "bot.commands.gifting.ee83c161b"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.ee83c161b",
        "role": "text",
        "examples": {
          "fixed1": "`!匿名打赏 数量/礼物名 PEIWANID`",
          "fixed2": "`!匿名打赏 1/甜甜圈 1101`"
        }
      }
    ],
    "source": "src/commands/gifting.ts:1328"
  },
  {
    "id": "bot:message:d1a79339517d",
    "kind": "message",
    "titleKey": "bot.commands.gifting.e2bd8b39a",
    "keys": [
      "bot.commands.gifting.e2bd8b39a"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.e2bd8b39a",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:1342"
  },
  {
    "id": "bot:message:6630deecb7ff",
    "kind": "message",
    "titleKey": "bot.commands.gifting.ca5d3d053",
    "keys": [
      "bot.commands.gifting.ca5d3d053"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.ca5d3d053",
        "role": "text",
        "examples": {
          "fixed1": "`数量/礼物名`"
        }
      }
    ],
    "source": "src/commands/gifting.ts:1348"
  },
  {
    "id": "bot:message:9a5e508531cb",
    "kind": "message",
    "titleKey": "bot.commands.gifting.c8e679cd1",
    "keys": [
      "bot.commands.gifting.c8e679cd1"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.c8e679cd1",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:1356"
  },
  {
    "id": "bot:message:cf0fcc3f5989",
    "kind": "message",
    "titleKey": "bot.commands.gifting.7bd601d56",
    "keys": [
      "bot.commands.gifting.7bd601d56"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.7bd601d56",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:1365"
  },
  {
    "id": "bot:message:ba66e5e72c9b",
    "kind": "message",
    "titleKey": "bot.commands.gifting.ac6fd2703",
    "keys": [
      "bot.commands.gifting.ac6fd2703"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.ac6fd2703",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:1371"
  },
  {
    "id": "bot:message:87258dcc2958",
    "kind": "message",
    "titleKey": "bot.commands.gifting.8fa0025e3",
    "keys": [
      "bot.commands.gifting.8fa0025e3"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.8fa0025e3",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:1402"
  },
  {
    "id": "bot:message:23d8a2b680df",
    "kind": "message",
    "titleKey": "bot.commands.gifting.d45a673aa",
    "keys": [
      "bot.commands.gifting.d45a673aa"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.d45a673aa",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:1422"
  },
  {
    "id": "bot:message:4d58dcd4fad1",
    "kind": "message",
    "titleKey": "bot.commands.gifting.97fcc3e6e",
    "keys": [
      "bot.commands.gifting.97fcc3e6e"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.97fcc3e6e",
        "role": "text",
        "examples": {
          "fixed1": "`!代打赏 数量/礼物名 @老板 @陪玩A @陪玩B`"
        }
      }
    ],
    "source": "src/commands/gifting.ts:1428"
  },
  {
    "id": "bot:message:d1abb83e65d8",
    "kind": "message",
    "titleKey": "bot.commands.gifting.36a293791",
    "keys": [
      "bot.commands.gifting.36a293791"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.36a293791",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:1435"
  },
  {
    "id": "bot:message:398371879085",
    "kind": "message",
    "titleKey": "bot.commands.gifting.54e0549c3",
    "keys": [
      "bot.commands.gifting.54e0549c3"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.54e0549c3",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:1456"
  },
  {
    "id": "bot:message:5e6af7083cfc",
    "kind": "message",
    "titleKey": "bot.commands.gifting.a0c9b2e92",
    "keys": [
      "bot.commands.gifting.a0c9b2e92"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.a0c9b2e92",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:1460"
  },
  {
    "id": "bot:message:55f8d3dd5fa5",
    "kind": "message",
    "titleKey": "bot.commands.gifting.7674891f1",
    "keys": [
      "bot.commands.gifting.7674891f1"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.7674891f1",
        "role": "text",
        "examples": {
          "fixed1": "!匿名打赏",
          "fixed2": "5"
        }
      }
    ],
    "source": "src/commands/gifting.ts:1507"
  },
  {
    "id": "bot:message:f2a633b73d07",
    "kind": "message",
    "titleKey": "bot.commands.gifting.1c0e73eb8",
    "keys": [
      "bot.commands.gifting.1c0e73eb8"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.1c0e73eb8",
        "role": "text",
        "examples": {
          "fixed1": "`!打赏 数量/礼物名 @对方(可多个)`",
          "fixed2": "`!打赏 3/甜甜圈 @陪玩A @陪玩B`"
        }
      }
    ],
    "source": "src/commands/gifting.ts:1513"
  },
  {
    "id": "bot:message:eec49cec30e4",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.3a009e197",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.3a009e197"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.3a009e197",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:174"
  },
  {
    "id": "bot:message:66499ab4fe18",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.04f8878d1",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.04f8878d1"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.04f8878d1",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:184"
  },
  {
    "id": "bot:message:d6c3a74ad02c",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.c627a47e8",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.c627a47e8"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.c627a47e8",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:210"
  },
  {
    "id": "bot:message:a16befda095c",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.5c666e212",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.5c666e212"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.5c666e212",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:215"
  },
  {
    "id": "bot:message:1f4a6ab68201",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.bb5a69363",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.bb5a69363"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.bb5a69363",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:221"
  },
  {
    "id": "bot:message:2a5c80c52d0c",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.3f03746e4",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.3f03746e4"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.3f03746e4",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:226"
  },
  {
    "id": "bot:message:a1d0ae6afff8",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.98ece5c21",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.98ece5c21"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.98ece5c21",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:236"
  },
  {
    "id": "bot:message:f70b4bead7ba",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.d0cf24b56",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.d0cf24b56",
      "bot.interactions.buttons.orderPriceSelect.cbdf94649"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.d0cf24b56",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.interactions.buttons.orderPriceSelect.cbdf94649",
        "role": "text",
        "separator": ""
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:248"
  },
  {
    "id": "bot:message:8837b1362e41",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.8f1c44ea4",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.8f1c44ea4"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.8f1c44ea4",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:261"
  },
  {
    "id": "bot:message:aa0b439c9616",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.9168341fe",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.9168341fe"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.9168341fe",
        "role": "text",
        "examples": {
          "fixed2": "100"
        }
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:267"
  },
  {
    "id": "bot:message:46ca93f8b98d",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.6f6074fbb",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.6f6074fbb"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.6f6074fbb",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:370"
  },
  {
    "id": "bot:message:05a1570355dc",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.endOrder.8320af745",
    "keys": [
      "bot.interactions.buttons.endOrder.8320af745"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.endOrder.8320af745",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/endOrder.ts:18"
  },
  {
    "id": "bot:message:7211f9c7a824",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.endOrder.71feb7bc6",
    "keys": [
      "bot.interactions.buttons.endOrder.71feb7bc6"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.endOrder.71feb7bc6",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/endOrder.ts:37"
  },
  {
    "id": "bot:message:e9e5e8a255d3",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.endOrder.4a22c57b6",
    "keys": [
      "bot.interactions.buttons.endOrder.4a22c57b6"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.endOrder.4a22c57b6",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/endOrder.ts:46"
  },
  {
    "id": "bot:message:8d86124cedcd",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.endOrder.59bf3c96d",
    "keys": [
      "bot.interactions.buttons.endOrder.59bf3c96d"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.endOrder.59bf3c96d",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/endOrder.ts:50"
  },
  {
    "id": "bot:message:84fa378e21ac",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.endOrder.9d80b92c1",
    "keys": [
      "bot.interactions.buttons.endOrder.9d80b92c1"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.endOrder.9d80b92c1",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/endOrder.ts:91"
  },
  {
    "id": "bot:message:10791f26c324",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.endOrder.134ff80e1",
    "keys": [
      "bot.interactions.buttons.endOrder.134ff80e1"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.endOrder.134ff80e1",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/endOrder.ts:95"
  },
  {
    "id": "bot:message:f51f50e11bfc",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.endOrder.e77536f70",
    "keys": [
      "bot.interactions.buttons.endOrder.e77536f70"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.endOrder.e77536f70",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/endOrder.ts:102"
  },
  {
    "id": "bot:message:745732f1f503",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.d22a69428",
    "keys": [
      "bot.services.redEnvelopeService.d22a69428"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.d22a69428",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1388"
  },
  {
    "id": "bot:message:573673398a98",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.a0f18987d",
    "keys": [
      "bot.services.redEnvelopeService.a0f18987d"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.a0f18987d",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1435"
  },
  {
    "id": "bot:message:9020d6967229",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.26a5c505a",
    "keys": [
      "bot.services.redEnvelopeService.26a5c505a"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.26a5c505a",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1558"
  },
  {
    "id": "bot:message:c70e7cfd2c0a",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.11de98d7a",
    "keys": [
      "bot.services.redEnvelopeService.11de98d7a"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.11de98d7a",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1578"
  },
  {
    "id": "bot:message:4b8fa7e75935",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.510449989",
    "keys": [
      "bot.services.redEnvelopeService.510449989"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.510449989",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1584"
  },
  {
    "id": "bot:message:ea7b2cca79df",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.8e5ca0458",
    "keys": [
      "bot.services.redEnvelopeService.8e5ca0458"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.8e5ca0458",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1608"
  },
  {
    "id": "bot:message:ad560b49a425",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.blockStack.4e9414558",
    "keys": [
      "bot.interactions.buttons.blockStack.4e9414558"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.blockStack.4e9414558",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/blockStack.ts:973"
  },
  {
    "id": "bot:message:d3925469c15c",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.blockStack.c7b1b88ab",
    "keys": [
      "bot.interactions.buttons.blockStack.c7b1b88ab"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.blockStack.c7b1b88ab",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/blockStack.ts:1009"
  },
  {
    "id": "bot:message:5647a1b09915",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.blockStack.c4c44a576",
    "keys": [
      "bot.interactions.buttons.blockStack.c4c44a576"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.blockStack.c4c44a576",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/blockStack.ts:1017"
  },
  {
    "id": "bot:message:b21917b96a4e",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.blockStack.83ab6fc0f",
    "keys": [
      "bot.interactions.buttons.blockStack.83ab6fc0f"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.blockStack.83ab6fc0f",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/blockStack.ts:1034"
  },
  {
    "id": "bot:message:42455b15aa8b",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.scratch.20076d29c",
    "keys": [
      "bot.interactions.buttons.scratch.20076d29c"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.scratch.20076d29c",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/scratch.ts:34"
  },
  {
    "id": "bot:message:0eb693c30774",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.scratch.fe47be9a6",
    "keys": [
      "bot.interactions.buttons.scratch.fe47be9a6"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.scratch.fe47be9a6",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/scratch.ts:58"
  },
  {
    "id": "bot:message:b98cd147d268",
    "kind": "message",
    "titleKey": "bot.interactions.selects.giftingSelect.8d884f58e",
    "keys": [
      "bot.interactions.selects.giftingSelect.8d884f58e"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.giftingSelect.8d884f58e",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/giftingSelect.ts:25"
  },
  {
    "id": "bot:message:3ba21a765587",
    "kind": "message",
    "titleKey": "bot.interactions.selects.discountSelect.e45fa5fe5",
    "keys": [
      "bot.interactions.selects.discountSelect.e45fa5fe5"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.discountSelect.e45fa5fe5",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/discountSelect.ts:15"
  },
  {
    "id": "bot:message:52c9fff49ecf",
    "kind": "message",
    "titleKey": "bot.interactions.selects.discountSelect.2b13a4f3d",
    "keys": [
      "bot.interactions.selects.discountSelect.2b13a4f3d"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.discountSelect.2b13a4f3d",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/discountSelect.ts:32"
  },
  {
    "id": "bot:message:bfbcac30d6be",
    "kind": "message",
    "titleKey": "bot.interactions.selects.discountSelect.36aedb2ba",
    "keys": [
      "bot.interactions.selects.discountSelect.36aedb2ba"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.discountSelect.36aedb2ba",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/discountSelect.ts:85"
  },
  {
    "id": "bot:message:a47c9171e1f5",
    "kind": "message",
    "titleKey": "bot.commands.totalEarn.d89ede695",
    "keys": [
      "bot.commands.totalEarn.d89ede695"
    ],
    "parts": [
      {
        "key": "bot.commands.totalEarn.d89ede695",
        "role": "text"
      }
    ],
    "source": "src/commands/totalEarn.ts:43"
  },
  {
    "id": "bot:message:3084835afb7c",
    "kind": "message",
    "titleKey": "bot.commands.totalEarn.6db1682fc",
    "keys": [
      "bot.commands.totalEarn.6db1682fc"
    ],
    "parts": [
      {
        "key": "bot.commands.totalEarn.6db1682fc",
        "role": "text",
        "examples": {
          "fixed1": "`!totalearn +金额 @陪玩`",
          "fixed2": "`!totalearn -金额 @陪玩`"
        }
      }
    ],
    "source": "src/commands/totalEarn.ts:49"
  },
  {
    "id": "bot:message:5954281d8acc",
    "kind": "message",
    "titleKey": "bot.commands.totalEarn.7559d1158",
    "keys": [
      "bot.commands.totalEarn.7559d1158"
    ],
    "parts": [
      {
        "key": "bot.commands.totalEarn.7559d1158",
        "role": "text"
      }
    ],
    "source": "src/commands/totalEarn.ts:61"
  },
  {
    "id": "bot:message:5953671fabe4",
    "kind": "message",
    "titleKey": "bot.commands.totalEarn.144892dd0",
    "keys": [
      "bot.commands.totalEarn.144892dd0"
    ],
    "parts": [
      {
        "key": "bot.commands.totalEarn.144892dd0",
        "role": "text"
      }
    ],
    "source": "src/commands/totalEarn.ts:75"
  },
  {
    "id": "bot:message:e8d210a37fdd",
    "kind": "message",
    "titleKey": "bot.commands.totalEarn.bcf0bb794",
    "keys": [
      "bot.commands.totalEarn.bcf0bb794"
    ],
    "parts": [
      {
        "key": "bot.commands.totalEarn.bcf0bb794",
        "role": "text"
      }
    ],
    "source": "src/commands/totalEarn.ts:81"
  },
  {
    "id": "bot:message:dbac5d322703",
    "kind": "message",
    "titleKey": "bot.commands.totalSpent.ab297ccc1",
    "keys": [
      "bot.commands.totalSpent.ab297ccc1"
    ],
    "parts": [
      {
        "key": "bot.commands.totalSpent.ab297ccc1",
        "role": "text"
      }
    ],
    "source": "src/commands/totalSpent.ts:44"
  },
  {
    "id": "bot:message:a23930a63834",
    "kind": "message",
    "titleKey": "bot.commands.totalSpent.23c304027",
    "keys": [
      "bot.commands.totalSpent.23c304027"
    ],
    "parts": [
      {
        "key": "bot.commands.totalSpent.23c304027",
        "role": "text",
        "examples": {
          "fixed1": "`!totalspent +金额 @用户`",
          "fixed2": "`!totalspent -金额 @用户`"
        }
      }
    ],
    "source": "src/commands/totalSpent.ts:50"
  },
  {
    "id": "bot:message:80706bc62f1a",
    "kind": "message",
    "titleKey": "bot.commands.totalSpent.027b3eb24",
    "keys": [
      "bot.commands.totalSpent.027b3eb24"
    ],
    "parts": [
      {
        "key": "bot.commands.totalSpent.027b3eb24",
        "role": "text"
      }
    ],
    "source": "src/commands/totalSpent.ts:62"
  },
  {
    "id": "bot:message:c2dce694f5bc",
    "kind": "message",
    "titleKey": "bot.commands.totalSpent.2e5600f1c",
    "keys": [
      "bot.commands.totalSpent.2e5600f1c"
    ],
    "parts": [
      {
        "key": "bot.commands.totalSpent.2e5600f1c",
        "role": "text"
      }
    ],
    "source": "src/commands/totalSpent.ts:77"
  },
  {
    "id": "bot:message:3005b87b6ed8",
    "kind": "message",
    "titleKey": "bot.commands.totalSpent.590722cc6",
    "keys": [
      "bot.commands.totalSpent.590722cc6"
    ],
    "parts": [
      {
        "key": "bot.commands.totalSpent.590722cc6",
        "role": "text"
      }
    ],
    "source": "src/commands/totalSpent.ts:83"
  },
  {
    "id": "bot:message:7679a28dd38b",
    "kind": "message",
    "titleKey": "bot.commands.loyaltyPoints.9e908b007",
    "keys": [
      "bot.commands.loyaltyPoints.9e908b007"
    ],
    "parts": [
      {
        "key": "bot.commands.loyaltyPoints.9e908b007",
        "role": "text"
      }
    ],
    "source": "src/commands/loyaltyPoints.ts:45"
  },
  {
    "id": "bot:message:65f116c29e18",
    "kind": "message",
    "titleKey": "bot.commands.loyaltyPoints.b53ef3400",
    "keys": [
      "bot.commands.loyaltyPoints.b53ef3400"
    ],
    "parts": [
      {
        "key": "bot.commands.loyaltyPoints.b53ef3400",
        "role": "text",
        "examples": {
          "fixed1": "`!积分 +金额 @用户`",
          "fixed2": "`!积分 -金额 @用户`"
        }
      }
    ],
    "source": "src/commands/loyaltyPoints.ts:51"
  },
  {
    "id": "bot:message:c32439d066c1",
    "kind": "message",
    "titleKey": "bot.commands.loyaltyPoints.cb5028640",
    "keys": [
      "bot.commands.loyaltyPoints.cb5028640"
    ],
    "parts": [
      {
        "key": "bot.commands.loyaltyPoints.cb5028640",
        "role": "text"
      }
    ],
    "source": "src/commands/loyaltyPoints.ts:75"
  },
  {
    "id": "bot:message:a68d5b0e290a",
    "kind": "message",
    "titleKey": "bot.commands.loyaltyPoints.83e7e4383",
    "keys": [
      "bot.commands.loyaltyPoints.83e7e4383"
    ],
    "parts": [
      {
        "key": "bot.commands.loyaltyPoints.83e7e4383",
        "role": "text"
      }
    ],
    "source": "src/commands/loyaltyPoints.ts:81"
  },
  {
    "id": "bot:message:d93cd377ec83",
    "kind": "message",
    "titleKey": "bot.commands.grantCouponSlash.0e45a0a83",
    "keys": [
      "bot.commands.grantCouponSlash.0e45a0a83",
      "bot.commands.grantCouponSlash.3c2d3d61a"
    ],
    "parts": [
      {
        "key": "bot.commands.grantCouponSlash.0e45a0a83",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.commands.grantCouponSlash.3c2d3d61a",
        "role": "text",
        "examples": {
          "fixed1": "!抽积木消耗该代金券"
        },
        "separator": "\n"
      }
    ],
    "source": "src/commands/grantCouponSlash.ts:155"
  },
  {
    "id": "bot:message:8a0cfa06d3bf",
    "kind": "message",
    "titleKey": "bot.commands.registerPeiwanSlash.671fff290",
    "keys": [
      "bot.commands.registerPeiwanSlash.671fff290"
    ],
    "parts": [
      {
        "key": "bot.commands.registerPeiwanSlash.671fff290",
        "role": "text"
      }
    ],
    "source": "src/commands/registerPeiwanSlash.ts:18"
  },
  {
    "id": "bot:message:e879bff72a11",
    "kind": "message",
    "titleKey": "bot.commands.registerPeiwanSlash.bd0382167",
    "keys": [
      "bot.commands.registerPeiwanSlash.bd0382167"
    ],
    "parts": [
      {
        "key": "bot.commands.registerPeiwanSlash.bd0382167",
        "role": "text"
      }
    ],
    "source": "src/commands/registerPeiwanSlash.ts:48"
  },
  {
    "id": "bot:message:0d8f35fc75d6",
    "kind": "message",
    "titleKey": "bot.commands.redEnvelopeSlash.27826c3fe",
    "keys": [
      "bot.commands.redEnvelopeSlash.27826c3fe"
    ],
    "parts": [
      {
        "key": "bot.commands.redEnvelopeSlash.27826c3fe",
        "role": "text"
      }
    ],
    "source": "src/commands/redEnvelopeSlash.ts:59"
  },
  {
    "id": "bot:message:24936a58ceb1",
    "kind": "message",
    "titleKey": "bot.commands.redEnvelopeSlash.50db62f4e",
    "keys": [
      "bot.commands.redEnvelopeSlash.50db62f4e"
    ],
    "parts": [
      {
        "key": "bot.commands.redEnvelopeSlash.50db62f4e",
        "role": "text",
        "examples": {
          "fixed1": "100"
        }
      }
    ],
    "source": "src/commands/redEnvelopeSlash.ts:69"
  },
  {
    "id": "bot:message:a4854be1fab8",
    "kind": "message",
    "titleKey": "bot.commands.redEnvelopeSlash.ffaad059d",
    "keys": [
      "bot.commands.redEnvelopeSlash.ffaad059d"
    ],
    "parts": [
      {
        "key": "bot.commands.redEnvelopeSlash.ffaad059d",
        "role": "text",
        "examples": {
          "fixed1": "10"
        }
      }
    ],
    "source": "src/commands/redEnvelopeSlash.ts:73"
  },
  {
    "id": "bot:message:009b2ea0b105",
    "kind": "message",
    "titleKey": "bot.commands.redEnvelopeSlash.ce517833c",
    "keys": [
      "bot.commands.redEnvelopeSlash.ce517833c"
    ],
    "parts": [
      {
        "key": "bot.commands.redEnvelopeSlash.ce517833c",
        "role": "text"
      }
    ],
    "source": "src/commands/redEnvelopeSlash.ts:94"
  },
  {
    "id": "bot:message:ff06e7dcfaf5",
    "kind": "message",
    "titleKey": "bot.commands.redEnvelopeSlash.b14ba1293",
    "keys": [
      "bot.commands.redEnvelopeSlash.b14ba1293"
    ],
    "parts": [
      {
        "key": "bot.commands.redEnvelopeSlash.b14ba1293",
        "role": "text"
      }
    ],
    "source": "src/commands/redEnvelopeSlash.ts:143"
  },
  {
    "id": "bot:message:f0c2e4c4cb83",
    "kind": "message",
    "titleKey": "bot.commands.redEnvelopeSlash.originalFailure",
    "keys": [
      "bot.commands.redEnvelopeSlash.originalFailure"
    ],
    "parts": [
      {
        "key": "bot.commands.redEnvelopeSlash.originalFailure",
        "role": "text"
      }
    ],
    "source": "src/commands/redEnvelopeSlash.ts:148"
  },
  {
    "id": "bot:message:4ccf5df6b252",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelopeSlash.ea2610790",
    "keys": [
      "bot.commands.keywordRedEnvelopeSlash.ea2610790"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelopeSlash.ea2610790",
        "role": "text"
      }
    ],
    "source": "src/commands/keywordRedEnvelopeSlash.ts:24"
  },
  {
    "id": "bot:message:5a2b3a1be64e",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelopeSlash.0cc1e4bc5",
    "keys": [
      "bot.commands.keywordRedEnvelopeSlash.0cc1e4bc5"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelopeSlash.0cc1e4bc5",
        "role": "text"
      }
    ],
    "source": "src/commands/keywordRedEnvelopeSlash.ts:68"
  },
  {
    "id": "bot:message:bd45e404e024",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelopeSlash.810804fab",
    "keys": [
      "bot.commands.keywordRedEnvelopeSlash.810804fab"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelopeSlash.810804fab",
        "role": "text",
        "examples": {
          "fixed1": "100"
        }
      }
    ],
    "source": "src/commands/keywordRedEnvelopeSlash.ts:84"
  },
  {
    "id": "bot:message:8aae566099be",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelopeSlash.2e21efc1b",
    "keys": [
      "bot.commands.keywordRedEnvelopeSlash.2e21efc1b"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelopeSlash.2e21efc1b",
        "role": "text",
        "examples": {
          "fixed1": "10"
        }
      }
    ],
    "source": "src/commands/keywordRedEnvelopeSlash.ts:88"
  },
  {
    "id": "bot:message:3c013fb69791",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelopeSlash.c4ef6c9dc",
    "keys": [
      "bot.commands.keywordRedEnvelopeSlash.c4ef6c9dc"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelopeSlash.c4ef6c9dc",
        "role": "text"
      }
    ],
    "source": "src/commands/keywordRedEnvelopeSlash.ts:111"
  },
  {
    "id": "bot:message:8fd8fb12c869",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelopeSlash.9ff40f343",
    "keys": [
      "bot.commands.keywordRedEnvelopeSlash.9ff40f343"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelopeSlash.9ff40f343",
        "role": "text"
      }
    ],
    "source": "src/commands/keywordRedEnvelopeSlash.ts:114"
  },
  {
    "id": "bot:message:49d0cea7254c",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelopeSlash.originalFailure",
    "keys": [
      "bot.commands.keywordRedEnvelopeSlash.originalFailure"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelopeSlash.originalFailure",
        "role": "text"
      }
    ],
    "source": "src/commands/keywordRedEnvelopeSlash.ts:150"
  },
  {
    "id": "bot:message:760ac37722a6",
    "kind": "message",
    "titleKey": "bot.commands.customerGangSlash.7c6605154",
    "keys": [
      "bot.commands.customerGangSlash.7c6605154"
    ],
    "parts": [
      {
        "key": "bot.commands.customerGangSlash.7c6605154",
        "role": "text"
      }
    ],
    "source": "src/commands/customerGangSlash.ts:45"
  },
  {
    "id": "bot:message:afa356754934",
    "kind": "message",
    "titleKey": "bot.commands.customerGangSlash.88e4f7bcf",
    "keys": [
      "bot.commands.customerGangSlash.88e4f7bcf"
    ],
    "parts": [
      {
        "key": "bot.commands.customerGangSlash.88e4f7bcf",
        "role": "text"
      }
    ],
    "source": "src/commands/customerGangSlash.ts:58"
  },
  {
    "id": "bot:message:77839e388d0f",
    "kind": "message",
    "titleKey": "bot.commands.customerGangSlash.c5e8f78e4",
    "keys": [
      "bot.commands.customerGangSlash.c5e8f78e4"
    ],
    "parts": [
      {
        "key": "bot.commands.customerGangSlash.c5e8f78e4",
        "role": "text"
      }
    ],
    "source": "src/commands/customerGangSlash.ts:63"
  },
  {
    "id": "bot:message:bc65db7e10d3",
    "kind": "message",
    "titleKey": "bot.commands.customerGangSlash.e42dfd70e",
    "keys": [
      "bot.commands.customerGangSlash.e42dfd70e"
    ],
    "parts": [
      {
        "key": "bot.commands.customerGangSlash.e42dfd70e",
        "role": "text"
      }
    ],
    "source": "src/commands/customerGangSlash.ts:138"
  },
  {
    "id": "bot:message:14ccb90cd000",
    "kind": "message",
    "titleKey": "bot.commands.customerGangSlash.440d23f27",
    "keys": [
      "bot.commands.customerGangSlash.440d23f27"
    ],
    "parts": [
      {
        "key": "bot.commands.customerGangSlash.440d23f27",
        "role": "text"
      }
    ],
    "source": "src/commands/customerGangSlash.ts:143"
  },
  {
    "id": "bot:message:4c69a9b37e80",
    "kind": "message",
    "titleKey": "bot.commands.customerGangSlash.429a75d7a",
    "keys": [
      "bot.commands.customerGangSlash.429a75d7a"
    ],
    "parts": [
      {
        "key": "bot.commands.customerGangSlash.429a75d7a",
        "role": "text"
      }
    ],
    "source": "src/commands/customerGangSlash.ts:147"
  },
  {
    "id": "bot:message:0587f1764103",
    "kind": "message",
    "titleKey": "bot.commands.revertGiftSlash.5deb3bdd8",
    "keys": [
      "bot.commands.revertGiftSlash.5deb3bdd8"
    ],
    "parts": [
      {
        "key": "bot.commands.revertGiftSlash.5deb3bdd8",
        "role": "text"
      }
    ],
    "source": "src/commands/revertGiftSlash.ts:21"
  },
  {
    "id": "bot:message:ec714ba750f5",
    "kind": "message",
    "titleKey": "bot.commands.revertGiftSlash.b90169fae",
    "keys": [
      "bot.commands.revertGiftSlash.b90169fae",
      "bot.commands.revertGiftSlash.e8e933429",
      "bot.commands.revertGiftSlash.85915c6c0",
      "bot.commands.revertGiftSlash.5620f3a11",
      "bot.commands.revertGiftSlash.legacySummary"
    ],
    "parts": [
      {
        "key": "bot.commands.revertGiftSlash.b90169fae",
        "role": "text",
        "separator": ""
      },
      {
        "text": "{resolveBossLabel}：",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.commands.revertGiftSlash.e8e933429",
        "role": "text",
        "separator": ""
      },
      {
        "text": " ",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.commands.revertGiftSlash.85915c6c0",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.commands.revertGiftSlash.5620f3a11",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.commands.revertGiftSlash.legacySummary",
        "role": "text",
        "separator": ""
      }
    ],
    "source": "src/commands/revertGiftSlash.ts:47"
  },
  {
    "id": "bot:message:80bfcf672c8a",
    "kind": "message",
    "titleKey": "bot.commands.revertGiftSlash.f40b2c50a",
    "keys": [
      "bot.commands.revertGiftSlash.f40b2c50a"
    ],
    "parts": [
      {
        "key": "bot.commands.revertGiftSlash.f40b2c50a",
        "role": "text"
      }
    ],
    "source": "src/commands/revertGiftSlash.ts:63"
  },
  {
    "id": "bot:message:ddbb360f7d1a",
    "kind": "message",
    "titleKey": "bot.commands.revertOrderSlash.91cc4ea32",
    "keys": [
      "bot.commands.revertOrderSlash.91cc4ea32"
    ],
    "parts": [
      {
        "key": "bot.commands.revertOrderSlash.91cc4ea32",
        "role": "text"
      }
    ],
    "source": "src/commands/revertOrderSlash.ts:20"
  },
  {
    "id": "bot:message:0a07bc276cf3",
    "kind": "message",
    "titleKey": "bot.commands.revertOrderSlash.83a36a5cd",
    "keys": [
      "bot.commands.revertOrderSlash.83a36a5cd"
    ],
    "parts": [
      {
        "key": "bot.commands.revertOrderSlash.83a36a5cd",
        "role": "text"
      }
    ],
    "source": "src/commands/revertOrderSlash.ts:36"
  },
  {
    "id": "bot:message:57f2498421e5",
    "kind": "message",
    "titleKey": "bot.commands.revertOrderSlash.fbc4f3c08",
    "keys": [
      "bot.commands.revertOrderSlash.fbc4f3c08"
    ],
    "parts": [
      {
        "key": "bot.commands.revertOrderSlash.fbc4f3c08",
        "role": "text"
      }
    ],
    "source": "src/commands/revertOrderSlash.ts:52"
  },
  {
    "id": "bot:message:c7a061949325",
    "kind": "message",
    "titleKey": "bot.commands.bulkDm.b04ae2eeb",
    "keys": [
      "bot.commands.bulkDm.b04ae2eeb"
    ],
    "parts": [
      {
        "key": "bot.commands.bulkDm.b04ae2eeb",
        "role": "text"
      }
    ],
    "source": "src/commands/bulkDm.ts:100"
  },
  {
    "id": "bot:message:02b07f22c635",
    "kind": "message",
    "titleKey": "bot.commands.bulkDm.e5ca74685",
    "keys": [
      "bot.commands.bulkDm.e5ca74685"
    ],
    "parts": [
      {
        "key": "bot.commands.bulkDm.e5ca74685",
        "role": "text"
      }
    ],
    "source": "src/commands/bulkDm.ts:105"
  },
  {
    "id": "bot:message:ea3abfb41084",
    "kind": "message",
    "titleKey": "bot.commands.bulkDm.43cfbac98",
    "keys": [
      "bot.commands.bulkDm.43cfbac98"
    ],
    "parts": [
      {
        "key": "bot.commands.bulkDm.43cfbac98",
        "role": "text"
      }
    ],
    "source": "src/commands/bulkDm.ts:115"
  },
  {
    "id": "bot:message:f54e5b420dce",
    "kind": "message",
    "titleKey": "bot.commands.bulkDm.769353bba",
    "keys": [
      "bot.commands.bulkDm.769353bba"
    ],
    "parts": [
      {
        "key": "bot.commands.bulkDm.769353bba",
        "role": "text"
      }
    ],
    "source": "src/commands/bulkDm.ts:134"
  },
  {
    "id": "bot:message:a9e2b60e2615",
    "kind": "message",
    "titleKey": "bot.commands.bulkDm.1dac5481a",
    "keys": [
      "bot.commands.bulkDm.1dac5481a"
    ],
    "parts": [
      {
        "key": "bot.commands.bulkDm.1dac5481a",
        "role": "text"
      }
    ],
    "source": "src/commands/bulkDm.ts:138"
  },
  {
    "id": "bot:message:b4e1adda8e7b",
    "kind": "message",
    "titleKey": "bot.commands.bulkDm.d05c29445",
    "keys": [
      "bot.commands.bulkDm.d05c29445"
    ],
    "parts": [
      {
        "key": "bot.commands.bulkDm.d05c29445",
        "role": "text"
      }
    ],
    "source": "src/commands/bulkDm.ts:156"
  },
  {
    "id": "bot:message:1cca2eda33d7",
    "kind": "message",
    "titleKey": "bot.commands.bulkDm.5af3b5f44",
    "keys": [
      "bot.commands.bulkDm.5af3b5f44"
    ],
    "parts": [
      {
        "key": "bot.commands.bulkDm.5af3b5f44",
        "role": "text",
        "examples": {
          "success": "0",
          "failure": "0"
        }
      }
    ],
    "source": "src/commands/bulkDm.ts:178"
  },
  {
    "id": "bot:message:fef6b9e0f798",
    "kind": "message",
    "titleKey": "bot.commands.giftSlash.090343235",
    "keys": [
      "bot.commands.giftSlash.090343235"
    ],
    "parts": [
      {
        "key": "bot.commands.giftSlash.090343235",
        "role": "text"
      }
    ],
    "source": "src/commands/giftSlash.ts:44"
  },
  {
    "id": "bot:message:ac76e3840778",
    "kind": "message",
    "titleKey": "bot.commands.giftSlash.b995db5f4",
    "keys": [
      "bot.commands.giftSlash.b995db5f4"
    ],
    "parts": [
      {
        "key": "bot.commands.giftSlash.b995db5f4",
        "role": "text"
      }
    ],
    "source": "src/commands/giftSlash.ts:53"
  },
  {
    "id": "bot:message:9dd1cd6741d9",
    "kind": "message",
    "titleKey": "bot.commands.giftSlash.7059b8750",
    "keys": [
      "bot.commands.giftSlash.7059b8750"
    ],
    "parts": [
      {
        "key": "bot.commands.giftSlash.7059b8750",
        "role": "text"
      }
    ],
    "source": "src/commands/giftSlash.ts:108"
  },
  {
    "id": "bot:message:3e69f99f2373",
    "kind": "message",
    "titleKey": "bot.commands.giftSlash.e1f4b782d",
    "keys": [
      "bot.commands.giftSlash.e1f4b782d"
    ],
    "parts": [
      {
        "key": "bot.commands.giftSlash.e1f4b782d",
        "role": "text"
      }
    ],
    "source": "src/commands/giftSlash.ts:114"
  },
  {
    "id": "bot:message:beaca4472074",
    "kind": "message",
    "titleKey": "bot.commands.channelMessageSlash.a77dc4d7d",
    "keys": [
      "bot.commands.channelMessageSlash.a77dc4d7d"
    ],
    "parts": [
      {
        "key": "bot.commands.channelMessageSlash.a77dc4d7d",
        "role": "text"
      }
    ],
    "source": "src/commands/channelMessageSlash.ts:29"
  },
  {
    "id": "bot:message:8d07c9ebc0ed",
    "kind": "message",
    "titleKey": "bot.commands.channelMessageSlash.41e399de6",
    "keys": [
      "bot.commands.channelMessageSlash.41e399de6"
    ],
    "parts": [
      {
        "key": "bot.commands.channelMessageSlash.41e399de6",
        "role": "text"
      }
    ],
    "source": "src/commands/channelMessageSlash.ts:37"
  },
  {
    "id": "bot:message:b247514fcac3",
    "kind": "message",
    "titleKey": "bot.commands.channelMessageSlash.a42a1dc6e",
    "keys": [
      "bot.commands.channelMessageSlash.a42a1dc6e"
    ],
    "parts": [
      {
        "key": "bot.commands.channelMessageSlash.a42a1dc6e",
        "role": "text"
      }
    ],
    "source": "src/commands/channelMessageSlash.ts:43"
  },
  {
    "id": "bot:message:3202372ffa54",
    "kind": "message",
    "titleKey": "bot.commands.channelMessageSlash.a5976e9d1",
    "keys": [
      "bot.commands.channelMessageSlash.a5976e9d1"
    ],
    "parts": [
      {
        "key": "bot.commands.channelMessageSlash.a5976e9d1",
        "role": "text"
      }
    ],
    "source": "src/commands/channelMessageSlash.ts:49"
  },
  {
    "id": "bot:message:1245029dd669",
    "kind": "message",
    "titleKey": "bot.commands.channelMessageSlash.e30295db6",
    "keys": [
      "bot.commands.channelMessageSlash.e30295db6"
    ],
    "parts": [
      {
        "key": "bot.commands.channelMessageSlash.e30295db6",
        "role": "text"
      }
    ],
    "source": "src/commands/channelMessageSlash.ts:57"
  },
  {
    "id": "bot:message:df2249f5b3e5",
    "kind": "message",
    "titleKey": "bot.commands.lookSelfSlash.27110d053",
    "keys": [
      "bot.commands.lookSelfSlash.27110d053"
    ],
    "parts": [
      {
        "key": "bot.commands.lookSelfSlash.27110d053",
        "role": "text"
      }
    ],
    "source": "src/commands/lookSelfSlash.ts:15"
  },
  {
    "id": "bot:message:14a142ca6f6a",
    "kind": "message",
    "titleKey": "bot.commands.lookSelfSlash.19fabc453",
    "keys": [
      "bot.commands.lookSelfSlash.19fabc453"
    ],
    "parts": [
      {
        "key": "bot.commands.lookSelfSlash.19fabc453",
        "role": "text"
      }
    ],
    "source": "src/commands/lookSelfSlash.ts:20"
  },
  {
    "id": "bot:message:e97966200858",
    "kind": "message",
    "titleKey": "bot.commands.viewCardSlash.50ea6e6ec",
    "keys": [
      "bot.commands.viewCardSlash.50ea6e6ec"
    ],
    "parts": [
      {
        "key": "bot.commands.viewCardSlash.50ea6e6ec",
        "role": "text"
      }
    ],
    "source": "src/commands/viewCardSlash.ts:28"
  },
  {
    "id": "bot:message:ac615f52fea1",
    "kind": "message",
    "titleKey": "bot.commands.viewCardSlash.a6a1cfe6d",
    "keys": [
      "bot.commands.viewCardSlash.a6a1cfe6d"
    ],
    "parts": [
      {
        "key": "bot.commands.viewCardSlash.a6a1cfe6d",
        "role": "text"
      }
    ],
    "source": "src/commands/viewCardSlash.ts:37"
  },
  {
    "id": "bot:message:eca7e6a490c4",
    "kind": "message",
    "titleKey": "bot.commands.viewCardSlash.79835b94d",
    "keys": [
      "bot.commands.viewCardSlash.79835b94d"
    ],
    "parts": [
      {
        "key": "bot.commands.viewCardSlash.79835b94d",
        "role": "text"
      }
    ],
    "source": "src/commands/viewCardSlash.ts:49"
  },
  {
    "id": "bot:message:6a0cf058af88",
    "kind": "message",
    "titleKey": "bot.services.lotteryFusionNotificationService.de1e12b56",
    "keys": [
      "bot.services.lotteryFusionNotificationService.de1e12b56"
    ],
    "parts": [
      {
        "key": "bot.services.lotteryFusionNotificationService.de1e12b56",
        "role": "text"
      }
    ],
    "source": "src/services/lotteryFusionNotificationService.ts:67"
  },
  {
    "id": "bot:message:cdf5e2068bf4",
    "kind": "message",
    "titleKey": "bot.commands.lotteryFusionSlash.97a252549",
    "keys": [
      "bot.commands.lotteryFusionSlash.97a252549"
    ],
    "parts": [
      {
        "key": "bot.commands.lotteryFusionSlash.97a252549",
        "role": "text"
      }
    ],
    "source": "src/commands/lotteryFusionSlash.ts:373"
  },
  {
    "id": "bot:message:9dbdfbdb08bb",
    "kind": "message",
    "titleKey": "bot.commands.lotteryFusionSlash.f42ab1e20",
    "keys": [
      "bot.commands.lotteryFusionSlash.f42ab1e20"
    ],
    "parts": [
      {
        "key": "bot.commands.lotteryFusionSlash.f42ab1e20",
        "role": "text",
        "examples": {
          "fixed1": "3"
        }
      }
    ],
    "source": "src/commands/lotteryFusionSlash.ts:419"
  },
  {
    "id": "bot:message:9081401168d8",
    "kind": "message",
    "titleKey": "bot.commands.lotteryFusionSlash.ce5327e5a",
    "keys": [
      "bot.commands.lotteryFusionSlash.ce5327e5a"
    ],
    "parts": [
      {
        "key": "bot.commands.lotteryFusionSlash.ce5327e5a",
        "role": "text"
      }
    ],
    "source": "src/commands/lotteryFusionSlash.ts:459"
  },
  {
    "id": "bot:message:bac21971bf31",
    "kind": "message",
    "titleKey": "bot.commands.balanceCommands.8bb94f5ee",
    "keys": [
      "bot.commands.balanceCommands.8bb94f5ee"
    ],
    "parts": [
      {
        "key": "bot.commands.balanceCommands.8bb94f5ee",
        "role": "text"
      }
    ],
    "source": "src/commands/balanceCommands.ts:72"
  },
  {
    "id": "bot:message:929fc8e3dba0",
    "kind": "message",
    "titleKey": "bot.commands.balanceCommands.fd42e0620",
    "keys": [
      "bot.commands.balanceCommands.fd42e0620"
    ],
    "parts": [
      {
        "key": "bot.commands.balanceCommands.fd42e0620",
        "role": "text",
        "examples": {
          "fixed1": "`!realcash +金额 @用户`",
          "fixed2": "`!realcash -金额 @用户`"
        }
      }
    ],
    "source": "src/commands/balanceCommands.ts:78"
  },
  {
    "id": "bot:message:66840a24ccb3",
    "kind": "message",
    "titleKey": "bot.commands.balanceCommands.b47a729d9",
    "keys": [
      "bot.commands.balanceCommands.b47a729d9"
    ],
    "parts": [
      {
        "key": "bot.commands.balanceCommands.b47a729d9",
        "role": "text"
      }
    ],
    "source": "src/commands/balanceCommands.ts:127"
  },
  {
    "id": "bot:message:46801bcad5d4",
    "kind": "message",
    "titleKey": "bot.commands.balanceCommands.originalMissingRebalance",
    "keys": [
      "bot.commands.balanceCommands.originalMissingRebalance"
    ],
    "parts": [
      {
        "key": "bot.commands.balanceCommands.originalMissingRebalance",
        "role": "text"
      }
    ],
    "source": "src/commands/balanceCommands.ts:134"
  },
  {
    "id": "bot:message:e03f3eb4fd41",
    "kind": "message",
    "titleKey": "bot.commands.balanceCommands.36375010b",
    "keys": [
      "bot.commands.balanceCommands.36375010b"
    ],
    "parts": [
      {
        "key": "bot.commands.balanceCommands.36375010b",
        "role": "text"
      }
    ],
    "source": "src/commands/balanceCommands.ts:138"
  },
  {
    "id": "bot:message:b323266c099f",
    "kind": "message",
    "titleKey": "bot.commands.balanceCommands.d26589121",
    "keys": [
      "bot.commands.balanceCommands.d26589121"
    ],
    "parts": [
      {
        "key": "bot.commands.balanceCommands.d26589121",
        "role": "text"
      }
    ],
    "source": "src/commands/balanceCommands.ts:142"
  },
  {
    "id": "bot:message:9ede19cbd318",
    "kind": "message",
    "titleKey": "bot.commands.balanceCommands.f6de6d82d",
    "keys": [
      "bot.commands.balanceCommands.f6de6d82d"
    ],
    "parts": [
      {
        "key": "bot.commands.balanceCommands.f6de6d82d",
        "role": "text"
      }
    ],
    "source": "src/commands/balanceCommands.ts:146"
  },
  {
    "id": "bot:message:150c8b00eef9",
    "kind": "message",
    "titleKey": "bot.commands.balanceCommands.adcf50551",
    "keys": [
      "bot.commands.balanceCommands.adcf50551"
    ],
    "parts": [
      {
        "key": "bot.commands.balanceCommands.adcf50551",
        "role": "text",
        "examples": {
          "fixed1": "`!扣款 金额 @用户`"
        }
      }
    ],
    "source": "src/commands/balanceCommands.ts:159"
  },
  {
    "id": "bot:message:672e08bd0a7b",
    "kind": "message",
    "titleKey": "bot.commands.balanceCommands.335c5c3be",
    "keys": [
      "bot.commands.balanceCommands.335c5c3be"
    ],
    "parts": [
      {
        "key": "bot.commands.balanceCommands.335c5c3be",
        "role": "text"
      }
    ],
    "source": "src/commands/balanceCommands.ts:201"
  },
  {
    "id": "bot:message:ceee466cad71",
    "kind": "message",
    "titleKey": "bot.commands.balanceCommands.728b1ebe5",
    "keys": [
      "bot.commands.balanceCommands.728b1ebe5"
    ],
    "parts": [
      {
        "key": "bot.commands.balanceCommands.728b1ebe5",
        "role": "text"
      }
    ],
    "source": "src/commands/balanceCommands.ts:219"
  },
  {
    "id": "bot:message:e4df49eb9aaf",
    "kind": "message",
    "titleKey": "bot.commands.balanceCommands.77e6b9c59",
    "keys": [
      "bot.commands.balanceCommands.77e6b9c59"
    ],
    "parts": [
      {
        "key": "bot.commands.balanceCommands.77e6b9c59",
        "role": "text"
      }
    ],
    "source": "src/commands/balanceCommands.ts:276"
  },
  {
    "id": "bot:message:cc6cce51511e",
    "kind": "message",
    "titleKey": "bot.commands.balanceCommands.eff5b8174",
    "keys": [
      "bot.commands.balanceCommands.eff5b8174"
    ],
    "parts": [
      {
        "key": "bot.commands.balanceCommands.eff5b8174",
        "role": "text"
      }
    ],
    "source": "src/commands/balanceCommands.ts:282"
  },
  {
    "id": "bot:message:5e11f35481e2",
    "kind": "message",
    "titleKey": "bot.commands.balanceCommands.originalFailure",
    "keys": [
      "bot.commands.balanceCommands.originalFailure"
    ],
    "parts": [
      {
        "key": "bot.commands.balanceCommands.originalFailure",
        "role": "text"
      }
    ],
    "source": "src/commands/balanceCommands.ts:286"
  },
  {
    "id": "bot:message:e288d27b7b4b",
    "kind": "message",
    "titleKey": "bot.commands.blockStack.a116b5447",
    "keys": [
      "bot.commands.blockStack.a116b5447"
    ],
    "parts": [
      {
        "key": "bot.commands.blockStack.a116b5447",
        "role": "text"
      }
    ],
    "source": "src/commands/blockStack.ts:41"
  },
  {
    "id": "bot:message:c269bf4704e4",
    "kind": "message",
    "titleKey": "bot.commands.blockStack.36774cde4",
    "keys": [
      "bot.commands.blockStack.36774cde4"
    ],
    "parts": [
      {
        "key": "bot.commands.blockStack.36774cde4",
        "role": "text"
      }
    ],
    "source": "src/commands/blockStack.ts:304"
  },
  {
    "id": "bot:message:de0866e51e37",
    "kind": "message",
    "titleKey": "bot.commands.blockStack.8808a5bd0",
    "keys": [
      "bot.commands.blockStack.8808a5bd0"
    ],
    "parts": [
      {
        "key": "bot.commands.blockStack.8808a5bd0",
        "role": "text"
      }
    ],
    "source": "src/commands/blockStack.ts:322"
  },
  {
    "id": "bot:message:d73fe267eb79",
    "kind": "message",
    "titleKey": "bot.commands.scratch.5346e9ab1",
    "keys": [
      "bot.commands.scratch.5346e9ab1"
    ],
    "parts": [
      {
        "key": "bot.commands.scratch.5346e9ab1",
        "role": "text"
      }
    ],
    "source": "src/commands/scratch.ts:28"
  },
  {
    "id": "bot:message:133097681715",
    "kind": "message",
    "titleKey": "bot.commands.scratch.a2a94220e",
    "keys": [
      "bot.commands.scratch.a2a94220e"
    ],
    "parts": [
      {
        "key": "bot.commands.scratch.a2a94220e",
        "role": "text"
      }
    ],
    "source": "src/commands/scratch.ts:94"
  },
  {
    "id": "bot:message:dcc7e309e4de",
    "kind": "message",
    "titleKey": "bot.commands.scratchStockSlash.beafb5f15",
    "keys": [
      "bot.commands.scratchStockSlash.beafb5f15"
    ],
    "parts": [
      {
        "key": "bot.commands.scratchStockSlash.beafb5f15",
        "role": "text"
      }
    ],
    "source": "src/commands/scratchStockSlash.ts:103"
  },
  {
    "id": "bot:message:9454a62e3fad",
    "kind": "message",
    "titleKey": "bot.server.internalWebhookServer.0e99d2768",
    "keys": [
      "bot.server.internalWebhookServer.0e99d2768"
    ],
    "parts": [
      {
        "text": "**{trim}**\n\n{trim}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.server.internalWebhookServer.0e99d2768",
        "role": "text",
        "separator": "\n\n"
      }
    ],
    "source": "src/server/internalWebhookServer.ts:375"
  },
  {
    "id": "bot:message:870a9ce677fd",
    "kind": "message",
    "titleKey": "bot.server.internalWebhookServer.63dabc428",
    "keys": [
      "bot.server.internalWebhookServer.63dabc428",
      "bot.server.internalWebhookServer.19ee94304",
      "bot.server.internalWebhookServer.2e3bd40ac",
      "bot.server.internalWebhookServer.fca2b207f",
      "bot.server.internalWebhookServer.4c2cf5eff",
      "bot.server.internalWebhookServer.4a573ce62"
    ],
    "parts": [
      {
        "key": "bot.server.internalWebhookServer.63dabc428",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.server.internalWebhookServer.19ee94304",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.2e3bd40ac",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.fca2b207f",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.4c2cf5eff",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.4a573ce62",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/server/internalWebhookServer.ts:420"
  },
  {
    "id": "bot:message:58b3c4f5ca4d",
    "kind": "message",
    "titleKey": "bot.server.internalWebhookServer.c587147b8",
    "keys": [
      "bot.server.internalWebhookServer.c587147b8"
    ],
    "parts": [
      {
        "key": "bot.server.internalWebhookServer.c587147b8",
        "role": "text"
      }
    ],
    "source": "src/server/internalWebhookServer.ts:523"
  },
  {
    "id": "bot:message:f44c77f2839d",
    "kind": "message",
    "titleKey": "bot.server.internalWebhookServer.6fe4b070e",
    "keys": [
      "bot.server.internalWebhookServer.6fe4b070e"
    ],
    "parts": [
      {
        "key": "bot.server.internalWebhookServer.6fe4b070e",
        "role": "text"
      }
    ],
    "source": "src/server/internalWebhookServer.ts:1306"
  },
  {
    "id": "bot:message:cabbc5ae0cf9",
    "kind": "message",
    "titleKey": "bot.server.internalWebhookServer.1e264f19f",
    "keys": [
      "bot.server.internalWebhookServer.1e264f19f"
    ],
    "parts": [
      {
        "key": "bot.server.internalWebhookServer.1e264f19f",
        "role": "text"
      }
    ],
    "source": "src/server/internalWebhookServer.ts:1651"
  },
  {
    "id": "bot:message:603da54b027a",
    "kind": "message",
    "titleKey": "bot.server.internalWebhookServer.ae8764dec",
    "keys": [
      "bot.server.internalWebhookServer.ae8764dec"
    ],
    "parts": [
      {
        "key": "bot.server.internalWebhookServer.ae8764dec",
        "role": "text"
      }
    ],
    "source": "src/server/internalWebhookServer.ts:2071"
  },
  {
    "id": "bot:message:85260122782e",
    "kind": "message",
    "titleKey": "bot.sqlNotifications.balanceBody",
    "keys": [
      "bot.sqlNotifications.balanceBody"
    ],
    "parts": [
      {
        "key": "bot.sqlNotifications.balanceBody",
        "role": "text"
      }
    ],
    "source": "src/services/rechargeWatcher.ts:120"
  },
  {
    "id": "bot:message:c0f28e7bc3b1",
    "kind": "message",
    "titleKey": "bot.services.inviteRewardService.8409eb1ec",
    "keys": [
      "bot.services.inviteRewardService.8409eb1ec"
    ],
    "parts": [
      {
        "key": "bot.services.inviteRewardService.8409eb1ec",
        "role": "text",
        "examples": {
          "fixed2": "2"
        }
      }
    ],
    "source": "src/services/inviteRewardService.ts:179"
  },
  {
    "id": "bot:message:c4ef4e941828",
    "kind": "message",
    "titleKey": "bot.services.inviteRewardService.96e593589",
    "keys": [
      "bot.services.inviteRewardService.96e593589"
    ],
    "parts": [
      {
        "key": "bot.services.inviteRewardService.96e593589",
        "role": "text"
      }
    ],
    "source": "src/services/inviteRewardService.ts:214"
  },
  {
    "id": "bot:message:f0f3753fef4a",
    "kind": "message",
    "titleKey": "bot.services.inviteRewardService.be63aac1a",
    "keys": [
      "bot.services.inviteRewardService.be63aac1a"
    ],
    "parts": [
      {
        "key": "bot.services.inviteRewardService.be63aac1a",
        "role": "text"
      }
    ],
    "source": "src/services/inviteRewardService.ts:227"
  },
  {
    "id": "bot:message:4574f505105b",
    "kind": "message",
    "titleKey": "bot.commands.redEnvelope.ca98d00b7",
    "keys": [
      "bot.commands.redEnvelope.ca98d00b7"
    ],
    "parts": [
      {
        "key": "bot.commands.redEnvelope.ca98d00b7",
        "role": "text"
      }
    ],
    "source": "src/commands/redEnvelope.ts:71"
  },
  {
    "id": "bot:message:d4ae9c089ece",
    "kind": "message",
    "titleKey": "bot.commands.redEnvelope.f4effd517",
    "keys": [
      "bot.commands.redEnvelope.f4effd517"
    ],
    "parts": [
      {
        "key": "bot.commands.redEnvelope.f4effd517",
        "role": "text",
        "examples": {
          "fixed1": "10"
        }
      }
    ],
    "source": "src/commands/redEnvelope.ts:76"
  },
  {
    "id": "bot:message:6de31d49d51f",
    "kind": "message",
    "titleKey": "bot.commands.redEnvelope.91b020d9f",
    "keys": [
      "bot.commands.redEnvelope.91b020d9f"
    ],
    "parts": [
      {
        "key": "bot.commands.redEnvelope.91b020d9f",
        "role": "text",
        "examples": {
          "fixed1": "100"
        }
      }
    ],
    "source": "src/commands/redEnvelope.ts:81"
  },
  {
    "id": "bot:message:76ab30073d1c",
    "kind": "message",
    "titleKey": "bot.commands.redEnvelope.91fb3d39b",
    "keys": [
      "bot.commands.redEnvelope.91fb3d39b"
    ],
    "parts": [
      {
        "key": "bot.commands.redEnvelope.91fb3d39b",
        "role": "text"
      }
    ],
    "source": "src/commands/redEnvelope.ts:99"
  },
  {
    "id": "bot:message:54574fcb03a5",
    "kind": "message",
    "titleKey": "bot.commands.redEnvelope.originalFailure",
    "keys": [
      "bot.commands.redEnvelope.originalFailure"
    ],
    "parts": [
      {
        "key": "bot.commands.redEnvelope.originalFailure",
        "role": "text"
      }
    ],
    "source": "src/commands/redEnvelope.ts:164"
  },
  {
    "id": "bot:message:83c3bad5df1c",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelope.67edc7a3d",
    "keys": [
      "bot.commands.keywordRedEnvelope.67edc7a3d"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelope.67edc7a3d",
        "role": "text"
      }
    ],
    "source": "src/commands/keywordRedEnvelope.ts:30"
  },
  {
    "id": "bot:message:fb3bcf710913",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelope.94b87109b",
    "keys": [
      "bot.commands.keywordRedEnvelope.94b87109b"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelope.94b87109b",
        "role": "text"
      }
    ],
    "source": "src/commands/keywordRedEnvelope.ts:84"
  },
  {
    "id": "bot:message:5a88d8f208a6",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelope.6900ee60b",
    "keys": [
      "bot.commands.keywordRedEnvelope.6900ee60b"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelope.6900ee60b",
        "role": "text",
        "examples": {
          "fixed1": "10"
        }
      }
    ],
    "source": "src/commands/keywordRedEnvelope.ts:94"
  },
  {
    "id": "bot:message:185ecc03fe91",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelope.b597c12c8",
    "keys": [
      "bot.commands.keywordRedEnvelope.b597c12c8"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelope.b597c12c8",
        "role": "text",
        "examples": {
          "fixed1": "100"
        }
      }
    ],
    "source": "src/commands/keywordRedEnvelope.ts:99"
  },
  {
    "id": "bot:message:004f155c0605",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelope.0b60fc992",
    "keys": [
      "bot.commands.keywordRedEnvelope.0b60fc992"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelope.0b60fc992",
        "role": "text"
      }
    ],
    "source": "src/commands/keywordRedEnvelope.ts:105"
  },
  {
    "id": "bot:message:b1040fd181da",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelope.originalFailure",
    "keys": [
      "bot.commands.keywordRedEnvelope.originalFailure"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelope.originalFailure",
        "role": "text"
      }
    ],
    "source": "src/commands/keywordRedEnvelope.ts:165"
  },
  {
    "id": "bot:message:4f4301499dbc",
    "kind": "message",
    "titleKey": "bot.assistant.orderActions.f8c37eefa",
    "keys": [
      "bot.assistant.orderActions.f8c37eefa"
    ],
    "parts": [
      {
        "key": "bot.assistant.orderActions.f8c37eefa",
        "role": "text"
      }
    ],
    "source": "src/assistant/orderActions.ts:251"
  },
  {
    "id": "bot:message:42e36233ef4b",
    "kind": "message",
    "titleKey": "bot.assistant.confirmButtons.8b5dcbf28",
    "keys": [
      "bot.assistant.confirmButtons.8b5dcbf28"
    ],
    "parts": [
      {
        "key": "bot.assistant.confirmButtons.8b5dcbf28",
        "role": "text"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:77"
  },
  {
    "id": "bot:message:c0e237f2c04a",
    "kind": "message",
    "titleKey": "bot.assistant.index.630a093f9",
    "keys": [
      "bot.assistant.index.630a093f9"
    ],
    "parts": [
      {
        "key": "bot.assistant.index.630a093f9",
        "role": "text"
      }
    ],
    "source": "src/assistant/index.ts:42"
  },
  {
    "id": "bot:message:07edcbd6c3b6",
    "kind": "message",
    "titleKey": "bot.assistant.index.ce68c5984",
    "keys": [
      "bot.assistant.index.ce68c5984"
    ],
    "parts": [
      {
        "key": "bot.assistant.index.ce68c5984",
        "role": "text"
      }
    ],
    "source": "src/assistant/index.ts:310"
  },
  {
    "id": "bot:message:4ebe534f34cc",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.cancelOrder.a91e9427c",
    "keys": [
      "bot.interactions.buttons.cancelOrder.a91e9427c"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.cancelOrder.a91e9427c",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/cancelOrder.ts:11"
  },
  {
    "id": "bot:message:73832f9c959e",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.cancelOrder.7e650e024",
    "keys": [
      "bot.interactions.buttons.cancelOrder.7e650e024"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.cancelOrder.7e650e024",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/cancelOrder.ts:23"
  },
  {
    "id": "bot:message:4f9b08c1b118",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.cancelOrder.b1c8ba84f",
    "keys": [
      "bot.interactions.buttons.cancelOrder.b1c8ba84f"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.cancelOrder.b1c8ba84f",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/cancelOrder.ts:30"
  },
  {
    "id": "bot:assistant.helpResponses:buildAssistantHelpReply:163",
    "kind": "message",
    "titleKey": "bot.assistant.helpResponses.57871949e",
    "keys": [
      "bot.assistant.helpResponses.57871949e",
      "bot.assistant.helpResponses.36bd6e5dd",
      "bot.assistant.helpResponses.b8ed7b420"
    ],
    "parts": [
      {
        "key": "bot.assistant.helpResponses.57871949e",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.assistant.helpResponses.36bd6e5dd",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.helpResponses.b8ed7b420",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/helpResponses.ts:5"
  },
  {
    "id": "bot:assistant.helpResponses:buildAssistantHelpReply:397",
    "kind": "message",
    "titleKey": "bot.assistant.helpResponses.e42388a70",
    "keys": [
      "bot.assistant.helpResponses.e42388a70",
      "bot.assistant.helpResponses.f43470ba0",
      "bot.assistant.helpResponses.6bc26574a"
    ],
    "parts": [
      {
        "key": "bot.assistant.helpResponses.e42388a70",
        "role": "text",
        "examples": {
          "fixed1": "1101"
        },
        "separator": ""
      },
      {
        "key": "bot.assistant.helpResponses.f43470ba0",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.helpResponses.6bc26574a",
        "role": "text",
        "examples": {
          "fixed1": "100"
        },
        "separator": "\n"
      }
    ],
    "source": "src/assistant/helpResponses.ts:11"
  },
  {
    "id": "bot:assistant.helpResponses:buildAssistantHelpReply:683",
    "kind": "message",
    "titleKey": "bot.assistant.helpResponses.4859fe420",
    "keys": [
      "bot.assistant.helpResponses.4859fe420",
      "bot.assistant.helpResponses.ebb66c142",
      "bot.assistant.helpResponses.b0d5d8120"
    ],
    "parts": [
      {
        "key": "bot.assistant.helpResponses.4859fe420",
        "role": "text",
        "examples": {
          "fixed1": "10",
          "fixed2": "10",
          "fixed3": "61111"
        },
        "separator": ""
      },
      {
        "key": "bot.assistant.helpResponses.ebb66c142",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.helpResponses.b0d5d8120",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/helpResponses.ts:17"
  },
  {
    "id": "bot:assistant.helpResponses:buildAssistantHelpReply:991",
    "kind": "message",
    "titleKey": "bot.assistant.helpResponses.43a455a2a",
    "keys": [
      "bot.assistant.helpResponses.43a455a2a"
    ],
    "parts": [
      {
        "key": "bot.assistant.helpResponses.43a455a2a",
        "role": "text"
      }
    ],
    "source": "src/assistant/helpResponses.ts:23"
  },
  {
    "id": "bot:assistant.helpResponses:buildAssistantHelpReply:1076",
    "kind": "message",
    "titleKey": "bot.assistant.helpResponses.1fe95d34b",
    "keys": [
      "bot.assistant.helpResponses.1fe95d34b",
      "bot.assistant.helpResponses.145ddeb0a"
    ],
    "parts": [
      {
        "key": "bot.assistant.helpResponses.1fe95d34b",
        "role": "text",
        "examples": {
          "fixed1": "1234"
        },
        "separator": ""
      },
      {
        "key": "bot.assistant.helpResponses.145ddeb0a",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/helpResponses.ts:25"
  },
  {
    "id": "bot:assistant.helpResponses:buildAssistantHelpReply:1281",
    "kind": "message",
    "titleKey": "bot.assistant.helpResponses.efb0412e3",
    "keys": [
      "bot.assistant.helpResponses.efb0412e3"
    ],
    "parts": [
      {
        "key": "bot.assistant.helpResponses.efb0412e3",
        "role": "text"
      }
    ],
    "source": "src/assistant/helpResponses.ts:30"
  },
  {
    "id": "bot:assistant.helpResponses:buildAssistantHelpReply:1371",
    "kind": "message",
    "titleKey": "bot.assistant.helpResponses.fd9cec0ea",
    "keys": [
      "bot.assistant.helpResponses.fd9cec0ea"
    ],
    "parts": [
      {
        "key": "bot.assistant.helpResponses.fd9cec0ea",
        "role": "text"
      }
    ],
    "source": "src/assistant/helpResponses.ts:32"
  },
  {
    "id": "bot:assistant.helpResponses:buildAssistantHelpReply:1462",
    "kind": "message",
    "titleKey": "bot.assistant.helpResponses.d3da2d320",
    "keys": [
      "bot.assistant.helpResponses.d3da2d320"
    ],
    "parts": [
      {
        "key": "bot.assistant.helpResponses.d3da2d320",
        "role": "text"
      }
    ],
    "source": "src/assistant/helpResponses.ts:34"
  },
  {
    "id": "bot:assistant.helpResponses:buildAssistantHelpReply:1538",
    "kind": "message",
    "titleKey": "bot.assistant.helpResponses.6b77785a9",
    "keys": [
      "bot.assistant.helpResponses.6b77785a9",
      "bot.assistant.helpResponses.ae254b2af",
      "bot.assistant.helpResponses.4ccc9bc49",
      "bot.assistant.helpResponses.3d6fc86e5",
      "bot.assistant.helpResponses.f23740cef",
      "bot.assistant.helpResponses.ed951b921",
      "bot.assistant.helpResponses.18e0a32a2",
      "bot.assistant.helpResponses.0b76ab27f"
    ],
    "parts": [
      {
        "key": "bot.assistant.helpResponses.6b77785a9",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.assistant.helpResponses.ae254b2af",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.helpResponses.4ccc9bc49",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.helpResponses.3d6fc86e5",
        "role": "text",
        "examples": {
          "fixed1": "1101"
        },
        "separator": "\n"
      },
      {
        "key": "bot.assistant.helpResponses.f23740cef",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.helpResponses.ed951b921",
        "role": "text",
        "examples": {
          "fixed1": "10"
        },
        "separator": "\n"
      },
      {
        "key": "bot.assistant.helpResponses.18e0a32a2",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.helpResponses.0b76ab27f",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/helpResponses.ts:36"
  },
  {
    "id": "bot:assistant.planner:buildDispatchConfirmationText:1578",
    "kind": "message",
    "titleKey": "bot.assistant.planner.f495ee3ce",
    "keys": [
      "bot.assistant.planner.f495ee3ce"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.f495ee3ce",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:46"
  },
  {
    "id": "bot:profile-card:empty",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.8fdb1ac7f",
    "keys": [
      "bot.ui.orderEmbeds.c267198fe",
      "bot.ui.orderEmbeds.96dcb130e",
      "bot.ui.orderEmbeds.32f6b5da9",
      "bot.ui.orderEmbeds.485b7d8af",
      "bot.ui.orderEmbeds.480c25ef2",
      "bot.ui.orderEmbeds.8fdb1ac7f",
      "bot.ui.orderEmbeds.1ee2a4024",
      "bot.ui.orderEmbeds.quotationQ1",
      "bot.ui.orderEmbeds.quotationQ2",
      "bot.ui.orderEmbeds.quotationQ3",
      "bot.ui.orderEmbeds.quotationQ4",
      "bot.ui.orderEmbeds.quotationQ5",
      "bot.ui.orderEmbeds.quotationQ6",
      "bot.ui.orderEmbeds.quotationQ7",
      "bot.ui.orderEmbeds.quotationQ8",
      "bot.ui.orderEmbeds.quotationQ9",
      "bot.ui.orderEmbeds.quotationQ10",
      "bot.ui.orderEmbeds.54564c64f",
      "bot.ui.orderEmbeds.99b00df69",
      "bot.ui.orderEmbeds.7f8fdc741"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.c267198fe",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.96dcb130e",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{peiwanId} {workerMention}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.32f6b5da9",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{roleLabels}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.485b7d8af",
        "role": "label",
        "examples": {
          "fixed1": "<a:41:1552515993182412812>"
        },
        "separator": "\n"
      },
      {
        "text": "{sanitizedOrderContent}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.480c25ef2",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.8fdb1ac7f",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.1ee2a4024",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ1",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ2",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ3",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ4",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ5",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ6",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ7",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ8",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ9",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ10",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.54564c64f",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ1",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ2",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ3",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ4",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ5",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ6",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ7",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ8",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ9",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ10",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.99b00df69",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{GiftName}：¥{price}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.7f8fdc741",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{GiftName}：¥{price}",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:246"
  },
  {
    "id": "bot:profile-card:reviews",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.480c25ef2",
    "keys": [
      "bot.ui.orderEmbeds.c267198fe",
      "bot.ui.orderEmbeds.96dcb130e",
      "bot.ui.orderEmbeds.32f6b5da9",
      "bot.ui.orderEmbeds.485b7d8af",
      "bot.ui.orderEmbeds.480c25ef2",
      "bot.ui.orderEmbeds.1ee2a4024",
      "bot.ui.orderEmbeds.quotationQ1",
      "bot.ui.orderEmbeds.quotationQ2",
      "bot.ui.orderEmbeds.quotationQ3",
      "bot.ui.orderEmbeds.quotationQ4",
      "bot.ui.orderEmbeds.quotationQ5",
      "bot.ui.orderEmbeds.quotationQ6",
      "bot.ui.orderEmbeds.quotationQ7",
      "bot.ui.orderEmbeds.quotationQ8",
      "bot.ui.orderEmbeds.quotationQ9",
      "bot.ui.orderEmbeds.quotationQ10",
      "bot.ui.orderEmbeds.54564c64f",
      "bot.ui.orderEmbeds.99b00df69",
      "bot.ui.orderEmbeds.7f8fdc741"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.c267198fe",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.96dcb130e",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{peiwanId} {workerMention}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.32f6b5da9",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{roleLabels}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.485b7d8af",
        "role": "label",
        "examples": {
          "fixed1": "<a:41:1552515993182412812>"
        },
        "separator": "\n"
      },
      {
        "text": "{sanitizedOrderContent}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.480c25ef2",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{bossReviews}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.1ee2a4024",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ1",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ2",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ3",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ4",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ5",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ6",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ7",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ8",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ9",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ10",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.54564c64f",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ1",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ2",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ3",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ4",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ5",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ6",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ7",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ8",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ9",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ10",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.99b00df69",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{GiftName}：¥{price}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.7f8fdc741",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{GiftName}：¥{price}",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:246"
  },
  {
    "id": "bot:fusion-panel:available",
    "kind": "card",
    "titleKey": "bot.commands.lotteryFusionSlash.493329069",
    "keys": [
      "bot.commands.lotteryFusionSlash.493329069",
      "bot.commands.lotteryFusionSlash.96e8dafce",
      "bot.commands.lotteryFusionSlash.edc341ea1",
      "bot.commands.lotteryFusionSlash.1de8b2be4",
      "bot.commands.lotteryFusionSlash.c7133b315",
      "bot.commands.lotteryFusionSlash.6f288532b",
      "bot.commands.lotteryFusionSlash.9f2518b71",
      "bot.commands.lotteryFusionSlash.0961a7db5",
      "bot.commands.lotteryFusionSlash.822234e53",
      "bot.commands.lotteryFusionSlash.d91b3117f",
      "bot.commands.lotteryFusionSlash.859bac46f",
      "bot.commands.lotteryFusionSlash.dcf86dc80",
      "bot.commands.lotteryFusionSlash.dc94f2fbd",
      "bot.commands.lotteryFusionSlash.e1fb83586",
      "bot.commands.lotteryFusionSlash.b9d405adf",
      "bot.commands.lotteryFusionSlash.043794451",
      "bot.commands.lotteryFusionSlash.c8e663b60",
      "bot.commands.lotteryFusionSlash.a27a076ed"
    ],
    "parts": [
      {
        "key": "bot.commands.lotteryFusionSlash.493329069",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.commands.lotteryFusionSlash.96e8dafce",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.edc341ea1",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.1de8b2be4",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.c7133b315",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.6f288532b",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.9f2518b71",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{selectedGroups}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.0961a7db5",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.822234e53",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.d91b3117f",
        "role": "footer",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.859bac46f",
        "role": "button",
        "separator": "\n",
        "examples": {
          "count": 3
        }
      },
      {
        "key": "bot.commands.lotteryFusionSlash.859bac46f",
        "role": "button",
        "separator": "\n",
        "examples": {
          "count": 4
        }
      },
      {
        "key": "bot.commands.lotteryFusionSlash.859bac46f",
        "role": "button",
        "separator": "\n",
        "examples": {
          "count": 6
        }
      },
      {
        "key": "bot.commands.lotteryFusionSlash.dcf86dc80",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{prizeName} ×{remainingCount}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.dc94f2fbd",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{prizeName} ×{selectedCount}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.e1fb83586",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.b9d405adf",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.043794451",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.c8e663b60",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.a27a076ed",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/commands/lotteryFusionSlash.ts:174"
  },
  {
    "id": "bot:fusion-panel:insufficient",
    "kind": "card",
    "titleKey": "bot.commands.lotteryFusionSlash.8bc8fb8e8",
    "keys": [
      "bot.commands.lotteryFusionSlash.493329069",
      "bot.commands.lotteryFusionSlash.96e8dafce",
      "bot.commands.lotteryFusionSlash.edc341ea1",
      "bot.commands.lotteryFusionSlash.1de8b2be4",
      "bot.commands.lotteryFusionSlash.8bc8fb8e8",
      "bot.commands.lotteryFusionSlash.6f288532b",
      "bot.commands.lotteryFusionSlash.9f2518b71",
      "bot.commands.lotteryFusionSlash.0961a7db5",
      "bot.commands.lotteryFusionSlash.822234e53",
      "bot.commands.lotteryFusionSlash.d91b3117f",
      "bot.commands.lotteryFusionSlash.859bac46f",
      "bot.commands.lotteryFusionSlash.dcf86dc80",
      "bot.commands.lotteryFusionSlash.dc94f2fbd",
      "bot.commands.lotteryFusionSlash.e1fb83586",
      "bot.commands.lotteryFusionSlash.b9d405adf",
      "bot.commands.lotteryFusionSlash.043794451",
      "bot.commands.lotteryFusionSlash.c8e663b60",
      "bot.commands.lotteryFusionSlash.a27a076ed"
    ],
    "parts": [
      {
        "key": "bot.commands.lotteryFusionSlash.493329069",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.commands.lotteryFusionSlash.96e8dafce",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.edc341ea1",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.1de8b2be4",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.8bc8fb8e8",
        "role": "text",
        "examples": {
          "fixed1": "3"
        },
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.6f288532b",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.9f2518b71",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{selectedGroups}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.0961a7db5",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.822234e53",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.d91b3117f",
        "role": "footer",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.859bac46f",
        "role": "button",
        "separator": "\n",
        "examples": {
          "count": 3
        }
      },
      {
        "key": "bot.commands.lotteryFusionSlash.859bac46f",
        "role": "button",
        "separator": "\n",
        "examples": {
          "count": 4
        }
      },
      {
        "key": "bot.commands.lotteryFusionSlash.859bac46f",
        "role": "button",
        "separator": "\n",
        "examples": {
          "count": 6
        }
      },
      {
        "key": "bot.commands.lotteryFusionSlash.dcf86dc80",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{prizeName} ×{remainingCount}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.dc94f2fbd",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{prizeName} ×{selectedCount}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.e1fb83586",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.b9d405adf",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.043794451",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.c8e663b60",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.a27a076ed",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/commands/lotteryFusionSlash.ts:174"
  },
  {
    "id": "bot:fusion-panel:submitting",
    "kind": "card",
    "titleKey": "bot.commands.lotteryFusionSlash.bfd31b69b",
    "keys": [
      "bot.commands.lotteryFusionSlash.493329069",
      "bot.commands.lotteryFusionSlash.bfd31b69b",
      "bot.commands.lotteryFusionSlash.9f2518b71",
      "bot.commands.lotteryFusionSlash.0961a7db5",
      "bot.commands.lotteryFusionSlash.822234e53",
      "bot.commands.lotteryFusionSlash.d91b3117f",
      "bot.commands.lotteryFusionSlash.859bac46f",
      "bot.commands.lotteryFusionSlash.dcf86dc80",
      "bot.commands.lotteryFusionSlash.dc94f2fbd",
      "bot.commands.lotteryFusionSlash.e1fb83586",
      "bot.commands.lotteryFusionSlash.b9d405adf",
      "bot.commands.lotteryFusionSlash.043794451",
      "bot.commands.lotteryFusionSlash.c8e663b60",
      "bot.commands.lotteryFusionSlash.109c4a20c"
    ],
    "parts": [
      {
        "key": "bot.commands.lotteryFusionSlash.493329069",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.commands.lotteryFusionSlash.bfd31b69b",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.9f2518b71",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{selectedGroups}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.0961a7db5",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.822234e53",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.d91b3117f",
        "role": "footer",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.859bac46f",
        "role": "button",
        "separator": "\n",
        "examples": {
          "count": 3
        }
      },
      {
        "key": "bot.commands.lotteryFusionSlash.859bac46f",
        "role": "button",
        "separator": "\n",
        "examples": {
          "count": 4
        }
      },
      {
        "key": "bot.commands.lotteryFusionSlash.859bac46f",
        "role": "button",
        "separator": "\n",
        "examples": {
          "count": 6
        }
      },
      {
        "key": "bot.commands.lotteryFusionSlash.dcf86dc80",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{prizeName} ×{remainingCount}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.dc94f2fbd",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{prizeName} ×{selectedCount}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.e1fb83586",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.b9d405adf",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.043794451",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.c8e663b60",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.109c4a20c",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/commands/lotteryFusionSlash.ts:174"
  },
  {
    "id": "bot:withdrawal:dm",
    "kind": "card",
    "titleKey": "bot.services.withdrawalNotificationService.b848685dd",
    "keys": [
      "bot.services.withdrawalNotificationService.b848685dd",
      "bot.services.withdrawalNotificationService.58231253b",
      "bot.services.withdrawalNotificationService.ecb2ebafa",
      "bot.services.withdrawalNotificationService.003574a5f"
    ],
    "parts": [
      {
        "key": "bot.services.withdrawalNotificationService.b848685dd",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.withdrawalNotificationService.58231253b",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.withdrawalNotificationService.ecb2ebafa",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.withdrawalNotificationService.003574a5f",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/withdrawalNotificationService.ts:121"
  },
  {
    "id": "bot:withdrawal:announcement",
    "kind": "card",
    "titleKey": "bot.services.withdrawalNotificationService.6c340c34f",
    "keys": [
      "bot.services.withdrawalNotificationService.6c340c34f",
      "bot.services.withdrawalNotificationService.b537b075a",
      "bot.services.withdrawalNotificationService.f568f6c80",
      "bot.services.withdrawalNotificationService.ecb2ebafa",
      "bot.services.withdrawalNotificationService.876e62149"
    ],
    "parts": [
      {
        "key": "bot.services.withdrawalNotificationService.6c340c34f",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.withdrawalNotificationService.b537b075a",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "陪玩ID：{workId}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.withdrawalNotificationService.f568f6c80",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.withdrawalNotificationService.ecb2ebafa",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.withdrawalNotificationService.876e62149",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/withdrawalNotificationService.ts:121"
  },
  {
    "id": "bot:gifting:points:false",
    "kind": "card",
    "titleKey": "bot.commands.gifting.e1580b03f",
    "keys": [
      "bot.commands.gifting.841dae4fc",
      "bot.commands.gifting.e1580b03f"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.841dae4fc",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.commands.gifting.e1580b03f",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/commands/gifting.ts:1053"
  },
  {
    "id": "bot:gifting:points:true",
    "kind": "card",
    "titleKey": "bot.commands.gifting.20958a59f",
    "keys": [
      "bot.commands.gifting.841dae4fc",
      "bot.commands.gifting.20958a59f",
      "bot.commands.gifting.2e5e5481d",
      "bot.commands.gifting.61dc20628"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.841dae4fc",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.commands.gifting.20958a59f",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.gifting.2e5e5481d",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.gifting.61dc20628",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/commands/gifting.ts:1053"
  },
  {
    "id": "bot:vip:summary",
    "kind": "card",
    "titleKey": "bot.services.vipBenefitService.c4635c3a8",
    "keys": [
      "bot.services.vipBenefitService.c4635c3a8",
      "bot.services.vipBenefitService.38f7aad80",
      "bot.services.vipBenefitService.currentTier",
      "bot.services.vipBenefitService.roleSynced",
      "bot.services.vipBenefitService.pointsBonus",
      "bot.services.vipBenefitService.3b302d606",
      "bot.services.vipBenefitService.0ee948a1d",
      "bot.services.vipBenefitService.ba58de4b5"
    ],
    "parts": [
      {
        "key": "bot.services.vipBenefitService.c4635c3a8",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.vipBenefitService.38f7aad80",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- ",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.currentTier",
        "role": "text",
        "separator": ""
      },
      {
        "text": "- ",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.roleSynced",
        "role": "text",
        "separator": ""
      },
      {
        "text": "- ",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.pointsBonus",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.vipBenefitService.3b302d606",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- {granted}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.0ee948a1d",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- {revoked}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.ba58de4b5",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- {contact}",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/vipBenefitService.ts:558"
  },
  {
    "id": "bot:vip:overview",
    "kind": "card",
    "titleKey": "bot.services.vipBenefitService.ae35b3e81",
    "keys": [
      "bot.services.vipBenefitService.ae35b3e81",
      "bot.services.vipBenefitService.38f7aad80",
      "bot.services.vipBenefitService.currentTier",
      "bot.services.vipBenefitService.roleSynced",
      "bot.services.vipBenefitService.pointsBonus",
      "bot.services.vipBenefitService.e173463bd",
      "bot.services.vipBenefitService.ba58de4b5"
    ],
    "parts": [
      {
        "key": "bot.services.vipBenefitService.ae35b3e81",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.vipBenefitService.38f7aad80",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- ",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.currentTier",
        "role": "text",
        "separator": ""
      },
      {
        "text": "- ",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.roleSynced",
        "role": "text",
        "separator": ""
      },
      {
        "text": "- ",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.pointsBonus",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.vipBenefitService.e173463bd",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- {autoBenefits}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.ba58de4b5",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- {manualBenefits}",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/vipBenefitService.ts:578"
  },
  {
    "id": "bot:vip:level:true",
    "kind": "card",
    "titleKey": "bot.services.vipBenefitService.0ba407aec",
    "keys": [
      "bot.services.vipBenefitService.0ba407aec",
      "bot.services.vipBenefitService.38f7aad80",
      "bot.services.vipBenefitService.currentTier",
      "bot.services.vipBenefitService.roleSynced",
      "bot.services.vipBenefitService.pointsBonus",
      "bot.services.vipBenefitService.1be557d14",
      "bot.services.vipBenefitService.b22d75632",
      "bot.services.vipBenefitService.ba58de4b5"
    ],
    "parts": [
      {
        "key": "bot.services.vipBenefitService.0ba407aec",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.vipBenefitService.38f7aad80",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- ",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.currentTier",
        "role": "text",
        "separator": ""
      },
      {
        "text": "- ",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.roleSynced",
        "role": "text",
        "separator": ""
      },
      {
        "text": "- ",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.pointsBonus",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.vipBenefitService.1be557d14",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- {granted}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.b22d75632",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- {alreadyDelivered}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.ba58de4b5",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- {contact}",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/vipBenefitService.ts:606"
  },
  {
    "id": "bot:vip:level:false",
    "kind": "card",
    "titleKey": "bot.services.vipBenefitService.054121585",
    "keys": [
      "bot.services.vipBenefitService.0ba407aec",
      "bot.services.vipBenefitService.054121585",
      "bot.services.vipBenefitService.1be557d14",
      "bot.services.vipBenefitService.b22d75632",
      "bot.services.vipBenefitService.ba58de4b5"
    ],
    "parts": [
      {
        "key": "bot.services.vipBenefitService.0ba407aec",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.vipBenefitService.054121585",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- VIP {vipLevel} · {name}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.1be557d14",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- {granted}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.b22d75632",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- {alreadyDelivered}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.vipBenefitService.ba58de4b5",
        "role": "label",
        "separator": "\n\n"
      },
      {
        "text": "- {contact}",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/vipBenefitService.ts:606"
  },
  {
    "id": "bot:recruitment:unassessed",
    "kind": "section",
    "titleKey": "bot.services.recruitmentApplicationService.b7abc5ea8",
    "keys": [
      "bot.services.recruitmentApplicationService.b7abc5ea8",
      "bot.services.recruitmentApplicationService.3432eb27f",
      "bot.services.recruitmentApplicationService.40bc30462",
      "bot.services.recruitmentApplicationService.db69bf05b",
      "bot.services.recruitmentApplicationService.e33338b24",
      "bot.services.recruitmentApplicationService.a0e331e7c",
      "bot.services.recruitmentApplicationService.afb3f55d8",
      "bot.services.recruitmentApplicationService.c68f4d515",
      "bot.services.recruitmentApplicationService.d58c52ad1",
      "bot.services.recruitmentApplicationService.86599ff70",
      "bot.services.recruitmentApplicationService.b98352511",
      "bot.services.recruitmentApplicationService.b0b836e5d",
      "bot.services.recruitmentApplicationService.3e64c4a75"
    ],
    "parts": [
      {
        "key": "bot.services.recruitmentApplicationService.b7abc5ea8",
        "role": "title",
        "separator": "",
        "examples": {
          "value": "",
          "part": ""
        }
      },
      {
        "text": "Discord ID：{discordId}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.3432eb27f",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{nickname}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.40bc30462",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{gender}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.db69bf05b",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{voice}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.e33338b24",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{exclusive}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.a0e331e7c",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{region}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.afb3f55d8",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{intro}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.c68f4d515",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{assessment}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.d58c52ad1",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{games}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.86599ff70",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{otherGames}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.b98352511",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{guild}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.b0b836e5d",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{inviter}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.3e64c4a75",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{wechat}",
        "role": "text",
        "separator": ""
      }
    ],
    "source": "src/services/recruitmentApplicationService.ts:40"
  },
  {
    "id": "bot:recruitment:assessed",
    "kind": "section",
    "titleKey": "bot.services.recruitmentApplicationService.6a7e141f1",
    "keys": [
      "bot.services.recruitmentApplicationService.b7abc5ea8",
      "bot.services.recruitmentApplicationService.3432eb27f",
      "bot.services.recruitmentApplicationService.40bc30462",
      "bot.services.recruitmentApplicationService.db69bf05b",
      "bot.services.recruitmentApplicationService.e33338b24",
      "bot.services.recruitmentApplicationService.a0e331e7c",
      "bot.services.recruitmentApplicationService.afb3f55d8",
      "bot.services.recruitmentApplicationService.c68f4d515",
      "bot.services.recruitmentApplicationService.6a7e141f1",
      "bot.services.recruitmentApplicationService.1df8949e4",
      "bot.services.recruitmentApplicationService.0ea1c24f4",
      "bot.services.recruitmentApplicationService.d58c52ad1",
      "bot.services.recruitmentApplicationService.86599ff70",
      "bot.services.recruitmentApplicationService.b98352511",
      "bot.services.recruitmentApplicationService.b0b836e5d",
      "bot.services.recruitmentApplicationService.3e64c4a75"
    ],
    "parts": [
      {
        "key": "bot.services.recruitmentApplicationService.b7abc5ea8",
        "role": "title",
        "separator": "",
        "examples": {
          "value": "",
          "part": ""
        }
      },
      {
        "text": "Discord ID：{discordId}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.3432eb27f",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{nickname}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.40bc30462",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{gender}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.db69bf05b",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{voice}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.e33338b24",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{exclusive}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.a0e331e7c",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{region}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.afb3f55d8",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{intro}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.c68f4d515",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{assessment}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.6a7e141f1",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{tier}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.1df8949e4",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{card}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.0ea1c24f4",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{heroes}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.d58c52ad1",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{games}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.86599ff70",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{otherGames}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.b98352511",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{guild}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.b0b836e5d",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{inviter}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.3e64c4a75",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{wechat}",
        "role": "text",
        "separator": ""
      }
    ],
    "source": "src/services/recruitmentApplicationService.ts:40"
  },
  {
    "id": "bot:recruitment:transfer",
    "kind": "section",
    "titleKey": "bot.services.recruitmentApplicationService.ba6195810",
    "keys": [
      "bot.services.recruitmentApplicationService.b7abc5ea8",
      "bot.services.recruitmentApplicationService.3432eb27f",
      "bot.services.recruitmentApplicationService.40bc30462",
      "bot.services.recruitmentApplicationService.db69bf05b",
      "bot.services.recruitmentApplicationService.e33338b24",
      "bot.services.recruitmentApplicationService.a0e331e7c",
      "bot.services.recruitmentApplicationService.afb3f55d8",
      "bot.services.recruitmentApplicationService.c68f4d515",
      "bot.services.recruitmentApplicationService.ba6195810",
      "bot.services.recruitmentApplicationService.6a7e141f1",
      "bot.services.recruitmentApplicationService.1df8949e4",
      "bot.services.recruitmentApplicationService.0ea1c24f4",
      "bot.services.recruitmentApplicationService.d58c52ad1",
      "bot.services.recruitmentApplicationService.86599ff70",
      "bot.services.recruitmentApplicationService.b98352511",
      "bot.services.recruitmentApplicationService.b0b836e5d",
      "bot.services.recruitmentApplicationService.3e64c4a75"
    ],
    "parts": [
      {
        "key": "bot.services.recruitmentApplicationService.b7abc5ea8",
        "role": "title",
        "separator": "",
        "examples": {
          "value": "",
          "part": ""
        }
      },
      {
        "text": "Discord ID：{discordId}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.3432eb27f",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{nickname}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.40bc30462",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{gender}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.db69bf05b",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{voice}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.e33338b24",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{exclusive}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.a0e331e7c",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{region}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.afb3f55d8",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{intro}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.c68f4d515",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{assessment}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.ba6195810",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{sourceGuild}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.6a7e141f1",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{tier}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.1df8949e4",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{card}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.0ea1c24f4",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{heroes}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.d58c52ad1",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{games}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.86599ff70",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{otherGames}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.b98352511",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{guild}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.b0b836e5d",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{inviter}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.recruitmentApplicationService.3e64c4a75",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：{wechat}",
        "role": "text",
        "separator": ""
      }
    ],
    "source": "src/services/recruitmentApplicationService.ts:40"
  },
  {
    "id": "bot:lottery:start:false:false",
    "kind": "card",
    "titleKey": "bot.commands.lottery.a3c1e9efa",
    "keys": [
      "bot.commands.lottery.cf8f84ee9",
      "bot.commands.lottery.a3c1e9efa"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.cf8f84ee9",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.commands.lottery.a3c1e9efa",
        "role": "text",
        "separator": "\n",
        "examples": {
          "actionText": "抽奖"
        }
      }
    ],
    "source": "src/commands/lottery.ts:51"
  },
  {
    "id": "bot:lottery:start:false:true",
    "kind": "card",
    "titleKey": "bot.commands.lottery.66353f9a2",
    "keys": [
      "bot.commands.lottery.cf8f84ee9",
      "bot.commands.lottery.66353f9a2"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.cf8f84ee9",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.commands.lottery.66353f9a2",
        "role": "text",
        "separator": "\n",
        "examples": {
          "actionText": "抽奖"
        }
      }
    ],
    "source": "src/commands/lottery.ts:51"
  },
  {
    "id": "bot:lottery:start:true:false",
    "kind": "card",
    "titleKey": "bot.commands.lottery.d405e680a",
    "keys": [
      "bot.commands.lottery.cf8f84ee9",
      "bot.commands.lottery.d405e680a"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.cf8f84ee9",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.commands.lottery.d405e680a",
        "role": "text",
        "separator": "\n",
        "examples": {
          "actionText": "抽奖"
        }
      }
    ],
    "source": "src/commands/lottery.ts:51"
  },
  {
    "id": "bot:lottery:start:true:true",
    "kind": "card",
    "titleKey": "bot.commands.lottery.3ec139f40",
    "keys": [
      "bot.commands.lottery.cf8f84ee9",
      "bot.commands.lottery.3ec139f40"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.cf8f84ee9",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.commands.lottery.3ec139f40",
        "role": "text",
        "separator": "\n",
        "examples": {
          "actionText": "抽奖"
        }
      }
    ],
    "source": "src/commands/lottery.ts:51"
  },
  {
    "id": "bot:lottery:reveal:false:mystery",
    "kind": "card",
    "titleKey": "bot.commands.lottery.89970e61a",
    "keys": [
      "bot.commands.lottery.5c7007dc5",
      "bot.commands.lottery.cf8f84ee9",
      "bot.commands.lottery.89970e61a",
      "bot.commands.lottery.c1470e2f7"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.5c7007dc5",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.commands.lottery.cf8f84ee9",
        "role": "title",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lottery.89970e61a",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lottery.c1470e2f7",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/commands/lottery.ts:138"
  },
  {
    "id": "bot:lottery:reveal:false:prize",
    "kind": "card",
    "titleKey": "bot.commands.lottery.6909d05be",
    "keys": [
      "bot.commands.lottery.5c7007dc5",
      "bot.commands.lottery.cf8f84ee9",
      "bot.commands.lottery.6909d05be"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.5c7007dc5",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.commands.lottery.cf8f84ee9",
        "role": "title",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lottery.6909d05be",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/commands/lottery.ts:144"
  },
  {
    "id": "bot:lottery:reveal:false:blocks",
    "kind": "card",
    "titleKey": "bot.commands.lottery.6909d05be",
    "keys": [
      "bot.commands.lottery.5c7007dc5",
      "bot.commands.lottery.cf8f84ee9",
      "bot.commands.lottery.6909d05be",
      "bot.commands.lottery.2b7890ea6"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.5c7007dc5",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.commands.lottery.cf8f84ee9",
        "role": "title",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lottery.6909d05be",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lottery.2b7890ea6",
        "role": "text",
        "examples": {
          "fixed1": "!抽积木消耗该代金券"
        },
        "separator": "\n"
      }
    ],
    "source": "src/commands/lottery.ts:144"
  },
  {
    "id": "bot:lottery:reveal:true:mystery",
    "kind": "card",
    "titleKey": "bot.commands.lottery.a9ceb1381",
    "keys": [
      "bot.commands.lottery.5c7007dc5",
      "bot.commands.lottery.cf8f84ee9",
      "bot.commands.lottery.a9ceb1381",
      "bot.commands.lottery.c1470e2f7"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.5c7007dc5",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.commands.lottery.cf8f84ee9",
        "role": "title",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lottery.a9ceb1381",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lottery.c1470e2f7",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/commands/lottery.ts:137"
  },
  {
    "id": "bot:lottery:reveal:true:prize",
    "kind": "card",
    "titleKey": "bot.commands.lottery.cf394b8c6",
    "keys": [
      "bot.commands.lottery.5c7007dc5",
      "bot.commands.lottery.cf8f84ee9",
      "bot.commands.lottery.cf394b8c6"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.5c7007dc5",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.commands.lottery.cf8f84ee9",
        "role": "title",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lottery.cf394b8c6",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/commands/lottery.ts:143"
  },
  {
    "id": "bot:lottery:reveal:true:blocks",
    "kind": "card",
    "titleKey": "bot.commands.lottery.cf394b8c6",
    "keys": [
      "bot.commands.lottery.5c7007dc5",
      "bot.commands.lottery.cf8f84ee9",
      "bot.commands.lottery.cf394b8c6",
      "bot.commands.lottery.2b7890ea6"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.5c7007dc5",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.commands.lottery.cf8f84ee9",
        "role": "title",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lottery.cf394b8c6",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lottery.2b7890ea6",
        "role": "text",
        "examples": {
          "fixed1": "!抽积木消耗该代金券"
        },
        "separator": "\n"
      }
    ],
    "source": "src/commands/lottery.ts:143"
  },
  {
    "id": "bot:inline-card:2a0e3ffde412",
    "kind": "card",
    "titleKey": "bot.ui.orderEmbeds.dae625146",
    "keys": [
      "bot.ui.orderEmbeds.dae625146",
      "bot.ui.orderEmbeds.69234b829",
      "bot.ui.orderEmbeds.2e2f60b3d"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.dae625146",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.69234b829",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.2e2f60b3d",
        "role": "text",
        "separator": "\n"
      },
      {
        "text": "\n{extraLines}",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:605"
  },
  {
    "id": "bot:inline-card:da233f50d431",
    "kind": "card",
    "titleKey": "bot.features.giftFeedHelper.e93ac9b76",
    "keys": [
      "bot.features.giftFeedHelper.e93ac9b76",
      "bot.features.giftFeedHelper.e4f3ebb98"
    ],
    "parts": [
      {
        "text": "{mentionPrefix}感谢{giverLabel} 老板送给陪玩 <@{receiverId}> \"{giftName}\", 感谢老板对陪陪的喜爱",
        "role": "text",
        "separator": ""
      },
      {
        "text": "**{giftName}**",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.features.giftFeedHelper.e93ac9b76",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.features.giftFeedHelper.e4f3ebb98",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/features/giftFeedHelper.ts:208"
  },
  {
    "id": "bot:inline-card:c3a23adaf816",
    "kind": "card",
    "titleKey": "bot.services.voicePointService.d6f433477",
    "keys": [
      "bot.services.voicePointService.d6f433477",
      "bot.services.voicePointService.a7444be72"
    ],
    "parts": [
      {
        "key": "bot.services.voicePointService.d6f433477",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.voicePointService.a7444be72",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/voicePointService.ts:184"
  },
  {
    "id": "bot:scratch-stock:empty",
    "kind": "card",
    "titleKey": "bot.commands.scratchStockSlash.2609a1574",
    "keys": [
      "bot.commands.scratchStockSlash.0217d19c7",
      "bot.commands.scratchStockSlash.2609a1574",
      "bot.commands.scratchStockSlash.f1be4ba01",
      "bot.commands.scratchStockSlash.d93c40c59",
      "bot.commands.scratchStockSlash.107739a9d"
    ],
    "parts": [
      {
        "key": "bot.commands.scratchStockSlash.0217d19c7",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.commands.scratchStockSlash.2609a1574",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.scratchStockSlash.f1be4ba01",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{total}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.scratchStockSlash.d93c40c59",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{sold}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.scratchStockSlash.107739a9d",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "0",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/commands/scratchStockSlash.ts:51"
  },
  {
    "id": "bot:scratch-stock:available",
    "kind": "card",
    "titleKey": "bot.commands.scratchStockSlash.0217d19c7",
    "keys": [
      "bot.commands.scratchStockSlash.0217d19c7",
      "bot.commands.scratchStockSlash.107739a9d",
      "bot.commands.scratchStockSlash.cc1a96f5a",
      "bot.commands.scratchStockSlash.c5a9ea98d",
      "bot.commands.scratchStockSlash.a1d865cab",
      "bot.commands.scratchStockSlash.2bb7b4bee",
      "bot.commands.scratchStockSlash.a9be09e72"
    ],
    "parts": [
      {
        "key": "bot.commands.scratchStockSlash.0217d19c7",
        "role": "title",
        "separator": ""
      },
      {
        "text": "{codeRows}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.scratchStockSlash.107739a9d",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{unsold}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.scratchStockSlash.cc1a96f5a",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{page}/{totalPages}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.scratchStockSlash.c5a9ea98d",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.commands.scratchStockSlash.a1d865cab",
        "role": "text",
        "examples": {
          "fixed2": "!刮刮乐",
          "fixed3": "!刮刮乐"
        },
        "separator": "\n"
      },
      {
        "key": "bot.commands.scratchStockSlash.2bb7b4bee",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.commands.scratchStockSlash.a9be09e72",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/commands/scratchStockSlash.ts:51"
  },
  {
    "id": "bot:profile-updated:true",
    "kind": "message",
    "titleKey": "bot.sqlNotifications.profileBody",
    "keys": [
      "bot.sqlNotifications.profileTitle",
      "bot.sqlNotifications.profileBody"
    ],
    "parts": [
      {
        "text": "**",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.sqlNotifications.profileTitle",
        "role": "title",
        "separator": ""
      },
      {
        "text": "**",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.sqlNotifications.profileBody",
        "role": "text",
        "separator": "\n\n"
      }
    ],
    "source": "src/services/peiwanWatcher.ts:98"
  },
  {
    "id": "bot:profile-updated:false",
    "kind": "message",
    "titleKey": "bot.sqlNotifications.profileBodyUnknown",
    "keys": [
      "bot.sqlNotifications.profileTitle",
      "bot.sqlNotifications.profileBodyUnknown"
    ],
    "parts": [
      {
        "text": "**",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.sqlNotifications.profileTitle",
        "role": "title",
        "separator": ""
      },
      {
        "text": "**",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.sqlNotifications.profileBodyUnknown",
        "role": "text",
        "separator": "\n\n"
      }
    ],
    "source": "src/services/peiwanWatcher.ts:98"
  },
  {
    "id": "bot:quick-order:REALNAME",
    "kind": "card",
    "titleKey": "bot.events.messageCreate.b97524625",
    "keys": [
      "bot.events.messageCreate.99a068982",
      "bot.events.messageCreate.e45819b14",
      "bot.events.messageCreate.64122ddd4",
      "bot.events.messageCreate.1d69ca7a9",
      "bot.events.messageCreate.ff2f178ea",
      "bot.events.messageCreate.b97524625",
      "bot.events.messageCreate.db3527178",
      "bot.ui.orderEmbeds.1ee2a4024",
      "bot.ui.orderEmbeds.quotationQ1",
      "bot.ui.orderEmbeds.quotationQ2",
      "bot.ui.orderEmbeds.quotationQ3",
      "bot.ui.orderEmbeds.quotationQ4",
      "bot.ui.orderEmbeds.quotationQ5",
      "bot.ui.orderEmbeds.quotationQ6",
      "bot.ui.orderEmbeds.quotationQ7",
      "bot.ui.orderEmbeds.quotationQ8",
      "bot.ui.orderEmbeds.quotationQ9",
      "bot.ui.orderEmbeds.quotationQ10"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.99a068982",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.events.messageCreate.e45819b14",
        "role": "title",
        "separator": "\n"
      },
      {
        "key": "bot.events.messageCreate.64122ddd4",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.events.messageCreate.1d69ca7a9",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{PEIWANID} <@{discordUserId}>",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.events.messageCreate.ff2f178ea",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.events.messageCreate.b97524625",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.events.messageCreate.db3527178",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{orderContent}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.1ee2a4024",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ1",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ2",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ3",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ4",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ5",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ6",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ7",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ8",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ9",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ10",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      }
    ],
    "source": "src/events/messageCreate.ts:502"
  },
  {
    "id": "bot:quick-order:ANON",
    "kind": "card",
    "titleKey": "bot.events.messageCreate.3204c059f",
    "keys": [
      "bot.events.messageCreate.99a068982",
      "bot.events.messageCreate.e45819b14",
      "bot.events.messageCreate.64122ddd4",
      "bot.events.messageCreate.1d69ca7a9",
      "bot.events.messageCreate.ff2f178ea",
      "bot.events.messageCreate.3204c059f",
      "bot.events.messageCreate.db3527178",
      "bot.ui.orderEmbeds.54564c64f",
      "bot.ui.orderEmbeds.quotationQ1",
      "bot.ui.orderEmbeds.quotationQ2",
      "bot.ui.orderEmbeds.quotationQ3",
      "bot.ui.orderEmbeds.quotationQ4",
      "bot.ui.orderEmbeds.quotationQ5",
      "bot.ui.orderEmbeds.quotationQ6",
      "bot.ui.orderEmbeds.quotationQ7",
      "bot.ui.orderEmbeds.quotationQ8",
      "bot.ui.orderEmbeds.quotationQ9",
      "bot.ui.orderEmbeds.quotationQ10"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.99a068982",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.events.messageCreate.e45819b14",
        "role": "title",
        "separator": "\n"
      },
      {
        "key": "bot.events.messageCreate.64122ddd4",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.events.messageCreate.1d69ca7a9",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{PEIWANID} <@{discordUserId}>",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.events.messageCreate.ff2f178ea",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.events.messageCreate.3204c059f",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.events.messageCreate.db3527178",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{orderContent}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.54564c64f",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ1",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ2",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ3",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ4",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ5",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ6",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ7",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ8",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ9",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ10",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      }
    ],
    "source": "src/events/messageCreate.ts:502"
  },
  {
    "id": "bot:assistant:order-price",
    "kind": "card",
    "titleKey": "bot.assistant.orderActions.c2bc55539",
    "keys": [
      "bot.assistant.orderActions.782169a27",
      "bot.assistant.orderActions.c2bc55539",
      "bot.assistant.orderActions.60564d111",
      "bot.assistant.orderActions.6eb3984b3",
      "bot.assistant.orderActions.5c8d7081c",
      "bot.assistant.orderActions.186688b35",
      "bot.assistant.orderActions.cde10f7e8",
      "bot.ui.orderEmbeds.54564c64f",
      "bot.ui.orderEmbeds.quotationQ1",
      "bot.ui.orderEmbeds.quotationQ2",
      "bot.ui.orderEmbeds.quotationQ3",
      "bot.ui.orderEmbeds.quotationQ4",
      "bot.ui.orderEmbeds.quotationQ5",
      "bot.ui.orderEmbeds.quotationQ6",
      "bot.ui.orderEmbeds.quotationQ7",
      "bot.ui.orderEmbeds.quotationQ8",
      "bot.ui.orderEmbeds.quotationQ9",
      "bot.ui.orderEmbeds.quotationQ10"
    ],
    "parts": [
      {
        "key": "bot.assistant.orderActions.782169a27",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.assistant.orderActions.c2bc55539",
        "role": "title",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.orderActions.60564d111",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.orderActions.6eb3984b3",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{PEIWANID} <@{discordUserId}>",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.orderActions.5c8d7081c",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.orderActions.186688b35",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.orderActions.cde10f7e8",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{orderContent}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.54564c64f",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ1",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ2",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ3",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ4",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ5",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ6",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ7",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ8",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ9",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.ui.orderEmbeds.quotationQ10",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "：¥{price}",
        "role": "text",
        "separator": ""
      }
    ],
    "source": "src/assistant/orderActions.ts:340"
  },
  {
    "id": "bot:chat-drop:true",
    "kind": "card",
    "titleKey": "bot.services.chatVoucherDropService.2488b2675",
    "keys": [
      "bot.services.chatVoucherDropService.3a5ea6ffa",
      "bot.services.chatVoucherDropService.2488b2675",
      "bot.services.chatVoucherDropService.e2d78a189"
    ],
    "parts": [
      {
        "key": "bot.services.chatVoucherDropService.3a5ea6ffa",
        "role": "title",
        "examples": {
          "CHAT_VOUCHER_EMOJI": "<a:chatVoucherEmoji:1552516040494284840>"
        },
        "separator": ""
      },
      {
        "key": "bot.services.chatVoucherDropService.2488b2675",
        "role": "text",
        "examples": {
          "CHAT_VOUCHER_EMOJI": "<a:chatVoucherEmoji:1552516040494284840>"
        },
        "separator": "\n"
      },
      {
        "key": "bot.services.chatVoucherDropService.e2d78a189",
        "role": "footer",
        "separator": "\n"
      }
    ],
    "source": "src/services/chatVoucherDropService.ts:368"
  },
  {
    "id": "bot:chat-drop:false",
    "kind": "card",
    "titleKey": "bot.services.chatVoucherDropService.f3f4def85",
    "keys": [
      "bot.services.chatVoucherDropService.3a5ea6ffa",
      "bot.services.chatVoucherDropService.f3f4def85",
      "bot.services.chatVoucherDropService.e3e95de77"
    ],
    "parts": [
      {
        "key": "bot.services.chatVoucherDropService.3a5ea6ffa",
        "role": "title",
        "examples": {
          "CHAT_VOUCHER_EMOJI": "<a:chatVoucherEmoji:1552516040494284840>"
        },
        "separator": ""
      },
      {
        "key": "bot.services.chatVoucherDropService.f3f4def85",
        "role": "text",
        "examples": {
          "CHAT_VOUCHER_EMOJI": "<a:chatVoucherEmoji:1552516040494284840>",
          "fixed3": "1"
        },
        "separator": "\n"
      },
      {
        "key": "bot.services.chatVoucherDropService.e3e95de77",
        "role": "footer",
        "separator": "\n"
      }
    ],
    "source": "src/services/chatVoucherDropService.ts:368"
  },
  {
    "id": "bot:mini-dispatch:true",
    "kind": "card",
    "titleKey": "bot.server.internalWebhookServer.ca2661551",
    "keys": [
      "bot.server.internalWebhookServer.45c45a3b0",
      "bot.server.internalWebhookServer.21c121933",
      "bot.server.internalWebhookServer.ca2661551",
      "bot.server.internalWebhookServer.7389faadc",
      "bot.server.internalWebhookServer.a6b50f4d2",
      "bot.server.internalWebhookServer.6b57e39cd",
      "bot.server.internalWebhookServer.58ebd9659",
      "bot.server.internalWebhookServer.b392f8f1b"
    ],
    "parts": [
      {
        "text": "{mentionContent}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.server.internalWebhookServer.45c45a3b0",
        "role": "title",
        "separator": "\n"
      },
      {
        "text": "{requirement}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.21c121933",
        "role": "label",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.ca2661551",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.7389faadc",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{sex}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.a6b50f4d2",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{game}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.6b57e39cd",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{tags}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.58ebd9659",
        "role": "footer",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.b392f8f1b",
        "role": "button",
        "examples": {
          "fixed1": "0"
        },
        "separator": "\n"
      }
    ],
    "source": "src/server/internalWebhookServer.ts:454"
  },
  {
    "id": "bot:mini-dispatch:false",
    "kind": "card",
    "titleKey": "bot.server.internalWebhookServer.45c45a3b0",
    "keys": [
      "bot.server.internalWebhookServer.45c45a3b0",
      "bot.server.internalWebhookServer.21c121933",
      "bot.server.internalWebhookServer.7389faadc",
      "bot.server.internalWebhookServer.a6b50f4d2",
      "bot.server.internalWebhookServer.6b57e39cd",
      "bot.server.internalWebhookServer.58ebd9659",
      "bot.server.internalWebhookServer.b392f8f1b"
    ],
    "parts": [
      {
        "text": "{mentionContent}",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.server.internalWebhookServer.45c45a3b0",
        "role": "title",
        "separator": "\n"
      },
      {
        "text": "{requirement}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.21c121933",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{ownerDisplayName}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.7389faadc",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{sex}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.a6b50f4d2",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{game}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.6b57e39cd",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{tags}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.58ebd9659",
        "role": "footer",
        "separator": "\n"
      },
      {
        "key": "bot.server.internalWebhookServer.b392f8f1b",
        "role": "button",
        "examples": {
          "fixed1": "0"
        },
        "separator": "\n"
      }
    ],
    "source": "src/server/internalWebhookServer.ts:454"
  },
  {
    "id": "bot:anonymous-log:events.messageCreate",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.6702e0f5e",
    "keys": [
      "bot.events.messageCreate.6702e0f5e",
      "bot.events.messageCreate.77c2455d2",
      "bot.events.messageCreate.f137616bb",
      "bot.events.messageCreate.32de6c413"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.6702e0f5e",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.events.messageCreate.77c2455d2",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.events.messageCreate.f137616bb",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.events.messageCreate.32de6c413",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/events/messageCreate.ts:823"
  },
  {
    "id": "bot:anonymous-log:assistant.orderActions",
    "kind": "message",
    "titleKey": "bot.assistant.orderActions.15af82fa8",
    "keys": [
      "bot.assistant.orderActions.15af82fa8",
      "bot.assistant.orderActions.947908f9c",
      "bot.assistant.orderActions.f24a99efd",
      "bot.assistant.orderActions.0ae694e44"
    ],
    "parts": [
      {
        "key": "bot.assistant.orderActions.15af82fa8",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.assistant.orderActions.947908f9c",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.orderActions.f24a99efd",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.orderActions.0ae694e44",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/orderActions.ts:264"
  },
  {
    "id": "bot:anonymous-log:interactions.buttons.orderPriceSelect",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.679ef5db5",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.679ef5db5",
      "bot.interactions.buttons.orderPriceSelect.deea94906",
      "bot.interactions.buttons.orderPriceSelect.b71cbe0a9",
      "bot.interactions.buttons.orderPriceSelect.f4fc629ac",
      "bot.interactions.buttons.orderPriceSelect.aa4508601",
      "bot.interactions.buttons.orderPriceSelect.74fd8b49f"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.679ef5db5",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.interactions.buttons.orderPriceSelect.deea94906",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.interactions.buttons.orderPriceSelect.b71cbe0a9",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.interactions.buttons.orderPriceSelect.f4fc629ac",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.interactions.buttons.orderPriceSelect.aa4508601",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.interactions.buttons.orderPriceSelect.74fd8b49f",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:394"
  },
  {
    "id": "bot:audition:buildInviteSentEmbed",
    "kind": "card",
    "titleKey": "bot.services.auditionService.e73179cb3",
    "keys": [
      "bot.services.auditionService.e73179cb3",
      "bot.services.auditionService.1ed343e2e",
      "bot.services.auditionService.6fd6b82f4"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.e73179cb3",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.1ed343e2e",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.6fd6b82f4",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:101"
  },
  {
    "id": "bot:audition:buildBossAcceptedRoomEmbed",
    "kind": "card",
    "titleKey": "bot.services.auditionService.6100f5022",
    "keys": [
      "bot.services.auditionService.6100f5022",
      "bot.services.auditionService.db9b4d810",
      "bot.services.auditionService.6fd6b82f4"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.6100f5022",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.db9b4d810",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.6fd6b82f4",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:178"
  },
  {
    "id": "bot:audition:buildWorkerAcceptedRoomEmbed",
    "kind": "card",
    "titleKey": "bot.services.auditionService.160d89563",
    "keys": [
      "bot.services.auditionService.160d89563",
      "bot.services.auditionService.95f94a6ea"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.160d89563",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.95f94a6ea",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:192"
  },
  {
    "id": "bot:audition:buildBossSuccessEmbed",
    "kind": "card",
    "titleKey": "bot.services.auditionService.e16155cce",
    "keys": [
      "bot.services.auditionService.e16155cce",
      "bot.services.auditionService.f01e0d283"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.e16155cce",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.f01e0d283",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:200"
  },
  {
    "id": "bot:audition:buildWorkerSuccessEmbed",
    "kind": "card",
    "titleKey": "bot.services.auditionService.301b10aef",
    "keys": [
      "bot.services.auditionService.301b10aef",
      "bot.services.auditionService.f345876af"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.301b10aef",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.f345876af",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:213"
  },
  {
    "id": "bot:audition:invitation-state:23ee6f369",
    "kind": "card",
    "titleKey": "bot.services.auditionService.23ee6f369",
    "keys": [
      "bot.services.auditionService.4abd08523",
      "bot.services.auditionService.5fbc7dd65",
      "bot.services.auditionService.b2976253d",
      "bot.services.auditionService.3d20c22e3",
      "bot.services.auditionService.3fca989f6",
      "bot.services.auditionService.23ee6f369"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.4abd08523",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.5fbc7dd65",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.b2976253d",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3d20c22e3",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3fca989f6",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.23ee6f369",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:66"
  },
  {
    "id": "bot:audition:invitation-state:ab0bec0bc",
    "kind": "card",
    "titleKey": "bot.services.auditionService.ab0bec0bc",
    "keys": [
      "bot.services.auditionService.4abd08523",
      "bot.services.auditionService.5fbc7dd65",
      "bot.services.auditionService.b2976253d",
      "bot.services.auditionService.3d20c22e3",
      "bot.services.auditionService.3fca989f6",
      "bot.services.auditionService.ab0bec0bc"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.4abd08523",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.5fbc7dd65",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.b2976253d",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3d20c22e3",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3fca989f6",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.ab0bec0bc",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:66"
  },
  {
    "id": "bot:audition:invitation-state:a2fba5d22",
    "kind": "card",
    "titleKey": "bot.services.auditionService.a2fba5d22",
    "keys": [
      "bot.services.auditionService.4abd08523",
      "bot.services.auditionService.5fbc7dd65",
      "bot.services.auditionService.b2976253d",
      "bot.services.auditionService.3d20c22e3",
      "bot.services.auditionService.3fca989f6",
      "bot.services.auditionService.a2fba5d22"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.4abd08523",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.5fbc7dd65",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.b2976253d",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3d20c22e3",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3fca989f6",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.a2fba5d22",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:66"
  },
  {
    "id": "bot:audition:invitation-state:e16155cce",
    "kind": "card",
    "titleKey": "bot.services.auditionService.e16155cce",
    "keys": [
      "bot.services.auditionService.4abd08523",
      "bot.services.auditionService.5fbc7dd65",
      "bot.services.auditionService.b2976253d",
      "bot.services.auditionService.3d20c22e3",
      "bot.services.auditionService.3fca989f6",
      "bot.services.auditionService.e16155cce"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.4abd08523",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.5fbc7dd65",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.b2976253d",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3d20c22e3",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3fca989f6",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.e16155cce",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:66"
  },
  {
    "id": "bot:audition:invitation-state:9f74c4d0d",
    "kind": "card",
    "titleKey": "bot.services.auditionService.9f74c4d0d",
    "keys": [
      "bot.services.auditionService.4abd08523",
      "bot.services.auditionService.5fbc7dd65",
      "bot.services.auditionService.b2976253d",
      "bot.services.auditionService.3d20c22e3",
      "bot.services.auditionService.3fca989f6",
      "bot.services.auditionService.9f74c4d0d"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.4abd08523",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.5fbc7dd65",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.b2976253d",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3d20c22e3",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3fca989f6",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.9f74c4d0d",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:66"
  },
  {
    "id": "bot:audition:invitation-state:984e7a2cf",
    "kind": "card",
    "titleKey": "bot.services.auditionService.984e7a2cf",
    "keys": [
      "bot.services.auditionService.4abd08523",
      "bot.services.auditionService.5fbc7dd65",
      "bot.services.auditionService.b2976253d",
      "bot.services.auditionService.3d20c22e3",
      "bot.services.auditionService.3fca989f6",
      "bot.services.auditionService.984e7a2cf"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.4abd08523",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.5fbc7dd65",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.b2976253d",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3d20c22e3",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3fca989f6",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.984e7a2cf",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:66"
  },
  {
    "id": "bot:audition:invitation-state:a2bdec810",
    "kind": "card",
    "titleKey": "bot.services.auditionService.a2bdec810",
    "keys": [
      "bot.services.auditionService.4abd08523",
      "bot.services.auditionService.5fbc7dd65",
      "bot.services.auditionService.b2976253d",
      "bot.services.auditionService.3d20c22e3",
      "bot.services.auditionService.3fca989f6",
      "bot.services.auditionService.a2bdec810"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.4abd08523",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.5fbc7dd65",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.b2976253d",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3d20c22e3",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3fca989f6",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.a2bdec810",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:66"
  },
  {
    "id": "bot:audition:invitation-state:5b6c45789",
    "kind": "card",
    "titleKey": "bot.services.auditionService.5b6c45789",
    "keys": [
      "bot.services.auditionService.4abd08523",
      "bot.services.auditionService.5fbc7dd65",
      "bot.services.auditionService.b2976253d",
      "bot.services.auditionService.3d20c22e3",
      "bot.services.auditionService.3fca989f6",
      "bot.services.auditionService.5b6c45789"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.4abd08523",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.auditionService.5fbc7dd65",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.b2976253d",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3d20c22e3",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.3fca989f6",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.services.auditionService.5b6c45789",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/auditionService.ts:66"
  },
  {
    "id": "bot:fusion:success",
    "kind": "card",
    "titleKey": "bot.commands.lotteryFusionSlash.b498eef71",
    "keys": [
      "bot.commands.lotteryFusionSlash.b498eef71",
      "bot.services.lotteryFusionNotificationService.aa463d1b8",
      "bot.commands.lotteryFusionSlash.9c806e8d3",
      "bot.commands.lotteryFusionSlash.ad3f374b2",
      "bot.commands.lotteryFusionSlash.d05e18948"
    ],
    "parts": [
      {
        "key": "bot.commands.lotteryFusionSlash.b498eef71",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.lotteryFusionNotificationService.aa463d1b8",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.9c806e8d3",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{prizeName}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.ad3f374b2",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{poolLabel}",
        "role": "text",
        "separator": "\n"
      },
      {
        "key": "bot.commands.lotteryFusionSlash.d05e18948",
        "role": "label",
        "separator": "\n"
      },
      {
        "text": "{expiresAt}",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/commands/lotteryFusionSlash.ts:329"
  },
  {
    "id": "bot:fusion:success-dm",
    "kind": "card",
    "titleKey": "bot.services.lotteryFusionNotificationService.7a3301104",
    "keys": [
      "bot.services.lotteryFusionNotificationService.7a3301104",
      "bot.services.lotteryFusionNotificationService.aa463d1b8"
    ],
    "parts": [
      {
        "key": "bot.services.lotteryFusionNotificationService.7a3301104",
        "role": "title",
        "separator": ""
      },
      {
        "key": "bot.services.lotteryFusionNotificationService.aa463d1b8",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/lotteryFusionNotificationService.ts:24"
  },
  {
    "id": "bot:keyword-audit:pending",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.26a5c505a",
    "keys": [
      "bot.services.redEnvelopeService.26a5c505a",
      "bot.services.redEnvelopeService.aa5653c79",
      "bot.services.redEnvelopeService.7b09393a3"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.26a5c505a",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.redEnvelopeService.aa5653c79",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.7b09393a3",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1548"
  },
  {
    "id": "bot:keyword-audit:approved",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.9ac89b234",
    "keys": [
      "bot.services.redEnvelopeService.26a5c505a",
      "bot.services.redEnvelopeService.9ac89b234",
      "bot.services.redEnvelopeService.7b09393a3"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.26a5c505a",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.redEnvelopeService.9ac89b234",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.7b09393a3",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1548"
  },
  {
    "id": "bot:keyword-audit:rejected",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.a7ed91d7d",
    "keys": [
      "bot.services.redEnvelopeService.26a5c505a",
      "bot.services.redEnvelopeService.aa5653c79",
      "bot.services.redEnvelopeService.a7ed91d7d"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.26a5c505a",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.services.redEnvelopeService.aa5653c79",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.services.redEnvelopeService.a7ed91d7d",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1548"
  },
  {
    "id": "bot:keyword-auditor:dm",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.a0f18987d",
    "keys": [
      "bot.services.redEnvelopeService.a0f18987d",
      "bot.services.redEnvelopeService.38407c320"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.a0f18987d",
        "role": "text",
        "separator": "",
        "examples": {
          "suffix": ""
        }
      },
      {
        "key": "bot.services.redEnvelopeService.38407c320",
        "role": "text",
        "separator": ""
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1435"
  },
  {
    "id": "bot:leaderboard:spend:0:false",
    "kind": "card",
    "titleKey": "bot.services.leaderboardService.92242509c",
    "keys": [
      "bot.services.leaderboardService.92242509c",
      "bot.services.leaderboardService.4d9226270"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.92242509c",
        "role": "title",
        "examples": {
          "redCrown": "<a:513:1552516024425910272>",
          "redCrown2": "<a:513:1552516024425910272>"
        },
        "separator": ""
      },
      {
        "key": "bot.services.leaderboardService.4d9226270",
        "role": "text",
        "separator": "\n\n"
      },
      {
        "text": "{remainingRanks}",
        "role": "text",
        "separator": "\n\n"
      }
    ],
    "source": "src/services/leaderboardService.ts:469"
  },
  {
    "id": "bot:leaderboard:spend:0:true",
    "kind": "card",
    "titleKey": "bot.services.leaderboardService.92242509c",
    "keys": [
      "bot.services.leaderboardService.92242509c",
      "bot.services.leaderboardService.0794e9f30"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.92242509c",
        "role": "title",
        "examples": {
          "redCrown": "<a:513:1552516024425910272>",
          "redCrown2": "<a:513:1552516024425910272>"
        },
        "separator": ""
      },
      {
        "key": "bot.services.leaderboardService.0794e9f30",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/leaderboardService.ts:469"
  },
  {
    "id": "bot:leaderboard:spend:1:false",
    "kind": "card",
    "titleKey": "bot.services.leaderboardService.556428823",
    "keys": [
      "bot.services.leaderboardService.556428823",
      "bot.services.leaderboardService.4d9226270"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.556428823",
        "role": "title",
        "examples": {
          "redCrown": "<a:513:1552516024425910272>",
          "redCrown2": "<a:513:1552516024425910272>"
        },
        "separator": ""
      },
      {
        "key": "bot.services.leaderboardService.4d9226270",
        "role": "text",
        "separator": "\n\n"
      },
      {
        "text": "{remainingRanks}",
        "role": "text",
        "separator": "\n\n"
      }
    ],
    "source": "src/services/leaderboardService.ts:469"
  },
  {
    "id": "bot:leaderboard:spend:1:true",
    "kind": "card",
    "titleKey": "bot.services.leaderboardService.556428823",
    "keys": [
      "bot.services.leaderboardService.556428823",
      "bot.services.leaderboardService.0794e9f30"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.556428823",
        "role": "title",
        "examples": {
          "redCrown": "<a:513:1552516024425910272>",
          "redCrown2": "<a:513:1552516024425910272>"
        },
        "separator": ""
      },
      {
        "key": "bot.services.leaderboardService.0794e9f30",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/leaderboardService.ts:469"
  },
  {
    "id": "bot:leaderboard:spend:2:false",
    "kind": "card",
    "titleKey": "bot.services.leaderboardService.3f9e1ed30",
    "keys": [
      "bot.services.leaderboardService.3f9e1ed30",
      "bot.services.leaderboardService.4d9226270"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.3f9e1ed30",
        "role": "title",
        "examples": {
          "redCrown": "<a:513:1552516024425910272>",
          "redCrown2": "<a:513:1552516024425910272>"
        },
        "separator": ""
      },
      {
        "key": "bot.services.leaderboardService.4d9226270",
        "role": "text",
        "separator": "\n\n"
      },
      {
        "text": "{remainingRanks}",
        "role": "text",
        "separator": "\n\n"
      }
    ],
    "source": "src/services/leaderboardService.ts:469"
  },
  {
    "id": "bot:leaderboard:spend:2:true",
    "kind": "card",
    "titleKey": "bot.services.leaderboardService.3f9e1ed30",
    "keys": [
      "bot.services.leaderboardService.3f9e1ed30",
      "bot.services.leaderboardService.0794e9f30"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.3f9e1ed30",
        "role": "title",
        "examples": {
          "redCrown": "<a:513:1552516024425910272>",
          "redCrown2": "<a:513:1552516024425910272>"
        },
        "separator": ""
      },
      {
        "key": "bot.services.leaderboardService.0794e9f30",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/leaderboardService.ts:469"
  },
  {
    "id": "bot:leaderboard:income:0:false",
    "kind": "card",
    "titleKey": "bot.services.leaderboardService.32b2b8fa0",
    "keys": [
      "bot.services.leaderboardService.32b2b8fa0"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.32b2b8fa0",
        "role": "title",
        "examples": {
          "crown": "<a:55:1552516019531030568>",
          "crown2": "<a:55:1552516019531030568>"
        },
        "separator": ""
      },
      {
        "text": "**{prefix} 第1名： {displayName} {mention}{amount}**\n\n{remainingRanks}",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/leaderboardService.ts:469"
  },
  {
    "id": "bot:leaderboard:income:0:true",
    "kind": "card",
    "titleKey": "bot.services.leaderboardService.32b2b8fa0",
    "keys": [
      "bot.services.leaderboardService.32b2b8fa0",
      "bot.services.leaderboardService.0794e9f30"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.32b2b8fa0",
        "role": "title",
        "examples": {
          "crown": "<a:55:1552516019531030568>",
          "crown2": "<a:55:1552516019531030568>"
        },
        "separator": ""
      },
      {
        "key": "bot.services.leaderboardService.0794e9f30",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/leaderboardService.ts:469"
  },
  {
    "id": "bot:leaderboard:income:1:false",
    "kind": "card",
    "titleKey": "bot.services.leaderboardService.eccb831ba",
    "keys": [
      "bot.services.leaderboardService.eccb831ba"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.eccb831ba",
        "role": "title",
        "examples": {
          "crown": "<a:55:1552516019531030568>",
          "crown2": "<a:55:1552516019531030568>"
        },
        "separator": ""
      },
      {
        "text": "**{prefix} 第1名： {displayName} {mention}{amount}**\n\n{remainingRanks}",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/leaderboardService.ts:469"
  },
  {
    "id": "bot:leaderboard:income:1:true",
    "kind": "card",
    "titleKey": "bot.services.leaderboardService.eccb831ba",
    "keys": [
      "bot.services.leaderboardService.eccb831ba",
      "bot.services.leaderboardService.0794e9f30"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.eccb831ba",
        "role": "title",
        "examples": {
          "crown": "<a:55:1552516019531030568>",
          "crown2": "<a:55:1552516019531030568>"
        },
        "separator": ""
      },
      {
        "key": "bot.services.leaderboardService.0794e9f30",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/leaderboardService.ts:469"
  },
  {
    "id": "bot:leaderboard:income:2:false",
    "kind": "card",
    "titleKey": "bot.services.leaderboardService.25964e06e",
    "keys": [
      "bot.services.leaderboardService.25964e06e"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.25964e06e",
        "role": "title",
        "examples": {
          "crown": "<a:55:1552516019531030568>",
          "crown2": "<a:55:1552516019531030568>"
        },
        "separator": ""
      },
      {
        "text": "**{prefix} 第1名： {displayName} {mention}{amount}**\n\n{remainingRanks}",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/leaderboardService.ts:469"
  },
  {
    "id": "bot:leaderboard:income:2:true",
    "kind": "card",
    "titleKey": "bot.services.leaderboardService.25964e06e",
    "keys": [
      "bot.services.leaderboardService.25964e06e",
      "bot.services.leaderboardService.0794e9f30"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.25964e06e",
        "role": "title",
        "examples": {
          "crown": "<a:55:1552516019531030568>",
          "crown2": "<a:55:1552516019531030568>"
        },
        "separator": ""
      },
      {
        "key": "bot.services.leaderboardService.0794e9f30",
        "role": "text",
        "separator": "\n"
      }
    ],
    "source": "src/services/leaderboardService.ts:469"
  },
  {
    "id": "bot:assistant-confirm:bot.assistant.planner.f495ee3ce",
    "kind": "message",
    "titleKey": "bot.assistant.planner.f495ee3ce",
    "keys": [
      "bot.assistant.planner.f495ee3ce",
      "bot.assistant.confirmButtons.46cc763b0",
      "bot.assistant.confirmButtons.b36ade4fc"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.f495ee3ce",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.assistant.confirmButtons.46cc763b0",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.confirmButtons.b36ade4fc",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:41"
  },
  {
    "id": "bot:assistant-confirm:bot.assistant.planner.a1855a709",
    "kind": "message",
    "titleKey": "bot.assistant.planner.a1855a709",
    "keys": [
      "bot.assistant.planner.a1855a709",
      "bot.assistant.confirmButtons.46cc763b0",
      "bot.assistant.confirmButtons.b36ade4fc"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.a1855a709",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.assistant.confirmButtons.46cc763b0",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.confirmButtons.b36ade4fc",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:41"
  },
  {
    "id": "bot:assistant-confirm:bot.assistant.planner.03bc7da94",
    "kind": "message",
    "titleKey": "bot.assistant.planner.03bc7da94",
    "keys": [
      "bot.assistant.planner.03bc7da94",
      "bot.assistant.confirmButtons.46cc763b0",
      "bot.assistant.confirmButtons.b36ade4fc"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.03bc7da94",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.assistant.confirmButtons.46cc763b0",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.confirmButtons.b36ade4fc",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:41"
  },
  {
    "id": "bot:assistant-confirm:bot.assistant.planner.209e99aef",
    "kind": "message",
    "titleKey": "bot.assistant.planner.209e99aef",
    "keys": [
      "bot.assistant.planner.209e99aef",
      "bot.assistant.confirmButtons.46cc763b0",
      "bot.assistant.confirmButtons.b36ade4fc"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.209e99aef",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.assistant.confirmButtons.46cc763b0",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.confirmButtons.b36ade4fc",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:41"
  },
  {
    "id": "bot:assistant-confirm:bot.assistant.planner.1ede2ae91",
    "kind": "message",
    "titleKey": "bot.assistant.planner.1ede2ae91",
    "keys": [
      "bot.assistant.planner.1ede2ae91",
      "bot.assistant.confirmButtons.46cc763b0",
      "bot.assistant.confirmButtons.b36ade4fc"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.1ede2ae91",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.assistant.confirmButtons.46cc763b0",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.confirmButtons.b36ade4fc",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:41"
  },
  {
    "id": "bot:assistant-confirm:bot.assistant.confirmButtons.8b5dcbf28",
    "kind": "message",
    "titleKey": "bot.assistant.confirmButtons.8b5dcbf28",
    "keys": [
      "bot.assistant.confirmButtons.8b5dcbf28",
      "bot.assistant.confirmButtons.46cc763b0",
      "bot.assistant.confirmButtons.b36ade4fc"
    ],
    "parts": [
      {
        "key": "bot.assistant.confirmButtons.8b5dcbf28",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.assistant.confirmButtons.46cc763b0",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.confirmButtons.b36ade4fc",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:41"
  },
  {
    "id": "bot:assistant-confirm:bot.assistant.confirmButtons.d29a86b7b",
    "kind": "message",
    "titleKey": "bot.assistant.confirmButtons.d29a86b7b",
    "keys": [
      "bot.assistant.confirmButtons.d29a86b7b",
      "bot.assistant.confirmButtons.46cc763b0",
      "bot.assistant.confirmButtons.b36ade4fc"
    ],
    "parts": [
      {
        "key": "bot.assistant.confirmButtons.d29a86b7b",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.assistant.confirmButtons.46cc763b0",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.confirmButtons.b36ade4fc",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:41"
  },
  {
    "id": "bot:assistant-confirm:bot.assistant.confirmButtons.caf7f1cca",
    "kind": "message",
    "titleKey": "bot.assistant.confirmButtons.caf7f1cca",
    "keys": [
      "bot.assistant.confirmButtons.caf7f1cca",
      "bot.assistant.confirmButtons.46cc763b0",
      "bot.assistant.confirmButtons.b36ade4fc"
    ],
    "parts": [
      {
        "key": "bot.assistant.confirmButtons.caf7f1cca",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.assistant.confirmButtons.46cc763b0",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.confirmButtons.b36ade4fc",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:41"
  },
  {
    "id": "bot:assistant-confirm:bot.assistant.confirmButtons.f88b55a2c",
    "kind": "message",
    "titleKey": "bot.assistant.confirmButtons.f88b55a2c",
    "keys": [
      "bot.assistant.confirmButtons.f88b55a2c",
      "bot.assistant.confirmButtons.46cc763b0",
      "bot.assistant.confirmButtons.b36ade4fc"
    ],
    "parts": [
      {
        "key": "bot.assistant.confirmButtons.f88b55a2c",
        "role": "text",
        "separator": ""
      },
      {
        "key": "bot.assistant.confirmButtons.46cc763b0",
        "role": "button",
        "separator": "\n"
      },
      {
        "key": "bot.assistant.confirmButtons.b36ade4fc",
        "role": "button",
        "separator": "\n"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:41"
  },
  {
    "id": "bot:message:services.recruitmentApplicationService.db774ad4c",
    "kind": "message",
    "titleKey": "bot.services.recruitmentApplicationService.db774ad4c",
    "keys": [
      "bot.services.recruitmentApplicationService.db774ad4c"
    ],
    "parts": [
      {
        "key": "bot.services.recruitmentApplicationService.db774ad4c",
        "role": "text"
      }
    ],
    "source": "src/services/recruitmentApplicationService.ts:50"
  },
  {
    "id": "bot:message:services.orderInteractionManager.25ba43eb1",
    "kind": "message",
    "titleKey": "bot.services.orderInteractionManager.25ba43eb1",
    "keys": [
      "bot.services.orderInteractionManager.25ba43eb1"
    ],
    "parts": [
      {
        "key": "bot.services.orderInteractionManager.25ba43eb1",
        "role": "text"
      }
    ],
    "source": "src/services/orderInteractionManager.ts:34"
  },
  {
    "id": "bot:message:services.orderInteractionManager.6fbcb4497",
    "kind": "message",
    "titleKey": "bot.services.orderInteractionManager.6fbcb4497",
    "keys": [
      "bot.services.orderInteractionManager.6fbcb4497"
    ],
    "parts": [
      {
        "key": "bot.services.orderInteractionManager.6fbcb4497",
        "role": "text"
      }
    ],
    "source": "src/services/orderInteractionManager.ts:44"
  },
  {
    "id": "bot:message:services.orderInteractionManager.e2ef72f97",
    "kind": "message",
    "titleKey": "bot.services.orderInteractionManager.e2ef72f97",
    "keys": [
      "bot.services.orderInteractionManager.e2ef72f97"
    ],
    "parts": [
      {
        "key": "bot.services.orderInteractionManager.e2ef72f97",
        "role": "text"
      }
    ],
    "source": "src/services/orderInteractionManager.ts:250"
  },
  {
    "id": "bot:message:services.auditionService.8ea81866a",
    "kind": "message",
    "titleKey": "bot.services.auditionService.8ea81866a",
    "keys": [
      "bot.services.auditionService.8ea81866a"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.8ea81866a",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1471"
  },
  {
    "id": "bot:message:services.auditionService.a54132d00",
    "kind": "message",
    "titleKey": "bot.services.auditionService.a54132d00",
    "keys": [
      "bot.services.auditionService.a54132d00"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.a54132d00",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:90"
  },
  {
    "id": "bot:message:services.auditionService.fcd46f5fe",
    "kind": "message",
    "titleKey": "bot.services.auditionService.fcd46f5fe",
    "keys": [
      "bot.services.auditionService.fcd46f5fe"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.fcd46f5fe",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:92"
  },
  {
    "id": "bot:message:services.auditionService.efa9970ee",
    "kind": "message",
    "titleKey": "bot.services.auditionService.efa9970ee",
    "keys": [
      "bot.services.auditionService.efa9970ee"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.efa9970ee",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:170"
  },
  {
    "id": "bot:message:services.auditionService.363f55215",
    "kind": "message",
    "titleKey": "bot.services.auditionService.363f55215",
    "keys": [
      "bot.services.auditionService.363f55215"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.363f55215",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:159"
  },
  {
    "id": "bot:message:services.auditionService.66b0d97d0",
    "kind": "message",
    "titleKey": "bot.services.auditionService.66b0d97d0",
    "keys": [
      "bot.services.auditionService.66b0d97d0"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.66b0d97d0",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:159"
  },
  {
    "id": "bot:message:services.auditionService.ed93b0d89",
    "kind": "message",
    "titleKey": "bot.services.auditionService.ed93b0d89",
    "keys": [
      "bot.services.auditionService.ed93b0d89"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.ed93b0d89",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:165"
  },
  {
    "id": "bot:message:services.auditionService.f3e18e467",
    "kind": "message",
    "titleKey": "bot.services.auditionService.f3e18e467",
    "keys": [
      "bot.services.auditionService.f3e18e467"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.f3e18e467",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:175"
  },
  {
    "id": "bot:message:services.auditionService.2ca36b17d",
    "kind": "message",
    "titleKey": "bot.services.auditionService.2ca36b17d",
    "keys": [
      "bot.services.auditionService.2ca36b17d"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.2ca36b17d",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1286"
  },
  {
    "id": "bot:message:services.auditionService.c7f513914",
    "kind": "message",
    "titleKey": "bot.services.auditionService.c7f513914",
    "keys": [
      "bot.services.auditionService.c7f513914"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.c7f513914",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:160"
  },
  {
    "id": "bot:message:services.auditionService.20880606a",
    "kind": "message",
    "titleKey": "bot.services.auditionService.20880606a",
    "keys": [
      "bot.services.auditionService.20880606a"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.20880606a",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:222"
  },
  {
    "id": "bot:message:services.auditionService.0566eb130",
    "kind": "message",
    "titleKey": "bot.services.auditionService.0566eb130",
    "keys": [
      "bot.services.auditionService.0566eb130"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.0566eb130",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:894"
  },
  {
    "id": "bot:message:services.auditionService.1d3eea5a7",
    "kind": "message",
    "titleKey": "bot.services.auditionService.1d3eea5a7",
    "keys": [
      "bot.services.auditionService.1d3eea5a7"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.1d3eea5a7",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1472"
  },
  {
    "id": "bot:message:services.auditionService.1a1cf67aa",
    "kind": "message",
    "titleKey": "bot.services.auditionService.1a1cf67aa",
    "keys": [
      "bot.services.auditionService.1a1cf67aa"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.1a1cf67aa",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1006"
  },
  {
    "id": "bot:message:services.auditionService.c02422096",
    "kind": "message",
    "titleKey": "bot.services.auditionService.c02422096",
    "keys": [
      "bot.services.auditionService.c02422096"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.c02422096",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1015"
  },
  {
    "id": "bot:message:services.auditionService.e020ff152",
    "kind": "message",
    "titleKey": "bot.services.auditionService.e020ff152",
    "keys": [
      "bot.services.auditionService.e020ff152"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.e020ff152",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1028"
  },
  {
    "id": "bot:message:services.auditionService.9ed50a629",
    "kind": "message",
    "titleKey": "bot.services.auditionService.9ed50a629",
    "keys": [
      "bot.services.auditionService.9ed50a629"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.9ed50a629",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1035"
  },
  {
    "id": "bot:message:services.auditionService.c50ef6caa",
    "kind": "message",
    "titleKey": "bot.services.auditionService.c50ef6caa",
    "keys": [
      "bot.services.auditionService.c50ef6caa"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.c50ef6caa",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1141"
  },
  {
    "id": "bot:message:services.auditionService.392599096",
    "kind": "message",
    "titleKey": "bot.services.auditionService.392599096",
    "keys": [
      "bot.services.auditionService.392599096"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.392599096",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1145"
  },
  {
    "id": "bot:message:services.auditionService.8dc91db3b",
    "kind": "message",
    "titleKey": "bot.services.auditionService.8dc91db3b",
    "keys": [
      "bot.services.auditionService.8dc91db3b"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.8dc91db3b",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1149"
  },
  {
    "id": "bot:message:services.auditionService.6105b5bee",
    "kind": "message",
    "titleKey": "bot.services.auditionService.6105b5bee",
    "keys": [
      "bot.services.auditionService.6105b5bee"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.6105b5bee",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1166"
  },
  {
    "id": "bot:message:services.auditionService.77c66aebd",
    "kind": "message",
    "titleKey": "bot.services.auditionService.77c66aebd",
    "keys": [
      "bot.services.auditionService.77c66aebd"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.77c66aebd",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1195"
  },
  {
    "id": "bot:message:services.auditionService.cea1534d0",
    "kind": "message",
    "titleKey": "bot.services.auditionService.cea1534d0",
    "keys": [
      "bot.services.auditionService.cea1534d0"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.cea1534d0",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1212"
  },
  {
    "id": "bot:message:services.auditionService.1e1d6330b",
    "kind": "message",
    "titleKey": "bot.services.auditionService.1e1d6330b",
    "keys": [
      "bot.services.auditionService.1e1d6330b"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.1e1d6330b",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1242"
  },
  {
    "id": "bot:message:services.auditionService.c0c2b56a0",
    "kind": "message",
    "titleKey": "bot.services.auditionService.c0c2b56a0",
    "keys": [
      "bot.services.auditionService.c0c2b56a0"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.c0c2b56a0",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1246"
  },
  {
    "id": "bot:message:services.auditionService.f77c3d26d",
    "kind": "message",
    "titleKey": "bot.services.auditionService.f77c3d26d",
    "keys": [
      "bot.services.auditionService.f77c3d26d"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.f77c3d26d",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1401"
  },
  {
    "id": "bot:message:services.auditionService.0f6086752",
    "kind": "message",
    "titleKey": "bot.services.auditionService.0f6086752",
    "keys": [
      "bot.services.auditionService.0f6086752"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.0f6086752",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1418"
  },
  {
    "id": "bot:message:services.auditionService.e37cde8ed",
    "kind": "message",
    "titleKey": "bot.services.auditionService.e37cde8ed",
    "keys": [
      "bot.services.auditionService.e37cde8ed"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.e37cde8ed",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1425"
  },
  {
    "id": "bot:message:services.auditionService.0c4d86cf3",
    "kind": "message",
    "titleKey": "bot.services.auditionService.0c4d86cf3",
    "keys": [
      "bot.services.auditionService.0c4d86cf3"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.0c4d86cf3",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1464"
  },
  {
    "id": "bot:message:services.auditionService.2bcfb45f5",
    "kind": "message",
    "titleKey": "bot.services.auditionService.2bcfb45f5",
    "keys": [
      "bot.services.auditionService.2bcfb45f5"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.2bcfb45f5",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:116"
  },
  {
    "id": "bot:message:services.auditionService.2b92ae361",
    "kind": "message",
    "titleKey": "bot.services.auditionService.2b92ae361",
    "keys": [
      "bot.services.auditionService.2b92ae361"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.2b92ae361",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:117"
  },
  {
    "id": "bot:message:services.bossDisplay.7e1a9734a",
    "kind": "message",
    "titleKey": "bot.services.bossDisplay.7e1a9734a",
    "keys": [
      "bot.services.bossDisplay.7e1a9734a"
    ],
    "parts": [
      {
        "key": "bot.services.bossDisplay.7e1a9734a",
        "role": "text"
      }
    ],
    "source": "src/services/bossDisplay.ts:15"
  },
  {
    "id": "bot:message:services.bossDisplay.780adbc47",
    "kind": "message",
    "titleKey": "bot.services.bossDisplay.780adbc47",
    "keys": [
      "bot.services.bossDisplay.780adbc47"
    ],
    "parts": [
      {
        "key": "bot.services.bossDisplay.780adbc47",
        "role": "text"
      }
    ],
    "source": "src/services/bossDisplay.ts:23"
  },
  {
    "id": "bot:message:ui.orderEmbeds.792c05227",
    "kind": "message",
    "titleKey": "bot.ui.orderEmbeds.792c05227",
    "keys": [
      "bot.ui.orderEmbeds.792c05227"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.792c05227",
        "role": "text"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:494"
  },
  {
    "id": "bot:message:ui.orderEmbeds.1cb2ae258",
    "kind": "message",
    "titleKey": "bot.ui.orderEmbeds.1cb2ae258",
    "keys": [
      "bot.ui.orderEmbeds.1cb2ae258"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.1cb2ae258",
        "role": "text"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:490"
  },
  {
    "id": "bot:message:ui.orderEmbeds.33a177d27",
    "kind": "message",
    "titleKey": "bot.ui.orderEmbeds.33a177d27",
    "keys": [
      "bot.ui.orderEmbeds.33a177d27"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.33a177d27",
        "role": "text"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:700"
  },
  {
    "id": "bot:message:ui.orderEmbeds.2da55b56d",
    "kind": "message",
    "titleKey": "bot.ui.orderEmbeds.2da55b56d",
    "keys": [
      "bot.ui.orderEmbeds.2da55b56d"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.2da55b56d",
        "role": "text"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:763"
  },
  {
    "id": "bot:message:ui.orderEmbeds.d58c2a8db",
    "kind": "message",
    "titleKey": "bot.ui.orderEmbeds.d58c2a8db",
    "keys": [
      "bot.ui.orderEmbeds.d58c2a8db"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.d58c2a8db",
        "role": "text"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:286"
  },
  {
    "id": "bot:message:ui.orderEmbeds.c6b630ae5",
    "kind": "message",
    "titleKey": "bot.ui.orderEmbeds.c6b630ae5",
    "keys": [
      "bot.ui.orderEmbeds.c6b630ae5"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.c6b630ae5",
        "role": "text"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:318"
  },
  {
    "id": "bot:message:interactions.buttons.play.0ea1abcc6",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.play.0ea1abcc6",
    "keys": [
      "bot.interactions.buttons.play.0ea1abcc6"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.play.0ea1abcc6",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/play.ts:56"
  },
  {
    "id": "bot:message:interactions.buttons.play.efc75f28b",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.play.efc75f28b",
    "keys": [
      "bot.interactions.buttons.play.efc75f28b"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.play.efc75f28b",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/play.ts:65"
  },
  {
    "id": "bot:message:interactions.buttons.play.42789ff09",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.play.42789ff09",
    "keys": [
      "bot.interactions.buttons.play.42789ff09"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.play.42789ff09",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/play.ts:74"
  },
  {
    "id": "bot:message:interactions.buttons.play.6a1763fc8",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.play.6a1763fc8",
    "keys": [
      "bot.interactions.buttons.play.6a1763fc8"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.play.6a1763fc8",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/play.ts:83"
  },
  {
    "id": "bot:message:interactions.buttons.play.cf8ac9434",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.play.cf8ac9434",
    "keys": [
      "bot.interactions.buttons.play.cf8ac9434"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.play.cf8ac9434",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/play.ts:225"
  },
  {
    "id": "bot:message:interactions.buttons.miniDispatch.93674996e",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.miniDispatch.93674996e",
    "keys": [
      "bot.interactions.buttons.miniDispatch.93674996e"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.miniDispatch.93674996e",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/miniDispatch.ts:63"
  },
  {
    "id": "bot:message:services.publicErrorMessages.bed9f7c1b",
    "kind": "message",
    "titleKey": "bot.services.publicErrorMessages.bed9f7c1b",
    "keys": [
      "bot.services.publicErrorMessages.bed9f7c1b"
    ],
    "parts": [
      {
        "key": "bot.services.publicErrorMessages.bed9f7c1b",
        "role": "text"
      }
    ],
    "source": "src/services/publicErrorMessages.ts:23"
  },
  {
    "id": "bot:message:services.lotteryService.f8f0eba2a",
    "kind": "message",
    "titleKey": "bot.services.lotteryService.f8f0eba2a",
    "keys": [
      "bot.services.lotteryService.f8f0eba2a"
    ],
    "parts": [
      {
        "key": "bot.services.lotteryService.f8f0eba2a",
        "role": "text",
        "examples": {
          "fixed2": "1"
        }
      }
    ],
    "source": "src/services/lotteryService.ts:420"
  },
  {
    "id": "bot:message:services.lotteryService.b8cc5d1f8",
    "kind": "message",
    "titleKey": "bot.services.lotteryService.b8cc5d1f8",
    "keys": [
      "bot.services.lotteryService.b8cc5d1f8"
    ],
    "parts": [
      {
        "key": "bot.services.lotteryService.b8cc5d1f8",
        "role": "text"
      }
    ],
    "source": "src/services/lotteryService.ts:482"
  },
  {
    "id": "bot:message:services.orderNotificationService.ab93b281f",
    "kind": "message",
    "titleKey": "bot.services.orderNotificationService.ab93b281f",
    "keys": [
      "bot.services.orderNotificationService.ab93b281f"
    ],
    "parts": [
      {
        "key": "bot.services.orderNotificationService.ab93b281f",
        "role": "text"
      }
    ],
    "source": "src/services/orderNotificationService.ts:121"
  },
  {
    "id": "bot:message:services.orderNotificationService.dc37e8775",
    "kind": "message",
    "titleKey": "bot.services.orderNotificationService.dc37e8775",
    "keys": [
      "bot.services.orderNotificationService.dc37e8775"
    ],
    "parts": [
      {
        "key": "bot.services.orderNotificationService.dc37e8775",
        "role": "text"
      }
    ],
    "source": "src/services/orderNotificationService.ts:122"
  },
  {
    "id": "bot:message:interactions.buttons.acceptOrder.f76547c35",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.acceptOrder.f76547c35",
    "keys": [
      "bot.interactions.buttons.acceptOrder.f76547c35"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.acceptOrder.f76547c35",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/acceptOrder.ts:26"
  },
  {
    "id": "bot:message:interactions.buttons.acceptOrder.2853072f9",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.acceptOrder.2853072f9",
    "keys": [
      "bot.interactions.buttons.acceptOrder.2853072f9"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.acceptOrder.2853072f9",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/acceptOrder.ts:98"
  },
  {
    "id": "bot:message:interactions.buttons.acceptOrder.44bd74853",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.acceptOrder.44bd74853",
    "keys": [
      "bot.interactions.buttons.acceptOrder.44bd74853"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.acceptOrder.44bd74853",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/acceptOrder.ts:99"
  },
  {
    "id": "bot:message:interactions.buttons.acceptOrder.29853332f",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.acceptOrder.29853332f",
    "keys": [
      "bot.interactions.buttons.acceptOrder.29853332f"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.acceptOrder.29853332f",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/acceptOrder.ts:244"
  },
  {
    "id": "bot:message:interactions.buttons.acceptOrder.b4e499ad2",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.acceptOrder.b4e499ad2",
    "keys": [
      "bot.interactions.buttons.acceptOrder.b4e499ad2"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.acceptOrder.b4e499ad2",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/acceptOrder.ts:244"
  },
  {
    "id": "bot:message:interactions.buttons.declineOrder.8f945b3d3",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.declineOrder.8f945b3d3",
    "keys": [
      "bot.interactions.buttons.declineOrder.8f945b3d3"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.declineOrder.8f945b3d3",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/declineOrder.ts:84"
  },
  {
    "id": "bot:message:interactions.buttons.declineOrder.8cbe5ecc5",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.declineOrder.8cbe5ecc5",
    "keys": [
      "bot.interactions.buttons.declineOrder.8cbe5ecc5"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.declineOrder.8cbe5ecc5",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/declineOrder.ts:85"
  },
  {
    "id": "bot:message:interactions.buttons.declineOrder.2ad62f58e",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.declineOrder.2ad62f58e",
    "keys": [
      "bot.interactions.buttons.declineOrder.2ad62f58e"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.declineOrder.2ad62f58e",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/declineOrder.ts:173"
  },
  {
    "id": "bot:message:interactions.buttons.declineOrder.1ea2b74d0",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.declineOrder.1ea2b74d0",
    "keys": [
      "bot.interactions.buttons.declineOrder.1ea2b74d0"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.declineOrder.1ea2b74d0",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/declineOrder.ts:174"
  },
  {
    "id": "bot:message:commands.lottery.47624767a",
    "kind": "message",
    "titleKey": "bot.commands.lottery.47624767a",
    "keys": [
      "bot.commands.lottery.47624767a"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.47624767a",
        "role": "text"
      }
    ],
    "source": "src/commands/lottery.ts:58"
  },
  {
    "id": "bot:message:commands.lottery.e2a646453",
    "kind": "message",
    "titleKey": "bot.commands.lottery.e2a646453",
    "keys": [
      "bot.commands.lottery.e2a646453"
    ],
    "parts": [
      {
        "key": "bot.commands.lottery.e2a646453",
        "role": "text"
      }
    ],
    "source": "src/commands/lottery.ts:58"
  },
  {
    "id": "bot:message:commands.gifting.a372f08e3",
    "kind": "message",
    "titleKey": "bot.commands.gifting.a372f08e3",
    "keys": [
      "bot.commands.gifting.a372f08e3"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.a372f08e3",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:327"
  },
  {
    "id": "bot:message:services.publicErrorMessages.ca64b9aeb",
    "kind": "message",
    "titleKey": "bot.services.publicErrorMessages.ca64b9aeb",
    "keys": [
      "bot.services.publicErrorMessages.ca64b9aeb"
    ],
    "parts": [
      {
        "key": "bot.services.publicErrorMessages.ca64b9aeb",
        "role": "text"
      }
    ],
    "source": "src/services/publicErrorMessages.ts:22"
  },
  {
    "id": "bot:message:commands.gifting.7df5b73cf",
    "kind": "message",
    "titleKey": "bot.commands.gifting.7df5b73cf",
    "keys": [
      "bot.commands.gifting.7df5b73cf"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.7df5b73cf",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:1297"
  },
  {
    "id": "bot:message:commands.gifting.fcd86e119",
    "kind": "message",
    "titleKey": "bot.commands.gifting.fcd86e119",
    "keys": [
      "bot.commands.gifting.fcd86e119"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.fcd86e119",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:152"
  },
  {
    "id": "bot:message:commands.gifting.bb7ef1c24",
    "kind": "message",
    "titleKey": "bot.commands.gifting.bb7ef1c24",
    "keys": [
      "bot.commands.gifting.bb7ef1c24"
    ],
    "parts": [
      {
        "key": "bot.commands.gifting.bb7ef1c24",
        "role": "text"
      }
    ],
    "source": "src/commands/gifting.ts:184"
  },
  {
    "id": "bot:message:assistant.confirmButtons.63ddb81e6",
    "kind": "message",
    "titleKey": "bot.assistant.confirmButtons.63ddb81e6",
    "keys": [
      "bot.assistant.confirmButtons.63ddb81e6"
    ],
    "parts": [
      {
        "key": "bot.assistant.confirmButtons.63ddb81e6",
        "role": "text"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:128"
  },
  {
    "id": "bot:message:assistant.confirmButtons.6f93aff08",
    "kind": "message",
    "titleKey": "bot.assistant.confirmButtons.6f93aff08",
    "keys": [
      "bot.assistant.confirmButtons.6f93aff08"
    ],
    "parts": [
      {
        "key": "bot.assistant.confirmButtons.6f93aff08",
        "role": "text"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:129"
  },
  {
    "id": "bot:message:assistant.confirmButtons.ebd65bfcb",
    "kind": "message",
    "titleKey": "bot.assistant.confirmButtons.ebd65bfcb",
    "keys": [
      "bot.assistant.confirmButtons.ebd65bfcb"
    ],
    "parts": [
      {
        "key": "bot.assistant.confirmButtons.ebd65bfcb",
        "role": "text"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:130"
  },
  {
    "id": "bot:message:assistant.confirmButtons.dff1f257b",
    "kind": "message",
    "titleKey": "bot.assistant.confirmButtons.dff1f257b",
    "keys": [
      "bot.assistant.confirmButtons.dff1f257b"
    ],
    "parts": [
      {
        "key": "bot.assistant.confirmButtons.dff1f257b",
        "role": "text"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:134"
  },
  {
    "id": "bot:message:assistant.confirmButtons.565645c2f",
    "kind": "message",
    "titleKey": "bot.assistant.confirmButtons.565645c2f",
    "keys": [
      "bot.assistant.confirmButtons.565645c2f"
    ],
    "parts": [
      {
        "key": "bot.assistant.confirmButtons.565645c2f",
        "role": "text"
      }
    ],
    "source": "src/assistant/confirmButtons.ts:135"
  },
  {
    "id": "bot:message:assistant.executor.2fa1e45d4",
    "kind": "message",
    "titleKey": "bot.assistant.executor.2fa1e45d4",
    "keys": [
      "bot.assistant.executor.2fa1e45d4"
    ],
    "parts": [
      {
        "key": "bot.assistant.executor.2fa1e45d4",
        "role": "text"
      }
    ],
    "source": "src/assistant/executor.ts:56"
  },
  {
    "id": "bot:message:assistant.executor.1d45c46e1",
    "kind": "message",
    "titleKey": "bot.assistant.executor.1d45c46e1",
    "keys": [
      "bot.assistant.executor.1d45c46e1"
    ],
    "parts": [
      {
        "key": "bot.assistant.executor.1d45c46e1",
        "role": "text"
      }
    ],
    "source": "src/assistant/executor.ts:66"
  },
  {
    "id": "bot:message:assistant.executor.fbf85ab78",
    "kind": "message",
    "titleKey": "bot.assistant.executor.fbf85ab78",
    "keys": [
      "bot.assistant.executor.fbf85ab78"
    ],
    "parts": [
      {
        "key": "bot.assistant.executor.fbf85ab78",
        "role": "text"
      }
    ],
    "source": "src/assistant/executor.ts:68"
  },
  {
    "id": "bot:message:assistant.executor.e485745ec",
    "kind": "message",
    "titleKey": "bot.assistant.executor.e485745ec",
    "keys": [
      "bot.assistant.executor.e485745ec"
    ],
    "parts": [
      {
        "key": "bot.assistant.executor.e485745ec",
        "role": "text"
      }
    ],
    "source": "src/assistant/executor.ts:81"
  },
  {
    "id": "bot:message:assistant.executor.10ba53ef0",
    "kind": "message",
    "titleKey": "bot.assistant.executor.10ba53ef0",
    "keys": [
      "bot.assistant.executor.10ba53ef0"
    ],
    "parts": [
      {
        "key": "bot.assistant.executor.10ba53ef0",
        "role": "text"
      }
    ],
    "source": "src/assistant/executor.ts:91"
  },
  {
    "id": "bot:message:assistant.executor.85e433baa",
    "kind": "message",
    "titleKey": "bot.assistant.executor.85e433baa",
    "keys": [
      "bot.assistant.executor.85e433baa"
    ],
    "parts": [
      {
        "key": "bot.assistant.executor.85e433baa",
        "role": "text"
      }
    ],
    "source": "src/assistant/executor.ts:103"
  },
  {
    "id": "bot:message:assistant.executor.9f5af0d77",
    "kind": "message",
    "titleKey": "bot.assistant.executor.9f5af0d77",
    "keys": [
      "bot.assistant.executor.9f5af0d77"
    ],
    "parts": [
      {
        "key": "bot.assistant.executor.9f5af0d77",
        "role": "text"
      }
    ],
    "source": "src/assistant/executor.ts:118"
  },
  {
    "id": "bot:message:assistant.index.c9876e6f5",
    "kind": "message",
    "titleKey": "bot.assistant.index.c9876e6f5",
    "keys": [
      "bot.assistant.index.c9876e6f5"
    ],
    "parts": [
      {
        "key": "bot.assistant.index.c9876e6f5",
        "role": "text"
      }
    ],
    "source": "src/assistant/index.ts:53"
  },
  {
    "id": "bot:message:assistant.index.d350e2541",
    "kind": "message",
    "titleKey": "bot.assistant.index.d350e2541",
    "keys": [
      "bot.assistant.index.d350e2541"
    ],
    "parts": [
      {
        "key": "bot.assistant.index.d350e2541",
        "role": "text"
      }
    ],
    "source": "src/assistant/index.ts:56"
  },
  {
    "id": "bot:message:assistant.index.207a50b46",
    "kind": "message",
    "titleKey": "bot.assistant.index.207a50b46",
    "keys": [
      "bot.assistant.index.207a50b46"
    ],
    "parts": [
      {
        "key": "bot.assistant.index.207a50b46",
        "role": "text"
      }
    ],
    "source": "src/assistant/index.ts:59"
  },
  {
    "id": "bot:message:assistant.index.708d03d17",
    "kind": "message",
    "titleKey": "bot.assistant.index.708d03d17",
    "keys": [
      "bot.assistant.index.708d03d17"
    ],
    "parts": [
      {
        "key": "bot.assistant.index.708d03d17",
        "role": "text"
      }
    ],
    "source": "src/assistant/index.ts:71"
  },
  {
    "id": "bot:message:assistant.index.0cffc9a56",
    "kind": "message",
    "titleKey": "bot.assistant.index.0cffc9a56",
    "keys": [
      "bot.assistant.index.0cffc9a56"
    ],
    "parts": [
      {
        "key": "bot.assistant.index.0cffc9a56",
        "role": "text"
      }
    ],
    "source": "src/assistant/index.ts:73"
  },
  {
    "id": "bot:message:events.messageCreate.9f0523d38",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.9f0523d38",
    "keys": [
      "bot.events.messageCreate.9f0523d38"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.9f0523d38",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:825"
  },
  {
    "id": "bot:message:events.messageCreate.52416c4ed",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.52416c4ed",
    "keys": [
      "bot.events.messageCreate.52416c4ed"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.52416c4ed",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:821"
  },
  {
    "id": "bot:message:events.messageCreate.6f404cbfc",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.6f404cbfc",
    "keys": [
      "bot.events.messageCreate.6f404cbfc"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.6f404cbfc",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:640"
  },
  {
    "id": "bot:message:events.messageCreate.e4728af51",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.e4728af51",
    "keys": [
      "bot.events.messageCreate.e4728af51"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.e4728af51",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:641"
  },
  {
    "id": "bot:message:events.messageCreate.eee05355a",
    "kind": "message",
    "titleKey": "bot.events.messageCreate.eee05355a",
    "keys": [
      "bot.events.messageCreate.eee05355a"
    ],
    "parts": [
      {
        "key": "bot.events.messageCreate.eee05355a",
        "role": "text"
      }
    ],
    "source": "src/events/messageCreate.ts:659"
  },
  {
    "id": "bot:message:interactions.buttons.orderPriceSelect.ba976c202",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.ba976c202",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.ba976c202"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.ba976c202",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:398"
  },
  {
    "id": "bot:message:interactions.buttons.orderPriceSelect.111eb1a60",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.111eb1a60",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.111eb1a60"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.111eb1a60",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:392"
  },
  {
    "id": "bot:message:interactions.buttons.orderPriceSelect.bd9aeb4f0",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.orderPriceSelect.bd9aeb4f0",
    "keys": [
      "bot.interactions.buttons.orderPriceSelect.bd9aeb4f0"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.orderPriceSelect.bd9aeb4f0",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/orderPriceSelect.ts:266"
  },
  {
    "id": "bot:message:ui.blockStackEmbeds.e15d31d27",
    "kind": "message",
    "titleKey": "bot.ui.blockStackEmbeds.e15d31d27",
    "keys": [
      "bot.ui.blockStackEmbeds.e15d31d27"
    ],
    "parts": [
      {
        "key": "bot.ui.blockStackEmbeds.e15d31d27",
        "role": "text"
      }
    ],
    "source": "src/ui/blockStackEmbeds.ts:110"
  },
  {
    "id": "bot:message:ui.blockStackEmbeds.3d5633323",
    "kind": "message",
    "titleKey": "bot.ui.blockStackEmbeds.3d5633323",
    "keys": [
      "bot.ui.blockStackEmbeds.3d5633323"
    ],
    "parts": [
      {
        "key": "bot.ui.blockStackEmbeds.3d5633323",
        "role": "text"
      }
    ],
    "source": "src/ui/blockStackEmbeds.ts:110"
  },
  {
    "id": "bot:message:services.redEnvelopeService.9d44f3c9c",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.9d44f3c9c",
    "keys": [
      "bot.services.redEnvelopeService.9d44f3c9c"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.9d44f3c9c",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1599"
  },
  {
    "id": "bot:message:services.redEnvelopeService.d0a2da248",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.d0a2da248",
    "keys": [
      "bot.services.redEnvelopeService.d0a2da248"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.d0a2da248",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1602"
  },
  {
    "id": "bot:message:services.redEnvelopeService.e9fe14e30",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.e9fe14e30",
    "keys": [
      "bot.services.redEnvelopeService.e9fe14e30"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.e9fe14e30",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:592"
  },
  {
    "id": "bot:message:services.redEnvelopeService.4cee6fcef",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.4cee6fcef",
    "keys": [
      "bot.services.redEnvelopeService.4cee6fcef"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.4cee6fcef",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:590"
  },
  {
    "id": "bot:message:services.redEnvelopeService.1c1f19f36",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.1c1f19f36",
    "keys": [
      "bot.services.redEnvelopeService.1c1f19f36"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.1c1f19f36",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:625"
  },
  {
    "id": "bot:message:services.redEnvelopeService.ea257bd04",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.ea257bd04",
    "keys": [
      "bot.services.redEnvelopeService.ea257bd04"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.ea257bd04",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1328"
  },
  {
    "id": "bot:message:services.redEnvelopeService.2ea0f3fa0",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.2ea0f3fa0",
    "keys": [
      "bot.services.redEnvelopeService.2ea0f3fa0"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.2ea0f3fa0",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1351"
  },
  {
    "id": "bot:message:services.redEnvelopeService.9d440ad3d",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.9d440ad3d",
    "keys": [
      "bot.services.redEnvelopeService.9d440ad3d"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.9d440ad3d",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:1366"
  },
  {
    "id": "bot:message:ui.scratchEmbeds.3d1fdc885",
    "kind": "message",
    "titleKey": "bot.ui.scratchEmbeds.3d1fdc885",
    "keys": [
      "bot.ui.scratchEmbeds.3d1fdc885"
    ],
    "parts": [
      {
        "key": "bot.ui.scratchEmbeds.3d1fdc885",
        "role": "text"
      }
    ],
    "source": "src/ui/scratchEmbeds.ts:66"
  },
  {
    "id": "bot:message:ui.scratchEmbeds.ed394d5e5",
    "kind": "message",
    "titleKey": "bot.ui.scratchEmbeds.ed394d5e5",
    "keys": [
      "bot.ui.scratchEmbeds.ed394d5e5"
    ],
    "parts": [
      {
        "key": "bot.ui.scratchEmbeds.ed394d5e5",
        "role": "text"
      }
    ],
    "source": "src/ui/scratchEmbeds.ts:78"
  },
  {
    "id": "bot:message:interactions.selects.giftingSelect.2824f8ac4",
    "kind": "message",
    "titleKey": "bot.interactions.selects.giftingSelect.2824f8ac4",
    "keys": [
      "bot.interactions.selects.giftingSelect.2824f8ac4"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.giftingSelect.2824f8ac4",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/giftingSelect.ts:56"
  },
  {
    "id": "bot:message:interactions.selects.giftingSelect.7bce4758a",
    "kind": "message",
    "titleKey": "bot.interactions.selects.giftingSelect.7bce4758a",
    "keys": [
      "bot.interactions.selects.giftingSelect.7bce4758a"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.giftingSelect.7bce4758a",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/giftingSelect.ts:76"
  },
  {
    "id": "bot:message:interactions.selects.giftingSelect.1985471e1",
    "kind": "message",
    "titleKey": "bot.interactions.selects.giftingSelect.1985471e1",
    "keys": [
      "bot.interactions.selects.giftingSelect.1985471e1"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.giftingSelect.1985471e1",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/giftingSelect.ts:83"
  },
  {
    "id": "bot:message:interactions.selects.discountSelect.37e0ae147",
    "kind": "message",
    "titleKey": "bot.interactions.selects.discountSelect.37e0ae147",
    "keys": [
      "bot.interactions.selects.discountSelect.37e0ae147"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.discountSelect.37e0ae147",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/discountSelect.ts:57"
  },
  {
    "id": "bot:message:interactions.selects.discountSelect.699ecdcb1",
    "kind": "message",
    "titleKey": "bot.interactions.selects.discountSelect.699ecdcb1",
    "keys": [
      "bot.interactions.selects.discountSelect.699ecdcb1"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.discountSelect.699ecdcb1",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/discountSelect.ts:60"
  },
  {
    "id": "bot:message:interactions.selects.discountSelect.1e9f8fda9",
    "kind": "message",
    "titleKey": "bot.interactions.selects.discountSelect.1e9f8fda9",
    "keys": [
      "bot.interactions.selects.discountSelect.1e9f8fda9"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.discountSelect.1e9f8fda9",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/discountSelect.ts:63"
  },
  {
    "id": "bot:message:interactions.selects.discountSelect.10b0fe8f4",
    "kind": "message",
    "titleKey": "bot.interactions.selects.discountSelect.10b0fe8f4",
    "keys": [
      "bot.interactions.selects.discountSelect.10b0fe8f4"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.discountSelect.10b0fe8f4",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/discountSelect.ts:66"
  },
  {
    "id": "bot:message:interactions.selects.discountSelect.f9b473a72",
    "kind": "message",
    "titleKey": "bot.interactions.selects.discountSelect.f9b473a72",
    "keys": [
      "bot.interactions.selects.discountSelect.f9b473a72"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.discountSelect.f9b473a72",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/discountSelect.ts:69"
  },
  {
    "id": "bot:message:interactions.selects.discountSelect.e4d803500",
    "kind": "message",
    "titleKey": "bot.interactions.selects.discountSelect.e4d803500",
    "keys": [
      "bot.interactions.selects.discountSelect.e4d803500"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.discountSelect.e4d803500",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/discountSelect.ts:72"
  },
  {
    "id": "bot:message:interactions.selects.discountSelect.e255430fb",
    "kind": "message",
    "titleKey": "bot.interactions.selects.discountSelect.e255430fb",
    "keys": [
      "bot.interactions.selects.discountSelect.e255430fb"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.discountSelect.e255430fb",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/discountSelect.ts:29"
  },
  {
    "id": "bot:message:interactions.selects.discountSelect.6d2f61ccd",
    "kind": "message",
    "titleKey": "bot.interactions.selects.discountSelect.6d2f61ccd",
    "keys": [
      "bot.interactions.selects.discountSelect.6d2f61ccd"
    ],
    "parts": [
      {
        "key": "bot.interactions.selects.discountSelect.6d2f61ccd",
        "role": "text"
      }
    ],
    "source": "src/interactions/selects/discountSelect.ts:77"
  },
  {
    "id": "bot:message:commands.totalEarn.32e36f3e1",
    "kind": "message",
    "titleKey": "bot.commands.totalEarn.32e36f3e1",
    "keys": [
      "bot.commands.totalEarn.32e36f3e1"
    ],
    "parts": [
      {
        "key": "bot.commands.totalEarn.32e36f3e1",
        "role": "text"
      }
    ],
    "source": "src/commands/totalEarn.ts:74"
  },
  {
    "id": "bot:message:commands.totalEarn.7976978a9",
    "kind": "message",
    "titleKey": "bot.commands.totalEarn.7976978a9",
    "keys": [
      "bot.commands.totalEarn.7976978a9"
    ],
    "parts": [
      {
        "key": "bot.commands.totalEarn.7976978a9",
        "role": "text"
      }
    ],
    "source": "src/commands/totalEarn.ts:74"
  },
  {
    "id": "bot:message:commands.totalSpent.281c65588",
    "kind": "message",
    "titleKey": "bot.commands.totalSpent.281c65588",
    "keys": [
      "bot.commands.totalSpent.281c65588"
    ],
    "parts": [
      {
        "key": "bot.commands.totalSpent.281c65588",
        "role": "text"
      }
    ],
    "source": "src/commands/totalSpent.ts:75"
  },
  {
    "id": "bot:message:commands.totalSpent.4975d3be2",
    "kind": "message",
    "titleKey": "bot.commands.totalSpent.4975d3be2",
    "keys": [
      "bot.commands.totalSpent.4975d3be2"
    ],
    "parts": [
      {
        "key": "bot.commands.totalSpent.4975d3be2",
        "role": "text"
      }
    ],
    "source": "src/commands/totalSpent.ts:75"
  },
  {
    "id": "bot:message:commands.loyaltyPoints.b6da11b50",
    "kind": "message",
    "titleKey": "bot.commands.loyaltyPoints.b6da11b50",
    "keys": [
      "bot.commands.loyaltyPoints.b6da11b50"
    ],
    "parts": [
      {
        "key": "bot.commands.loyaltyPoints.b6da11b50",
        "role": "text"
      }
    ],
    "source": "src/commands/loyaltyPoints.ts:74"
  },
  {
    "id": "bot:message:commands.loyaltyPoints.5d6875551",
    "kind": "message",
    "titleKey": "bot.commands.loyaltyPoints.5d6875551",
    "keys": [
      "bot.commands.loyaltyPoints.5d6875551"
    ],
    "parts": [
      {
        "key": "bot.commands.loyaltyPoints.5d6875551",
        "role": "text"
      }
    ],
    "source": "src/commands/loyaltyPoints.ts:74"
  },
  {
    "id": "bot:message:commands.grantCouponSlash.ebe1b0bee",
    "kind": "message",
    "titleKey": "bot.commands.grantCouponSlash.ebe1b0bee",
    "keys": [
      "bot.commands.grantCouponSlash.ebe1b0bee"
    ],
    "parts": [
      {
        "key": "bot.commands.grantCouponSlash.ebe1b0bee",
        "role": "text"
      }
    ],
    "source": "src/commands/grantCouponSlash.ts:97"
  },
  {
    "id": "bot:message:commands.grantCouponSlash.ea6fad8d5",
    "kind": "message",
    "titleKey": "bot.commands.grantCouponSlash.ea6fad8d5",
    "keys": [
      "bot.commands.grantCouponSlash.ea6fad8d5"
    ],
    "parts": [
      {
        "key": "bot.commands.grantCouponSlash.ea6fad8d5",
        "role": "text"
      }
    ],
    "source": "src/commands/grantCouponSlash.ts:106"
  },
  {
    "id": "bot:message:commands.grantCouponSlash.d3e4175dc",
    "kind": "message",
    "titleKey": "bot.commands.grantCouponSlash.d3e4175dc",
    "keys": [
      "bot.commands.grantCouponSlash.d3e4175dc"
    ],
    "parts": [
      {
        "key": "bot.commands.grantCouponSlash.d3e4175dc",
        "role": "text",
        "examples": {
          "MAX_GRANT_QUANTITY": "10"
        }
      }
    ],
    "source": "src/commands/grantCouponSlash.ts:110"
  },
  {
    "id": "bot:message:commands.grantCouponSlash.fc0596d98",
    "kind": "message",
    "titleKey": "bot.commands.grantCouponSlash.fc0596d98",
    "keys": [
      "bot.commands.grantCouponSlash.fc0596d98"
    ],
    "parts": [
      {
        "key": "bot.commands.grantCouponSlash.fc0596d98",
        "role": "text"
      }
    ],
    "source": "src/commands/grantCouponSlash.ts:116"
  },
  {
    "id": "bot:message:commands.grantCouponSlash.118b5644b",
    "kind": "message",
    "titleKey": "bot.commands.grantCouponSlash.118b5644b",
    "keys": [
      "bot.commands.grantCouponSlash.118b5644b"
    ],
    "parts": [
      {
        "key": "bot.commands.grantCouponSlash.118b5644b",
        "role": "text",
        "examples": {
          "fixed4": "30"
        }
      }
    ],
    "source": "src/commands/grantCouponSlash.ts:164"
  },
  {
    "id": "bot:message:commands.grantCouponSlash.0c03927f7",
    "kind": "message",
    "titleKey": "bot.commands.grantCouponSlash.0c03927f7",
    "keys": [
      "bot.commands.grantCouponSlash.0c03927f7"
    ],
    "parts": [
      {
        "key": "bot.commands.grantCouponSlash.0c03927f7",
        "role": "text"
      }
    ],
    "source": "src/commands/grantCouponSlash.ts:174"
  },
  {
    "id": "bot:message:commands.grantCouponSlash.f2fccc9c9",
    "kind": "message",
    "titleKey": "bot.commands.grantCouponSlash.f2fccc9c9",
    "keys": [
      "bot.commands.grantCouponSlash.f2fccc9c9"
    ],
    "parts": [
      {
        "key": "bot.commands.grantCouponSlash.f2fccc9c9",
        "role": "text"
      }
    ],
    "source": "src/commands/grantCouponSlash.ts:120"
  },
  {
    "id": "bot:message:commands.grantCouponSlash.9f2ce5aec",
    "kind": "message",
    "titleKey": "bot.commands.grantCouponSlash.9f2ce5aec",
    "keys": [
      "bot.commands.grantCouponSlash.9f2ce5aec"
    ],
    "parts": [
      {
        "key": "bot.commands.grantCouponSlash.9f2ce5aec",
        "role": "text"
      }
    ],
    "source": "src/commands/grantCouponSlash.ts:120"
  },
  {
    "id": "bot:message:services.redEnvelopeService.515dfc435",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.515dfc435",
    "keys": [
      "bot.services.redEnvelopeService.515dfc435"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.515dfc435",
        "role": "text"
      }
    ],
    "source": "src/services/redEnvelopeService.ts:88"
  },
  {
    "id": "bot:message:services.redEnvelopeService.dc918fa4f",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.dc918fa4f",
    "keys": [
      "bot.services.redEnvelopeService.dc918fa4f"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.dc918fa4f",
        "role": "text",
        "examples": {
          "fixed1": "50"
        }
      }
    ],
    "source": "src/services/redEnvelopeService.ts:91"
  },
  {
    "id": "bot:message:services.redEnvelopeService.7963bddd1",
    "kind": "message",
    "titleKey": "bot.services.redEnvelopeService.7963bddd1",
    "keys": [
      "bot.services.redEnvelopeService.7963bddd1"
    ],
    "parts": [
      {
        "key": "bot.services.redEnvelopeService.7963bddd1",
        "role": "text",
        "examples": {
          "fixed1": "@everyone",
          "fixed2": "@here"
        }
      }
    ],
    "source": "src/services/redEnvelopeService.ts:94"
  },
  {
    "id": "bot:message:commands.revertGiftSlash.c209a976d",
    "kind": "message",
    "titleKey": "bot.commands.revertGiftSlash.c209a976d",
    "keys": [
      "bot.commands.revertGiftSlash.c209a976d"
    ],
    "parts": [
      {
        "key": "bot.commands.revertGiftSlash.c209a976d",
        "role": "text"
      }
    ],
    "source": "src/commands/revertGiftSlash.ts:35"
  },
  {
    "id": "bot:message:commands.revertGiftSlash.a9d46fde2",
    "kind": "message",
    "titleKey": "bot.commands.revertGiftSlash.a9d46fde2",
    "keys": [
      "bot.commands.revertGiftSlash.a9d46fde2"
    ],
    "parts": [
      {
        "key": "bot.commands.revertGiftSlash.a9d46fde2",
        "role": "text"
      }
    ],
    "source": "src/commands/revertGiftSlash.ts:35"
  },
  {
    "id": "bot:message:services.giftReversalFacts.29cf49023",
    "kind": "message",
    "titleKey": "bot.services.giftReversalFacts.29cf49023",
    "keys": [
      "bot.services.giftReversalFacts.29cf49023"
    ],
    "parts": [
      {
        "key": "bot.services.giftReversalFacts.29cf49023",
        "role": "text"
      }
    ],
    "source": "src/services/giftReversalFacts.ts:187"
  },
  {
    "id": "bot:message:services.giftReversalFacts.174a2a768",
    "kind": "message",
    "titleKey": "bot.services.giftReversalFacts.174a2a768",
    "keys": [
      "bot.services.giftReversalFacts.174a2a768"
    ],
    "parts": [
      {
        "key": "bot.services.giftReversalFacts.174a2a768",
        "role": "text"
      }
    ],
    "source": "src/services/giftReversalFacts.ts:188"
  },
  {
    "id": "bot:message:services.giftReversalFacts.557cb8c28",
    "kind": "message",
    "titleKey": "bot.services.giftReversalFacts.557cb8c28",
    "keys": [
      "bot.services.giftReversalFacts.557cb8c28"
    ],
    "parts": [
      {
        "key": "bot.services.giftReversalFacts.557cb8c28",
        "role": "text"
      }
    ],
    "source": "src/services/giftReversalFacts.ts:193"
  },
  {
    "id": "bot:message:commands.revertGiftSlash.760c1f9ec",
    "kind": "message",
    "titleKey": "bot.commands.revertGiftSlash.760c1f9ec",
    "keys": [
      "bot.commands.revertGiftSlash.760c1f9ec"
    ],
    "parts": [
      {
        "key": "bot.commands.revertGiftSlash.760c1f9ec",
        "role": "text"
      }
    ],
    "source": "src/commands/revertGiftSlash.ts:61"
  },
  {
    "id": "bot:message:commands.revertGiftSlash.c60f0dd03",
    "kind": "message",
    "titleKey": "bot.commands.revertGiftSlash.c60f0dd03",
    "keys": [
      "bot.commands.revertGiftSlash.c60f0dd03"
    ],
    "parts": [
      {
        "key": "bot.commands.revertGiftSlash.c60f0dd03",
        "role": "text"
      }
    ],
    "source": "src/commands/revertGiftSlash.ts:62"
  },
  {
    "id": "bot:message:services.orderReversalFacts.71c04450a",
    "kind": "message",
    "titleKey": "bot.services.orderReversalFacts.71c04450a",
    "keys": [
      "bot.services.orderReversalFacts.71c04450a"
    ],
    "parts": [
      {
        "key": "bot.services.orderReversalFacts.71c04450a",
        "role": "text"
      }
    ],
    "source": "src/services/orderReversalFacts.ts:150"
  },
  {
    "id": "bot:message:services.orderReversalFacts.35c78c6da",
    "kind": "message",
    "titleKey": "bot.services.orderReversalFacts.35c78c6da",
    "keys": [
      "bot.services.orderReversalFacts.35c78c6da"
    ],
    "parts": [
      {
        "key": "bot.services.orderReversalFacts.35c78c6da",
        "role": "text"
      }
    ],
    "source": "src/services/orderReversalFacts.ts:154"
  },
  {
    "id": "bot:message:services.orderReversalFacts.c536a2347",
    "kind": "message",
    "titleKey": "bot.services.orderReversalFacts.c536a2347",
    "keys": [
      "bot.services.orderReversalFacts.c536a2347"
    ],
    "parts": [
      {
        "key": "bot.services.orderReversalFacts.c536a2347",
        "role": "text"
      }
    ],
    "source": "src/services/orderReversalFacts.ts:157"
  },
  {
    "id": "bot:message:commands.revertOrderSlash.a710a7e68",
    "kind": "message",
    "titleKey": "bot.commands.revertOrderSlash.a710a7e68",
    "keys": [
      "bot.commands.revertOrderSlash.a710a7e68"
    ],
    "parts": [
      {
        "key": "bot.commands.revertOrderSlash.a710a7e68",
        "role": "text"
      }
    ],
    "source": "src/commands/revertOrderSlash.ts:42"
  },
  {
    "id": "bot:message:commands.revertOrderSlash.9cd6fabad",
    "kind": "message",
    "titleKey": "bot.commands.revertOrderSlash.9cd6fabad",
    "keys": [
      "bot.commands.revertOrderSlash.9cd6fabad"
    ],
    "parts": [
      {
        "key": "bot.commands.revertOrderSlash.9cd6fabad",
        "role": "text"
      }
    ],
    "source": "src/commands/revertOrderSlash.ts:44"
  },
  {
    "id": "bot:message:commands.revertOrderSlash.3e58f2807",
    "kind": "message",
    "titleKey": "bot.commands.revertOrderSlash.3e58f2807",
    "keys": [
      "bot.commands.revertOrderSlash.3e58f2807"
    ],
    "parts": [
      {
        "key": "bot.commands.revertOrderSlash.3e58f2807",
        "role": "text"
      }
    ],
    "source": "src/commands/revertOrderSlash.ts:46"
  },
  {
    "id": "bot:message:commands.revertOrderSlash.adf8a14ba",
    "kind": "message",
    "titleKey": "bot.commands.revertOrderSlash.adf8a14ba",
    "keys": [
      "bot.commands.revertOrderSlash.adf8a14ba"
    ],
    "parts": [
      {
        "key": "bot.commands.revertOrderSlash.adf8a14ba",
        "role": "text",
        "examples": {
          "fixed1": "0"
        }
      }
    ],
    "source": "src/commands/revertOrderSlash.ts:48"
  },
  {
    "id": "bot:message:commands.revertOrderSlash.51abe3cef",
    "kind": "message",
    "titleKey": "bot.commands.revertOrderSlash.51abe3cef",
    "keys": [
      "bot.commands.revertOrderSlash.51abe3cef"
    ],
    "parts": [
      {
        "key": "bot.commands.revertOrderSlash.51abe3cef",
        "role": "text"
      }
    ],
    "source": "src/commands/revertOrderSlash.ts:50"
  },
  {
    "id": "bot:message:commands.revertOrderSlash.01b5f4bc5",
    "kind": "message",
    "titleKey": "bot.commands.revertOrderSlash.01b5f4bc5",
    "keys": [
      "bot.commands.revertOrderSlash.01b5f4bc5"
    ],
    "parts": [
      {
        "key": "bot.commands.revertOrderSlash.01b5f4bc5",
        "role": "text"
      }
    ],
    "source": "src/commands/revertOrderSlash.ts:51"
  },
  {
    "id": "bot:message:commands.getAvatarSlash.8b29746f5",
    "kind": "message",
    "titleKey": "bot.commands.getAvatarSlash.8b29746f5",
    "keys": [
      "bot.commands.getAvatarSlash.8b29746f5"
    ],
    "parts": [
      {
        "key": "bot.commands.getAvatarSlash.8b29746f5",
        "role": "text"
      }
    ],
    "source": "src/commands/getAvatarSlash.ts:21"
  },
  {
    "id": "bot:message:commands.viewCardSlash.bcee922a4",
    "kind": "message",
    "titleKey": "bot.commands.viewCardSlash.bcee922a4",
    "keys": [
      "bot.commands.viewCardSlash.bcee922a4"
    ],
    "parts": [
      {
        "key": "bot.commands.viewCardSlash.bcee922a4",
        "role": "text"
      }
    ],
    "source": "src/commands/viewCardSlash.ts:40"
  },
  {
    "id": "bot:message:commands.lotteryFusionSlash.e6ec65ffe",
    "kind": "message",
    "titleKey": "bot.commands.lotteryFusionSlash.e6ec65ffe",
    "keys": [
      "bot.commands.lotteryFusionSlash.e6ec65ffe"
    ],
    "parts": [
      {
        "key": "bot.commands.lotteryFusionSlash.e6ec65ffe",
        "role": "text"
      }
    ],
    "source": "src/commands/lotteryFusionSlash.ts:163"
  },
  {
    "id": "bot:message:commands.lotteryFusionSlash.5a56391fc",
    "kind": "message",
    "titleKey": "bot.commands.lotteryFusionSlash.5a56391fc",
    "keys": [
      "bot.commands.lotteryFusionSlash.5a56391fc"
    ],
    "parts": [
      {
        "key": "bot.commands.lotteryFusionSlash.5a56391fc",
        "role": "text"
      }
    ],
    "source": "src/commands/lotteryFusionSlash.ts:100"
  },
  {
    "id": "bot:message:commands.blockStack.9d5a1c0d4",
    "kind": "message",
    "titleKey": "bot.commands.blockStack.9d5a1c0d4",
    "keys": [
      "bot.commands.blockStack.9d5a1c0d4"
    ],
    "parts": [
      {
        "key": "bot.commands.blockStack.9d5a1c0d4",
        "role": "text"
      }
    ],
    "source": "src/commands/blockStack.ts:280"
  },
  {
    "id": "bot:message:commands.scratch.2cab763b9",
    "kind": "message",
    "titleKey": "bot.commands.scratch.2cab763b9",
    "keys": [
      "bot.commands.scratch.2cab763b9"
    ],
    "parts": [
      {
        "key": "bot.commands.scratch.2cab763b9",
        "role": "text"
      }
    ],
    "source": "src/commands/scratch.ts:37"
  },
  {
    "id": "bot:message:commands.scratch.c920bb85d",
    "kind": "message",
    "titleKey": "bot.commands.scratch.c920bb85d",
    "keys": [
      "bot.commands.scratch.c920bb85d"
    ],
    "parts": [
      {
        "key": "bot.commands.scratch.c920bb85d",
        "role": "text"
      }
    ],
    "source": "src/commands/scratch.ts:47"
  },
  {
    "id": "bot:message:services.withdrawalNotificationService.0114b4175",
    "kind": "message",
    "titleKey": "bot.services.withdrawalNotificationService.0114b4175",
    "keys": [
      "bot.services.withdrawalNotificationService.0114b4175"
    ],
    "parts": [
      {
        "key": "bot.services.withdrawalNotificationService.0114b4175",
        "role": "text"
      }
    ],
    "source": "src/services/withdrawalNotificationService.ts:95"
  },
  {
    "id": "bot:message:services.orderCancellationService.76974fc4d",
    "kind": "message",
    "titleKey": "bot.services.orderCancellationService.76974fc4d",
    "keys": [
      "bot.services.orderCancellationService.76974fc4d"
    ],
    "parts": [
      {
        "key": "bot.services.orderCancellationService.76974fc4d",
        "role": "text"
      }
    ],
    "source": "src/services/orderCancellationService.ts:63"
  },
  {
    "id": "bot:message:server.internalWebhookServer.1cccbc141",
    "kind": "message",
    "titleKey": "bot.server.internalWebhookServer.1cccbc141",
    "keys": [
      "bot.server.internalWebhookServer.1cccbc141"
    ],
    "parts": [
      {
        "key": "bot.server.internalWebhookServer.1cccbc141",
        "role": "text"
      }
    ],
    "source": "src/server/internalWebhookServer.ts:450"
  },
  {
    "id": "bot:message:server.internalWebhookServer.f5609e4c0",
    "kind": "message",
    "titleKey": "bot.server.internalWebhookServer.f5609e4c0",
    "keys": [
      "bot.server.internalWebhookServer.f5609e4c0"
    ],
    "parts": [
      {
        "key": "bot.server.internalWebhookServer.f5609e4c0",
        "role": "text"
      }
    ],
    "source": "src/server/internalWebhookServer.ts:451"
  },
  {
    "id": "bot:message:server.internalWebhookServer.90548a678",
    "kind": "message",
    "titleKey": "bot.server.internalWebhookServer.90548a678",
    "keys": [
      "bot.server.internalWebhookServer.90548a678"
    ],
    "parts": [
      {
        "key": "bot.server.internalWebhookServer.90548a678",
        "role": "text",
        "examples": {
          "fixed3": "1%"
        }
      }
    ],
    "source": "src/server/internalWebhookServer.ts:1425"
  },
  {
    "id": "bot:message:server.internalWebhookServer.705cc3bd2",
    "kind": "message",
    "titleKey": "bot.server.internalWebhookServer.705cc3bd2",
    "keys": [
      "bot.server.internalWebhookServer.705cc3bd2"
    ],
    "parts": [
      {
        "key": "bot.server.internalWebhookServer.705cc3bd2",
        "role": "text",
        "examples": {
          "fixed3": "5000"
        }
      }
    ],
    "source": "src/server/internalWebhookServer.ts:1477"
  },
  {
    "id": "bot:message:server.internalWebhookServer.15b9fe99c",
    "kind": "message",
    "titleKey": "bot.server.internalWebhookServer.15b9fe99c",
    "keys": [
      "bot.server.internalWebhookServer.15b9fe99c"
    ],
    "parts": [
      {
        "key": "bot.server.internalWebhookServer.15b9fe99c",
        "role": "text",
        "examples": {
          "fixed3": "5000"
        }
      }
    ],
    "source": "src/server/internalWebhookServer.ts:1530"
  },
  {
    "id": "bot:message:server.internalWebhookServer.adc712051",
    "kind": "message",
    "titleKey": "bot.server.internalWebhookServer.adc712051",
    "keys": [
      "bot.server.internalWebhookServer.adc712051"
    ],
    "parts": [
      {
        "key": "bot.server.internalWebhookServer.adc712051",
        "role": "text"
      }
    ],
    "source": "src/server/internalWebhookServer.ts:2067"
  },
  {
    "id": "bot:message:services.leaderboardService.f74128d22",
    "kind": "message",
    "titleKey": "bot.services.leaderboardService.f74128d22",
    "keys": [
      "bot.services.leaderboardService.f74128d22"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.f74128d22",
        "role": "text"
      }
    ],
    "source": "src/services/leaderboardService.ts:278"
  },
  {
    "id": "bot:message:services.leaderboardService.c7d12bb8b",
    "kind": "message",
    "titleKey": "bot.services.leaderboardService.c7d12bb8b",
    "keys": [
      "bot.services.leaderboardService.c7d12bb8b"
    ],
    "parts": [
      {
        "key": "bot.services.leaderboardService.c7d12bb8b",
        "role": "text"
      }
    ],
    "source": "src/services/leaderboardService.ts:251"
  },
  {
    "id": "bot:message:interactions.buttons.cancelOrder.a5d5ec355",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.cancelOrder.a5d5ec355",
    "keys": [
      "bot.interactions.buttons.cancelOrder.a5d5ec355"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.cancelOrder.a5d5ec355",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/cancelOrder.ts:28"
  },
  {
    "id": "bot:message:interactions.buttons.cancelOrder.5b2765f2e",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.cancelOrder.5b2765f2e",
    "keys": [
      "bot.interactions.buttons.cancelOrder.5b2765f2e"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.cancelOrder.5b2765f2e",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/cancelOrder.ts:29"
  },
  {
    "id": "bot:message:assistant.executor.513d76bd0",
    "kind": "message",
    "titleKey": "bot.assistant.executor.513d76bd0",
    "keys": [
      "bot.assistant.executor.513d76bd0"
    ],
    "parts": [
      {
        "key": "bot.assistant.executor.513d76bd0",
        "role": "text"
      }
    ],
    "source": "src/assistant/executor.ts:77"
  },
  {
    "id": "bot:message:assistant.executor.e2ac62b3d",
    "kind": "message",
    "titleKey": "bot.assistant.executor.e2ac62b3d",
    "keys": [
      "bot.assistant.executor.e2ac62b3d"
    ],
    "parts": [
      {
        "key": "bot.assistant.executor.e2ac62b3d",
        "role": "text"
      }
    ],
    "source": "src/assistant/executor.ts:87"
  },
  {
    "id": "bot:message:assistant.planner.d67f44151",
    "kind": "message",
    "titleKey": "bot.assistant.planner.d67f44151",
    "keys": [
      "bot.assistant.planner.d67f44151"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.d67f44151",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:52"
  },
  {
    "id": "bot:message:assistant.planner.e356636fe",
    "kind": "message",
    "titleKey": "bot.assistant.planner.e356636fe",
    "keys": [
      "bot.assistant.planner.e356636fe"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.e356636fe",
        "role": "text",
        "examples": {
          "fixed1": "1101"
        }
      }
    ],
    "source": "src/assistant/planner.ts:57"
  },
  {
    "id": "bot:message:assistant.planner.23ad2e543",
    "kind": "message",
    "titleKey": "bot.assistant.planner.23ad2e543",
    "keys": [
      "bot.assistant.planner.23ad2e543"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.23ad2e543",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:62"
  },
  {
    "id": "bot:message:assistant.planner.1a4be0620",
    "kind": "message",
    "titleKey": "bot.assistant.planner.1a4be0620",
    "keys": [
      "bot.assistant.planner.1a4be0620"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.1a4be0620",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:65"
  },
  {
    "id": "bot:message:assistant.planner.435d4dd54",
    "kind": "message",
    "titleKey": "bot.assistant.planner.435d4dd54",
    "keys": [
      "bot.assistant.planner.435d4dd54"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.435d4dd54",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:71"
  },
  {
    "id": "bot:message:assistant.planner.9034e1f59",
    "kind": "message",
    "titleKey": "bot.assistant.planner.9034e1f59",
    "keys": [
      "bot.assistant.planner.9034e1f59"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.9034e1f59",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:45"
  },
  {
    "id": "bot:message:assistant.planner.27b5f100c",
    "kind": "message",
    "titleKey": "bot.assistant.planner.27b5f100c",
    "keys": [
      "bot.assistant.planner.27b5f100c"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.27b5f100c",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:19"
  },
  {
    "id": "bot:message:assistant.planner.404e5140a",
    "kind": "message",
    "titleKey": "bot.assistant.planner.404e5140a",
    "keys": [
      "bot.assistant.planner.404e5140a"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.404e5140a",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:21"
  },
  {
    "id": "bot:message:assistant.planner.b2e688104",
    "kind": "message",
    "titleKey": "bot.assistant.planner.b2e688104",
    "keys": [
      "bot.assistant.planner.b2e688104"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.b2e688104",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:25"
  },
  {
    "id": "bot:message:assistant.planner.434da974d",
    "kind": "message",
    "titleKey": "bot.assistant.planner.434da974d",
    "keys": [
      "bot.assistant.planner.434da974d"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.434da974d",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:38"
  },
  {
    "id": "bot:message:assistant.planner.39aff629b",
    "kind": "message",
    "titleKey": "bot.assistant.planner.39aff629b",
    "keys": [
      "bot.assistant.planner.39aff629b"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.39aff629b",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:97"
  },
  {
    "id": "bot:message:assistant.resolver.7cf712fc8",
    "kind": "message",
    "titleKey": "bot.assistant.resolver.7cf712fc8",
    "keys": [
      "bot.assistant.resolver.7cf712fc8"
    ],
    "parts": [
      {
        "key": "bot.assistant.resolver.7cf712fc8",
        "role": "text"
      }
    ],
    "source": "src/assistant/resolver.ts:72"
  },
  {
    "id": "bot:message:assistant.resolver.25692a5c9",
    "kind": "message",
    "titleKey": "bot.assistant.resolver.25692a5c9",
    "keys": [
      "bot.assistant.resolver.25692a5c9"
    ],
    "parts": [
      {
        "key": "bot.assistant.resolver.25692a5c9",
        "role": "text"
      }
    ],
    "source": "src/assistant/resolver.ts:87"
  },
  {
    "id": "bot:message:assistant.resolver.9de9927e5",
    "kind": "message",
    "titleKey": "bot.assistant.resolver.9de9927e5",
    "keys": [
      "bot.assistant.resolver.9de9927e5"
    ],
    "parts": [
      {
        "key": "bot.assistant.resolver.9de9927e5",
        "role": "text"
      }
    ],
    "source": "src/assistant/resolver.ts:92"
  },
  {
    "id": "bot:message:assistant.resolver.629704151",
    "kind": "message",
    "titleKey": "bot.assistant.resolver.629704151",
    "keys": [
      "bot.assistant.resolver.629704151"
    ],
    "parts": [
      {
        "key": "bot.assistant.resolver.629704151",
        "role": "text"
      }
    ],
    "source": "src/assistant/resolver.ts:147"
  },
  {
    "id": "bot:message:assistant.resolver.4c82a80ad",
    "kind": "message",
    "titleKey": "bot.assistant.resolver.4c82a80ad",
    "keys": [
      "bot.assistant.resolver.4c82a80ad"
    ],
    "parts": [
      {
        "key": "bot.assistant.resolver.4c82a80ad",
        "role": "text"
      }
    ],
    "source": "src/assistant/resolver.ts:149"
  },
  {
    "id": "bot:message:assistant.resolver.681b44e03",
    "kind": "message",
    "titleKey": "bot.assistant.resolver.681b44e03",
    "keys": [
      "bot.assistant.resolver.681b44e03"
    ],
    "parts": [
      {
        "key": "bot.assistant.resolver.681b44e03",
        "role": "text"
      }
    ],
    "source": "src/assistant/resolver.ts:150"
  },
  {
    "id": "bot:message:assistant.resolver.c472d2792",
    "kind": "message",
    "titleKey": "bot.assistant.resolver.c472d2792",
    "keys": [
      "bot.assistant.resolver.c472d2792"
    ],
    "parts": [
      {
        "key": "bot.assistant.resolver.c472d2792",
        "role": "text"
      }
    ],
    "source": "src/assistant/resolver.ts:56"
  },
  {
    "id": "bot:message:assistant.resolver.7a45636b1",
    "kind": "message",
    "titleKey": "bot.assistant.resolver.7a45636b1",
    "keys": [
      "bot.assistant.resolver.7a45636b1"
    ],
    "parts": [
      {
        "key": "bot.assistant.resolver.7a45636b1",
        "role": "text"
      }
    ],
    "source": "src/assistant/resolver.ts:216"
  },
  {
    "id": "bot:message:assistant.resolver.a7f3667f5",
    "kind": "message",
    "titleKey": "bot.assistant.resolver.a7f3667f5",
    "keys": [
      "bot.assistant.resolver.a7f3667f5"
    ],
    "parts": [
      {
        "key": "bot.assistant.resolver.a7f3667f5",
        "role": "text"
      }
    ],
    "source": "src/assistant/resolver.ts:223"
  },
  {
    "id": "bot:message:assistant.resolver.030c7258b",
    "kind": "message",
    "titleKey": "bot.assistant.resolver.030c7258b",
    "keys": [
      "bot.assistant.resolver.030c7258b"
    ],
    "parts": [
      {
        "key": "bot.assistant.resolver.030c7258b",
        "role": "text"
      }
    ],
    "source": "src/assistant/resolver.ts:272"
  },
  {
    "id": "bot:message:assistant.resolver.af54155ae",
    "kind": "message",
    "titleKey": "bot.assistant.resolver.af54155ae",
    "keys": [
      "bot.assistant.resolver.af54155ae"
    ],
    "parts": [
      {
        "key": "bot.assistant.resolver.af54155ae",
        "role": "text"
      }
    ],
    "source": "src/assistant/resolver.ts:293"
  },
  {
    "id": "bot:message:assistant.resolver.fd18fe7d6",
    "kind": "message",
    "titleKey": "bot.assistant.resolver.fd18fe7d6",
    "keys": [
      "bot.assistant.resolver.fd18fe7d6"
    ],
    "parts": [
      {
        "key": "bot.assistant.resolver.fd18fe7d6",
        "role": "text"
      }
    ],
    "source": "src/assistant/resolver.ts:323"
  },
  {
    "id": "bot:message:assistant.index.20bc07002",
    "kind": "message",
    "titleKey": "bot.assistant.index.20bc07002",
    "keys": [
      "bot.assistant.index.20bc07002"
    ],
    "parts": [
      {
        "key": "bot.assistant.index.20bc07002",
        "role": "text"
      }
    ],
    "source": "src/assistant/index.ts:124"
  },
  {
    "id": "bot:message:assistant.index.9a84ae8ba",
    "kind": "message",
    "titleKey": "bot.assistant.index.9a84ae8ba",
    "keys": [
      "bot.assistant.index.9a84ae8ba"
    ],
    "parts": [
      {
        "key": "bot.assistant.index.9a84ae8ba",
        "role": "text"
      }
    ],
    "source": "src/assistant/index.ts:198"
  },
  {
    "id": "bot:message:ui.orderEmbeds.c86d896c7",
    "kind": "message",
    "titleKey": "bot.ui.orderEmbeds.c86d896c7",
    "keys": [
      "bot.ui.orderEmbeds.c86d896c7"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.c86d896c7",
        "role": "text"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:341"
  },
  {
    "id": "bot:message:ui.orderEmbeds.816394792",
    "kind": "message",
    "titleKey": "bot.ui.orderEmbeds.816394792",
    "keys": [
      "bot.ui.orderEmbeds.816394792"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.816394792",
        "role": "text"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:344"
  },
  {
    "id": "bot:message:ui.orderEmbeds.98578da60",
    "kind": "message",
    "titleKey": "bot.ui.orderEmbeds.98578da60",
    "keys": [
      "bot.ui.orderEmbeds.98578da60"
    ],
    "parts": [
      {
        "key": "bot.ui.orderEmbeds.98578da60",
        "role": "text"
      }
    ],
    "source": "src/ui/orderEmbeds.ts:347"
  },
  {
    "id": "bot:message:ui.blockStackEmbeds.053142cde",
    "kind": "message",
    "titleKey": "bot.ui.blockStackEmbeds.053142cde",
    "keys": [
      "bot.ui.blockStackEmbeds.053142cde"
    ],
    "parts": [
      {
        "key": "bot.ui.blockStackEmbeds.053142cde",
        "role": "text"
      }
    ],
    "source": "src/ui/blockStackEmbeds.ts:46"
  },
  {
    "id": "bot:message:ui.blockStackEmbeds.69e8d75bd",
    "kind": "message",
    "titleKey": "bot.ui.blockStackEmbeds.69e8d75bd",
    "keys": [
      "bot.ui.blockStackEmbeds.69e8d75bd"
    ],
    "parts": [
      {
        "key": "bot.ui.blockStackEmbeds.69e8d75bd",
        "role": "text"
      }
    ],
    "source": "src/ui/blockStackEmbeds.ts:49"
  },
  {
    "id": "bot:message:services.vipBenefitService.alreadyGranted",
    "kind": "message",
    "titleKey": "bot.services.vipBenefitService.alreadyGranted",
    "keys": [
      "bot.services.vipBenefitService.alreadyGranted"
    ],
    "parts": [
      {
        "key": "bot.services.vipBenefitService.alreadyGranted",
        "role": "text"
      }
    ],
    "source": "src/services/vipBenefitService.ts:78"
  },
  {
    "id": "bot:message:services.vipBenefitService.alreadyUsed",
    "kind": "message",
    "titleKey": "bot.services.vipBenefitService.alreadyUsed",
    "keys": [
      "bot.services.vipBenefitService.alreadyUsed"
    ],
    "parts": [
      {
        "key": "bot.services.vipBenefitService.alreadyUsed",
        "role": "text"
      }
    ],
    "source": "src/services/vipBenefitService.ts:80"
  },
  {
    "id": "bot:message:services.vipBenefitService.noTier",
    "kind": "message",
    "titleKey": "bot.services.vipBenefitService.noTier",
    "keys": [
      "bot.services.vipBenefitService.noTier"
    ],
    "parts": [
      {
        "key": "bot.services.vipBenefitService.noTier",
        "role": "text"
      }
    ],
    "source": "src/services/vipBenefitService.ts:540"
  },
  {
    "id": "bot:message:services.vipBenefitService.tierAdjusted",
    "kind": "message",
    "titleKey": "bot.services.vipBenefitService.tierAdjusted",
    "keys": [
      "bot.services.vipBenefitService.tierAdjusted"
    ],
    "parts": [
      {
        "key": "bot.services.vipBenefitService.tierAdjusted",
        "role": "text"
      }
    ],
    "source": "src/services/vipBenefitService.ts:552"
  },
  {
    "id": "bot:message:commands.money.unknownError",
    "kind": "message",
    "titleKey": "bot.commands.money.unknownError",
    "keys": [
      "bot.commands.money.unknownError"
    ],
    "parts": [
      {
        "key": "bot.commands.money.unknownError",
        "role": "text"
      }
    ],
    "source": "src/commands/loyaltyPoints.ts:81"
  },
  {
    "id": "bot:message:commands.redEnvelope.originalFailureFallback",
    "kind": "message",
    "titleKey": "bot.commands.redEnvelope.originalFailureFallback",
    "keys": [
      "bot.commands.redEnvelope.originalFailureFallback"
    ],
    "parts": [
      {
        "key": "bot.commands.redEnvelope.originalFailureFallback",
        "role": "text"
      }
    ],
    "source": "src/commands/redEnvelope.ts:162"
  },
  {
    "id": "bot:message:commands.keywordRedEnvelope.originalFailureFallback",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelope.originalFailureFallback",
    "keys": [
      "bot.commands.keywordRedEnvelope.originalFailureFallback"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelope.originalFailureFallback",
        "role": "text"
      }
    ],
    "source": "src/commands/keywordRedEnvelope.ts:163"
  },
  {
    "id": "bot:message:commands.redEnvelopeSlash.originalFailureFallback",
    "kind": "message",
    "titleKey": "bot.commands.redEnvelopeSlash.originalFailureFallback",
    "keys": [
      "bot.commands.redEnvelopeSlash.originalFailureFallback"
    ],
    "parts": [
      {
        "key": "bot.commands.redEnvelopeSlash.originalFailureFallback",
        "role": "text"
      }
    ],
    "source": "src/commands/redEnvelopeSlash.ts:146"
  },
  {
    "id": "bot:message:commands.keywordRedEnvelopeSlash.originalFailureFallback",
    "kind": "message",
    "titleKey": "bot.commands.keywordRedEnvelopeSlash.originalFailureFallback",
    "keys": [
      "bot.commands.keywordRedEnvelopeSlash.originalFailureFallback"
    ],
    "parts": [
      {
        "key": "bot.commands.keywordRedEnvelopeSlash.originalFailureFallback",
        "role": "text"
      }
    ],
    "source": "src/commands/keywordRedEnvelopeSlash.ts:148"
  },
  {
    "id": "bot:message:services.giftReversalFacts.original_gift_audit_incomplete",
    "kind": "message",
    "titleKey": "bot.services.giftReversalFacts.original_gift_audit_incomplete",
    "keys": [
      "bot.services.giftReversalFacts.original_gift_audit_incomplete"
    ],
    "parts": [
      {
        "key": "bot.services.giftReversalFacts.original_gift_audit_incomplete",
        "role": "text"
      }
    ],
    "source": "src/services/giftReversalFacts.ts:189"
  },
  {
    "id": "bot:message:services.giftReversalFacts.original_gift_audit_mismatch",
    "kind": "message",
    "titleKey": "bot.services.giftReversalFacts.original_gift_audit_mismatch",
    "keys": [
      "bot.services.giftReversalFacts.original_gift_audit_mismatch"
    ],
    "parts": [
      {
        "key": "bot.services.giftReversalFacts.original_gift_audit_mismatch",
        "role": "text"
      }
    ],
    "source": "src/services/giftReversalFacts.ts:190"
  },
  {
    "id": "bot:message:services.giftReversalFacts.original_gift_referral_audit_incomplete",
    "kind": "message",
    "titleKey": "bot.services.giftReversalFacts.original_gift_referral_audit_incomplete",
    "keys": [
      "bot.services.giftReversalFacts.original_gift_referral_audit_incomplete"
    ],
    "parts": [
      {
        "key": "bot.services.giftReversalFacts.original_gift_referral_audit_incomplete",
        "role": "text"
      }
    ],
    "source": "src/services/giftReversalFacts.ts:191"
  },
  {
    "id": "bot:message:services.giftReversalFacts.original_gift_referral_audit_mismatch",
    "kind": "message",
    "titleKey": "bot.services.giftReversalFacts.original_gift_referral_audit_mismatch",
    "keys": [
      "bot.services.giftReversalFacts.original_gift_referral_audit_mismatch"
    ],
    "parts": [
      {
        "key": "bot.services.giftReversalFacts.original_gift_referral_audit_mismatch",
        "role": "text"
      }
    ],
    "source": "src/services/giftReversalFacts.ts:192"
  },
  {
    "id": "bot:message:services.giftReversalFacts.original_gift_voucher_requires_review",
    "kind": "message",
    "titleKey": "bot.services.giftReversalFacts.original_gift_voucher_requires_review",
    "keys": [
      "bot.services.giftReversalFacts.original_gift_voucher_requires_review"
    ],
    "parts": [
      {
        "key": "bot.services.giftReversalFacts.original_gift_voucher_requires_review",
        "role": "text"
      }
    ],
    "source": "src/services/giftReversalFacts.ts:194"
  },
  {
    "id": "bot:message:services.giftReversalFacts.original_buff_restore_requires_review",
    "kind": "message",
    "titleKey": "bot.services.giftReversalFacts.original_buff_restore_requires_review",
    "keys": [
      "bot.services.giftReversalFacts.original_buff_restore_requires_review"
    ],
    "parts": [
      {
        "key": "bot.services.giftReversalFacts.original_buff_restore_requires_review",
        "role": "text"
      }
    ],
    "source": "src/services/giftReversalFacts.ts:195"
  },
  {
    "id": "bot:message:services.orderReversalFacts.original_order_audit_incomplete",
    "kind": "message",
    "titleKey": "bot.services.orderReversalFacts.original_order_audit_incomplete",
    "keys": [
      "bot.services.orderReversalFacts.original_order_audit_incomplete"
    ],
    "parts": [
      {
        "key": "bot.services.orderReversalFacts.original_order_audit_incomplete",
        "role": "text"
      }
    ],
    "source": "src/services/orderReversalFacts.ts:151"
  },
  {
    "id": "bot:message:services.orderReversalFacts.original_order_audit_mismatch",
    "kind": "message",
    "titleKey": "bot.services.orderReversalFacts.original_order_audit_mismatch",
    "keys": [
      "bot.services.orderReversalFacts.original_order_audit_mismatch"
    ],
    "parts": [
      {
        "key": "bot.services.orderReversalFacts.original_order_audit_mismatch",
        "role": "text"
      }
    ],
    "source": "src/services/orderReversalFacts.ts:152"
  },
  {
    "id": "bot:message:services.orderReversalFacts.original_order_discount_requires_review",
    "kind": "message",
    "titleKey": "bot.services.orderReversalFacts.original_order_discount_requires_review",
    "keys": [
      "bot.services.orderReversalFacts.original_order_discount_requires_review"
    ],
    "parts": [
      {
        "key": "bot.services.orderReversalFacts.original_order_discount_requires_review",
        "role": "text"
      }
    ],
    "source": "src/services/orderReversalFacts.ts:153"
  },
  {
    "id": "bot:message:services.orderReversalFacts.original_buff_restore_requires_review",
    "kind": "message",
    "titleKey": "bot.services.orderReversalFacts.original_buff_restore_requires_review",
    "keys": [
      "bot.services.orderReversalFacts.original_buff_restore_requires_review"
    ],
    "parts": [
      {
        "key": "bot.services.orderReversalFacts.original_buff_restore_requires_review",
        "role": "text"
      }
    ],
    "source": "src/services/orderReversalFacts.ts:156"
  },
  {
    "id": "bot:message:services.lotteryFusionNotificationService.originalFallbackUser",
    "kind": "message",
    "titleKey": "bot.services.lotteryFusionNotificationService.originalFallbackUser",
    "keys": [
      "bot.services.lotteryFusionNotificationService.originalFallbackUser"
    ],
    "parts": [
      {
        "key": "bot.services.lotteryFusionNotificationService.originalFallbackUser",
        "role": "text"
      }
    ],
    "source": "src/services/lotteryFusionNotificationService.ts:20"
  },
  {
    "id": "bot:message:services.auditionService.roomCreateFailedWorker",
    "kind": "message",
    "titleKey": "bot.services.auditionService.roomCreateFailedWorker",
    "keys": [
      "bot.services.auditionService.roomCreateFailedWorker"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.roomCreateFailedWorker",
        "role": "text"
      }
    ],
    "source": "src/services/auditionService.ts:1288"
  },
  {
    "id": "bot:message:services.auditionService.52278a086",
    "kind": "message",
    "titleKey": "bot.services.auditionService.52278a086",
    "keys": [
      "bot.services.auditionService.52278a086"
    ],
    "parts": [
      {
        "key": "bot.services.auditionService.52278a086",
        "role": "text",
        "examples": {
          "fixed1": "5"
        }
      }
    ],
    "source": "src/services/auditionService.ts:308"
  },
  {
    "id": "bot:message:interactions.buttons.miniDispatch.43d1458b4",
    "kind": "message",
    "titleKey": "bot.interactions.buttons.miniDispatch.43d1458b4",
    "keys": [
      "bot.interactions.buttons.miniDispatch.43d1458b4"
    ],
    "parts": [
      {
        "key": "bot.interactions.buttons.miniDispatch.43d1458b4",
        "role": "text"
      }
    ],
    "source": "src/interactions/buttons/miniDispatch.ts:72"
  },
  {
    "id": "bot:message:commands.cash.7789e1e68",
    "kind": "message",
    "titleKey": "bot.commands.cash.7789e1e68",
    "keys": [
      "bot.commands.cash.7789e1e68"
    ],
    "parts": [
      {
        "key": "bot.commands.cash.7789e1e68",
        "role": "text"
      }
    ],
    "source": "src/commands/cash.ts:239"
  },
  {
    "id": "bot:message:commands.totalEarn.f03e55bf1",
    "kind": "message",
    "titleKey": "bot.commands.totalEarn.f03e55bf1",
    "keys": [
      "bot.commands.totalEarn.f03e55bf1"
    ],
    "parts": [
      {
        "key": "bot.commands.totalEarn.f03e55bf1",
        "role": "text"
      }
    ],
    "source": "src/commands/totalEarn.ts:81"
  },
  {
    "id": "bot:message:commands.totalSpent.299a06e09",
    "kind": "message",
    "titleKey": "bot.commands.totalSpent.299a06e09",
    "keys": [
      "bot.commands.totalSpent.299a06e09"
    ],
    "parts": [
      {
        "key": "bot.commands.totalSpent.299a06e09",
        "role": "text"
      }
    ],
    "source": "src/commands/totalSpent.ts:83"
  },
  {
    "id": "bot:message:commands.registerPeiwanSlash.e50698500",
    "kind": "message",
    "titleKey": "bot.commands.registerPeiwanSlash.e50698500",
    "keys": [
      "bot.commands.registerPeiwanSlash.e50698500"
    ],
    "parts": [
      {
        "key": "bot.commands.registerPeiwanSlash.e50698500",
        "role": "text"
      }
    ],
    "source": "src/commands/registerPeiwanSlash.ts:56"
  },
  {
    "id": "bot:message:commands.scratch.b9517d67b",
    "kind": "message",
    "titleKey": "bot.commands.scratch.b9517d67b",
    "keys": [
      "bot.commands.scratch.b9517d67b"
    ],
    "parts": [
      {
        "key": "bot.commands.scratch.b9517d67b",
        "role": "text"
      }
    ],
    "source": "src/commands/scratch.ts:60"
  },
  {
    "id": "bot:message:commands.scratch.4c8e8e0a7",
    "kind": "message",
    "titleKey": "bot.commands.scratch.4c8e8e0a7",
    "keys": [
      "bot.commands.scratch.4c8e8e0a7"
    ],
    "parts": [
      {
        "key": "bot.commands.scratch.4c8e8e0a7",
        "role": "text"
      }
    ],
    "source": "src/commands/scratch.ts:64"
  },
  {
    "id": "bot:message:commands.scratch.527b1c529",
    "kind": "message",
    "titleKey": "bot.commands.scratch.527b1c529",
    "keys": [
      "bot.commands.scratch.527b1c529"
    ],
    "parts": [
      {
        "key": "bot.commands.scratch.527b1c529",
        "role": "text"
      }
    ],
    "source": "src/commands/scratch.ts:72"
  },
  {
    "id": "bot:message:server.internalWebhookServer.c9abb43e7",
    "kind": "message",
    "titleKey": "bot.server.internalWebhookServer.c9abb43e7",
    "keys": [
      "bot.server.internalWebhookServer.c9abb43e7"
    ],
    "parts": [
      {
        "key": "bot.server.internalWebhookServer.c9abb43e7",
        "role": "text"
      }
    ],
    "source": "src/server/internalWebhookServer.ts:459"
  },
  {
    "id": "bot:message:assistant.orderActions.fda3a203d",
    "kind": "message",
    "titleKey": "bot.assistant.orderActions.fda3a203d",
    "keys": [
      "bot.assistant.orderActions.fda3a203d"
    ],
    "parts": [
      {
        "key": "bot.assistant.orderActions.fda3a203d",
        "role": "text"
      }
    ],
    "source": "src/assistant/orderActions.ts:266"
  },
  {
    "id": "bot:message:assistant.orderActions.e2c042a4d",
    "kind": "message",
    "titleKey": "bot.assistant.orderActions.e2c042a4d",
    "keys": [
      "bot.assistant.orderActions.e2c042a4d"
    ],
    "parts": [
      {
        "key": "bot.assistant.orderActions.e2c042a4d",
        "role": "text"
      }
    ],
    "source": "src/assistant/orderActions.ts:260"
  },
  {
    "id": "bot:message:assistant.planner.2700f72db",
    "kind": "message",
    "titleKey": "bot.assistant.planner.2700f72db",
    "keys": [
      "bot.assistant.planner.2700f72db"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.2700f72db",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:68"
  },
  {
    "id": "bot:message:assistant.planner.c5eb49f2d",
    "kind": "message",
    "titleKey": "bot.assistant.planner.c5eb49f2d",
    "keys": [
      "bot.assistant.planner.c5eb49f2d"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.c5eb49f2d",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:42"
  },
  {
    "id": "bot:message:assistant.planner.fa0b28fde",
    "kind": "message",
    "titleKey": "bot.assistant.planner.fa0b28fde",
    "keys": [
      "bot.assistant.planner.fa0b28fde"
    ],
    "parts": [
      {
        "key": "bot.assistant.planner.fa0b28fde",
        "role": "text"
      }
    ],
    "source": "src/assistant/planner.ts:95"
  },
  {
    "id": "bot:message:dispatch.selectedHint",
    "kind": "message",
    "titleKey": "bot.dispatch.selectedHint",
    "keys": [
      "bot.dispatch.selectedHint"
    ],
    "parts": [
      {
        "key": "bot.dispatch.selectedHint",
        "role": "text"
      }
    ],
    "source": "src/constants/orderRequestCopy.ts:6"
  },
  {
    "id": "bot:message:dispatch.endedHint",
    "kind": "message",
    "titleKey": "bot.dispatch.endedHint",
    "keys": [
      "bot.dispatch.endedHint"
    ],
    "parts": [
      {
        "key": "bot.dispatch.endedHint",
        "role": "text"
      }
    ],
    "source": "src/constants/orderRequestCopy.ts:7"
  },
  {
    "id": "bot:message:dispatch.closedHint",
    "kind": "message",
    "titleKey": "bot.dispatch.closedHint",
    "keys": [
      "bot.dispatch.closedHint"
    ],
    "parts": [
      {
        "key": "bot.dispatch.closedHint",
        "role": "text"
      }
    ],
    "source": "src/constants/orderRequestCopy.ts:8"
  }
];
