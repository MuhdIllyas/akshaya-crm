import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FiX, FiUser, FiCamera, FiArrowLeft } from "react-icons/fi";
import { useParams, useNavigate } from "react-router-dom";

// ---------- helpers ----------
const API = import.meta.env.VITE_API_URL;

const getPhotoUrl = (photo) => {
  if (!photo || photo === "null" || photo === "undefined") return null;
  if (photo.startsWith("http") || photo.startsWith("data:image")) return photo;
  return `${API}${photo.startsWith("/") ? "" : "/"}${photo}`;
};

// "2026-10-16" or "2026-10-16T00:00:00.000Z" -> "2026-10-16" (no timezone shift)
const toDateInput = (v) => (v ? String(v).slice(0, 10) : "");
const todayStr = () => new Date().toLocaleDateString("en-CA");

const inputCls =
  "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed";

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

const Section = ({ title, cols = "md:grid-cols-2", children }) => (
  <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{title}</h3>
    <div className={`grid grid-cols-1 ${cols} gap-4`}>{children}</div>
  </section>
);

const EditStaffForm = ({ staff, onUpdate, onClose }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const userRole = localStorage.getItem("role");
  const staffId = id || staff?.id;

  const [formData, setFormData] = useState({
    username: "",
    name: "",
    role: "",
    department: "",
    email: "",
    phone: "",
    status: "Active",
    joinDate: "",
    employeeId: "",
    employmentType: "",
    reportsTo: "",
    salary: "",
    dob: "",
    gender: "",
    emergencyContact: "",
    emergencyRelationship: "",
    centre_id: "",
    start_time: "09:00",
    end_time: "17:00",
    effective_from: todayStr(),
  });
  const [existingPhoto, setExistingPhoto] = useState(null); // stored path, e.g. /uploads/staff/x.jpg
  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [centreName, setCentreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [centres, setCentres] = useState([]);
  const [reportsToOptions, setReportsToOptions] = useState([]);
  const fileInputRef = useRef(null);

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No authentication token found. Please log in again.");
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!staffId) throw new Error("Staff ID is missing");

        const staffData = staff
          ? staff
          : (await axios.get(`${API}/api/staff/${staffId}`, { headers: authHeaders() })).data;

        // Current schedule
        let schedule = {};
        if (staffData.role !== "superadmin") {
          try {
            const res = await axios.get(`${API}/api/staff/schedule/${staffId}`, {
              headers: authHeaders(),
              params: { date: todayStr() },
            });
            schedule = res.data || {};
          } catch (err) {
            console.warn("Could not fetch schedule:", err);
          }
        }

        const centreId =
          userRole === "admin"
            ? localStorage.getItem("centre_id") || staffData.centreId || ""
            : staffData.centreId ?? staffData.centre_id ?? "";

        setFormData({
          username: staffData.username || "",
          name: staffData.name || "",
          role: staffData.role || "staff",
          department: staffData.department || "",
          email: staffData.email || "",
          phone: staffData.phone || "",
          status: staffData.status || "Active",
          joinDate: toDateInput(staffData.joinDate),
          employeeId: staffData.employeeId || "",
          employmentType: staffData.employmentType || "",
          reportsTo: staffData.reportsTo ?? "",
          salary: staffData.salary ?? "",
          dob: toDateInput(staffData.dateOfBirth || staffData.dob),
          gender: staffData.gender || "",
          emergencyContact: staffData.emergencyContact || "",
          emergencyRelationship: staffData.emergencyRelationship || "",
          centre_id: centreId ? String(centreId) : "",
          start_time: schedule.start_time ? String(schedule.start_time).slice(0, 5) : "09:00",
          end_time: schedule.end_time ? String(schedule.end_time).slice(0, 5) : "17:00",
          effective_from: toDateInput(schedule.effective_from) || todayStr(),
        });
        setCentreName(staffData.centreName || "");
        setExistingPhoto(staffData.photo || null);
        setPhotoPreview(getPhotoUrl(staffData.photo));

        if (userRole === "superadmin") {
          try {
            const res = await axios.get(`${API}/api/centres`, { headers: authHeaders() });
            setCentres(Array.isArray(res.data) ? res.data : []);
          } catch (err) {
            console.warn("Could not fetch centres:", err);
          }
        }

        try {
          const res = await axios.get(`${API}/api/staff/all`, { headers: authHeaders() });
          setReportsToOptions(
            (res.data || []).filter(
              (s) => (s.role === "superadmin" || s.role === "admin") && String(s.id) !== String(staffId)
            )
          );
        } catch (err) {
          console.warn("Could not fetch reports-to options:", err);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err.response?.data?.error || err.message || "Failed to load staff data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, staff, userRole]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo size must be less than 2MB");
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const undoPhoto = () => {
    setSelectedFile(null);
    setPhotoPreview(getPhotoUrl(existingPhoto));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const goBack = () => {
    if (onClose) onClose();
    else navigate(`/dashboard/admin/staff/${staffId}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!formData.name.trim() || !formData.email.trim() || !formData.role) {
      toast.error("Name, email and role are required");
      return;
    }
    if (formData.role !== "superadmin" && (!formData.start_time || !formData.end_time || !formData.effective_from)) {
      toast.error("Start time, end time and effective from date are required");
      return;
    }

    // Send as multipart so the photo file reaches the backend (upload.single('photo'))
    const payload = new FormData();
    const fields = {
      username: formData.username,
      name: formData.name.trim(),
      role: formData.role,
      department: formData.department,
      email: formData.email.trim(),
      phone: formData.phone,
      status: formData.status,
      joinDate: formData.joinDate,
      employeeId: formData.employeeId,
      employmentType: formData.employmentType,
      reportsTo: formData.reportsTo,
      salary: formData.salary,
      dateOfBirth: formData.dob, // backend field name
      gender: formData.gender,
      emergencyContact: formData.emergencyContact,
      emergencyRelationship: formData.emergencyRelationship,
      centre_id: userRole === "admin" ? localStorage.getItem("centre_id") || formData.centre_id : formData.centre_id,
      start_time: formData.start_time,
      end_time: formData.end_time,
      effective_from: formData.effective_from,
    };
    Object.entries(fields).forEach(([k, v]) => payload.append(k, v ?? ""));
    if (selectedFile) payload.append("photo", selectedFile);
    else if (existingPhoto) payload.append("photo", existingPhoto); // keep current photo

    try {
      setSaving(true);
      await axios.put(`${API}/api/staff/${staffId}`, payload, { headers: authHeaders() });
      toast.success("Staff profile updated");
      if (onUpdate) onUpdate();
      else navigate(`/dashboard/admin/staff/${staffId}`);
    } catch (err) {
      console.error("Error updating staff:", err);
      toast.error(err.response?.data?.error || "Failed to update staff");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-navy-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error loading staff</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={() => navigate("/dashboard/admin/staff")} className="text-navy-700 hover:text-navy-800 font-medium">
            Back to Staff Management
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={goBack} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100" title="Back">
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Staff</h1>
            <p className="text-sm text-gray-500">Update {formData.name || "staff member"}'s details</p>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <FiX size={20} />
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* Photo + identity */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative w-24 h-24 shrink-0">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Profile"
                onError={() => setPhotoPreview(null)}
                className="w-24 h-24 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                <FiUser className="text-gray-400" size={30} />
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 bg-navy-700 hover:bg-navy-800 text-white rounded-full p-2 shadow-md"
              title="Change photo"
            >
              <FiCamera size={14} />
            </button>
            <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/*" className="hidden" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-gray-900 truncate">{formData.name || "—"}</p>
            <p className="text-sm text-gray-500">@{formData.username}</p>
            <p className="text-xs text-gray-400 mt-1">JPG or PNG, up to 2MB</p>
            {selectedFile && (
              <button type="button" onClick={undoPhoto} className="text-sm text-red-600 hover:text-red-700 font-medium mt-1">
                Undo photo change
              </button>
            )}
          </div>
        </section>

        <Section title="Basic details">
          <Field label="Full Name" required>
            <input name="name" value={formData.name} onChange={handleChange} className={inputCls} />
          </Field>
          <Field label="Username" hint="Username cannot be changed">
            <input value={formData.username} disabled className={inputCls} />
          </Field>
          <Field label="Email" required>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputCls} />
          </Field>
          <Field label="Phone">
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={inputCls} />
          </Field>
          <Field label="Date of Birth" hint="Used for birthday wishes on the dashboard">
            <input type="date" name="dob" value={formData.dob} onChange={handleChange} max={todayStr()} className={inputCls} />
          </Field>
          <Field label="Gender">
            <select name="gender" value={formData.gender} onChange={handleChange} className={inputCls}>
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </Field>
        </Section>

        <Section title="Job details">
          <Field label="Role" required>
            <select name="role" value={formData.role} onChange={handleChange} disabled={userRole !== "superadmin"} className={inputCls}>
              <option value="staff">Staff</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </Field>
          <Field label="Centre">
            {userRole === "superadmin" ? (
              <select name="centre_id" value={formData.centre_id} onChange={handleChange} className={inputCls}>
                <option value="">Select a centre</option>
                {centres.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            ) : (
              <input value={centreName || "Your centre"} disabled className={inputCls} />
            )}
          </Field>
          <Field label="Department">
            <select name="department" value={formData.department} onChange={handleChange} className={inputCls}>
              <option value="">Select department</option>
              <option value="Accounts">Accounts</option>
              <option value="Reception">Reception</option>
              <option value="Front Office">Front Office</option>
              <option value="Aadhaar">Aadhaar</option>
              <option value="Staff Executive">Staff Executive</option>
              <option value="Customer Relations">Customer Relations</option>
            </select>
          </Field>
          <Field label="Reports To">
            <select name="reportsTo" value={String(formData.reportsTo ?? "")} onChange={handleChange} className={inputCls}>
              <option value="">No one</option>
              {reportsToOptions.map((o) => (
                <option key={o.id} value={String(o.id)}>{o.name} ({o.role})</option>
              ))}
            </select>
          </Field>
          <Field label="Employee ID">
            <input name="employeeId" value={formData.employeeId} onChange={handleChange} className={inputCls} />
          </Field>
          <Field label="Employment Type">
            <select name="employmentType" value={formData.employmentType} onChange={handleChange} className={inputCls}>
              <option value="">Select type</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Freelance">Freelance</option>
              <option value="Probation">Probation</option>
            </select>
          </Field>
          <Field label="Status">
            <select name="status" value={formData.status} onChange={handleChange} className={inputCls}>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Terminated">Terminated</option>
            </select>
          </Field>
          <Field label="Join Date">
            <input type="date" name="joinDate" value={formData.joinDate} onChange={handleChange} className={inputCls} />
          </Field>
          <Field label="Salary (₹)" hint="Changing salary creates a new salary structure from today">
            <input type="number" name="salary" value={formData.salary} onChange={handleChange} min="0" className={inputCls} />
          </Field>
        </Section>

        <Section title="Emergency contact">
          <Field label="Contact Number">
            <input type="tel" name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className={inputCls} />
          </Field>
          <Field label="Relationship">
            <input name="emergencyRelationship" value={formData.emergencyRelationship} onChange={handleChange} placeholder="e.g. Father, Spouse" className={inputCls} />
          </Field>
        </Section>

        {formData.role !== "superadmin" && (
          <Section title="Work schedule" cols="sm:grid-cols-3">
            <Field label="Start Time" required>
              <input type="time" name="start_time" value={formData.start_time} onChange={handleChange} className={inputCls} />
            </Field>
            <Field label="End Time" required>
              <input type="time" name="end_time" value={formData.end_time} onChange={handleChange} className={inputCls} />
            </Field>
            <Field label="Effective From" required>
              <input type="date" name="effective_from" value={formData.effective_from} onChange={handleChange} className={inputCls} />
            </Field>
          </Section>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 mt-6 -mx-4 md:-mx-6 px-4 md:px-6 py-4 bg-gray-50/95 border-t border-gray-200 flex justify-end gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-navy-700 hover:bg-navy-800 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
};

export default EditStaffForm;