"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function RequestDemoPage() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [projects, setProjects] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestDemo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(""); setIsSubmitting(true);
    try { const response = await fetch("/api/request-demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, company, email, projects, message }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error); setStatus("Thank you — your demo request has been sent. We will reply to your work email shortly."); setName(""); setCompany(""); setEmail(""); setProjects(""); setMessage(""); }
    catch (error) { setStatus(error instanceof Error && error.message ? error.message : "We could not send your request right now. Please try again shortly."); }
    finally { setIsSubmitting(false); }
  };

  return <main className="demo-page"><section className="demo-introduction"><Link className="brand demo-brand" href="/login" aria-label="BuildCore sign in"><span className="brand-mark" aria-hidden="true">B</span><span className="brand-word">Build<span>Core</span><small>Engineering</small></span></Link><p className="eyebrow">BuildCore Engineering</p><h1>See clearer project control in action.</h1><p>Request a personalised walkthrough of daily reporting, BOQ progress, variations, and valuations for your construction team.</p><div className="demo-benefits"><span>Designed for Nigerian construction teams</span><span>Built for site and office work</span></div></section><section className="demo-panel"><Link className="back-link" href="/login">← Back to sign in</Link><p className="eyebrow">Request a demo</p><h2>Tell us about your company</h2><p className="login-help">Submit your details and the BuildCore team will reply to your work email.</p><form onSubmit={requestDemo}><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Company name<input value={company} onChange={(event) => setCompany(event.target.value)} required /></label><label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Active projects<select value={projects} onChange={(event) => setProjects(event.target.value)}><option value="">Select an option</option><option>1–3 projects</option><option>4–10 projects</option><option>11–25 projects</option><option>More than 25 projects</option></select></label><label>What would you like to discuss? <span className="field-hint">optional</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us about your reporting or project-control needs." /></label>{status && <p className={status.startsWith("Thank") ? "form-success" : "form-error"} role="status">{status}</p>}<button type="submit" disabled={isSubmitting}>{isSubmitting ? "Sending request…" : "Request a demo"}</button></form></section></main>;
}
