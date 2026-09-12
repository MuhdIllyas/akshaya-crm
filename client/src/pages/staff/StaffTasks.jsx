//src/pages/staff/StaffTasks.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCheckSquare, FiCalendar, FiInbox, FiBarChart2, FiFolder, 
  FiTarget, FiPlus, FiMoreHorizontal, FiMoreVertical, 
  FiSearch, FiBell, FiHelpCircle, FiX, FiPaperclip
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const StaffTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  
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
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/all?assigned_to=${staffId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      setError(err.message);
      toast.error('Could not load tasks');
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskStatus = async (e, taskId, currentStatus) => {
    e.stopPropagation();
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
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => ({ ...prev, status: newStatus }));
      }
      toast.success(`Task moved to ${newStatus === 'completed' ? 'Done' : 'To do'}`);
    } catch (err) {
      toast.error('Failed to update task');
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  // Styling helpers to match the specific screenshot tags
  const getTagStyles = (priority) => {
    switch(priority?.toLowerCase()) {
      case 'high': 
        return { num: '8', numBg: 'bg-[#FF5C5C]', pillBg: 'bg-pink-100', pillText: 'text-pink-500', label: 'Graphic Design' };
      case 'medium': 
        return { num: '6', numBg: 'bg-[#FFB020]', pillBg: 'bg-purple-100', pillText: 'text-purple-600', label: 'UI/UX Design' };
      case 'low': 
        return { num: '3', numBg: 'bg-[#00D084]', pillBg: 'bg-blue-100', pillText: 'text-blue-600', label: 'Development' };
      default: 
        return { num: '1', numBg: 'bg-gray-400', pillBg: 'bg-gray-100', pillText: 'text-gray-600', label: 'General' };
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F6F8]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F5F6F8] font-sans overflow-hidden text-gray-800">
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="grid grid-cols-2 gap-1 w-6 h-6">
            <div className="bg-blue-600 rounded-full"></div>
            <div className="bg-blue-600 rounded-full"></div>
            <div className="bg-blue-600 rounded-full"></div>
            <div className="bg-blue-600 rounded-full"></div>
          </div>
          <span className="font-bold text-xl tracking-tight text-gray-900">ChronoTask</span>
        </div>
        
        <div className="px-6 mb-8">
          <button className="w-full flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 rounded-full py-2.5 text-sm font-medium transition-colors shadow-sm">
            <FiPlus size={16} /> Create
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <p className="px-4 text-[11px] font-bold text-gray-400 tracking-wider mb-2">GENERAL</p>
          <a href="#" className="flex items-center gap-3 px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium">
            <FiCheckSquare size={18} /> Home
          </a>
          <a href="#" className="flex items-center justify-between px-4 py-2.5 bg-gray-100 text-gray-900 rounded-xl text-sm font-medium">
            <div className="flex items-center gap-3">
              <FiFolder size={18} /> My Tasks
            </div>
            <span className="bg-white text-gray-500 text-xs py-0.5 px-2 rounded-full border border-gray-200">{tasks.length}</span>
          </a>
          <a href="#" className="flex items-center justify-between px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium">
            <div className="flex items-center gap-3">
              <FiInbox size={18} /> Inbox
            </div>
            <span className="text-gray-400 text-xs">{pendingTasks.length}</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium">
            <FiBarChart2 size={18} /> Reporting
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium">
            <FiFolder size={18} /> Portfolios
          </a>
          <a href="#" className="flex items-center justify-between px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium">
            <div className="flex items-center gap-3">
              <FiTarget size={18} /> Goals
            </div>
            <span className="text-gray-400 text-xs">8</span>
          </a>
        </nav>

        <div className="p-6">
          <a href="#" className="flex items-center gap-3 text-gray-500 hover:text-gray-700 text-sm font-medium">
            <FiHelpCircle size={18} /> Get help
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-gray-200/60 bg-transparent">
          <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
            <FiCalendar className="text-gray-400" size={16} />
            {currentDate}
          </div>
          <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-gray-600"><FiSearch size={20} /></button>
            <button className="text-gray-400 hover:text-gray-600"><FiBell size={20} /></button>
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
              {getInitials(staffId || 'Me')}
            </div>
          </div>
        </header>

        {/* Dashboard Header */}
        <div className="px-8 pt-8 pb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">My tasks</h1>
          
          <div className="flex items-center gap-8 border-b border-gray-200">
            {['List', 'Board', 'Calendar', 'Files'].map((tab) => (
              <button
                key={tab}
                className={`pb-3 text-sm font-medium relative ${
                  tab === 'Board' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
                {tab === 'Board' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mx-8 mt-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        )}

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto p-8 pt-4 flex gap-6">
          
          {/* To Do Column */}
          <div className="w-[340px] shrink-0 flex flex-col">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <h3 className="font-bold text-gray-900">To do</h3>
                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full font-semibold">{pendingTasks.length}</span>
              </div>
              <div className="flex gap-1">
                <button className="p-1 text-gray-400 hover:bg-gray-200 rounded"><FiPlus size={18} /></button>
                <button className="p-1 text-gray-400 hover:bg-gray-200 rounded"><FiMoreVertical size={18} /></button>
              </div>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto pb-8 custom-scrollbar">
              <AnimatePresence>
                {pendingTasks.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onClick={() => setSelectedTask(task)}
                    onToggle={(e) => toggleTaskStatus(e, task.id, task.status)}
                    styles={getTagStyles(task.priority)}
                    initials={getInitials(task.assigned_to_name)}
                  />
                ))}
              </AnimatePresence>
              <button className="flex items-center gap-2 text-gray-500 hover:text-gray-800 p-2 text-sm font-medium transition-colors">
                <FiPlus size={16} /> Add task
              </button>
            </div>
          </div>

          {/* In Progress / Done Column */}
          <div className="w-[340px] shrink-0 flex flex-col">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚀</span>
                <h3 className="font-bold text-gray-900">Completed</h3>
                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full font-semibold">{completedTasks.length}</span>
              </div>
              <div className="flex gap-1">
                <button className="p-1 text-gray-400 hover:bg-gray-200 rounded"><FiPlus size={18} /></button>
                <button className="p-1 text-gray-400 hover:bg-gray-200 rounded"><FiMoreVertical size={18} /></button>
              </div>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto pb-8 custom-scrollbar">
              <AnimatePresence>
                {completedTasks.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onClick={() => setSelectedTask(task)}
                    onToggle={(e) => toggleTaskStatus(e, task.id, task.status)}
                    styles={getTagStyles(task.priority)}
                    initials={getInitials(task.assigned_to_name)}
                  />
                ))}
              </AnimatePresence>
              <button className="flex items-center gap-2 text-gray-500 hover:text-gray-800 p-2 text-sm font-medium transition-colors">
                <FiPlus size={16} /> Add task
              </button>
            </div>
          </div>

        </div>

        {/* Task Detail Modal Overlay */}
        <AnimatePresence>
          {selectedTask && (
            <motion.div 
              initial={{ opacity: 0, x: 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 400 }}
              className="absolute top-4 right-4 bottom-4 w-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <button onClick={() => setSelectedTask(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                  <FiX size={20} />
                </button>
                <div className="flex gap-2">
                  <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><FiMoreHorizontal size={20} /></button>
                </div>
              </div>

              <div className="p-8 overflow-y-auto flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-8">{selectedTask.title}</h2>
                
                <div className="space-y-5 text-sm">
                  <div className="flex items-center">
                    <span className="w-32 text-gray-400 flex items-center gap-2"><FiTarget /> Priority</span>
                    <div className="flex gap-2 items-center">
                      <span className={`w-6 h-6 flex items-center justify-center rounded text-white text-xs font-bold ${getTagStyles(selectedTask.priority).numBg}`}>
                        {getTagStyles(selectedTask.priority).num}
                      </span>
                      <span className={`px-3 py-1 rounded-full font-bold text-xs ${getTagStyles(selectedTask.priority).pillBg} ${getTagStyles(selectedTask.priority).pillText}`}>
                        {getTagStyles(selectedTask.priority).label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="w-32 text-gray-400 flex items-center gap-2"><FiCheckSquare /> Status</span>
                    <span className="text-gray-900 capitalize">{selectedTask.status}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-32 text-gray-400 flex items-center gap-2"><FiCalendar /> Due date</span>
                    <span className="text-gray-900">{selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'No date'}</span>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-100">
                  <p className="text-gray-600 leading-relaxed">
                    {selectedTask.description || "No description provided for this task."}
                  </p>
                </div>

                {/* Mock Attachments section */}
                <div className="mt-8">
                  <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <FiPaperclip className="text-gray-400" /> Attachments
                  </h4>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl w-48">
                      <div className="w-8 h-8 bg-red-100 text-red-500 rounded flex items-center justify-center font-bold text-xs">PDF</div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Brief.pdf</p>
                        <p className="text-xs text-gray-400">2.45 MB</p>
                      </div>
                    </div>
                    <button className="w-12 h-[60px] border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-50">
                      <FiPlus size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
};

// Extracted Task Card Component
const TaskCard = ({ task, onClick, onToggle, styles, initials }) => {
  const isCompleted = task.status === 'completed';
  const progressPercent = isCompleted ? 100 : Math.floor(Math.random() * 50) + 15; // Mock progress for pending
  const circleCircumference = 2 * Math.PI * 10;
  const strokeDashoffset = circleCircumference - (progressPercent / 100) * circleCircumference;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      className="bg-white p-5 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-100 cursor-pointer hover:shadow-md transition-shadow group"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-5 h-5 flex items-center justify-center rounded text-white text-[10px] font-bold ${styles.numBg}`}>
          {styles.num}
        </span>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${styles.pillBg} ${styles.pillText}`}>
          {styles.label}
        </span>
      </div>
      
      <h4 className={`text-[15px] font-bold mb-2 leading-snug ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
        {task.title}
      </h4>
      <p className="text-sm text-gray-500 line-clamp-2 mb-4 leading-relaxed">
        {task.description || 'No description available for this task.'}
      </p>
      
      <div className="flex items-center justify-between mt-auto">
        <div className="flex -space-x-2">
          <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-white text-white flex items-center justify-center text-[10px] font-bold z-10">
            {initials}
          </div>
          <div className="w-7 h-7 rounded-full bg-orange-400 border-2 border-white text-white flex items-center justify-center text-[10px] font-bold">
            JD
          </div>
        </div>
        
        <div 
          className="flex items-center gap-2 cursor-pointer group/ring"
          onClick={onToggle}
          title={isCompleted ? "Mark pending" : "Mark complete"}
        >
          <div className="relative w-6 h-6 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" className="stroke-gray-100" strokeWidth="3" fill="none" />
              <circle 
                cx="12" cy="12" r="10" 
                className={`transition-all duration-500 ${isCompleted ? 'stroke-green-500' : 'stroke-blue-500'} group-hover/ring:stroke-blue-600`}
                strokeWidth="3" fill="none" 
                strokeDasharray={circleCircumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className={`text-xs font-bold ${isCompleted ? 'text-green-500' : 'text-gray-400 group-hover/ring:text-blue-600'}`}>
            {progressPercent}%
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default StaffTasks;