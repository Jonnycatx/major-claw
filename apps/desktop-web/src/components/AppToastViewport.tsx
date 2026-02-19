import { useEffect, useRef, useState } from "react";
import type { ErrorResponse } from "@majorclaw/shared-types";
import { APP_ERROR_EVENT, type AppErrorEventDetail } from "../utils/errorBus.js";
import { getUserFriendlyErrorMessage } from "../utils/errorMapper.js";

type ToastItem = {
  id: string;
  signature: string;
  count: number;
  error: ErrorResponse;
  context?: string;
  retry?: () => void;
};

export function AppToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismissTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const onError = (event: Event) => {
      const detail = (event as CustomEvent<AppErrorEventDetail>).detail;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const signature = `${detail.context ?? "Request Error"}::${detail.error.code}::${detail.error.message}`;
      const item: ToastItem = {
        id,
        signature,
        count: 1,
        error: detail.error
      };
      if (detail.context) {
        item.context = detail.context;
      }
      if (detail.retry) {
        item.retry = detail.retry;
      }
      setToasts((current) => {
        const existing = current.find((entry) => entry.signature === signature);
        if (existing) {
          return current.map((entry) =>
            entry.signature === signature
              ? (() => {
                  const next: ToastItem = {
                    ...entry,
                    id,
                    count: entry.count + 1,
                    error: detail.error
                  };
                  if (detail.retry) {
                    next.retry = detail.retry;
                  }
                  if (detail.context) {
                    next.context = detail.context;
                  }
                  return next;
                })()
              : entry
          );
        }
        return [...current, item].slice(-5);
      });
      if (dismissTimersRef.current[signature]) {
        clearTimeout(dismissTimersRef.current[signature]);
      }
      dismissTimersRef.current[signature] = window.setTimeout(() => {
        setToasts((current) => current.filter((entry) => entry.signature !== signature));
        delete dismissTimersRef.current[signature];
      }, 7000);
    };

    window.addEventListener(APP_ERROR_EVENT, onError as EventListener);
    return () => {
      window.removeEventListener(APP_ERROR_EVENT, onError as EventListener);
      for (const timer of Object.values(dismissTimersRef.current)) {
        clearTimeout(timer);
      }
      dismissTimersRef.current = {};
    };
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-40 flex w-[360px] flex-col gap-2">
      <div className="pointer-events-auto flex justify-end">
        <button
          type="button"
          className="rounded-md border border-white/25 bg-black/70 px-2 py-1 text-[11px] text-text-secondary"
          onClick={() => {
            for (const timer of Object.values(dismissTimersRef.current)) {
              clearTimeout(timer);
            }
            dismissTimersRef.current = {};
            setToasts([]);
          }}
        >
          Clear all
        </button>
      </div>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-xl border border-lobster/50 bg-black/90 p-3 text-xs text-red-100 shadow-[0_0_18px_rgba(255,59,0,0.35)]"
        >
          <p className="font-semibold text-lobster">{toast.context ?? "Request Error"}</p>
          <p className="mt-1 text-text-primary">{getUserFriendlyErrorMessage(toast.error)}</p>
          <p className="mt-1 text-[11px] text-text-secondary">
            {toast.error.code} {toast.error.details && typeof toast.error.details === "object" && "requestId" in (toast.error.details as Record<string, unknown>)
              ? `· request ${(toast.error.details as Record<string, unknown>).requestId as string}`
              : ""}
            {toast.count > 1 ? ` · repeated x${toast.count}` : ""}
          </p>
          <div className="mt-2 flex gap-2">
            {toast.retry ? (
              <button type="button" className="rounded-md border border-lobster/50 px-2 py-1 text-[11px] text-lobster" onClick={toast.retry}>
                Retry
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-white/20 px-2 py-1 text-[11px] text-text-secondary"
              onClick={() => setToasts((current) => current.filter((entry) => entry.id !== toast.id))}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
