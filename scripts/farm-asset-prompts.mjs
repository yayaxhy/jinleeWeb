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
      'Create an original bright browser-game farm background in a 2.5D isometric old-web-game style.',
      'Theme: koi manor, sunny spring day, Chinese courtyard manor, warm playful social farming game.',
      'Composition: a complete natural farming manor scene, koi pond and red bridge on the left, a smaller manor house on the right, layered grass and paths, distant hills, and a large central-lower farm field zone as the main gameplay area.',
      'Do not reserve blank HUD space. The image should read as a complete scene by itself, while keeping the upper part relatively clean and calm enough for overlay UI later.',
      'The farm field zone must be the clear visual focus: it should be significantly larger and dominate the center-lower half of the scene.',
      'The field should be a broad light earthen area, closer to a clean rectangular field than a decorative terrace, suitable for a continuous 4x4 farm layout embedded into the ground later.',
      'Do not paint individual crop tiles, plot frames, furrows, or visible square UI blocks into the field. The field should have subtle farmland texture, but not a fixed grid.',
      'The field area should feel proportional to the whole scene, not tiny, and it should sit slightly below center like a classic browser farm game.',
      'The house should stay smaller and secondary. The koi pond and bridge should remain decorative side elements and should not visually compete with the field.',
      'Small decorative props are welcome, such as stones, jars, flowers, path detail, lotus leaves, or tiny farm objects, but they must remain secondary and must not reduce the apparent size or visual dominance of the field.',
      'The image should feel more sunlit, cheerful, and lively than ceremonial: brighter daylight, healthy grass, soft hills, clearer pathways, and a slightly busier browser-game environment.',
      'The koi pond should use smaller koi fish and include lotus leaves or lotus flowers; avoid oversized koi that dominate the left side.',
      'Keep the upper background clean and stable: no streaks, no banding, no glitch-like artifacts.',
      'Add a little more farm-life richness near the field with subtle small props or path detail, but do not clutter the farm area.',
      'Style: polished casual game art, painterly, colorful, readable, friendly, high cohesion, not realistic, not flat icon style, not a collage, not sticker-like.',
      'Colors: bright warm gold, spring green, koi pond blue, lacquer red accents, jade roof green, cream highlights.',
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
  'field-surface': {
    fileName: 'field-surface.webp',
    size: '1536x1024',
    quality: 'high',
    prompt: [
      'Create a full-scene transparent overlay for a 2.5D browser farm game background.',
      'Only render a thin in-ground farm field skin exactly where the center-lower gameplay field would sit; everything else must remain transparent.',
      'The field must read as one continuous 4x4 cultivated farmland surface with strong cohesion, accurate 2.5D perspective, and seamless internal divisions.',
      'The 16 cells should feel cut into one shared field on the ground, not like 16 separate floating tiles.',
      'Absolutely no floating slab, no thick platform, no visible side faces, no pedestal, no isolated object render, no detached diamond tile, no boxy 3D base.',
      'The result should feel like a top surface painted onto the ground with subtle depth only from grooves, soil variation, and thin seams.',
      'Style: bright sunny koi manor, polished painterly browser-game art, warm earthen soil, subtle furrows, elegant soft highlights, gentle embedded 3D depth.',
      'Do not include crops, tools, buildings, pond, bridge, paths, grass, sky, UI, text, or any non-field element.',
      'This asset will be composited over the manor background, so it must only contain the unified farmland surface and internal 4x4 divisions.',
      'Transparent background everywhere outside the field surface.',
    ].join(' '),
  },
  'field-rim': {
    fileName: 'field-rim.webp',
    size: '1536x1024',
    quality: 'high',
    prompt: [
      'Create a full-scene transparent overlay for a 2.5D browser farm game background.',
      'Only render thin earthen edge accents, border depth, and contact-shadow details for the same center-lower field area; everything else must remain transparent.',
      'The rim must align to one integrated 4x4 field and feel embedded into the ground, not like separate tile borders.',
      'Absolutely no heavy platform, no thick floating base, no visible underside, no detached object render.',
      'Style: bright koi manor browser farm game, warm clay and earthen tones, gentle 3D depth, elegant stylized game rendering, seamless and cohesive.',
      'Do not include crops, buildings, grass, pond, bridge, UI, text, or any other scene content.',
      'This asset will be composited over the existing manor background and under crop states, so it should only contain the field edge accents and shallow 3D edging.',
      'Transparent background everywhere outside the rim.',
    ].join(' '),
  },
  ...Object.fromEntries(cropPromptEntries),
};

export const FARM_CORE_ASSET_KEYS = ['scene-main', 'plot-frame', 'plot-empty', 'plot-harvested', 'wood-sign', 'field-surface', 'field-rim'];
export const FARM_CROP_ASSET_KEYS = cropPromptEntries.map(([key]) => key);
