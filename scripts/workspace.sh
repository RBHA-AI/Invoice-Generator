#!/usr/bin/env bash
# Manage workspaces (create tenant, set login password).
#
# Create empty workspace for a new customer:
#   ./scripts/workspace.sh --create --workspace acme-corp --password 'SecretPass123' --name "Acme Corp"
#
# Update login password for an existing workspace (e.g. after changing .env — that does NOT auto-update passwords):
#   ./scripts/workspace.sh --set-password --workspace rbhargava --password 'Admin@123'

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ACTION=""
WORKSPACE=""
PASSWORD=""
NAME=""

usage() {
  cat <<'EOF'
Usage:
  ./scripts/workspace.sh --create --workspace <slug> --password '<pwd>' [--name "Display Name"]
  ./scripts/workspace.sh --set-password --workspace <slug> --password '<pwd>'

Examples:
  ./scripts/workspace.sh --create --workspace test-co --password 'TestPass123!' --name "Test Company"
  ./scripts/workspace.sh --set-password --workspace rbhargava --password 'Admin@123'
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --create) ACTION="create" ;;
    --set-password) ACTION="set-password" ;;
    --workspace) WORKSPACE="${2:-}"; shift ;;
    --password) PASSWORD="${2:-}"; shift ;;
    --name) NAME="${2:-}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

if [[ -z "$ACTION" || -z "$WORKSPACE" || -z "$PASSWORD" ]]; then
  echo "Error: --create or --set-password, plus --workspace and --password are required." >&2
  usage
  exit 1
fi

if [[ "$ACTION" == "create" && -z "$NAME" ]]; then
  NAME="$WORKSPACE"
fi

export PROJECT_ROOT ACTION WORKSPACE PASSWORD NAME
node -e "
const path = require('path');
require('dotenv').config({ path: path.join(process.env.PROJECT_ROOT, '.env') });
const Database = require('better-sqlite3');
const {
  migrateWorkspaces,
  createWorkspace,
  updateWorkspacePassword
} = require(path.join(process.env.PROJECT_ROOT, 'server/workspaces'));

const action = process.env.ACTION;
const slug = process.env.WORKSPACE;
const password = process.env.PASSWORD;
const displayName = process.env.NAME || slug;

const dbPath = process.env.INVOICES_DB_PATH || path.join(process.env.PROJECT_ROOT, 'invoices.db');
const db = new Database(dbPath);
migrateWorkspaces(db);

try {
  if (action === 'create') {
    const ws = createWorkspace(db, { slug, displayName, password });
    console.log('Workspace created.');
    console.log('  Login name (slug):', ws.slug);
    console.log('  Display name:     ', ws.displayName);
    console.log('  Workspace id:     ', ws.id);
  } else if (action === 'set-password') {
    const ws = updateWorkspacePassword(db, { slug, password });
    console.log('Password updated for workspace:', ws.slug);
  } else {
    throw new Error('Invalid action');
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
} finally {
  db.close();
}
"
