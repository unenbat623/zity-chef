import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readEnvFile(path) {
  if (!existsSync(path)) return {};

  const env = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.replace(/^['"]|['"]$/g, '').trim();
    env[key] = value;
  }

  return env;
}

const root = resolve(import.meta.dirname, '..');
const fileEnv = {
  ...readEnvFile(resolve(root, '.env')),
  ...readEnvFile(resolve(root, '.env.local')),
};
const apiUrl = (process.env.VITE_API_URL || fileEnv.VITE_API_URL || '').replace(/\/+$/, '');
const supabaseUrl = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY || '';

const failures = [];

if (!apiUrl) {
  failures.push('VITE_API_URL must be set for mobile builds.');
} else if (!/^https:\/\//.test(apiUrl)) {
  failures.push('VITE_API_URL must be an HTTPS production URL for store builds.');
}

if (!supabaseUrl || !supabaseAnonKey) {
  failures.push('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.');
}

if (failures.length) {
  console.error('Mobile release preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nExample: VITE_API_URL=https://api.zitychef.mn npm run mobile:build');
  process.exit(1);
}

console.log('Mobile release preflight passed.');
