import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUser, FiPhone, FiHash, FiPlus, FiCheckCircle, FiChevronDown, FiUserPlus, FiClock,
  FiSearch, FiCalendar, FiAward, FiFileText, FiRefreshCw, FiAlertCircle, FiInbox,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { getServices, createToken, getTokens, getCampaignHistory, getActiveCampaigns, getStaff, assignStaffToToken } from '/src/services/serviceService';
// Import centralized socket and connection function
import { socket } from '@/services/socket';

// ---------- helpers ----------
const IST = 'Asia/Kolkata';
const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST });
};
const isPast = (v) => {
  if (!v) return false;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return false;
  // a campaign is live through the whole of its end date (IST)
  const ymd = (x) => x.toLocaleDateString('en-CA', { timeZone: IST });
  return ymd(d) < ymd(new Date());
};
const codeFor = (c) => c.campaign_code || (c.name || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase();
const toArr = (res) => {
  const d = res?.data ?? res;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

const STATUS = {
  pending: { label: 'Pending', chip: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  processed: { label: 'Processed', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  completed: { label: 'Completed', chip: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  cancelled: { label: 'Cancelled', chip: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
};
const STATUS_TABS = ['all', 'pending', 'processed', 'completed', 'cancelled'];

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40 disabled:bg-slate-50 disabled:text-slate-400';

const StatusChip = ({ status }) => {
  const s = STATUS[status] || { label: status || 'Unknown', chip: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

const TypeTag = ({ type }) => (
  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${type === 'campaign' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
    {type === 'campaign' && <FiAward className="h-3 w-3" />}
    {type === 'campaign' ? 'Campaign' : 'Normal'}
  </span>
);

const Field = ({ label, icon: Icon, children, hint }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
    <span className="relative block">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
      {children}
    </span>
    {hint}
  </label>
);

const AdminTokenManagement = () => {
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    category: '',
    subcategory: '',
    campaign: '',
    type: 'normal',
    centreId: localStorage.getItem('centre_id') || '',
  });
  const [categories, setCategories] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [campaignHistory, setCampaignHistory] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [staffList, setStaffList] = useState({});
  const [selectedStaff, setSelectedStaff] = useState({});
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [tokenView, setTokenView] = useState('active'); // 'active' or 'history'
  const [searchTerm, setSearchTerm] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [campaignMap, setCampaignMap] = useState({}); // campaign details by ID
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assigningId, setAssigningId] = useState(null);

  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('id');
  const centreId = localStorage.getItem('centre_id');
  const canAssign = userRole === 'admin' || userRole === 'superadmin';
  const showActions = canAssign && tokenView === 'active';

  // latest view for socket handlers (avoids stale closures)
  const viewRef = useRef(tokenView);
  viewRef.current = tokenView;
  const fetchTokensRef = useRef(null);

  // --- Socket global error listener ---
  useEffect(() => {
    const onConnectError = (err) => {
      console.error('AdminTokenManagement: Socket connection error:', err.message);
      if (err.message === 'Socket authentication failed') {
        toast.error('Session expired. Please login again.');
      }
    };
    socket.on('connect_error', onConnectError);
    return () => {
      socket.off('connect_error', onConnectError);
    };
  }, []);

  // --- Socket event listeners for token updates ---
  useEffect(() => {
    const onNewToken = (data) => {
      toast.info(data.message);
      if (viewRef.current === 'active') fetchTokensRef.current?.();
    };
    const onTokenReassigned = (data) => {
      toast.info(data.message);
      if (viewRef.current === 'active') fetchTokensRef.current?.();
    };
    socket.on('newToken', onNewToken);
    socket.on('tokenReassigned', onTokenReassigned);
    return () => {
      socket.off('newToken', onNewToken);
      socket.off('tokenReassigned', onTokenReassigned);
    };
  }, []);

  const fetchTokens = async () => {
    try {
      // Only active tokens (normal + active campaign)
      const tokensRes = await getTokens(formData.centreId, '');
      const list = toArr(tokensRes);
      setTokens(list);
      return list;
    } catch (err) {
      console.error('AdminTokenManagement: Error fetching tokens:', err.response?.data || err.message);
      toast.error('Failed to fetch tokens: ' + (err.response?.data?.error || err.message));
      return null;
    }
  };
  fetchTokensRef.current = fetchTokens;

  const fetchCampaignHistory = async () => {
    try {
      const historyRes = await getCampaignHistory(formData.centreId);
      setCampaignHistory(toArr(historyRes));
    } catch (err) {
      console.error('AdminTokenManagement: Error fetching campaign history:', err.response?.data || err.message);
      toast.error('Failed to fetch campaign history: ' + (err.response?.data?.error || err.message));
    }
  };

  // Build campaign map from active campaigns and from history rows
  useEffect(() => {
    const map = {};
    activeCampaigns.forEach((c) => {
      map[c.id] = {
        id: c.id,
        name: c.name,
        code: codeFor(c),
        startDate: c.start_date,
        endDate: c.end_date,
        targetTokens: c.target_tokens,
        tokensGenerated: c.tokens_generated || 0,
      };
    });
    campaignHistory.forEach((token) => {
      if (token.campaignId && !map[token.campaignId]) {
        map[token.campaignId] = {
          id: token.campaignId,
          name: token.campaignName || 'Unknown campaign',
          code: token.campaignCode || 'CAM',
          startDate: token.campaignStartDate,
          endDate: token.campaignEndDate,
        };
      }
    });
    setCampaignMap(map);
  }, [activeCampaigns, campaignHistory]);

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      // each request on its own, so one failure does not blank the whole page
      const [catRes, campRes, tokensList, histRes] = await Promise.allSettled([
        getServices(),
        getActiveCampaigns(formData.centreId),
        getTokens(formData.centreId, ''),
        getCampaignHistory(formData.centreId),
      ]);
      if (catRes.status === 'fulfilled') setCategories(toArr(catRes.value));
      else console.error('AdminTokenManagement: categories failed', catRes.reason);
      if (campRes.status === 'fulfilled') setActiveCampaigns(toArr(campRes.value));
      else console.error('AdminTokenManagement: campaigns failed', campRes.reason);
      if (histRes.status === 'fulfilled') setCampaignHistory(toArr(histRes.value));
      else console.error('AdminTokenManagement: history failed', histRes.reason);

      let list = [];
      if (tokensList.status === 'fulfilled') {
        list = toArr(tokensList.value);
        setTokens(list);
      } else {
        throw tokensList.reason || new Error('Failed to fetch tokens');
      }

      const uniqueCentreIds = [...new Set(list.map((t) => t.centreId).filter((v) => v !== undefined && v !== null))];
      const staffResults = await Promise.allSettled(uniqueCentreIds.map((cid) => getStaff(cid)));
      const staffData = {};
      uniqueCentreIds.forEach((cid, i) => {
        staffData[cid] = staffResults[i].status === 'fulfilled' ? toArr(staffResults[i].value) : [];
      });
      setStaffList(staffData);
    } catch (err) {
      console.error('AdminTokenManagement: Error fetching data:', err.message);
      setError('Failed to load data.');
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.centreId]);

  useEffect(() => {
    if (formData.category && categories.length > 0) {
      const category = categories.find((cat) => cat.id === parseInt(formData.category, 10));
      setFilteredSubcategories(category?.subcategories || []);
    } else {
      setFilteredSubcategories([]);
    }
  }, [formData.category, categories]);

  useEffect(() => { setCampaignFilter('all'); }, [tokenView]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'type' && value === 'normal') next.campaign = '';
      if (name === 'category') next.subcategory = '';
      return next;
    });
  };

  const handleStaffChange = (tokenId, staffId) => {
    setSelectedStaff((prev) => ({ ...prev, [tokenId]: staffId }));
  };

  const handleAssignStaff = async (tokenId) => {
    const staffId = selectedStaff[tokenId];
    if (!staffId) {
      toast.error('Please select a staff member to assign');
      return;
    }
    setAssigningId(tokenId);
    try {
      await assignStaffToToken(tokenId, parseInt(staffId, 10));
      toast.success(`Staff assigned to token ${tokenId}`);
      setSelectedStaff((prev) => { const n = { ...prev }; delete n[tokenId]; return n; });
      await fetchTokens();
    } catch (err) {
      console.error('AdminTokenManagement: Error assigning staff:', err.response?.data || err.message);
      toast.error(`Failed to assign staff: ${err.response?.data?.error || err.message}`);
    } finally {
      setAssigningId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const errors = [];
    if (!formData.customerName || formData.customerName.trim().length < 2) {
      errors.push('Customer name is required and must be at least 2 characters');
    }
    if (!formData.phone || !/^\d{10}$/.test(formData.phone)) {
      errors.push('Valid 10-digit phone number is required');
    }
    if (!['normal', 'campaign'].includes(formData.type)) {
      errors.push('Token type is required and must be either "normal" or "campaign"');
    }
    if (formData.type === 'campaign') {
      if (!formData.campaign) {
        errors.push('Campaign selection is required for campaign tokens');
      } else {
        const selectedCampaign = activeCampaigns.find((c) => c.id === parseInt(formData.campaign, 10));
        if (selectedCampaign && selectedCampaign.tokens_generated >= selectedCampaign.target_tokens) {
          errors.push('This campaign has reached its target token limit');
        }
      }
    }
    if (formData.type === 'normal' && formData.campaign) {
      errors.push('Campaign should not be selected for normal tokens');
    }
    if (userRole !== 'admin' && (!formData.centreId || isNaN(parseInt(formData.centreId, 10)))) {
      errors.push('Valid centre ID is required for non-admin users');
    }
    if (formData.category && isNaN(parseInt(formData.category, 10))) {
      errors.push('Valid category ID is required');
    }
    if (formData.subcategory && isNaN(parseInt(formData.subcategory, 10))) {
      errors.push('Valid subcategory ID is required');
    }
    if (errors.length > 0) {
      errors.forEach((er) => toast.error(er));
      return;
    }

    setSubmitting(true);
    try {
      const submissionData = {
        customerName: formData.customerName.trim(),
        phone: formData.phone.trim(),
        categoryId: formData.category ? parseInt(formData.category, 10) : null,
        subcategoryId: formData.subcategory ? parseInt(formData.subcategory, 10) : null,
        campaignId: formData.type === 'campaign' ? parseInt(formData.campaign, 10) : null,
        type: formData.type,
        created_by: userId,
        centreId: userRole === 'admin' ? undefined : parseInt(formData.centreId, 10),
      };
      await createToken(submissionData);
      toast.success('Token created successfully!');

      setFormData({
        customerName: '',
        phone: '',
        category: '',
        subcategory: '',
        campaign: '',
        type: 'normal',
        centreId: formData.centreId,
      });
      setFilteredSubcategories([]);

      await fetchTokens();
      await fetchCampaignHistory();
      try {
        const activeCampaignsRes = await getActiveCampaigns(formData.centreId);
        setActiveCampaigns(toArr(activeCampaignsRes));
      } catch (err) {
        console.error('AdminTokenManagement: could not refresh campaigns', err);
      }

      if (submissionData.centreId && !staffList[submissionData.centreId]) {
        try {
          const staffRes = await getStaff(submissionData.centreId);
          setStaffList((prev) => ({ ...prev, [submissionData.centreId]: toArr(staffRes) }));
        } catch (err) {
          console.error('AdminTokenManagement: could not load staff', err);
        }
      }
    } catch (err) {
      console.error('AdminTokenManagement: Error creating token:', err.response?.data || err.message);
      if (err.response?.data?.details) {
        err.response.data.details.forEach((detail) => toast.error(detail));
      } else {
        toast.error(err.response?.data?.error || 'Failed to create token.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- lookups ----------
  const getCategoryName = (categoryId) => categories.find((c) => c.id === categoryId)?.name || 'N/A';
  const getSubcategoryName = (categoryId, subcategoryId) =>
    categories.find((c) => c.id === categoryId)?.subcategories?.find((s) => s.id === subcategoryId)?.name || 'N/A';
  const getStaffName = (staffId, cid) => {
    if (!staffId) return 'Unassigned';
    const staff = staffList[cid]?.find((s) => String(s.id) === String(staffId));
    return staff ? staff.name : 'Unassigned';
  };

  // ---------- derived ----------
  // History lists only tokens whose campaign is still running; tokens of campaigns past their end date are left out
  const sourceRows = useMemo(() => {
    if (tokenView === 'active') return tokens;
    return campaignHistory.filter((t) => !isPast(campaignMap[t.campaignId]?.endDate ?? t.campaignEndDate));
  }, [tokenView, tokens, campaignHistory, campaignMap]);

  const filteredTokens = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return sourceRows.filter((t) => {
      if (activeTab !== 'all' && t.status !== activeTab) return false;
      if (campaignFilter !== 'all' && String(t.campaignId) !== String(campaignFilter)) return false;
      if (!q) return true;
      return (
        t.customerName?.toLowerCase().includes(q) ||
        String(t.tokenId || '').toLowerCase().includes(q) ||
        String(t.phone || '').includes(q)
      );
    });
  }, [sourceRows, activeTab, campaignFilter, searchTerm]);

  const tabCounts = useMemo(() => {
    const c = { all: sourceRows.length };
    sourceRows.forEach((t) => { c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, [sourceRows]);

  const campaignOptions = useMemo(() => {
    const ids = new Set(sourceRows.filter((t) => t.campaignId).map((t) => String(t.campaignId)));
    return [...ids].map((id) => ({ id, name: campaignMap[id]?.name || 'Unknown campaign' })).sort((a, b) => a.name.localeCompare(b.name));
  }, [sourceRows, campaignMap]);

  const selectedCampaign = formData.campaign ? activeCampaigns.find((c) => c.id === parseInt(formData.campaign, 10)) : null;
  const tokenCentre = centreId || formData.centreId;

  const tiles = [
    { label: 'Active tokens', value: tokens.length, icon: FiHash, tone: 'bg-navy-700/10 text-navy-700' },
    { label: 'Processed', value: tokens.filter((t) => t.status === 'processed' || t.status === 'completed').length, icon: FiCheckCircle, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Pending', value: tokens.filter((t) => t.status === 'pending').length, icon: FiClock, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Active campaigns', value: activeCampaigns.length, icon: FiAward, tone: 'bg-violet-50 text-violet-600' },
  ];

  const renderAssign = (token) => {
    if (token.status === 'pending' && token.type === 'normal') {
      const busy = assigningId === token.tokenId;
      return (
        <div className="flex items-center gap-2">
          <select
            value={selectedStaff[token.tokenId] || ''}
            onChange={(e) => handleStaffChange(token.tokenId, e.target.value)}
            aria-label={`Assign staff to ${token.tokenId}`}
            className="min-w-[8rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-500/40"
          >
            <option value="">Select staff</option>
            {(staffList[token.centreId] || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            type="button"
            onClick={() => handleAssignStaff(token.tokenId)}
            disabled={!selectedStaff[token.tokenId] || busy}
            className="inline-flex items-center gap-1 rounded-lg bg-navy-700 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiUserPlus className="h-4 w-4" /> {busy ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      );
    }
    if (token.type === 'campaign') {
      return <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700"><FiAward className="h-3 w-3" /> Campaign token</span>;
    }
    return <span className="text-xs text-slate-400">Not assignable</span>;
  };

  const renderIdentity = (token) => {
    const camp = token.campaignId ? campaignMap[token.campaignId] : null;
    const expired = token.type === 'campaign' && isPast(camp?.endDate);
    return (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-semibold text-slate-900 ${token.type === 'campaign' ? 'font-mono' : ''}`}>{token.tokenId}</span>
          <TypeTag type={token.type} />
          {expired && <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-600">Ended</span>}
        </div>
        <p className="mt-0.5 truncate text-sm text-slate-700">{token.customerName}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><FiPhone className="h-3 w-3" />{token.phone}</p>
        {token.type === 'campaign' && token.campaignId && (
          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-violet-600">
            <FiCalendar className="h-3 w-3" />
            {camp?.name || 'Unknown campaign'}
            {camp?.endDate && <span className="text-slate-400">· until {formatDate(camp.endDate)}</span>}
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
        <div className="w-full animate-pulse space-y-4">
          <div className="h-10 w-72 rounded-lg bg-white" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-white" />)}</div>
          <div className="h-72 rounded-2xl bg-white" />
          <div className="h-80 rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Token Management</h1>
            <p className="mt-1 text-sm text-slate-500">Create, assign and track customer service tokens</p>
          </div>
          <button
            type="button" onClick={() => loadAll(true)} disabled={refreshing}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-slate-50 disabled:opacity-60 sm:self-auto"
          >
            <FiRefreshCw className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="flex items-center gap-2"><FiAlertCircle className="h-4 w-4" /> {error}</span>
            <button type="button" onClick={() => loadAll(true)} className="font-medium underline">Retry</button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.tone}`}><t.icon className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-500">{t.label}</p>
                <p className="text-xl font-bold tabular-nums text-slate-900">{t.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Generate token */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
          noValidate
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-700/10 text-navy-700"><FiPlus className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Generate new token</h2>
              <p className="text-sm text-slate-500">Create a token for a walk-in customer</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Customer name" icon={FiUser}>
              <input type="text" name="customerName" value={formData.customerName} onChange={handleInputChange} className={`${inputCls} pl-9`} placeholder="Enter customer name" />
            </Field>
            <Field label="Phone number" icon={FiPhone}>
              <input
                type="tel" inputMode="numeric" name="phone" maxLength={10} value={formData.phone}
                onChange={(e) => handleInputChange({ target: { name: 'phone', value: e.target.value.replace(/\D/g, '') } })}
                className={`${inputCls} pl-9`} placeholder="10-digit phone number"
              />
            </Field>
            <Field label="Centre ID" icon={FiHash}>
              <input type="text" name="centreId" value={formData.centreId} onChange={handleInputChange} className={`${inputCls} pl-9`} placeholder="Enter centre ID" disabled={userRole !== 'superadmin'} />
            </Field>
            <Field label="Service category" icon={FiHash}>
              <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select name="category" value={formData.category} onChange={handleInputChange} className={`${inputCls} appearance-none pl-9 pr-9`}>
                <option value="">Select category</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </Field>
            <Field label="Subcategory" icon={FiHash}>
              <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select name="subcategory" value={formData.subcategory} onChange={handleInputChange} className={`${inputCls} appearance-none pl-9 pr-9`} disabled={!formData.category}>
                <option value="">Select subcategory</option>
                {filteredSubcategories.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
            </Field>
            <div className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Token type</span>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="Token type">
                {[['normal', 'Normal'], ['campaign', 'Campaign']].map(([v, l]) => (
                  <button
                    key={v} type="button" role="radio" aria-checked={formData.type === v}
                    onClick={() => handleInputChange({ target: { name: 'type', value: v } })}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${formData.type === v ? 'bg-white text-navy-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {formData.type === 'campaign' && (
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Campaign" icon={FiAward}>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select name="campaign" value={formData.campaign} onChange={handleInputChange} className={`${inputCls} appearance-none pl-9 pr-9`}>
                    <option value="">{activeCampaigns.length ? 'Select campaign' : 'No active campaigns'}</option>
                    {activeCampaigns.map((cmp) => {
                      const next = (cmp.tokens_generated || 0) + 1;
                      return (
                        <option key={cmp.id} value={cmp.id}>
                          {cmp.name} ({codeFor(cmp)}-{tokenCentre}-{String(next).padStart(3, '0')}) · {cmp.tokens_generated || 0}/{cmp.target_tokens} tokens
                        </option>
                      );
                    })}
                  </select>
                </Field>
                {selectedCampaign && (() => {
                  const next = (selectedCampaign.tokens_generated || 0) + 1;
                  const used = selectedCampaign.tokens_generated || 0;
                  const target = selectedCampaign.target_tokens || 0;
                  const pct = target ? Math.min(100, Math.round((used / target) * 100)) : 0;
                  return (
                    <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <p className="text-violet-700"><span className="font-semibold">Next token:</span> <span className="font-mono">{codeFor(selectedCampaign)}-{tokenCentre}-{String(next).padStart(3, '0')}</span></p>
                        <p className="text-slate-500">Valid until {formatDate(selectedCampaign.end_date)}</p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} /></div>
                        <span className="text-xs tabular-nums text-slate-500">{used}/{target}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit" disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-500/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiPlus className="h-4 w-4" /> {submitting ? 'Generating…' : 'Generate token'}
            </button>
          </div>
        </motion.form>

        {/* View switch + filters */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Token view">
              {[['active', 'Active tokens', FiHash], ['history', 'Campaign history', FiFileText]].map(([v, l, Icon]) => (
                <button
                  key={v} type="button" role="tab" aria-selected={tokenView === v}
                  onClick={() => { setTokenView(v); setActiveTab('all'); }}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition ${tokenView === v ? 'bg-white text-navy-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Icon className="h-4 w-4" /> {l}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {campaignOptions.length > 0 && (
                <select className={`${inputCls} sm:w-56`} value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} aria-label="Campaign">
                  <option value="all">All campaigns</option>
                  {campaignOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <div className="relative sm:w-64">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search name, phone, token…" className={`${inputCls} pl-9`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search tokens" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Status">
            {STATUS_TABS.map((s) => (
              <button
                key={s} type="button" role="tab" aria-selected={activeTab === s} onClick={() => setActiveTab(s)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition ${activeTab === s ? 'bg-navy-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {s === 'all' ? 'All' : STATUS[s].label}
                <span className={`rounded-full px-1.5 text-xs tabular-nums ${activeTab === s ? 'bg-white/20' : 'bg-white text-slate-500'}`}>{tabCounts[s] || 0}</span>
              </button>
            ))}
          </div>

          {tokenView === 'history' && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-700">
              <FiFileText className="h-4 w-4 shrink-0" /> Campaign tokens of campaigns that are still running. Expired campaigns are not listed.
            </p>
          )}
        </div>

        {/* Results */}
        <p className="mb-2 px-1 text-sm text-slate-500">Showing <span className="font-semibold text-slate-700">{filteredTokens.length}</span> of {sourceRows.length} tokens</p>

        {filteredTokens.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <FiInbox className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-sm font-semibold text-slate-800">No tokens found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {sourceRows.length === 0
                ? (tokenView === 'active' ? 'No active tokens yet. Generate one above to get started.' : 'No tokens from running campaigns.')
                : 'Nothing matches the current filters.'}
            </p>
          </div>
        ) : (
          <>
            {/* phones: cards */}
            <div className="space-y-3 md:hidden">
              <AnimatePresence initial={false}>
                {filteredTokens.map((token) => (
                  <motion.div key={token.id || token.tokenId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      {renderIdentity(token)}
                      <StatusChip status={token.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">Service</p>
                        <p className="font-medium text-slate-800">{getCategoryName(token.categoryId)}</p>
                        <p className="text-xs text-slate-500">{getSubcategoryName(token.categoryId, token.subcategoryId)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Assigned to</p>
                        <p className="font-medium text-slate-800">{getStaffName(token.staffId, token.centreId)}</p>
                        <p className="text-xs text-slate-500">{token.centreName}</p>
                      </div>
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs text-slate-400"><FiClock className="h-3 w-3" /> {formatDate(token.createdAt)}</p>
                    {showActions && <div className="mt-3 border-t border-slate-100 pt-3">{renderAssign(token)}</div>}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* desktop: table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
              <table className="w-full">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Token</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned to</th>
                    {showActions && <th className="px-4 py-3">Assign</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTokens.map((token) => (
                    <tr key={token.id || token.tokenId} className="align-top transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3.5">{renderIdentity(token)}</td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium text-slate-800">{getCategoryName(token.categoryId)}</p>
                        <p className="text-xs text-slate-500">{getSubcategoryName(token.categoryId, token.subcategoryId)}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusChip status={token.status} />
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400"><FiClock className="h-3 w-3" /> {formatDate(token.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"><FiUser className="h-4 w-4" /></span>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{getStaffName(token.staffId, token.centreId)}</p>
                            <p className="text-xs text-slate-500">{token.centreName}</p>
                          </div>
                        </div>
                      </td>
                      {showActions && <td className="px-4 py-3.5">{renderAssign(token)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminTokenManagement;