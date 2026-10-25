# SmartStay — Smart Hostel Management System

A complete local college hostel application with a campus landing page, six role-specific accounts, persistent SQLite data, and 19 navigation modules. Uses Node.js 24 built-in HTTP, cryptography, and SQLite. No dependency installation or external database service is required.

See [UPDATE-V2.md](UPDATE-V2.md) for registration, account approval, hostel scope, database migrations and the private Admin security code.

## Run

```powershell
cd E:\Project\CollegeHostel\smartstay
npm run setup:admin
npm start
```

Open **http://localhost:5001**. The database is created and seeded on the first start at `data/smartstay.sqlite`. Writes persist across restarts. You can override the port with `$env:PORT='5003'` before starting.

The application, persistent database and tests are in the existing `smartstay/` directory. Run these commands from that directory.

## Email authentication

The login page uses the existing six campus role cards and real credentials only. Demo Access, demo hostels, public demo account discovery and credential autofill have been removed.

All six roles accept any syntactically valid email address, including Gmail, Yahoo, Outlook, college and business domains. The shared policy in `public/js/email.js` is used by frontend and backend validation. Addresses are trimmed and lowercased for storage and lookup, and the existing case-insensitive unique email index prevents duplicate accounts. Email domains do not grant roles or bypass approval.

Student/Staff registration remains pending until Admin approves the account and confirms its hostel; approval does not allocate a room or bed. A valid email alone never grants access. The server verifies the stored account, password, selected role, approval and active status before issuing a protected session. Admin also needs the private backend `ADMIN_SECURITY_CODE`.

College-domain configuration, institutional-only Admin restrictions and roll-number/email matching are removed. Roll numbers remain required and unique for students. Email labels are "Email Address", with provider-neutral placeholders and helpers for every role.

Email authentication files:

- Shared policy and authentication UI: `public/js/email.js` (new), `public/login.html`, `public/js/login.js`, `public/js/register.js`, `public/js/validation.js`.
- Backend validation, normalization and registration metadata: `server/security.js`, `server/accounts.js`, `server/server.js`, `server/controllers.js`. The obsolete `server/config.js` is removed.
- Configuration and documentation: `.env.example`, `.env.local` (obsolete email-domain entry only; private security code preserved), `README.md`, `UPDATE-V2.md`.
- Isolated test fixtures and regression checks: `tests/auth-fixtures.js`, `tests/browser-server.js`, the four backend test files, and login, registration, Admin registration, validation, theme and workflow browser suites. No persistent account email migration or additional email column is needed.

## Secure Admin registration

Admin registration accepts any valid, unique email and independently verifies the existing private server security code before creating an active/APPROVED account. The form shows exactly seven Admin details, uses `admin@example.com`, and explains that verified administrators have access to all four hostels. Missing/incorrect codes or duplicate/invalid emails create no account. Student/Staff registration still requires Admin approval.

The project intentionally retains its existing additional security-code factor at normal Admin login. The code authorizes registration and is also required by the dedicated Admin login endpoint; choosing Admin or using a particular email domain grants no privileges. Authentication checks the stored role, password and active/APPROVED status. Admin account recovery accepts the registered email, with the existing residence-office identity check before password reset.

Files for the Admin email update: `public/js/email.js`, `public/js/register.js`, `public/js/login.js`, `public/js/validation.js`, `server/security.js`, `server/accounts.js`, `server/server.js`, `tests/admin-registration.test.js`, `tests/admin-registration-browser.js`, `tests/email-access.test.js`, `README.md` and `UPDATE-V2.md`. No schema migration, account renaming, role permission change or private security-code change is required.

The existing registration dropdown now includes Admin after the five Student/Staff roles. Admin fields are Full Name, Admin / Employee ID, Phone Number, Email Address, Password, Confirm Password and Admin Security Code. Student fields and hostel assignment are hidden; the Campus Guide counts these seven required details and retains the existing theme and inline validation.

