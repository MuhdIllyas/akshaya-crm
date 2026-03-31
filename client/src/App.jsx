import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DashboardLayout from "./layouts/DashboardLayout";
import AdminDashboard from "./pages/AdminDashboard";
import StaffDashboard from "./pages/StaffDashboard";
import SupervisorDashboard from "./pages/SupervisorDashboard";
import SuperadminDashboard from "./pages/SuperadminDashboard";
import StaffManagement from "./pages/admin/StaffManagement";
import StaffProfile from "./pages/admin/StaffProfile";
import EditStaffForm from "./components/EditStaffForm";
import WalletManagement from "./pages/admin/wallet/WalletManagement";
import WalletActivity from "./pages/admin/wallet/WalletActivity";
import ServiceManagement from "./pages/admin/service/ServiceManagement";
import ServiceLogs from "./pages/admin/ServiceLogs";
import AdminTokenManagement from "./pages/admin/AdminTokenManagement";
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminReports from './pages/reports/AdminReports';
import CentreManagement from "./pages/superadmin/CentreManagement";
import SuperadminStaffManagement from './pages/superadmin/SuperadminStaffManagement';
import WalletManagementSuperAdmin from './pages/superadmin/WalletManagementSuperAdmin';
import ServiceManagementSuperAdmin from './pages/superadmin/ServiceManagementSuperAdmin';
import SuperadminServiceLogs from './pages/superadmin/SuperadminServiceLogs';
import AttendanceSuperAdmin from './pages/superadmin/AttendanceSuperAdmin';
import CampaignManagementSuperAdmin from './pages/superadmin/CampaignManagementSuperAdmin';
import SuperAdminReports from './pages/reports/SuperAdminReports';
import Messenger from './pages/superadmin/MessengerPage';
import TeamManagement from "./pages/team/TeamManagement";
import TokenGenerator from "./pages/staff/TokenGenerator";
import ServiceWorkspace from './components/ServiceWorkspace';
import StaffPerformance from './pages/staff/StaffPerformance';
import StaffAttendance from "./pages/staff/StaffAttendance";
import ServiceEntry from "./pages/staff/ServiceEntry";
import ExpenseEntry from "./pages/staff/ExpenseEntry";
import PendingPayments from './pages/staff/PendingPayments';
import TrackService from "./pages/staff/TrackServicePage";
import AllEntries from './pages/AllEntries';
import CustomerProfileSystem from './pages/CustomerProfileSystem';
import MyProfile from './pages/MyProfile';
import CampaignManagement from "./pages/campaign/CampaignManagement";
import axios from "axios";
import Login from "./pages/Login";

import CustomerRegistration from './pages/CustomerRegistration';
import CustomerDashboard from './pages/customers/CustomerDashboard';
import CustomerMyServices from './pages/customers/MyServices';
import CustomerMyDocuments from './pages/customers/MyDocuments';
import CustomerProfile from './pages/customers/CustomerProfile';
import ContinueApplication from './components/ContinueApplication';
import ApplicationDocuments from './components/ApplicationDocuments';
import ConfirmationPage from './components/ConfirmationPage';
import ViewServiceDetails from './components/ViewServiceDetails';
import PublicReview from './components/PublicReview';

const ProtectedRoute = ({ allowedRoles, children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;
  const token = localStorage.getItem("token")?.trim();
  const role = localStorage.getItem("role")?.trim()?.toLowerCase();

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        console.log("ProtectedRoute: No token found in localStorage");
        setIsAuthenticated(false);
        return;
      }

      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("ProtectedRoute: Token verification successful:", response.data);
        console.log("ProtectedRoute: Checking role:", { role, allowedRoles });
        if (allowedRoles && !allowedRoles.includes(role)) {
          console.warn(`ProtectedRoute: Role ${role} not allowed. Allowed roles: ${allowedRoles}`);
          toast.error("Unauthorized access. Redirecting to login.", {
            position: "top-right",
            autoClose: 3000,
            theme: "light",
            toastId: "role-error",
          });
          setIsAuthenticated(false);
          return;
        }
        setIsAuthenticated(true);
      } catch (err) {
        console.error("ProtectedRoute: Token verification failed:", {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data,
          retryCount,
        });
        if (retryCount < maxRetries && err.response?.status === 401) {
          console.log(`ProtectedRoute: Retrying token verification (${retryCount + 1}/${maxRetries})`);
          setRetryCount(prev => prev + 1);
          return;
        }
        toast.error(err.response?.data?.error || "Session expired, please log in again", {
          position: "top-right",
          autoClose: 3000,
          theme: "light",
          toastId: "session-error",
        });
        setIsAuthenticated(false);
      }
    };
    verifyToken();
  }, [token, role, allowedRoles, retryCount]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-navy-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="text-gray-600">Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !token) {
    console.log("ProtectedRoute: Redirecting to /login due to no authentication or token");
    return <Navigate to="/login" replace />;
  }

  return children ? children : <Outlet />;
};

const CustomerProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const customerToken = localStorage.getItem("customer_token");

  useEffect(() => {
    const verifyCustomerToken = async () => {
      if (!customerToken) {
        console.log("CustomerProtectedRoute: No customer token found");
        setIsAuthenticated(false);
        return;
      }

      try {
        // You'll need to create this endpoint in your backend
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/customer/verify`, {
          headers: { Authorization: `Bearer ${customerToken}` },
        });
        console.log("CustomerProtectedRoute: Token verification successful");
        setIsAuthenticated(true);
      } catch (err) {
        console.error("CustomerProtectedRoute: Token verification failed:", err);
        toast.error("Session expired, please log in again", {
          position: "top-right",
          autoClose: 3000,
          theme: "light",
        });
        setIsAuthenticated(false);
      }
    };
    
    verifyCustomerToken();
  }, [customerToken]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-navy-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="text-gray-600">Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !customerToken) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const App = () => {
  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/customer/register" element={<CustomerRegistration />} />
        <Route path="/review/:token" element={<PublicReview />} /> 

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to={`/dashboard/${localStorage.getItem("role")?.trim()?.toLowerCase() || "staff"}`} replace />} />
            <Route path="superadmin" element={<ProtectedRoute allowedRoles={["superadmin"]}><SuperadminDashboard /></ProtectedRoute>} />
            <Route path="admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="staff" element={<ProtectedRoute allowedRoles={["staff"]}><StaffDashboard /></ProtectedRoute>} />
            <Route path="supervisor" element={<ProtectedRoute allowedRoles={["supervisor"]}><SupervisorDashboard /></ProtectedRoute>} />

            <Route
              path="admin/staff"
              element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><StaffManagement /></ProtectedRoute>}
            />
            <Route
              path="admin/staff/:id"
              element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><StaffProfile /></ProtectedRoute>}
            />
            <Route
              path="admin/staff/edit/:id"
              element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><EditStaffForm /></ProtectedRoute>}
            />
            <Route
              path="admin/wallets"
              element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><WalletManagement /></ProtectedRoute>}
            />
            <Route
              path="admin/wallets/:walletId"
              element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><WalletActivity /></ProtectedRoute>}
            />
            <Route
              path="admin/services"
              element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><ServiceManagement /></ProtectedRoute>}
            />
            <Route
              path="admin/servicelogs"
              element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><ServiceLogs /></ProtectedRoute>}
            />
            <Route
              path="admin/messenger"
              element={<ProtectedRoute allowedRoles={["admin"]}><Messenger /></ProtectedRoute>}
            />
            <Route
              path="admin/token"
              element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminTokenManagement /></ProtectedRoute>}
            />
            <Route
              path="admin/attendancemanagement"
              element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminAttendance /></ProtectedRoute>}
            />
            <Route
              path="admin/teams"
              element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><TeamManagement /></ProtectedRoute>}
            />
            <Route
              path="admin/campaigns"
              element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><CampaignManagement /></ProtectedRoute>}
            />
            <Route
              path="admin/reports"
              element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminReports /></ProtectedRoute>}
            />
            <Route
              path="superadmin/centremanagement"
              element={<ProtectedRoute allowedRoles={["superadmin"]}><CentreManagement /></ProtectedRoute>}
            />
            <Route
              path="superadmin/staffmanagement"
              element={<ProtectedRoute allowedRoles={["superadmin"]}><SuperadminStaffManagement /></ProtectedRoute>}
            />
            <Route
              path="superadmin/walletmanagement"
              element={<ProtectedRoute allowedRoles={["superadmin"]}><WalletManagementSuperAdmin /></ProtectedRoute>}
            />
            <Route
              path="superadmin/servicemanagement"
              element={<ProtectedRoute allowedRoles={["superadmin"]}><ServiceManagementSuperAdmin /></ProtectedRoute>}
            />
            <Route
              path="superadmin/servicelogs"
              element={<ProtectedRoute allowedRoles={["superadmin"]}><SuperadminServiceLogs /></ProtectedRoute>}
            />
            <Route
              path="superadmin/attendance"
              element={<ProtectedRoute allowedRoles={["superadmin"]}><AttendanceSuperAdmin /></ProtectedRoute>}
            />
            <Route
              path="superadmin/reports"
              element={<ProtectedRoute allowedRoles={["superadmin"]}><SuperAdminReports /></ProtectedRoute>}
            />
            <Route
              path="superadmin/messenger"
              element={<ProtectedRoute allowedRoles={["superadmin"]}><Messenger /></ProtectedRoute>}
            /> 
            <Route
              path="superadmin/campaigns"
              element={<ProtectedRoute allowedRoles={["superadmin"]}><CampaignManagementSuperAdmin /></ProtectedRoute>}
            />  
            <Route
              path="staff/token"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor"]}><TokenGenerator /></ProtectedRoute>}
            />
            <Route
              path="staff/performance"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor"]}><StaffPerformance /></ProtectedRoute>}
            />
            <Route
              path="staff/attendance"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor"]}><StaffAttendance /></ProtectedRoute>}
            />
            <Route
              path="staff/service_entry"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor"]}><ServiceEntry /></ProtectedRoute>}
            />
            <Route
              path="staff/token/:tokenId/service"
              element={<ProtectedRoute allowedRoles={["staff"]}><ServiceEntry /></ProtectedRoute>}
            />
            <Route
              path="staff/online-service/:customerServiceId"
              element={<ProtectedRoute allowedRoles={["staff"]}><ServiceEntry /></ProtectedRoute>}
            />
            <Route
              path="staff/all-entries"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor"]}><AllEntries /></ProtectedRoute>}
            />
            <Route
              path="staff/expense_entry"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor"]}><ExpenseEntry /></ProtectedRoute>}
            />
            <Route
              path="staff/pending_payments"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor"]}><PendingPayments /></ProtectedRoute>}
            />
            <Route
              path="staff/messenger"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor"]}><Messenger /></ProtectedRoute>}
            />
            <Route
              path="staff/track_service"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor"]}><TrackService /></ProtectedRoute>}
            />
            <Route
              path="staff/track_service/:id"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor"]}><TrackService /></ProtectedRoute>}
            />
            <Route
              path="staff/service-workspace/:selectedServiceId"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor"]}><ServiceWorkspace /></ProtectedRoute>}
            />
            <Route
              path="staff/customers"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor", "admin", "superadmin"]}><CustomerProfileSystem /></ProtectedRoute>}
            />
            <Route
              path="staff/customers/:customerId"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor", "admin", "superadmin"]}><CustomerProfileSystem /></ProtectedRoute>}
            />
            <Route
              path="staff/myprofile"
              element={<ProtectedRoute allowedRoles={["staff", "supervisor"]}><MyProfile /></ProtectedRoute>}
            />
          </Route>
        </Route>

        {/* Customer Protected Routes (separate from staff/admin) */}
        <Route element={<DashboardLayout />}>

            <Route
              path="/customer/dashboard"
              element={<CustomerProtectedRoute><CustomerDashboard /></CustomerProtectedRoute>}
            />
            <Route
              path="/customer/myservices"
              element={<CustomerProtectedRoute><CustomerMyServices /></CustomerProtectedRoute>}
            />
            <Route
              path="/customer/myservices/continue/:id"
              element={<CustomerProtectedRoute><ContinueApplication /></CustomerProtectedRoute>}
            />
            <Route
              path="/customer/myservices/:id/documents"
              element={<CustomerProtectedRoute><ApplicationDocuments /></CustomerProtectedRoute>}
            />
            <Route
              path="/customer/myservices/:id/confirmation"
              element={<CustomerProtectedRoute><ConfirmationPage /></CustomerProtectedRoute>}
            />
            <Route
              path="/customer/myservices/:id/timeline"
              element={<CustomerProtectedRoute><ViewServiceDetails /></CustomerProtectedRoute>}
            />
            <Route
              path="/customer/mydocuments"
              element={<CustomerProtectedRoute><CustomerMyDocuments /></CustomerProtectedRoute>}
            />
            <Route
              path="/customer/myprofile"
              element={<CustomerProtectedRoute><CustomerProfile /></CustomerProtectedRoute>}
            />
          
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
};

export default App;
