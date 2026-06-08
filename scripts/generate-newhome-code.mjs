import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();

function extractSection(html, tagName) {
  const openTagMatch = html.match(new RegExp(`<${tagName}[^>]*>`, 'i'));
  if (!openTagMatch || openTagMatch.index === undefined) {
    throw new Error(`Missing <${tagName}> in source HTML`);
  }

  const contentStart = openTagMatch.index + openTagMatch[0].length;

  if (tagName === 'head') {
    const bodyOpenIndex = html.search(/<body[^>]*>/i);
    if (bodyOpenIndex === -1) {
      throw new Error('Missing <body> in source HTML');
    }

    const headCloseIndex = html.lastIndexOf('</head>', bodyOpenIndex);
    if (headCloseIndex === -1) {
      throw new Error('Missing closing </head> in source HTML');
    }

    return html.slice(contentStart, headCloseIndex);
  }

  if (tagName === 'body') {
    const bodyCloseIndex = html.toLowerCase().lastIndexOf('</body>');
    if (bodyCloseIndex === -1) {
      throw new Error('Missing closing </body> in source HTML');
    }

    return html.slice(contentStart, bodyCloseIndex);
  }

  const closeIndex = html.toLowerCase().indexOf(`</${tagName.toLowerCase()}>`, contentStart);
  if (closeIndex === -1) {
    throw new Error(`Missing closing </${tagName}> in source HTML`);
  }

  return html.slice(contentStart, closeIndex);
}

function extractPreambleHtml(html) {
  return html.match(/<!DOCTYPE html>([\s\S]*?)<html/i)?.[1] ?? '';
}

function extractPostambleHtml(html) {
  return html.match(/<\/html>([\s\S]*)$/i)?.[1] ?? '';
}

