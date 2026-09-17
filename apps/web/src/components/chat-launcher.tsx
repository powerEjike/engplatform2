"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function ChatLauncher() {
  const pathname = usePathname();
  const { user, profile, isLoading, isProfileLoading } = useAuth();

  if (isLoading || isProfileLoading || !user || !profile || pathname === "/chat") return null;

  return <Link className="chat-launcher" href="/chat" aria-label="Open team chat">
    <span aria-hidden="true">💬</span><b>Team chat</b>
  </Link>;
}
