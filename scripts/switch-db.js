/**
 * Switch Prisma schema based on DATABASE_URL
 *
 * Auto-detects database provider from URL format:
 * - SQLite: file:./path/to/db
 * - PostgreSQL: postgres://... or postgresql://...
 * - MySQL: mysql://...
 *
 * Usage: node scripts/switch-db.js
 *
 * This script is called automatically by npm run dev and npm run build
 */

const fs = require('fs');
const path = require('path');

// Load .env file for local development
require('dotenv').config();

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

const sourceFile = path.join(__dirname, '..', 'prisma', `schema.${provider}.prisma`);
const destFile = path.join(__dirname, '..', 'prisma', 'schema.prisma');

// Check if source file exists
if (!fs.existsSync(sourceFile)) {
  console.error(`Error: Schema template not found: ${sourceFile}`);
  console.error(`Available providers: sqlite, postgres, mysql`);
  process.exit(1);
}

// Copy the appropriate schema
fs.copyFileSync(sourceFile, destFile);

// Log the switch (truncate URL for security)
const urlPreview = dbUrl.length > 30 ? dbUrl.substring(0, 30) + '...' : dbUrl;
console.log(`[switch-db] Switched to ${provider} (DATABASE_URL: ${urlPreview})`);
