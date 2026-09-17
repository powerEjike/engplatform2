"use client";

import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";

const friendlyError = (code: string) => {
  if (code === "auth/invalid-credential") return "That email address or password is not correct.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a moment and try again.";
  if (code === "auth/network-request-failed") return "We could not reach the service. Check your connection and try again.";
  return "We could not sign you in. Please try again.";
};

export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [router, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/");
    } catch (caughtError) {
      const code = typeof caughtError === "object" && caughtError !== null && "code" in caughtError
        ? String(caughtError.code)
        : "";
      setError(friendlyError(code));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPassword = async () => {
    setError(""); setMessage("");
    if (!email.trim()) { setError("Enter your work email address first, then select Forgot password."); return; }
    try { await sendPasswordResetEmail(auth, email.trim()); setMessage("Password-reset instructions have been sent. Check your inbox and spam folder."); }
    catch { setError("We could not send a reset email. Check the email address and try again."); }
  };

  return (
    <main className="login-page">
      <section className="login-introduction">
        <Link className="brand login-brand" href="/" aria-label="BuildCore home"><span className="brand-mark" aria-hidden="true">B</span><span className="brand-word">Build<span>Core</span><small>Engineering</small></span></Link>
        <div className="login-intro-content"><p className="eyebrow">Built for the field and the office</p><h1>Clear projects. Confident decisions.</h1><p className="login-intro-copy">Bring daily site reporting, BOQ progress, variations, and valuations into one dependable workspace.</p><div className="login-benefits"><span>Live project visibility</span><span>BOQ-led progress</span><span>Controlled variations</span></div><div className="login-brand-visual" aria-hidden="true"><Image src="/brand/buildcore-app-icon.png" alt="" fill sizes="(max-width: 800px) 0px, 280px" priority /></div><p className="login-trust">One workspace for Directors, Project Managers, Quantity Surveyors, and Site Engineers.</p></div>
      </section>

      <section className="login-panel" aria-labelledby="login-heading">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h2 id="login-heading">Sign in to your workspace</h2>
          <p className="login-help">Use the work email address your company administrator invited.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Work email
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</button>
        </form>
        <div className="login-support"><button className="text-button" type="button" onClick={() => void resetPassword()}>Forgot password?</button><p className="login-help">Need access? Ask your company administrator to invite you.</p><Link className="demo-link" href="/request-demo">New to BuildCore? Request a demo →</Link></div>
      </section>
    </main>
  );
}
