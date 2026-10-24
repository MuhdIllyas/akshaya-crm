import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FiPlus, FiMessageSquare, FiSettings, FiCopy, FiCheck, FiEdit, FiPower } from "react-icons/fi";

const CommunicationSettings = () => {
  const [activeTab, setActiveTab] = useState("accounts");
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [savingMappings, setSavingMappings] = useState(false);
  const [loadError, setLoadError] = useState(null);
  
  // NEW: Track if we are editing an existing account
  const [editingId, setEditingId] = useState(null);

  const [accountForm, setAccountForm] = useState({
    name: "",
    phone_number: "",
    access_token: "",
    channel_id: "", 
  });

  const [selectedMappingAccount, setSelectedMappingAccount] = useState("");
  const [mappings, setMappings] = useState({});

  const systemEvents = [
    { key: "pending_payment", label: "Pending Payment Reminder" },
    { key: "service_tracking", label: "Service Status Update" },
    { key: "review_request", label: "Customer Review Request" },
    { key: "token_generated", label: "New Token Generated" },
    { key: "reengagement_message", label: "Reengagement Request" },
    { key: "document_ready", label: "Document Ready - Public" },
    { key: "passport_appointment_reminder", label: "Passport Appointment Reminder" },
    { key: "document_submission_reminder", label: "Document Submission Reminder" }
  ];

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/communication/accounts`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setAccounts(response.data || []);
    } catch (err) {
      console.error("Failed to fetch accounts", err);
      const msg = err.response?.data?.error || "Failed to load communication accounts";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // UPDATED: Handles both Create and Edit based on editingId
  const handleSaveAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await axios.put(`${import.meta.env.VITE_API_URL}/api/communication/accounts/${editingId}`, accountForm, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        toast.success("Communication Account updated!");
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/communication/accounts`, accountForm, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        toast.success("Communication Account created!");
      }
      closeModal();
      fetchAccounts();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save account");
    } finally {
      setLoading(false);
    }
  };

  // NEW: Pre-fill the form and open modal for editing
  const handleEditClick = (acc) => {
    setEditingId(acc.id);
    setAccountForm({
      name: acc.name,
      phone_number: acc.phone_number,
      access_token: "", 
      channel_id: acc.channel_id || "",
    });
    setShowAddModal(true);
  };

  // NEW: Toggle Active Status
  const handleToggleStatus = async (id, currentStatus) => {
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL}/api/communication/accounts/${id}/status`, 
        { is_active: !currentStatus },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      toast.success(`Account ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchAccounts();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update status");
    }
  };

  // Helper to cleanly reset form state
  const closeModal = () => {
    setShowAddModal(false);
    setEditingId(null);
    setAccountForm({ name: "", phone_number: "", access_token: "", channel_id: "" });
  };

  const copyWebhook = async (accountId) => {
    const url = `${import.meta.env.VITE_API_URL}/api/webhook/whatsapp`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(accountId);
      setTimeout(() => setCopiedId(null), 2000);
      toast.info("Webhook URL copied to clipboard");
    } catch (err) {
      toast.error("Couldn't copy. Please copy the URL manually: " + url);
    }
  };

  // Fetch existing mappings when an account is selected
  useEffect(() => {
    if (selectedMappingAccount) {
      fetchMappings(selectedMappingAccount);
    } else {
      setMappings({});
    }
  }, [selectedMappingAccount]);

  const fetchMappings = async (accountId) => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/communication/accounts/${accountId}/mappings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      // Convert array of database rows into a simple key-value object
      const mappingObj = {};
      response.data.forEach(m => {
        mappingObj[m.event_key] = m.provider_template_name;
      });
      setMappings(mappingObj);
    } catch (err) {
      console.error("Failed to fetch mappings", err);
    }
  };

  const handleSaveMappings = async () => {
    if (!selectedMappingAccount) {
      toast.warning("Please select an account first");
      return;
    }
    setSavingMappings(true);
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/communication/accounts/${selectedMappingAccount}/mappings`, 
        { mappings }, 
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      toast.success("Template mappings saved successfully!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save mappings");
    } finally {
      setSavingMappings(false);
    }
  };

  const activeCount = accounts.filter((a) => a.is_active).length;

  const AccountActions = ({ acc }) => (
    <div className="inline-flex items-center gap-1">
      <button
        onClick={() => copyWebhook(acc.id)}
        className="p-2.5 rounded-lg text-slate-500 hover:text-navy-700 hover:bg-slate-100 transition-colors"
        title="Copy Webhook URL"
        aria-label={`Copy webhook URL for ${acc.name}`}
      >
        {copiedId === acc.id ? <FiCheck className="text-emerald-600" size={16} /> : <FiCopy size={16} />}
      </button>
      <button
        onClick={() => handleToggleStatus(acc.id, acc.is_active)}
        className={`p-2.5 rounded-lg transition-colors ${acc.is_active ? "text-slate-500 hover:text-rose-600 hover:bg-rose-50" : "text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"}`}
        title={acc.is_active ? "Deactivate Account" : "Activate Account"}
        aria-label={`${acc.is_active ? "Deactivate" : "Activate"} ${acc.name}`}
      >
        <FiPower size={16} />
      </button>
      <button
        onClick={() => handleEditClick(acc)}
        className="p-2.5 rounded-lg text-slate-500 hover:text-navy-700 hover:bg-slate-100 transition-colors"
        title="Edit Account"
        aria-label={`Edit ${acc.name}`}
      >
        <FiEdit size={16} />
      </button>
    </div>
  );

  const StatusPill = ({ active }) => (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-rose-500"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );

  const inputCls = "w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 disabled:bg-slate-100 disabled:text-slate-400";

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-6">
      <div className="w-full">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Communication Settings</h1>
          <p className="text-slate-500 mt-1">Manage WhatsApp numbers, providers, and message templates.</p>
        </div>

        <div className="flex w-full sm:inline-flex sm:w-auto bg-slate-200/70 rounded-xl p-1 mb-6" role="tablist">
          {[["accounts", FiMessageSquare, "WhatsApp Accounts"], ["templates", FiSettings, "Template Mappings"]].map(([id, Icon, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 sm:flex-none whitespace-nowrap flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id ? "bg-white text-navy-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>

        {loadError && !loading && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-rose-800">Couldn't load accounts</p>
              <p className="text-sm text-rose-600">{loadError}</p>
            </div>
            <button onClick={fetchAccounts} className="shrink-0 px-3 py-2 text-sm font-medium text-rose-700 hover:text-rose-900">Retry</button>
          </div>
        )}

        {activeTab === "accounts" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="grid grid-cols-3 gap-3 sm:gap-4 flex-1">
                {[
                  ["Total accounts", accounts.length, "text-slate-900"],
                  ["Active", activeCount, "text-emerald-600"],
                  ["Inactive", accounts.length - activeCount, "text-rose-600"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3">
                    <p className="text-xs sm:text-sm text-slate-500 font-medium">{label}</p>
                    <p className={`text-2xl font-bold ${tone}`}>{value}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center justify-center gap-2 bg-navy-700 hover:bg-navy-800 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors shadow-sm"
              >
                <FiPlus className="text-lg" />
                Add Account
              </button>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone Number</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-slate-100 text-navy-700 flex items-center justify-center shrink-0">
                            <FiMessageSquare size={18} />
                          </span>
                          <span className="font-medium text-slate-900">{acc.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">{acc.phone_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <StatusPill active={acc.is_active} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <AccountActions acc={acc} />
                      </td>
                    </tr>
                  ))}
                  {accounts.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-10 text-center text-slate-500">
                        No communication accounts configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {accounts.map((acc) => (
                <div key={acc.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-xl bg-slate-100 text-navy-700 flex items-center justify-center shrink-0">
                      <FiMessageSquare size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">{acc.name}</p>
                      <p className="text-sm text-slate-500 truncate">{acc.phone_number}</p>
                    </div>
                    <StatusPill active={acc.is_active} />
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                    <AccountActions acc={acc} />
                  </div>
                </div>
              ))}
              {accounts.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
                  No communication accounts configured yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Template Mappings */}
        {activeTab === "templates" && (
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Map Libromi Templates to CRM Events</h3>
            <p className="text-sm text-slate-500 mb-6">
              Select an account and link your approved Meta template names to the automated events in Akshaya CRM.
            </p>

            <div className="mb-6 max-w-md">
              <label htmlFor="mapping-account" className="block text-sm font-medium text-slate-700 mb-2">Select Account to Configure</label>
              <select
                id="mapping-account"
                className={inputCls}
                value={selectedMappingAccount}
                onChange={(e) => setSelectedMappingAccount(e.target.value)}
              >
                <option value="">-- Select Account --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.phone_number})</option>
                ))}
              </select>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="hidden md:grid grid-cols-12 bg-slate-50 px-4 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <div className="col-span-4">CRM Event (Trigger)</div>
                <div className="col-span-8">Approved Meta Template Name</div>
              </div>

              {systemEvents.map((event, index) => (
                <div key={event.key} className={`grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 md:items-center px-4 py-3.5 ${index !== systemEvents.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  <div className="md:col-span-4">
                    <label htmlFor={`map-${event.key}`} className="block font-medium text-slate-800">{event.label}</label>
                    <span className="block text-xs text-slate-400 font-mono mt-0.5">{event.key}</span>
                  </div>
                  <div className="md:col-span-8">
                    <input
                      id={`map-${event.key}`}
                      type="text"
                      placeholder={`e.g., ${event.key}_v1`}
                      value={mappings[event.key] || ""}
                      onChange={(e) => setMappings({...mappings, [event.key]: e.target.value})}
                      disabled={!selectedMappingAccount}
                      className={`${inputCls} md:max-w-xl`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveMappings}
                disabled={savingMappings || !selectedMappingAccount}
                className="bg-navy-700 hover:bg-navy-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-semibold transition-colors shadow-sm"
              >
                {savingMappings ? "Saving..." : "Save Mappings"}
              </button>
            </div>
          </div>
        )}

      {/* Add / Edit Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-label={editingId ? "Edit WhatsApp Account" : "Add New WhatsApp Account"}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="bg-navy-700 text-white px-5 py-4">
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit WhatsApp Account" : "Add New WhatsApp Account"}
              </h2>
            </div>
            <form onSubmit={handleSaveAccount} className="p-5 md:p-6 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label htmlFor="acc-name" className="block text-sm font-medium text-slate-700 mb-1.5">Internal Name</label>
                  <input
                    id="acc-name"
                    type="text"
                    required
                    value={accountForm.name}
                    onChange={(e) => setAccountForm({...accountForm, name: e.target.value})}
                    placeholder="e.g., Shared Main Account"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="acc-phone" className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp Phone Number</label>
                  <input
                    id="acc-phone"
                    type="text"
                    required
                    value={accountForm.phone_number}
                    onChange={(e) => setAccountForm({...accountForm, phone_number: e.target.value})}
                    placeholder="e.g., +919961900071"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="acc-channel" className="block text-sm font-medium text-slate-700 mb-1.5">Channel ID</label>
                  <input
                    id="acc-channel"
                    type="text"
                    required
                    value={accountForm.channel_id}
                    onChange={(e) => setAccountForm({...accountForm, channel_id: e.target.value})}
                    placeholder="e.g., 1234"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="acc-token" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Libromi Access Token
                  </label>
                  <input
                    id="acc-token"
                    type="password"
                    required={!editingId} // Only required when creating a new account
                    value={accountForm.access_token}
                    onChange={(e) => setAccountForm({...accountForm, access_token: e.target.value})}
                    placeholder={editingId ? "Leave blank to keep existing token" : "Paste token here"}
                    className={inputCls}
                  />
                  {editingId && (
                    <p className="text-xs text-slate-500 mt-1.5">Only fill this if you need to update the token.</p>
                  )}
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-navy-700 hover:bg-navy-800 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors shadow-sm"
                >
                  {loading ? "Saving..." : (editingId ? "Update Account" : "Save Account")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default CommunicationSettings;