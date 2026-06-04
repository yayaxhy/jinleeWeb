export type HtmlDocumentSource = {
  htmlAttributes: Record<string, string>;
  preambleHtml?: string;
  postambleHtml?: string;
  headHtml: string;
  bodyHtml?: string;
  bodyAppendHtml?: string;
  bodyParts?: ReadonlyArray<{
    id: string;
    html: string;
  }>;
};

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function renderHtmlDocument({
  htmlAttributes,
  preambleHtml = '',
  postambleHtml = '',
  headHtml,
  bodyHtml,
  bodyAppendHtml = '',
  bodyParts,
}: HtmlDocumentSource) {
  const attributeString = Object.entries(htmlAttributes)
    .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
    .join(' ');

  const resolvedBodyHtml = bodyHtml ?? (bodyParts ? bodyParts.map((part) => part.html).join('') : '');

  return `<!DOCTYPE html>${preambleHtml}<html ${attributeString}><head>${headHtml}</head><body>${resolvedBodyHtml}${bodyAppendHtml}</body></html>${postambleHtml}`;
}
