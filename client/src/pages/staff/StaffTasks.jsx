// src/pages/staff/StaffTasks.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCheckSquare, FiCalendar, FiUser, FiCheck, FiX, 
  FiAlertCircle, FiRefreshCw, FiFilter, FiClock,
  FiList, FiLayout, FiPlayCircle, FiMoreVertical
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all duration-300"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </motion.div>
);

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

  // Drag and Drop Handlers
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
    if (filter === 'pending') return task.status === 'pending';
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

  const getPriorityIcon = (priority) => {
    if (priority === 'high') return <FiAlertCircle size={12} />;
    if (priority === 'medium') return <FiClock size={12} />;
    return null;
  };

  const columns = [
    { id: 'pending', title: 'To Do', icon: <FiCheckSquare className="text-gray-500" /> },
    { id: 'in_progress', title: 'In Progress', icon: <FiPlayCircle className="text-blue-500" /> },
    { id: 'completed', title: 'Completed', icon: <FiCheck className="text-emerald-500" /> }
  ];

  const TaskCard = ({ task, isBoard }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      draggable={isBoard}
      onDragStart={(e) => handleDragStart(e, task.id)}
      className={`group bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all ${isBoard ? 'cursor-grab active:cursor-grabbing mb-3' : 'mb-3'}`}
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
            <h4 className={`font-semibold text-gray-900 truncate ${task.status === 'completed' && !isBoard ? 'line-through text-gray-400' : ''}`}>
              {task.title}
            </h4>
            <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold border ${getPriorityStyles(task.priority)}`}>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Syncing tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header aligned with dashboard theme */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                <FiCheckSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Task Management</h1>
                <p className="text-gray-600 text-sm">Organize, track, and complete your assigned work</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${
                    viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FiList size={16} /> <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => setViewMode('board')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${
                    viewMode === 'board' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FiLayout size={16} /> <span className="hidden sm:inline">Board</span>
                </button>
              </div>
              <button
                onClick={fetchTasks}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                title="Refresh Tasks"
              >
                <FiRefreshCw className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title="Total Tasks" 
            value={tasks.length} 
            icon={FiCheckSquare} 
            color="bg-gray-600" 
          />
          <StatCard 
            title="To Do" 
            value={tasks.filter(t => t.status === 'pending' || !t.status).length} 
            icon={FiAlertCircle} 
            color="bg-amber-500" 
          />
          <StatCard 
            title="In Progress" 
            value={tasks.filter(t => t.status === 'in_progress').length} 
            icon={FiPlayCircle} 
            color="bg-blue-500" 
          />
          <StatCard 
            title="Completed" 
            value={tasks.filter(t => t.status === 'completed').length} 
            icon={FiCheck} 
            color="bg-emerald-500" 
          />
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-8 flex items-center gap-3 text-rose-700">
            <FiAlertCircle size={20} />
            <span className="font-medium text-sm">{error}</span>
            <button onClick={fetchTasks} className="ml-auto text-sm font-bold underline">Retry</button>
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiCheckSquare className="text-gray-400 text-2xl" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">You're all caught up!</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              There are no tasks assigned to you right now. Take a breather or check back later.
            </p>
          </div>
        ) : viewMode === 'board' ? (
          
          /* Kanban Board View */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {columns.map(column => (
              <div 
                key={column.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
                className="bg-gray-100/80 rounded-xl p-4 min-h-[60vh] flex flex-col border border-gray-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {column.icon}
                    <h3 className="font-bold text-gray-800 text-sm">{column.title}</h3>
                  </div>
                  <span className="bg-white text-gray-600 text-xs font-bold px-2 py-0.5 rounded shadow-sm border border-gray-100">
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

          /* Standard List View */
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-gray-100 bg-gray-50 overflow-x-auto hide-scrollbar">
              <FiFilter className="text-gray-400 ml-2 mr-1" />
              {['all', 'pending', 'in_progress', 'completed'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-colors whitespace-nowrap ${
                    filter === f
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {f.replace('_', ' ')}
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
                <div className="text-center py-12">
                  <FiCheckSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-500">No tasks found for this filter.</p>
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