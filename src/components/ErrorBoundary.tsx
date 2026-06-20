import { Component, ReactNode, ErrorInfo } from "react";
import { reportError } from "@/lib/errorReporter";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional label for the section — included in error report */
  section?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError({
      error_type: "react",
      message: error.message,
      stack: error.stack,
      component: info.componentStack?.split("\n")[1]?.trim() ?? this.props.section,
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive/70" />
        <div>
          <p className="font-medium text-foreground mb-1">Something went wrong</p>
          <p className="text-sm text-muted-foreground">
            Our AI has been notified and is working on a fix.
          </p>
        </div>
        <button
          onClick={() => {
            this.setState({ error: null });
            window.location.reload();
          }}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Reload page
        </button>
        {import.meta.env.DEV && (
          <pre className="mt-4 text-left text-xs bg-muted p-4 rounded-lg overflow-auto max-w-lg max-h-40 text-destructive">
            {this.state.error.message}
            {"\n"}
            {this.state.error.stack}
          </pre>
        )}
      </div>
    );
  }
}
