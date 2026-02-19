import type { AppErrorCode, ErrorResponse } from "@majorclaw/shared-types";

type GatewayErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    timestamp?: string;
  };
  requestId?: string;
};

function mapCode(raw?: string): AppErrorCode {
  const code = (raw ?? "").trim();
  switch (code) {
    case "ValidationError":
    case "VALIDATION_ERROR":
    case "BAD_REQUEST":
      return "ValidationError";
    case "AuthError":
    case "UNAUTHORIZED":
      return "AuthError";
    case "PermissionDenied":
    case "FORBIDDEN":
      return "PermissionDenied";
    case "NotFound":
    case "NOT_FOUND":
      return "NotFound";
    case "RateLimited":
    case "RATE_LIMITED":
      return "RateLimited";
    case "VaultStorageFull":
      return "VaultStorageFull";
    case "NetworkError":
      return "NetworkError";
    default:
      return "InternalServerError";
  }
}

function parseEmbeddedJson(message: string): GatewayErrorBody | null {
  const start = message.indexOf("{");
  const end = message.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(message.slice(start, end + 1)) as GatewayErrorBody;
  } catch {
    return null;
  }
}

export function normalizeError(error: unknown, fallbackContext?: string): ErrorResponse {
  const now = new Date().toISOString();
  if (typeof error === "object" && error && "code" in error && "message" in error) {
    const obj = error as { code?: string; message?: string; details?: unknown; timestamp?: string };
    return {
      code: mapCode(obj.code),
      message: obj.message ?? "Request failed",
      details: obj.details,
      timestamp: obj.timestamp ?? now
    };
  }

  const rawMessage =
    typeof error === "string"
      ? error
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "Request failed")
        : "Request failed";

  const embedded = parseEmbeddedJson(rawMessage);
  if (embedded?.error) {
    return {
      code: mapCode(embedded.error.code),
      message: embedded.error.message ?? "Request failed",
      details: embedded.error.details ?? (embedded.requestId ? { requestId: embedded.requestId } : undefined),
      timestamp: embedded.error.timestamp ?? now
    };
  }

  const lower = rawMessage.toLowerCase();
  const inferredCode: AppErrorCode = lower.includes("network")
    ? "NetworkError"
    : lower.includes("token") || lower.includes("unauthorized")
      ? "AuthError"
      : lower.includes("permission") || lower.includes("forbidden")
        ? "PermissionDenied"
        : lower.includes("rate")
          ? "RateLimited"
          : lower.includes("validation") || lower.includes("invalid")
            ? "ValidationError"
            : lower.includes("storage") || lower.includes("disk")
              ? "VaultStorageFull"
              : "InternalServerError";

  return {
    code: inferredCode,
    message: fallbackContext ? `${fallbackContext} failed` : rawMessage,
    details: undefined,
    timestamp: now
  };
}

export function getUserFriendlyErrorMessage(error: ErrorResponse): string {
  switch (mapCode(String(error.code))) {
    case "ValidationError":
      return "That input is invalid. Please review and try again.";
    case "AuthError":
      return "Your secure session expired or is invalid. Restart the gateway and try again.";
    case "PermissionDenied":
      return "Action denied by safety policy. Review permissions and retry.";
    case "NotFound":
      return "Requested resource was not found.";
    case "RateLimited":
      return "Too many requests right now. Wait a moment and retry.";
    case "VaultStorageFull":
      return "Vault storage is near capacity. Free space or relocate vault storage.";
    case "NetworkError":
      return "Network connection failed. Verify local services and retry.";
    default:
      return "Something went wrong. You can retry safely.";
  }
}
