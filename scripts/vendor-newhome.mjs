import crypto from 'node:crypto';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const SOURCE_ORIGIN = 'https://warhol-arts.webflow.io';
const SOURCE_HOST = 'warhol-arts.webflow.io';
const FINAL_PUBLIC_ROOT = path.join(process.cwd(), 'public', 'newhome');
const PUBLIC_ROOT = path.join(process.cwd(), 'public', 'newhome.__staging');
const ASSET_ROOT = path.join(PUBLIC_ROOT, 'assets');

const PAGES = [
  {
    sourceUrl: `${SOURCE_ORIGIN}/`,
    outputFile: path.join(PUBLIC_ROOT, 'index.html'),
    routePath: '/newhome',
  },
  {
    sourceUrl: `${SOURCE_ORIGIN}/404`,
    outputFile: path.join(PUBLIC_ROOT, '404', 'index.html'),
    routePath: '/newhome/404',
  },
];

const SEEDED_ASSET_URLS = [
  'https://cdn.jsdelivr.net/npm/@splinetool/runtime/build/runtime.js',
  'https://cdn.jsdelivr.net/npm/@splinetool/runtime/build/boolean.js',
  'https://cdn.jsdelivr.net/npm/@splinetool/runtime/build/gaussian-splat-compression.js',
  'https://cdn.jsdelivr.net/npm/@splinetool/runtime/build/howler.js',
  'https://cdn.jsdelivr.net/npm/@splinetool/runtime/build/navmesh.js',
  'https://cdn.jsdelivr.net/npm/@splinetool/runtime/build/opentype.js',
  'https://cdn.jsdelivr.net/npm/@splinetool/runtime/build/physics.js',
  'https://cdn.jsdelivr.net/npm/@splinetool/runtime/build/process.js',
  'https://cdn.jsdelivr.net/npm/@splinetool/runtime/build/ui.js',
  'https://unpkg.com/@splinetool/navmesh-wasm@1.12.95/build/navmesh.wasm',
  'https://unpkg.com/@splinetool/modelling-wasm@1.12.95/build/process.wasm',
  'https://unpkg.com/@splinetool/boolean-wasm@1.12.95/build/boolean.wasm',
  'https://unpkg.com/@splinetool/ui-wasm@1.12.95/build/ui.wasm',
  'https://www.gstatic.com/draco/versioned/decoders/1.5.2/draco_decoder.js',
  'https://www.gstatic.com/draco/versioned/decoders/1.5.2/draco_wasm_wrapper.js',
  'https://www.gstatic.com/draco/versioned/decoders/1.5.2/draco_decoder.wasm',
];

const FALLBACK_TEXT_RESOURCES = new Map([
  [
    'https://cdn.prod.website-files.com/plugins/Animation/assets/wf-placeholder.cd67a2c2ba.json',
    JSON.stringify(
      {
        v: '5.7.4',
        fr: 30,
        ip: 0,
        op: 1,
        w: 1,
        h: 1,
        nm: 'wf-placeholder',
        ddd: 0,
        assets: [],
        layers: [],
      },
      null,
      2,
    ),
  ],
]);

const ALLOWED_HOSTS = new Set([
  SOURCE_HOST,
  'cdn.prod.website-files.com',
  'd3e54v103j8qbb.cloudfront.net',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'ajax.googleapis.com',
  'prod.spline.design',
  'raw.githubusercontent.com',
  'www.gstatic.com',
]);

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.svg',
  '.txt',
  '.xml',
]);

const ASSET_EXTENSIONS = new Set([
  '.avif',
  '.css',
  '.eot',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.mp3',
  '.mp4',
  '.ogg',
  '.otf',
  '.png',
  '.splinecode',
  '.svg',
  '.ttf',
  '.txt',
  '.wasm',
  '.wav',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
  '.xml',
]);

const resources = new Map();
const queue = [];
const queuedUrls = new Set();
const execFileAsync = promisify(execFile);

function hash(input) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 10);
}

function sanitizeSegment(segment) {
  const decoded = decodeURIComponent(segment);
  const sanitized = decoded.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized || 'index';
}

function buildAssetTarget(remoteUrl) {
  const url = new URL(remoteUrl);
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => sanitizeSegment(segment));

  const basename = segments.length > 0 ? segments.pop() : 'index';
  const parsed = path.posix.parse(basename);
  const filenameBase = parsed.name || 'index';
  const extension = parsed.ext || '';
  const searchSuffix = url.search ? `__${hash(url.search)}` : '';
  const filename = `${filenameBase}${searchSuffix}${extension}`;
  const relativeParts = ['assets', sanitizeSegment(url.hostname), ...segments, filename];
  const publicPath = `/newhome/${relativeParts.join('/')}`;

  return {
    filePath: path.join(PUBLIC_ROOT, ...relativeParts),
    publicPath,
  };
}

