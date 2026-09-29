# GammoDA HR System — Roles Guide

This document describes **what each role includes** and **what each role can do** in the current system.

Every account has a **role**. Org Admin and Org HR are always organization-wide. Sector Lead is always tied to one top sector. Managers lead a sub-sector; Unit Managers lead a nested sub-sub-sector.

---

## Role overview

| Role | Purpose | Scope |
|------|---------|-------|
| **Super Admin** | Own the whole system | Always organization-wide |
| **Org Admin** (`admin`) | Org accounts & structure | Always organization-wide |
| **Org HR** (`hr`) | Central people operations | Always organization-wide |
| **Sector Lead** (`sector_lead`) | Sector admin + HR combined | One top sector (e.g. Business) |
| **Manager** (`manager`) | Lead a sub-sector | One sub-sector (e.g. Nechisar Hotel) |
| **Unit Manager** (`unit_manager`) | Lead a nested unit | One sub-sub-sector (e.g. 40 Springs) |
| **Employee** | Self-service staff | Assigned unit |

> **Note:** Sector Admin and Sector HR were merged into **Sector Lead** to remove overlap.

---

## Scope levels

| Scope | Meaning | Who uses it |
|-------|---------|-------------|
| `organization` | Whole GammoDA | Super Admin, Org Admin, Org HR |
| `sector` | One top sector + all units under it | Sector Lead |
| `sub_sector` | One unit (e.g. Nechisar Hotel) | Manager, Employee |
| `sub_sub_sector` | Nested unit (e.g. 40 Springs) | Unit Manager, Employee |

**Data rule:** users only see employees, leave, attendance, payroll, etc. that fall inside their scope (or themselves).

---

## Demo login accounts (seeded)

Credentials for seeded demo users are **not** listed here (public doc).

👉 Maintainers: see **[`docs/INTERNAL.md`](./docs/INTERNAL.md)**  
(`npm run seed:sectors` in `Backend`).

---

## 1. Super Admin (`superadmin`)

Highest privilege. Full control of the GammoDA HR portal.

- Create any role (including Super Admin, Org Admin, Org HR, Sector Lead)
- Manage full sector tree
- Admin Console
- All modules, all sectors

---

## 2. Org Admin (`admin`)

Organization administration across **all** sectors.

- Admin Console
- Create: Org Admin, Org HR, Sector Lead, Manager, Unit Manager, Employee
- Manage sector tree (with Org HR / Super Admin)
- Full HR ops org-wide **except payroll mutations** — payroll list is **read-only**
- Cannot create Super Admin

---

## 3. Org HR (`hr`)

Central people operations across **all** sectors.

- Create: Org Admin, Org HR, Sector Lead, Manager, Unit Manager, Employee
- Employees, leave, payslips, recruitment, devices — org-wide
- **Payroll:** create org-wide GaDA sheet rows; **approve / reject** pending payrolls from managers
- Can help manage sector tree
- **No** Admin Console
- Cannot edit/delete manager-prepared payrolls (approve/reject only)

---

## 4. Sector Lead (`sector_lead`)

**Merged Sector Admin + Sector HR.** One role that runs a top sector.

### Sees / manages
Everything in **one sector** (e.g. Business) including all sub-sectors under it — not the other top sector.

### Can do
- Employees, leave, attendance, salary/payslips, recruitment, devices (sector only)
- Create **Manager**, **Unit Manager**, and **Employee** inside that sector
- View sector structure (cannot reshape the whole org tree)

### Cannot
- See Charity (if assigned to Business) or vice versa
- Create Org Admin / Org HR / Super Admin / peer Sector Leads
- Open Admin Console
- Delete org sector units

### Demo
See `docs/INTERNAL.md` (Sector Lead account).

---

## 5. Manager (`manager`)

Unit leader for one **sub-sector** (e.g. Nechisar Hotel).

