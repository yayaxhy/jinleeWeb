export const COPY_IMAGE_MAX_BYTES = 50 * 1024 * 1024;

/** Shared by the browser and upload handler; no server-only imports. */
export function copyImageFailureMessage(code: unknown): string {
  switch (code) {
    case 'too_large': return '图片不能超过 50MB。';
    case 'unsupported': return '图片格式不支持，请选择 JPG、PNG、WebP 或 GIF。';
    case 'unreadable': return '图片文件无法读取，请重新选择。';
    case 'dimensions': return '图片尺寸过大，请缩小后上传。';
    case 'missing': return '图片未找到，请重新上传。';
    case 'forbidden': return '当前账号没有文案管理权限。';
    case 'invalid_origin': return '请从当前网站后台提交';
    default: return '图片上传失败，请重试。';
  }
}
