import { useState, useRef, useEffect } from "react";
import { FiX, FiUser, FiPlus } from "react-icons/fi";
import axios from "axios";
import { toast } from "react-toastify";

const AddStaffForm = ({ onAdd, onClose, centres }) => {
  const [formData, setFormData] = useState({
    username: "",
    name: "",
    role: "",
    department: "",
    email: "",
    phone: "",
    status: "Active",
    joinDate: new Date().toISOString().split("T")[0],
    photo: null,
    employeeId: "",
    employmentType: "Full-time",
    reportsTo: "",
    salary: "",
    dateOfBirth: "",
    gender: "Male",
    emergencyContact: "",
    emergencyRelationship: "",
    centre_id: "",
    password: "",
    start_time: "09:00", // New field
    end_time: "17:00",   // New field
    effective_from: new Date().toISOString().split("T")[0], // New field
  });
  const [supervisors, setSupervisors] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch supervisors for reportsTo dropdown
  useEffect(() => {
    const fetchSupervisors = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/staff/all`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          params: { role: "admin,superadmin,supervisor" },
        });
        setSupervisors(response.data);
      } catch (err) {
        console.error("Error fetching supervisors:", err);
        toast.error("Failed to load supervisors", {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: "light",
          toastId: "fetch-supervisors-error",
        });
      }
    };
    fetchSupervisors();
  }, []);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username.trim()) newErrors.username = "Username is required";
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Invalid email format";
    if (!formData.password.trim()) newErrors.password = "Password is required";
    else if (formData.password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (!formData.role) newErrors.role = "Role is required";
    if (!formData.centre_id && formData.role !== "superadmin") newErrors.centre_id = "Centre is required";
    if (!formData.status) newErrors.status = "Status is required";
    if (!formData.employeeId.trim()) newErrors.employeeId = "Employee ID is required";
    if (formData.role !== "superadmin") {
      if (!formData.start_time) newErrors.start_time = "Start time is required";
      if (!formData.end_time) newErrors.end_time = "End time is required";
      if (!formData.effective_from) newErrors.effective_from = "Effective from date is required";
    }
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
        setFormData((prev) => ({ ...prev, photo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      console.log("Sending staff creation request:", formData);
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/staff/add`, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });
      console.log("Staff creation response:", response.data);

      toast.success(`Staff added! Temporary password: ${response.data.password}`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "light",
        toastId: "add-staff-success",
      });

      setFormData({
        username: "",
        name: "",
        role: "",
        department: "",
        email: "",
        phone: "",
        status: "Active",
        joinDate: new Date().toISOString().split("T")[0],
        photo: null,
        employeeId: "",
        employmentType: "Full-time",
        reportsTo: "",
        salary: "",
        dateOfBirth: "",
        gender: "Male",
        emergencyContact: "",
        emergencyRelationship: "",
        centre_id: "",
        password: "",
        start_time: "09:00",
        end_time: "17:00",
        effective_from: new Date().toISOString().split("T")[0],
      });
      setPhotoPreview(null);
      setErrors({});
      if (onAdd) {
        onAdd(response.data.staff);
      }
      onClose();
    } catch (err) {
      console.error("Error creating staff:", err);
      const errorMessage =
        err.response?.status === 404
          ? "Staff creation endpoint not found (404). Check server routes."
          : err.response?.data?.error || "Failed to create staff";
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "light",
        toastId: "add-staff-error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800">Add New Staff Member</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close form"
        >
          <FiX size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
              className="absolute bottom-0 right-0 bg-navy-700 text-white rounded-full p-2 hover:bg-navy-800 transition-colors shadow-md"
              disabled={loading}
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
          <p className="mt-2 text-sm text-gray-500">Click the + to upload a photo</p>
        </div>

        {/* Employee ID and Username Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 mb-1">
              Employee ID
            </label>
            <input
              type="text"
              id="employeeId"
              name="employeeId"
              value={formData.employeeId}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent ${
                errors.employeeId ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="EMP-001"
              disabled={loading}
            />
            {errors.employeeId && <p className="mt-1 text-sm text-red-600">{errors.employeeId}</p>}
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent ${
                errors.username ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="johndoe123"
              disabled={loading}
            />
            {errors.username && <p className="mt-1 text-sm text-red-600">{errors.username}</p>}
          </div>
        </div>

        {/* Name and Password Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="John Doe"
              disabled={loading}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent ${
                errors.password ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Enter password"
              disabled={loading}
            />
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
          </div>
        </div>

        {/* Role and Centre Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent ${
                errors.role ? "border-red-500" : "border-gray-300"
              }`}
              disabled={loading}
            >
              <option value="">Select Role</option>
              <option value="superadmin">Superadmin</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="supervisor">Supervisor</option>
            </select>
            {errors.role && <p className="mt-1 text-sm text-red-600">{errors.role}</p>}
          </div>

          <div>
            <label htmlFor="centre_id" className="block text-sm font-medium text-gray-700 mb-1">
              Centre
            </label>
            <select
              id="centre_id"
              name="centre_id"
              value={formData.centre_id}
              onChange={handleChange}
              required={formData.role !== "superadmin"}
              className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent ${
                errors.centre_id ? "border-red-500" : "border-gray-300"
              }`}
              disabled={loading}
            >
              <option value="">Select Centre</option>
              {centres.map((centre) => (
                <option key={centre.id} value={centre.id}>
                  {centre.name}
                </option>
              ))}
            </select>
            {errors.centre_id && <p className="mt-1 text-sm text-red-600">{errors.centre_id}</p>}
          </div>
        </div>

        {/* Employment Type and Reports To Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="employmentType" className="block text-sm font-medium text-gray-700 mb-1">
              Employment Type
            </label>
            <select
              id="employmentType"
              name="employmentType"
              value={formData.employmentType}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Freelance">Freelance</option>
              <option value="Freelance">Probation</option>
            </select>
          </div>

          <div>
            <label htmlFor="reportsTo" className="block text-sm font-medium text-gray-700 mb-1">
              Reports To
            </label>
            <select
              id="reportsTo"
              name="reportsTo"
              value={formData.reportsTo}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">Select Supervisor</option>
              {supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.name} ({supervisor.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Department and Status Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <select
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              disabled={loading}
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
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent ${
                errors.status ? "border-red-500" : "border-gray-300"
              }`}
              disabled={loading}
            >
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Terminated">Terminated</option>
            </select>
            {errors.status && <p className="mt-1 text-sm text-red-600">{errors.status}</p>}
          </div>
        </div>

        {/* Salary and Date of Birth Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="salary" className="block text-sm font-medium text-gray-700 mb-1">
              Salary (₹)
            </label>
            <input
              type="number"
              id="salary"
              name="salary"
              value={formData.salary}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="Monthly salary"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
              Date of Birth
            </label>
            <input
              type="date"
              id="dateOfBirth"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
        </div>

        {/* Gender and Emergency Contact Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>

          <div>
            <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Contact
            </label>
            <input
              type="tel"
              id="emergencyContact"
              name="emergencyContact"
              value={formData.emergencyContact}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="Emergency phone number"
              disabled={loading}
            />
          </div>
        </div>

        {/* Emergency Relationship and Join Date Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="emergencyRelationship" className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Relationship
            </label>
            <input
              type="text"
              id="emergencyRelationship"
              name="emergencyRelationship"
              value={formData.emergencyRelationship}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="Relationship (e.g., Father, Spouse)"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="joinDate" className="block text-sm font-medium text-gray-700 mb-1">
              Join Date
            </label>
            <input
              type="date"
              id="joinDate"
              name="joinDate"
              value={formData.joinDate}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
        </div>

        {/* Email and Phone Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent ${
                errors.email ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="john.doe@company.com"
              disabled={loading}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="+91 98765 43210"
              disabled={loading}
            />
          </div>
        </div>

        {/* Schedule Fields */}
        {formData.role !== "superadmin" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                id="start_time"
                name="start_time"
                value={formData.start_time}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent ${
                  errors.start_time ? "border-red-500" : "border-gray-300"
                }`}
                disabled={loading}
              />
              {errors.start_time && <p className="mt-1 text-sm text-red-600">{errors.start_time}</p>}
            </div>
            <div>
              <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                id="end_time"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent ${
                  errors.end_time ? "border-red-500" : "border-gray-300"
                }`}
                disabled={loading}
              />
              {errors.end_time && <p className="mt-1 text-sm text-red-600">{errors.end_time}</p>}
            </div>
            <div>
              <label htmlFor="effective_from" className="block text-sm font-medium text-gray-700 mb-1">
                Effective From
              </label>
              <input
                type="date"
                id="effective_from"
                name="effective_from"
                value={formData.effective_from}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent ${
                  errors.effective_from ? "border-red-500" : "border-gray-300"
                }`}
                disabled={loading}
              />
              {errors.effective_from && <p className="mt-1 text-sm text-red-600">{errors.effective_from}</p>}
            </div>
          </div>
        )}

        <div className="pt-4 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2.5 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating...
              </span>
            ) : (
              "Add Staff Member"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddStaffForm;
