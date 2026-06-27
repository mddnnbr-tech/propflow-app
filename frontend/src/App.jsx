import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';

// Manager pages
import ManagerLayout from './components/ManagerLayout';
import ManagerDashboard from './pages/manager/Dashboard';
import ManagerProperties from './pages/manager/Properties';
import ManagerLeases from './pages/manager/Leases';
import ManagerMaintenance from './pages/manager/Maintenance';
import ManagerVendors from './pages/manager/Vendors';
import ManagerFinances from './pages/manager/Finances';
import ManagedServices from './pages/manager/ManagedServices';

// Tenant pages
import TenantLayout from './components/TenantLayout';
import TenantHome from './pages/tenant/Home';
import TenantRentPayment from './pages/tenant/RentPayment';
import TenantMaintenance from './pages/tenant/MaintenanceRequest';
import TenantLease from './pages/tenant/LeaseDetails';

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'MANAGER' ? '/manager' : '/tenant'} replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'MANAGER' ? '/manager' : '/tenant'} replace /> : <Login />} />

      {/* Manager routes */}
      <Route path="/manager" element={<ProtectedRoute role="MANAGER"><ManagerLayout /></ProtectedRoute>}>
        <Route index element={<ManagerDashboard />} />
        <Route path="properties" element={<ManagerProperties />} />
        <Route path="leases" element={<ManagerLeases />} />
        <Route path="maintenance" element={<ManagerMaintenance />} />
        <Route path="vendors" element={<ManagerVendors />} />
        <Route path="finances" element={<ManagerFinances />} />
        <Route path="managed-services" element={<ManagedServices />} />
      </Route>

      {/* Tenant routes */}
      <Route path="/tenant" element={<ProtectedRoute role="TENANT"><TenantLayout /></ProtectedRoute>}>
        <Route index element={<TenantHome />} />
        <Route path="pay" element={<TenantRentPayment />} />
        <Route path="maintenance" element={<TenantMaintenance />} />
        <Route path="lease" element={<TenantLease />} />
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