The backend independently validates `admin_security_code` with the existing timing-safe `verifyAdminCode` check before creating an Admin. Missing or incorrect codes are rejected; a missing or short server configuration fails closed. Email and employee ID uniqueness, input validation, password hashing and the registration rate limit still apply. Client-supplied approval, role ID and hostel fields cannot grant privileges.

This project has no separate Super Admin hierarchy. A verified Admin is created active/APPROVED with no hostel assignment or self-approval, and has access to all four hostels and existing Admin modules. Creation is audited and notifies existing Admins. The security code is not retained in user records, audit details, notifications or browser storage. Student/Staff accounts still require administrator approval and hostel confirmation.

Configure `ADMIN_SECURITY_CODE` in the private backend `.env.local` file or process environment; use at least 10 characters and restart `npm start` after changes. `npm run setup:admin` generates this file if needed and preserves an existing configuration. The security code remains private. Email syntax validation does not require an email-domain environment variable. After registration, use the existing Admin login with your email, password and security code. No database migration or changes to saved accounts are required.

Run `npm test` for email/API/security coverage and `npm run test:admin-registration-browser` for the Admin form, wrong-code correction, theme/viewport checks, success, login, global hostel access and logout. Run `npm run test:registration-browser` to verify the five existing approval workflows. These tests use isolated databases and leave the saved project data untouched.

Files changed for Admin registration:

- Form and validation: `public/js/register.js`, `public/js/validation.js`.
- Backend and domain configuration: `server/accounts.js`, `server/config.js`.
- Setup and documentation: `.env.example`, `package.json`, `README.md`, `UPDATE-V2.md`.
- Tests: `tests/accounts.test.js`, `tests/admin-registration.test.js`, `tests/admin-registration-browser.js`, `tests/validation-browser.js`. The last file now waits for the requested page and stops old portal polling before switching test sessions.

## Retained development seed accounts

No users, passwords, allocations or operational records were deleted or renamed. Existing seed definitions remain in `server/db.js` and `server/seed-config.js`. Their saved email addresses now pass the shared provider-independent policy. The credentials below work for active, approved accounts; select the matching role, and provide the private security code for Admin. No credentials are displayed on the public login page. New Student/Staff accounts still require administrator approval.

| Role | Development email | Password |
|---|---|---|
| Admin | admin@smartstay.edu | Admin@123 |
| Warden | warden@smartstay.edu | Warden@123 |
| Security | security@smartstay.edu | Security@123 |
| Maintenance | maintenance@smartstay.edu | Maintenance@123 |
| Laundry | laundry@smartstay.edu | Laundry@123 |

Legacy seeded students include `student@smartstay.edu`, `st1212@smartstay.edu`, `st1422@smartstay.edu` and `st1633@smartstay.edu`. Their records, passwords and allocations remain intact. New Student/Staff users may register with any valid email and await Admin approval. Browser fixtures use Gmail only in isolated in-memory databases and do not rename saved accounts.

An example email address is not automatically created in the saved database. Register your own account and await approval where required. All automated registration and approval checks use isolated databases.

## Light and dark mode

The sun/moon icon in the homepage navigation, login/registration pages and portal topbar switches the shared theme. The existing light appearance is the default. The browser saves the selection as `localStorage['smartstay-theme'] = 'light'` or `'dark'`; it follows you across pages, refreshes and logout/login. The blocking `public/js/theme.js` head script restores the preference before styles and content render. `public/css/theme.css` contains the semantic palettes and shared component colors; charts use the same tokens. Reduced-motion preferences are respected, and printing uses the light palette.

With the isolated Chrome instance running, `npm run test:theme-browser` checks public pages, every authorized module for all six roles, contrast, surfaces, dialogs, chart updates, mobile layout, keyboard access and persistence. It uses an in-memory database.

## Crisp borders and focus

`public/css/theme.css` centralizes `--border-subtle`, `--border-default`, `--border-interactive` and `--border-focus` for both themes, alongside control/card radii and natural depth shadows. Ordinary components use one 1px border; hover changes its color without changing thickness. Keyboard focus uses one 2px outline with a 2px offset through `:focus-visible`. Compound search controls display that outline on their outer wrapper, avoiding overlapping input and wrapper rings.

