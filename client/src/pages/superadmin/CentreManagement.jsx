import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import AddAdminForm from "../../components/AddAdminForm";
import { FiPlus } from "react-icons/fi";

const CentreManagement = () => {
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [centreForm, setCentreForm] = useState({ name: "", admin_id: "" });
  const [editingCentreId, setEditingCentreId] = useState(null);
  const [showAddAdminForm, setShowAddAdminForm] = useState(null);
  const [showCentreDetails, setShowCentreDetails] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchCentres();
  }, []);

  const fetchCentres = async () => {
    setLoading(true);
    try {
      const response = await axios.get("http://localhost:5000/api/centres", {
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

  const fetchCentreDetails = async (centreId) => {
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:5000/api/centres/${centreId}/staff`, {
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
      if (editingCentreId) {
        const response = await axios.put(`http://localhost:5000/api/centres/${editingCentreId}`, centreForm, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        toast.success(response.data.message || "Centre updated successfully", {
          position: "top-right",
          autoClose: 3000,
          theme: "light"
        });
      } else {
        const response = await axios.post("http://localhost:5000/api/centres", centreForm, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        toast.success(response.data.message || "Centre created successfully", {
          position: "top-right",
          autoClose: 3000,
          theme: "light"
        });
      }
      setCentreForm({ name: "", admin_id: "" });
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
    setCentreForm({ name: centre.name, admin_id: centre.admin_id || "" });
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
        const response = await axios.delete(`http://localhost:5000/api/centres/${id}`, {
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
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
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
                  setCentreForm({ name: "", admin_id: "" });
                }
              }}
              className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#172a45] text-white px-4 py-2.5 rounded-xl font-medium transition-all duration-300 shadow-md hover:shadow-lg"
            >
              <FiPlus className="text-lg" />
              {showForm ? "Hide Form" : "Add Centre"}
            </button>
          </div>
        </div>

        {/* Add/Edit Centre Card - Only shown when showForm is true */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-8 overflow-hidden">
            <div className="bg-[#1e3a5f] text-white p-4">
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Enter centre name"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="centre-admin_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Admin ID
                  </label>
                  <input
                    type="number"
                    id="centre-admin_id"
                    name="admin_id"
                    value={centreForm.admin_id}
                    onChange={(e) => setCentreForm({ ...centreForm, admin_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Enter admin ID"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingCentreId(null);
                    setCentreForm({ name: "", admin_id: "" });
                  }}
                  className="mr-3 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-6 py-2.5 rounded-xl font-medium text-white shadow-md transition-all duration-300 
                    bg-[#1e3a5f] hover:bg-[#172a45] ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
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
            </form>
          </div>
        )}

        {/* Centres List */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Centres List</h2>
              <div className="flex items-center">
                <div className="relative mr-4">
                  <input
                    type="text"
                    placeholder="Search centres..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
                <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1e3a5f]"></div>
              <span className="mt-3 text-gray-600 font-medium">Loading centres...</span>
            </div>
          ) : centres.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-block p-4 bg-blue-100 rounded-full">
                <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-700">No centres found</h3>
              <p className="mt-1 text-gray-500">Create your first centre using the form above</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 inline-flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#172a45] text-white px-4 py-2.5 rounded-xl font-medium transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <FiPlus className="text-lg" />
                Add Centre
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Centre Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {centres.map((centre) => (
                    <tr key={centre.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="bg-blue-100 rounded-lg p-2 mr-3">
                            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                            </svg>
                          </div>
                          <span className="font-medium text-gray-900">{centre.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {centre.admin_name || <span className="text-gray-400 italic">Not assigned</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {centre.created_by_name || centre.created_by}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end space-x-1">
                          <button
                            onClick={() => fetchCentreDetails(centre.id)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View centre details"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEditCentre(centre)}
                            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit centre"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteCentre(centre.id)}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete centre"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => setShowAddAdminForm(centre.id)}
                            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Add admin"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Centre Details Modal */}
      {showCentreDetails && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl transform transition-all">
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
                              src={staff.photo}
                              alt={`${staff.name}'s photo`}
                              className="w-14 h-14 rounded-full object-cover mr-4"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mr-4">
                              <svg className="h-7 w-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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