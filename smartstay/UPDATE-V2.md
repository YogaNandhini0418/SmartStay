> Authentication update: all six roles accept any valid email domain. There is no Demo Access, college-domain restriction or roll-number/email matching. Admin creation and login still require the private backend security code; creation activates global access without self-approval. Student/Staff approval, passwords and role/status checks remain enforced. Saved seed addresses are valid again without renaming accounts or changing the database. See README.md for instructions and tests.

# SmartStay update: hostel types and controlled account access

This update modifies the existing application in `E:\Project\CollegeHostel\smartstay`, previously served at port 5001. Existing operational records and routes are retained.

## Start and Admin setup

```powershell
cd E:\Project\CollegeHostel\smartstay
npm run setup:admin
npm start
```

Open http://localhost:5001. Registration is at http://localhost:5001/register. Dedicated Admin sign-in uses http://localhost:5001/login?role=admin.

`setup:admin` creates a private `.env.local` with a cryptographically random `ADMIN_SECURITY_CODE`. It preserves an existing file. Read that file locally to obtain your code. To change the code, edit `ADMIN_SECURITY_CODE` in `.env.local`, use at least 10 characters, and restart the server. You can also supply the value through the server process environment; environment values take precedence over the file. The `npm start` command loads `.env.local` using Node's backend environment-file mechanism.

The code is never included in HTML, frontend JavaScript, public API responses, or the database. The private file is excluded from Git and is outside the static document root. Admin login fails closed if the code is absent or shorter than 10 characters. Test suites use separate, fictional test codes and isolated databases.

Existing demo email/password credentials are unchanged:

| Role | Email | Password | Assigned hostel |
|---|---|---|---|
| Admin | admin@smartstay.edu | Admin@123 | All four hostels |
| Warden | warden@smartstay.edu | Warden@123 | Boys Hostel – AC |
| Student | student@smartstay.edu | Student@123 | Boys Hostel – AC |
| Security | security@smartstay.edu | Security@123 | Girls Hostel – AC |
| Maintenance | maintenance@smartstay.edu | Maintenance@123 | Boys Hostel – AC |
| Laundry | laundry@smartstay.edu | Laundry@123 | Boys Hostel – Non-AC |

Admin additionally requires the private backend security code. The login page displays no demo controls or credentials. Existing staff assignments are preserved; the demo security user can scan `STU1422`, a resident in Girls Hostel – AC. To demonstrate another hostel, Admin can confirm a staff reassignment in User Approvals.

## Database migration

`server/migrations.js` applies version 2 once inside a transaction. Before changing an existing disk database, it creates a consistent SQLite backup in `data/backups/before-approval-v2-*.sqlite`. It does not delete students, rooms, beds, operational requests, or allocation history.

The four original hostel IDs become:

1. Boys Hostel – AC
2. Boys Hostel – Non-AC
3. Girls Hostel – AC
4. Girls Hostel – Non-AC

Hostel references remain foreign keys. Hostel types are fixed; Admin manages facilities, location and active status. Room/floor/bed totals and assigned teams are derived from related records. DB triggers prevent adding, deleting or renaming the four primary types.

Added fields include hostel accommodation/active status; user account status, requested/assigned hostel, employee ID, specialization, shift, approval timestamp/reviewer/reason; student gender; notification and IoT hostel references; and audit details. A shared `departments` table supplies configurable registration and student-management options. A version ledger, unique employee and case-insensitive email indexes, scope indexes and consistency triggers support these changes. Existing active accounts migrate to APPROVED; disabled accounts migrate to SUSPENDED. Existing student gender is initialized from their assigned hostel category.

Historical maintenance assignment records remain intact. Current assignments that cross hostel boundaries are released during migration; unfinished work returns to Reported for assignment to the correct hostel team. Resolved and verified outcomes are retained.

## Registration and approval workflow

