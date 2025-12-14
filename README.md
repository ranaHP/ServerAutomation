# ReleasePilot

ReleasePilot is a monorepo that ships a secure automation portal for deploying or rolling back custom-plugin JARs on RHEL targets through SSH.

## Repository layout
```
releasepilot/
  server/        # Express + sqlite + ssh2 backend
  web/           # Vite + React + Tailwind frontend
```

## Prerequisites
- Node.js 18+
- npm
- OpenSSH private key accessible to the backend host
- Native build toolchain for `better-sqlite3` (only required on platforms without prebuilt binaries)

## Setup
1. Clone the repository and copy environment files:
   ```bash
   cp server/.env.example server/.env
   cp web/.env.example web/.env
   ```
2. Edit `server/.env` to point to your SSH key and web origin.
3. Configure inventory in `server/inventory/servers.yml` with approved UAT/PROD hosts.

## Install dependencies
Install dependencies per package using npm (preferred for this repo):

```bash
cd server && npm install
cd ../web && npm install
```

### Windows build notes (better-sqlite3)
`better-sqlite3` ships prebuilt binaries for common Node versions and platforms, but Windows users may need to compile from source when a matching binary is unavailable. Install the following prerequisites, then rerun `npm install` inside `server/`:

- Visual Studio 2022 Build Tools with the **Desktop development with C++** workload
- Python 3.x on PATH
- Node.js build tools available on PATH (from the VS Build Tools install)

After installing the tools, restart your terminal and run:

```powershell
cd server
npm install
```

If you prefer not to install a Windows build toolchain, running the backend inside WSL with Node 18+ is also supported.

## Running locally
In two shells:
```bash
cd server && npm run dev
cd web && npm run dev
```
Backend listens on port 4000 by default; frontend on 5173.

## Production build
```bash
cd server && npm run start
cd web && npm run build
```
Serve `web/dist` behind your preferred web server and point it at the running API.

## Security notes
- Change the seeded admin password (`admin123!`) immediately after first login.
- Restrict SSH keys to least privilege; avoid sharing with other systems.
- Keep `inventory/servers.yml` limited to approved hosts. Operators can target UAT only; admins can reach PROD.
- Backend enforces JWT auth, rate-limited login, and SSE for safe log streaming without storing passwords.

## Default credentials
```
username: admin
password: admin123!
```
Update via the database or future user-management endpoints after first use.
