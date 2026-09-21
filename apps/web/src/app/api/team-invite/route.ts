import { NextResponse } from "next/server";
import { isRateLimited, isSameOriginRequest } from "@/lib/request-security";

const text = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "This request must come from the BuildCore website." }, { status: 403 });
  if (isRateLimited(request, "team-invite", 10)) return NextResponse.json({ error: "Too many invitations from this connection. Please wait 15 minutes before trying again." }, { status: 429 });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Email invitations are not configured yet." }, { status: 503 });

  let payload: Record<string, unknown>;
  try { payload = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "The invitation details could not be read. Please try again." }, { status: 400 }); }
  const email = text(payload.email, 180).toLowerCase();
  const companyName = text(payload.companyName, 160);
  const role = text(payload.role, 80);
  const link = text(payload.link, 2_000);
  if (!email.includes("@") || !companyName || !role || !link.startsWith("http")) return NextResponse.json({ error: "The invitation details are incomplete." }, { status: 400 });

  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "BuildCore Engineering <onboarding@resend.dev>", to: [email], subject: `You are invited to join ${companyName} on BuildCore`, text: [`Hello,`, "", `You have been invited to join ${companyName} as a ${role.replaceAll("_", " ")}.`, "", "Use this private link to create your account:", link, "", `You will be asked to enter your company name (${companyName}) and choose a password.`, "", "If you were not expecting this invitation, you can ignore this email."].join("\n") }) });
  if (!response.ok) return NextResponse.json({ error: "The invitation was created, but the email could not be sent." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
