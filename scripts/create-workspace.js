#!/usr/bin/env node
/**
 * Admin CLI: create an empty workspace for a new customer.
 *
 * Usage:
 *   node scripts/create-workspace.js --slug acme-corp --name "Acme Corp" --password 'SecretPass123'
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Database = require('better-sqlite3');
const { migrateWorkspaces, createWorkspace } = require('../server/workspaces');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--slug' || arg === '-s') out.slug = argv[++i];
    else if (arg === '--name' || arg === '-n') out.displayName = argv[++i];
    else if (arg === '--password' || arg === '-p') out.password = argv[++i];
    else if (arg === '--help' || arg === '-h') out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`Create a new empty workspace (admin only).

Usage:
  node scripts/create-workspace.js --slug <workspace-name> --name "Display Name" --password '<password>'

Options:
  --slug, -s       Workspace login name (lowercase letters, numbers, hyphens)
  --name, -n       Display name shown in the app
  --password, -p   Login password (min 8 characters)
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.slug || !args.displayName || !args.password) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const dbPath = process.env.INVOICES_DB_PATH || path.join(__dirname, '..', 'invoices.db');
  const db = new Database(dbPath);
  migrateWorkspaces(db);

  try {
    const workspace = createWorkspace(db, {
      slug: args.slug,
      displayName: args.displayName,
      password: args.password
    });
    console.log('Workspace created successfully.');
    console.log(`  Slug (login name): ${workspace.slug}`);
    console.log(`  Display name:      ${workspace.displayName}`);
    console.log(`  Workspace id:      ${workspace.id}`);
    console.log('\nHand off the workspace name and password to the customer.');
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
