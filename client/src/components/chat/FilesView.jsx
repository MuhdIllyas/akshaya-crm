import React, { useState, useEffect } from "react";
import {
  FiUpload,
  FiDownload,
  FiTrash2,
  FiPlus,
  FiGlobe,
  FiHome,
  FiClock,
  FiX,
  FiFile,
  FiFolder,
  FiSearch,
  FiFilter,
  FiChevronDown,
  FiEye,
  FiAlertCircle,
  FiCheckCircle,
  FiBriefcase
} from "react-icons/fi";

const API_BASE_URL = import.meta.env.VITE_API_URL;
    if (!API_BASE_URL) {
      throw new Error("VITE_API_URL is not defined");
}

const categories = [
  { id: "govt_orders", label: "Government Orders", icon: "📜", color: "bg-purple-100 text-purple-700" },
  { id: "circulars", label: "Circulars", icon: "🔄", color: "bg-blue-100 text-blue-700" },
  { id: "application_forms", label: "Application Forms", icon: "📋", color: "bg-green-100 text-green-700" },
  { id: "affidavits", label: "Affidavits", icon: "📑", color: "bg-red-100 text-red-700" },
  { id: "notifications", label: "Notifications", icon: "🔔", color: "bg-yellow-100 text-yellow-700" },
  { id: "manuals", label: "Manuals", icon: "📘", color: "bg-indigo-100 text-indigo-700" },
  { id: "general_files", label: "General Files", icon: "📁", color: "bg-gray-100 text-gray-700" }
];

const FilesView = ({ user }) => {
  const token = localStorage.getItem("token");

  const [files, setFiles] = useState([]);
  const [services, setServices] = useState([]);
  const [servicesMap, setServicesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [downloadLoading, setDownloadLoading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState(1);
  const [newFileData, setNewFileData] = useState({
    name: "",
    category: "",
    is_global: false,
    centre_id: "",
    description: "",
    related_service_id: ""
  });

  const [uploadProgress, setUploadProgress] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("newest");

  /* ================================
     FETCH SERVICES
  ================================= */

  const fetchServices = async () => {
    setServicesLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/servicemanagement/services`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      setServices(data);
      
      // Create a map for quick service name lookup by ID
      const map = {};
      data.forEach(service => {
        map[service.id] = service.name;
      });
      setServicesMap(map);
      
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setServicesLoading(false);
    }
  };

  // Fetch services on component mount
  useEffect(() => {
    fetchServices();
  }, []);

  /* ================================
     FETCH FILES
  ================================= */

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      setFiles(data);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  /* ================================
     FETCH VERSION HISTORY
  ================================= */

  const fetchVersions = async (fileId) => {
    setVersionsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/files/${fileId}/versions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      setVersions(data);
    } catch (error) {
      console.error("Error fetching versions:", error);
    } finally {
      setVersionsLoading(false);
    }
  };

  /* ================================
     DOWNLOAD VERSION
  ================================= */

  const downloadVersion = async (versionId, fileName) => {
    setDownloadLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/files/version/${versionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Unauthorized - Please login again");
        } else if (res.status === 403) {
          throw new Error("Access denied - You don't have permission to download this file");
        } else {
          const errorData = await res.json();
          throw new Error(errorData.error || `Download failed with status ${res.status}`);
        }
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = fileName || 'download';
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, '');
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
      
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download file: " + error.message);
    } finally {
      setDownloadLoading(false);
    }
  };

  /* ================================
     UPLOAD NEW FILE
  ================================= */

  const handleNewUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate required fields
    if (!newFileData.name || !newFileData.category) {
      setUploadError("Please fill in all required fields");
      return;
    }

    // For non-admin users, validate centre_id for local files
    if (!newFileData.is_global && user?.role !== "admin" && !newFileData.centre_id) {
      setUploadError("Centre ID is required for local files");
      return;
    }

    setUploadError("");
    setUploadSuccess("");
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", newFileData.name);
    formData.append("category", newFileData.category);
    formData.append("is_global", newFileData.is_global ? "true" : "false");
    
    // Handle centre_id
    if (!newFileData.is_global) {
      if (newFileData.centre_id && newFileData.centre_id.trim() !== "") {
        formData.append("centre_id", newFileData.centre_id);
      } else if (user?.role === "admin") {
        formData.append("centre_id", "");
      } else {
        setUploadError("Centre ID is required for local files");
        clearInterval(interval);
        return;
      }
    } else {
      formData.append("centre_id", "");
    }
    
    // Add optional fields
    if (newFileData.description && newFileData.description.trim() !== "") {
      formData.append("description", newFileData.description);
    }
    
    if (newFileData.related_service_id && newFileData.related_service_id.trim() !== "") {
      formData.append("related_service_id", newFileData.related_service_id);
    }

    try {
      console.log("Uploading file with data:", {
        name: newFileData.name,
        category: newFileData.category,
        is_global: newFileData.is_global,
        centre_id: newFileData.centre_id,
        description: newFileData.description,
        related_service_id: newFileData.related_service_id
      });

      const res = await fetch(`${API_BASE_URL}/files/upload`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(interval);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Upload failed with status ${res.status}`);
      }

      const responseData = await res.json();
      console.log("Upload successful:", responseData);

      setUploadProgress(100);
      setUploadSuccess("File uploaded successfully!");
      
      // Refresh services to ensure we have the latest
      await fetchServices();
      
      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadProgress(0);
        setUploadStep(1);
        setUploadSuccess("");
        setNewFileData({
          name: "",
          category: "",
          is_global: false,
          centre_id: "",
          description: "",
          related_service_id: ""
        });
        fetchFiles();
      }, 1500);
      
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(error.message);
      clearInterval(interval);
      setUploadProgress(0);
    }
  };

  /* ================================
     UPLOAD NEW VERSION
  ================================= */

  const handleVersionUpload = async (e, fileId) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("file_id", fileId);

    try {
      const res = await fetch(`${API_BASE_URL}/files/upload`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Version upload failed");
      }

      await fetchFiles();
      await fetchVersions(fileId);
      
    } catch (error) {
      console.error("Version upload error:", error);
      alert(error.message);
    }
  };

  /* ================================
     DELETE FILE
  ================================= */

  const deleteFile = async (fileId) => {
    if (!window.confirm("Are you sure you want to delete this file permanently?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/files/${fileId}`, {
        method: "DELETE",
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Delete failed");
      }

      setSelectedFile(null);
      fetchFiles();
    } catch (error) {
      console.error("Delete error:", error);
      alert(error.message);
    }
  };

  /* ================================
     FILTERING & SORTING
  ================================= */

  const filteredFiles = files
    .filter(file => {
      const matchesSearch = file.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           file.category?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === "all" || file.category === selectedCategory;
      
      const matchesType = filterType === "all" ||
                         (filterType === "global" && file.is_global) ||
                         (filterType === "local" && !file.is_global);
      
      return matchesSearch && matchesCategory && matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        case "oldest":
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        default:
          return 0;
      }
    });

  const getCategoryDetails = (categoryId) => {
    return categories.find(c => c.id === categoryId) || categories[5];
  };

  // Get service name by ID using the map
  const getServiceName = (serviceId) => {
    if (!serviceId) return null;
    return servicesMap[serviceId] || null;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* MAIN CONTENT */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${selectedFile ? 'mr-96' : ''}`}>
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">File Repository</h1>
              <p className="text-sm text-gray-500 mt-1">Manage and organize your documents</p>
            </div>
            
            <button
              onClick={() => setIsUploadOpen(true)}
              className="px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition flex items-center gap-2 shadow-sm"
            >
              <FiPlus size={18} />
              <span>Upload File</span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search files by name or category..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
                showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              <FiFilter size={18} />
              <span>Filters</span>
              <FiChevronDown size={16} className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">File Type</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="all">All Files</option>
                    <option value="global">Global Files</option>
                    <option value="local">Local Files</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="name">Name (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* File Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FiFolder size={48} className="mb-4 text-gray-300" />
              <p className="text-lg">No files found</p>
              <p className="text-sm">Try adjusting your filters or upload a new file</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFiles.map(file => {
                const category = getCategoryDetails(file.category);
                const serviceName = getServiceName(file.related_service_id);
                return (
                  <div
                    key={file.id}
                    className={`group bg-white rounded-xl border hover:shadow-lg transition-all cursor-pointer transform hover:-translate-y-1 ${
                      selectedFile?.id === file.id ? 'ring-2 ring-blue-500 border-blue-500' : ''
                    }`}
                    onClick={() => {
                      setSelectedFile(file);
                      fetchVersions(file.id);
                    }}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 ${category.color} rounded-lg flex items-center justify-center text-xl`}>
                          {category.icon}
                        </div>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded-full font-medium">
                          v{file.version_number || 1}
                        </span>
                      </div>
                      
                      <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2">{file.name}</h3>
                      
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded-full ${category.color}`}>
                          {category.label}
                        </span>
                        {serviceName && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full flex items-center gap-1">
                            <FiBriefcase size={10} />
                            {serviceName}
                          </span>
                        )}
                        {file.related_service_id && !serviceName && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full flex items-center gap-1">
                            <FiBriefcase size={10} />
                            Loading...
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <FiClock size={12} />
                          {file.created_at ? new Date(file.created_at).toLocaleDateString() : 'N/A'}
                        </div>
                        
                        {file.is_global ? (
                          <span className="flex items-center gap-1 text-purple-600 font-medium">
                            <FiGlobe size={12} /> Global
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-blue-600">
                            <FiHome size={12} /> Centre {file.centre_id || 'Not Assigned'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* VERSION DRAWER */}
      {selectedFile && (
        <div className="fixed right-0 top-0 w-96 h-full bg-white border-l shadow-xl overflow-y-auto animate-slideIn z-40">
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Version History</h2>
            <button 
              onClick={() => setSelectedFile(null)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiX size={18} className="text-gray-500" />
            </button>
          </div>
          
          <div className="p-4">
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-1">Current File</h3>
              <p className="text-sm text-blue-600 line-clamp-2">{selectedFile.name}</p>
              
              {/* Access Type Badge */}
              <div className="mt-2 flex items-center gap-2 text-xs">
                {selectedFile.is_global ? (
                  <span className="flex items-center gap-1 text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                    <FiGlobe size={12} /> Global Access
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                    <FiHome size={12} /> Centre {selectedFile.centre_id || 'Not Assigned'}
                  </span>
                )}
              </div>
              
              {/* Service Badge */}
              {selectedFile.related_service_id && (
                <p className="text-xs text-blue-500 mt-2 flex items-center gap-1">
                  <FiBriefcase size={12} />
                  Service: {getServiceName(selectedFile.related_service_id) || 'Loading...'}
                </p>
              )}
            </div>
            
            {versionsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No version history available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((v, index) => (
                  <div key={v.id} className="relative">
                    {index !== versions.length - 1 && (
                      <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200"></div>
                    )}
                    <div className="bg-white border rounded-lg p-3 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">
                          {v.version_number}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">Version {v.version_number}</span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <FiClock size={12} />
                              {v.created_at ? new Date(v.created_at).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mb-2">
                            Size: {v.file_size ? (v.file_size / 1024).toFixed(2) : 0} KB
                          </div>
                          <div className="text-xs text-gray-600 mb-3">
                            Uploaded by: {v.uploaded_by_name || 'Unknown'}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => downloadVersion(v.id, selectedFile.name)}
                              disabled={downloadLoading}
                              className="flex-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {downloadLoading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                              ) : (
                                <FiDownload size={14} />
                              )}
                              Download
                            </button>
                            
                            <label className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1 text-sm cursor-pointer">
                              <FiUpload size={14} />
                              Update
                              <input
                                type="file"
                                hidden
                                onChange={(e) => handleVersionUpload(e, selectedFile.id)}
                              />
                            </label>
                            
                            {(user?.role === "superadmin" || user?.role === "admin") && index === 0 && (
                              <button
                                onClick={() => deleteFile(selectedFile.id)}
                                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Upload New File</h2>
              <button
                onClick={() => {
                  setIsUploadOpen(false);
                  setUploadError("");
                  setUploadSuccess("");
                  setUploadStep(1);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FiX size={20} className="text-gray-500" />
              </button>
            </div>
            
            {/* Error Message */}
            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <FiAlertCircle size={18} />
                <span className="text-sm">{uploadError}</span>
              </div>
            )}
            
            {/* Success Message */}
            {uploadSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                <FiCheckCircle size={18} />
                <span className="text-sm">{uploadSuccess}</span>
              </div>
            )}
            
            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-6">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    uploadStep >= step ? 'bg-navy-700 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-12 h-1 ${
                      uploadStep > step ? 'bg-navy-700' : 'bg-gray-200'
                    }`}></div>
                  )}
                </div>
              ))}
            </div>
            
            {uploadProgress > 0 && uploadProgress < 100 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Uploading...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-navy-700 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {uploadStep === 1 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        File Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter file name"
                        className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newFileData.name}
                        onChange={(e) =>
                          setNewFileData({ ...newFileData, name: e.target.value })
                        }
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description (optional)
                      </label>
                      <textarea
                        placeholder="Enter file description"
                        className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows="3"
                        value={newFileData.description}
                        onChange={(e) =>
                          setNewFileData({ ...newFileData, description: e.target.value })
                        }
                      />
                    </div>
                    
                    <button
                      onClick={() => setUploadStep(2)}
                      disabled={!newFileData.name}
                      className="w-full bg-navy-700 text-white py-2 rounded-lg hover:bg-navy-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </>
                )}
                
                {uploadStep === 2 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={(e) =>
                          setNewFileData({ ...newFileData, category: e.target.value })
                        }
                        value={newFileData.category}
                      >
                        <option value="">Select Category</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.label} {cat.icon}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {user?.role === "superadmin" && (
                      <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600"
                          checked={newFileData.is_global}
                          onChange={(e) =>
                            setNewFileData({
                              ...newFileData,
                              is_global: e.target.checked,
                              centre_id: e.target.checked ? "" : newFileData.centre_id
                            })
                          }
                        />
                        <span className="text-sm text-gray-700">Make this file globally accessible</span>
                      </label>
                    )}
                    
                    {/* Show centre_id input only for non-global files and non-admin users */}
                    {!newFileData.is_global && user?.role !== "admin" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Centre ID {user?.role !== "superadmin" && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Enter Centre ID"
                          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={newFileData.centre_id}
                          onChange={(e) =>
                            setNewFileData({
                              ...newFileData,
                              centre_id: e.target.value
                            })
                          }
                        />
                      </div>
                    )}
                    
                    {/* For admin users, show their centre_id as read-only */}
                    {!newFileData.is_global && user?.role === "admin" && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">
                          <span className="font-medium">Centre ID:</span> {user.centre_id} (auto-assigned)
                        </p>
                      </div>
                    )}
                    
                    {/* Show message for global files */}
                    {newFileData.is_global && (
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <p className="text-sm text-purple-700 flex items-center gap-2">
                          <FiGlobe size={14} />
                          This file will be accessible globally
                        </p>
                      </div>
                    )}
                    
                    {/* Related Service Dropdown */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Related Service (optional)
                      </label>
                      <div className="relative">
                        <select
                          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                          value={newFileData.related_service_id}
                          onChange={(e) =>
                            setNewFileData({
                              ...newFileData,
                              related_service_id: e.target.value
                            })
                          }
                        >
                          <option value="">Select a service</option>
                          {servicesLoading ? (
                            <option disabled>Loading services...</option>
                          ) : (
                            services.map(service => (
                              <option key={service.id} value={service.id}>
                                {service.name} {service.status === 'inactive' ? '(Inactive)' : ''}
                              </option>
                            ))
                          )}
                        </select>
                        <FiBriefcase className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                      </div>
                      {services.length === 0 && !servicesLoading && (
                        <p className="text-xs text-amber-600 mt-1">
                          No services found. Please add services first.
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => setUploadStep(1)}
                        className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setUploadStep(3)}
                        disabled={
                          !newFileData.category || 
                          (!newFileData.is_global && !newFileData.centre_id && user?.role !== "admin")
                        }
                        className="flex-1 bg-navy-700 text-white py-2 rounded-lg hover:bg-navy-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </>
                )}
                
                {uploadStep === 3 && (
                  <>
                    <div className="relative border-2 border-dashed rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                      <FiUpload size={32} className="mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600 mb-2">Click to browse or drag and drop</p>
                      <p className="text-xs text-gray-400">PDF, DOC, XLS, Images (Max 10MB)</p>
                      <input
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleNewUpload}
                      />
                    </div>
                    
                    {/* Summary of selections */}
                    <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                      <p><span className="font-medium">File Name:</span> {newFileData.name}</p>
                      <p><span className="font-medium">Category:</span> {categories.find(c => c.id === newFileData.category)?.label || 'Not selected'}</p>
                      {newFileData.related_service_id && (
                        <p><span className="font-medium">Service:</span> {services.find(s => s.id === parseInt(newFileData.related_service_id))?.name}</p>
                      )}
                      <p><span className="font-medium">Access:</span> {newFileData.is_global ? 'Global' : `Centre ${newFileData.centre_id || user?.centre_id}`}</p>
                    </div>
                    
                    <button
                      onClick={() => setUploadStep(2)}
                      className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Back
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default FilesView;