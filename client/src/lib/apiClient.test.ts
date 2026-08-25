import { describe, it, expect } from 'vitest';
import { resolveApiBase } from './apiClient';

/**
 * A production build must talk to its own origin. It did not: `.env` carries
 * the server's `NODE_ENV=development`, Vite reads that file for VITE_*
 * variables, and the resulting bundle was stamped as development — so the
 * deployed client called `<host>:3002`, a port that serves nothing in
 * production, and every request failed.
 */
describe('resolveApiBase', () => {
  it('is same-origin in a production build, whatever the host', () => {
    expect(resolveApiBase({ isProd: true, protocol: 'https:', hostname: 'zitychef.mn' })).toBe('');
  });

  it('points at the dev API port during development', () => {
    expect(resolveApiBase({ isProd: false, protocol: 'http:', hostname: '10.20.19.58' })).toBe(
      'http://10.20.19.58:3002'
    );
  });

  it('lets an explicit VITE_API_URL win in either mode', () => {
    for (const isProd of [true, false]) {
      expect(
        resolveApiBase({
          configured: 'https://api.zitychef.mn',
          isProd,
          hostname: 'x',
          protocol: 'https:',
        })
      ).toBe('https://api.zitychef.mn');
    }
  });

  it('falls back to localhost when there is no window', () => {
    expect(resolveApiBase({ isProd: false })).toBe('http://localhost:3002');
  });
});
