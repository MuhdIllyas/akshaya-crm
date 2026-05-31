import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiAward, FiUser, FiPhone, FiClock, FiChevronRight, FiChevronDown,
  FiEye, FiCheckCircle, FiClock as FiPending, FiXCircle, FiLoader,
  FiCalendar, FiFileText, FiTrendingUp, FiBarChart2, FiPieChart, FiFilter,
  FiStar, FiSearch, FiChevronsUp, FiChevronsDown
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar
} from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_URL;
const getToken = () => localStorage.getItem('token');

// Custom tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="backdrop-blur-md bg-white/85 p-3 rounded-xl shadow-xl border border-white/40">
        <p className="font-bold text-gray-800">{label}</p>
        {payload.map((p, idx) => (
          <p key={idx} className="text-sm flex items-center gap-2 mt-1" style={{ color: p.color }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }}></span>
            {p.name}: <span className="font-mono font-semibold">{p.value}</span> tokens
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CampaignTokenManagementStaff = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState('all');
  const [activeChartTab, setActiveChartTab] = useState('staff');
  const navigate = useNavigate();

  // Table state
  const [tableTokens, setTableTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0, limit: 20 });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tableCampaignId, setTableCampaignId] = useState('all');
  const [tableStatus, setTableStatus] = useState('all');
  const [staffList, setStaffList] = useState([]);
  const [tableStaffId, setTableStaffId] = useState('all');
  const [globalSearch, setGlobalSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTokenData, setCancelTokenData] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const COLORS = {
    completed: '#10B981',
    pending: '#F59E0B',
    inProgress: '#8B5CF6',
    processed: '#3B82F6'
  };

  useEffect(() => {
    fetchCampaignsAndStats();
    fetchTableTokens();
  }, [selectedCampaignId]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [dateFrom, dateTo, tableCampaignId, tableStatus, debouncedSearch, tableStaffId]);

  useEffect(() => {
    fetchTableTokens();
  }, [pagination.page, dateFrom, dateTo, tableCampaignId, tableStatus, debouncedSearch, tableStaffId]);

  useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedSearch(globalSearch);
      }, 500);
      return () => clearTimeout(handler);
  }, [globalSearch]);

  useEffect(() => {
    const fetchStaffList = async () => {
      try {
        const token = getToken();
        if (!token) return;
        const response = await axios.get(`${API_BASE_URL}/api/servicemanagement/staff`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStaffList(response.data || []);
      } catch (err) {
        console.error('Failed to fetch staff list:', err);
      }
    };
    fetchStaffList();
  }, []);

  const fetchCampaignsAndStats = async () => {
    try {
      const token = getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      const response = await axios.get(`${API_BASE_URL}/api/servicemanagement/staff/campaign-tokens`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const campaignsData = response.data?.campaigns || [];
      setCampaigns(campaignsData);
      
      const params = new URLSearchParams();
      if (selectedCampaignId !== 'all') {
        params.append('campaign_id', selectedCampaignId);
      }
      const statsResponse = await axios.get(`${API_BASE_URL}/api/servicemanagement/campaigns/stats?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(statsResponse.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTableTokens = async () => {
    setTableLoading(true);
    try {
      const token = getToken();
      if (!token) return;
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        from: dateFrom,
        to: dateTo,
        status: tableStatus,
        campaign_id: tableCampaignId,
        search: debouncedSearch,
        staff_id: tableStaffId
      });
      const response = await axios.get(`${API_BASE_URL}/api/servicemanagement/campaign-tokens/table?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTableTokens(response.data.tokens);
      setFilteredTokens(response.data.tokens);
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
        pages: response.data.pages
      }));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load tokens');
    } finally {
      setTableLoading(false);
    }
  };

  const handleServiceAction = (trackingId, tokenCode) => {
    if (trackingId) {
      navigate(`/dashboard/staff/track_service/${trackingId}`);
    } else {
      navigate(`/dashboard/staff/token/${tokenCode}/service`);
    }
  };

  const openCancelModal = (tokenCode, customerName) => {
    setCancelTokenData({ tokenCode, customerName });
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelTokenData) return;
    setCancelling(true);
    try {
      const token = getToken();
      await axios.put(`${API_BASE_URL}/api/servicemanagement/tokens/${cancelTokenData.tokenCode}/cancel`,
        { reason: cancelReason.trim() || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Token ${cancelTokenData.tokenCode} cancelled successfully`);
      setShowCancelModal(false);
      setCancelTokenData(null);
      setCancelReason('');
      fetchTableTokens();
      fetchCampaignsAndStats();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to cancel token');
    } finally {
      setCancelling(false);
    }
  };

  const toggleRowExpand = (tokenCode) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tokenCode)) newSet.delete(tokenCode);
      else newSet.add(tokenCode);
      return newSet;
    });
  };

  const expandAllRows = () => {
    const allCodes = filteredTokens.map(t => t.tokenCode);
    setExpandedRows(new Set(allCodes));
  };

  const collapseAllRows = () => {
    setExpandedRows(new Set());
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      processed: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
      'in-progress': 'bg-indigo-100 text-indigo-800'
    };
    const icons = {
      pending: <FiPending className="h-3 w-3 mr-1" />,
      processed: <FiCheckCircle className="h-3 w-3 mr-1" />,
      completed: <FiCheckCircle className="h-3 w-3 mr-1" />,
      cancelled: <FiXCircle className="h-3 w-3 mr-1" />,
      'in-progress': <FiLoader className="h-3 w-3 mr-1" />
    };
    const displayStatus = status?.replace('_', ' ') || 'Unknown';
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {icons[status] || null}
        {displayStatus}
      </span>
    );
  };

  const isCampaignActive = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    return now >= start && now <= end;
  };

  // Chart data preparation (same as before)
  const staffChartData = stats?.staff_contributions?.map(s => ({
    name: s.staff_name.split(' ')[0] || s.staff_name,
    Completed: s.completed_tokens,
    Pending: s.pending_tokens,
    'In Progress': s.in_progress_tokens,
    fullName: s.staff_name
  })) || [];

  const statusChartData = stats?.status_summary ? [
    { name: 'Pending', value: stats.status_summary.pending, color: COLORS.pending },
    { name: 'Processed', value: stats.status_summary.processed, color: COLORS.processed },
    { name: 'Completed', value: stats.status_summary.completed, color: COLORS.completed },
    { name: 'In Progress', value: stats.status_summary.in_progress, color: COLORS.inProgress }
  ].filter(item => item.value > 0) : [];

  const campaignPerformanceData = stats?.campaign_summary?.map(c => ({
    name: c.campaign_name.length > 20 ? c.campaign_name.substring(0, 20) + '...' : c.campaign_name,
    Total: c.total_tokens,
    Completed: c.completed_tokens,
    completionRate: Math.round(c.completion_rate),
    fullName: c.campaign_name
  })) || [];

  const totalTokens = (campaigns || []).reduce((sum, c) => sum + (c?.tokens?.length || 0), 0);
  const completedTokens = (campaigns || []).reduce((sum, c) => 
    sum + (c?.tokens?.filter(t => t?.token_status === 'completed' || t?.service_status === 'completed').length || 0), 0);
  const completionRate = totalTokens ? Math.round((completedTokens / totalTokens) * 100) : 0;

  const avgCompletionRate = stats?.campaign_summary?.length
    ? (stats.campaign_summary.reduce((sum, c) => sum + c.completion_rate, 0) / stats.campaign_summary.length).toFixed(1)
    : 0;

  const totalStaff = stats?.staff_contributions?.length || 0;
  const activeStaff = stats?.staff_contributions?.filter(s => s.total_tokens > 0).length || 0;
  const staffParticipationRate = totalStaff ? ((activeStaff / totalStaff) * 100).toFixed(1) : 0;

  const mostActiveCampaign = stats?.campaign_summary?.reduce((max, c) => c.total_tokens > (max?.total_tokens || 0) ? c : max, null);
  const mostActiveCampaignName = mostActiveCampaign?.campaign_name || '—';
  const mostActiveCampaignTokens = mostActiveCampaign?.total_tokens || 0;

  const pendingTokens = stats?.status_summary?.pending || 0;

  const leaderboardData = [...staffChartData]
    .sort((a, b) => b.Completed - a.Completed)
    .slice(0, 5)
    .map(item => ({ name: item.name, Completed: item.Completed, fullName: item.fullName }));

  const gaugeData = [
    { name: 'Completed', value: completionRate, fill: '#10B981' },
    { name: 'Remaining', value: 100 - completionRate, fill: '#E5E7EB' }
  ];

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading campaign data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg">
              <FiAward className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Campaign Token Management</h1>
              <p className="text-gray-600 mt-1">Track and manage campaign service requests</p>
            </div>
          </div>
        </div>

        {/* Stats Cards - Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">Total Campaign Tokens</p><p className="text-2xl font-bold text-gray-900">{totalTokens}</p></div>
              <div className="p-3 bg-purple-100 rounded-xl"><FiAward className="h-6 w-6 text-purple-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">Active Campaigns</p><p className="text-2xl font-bold text-gray-900">{(campaigns || []).filter(c => isCampaignActive(c?.campaign_start, c?.campaign_end)).length}</p></div>
              <div className="p-3 bg-green-100 rounded-xl"><FiTrendingUp className="h-6 w-6 text-green-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">Completed Services</p><p className="text-2xl font-bold text-gray-900">{completedTokens}</p></div>
              <div className="p-3 bg-blue-100 rounded-xl"><FiCheckCircle className="h-6 w-6 text-blue-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">Completion Rate</p><p className="text-2xl font-bold text-gray-900">{completionRate}%</p></div>
              <div className="p-3 bg-indigo-100 rounded-xl"><FiBarChart2 className="h-6 w-6 text-indigo-600" /></div>
            </div>
            <div className="mt-2 h-1 w-full bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${completionRate}%` }} />
            </div>
          </div>
        </div>

        {/* Row 2: Additional metrics cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">Avg. Completion Rate</p><p className="text-2xl font-bold text-gray-900">{avgCompletionRate}%</p></div>
              <div className="p-3 bg-teal-100 rounded-xl"><FiTrendingUp className="h-6 w-6 text-teal-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">Staff Participation</p><p className="text-2xl font-bold text-gray-900">{staffParticipationRate}%</p><p className="text-xs text-gray-400">{activeStaff}/{totalStaff} staff</p></div>
              <div className="p-3 bg-orange-100 rounded-xl"><FiUser className="h-6 w-6 text-orange-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">Most Active Campaign</p><p className="font-bold text-gray-900 truncate max-w-[160px]">{mostActiveCampaignName}</p><p className="text-xs text-gray-400">{mostActiveCampaignTokens} tokens</p></div>
              <div className="p-3 bg-pink-100 rounded-xl"><FiAward className="h-6 w-6 text-pink-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-500">Pending Tokens</p><p className="text-2xl font-bold text-yellow-600">{pendingTokens}</p></div>
              <div className="p-3 bg-yellow-100 rounded-xl"><FiClock className="h-6 w-6 text-yellow-600" /></div>
            </div>
          </div>
        </div>

        {/* Campaign Analytics Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <FiPieChart className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-gray-900">Campaign Analytics</h2>
            </div>
            <div className="flex items-center gap-3">
              <FiFilter className="h-4 w-4 text-gray-400" />
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="all">All Campaigns</option>
                {campaigns.map(c => (
                  <option key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 mb-6">
            <button onClick={() => setActiveChartTab('staff')} className={`px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${activeChartTab === 'staff' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><FiUser className="h-4 w-4" /> Staff Contribution</button>
            <button onClick={() => setActiveChartTab('status')} className={`px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${activeChartTab === 'status' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><FiPieChart className="h-4 w-4" /> Status Distribution</button>
            <button onClick={() => setActiveChartTab('campaigns')} className={`px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${activeChartTab === 'campaigns' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><FiBarChart2 className="h-4 w-4" /> Campaign Performance</button>
          </div>
          <div className="h-80">
            {activeChartTab === 'staff' && (
              staffChartData.length === 0 ? <div className="flex items-center justify-center h-full text-gray-400">No staff data</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={staffChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barCategoryGap="20%">
                    <defs>
                      <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#059669"/></linearGradient>
                      <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#D97706"/></linearGradient>
                      <linearGradient id="gradInProgress" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#6D28D9"/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC', opacity: 0.6 }} />
                    <Legend wrapperStyle={{ paddingTop: 15 }} iconType="circle" formatter={(value) => <span className="text-sm text-gray-700">{value}</span>} />
                    <Bar dataKey="Completed" fill="url(#gradCompleted)" radius={[6,6,0,0]} animationDuration={800} />
                    <Bar dataKey="Pending" fill="url(#gradPending)" radius={[6,6,0,0]} animationDuration={800} />
                    <Bar dataKey="In Progress" fill="url(#gradInProgress)" radius={[6,6,0,0]} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              )
            )}
            {activeChartTab === 'status' && (
              statusChartData.length === 0 ? <div className="flex items-center justify-center h-full text-gray-400">No status data</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {statusChartData.map((entry, idx) => (
                        <linearGradient key={`grad-${idx}`} id={`gradStatus${idx}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={entry.color} stopOpacity={0.9}/><stop offset="100%" stopColor={entry.color} stopOpacity={0.5}/></linearGradient>
                      ))}
                      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.15" /></filter>
                    </defs>
                    <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#94A3B8', strokeWidth: 1, strokeDasharray: '2 2' }} animationBegin={0} animationDuration={1000}>
                      {statusChartData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={`url(#gradStatus${idx})`} stroke="#fff" strokeWidth={2} filter="url(#shadow)" />)}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} token(s)`, 'Count']} contentStyle={{ borderRadius: '16px', backdropFilter: 'blur(12px)', backgroundColor: 'rgba(255,255,255,0.85)', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '8px 14px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )
            )}
            {activeChartTab === 'campaigns' && (
              campaignPerformanceData.length === 0 ? <div className="flex items-center justify-center h-full text-gray-400">No campaign data</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={campaignPerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical" barSize={20}>
                    <defs>
                      <linearGradient id="totalGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#6366F1"/><stop offset="100%" stopColor="#8B5CF6"/></linearGradient>
                      <linearGradient id="compGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#059669"/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#475569', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} width={130} axisLine={false} tickLine={false} />
                    <Tooltip content={({ active, payload, label }) => { if (active && payload && payload.length) { const data = payload[0].payload; return (<div className="backdrop-blur-md bg-white/80 p-3 rounded-xl shadow-xl border border-white/40"><p className="font-bold text-gray-800">{data.fullName || label}</p><p className="text-sm text-indigo-600">Total: {data.Total} tokens</p><p className="text-sm text-emerald-600">Completed: {data.Completed} tokens</p><p className="text-xs text-gray-500 mt-1">Completion: {data.completionRate}%</p></div>); } return null; }} cursor={{ fill: '#F8FAFC', opacity: 0.5 }} />
                    <Legend iconType="circle" formatter={(value) => <span className="text-sm text-gray-700">{value}</span>} />
                    <Bar dataKey="Total" fill="url(#totalGrad)" radius={[0,8,8,0]} animationDuration={800} />
                    <Bar dataKey="Completed" fill="url(#compGrad)" radius={[0,8,8,0]} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              )
            )}
          </div>
        </div>

        {/* Staff Leaderboard & Completion Rate Gauge */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-amber-100 rounded-xl"><FiStar className="h-5 w-5 text-amber-600" /></div><h2 className="text-xl font-semibold text-gray-900">Staff Leaderboard (Top 5)</h2></div>
            <div className="h-64">
              {leaderboardData.length === 0 ? <div className="flex items-center justify-center h-full text-gray-400">No staff data</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leaderboardData} layout="vertical" margin={{ left: 40, right: 20, top: 10, bottom: 10 }} barSize={24}>
                    <defs><linearGradient id="leaderboardGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#F97316"/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#475569', fontSize: 12 }} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} width={80} axisLine={false} tickLine={false} />
                    <Tooltip content={({ active, payload, label }) => { if (active && payload && payload.length) { const data = payload[0].payload; return (<div className="backdrop-blur-md bg-white/80 p-2 rounded-lg shadow-md border border-white/40"><p className="font-semibold text-gray-800">{data.fullName || label}</p><p className="text-sm text-amber-600">✅ {data.Completed} completed</p></div>); } return null; }} cursor={{ fill: '#FEF3C7', opacity: 0.4 }} />
                    <Bar dataKey="Completed" fill="url(#leaderboardGrad)" radius={[0,6,6,0]} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-emerald-100 rounded-xl"><FiCheckCircle className="h-5 w-5 text-emerald-600" /></div><h2 className="text-xl font-semibold text-gray-900">Completion Rate Gauge</h2></div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="60%" outerRadius="100%" data={gaugeData} startAngle={180} endAngle={0} cx="50%" cy="50%">
                  <RadialBar minAngle={15} background clockWise dataKey="value" cornerRadius={10} fill="#8884d8" />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-bold" fill="#1F2937">{completionRate}%</text>
                  <text x="50%" y="65%" textAnchor="middle" dominantBaseline="middle" className="text-xs fill-gray-500">Completed</text>
                  <Tooltip formatter={(value) => [`${value}%`, 'Completion Rate']} contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'rgba(255,255,255,0.9)' }} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Token Table with Staff Name Column */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="text-xs text-gray-500">From Date</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">To Date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Campaign</label>
              <select value={tableCampaignId} onChange={e => setTableCampaignId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
                <option value="all">All Campaigns</option>
                {campaigns.map(c => <option key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Staff</label>
              <select value={tableStaffId} onChange={e => setTableStaffId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
                <option value="all">All Staff</option>
                {staffList.map(staff => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select value={tableStatus} onChange={e => setTableStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="processed">Processed</option>
                <option value="completed">Completed</option>
                <option value="in-progress">In Progress</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Global Search Bar */}
          <div className="mb-4 flex items-center gap-4">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by token ID, customer name, phone, campaign, or staff..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={expandAllRows} className="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 flex items-center gap-1"><FiChevronsDown className="h-4 w-4" /> Expand All</button>
              <button onClick={collapseAllRows} className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-1"><FiChevronsUp className="h-4 w-4" /> Collapse All</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">Token ID</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">Customer</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">Campaign</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">Staff</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">Created</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500">Action</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {tableLoading ? (
                  <tr><td colSpan="8" className="text-center py-8 text-gray-400">Loading tokens...</td></tr>
                ) : filteredTokens.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-8 text-gray-400">No tokens found</td></tr>
                ) : (
                  filteredTokens.map(token => (
                    <React.Fragment key={token.tokenCode}>
                      <tr className="border-t hover:bg-gray-50">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-sm">{token.tokenCode}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-medium">{token.customerName}</div>
                          <div className="text-xs text-gray-500">{token.phone}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">{token.campaignName}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <FiUser className="h-3 w-3 text-gray-400" />
                            <span className="text-sm">{token.staffName || 'Unassigned'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(token.status)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{new Date(token.created_at).toLocaleDateString()}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {token.status !== 'cancelled' ? (
                            <>
                              <button
                                onClick={() => handleServiceAction(token.trackingId, token.tokenCode)}
                                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100"
                              >
                                {token.trackingId ? 'View Service' : 'Start Service'}
                              </button>
                              <button
                                onClick={() => openCancelModal(token.tokenCode, token.customerName)}
                                className="ml-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">Cancelled</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={() => toggleRowExpand(token.tokenCode)} className="text-gray-400 hover:text-gray-600">
                            {expandedRows.has(token.tokenCode) ? <FiChevronDown /> : <FiChevronRight />}
                          </button>
                        </td>
                      </tr>
                      {expandedRows.has(token.tokenCode) && (
                        <tr className="bg-gray-50 border-t">
                          <td colSpan="8" className="py-3 px-4 text-sm">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div><p className="text-xs font-medium text-gray-500">Service Name</p><p className="text-gray-800">{token.serviceName || '—'}</p></div>
                              <div><p className="text-xs font-medium text-gray-500">Subcategory</p><p className="text-gray-800">{token.subcategoryName || '—'}</p></div>
                              <div><p className="text-xs font-medium text-gray-500">Application Number</p><p className="text-gray-800 font-mono">{token.applicationNumber || '—'}</p></div>
                              <div><p className="text-xs font-medium text-gray-500">Progress</p><p className="text-gray-800">{token.progress !== undefined ? `${token.progress}%` : '—'}</p></div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <button disabled={pagination.page === 1} onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Previous</button>
              <span className="text-sm text-gray-600">Page {pagination.page} of {pagination.pages}</span>
              <button disabled={pagination.page === pagination.pages} onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
            </div>
          )}
        </div>

        {/* Cancel Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Cancel Token</h3>
              <p className="text-gray-600 mb-4">Are you sure you want to cancel token <span className="font-mono font-bold">{cancelTokenData?.tokenCode}</span> for <span className="font-medium">{cancelTokenData?.customerName}</span>?</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., customer request, duplicate entry..." />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition">No, Keep Token</button>
                <button onClick={handleCancelConfirm} disabled={cancelling} className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition disabled:opacity-50">{cancelling ? 'Cancelling...' : 'Yes, Cancel Token'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignTokenManagementStaff;