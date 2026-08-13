import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

function readEnvFile(path) {
  if (!existsSync(path)) return {};

  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function redact(value) {
  return String(value || '')
    .replace(/postgres(ql)?:\/\/[^\s]+/g, 'postgresql://[REDACTED]')
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, 'sb_secret_[REDACTED]')
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, 'sb_publishable_[REDACTED]');
}

const fileEnv = readEnvFile('.env');
const env = { ...process.env, ...fileEnv, HOME: process.env.HOME || '/private/tmp' };
const rawDbUrl = env.DIRECT_URL || env.DATABASE_URL;

if (!rawDbUrl) {
  console.error('Missing DIRECT_URL or DATABASE_URL in .env');
  process.exit(2);
}

const dbUrl = new URL(rawDbUrl);
dbUrl.password = dbUrl.password.replace(/%/g, '%25');
dbUrl.searchParams.set('sslmode', dbUrl.searchParams.get('sslmode') || 'require');

const result = spawnSync(
  './node_modules/.bin/supabase',
  ['db', 'push', '--db-url', dbUrl.toString()],
  { env, encoding: 'utf8' }
);

process.stdout.write(redact(result.stdout));
process.stderr.write(redact(result.stderr));
process.exit(result.status ?? 1);
