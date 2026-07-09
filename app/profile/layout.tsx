import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_OG_IMAGE_HEIGHT,
  SITE_OG_IMAGE_WIDTH,
} from '@/lib/site';

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: '/profile',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SITE_OG_IMAGE,
        width: SITE_OG_IMAGE_WIDTH,
        height: SITE_OG_IMAGE_HEIGHT,
        alt: `${SITE_NAME}锦鲤 logo`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