Shared controls, cards, tables, navigation and dialogs retain their existing surfaces and layout. Homepage and role-card styles no longer stack inset highlights or blue glows with their borders. Campus Guide validation retains its attention and completion states with one attention border and the same accessible keyboard focus. Decorative background glows and frames are removed; the campus illustration, selected navigation markers and chart geometry remain intact.

The theme browser suite also checks border thickness, shadow layers, inset strokes and focus outlines across all six roles and supported viewports. The cleanup passed 95 theme checks plus 18 targeted browser interaction checks covering button hover/click/focus, navigation, role cards, disabled controls, dialogs and registration field correction in both themes. Homepage geometry was unchanged in the before/after measurements.

## Demo campus

842 students, 4 hostels, 16 floors, 240 rooms, 960 beds, 842 active allocations, 4 wardens, and 12 staff. The seed includes 14 days of attendance, 45 leave requests, 42 gate movements, maintenance tickets, confidential complaints, laundry requests, inspections, cleaning tasks, visitor records, feedback, notifications, and example safety incidents. Indian engineering departments and registration numbers are included.

All dashboard figures are calculated from database records. The fictional demo starts at 87.7% bed occupancy.

## Review walkthrough

1. Sign in as Admin. Browse the four hostel blocks and room floor views. In Students, add a resident with their emergency contacts. In Room Allocation, allocate a free bed; transfer or vacate it and watch availability update. Deactivation also releases the bed and revokes account sessions.
2. Sign in using an approved Student account. Room and bed assignment remain controlled through Room Allocation. Apply for leave on dates that do not overlap an existing request. Submit maintenance with a photo or PDF, submit a confidential concern, request laundry, and share private service feedback from Settings.
3. Sign in as Warden. Review the leave, take daily attendance, simulate a biometric event, assign maintenance to Ramesh Patel, update complaints, and record a room inspection from the dashboard.
4. Sign in as Security. The preserved demo security assignment is Girls Hostel – AC; scan `STU1422`. Admin can reassign this account through User Approvals to demonstrate Boys Hostel – AC and `STU1001`. For the student's leave walkthrough, use Admin as the gate operator. Scan `STU1422`, record exit and a future expected return, then record entry. Active approved leave completes on return. Late entries generate high-priority alerts. Use the Key Handover tab to submit and return keys, and register guardians in Visitors.
5. Sign in as Maintenance. Start an assigned task and resolve it with a written resolution. Sign back in as Student to verify the fix.
6. Sign in as Laundry. Advance a pickup through Collected → Washing → Ready → Delivered. The student receives in-app ready and delivered notifications.
7. Open Safety. SOS opens a form and requires explicit confirmation. Admin, the assigned warden, and security receive in-app emergency notifications. Staff acknowledge and resolve alerts. Contact links call the fictional campus directory numbers.
8. Open Reports as Admin or Warden. Choose any of the ten reports, set dates, search, sort, and export CSV. Inspect private service averages and the admin audit log in Settings.

## Verification

```powershell
npm run check
npm test
```

`npm test` includes domain-independent email-access tests and uses a fresh in-memory database and an ephemeral HTTP server. It validates every authorized module for all six roles and tests connected workflows, authorization boundaries, file access, atomic imports, room constraints, recovery, notifications, and data integrity. It does not alter the persistent demo database.

