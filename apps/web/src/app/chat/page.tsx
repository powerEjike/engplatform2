"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { markChatRead } from "@/lib/chat-notifications";

type ChatMessage = { id: string; authorId: string; authorName: string; authorRole: string; message: string; createdAt?: unknown };
const chatDate = (value: unknown) => value && typeof value === "object" && "toDate" in value
  ? (value as { toDate: () => Date }).toDate().toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
  : "";

export default function ChatPage() {
  const router = useRouter();
  const { user, profile, isLoading, isProfileLoading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    if (!isProfileLoading && user && !profile) router.replace("/access");
  }, [isLoading, isProfileLoading, profile, router, user]);

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(
      query(collection(db, "companies", profile.companyId, "messages"), orderBy("createdAt", "asc")),
      (snapshot) => setMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ChatMessage)),
      () => { setMessages([]); setError("Chat is not available yet. Publish the latest Firestore rules, then try again."); }
    );
  }, [profile]);
  useEffect(() => {
    if (profile && user) markChatRead(profile.companyId, user.uid);
  }, [profile, user]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (!profile || !user || !text) return;
    setIsSending(true); setError("");
    try {
      await addDoc(collection(db, "companies", profile.companyId, "messages"), {
        authorId: user.uid, authorName: profile.name, authorRole: profile.role, message: text, createdAt: serverTimestamp()
      });
      setMessage("");
    } catch {
      setError("We could not send your message. Publish the latest Firestore rules, then try again.");
    } finally { setIsSending(false); }
  };

  if (isLoading || isProfileLoading || !user || !profile) return <main className="auth-loading">Opening team chat…</main>;

  return <main className="report-page"><div className="schedule-content">
    <Link className="back-link" href="/dashboard">← Back to workspace</Link>
    <section className="schedule-hero"><div><p className="eyebrow">BuildCore team</p><h1>Team chat</h1><p>One secure space for company-wide coordination, questions, and announcements.</p></div></section>
    <section className="chat-layout company-chat">
      <div className="chat-conversation"><header><div><p className="eyebrow">Company conversation</p><h2>{profile.companyName}</h2><p>All BuildCore team members can take part.</p></div><span>Live team chat</span></header>
        <div className="chat-messages">{messages.length === 0 ? <p className="chat-empty-message">No messages yet. Start the conversation with your team.</p> : messages.map((item) => <article className={item.authorId === user.uid ? "chat-message own" : "chat-message"} key={item.id}><div><strong>{item.authorName}</strong><em>{item.authorRole.replaceAll("_", " ")}</em><time>{chatDate(item.createdAt)}</time></div><p>{item.message}</p></article>)}</div>
        <form className="chat-composer" onSubmit={sendMessage}><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message to the BuildCore team…" maxLength={1000} required /><div><span>Visible to everyone in this workspace.</span><button disabled={isSending}>{isSending ? "Sending…" : "Send message"}</button></div></form>
        {error && <p className="form-error">{error}</p>}
      </div>
    </section>
  </div></main>;
}
