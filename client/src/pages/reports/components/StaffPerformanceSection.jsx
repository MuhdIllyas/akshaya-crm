import React, { useState, useEffect, useMemo, useRef } from 'react'; 
import { 
  FiUser, FiUserCheck, FiCalendar, FiTarget, 
  FiBarChart2, FiPercent, FiBriefcase, FiDollarSign,
  FiTrendingUp, FiCheckCircle, FiAward, FiUsers,
  FiArrowLeft, FiX, FiFilter, FiDownload, FiMoreVertical,
  FiActivity, FiStar, FiClock, FiTrendingDown, FiSearch,
  FiChevronRight, FiRefreshCw, FiEye, FiFileText, FiList
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";

const formatINR = (value) =>
  Number(value || 0).toLocaleString("en-IN");

// Compact StatCard Component 
const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick, trend }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer p-3"
    onClick={onClick}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-600 mb-1 text-xs">{title}</p>
        <p className="font-bold text-gray-900 mb-1 text-lg">{value}</p>
        <div className="flex items-center">
          <p className="text-gray-500 text-xs">{subtitle}</p>
          {trend && (
            <span className={`ml-2 flex items-center text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend > 0 ? <FiTrendingUp className="mr-1" /> : <FiTrendingDown className="mr-1" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
      <div className={`rounded-lg ${color} p-2`}>
        <Icon className="text-white h-4 w-4" />
      </div>
    </div>
  </motion.div>
);

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
      {children || <FiEye className="h-3 w-3 text-gray-400 cursor-pointer hover:text-gray-600" />}
      
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
            <div className="relative bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl">
              {content}
              <div 
                className={`absolute w-3 h-3 bg-gray-900 transform rotate-45 ${placement === 'top' ? '-bottom-1.5 left-1/2 -translate-x-1/2' : '-top-1.5 left-1/2 -translate-x-1/2'}`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StaffPerformanceCard = ({ staff, rank, onClick, isSelected = false }) => {
  const collectionProgress = staff.expectedAmount > 0 ? (staff.collectedAmount / staff.expectedAmount) * 100 : 0;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`bg-white rounded-lg border hover:shadow-md transition-all duration-200 cursor-pointer p-3 relative hover:z-30 ${
        isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <div className="bg-indigo-500 rounded-lg flex items-center justify-center w-8 h-8">
              <FiUser className="text-white h-4 w-4" />
            </div>
            {rank !== null && rank <= 3 && (
              <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                rank === 1 ? 'bg-amber-500' : 
                rank === 2 ? 'bg-gray-500' : 
                'bg-orange-600'
              }`}>
                {rank}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-xs truncate">{staff.name}</h3>
            <p className="text-gray-500 text-xs">{staff.role}</p>
          </div>
        </div>
        <FiChevronRight className="h-4 w-4 text-gray-400" />
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-600 text-xs">Revenue</span>
          <span className="font-bold text-emerald-700 text-sm">₹{formatINR(staff.revenueCollected)}</span>
        </div>
      </div>

      <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold mb-2 ${
        staff.collectionRate >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
        staff.collectionRate >= 70 ? 'bg-amber-50 text-amber-700 border-amber-200' :
        'bg-rose-50 text-rose-700 border-rose-200'
      }`}>
        {staff.collectionRate}% Collection Rate
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-xs text-gray-600 mb-1">Services</div>
          <div className="font-semibold text-gray-900 text-sm">{staff.servicesCompleted}</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-xs text-gray-600 mb-1">Avg Tx</div>
          <div className="font-semibold text-gray-900 text-sm">₹{formatINR(staff.avgTransaction)}</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="flex items-center justify-center space-x-1 text-xs text-gray-600 mb-1">
            <span>Incentive</span>
            <InfoTooltip
              placement="top"
              content={
                <div className="space-y-2">
                  <p className="font-semibold text-white">Incentive Readiness Score (0–100)</p>
                  <div className="space-y-1">
                    <p>• <b>50%</b> Collection discipline</p>
                    <p>• <b>30%</b> Revenue efficiency (₹ / day)</p>
                    <p>• <b>20%</b> Consistency (active days)</p>
                  </div>
                  <p className="text-gray-300 text-xs mt-1">Based on completed services & received payments</p>
                </div>
              }
            />
          </div>
          <div className="font-semibold text-gray-900 text-sm">{staff.incentiveScore}%</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Collected</span>
          <span className="text-gray-500">Expected</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
      
      {staff.pendingAmount > 0 && (
        <div className="flex items-center justify-between text-xs text-rose-600 pt-2 border-t border-gray-100 mt-2">
          <span>Pending</span>
          <span className="font-medium">₹{formatINR(staff.pendingAmount)}</span>
        </div>
      )}

      {staff.totalReviews > 0 && (
        <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-2 mt-2">
          <div className="flex items-center text-yellow-600">
            <FiStar className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
            <span className="font-medium">{staff.avgStaffRating.toFixed(1)}</span>
          </div>
          <span className="text-gray-500">{staff.totalReviews} {staff.totalReviews === 1 ? 'review' : 'reviews'}</span>
        </div>
      )}
    </motion.div>
  );
};

const StaffDetailsPanel = ({ staff, categoryStrength, loadingCategories, ratingDistribution, onClose }) => {
  const [activeTab, setActiveTab] = useState('performance');

  const tabs = [
    { id: 'performance', label: 'Performance', icon: FiTrendingUp },
    { id: 'categories', label: 'Categories', icon: FiBriefcase },
    { id: 'efficiency', label: 'Efficiency', icon: FiActivity }
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
      />
      
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed top-0 right-0 h-full bg-white shadow-lg z-50 flex flex-col w-full max-w-sm"
      >
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-2">
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <FiArrowLeft className="h-4 w-4 text-gray-600" />
              </button>
              <div>
                <h2 className="text-base font-bold text-gray-900">{staff.name}</h2>
                <p className="text-xs text-gray-600">{staff.role}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <FiX className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          <div className="flex px-4 border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-3 py-2 border-b-2 text-xs font-medium transition-colors ${
                  activeTab === tab.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-3 w-3 mr-1" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 relative">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 mr-2">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">Incentive Readiness</h3>
                  </div>
                  <p className="text-gray-500 text-xs truncate">Performance-based incentive eligibility</p>
                </div>
                <div className={`inline-flex flex-col px-3 py-2 border rounded-lg shrink-0 ${
                  staff.incentiveScore >= 80 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                  staff.incentiveScore >= 60 ? 'border-amber-200 bg-amber-50 text-amber-800' :
                  'border-rose-200 bg-rose-50 text-rose-800'
                }`}>
                  <span className="font-bold text-lg">{staff.incentiveScore}%</span>
                  <span className="text-xs">
                    {staff.incentiveScore >= 80 ? 'Excellent' : staff.incentiveScore >= 60 ? 'Good' : 'Needs Improvement'}
                  </span>
                </div>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    staff.incentiveScore >= 80 ? 'bg-emerald-500' : staff.incentiveScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${staff.incentiveScore}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">Revenue Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center mb-1">
                    <FiDollarSign className="h-3 w-3 text-blue-600 mr-1" />
                    <span className="text-xs font-medium text-gray-700">Total Revenue</span>
                  </div>
                  <div className="font-bold text-gray-900 text-sm">₹{formatINR(staff.revenueCollected)}</div>
                </div>
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center mb-1">
                    <FiBriefcase className="h-3 w-3 text-purple-600 mr-1" />
                    <span className="text-xs font-medium text-gray-700">Service Charge</span>
                  </div>
                  <div className="font-bold text-gray-900 text-sm">₹{formatINR(staff.serviceCharge)}</div>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Collection Stats</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-xs">Collection Rate</span>
                  <span className={`font-bold text-xs ${
                    staff.collectionRate >= 90 ? 'text-emerald-600' :
                    staff.collectionRate >= 70 ? 'text-amber-600' : 'text-rose-600'
                  }`}>{staff.collectionRate}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-xs">Avg. Transaction</span>
                  <span className="font-bold text-gray-900 text-xs">₹{formatINR(staff.avgTransaction)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-xs">Services Completed</span>
                  <span className="font-bold text-gray-900 text-xs">{staff.servicesCompleted}</span>
                </div>
              </div>
            </div>

            {(activeTab === 'performance' || activeTab === 'efficiency') && staff.totalReviews > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center">
                  <FiStar className="h-3 w-3 mr-2 text-yellow-500" /> Customer Ratings
                </h3>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center">
                      <span className="text-2xl font-bold text-gray-900 mr-2">{staff.avgStaffRating.toFixed(1)}</span>
                      <div className="flex">
                        {[1,2,3,4,5].map(star => (
                          <FiStar
                            key={star}
                            className={`h-4 w-4 ${
                              star <= Math.round(staff.avgStaffRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Based on {staff.totalReviews} reviews</p>
                  </div>
                </div>
                {ratingDistribution && ratingDistribution.length > 0 && (
                  <div className="space-y-2">
                    {[5,4,3,2,1].map(rating => {
                      const ratingData = ratingDistribution.find(r => Number(r.staff_rating) === rating);
                      const count = ratingData ? Number(ratingData.count) : 0;
                      const total = ratingDistribution.reduce((sum, r) => sum + Number(r.count), 0);
                      const percentage = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div key={rating} className="flex items-center text-xs">
                          <span className="w-8 text-gray-600">{rating}★</span>
                          <div className="flex-1 mx-2">
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-yellow-400 h-1.5 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-8 text-right text-gray-500">{Math.round(percentage)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">Category-wise Strength</h3>
                {loadingCategories ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                  </div>
                ) : categoryStrength.length === 0 ? (
                  <p className="text-sm text-gray-500">No data for this period</p>
                ) : (
                  <div className="space-y-2">
                    {categoryStrength.map((c) => {
                      const totalRevenue = categoryStrength.reduce((sum, x) => sum + Number(x.revenue), 0);
                      const percent = totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100) : 0;
                      return (
                        <div key={c.service_id}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-gray-700">{c.service_name}</span>
                            <span className="text-gray-500">₹{Number(c.revenue).toLocaleString("en-IN")}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-indigo-600 h-1.5 rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {c.applications} apps • Profit ₹{Number(c.profit).toLocaleString("en-IN")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'efficiency' && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center">
                  <FiActivity className="h-3 w-3 mr-2 text-green-600" /> Efficiency Metrics
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 rounded p-2 border border-green-200">
                    <p className="text-xs text-green-700">Active Days</p>
                    <p className="font-bold text-green-900 text-sm">{staff.activeDays}</p>
                  </div>
                  <div className="bg-blue-50 rounded p-2 border border-blue-200">
                    <p className="text-xs text-blue-700">Revenue / Day</p>
                    <p className="font-bold text-blue-900 text-sm">₹{formatINR(staff.revenuePerDay)}</p>
                  </div>
                  <div className="bg-amber-50 rounded p-2 border border-amber-200">
                    <p className="text-xs text-amber-700">Profit / Day</p>
                    <p className="font-bold text-amber-900 text-sm">₹{formatINR(staff.profitPerDay)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};

const StaffPerformanceSection = ({ 
  data, 
  showCharts, 
  timePeriod, 
  setTimePeriod,
  selectedStaff: externalSelectedStaff,
  setSelectedStaff: externalSetSelectedStaff,
  setActiveSection,
  centreId,
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
  const [categoryStrength, setCategoryStrength] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('revenue'); 
  
  const [internalReviewSummary, setInternalReviewSummary] = useState(null);
  const [internalRatingDistribution, setInternalRatingDistribution] = useState([]);
  const [internalLoadingReviews, setInternalLoadingReviews] = useState(false);

  const reviewSummary = isSuperAdmin ? null : internalReviewSummary; 
  const ratingDistribution = externalRatingDistribution || internalRatingDistribution;
  const loadingReviews = externalLoadingReviews !== undefined ? externalLoadingReviews : internalLoadingReviews;

  const DateRangePicker = () => {
    const [isOpen, setIsOpen] = useState(false);
    
    const quickRanges = [
      { label: 'This Month', getDates: () => {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = new Date();
        return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
      }},
      { label: 'Last Quarter', getDates: () => {
        const now = new Date();
        const q = Math.floor(now.getMonth() / 3) * 3;
        const from = new Date(now.getFullYear(), q, 1);
        const to = new Date();
        return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
      }},
      { label: 'This Year', getDates: () => {
        const now = new Date();
        const from = new Date(now.getFullYear(), 0, 1);
        const to = new Date();
        return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
      }},
    ];

    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <FiCalendar className="h-4 w-4 mr-2 text-gray-500" />
          {fromDate && toDate ? `${fromDate} to ${toDate}` : 'Select Date Range'}
          <FiChevronRight className="h-4 w-4 ml-2 text-gray-500 transform rotate-90" />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-80"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900 text-sm">Date Range</h4>
                    <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                      <FiX className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
                      <input
                        type="date"
                        value={fromDate || ''}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
                      <input
                        type="date"
                        value={toDate || ''}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-medium text-gray-700">Quick Select</p>
                    <div className="space-y-2">
                      {quickRanges.map((range) => (
                        <button
                          key={range.label}
                          onClick={() => {
                            const dates = range.getDates();
                            setFromDate(dates.from);
                            setToDate(dates.to);
                            setIsOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
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

  const fetchStaffPerformance = async (from, to, centreId) => {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams({ from, to });
    if (centreId) params.append("centreId", centreId);
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/staffreport/staff-performance?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error("Failed to fetch staff performance");
    return res.json();
  };

  const fetchTraineePerformance = async (from, to, centreId) => {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams({ from, to });
    if (centreId) params.append("centreId", centreId);
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/staffreport/trainee-performance?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error("Failed to fetch trainee performance");
    return res.json();
  };

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
        { headers: { Authorization: `Bearer ${token}` } }
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
        { headers: { Authorization: `Bearer ${token}` } }
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
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!selectedStaff || !fromDate || !toDate) return;
    const fetchCategoryStrength = async () => {
      try {
        setLoadingCategories(true);
        const token = localStorage.getItem("token");
        const params = new URLSearchParams({ from: fromDate, to: toDate });
        if (centreId) params.append("centreId", centreId);

        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/staffreport/staff/${selectedStaff.id}/category-strength?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } }
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
    const to = now.toISOString().slice(0, 10);
    let from;
    if (timePeriod === "monthly") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timePeriod === "quarterly") {
      const q = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), q, 1);
    } else {
      from = new Date(now.getFullYear(), 0, 1);
    }
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to);
  }, [timePeriod]);

  useEffect(() => {
    if (!isSuperAdmin && fromDate && toDate) {
      fetchReviewSummary();
      fetchRatingDistribution();
    }
  }, [isSuperAdmin, centreId, fromDate, toDate]);

  const formatPerformanceData = (rows) => {
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
        collectionRate: expected > 0 ? Math.round((collected / expected) * 100) : 100,
        revenueCollected: collected,
        serviceCharge: Number(row.service_charge_earned),
        servicesCompleted: Number(row.services_completed),
        avgTransaction: Number(row.avg_ticket_size || 0),
        incentiveScore: incentiveScore,
        totalReviews: Number(row.total_reviews || 0),
        avgStaffRating: Number(row.avg_staff_rating || 0),
        activeDays: Number(row.active_days || 0),
        revenuePerDay: Number(row.revenue_per_day || 0),
        profitPerDay: Number(row.profit_per_day || 0),
        achievement: 0,
        monthlyTarget: 0,
        todayCollection: 0,
      };
    });
  };

  const loadStaffPerformance = async (from, to) => {
    try {
      setLoading(true);

      const [staffRows, traineeRows] = await Promise.all([
        fetchStaffPerformance(from, to, centreId),
        fetchTraineePerformance(from, to, centreId).catch(() => []) 
      ]);

      setStaffPerformance(formatPerformanceData(staffRows));
      setTraineePerformance(formatPerformanceData(traineeRows));

    } catch (err) {
      console.error("Staff performance load failed", err);
      setStaffPerformance([]);
      setTraineePerformance([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedStaff = useMemo(() => {
    let result = [...staffPerformance];
    if (searchQuery) {
      result = result.filter(staff => staff.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'rate': return b.collectionRate - a.collectionRate;
        case 'incentive': return b.incentiveScore - a.incentiveScore;
        case 'services': return b.servicesCompleted - a.servicesCompleted;
        case 'name': return a.name.localeCompare(b.name);
        case 'revenue': default: return b.revenueCollected - a.revenueCollected;
      }
    });
    return result;
  }, [staffPerformance, sortBy, searchQuery]);

  const filteredAndSortedTrainees = useMemo(() => {
    let result = [...traineePerformance];
    if (searchQuery) {
      result = result.filter(staff => staff.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'rate': return b.collectionRate - a.collectionRate;
        case 'incentive': return b.incentiveScore - a.incentiveScore;
        case 'services': return b.servicesCompleted - a.servicesCompleted;
        case 'name': return a.name.localeCompare(b.name);
        case 'revenue': default: return b.revenueCollected - a.revenueCollected;
      }
    });
    return result;
  }, [traineePerformance, sortBy, searchQuery]);

  // COMBINED DATA FOR THE QUICK VIEW TABLE
  const combinedStaffForTable = useMemo(() => {
    const all = [
      ...filteredAndSortedStaff.map(s => ({ ...s, isTrainee: false })),
      ...filteredAndSortedTrainees.map(s => ({ ...s, isTrainee: true }))
    ];
    return all.sort((a, b) => b.expectedAmount - a.expectedAmount); 
  }, [filteredAndSortedStaff, filteredAndSortedTrainees]);

  const summaryStats = useMemo(() => {
    const combinedStaff = [...staffPerformance, ...traineePerformance];
    if (combinedStaff.length === 0) return null;
    
    const totalRevenue = combinedStaff.reduce((sum, s) => sum + s.revenueCollected, 0);
    const avgRate = Math.round(combinedStaff.reduce((sum, s) => sum + s.collectionRate, 0) / combinedStaff.length);
    const totalServices = combinedStaff.reduce((sum, s) => sum + s.servicesCompleted, 0);
    const avgIncentive = Math.round(combinedStaff.reduce((sum, s) => sum + s.incentiveScore, 0) / combinedStaff.length);
    
    return { totalRevenue, avgRate, totalServices, avgIncentive };
  }, [staffPerformance, traineePerformance]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <p className="font-semibold text-gray-900 text-sm mb-2">{label}</p>
          {payload.map((item, index) => (
            <div key={index} className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                <span className="text-gray-600 text-xs">{item.name}</span>
              </div>
              <span className="font-bold text-gray-900 text-xs">
                {item.name.includes('Revenue') || item.name.includes('Transaction') ? `₹${formatINR(item.value)}` : item.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <FiUserCheck className="h-5 w-5 mr-2 text-indigo-600" />
              Staff Performance
            </h2>
            <p className="text-gray-600 text-sm mt-1">Revenue collection and performance metrics</p>
          </div>
          <button
            onClick={() => loadStaffPerformance(fromDate, toDate)}
            className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FiRefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <DateRangePicker />
          
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
          >
            <option value="monthly">This Month</option>
            <option value="quarterly">This Quarter</option>
            <option value="yearly">This Year</option>
          </select>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search staff..."
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="revenue">Sort by Revenue</option>
              <option value="rate">Sort by Collection Rate</option>
              <option value="incentive">Sort by Incentive</option>
              <option value="services">Sort by Services</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
        </div>

        {summaryStats && (
          <div className="grid gap-3 mb-4 grid-cols-2 md:grid-cols-4">
            <StatCard
              title="Total Revenue"
              value={`₹${formatINR(summaryStats.totalRevenue)}`}
              subtitle="All staff combined"
              icon={FiDollarSign}
              color="bg-indigo-600"
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

        {!isSuperAdmin && reviewSummary && (
          <div className="grid gap-3 mb-4 grid-cols-3">
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
              color="bg-indigo-600"
            />
          </div>
        )}

        {showCharts && filteredAndSortedStaff.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Revenue vs Services</h3>
                  <p className="text-gray-500 text-xs">Top performers</p>
                </div>
                <FiBarChart2 className="h-4 w-4 text-indigo-600" />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={filteredAndSortedStaff.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.length > 8 ? `${value.substring(0, 6)}...` : value}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `₹${value/1000}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenueCollected" name="Revenue" fill="#6366F1" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="servicesCompleted" name="Services" fill="#10B981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Collection Performance</h3>
                  <p className="text-gray-500 text-xs">Rate vs Incentive</p>
                </div>
                <FiTrendingUp className="h-4 w-4 text-indigo-600" />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={filteredAndSortedStaff.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.length > 8 ? `${value.substring(0, 6)}...` : value}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="collectionRate" name="Collection Rate" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="incentiveScore" name="Incentive Score" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Avg. Transaction Size</h3>
                  <p className="text-gray-500 text-xs">Ticket size comparison</p>
                </div>
                <FiDollarSign className="h-4 w-4 text-indigo-600" />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={filteredAndSortedStaff.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.length > 8 ? `${value.substring(0, 6)}...` : value}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `₹${value/1000}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgTransaction" name="Avg. Transaction" fill="#F59E0B" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Rating Distribution</h3>
                  <p className="text-gray-500 text-xs">Staff performance ratings</p>
                </div>
                <FiStar className="h-4 w-4 text-yellow-500" />
              </div>
              
              {loadingReviews ? (
                <div className="flex items-center justify-center h-[200px]">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                </div>
              ) : ratingDistribution.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-gray-500 text-sm">
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
                            <span className="font-medium text-gray-700">{rating} ★</span>
                          </div>
                          <span className="text-gray-500">{count} reviews</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
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

        {/* 🔥 NEW QUICK VIEW REVENUE TABLE */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="text-sm font-bold text-gray-900 flex items-center">
              <FiList className="mr-2 text-indigo-600" />
              Quick View: Revenue & Charges Breakdown
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="p-3 font-medium">Staff Name</th>
                  <th className="p-3 font-medium text-center">Type</th>
                  <th className="p-3 font-medium text-center">Services</th>
                  <th className="p-3 font-medium text-right">Total Revenue</th>
                  <th className="p-3 font-medium text-right text-blue-600">Dept Charges</th>
                  <th className="p-3 font-medium text-right text-indigo-600">Service Charges</th>
                  <th className="p-3 font-medium text-right text-emerald-600">Collected</th>
                  <th className="p-3 font-medium text-right text-rose-600">Pending</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-gray-500">
                      <FiRefreshCw className="animate-spin h-5 w-5 mx-auto mb-2 text-indigo-500" />
                      Loading breakdown...
                    </td>
                  </tr>
                ) : combinedStaffForTable.length > 0 ? (
                  combinedStaffForTable.map(staff => {
                    const deptCharge = staff.expectedAmount - staff.serviceCharge;
                    return (
                      <tr key={`table-${staff.id}`} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3 font-medium text-gray-900">{staff.name}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${staff.isTrainee ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                            {staff.isTrainee ? 'Trainee' : 'Staff'}
                          </span>
                        </td>
                        <td className="p-3 text-center text-gray-600">{staff.servicesCompleted}</td>
                        <td className="p-3 text-right font-bold text-gray-900">₹{formatINR(staff.expectedAmount)}</td>
                        <td className="p-3 text-right font-medium text-blue-700">₹{formatINR(deptCharge)}</td>
                        <td className="p-3 text-right font-bold text-indigo-600">₹{formatINR(staff.serviceCharge)}</td>
                        <td className="p-3 text-right font-medium text-emerald-600">₹{formatINR(staff.collectedAmount)}</td>
                        <td className="p-3 text-right font-medium text-rose-600">{staff.pendingAmount > 0 ? `₹${formatINR(staff.pendingAmount)}` : '-'}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="p-4 text-center text-gray-500 text-sm">No data available for the selected period</td>
                  </tr>
                )}
                
                {combinedStaffForTable.length > 0 && (
                  <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                    <td className="p-3 text-gray-900" colSpan="2">Grand Total</td>
                    <td className="p-3 text-center text-gray-900">{combinedStaffForTable.reduce((sum, s) => sum + s.servicesCompleted, 0)}</td>
                    <td className="p-3 text-right text-gray-900">₹{formatINR(combinedStaffForTable.reduce((sum, s) => sum + s.expectedAmount, 0))}</td>
                    <td className="p-3 text-right text-blue-700">₹{formatINR(combinedStaffForTable.reduce((sum, s) => sum + (s.expectedAmount - s.serviceCharge), 0))}</td>
                    <td className="p-3 text-right text-indigo-600">₹{formatINR(combinedStaffForTable.reduce((sum, s) => sum + s.serviceCharge, 0))}</td>
                    <td className="p-3 text-right text-emerald-600">₹{formatINR(combinedStaffForTable.reduce((sum, s) => sum + s.collectedAmount, 0))}</td>
                    <td className="p-3 text-right text-rose-600">₹{formatINR(combinedStaffForTable.reduce((sum, s) => sum + s.pendingAmount, 0))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Permanent Staff Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">
              Permanent Staff List {filteredAndSortedStaff.length > 0 && `(${filteredAndSortedStaff.length})`}
            </h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Showing top performers by {sortBy}
            </span>
          </div>

          {!loading && filteredAndSortedStaff.length === 0 && (
            <div className="text-center py-8 border border-gray-200 rounded-lg bg-white">
              <FiUser className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-600 text-sm mb-1">No staff found</p>
              <p className="text-gray-500 text-xs">Try adjusting your filters or search criteria</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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

        {/* Trainee / Probation Grid */}
        {!loading && filteredAndSortedTrainees.length > 0 && (
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center">
                <FiUsers className="mr-2 text-blue-600" />
                Trainee & Probation List ({filteredAndSortedTrainees.length})
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredAndSortedTrainees.map((staff) => (
                <StaffPerformanceCard
                  key={`trainee-${staff.id}`}
                  staff={staff}
                  rank={null} 
                  isSelected={selectedStaff?.id === staff.id}
                  onClick={() => setSelectedStaff(staff)}
                />
              ))}
            </div>
          </div>
        )}

      </div>

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