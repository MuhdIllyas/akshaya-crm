# Organizations (multi-tenancy)

Each business that buys a subscription is an **organization** with its **own
PostgreSQL database**. Its centres, staff, customers, services catalogue and
online requests never mix with another organization's.

```
control DB  (organizations list)
├── default   → your current database (DATABASE_URL)
├── buyer-x   → akshaya_org_buyer_x
└── buyer-y   → akshaya_org_buyer_y
```

## How a request finds its database

1. `tenancy/middleware.js` decides the organization:
   login token's `org` claim → print-station token prefix → `X-Org-Slug`
   header / `?org=` → default organization.
2. The rest of the request runs inside that organization
   (`tenancy/context.js`, AsyncLocalStorage).
3. `db.js` (`pool.query`, `pool.connect`, `req.db`) sends every query to
   that organization's database. **Route code does not change.**
4. Socket.io rooms get an `<slug>|` prefix (`tenancy/io.js`), so `user:1`
   in one organization never reaches `user:1` in another.
5. Cron jobs run once per active organization (`tenancy/jobs.js`).

Without `CONTROL_DATABASE_URL` the server runs exactly as before
(single organization). In multi-organization mode, a query outside any
organization throws instead of guessing.

## Switching it on (VPS)

1. Add to `server/.env`:
   ```
   CONTROL_DATABASE_URL=postgresql://USER:PASS@localhost:5432/akshaya_control
   DEFAULT_ORG_SLUG=default
   ```
   The database user needs `CREATEDB` permission.
2. `node scripts/orgs.js init --name "Your business name"`
3. Apply the migrations, in order:
   ```
   node scripts/orgs.js migrate migrations/2026-11-10-whatsapp-per-org.sql
   node scripts/orgs.js migrate migrations/2026-11-11-centre-bookings.sql
   node scripts/orgs.js migrate migrations/2026-11-11-one-whatsapp-per-centre.sql
   node scripts/orgs.js migrate migrations/2026-11-12-staff-logins.sql
   ```
   The last one stops and names the centres if two centres share one
   WhatsApp account. Give each its own account (or none), then run it again.
4. Platform-admin login: add `PLATFORM_JWT_SECRET=<long random string>` to
   `.env`, then
   `node scripts/orgs.js add-admin --username <you> --password '<10+ chars>' --name "Your name"`
5. Load the standard plans: `node scripts/orgs.js seed-plans`
6. Restart the server. Existing logins keep working: tokens without an
   `org` claim belong to the default organization.

## Standard plans (agreed 2026-11-11)

| Plan | Limits | Yearly | Monthly |
|---|---|---|---|
| Single centre | 1 centre, 8 staff, 2 GB, customer portal, no WhatsApp | ₹4,999 (launch offer ₹2,999) | ₹499 |
| Multi-centre | up to 3 centres, 25 staff, 10 GB, portal and WhatsApp | ₹12,999 | ₹1,299 |
| Group | up to 10 centres, 80 staff, 50 GB, everything | ₹29,999 | ₹2,999 |
| Large group | no limits | quoted | — |

`seed-plans` adds these (existing plans with the same name are left alone).
The launch offer is not a separate plan: record the first payment at ₹2,999.
"Large group" has price 0 because each is quoted: record the agreed amount
as payments (the monthly-revenue card counts only plan prices, so these
organizations show ₹0 there).

## Platform-admin page (`/platform`)

Sign in at `https://<site>/platform/login` (separate from organization logins;
a platform token never works on organization routes, and the other way round).

Sections (sidebar):

- **Overview:** active organizations, monthly revenue, collected this month,
  trials; **Needs attention** (suspended, overdue, grace period, due within
  7 days, trial ending within 7 days, storage over 90%); collections for the
  last 6 months.
- **Organizations:** list with plan, billing state and usage, and **New
  organization** (same as `orgs.js create`, with plan, billing cycle,
  free-trial days and grace days). Opening one: edit details, plan and billing
  dates, **record a payment** (by default it adds one billing cycle after the
  paid period), payment history, portal links, suspend or switch back on.
- **Subscriptions:** every organization's plan, cycle, next due date and
  state, with filters (due soon, overdue, trial, no billing dates).
- **Payments:** every payment by month, who recorded it, and **Download for
  Excel** (CSV).
