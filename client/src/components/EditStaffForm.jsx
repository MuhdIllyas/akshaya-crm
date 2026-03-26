import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FiX, FiUser, FiPlus } from "react-icons/fi";
import { useParams, useNavigate } from "react-router-dom";

const EditStaffForm = ({ staff, onUpdate, onClose }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    name: "",
    role: "",
    department: "",
    email: "",
    phone: "",
    status: "Active",
    joinDate: "",
    photo: null,
    employeeId: "",
    employmentType: "",
    reportsTo: "",
    salary: "",
    dob: "",
    gender: "",
    emergencyContact: "",
    emergencyRelationship: "",
    centre_id: "",
    start_time: "09:00", // New field
    end_time: "17:00",   // New field
    effective_from: new Date().toISOString().split("T")[0], // New field
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [centres, setCentres] = useState([]);
  const [reportsToOptions, setReportsToOptions] = useState([]);
  const fileInputRef = useRef(null);
  const userRole = localStorage.getItem("role");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // If staff prop is provided (from modal), use it; otherwise, fetch by ID
        let staffData;
        if (staff) {
          staffData = staff;
        } else {
          const response = await axios.get(`http://localhost:5000/api/staff/${id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          });
          staffData = response.data;
        }

        // Fetch current schedule
        const scheduleResponse = await axios.get(`http://localhost:5000/api/staff/schedule/${id || staff.id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          params: { date: new Date().toISOString().split("T")[0] },
        });
        const schedule = scheduleResponse.data;

        setFormData({
          ...staffData,
          joinDate: staffData.joinDate ? new Date(staffData.joinDate).toISOString().split("T")[0] : "",
          dob: staffData.dob ? new Date(staffData.dob).toISOString().split("T")[0] : "",
          centre_id: staffData.centre_id || "",
          start_time: schedule?.start_time || "09:00",
          end_time: schedule?.end_time || "17:00",
          effective_from: schedule?.effective_from || new Date().toISOString().split("T")[0],
        });
        setPhotoPreview(staffData.photo || null);

        // Fetch centres for dropdown
        const centresResponse = await axios.get("http://localhost:5000/api/centres", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setCentres(centresResponse.data);

        // Fetch reportsTo options
        const staffResponse = await axios.get("http://localhost:5000/api/staff/all", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setReportsToOptions(staffResponse.data.filter(s => s.role === "superadmin" || s.role === "admin"));

        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err.response?.data?.error || "Failed to load staff data");
        setLoading(false);
      }
    };
    fetchData();
  }, [id, staff]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Photo size must be less than 2MB", {
          position: "top-right",
          autoClose: 5000,
          theme: "light",
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
        setFormData(prev => ({ ...prev, photo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.name || !formData.email || !formData.role) {
      toast.error("Username, name, email, and role are required", {
        position: "top-right",
        autoClose: 5000,
        theme: "light",
      });
      return;
    }
    if (formData.role !== "superadmin" && (!formData.start_time || !formData.end_time || !formData.effective_from)) {
      toast.error("Start time, end time, and effective from date are required for non-superadmin roles", {
        position: "top-right",
        autoClose: 5000,
        theme: "light",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await axios.put(
        `http://localhost:5000/api/staff/${id || staff.id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );

      toast.success("Staff profile updated successfully", {
        position: "top-right",
        autoClose: 3000,
        theme: "light",
      });

      if (onUpdate) {
        onUpdate();
      } else {
        navigate(`/dashboard/admin/staff/${id}`);
      }
    } catch (err) {
      console.error("Error updating staff:", err);
      toast.error(err.response?.data?.error || "Failed to update staff", {
        position: "top-right",
        autoClose: 5000,
        theme: "light",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(`/dashboard/admin/staff/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-navy-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Staff</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate("/dashboard/admin/staff")}
            className="mt-4 inline-flex items-center text-navy-700 hover:text-navy-800 font-medium"
          >
            Back to Staff Management
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800">Edit Staff Profile</h2>
        <button
          onClick={handleClose}
          className="text-gray-600 hover:text-gray-800 transition-colors"
          aria-label="Close form"
        >
          <FiX size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Profile Photo Upload */}
        <div className="flex flex-col items-center mb-4">
          <div className="relative">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Profile preview"
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
              />
            ) : (
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-full w-24 h-24 flex items-center justify-center">
                <FiUser className="text-gray-400 text-3xl" />
              </div>
            )}
            <button
              type="button"
              onClick={triggerFileInput}
              className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-2 hover:bg-blue-700 transition-colors shadow-md"
            >
              <FiPlus className="text-white" />
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoChange}
            accept="image/*"
            className="hidden"
            disabled={loading}
          />
          <p className="mt-2 text-sm text-gray-500">Click the + to upload a new photo (max 2MB)</p>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition bg-gray-100 cursor-not-allowed"
              placeholder="Enter username"
            />
            <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
          </div>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter full name"
            />
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1.5">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              disabled={loading || userRole !== "superadmin"}
              className={`w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition ${
                userRole !== "superadmin" ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
            >
              <option value="superadmin">Superadmin</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </div>
          <div>
            <label htmlFor="centre_id" className="block text-sm font-medium text-gray-700 mb-1.5">
              Centre
            </label>
            <select
              id="centre_id"
              name="centre_id"
              value={formData.centre_id}
              onChange={handleChange}
              disabled={loading || userRole !== "superadmin"}
              className={`w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition ${
                userRole !== "superadmin" ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
            >
              <option value="">Select a centre</option>
              {centres.map((centre) => (
                <option key={centre.id} value={centre.id}>
                  {centre.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter email"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter phone number"
            />
          </div>
          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1.5">
              Department
            </label>
            <select
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
            >
              <option value="">Select Department</option>
              <option value="Accounts">Accounts</option>
              <option value="Reception">Reception</option>
              <option value="Front Office">Front Office</option>
              <option value="Aadhaar">Aadhaar</option>
              <option value="Staff Executive">Staff Executive</option>
              <option value="Customer Relations">Customer Relations</option>
            </select>
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1.5">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
            >
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Terminated">Terminated</option>
            </select>
          </div>
          <div>
            <label htmlFor="joinDate" className="block text-sm font-medium text-gray-700 mb-1.5">
              Join Date
            </label>
            <input
              type="date"
              id="joinDate"
              name="joinDate"
              value={formData.joinDate}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
            />
          </div>
          <div>
            <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 mb-1.5">
              Employee ID
            </label>
            <input
              type="text"
              id="employeeId"
              name="employeeId"
              value={formData.employeeId}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter employee ID"
            />
          </div>
          <div>
            <label htmlFor="employmentType" className="block text-sm font-medium text-gray-700 mb-1.5">
              Employment Type
            </label>
            <select
              id="employmentType"
              name="employmentType"
              value={formData.employmentType}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
            >
              <option value="">Select Employment Type</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Freelance">Freelance</option>
            </select>
          </div>
          <div>
            <label htmlFor="reportsTo" className="block text-sm font-medium text-gray-700 mb-1.5">
              Reports To
            </label>
            <select
              id="reportsTo"
              name="reportsTo"
              value={formData.reportsTo}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
            >
              <option value="">Select a supervisor</option>
              {reportsToOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({option.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="salary" className="block text-sm font-medium text-gray-700 mb-1.5">
              Salary (₹)
            </label>
            <input
              type="number"
              id="salary"
              name="salary"
              value={formData.salary}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter salary"
            />
          </div>
          <div>
            <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-1.5">
              Date of Birth
            </label>
            <input
              type="date"
              id="dob"
              name="dob"
              value={formData.dob}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
            />
          </div>
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1.5">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700 mb-1.5">
              Emergency Contact
            </label>
            <input
              type="tel"
              id="emergencyContact"
              name="emergencyContact"
              value={formData.emergencyContact}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter emergency contact"
            />
          </div>
          <div>
            <label htmlFor="emergencyRelationship" className="block text-sm font-medium text-gray-700 mb-1.5">
              Emergency Relationship
            </label>
            <input
              type="text"
              id="emergencyRelationship"
              name="emergencyRelationship"
              value={formData.emergencyRelationship}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter emergency relationship"
            />
          </div>
        </div>

        {/* Schedule Fields */}
        {formData.role !== "superadmin" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1.5">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                id="start_time"
                name="start_time"
                value={formData.start_time}
                onChange={handleChange}
                required
                disabled={loading}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-1.5">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                id="end_time"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
                required
                disabled={loading}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label htmlFor="effective_from" className="block text-sm font-medium text-gray-700 mb-1.5">
                Effective From <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="effective_from"
                name="effective_from"
                value={formData.effective_from}
                onChange={handleChange}
                required
                disabled={loading}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 space-x-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className={`px-6 py-2.5 rounded-xl font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-all ${
              loading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-2.5 rounded-xl font-medium text-white bg-green-600 hover:bg-green-700 shadow-sm transition-all ${
              loading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {loading ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </span>
            ) : (
              "Update Staff Profile"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditStaffForm;