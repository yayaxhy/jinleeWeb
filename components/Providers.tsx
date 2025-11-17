"use client";

import type { ReactNode } from "react";
import type { SessionSnapshot } from "@/types/session";
import { SessionProvider } from "./SessionProvider";

type ProvidersProps = {
  children: ReactNode;
  initialSession: SessionSnapshot | null;
};

export function Providers({ children, initialSession }: ProvidersProps) {
  return <SessionProvider initialSession={initialSession}>{children}</SessionProvider>;
}
