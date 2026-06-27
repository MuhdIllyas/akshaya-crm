import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FiPlus, FiMessageSquare, FiSettings, FiCopy, FiCheck, FiEdit, FiPower } from "react-icons/fi";

const CommunicationSettings = () => {
  const [activeTab, setActiveTab] = useState("accounts");
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  
  // NEW: Track if we are editing an existing account
  const [editingId, setEditingId] = useState(null);

  const [accountForm, setAccountForm] = useState({
    name: "",
    phone_number: "",
    access_token: "",
  });

  const [selectedMappingAccount, setSelectedMappingAccount] = useState("");
  const [mappings, setMappings] = useState({});

  const systemEvents = [
    { key: "pending_payment", label: "Pending Payment Reminder" },
    { key: "service_tracking", label: "Service Status Update" },
    { key: "review_request", label: "Customer Review Request" },
    { key: "token_generated", label: "New Token Generated" },
    { key: "reengagement_message", label: "Reengagement Request" },
  ];

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/communication/accounts`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setAccounts(response.data || []);
    } catch (err) {
      console.error("Failed to fetch accounts", err);
      setAccounts([
        { id: 1, name: "Shared Main Account", phone_number: "+919961900071", is_active: true }
      ]);
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
      access_token: "", // Keep blank so we don't expose it. Handled dynamically on backend.
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
    setAccountForm({ name: "", phone_number: "", access_token: "" });
  };

  const copyWebhook = (phone) => {
    const url = `${import.meta.env.VITE_API_URL}/api/webhook/whatsapp`;
    navigator.clipboard.writeText(url);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
    toast.info("Webhook URL copied to clipboard");
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
    setLoading(true);
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/communication/accounts/${selectedMappingAccount}/mappings`, 
        { mappings }, 
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      toast.success("Template mappings saved successfully!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save mappings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Communication Settings</h1>
          <p className="text-gray-500 mt-1">Manage WhatsApp numbers, providers, and message templates.</p>
        </div>

        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab("accounts")}
            className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
              activeTab === "accounts"
                ? "border-[#1e3a5f] text-[#1e3a5f]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <FiMessageSquare /> WhatsApp Accounts
            </div>
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
              activeTab === "templates"
                ? "border-[#1e3a5f] text-[#1e3a5f]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <FiSettings /> Template Mappings
            </div>
          </button>
        </div>

        {activeTab === "accounts" && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#172a45] text-white px-4 py-2.5 rounded-xl font-medium transition-all duration-300 shadow-md"
              >
                <FiPlus className="text-lg" />
                Add Account
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone Number</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{acc.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">{acc.phone_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${acc.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {acc.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end items-center gap-3">
                          <button 
                            onClick={() => copyWebhook(acc.phone_number)}
                            className="text-gray-500 hover:text-[#1e3a5f]"
                            title="Copy Webhook URL"
                          >
                            {copiedToken ? <FiCheck className="text-green-500" /> : <FiCopy />}
                          </button>
                          
                          <div className="w-px h-4 bg-gray-300"></div> {/* Divider */}
                          
                          <button 
                            onClick={() => handleToggleStatus(acc.id, acc.is_active)}
                            className={`${acc.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
                            title={acc.is_active ? "Deactivate Account" : "Activate Account"}
                          >
                            <FiPower />
                          </button>
                          <button 
                            onClick={() => handleEditClick(acc)}
                            className="text-blue-500 hover:text-blue-700"
                            title="Edit Account"
                          >
                            <FiEdit />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {accounts.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                        No communication accounts configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Template Mappings */}
        {activeTab === "templates" && (
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Map Libromi Templates to CRM Events</h3>
            <p className="text-sm text-gray-500 mb-6">
              Select an account and link your approved Meta template names to the automated events in Akshaya CRM.
            </p>

            <div className="mb-6 max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Account to Configure</label>
              <select 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a5f]"
                value={selectedMappingAccount}
                onChange={(e) => setSelectedMappingAccount(e.target.value)}
              >
                <option value="">-- Select Account --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.phone_number})</option>
                ))}
              </select>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 bg-gray-50 p-4 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
                <div className="col-span-4">CRM Event (Trigger)</div>
                <div className="col-span-8">Approved Meta Template Name</div>
              </div>
              
              {systemEvents.map((event, index) => (
                <div key={event.key} className={`grid grid-cols-12 items-center p-4 ${index !== systemEvents.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div className="col-span-4">
                    <span className="block font-medium text-gray-800">{event.label}</span>
                    <span className="block text-xs text-gray-400 font-mono mt-1">{event.key}</span>
                  </div>
                  <div className="col-span-8">
                    <input 
                      type="text" 
                      placeholder={`e.g., ${event.key}_v1`}
                      value={mappings[event.key] || ""}
                      onChange={(e) => setMappings({...mappings, [event.key]: e.target.value})}
                      disabled={!selectedMappingAccount}
                      className="w-full max-w-md px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#1e3a5f] disabled:bg-gray-100"
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={handleSaveMappings}
                disabled={loading || !selectedMappingAccount}
                className="bg-[#1e3a5f] hover:bg-[#172a45] disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              >
                {loading ? "Saving..." : "Save Mappings"}
              </button>
            </div>
          </div>
        )}

      {/* Add / Edit Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="bg-[#1e3a5f] text-white p-4">
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit WhatsApp Account" : "Add New WhatsApp Account"}
              </h2>
            </div>
            <form onSubmit={handleSaveAccount} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Internal Name</label>
                  <input
                    type="text"
                    required
                    value={accountForm.name}
                    onChange={(e) => setAccountForm({...accountForm, name: e.target.value})}
                    placeholder="e.g., Shared Main Account"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a5f]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Phone Number</label>
                  <input
                    type="text"
                    required
                    value={accountForm.phone_number}
                    onChange={(e) => setAccountForm({...accountForm, phone_number: e.target.value})}
                    placeholder="e.g., +919961900071"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a5f]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Libromi Access Token
                  </label>
                  <input
                    type="password"
                    required={!editingId} // Only required when creating a new account
                    value={accountForm.access_token}
                    onChange={(e) => setAccountForm({...accountForm, access_token: e.target.value})}
                    placeholder={editingId ? "Leave blank to keep existing token" : "Paste token here"}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a5f]"
                  />
                  {editingId && (
                    <p className="text-xs text-gray-400 mt-1">Only fill this if you need to update the token.</p>
                  )}
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#1e3a5f] hover:bg-[#172a45] text-white px-4 py-2 rounded-lg font-medium transition-colors"
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