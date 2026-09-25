const windowMs = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; startedAt: number }>();

const clientAddress = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  ?? request.headers.get("x-real-ip")
  ?? "unknown";

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
    attempts.set(key, { count: 1, startedAt: now });
    return false;
  }
  if (current.count >= maxAttempts) return true;
  current.count += 1;
  return false;
}
