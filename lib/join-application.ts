// Keep this transport contract in sync with Bot/src/services/recruitmentContract.ts.
export const MAX_JOIN_IMAGE_BYTES = 200 * 1024;
export const MAX_JOIN_BODY_BYTES = 1024 * 1024;
export const MAX_JOIN_GAMES = 20;
export const ASSESSMENT_LABELS = { unassessed: '尚未考核', transfer: '平移考核记录', passed: '已考核通过' } as const;
export type Assessment = keyof typeof ASSESSMENT_LABELS;
export const JOIN_FIELDS = {
  nickname: ['公会昵称', 32], gender: ['性别', 20], voice: ['音色', 80], region: ['所在地区', 100],
  wechat: ['微信号', 64], guild: ['当前挂名公会', 200], inviter: ['邀请人', 100], intro: ['个人简介', 20],
  otherGames: ['其他游戏', 500], sourceGuild: ['来源公会', 100], card: ['大神名片类型', 80], heroes: ['擅长英雄／位置', 150],
} as const;
export type JoinFields = Record<keyof typeof JOIN_FIELDS, string>;
export type JoinGame = { name: string; level: string; price: string; unit: '小时' | '局' };
export type JoinApplication = { discordId: string; fields: JoinFields; exclusive: '是' | '否'; assessment: Assessment; tier: string; games: JoinGame[] };
export type JoinImage = { kind: 'photo' | 'rank' | 'transfer' | 'passed'; contentType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string };
export const JOIN_IMAGE_LABELS = { photo: '名片使用图片', rank: '游戏段位截图', transfer: '其他公会考核记录', passed: '考核区通过记录' } as const;
export const JOIN_IMAGE_IDS = { photo: 'personal-photos', rank: 'rank-images', transfer: 'assessment-records', passed: 'passed-records' } as const;
export type JoinErrors = Record<string, string>;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const hasControlCharacters = (value: string) => Array.from(value).some((c) => c.charCodeAt(0) < 32 && !'\n\r\t'.includes(c));

export function validateJoinApplication(raw: unknown, discordId: string) {
  const input = object(raw);
  const values = object(input.fields);
  const errors: JoinErrors = {};
  const text = (value: unknown, key: string, label: string, max: number, required = true) => {
    const result = typeof value === 'string' ? value.trim() : '';
    if (required && !result) errors[key] = `请填写${label}。`;
    else if (result.length > max) errors[key] = `${label}最多 ${max} 个字。`;
    else if (hasControlCharacters(result)) errors[key] = `${label}包含无效字符。`;
    return result;
  };
  if (!/^\d{17,20}$/.test(discordId)) errors.discord = '请先通过 Discord 登录。';
  const assessment: Assessment = input.assessment === 'transfer' || input.assessment === 'passed' ? input.assessment : 'unassessed';
  if (!(typeof input.assessment === 'string' && Object.hasOwn(ASSESSMENT_LABELS, input.assessment))) errors.assessment = '请选择申请方式。';
  const tier = assessment === 'unassessed' ? '' : text(input.tier, 'tier', '考核过的水平', 100);
  const master = assessment !== 'unassessed' && tier.includes('大神');
  const fields = {} as JoinFields;
  for (const key of Object.keys(JOIN_FIELDS) as (keyof JoinFields)[]) {
    const [label, max] = JOIN_FIELDS[key];
    const inactive = (key === 'sourceGuild' && assessment !== 'transfer') || ((key === 'card' || key === 'heroes') && !master);
    fields[key] = inactive ? '' : text(values[key], key, label, max, key !== 'inviter' && key !== 'otherGames');
  }
  if (fields.gender && !['男', '女'].includes(fields.gender)) errors.gender = '请选择男或女。';
  const exclusive = input.exclusive === '是' ? '是' : '否';
  if (input.exclusive !== '是' && input.exclusive !== '否') errors.exclusive = '请选择是否独家入驻。';
  const rawGames = Array.isArray(input.games) ? input.games : [];
  if (!rawGames.length || rawGames.length > MAX_JOIN_GAMES) errors.games = `请填写 1–${MAX_JOIN_GAMES} 个主营项目。`;
  const games = rawGames.slice(0, MAX_JOIN_GAMES).map((rawGame, index): JoinGame => {
    const game = object(rawGame);
    const name = text(game.name, `game-${index}`, '游戏／项目', 80);
    const level = text(game.level, `level-${index}`, '游戏水平／段位', 100);
    const price = text(game.price, `price-${index}`, '单价', 10);
    if (price && !/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(price)) errors[`price-${index}`] = '单价须为非负金额，最多两位小数。';
    if (game.unit !== '小时' && game.unit !== '局') errors[`price-${index}`] = '请选择计价单位。';
    return { name, level, price, unit: game.unit === '局' ? '局' : '小时' };
  });
  return { data: { discordId, fields, assessment, exclusive, tier, games } satisfies JoinApplication, errors };
}

export function validateJoinImages(raw: unknown, assessment: Assessment) {
  const errors: JoinErrors = {};
  const images: JoinImage[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(raw) || raw.length > 3) return { images, errors: { 'personal-photos': '图片资料格式不正确，请重新选择图片。' } };
  for (const value of raw) {
    const image = object(value);
    const kind = image.kind as JoinImage['kind'];
    if (!Object.hasOwn(JOIN_IMAGE_LABELS, kind) || (kind !== 'photo' && kind !== 'rank' && kind !== assessment) || seen.has(kind)) {
      errors['personal-photos'] = '图片资料不匹配，请检查申请方式和图片。';
      continue;
    }
    seen.add(kind);
    const key = JOIN_IMAGE_IDS[kind];
    const data = typeof image.data === 'string' ? image.data : '';
    if (!data || data.length > Math.ceil(MAX_JOIN_IMAGE_BYTES / 3) * 4 || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      errors[key] = '图片处理失败，请重新选择图片。'; continue;
    }
    let bytes = '';
    try { bytes = atob(data); } catch { errors[key] = '图片数据无效，请重新选择图片。'; continue; }
    const type = image.contentType;
    const valid = (type === 'image/jpeg' && bytes.startsWith('\xff\xd8\xff'))
      || (type === 'image/png' && bytes.startsWith('\x89PNG\r\n\x1a\n'))
      || (type === 'image/webp' && bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP');
    if (!valid || bytes.length > MAX_JOIN_IMAGE_BYTES) { errors[key] = '请选择有效的 JPG、PNG 或 WebP 图片。'; continue; }
    images.push({ kind, contentType: type as JoinImage['contentType'], data });
  }
  for (const kind of ['photo', ...(assessment === 'unassessed' ? [] : [assessment])] as JoinImage['kind'][]) {
    if (!seen.has(kind)) errors[JOIN_IMAGE_IDS[kind]] = `请上传${JOIN_IMAGE_LABELS[kind]}。`;
  }
  return { images: images.sort((a, b) => a.kind.localeCompare(b.kind)), errors };
}
