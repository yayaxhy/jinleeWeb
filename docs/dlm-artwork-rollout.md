# DLMClub 新版图片部署

## 包含内容

public/brand/dlm-v1/ 包含 66 个可公开访问的静态图片文件：

- operations：17 张运营 PNG + 1 个感谢 GIF。
- prizes：36 张横版奖品／代金券 PNG（原 29 张加本次补充的 7 张）。
- vip：用户提供的 VIP1–VIP12 图片。

lib/brand-artwork-catalog.ts 和 Bot/src/config/brandArtworkCatalog.ts 的映射保持一致。背包、合成材料和合成结果优先显示新版已知奖品图，不受数据库历史 imageUrl 影响；未映射的奖品及用户自定义内容保留现有逻辑。next.config.ts 已允许 /brand/** 本地图片优化。

不修改数据库、价格、概率、权益或订单；不将代金券图用于实际礼物图片。

## 发布

先发布网站代码和整个 public/brand/dlm-v1/ 目录、构建并重启网站，再部署 Bot。Bot 会请求 https://dlmclub.com/brand/dlm-v1/ 下的图片；这些地址必须无需登录可访问，不能受防盗链、身份验证或机器人验证页阻挡。

检查这几个地址的 HTTP 状态和 Content-Type：

- https://dlmclub.com/brand/dlm-v1/operations/01-order-dispatch.png
- https://dlmclub.com/brand/dlm-v1/prizes/01-cupcake-voucher.png
- https://dlmclub.com/brand/dlm-v1/vip/VIP12.png

仅换图不需要数据库迁移。若有静态目录单独发布或 dist/ 打包流程，需要明确包含 public/brand/dlm-v1/。线上历史 Discord 消息不会自动换图。

## 边界

已补齐陪玩评语券、香水／旋转木马／南瓜车／留声机代金券、月冠名92折券／月冠名9折券的新素材，并优先于旧数据库图片展示。

兔兔宝宝／狐狸宝宝／猪猪宝宝／小鸡宝宝按用户明确要求不完善、不添加新图片映射，保留原有显示。老板自定义派单背景、用户头像、名片、礼物墙、收款二维码等不变。

已通过 4 项图片测试、TypeScript 检查及新配置文件 ESLint；66 个文件格式检查通过，新增 7 张与生成来源逐一比对一致。尚未执行生产部署或线上业务测试。
