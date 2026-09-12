# Architecture

## Applications

- **Mobile:** React Native with Expo for Site Engineers.
- **Web:** Next.js for Project Managers, Quantity Surveyors, and Directors.
- **Backend:** Firebase Authentication, Firestore, Cloud Storage, and Cloud Functions.

## Design principles

1. Data is partitioned under `companies/{companyId}` to protect each firm's records.
2. Firebase security rules and Cloud Functions enforce permissions; the user interface is never the only safeguard.
3. Business calculations and validation rules are shared across mobile, web, and server code.
4. Daily reporting remains usable offline and clearly shows whether data is saved locally or synced.

## Planned shared packages

- `shared-types`: roles, project records, BOQ items, reports, variations, and valuations.
- `shared-logic`: progress calculations and validation rules.
