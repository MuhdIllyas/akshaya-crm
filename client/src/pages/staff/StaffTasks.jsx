//src/pages/staff/StaffTasks.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCheckSquare, FiCalendar, FiUser, FiCheck, FiX, 
  FiAlertCircle, FiRefreshCw, FiFilter, FiClock 
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const StaffTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'completed'
  
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
      
      // Update local state
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
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityIcon = (priority) => {
    if (priority === 'high') return <FiAlertCircle className="inline mr-1" size={12} />;
    if (priority === 'medium') return <FiClock className="inline mr-1" size={12} />;
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-navy-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FiCheckSquare className="text-navy-700" /> My Tasks
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            View and manage tasks assigned to you
          </p>
        </div>
        <button
          onClick={fetchTasks}
          className="p-2 rounded-full hover:bg-gray-100 transition"
          title="Refresh"
        >
          <FiRefreshCw className="text-gray-600" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Total Tasks</p>
          <p className="text-2xl font-bold text-gray-800">{tasks.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-green-600">{completedCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 bg-white rounded-lg p-2 border border-gray-200 shadow-sm w-fit">
        <FiFilter className="text-gray-500 ml-2" size={16} />
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            filter === 'all'
              ? 'bg-navy-700 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          All ({tasks.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            filter === 'pending'
              ? 'bg-yellow-500 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            filter === 'completed'
              ? 'bg-green-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Completed ({completedCount})
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3 text-red-700">
          <FiAlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchTasks} className="ml-auto text-sm underline">Try again</button>
        </div>
      )}

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <FiCheckSquare className="mx-auto text-gray-400 text-5xl mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No tasks found</h3>
          <p className="text-gray-500">
            {filter === 'pending' 
              ? 'You have no pending tasks. Great job!' 
              : filter === 'completed'
              ? 'You have no completed tasks yet.'
              : 'No tasks assigned to you at the moment.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleTaskStatus(task.id, task.status)}
                  className={`mt-1 p-1 rounded flex-shrink-0 ${
                    task.status === 'completed'
                      ? 'bg-navy-700 text-white'
                      : 'border border-gray-300 text-transparent hover:border-navy-700'
                  }`}
                >
                  <FiCheck size={14} />
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                      {task.title}
                    </h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityColor(task.priority)}`}>
                      {getPriorityIcon(task.priority)}
                      {task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1) || 'Medium'}
                    </span>
                    {task.due_date && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <FiCalendar size={12} />
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {task.assigned_to_name && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <FiUser size={12} />
                        {task.assigned_to_name}
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                  )}
                  {task.created_by_name && (
                    <p className="text-xs text-gray-400 mt-2">
                      Created by {task.created_by_name} on {new Date(task.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StaffTasks;
