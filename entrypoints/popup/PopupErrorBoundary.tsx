import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface PopupErrorBoundaryProps {
  children: ReactNode;
}

interface PopupErrorBoundaryState {
  failed: boolean;
}

export class PopupErrorBoundary extends Component<PopupErrorBoundaryProps, PopupErrorBoundaryState> {
  state: PopupErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): PopupErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Contexto popup render failed', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="popup-shell popup-recovery" role="alert">
          <h1>Contexto could not open</h1>
          <p>Reload the popup and try again.</p>
          <button type="button" onClick={() => location.reload()}>Retry</button>
        </main>
      );
    }

    return this.props.children;
  }
}
