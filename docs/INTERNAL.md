# GammoDA HR — Internal maintainer notes

> ⚠️ **PRIVATE / MAINTAINERS ONLY**  
> Do **not** paste credentials into the public `README.md`, issues, or client slides.  
> Prefer keeping this file **out of public forks** when possible, or restrict the repository.

---

## Demo accounts (seed)

Created / updated by:

```bash
cd Backend
npm run seed:sectors
```

Login with **email + password** only.

| Role | Email | Password | Scope |
|------|--------|----------|-------|
| Super Admin | `superadmin@gammoda.local` | `SuperAdmin123!` | Organization |
| Org Admin | `orgadmin@gammoda.local` | `Demo123!` | Organization |
| Org HR | `orghr@gammoda.local` | `Demo123!` | Organization |
| Sector Lead | `business.lead@gammoda.local` | `Demo123!` | Business Sector |
| Manager | `hotel.manager@gammoda.local` | `Demo123!` | Nechisar Hotel |
| Unit Manager | `springs.manager@gammoda.local` | `Demo123!` | 40 Springs |
| Employee | `hotel.employee@gammoda.local` | `Demo123!` | Nechisar Hotel |

**Legacy migrations on re-seed:**  
`business.admin@gammoda.local` / `business.hr@gammoda.local` → Sector Lead.  
Former `manager` accounts on a sub-sub-sector → Unit Manager.

> Change all of these before any shared staging or production deploy.

---

## Environment templates

### `Backend/.env`

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/gammoda_hr
JWT_SECRET=replace-with-long-random-secret

CLOUDINARY_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_SECRET_KEY=

EMAIL=
EMAIL_PASSWORD=
FRONTEND_URL=http://localhost:5173

WORK_START_TIME=09:00

SUPERADMIN_EMAIL=superadmin@gammoda.local
SUPERADMIN_PASSWORD=SuperAdmin123!
```

### `Frontend/.env`

```env
VITE_API_URL=http://localhost:5000
```

| Variable | Notes |
|----------|--------|
| `MONGODB_URI` | Local or Atlas |
| `JWT_SECRET` | Long random string; never commit real value |
| `CLOUDINARY_*` | Profile / chat media |
| `EMAIL` / `EMAIL_PASSWORD` | SMTP / app password |
| `FRONTEND_URL` | Email links + CORS alignment |
| `WORK_START_TIME` | Attendance late threshold (default `09:00`) |
| `SUPERADMIN_*` | Bootstrap only — rotate after first login in real envs |

---

## Local URLs (dev)

| Service | Typical URL |
|---------|-------------|
| API | `http://localhost:5000` |
| SPA | Vite default (often `http://localhost:5173`) |

Auth header for API calls: `Authorization: Bearer <JWT>`

---

## API map (for developers)

Base: `/api`

| Prefix | Domain |
|--------|--------|
| `/api/auth` | Login, session, password |
| `/api/employees` | Employee CRUD & profile |
| `/api/sectors` | Org tree |
| `/api/departments` | Legacy departments |
| `/api/attendance` | Check-in/out, roster, stats, reports |
| `/api/leave` | Leave requests & decisions |
| `/api/payroll` | GaDA payroll sheet |
| `/api/payslips` | Payslips |
| `/api/salary-advances` | Advances |
| `/api/jobs` · `/api/candidates` | Recruitment |
| `/api/devices` | Device inventory |
| `/api/chat` | Conversations & messages |
| `/api/events` | Calendar |
| `/api/goals` | Goals |
| `/api/notifications` | In-app notifications |
| `/api/activities` | Activity feed |

Realtime: Socket.IO on the same HTTP server.

---

## UI routes & gates (for developers)

| Path | Module | Gate (capability / role) |
|------|--------|---------------------------|
| `/auth` | Sign in | Public |
| `/dashboard` | Dashboard | Auth |
| `/employees` · `/employees/:id` | Employees | `canManage` |
| `/sectors` | Sectors | `canManage` |
| `/departments` | → `/sectors` | Auth |
| `/admin-console` | Admin Console | `canAccessAdminConsole` |
| `/attendance` | Attendance | Auth |
| `/leave-requests` | Leave | Auth |
| `/salary` | Payroll / my salary | Auth |
| `/salary-advances` | Advances | `canViewSalaryAdvances` |
| `/payslips` | Payslips | Auth |
| `/recruitment` | Recruitment | `canRecruit` |
| `/device-management` | Devices | `canManageDevices` |
| `/my-devices` | My devices | Auth |
| `/profile` | Profile | Auth |
| `/my-id` | ID card | Auth |
| `/chat` | Chat | Auth |
| `/calendar` | Calendar | Auth |
| `/goals` | Goals | Auth |
| `/settings` | Settings | Auth |

---

## Employee data model (PII — handle carefully)

Stored fields include (among others):

- Account: email, role, scope, last login  
- Personal: name, phone, gender, DOB, nationality, address, bio, skills, emergency contacts, national ID  
- Employment: employee ID, position, grade, manager, dates, status, salary, pay type  
- Org: `sectorId` / `subSectorId` / `subSubSectorId`  
- Bank: bank name, account name/number, branch (CBE-oriented defaults)  
- Documents: resume metadata  

Exports and ID cards surface subsets of this data — treat Excel downloads as sensitive.

---

## Payroll notes (internal)

See also `roles.md` for role × payroll matrix.

GaDA sheet concepts:

- Earnings: basic, house / telephone / transport allowances → gross  
- Statutory: employee pension 11%, employer GaDA pension 11% (reported), Ethiopia PAYE  
- Deductions: membership, advance, other → net  
- Unpaid approved leave days can feed **Other** (basic ÷ 30 × days)  
- Advances: full vs installment repayment into payroll suggestions  
- One active payroll row per employee per calendar month  
- Approve → payslip + notify; mark paid + bank CSV  

---

## Seeded org examples

Used in demos / seeds (not marketing copy):

- Business Sector → Nechisar Hotel → 40 Springs  
- Charity as sibling top sector in seed data  

---

## Git committer (this repo)

Preferred identity for pushes to the org repo:

- Name: `chapi1234`  
- Email: `metasebiyawasfaw@gmail.com`

Set **locally** (do not put in public README):

```bash
git config user.name "chapi1234"
git config user.email "metasebiyawasfaw@gmail.com"
```

---

## Related docs

- Public overview: [`README.md`](../README.md)  
- Roles & capabilities (no passwords): [`roles.md`](../roles.md)  
