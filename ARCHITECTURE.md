# SmartStay architecture

SmartStay is a small, self-contained college hostel application. It uses Node.js 24's built-in HTTP server and SQLite driver, so a demo can run without a package installation or external database service.

## Application layers

- `server/server.js` — HTTP routes, validation, role checks, sessions, and static file serving.
- `server/db.js` and `server/schema.sql` — relational schema, prepared queries, and idempotent demo seed data.
- `public/` — responsive landing/login experiences and the modular role-aware application shell.
- `data/smartstay.sqlite` — created on first run and retained between restarts.

## Authentication and authorization

Passwords are scrypt hashes. Login issues a random opaque session token; only its SHA-256 digest is stored in SQLite. The cookie is HttpOnly and SameSite=Strict. All application APIs require a session and enforce a role allow-list server-side. Student-facing records are scoped to the signed-in student. Confidential complaints expose reporter identity only to admin and warden roles.

## Main relational entities

`roles → users → students / wardens / staff`; `hostels → floors → rooms → beds → room_allocations`; and activity records for attendance, gate movements, leave, key custody, maintenance, complaints and updates, laundry, notifications, emergencies, inspections, cleaning, IoT readings, feedback, settings, audit events, and sessions. Foreign keys and a partial unique index prevent duplicate active room assignments.

## Route groups

- `/api/auth/*`, `/api/me`, `/api/dashboard`
- `/api/students`, `/api/hostels`, `/api/rooms`, `/api/allocations`, `/api/staff`
- `/api/attendance`, `/api/gate`, `/api/leaves`, `/api/keys`
- `/api/maintenance`, `/api/complaints`, `/api/laundry`, `/api/notifications`, `/api/emergencies`
- `/api/inspections`, `/api/cleaning`, `/api/iot`, `/api/reports`, `/api/settings`

Actions use JSON over HTTP and return the updated record. The browser refreshes affected views after writes and shows success or validation feedback.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@smartstay.edu | Admin@123 |
| Warden | warden@smartstay.edu | Warden@123 |
| Student | student@smartstay.edu | Student@123 |
| Security | security@smartstay.edu | Security@123 |
| Maintenance | maintenance@smartstay.edu | Maintenance@123 |
| Laundry | laundry@smartstay.edu | Laundry@123 |

Start with `npm start`, then open `http://localhost:5000`.
