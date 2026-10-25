import type { Viewport } from 'next';
import DiscordChangeClient from './DiscordChangeClient';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, userScalable: true };

export default function DiscordChangePage() { return <DiscordChangeClient/>; }
