import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GlobalLoading from './ui/GlobalLoading';

export function ProtectedRoute() {
  const { token, loading } = useAuth();

  if (loading) {
    return <GlobalLoading />;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