function isTextContent(remoteUrl, contentType) {
  const extension = path.posix.extname(new URL(remoteUrl).pathname).toLowerCase();
  if (TEXT_EXTENSIONS.has(extension)) {
    return true;
  }

  const normalizedType = contentType.toLowerCase();
  return (
    normalizedType.startsWith('text/') ||
    normalizedType.includes('javascript') ||
    normalizedType.includes('json') ||
    normalizedType.includes('svg') ||
    normalizedType.includes('xml')
  );
}

function shouldDiscoverNestedAssets(remoteUrl, contentType) {
  const extension = path.posix.extname(new URL(remoteUrl).pathname).toLowerCase();
  if (extension === '.css' || extension === '.html' || extension === '.js') {
    return true;
  }

  const normalizedType = contentType.toLowerCase();
  return (
    normalizedType.startsWith('text/html') ||
    normalizedType.startsWith('text/css') ||
    normalizedType.includes('javascript')
  );
}

function guessContentType(remoteUrl) {
  const extension = path.posix.extname(new URL(remoteUrl).pathname).toLowerCase();

  switch (extension) {
    case '.avif':
      return 'image/avif';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.eot':
      return 'application/vnd.ms-fontobject';
    case '.gif':
      return 'image/gif';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.ico':
      return 'image/x-icon';
    case '.jpeg':
    case '.jpg':
      return 'image/jpeg';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.mp3':
      return 'audio/mpeg';
    case '.mp4':
      return 'video/mp4';
    case '.ogg':
      return 'audio/ogg';
    case '.otf':
      return 'font/otf';
    case '.png':
      return 'image/png';
    case '.splinecode':
      return 'application/octet-stream';
    case '.svg':
      return 'image/svg+xml';
    case '.ttf':
      return 'font/ttf';
    case '.txt':
      return 'text/plain; charset=utf-8';
    case '.wasm':
      return 'application/wasm';
    case '.wav':
      return 'audio/wav';
    case '.webm':
      return 'video/webm';
    case '.webp':
      return 'image/webp';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.xml':
      return 'application/xml; charset=utf-8';
    default:
      if (new URL(remoteUrl).hostname === 'unpkg.com' && new URL(remoteUrl).pathname === '/split-type') {
        return 'application/javascript; charset=utf-8';
      }

      return 'application/octet-stream';
  }
}

function normalizeCandidate(rawValue, baseUrl) {
  if (!rawValue) {
    return null;
  }

  const trimmed = rawValue.trim().replace(/^['"]|['"]$/g, '');

  if (
    trimmed === '' ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('javascript:')
  ) {
    return null;
  }

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function isMirrorableAsset(remoteUrl) {
  const url = new URL(remoteUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    return false;
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return false;
  }

  if (url.hostname === SOURCE_HOST && (url.pathname === '/' || url.pathname === '/404')) {
    return false;
  }

  const extension = path.posix.extname(url.pathname).toLowerCase();
  if (ASSET_EXTENSIONS.has(extension)) {
    return true;
  }

  if (url.hostname === 'unpkg.com' && url.pathname === '/split-type') {
    return true;
  }

  return url.pathname.includes('/plugins/Animation/assets/');
}

function collectCandidates(text, baseUrl) {
  const candidates = new Set();
  const patterns = [
    /https?:\/\/[^\s"'()<>\\]+/g,
    /\b(?:src|href|poster|content|data-src)\s*=\s*["']([^"']+)["']/gi,
    /\bsrcset\s*=\s*["']([^"']+)["']/gi,
    /url\(([^)]+)\)/gi,
  ];

  for (const match of text.matchAll(patterns[0])) {
    candidates.add(match[0]);
  }

  for (const match of text.matchAll(patterns[1])) {
    candidates.add(match[1]);
  }

  for (const match of text.matchAll(patterns[2])) {
    const entries = match[1].split(',');
    for (const entry of entries) {
      const candidate = entry.trim().split(/\s+/)[0];
      candidates.add(candidate);
    }
  }

  for (const match of text.matchAll(patterns[3])) {
    candidates.add(match[1]);
  }

  const normalized = new Set();
  for (const candidate of candidates) {
    const resolved = normalizeCandidate(candidate, baseUrl);
    if (resolved && isMirrorableAsset(resolved)) {
      normalized.add(resolved);
    }
  }

  return normalized;
}

function collectSpecialJsAssets(text, remoteUrl) {
  const extra = new Set();
  const baseUrl = new URL(remoteUrl);

  for (const match of text.matchAll(/webflow\.achunk\.[a-z0-9]+\.(?:js)/gi)) {
    extra.add(new URL(match[0], baseUrl).toString());
  }

  for (const match of text.matchAll(/webflow\.achunk\."\+\(\{([\s\S]*?)\}\)\[e\]\+"\.js"/g)) {
    for (const hashMatch of match[1].matchAll(/:"([a-z0-9]+)"/gi)) {
      extra.add(new URL(`webflow.achunk.${hashMatch[1]}.js`, baseUrl).toString());
    }
  }

  return extra;
}

function enqueue(remoteUrl) {
  if (queuedUrls.has(remoteUrl)) {
    return;
  }

  queuedUrls.add(remoteUrl);
  queue.push(remoteUrl);
}

async function fetchText(url) {
  const buffer = await downloadWithCurl(url);
  return buffer.toString('utf8');
}

async function downloadWithCurl(url) {
  try {
    const { stdout } = await execFileAsync(
      'curl',
      [
        '-LfsS',
        '--http1.1',
        '--retry',
        '20',
        '--retry-all-errors',
        '--retry-connrefused',
        '--retry-delay',
        '2',
        '--connect-timeout',
        '20',
        '--user-agent',
        'jinlee-club local vendor',
        url,
      ],
      {
        encoding: 'buffer',
        maxBuffer: 64 * 1024 * 1024,
      },
    );

    return stdout;
  } catch (error) {
    const fallbackResource = buildFallbackResource(url);
    if (fallbackResource) {
      return Buffer.from(fallbackResource.body, 'utf8');
    }

    throw error;
  }
}

function buildFallbackResource(remoteUrl) {
  const fallbackText = FALLBACK_TEXT_RESOURCES.get(remoteUrl);
  if (!fallbackText) {
    return null;
  }

  const { filePath, publicPath } = buildAssetTarget(remoteUrl);
  return {
    remoteUrl,
    localFilePath: filePath,
    localPublicPath: publicPath,
    contentType: 'application/json; charset=utf-8',
    body: fallbackText,
    isText: true,
  };
}

function rewriteTextContent(input, options = {}) {
  const { isHtml = false } = options;
  let output = input;

  const replacements = [...resources.values()]
    .map((resource) => [resource.remoteUrl, resource.localPublicPath])
    .sort((left, right) => right[0].length - left[0].length);

  for (const [remoteUrl, localPublicPath] of replacements) {
    output = output.split(remoteUrl).join(localPublicPath);
  }

  if (isHtml) {
    for (const page of PAGES) {
      const canonicalSource = page.sourceUrl.endsWith('/') ? page.sourceUrl.slice(0, -1) : page.sourceUrl;
      output = output.split(page.sourceUrl).join(page.routePath);
      output = output.split(canonicalSource).join(page.routePath);
    }

    output = output.replace(/(["'])\/404\1/g, `"${
      PAGES.find((page) => page.sourceUrl.endsWith('/404'))?.routePath ?? '/newhome/404'
    }"`);
    output = output.replace(/(["'])\/\1/g, `"${
      PAGES.find((page) => page.sourceUrl.endsWith('/'))?.routePath ?? '/newhome'
    }"`);
    output = output.replaceAll('data-wf-domain="warhol-arts.webflow.io"', 'data-wf-domain="newhome.local"');
    output = output.replaceAll('<link href="https://cdn.prod.website-files.com" rel="preconnect" crossorigin="anonymous"/>', '');
    output = output.replaceAll('<link rel="preconnect" href="https://cdn.prod.website-files.com">', '');
    output = output.replace(/\s+integrity="[^"]*"/g, '');
  }

  output = output.replaceAll(
    'https://unpkg.com/@splinetool/navmesh-wasm@1.12.95/build',
    '/newhome/assets/unpkg.com/_splinetool/navmesh-wasm_1.12.95/build',
  );
  output = output.replaceAll(
    'https://unpkg.com/@splinetool/modelling-wasm@1.12.95/build',
    '/newhome/assets/unpkg.com/_splinetool/modelling-wasm_1.12.95/build',
  );
  output = output.replaceAll(
    'https://unpkg.com/@splinetool/boolean-wasm@1.12.95/build',
    '/newhome/assets/unpkg.com/_splinetool/boolean-wasm_1.12.95/build',
  );
  output = output.replaceAll(
    'https://www.gstatic.com/draco/versioned/decoders/1.5.2/',
    '/newhome/assets/www.gstatic.com/draco/versioned/decoders/1.5.2/',
  );

  return output;
}

async function main() {
  await rm(PUBLIC_ROOT, { recursive: true, force: true });
  await mkdir(ASSET_ROOT, { recursive: true });

  const pagePayloads = [];

  for (const page of PAGES) {
    const html = await fetchText(page.sourceUrl);
    pagePayloads.push({ ...page, html });
    for (const candidate of collectCandidates(html, page.sourceUrl)) {
      enqueue(candidate);
    }
  }

  for (const remoteUrl of SEEDED_ASSET_URLS) {
    enqueue(remoteUrl);
  }

  while (queue.length > 0) {
    const remoteUrl = queue.shift();
    if (!remoteUrl || resources.has(remoteUrl)) {
      continue;
    }

    const body = await downloadWithCurl(remoteUrl);
    const contentType = guessContentType(remoteUrl);
    const { filePath, publicPath } = buildAssetTarget(remoteUrl);
    const resource = {
      remoteUrl,
      localFilePath: filePath,
      localPublicPath: publicPath,
      contentType,
      body: null,
      isText: isTextContent(remoteUrl, contentType),
    };

    if (resource.isText) {
      const text = body.toString('utf8');
      resource.body = text;

      if (shouldDiscoverNestedAssets(remoteUrl, contentType)) {
        for (const candidate of collectCandidates(text, remoteUrl)) {
          enqueue(candidate);
        }
      }

      if (path.posix.extname(new URL(remoteUrl).pathname).toLowerCase() === '.js') {
        for (const candidate of collectSpecialJsAssets(text, remoteUrl)) {
          enqueue(candidate);
        }
      }
    } else {
      resource.body = body;
    }

    resources.set(remoteUrl, resource);

    if (resources.size % 25 === 0) {
      console.log(`Downloaded ${resources.size} assets...`);
    }
  }

  for (const resource of resources.values()) {
    await mkdir(path.dirname(resource.localFilePath), { recursive: true });

    if (resource.isText) {
      await writeFile(resource.localFilePath, rewriteTextContent(resource.body), 'utf8');
    } else {
      await writeFile(resource.localFilePath, resource.body);
    }
  }

  for (const page of pagePayloads) {
    await mkdir(path.dirname(page.outputFile), { recursive: true });
    await writeFile(page.outputFile, rewriteTextContent(page.html, { isHtml: true }), 'utf8');
  }

  const summary = {
    pages: pagePayloads.length,
    assets: resources.size,
  };

  await writeFile(
    path.join(PUBLIC_ROOT, 'manifest.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );

  const remainingChecks = [
    'https://warhol-arts.webflow.io',
    'http://warhol-arts.webflow.io',
    'https://cdn.prod.website-files.com',
    'http://cdn.prod.website-files.com',
    'https://cdnjs.cloudflare.com',
    'http://cdnjs.cloudflare.com',
    'https://cdn.jsdelivr.net',
    'http://cdn.jsdelivr.net',
    'https://ajax.googleapis.com',
    'http://ajax.googleapis.com',
    'https://d3e54v103j8qbb.cloudfront.net',
    'http://d3e54v103j8qbb.cloudfront.net',
  ];

  const scanTargets = [
    path.join(PUBLIC_ROOT, 'index.html'),
    path.join(PUBLIC_ROOT, '404', 'index.html'),
    ...[...resources.values()].filter((resource) => resource.isText).map((resource) => resource.localFilePath),
  ];

  const remainingMatches = [];
  for (const target of scanTargets) {
    const content = await readFile(target, 'utf8');
    for (const needle of remainingChecks) {
      if (content.includes(needle)) {
        remainingMatches.push({ target, needle });
      }
    }
  }

  if (remainingMatches.length > 0) {
    console.warn('Mirror completed with remaining external references:');
    for (const match of remainingMatches) {
      console.warn(`- ${match.needle} in ${path.relative(process.cwd(), match.target)}`);
    }
  } else {
    console.log(`Mirrored ${pagePayloads.length} pages and ${resources.size} assets with local references only.`);
  }

  await rm(FINAL_PUBLIC_ROOT, { recursive: true, force: true });
  await rename(PUBLIC_ROOT, FINAL_PUBLIC_ROOT);

  const librariesRoot = path.join(process.cwd(), 'public', '_libraries');
  await rm(librariesRoot, { recursive: true, force: true });
  await mkdir(librariesRoot, { recursive: true });
  await writeFile(
    path.join(librariesRoot, 'navmesh.js'),
    await readFile(
      path.join(FINAL_PUBLIC_ROOT, 'assets', 'cdn.jsdelivr.net', 'npm', '_splinetool', 'runtime', 'build', 'navmesh.js'),
    ),
  );
  await writeFile(
    path.join(librariesRoot, 'navmesh.wasm'),
    await readFile(
      path.join(
        FINAL_PUBLIC_ROOT,
        'assets',
        'unpkg.com',
        '_splinetool',
        'navmesh-wasm_1.12.95',
        'build',
        'navmesh.wasm',
      ),
    ),
  );
}

await main();
