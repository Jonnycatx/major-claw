const sensitiveKeyPattern = /(api[_-]?key|token|secret|password|authorization)/i;

function redactStringValue(value: string): string {
  let next = value.replace(
    /(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*(['"]?)[^\s'",;]+(['"]?)/gi,
    "$1=[REDACTED]"
  );
  next = next.replace(/bearer\s+[a-z0-9._-]+/gi, "Bearer [REDACTED]");
  next = next.replace(/(x-session-token\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]");
  next = next.replace(/(authorization=\[REDACTED\])\s+[^\s,;]+/gi, "$1");
  return next;
}

export function redactSensitiveString(value: string): string {
  return redactStringValue(value);
}

export function redactSensitiveObject(value: unknown): unknown {
  if (typeof value === "string") {
    return redactStringValue(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveObject(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => {
      if (sensitiveKeyPattern.test(key)) {
        return [key, "[REDACTED]"];
      }
      return [key, redactSensitiveObject(item)];
    })
  );
}

