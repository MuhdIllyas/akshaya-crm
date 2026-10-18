import React, { useState, useEffect, useMemo, useRef } from 'react'; 
import { 
  FiUser, FiUserCheck, FiCalendar, FiTarget, 
  FiBarChart2, FiPercent, FiBriefcase, FiDollarSign,
  FiTrendingUp, FiCheckCircle, FiAward, FiUsers,
  FiArrowLeft, FiX, FiFilter, FiDownload, FiMoreVertical,
  FiActivity, FiStar, FiClock, FiTrendingDown, FiSearch,
  FiChevronRight, FiRefreshCw, FiEye, FiFileText
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";
import StaffTargetsPanel from "./StaffTargetsPanel";
import StaffTargetHistory from "./StaffTargetHistory";

// Local-date formatter (YYYY-MM-DD). toISOString() converts to UTC, which shifts
// the date back by a day in IST (e.g. 1 Oct 00:00 IST -> 30 Sep).
const toLocalISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatINR = (value) =>
  Number(value || 0).toLocaleString("en-IN");

// Shared style tokens (UI only)
const fieldCls =
  'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500';
const cardCls = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const targetBar = (p) => (p >= 100 ? 'bg-emerald-500' : p >= 50 ? 'bg-amber-400' : 'bg-rose-400');

// Compact StatCard Component
const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick, trend }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className={`${cardCls} p-4 transition-shadow hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-medium text-slate-500">{title}</p>
        <p className="mb-1 truncate text-xl font-bold text-slate-900">{value}</p>
        <div className="flex items-center">
          <p className="text-xs text-slate-500">{subtitle}</p>
          {trend && (
            <span className={`ml-2 flex items-center text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend > 0 ? <FiTrendingUp className="mr-1" /> : <FiTrendingDown className="mr-1" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
      <div className={`shrink-0 rounded-xl ${color} p-2.5`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
    </div>
  </motion.div>
);

// Updated InfoTooltip component with proper positioning
const InfoTooltip = ({ content, placement = "top", children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible]);

  return (
    <div 
      ref={tooltipRef}
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={(e) => e.stopPropagation()}
    >
      {children || <FiEye className="h-3 w-3 text-slate-400 cursor-pointer hover:text-slate-600" />}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-[100] ${placement === 'top' ? 'bottom-full left-0 mb-2' : 'top-full left-0 mt-2'} min-w-[240px] max-w-[280px]`}
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="relative bg-slate-900 text-white text-xs rounded-xl p-3 shadow-xl">
              {content}
              <div 
                className={`absolute w-3 h-3 bg-slate-900 transform rotate-45 ${placement === 'top' ? '-bottom-1.5 left-1/2 -translate-x-1/2' : '-top-1.5 left-1/2 -translate-x-1/2'}`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// StaffPerformanceCard Component - Updated to match WalletCard style with ratings
const StaffPerformanceCard = ({ staff, rank, onClick, isSelected = false }) => {
  const collectionProgress = staff.expectedAmount > 0 ? (staff.collectedAmount / staff.expectedAmount) * 100 : 0;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`relative cursor-pointer rounded-2xl border p-4 shadow-sm transition-shadow hover:z-30 hover:shadow-md ${
        isSelected ? 'border-navy-500 bg-slate-50 ring-2 ring-navy-500/20' : 'border-slate-200 bg-white'
      }`}
      onClick={onClick}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-700">
              <FiUser className="h-4 w-4 text-white" />
            </div>
            {rank <= 3 && (
              <div className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${
                rank === 1 ? 'bg-amber-500' : 
                rank === 2 ? 'bg-slate-500' : 
                'bg-orange-600'
              }`}>
                {rank}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">{staff.name}</h3>
            <p className="text-xs text-slate-500">{staff.role}</p>
          </div>
        </div>
        <FiChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </div>

      {/* Revenue */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-slate-600">Revenue</span>
        <span className="text-sm font-bold text-emerald-700">₹{formatINR(staff.revenueCollected)}</span>
      </div>

      {/* Performance Score */}
      <div className={`mb-3 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${
        staff.collectionRate >= 90 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
        staff.collectionRate >= 70 ? 'border-amber-200 bg-amber-50 text-amber-700' :
        'border-rose-200 bg-rose-50 text-rose-700'
      }`}>
        {staff.collectionRate}% Collection Rate
      </div>

      {/* Key Metrics */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-50 p-2 text-center">
          <div className="mb-1 text-xs text-slate-500">Services</div>
          <div className="text-sm font-semibold text-slate-900">{staff.servicesCompleted}</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-2 text-center">
          <div className="mb-1 text-xs text-slate-500">Avg Tx</div>
          <div className="truncate text-sm font-semibold text-slate-900">₹{formatINR(staff.avgTransaction)}</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-2 text-center">
          <div className="mb-1 flex items-center justify-center gap-1 text-xs text-slate-500">
            <span>Incentive</span>
            <InfoTooltip
              placement="top"
              content={
                <div className="space-y-2">
                  <p className="font-semibold text-white">
                    Incentive Readiness Score (0–100)
                  </p>
                  <div className="space-y-1">
                    <p>• <b>50%</b> Collection discipline</p>
                    <p>• <b>30%</b> Revenue efficiency (₹ / day)</p>
                    <p>• <b>20%</b> Consistency (active days)</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    Based on completed services & received payments
                  </p>
                </div>
              }
            />
          </div>
          <div className="text-sm font-semibold text-slate-900">{staff.incentiveScore}%</div>
        </div>
      </div>

      {/* Collection Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Collected</span>
          <span className="text-slate-500">Expected</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div 
            className={`h-full rounded-full ${
              collectionProgress >= 90 ? 'bg-emerald-500' :
              collectionProgress >= 70 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${collectionProgress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="font-medium text-emerald-600">₹{formatINR(staff.collectedAmount)}</span>
          <span className="font-medium text-blue-600">₹{formatINR(staff.expectedAmount)}</span>
        </div>
      </div>

      {/* Target Progress */}
      {staff.monthlyTarget > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="mb-1 flex justify-between text-xs">
            <span className="flex items-center text-slate-500"><FiTarget className="mr-1 h-3 w-3" />Target</span>
            <span className={`font-semibold ${staff.targetPercent >= 100 ? "text-emerald-600" : "text-slate-700"}`}>
              {staff.targetPercent.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full ${targetBar(staff.targetPercent)}`}
                style={{ width: `${Math.min(staff.targetPercent, 100)}%` }} />
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">₹{formatINR(staff.targetAchieved)} / ₹{formatINR(staff.monthlyTarget)}</p>
        </div>
      )}
      
      {staff.pendingAmount > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-rose-600">
          <span>Pending</span>
          <span className="font-medium">₹{formatINR(staff.pendingAmount)}</span>
        </div>
      )}

      {/* Ratings Info */}
      {staff.totalReviews > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
          <div className="flex items-center text-yellow-600">
            <FiStar className="mr-1 h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="font-medium">{staff.avgStaffRating.toFixed(1)}</span>
          </div>
          <span className="text-slate-500">{staff.totalReviews} {staff.totalReviews === 1 ? 'review' : 'reviews'}</span>
        </div>
      )}
    </motion.div>
  );
};

// Shows ONE staff's last 6 months inside the side panel.
const StaffTargetTab = ({ staffId }) => {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/staffreport/staff/${staffId}/target-history?months=6`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setRows(res.ok ? await res.json() : []);
      } catch { setRows([]); }
    })();
  }, [staffId]);

  if (!rows) return <p className="text-xs text-slate-400">Loading…</p>;
  if (rows.length === 0) return <p className="text-xs text-slate-400">No target history yet</p>;

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <h3 className="mb-3 flex items-center text-sm font-semibold text-slate-900">
        <FiTarget className="mr-2 h-3.5 w-3.5 text-navy-700" /> Target History (+10% Growth)
      </h3>
      <div className="space-y-3">
        {rows.map((r) => {
          const pct = Number(r.achievement_percent || 0);
          const open = r.status === "active";
          const hasTarget = Number(r.target_amount) > 0;
          return (
            <div key={r.month}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-slate-700">
                  {new Date(r.month).toLocaleString("en-IN", { month: "short", year: "numeric" })}
                </span>
                <span className={!hasTarget ? "text-slate-400" : open ? "text-blue-600" : pct >= 100 ? "text-emerald-600" : "text-rose-600"}>
                  {!hasTarget ? "No target" : open ? `In progress · ${pct.toFixed(0)}%` : pct >= 100 ? `✓ Achieved · ${pct.toFixed(0)}%` : `✗ Missed · ${pct.toFixed(0)}%`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full ${targetBar(pct)}`}
                     style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">₹{formatINR(r.achieved_amount)} / ₹{formatINR(r.target_amount)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// StaffDetailsPanel Component - Updated to match WalletDetailsPanel style with ratings
const StaffDetailsPanel = ({ staff, categoryStrength, loadingCategories, ratingDistribution, onClose }) => {
  const [activeTab, setActiveTab] = useState('performance');

  const tabs = [
    { id: 'performance', label: 'Performance', icon: FiTrendingUp },
    { id: 'categories', label: 'Categories', icon: FiBriefcase },
    { id: 'efficiency', label: 'Efficiency', icon: FiActivity },
    { id: 'targets', label: 'Targets', icon: FiTarget }
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
      />
      
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`${staff.name} details`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="border-b border-slate-200">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                aria-label="Back"
                className="rounded-lg p-2 transition-colors hover:bg-slate-100"
              >
                <FiArrowLeft className="h-4 w-4 text-slate-600" />
              </button>
              <div>
                <h2 className="text-base font-bold text-slate-900">{staff.name}</h2>
                <p className="text-xs text-slate-500">{staff.role}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 transition-colors hover:bg-slate-100"
            >
              <FiX className="h-4 w-4 text-slate-600" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-4 pb-3">
            <div role="tablist" className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-navy-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <tab.icon className="mr-1 h-3 w-3" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-4">
            {/* Performance Score */}
            <div className="relative rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="mr-2 min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-900">
                      Incentive Readiness
                    </h3>
                    <div className="relative">
                      <InfoTooltip
                        placement="bottom"
                        content={
                          <div className="space-y-2">
                            <p className="font-semibold text-white">
                              How this score is calculated
                            </p>
                            <div className="space-y-1">
                              <p>• <b>50%</b> Collection discipline</p>
                              <p>• <b>30%</b> Revenue efficiency (₹ / day)</p>
                              <p>• <b>20%</b> Consistency (active days)</p>
                            </div>
                            <p className="mt-1 text-xs text-slate-300">
                              Based only on completed services & received payments
                            </p>
                          </div>
                        }
                      />
                    </div>
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    Performance-based incentive eligibility
                  </p>
                </div>
                <div className={`inline-flex shrink-0 flex-col rounded-xl border px-3 py-2 ${
                  staff.incentiveScore >= 80 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                  staff.incentiveScore >= 60 ? 'border-amber-200 bg-amber-50 text-amber-800' :
                  'border-rose-200 bg-rose-50 text-rose-800'
                }`}>
                  <span className="text-lg font-bold">{staff.incentiveScore}%</span>
                  <span className="text-xs">
                    {staff.incentiveScore >= 80 ? 'Excellent' :
                     staff.incentiveScore >= 60 ? 'Good' : 'Needs Improvement'}
                  </span>
                </div>
              </div>
              
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${
                    staff.incentiveScore >= 80 ? 'bg-emerald-500' :
                    staff.incentiveScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${staff.incentiveScore}%` }}
                />
              </div>
            </div>

            {/* Revenue Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Revenue Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-1 flex items-center">
                    <FiDollarSign className="mr-1 h-3 w-3 text-blue-600" />
                    <span className="text-xs font-medium text-slate-600">Total Revenue</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">₹{formatINR(staff.revenueCollected)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-1 flex items-center">
                    <FiBriefcase className="mr-1 h-3 w-3 text-purple-600" />
                    <span className="text-xs font-medium text-slate-600">Service Charge</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">₹{formatINR(staff.serviceCharge)}</div>
                </div>
              </div>
            </div>

            {/* Collection Stats */}
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Collection Stats</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Collection Rate</span>
                  <span className={`text-xs font-bold ${
                    staff.collectionRate >= 90 ? 'text-emerald-600' :
                    staff.collectionRate >= 70 ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {staff.collectionRate}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Avg. Transaction</span>
                  <span className="text-xs font-bold text-slate-900">₹{formatINR(staff.avgTransaction)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Services Completed</span>
                  <span className="text-xs font-bold text-slate-900">{staff.servicesCompleted}</span>
                </div>
              </div>
            </div>

            {/* Ratings Section */}
            {(activeTab === 'performance' || activeTab === 'efficiency') && staff.totalReviews > 0 && (
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="mb-3 flex items-center text-sm font-semibold text-slate-900">
                  <FiStar className="mr-2 h-3.5 w-3.5 text-yellow-500" />
                  Customer Ratings
                </h3>
                
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center">
                      <span className="mr-2 text-2xl font-bold text-slate-900">{staff.avgStaffRating.toFixed(1)}</span>
                      <div className="flex">
                        {[1,2,3,4,5].map(star => (
                          <FiStar
                            key={star}
                            className={`h-4 w-4 ${
                              star <= Math.round(staff.avgStaffRating)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Based on {staff.totalReviews} reviews</p>
                  </div>
                </div>
                
                {/* Rating Breakdown */}
                {ratingDistribution && ratingDistribution.length > 0 && (
                  <div className="space-y-2">
                    {[5,4,3,2,1].map(rating => {
                      const ratingData = ratingDistribution.find(r => Number(r.staff_rating) === rating);
                      const count = ratingData ? Number(ratingData.count) : 0;
                      const total = ratingDistribution.reduce((sum, r) => sum + Number(r.count), 0);
                      const percentage = total > 0 ? (count / total) * 100 : 0;
                      
                      return (
                        <div key={rating} className="flex items-center text-xs">
                          <span className="w-8 text-slate-600">{rating}★</span>
                          <div className="mx-2 flex-1">
                            <div className="h-1.5 w-full rounded-full bg-slate-200">
                              <div
                                className="h-1.5 rounded-full bg-yellow-400"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-8 text-right text-slate-500">
                            {Math.round(percentage)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Category Strength */}
            {activeTab === 'categories' && (
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Category-wise Strength</h3>
                {loadingCategories ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-navy-700"></div>
                  </div>
                ) : categoryStrength.length === 0 ? (
                  <p className="text-sm text-slate-500">No data for this period</p>
                ) : (
                  <div className="space-y-3">
                    {categoryStrength.map((c) => {
                      const totalRevenue = categoryStrength.reduce(
                        (sum, x) => sum + Number(x.revenue),
                        0
                      );

                      const percent =
                        totalRevenue > 0
                          ? Math.round((c.revenue / totalRevenue) * 100)
                          : 0;

                      return (
                        <div key={c.service_id}>
                          <div className="mb-1 flex justify-between gap-2 text-xs">
                            <span className="font-medium text-slate-700">
                              {c.service_name}
                            </span>
                            <span className="shrink-0 text-slate-500">
                              ₹{Number(c.revenue).toLocaleString("en-IN")}
                            </span>
                          </div>

                          <div className="h-1.5 w-full rounded-full bg-slate-200">
                            <div
                              className="h-1.5 rounded-full bg-navy-700"
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {c.applications} apps • Profit ₹
                            {Number(c.profit).toLocaleString("en-IN")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Efficiency Metrics */}
            {activeTab === 'efficiency' && (
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="mb-3 flex items-center text-sm font-semibold text-slate-900">
                  <FiActivity className="mr-2 h-3.5 w-3.5 text-green-600" />
                  Efficiency Metrics
                </h3>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-green-200 bg-green-50 p-2">
                    <p className="text-xs text-green-700">Active Days</p>
                    <p className="text-sm font-bold text-green-900">
                      {staff.activeDays}
                    </p>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-2">
                    <p className="text-xs text-blue-700">Revenue / Day</p>
                    <p className="truncate text-sm font-bold text-blue-900">
                      ₹{formatINR(staff.revenuePerDay)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-2">
                    <p className="text-xs text-amber-700">Profit / Day</p>
                    <p className="truncate text-sm font-bold text-amber-900">
                      ₹{formatINR(staff.profitPerDay)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Staff Targets */}
            {activeTab === 'targets' && <StaffTargetTab staffId={staff.id} />}
          </div>
        </div>
      </motion.div>
    </>
  );
};

// Main Staff Performance Section Component - Updated with trainee view toggle and revenue breakdown table
const StaffPerformanceSection = ({ 
  data, 
  showCharts, 
  timePeriod, 
  setTimePeriod,
  selectedStaff: externalSelectedStaff,
  setSelectedStaff: externalSetSelectedStaff,
  setActiveSection,
  centreId,
  // Props for superadmin mode
  ratingDistribution: externalRatingDistribution,
  loadingReviews: externalLoadingReviews,
  isSuperAdmin = false
}) => {
  const [internalSelectedStaff, setInternalSelectedStaff] = useState(null);
  const selectedStaff = externalSelectedStaff ?? internalSelectedStaff;
  const setSelectedStaff = externalSetSelectedStaff ?? setInternalSelectedStaff;

  const [staffPerformance, setStaffPerformance] = useState([]);
  const [traineePerformance, setTraineePerformance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrainee, setLoadingTrainee] = useState(false);
  const [categoryStrength, setCategoryStrength] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  // Date picker state lives here (not inside the picker) so re-renders can't close it
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');

  const openDatePicker = () => {
    setDraftFrom(fromDate || '');
    setDraftTo(toDate || '');
    setIsDatePickerOpen(true);
  };
  const draftInvalid = !draftFrom || !draftTo || draftFrom > draftTo;
  const applyDraft = () => {
    if (draftInvalid) return;
    setFromDate(draftFrom);
    setToDate(draftTo);
    setIsDatePickerOpen(false);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('revenue'); // 'revenue', 'rate', 'incentive'
  const [staffMode, setStaffMode] = useState('permanent'); // 'permanent' or 'trainee'
  
  // Review states - use props if provided (superadmin), otherwise use internal state
  const [internalReviewSummary, setInternalReviewSummary] = useState(null);
  const [internalRatingDistribution, setInternalRatingDistribution] = useState([]);
  const [internalLoadingReviews, setInternalLoadingReviews] = useState(false);

  const reviewSummary = isSuperAdmin ? null : internalReviewSummary; // Superadmin doesn't need summary cards
  const ratingDistribution = externalRatingDistribution || internalRatingDistribution;
  const loadingReviews = externalLoadingReviews !== undefined ? externalLoadingReviews : internalLoadingReviews;

  //Staff Targets
  const [showTargets, setShowTargets] = useState(false);
  const [targetMap, setTargetMap] = useState({});

  // Cards show the target of the month that `toDate` falls in (targets are monthly,
  // the date picker is free-range — so the card is labelled by month, not by range).
  useEffect(() => {
    if (!toDate) return;
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const params = new URLSearchParams({ month: toDate.slice(0, 7) });
        if (centreId) params.append("centreId", centreId);
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/staffreport/staff-targets?${params}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const rows = res.ok ? await res.json() : [];
        setTargetMap(Object.fromEntries(rows.map((r) => [String(r.staff_id), r])));
      } catch { setTargetMap({}); }
    })();
  }, [centreId, toDate]);

  // Date range picker component
  const renderDateRangePicker = () => {
    const todayStr = toLocalISO(new Date());

    const quickRanges = [
      { label: 'This Month', getDates: () => {
        const now = new Date();
        return { from: toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toLocalISO(now) };
      }},
      { label: 'Last Quarter', getDates: () => {            // (label kept as-is; it is the CURRENT quarter to date)
        const now = new Date();
        const q = Math.floor(now.getMonth() / 3) * 3;
        return { from: toLocalISO(new Date(now.getFullYear(), q, 1)), to: toLocalISO(now) };
      }},
      { label: 'This Year', getDates: () => {
        const now = new Date();
        return { from: toLocalISO(new Date(now.getFullYear(), 0, 1)), to: toLocalISO(now) };
      }},
    ];

    return (
      <div className="relative">
        <button
          onClick={() => (isDatePickerOpen ? setIsDatePickerOpen(false) : openDatePicker())}
          aria-expanded={isDatePickerOpen}
          className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <FiCalendar className="mr-2 h-4 w-4 text-slate-400" />
          {fromDate && toDate ? `${fromDate} to ${toDate}` : 'Select Date Range'}
          <FiChevronRight className="ml-2 h-4 w-4 rotate-90 transform text-slate-400" />
        </button>

        <AnimatePresence>
          {isDatePickerOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsDatePickerOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute left-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white shadow-xl sm:left-auto sm:right-0"
              >
                <div className="p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900">Date Range</h4>
                    <button onClick={() => setIsDatePickerOpen(false)} aria-label="Close date picker" className="text-slate-400 hover:text-slate-600">
                      <FiX className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mb-2 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
                      <input
                        type="date"
                        value={draftFrom}
                        max={draftTo || todayStr}
                        onChange={(e) => setDraftFrom(e.target.value)}
                        className={`${fieldCls} w-full`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
                      <input
                        type="date"
                        value={draftTo}
                        min={draftFrom || undefined}
                        max={todayStr}
                        onChange={(e) => setDraftTo(e.target.value)}
                        className={`${fieldCls} w-full`}
                      />
                    </div>
                  </div>

                  {draftFrom && draftTo && draftFrom > draftTo && (
                    <p className="mb-2 text-xs text-rose-600">"From" must be on or before "To"</p>
                  )}

                  <div className="mb-4 flex justify-end gap-2">
                    <button
                      onClick={() => setIsDatePickerOpen(false)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={applyDraft}
                      disabled={draftInvalid}
                      className="rounded-xl bg-navy-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Apply
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">Quick Select</p>
                    <div className="space-y-2">
                      {quickRanges.map((range) => (
                        <button
                          key={range.label}
                          onClick={() => {
                            const dates = range.getDates();
                            setFromDate(dates.from);
                            setToDate(dates.to);
                            setIsDatePickerOpen(false);
                          }}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Fetch functions
  const fetchStaffPerformance = async (from, to, centreId) => {
    const token = localStorage.getItem("token");

    const params = new URLSearchParams({ from, to });
    if (centreId) params.append("centreId", centreId);

    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/staffreport/staff-performance?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      throw new Error("Failed to fetch staff performance");
    }

    return res.json();
  };

  const fetchTraineePerformance = async (from, to, centreId) => {
    const token = localStorage.getItem("token");

    const params = new URLSearchParams({ from, to });
    if (centreId) params.append("centreId", centreId);

    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/staffreport/trainee-performance?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      throw new Error("Failed to fetch trainee performance");
    }

    return res.json();
  };

  // Fetch review summary (for dashboard cards) - only for non-superadmin
  const fetchReviewSummary = async () => {
    if (isSuperAdmin) return;
    
    try {
      setInternalLoadingReviews(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (centreId) params.append("centreId", centreId);
      if (fromDate && toDate) {
        params.append("from", fromDate);
        params.append("to", toDate);
      }
      
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/staffreport/review-summary?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (!res.ok) throw new Error("Failed to fetch review summary");
      
      const data = await res.json();
      setInternalReviewSummary(data);
    } catch (err) {
      console.error("Review summary error:", err);
    } finally {
      setInternalLoadingReviews(false);
    }
  };

  // Fetch rating distribution (for charts) - only for non-superadmin
  const fetchRatingDistribution = async () => {
    if (isSuperAdmin) return;
    
    try {
      setInternalLoadingReviews(true);
      const token = localStorage.getItem("token");
      
      const params = new URLSearchParams();
      if (centreId) params.append("centreId", centreId);
      if (fromDate && toDate) {
        params.append("from", fromDate);
        params.append("to", toDate);
      }
      
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/staffreport/rating-distribution?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (!res.ok) throw new Error("Failed to fetch rating distribution");
      
      const data = await res.json();
      setInternalRatingDistribution(data);
    } catch (err) {
      console.error("Rating distribution error:", err);
      setInternalRatingDistribution([]);
    } finally {
      setInternalLoadingReviews(false);
    }
  };

  useEffect(() => {
    if (!fromDate || !toDate) return;
    loadStaffPerformance(fromDate, toDate);
    loadTraineePerformance(fromDate, toDate);
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!selectedStaff || !fromDate || !toDate) return;

    const fetchCategoryStrength = async () => {
      try {
        setLoadingCategories(true);
        const token = localStorage.getItem("token");

        const params = new URLSearchParams({
          from: fromDate,
          to: toDate,
        });

        if (centreId) params.append("centreId", centreId);

        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/staffreport/staff/${selectedStaff.id}/category-strength?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data = await res.json();
        setCategoryStrength(data);
      } catch (err) {
        console.error("Failed to load category strength", err);
        setCategoryStrength([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategoryStrength();
  }, [selectedStaff, fromDate, toDate]);

  useEffect(() => {
    const now = new Date();
    let from;

    if (timePeriod === "monthly") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timePeriod === "quarterly") {
      const q = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), q, 1);
    } else {
      from = new Date(now.getFullYear(), 0, 1);
    }

    setFromDate(toLocalISO(from));
    setToDate(toLocalISO(now));
  }, [timePeriod]);

  // Fetch review data when centreId or date range changes (for non-superadmin)
  useEffect(() => {
    if (!isSuperAdmin && fromDate && toDate) {
      fetchReviewSummary();
      fetchRatingDistribution();
    }
  }, [isSuperAdmin, centreId, fromDate, toDate]);

  const transformStaffRows = (rows) => {
    return rows.map((row) => {
      const incentiveScore = Number(row.incentive_score ?? 0);
      const expected = Number(row.expected_amount);
      const collected = Number(row.collected_amount);

      return {
        id: row.staff_id,
        name: row.staff_name,
        role: "Staff",

        expectedAmount: expected,
        collectedAmount: collected,
        pendingAmount: Math.max(expected - collected, 0),

        collectionRate:
          expected > 0
            ? Math.round((collected / expected) * 100)
            : 100,

        revenueCollected: collected,
        serviceCharge: Number(row.service_charge_earned),
        servicesCompleted: Number(row.services_completed),
        avgTransaction: Number(row.avg_ticket_size || 0),
        incentiveScore: incentiveScore,

        // Review data
        totalReviews: Number(row.total_reviews || 0),
        avgStaffRating: Number(row.avg_staff_rating || 0),

        // Efficiency metrics
        activeDays: Number(row.active_days || 0),
        revenuePerDay: Number(row.revenue_per_day || 0),
        profitPerDay: Number(row.profit_per_day || 0),

        // Placeholders
        achievement: 0,
        monthlyTarget: 0,
        todayCollection: 0,
      };
    });
  };

  const loadStaffPerformance = async (from, to) => {
    try {
      setLoading(true);
      const rows = await fetchStaffPerformance(from, to, centreId);
      setStaffPerformance(transformStaffRows(rows));
    } catch (err) {
      console.error("Staff performance load failed", err);
      setStaffPerformance([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTraineePerformance = async (from, to) => {
    try {
      setLoadingTrainee(true);
      const rows = await fetchTraineePerformance(from, to, centreId);
      setTraineePerformance(transformStaffRows(rows));
    } catch (err) {
      console.error("Trainee performance load failed", err);
      setTraineePerformance([]);
    } finally {
      setLoadingTrainee(false);
    }
  };

  // Derive the set of trainee IDs to exclude from permanent view
  const traineeIds = useMemo(() => new Set(traineePerformance.map(s => s.id)), [traineePerformance]);
  
  const permanentStaff = useMemo(() => {
    return staffPerformance.filter(s => !traineeIds.has(s.id));
  }, [staffPerformance, traineeIds]);

  // Active dataset based on toggle
  const activeData = useMemo(
    () =>
      (staffMode === "permanent" ? permanentStaff : traineePerformance).map((s) => {
        const t = targetMap[String(s.id)];
        return {
          ...s,
          monthlyTarget: Number(t?.target_amount || 0),
          targetAchieved: Number(t?.achieved_amount || 0),
          targetPercent: Number(t?.achievement_percent || 0),
        };
      }),
    [staffMode, permanentStaff, traineePerformance, targetMap]
  );

  // Filter and sort active data
  const filteredAndSortedStaff = useMemo(() => {
    let result = [...activeData];
    
    if (searchQuery) {
      result = result.filter(staff => 
        staff.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    result.sort((a, b) => {
      switch (sortBy) {
        case 'rate':
          return b.collectionRate - a.collectionRate;
        case 'incentive':
          return b.incentiveScore - a.incentiveScore;
        case 'services':
          return b.servicesCompleted - a.servicesCompleted;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'revenue':
        default:
          return b.revenueCollected - a.revenueCollected;
      }
    });
    
    return result;
  }, [activeData, sortBy, searchQuery]);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (activeData.length === 0) return null;
    
    const totalRevenue = activeData.reduce((sum, s) => sum + s.revenueCollected, 0);
    const avgRate = Math.round(activeData.reduce((sum, s) => sum + s.collectionRate, 0) / activeData.length);
    const totalServices = activeData.reduce((sum, s) => sum + s.servicesCompleted, 0);
    const avgIncentive = Math.round(activeData.reduce((sum, s) => sum + s.incentiveScore, 0) / activeData.length);
    
    return { totalRevenue, avgRate, totalServices, avgIncentive };
  }, [activeData]);

  // Combined revenue breakdown for Quick View table (permanent + trainees)
  const revenueBreakdownData = useMemo(() => {
    const permanent = permanentStaff.map(s => ({ ...s, type: 'Permanent' }));
    const trainees = traineePerformance.map(s => ({ ...s, type: 'Trainee' }));
    return [...permanent, ...trainees];
  }, [permanentStaff, traineePerformance]);

  const revenueGrandTotal = useMemo(() => {
    const totalRevenue = revenueBreakdownData.reduce((sum, s) => sum + s.revenueCollected, 0);
    const totalServiceCharge = revenueBreakdownData.reduce((sum, s) => sum + s.serviceCharge, 0);
    const totalDeptCharge = totalRevenue - totalServiceCharge;
    return { totalRevenue, totalDeptCharge, totalServiceCharge };
  }, [revenueBreakdownData]);

  // Custom Tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-md">
          <p className="mb-2 text-sm font-semibold text-slate-900">{label}</p>
          {payload.map((item, index) => (
            <div key={index} className="mb-1 flex items-center justify-between gap-4">
              <div className="flex items-center">
                <div className="mr-2 h-2 w-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-xs text-slate-600">{item.name}</span>
              </div>
              <span className="text-xs font-bold text-slate-900">
                {item.name.includes('Revenue') || item.name.includes('Transaction') ? `₹${formatINR(item.value)}` : item.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const isLoading = staffMode === 'permanent' ? loading : loadingTrainee;

  return (
    <>
      <div className="mb-6">
        {/* Header Section */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center text-lg font-bold text-slate-900">
              <FiUserCheck className="mr-2 h-5 w-5 text-navy-700" />
              Staff Performance
            </h2>
            <p className="mt-1 text-sm text-slate-500">Revenue collection and performance metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (staffMode === 'permanent') loadStaffPerformance(fromDate, toDate);
                else loadTraineePerformance(fromDate, toDate);
              }}
              className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <FiRefreshCw className={`mr-2 h-4 w-4 ${loading || loadingTrainee ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              onClick={() => setShowTargets((v) => !v)}
              aria-pressed={showTargets}
              className={`flex items-center rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                showTargets ? "border-navy-700 bg-navy-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <FiTarget className="mr-2 h-4 w-4" /> Targets
            </button>
          </div>
        </div>

        {/* Staff Type Toggle */}
        <div className="mb-4">
          <div role="tablist" className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
            <button
              role="tab"
              aria-selected={staffMode === 'permanent'}
              onClick={() => setStaffMode('permanent')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                staffMode === 'permanent'
                  ? 'bg-navy-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FiUser className="mr-2 inline h-4 w-4" />
              Permanent Staff
            </button>
            <button
              role="tab"
              aria-selected={staffMode === 'trainee'}
              onClick={() => setStaffMode('trainee')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                staffMode === 'trainee'
                  ? 'bg-navy-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FiUsers className="mr-2 inline h-4 w-4" />
              Trainees ({traineePerformance.length})
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {renderDateRangePicker()}
          
          <select
            className={fieldCls}
            aria-label="Time period"
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
          >
            <option value="monthly">This Month</option>
            <option value="quarterly">This Quarter</option>
            <option value="yearly">This Year</option>
          </select>
          
          <div className="relative w-full sm:w-auto">
            <FiSearch className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff..."
              aria-label="Search staff"
              className={`${fieldCls} w-full pl-9 sm:w-56`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort staff"
            className={fieldCls}
          >
            <option value="revenue">Sort by Revenue</option>
            <option value="rate">Sort by Collection Rate</option>
            <option value="incentive">Sort by Incentive</option>
            <option value="services">Sort by Services</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>

        {/* Summary Stats */}
        {summaryStats && (
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              title="Total Revenue"
              value={`₹${formatINR(summaryStats.totalRevenue)}`}
              subtitle="All staff combined"
              icon={FiDollarSign}
              color="bg-navy-700"
              trend={8.5}
            />
            <StatCard
              title="Avg Collection Rate"
              value={`${summaryStats.avgRate}%`}
              subtitle="Average across staff"
              icon={FiPercent}
              color="bg-emerald-600"
              trend={2.3}
            />
            <StatCard
              title="Total Services"
              value={summaryStats.totalServices}
              subtitle="Services completed"
              icon={FiBriefcase}
              color="bg-blue-600"
              trend={12.7}
            />
            <StatCard
              title="Avg Incentive Score"
              value={`${summaryStats.avgIncentive}%`}
              subtitle="Performance rating"
              icon={FiAward}
              color="bg-amber-600"
              trend={-1.2}
            />
          </div>
        )}

        {/* Review Stats Cards - Only show for non-superadmin and permanent staff mode */}
        {!isSuperAdmin && staffMode === 'permanent' && reviewSummary && (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              title="Total Reviews"
              value={reviewSummary.total_reviews || 0}
              subtitle="Customer feedback received"
              icon={FiStar}
              color="bg-purple-600"
            />
            <StatCard
              title="Avg Service Rating"
              value={reviewSummary.avg_service_rating ? Number(reviewSummary.avg_service_rating).toFixed(1) : '0.0'}
              subtitle="Out of 5"
              icon={FiAward}
              color="bg-pink-600"
            />
            <StatCard
              title="Avg Staff Rating"
              value={reviewSummary.avg_staff_rating ? Number(reviewSummary.avg_staff_rating).toFixed(1) : '0.0'}
              subtitle="Out of 5"
              icon={FiUserCheck}
              color="bg-navy-700"
            />
          </div>
        )}

        {/* Charts Section */}
        {showCharts && filteredAndSortedStaff.length > 0 && (
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* Revenue vs Services */}
            <div className={`${cardCls} p-4`}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Revenue vs Services</h3>
                  <p className="text-xs text-slate-500">Top performers</p>
                </div>
                <FiBarChart2 className="h-4 w-4 text-navy-700" />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={filteredAndSortedStaff.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(value) => value.length > 8 ? `${value.substring(0, 6)}...` : value}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(value) => `₹${value/1000}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenueCollected" name="Revenue" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="servicesCompleted" name="Services" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Collection Performance */}
            <div className={`${cardCls} p-4`}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Collection Performance</h3>
                  <p className="text-xs text-slate-500">Rate vs Incentive</p>
                </div>
                <FiTrendingUp className="h-4 w-4 text-navy-700" />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={filteredAndSortedStaff.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(value) => value.length > 8 ? `${value.substring(0, 6)}...` : value}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="collectionRate" name="Collection Rate" stroke="#1e3a5f" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="incentiveScore" name="Incentive Score" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Avg Transaction Size */}
            <div className={`${cardCls} p-4`}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Avg. Transaction Size</h3>
                  <p className="text-xs text-slate-500">Ticket size comparison</p>
                </div>
                <FiDollarSign className="h-4 w-4 text-navy-700" />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={filteredAndSortedStaff.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(value) => value.length > 8 ? `${value.substring(0, 6)}...` : value}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(value) => `₹${value/1000}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgTransaction" name="Avg. Transaction" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Rating Distribution */}
            <div className={`${cardCls} p-4`}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Rating Distribution</h3>
                  <p className="text-xs text-slate-500">Staff performance ratings</p>
                </div>
                <FiStar className="h-4 w-4 text-yellow-500" />
              </div>
              
              {loadingReviews ? (
                <div className="flex h-[200px] items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-navy-700"></div>
                </div>
              ) : ratingDistribution.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center text-sm text-slate-500">
                  No rating data available
                </div>
              ) : (
                <div className="space-y-3">
                  {[5,4,3,2,1].map(rating => {
                    const ratingData = ratingDistribution.find(r => Number(r.staff_rating) === rating);
                    const count = ratingData ? Number(ratingData.count) : 0;
                    const total = ratingDistribution.reduce((sum, r) => sum + Number(r.count), 0);
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    
                    return (
                      <div key={rating} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center">
                            <span className="font-medium text-slate-700">{rating} ★</span>
                          </div>
                          <span className="text-slate-500">{count} reviews</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200">
                          <div
                            className={`h-2 rounded-full ${
                              rating >= 4 ? 'bg-emerald-500' :
                              rating >= 3 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {showTargets && (
          <>
            <StaffTargetsPanel centreId={centreId} />
            <StaffTargetHistory centreId={centreId} />
          </>
        )}

        {/* Revenue Breakdown Quick View Table */}
        {revenueBreakdownData.length > 0 && (
          <div className={`${cardCls} mb-6 p-4 sm:p-5`}>
            <h3 className="mb-3 flex items-center text-sm font-semibold text-slate-900">
              <FiDollarSign className="mr-2 h-4 w-4 text-navy-700" />
              Quick View: Revenue Breakdown
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Staff Name</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total Revenue</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Dept. Charges</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Service Charges (Profit)</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueBreakdownData.map((staff, idx) => {
                    const deptCharge = staff.revenueCollected - staff.serviceCharge;
                    return (
                      <tr key={staff.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-slate-50/60' : ''}`}>
                        <td className="px-3 py-2.5 font-medium text-slate-900">{staff.name}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            staff.type === 'Permanent' ? 'bg-slate-100 text-navy-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {staff.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">₹{formatINR(staff.revenueCollected)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">₹{formatINR(deptCharge)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-600">₹{formatINR(staff.serviceCharge)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                    <td className="px-3 py-2.5 text-slate-900" colSpan={2}>Grand Total</td>
                    <td className="px-3 py-2.5 text-right font-mono">₹{formatINR(revenueGrandTotal.totalRevenue)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">₹{formatINR(revenueGrandTotal.totalDeptCharge)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-600">₹{formatINR(revenueGrandTotal.totalServiceCharge)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Staff Performance Grid */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {staffMode === 'permanent' ? 'Permanent Staff' : 'Trainee'} Performance {filteredAndSortedStaff.length > 0 && `(${filteredAndSortedStaff.length})`}
            </h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              Showing {staffMode === 'permanent' ? 'top performers' : 'all trainees'} by {sortBy}
            </span>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-navy-700"></div>
                <p className="text-sm text-slate-600">Loading {staffMode === 'permanent' ? 'staff' : 'trainee'} performance…</p>
              </div>
            </div>
          )}

          {!isLoading && filteredAndSortedStaff.length === 0 && (
            <div className={`${cardCls} py-8 text-center`}>
              <FiUser className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="mb-1 text-sm text-slate-600">No {staffMode === 'permanent' ? 'staff' : 'trainees'} found</p>
              <p className="text-xs text-slate-500">Try adjusting your filters or search criteria</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredAndSortedStaff.map((staff, index) => (
              <StaffPerformanceCard
                key={staff.id}
                staff={staff}
                rank={index + 1}
                isSelected={selectedStaff?.id === staff.id}
                onClick={() => setSelectedStaff(staff)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Staff Details Panel */}
      <AnimatePresence>
        {selectedStaff && (
          <StaffDetailsPanel
            staff={selectedStaff}
            categoryStrength={categoryStrength}
            loadingCategories={loadingCategories}
            ratingDistribution={ratingDistribution}
            onClose={() => setSelectedStaff(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default StaffPerformanceSection;