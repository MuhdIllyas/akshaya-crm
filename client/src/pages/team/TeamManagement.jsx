import React, { useState } from 'react';
import { FiUsers, FiBarChart2, FiActivity, FiTrendingUp, FiTarget, FiAward, FiMoreVertical, FiSearch, FiDownload, FiPlus, FiX, FiUser, FiUserPlus, FiCheck } from 'react-icons/fi';

const TeamManagement = () => {
  // Mock data for teams and members
  const [teams, setTeams] = useState([
    {
      id: 1,
      name: "Team Alpha",
      manager: "Sarah Johnson",
      performance: 92,
      members: [
        { id: 1, name: "John Doe", role: "Tax Specialist", tasks: 42, completion: 95, efficiency: 88 },
        { id: 2, name: "Jane Smith", role: "Document Processor", tasks: 38, completion: 91, efficiency: 92 },
        { id: 3, name: "Robert Brown", role: "Client Relations", tasks: 35, completion: 89, efficiency: 85 },
        { id: 4, name: "Emily Davis", role: "Compliance Officer", tasks: 28, completion: 93, efficiency: 90 }
      ]
    },
    {
      id: 2,
      name: "Team Beta",
      manager: "Michael Chen",
      performance: 85,
      members: [
        { id: 1, name: "Alex Thompson", role: "Tax Specialist", tasks: 39, completion: 88, efficiency: 82 },
        { id: 2, name: "Maria Garcia", role: "Document Processor", tasks: 36, completion: 84, efficiency: 79 },
        { id: 3, name: "David Wilson", role: "Client Relations", tasks: 31, completion: 87, efficiency: 81 }
      ]
    },
    {
      id: 3,
      name: "Team Gamma",
      manager: "Olivia Parker",
      performance: 78,
      members: [
        { id: 1, name: "James Taylor", role: "Tax Specialist", tasks: 35, completion: 82, efficiency: 75 },
        { id: 2, name: "Sophia Martinez", role: "Document Processor", tasks: 30, completion: 79, efficiency: 72 }
      ]
    }
  ]);

  const [reports] = useState([
    { id: 1, name: "Q3 Performance Report", date: "2023-10-15", type: "Quarterly", download: "/reports/q3-2023.pdf" },
    { id: 2, name: "September Efficiency", date: "2023-10-01", type: "Monthly", download: "/reports/sept-2023.pdf" },
    { id: 3, name: "Team Comparison Q3", date: "2023-10-05", type: "Analytical", download: "/reports/team-comp-q3.pdf" }
  ]);

  const [availableMembers] = useState([
    { id: 1, name: "Emma Wilson", role: "Tax Specialist" },
    { id: 2, name: "Daniel Lee", role: "Document Processor" },
    { id: 3, name: "Sophie Martin", role: "Client Relations" },
    { id: 4, name: "Lucas Garcia", role: "Compliance Officer" },
    { id: 5, name: "Amelia Thompson", role: "Data Analyst" }
  ]);

  const [selectedTeam, setSelectedTeam] = useState(1);
  const [timeRange, setTimeRange] = useState("monthly");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeam, setNewTeam] = useState({
    name: "",
    manager: "",
    members: []
  });
  const [showMemberSelector, setShowMemberSelector] = useState(false);

  // Get performance color
  const getPerformanceColor = (score) => {
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-blue-600";
    if (score >= 70) return "text-amber-600";
    return "text-red-600";
  };

  // Get performance bar color
  const getBarColor = (score) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 80) return "bg-blue-500";
    if (score >= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  // Get current team
  const currentTeam = teams.find(team => team.id === selectedTeam);

  // Filter members based on search
  const filteredMembers = currentTeam?.members.filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle create team
  const handleCreateTeam = (e) => {
    e.preventDefault();
    
    if (!newTeam.name || !newTeam.manager) {
      alert("Please fill all required fields");
      return;
    }
    
    const teamId = teams.length > 0 ? Math.max(...teams.map(t => t.id)) + 1 : 1;
    
    const createdTeam = {
      id: teamId,
      name: newTeam.name,
      manager: newTeam.manager,
      performance: 0,
      members: newTeam.members.map(id => {
        const member = availableMembers.find(m => m.id === id);
        return {
          ...member,
          tasks: 0,
          completion: 0,
          efficiency: 0
        };
      })
    };
    
    setTeams([...teams, createdTeam]);
    setShowCreateTeamModal(false);
    
    // Reset form
    setNewTeam({
      name: "",
      manager: "",
      members: []
    });
  };

  // Toggle member selection
  const toggleMemberSelection = (memberId) => {
    setNewTeam(prev => {
      if (prev.members.includes(memberId)) {
        return {
          ...prev,
          members: prev.members.filter(id => id !== memberId)
        };
      } else {
        return {
          ...prev,
          members: [...prev.members, memberId]
        };
      }
    });
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Team Dashboard</h1>
            <p className="text-gray-600 mt-1">Track performance, compare teams, and generate reports</p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search team members..."
                className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setShowCreateTeamModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-xl flex items-center transition-all duration-300 shadow-md hover:shadow-lg"
            >
              <FiPlus className="mr-2" />
              Create Team
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Total Teams</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{teams.length}</p>
              </div>
              <div className="bg-indigo-100 p-3 rounded-xl">
                <FiUsers className="text-indigo-600 text-xl" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Total Members</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {teams.reduce((sum, team) => sum + team.members.length, 0)}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl">
                <FiActivity className="text-green-600 text-xl" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Avg. Performance</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {Math.round(teams.reduce((sum, team) => sum + team.performance, 0) / teams.length)}%
                </p>
              </div>
              <div className="bg-amber-100 p-3 rounded-xl">
                <FiTrendingUp className="text-amber-600 text-xl" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Top Performing Team</p>
                <p className="text-2xl font-bold text-gray-900 mt-1 flex items-center">
                  <span className="text-green-600 mr-2">Alpha</span> 92%
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-xl">
                <FiAward className="text-purple-600 text-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Members Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              <div className="p-5">
                <div className="flex flex-wrap justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Team Members</h2>
                  <div className="flex gap-3 mt-3 sm:mt-0">
                    <div className="flex items-center">
                      <label className="mr-2 text-sm text-gray-600">Team:</label>
                      <select
                        value={selectedTeam}
                        onChange={(e) => setSelectedTeam(Number(e.target.value))}
                        className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {teams.map(team => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center">
                      <label className="mr-2 text-sm text-gray-600">Period:</label>
                      <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-3 text-left text-sm font-semibold text-gray-600">Member</th>
                        <th className="pb-3 text-center text-sm font-semibold text-gray-600">Role</th>
                        <th className="pb-3 text-center text-sm font-semibold text-gray-600">Tasks</th>
                        <th className="pb-3 text-center text-sm font-semibold text-gray-600">Completion</th>
                        <th className="pb-3 text-center text-sm font-semibold text-gray-600">Efficiency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers?.map(member => (
                        <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4">
                            <div className="flex items-center">
                              <div className="bg-indigo-100 text-indigo-800 p-2 rounded-lg mr-3">
                                <FiUser />
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{member.name}</p>
                                <p className="text-xs text-gray-500">{currentTeam?.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 text-center text-sm text-gray-600">{member.role}</td>
                          <td className="py-4 text-center font-medium">{member.tasks}</td>
                          <td className="py-4 text-center">
                            <div className="flex items-center justify-center">
                              <span className={`font-medium ${getPerformanceColor(member.completion)}`}>
                                {member.completion}%
                              </span>
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center">
                              <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className={`h-2 rounded-full ${getBarColor(member.efficiency)}`} 
                                  style={{ width: `${member.efficiency}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-medium w-8">
                                {member.efficiency}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Team Comparison & Reports */}
          <div className="space-y-6">
            {/* Team Comparison */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              <div className="p-5">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-xl font-bold text-gray-800">Team Comparison</h2>
                  <button className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    View Details
                  </button>
                </div>
                
                <div className="space-y-4">
                  {teams.map(team => (
                    <div key={team.id}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{team.name}</span>
                        <span className={`text-sm font-medium ${getPerformanceColor(team.performance)}`}>
                          {team.performance}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full ${getBarColor(team.performance)}`} 
                          style={{ width: `${team.performance}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-gray-500">
                        <span>Manager: {team.manager}</span>
                        <span>{team.members.length} members</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Reports */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              <div className="p-5">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-xl font-bold text-gray-800">Recent Reports</h2>
                  <button className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    View All
                  </button>
                </div>
                
                <div className="space-y-4">
                  {reports.map(report => (
                    <div key={report.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50">
                      <div>
                        <p className="font-medium text-gray-800">{report.name}</p>
                        <div className="flex items-center mt-1 text-sm text-gray-600">
                          <span className="mr-3">{formatDate(report.date)}</span>
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            {report.type}
                          </span>
                        </div>
                      </div>
                      <a 
                        href={report.download} 
                        className="text-indigo-600 hover:text-indigo-800 p-2"
                        title="Download report"
                      >
                        <FiDownload />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 sticky top-0">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Create New Team</h2>
                <button 
                  onClick={() => setShowCreateTeamModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <FiX size={20} />
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateTeam} className="p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTeam.name}
                    onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter team name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Manager <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTeam.manager}
                    onChange={(e) => setNewTeam({...newTeam, manager: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter manager name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team Members
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {newTeam.members.map(memberId => {
                      const member = availableMembers.find(m => m.id === memberId);
                      return (
                        <div 
                          key={memberId} 
                          className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full flex items-center"
                        >
                          <span className="mr-2">{member?.name}</span>
                          <button 
                            type="button"
                            onClick={() => toggleMemberSelection(memberId)}
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            <FiX size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMemberSelector(true)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 flex items-center justify-center"
                  >
                    <FiUserPlus className="mr-2" />
                    Add Team Members
                  </button>
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-5">
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(false)}
                  className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Selector Modal */}
      {showMemberSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl border border-gray-200">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 sticky top-0">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Select Team Members</h2>
                <button 
                  onClick={() => setShowMemberSelector(false)}
                  className="text-white hover:text-gray-200"
                >
                  <FiX size={20} />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="relative mb-4">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search members..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div className="space-y-3">
                {availableMembers.map(member => (
                  <div 
                    key={member.id}
                    className={`flex items-center justify-between p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 ${
                      newTeam.members.includes(member.id) ? "bg-indigo-50 border-indigo-200" : ""
                    }`}
                    onClick={() => toggleMemberSelection(member.id)}
                  >
                    <div className="flex items-center">
                      <div className="bg-indigo-100 text-indigo-800 p-2 rounded-lg mr-3">
                        <FiUser />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{member.name}</p>
                        <p className="text-sm text-gray-600">{member.role}</p>
                      </div>
                    </div>
                    {newTeam.members.includes(member.id) && (
                      <div className="bg-green-100 text-green-800 p-1 rounded-full">
                        <FiCheck size={16} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowMemberSelector(false)}
                  className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;