import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: 'weekly',
    },
    {
      url: `${SITE_URL}/peiwanList`,
      changeFrequency: 'daily',
    },
  ];
}
