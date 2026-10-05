import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('Application could not render:', error.name); }
  render() {
    if (this.state.failed) return <main className="panel" role="alert"><h1>Unable to open this page</h1><p>Check your connection and reload the website to try again.</p><button className="primary" onClick={() => window.location.reload()}>Reload website</button></main>;
    return this.props.children;
  }
}
