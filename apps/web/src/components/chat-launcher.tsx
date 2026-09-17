"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { addUnreadChatMessage, chatUnreadChangeEvent, getUnreadChatCount } from "@/lib/chat-notifications";

type ChatMessage = { id: string; authorId: string; authorName: string; message: string };

export function ChatLauncher() {
  const pathname = usePathname();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notice, setNotice] = useState<ChatMessage | null>(null);
  const initialSnapshot = useRef(true);

  useEffect(() => {
    if (!user || !profile) return;
    const refreshUnreadCount = () => setUnreadCount(getUnreadChatCount(profile.companyId, user.uid));
    refreshUnreadCount();
    window.addEventListener(chatUnreadChangeEvent, refreshUnreadCount);
    return () => window.removeEventListener(chatUnreadChangeEvent, refreshUnreadCount);
  }, [profile, user]);

  useEffect(() => {
    if (!user || !profile) return;
    initialSnapshot.current = true;
    return onSnapshot(query(collection(db, "companies", profile.companyId, "messages"), orderBy("createdAt", "desc"), limit(20)), (snapshot) => {
      if (initialSnapshot.current) {
        initialSnapshot.current = false;
        return;
      }
      snapshot.docChanges().filter((change) => change.type === "added" && !change.doc.metadata.hasPendingWrites).forEach((change) => {
        const message = { id: change.doc.id, ...change.doc.data() } as ChatMessage;
        if (message.authorId === user.uid || pathname === "/chat") return;
        addUnreadChatMessage(profile.companyId, user.uid);
        setNotice(message);
      });
    });
  }, [pathname, profile, user]);

  if (isLoading || isProfileLoading || !user || !profile || pathname === "/chat") return null;

  return <><Link className="chat-launcher" href="/chat" aria-label={`Open team chat${unreadCount ? `, ${unreadCount} unread message${unreadCount === 1 ? "" : "s"}` : ""}`}>
    <span aria-hidden="true">💬</span><b>Team chat</b>{unreadCount > 0 && <em>{Math.min(unreadCount, 9)}</em>}
  </Link>{notice && <aside className="chat-message-notification" role="status"><div><strong>New message from {notice.authorName}</strong><p>{notice.message}</p></div><Link href="/chat" onClick={() => setNotice(null)}>Open chat</Link><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss chat notification">×</button></aside>}</>;
}
