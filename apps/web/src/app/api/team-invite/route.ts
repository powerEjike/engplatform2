import { NextResponse } from "next/server";
import { isRateLimited, isSameOriginRequest } from "@/lib/request-security";

const text = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const documentId = (value: string) => /^[A-Za-z0-9_-]{1,160}$/.test(value);
type FirestoreDocument = { fields?: Record<string, { stringValue?: string; booleanValue?: boolean; timestampValue?: string }> };
type FirebaseIdentity = { users?: Array<{ localId?: string; emailVerified?: boolean }> };

async function readFirebaseDocument(projectId: string, path: string, token: string) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<FirestoreDocument>;
}

async function readFirebaseIdentity(apiKey: string, token: string) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }), cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<FirebaseIdentity>;
}

const fieldText = (document: FirestoreDocument, field: string) => document.fields?.[field]?.stringValue ?? "";
const fieldBoolean = (document: FirestoreDocument, field: string) => document.fields?.[field]?.booleanValue === true;

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

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !firebaseApiKey) return NextResponse.json({ error: "Secure invitation delivery is not configured yet." }, { status: 503 });

  let companyName = "";
  let role = "";
  try {
    const identity = await readFirebaseIdentity(firebaseApiKey, token);
    const signedInUser = identity?.users?.[0];
    if (!signedInUser?.localId || !signedInUser.emailVerified) return NextResponse.json({ error: "Verify your Director email before sending an invitation." }, { status: 403 });
    const [directorProfile, invite] = await Promise.all([
      readFirebaseDocument(projectId, `companies/${companyId}/users/${signedInUser.localId}`, token),
      readFirebaseDocument(projectId, `companies/${companyId}/invites/${inviteId}`, token),
    ]);
    if (!directorProfile || !fieldBoolean(directorProfile, "active") || fieldText(directorProfile, "role") !== "director") return NextResponse.json({ error: "Only an active Director can send invitations." }, { status: 403 });
    const expiresAt = Date.parse(invite?.fields?.expiresAt?.timestampValue ?? "");
    if (!invite || !fieldBoolean(invite, "active") || !Number.isFinite(expiresAt) || expiresAt <= Date.now() || fieldText(invite, "email").toLowerCase() !== email) return NextResponse.json({ error: "This invitation is no longer active. Create a new invitation and try again." }, { status: 403 });
    companyName = text(fieldText(invite, "companyName"), 160);
    role = text(fieldText(invite, "role"), 80);
    if (!companyName || !role) return NextResponse.json({ error: "The saved invitation is incomplete. Create a new invitation and try again." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Your secure sign-in could not be verified. Sign in again and try once more." }, { status: 401 });
  }

  const link = `${new URL(request.url).origin}/join?company=${encodeURIComponent(companyId)}&invite=${encodeURIComponent(inviteId)}&companyName=${encodeURIComponent(companyName)}&email=${encodeURIComponent(email)}`;

  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "BuildCore Engineering <onboarding@resend.dev>", to: [email], subject: `You are invited to join ${companyName} on BuildCore`, text: [`Hello,`, "", `You have been invited to join ${companyName} as a ${role.replaceAll("_", " ")}.`, "", "Use this private link to create your account:", link, "", `You will be asked to enter your company name (${companyName}) and choose a password.`, "", "If you were not expecting this invitation, you can ignore this email."].join("\n") }) });
  if (!response.ok) return NextResponse.json({ error: "The invitation was created, but the email could not be sent." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
