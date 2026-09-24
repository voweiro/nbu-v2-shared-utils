// Do not cache decisions: role/type edits must affect active students on their next request.
module.exports = async function studentHoldCheck(req, res) {
  if (process.env.STUDENT_HOLDS_ENABLED !== 'true' || req.user?.userType !== 'STUDENT') return true;
  try {
    const base = process.env.AUTH_SERVICE_URL;
    const key = process.env.SYSTEM_API_KEY;
    if (!base || !key) throw new Error('Hold service configuration missing');
    const response = await fetch(`${base.replace(/\/+$/, '').replace(/\/api\/auth$/, '')}/api/auth/holds/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ userId: req.user.id, path: req.originalUrl, method: req.method }),
      signal: AbortSignal.timeout(5000),
    });
    const result = await response.json();
    if (response.ok && result.allowed === true) return true;
    if (response.status === 403 && ['STUDENT_HOLD', 'ACCOUNT_SUSPENDED'].includes(result.code)) {
      res.set('Cache-Control', 'no-store').status(403).json(result);
      return false;
    }
    throw new Error('Hold check unavailable');
  } catch {
    res.status(503).json({ code: 'HOLD_CHECK_UNAVAILABLE', message: 'Unable to check account restrictions. Please try again shortly.' });
    return false;
  }
};
