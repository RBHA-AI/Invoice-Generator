# Multi-tenant workspaces

Each customer gets an isolated **workspace**: their own companies, clients, invoices, email templates, and logo files. Your historical data stays in the default workspace after migration.

## Before you deploy

1. **Back up databases** (mandatory):

```bash
./scripts/backup.sh
```

2. Set in `.env` (see `.env.example`):

- `JWT_SECRET` — long random string (required in production)
- `ADMIN_SECRET` — used to create new workspaces via API or CLI
- `DEFAULT_WORKSPACE_SLUG` — login name for your existing data (e.g. `rbhargava`)
- `DEFAULT_WORKSPACE_PASSWORD` — password for that workspace on first boot

On first start, all existing rows in `invoices.db` are assigned to the default workspace.

## Sign in

Open the app → **Sign in** with:

- **Workspace name** — the slug (e.g. `rbhargava`)
- **Password** — workspace password

## Create a new customer workspace (admin only)

### CLI (recommended)

```bash
node scripts/create-workspace.js \
  --slug acme-corp \
  --name "Acme Corp" \
  --password 'TheirSecurePass123'
```

Hand off **workspace name** (`acme-corp`) and **password** to the customer. They start with an empty workspace.

### HTTP API

```bash
curl -X POST http://localhost:5000/api/admin/workspaces \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET" \
  -d '{"slug":"acme-corp","displayName":"Acme Corp","password":"TheirSecurePass123"}'
```

## Deploy checklist

1. Run `./scripts/backup.sh`
2. Set `JWT_SECRET`, `ADMIN_SECRET`, and default workspace env vars
3. Deploy and restart the server
4. Sign in as the default workspace — confirm existing invoices are visible
5. Create a test workspace via CLI and sign in — confirm lists are empty
6. Create a company + invoice in the test workspace

## Security notes

- All tenant APIs require `Authorization: Bearer <token>` from `POST /api/auth/login`
- Cross-tenant access by UUID returns 404
- HSN/SAC search remains shared reference data (read-only for all workspaces)
- Logo files are stored under `server/uploads/logos/<workspaceId>/`
