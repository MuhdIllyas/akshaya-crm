import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FiGrid, FiActivity, FiHome, FiFileText, FiPlusCircle, FiUpload } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import CentreChatCard from '../../components/CentreChatCard';

// Booking statuses, as grouped on My Services.
const ACTIVE_STATUSES = ['draft', 'pending_documents', 'action_required', 'under_review', 'in_progress', 'payment_pending'];
const NEEDS_CUSTOMER = ['draft', 'pending_documents', 'action_required', 'payment_pending'];

const customerApi = () =>
  axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: { Authorization: `Bearer ${localStorage.getItem("customer_token") || ""}` },
  });

const CustomerDashboard = () => {
  const navigate = useNavigate();
  // null while loading; the cards show "—" until the numbers arrive.
  const [stats, setStats] = useState({ active: null, pending: null, documents: null });

  useEffect(() => {
    let cancelled = false;
    const api = customerApi();
    Promise.allSettled([api.get('/api/customer/bookings'), api.get('/api/customer/documents')]).then(
      ([bookings, documents]) => {
        if (cancelled) return;
        const list = bookings.status === 'fulfilled' && Array.isArray(bookings.value.data) ? bookings.value.data : null;
        const docs = documents.status === 'fulfilled' && Array.isArray(documents.value.data) ? documents.value.data : null;
        setStats({
          active: list ? list.filter((b) => ACTIVE_STATUSES.includes(b.status)).length : null,
          pending: list ? list.filter((b) => NEEDS_CUSTOMER.includes(b.status)).length : null,
          documents: docs ? docs.filter((d) => d.is_latest !== false).length : null,
        });
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const show = (n, zero) => (n === null ? '—' : n === 0 ? zero : n);
  const customerName = localStorage.getItem("customer_name");
  const customerId = localStorage.getItem("customer_id");
  const role = localStorage.getItem("role");

  return (
    <>
      {/* Welcome Message */}
      <div className="rounded-2xl bg-navy-700 p-5 text-white shadow-sm sm:p-6 mb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-white/70">Welcome to Akshaya Centre Portal</p>
            <h2 className="mt-0.5 text-xl font-semibold sm:text-2xl">
              Welcome back, <span className="break-words">{customerName}</span>
            </h2>
            <p className="mt-2 text-sm text-white/70">
              You can now access digital services, track your service requests, and manage your account.
            </p>
            <p className="mt-3 text-sm text-white/70">
              Customer ID: <span className="ml-1 rounded-md bg-white/10 px-2 py-1 font-mono text-white">{customerId}</span>
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
            <button type="button" onClick={() => navigate("/customer/myservices", { state: { apply: true } })} className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-4 text-sm font-medium text-navy-700 transition-colors hover:bg-slate-100">
              <FiPlusCircle className="h-4 w-4" />
              Apply for a Service
            </button>
            <button type="button" onClick={() => navigate("/customer/mydocuments")} className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20">
              <FiUpload className="h-4 w-4" />
              Upload Document
            </button>
            <button type="button" onClick={() => navigate("/customer/myservices")} className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20">
              <FiGrid className="h-4 w-4" />
              View My Services
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-500/10 text-navy-700">
            <FiActivity className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-slate-500">Active Services</p>
            <p className="text-xl font-semibold text-slate-900">{show(stats.active, "None")}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
            <FiHome className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-slate-500">Pending Actions</p>
            <p className="text-xl font-semibold text-slate-900">{show(stats.pending, "None")}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <FiFileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-slate-500">Documents Uploaded</p>
            <p className="text-xl font-semibold text-slate-900">{show(stats.documents, 0)}</p>
          </div>
        </div>
      </div>

      <CentreChatCard />
    </>
  );
};

export default CustomerDashboard;