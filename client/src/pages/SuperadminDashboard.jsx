import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const SuperadminDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [centres, setCentres] = useState([]);
  const [stats, setStats] = useState({ centreCount: 0, staffCount: 0, adminCount: 0 });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const centresResponse = await axios.get("http://localhost:5000/api/centres", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        const staffResponse = await axios.get("http://localhost:5000/api/staff/all", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        setCentres(centresResponse.data);
        setStats({
          centreCount: centresResponse.data.length,
          adminCount: staffResponse.data.filter((s) => s.role === "admin").length,
          staffCount: staffResponse.data.filter((s) => s.role === "staff" || s.role === "supervisor").length
        });
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        toast.error("Failed to load dashboard data. Using mock data.", {
          position: "top-right",
          autoClose: 5000,
          theme: "light"
        });
        setCentres([{ id: 1, name: "Pukayur Centre", admin_id: 2, created_by: 1 }]);
        setStats({ centreCount: 1, adminCount: 5, staffCount: 10 });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Superadmin Dashboard</h1>

      {loading ? (
        <div className="flex items-center justify-center">
          <svg
            className="animate-spin h-8 w-8 text-navy-600 mr-2"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="text-gray-600">Loading...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <h2 className="text-xl font-semibold text-blue-800 mb-2">Total Centres</h2>
            <p className="text-2xl font-bold text-blue-900">{stats.centreCount}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-xl border border-green-100">
            <h2 className="text-xl font-semibold text-green-800 mb-2">Total Admins</h2>
            <p className="text-2xl font-bold text-green-900">{stats.adminCount}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">Total Staff</h2>
            <p className="text-2xl font-bold text-yellow-900">{stats.staffCount}</p>
          </div>

          <div className="col-span-1 md:col-span-3 bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Centres Overview</h2>
            {centres.length === 0 ? (
              <p className="text-gray-600">No centres available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Centre Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {centres.map((centre) => (
                      <tr key={centre.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{centre.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{centre.admin_id || "N/A"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{centre.created_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperadminDashboard;