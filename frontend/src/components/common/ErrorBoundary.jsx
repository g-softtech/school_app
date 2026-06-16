import React from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    console.error('ErrorBoundary caught an error:', { error, errorInfo });
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="card text-center py-12 flex flex-col items-center justify-center space-y-4 border border-red-100 bg-red-50/30">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
            <FiAlertTriangle size={32} />
          </div>
          <div className="max-w-md">
            <h2 className="text-lg font-bold text-secondary-800 mb-2">Something went wrong</h2>
            <p className="text-sm text-secondary-600 mb-6">
              A section of this page encountered an unexpected error and could not be loaded.
              We've logged this issue for our engineering team.
            </p>
            {this.state.error && (
              <div className="text-left bg-white p-3 rounded-lg border border-red-100 overflow-x-auto text-xs text-red-600 font-mono mb-6 mx-auto w-full max-w-sm">
                {this.state.error.toString()}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="btn-primary inline-flex items-center gap-2"
            >
              <FiRefreshCw size={16} /> Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
