import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiSearch, FiChevronDown, FiUser, FiTag, FiLoader } from 'react-icons/fi';
import { fetchCases } from '@/services/knowledge'; 

const CasesView = ({ workspaceId }) => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const loadCases = async () => {
      try {
        const data = await fetchCases(workspaceId);
        setCases(data);
      } catch (err) {
        console.error("Failed to load cases", err);
      } finally {
        setLoading(false);
      }
    };
    loadCases();
  }, [workspaceId]);

  const filteredCases = cases.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) || 
    c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="p-12 flex justify-center"><FiLoader className="animate-spin h-8 w-8 text-emerald-500" /></div>;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Solved Cases</h2>
          <p className="text-sm text-gray-500 mt-1">A permanent archive of resolved issues and proven solutions.</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search cases or tags..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>
      </div>

      {filteredCases.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl border-dashed">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-500">
            <FiCheckCircle className="h-8 w-8" />
          </div>
          <h3 className="text-gray-900 font-bold mb-1">No Cases Found</h3>
          <p className="text-gray-500 text-sm">When discussions are converted to cases, they appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCases.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all hover:border-emerald-200">
              <div 
                className="p-4 sm:p-5 flex items-start gap-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              >
                <div className="mt-1 bg-emerald-100 text-emerald-600 p-1.5 rounded-full flex-shrink-0">
                  <FiCheckCircle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900">{c.title}</h3>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><FiUser /> {c.solver_name || 'System'}</span>
                    {c.tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-md">
                        <FiTag className="h-3 w-3" /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <FiChevronDown className={`text-gray-400 transition-transform ${expandedId === c.id ? 'rotate-180' : ''}`} />
              </div>

              {expandedId === c.id && (
                <div className="px-5 pb-5 pt-2 border-t border-gray-100 bg-gray-50/50">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">The Issue</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.description}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">The Solution</h4>
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.solution}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CasesView;