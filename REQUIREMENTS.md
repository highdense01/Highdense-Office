# Requirements

This project is a Node.js/Next.js application, so there is no Python-style
`requirements.txt`. This document lists everything you need installed and
configured before running the app. (Node package requirements are managed
via `package.json` / `package-lock.json` as usual — run `npm install`.)

## 1. System Requirements

| Requirement | Minimum Version | Notes |
|---|---|---|
| OS | Windows 10/11, macOS, or Linux | Developed/tested on Windows 11 |
| Node.js | 20.x LTS or newer | Required by Next.js 16 |
| npm | 10.x or newer | Ships with Node.js |
| Git | any recent version | For version control |
| RAM | 4 GB minimum, 8 GB+ recommended | |
| Disk space | ~1 GB free (node_modules + build cache) | |

Check your versions:

```bash
node -v
npm -v
git --version
```

## 2. Database Requirements

- **XAMPP** (Apache + MySQL/MariaDB + phpMyAdmin)
  - Download: https://www.apachefriends.org/
  - Only the **MySQL/MariaDB** and **Apache** (for phpMyAdmin) modules are
    required; other bundled services are optional.
- A MySQL/MariaDB database named `employee_work_management`
  (created via phpMyAdmin — see README "XAMPP Setup").

## 3. Authentication Requirements

- Email/password only — no external OAuth provider is required.
- `AUTH_SECRET` (32+ byte random string, e.g. `openssl rand -base64 32`).
- `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` set before running
  `npm run db:seed`, so the first admin account actually has a password
  (there is no fallback sign-in method).

## 4. Caching / Presence Requirements

- A free **Upstash Redis** database (https://upstash.com/)
  - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the
    Upstash console (REST API credentials, not the raw Redis URL).
  - The Free Tier is sufficient (see README "Upstash Redis Setup" for
    usage limits and how this app stays within them).

## 5. Meetings Requirement

- No installation needed. Meeting links use the public **Jitsi Meet**
  instance (`https://meet.jit.si/<room>`). No account or server setup
  required for development.

## 6. Browser Requirements

- A modern evergreen browser: Chrome, Edge, Firefox, or Safari (latest
  two major versions). The UI is responsive and supports desktop,
  tablet, and mobile viewports.

## 7. Environment Variables

All required environment variables are documented in [.env.example](.env.example)
and must be copied into a local `.env.local` file (never committed).
See the README's "Environment Variables" section for details on each
variable.

## 8. Summary Checklist

- [ ] Node.js 20+ and npm installed
- [ ] XAMPP installed, Apache + MySQL running
- [ ] `employee_work_management` database created in phpMyAdmin
- [ ] `AUTH_SECRET` generated and `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` set
- [ ] Upstash Redis database created (REST URL + token copied)
- [ ] `.env.local` created from `.env.example` and filled in
- [ ] `npm install` run successfully
- [ ] `npx prisma migrate dev` (or `db push`) run successfully
- [ ] `npm run db:seed` run successfully
- [ ] `npm run dev` starts the app at http://localhost:3000
