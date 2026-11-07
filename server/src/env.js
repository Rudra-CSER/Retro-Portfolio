// Loads .env from the project root (and server/.env as a fallback) no matter
// which directory the process was started from.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_DIR = path.resolve(here, '..');
export const ROOT_DIR = path.resolve(SERVER_DIR, '..');

for (const file of [path.join(ROOT_DIR, '.env'), path.join(SERVER_DIR, '.env')]) {
  if (fs.existsSync(file)) dotenv.config({ path: file, quiet: true });
}

export const config = {
  port: Number(process.env.PORT || 5000),
  host: process.env.HOST || '0.0.0.0',
  mongoUri: (process.env.MONGODB_URI || '').trim(),
  siteUrl: (process.env.SITE_URL || '').trim().replace(/\/+$/, ''),
  hostLabel: (process.env.HOST_LABEL || 'LEGION 5 PRO · UBUNTU').trim(),
  adminToken: (process.env.ADMIN_TOKEN || '').trim(),
  trustProxy: process.env.TRUST_PROXY || 'loopback',
  paths: {
    content: path.join(SERVER_DIR, 'data', 'content.json'),
    storage: path.join(SERVER_DIR, 'storage'),
    public: path.join(SERVER_DIR, 'public'),
    dist: path.join(ROOT_DIR, 'client', 'dist'),
  },
};
