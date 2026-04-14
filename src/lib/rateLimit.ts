type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return realIp || 'unknown';
}

export function isRateLimited(
  key: string,
  maxRequests: number,
  windowMs: number
): { limited: boolean; retryAfterMs: number } {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now > current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterMs: 0 };
  }

  if (current.count >= maxRequests) {
    return { limited: true, retryAfterMs: Math.max(current.resetAt - now, 0) };
  }

  current.count += 1;
  buckets.set(key, current);

  return { limited: false, retryAfterMs: 0 };
}
