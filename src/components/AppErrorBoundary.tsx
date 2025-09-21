import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col">
          {/* Simple header without routing dependencies */}
          <header className="h-14 md:h-16 bg-background">
            <div className="flex items-center justify-between px-4 h-full">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-background font-bold text-lg">C</span>
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="font-semibold text-left text-primary" style={{ fontFamily: 'Spectral', fontWeight: 600 }}>
                    Canary Cards
                  </span>
                  <span className="text-sm hidden sm:block text-left text-muted-foreground">
                    Real postcards. Real impact.
                  </span>
                </div>
              </div>
            </div>
          </header>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-6">
              <h1 className="text-4xl display-title mb-4">Oops!</h1>
              <p className="text-xl body-text text-muted-foreground mb-4">
                Something went wrong. Please refresh the page to try again.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}