- Team employees, leave review, attendance, goals
- Create **Unit Manager** and **Employee** under their sub-sector
- **Payroll:** create / update / delete **pending** GaDA payroll sheet rows for staff in their sub-sector only (Org HR must approve)
- Own devices (not device inventory)
- No recruitment

### Demo
See `docs/INTERNAL.md` (Manager account).

---

## 6. Unit Manager (`unit_manager`)

Leader for one **sub-sub-sector** (nested unit under a sub-sector).

- Same day-to-day team tools as Manager, but only for that nested unit
- Create **Employee** only (in their unit)
- Calendar announcements visible only to that unit
- **Payroll:** view scoped records only (no create / edit / approve)
- Own salary / own devices

### Demo
See `docs/INTERNAL.md` (Unit Manager account).

---

## 7. Employee (`employee`)

Self-service only: attendance, leave, own salary, own devices, goals, profile.

Public signup can only create Employee accounts.

### Demo
See `docs/INTERNAL.md` (Employee account).

---

## Payroll workflow (GaDA sheet)

Matches **Gamo Development Association Salary Payment Payroll Sheet**:

| Column | Notes |
|--------|--------|
| Basic Salary | Required |
| House / Telephone / Transport allowances | Earnings |
| Pension GaDA 11% | Employer contribution (reported; auto from basic) |
| Pension 11% | Employee contribution (in total deduction; auto from basic) |
| Gross | Basic + allowances |
| Income tax | Ethiopia PAYE on Gross (auto if blank; editable) |
| Membership, Advance, Other | Deductions |
| Total deduction | Employee pension + tax + fees + advance + other |
| Net | Gross − total deduction |

| Role | Create | Edit / Delete pending | Approve / Reject | View list |
|------|:------:|:---------------------:|:----------------:|:---------:|
| Sub-sector Manager | Own sub-sector | Yes | No | Sub-sector |
| Org HR | Organization-wide | Own drafts only* | Yes | All |
| Sector Lead | No | No | No | Sector (read-only) |
| Org Admin / Super Admin | No | No | No | All (read-only) |
| Employee | No | No | No | Own rows |

\*Backend allows Org HR to fix pending rows they prepared; UI emphasizes approve/reject for HR.

**Rules**
- At most **one active payroll** (`pending` / `approved` / `paid`) per employee per calendar month.
- **Export Excel** from the Salary page for the selected month (GaDA columns).
- On **approve**, a **payslip** is generated automatically and the employee is notified.
- **Mark as paid** (Org HR) after approval — with payment reference; Bank CSV export for approved/paid.
- **Batch generate**, **bulk approve/reject**, **month lock**, manager **reminders**.
- PAYE auto-calc uses **Gross − employee pension**.
- Open advances default-selected; remaining balance supports installments across months.
- Approved **unpaid** leave days in the month add to **Other** (basic÷30 × days).
- Payroll rows keep an **auditLog** of create/update/approve/reject/paid.

### Salary advances (record when taken)

1. **Manager / Org HR** records an advance when the employee takes money (`open`).
2. On payroll create/edit, select open advances → amount fills **Salary advance** and advances become `applied`.
3. When Org HR **approves** payroll, linked advances become `recovered`.
4. If payroll is **deleted** or **rejected**, applied advances reopen as `open`.
5. Open advances can be **cancelled** (Manager in sub-sector; Org HR org-wide).
6. **Employee notify:** when an advance or payroll row is created in their name, they get an **email** plus a live **in-app bell** alert (if online). Advance alerts open **My Advances**; payroll alerts open **My Salary**.
7. Employees can **view** their own advances (read-only) under **My Advances**.

| Role | Record / Cancel open | Apply on payroll | Recover (via approve) | View |
|------|:--------------------:|:----------------:|:---------------------:|:----:|
| Sub-sector Manager | Sub-sector | Yes (pending rows) | No | Sub-sector |
| Org HR | Organization-wide | On create | Yes (approve) | All |
| Sector Lead / Admin / Super Admin | No | No | No | Scope (read-only) |
| Employee | No | No | No | Own (read-only) |

