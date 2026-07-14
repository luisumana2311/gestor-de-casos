# Gestor de Casos

Full-stack web application for managing inspection cases, assignments, resolutions and administrative workflows.

## Overview

Gestor de Casos is a web-based system designed to support the control and follow-up of administrative inspection cases. The application allows users to register cases, manage case status, assign inspectors, track resolution dates and maintain better organization of operational workflows.

## Tech Stack

- JavaScript
- Node.js
- Express.js
- MongoDB
- HTML
- CSS

## Main Features

- Case registration and management
- Inspector assignment
- Case status tracking
- Resolution date control
- Administrative workflow organization
- Database-driven case storage
- JWT authentication and role-based authorization
- Login rate limiting and restricted CORS configuration
- Automated security checks with GitHub Actions
- Independent analytics dashboard with workload, resolution and delay indicators
- Server-side search, operational filters and globally accurate case metrics
- Persistent notification outbox with delivery history, retries and overdue-case alerts
- Dedicated case workspace with notes, workflow management and complete audit timeline

## Roles and permissions

| Action | Admin | Supervisor | Inspector |
| --- | --- | --- | --- |
| View cases and inspectors | Yes | Yes | Yes |
| Create cases | Yes | Yes | No |
| Update cases, status and notes | Yes | Yes | Yes |
| Delete cases | Yes | No | No |
| Register users | Yes | No | No |

Administrators can create inspector and supervisor accounts from the deployed web
interface. The browser hides case creation from inspectors and destructive actions
from every non-administrator role; the API enforces the same rules independently.
The same administration module lists every account and allows administrators to
activate, deactivate or permanently delete other users. Inactive accounts cannot
log in and existing JWT sessions are revoked on their next API request. The current
administrator account and the last remaining administrator are protected from
accidental deactivation or deletion.

## Configuration

Copy `.env.example` to `.env` and replace every placeholder. Use a randomly generated
`JWT_SECRET` with at least 32 characters. If credentials were previously committed,
rotate them before deploying the application.

```bash
cp .env.example .env
npm install
npm start
```

Allowed browser origins are configured as a comma-separated list in
`CORS_ORIGINS`. Email delivery remains disabled unless `EMAIL_ENABLED=true`.
The email rollout is temporarily locked off in code while the product remains under
development, even if `EMAIL_ENABLED=true` is present. When the final version is approved,
the rollout lock can be removed and `EMAIL_USER` plus `EMAIL_PASS` will become required.
Assignment emails will then be stored before processing, retried up to three times with
progressive delays and monitored from the independent Alerts section.
The static frontend reads its deployed API URL from `public/config.js`; localhost
continues to use the local server automatically.
The Express application trusts exactly one reverse-proxy hop, matching Render's
public web-service topology and preserving per-client login rate limiting.

## Tests

```bash
npm test
```

The test suite verifies public health checks, protected resources, invalid tokens
and the most important role boundaries. Integration tests run against a temporary
MongoDB instance and cover login plus the complete case lifecycle without touching
development or production data.

## Existing-user migration

Older installations may contain users with the legacy `cliente` role. Preview the
migration first; the preview never changes data:

```bash
npm run migrate:roles
```

After checking the reported number, apply the conversion to `inspector`:

```bash
npm run migrate:roles -- --apply
```

Back up the database before applying migrations in production.

Cases created before inspector accounts were unified can be linked by matching the
stored inspector email. Preview the operation first, then apply it after checking
the unmatched count:

```bash
npm run migrate:case-inspectors
npm run migrate:case-inspectors -- --apply
```

New assignments use a hybrid inspector catalog: the institution's preloaded
inspectors always remain available, and active inspector accounts are added and
linked automatically by email without duplicates. A preloaded inspector can
receive a case before having a login account; creating an active inspector account
later with the same email grants access to those assigned cases. Inspectors see
only their assigned cases, while supervisors and administrators retain the global
view. Every creation, administrative edit, status change and note records
the acting user, role, timestamp and relevant changes in the case activity history.

## First administrator

If the database has no administrator, configure the three `BOOTSTRAP_ADMIN_*`
variables shown in `.env.example` and run:

```bash
npm run bootstrap:admin
```

The command refuses to create another account when an administrator already exists.
Remove the bootstrap values from the deployment environment after use.

## Project Purpose

This project was developed as a practical business-oriented system focused on improving the management of inspection cases and reducing manual tracking. It demonstrates backend development, database management, routing, business logic and full-stack application structure.

## Project Structure

```text
gestor-de-casos/
├── controllers/
├── models/
├── routes/
├── public/
├── views/
├── app.js
├── package.json
└── README.md
```

## Future Improvements

- Password recovery and mandatory temporary-password rotation
- CSV/PDF operational exports
- Configurable SLA rules by investigation type
- Automated browser end-to-end tests

## Author

**Luis Mariano Umaña**  
Software Engineering Student | Backend Developer

📧 marianoumana@gmail.com
