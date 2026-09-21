"use client";

import { sendEmailVerification } from "firebase/auth";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";

export function EmailVerificationNotice() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");

  if (!user || user.emailVerified) return null;

  const sendVerification = async () => {
    setStatus("");
    try {
      await sendEmailVerification(user);
      setStatus(`Verification email sent to ${user.email}. Open it, verify your address, then refresh this page.`);
    } catch {
      setStatus("We could not send the verification email. Please try again shortly.");
    }
  };

  return <section className="report-section"><h2>Verify your Director email</h2><p className="field-hint">For company protection, verify your email before inviting people, changing roles, or changing account access.</p><button type="button" onClick={() => void sendVerification()}>Send verification email</button>{status && <p className={status.startsWith("Verification email sent") ? "form-success" : "form-error"}>{status}</p>}</section>;
}
