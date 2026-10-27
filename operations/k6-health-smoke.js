import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '2m', target: 25 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const response = http.get(`${__ENV.SIGA_BASE_URL}/health`, { tags: { endpoint: 'health' } });
  check(response, { 'health 200': (result) => result.status === 200, 'estado ok': (result) => result.json('status') === 'ok' });
  sleep(1);
}
