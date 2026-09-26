const windowMs = 15 * 60 * 1000;
const maximumRateLimitRecords = 5_000;
const attempts = new Map<string, { count: number; startedAt: number }>();

const clientAddress = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 120)
  ?? request.headers.get("x-real-ip")
  ?? "unknown";

function trimRateLimitRecords(now: number) {
  if (attempts.size < maximumRateLimitRecords) return;
  for (const [key, attempt] of attempts) {
    if (now - attempt.startedAt > windowMs) attempts.delete(key);
  }
  // A flood of unique addresses should not make a server instance retain an
  // unbounded number of records. Removing the oldest remaining record keeps
  // the lightweight limiter safe while provider-level protections remain on.
  if (attempts.size >= maximumRateLimitRecords) {
    const oldestKey = attempts.keys().next().value;
    if (oldestKey) attempts.delete(oldestKey);
  }
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; }
  catch { return false; }
}

// Public forms only need a few short text fields. Refuse abnormally large
// requests before parsing them, so they cannot be used to consume server time.
export function hasAcceptableJsonSize(request: Request, maximumBytes = 16_384) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  return !Number.isFinite(contentLength) || contentLength <= maximumBytes;
}

// A lightweight first line of defence for public form endpoints. Hosting platforms
// may run more than one instance, so this complements—not replaces—provider limits.
export function isRateLimited(request: Request, scope: string, maxAttempts: number) {
  const key = `${scope}:${clientAddress(request)}`;
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || now - current.startedAt > windowMs) {
    trimRateLimitRecords(now);
    attempts.set(key, { count: 1, startedAt: now });
    return false;
  }
  if (current.count >= maxAttempts) return true;
  current.count += 1;
  return false;
}
