import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/accounts/',
        '/admin/',
        '/api/',
        '/farm/',
        '/howard/',
        '/iria/',
        '/kefu/',
        '/newhome',
        '/newhome-editable/',
        '/profile/',
        '/recharge/',
        '/wechat/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
