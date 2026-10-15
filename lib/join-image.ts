'use client';
import { MAX_JOIN_IMAGE_BYTES, type JoinImage } from './join-application';

// Accept original images regardless of file size. Resize locally for reliable delivery.
export async function prepareJoinImage(file: File, kind: JoinImage['kind']): Promise<JoinImage> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('invalid_image');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas_unavailable');
    let edge = Math.min(2400, Math.max(image.naturalWidth, image.naturalHeight));
    for (let attempt = 0; attempt < 12; attempt++) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.78, 0.65]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
        if (blob && blob.size > 0 && blob.size <= MAX_JOIN_IMAGE_BYTES) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('image_read_failed'));
            reader.readAsDataURL(blob);
          });
          return { kind, contentType: blob.type as JoinImage['contentType'], data: dataUrl.slice(dataUrl.indexOf(',') + 1) };
        }
      }
      edge *= 0.8;
    }
    throw new Error('image_processing_failed');
  } finally {
    image.src = '';
    URL.revokeObjectURL(url);
  }
}
