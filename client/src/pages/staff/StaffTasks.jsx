// src/pages/staff/StaffTasks.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCheckSquare, FiCalendar, FiUser, FiCheck, FiX, 
  FiAlertCircle, FiRefreshCw, FiFilter, FiClock,
  FiList, FiLayout, FiPlayCircle, FiMoreVertical
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all duration-300"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </motion.div>
);

const StaffTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); 
  const [viewMode, setViewMode] = useState('list'); // Default to list for compactness
  
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

  useEffect(() => {
    fetchTasks();
  }, []);

  const updateTaskStatus = async (taskId, newStatus) => {
    const previousTasks = [...tasks];
    setTasks(prev => prev.map(task =>
      task.id.toString() === taskId.toString() ? { ...task, status: newStatus } : task
    ));

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
      toast.success(`Task moved to ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      console.error('Error updating task:', err);
      toast.error('Failed to update task');
      setTasks(previousTasks);
    }
  };

  // --- Drag and Drop Handlers (Board Only) ---
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id.toString() === taskId);
    
    if (task && task.status !== status) {
      updateTaskStatus(taskId, status);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'pending') return task.status === 'pending' || !task.status;
    if (filter === 'in_progress') return task.status === 'in_progress';
    if (filter === 'completed') return task.status === 'completed';
    return true;
  });

  const getPriorityStyles = (priority) => {
    switch(priority?.toLowerCase()) {
      case 'high': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusStyles = (status) => {
    switch(status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      default: return 'bg-amber-100 text-amber-700';
    }
  };

  const columns = [
    { id: 'pending', title: 'To Do', icon: <FiCheckSquare className="text-gray-500 h-4 w-4" /> },
    { id: 'in_progress', title: 'In Progress', icon: <FiPlayCircle className="text-blue-500 h-4 w-4" /> },
    { id: 'completed', title: 'Completed', icon: <FiCheck className="text-emerald-500 h-4 w-4" /> }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600 font-medium text-sm">Syncing tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-sm">
                <FiCheckSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Task Management</h1>
                <p className="text-gray-500 text-xs mt-0.5">Organize and track your assigned work</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FiList size={14} /> <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => setViewMode('board')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === 'board' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FiLayout size={14} /> <span className="hidden sm:inline">Board</span>
                </button>
              </div>
              <button
                onClick={fetchTasks}
                className="p-1.5 bg-gray-100 rounded-lg border border-gray-200 hover:bg-gray-200 transition-colors"
                title="Refresh Tasks"
              >
                <FiRefreshCw className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Compact Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Tasks" value={tasks.length} icon={FiCheckSquare} color="bg-gray-600" />
          <StatCard title="To Do" value={tasks.filter(t => t.status === 'pending' || !t.status).length} icon={FiAlertCircle} color="bg-amber-500" />
          <StatCard title="In Progress" value={tasks.filter(t => t.status === 'in_progress').length} icon={FiPlayCircle} color="bg-blue-500" />
          <StatCard title="Completed" value={tasks.filter(t => t.status === 'completed').length} icon={FiCheck} color="bg-emerald-500" />
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-6 flex items-center gap-2 text-rose-700 text-sm">
            <FiAlertCircle size={16} />
            <span className="font-medium">{error}</span>
            <button onClick={fetchTasks} className="ml-auto font-bold underline">Retry</button>
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center shadow-sm">
            <FiCheckSquare className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <h3 className="text-base font-bold text-gray-900 mb-1">You're all caught up!</h3>
            <p className="text-gray-500 text-sm">No tasks assigned to you right now.</p>
          </div>
        ) : viewMode === 'board' ? (
          
          /* KANBAN BOARD VIEW (Compact) */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            {columns.map(column => (
              <div 
                key={column.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
                className="bg-gray-50 rounded-xl p-3 min-h-[50vh] flex flex-col border border-gray-200"
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-1.5">
                    {column.icon}
                    <h3 className="font-bold text-gray-800 text-sm">{column.title}</h3>
                  </div>
                  <span className="bg-white text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-gray-200">
                    {tasks.filter(t => (t.status || 'pending') === column.id).length}
                  </span>
                </div>
                
                <div className="flex-1 space-y-2.5">
                  <AnimatePresence>
                    {tasks.filter(t => (t.status || 'pending') === column.id).map(task => (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:border-indigo-300 hover:shadow transition-all cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className={`text-sm font-bold text-gray-900 leading-tight ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                            {task.title}
                          </h4>
                        </div>
                        {task.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                           <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold border ${getPriorityStyles(task.priority)}`}>
                            {task.priority || 'Medium'}
                          </span>
                          {task.due_date && (
                            <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                              <FiCalendar />
                              {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>

        ) : (

          /* COMPACT LIST VIEW (Table-Like) */
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b border-gray-200 bg-gray-50 overflow-x-auto hide-scrollbar">
              <FiFilter className="text-gray-400 ml-2 mr-1 h-4 w-4" />
              {['all', 'pending', 'in_progress', 'completed'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-colors whitespace-nowrap ${
                    filter === f
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase w-10">Status</th>
                    <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase">Task Name</th>
                    <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase w-28">Priority</th>
                    <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase w-32">Due Date</th>
                    <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase w-32">Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <AnimatePresence>
                    {filteredTasks.map(task => (
                      <motion.tr 
                        key={task.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-gray-50 transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <button
                            onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                            className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                              task.status === 'completed'
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-2 border-gray-300 text-transparent hover:border-emerald-500'
                            }`}
                          >
                            <FiCheck size={12} strokeWidth={3} />
                          </button>
                        </td>
                        <td className="py-3 px-4 min-w-[200px]">
                          <p className={`text-sm font-semibold text-gray-900 ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-gray-500 truncate max-w-md mt-0.5">
                              {task.description}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold border ${getPriorityStyles(task.priority)}`}>
                            {task.priority || 'Medium'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {task.due_date ? (
                            <span className="text-xs text-gray-600 font-medium flex items-center gap-1.5">
                              <FiCalendar className="text-gray-400" />
                              {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusStyles(task.status || 'pending')}`}>
                            {(task.status || 'pending').replace('_', ' ')}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {filteredTasks.length === 0 && (
                <div className="text-center py-10">
                  <FiList className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-500">No tasks match your filter.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffTasks;