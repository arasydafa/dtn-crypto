/**
 * @module components/ErrorBoundary
 * @description React error boundary that catches rendering errors and displays a fallback UI.
 *
 * Wraps the entire application to prevent a single component crash from
 * unmounting the whole tree. Shows the error stack trace and a reload button.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */

import { Component, type ReactNode } from "react";

/** Props for the ErrorBoundary component. */
interface Props {
  /** Child components to protect. */
  children: ReactNode;
}

/** Internal state tracking whether an error has been caught. */
interface State {
  /** Whether an error has been caught. */
  hasError: boolean;

  /** The caught error, or null. */
  error: Error | null;
}

/**
 * React class component error boundary.
 *
 * Uses `getDerivedStateFromError` to update state when a child throws,
 * and `componentDidCatch` to log the error to the console.
 */
export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    /**
     * Static lifecycle method called when a child component throws.
     * Updates state to trigger the fallback UI.
     */
    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    /**
     * Called after an error has been caught. Logs the error and component
     * stack trace to the console for debugging.
     */
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("ErrorBoundary caught:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    position: "fixed", inset: 0, background: "#0a0b10", color: "#e5e7f0",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    padding: 40, fontFamily: "monospace", zIndex: 9999
                }}>
                    <h2 style={{ color: "#ff6b6b", marginBottom: 16 }}>Something went wrong</h2>
                    <pre style={{
                        background: "#12141c", padding: 20, borderRadius: 8,
                        maxWidth: 800, overflow: "auto", fontSize: 13, lineHeight: 1.6,
                        border: "1px solid #2a2d3e"
                    }}>
                        {this.state.error?.stack ?? this.state.error?.message ?? "Unknown error"}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: 20, padding: "10px 20px", background: "#6c5ce7",
                            color: "#fff", border: "none", borderRadius: 8, cursor: "pointer",
                            fontSize: 14, fontWeight: 600
                        }}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
