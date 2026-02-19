import type { ErrorResponse } from "@majorclaw/shared-types";

export const APP_ERROR_EVENT = "majorclaw:error";

export type AppErrorEventDetail = {
  error: ErrorResponse;
  context?: string;
  retry?: () => void;
};

export function emitAppError(detail: AppErrorEventDetail): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<AppErrorEventDetail>(APP_ERROR_EVENT, { detail }));
}
