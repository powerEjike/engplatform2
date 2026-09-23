import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFile(resolve(root, path), "utf8");
const requireText = (source, expected, label) => {
  if (!source.includes(expected)) throw new Error(`Security verification failed: ${label}.`);
};
const rejectText = (source, unsafe, label) => {
  if (source.includes(unsafe)) throw new Error(`Security verification failed: ${label}.`);
};

const [firestoreRules, storageRules, nextConfig, inviteRoute] = await Promise.all([
  read("firestore/firestore.rules"),
  read("storage/storage.rules"),
  read("apps/web/next.config.ts"),
  read("apps/web/src/app/api/team-invite/route.ts"),
]);

rejectText(firestoreRules, "allow read, write: if true", "Firestore must never be open to everyone");
requireText(firestoreRules, "function isVerifiedDirector", "verified Director guard must exist");
requireText(firestoreRules, "allow create, update: if isVerifiedDirector(companyId);", "project changes must remain Director-controlled");
requireText(firestoreRules, "request.resource.data.authorId == request.auth.uid", "message author identity must be enforced");
requireText(firestoreRules, "request.resource.data.message.size() <= 1000", "chat message size must be limited");
requireText(firestoreRules, "request.resource.data.createdAt == request.time", "chat messages must use a server timestamp");
requireText(firestoreRules, "match /securityAudit/{auditId}", "append-only security audit collection must exist");

rejectText(storageRules, "allow read, write: if true", "Storage must never be open to everyone");
requireText(storageRules, "allow update, delete: if false;", "project evidence must remain immutable");
requireText(storageRules, "request.resource.size < 15 * 1024 * 1024", "Storage upload size limit must remain in place");

requireText(nextConfig, "X-Content-Type-Options", "MIME sniffing protection header must remain enabled");
requireText(nextConfig, "Cross-Origin-Opener-Policy", "cross-origin opener isolation must remain enabled");
requireText(nextConfig, "Strict-Transport-Security", "HTTPS transport protection header must remain enabled");
requireText(nextConfig, "Content-Security-Policy", "Content Security Policy must remain enabled");
requireText(nextConfig, "frame-ancestors 'none'", "the app must not be embedded by another site");

requireText(inviteRoute, "readFirebaseIdentity", "invitation sender identity must be verified");
requireText(inviteRoute, "isSameOriginRequest", "invitation endpoint must reject cross-site requests");
requireText(inviteRoute, "isRateLimited", "invitation endpoint must be rate limited");

console.log("Security regression checks passed.");
