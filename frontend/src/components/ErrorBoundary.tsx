import { Component, type ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

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
