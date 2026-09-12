# engplatform2

Engineering and construction project management platform for construction firms across Nigeria.

## What this platform will do

- Let site engineers submit daily reports, even when a site has poor connectivity.
- Help project managers, quantity surveyors, and directors monitor progress and variations.
- Generate reliable valuations from approved work and variations.

## Project structure

```text
apps/mobile       Expo mobile app for site engineers
apps/web          Next.js dashboard for management
packages/*        Shared TypeScript types and business rules
functions/        Firebase Cloud Functions
firestore/        Firestore security rules and indexes
docs/             Product and technical documentation
tests/            Automated test suites
```

## Status

Foundation created. The first build milestone is authentication, company/project setup, and the daily site-report workflow.

## Documentation

Read [the product overview](docs/product-overview.md) and [the architecture notes](docs/architecture.md) before making structural decisions.
