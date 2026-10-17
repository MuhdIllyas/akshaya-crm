import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FiUser, FiPhone, FiHash, FiPlus, FiCheckCircle, FiChevronDown, FiClock,
  FiAward, FiSearch, FiXCircle, FiLayers,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getServices, createToken, getTokens, getCampaigns, getStaff, assignToken } from '/src/services/campaignService';

// ---------- helpers ----------
const toYmd = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};
const todayYmd = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// A campaign can take new tokens only while it is running. If the API gives no dates, keep it.
const isCampaignOpen = (c) => {
  const start = toYmd(c?.start_date || c?.startDate || c?.campaign_start);
  const end = toYmd(c?.end_date || c?.endDate || c?.campaign_end);
  const today = todayYmd();
  if (start && start > today) return false;
  if (end && end < today) return false;
  return true;
};

const formatDate = (value) => {
  const d = new Date(value);
  return isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};

const STATUS = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  processed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-sky-50 text-sky-700 ring-sky-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20 disabled:bg-slate-50 disabled:text-slate-400';

const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
  </label>
);

const SelectWrap = ({ children }) => (
  <div className="relative">
    {children}
    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
  </div>
);

const TokenGenerator = () => {
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    category: '',
    subcategory: '',
    campaign: '',
    centreId: localStorage.getItem('centre_id') || '',
  });

  const [categories, setCategories] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [tokenView, setTokenView] = useState('active'); // 'active' or 'campaign'

  const userRole = localStorage.getItem('role');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const categoriesRes = await getServices();
        setCategories(categoriesRes.data);

        const campaignsRes = await getCampaigns();
        setCampaigns(campaignsRes.data);

        const tokensRes = await getTokens();
        setTokens(tokensRes.data);

        const staffRes = await getStaff(formData.centreId);
        setStaffList(staffRes.data);
        setError(null);
      } catch (err) {
        console.error('TokenGenerator.jsx: Error fetching data:', err.response?.data || err.message);
        setError('Failed to load data.');
        toast.error('Failed to load data: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [formData.centreId]);

  useEffect(() => {
    if (formData.category && categories.length > 0) {
      const category = categories.find((cat) => cat.id === parseInt(formData.category));
      setFilteredSubcategories(category?.subcategories || []);
    } else {
      setFilteredSubcategories([]);
    }
  }, [formData.category, categories]);

  const openCampaigns = useMemo(() => campaigns.filter(isCampaignOpen), [campaigns]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData((prev) => ({ ...prev, phone: value.replace(/\D/g, '').slice(0, 10) }));
      return;
    }
    if (name === 'category') {
      setFormData((prev) => ({ ...prev, category: value, subcategory: '' }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = [];
    if (!formData.customerName || formData.customerName.trim().length < 2) {
      errors.push('Customer name is required and must be at least 2 characters');
    }
    if (!formData.phone || !/^\d{10}$/.test(formData.phone)) {
      errors.push('Valid 10-digit phone number is required');
    }
    if (!formData.centreId || isNaN(parseInt(formData.centreId))) {
      errors.push('Valid centre ID is required');
    }
    if (formData.category && isNaN(parseInt(formData.category))) {
      errors.push('Valid category ID is required');
    }
    if (formData.subcategory && isNaN(parseInt(formData.subcategory))) {
      errors.push('Valid subcategory ID is required');
    }
    if (formData.campaign && isNaN(parseInt(formData.campaign))) {
      errors.push('Valid campaign ID is required');
    }

    if (errors.length > 0) {
      errors.forEach((msg) => toast.error(msg));
      return;
    }

    setSubmitting(true);
    try {
      const submissionData = {
        customerName: formData.customerName.trim(),
        phone: formData.phone.trim(),
        categoryId: formData.category ? parseInt(formData.category) : null,
        subcategoryId: formData.subcategory ? parseInt(formData.subcategory) : null,
        campaignId: formData.campaign ? parseInt(formData.campaign) : null,
        centreId: parseInt(formData.centreId) || null,
        type: formData.campaign ? 'campaign' : 'normal',
      };

      await createToken(submissionData);
      toast.success('Token created successfully!');

      setFormData({
        customerName: '',
        phone: '',
        category: '',
        subcategory: '',
        campaign: '',
        centreId: formData.centreId,
      });
      setFilteredSubcategories([]);

      const tokensRes = await getTokens();
      setTokens(tokensRes.data);
    } catch (err) {
      if (err.response?.data?.details) {
        err.response.data.details.forEach((detail) => toast.error(detail));
      } else {
        toast.error(err.response?.data?.error || 'Failed to create token.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignToken = async (tokenId, staffId) => {
    if (!staffId) return;
    try {
      await assignToken(tokenId, staffId);
      toast.success('Token reassigned successfully!');

      const tokensRes = await getTokens();
      setTokens(tokensRes.data);
    } catch (err) {
      toast.error('Failed to assign token: ' + (err.response?.data?.error || err.message));
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find((cat) => cat.id === categoryId);
    return category ? category.name : 'N/A';
  };

  const getSubcategoryName = (categoryId, subcategoryId) => {
    const category = categories.find((cat) => cat.id === categoryId);
    const subcategory = category?.subcategories?.find((sub) => sub.id === subcategoryId);
    return subcategory ? subcategory.name : 'N/A';
  };

  const getCampaignName = (campaignId) => {
    const campaign = campaigns.find((cmp) => cmp.id === campaignId);
    return campaign ? campaign.name : 'N/A';
  };

  // tokens in the chosen view (Active = all, Campaign = campaign tokens only)
  const viewTokens = useMemo(
    () => tokens.filter((t) => (tokenView === 'campaign' ? t.type === 'campaign' : true)),
    [tokens, tokenView]
  );

  const counts = useMemo(() => {
    const c = { all: viewTokens.length, pending: 0, processed: 0, completed: 0, cancelled: 0 };
    viewTokens.forEach((t) => { if (c[t.status] !== undefined) c[t.status] += 1; });
    return c;
  }, [viewTokens]);

  const filteredTokens = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return viewTokens
      .filter((t) => activeTab === 'all' || t.status === activeTab)
      .filter((t) => !q
        || t.customerName?.toLowerCase().includes(q)
        || t.tokenId?.toLowerCase().includes(q)
        || t.phone?.includes(q));
  }, [viewTokens, activeTab, searchTerm]);

  const renderBadge = (token) => (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS[token.status] || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
      {token.status}
    </span>
  );

  const renderAssignee = (token) => (
    token.status === 'pending' ? (
      <SelectWrap>
        <select
          value={token.staffId || ''}
          onChange={(e) => handleAssignToken(token.tokenId, e.target.value)}
          className="w-full min-w-[150px] cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20"
        >
          <option value="" disabled>Unassigned</option>
          {staffList.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
        </select>
      </SelectWrap>
    ) : (
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <FiUser className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-medium text-slate-800">{token.staffName || 'Unassigned'}</div>
          {token.centreName && <div className="text-xs text-slate-400">{token.centreName}</div>}
        </div>
      </div>
    )
  );

  const stats = [
    { label: 'Total tokens', value: tokens.length, icon: FiHash, tone: 'text-navy-700 bg-navy-700/10' },
    { label: 'Processed', value: tokens.filter((t) => t.status === 'processed' || t.status === 'completed').length, icon: FiCheckCircle, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Pending', value: tokens.filter((t) => t.status === 'pending').length, icon: FiClock, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Campaign tokens', value: tokens.filter((t) => t.type === 'campaign').length, icon: FiAward, tone: 'text-violet-600 bg-violet-50' },
  ];

  const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'processed', label: 'Processed' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-800 text-white">
            <FiHash className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Token Generator</h1>
            <p className="text-sm text-slate-500">Create and manage customer service tokens</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <FiXCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Stats */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-500">{label}</p>
                <p className="text-xl font-semibold tabular-nums text-slate-900">{loading ? '-' : value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Generate form */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          <div className="mb-5 flex items-center gap-2.5">
            <FiPlus className="h-5 w-5 text-navy-700" />
            <h2 className="text-base font-semibold text-slate-900">Generate new token</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Customer name">
              <div className="relative">
                <FiUser className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  className={`${inputCls} pl-10`}
                  placeholder="Enter customer name"
                />
              </div>
            </Field>

            <Field label="Phone number">
              <div className="relative">
                <FiPhone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  inputMode="numeric"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={`${inputCls} pl-10`}
                  placeholder="10-digit mobile number"
                />
              </div>
            </Field>

            {userRole === 'superadmin' && (
              <Field label="Centre ID">
                <input
                  type="text"
                  name="centreId"
                  value={formData.centreId}
                  onChange={handleInputChange}
                  className={inputCls}
                  placeholder="Enter centre ID"
                />
              </Field>
            )}

            <Field label="Service category">
              <SelectWrap>
                <select name="category" value={formData.category} onChange={handleInputChange} className={`${inputCls} appearance-none pr-9`}>
                  <option value="">Select category</option>
                  {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </SelectWrap>
            </Field>

            <Field label="Subcategory">
              <SelectWrap>
                <select
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleInputChange}
                  className={`${inputCls} appearance-none pr-9`}
                  disabled={!formData.category}
                >
                  <option value="">Select subcategory</option>
                  {filteredSubcategories.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </select>
              </SelectWrap>
            </Field>

            <Field label="Campaign (optional)" hint={openCampaigns.length === 0 ? 'No campaign is running now' : undefined}>
              <SelectWrap>
                <select
                  name="campaign"
                  value={formData.campaign}
                  onChange={handleInputChange}
                  className={`${inputCls} appearance-none pr-9`}
                  disabled={openCampaigns.length === 0}
                >
                  <option value="">No campaign</option>
                  {openCampaigns.map((cmp) => <option key={cmp.id} value={cmp.id}>{cmp.name}</option>)}
                </select>
              </SelectWrap>
            </Field>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">
              {formData.campaign ? 'This will be created as a campaign token.' : 'This will be created as a normal token.'}
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2 disabled:opacity-60"
            >
              <FiPlus className="h-4 w-4" />
              {submitting ? 'Generating…' : 'Generate token'}
            </button>
          </div>
        </motion.form>

        {/* Token list */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="space-y-4 border-b border-slate-100 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div role="tablist" aria-label="Token view" className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                {[
                  { key: 'active', label: 'Active tokens', icon: FiHash },
                  { key: 'campaign', label: 'Campaign tokens', icon: FiLayers },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tokenView === key}
                    onClick={() => { setTokenView(key); setActiveTab('all'); }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${tokenView === key ? 'bg-navy-700 text-white' : 'text-slate-600 hover:bg-white'}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <FiSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, phone or token…"
                  className={`${inputCls} pl-10`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {statusTabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`shrink-0 rounded-full border px-3.5 py-1 text-sm transition-colors ${activeTab === t.key ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {t.label}
                  <span className={`ml-1.5 text-xs tabular-nums ${activeTab === t.key ? 'text-white/70' : 'text-slate-400'}`}>{counts[t.key]}</span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-px">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-[72px] animate-pulse bg-slate-50" />)}
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <FiHash className="mx-auto mb-3 h-9 w-9 text-slate-300" />
              <h3 className="text-sm font-semibold text-slate-800">No tokens found</h3>
              <p className="mt-1 text-sm text-slate-500">
                {searchTerm || activeTab !== 'all'
                  ? 'Try a different search or status.'
                  : tokenView === 'campaign'
                    ? 'No campaign tokens available.'
                    : 'Create a new token to get started.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 sm:px-6">Token</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="hidden px-4 py-3 md:table-cell">Status</th>
                    <th className="hidden px-4 py-3 sm:px-6 md:table-cell">Assigned to</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTokens.map((token) => (
                    <tr key={token.id || token.tokenId} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3.5 sm:px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-slate-900">{token.tokenId}</span>
                          {token.type === 'campaign' && (
                            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">Campaign</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-sm text-slate-700">{token.customerName}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <FiPhone className="h-3 w-3" /> {token.phone}
                        </div>
                        <div className="mt-2.5 space-y-2 md:hidden">
                          <div className="flex items-center gap-2">
                            {renderBadge(token)}
                            <span className="text-xs text-slate-400">{formatDate(token.createdAt)}</span>
                          </div>
                          {renderAssignee(token)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-sm font-medium text-slate-800">{getCategoryName(token.categoryId)}</div>
                        <div className="text-xs text-slate-500">{getSubcategoryName(token.categoryId, token.subcategoryId)}</div>
                        {token.campaignId && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-violet-600">
                            <FiAward className="h-3 w-3" /> {getCampaignName(token.campaignId)}
                          </div>
                        )}
                      </td>

                      <td className="hidden px-4 py-3.5 md:table-cell">
                        {renderBadge(token)}
                        <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <FiClock className="h-3 w-3" /> {formatDate(token.createdAt)}
                        </div>
                      </td>

                      <td className="hidden px-4 py-3.5 sm:px-6 md:table-cell">
                        {renderAssignee(token)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenGenerator;