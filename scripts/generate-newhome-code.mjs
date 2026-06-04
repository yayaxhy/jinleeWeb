import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

function renderModule({ htmlAttributes, preambleHtml, postambleHtml, headHtml, bodyParts, title, description }) {
  return `export const newhomeDocument = {
  htmlAttributes: ${JSON.stringify(htmlAttributes, null, 2)} as const,
  title: ${JSON.stringify(title)},
  description: ${JSON.stringify(description)},
  preambleHtml: String.raw\`${escapeTemplateLiteral(preambleHtml)}\`,
  postambleHtml: String.raw\`${escapeTemplateLiteral(postambleHtml)}\`,
  headHtml: String.raw\`${escapeTemplateLiteral(headHtml)}\`,
  bodyParts: [
${bodyParts
  .map(
    (part) => `    {
      id: ${JSON.stringify(part.id)},
      html: String.raw\`${escapeTemplateLiteral(part.html)}\`,
    },`,
  )
  .join('\n')}
  ] as const,
} as const;
`;
}

async function generateOne({ inputPath, outputPath, sourceKind }) {
  const html = await readFile(inputPath, 'utf8');
  const headHtml = extractSection(html, 'head');
  const bodyHtml = extractSection(html, 'body');

  const moduleSource = renderModule({
    htmlAttributes: extractHtmlAttributes(html),
    title: extractTitle(headHtml),
    description: extractDescription(headHtml),
    preambleHtml: extractPreambleHtml(html),
    postambleHtml: extractPostambleHtml(html),
    headHtml,
    bodyParts: buildBodyParts(bodyHtml, sourceKind),
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, moduleSource, 'utf8');
}

async function main() {
  await generateOne({
    inputPath: path.join(projectRoot, 'public', 'newhome', 'index.html'),
    outputPath: path.join(projectRoot, 'app', 'newhome', '_generated', 'index.ts'),
    sourceKind: 'index',
  });

  await generateOne({
    inputPath: path.join(projectRoot, 'public', 'newhome', '404', 'index.html'),
    outputPath: path.join(projectRoot, 'app', 'newhome', '404', '_generated', 'index.ts'),
    sourceKind: '404',
  });

  console.log('Generated code-backed newhome documents.');
}

await main();
