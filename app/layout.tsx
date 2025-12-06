import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { getServerSession } from "@/lib/session";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "锦鲤公会官网",
  description: "锦鲤官网",
};

export const viewport: Viewport = {
  // Force desktop viewport width on mobile so the layout follows the desktop format
  width: "1280",
  // Lock scale so each load stays at the default (fully缩小的) zoom level on mobile
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession();
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers initialSession={session}>{children}</Providers>
      </body>
    </html>
  );
}
