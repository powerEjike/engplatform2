import { NextResponse } from "next/server";
import { isRateLimited, isSameOriginRequest } from "@/lib/request-security";

const text = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const projectRanges = new Set(["1–3 projects", "4–10 projects", "11–25 projects", "More than 25 projects"]);

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "This request must come from the BuildCore website." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Invalid request format." }, { status: 415 });
  if (isRateLimited(request, "request-demo", 5)) return NextResponse.json({ error: "Too many demo requests from this connection. Please try again in 15 minutes." }, { status: 429 });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Demo requests are not configured yet. Please try again later." }, { status: 503 });

  let payload: Record<string, unknown>;
  try { payload = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "The request details could not be read. Please try again." }, { status: 400 }); }
  const name = text(payload.name, 120);
  const company = text(payload.company, 160);
  const email = text(payload.email, 180);
  const projects = text(payload.projects, 60);
  const message = text(payload.message, 2_000);
  if (!name || !company || !validEmail(email) || (projects && !projectRanges.has(projects))) return NextResponse.json({ error: "Please provide your name, company, and a valid work email." }, { status: 400 });

  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "BuildCore Demo <onboarding@resend.dev>", to: ["powerejike1994@gmail.com"], reply_to: email, subject: `Demo request — ${company}`, text: [`New BuildCore demo request`, "", `Name: ${name}`, `Company: ${company}`, `Work email: ${email}`, `Active projects: ${projects || "Not specified"}`, "", "What they would like to discuss:", message || "A demonstration of the platform."].join("\n") }) });
  if (!response.ok) return NextResponse.json({ error: "We could not send your request right now. Please try again shortly." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
