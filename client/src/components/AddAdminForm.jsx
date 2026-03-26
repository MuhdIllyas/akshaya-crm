import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const AddAdminForm = ({ onAdd, onClose, centreId }) => {
  const [formData, setFormData] = useState({
    username: "",
    name: "",
    email: "",
    phone: "",
    department: "",
    status: "Active",
    joinDate: new Date().toISOString().split("T")[0],
    photo: null,
    employeeId: "",
    employmentType: "",
    reportsTo: "",
    salary: "",
    dateOfBirth: "",
    gender: "",
    emergencyContact: "",
    emergencyRelationship: ""
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportsToOptions, setReportsToOptions] = useState([]);

  useEffect(() => {
    const fetchReportsToOptions = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/staff/all", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        setReportsToOptions(response.data.filter(staff => staff.role === "superadmin" || staff.role === "admin"));
      } catch (err) {
        console.error("Error fetching reportsTo options:", err);
        toast.error("Failed to load reportsTo options", {
          position: "top-right",
          autoClose: 5000,
          theme: "light"
        });
      }
    };
    fetchReportsToOptions();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Photo size must be less than 2MB", {
          position: "top-right",
          autoClose: 5000,
          theme: "light"
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photo: reader.result });
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.name || !formData.email) {
      toast.error("Username, name, and email are required", {
        position: "top-right",
        autoClose: 5000,
        theme: "light"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:5000/api/staff/add",
        {
          ...formData,
          role: "admin",
          centre_id: centreId
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json"
          }
        }
      );
      toast.success(
        <div>
          <p>Admin created successfully!</p>
          <p>Username: {formData.username}</p>
          <p>Password: {response.data.password}</p>
          <p className="text-sm text-gray-600 mt-2">Please save this password, as it will not be shown again.</p>
        </div>,
        {
          position: "top-right",
          autoClose: 10000, // Longer duration to allow user to read password
          theme: "light"
        }
      );
      onAdd();
    } catch (err) {
      console.error("Error creating admin:", err);
      toast.error(err.response?.data?.error || "Failed to create admin", {
        position: "top-right",
        autoClose: 5000,
        theme: "light"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-800">Add New Admin</h2>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-800 transition-colors"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="admin-username" className="block text-sm font-medium text-gray-700 mb-1.5">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="admin-username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter username"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="admin-name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="admin-name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter full name"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="admin-email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter email"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="admin-phone" className="block text-sm font-medium text-gray-700 mb-1.5">
              Phone
            </label>
            <input
              type="text"
              id="admin-phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter phone number"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="admin-department" className="block text-sm font-medium text-gray-700 mb-1.5">
              Department
            </label>
            <input
              type="text"
              id="admin-department"
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter department"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="admin-status" className="block text-sm font-medium text-gray-700 mb-1.5">
              Status
            </label>
            <select
              id="admin-status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              disabled={loading}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label htmlFor="admin-joinDate" className="block text-sm font-medium text-gray-700 mb-1.5">
              Join Date
            </label>
            <input
              type="date"
              id="admin-joinDate"
              name="joinDate"
              value={formData.joinDate}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="admin-photo" className="block text-sm font-medium text-gray-700 mb-1.5">
              Photo
            </label>
            <input
              type="file"
              id="admin-photo"
              accept="image/*"
              onChange={handlePhotoChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              disabled={loading}
            />
            {photoPreview && (
              <img src={photoPreview} alt="Photo preview" className="mt-2 w-24 h-24 rounded-full object-cover" />
            )}
          </div>
          <div>
            <label htmlFor="admin-employeeId" className="block text-sm font-medium text-gray-700 mb-1.5">
              Employee ID
            </label>
            <input
              type="text"
              id="admin-employeeId"
              name="employeeId"
              value={formData.employeeId}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter employee ID"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="admin-employmentType" className="block text-sm font-medium text-gray-700 mb-1.5">
              Employment Type
            </label>
            <input
              type="text"
              id="admin-employmentType"
              name="employmentType"
              value={formData.employmentType}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter employment type"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="admin-reportsTo" className="block text-sm font-medium text-gray-700 mb-1.5">
              Reports To
            </label>
            <select
              id="admin-reportsTo"
              name="reportsTo"
              value={formData.reportsTo}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              disabled={loading}
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
            <label htmlFor="admin-salary" className="block text-sm font-medium text-gray-700 mb-1.5">
              Salary
            </label>
            <input
              type="number"
              id="admin-salary"
              name="salary"
              value={formData.salary}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter salary"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="admin-dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1.5">
              Date of Birth
            </label>
            <input
              type="date"
              id="admin-dateOfBirth"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="admin-gender" className="block text-sm font-medium text-gray-700 mb-1.5">
              Gender
            </label>
            <select
              id="admin-gender"
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              disabled={loading}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="admin-emergencyContact" className="block text-sm font-medium text-gray-700 mb-1.5">
              Emergency Contact
            </label>
            <input
              type="text"
              id="admin-emergencyContact"
              name="emergencyContact"
              value={formData.emergencyContact}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter emergency contact"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="admin-emergencyRelationship" className="block text-sm font-medium text-gray-700 mb-1.5">
              Emergency Relationship
            </label>
            <input
              type="text"
              id="admin-emergencyRelationship"
              name="emergencyRelationship"
              value={formData.emergencyRelationship}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
              placeholder="Enter emergency relationship"
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className={`px-6 py-2.5 rounded-xl font-medium text-white bg-green-600 hover:bg-green-700 shadow-sm transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
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
            ) : (
              "Add Admin"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddAdminForm;