import type { EditableCopyEntry } from './editable-copy-contract';
import { CopyImageStorageError, readCopyImageBody, storeCopyImage } from './editable-copy-image-storage';
import { isSameOriginKnowledgeWrite } from './knowledge-validation';

type Dependencies = {
  session: () => Promise<{ discordId?: string | null } | null>;
  isAdmin: (id: string) => boolean;
  catalog: (scope: 'bot' | 'site') => readonly EditableCopyEntry[];
  publicUrl?: string;
  store?: typeof storeCopyImage;
};
const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function handleCopyImageUpload(request: Request, dependencies: Dependencies) {
  try {
    const session = await dependencies.session();
    if (!session?.discordId || !dependencies.isAdmin(session.discordId)) return json({ error: 'forbidden' }, 403);
    if (!isSameOriginKnowledgeWrite(request, dependencies.publicUrl)) return json({ error: 'invalid_origin' }, 403);
    const params = new URL(request.url).searchParams;
    const scope = params.get('scope');
    const key = params.get('key');
    if ((scope !== 'bot' && scope !== 'site') || !key || params.getAll('scope').length !== 1 || params.getAll('key').length !== 1
      || [...params.keys()].some(name => name !== 'scope' && name !== 'key')
      || !dependencies.catalog(scope).some(entry => entry.key === key && entry.kind === 'image')) return json({ error: 'invalid_request' }, 400);
    const bytes = await readCopyImageBody(request);
    const stored = await (dependencies.store ?? storeCopyImage)(bytes);
    return json({ ok: true, ...stored }, 200);
  } catch (error) {
    if (error instanceof CopyImageStorageError) return json({ error: error.code }, error.code === 'too_large' ? 413 : 400);
    console.error('[copy-images] upload failed');
    return json({ error: 'upload_failed' }, 500);
  }
}
