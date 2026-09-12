//src/pages/staff/StaffTasks.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCheckSquare, FiCalendar, FiUser, FiCheck, 
  FiAlertCircle, FiRefreshCw, FiClock, FiMoreHorizontal,
  FiPaperclip, FiMessageCircle, FiShare2
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const StaffTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); 
  
  const staffId = localStorage.getItem('id')?.trim();
  const token = localStorage.getItem('token');
  const API_BASE_URL = import.meta.env.VITE_API_URL;

  const fetchTasks = async () => {
    if (!token || !staffId) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/all?assigned_to=${staffId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err.message);
      toast.error('Could not load tasks');
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskStatus = async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update task');
      
      setTasks(prev => prev.map(task =>
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
      toast.success(`Task marked as ${newStatus}`);
    } catch (err) {
      console.error('Error updating task:', err);
      toast.error('Failed to update task');
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredTasks = tasks.filter(task => {
    if (filter === 'pending') return task.status !== 'completed';
    if (filter === 'completed') return task.status === 'completed';
    return true;
  });

  const pendingCount = tasks.filter(t => t.status !== 'completed').length;

  const getPriorityStyle = (priority) => {
    switch(priority?.toLowerCase()) {
      case 'high': return 'bg-fuchsia-200 text-fuchsia-800';
      case 'medium': return 'bg-blue-100 text-blue-700';
      case 'low': return 'bg-orange-200 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDaysLeft = (dueDate) => {
    if (!dueDate) return 'No date';
    const diffTime = new Date(dueDate) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    return `${diffDays} Days left`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-12 font-sans">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm sm:border-x sm:border-gray-100">
        
        {/* Header */}
        <div className="p-6 pb-2">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                <FiCheckSquare size={18} />
              </div>
              My Tasks
            </h1>
            <div className="flex gap-2">
              <button onClick={fetchTasks} className="p-2 text-gray-400 hover:text-gray-600 transition">
                <FiRefreshCw size={18} />
              </button>
              <button className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                <FiShare2 size={14} /> Share
              </button>
            </div>
          </div>

          {/* Clean Underline Tabs */}
          <div className="flex gap-6 border-b border-gray-100">
            {['all', 'pending', 'completed'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`pb-3 text-sm font-medium capitalize transition-colors relative ${
                  filter === tab ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab}
                {filter === tab && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
                )}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
            <FiAlertCircle /> {error}
          </div>
        )}

        {/* Task List Section */}
        <div className="p-6 bg-[#F8F9FA] min-h-[calc(100vh-140px)]">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold text-gray-400 tracking-widest uppercase">
            TODO <span className="bg-gray-200 text-gray-500 px-2 py-0.5 rounded-md">{filter === 'completed' ? tasks.length - pendingCount : pendingCount}</span>
          </div>

          <div className="space-y-4">
            <AnimatePresence>
              {filteredTasks.map(task => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-50"
                >
                  <div className="flex gap-4">
                    <div className="text-gray-300 pt-1">
                      {task.assigned_to_name ? <FiUser size={20} /> : <FiCalendar size={20} />}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className={`text-[16px] font-semibold leading-snug pr-4 ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {task.title}
                        </h3>
                        <button className="text-gray-400 hover:text-gray-600">
                          <FiMoreHorizontal size={20} />
                        </button>
                      </div>

                      {/* Pill Tags */}
                      <div className="flex flex-wrap gap-2 mb-5">
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getPriorityStyle(task.priority)}`}>
                          {task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1) || 'Medium'} Priority
                        </span>
                        
                        <button 
                          onClick={() => toggleTaskStatus(task.id, task.status)}
                          className={`text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1 transition-colors ${
                            task.status === 'completed' 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {task.status === 'completed' && <FiCheck size={12} />}
                          {task.status === 'completed' ? 'Completed' : 'Mark Complete'}
                        </button>
                      </div>

                      {/* Footer Icons */}
                      <div className="flex items-center gap-5 text-xs font-medium text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <FiClock size={14} />
                          <span>{getDaysLeft(task.due_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 hover:text-gray-600 cursor-pointer">
                          <FiPaperclip size={14} />
                          <span>0</span>
                        </div>
                        <div className="flex items-center gap-1.5 hover:text-gray-600 cursor-pointer">
                          <FiMessageCircle size={14} />
                          <span>0</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredTasks.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm">No tasks found in this view.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffTasks;