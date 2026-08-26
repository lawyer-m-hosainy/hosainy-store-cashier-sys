/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import POS from './pages/POS';
import CashSession from './pages/CashSession';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Expenses from './pages/Expenses';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Auth from './pages/Auth';
import Users from './pages/Users';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import Toaster from './components/Toaster';
import { getUser } from './lib/api';

const ProtectedRoute = ({ children, allowedRoles }: { children: any, allowedRoles?: string[] }) => {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/login" element={<Auth />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={
            <ProtectedRoute>
              {getUser()?.role === 'owner' ? <Dashboard /> : <Navigate to="/pos" replace />}
            </ProtectedRoute>
          } />
          <Route path="pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
          <Route path="cash" element={<ProtectedRoute><CashSession /></ProtectedRoute>} />
          <Route path="customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
          
          {/* Owner Only */}
          <Route path="products" element={<ProtectedRoute allowedRoles={['owner']}><Products /></ProtectedRoute>} />
          <Route path="suppliers" element={<ProtectedRoute allowedRoles={['owner']}><Suppliers /></ProtectedRoute>} />
          <Route path="purchases" element={<ProtectedRoute allowedRoles={['owner']}><Purchases /></ProtectedRoute>} />
          <Route path="expenses" element={<ProtectedRoute allowedRoles={['owner']}><Expenses /></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute allowedRoles={['owner']}><Inventory /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute allowedRoles={['owner']}><Reports /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute allowedRoles={['owner']}><Users /></ProtectedRoute>} />
          <Route path="audit" element={<ProtectedRoute allowedRoles={['owner']}><AuditLogs /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute allowedRoles={['owner']}><Settings /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

