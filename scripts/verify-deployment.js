import https from 'https';

const DOMAIN = process.argv[2];
if (!DOMAIN) {
  console.error('Usage: node scripts/verify-deployment.js <domain>');
  process.exit(1);
}

const endpoints = [
  { path: '/api/health', name: 'Health Check' },
  { path: '/', name: 'Homepage', expect: 'FamPlanner' },
  { path: '/api/auth/me', name: 'Auth (expect 401)', expectStatus: 401 },
  { path: '/api/quotes', name: 'Quotes (expect 401 unauthed)', expectStatus: 401 },
  { path: '/manifest.json', name: 'PWA Manifest' },
  { path: '/sw.js', name: 'Service Worker' },
];

async function check({ path, name, expect: content, expectStatus }) {
  const expectedCode = expectStatus || 200;
  return new Promise((resolve) => {
    https
      .get(`https://${DOMAIN}${path}`, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          const ok =
            res.statusCode === expectedCode &&
            (!content || data.includes(content));
          console.log(
            `${ok ? 'PASS' : 'FAIL'} ${name}: ${res.statusCode} (expected ${expectedCode})`
          );
          resolve(ok);
        });
      })
      .on('error', (err) => {
        console.log(`FAIL ${name}: ${err.message}`);
        resolve(false);
      });
  });
}

const results = [];
for (const ep of endpoints) results.push(await check(ep));
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
