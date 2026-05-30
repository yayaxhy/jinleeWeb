const UPSTREAM_URL = 'https://warhol-arts.webflow.io/';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const upstreamResponse = await fetch(UPSTREAM_URL, {
      cache: 'no-store',
      headers: {
        'user-agent': 'jinlee-club newhome mirror',
      },
    });

    if (!upstreamResponse.ok) {
      return new Response(
        `Failed to load upstream page: ${upstreamResponse.status} ${upstreamResponse.statusText}`,
        {
          status: 502,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
          },
        },
      );
    }

    const html = await upstreamResponse.text();

    return new Response(html, {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error while loading upstream page';

    return new Response(`Failed to load upstream page: ${message}`, {
      status: 502,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    });
  }
}
