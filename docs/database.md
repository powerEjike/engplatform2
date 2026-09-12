# Data model

## Tenant structure

Each company owns its data under `companies/{companyId}`. This is the core boundary that prevents one firm from viewing another firm's work.

```text
companies/{companyId}
  users/{userId}
  projects/{projectId}
    boqItems/{itemId}
    siteReports/{reportId}
    variations/{variationId}
    valuations/{valuationId}
  auditLog/{logId}
  notifications/{notificationId}
```

## Shared types

The `packages/shared-types` package defines the records used throughout the platform. The mobile app, web dashboard, and Firebase functions will use these same definitions.

The `packages/shared-logic` package contains the official BOQ and project-progress calculations plus site-report validation. Centralising this logic prevents different screens from reporting different progress percentages.

## Location support

A project has both a detailed `location` and a `state`. States are not restricted: a company can create and manage projects anywhere in Nigeria.
