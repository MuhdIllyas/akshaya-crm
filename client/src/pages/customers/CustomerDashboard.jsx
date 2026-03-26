import React from 'react';
import { FiGrid, FiActivity, FiHome } from 'react-icons/fi';

const CustomerDashboard = () => {
  const customerName = localStorage.getItem("customer_name");
  const customerId = localStorage.getItem("customer_id");
  const role = localStorage.getItem("role");

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 border">
          <p className="text-gray-500 text-sm">Active Services</p>
          <p className="text-xl font-semibold text-gray-800">None</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border">
          <p className="text-gray-500 text-sm">Pending Actions</p>
          <p className="text-xl font-semibold text-gray-800">—</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border">
          <p className="text-gray-500 text-sm">Documents Uploaded</p>
          <p className="text-xl font-semibold text-gray-800">2</p>
        </div>
      </div>

      {/* Welcome Message */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Welcome to Akshaya Centre Portal</h2>
        <p className="text-gray-600 mb-4">
          You can now access digital services, track your service requests, and manage your account.
        </p>
        <p className="text-gray-600">
          Customer ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{customerId}</span>
        </p>
        <p className="text-gray-600 mt-2">
          Welcome back, <span className="font-semibold text-navy-700">{customerName}</span>
        </p>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl p-6 border mb-8">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-4">
          <button className="btn-primary">Apply for a Service</button>
          <button className="btn-secondary">Upload Document</button>
          <button className="btn-secondary">View My Services</button>
        </div>
      </div>
    </>
  );
};

export default CustomerDashboard;