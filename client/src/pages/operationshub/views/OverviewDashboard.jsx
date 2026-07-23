import React from 'react';
import { FiUsers, FiMessageSquare, FiShield, FiLink, FiClock, FiCheckSquare, FiBriefcase } from 'react-icons/fi';

const OverviewDashboard = ({ stats, contributors, workspace, documents, setActiveTab }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900">Service Overview</h1>
        <p className="text-sm text-gray-500 mt-2">
          Global standard operating procedures and service metrics.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Contributors', value: stats.contributors, icon: FiUsers, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Discussions', value: stats.discussionCount, icon: FiMessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Solved Cases', value: stats.caseCount, icon: FiShield, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Resources', value: stats.resourceCount, icon: FiLink, color: 'text-amber-600', bg: 'bg-amber-50' }
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center text-center">
            <div className={`p-2 rounded-lg ${s.bg} ${s.color} mb-3`}><s.icon className="h-5 w-5" /></div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs font-medium text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions Action Pad */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
        <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button 
            onClick={() => setActiveTab('discussions')} 
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border border-gray-100 hover:border-indigo-200"
            >
            <FiMessageSquare className="h-5 w-5" />
            <span className="text-sm font-medium">New Discussion</span>
            </button>
            <button 
            onClick={() => setActiveTab('resources')} 
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 transition-colors border border-gray-100 hover:border-blue-200"
            >
            <FiLink className="h-5 w-5" />
            <span className="text-sm font-medium">Add Resource</span>
            </button>
            <button 
            onClick={() => setActiveTab('cases')} 
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 transition-colors border border-gray-100 hover:border-emerald-200"
            >
            <FiCheckSquare className="h-5 w-5" />
            <span className="text-sm font-medium">Log Solved Case</span>
            </button>
            <button 
            onClick={() => setActiveTab('government_orders')} 
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-gray-50 hover:bg-purple-50 hover:text-purple-700 transition-colors border border-gray-100 hover:border-purple-200"
            >
            <FiBriefcase className="h-5 w-5" />
            <span className="text-sm font-medium">Upload Circular</span>
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Documents Quick Links */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">Core Documentation</h3>
          <div className="space-y-2">
            {documents.slice(0, 4).map(doc => (
              <div 
                key={doc.id} 
                onClick={() => setActiveTab(doc.system_key || `doc-${doc.id}`)}
                className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all"
              >
                <span className="text-sm font-medium text-gray-800">{doc.title}</span>
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <FiClock /> {new Date(doc.updated_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Contributors List */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">Ownership & Contributors</h3>
          <div className="space-y-3">
            {contributors.map(c => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                  {c.staff_name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{c.staff_name}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{c.role}</div>
                </div>
              </div>
            ))}
            {contributors.length === 0 && <p className="text-sm text-gray-500">No contributors assigned.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewDashboard;