# High Dense Office

A production-ready internal platform for employee work assignment, progress
tracking, monitoring, communication, and meeting management — built to feel
like a real enterprise SaaS tool, not a to-do app.

## Project Overview

High Dense Office centralizes everything a company needs to run day-to-day delivery work:

- Administrators create employees, define dynamic roles/permissions, manage
  departments/designations, create projects, assign tasks, and monitor
  progress and activity across the org.
- Employees see their assigned work, update task progress, manage personal
  todos, chat with teammates (group rooms and 1-to-1), join meetings, and
  track deadlines on a calendar.
- Every important action is written to an immutable activity log for audit.

## Features

- **Authentication** — email/password; employees must already exist in the
  database (created by an admin, with a password set) before they can sign
  in. No account gets admin access by default.
- **RBAC** — dynamic roles + a permission master, with server-side
  enforcement on every server action, route handler, and page (never just
  hidden UI).
- **Employees, Departments, Designations** — full CRUD masters.
- **Projects & Tasks** — statuses, priorities, progress percentage, task
  comments, and an immutable progress-update history per task.
- **Personal Todos** — separate from assigned tasks.
- **Chat** — group rooms and 1-to-1 direct messages, with Redis-backed
  presence/unread counters and a polling-based live update loop.
- **Meetings** — scheduling, participants, and auto-generated Jitsi Meet
  links (swappable provider).
- **Calendar** — month/week/day views combining meetings, task deadlines,
  and project milestones, scoped to what the signed-in user is allowed to see.
- **Notifications** — in-app notification center with a navbar dropdown.
- **Activity Logs** — searchable, filterable, paginated audit trail.
- **Employee Monitoring** — legitimate, application-activity-based overview
  only (task counts, last action). No keylogging, screen, or webcam capture.
- **Reports** — task completion, project progress, department/employee
  workload, and activity summaries.
- **Global search** — debounced search across employees, projects, tasks,
  and meetings.
- **Light/dark theme**, fully responsive (desktop/tablet/mobile).

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling / UI | Tailwind CSS v4, shadcn/ui (Radix base), Lucide icons |
| Forms / validation | React Hook Form + Zod |
| Data tables | TanStack Table |
| Charts | Recharts (via shadcn `chart`) |
| Database | MySQL/MariaDB via Prisma ORM (driver adapter) |
| Cache / presence / rate limiting | Upstash Redis (REST, free tier) |
| Auth | Auth.js (NextAuth v5) — Credentials (email/password), Prisma adapter |
| Meetings | Jitsi Meet (public instance, swappable) |

## Architecture

```
src/
├── app/
│   ├── login/                # Public sign-in page
│   ├── (dashboard)/          # Authenticated app shell (sidebar + navbar)
│   │   ├── dashboard/ employees/ roles/ departments/ designations/
│   │   ├── projects/ tasks/ todos/ chat/ meetings/ calendar/
│   │   ├── activity-logs/ monitoring/ reports/ notifications/
│   │   └── profile/ settings/
│   └── api/auth/[...nextauth]/  # Auth.js route handler
├── components/
│   ├── ui/            # shadcn/ui primitives (generated, safe to customize)
│   ├── layout/         sidebar, navbar, theme toggle, notifications
│   ├── dashboard/      stat cards, charts, role-specific dashboards
│   ├── tasks/          status/priority badges, task progress row, forms
│   ├── chat/           chat window (shared by rooms + direct messages)
│   ├── search/         global search
│   └── data-table/     reusable TanStack Table wrapper
├── lib/
│   ├── auth/           NextAuth config, session→permission loading
│   ├── db/             Prisma client (driver-adapter wired)
│   ├── redis/          Upstash client, presence, rate limiting
│   ├── permissions/    permission constants + server-side enforcement
│   ├── validations/    Zod schemas (client + server share these)
│   ├── activity/       immutable activity logger
│   ├── notifications/  notification creation helper
│   └── meetings/       Jitsi link generation
├── server/
│   ├── actions/        Server Actions — every one calls
│   │                   requireAuth()/requirePermission() first
│   └── services/       Read-heavy aggregation queries (dashboard, reports,
│                       monitoring) used by Server Components
├── types/              next-auth session/JWT type augmentation
└── proxy.ts            Next.js 16 "proxy" (middleware) convention — an
                        edge-only auth gate, NOT where permissions are
                        enforced (see below)

prisma/
├── schema.prisma       Full relational schema (see below)
└── seed.ts             Seeds roles, permissions, departments, designations,
                         a Super Admin, and demo data
```

Business logic lives in `lib/` and `server/`, never inside UI components.

## Authentication Architecture

- **Provider**: a single Credentials (email/password) provider
  (`next-auth`/Auth.js v5), backed by the Prisma adapter. Passwords are
  hashed with bcrypt (`src/lib/auth/password.ts`, 12 salt rounds) and stored
  in `User.passwordHash` — never in plaintext, never logged. Sign-in is
  rate-limited per email via Upstash (`authLimiter` in
  `src/lib/redis/rate-limit.ts`). There is no OAuth provider — if a `User`
  row has no `passwordHash` set, that account cannot sign in at all.
- **Session strategy**: JWT. The `jwt` callback re-loads the user's role and
  permissions from MySQL (via `loadAuthUserContext`, cached in Redis for 30s)
  on every sign-in and periodically thereafter, so a permission change made
  by an admin reaches active sessions within ~30 seconds without forcing a
  re-login.
- **No self-service accounts**: `authorize()` only succeeds for an existing,
  active `User` row with a matching password hash. This is what keeps every
  account from getting default access — employees must be created by an
  admin first, with a password set (the Add Employee form requires one).
  There's no self-registration.
- **Edge gate vs. real enforcement**: `src/proxy.ts` (Next's "proxy"/
  middleware convention) only checks "is there a session at all" and
  redirects anonymous visitors to `/login`. It does **not** check
  permissions, because Prisma can't run on the Edge runtime. Real
  authorization happens in `requirePermission()` (see below), called at the
  top of every Server Action, Route Handler, and protected page.

## RBAC & Permission Architecture

- `roles`, `permissions`, `role_permissions` tables — nothing is hard-coded.
  `src/lib/permissions/constants.ts` is the single source of truth for which
  permission keys exist (e.g. `task.create`, `project.delete`); the seed
  script inserts them.
- `src/lib/permissions/check.ts` exports `requireAuth()` and
  `requirePermission(key)` — every server action calls one of these as its
  **first line**. If the check fails, the action throws before touching the
  database. The sidebar (`src/lib/nav-config.ts`) also filters by
  permission, but that's convenience UI, not security — the server checks
  are what actually protect data.
- Admins manage roles and edit a role's permission set via a checklist UI at
  `/roles/[id]` (mirrors the "✓ View Employees / ✗ Manage Roles" example from
  the spec). The `Super Admin` role is marked `isSystem` and cannot be edited
  or deleted.

## Redis Usage (Upstash)

Redis is a cache/ephemeral layer only — **MySQL is always the source of
truth**. If Upstash isn't configured, every Redis-backed feature degrades to
a no-op (see `src/lib/redis/client.ts`) rather than breaking the app:

| Use | Where |
|---|---|
| Auth/permission cache (30s TTL) | `lib/auth/get-user-context.ts` |
| Online/offline presence | `lib/redis/client.ts` (`markUserOnline`, `getOnlineUserIds`) |
| Unread message counters | `lib/redis/client.ts` (per room/conversation) |
| Rate limiting (chat sends, auth, general API) | `lib/redis/rate-limit.ts` via `@upstash/ratelimit` |

This stays well within the Upstash free tier for an internal team — nothing
here is unbounded (short TTLs, small per-user keys).

## Database Schema

MySQL/MariaDB via Prisma (`prisma/schema.prisma`). Key tables:

```
users · roles · permissions · role_permissions
departments · designations
projects · project_members
tasks · task_comments · task_progress_updates
todos
chat_rooms · chat_room_members · conversations · messages
meetings · meeting_participants
notifications
activity_logs (insert-only, immutable — no update/delete mutation exists)
accounts · sessions · verification_tokens   (Auth.js tables)
```

Notable design choices:
- Soft deletes (`deletedAt`) on `users`, `projects`, `tasks`, `roles`,
  `departments`, `designations`, `task_comments` — nothing important is
  hard-deleted.
- `activity_logs` is append-only by convention: no server action ever
  updates or deletes a row in it.
- `messages` supports both group rooms (`roomId`) and 1-to-1 DMs
  (`conversationId`) via two nullable foreign keys on one table, since both
  share the same shape (sender, content, timestamps).
- Indexes on every frequently-filtered column (status, priority, dueDate,
  foreign keys used in dashboard/report queries).

### Why `prisma.config.ts` exists

Prisma 7 removed reading `url` directly from `datasource` in
`schema.prisma` — the CLI now needs `prisma.config.ts` for
migrate/push/studio, and the running app needs an explicit **driver
adapter**. This project uses `@prisma/adapter-mariadb` (talks to both MySQL
and MariaDB). `DATABASE_URL` still uses the standard `mysql://` scheme you'd
expect — `src/lib/db/prisma.ts` parses it into the adapter's connection
config itself, so you never need a non-standard URL scheme.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in real values (see
`REQUIREMENTS.md` for what each external service needs):

```env
DATABASE_URL="mysql://root:@localhost:3306/employee_work_management"
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
AUTH_SECRET=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SUPER_ADMIN_EMAIL=""
SUPER_ADMIN_PASSWORD=""
```

`.env.local` is git-ignored (see `.gitignore`); `.env.example` is the only
env file committed, and it holds placeholders only. Never commit real
secrets.

## Installation

**Prerequisites**: see `REQUIREMENTS.md` (Node 20+, XAMPP, an Upstash Redis
database).

```bash
git clone <this-repo>
cd employee-work-management
cp .env.example .env.local   # then fill in real values
npm run setup                 # installs deps, pushes the DB schema, seeds data
npm run dev
```

`npm run setup` is a single command that replaces the old multi-step
"install packages one by one, then migrate, then seed" flow — see
**Development** below for the equivalent manual steps if you want to run
them individually.

## XAMPP Setup

1. Install XAMPP: https://www.apachefriends.org/
2. Open the XAMPP Control Panel and start **Apache** and **MySQL**.
3. Open phpMyAdmin: http://localhost/phpmyadmin
4. Create a database named `employee_work_management` (this repo's seed/push
   scripts assume this name — see `DATABASE_URL` above).
5. If your MySQL root user has a password, put it in `DATABASE_URL`
   (URL-encode special characters — e.g. `@` becomes `%40`).

### Troubleshooting: "Cannot load from mysql.proc. The table is probably corrupted"

If `npm run db:push` / `npm run db:migrate` fails with this MariaDB error
(code 1728), it means MariaDB's *binaries* were upgraded but its internal
system tables weren't. This is common on XAMPP installs that have been
updated over time, and it's unrelated to your actual application data. Fix
it once, from the XAMPP `mysql/bin` folder:

```bash
mysql_upgrade.exe -u root -p
```

(Add `-p` only if your root user has a password.) This repairs MariaDB's
internal `mysql`/`performance_schema` tables — it does **not** touch or
drop any of your other databases. Restart MySQL afterward and re-run
`npm run db:push`.

## MySQL/phpMyAdmin Setup

Already covered above — this app never talks to MySQL directly from the
browser; all queries go through Prisma on the server.

## Auth Secret Setup

Generate `AUTH_SECRET`: `openssl rand -base64 32` (or any 32+ byte random
string) and put it in `.env.local`.

## Upstash Redis Setup

1. Create a free database at https://console.upstash.com/
2. Copy the **REST API** URL and token (not the raw `redis://` connection
   string) into `.env.local` as `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN`.
3. Nothing else to configure — the app auto-detects Redis and degrades
   gracefully (presence/rate-limiting become no-ops) if it's left empty,
   which is convenient while developing locally.

## Database Migration & Seed Data

```bash
npm run db:push      # applies prisma/schema.prisma to MySQL (dev-friendly)
npm run db:migrate   # alternative: versioned migrations (prisma migrate dev)
npm run db:seed      # seeds roles, permissions, departments, designations,
                      # a Super Admin, and demo employees/projects/tasks
```

The seed script provisions the **first Super Admin** using the
`SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` environment variables (the email
defaults to the email used to generate this project, but there is no
password default — without `SUPER_ADMIN_PASSWORD` set, the account is
created with no password and cannot sign in). Set both in `.env.local`
before seeding, then sign in with that exact email/password.

Set `SEED_DEMO_DATA=false` in `.env.local` before seeding to skip the demo
project/tasks/chat room and only get roles/permissions/departments/admin.

## Development

```bash
npm install
npx prisma generate   # regenerates automatically after npm install too (postinstall)
npm run db:push
npm run db:seed
npm run dev
```

Visit http://localhost:3000 and sign in with the Super Admin's
email/password to create your first real employees, roles, and projects.

## Production Build

```bash
npm run build
npm start
```

## How to Create the First Admin

The very first admin can't be created through the UI (there's no admin yet
to create them) — that's what `prisma/seed.ts` is for. It inserts a `User`
row with `isAdmin: true` and the `Super Admin` role for the email in
`SUPER_ADMIN_EMAIL`. Set `SUPER_ADMIN_PASSWORD` in `.env.local` before
seeding — without it the account has no password and cannot sign in at all,
since there's no OAuth fallback. Run `npm run db:seed`, then sign in. From
there, use **Employees → Add Employee** to onboard everyone else and assign
them ordinary roles (the Add/Edit Employee form requires a password on
creation, since that's the only way the account will ever be able to sign
in).

## How to Test the Complete System

1. **Auth**: sign in with the seeded Super Admin's email/password; confirm an
   unknown email or wrong password is rejected with "Invalid email or
   password" and a deactivated account's login is rejected too.
2. **RBAC**: create a role with only `task.view`/`task.update`, assign it to
   a test employee, and confirm they can't see Employees/Roles/Reports in
   the sidebar — then confirm the server also refuses direct action calls
   for permissions they lack (not just hidden UI).
3. **Employees/Departments/Designations**: create, edit, deactivate.
4. **Projects/Tasks**: create a project, add tasks, assign them, update
   progress as the assignee, and confirm progress history + activity logs
   record it.
5. **Todos**: add/complete/delete a personal todo.
6. **Chat**: create a group room, send messages; start a 1-to-1
   conversation with another seeded user.
7. **Meetings**: schedule one with a start/end time, confirm a Jitsi link
   is generated and joinable.
8. **Calendar**: confirm the meeting and a task's due date both appear.
9. **Notifications**: confirm assigning a task/scheduling a meeting creates
   a notification for the other party.
10. **Activity Logs / Reports / Monitoring**: confirm the actions above show
    up, and that reports/monitoring pages require `report.view`/
    `activity.view` permissions.

## Deployment

This is a standard Next.js app — deploy anywhere that runs Node 20+ (a VM,
a container, or a platform like Vercel/Render). You'll need:
- A reachable MySQL/MariaDB instance (XAMPP is for local development only —
  use a managed MySQL/MariaDB service in production).
- The same environment variables as `.env.local`, set via your host's
  secret/environment configuration — never in source control.
- `npm run build && npm start`, with `npx prisma migrate deploy` run once
  against the production database beforehand.

## Troubleshooting

- **"Cannot load from mysql.proc"** — see the XAMPP Setup section above.
- **"Invalid email or password" even though the email exists** — the user's
  `passwordHash` is probably `NULL` (e.g. the Super Admin seeded without
  `SUPER_ADMIN_PASSWORD`, or an employee created before a password was set).
  Set/reset a password from **Employees → Edit** (admin) or re-seed with
  `SUPER_ADMIN_PASSWORD` set.
- **Redis features silently doing nothing** — expected if
  `UPSTASH_REDIS_REST_URL`/`TOKEN` are empty; the app runs fine without
  Redis, just without presence/rate-limiting/caching.
- **Prisma CLI pulls in an unrelated `8.0.0-rc` version** — this repo pins
  `prisma`/`@prisma/client` to an exact stable version and uses npm
  `overrides` to keep transitive deps (`mariadb`, `mysql2`) patched. Run a
  plain `npm install` (not `npm install prisma@latest`) to stay on the
  tested versions.
