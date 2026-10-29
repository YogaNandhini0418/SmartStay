# SmartStay – Smart Hostel Management System

SmartStay is a college hostel management application that connects students, wardens, administrators, security guards, maintenance staff and laundry staff. It brings room allocation, student safety, approvals and everyday residence services into one campus portal.

The current application is in **[`smartstay/`](smartstay/)**. Run the commands below from that directory. The older application files in the project root are retained separately.

![Dhanalakshmi Srinivasan University campus entrance](smartstay/public/images/dsu-campus-gate.png)

## Main features

- **Role-specific dashboards:** Admin, Student, Warden, Security, Maintenance and Laundry workspaces with server-enforced permissions.
- **Students and accommodation:** Student profiles, guardian contacts, CSV import/export, hostel blocks, floors, room and bed views, allocation, transfer, vacancy and allocation history.
- **Registration and approval:** Role-specific registration, pending-account review, approval, rejection, suspension and confirmed hostel assignments.
- **Attendance and gate operations:** Daily attendance, simulated biometric events, entry/exit logs, outside-student tracking, late-return alerts, visitor records and digital key handover.
- **Leave management:** Normal, emergency and medical requests, supporting documents, warden review and return tracking through gate entry.
- **Residence services:** Maintenance assignment and resolution, confidential complaints, laundry tracking, cleaning schedules and room inspections.
- **Safety and communication:** Confirmed SOS submissions, emergency contacts, in-app notifications, announcements and private service feedback.
- **Reports and settings:** Occupancy, attendance, leave, gate, maintenance, complaint, staff and laundry reports, CSV export, hostel timings and audit records.
- **Campus interface:** Responsive layouts, Light/Dark Mode, accessible custom validation, persistent theme preferences and the real DSU campus photograph.

Dashboard totals are calculated from database records rather than fixed display values.

## Four-hostel structure

| Hostel | Gender category | Accommodation |
|---|---|---|
| Boys Hostel – AC | Boys | AC |
| Boys Hostel – Non-AC | Boys | Non-AC |
| Girls Hostel – AC | Girls | AC |
| Girls Hostel – Non-AC | Girls | Non-AC |

Admin can manage all four hostels. Other roles are limited to their assigned hostel, tasks or personal records. Student hostel allocation respects gender, and room allocation prevents occupied-bed assignments and duplicate active allocations.

## Technology

| Layer | Implementation |
|---|---|
| Frontend | HTML, CSS and native JavaScript modules |
| Backend | Node.js 24 built-in HTTP server |
| Database | SQLite through Node's built-in `node:sqlite` module |
| Authentication | Server-side sessions with protected cookies |
| Password storage | Salted scrypt hashes |
| Testing | Node test runner and Chrome DevTools Protocol browser checks |

No frontend build step, external database service or third-party runtime dependency installation is required.

## Run locally

Install **Node.js 24 or later**, including npm, then open PowerShell:

```powershell
cd E:\Project\CollegeHostel\smartstay
npm run setup:admin
$env:PORT = '5003'
npm start
```

