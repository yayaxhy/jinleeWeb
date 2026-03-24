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
    prompt: [
      'Create a single reusable isometric farm plot tile for a casual web game.',
      'It must be one isolated plot asset only, centered, with transparent background.',
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
      'Theme: koi manor terrace soil, warm gold highlights, no crop planted yet.',
      'Do not include pond, bridge, fence, stairs, platform base, courtyard floor, walls, house, sky, multiple plots, or any full scene composition.',
      'Game-ready, centered composition, no text, no scene, no environment.',
    ].join(' '),
  },
  'plot-harvested': {
    fileName: 'plot-harvested.webp',
    size: '1024x1024',
    quality: 'medium',
    prompt: [
      'Create a single reusable isometric harvested farm plot state for a casual web game.',
      'It must be one isolated plot asset only, centered, with transparent background.',
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
  'wheat-ready': {
    fileName: 'wheat-ready.webp',
    size: '1024x1024',
    quality: 'medium',
    prompt: [
      'Create an original isometric crop sprite for a casual web farming game.',
      'Crop: wheat.',
      'Growth stage: ready.',
      'Theme: koi manor, elegant warm colors, painterly game art, readable at small size, cute but polished, no text.',
      'Transparent background, centered composition.',
    ].join(' '),
  },
  'rose-ready': {
    fileName: 'rose-ready.webp',
    size: '1024x1024',
    quality: 'medium',
    prompt: [
      'Create an original isometric crop sprite for a casual web farming game.',
      'Crop: rose.',
      'Growth stage: ready.',
      'Theme: koi manor, elegant warm colors, painterly game art, readable at small size, cute but polished, no text.',
      'Transparent background, centered composition.',
    ].join(' '),
  },
  'koi-flower-ready': {
    fileName: 'koi-flower-ready.webp',
    size: '1024x1024',
    quality: 'medium',
    prompt: [
      'Create an original isometric crop sprite for a casual web farming game.',
      'Crop: koi flower.',
      'Growth stage: ready.',
      'Theme: koi manor, signature premium crop, red and gold petals, painterly game art, readable at small size, cute but polished, no text.',
      'Transparent background, centered composition.',
    ].join(' '),
  },
  'mystery-fruit-ready': {
    fileName: 'mystery-fruit-ready.webp',
    size: '1024x1024',
    quality: 'medium',
    prompt: [
      'Create an original isometric crop sprite for a casual web farming game.',
      'Crop: mystery fruit.',
      'Growth stage: ready.',
      'Theme: koi manor, jewel-like rare fruit, red-gold-green palette, painterly game art, readable at small size, cute but polished, no text.',
      'Transparent background, centered composition.',
    ].join(' '),
  },
};

export const FARM_CORE_ASSET_KEYS = ['scene-main', 'plot-frame', 'plot-empty', 'plot-harvested', 'wood-sign'];
