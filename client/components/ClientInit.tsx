"use client";
import { InitHooks } from "@/hooks";

export default function ClientInit({ children }: { children: React.ReactNode }) {
  InitHooks();
  return <>{children}</>;
}
