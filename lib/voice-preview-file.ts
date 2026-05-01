import fs from 'fs/promises';
import path from 'path';

export const VOICE_PREVIEW_TARGET_DIR = path.join(process.cwd(), 'public', 'peiwan-voice-preview');

const EXTENSION_CONTENT_TYPE_MAP: Record<string, string> = {
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
};

export const sanitizeVoicePreviewFilename = (filename?: string | null) =>
  path.basename(String(filename ?? '').trim()).replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '');

export const resolveStoredVoicePreviewFileNameFromUrl = (rawUrl?: string | null) => {
  const value = String(rawUrl ?? '').trim();
  if (!value) return '';
  try {
    return sanitizeVoicePreviewFilename(path.basename(new URL(value).pathname));
  } catch {
    if (value.startsWith('/')) {
      return sanitizeVoicePreviewFilename(path.basename(value));
    }
    return '';
  }
};

export const resolveVoicePreviewContentTypeFromFileName = (filename?: string | null) => {
  const ext = path.extname(String(filename ?? '').trim()).toLowerCase();
  return EXTENSION_CONTENT_TYPE_MAP[ext] ?? 'application/octet-stream';
};

export const buildVoicePreviewAudioResponse = async (
  request: Request,
  filePath: string,
  downloadName: string,
  includeBody = true,
) => {
  const fileBuffer = await fs.readFile(filePath);
  const size = fileBuffer.byteLength;
  const rangeHeader = request.headers.get('range');
  const contentType = resolveVoicePreviewContentTypeFromFileName(downloadName);

  if (rangeHeader?.startsWith('bytes=')) {
    const [startRaw, endRaw] = rangeHeader.slice(6).split('-', 2);
    const parsedStart = Number.parseInt(startRaw ?? '', 10);
    const parsedEnd = Number.parseInt(endRaw ?? '', 10);
    const start = Number.isFinite(parsedStart) ? parsedStart : 0;
    const end = Number.isFinite(parsedEnd) ? parsedEnd : size - 1;

    if (start < 0 || start >= size || end < start) {
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
        },
      });
    }

    const safeEnd = Math.min(end, size - 1);
    const chunk = includeBody ? fileBuffer.subarray(start, safeEnd + 1) : null;
    return new Response(chunk, {
      status: 206,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(safeEnd - start + 1),
        'Content-Range': `bytes ${start}-${safeEnd}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return new Response(includeBody ? fileBuffer : null, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      'Cache-Control': 'no-store',
    },
  });
};
