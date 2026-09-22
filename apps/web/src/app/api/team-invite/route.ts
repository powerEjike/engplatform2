import { NextResponse } from "next/server";
import { isRateLimited, isSameOriginRequest } from "@/lib/request-security";
import { getFirebaseAdmin } from "@/lib/firebase-admin";

const text = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const documentId = (value: string) => /^[A-Za-z0-9_-]{1,160}$/.test(value);

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "This request must come from the BuildCore website." }, { status: 403 });
  if (isRateLimited(request, "team-invite", 10)) return NextResponse.json({ error: "Too many invitations from this connection. Please wait 15 minutes before trying again." }, { status: 429 });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Email invitations are not configured yet." }, { status: 503 });

  let payload: Record<string, unknown>;
  try { payload = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "The invitation details could not be read. Please try again." }, { status: 400 }); }
  const email = text(payload.email, 180).toLowerCase();
  const companyId = text(payload.companyId, 160);
  const inviteId = text(payload.inviteId, 160);
  if (!email.includes("@") || !documentId(companyId) || !documentId(inviteId)) return NextResponse.json({ error: "The invitation details are incomplete." }, { status: 400 });

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Sign in again before sending an invitation." }, { status: 401 });

  let companyName = "";
  let role = "";
  try {
    const { auth, firestore } = getFirebaseAdmin();
    const identity = await auth.verifyIdToken(token, true);
    if (!identity.email_verified) return NextResponse.json({ error: "Verify your Director email before sending an invitation." }, { status: 403 });
    const [directorProfile, invite] = await Promise.all([
      firestore.doc(`companies/${companyId}/users/${identity.uid}`).get(),
      firestore.doc(`companies/${companyId}/invites/${inviteId}`).get(),
    ]);
    if (!directorProfile.exists || directorProfile.data()?.active !== true || directorProfile.data()?.role !== "director") return NextResponse.json({ error: "Only an active Director can send invitations." }, { status: 403 });
    const expiresAt = invite.data()?.expiresAt as { toMillis?: () => number } | undefined;
    if (!invite.exists || invite.data()?.active !== true || !expiresAt?.toMillis || expiresAt.toMillis() <= Date.now() || String(invite.data()?.email ?? "").toLowerCase() !== email) return NextResponse.json({ error: "This invitation is no longer active. Create a new invitation and try again." }, { status: 403 });
    companyName = text(invite.data()?.companyName, 160);
    role = text(invite.data()?.role, 80);
    if (!companyName || !role) return NextResponse.json({ error: "The saved invitation is incomplete. Create a new invitation and try again." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Firebase server credentials are not configured.") return NextResponse.json({ error: "Secure invitation delivery is not configured yet." }, { status: 503 });
    return NextResponse.json({ error: "Your secure sign-in could not be verified. Sign in again and try once more." }, { status: 401 });
  }

  const link = `${new URL(request.url).origin}/join?company=${encodeURIComponent(companyId)}&invite=${encodeURIComponent(inviteId)}&companyName=${encodeURIComponent(companyName)}&email=${encodeURIComponent(email)}`;

  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "BuildCore Engineering <onboarding@resend.dev>", to: [email], subject: `You are invited to join ${companyName} on BuildCore`, text: [`Hello,`, "", `You have been invited to join ${companyName} as a ${role.replaceAll("_", " ")}.`, "", "Use this private link to create your account:", link, "", `You will be asked to enter your company name (${companyName}) and choose a password.`, "", "If you were not expecting this invitation, you can ignore this email."].join("\n") }) });
  if (!response.ok) return NextResponse.json({ error: "The invitation was created, but the email could not be sent." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
