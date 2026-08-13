// k6 load test — validates the API under concurrent load.
// Run:  k6 run loadtest/store.k6.js         (defaults to http://localhost:3002)
//       BASE=https://api.zitychef.mn k6 run loadtest/store.k6.js
//
// Install k6: https://k6.io/docs/get-started/installation/
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 50 }, // ramp to 50 virtual users
    { duration: '30s', target: 200 }, // sustain 200 VUs
    { duration: '10s', target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.05'],
  },
};

const BASE = __ENV.BASE || 'http://localhost:3002';

export default function () {
  const res = http.get(`${BASE}/api/store/products`);
  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });
  sleep(0.5);
}
