import React from 'react';

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a bug in one component shows a readable error
 * instead of a blank white screen.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Render crash:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 800, margin: '40px auto' }}>
        <h2 style={{ color: '#b91c1c' }}>Something went wrong</h2>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#fef2f2', padding: 16, borderRadius: 8, fontSize: 13 }}>
          {this.state.error.message}
          {'\n\n'}
          {this.state.error.stack?.split('\n').slice(0, 6).join('\n')}
        </pre>
        <button
          onClick={() => {
            sessionStorage.clear();
            localStorage.removeItem('nexus_auth_token');
            window.location.reload();
          }}
          style={{ padding: '8px 16px', cursor: 'pointer' }}
        >
          Clear session &amp; reload
        </button>
      </div>
    );
  }
}