---

## Who manages what (example)

```text
GammoDA (Org Admin / Org HR / Super Admin — all sectors)
│
├── Business Sector ← Sector Lead
│   ├── Nechisar Hotel ← Manager
│   └── Tourism Development
│       ├── 40 Springs ← Unit Manager
│       └── Crocodile Breeding ← Unit Manager
│
└── Charity Sector ← its own Sector Lead
    └── …
```

---

## Capability matrix

| Capability | Super Admin | Org Admin | Org HR | Sector Lead | Manager | Unit Manager | Employee |
|------------|:-----------:|:---------:|:------:|:-----------:|:-------:|:------------:|:--------:|
| Admin Console | Yes | Yes | No | No | No | No | No |
| Manage sector tree | Yes | Yes | Yes | View | View | View | No |
| Create Super Admin | Yes | No | No | No | No | No | No |
| Create Org Admin / Org HR | Yes | Yes | Yes | No | No | No | No |
| Create Sector Lead | Yes | Yes | Yes | No | No | No | No |
| Create Manager | Yes | Yes | Yes | Yes* | No | No | No |
| Create Unit Manager | Yes | Yes | Yes | Yes* | Yes* | No | No |
| Create Employee | Yes | Yes | Yes | Yes* | Yes* | Yes* | No |
| Employees (others) | All | All | All | Sector | Sub-sector | Nested unit | No |
| Leave review | All | All | All | Sector | Sub-sector | Nested unit | Own |
| Payroll / payslips manage | View | View | Approve + create | View | Create/edit pending | View | Own view |
| Salary advances | View | View | Record + cancel | View | Record + cancel | View | Own view |
| Payslips | View | View | Auto on approve | View | View (own/team via payroll) | Own view | Own view |
| Recruitment | Yes | Yes | Yes | Sector | No | No | No |
| Device inventory (create/edit/delete) | Yes | Yes | Yes | No | No | No | No |
| Device assign / return | Yes | Yes | Yes | Sector (needs HR approval) | Own | Own | Own |
| Approve device assignments | Yes | Yes | Yes | No | No | No | No |
| Org-wide data | Yes | Yes | Yes | No | No | No | No |

\* Only inside their organizational unit / sector.

---

## Device management workflow

- **Inventory CRUD** (add / edit / delete devices): Org HR, Org Admin, Super Admin only.
- **Assign / return / reassign**: HR and above. Sector Leads can only assign to employees **in their sector**, and their assignment stays **`pending_approval`** until Org HR / Admin / Super Admin approves or rejects it (both sides get notified).
- **Return due date**: optional on assignment. When the date arrives the holder gets an in-app notification **and email**, repeated daily while overdue.
- Device types have their own fields and table columns: PC/electronics (RAM, storage), Cameras (megapixels, resolution, lens), Motorcycles (plate, chassis, engine cc, color, year).

---

## Announcement visibility

| Poster | Who sees it |
|--------|-------------|
| Org HR / Org Admin / Super Admin | Everyone (organization-wide) |
| Sector Lead | Everyone in that sector (all sub-sectors under it) |
| Manager | Everyone in their sub-sector |
| Unit Manager | Only their nested unit |

**Edit / delete:** only the **creator**, **Org Admin**, or **Super Admin**. Other managers (and Sector Lead / Org HR) can still see events in their scope but cannot change someone else's.

Realtime: the notification bell updates live via Socket.io when an announcement is posted to your scope.

---

## Login note

Sign in with email and password only. The backend uses the role stored on the employee record (no role picker on login).

---

## Related files

- Planning: `modification.md`  
- Frontend capabilities: `Frontend/src/utils/permissions.js`  
- Backend create rules: `Backend/utils/scope.js` → `allowedRolesToCreate`  
- Dashboard modes: `Frontend/src/utils/dashboardModes.js`  
- Seed accounts: `Backend/scripts/seedSectors.js` (`npm run seed:sectors`)
