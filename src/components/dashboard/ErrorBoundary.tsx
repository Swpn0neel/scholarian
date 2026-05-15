"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("[DashboardErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center px-6">
          <div className="flex size-14 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="size-7 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-on-surface">
              Something went wrong
            </h2>
            <p className="mt-1 text-sm text-secondary max-w-sm">
              {this.state.message}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, message: "" });
              window.location.reload();
            }}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-container transition-colors"
          >
            Reload workspace
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