function extractHtmlAttributes(html) {
  const match = html.match(/<html\s+([^>]+)>/i);
  const rawAttributes = match?.[1] ?? '';
  const attributes = {};
  const attributePattern = /([:@\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

  for (const attributeMatch of rawAttributes.matchAll(attributePattern)) {
    const [, name, doubleQuoted, singleQuoted, bare] = attributeMatch;
    attributes[name] = doubleQuoted ?? singleQuoted ?? bare ?? '';
  }

  return attributes;
}

function extractTitle(headHtml) {
  return headHtml.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? 'WarholArts ©';
}

function extractDescription(headHtml) {
  return headHtml.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1]?.trim() ?? '';
}

function escapeTemplateLiteral(value) {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function sliceByMarkers(source, markers) {
  const indexedMarkers = markers.map((marker) => {
    const index = source.indexOf(marker.match);
    if (index === -1) {
      throw new Error(`Missing marker: ${marker.match}`);
    }

    return {
      ...marker,
      index,
    };
  });

  return indexedMarkers.map((marker, currentIndex) => {
    const nextIndex = indexedMarkers[currentIndex + 1]?.index ?? source.length;
    return {
      id: marker.id,
      html: source.slice(marker.index, nextIndex),
    };
  });
}

function buildBodyParts(bodyHtml, sourceKind) {
  if (sourceKind === 'index') {
    const heroStart = bodyHtml.indexOf('<section id="hero-section"');
    const footerStart = bodyHtml.indexOf('<footer id="footer-sec" data-hide-progress="" class="footer lazy-section">');
    const scriptsStart = bodyHtml.indexOf(
      '<script src="/newhome/assets/d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8__516609640c.js"',
    );

    if (heroStart === -1 || footerStart === -1 || scriptsStart === -1) {
      throw new Error('Failed to locate one or more required index body anchors.');
    }

    return [
      { id: 'frame', html: bodyHtml.slice(0, heroStart) },
      ...sliceByMarkers(bodyHtml.slice(heroStart, footerStart), [
        { id: 'hero', match: '<section id="hero-section"' },
        { id: 'elvis', match: '<section id="4-elvis"' },
        { id: 'quote', match: '<section id="section-quote"' },
        { id: 'bananas', match: '<section id="section-bananas"' },
        { id: 'monroe', match: '<section id="section-monroe"' },
        { id: 'expo', match: '<section id="section-expo"' },
        { id: 'tickets', match: '<section id="sec-tickets"' },
      ]),
      { id: 'footer', html: bodyHtml.slice(footerStart, scriptsStart) },
      { id: 'runtimeScripts', html: bodyHtml.slice(scriptsStart) },
    ];
  }

  const scriptsStart = bodyHtml.indexOf(
    '<script src="/newhome/assets/d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8__516609640c.js"',
  );
  const sectionStart = bodyHtml.indexOf('<section id="hero-section"');

  if (scriptsStart === -1 || sectionStart === -1) {
    throw new Error('Failed to locate one or more required 404 body anchors.');
  }

  return [
    { id: 'frame', html: bodyHtml.slice(0, sectionStart) },
    { id: 'notFoundScene', html: bodyHtml.slice(sectionStart, scriptsStart) },
    { id: 'runtimeScripts', html: bodyHtml.slice(scriptsStart) },
  ];
}

function toCamelCase(value) {
  return value
    .replace(/^[^a-zA-Z]+/, '')
    .replace(/[-_]+([a-zA-Z0-9])/g, (_match, letter) => letter.toUpperCase())
    .replace(/^[A-Z]/, (letter) => letter.toLowerCase());
}

function toKebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function renderPartModule(part, sourceKind) {
  const constName = `${toCamelCase(part.id)}Part`;

  if (sourceKind === 'index' && part.id === 'hero') {
    const hoverStartMarker = '<div class="warhol_hover-video w-embed w-script"><script>';
    const hoverEndMarker = '<div class="hero_display-wrapper">';
    const hoverStartIndex = part.html.indexOf(hoverStartMarker);
    const hoverEndIndex = part.html.indexOf(hoverEndMarker, hoverStartIndex);

    if (hoverStartIndex === -1 || hoverEndIndex === -1) {
      throw new Error('Failed to locate hover video boundaries in hero section.');
    }

    const beforeHover = part.html.slice(0, hoverStartIndex);
    const afterHover = part.html.slice(hoverEndIndex);

    return `import { newhomeHoverVideoEmbedHtml } from '@/lib/newhome-hover-fix';

export const ${constName} = {
  id: ${JSON.stringify(part.id)},
  html:
    String.raw\`${escapeTemplateLiteral(beforeHover)}\` +
    newhomeHoverVideoEmbedHtml +
    String.raw\`${escapeTemplateLiteral(afterHover)}\`,
} as const;
`;
  }

  return `export const ${constName} = {
  id: ${JSON.stringify(part.id)},
  html: String.raw\`${escapeTemplateLiteral(part.html)}\`,
} as const;
`;
}

function renderDocumentModule({ htmlAttributes, preambleHtml, postambleHtml, headHtml, bodyParts, title, description }) {
  const imports = bodyParts
    .map((part) => {
      const fileName = toKebabCase(part.id);
      const constName = `${toCamelCase(part.id)}Part`;
      return `import { ${constName} } from './parts/${fileName}';`;
    })
    .join('\n');

  const bodyPartList = bodyParts.map((part) => `${toCamelCase(part.id)}Part`).join(', ');

  return `${imports}

export const newhomeDocument = {
  htmlAttributes: ${JSON.stringify(htmlAttributes, null, 2)} as const,
  title: ${JSON.stringify(title)},
  description: ${JSON.stringify(description)},
  preambleHtml: String.raw\`${escapeTemplateLiteral(preambleHtml)}\`,
  postambleHtml: String.raw\`${escapeTemplateLiteral(postambleHtml)}\`,
  headHtml: String.raw\`${escapeTemplateLiteral(headHtml)}\`,
  bodyParts: [${bodyPartList}] as const,
} as const;
`;
}

async function writeDocumentModules({ inputPath, outputDir, sourceKind }) {
  const html = await readFile(inputPath, 'utf8');
  const headHtml = extractSection(html, 'head');
  const bodyHtml = extractSection(html, 'body');
  const bodyParts = buildBodyParts(bodyHtml, sourceKind);
  const partsDir = path.join(outputDir, 'parts');

  await rm(outputDir, { force: true, recursive: true });
  await mkdir(partsDir, { recursive: true });

  for (const part of bodyParts) {
    const fileName = `${toKebabCase(part.id)}.ts`;
    await writeFile(path.join(partsDir, fileName), renderPartModule(part, sourceKind), 'utf8');
  }

  const documentSource = renderDocumentModule({
    htmlAttributes: extractHtmlAttributes(html),
    title: extractTitle(headHtml),
    description: extractDescription(headHtml),
    preambleHtml: extractPreambleHtml(html),
    postambleHtml: extractPostambleHtml(html),
    headHtml,
    bodyParts,
  });

  await writeFile(path.join(outputDir, 'document.ts'), documentSource, 'utf8');
}

async function main() {
  await writeDocumentModules({
    inputPath: path.join(projectRoot, 'public', 'newhome', 'index.html'),
    outputDir: path.join(projectRoot, 'app', 'newhome', '_source'),
    sourceKind: 'index',
  });

  await writeDocumentModules({
    inputPath: path.join(projectRoot, 'public', 'newhome', '404', 'index.html'),
    outputDir: path.join(projectRoot, 'app', 'newhome', '404', '_source'),
    sourceKind: '404',
  });

  console.log('Generated source-backed newhome document modules.');
}

await main();
