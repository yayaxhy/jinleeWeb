import { NextRequest, NextResponse } from 'next/server';
import { destroyDlmPortalSession } from '@/lib/dlm-portal-session';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/dlm/login', request.url), 303);
  destroyDlmPortalSession(response);
  return response;
}
