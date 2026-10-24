import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  FiArrowLeft, FiEdit2, FiLock, FiCalendar, FiPhone, FiMail, FiMapPin,
  FiTrash2, FiGift, FiClock, FiActivity, FiX,
} from "react-icons/fi";
import ChangePassword from "../../components/ChangePassword";

// ---------- helpers ----------
const API = import.meta.env.VITE_API_URL;

const getPhotoUrl = (photo) => {
  if (!photo || photo === "null" || photo === "undefined") return null;
  if (photo.startsWith("http") || photo.startsWith("data:image")) return photo;
  return `${API}${photo.startsWith("/") ? "" : "/"}${photo}`;
};

// Formats "YYYY-MM-DD" (or ISO) without timezone shifts
const formatDate = (value, opts = { day: "2-digit", month: "short", year: "numeric" }) => {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", opts);
};

const getAge = (dob) => {
  if (!dob) return null;
  const [y, m, d] = String(dob).slice(0, 10).split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 ? age : null;
};

const getTenure = (joinDate) => {
  if (!joinDate) return null;
  const [y, m] = String(joinDate).slice(0, 10).split("-").map(Number);
  const now = new Date();
  const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (months < 1) return "Joined this month";
  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  return [yrs && `${yrs} yr${yrs > 1 ? "s" : ""}`, mos && `${mos} mo${mos > 1 ? "s" : ""}`].filter(Boolean).join(" ");
};

const initials = (name = "") =>
  name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

const statusCls = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Leave": "bg-amber-50 text-amber-700 border-amber-200",
  Terminated: "bg-red-50 text-red-700 border-red-200",
};

const InfoRow = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3">
    <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
      <Icon size={16} />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <div className="text-sm font-medium text-gray-900 break-words">{children}</div>
    </div>
  </div>
);

const Detail = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
    <p className={`text-sm font-medium ${value ? "text-gray-900" : "text-gray-400"}`}>{value || "Not specified"}</p>
  </div>
);

