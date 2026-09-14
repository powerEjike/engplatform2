# Development log

## 2026-09-12 — Project foundation

- Created the `engplatform2` GitHub repository connection.
- Added the initial monorepo folder structure.
- Added project-wide TypeScript and environment configuration placeholders.
- Agreed the first milestone: authentication, project/BOQ setup, daily site reporting, and management visibility.

## Next decision

Install Node.js, then initialise the Next.js web dashboard and Expo mobile app.

## 2026-09-12 — Director portfolio dashboard

- Added the first dashboard screen for Directors.
- Added sample project data to demonstrate portfolio progress, schedule health, variation exposure, and late-report attention.
- Built a responsive layout that adapts from desktop to mobile widths.
- Firebase-backed data and authentication remain the next implementation step.

## 2026-09-12 — Shared product data foundation

- Added shared TypeScript types for companies, users, projects, BOQ items, site reports, and variations.
- Added shared progress calculations and site-report validation rules.
- Documented the tenant data structure and national project-location support.

## 2026-09-12 — Firebase web connection and sign-in

- Added the Firebase web connection module using local environment variables.
- Added an Email/Password sign-in screen using Firebase Authentication.
- The next step is to create the first Director account and enforce authenticated access to the dashboard.

## 2026-09-14 — Protected dashboard access

- Added a shared Firebase Authentication provider for the web dashboard.
- Unauthenticated visitors are redirected to the sign-in page.
- Added authenticated-user display and sign-out functionality.
