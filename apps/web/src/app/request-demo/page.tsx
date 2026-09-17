"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function RequestDemoPage() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [projects, setProjects] = useState("");
  const [message, setMessage] = useState("");

  const requestDemo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const subject = `BuildCore demo request from ${company.trim()}`;
    const body = [`Hello BuildCore Engineering,`, "", `Name: ${name.trim()}`, `Company: ${company.trim()}`, `Work email: ${email.trim()}`, `Active projects: ${projects || "Not specified"}`, "", "What I would like to discuss:", message.trim() || "A demonstration of the platform.", "", "Kind regards,"].join("\n");
    window.location.href = `mailto:powerejike1994@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return <main className="demo-page"><section className="demo-introduction"><Link className="brand demo-brand" href="/login"><span className="brand-mark">e</span><span>engplatform<span>2</span></span></Link><p className="eyebrow">BuildCore Engineering</p><h1>See clearer project control in action.</h1><p>Request a personalised walkthrough of daily reporting, BOQ progress, variations, and valuations for your construction team.</p><div className="demo-benefits"><span>Designed for Nigerian construction teams</span><span>Built for site and office work</span></div></section><section className="demo-panel"><Link className="back-link" href="/login">← Back to sign in</Link><p className="eyebrow">Request a demo</p><h2>Tell us about your company</h2><p className="login-help">Your email app will open with these details prepared for sending to the BuildCore team.</p><form onSubmit={requestDemo}><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Company name<input value={company} onChange={(event) => setCompany(event.target.value)} required /></label><label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Active projects<select value={projects} onChange={(event) => setProjects(event.target.value)}><option value="">Select an option</option><option>1–3 projects</option><option>4–10 projects</option><option>11–25 projects</option><option>More than 25 projects</option></select></label><label>What would you like to discuss? <span className="field-hint">optional</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us about your reporting or project-control needs." /></label><button type="submit">Prepare demo request email</button></form></section></main>;
}
