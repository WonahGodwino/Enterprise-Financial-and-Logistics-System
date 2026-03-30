// frontend/src/components/error/ErrorBoundary.jsx
import React, { Component } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Home,
  ArrowLeft,
  Mail,
  Bug,
  FileText
} from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log error to monitoring service
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    // Send error to your logging service
    console.error('Error caught by boundary:', error, errorInfo);
    
    // You can integrate with services like Sentry, LogRocket, etc.
    if (process.env.NODE_ENV === 'production') {
      // Send to your error tracking service
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.toString(),
          errorInfo: errorInfo,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.error('Failed to log error:', err));
    }
  };

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoBack = () => {
    window.history.back();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReportIssue = () => {
    const subject = encodeURIComponent('Error Report: Application Crash');
    const body = encodeURIComponent(
      `Error: ${this.state.error}\n\n` +
      `URL: ${window.location.href}\n` +
      `Time: ${new Date().toISOString()}\n` +
      `User Agent: ${navigator.userAgent}`
    );
    window.location.href = `mailto:support@mapsi-efms.com?subject=${subject}&body=${body}`;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            {/* Error Illustration */}
            <div className="text-center mb-8">
              <div className="inline-block p-6 bg-red-100 rounded-full mb-4">
                <AlertTriangle className="h-16 w-16 text-red-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                {this.props.title || 'Something went wrong'}
              </h1>
              <p className="text-gray-600">
                {this.props.message || 'We apologize for the inconvenience. Our team has been notified.'}
              </p>
            </div>

            {/* Error ID */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Bug className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">Error ID:</span>
                </div>
                <code className="text-sm bg-gray-100 px-3 py-1 rounded">
                  {Math.random().toString(36).substring(2, 10).toUpperCase()}
                </code>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <button
                onClick={this.handleRefresh}
                className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow flex flex-col items-center text-gray-700 hover:text-red-600"
              >
                <RefreshCw className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Refresh Page</span>
              </button>

              <button
                onClick={this.handleGoBack}
                className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow flex flex-col items-center text-gray-700 hover:text-red-600"
              >
                <ArrowLeft className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Go Back</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow flex flex-col items-center text-gray-700 hover:text-red-600"
              >
                <Home className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Go Home</span>
              </button>

              <button
                onClick={this.handleReportIssue}
                className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow flex flex-col items-center text-gray-700 hover:text-red-600"
              >
                <Mail className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Report Issue</span>
              </button>
            </div>

            {/* Error Details Toggle */}
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <button
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
                >
                  <span className="font-medium text-gray-700">Technical Details</span>
                  <FileText className="h-5 w-5 text-gray-500" />
                </button>
                
                {this.state.showDetails && (
                  <div className="p-6 bg-gray-900 text-gray-100 overflow-x-auto">
                    <pre className="text-sm font-mono whitespace-pre-wrap">
                      {this.state.error && this.state.error.toString()}
                      {'\n\n'}
                      {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Support Information */}
            <div className="mt-8 text-center text-sm text-gray-500">
              <p>
                Need immediate assistance? Contact our support team at{' '}
                <a href="mailto:support@mapsi-efms.com" className="text-red-600 hover:underline">
                  support@mapsi-efms.com
                </a>
              </p>
              <p className="mt-2">
                Or call us at{' '}
                <a href="tel:+1234567890" className="text-red-600 hover:underline">
                  +1 (234) 567-890
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;