- **Plans:** price per month and per year; limits on centres, active staff
  (superadmins don't count) and storage (MB). An empty limit means unlimited,
  so a flat-fee plan is a plan with no limits. Customer portal and WhatsApp
  can be switched on or off per plan.
- **Platform admins** (owners): add people to the control panel with a role,
  reset passwords, switch accounts off.
- **Activity log** (owners): who did what, when and from which IP.
- **Settings:** change your password; your recent sign-ins (successful and
  failed).

**Roles** (checked on the server):

| Role | Can |
|---|---|
| Owner | Everything, including plans, admins and the activity log |
| Billing | Organizations, subscriptions and payments |
| Viewer | Read only |

Safety rules: you can't change your own role or switch yourself off, and there
must always be one active owner. Five wrong passwords lock that username for
15 minutes. If every owner is locked out, `node scripts/orgs.js add-admin
--username … --password '…'` on the server resets that account as an active
owner.

**Billing rules.** An organization is covered until the later of its trial
end and paid-until date. After that it keeps working for its grace days,
then a daily job (00:30 IST) suspends it. Recording a payment that covers
today switches it back on, but only if it was suspended for non-payment, not
if you suspended it by hand. Your own organization is never billed or limited.

**Plan limits in the app.**
- Adding a centre or an active staff member beyond the limit is refused.
- Uploads are refused once the organization's folders reach the storage limit.
- With the customer portal off, customer registration, login and booking are
  refused; staff can still manage customers.
- With WhatsApp off, accounts can't be added or switched on, and moving an
  organization to such a plan switches its accounts off.

Changes take effect within 30 seconds. The server keeps the control
database's tables up to date by itself at start-up.

## Adding a buyer from the command line

```
node scripts/orgs.js create --name "Buyer X" --slug buyer-x \
  --admin-username buyerx --admin-password 'StrongPass123' --admin-name "Owner name"
```

This creates an empty database with the same tables as yours, copies
`document_master` (change with `--copy table1,table2`, or `--copy` for none),
and creates their superadmin. Give them:

- Staff login: `https://<site>/portal/buyer-x/login`
- Customer portal: `https://<site>/portal/buyer-x/customer/register`
  (customers log in at the same `/portal/buyer-x/login` link)

Other commands: `list`, `suspend <slug>`, `activate <slug>`.

## Changing the database schema from now on

Every organization has its own copy of the tables, so schema changes must
be applied to all of them. Put the change in a `.sql` file and run:

```
node scripts/orgs.js migrate migrations/2026-11-20-add-column.sql
```

It records what was applied and skips organizations that already have it.

## WhatsApp (Libromi) per organization

Each organization's superadmin sets up WhatsApp in **Communication Settings**:
access token, channel id and the **developer API key** (different from the
access token; needed to save photos/documents customers send).

- **Customer portal OTPs** are sent from the **platform number** (yours, as
  the software owner) for every organization:
  `PLATFORM_WHATSAPP_ACCESS_TOKEN` and `PLATFORM_WHATSAPP_BASE_URL` in `.env`
  (falls back to `LIBROMI_ACCESS_TOKEN` / `LIBROMI_BASE_URL`). The platform
  account needs the approved OTP template. An organization can instead tick
  one of its own accounts: "Send customer portal OTPs from this number".
- **One WhatsApp number per centre.** Two centres can't share an account
  (Centre Management refuses it, and the database blocks it after the
  migration). A centre without an account has WhatsApp off.
- Customers see a **"Chat with a centre"** card with a WhatsApp button for
  every centre that has WhatsApp connected.

- The page shows the **webhook URL** to register in Libromi. Other
  organizations get `…/api/webhook/whatsapp?org=<slug>`; yours is unchanged.
- Libromi bot/flow calls to `/api/whatsapp/...` for another organization
  must also add `?org=<slug>` to the URL.
- `.env` no longer needs `LIBROMI_ACCESS_TOKEN`, `LIBROMI_BASE_URL` or
  `LIBROMI_API_KEY` once your own accounts have them saved in settings
  (until then they are used as a fallback for the default organization
  only). `LIBROMI_PHONE_NUMBER` and `CENTRE_PHONE` are unused.
- Needs the migration `migrations/2026-11-10-whatsapp-per-org.sql`.
- Optional: `PUBLIC_API_URL` in `.env` (default `https://api.akshayasahayi.com`).

## Booking with a specific centre

- Customers choose a centre when booking ("Any centre" is allowed). Each
  centre has its own link and QR code (`/portal/<slug>/c/<centreId>`, shown
  in Settings → Online Bookings). Opening it pre-selects that centre.
- `customer_services.requested_centre_id` is what the customer chose and
  never changes; `handling_centre_id` is the centre that took the job.
- Settings → Online Bookings → **booking mode** for the organization:
  - **Shared with confirmation** (default): every centre sees every booking
    with a "Booked for Centre A" label. Another centre must confirm before
    taking it; the takeover is recorded and Centre A's admin is notified.
  - **Strict**: only the booked centre sees and takes it. "Any centre"
    bookings still go to everyone.
  The rule is enforced by the server (`PUT …/customer-services/:id/take`),
  not only on screen.

## Staff sign-in history

Every staff sign-in and wrong password is recorded in that organization's
`staff_logins` table (migration `2026-11-12-staff-logins.sql`).

- Five wrong passwords for one username lock it for 15 minutes.
- After signing in, the sidebar shows "Last sign-in: …" (the one before).
- Superadmin → Settings → **Sign-in History**: everyone, with a "wrong
  passwords only" filter. Admin → Settings → **Security**: their own centre's
  staff only. Each staff profile has a **Sign-in History** card.
- Before the migration is applied, logins work as before and the history
  is simply empty.

## Uploaded files

New files of other organizations go under `uploads/<slug>/…` and
`private_uploads/<slug>/…`; your organization keeps using `uploads/…`
as before. Old files are not moved. A slug can't be the name of an existing
folder in `uploads/`.

## Not covered yet

- `/uploads` is served publicly (as before); customer documents should be
  served only through the logged-in download routes.
- Online payments (Razorpay or another gateway); payments are recorded by hand.
- Reminders to organizations before their due date.
