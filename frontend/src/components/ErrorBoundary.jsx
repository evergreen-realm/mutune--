import React from 'react';
import { AlertTriangle, MonitorX, RefreshCw, Map } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
          <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-slate-400 mb-4">
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            {this.state.error && (
              <div className="mb-6 p-3 bg-red-950/60 border border-red-500/30 rounded-xl text-left overflow-x-auto max-h-36 text-xs font-mono">
                <p className="font-bold text-red-400 mb-1">{this.state.error.name || 'Error'}: {this.state.error.message}</p>
                {this.state.error.stack && (
                  <pre className="text-[10px] text-red-300/70 whitespace-pre-wrap">{this.state.error.stack}</pre>
                )}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export class WebGLErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, overlayDismissed: false };
    this.dismissOverlay = this.dismissOverlay.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('WebGL Error Boundary caught:', error, errorInfo);
    // Persist Lite Mode to prevent crash loops on reload
    try {
      localStorage.setItem('mutune_lite_view', 'true');
    } catch (e) {
      // Ignore
    }
  }

  dismissOverlay() {
    this.setState({ overlayDismissed: true });
    if (this.props.onFallbackAcknowledge) {
      this.props.onFallbackAcknowledge();
    }
  }

  render() {
    if (this.state.hasError) {
      // If the overlay is dismissed, return null so it unmounts the 3D scene (or renders a fallback banner if needed)
      // The parent MapWidget can handle switching to Lite Mode based on the fallback callback.
      if (this.state.overlayDismissed) {
        return null;
      }
      return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <MonitorX className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">3D Hardware Unreachable</h2>
            <p className="text-slate-400 mb-6">
              Your device ran out of memory or your browser lost its WebGL context. We have switched to the lightweight 2D map view to keep you moving.
            </p>
            <button
              onClick={this.dismissOverlay}
              className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Map className="w-4 h-4" />
              Continue in 2D Lite Mode
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
