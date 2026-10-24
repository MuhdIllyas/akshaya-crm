import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import AddAdminForm from "../../components/AddAdminForm";
import {
  FiPlus, FiSearch, FiX, FiGrid, FiList, FiEye, FiEdit2, FiTrash2, FiUserPlus, FiPhone, FiClock,
  FiHome, FiUserCheck, FiAlertCircle, FiMessageCircle, FiUser,
} from "react-icons/fi";

const EMPTY_CENTRE_FORM = {
  name: "", admin_id: "", communication_account_id: "",
  address: "", district: "", state: "", pincode: "",
  latitude: "", longitude: "", google_place_id: "",
  working_hours: "", phone: "", email: "", logo: ""
};

const getViewMode = () => {
  try { return localStorage.getItem("centre-view-mode") || "card"; } catch { return "card"; }
};

const WaBadge = ({ on }) => (
  <span
    className={`shrink-0 inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${
      on ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
    }`}
  >
    {on ? "WhatsApp on" : "System only"}
  </span>
);

const CentreManagement = () => {
  const [centres, setCentres] = useState([]);
  const [availableCommAccounts, setAvailableCommAccounts] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [centreForm, setCentreForm] = useState(EMPTY_CENTRE_FORM);
  const [editingCentreId, setEditingCentreId] = useState(null);
  const [showAddAdminForm, setShowAddAdminForm] = useState(null);
  const [showCentreDetails, setShowCentreDetails] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [viewMode, setViewMode] = useState(getViewMode);

  const changeView = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem("centre-view-mode", mode); } catch {}
  };

  const visibleCentres = centres.filter((c) => {
    if (filterMode === "no_admin" && c.admin_name) return false;
    if (filterMode === "no_whatsapp" && c.communication_account_id) return false;
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.admin_name, c.created_by_name, c.district, c.phone].some((f) => String(f || "").toLowerCase().includes(q));
  });

  const getImageUrl = (imagePath) => {
    if (!imagePath) return "";
    // If it's already a full URL or a legacy base64 string, return as is
    if (imagePath.startsWith("http") || imagePath.startsWith("data:image")) {
      return imagePath;
    }
    // Otherwise, append the backend URL
    const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";
    const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
    return `${baseUrl}${path}`;
  };

  const CentreLogo = ({ centre, size }) => {
    const [failed, setFailed] = useState(false);
    if (centre.logo && !failed) {
      return (
        <img
          src={getImageUrl(centre.logo)}
          alt={`${centre.name} logo`}
          onError={() => setFailed(true)}
          className={`${size} rounded-xl object-cover border border-slate-200 bg-white shrink-0`}
        />
      );
    }
    return (
      <div className={`${size} rounded-xl bg-navy-700 text-white flex items-center justify-center shrink-0`}>
        <FiHome size={18} />
      </div>
    );
  };

  const CentreActions = ({ centre }) => (
    <div className="inline-flex gap-1">
      <button onClick={() => fetchCentreDetails(centre.id)} className="p-2.5 rounded-lg text-slate-500 hover:text-navy-700 hover:bg-slate-100 transition-colors" title="View centre details" aria-label={`View ${centre.name}`}>
        <FiEye size={16} />
      </button>
      <button onClick={() => handleEditCentre(centre)} className="p-2.5 rounded-lg text-slate-500 hover:text-navy-700 hover:bg-slate-100 transition-colors" title="Edit centre" aria-label={`Edit ${centre.name}`}>
        <FiEdit2 size={16} />
      </button>
      <button onClick={() => setShowAddAdminForm(centre.id)} className="p-2.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" title="Add admin" aria-label={`Add admin to ${centre.name}`}>
        <FiUserPlus size={16} />
      </button>
      <button onClick={() => handleDeleteCentre(centre.id)} className="p-2.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete centre" aria-label={`Delete ${centre.name}`}>
        <FiTrash2 size={16} />
      </button>
    </div>
  );

  useEffect(() => {
    fetchCentres();
    fetchCommAccounts();
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/staff/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      // Filter the staff list so only admins appear in the dropdown
      const adminList = response.data.filter(staff => staff.role === 'admin');
      setAdmins(adminList);
    } catch (err) {
      console.error("Error fetching admins:", err);
    }
  };

  const fetchCentres = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/centres`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setCentres(response.data);
      toast.info("Centres loaded successfully", {
        position: "top-right",
        autoClose: 3000,
        theme: "light"
      });
    } catch (err) {
      console.error("Error fetching centres:", err);
      toast.error(err.response?.data?.error || "Failed to load centres", {
        position: "top-right",
        autoClose: 5000,
        theme: "light"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCommAccounts = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/communication/accounts`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setAvailableCommAccounts(response.data);
    } catch (err) {
      console.error("Error fetching communication accounts:", err);
      // We don't necessarily need a toast error here to avoid overwhelming the user if it fails
    }
  };

  const fetchCentreDetails = async (centreId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/centres/${centreId}/staff`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setShowCentreDetails(response.data);
      toast.info(`Loaded details for ${response.data.centre.name}`, {
        position: "top-right",
        autoClose: 3000,
        theme: "light"
      });
    } catch (err) {
      console.error("Error fetching centre details:", err);
      toast.error(err.response?.data?.error || "Failed to load centre details", {
        position: "top-right",
        autoClose: 5000,
        theme: "light"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCentreSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Create a FormData object to handle the file upload
      const formData = new FormData();
      
      // Append all form fields to the FormData object
      Object.keys(centreForm).forEach(key => {
        // Only append if the value exists (avoids sending strings of "null" or "undefined")
        if (centreForm[key] !== "" && centreForm[key] !== null && centreForm[key] !== undefined) {
          formData.append(key, centreForm[key]);
        }
      });

      const config = {
        headers: { 
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          'Content-Type': 'multipart/form-data' // Tell the server we are sending a file
        }
      };

      if (editingCentreId) {
        const response = await axios.put(`${import.meta.env.VITE_API_URL}/api/centres/${editingCentreId}`, formData, config);
        toast.success(response.data.message || "Centre updated successfully", {
          position: "top-right",
          autoClose: 3000,
          theme: "light"
        });
      } else {
        const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/centres`, formData, config);
        toast.success(response.data.message || "Centre created successfully", {
          position: "top-right",
          autoClose: 3000,
          theme: "light"
        });
      }
      
      // Reset form
      setCentreForm(EMPTY_CENTRE_FORM);
      setEditingCentreId(null);
      setShowForm(false);
      fetchCentres();
    } catch (err) {
      console.error("Error saving centre:", err);
      toast.error(err.response?.data?.error || "Failed to save centre", {
        position: "top-right",
        autoClose: 5000,
        theme: "light"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditCentre = (centre) => {
    setCentreForm({ 
      name: centre.name || "", 
      admin_id: centre.admin_id || "",
      communication_account_id: centre.communication_account_id || "",
      address: centre.address || "",
      district: centre.district || "",
      state: centre.state || "",
      pincode: centre.pincode || "",
      latitude: centre.latitude || "",
      longitude: centre.longitude || "",
      google_place_id: centre.google_place_id || "",
      working_hours: centre.working_hours || "",
      phone: centre.phone || "",
      email: centre.email || "",
      logo: centre.logo || ""
    });
    setEditingCentreId(centre.id);
    setShowForm(true);
    toast.info("Editing centre: " + centre.name, {
      position: "top-right",
      autoClose: 3000,
      theme: "light"
    });
  };

  const handleDeleteCentre = async (id) => {
    if (window.confirm("Are you sure you want to delete this centre?")) {
      setLoading(true);
      try {
        const response = await axios.delete(`${import.meta.env.VITE_API_URL}/api/centres/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        toast.success(response.data.message || "Centre deleted successfully", {
          position: "top-right",
          autoClose: 3000,
          theme: "light"
        });
        fetchCentres();
      } catch (err) {
        console.error("Error deleting centre:", err);
        toast.error(err.response?.data?.error || "Failed to delete centre", {
          position: "top-right",
          autoClose: 5000,
          theme: "light"
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddAdmin = () => {
    fetchCentres();
    setShowAddAdminForm(null);
    toast.success("Admin creation initiated", {
      position: "top-right",
      autoClose: 3000,
      theme: "light"
    });
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-6">
      <div className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Centre Management</h1>
            <p className="text-gray-500 mt-1">Manage centres and their administrators</p>
          </div>
          
          <div className="mt-4 md:mt-0">
            <button
              onClick={() => {
                setShowForm(!showForm);
                if (editingCentreId) {
                  setEditingCentreId(null);
                  setCentreForm(EMPTY_CENTRE_FORM);
                }
              }}
              className="flex items-center gap-2 bg-navy-700 hover:bg-navy-800 text-white px-4 py-2.5 rounded-xl font-medium transition-all duration-300 shadow-md hover:shadow-lg"
            >
              <FiPlus className="text-lg" />
              {showForm ? "Hide Form" : "Add Centre"}
            </button>
          </div>
        </div>

        {/* Add/Edit Centre Card - Only shown when showForm is true */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-8 overflow-hidden">
            <div className="bg-navy-700 text-white p-4">
              <div className="flex items-center">
                <svg className="h-6 w-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
                <h2 className="text-lg font-semibold">
                  {editingCentreId ? "Edit Centre" : "Create New Centre"}
                </h2>
              </div>
            </div>
            
            <form onSubmit={handleCentreSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="centre-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Centre Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="centre-name"
                    name="name"
                    value={centreForm.name}
                    onChange={(e) => setCentreForm({ ...centreForm, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition"
                    placeholder="Enter centre name"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label htmlFor="centre-phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    id="centre-phone"
                    value={centreForm.phone}
                    onChange={(e) => setCentreForm({ ...centreForm, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition"
                    placeholder="Enter contact number"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="centre-email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="centre-email"
                    value={centreForm.email}
                    onChange={(e) => setCentreForm({ ...centreForm, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition"
                    placeholder="Enter email address"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="centre-working-hours" className="block text-sm font-medium text-gray-700 mb-2">
                    Working Hours
                  </label>
                  <input
                    type="text"
                    id="centre-working-hours"
                    value={centreForm.working_hours}
                    onChange={(e) => setCentreForm({ ...centreForm, working_hours: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition"
                    placeholder="e.g., 9:00 AM - 6:00 PM"
                    disabled={loading}
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="centre-address" className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    id="centre-address"
                    value={centreForm.address}
                    onChange={(e) => setCentreForm({ ...centreForm, address: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition"
                    placeholder="Enter full address"
                    rows="2"
                    disabled={loading}
                  ></textarea>
                </div>

                <div>
                  <label htmlFor="centre-district" className="block text-sm font-medium text-gray-700 mb-2">
                    District
                  </label>
                  <input
                    type="text"
                    id="centre-district"
                    value={centreForm.district}
                    onChange={(e) => setCentreForm({ ...centreForm, district: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition"
                    placeholder="Enter district"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="centre-state" className="block text-sm font-medium text-gray-700 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    id="centre-state"
                    value={centreForm.state}
                    onChange={(e) => setCentreForm({ ...centreForm, state: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition"
                    placeholder="Enter state"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="centre-pincode" className="block text-sm font-medium text-gray-700 mb-2">
                    Pincode
                  </label>
                  <input
                    type="text"
                    id="centre-pincode"
                    value={centreForm.pincode}
                    onChange={(e) => setCentreForm({ ...centreForm, pincode: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition"
                    placeholder="Enter pincode"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="centre-logo" className="block text-sm font-medium text-gray-700 mb-2">
                    Centre Logo
                  </label>
                  
                  {/* Show existing logo when editing */}
                  {editingCentreId && typeof centreForm.logo === 'string' && centreForm.logo !== "" && (
                    <div className="mb-3 p-2 bg-gray-50 border border-gray-200 rounded-lg inline-block">
                      <p className="text-xs text-gray-500 mb-2">Current Logo:</p>
                      <img 
                        src={getImageUrl(centreForm.logo)} 
                        alt="Current Centre Logo" 
                        className="h-16 w-auto object-contain rounded"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}

                  {/* Show preview of newly selected file */}
                  {centreForm.logo && typeof centreForm.logo === 'object' && (
                    <div className="mb-3 p-2 bg-slate-50 border border-slate-200 rounded-lg inline-block">
                      <p className="text-xs text-navy-700 mb-2">New Logo Preview:</p>
                      <img 
                        src={URL.createObjectURL(centreForm.logo)} 
                        alt="New Logo Preview" 
                        className="h-16 w-auto object-contain rounded"
                      />
                    </div>
                  )}

                  <input
                    type="file"
                    id="centre-logo"
                    accept="image/*"
                    onChange={(e) => setCentreForm({ ...centreForm, logo: e.target.files[0] })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-navy-700 hover:file:bg-slate-200"
                    disabled={loading}
                  />
                  {editingCentreId && (
                    <p className="text-xs text-gray-500 mt-1">Select a new file to overwrite the current logo.</p>
                  )}
                </div>

                <div>
                  <label htmlFor="centre-latitude" className="block text-sm font-medium text-gray-700 mb-2">
                    Latitude
                  </label>
                  <input
                    type="text"
                    id="centre-latitude"
                    value={centreForm.latitude}
                    onChange={(e) => setCentreForm({ ...centreForm, latitude: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition"
                    placeholder="e.g., 11.2588"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="centre-longitude" className="block text-sm font-medium text-gray-700 mb-2">
                    Longitude
                  </label>
                  <input
                    type="text"
                    id="centre-longitude"
                    value={centreForm.longitude}
                    onChange={(e) => setCentreForm({ ...centreForm, longitude: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition"
                    placeholder="e.g., 75.7804"
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label htmlFor="centre-place-id" className="block text-sm font-medium text-gray-700 mb-2">
                    Google Place ID (Optional)
                  </label>
                  <input
                    type="text"
                    id="centre-place-id"
                    value={centreForm.google_place_id}
                    onChange={(e) => setCentreForm({ ...centreForm, google_place_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition"
                    placeholder="Enter Google Place ID"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="centre-admin_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Admin
                  </label>
                  <select
                    id="centre-admin_id"
                    name="admin_id"
                    value={centreForm.admin_id || ""}
                    onChange={(e) => setCentreForm({ ...centreForm, admin_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition"
                    disabled={loading}
                  >
                    <option value="">-- Select an Admin (Optional) --</option>
                    {admins.map(admin => (
                      <option key={admin.id} value={admin.id}>
                        {admin.name} (ID: {admin.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingCentreId(null);
                    setCentreForm(EMPTY_CENTRE_FORM);
                  }}
                  className="mr-3 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-6 py-2.5 rounded-xl font-medium text-white shadow-md transition-all duration-300 
                    bg-navy-700 hover:bg-navy-800 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : editingCentreId ? "Update Centre" : "Create Centre"} 
                </button>
              </div>

              {/* Communication Account Assignment */}
              <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-2">
                <label htmlFor="communication_account_id" className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp Communication Mode
                </label>
                <select
                  id="communication_account_id"
                  name="communication_account_id"
                  value={centreForm.communication_account_id || ""}
                  onChange={(e) => setCentreForm({ ...centreForm, communication_account_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition"
                  disabled={loading}
                >
                  <option value="">No WhatsApp (System Only)</option>
                  {/* Map through available communication accounts fetched from the backend */}
                  {availableCommAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.phone_number})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  Select which WhatsApp number this centre will use to talk to customers.
                </p>
              </div>
            </form>
          </div>
        )}

        {/* Summary tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total centres", value: centres.length, icon: FiHome, tone: "bg-slate-100 text-navy-700" },
            { label: "With admin", value: centres.filter((c) => c.admin_name).length, icon: FiUserCheck, tone: "bg-emerald-50 text-emerald-600" },
            { label: "No admin", value: centres.filter((c) => !c.admin_name).length, icon: FiAlertCircle, tone: "bg-amber-50 text-amber-600" },
            { label: "WhatsApp connected", value: centres.filter((c) => c.communication_account_id).length, icon: FiMessageCircle, tone: "bg-slate-100 text-navy-700" },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{loading && centres.length === 0 ? "–" : value}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}>
                <Icon size={20} />
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search centres"
                placeholder="Search centres, admins, phone…"
                className="w-full pl-10 pr-9 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 outline-none"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <FiX size={16} />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[["all", "All"], ["no_admin", "No admin"], ["no_whatsapp", "No WhatsApp"]].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilterMode(id)}
                  aria-pressed={filterMode === id}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${
                    filterMode === id ? "bg-navy-700 text-white border-navy-700" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="flex bg-slate-100 rounded-xl p-1">
                {[["card", FiGrid, "Cards"], ["table", FiList, "Table"]].map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => changeView(mode)}
                    aria-pressed={viewMode === mode}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium ${
                      viewMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Icon size={15} /> <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {(searchTerm || filterMode !== "all") && (
            <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
              Showing {visibleCentres.length} of {centres.length}
              <button type="button" onClick={() => { setSearchTerm(""); setFilterMode("all"); }} className="text-navy-700 hover:text-navy-800 font-medium">Clear filters</button>
            </div>
          )}
        </div>

        {/* Centres */}
        {loading && centres.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-200" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                    <div className="h-3 bg-slate-200 rounded w-1/3" />
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  <div className="h-3 bg-slate-200 rounded" />
                  <div className="h-3 bg-slate-200 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : centres.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 text-center py-16">
            <div className="inline-block p-4 bg-slate-100 rounded-full text-navy-700">
              <FiHome size={36} />
            </div>
            <h3 className="mt-4 text-lg font-medium text-slate-800">No centres found</h3>
            <p className="mt-1 text-slate-500">Create your first centre to get started</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 bg-navy-700 hover:bg-navy-800 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
            >
              <FiPlus className="text-lg" />
              Add Centre
            </button>
          </div>
        ) : visibleCentres.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 text-center py-12 text-slate-500">No centres match your search.</div>
        ) : viewMode === "table" ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {["Centre", "Admin", "Contact", "Hours", "WhatsApp", "Created By"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {visibleCentres.map((centre) => (
                    <tr key={centre.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <CentreLogo centre={centre} size="w-10 h-10" />
                          <div>
                            <p className="font-medium text-slate-900">{centre.name}</p>
                            {centre.district && <p className="text-xs text-slate-500">{centre.district}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-slate-700">
                        {centre.admin_name || <span className="text-amber-600">Not assigned</span>}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-slate-600">{centre.phone || "—"}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-slate-600">{centre.working_hours || "—"}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap"><WaBadge on={!!centre.communication_account_id} /></td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-slate-600">{centre.created_by_name || centre.created_by}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <CentreActions centre={centre} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {visibleCentres.map((centre) => (
              <div key={centre.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <div className="p-5 flex-1">
                  <div className="flex items-start gap-3">
                    <CentreLogo centre={centre} size="w-11 h-11" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 truncate" title={centre.name}>{centre.name}</h3>
                      <p className="text-xs text-slate-500 truncate">
                        {[centre.district, centre.state].filter(Boolean).join(", ") || "Location not set"}
                      </p>
                    </div>
                    {centre.admin_name ? (
                      <WaBadge on={!!centre.communication_account_id} />
                    ) : (
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">No admin</span>
                    )}
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <p className="flex items-center gap-2.5 min-w-0">
                      <FiUser className="text-slate-400 shrink-0" size={14} />
                      <span className="truncate">{centre.admin_name || "Not assigned"}</span>
                    </p>
                    <p className="flex items-center gap-2.5 min-w-0">
                      <FiPhone className="text-slate-400 shrink-0" size={14} />
                      <span className="truncate">{centre.phone || "No phone"}</span>
                    </p>
                    <p className="flex items-center gap-2.5 min-w-0">
                      <FiClock className="text-slate-400 shrink-0" size={14} />
                      <span className="truncate">{centre.working_hours || "Hours not set"}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500 pl-2 truncate">
                    {centre.staff_count != null ? `${centre.staff_count} staff` : `By ${centre.created_by_name || centre.created_by || "—"}`}
                  </span>
                  <CentreActions centre={centre} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Centre Details Modal */}
      {showCentreDetails && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-xl transform transition-all">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-gray-800">{showCentreDetails.centre.name} Details</h2>
                <button
                  onClick={() => setShowCentreDetails(null)}
                  className="text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Centre Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Name</p>
                    <p className="text-gray-900">{showCentreDetails.centre.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Admin</p>
                    <p className="text-gray-900">{showCentreDetails.centre.admin_name || "Not assigned"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Created By</p>
                    <p className="text-gray-900">{showCentreDetails.centre.created_by_name || showCentreDetails.centre.created_by}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Staff Members</h3>
                {showCentreDetails.staff.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No staff assigned to this centre.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {showCentreDetails.staff.map((staff) => (
                      <div key={staff.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center mb-4">
                          {staff.photo ? (
                            <img
                              src={getImageUrl(staff.photo)}
                              alt={`${staff.name}'s photo`}
                              className="w-14 h-14 rounded-full object-cover mr-4"
                              onError={(e) => {
                                // Fallback if the image file is missing on the server
                                e.target.onerror = null; 
                                e.target.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(staff.name) + "&background=random";
                              }}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mr-4">
                              <svg className="h-7 w-7 text-navy-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          )}
                          <div>
                            <h4 className="text-md font-semibold text-gray-800">{staff.name}</h4>
                            <p className="text-sm text-gray-600">{staff.role}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <svg className="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
                            </svg>
                            <span>{staff.email}</span>
                          </div>
                          {staff.phone && (
                            <div className="flex items-center">
                              <svg className="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                              </svg>
                              <span>{staff.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center">
                            <svg className="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span className={`${staff.status === 'Active' ? 'text-green-600' : 'text-red-600'}`}>{staff.status}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {showAddAdminForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl transform transition-all">
            <AddAdminForm
              onAdd={handleAddAdmin}
              onClose={() => setShowAddAdminForm(null)}
              centreId={showAddAdminForm}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CentreManagement;