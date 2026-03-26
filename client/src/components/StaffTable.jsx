import { FiUser } from "react-icons/fi";
import { Link } from "react-router-dom";

const StaffTable = ({ staffList }) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Staff Member
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Role
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Department
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Join Date
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {staffList.length > 0 ? (
            staffList.map((staff) => (
              <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {staff.photo ? (
                      <img 
                        src={staff.photo} 
                        alt={staff.name} 
                        className="w-10 h-10 rounded-xl object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl w-10 h-10 flex items-center justify-center">
                        <FiUser className="text-gray-400" />
                      </div>
                    )}
                    <div className="ml-4 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{staff.name}</div>
                      <div className="text-sm text-gray-500 truncate">@{staff.username}</div>
                      <div className="text-xs text-blue-600 mt-1 truncate">{staff.email}</div>
                      <div className="text-xs text-blue-600 truncate">{staff.phone}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate">
                  {staff.role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate">
                  {staff.department}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    staff.status === "Active" 
                      ? "bg-green-100 text-green-800" 
                      : staff.status === "On Leave" 
                        ? "bg-yellow-100 text-yellow-800" 
                        : "bg-red-100 text-red-800"
                  }`}>
                    {staff.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {staff.joinDate}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                  <Link 
                    to={`/dashboard/admin/staff/${staff.id}`} 
                    className="text-gray-600 hover:text-gray-900"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                No staff members found matching your criteria
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StaffTable;