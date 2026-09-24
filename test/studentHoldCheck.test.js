const { test } = require('node:test');
const assert = require('node:assert/strict');
const check = require('../middleware/studentHoldCheck');
const response = () => ({ statusCode: 200, body: null, set() { return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('hold enforcement checks every student request and fails closed without misclassifying auth', async () => {
  const prior = { enabled: process.env.STUDENT_HOLDS_ENABLED, url: process.env.AUTH_SERVICE_URL, key: process.env.SYSTEM_API_KEY, fetch: global.fetch };
  try {
    process.env.STUDENT_HOLDS_ENABLED = 'true';
    process.env.AUTH_SERVICE_URL = 'https://auth.invalid';
    process.env.SYSTEM_API_KEY = 'test-service-key';
    let calls = 0;
    const req = { user: { id: 'student-1', userType: 'STUDENT' }, method: 'POST', originalUrl: '/api/payments/initiate' };
    global.fetch = async (url, options) => {
      calls++;
      assert.equal(url, 'https://auth.invalid/api/auth/holds/check');
      assert.deepEqual(JSON.parse(options.body), { userId: 'student-1', path: '/api/payments/initiate', method: 'POST' });
      return { ok: true, json: async () => ({ allowed: true }) };
    };
    assert.equal(await check(req, response()), true);
    assert.equal(await check(req, response()), true);
    assert.equal(calls, 2);
    assert.equal(await check({ user: { userType: 'STAFF' } }, response()), true);
    assert.equal(calls, 2);
    global.fetch = async () => ({ ok: false, status: 403, json: async () => ({ code: 'STUDENT_HOLD', message: 'Contact ICT.' }) });
    const denied = response();
    assert.equal(await check(req, denied), false);
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.body.code, 'STUDENT_HOLD');
    global.fetch = async () => { throw new Error('timeout'); };
    const unavailable = response();
    assert.equal(await check(req, unavailable), false);
    assert.equal(unavailable.statusCode, 503);
    assert.equal(unavailable.body.code, 'HOLD_CHECK_UNAVAILABLE');
    process.env.STUDENT_HOLDS_ENABLED = 'false';
    assert.equal(await check(req, response()), true);
  } finally {
    for (const [name, value] of Object.entries({ STUDENT_HOLDS_ENABLED: prior.enabled, AUTH_SERVICE_URL: prior.url, SYSTEM_API_KEY: prior.key })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    global.fetch = prior.fetch;
  }
});
