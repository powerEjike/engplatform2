"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

const friendlyError = (code: string) => {
  if (code === "auth/invalid-credential") return "That email address or password is not correct.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a moment and try again.";
  if (code === "auth/network-request-failed") return "We could not reach the service. Check your connection and try again.";
  return "We could not sign you in. Please try again.";
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
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

  return (
    <main className="login-page">
      <section className="login-introduction">
        <Link className="brand login-brand" href="/"><span className="brand-mark">e</span><span>engplatform<span>2</span></span></Link>
        <p className="eyebrow">Built for the field and the office</p>
        <h1>Clear projects. Confident decisions.</h1>
        <p>Bring daily site reporting, BOQ progress, variations, and valuations into one dependable workspace.</p>
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
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="login-help">Need access? Ask your company administrator to invite you.</p>
      </section>
    </main>
  );
}
