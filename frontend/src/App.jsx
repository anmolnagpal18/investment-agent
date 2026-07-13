import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';

// Layout Guards & Layout Wrappers
import ProtectedRoute from './components/ProtectedRoute';
import GlobalLayout from './components/GlobalLayout';
import { GlobalLoading } from './components/ui/GlobalLoading';

// Pages — code-split via React.lazy (reduces initial bundle size)
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';

const Dashboard        = React.lazy(() => import('./pages/Dashboard'));
const ResearchWorkspace = React.lazy(() => import('./pages/ResearchWorkspace'));
const Watchlist        = React.lazy(() => import('./pages/Watchlist'));
const Comparisons      = React.lazy(() => import('./pages/Comparisons'));
const Reports          = React.lazy(() => import('./pages/Reports'));
const NotFound         = React.lazy(() => import('./pages/NotFound'));

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <Suspense fallback={<GlobalLoading />}>
                <Routes>
                  {/* 1. Public Auth / Marketing routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  {/* 2. Protected Research Hub Workspaces */}
                  <Route element={<ProtectedRoute />}>
                    <Route element={<GlobalLayout />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/workspace" element={<ResearchWorkspace />} />
                      <Route path="/watchlist" element={<Watchlist />} />
                      <Route path="/compare" element={<Comparisons />} />
                      <Route path="/reports" element={<Reports />} />
                    </Route>
                  </Route>

                  {/* 3. 404 Wildcard Error Page */}
                  <Route path="/404" element={<NotFound />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
