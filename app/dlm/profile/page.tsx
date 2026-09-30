import { redirect } from 'next/navigation';
export default async function DlmPortalProfilePage() {
  // Keep old shared links working while making /profile the only profile implementation.
  redirect('/profile');
}
