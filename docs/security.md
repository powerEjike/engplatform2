# Security architecture

## Access model

BuildCore uses Firebase Authentication and Firestore rules as the enforcement layer. Users can read only their own active company workspace. Directors and Quantity Surveyors have company-wide project visibility; Project Managers and Site Engineers can access only projects assigned to them.

Directors must verify their email before sensitive administration, including sending invitations, changing roles, disabling accounts, and Director-level project or financial changes. Sensitive team changes also require the Director to re-enter their password.

## Data protections

Firestore rules reject unauthenticated requests, cross-company access, unassigned-project access, and unauthorised role changes. Invitations are tied to the invited email and company, expire after seven days, and can be accepted once. Sensitive team actions are recorded in an append-only, Director-only security audit collection.

Secrets are held in deployment environment variables. Never place API keys, service-account files, passwords, reset links, or private keys in source code, Firestore, browser storage, screenshots, or support messages.

## Operational response

If an account, invitation, or API key may be compromised: disable the account from Team management, revoke outstanding invitations, rotate the affected key in its provider and Vercel, then review the security activity list. Preserve relevant records before making further changes.

## Recovery and launch checklist

Before production onboarding: configure private Firebase Storage rules, enable Firebase App Check, configure MFA for Directors through Firebase/Identity Platform, set up scheduled Firestore backups with 30-day retention, and perform a documented restoration test. Privileged financial approvals and exports must move to verified server-side Cloud Functions before financial production use.

## Automated checks

GitHub Actions runs on pushes to `main` and pull requests. It installs locked dependencies, checks for malformed diffs, scans tracked files for common secret patterns, runs a production-dependency vulnerability audit, and runs lint and TypeScript checks. Security-rule emulator tests should be added alongside any new Firestore collection or role capability.
