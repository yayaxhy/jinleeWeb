import { CopyImageStorageError, readCopyImageBody, storeCopyImage } from './editable-copy-image-storage';
import { isSameOriginKnowledgeWrite } from './knowledge-validation';

type Dependencies = {
  session: () => Promise<{ discordId?: string | null } | null>;
  isAdmin: (id: string) => boolean;
  publicUrl?: string;
  store?: typeof storeCopyImage;
};

const json = (body: unknown, status: number) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store' },
});

export async function handlePointShopImageUpload(request: Request, dependencies: Dependencies) {
  try {
    const session = await dependencies.session();
    if (!session?.discordId || !dependencies.isAdmin(session.discordId)) {
      return json({ error: 'forbidden' }, 403);
    }
    if (!isSameOriginKnowledgeWrite(request, dependencies.publicUrl)) {
      return json({ error: 'invalid_origin' }, 403);
    }
    const bytes = await readCopyImageBody(request);
    const stored = await (dependencies.store ?? storeCopyImage)(bytes);
    return json({ ok: true, ...stored }, 200);
  } catch (error) {
    if (error instanceof CopyImageStorageError) {
      return json({ error: error.code }, error.code === 'too_large' ? 413 : 400);
    }
    console.error('[point-shop-images] upload failed');
    return json({ error: 'upload_failed' }, 500);
  }
}
