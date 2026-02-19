import React from "react";
import type { ErrorResponse } from "@majorclaw/shared-types";
import { emitAppError } from "../utils/errorBus.js";
import { normalizeError } from "../utils/errorMapper.js";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: ErrorResponse | null;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      error: normalizeError(error, "UI render")
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    const normalized = normalizeError(error, "UI render");
    emitAppError({
      error: normalized,
      context: "ErrorBoundary",
      retry: () => window.location.reload()
    });
    // eslint-disable-next-line no-console
    console.error("ui_boundary_error", {
      error: normalized,
      componentStack: info.componentStack
    });
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-void p-6">
        <div className="w-full max-w-xl rounded-2xl border border-lobster/35 bg-panel/90 p-6 shadow-lobster-glow-strong">
          <p className="text-xs uppercase tracking-[0.14em] text-lobster">System Recovery</p>
          <h1 className="mt-1 text-xl font-semibold text-text-primary">Major Claw hit an unexpected UI error</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Your runtime data is safe. Reload the cockpit to recover.
          </p>
          {this.state.error ? (
            <p className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-text-secondary">
              {this.state.error.code}: {this.state.error.message}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button type="button" className="lobster-button-filled" onClick={() => window.location.reload()}>
              Retry
            </button>
            <button type="button" className="lobster-button" onClick={() => this.setState({ hasError: false, error: null })}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }
}
