import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

type Role = "site_engineer" | "project_manager" | "quantity_surveyor" | "director";

export const inviteTeamMember = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in before inviting a team member.");
  const { companyId, email, name, role } = request.data as { companyId?: string; email?: string; name?: string; role?: Role };
  if (!companyId || !email || !name || !role) throw new HttpsError("invalid-argument", "Company, name, email, and role are required.");
  const db = getFirestore();
  const caller = await db.doc(`companies/${companyId}/users/${request.auth.uid}`).get();
  if (!caller.exists || caller.data()?.role !== "director") throw new HttpsError("permission-denied", "Only directors can invite team members.");
  const auth = getAuth();
  const account = await auth.createUser({ email, displayName: name, emailVerified: false });
  await Promise.all([
    db.doc(`companies/${companyId}/users/${account.uid}`).set({ name, email, role, active: true, assignedProjectIds: [], createdAt: new Date().toISOString() }),
    db.doc(`userIndex/${account.uid}`).set({ companyId }),
  ]);
  const resetLink = await auth.generatePasswordResetLink(email);
  return { uid: account.uid, resetLink };
});
