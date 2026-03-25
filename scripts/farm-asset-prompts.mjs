const cropStageDirections = {
  SPROUT: 'just sprouted, tiny elegant sprouts emerging from the soil, minimal foliage, early growth',
  YOUNG: 'young plant, clearly growing, more leaves and volume, still not close to harvest',
  MATURE: 'late growth stage, full healthy plant, almost harvestable, rich shape, but not the final ripe state',
  READY: 'fully ready for harvest, most iconic and rewarding final state',
};

const cropConfigs = {
  WHEAT: {
    slug: 'wheat',
    name: 'wheat',
    stageQualities: { READY: 'medium' },
    notes: 'warm gold crop, soft elegant shape, slightly premium social-game look',
  },
  ROSE: {
    slug: 'rose',
    name: 'rose',
    stageQualities: { READY: 'medium' },
    notes: 'ornamental rose crop, rich pink-red blossoms, elegant but readable',
  },
  KOI_FLOWER: {
    slug: 'koi-flower',
    name: 'koi flower',
    stageQualities: { READY: 'high', MATURE: 'medium' },
    notes: 'signature premium crop, red and gold petals, most on-theme for koi manor',
  },
  MYSTERY_FRUIT: {
    slug: 'mystery-fruit',
    name: 'mystery fruit',
    stageQualities: { READY: 'high', MATURE: 'medium' },
    notes: 'rare jewel-like fruit, red-gold-green palette, slightly magical but still grounded in the manor theme',
  },
};

function buildCropPrompt(cropName, stage, notes) {
  return [
    'Create an original isometric crop sprite for a casual web farming game.',
    `Crop: ${cropName}.`,
    `Growth stage: ${stage.toLowerCase()}.`,
    cropStageDirections[stage],
    `Style notes: ${notes}.`,
    'Theme: koi manor, elegant warm colors, painterly game art, readable at small size, cute but polished.',
    'Transparent background, centered composition, no text, no UI, no watermark.',
  ].join(' ');
}

const cropPromptEntries = Object.entries(cropConfigs).flatMap(([cropCode, config]) =>
  Object.keys(cropStageDirections).map((stage) => {
    const key = `${config.slug}-${stage.toLowerCase()}`;
    return [
      key,
      {
        fileName: `${config.slug}-${stage.toLowerCase()}.webp`,
        size: '1024x1024',
        quality: config.stageQualities?.[stage] ?? 'medium',
        prompt: buildCropPrompt(config.name, stage, config.notes),
      },
    ];
  }),
);

export const FARM_ASSET_PROMPTS = {
  'scene-main': {
    fileName: 'manor-base.webp',
    size: '1536x1024',
    quality: 'high',
    prompt: [
      'Create an original browser-game farm background in a 2.5D isometric style.',
      'Theme: koi manor, Chinese courtyard, red lacquer bridge, koi pond, warm golden light, spring garden.',
      'Composition: a single coherent manor scene with koi pond on the left, manor house on the right, courtyard paths and fences, soft clouds, elegant playful social-game mood.',
      'The center must be a large clean expandable terrace for UI overlays: do not draw any crop blocks, plot frames, farm squares, repeated beds, furrows, or visible tile grid.',
      'The open terrace should be flat, readable, and visually consistent in scale so the frontend can place many equal interactive plots on top of it later.',
      'Style: polished casual game art, painterly, colorful, readable, friendly, high cohesion, not realistic, not flat icon style, not a collage, not sticker-like.',
      'Colors: lacquer red, warm gold, jade green, pond blue, cream highlights.',
      'No text, no UI, no characters, no watermark.',
    ].join(' '),
  },
  'plot-frame': {
    fileName: 'plot-frame.webp',
    size: '1024x1024',
    quality: 'medium',
    editReferenceFileName: 'plot-empty.webp',
    inputFidelity: 'high',
    prompt: [
      'Create a single reusable isometric farm plot tile for a casual web game.',
      'It must be one isolated plot asset only, centered, with transparent background.',
      'Match the uploaded reference image composition, camera angle, footprint, silhouette, and scale as closely as possible.',
      'Theme: koi manor terrace farmland, warm gold trim, elegant courtyard material language, rich brown soil.',
      'Do not include pond, bridge, fence, stairs, platform base, courtyard floor, walls, house, sky, multiple plots, or any full scene composition.',
      'Readable from top-down isometric angle, clean silhouette, game-ready, no text, no scene, no environment.',
    ].join(' '),
  },
  'plot-empty': {
    fileName: 'plot-empty.webp',
    size: '1024x1024',
    quality: 'medium',
    prompt: [
      'Create a single reusable isometric empty farm plot state for a casual web game.',
      'It must be one isolated plot asset only, centered, with transparent background.',
      'Match the uploaded reference image composition, camera angle, footprint, silhouette, and scale as closely as possible.',
      'Theme: koi manor terrace soil, warm gold highlights, no crop planted yet.',
      'Do not include pond, bridge, fence, stairs, platform base, courtyard floor, walls, house, sky, multiple plots, or any full scene composition.',
      'Game-ready, centered composition, no text, no scene, no environment.',
    ].join(' '),
  },
  'plot-harvested': {
    fileName: 'plot-harvested.webp',
    size: '1024x1024',
    quality: 'medium',
    editReferenceFileName: 'plot-empty.webp',
    inputFidelity: 'high',
    prompt: [
      'Create a single reusable isometric harvested farm plot state for a casual web game.',
      'It must be one isolated plot asset only, centered, with transparent background.',
      'Match the uploaded reference image composition, camera angle, footprint, silhouette, and scale as closely as possible.',
      'Theme: koi manor terrace soil after harvest, slightly disturbed soil rows, warm gold highlights.',
      'Do not include pond, bridge, fence, stairs, platform base, courtyard floor, walls, house, sky, multiple plots, or any full scene composition.',
      'Game-ready, centered composition, no text, no scene, no environment.',
    ].join(' '),
  },
  'wood-sign': {
    fileName: 'wood-sign.webp',
    size: '1024x1024',
    quality: 'medium',
    prompt: [
      'Create an original casual game UI sign panel.',
      'Theme: lacquered red wood, gold trim, elegant koi manor, warm soft highlights, premium but playful.',
      'Transparent background, no text, centered composition.',
    ].join(' '),
  },
  ...Object.fromEntries(cropPromptEntries),
};

export const FARM_CORE_ASSET_KEYS = ['scene-main', 'plot-frame', 'plot-empty', 'plot-harvested', 'wood-sign'];
export const FARM_CROP_ASSET_KEYS = cropPromptEntries.map(([key]) => key);
