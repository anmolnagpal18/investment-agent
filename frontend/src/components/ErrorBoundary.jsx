import React, { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './ui/Button';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an uncaught exception:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712] p-6 text-center">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-600/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative flex flex-col items-center justify-center max-w-md w-full bg-[#0a0f1d]/90 border border-red-500/10 rounded-2xl p-8 backdrop-blur-md shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-600/10 flex items-center justify-center text-red-400 mb-5 border border-red-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <h1 className="text-xl font-bold text-white tracking-wide">Something went wrong</h1>
            <p className="text-sm text-slate-400 mt-2.5 leading-relaxed">
              We encountered an unexpected rendering error. Diagnostic details have been logged.
            </p>
            
            {this.state.error && (
              <pre className="w-full text-left mt-5 p-4 rounded-lg bg-black/40 border border-white/5 text-[11px] text-red-300 font-mono overflow-x-auto no-scrollbar max-h-40">
                {this.state.error.toString()}
              </pre>
            )}
            
            <div className="flex gap-3 w-full mt-6">
              <Button 
                variant="primary" 
                onClick={this.handleReset}
                className="flex-1 font-semibold"
              >
                Reset Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