const Card = ({ title, children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 ${className}`}>
    {title && <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{title}</h3>}
    {children}
  </div>
);

const StaffProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No authentication token found");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API}/api/staff/${id}`, { headers: authHeaders() });
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error(`Server returned unexpected format (${res.status})`);
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Server error: ${res.status}`);
        setStaff(data);
        setPhotoFailed(false);
      } catch (err) {
        console.error("Error fetching staff:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const goToStaffManagement = () => navigate("/dashboard/admin/staff");
  const goToEditStaff = () => navigate(`/dashboard/admin/staff/edit/${id}`);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await fetch(`${API}/api/staff/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete staff");
      }
      goToStaffManagement();
    } catch (err) {
      console.error("Delete error:", err);
      setError(err.message);
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-navy-700" />
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error loading profile</h2>
          <p className="text-gray-600 mb-4">{error || "Staff not found"}</p>
          <button onClick={goToStaffManagement} className="inline-flex items-center gap-2 text-navy-700 hover:text-navy-800 font-medium">
            <FiArrowLeft /> Back to Staff Management
          </button>
        </div>
      </div>
    );
  }

  const photoUrl = !photoFailed ? getPhotoUrl(staff.photo) : null;
  const dob = staff.dateOfBirth || staff.dob;
  const age = getAge(dob);
  const tenure = getTenure(staff.joinDate);
  const salary = staff.salary != null && staff.salary !== "" ? Number(staff.salary) : null;
  const reportsTo = staff.reportsToName || (staff.reportsTo ? `Staff #${staff.reportsTo}` : null);
  const createdAt = staff.created_at || staff.createdAt;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={goToStaffManagement} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100" title="Back">
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Profile</h1>
            <p className="text-sm text-gray-500">Details for {staff.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={goToEditStaff}
            className="inline-flex items-center gap-2 bg-navy-700 hover:bg-navy-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm"
          >
            <FiEdit2 size={15} /> Edit Profile
          </button>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="inline-flex items-center gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            <FiLock size={15} /> Change Password
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-2 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            <FiTrash2 size={15} /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: identity card */}
        <div className="space-y-5">
          <Card>
            <div className="flex flex-col items-center text-center">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={staff.name}
                  onError={() => setPhotoFailed(true)}
                  className="w-28 h-28 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center text-3xl font-semibold">
                  {initials(staff.name)}
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900 mt-4">{staff.name}</h2>
              <p className="text-sm text-gray-500">@{staff.username}</p>
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200 capitalize">
                  {staff.role}
                </span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusCls[staff.status] || statusCls.Active}`}>
                  {staff.status || "Active"}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100 space-y-4">
              <InfoRow icon={FiPhone} label="Phone">
                {staff.phone ? (
                  <a href={`tel:${staff.phone}`} className="text-blue-600 hover:underline">{staff.phone}</a>
                ) : (
                  <span className="text-gray-400">Not specified</span>
                )}
              </InfoRow>
              <InfoRow icon={FiMail} label="Email">
                <a href={`mailto:${staff.email}`} className="text-blue-600 hover:underline">{staff.email}</a>
              </InfoRow>
              <InfoRow icon={FiMapPin} label="Centre">
                {staff.centreName || <span className="text-gray-400">Not assigned</span>}
              </InfoRow>
              <InfoRow icon={FiCalendar} label="Joined">
                {formatDate(staff.joinDate) || <span className="text-gray-400">Not specified</span>}
                {tenure && <span className="block text-xs font-normal text-gray-500">{tenure}</span>}
              </InfoRow>
              <InfoRow icon={FiGift} label="Birthday">
                {dob ? (
                  <>
                    {formatDate(dob)}
                    {age !== null && <span className="block text-xs font-normal text-gray-500">{age} years old</span>}
                  </>
                ) : (
                  <span className="text-gray-400">Not specified</span>
                )}
              </InfoRow>
            </div>
          </Card>
        </div>

        {/* Right: details */}
        <div className="lg:col-span-2 space-y-5">
          <Card title="Employment">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Detail label="Employee ID" value={staff.employeeId} />
              <Detail label="Employment Type" value={staff.employmentType} />
              <Detail label="Department" value={staff.department} />
              <Detail label="Reports To" value={reportsTo} />
              <Detail
                label="Salary"
                value={salary !== null && !isNaN(salary) ? `₹${salary.toLocaleString("en-IN")} / month` : null}
              />
              <Detail label="Join Date" value={formatDate(staff.joinDate)} />
            </div>
          </Card>

          <Card title="Personal">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Detail label="Date of Birth" value={formatDate(dob)} />
              <Detail label="Gender" value={staff.gender} />
              <Detail label="Emergency Contact" value={staff.emergencyContact} />
              <Detail label="Relationship" value={staff.emergencyRelationship} />
            </div>
          </Card>

          <Card title="Account">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Detail label="Username" value={`@${staff.username}`} />
              <Detail label="Account Created" value={createdAt ? formatDate(createdAt) : null} />
            </div>
          </Card>

          <Card title="Recent Activity">
            {staff.recentActivity?.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {staff.recentActivity.map((a, i) => (
                  <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                      <FiActivity size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 capitalize">{String(a.action || "").replace(/_/g, " ")}</p>
                      {a.details && <p className="text-xs text-gray-500 truncate">{a.details}</p>}
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <FiClock size={11} /> {new Date(a.timestamp).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
            )}
          </Card>
        </div>
      </div>

      {/* Change password modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <ChangePassword username={staff.username} onClose={() => setShowPasswordModal(false)} />
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-gray-900">Delete staff member?</h3>
              <button onClick={() => setShowDeleteModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                <FiX size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              <span className="font-semibold text-gray-900">{staff.name}</span>'s profile will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                <FiTrash2 size={15} /> {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffProfile;