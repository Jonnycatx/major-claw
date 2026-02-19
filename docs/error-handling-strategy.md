# Global Error Handling Strategy (P0 #5)

## Unified Error Shape

All layers normalize to:

```ts
{
  success: false,
  error: {
    code: "ValidationError" | "AuthError" | "NotFound" | "RateLimited" | "InternalServerError" | "NetworkError" | "PermissionDenied" | "VaultStorageFull",
    message: string,
    details?: unknown,
    timestamp: string
  }
}
```

## Layer Behavior

- **Gateway**: emits structured sanitized error envelopes with canonical codes and request IDs in `details`.
- **Tauri command boundary**: command failures bubble through `invoke` and are normalized client-side.
- **Frontend**:
  - Global boundary catches render crashes (`AppErrorBoundary`).
  - Runtime command errors emit global events from `tauriGateway`.
  - Toast viewport surfaces user-friendly messages with optional retry callbacks.
  - SSE stream failures are reported and auto-recovered with data refetch.

## Security Rules

- Never expose raw stack traces or internal paths to users.
- Keep request correlation in `details.requestId` only.
- Map unknown failures to `InternalServerError`.