1. Students, wardens, security, maintenance and laundry staff register on the shared registration page. The additional Admin option requires a valid backend security code and any syntactically valid, unique email before any Admin is created. Verified Admin accounts become active with access to all four hostels, no assigned hostel and no self-approval; they are audited and existing Admins are notified. Passwords are salted and hashed. Duplicate email, roll number and employee ID checks run on the backend.
2. New Student/Staff accounts are PENDING and cannot log in. Students record a preferred gender-compatible hostel; their confirmed hostel, room and bed remain unset. Admin receives an in-app registration notification.
3. Admin opens **User Approvals**, reviews all submitted details, and confirms or changes the hostel before approving. Rejection requires a reason. Confirmation is required in the UI for approval, rejection, suspension and reassignment.
4. Approval activates the appropriate existing student/warden/staff profile. Students receive hostel assignment; room and bed allocation remains separate. Login opens the existing role dashboard.
5. Admin can suspend or restore approved accounts. Suspension and reassignment revoke existing sessions immediately. The Admin account itself is excluded from public approvals. A resident with an active bed must vacate or transfer through Room Allocation before a conflicting hostel reassignment.

Pending, rejected and suspended login attempts produce the requested account-status messages after verifying the password. Admin authentication additionally requires the backend security code and dedicated endpoint.

## Access and hostel filtering

Admin sees **All Hostels** and the four types in the shared hostel selector. The selection scopes dashboards, students, rooms, allocations, team directories, attendance, gate, leave, services, IoT, safety and reports. Other roles see their assigned hostel and cannot select global scope.

The server resolves the current account status and hostel assignment on every request. Wardens manage their hostel; security accesses its gate and residents; maintenance accesses assigned tasks inside its hostel; laundry manages its hostel's requests; students access their own account/workflows. Changing URL IDs, query parameters or the hostel header does not grant access to another hostel. Emergency, leave and laundry notifications route to the appropriate hostel team and authorized Admin recipients.

Student creation, approval and bed allocation check gender on the API, with matching frontend dropdown options and database safeguards. Admin can transfer between the two hostels of the same gender. Wardens cannot transfer residents across hostel boundaries.

Admin configures engineering department options from Settings. Disabling a department hides it from new registration without changing existing student records. Administration audit records include actor, target account, action, timestamp, hostel/status transitions and review reasons.

## Changed files

- Backend: `server/db.js`, `security.js`, `server.js`, `repositories.js`, `services.js`, `controllers.js`; new `migrations.js`, `accounts.js` and shared seed configuration.
- UI: existing login, landing and app shell; shared components and housing, people, dashboard, campus and settings pages; new registration page/script, approvals page, department settings and `css/approval.css`.
- Setup/docs/tests: package scripts, `.gitignore`, `.env.example`, `scripts/setup-admin.js`, README/architecture notes, existing regression suites, new account/API/persistence and registration-browser checks.

## Verification

```powershell
npm run check
npm test
npm run test:browser
npm run test:registration-browser
```

The browser suites use the existing Chrome CDP helper. Start a dedicated headless Chrome with port 9223 as described in README before running browser checks. Tests use separate in-memory or test-results databases; they do not change the persistent application database.

The completed update passed 24 application JavaScript syntax checks, 30 API/persistence tests, 58 existing-module browser checks and 32 registration/approval browser checks. The running application was also checked against its pre-migration backup: all 25 checked operational tables retained their record counts, with valid foreign keys, 842 students, 240 rooms and 960 beds. The private backend security code was verified absent from public files.

The live database backup created for this update is `data/backups/before-approval-v2-1791447847068.sqlite`. Local screenshots and browser result files are in `test-results/`.

## Integration boundaries

Registration/status notifications operate in-app. External email/SMS and identity verification services are not configured. IoT and biometric events remain labeled simulations. Admin must verify registration details before approving accounts. The backend security code is an additional shared secret, not an OTP or an external multifactor provider. SQLite/Node remains the existing local application architecture.
