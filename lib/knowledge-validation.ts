export function isSameOriginKnowledgeWrite(request: Request, publicUrl = process.env.NEXTAUTH_URL) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(publicUrl || request.url).origin; } catch { return false; }
}
