// src/pages/staff/StaffTasks.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCheckSquare, FiCalendar, FiUser, FiCheck, FiX, 
  FiAlertCircle, FiRefreshCw, FiFilter, FiClock,
  FiList, FiGrid, FiMoreVertical, FiPlay
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const StaffTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); 
  const [viewMode, setViewMode] = useState('board'); // 'list' or 'board'
  
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

  // --- Task Updates & Drag/Drop Logic ---
  const updateTaskStatus = async (taskId, newStatus) => {
    // Optimistic UI update for smooth dragging & clicking
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
      setTasks(previousTasks); // Revert on failure
    }
  };

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
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

  // --- Helpers ---
  const filteredTasks = tasks.filter(task => {
    if (filter === 'pending') return task.status !== 'completed';
    if (filter === 'completed') return task.status === 'completed';
    return true;
  });

  const getPriorityStyles = (priority) => {
    switch(priority?.toLowerCase()) {
      case 'high': return 'bg-red-50 text-red-700 border-red-200';
      case 'medium': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'low': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getPriorityIcon = (priority) => {
    if (priority === 'high') return <FiAlertCircle size={12} />;
    if (priority === 'medium') return <FiClock size={12} />;
    return null;
  };

  const columns = [
    { id: 'pending', title: 'To Do', icon: <FiCheckSquare className="text-gray-400" /> },
    { id: 'in_progress', title: 'In Progress', icon: <FiPlay className="text-blue-500" /> },
    { id: 'completed', title: 'Completed', icon: <FiCheck className="text-emerald-500" /> }
  ];

  // --- Render Components ---
  const TaskCard = ({ task, isBoard }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      draggable={isBoard}
      onDragStart={(e) => handleDragStart(e, task.id)}
      className={`group bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all ${isBoard ? 'cursor-grab active:cursor-grabbing mb-3' : 'mb-3'}`}
    >
      <div className="flex items-start gap-3">
        {!isBoard && (
          <button
            onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
            className={`mt-1 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors ${
              task.status === 'completed'
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'border-2 border-gray-300 text-transparent hover:border-emerald-500'
            }`}
          >
            <FiCheck size={12} strokeWidth={3} />
          </button>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={`font-semibold text-gray-800 truncate ${task.status === 'completed' && !isBoard ? 'line-through text-gray-400' : ''}`}>
              {task.title}
            </h4>
            <span className={`flex-shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-md border font-medium capitalize ${getPriorityStyles(task.priority)}`}>
              {getPriorityIcon(task.priority)}
              {task.priority || 'Medium'}
            </span>
          </div>
          
          {task.description && (
            <p className="text-sm text-gray-500 line-clamp-2 mb-3 leading-relaxed">
              {task.description}
            </p>
          )}
          
          <div className="flex flex-wrap items-center gap-3 mt-2 pt-3 border-t border-gray-50 text-xs text-gray-500 font-medium">
            {task.due_date && (
              <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                <FiCalendar className="text-gray-400" />
                {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            )}
            {task.assigned_to_name && (
              <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                <FiUser className="text-gray-400" />
                {task.assigned_to_name.split(' ')[0]}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium animate-pulse">Syncing tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[90rem] mx-auto p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50/30">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Workspace</h1>
          <p className="text-gray-500 mt-1">Manage and track your assigned tasks</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex bg-gray-100/50 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all flex items-center gap-2 text-sm font-medium ${
                viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiList size={16} /> <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`p-2 rounded-md transition-all flex items-center gap-2 text-sm font-medium ${
                viewMode === 'board' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiGrid size={16} /> <span className="hidden sm:inline">Board</span>
            </button>
          </div>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
          <button
            onClick={fetchTasks}
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors mr-1"
            title="Refresh Tasks"
          >
            <FiRefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Tasks', count: tasks.length, color: 'border-l-indigo-500' },
          { label: 'To Do', count: tasks.filter(t => t.status === 'pending').length, color: 'border-l-gray-400' },
          { label: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length, color: 'border-l-blue-500' },
          { label: 'Completed', count: tasks.filter(t => t.status === 'completed').length, color: 'border-l-emerald-500' },
        ].map(stat => (
          <div key={stat.label} className={`bg-white rounded-xl p-5 border border-gray-100 shadow-sm border-l-4 ${stat.color}`}>
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stat.count}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50/80 border border-red-200 rounded-xl p-4 mb-8 flex items-center justify-between text-red-700">
          <div className="flex items-center gap-3">
            <FiAlertCircle size={20} />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={fetchTasks} className="text-sm font-semibold hover:underline">Retry</button>
        </div>
      )}

      {/* Dynamic View Rendering */}
      {tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiCheckSquare className="text-gray-400 text-2xl" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">You're all caught up!</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            There are no tasks assigned to you right now. Take a breather or check back later.
          </p>
        </div>
      ) : viewMode === 'board' ? (
        
        /* Board (Kanban) View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {columns.map(column => (
            <div 
              key={column.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
              className="bg-gray-100/50 rounded-2xl p-4 min-h-[60vh] flex flex-col border border-gray-200/60"
            >
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  {column.icon}
                  <h3 className="font-bold text-gray-700">{column.title}</h3>
                </div>
                <span className="bg-white text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                  {tasks.filter(t => (t.status || 'pending') === column.id).length}
                </span>
              </div>
              
              <div className="flex-1 space-y-3">
                <AnimatePresence>
                  {tasks
                    .filter(t => (t.status || 'pending') === column.id)
                    .map(task => (
                      <TaskCard key={task.id} task={task} isBoard={true} />
                    ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>

      ) : (

        /* List View */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Internal Filters for List View */}
          <div className="flex items-center gap-2 p-4 border-b border-gray-100 bg-gray-50/50 overflow-x-auto">
            <FiFilter className="text-gray-400 ml-2" />
            {['all', 'pending', 'in_progress', 'completed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                  filter === f
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'text-gray-600 hover:bg-gray-200/50'
                }`}
              >
                {f.replace('_', ' ').charAt(0).toUpperCase() + f.replace('_', ' ').slice(1)}
              </button>
            ))}
          </div>
          
          <div className="p-4 md:p-6">
            <AnimatePresence>
              {filteredTasks.map(task => (
                <TaskCard key={task.id} task={task} isBoard={false} />
              ))}
            </AnimatePresence>
            {filteredTasks.length === 0 && (
              <p className="text-center text-gray-500 py-8 font-medium">No tasks found in this filter.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffTasks;