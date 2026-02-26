/**
 * Switch Prisma schema based on DATABASE_URL
 *
 * Auto-detects database provider from URL format:
 * - SQLite: file:./path/to/db
 * - PostgreSQL: postgres://... or postgresql://...
 *
 * Usage: node scripts/switch-db.js
 */

const fs = require('fs');
const path = require('path');

// Load .env for local development only (not on Vercel)
// Vercel injects env vars directly into process.env
if (!process.env.VERCEL) {
  require('dotenv').config();
}

const dbUrl = process.env.DATABASE_URL || '';

// Detect provider from URL
let provider = 'sqlite'; // default

if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
  provider = 'postgresql';
} else if (dbUrl.startsWith('mysql://')) {
  provider = 'mysql';
} else if (dbUrl.startsWith('file:')) {
  provider = 'sqlite';
} else if (dbUrl.includes('prisma.io')) {
  // Prisma Postgres
  provider = 'postgresql';
}

// Log for debugging
const urlPreview = dbUrl.length > 30 ? dbUrl.substring(0, 30) + '...' : dbUrl || '(empty)';
console.error(`[switch-db] DATABASE_URL: ${urlPreview}`);
console.error(`[switch-db] Detected provider: ${provider}`);
console.error(`[switch-db] Environment: ${process.env.VERCEL ? 'Vercel' : 'Local'}`);

const sourceFile = path.join(__dirname, '..', 'prisma', `schema.${provider}.prisma`);
const destFile = path.join(__dirname, '..', 'prisma', 'schema.prisma');

// Check if source file exists
if (!fs.existsSync(sourceFile)) {
  console.error(`Error: Schema template not found: ${sourceFile}`);
  console.error(`Available providers: sqlite, postgres`);
  process.exit(1);
}

// Copy the appropriate schema
fs.copyFileSync(sourceFile, destFile);

console.log(`[switch-db] Switched to ${provider}`);
