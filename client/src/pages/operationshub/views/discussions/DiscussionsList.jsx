import React, { useState, useMemo } from 'react';
import { FiMessageSquare, FiUser, FiClock, FiCheckCircle, FiAlertCircle, FiSearch, FiTarget } from 'react-icons/fi';

const DiscussionsList = ({ discussions, onOpenThread, onCreateNew }) => {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Icon Mapper based on category
  const getTypeMeta = (type) => {
    switch(type) {
      case 'question': return { icon: FiMessageSquare, color: 'bg-blue-50 text-blue-600' };
      case 'customer_issue': return { icon: FiUser, color: 'bg-amber-50 text-amber-600' };
      case 'bug': return { icon: FiAlertCircle, color: 'bg-red-50 text-red-600' };
      default: return { icon: FiMessageSquare, color: 'bg-gray-50 text-gray-600' };
    }
  };

  const filteredDiscussions = useMemo(() => {
    return discussions.filter(d => {
      const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'all' ? true : filter === 'solved' ? d.solved : !d.solved;
      return matchesSearch && matchesFilter;
    });
  }, [discussions, search, filter]);

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Service Discussions</h2>
          <p className="text-sm text-gray-500 mt-1">Ask questions, report issues, and collaborate with the team.</p>
        </div>
        <button onClick={onCreateNew} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm">
          + New Discussion
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex-1 min-w-[200px] relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" placeholder="Search discussions..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none">
          <option value="all">All Status</option>
          <option value="open">Open / Unresolved</option>
          <option value="solved">Solved</option>
        </select>
      </div>

      {/* Discussion Cards */}
      <div className="space-y-3">
        {filteredDiscussions.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
            <FiMessageSquare className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No discussions found.</p>
          </div>
        ) : (
          filteredDiscussions.map(d => {
            const meta = getTypeMeta(d.category);
            return (
              <div key={d.id} onClick={() => onOpenThread(d.id)} className="p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 ${meta.color}`}>
                    <meta.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{d.title}</h3>
                      {d.solved && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Solved</span>}
                      {d.priority === 'high' && !d.solved && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">Urgent</span>}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-1 mb-2">{d.preview}</p>
                    
                    {/* CRM Context Badges */}
                    {(d.crm_customer || d.crm_application) && (
                      <div className="flex gap-2 mb-2">
                        {d.crm_customer && <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded flex items-center gap-1"><FiUser/> {d.crm_customer}</span>}
                        {d.crm_application && <span className="text-[11px] bg-gray-100 text-gray-700 px-2 py-1 rounded flex items-center gap-1"><FiTarget/> {d.crm_application}</span>}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
                      <span className="flex items-center gap-1"><FiUser /> {d.author}</span>
                      <span className="flex items-center gap-1"><FiClock /> {d.lastReply}</span>
                      <span className="flex items-center gap-1"><FiMessageSquare /> {d.replies_count} replies</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DiscussionsList;