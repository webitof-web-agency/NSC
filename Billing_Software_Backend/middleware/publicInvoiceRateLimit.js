const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 120;
const requestBuckets = new Map();

const cleanupExpiredBuckets = (now) => {
  if (requestBuckets.size < 1000) return;
  for (const [key, bucket] of requestBuckets) {
    if (bucket.resetAt <= now) requestBuckets.delete(key);
  }
};

const publicInvoiceRateLimit = (req, res, next) => {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const key = String(req.ip || req.socket?.remoteAddress || 'unknown');
  const existing = requestBuckets.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + WINDOW_MS }
    : existing;

  bucket.count += 1;
  requestBuckets.set(key, bucket);

  res.set('RateLimit-Limit', String(MAX_REQUESTS));
  res.set('RateLimit-Remaining', String(Math.max(MAX_REQUESTS - bucket.count, 0)));
  res.set('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > MAX_REQUESTS) {
    res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
    res.set('Cache-Control', 'private, no-store');
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  }

  return next();
};

module.exports = { publicInvoiceRateLimit };