Open **[http://localhost:5003](http://localhost:5003)**.

`setup:admin` creates a private `.env.local` file with a random Admin security code when the file does not exist. An existing configuration is preserved. Read or edit that file locally to obtain your configured code, and restart the server after changing it.

Without a `PORT` override, the server defaults to port **5001**. Stop the foreground server with **Ctrl+C**.

### Useful pages

| Page | URL when using port 5003 |
|---|---|
| Homepage | `http://localhost:5003/` |
| Student login | `http://localhost:5003/login?role=student` |
| Admin login | `http://localhost:5003/login?role=admin` |
| Registration | `http://localhost:5003/register` |
| Dashboard | `http://localhost:5003/app/dashboard` — authentication required |

## Accounts and access

All roles accept **any syntactically valid email address**, including Gmail, Yahoo, Outlook, college and business domains. Emails are trimmed, compared case-insensitively and kept unique across accounts. A student's roll number remains required and unique, but does not have to match the email address.

Student and staff registration follows this workflow:

```text
Register → Pending → Admin review → Approved → Role dashboard
```

The administrator confirms the hostel assignment during approval. Room and bed allocation remain separate controlled actions. Pending, rejected and suspended accounts cannot sign in.

Admin registration requires server-side verification of the private security code before an active Admin account is created. Admin accounts have access to all four hostels without a single-hostel assignment. Normal Admin login currently requires **email, password and Admin Security Code**.

### Development seed credentials

A fresh database includes these sample accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@smartstay.edu` | `Admin@123` |
| Student | `student@smartstay.edu` | `Student@123` |
| Warden | `warden@smartstay.edu` | `Warden@123` |
| Security | `security@smartstay.edu` | `Security@123` |
| Maintenance | `maintenance@smartstay.edu` | `Maintenance@123` |
| Laundry | `laundry@smartstay.edu` | `Laundry@123` |

Choose the matching role on the login page. Admin also needs the code configured in the backend environment. These are development seed credentials; saved accounts may have different passwords or statuses if an administrator has changed them. Demo credential autofill is not shown on the public login page.

## Backend configuration

Configuration belongs in **`smartstay/.env.local`** or the server process environment. The template is [smartstay/.env.example](smartstay/.env.example).

| Variable | Purpose |
|---|---|
| `ADMIN_SECURITY_CODE` | Required private Admin code; at least 10 characters. Used for Admin registration and login. |
| `PORT` | HTTP port; defaults to `5001`. The local setup above uses `5003`. |
| `SMARTSTAY_DB` | Optional SQLite database path. Defaults to `smartstay/data/smartstay.sqlite`. |
| `COOKIE_SECURE` | Set to `true` when serving through HTTPS. |

The real Admin security code is not included in this README. Keep `.env.local` out of public assets and version control.

## Database and sample campus

The database is created and seeded on first startup. Saved records persist across restarts, and existing data is preserved by the migration and seed checks.

The initial demonstration dataset contains **842 students, 4 hostels, 16 floors, 240 rooms, 960 beds, 4 wardens and 12 staff**, plus allocations, attendance, leave requests, gate movements, service requests and notifications. These are initial seed figures; live counts change as the application is used.

The relational model uses foreign keys, unique constraints and indexes. It covers users, roles, hostels, floors, rooms, beds, allocations, attendance, gate logs, leaves, key handovers, maintenance, complaints, laundry, notifications, emergency alerts, inspections, cleaning, IoT records, feedback, attachments, settings and audit logs.

## Project structure

```text
CollegeHostel/
├── README.md                    Project overview and startup guide
├── smartstay/                   Current application
│   ├── public/                  Homepage, login, registration and application shell
│   │   ├── css/                 Themes, shared controls, validation and campus-photo styles
│   │   ├── images/              Shared DSU campus photograph
│   │   └── js/                  UI components, authentication and page modules
│   ├── server/                  HTTP routes, security, services and database access
│   ├── data/                    Persistent SQLite database, created at runtime
│   ├── scripts/                 Admin configuration and syntax checks
│   ├── tests/                   Backend and browser regression suites
│   ├── .env.example             Backend configuration template
│   ├── ARCHITECTURE.md           Layers, schema and authorization details
│   └── UPDATE-V2.md              Hostel and approval implementation notes
└── public/, server/, tests/      Retained older application copy
```

## Verification

From `E:\Project\CollegeHostel\smartstay`:

```powershell
npm run check
npm test
```

The backend suites use isolated databases and cover authentication, approval, email validation, hostel scope, allocation, services and connected workflows.

Browser suites require Chrome with a debugging endpoint on port **9223**. Launch a separate test browser from the same application directory:

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --headless=new --no-first-run --remote-debugging-port=9223 --user-data-dir="$PWD\test-results\browser-profile" about:blank
```

Then run the relevant suite in another terminal:

```powershell
npm run test:login-browser
npm run test:registration-browser
npm run test:admin-registration-browser
npm run test:validation-browser
npm run test:theme-browser
npm run test:browser
```

These browser suites run against isolated test servers. They check forms, role-specific access, approvals, workflow actions, responsive layouts and theme behavior.

## Security and demo integrations

Backend authorization checks both role and hostel ownership. Sessions use HttpOnly, SameSite cookies; passwords use salted hashes; SQL statements use prepared parameters. Protected routes, account-status checks, input validation, audit records and restricted complaint/attachment access remain enforced independently of the interface.

IoT readings and biometric events are explicitly simulated demonstration data. Notifications are in-app. Account recovery records an administration request and requires identity verification through the residence office. Real biometric devices, IoT hardware, external email/SMS delivery and emergency-service dispatch are not connected by default.

## Further documentation

- [Application README](smartstay/README.md)
- [Architecture and relational model](smartstay/ARCHITECTURE.md)
- [Registration, approval and hostel update notes](smartstay/UPDATE-V2.md)