Browser checks use Chrome's built-in debugging protocol with Node's WebSocket support; no Playwright dependency is needed. Start an isolated headless Chrome instance before running them:

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --headless=new --no-sandbox --disable-gpu --no-first-run --remote-debugging-port=9223 --user-data-dir=E:\Project\CollegeHostel\smartstay\test-results\browser-profile about:blank
```

Then, in another terminal:

```powershell
npm run test:browser
npm run test:registration-browser
npm run test:admin-registration-browser
npm run test:theme-browser
npm run test:validation-browser
```

The browser suite starts a separate in-memory server on port 5002, tests navigation, forms, connected role workflows, logout, and six requested viewport widths, and saves screenshots and results in `test-results/`.

The SmartStay Campus Guide is centralized in `public/js/validation.js` and `public/css/validation.css`. Registration stays on one page, with reusable Personal, Hostel, and Account sections, a focus-aware journey indicator, and completion calculated from valid required fields. Preselected valid options count toward completion. The helper card shows the remaining details and can focus the next unfinished field. Neutral fields stay quiet; fields needing attention use warm borders and compact slate hints; completed fields show a small success check. Server conflicts use a small red indicator without changing the whole input red. Icons respect dropdown chevrons, password visibility buttons, and date pickers. Transitions last 180–200 ms and respect reduced motion.

Forms retain their required, format, length, date and number constraints. Browser validation bubbles are replaced by accessible field hints and focus on the first unfinished detail. Feedback starts after touch or a submission attempt and clears during correction. All registration roles and shared modal forms reuse the field states; backend validation remains authoritative. Known duplicate account errors attach to their corresponding field. `showFormError(form, error)` remains available from the shared components module. Student/Staff registration shows “Complete registration” until valid, then “Submit registration”, followed by a sending state and a success panel with the requested hostel and awaiting-approval status. Admin uses the same presentation with “Create administrator account” and a global-access, active-account success state. Routes, database schema and existing approval workflows are preserved.

The validation browser suite uses an isolated in-memory database on port 5008 and checks Student/Staff registration through approval/login, field correction, accessibility, light/dark contrast, mobile layout, evidence uploads, hostel request forms, allocation, student/staff forms, settings, reports, attendance, and gate scanning. The separate Admin registration suite checks its security-code activation and login. Both leave the saved demo database untouched.

## Architecture and scope

See [ARCHITECTURE.md](ARCHITECTURE.md) for entities, routes, permissions, and integration boundaries.

IoT and biometric events are explicitly simulated. No real hardware, fingerprint collection, face recognition, external SMS, emergency dispatch, or email service is connected. Notifications and SOS dispatch operate inside SmartStay. Forgotten-password recovery is handled by a verified residence administrator rather than pretending an email was sent. Demo emergency phone numbers and all student records are fictional.

For an HTTPS installation, set `COOKIE_SECURE=true`; use private account credentials and actual campus contacts. The default demo server is intended for a local project presentation. Back up the SQLite database using SQLite's backup tooling before real data changes.

## Email access update checks

Run `npm run check`, `npm test`, `npm run test:login-browser` and `npm run test:registration-browser`. Browser suites require the existing Chrome debugging endpoint on port 9223. The login suite checks all six roles, all 30 wrong-role combinations, missing/incorrect Admin codes, manual credentials, password visibility, session lifetime, registration/approval of a personal email address, incorrect passwords, unregistered/pending/suspended accounts, invalid email syntax, accepted non-Gmail providers, independent roll numbers, keyboard access, recovery, logout, theme persistence and 320px through 1920px layouts.

Other browser suites now enter explicit credentials instead of using removed demo controls. `tests/browser-server.js` and `tests/auth-fixtures.js` adapt student emails only in the isolated in-memory test database. The fixture helper refuses to write to a persistent database.

## Email access implementation

- Login and registration UI: `public/login.html`, `public/js/login.js`, `public/js/register.js`.
- Shared form validation: `public/js/validation.js`, `public/css/validation.css`; the unused college-only validator `public/js/college-email.js` was removed.
- Backend policy and role verification: `server/security.js`, `server/accounts.js`, `server/server.js`. No database migration or credential changes are required.
- Documentation and test command: `package.json`, `README.md`, `UPDATE-V2.md`.
- Isolated email workflow tests: `tests/email-access.test.js` replaces the former college-only policy tests.
- Updated browser checks: `tests/login-browser.js`, `tests/registration-browser.js`, `tests/validation-browser.js`, `tests/browser.test.js`, `tests/theme-browser.js`. Existing theme tokens and role-card design are unchanged.

All automated workflows use isolated databases. The update does not rename emails, reset passwords, delete users or change room allocations in the saved database.
