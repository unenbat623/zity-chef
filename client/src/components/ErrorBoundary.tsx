import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/errorReporting';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * App-wide error boundary. Without this a single render-time throw white-screens
 * the entire SPA. Shows a friendly recovery screen and lets the user reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { componentStack: info.componentStack });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-pestle-bg text-pestle-text p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-5xl">🍳</div>
          <h1 className="text-lg font-extrabold">Алдаа гарлаа / Something went wrong</h1>
          <p className="text-sm text-gray-400">
            Хуудсыг дахин ачаалж үзнэ үү. / Please reload the page and try again.
          </p>
          <button onClick={this.handleReload} className="btn-primary w-full py-3 text-sm font-bold">
            Дахин ачаалах / Reload
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-left text-[10px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-xl p-3 overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
