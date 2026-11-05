import React from 'react';

type Props = { children: React.ReactNode; label?: string };

type State = { failed: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`DriveLink ${this.props.label || 'section'} render error:`, error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="mx-4 my-4 rounded-2xl border border-[#e5e7eb] bg-white p-5 text-center text-sm text-[#0A0F1E] shadow-sm">
          <p className="font-semibold">Something went wrong.</p>
          <p className="mt-1 text-xs text-[#667085]">Tap to reload and try again.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-full bg-[#0A0F1E] px-5 py-2.5 font-semibold text-white">Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
