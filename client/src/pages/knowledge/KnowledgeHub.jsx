import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FiHome, FiMessageCircle, FiBook, FiBell, FiAward,
  FiTag, FiBookmark, FiAtSign, FiClock, FiPlus, FiSearch,
  FiUser, FiChevronRight, FiChevronLeft, FiX,
  FiStar, FiTrendingUp, FiCalendar, FiEye, FiMessageSquare,
  FiPaperclip, FiLink, FiCheckCircle, FiAlertCircle, FiFilter,
  FiChevronDown, FiCornerDownLeft, FiEdit2, FiTrash2, FiSave,
  FiExternalLink, FiLock, FiMapPin, FiGlobe, FiHeart, FiZap,
  FiThumbsUp, FiThumbsDown, FiLoader, FiInfo,
  FiMenu, FiSettings, FiFile, FiLayers, FiFolder,
  FiMoreHorizontal, FiShare2, FiUserPlus, FiRefreshCw,
  FiArchive, FiClipboard, FiVideo, FiFileText, FiLifeBuoy,
  FiUsers, FiBriefcase, FiTarget, FiCheckSquare, FiMessageCircle as FiMessageCircleOutline,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { MentionsInput, Mention } from 'react-mentions';
import { toast } from 'react-toastify';

// =====================================================================
// MOCK DATA (same as before)
// =====================================================================
const DATA = { /* ... (same as previous) ... */ };
const STAFF_SUGGESTIONS = [ /* ... */ ];

// =====================================================================
// HELPER COMPONENTS (Tailwind only)
// =====================================================================

// Sidebar
const Sidebar = ({ active, onNavigate }) => {
  const mainNav = [
    { id: 'home', label: 'Home', icon: FiHome },
    { id: 'discussions', label: 'Discussions', icon: FiMessageCircle, count: DATA.stats.discussions },
    { id: 'knowledge', label: 'Knowledge Base', icon: FiBook, count: DATA.stats.articles },
    { id: 'learning', label: 'Learning Center', icon: FiAward, count: DATA.stats.trainings },
    { id: 'announcements', label: 'Announcements', icon: FiBell, count: DATA.stats.announcements },
  ];
  const workspaceItems = [
    { id: 'mentions', label: 'Mentions', icon: FiAtSign, count: DATA.stats.unreadMentions },
    { id: 'bookmarks', label: 'Bookmarks', icon: FiBookmark },
    { id: 'drafts', label: 'Drafts', icon: FiFile, count: DATA.drafts.length },
    { id: 'following', label: 'Following', icon: FiUserPlus },
    { id: 'history', label: 'History', icon: FiClock },
  ];

  return (
    <div className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col sticky top-0 h-screen overflow-y-auto flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm">
          <FiZap className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Knowledge Hub</h1>
        <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full ml-auto">v3.0</span>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-2.5 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-1.5">💡 Knowledge Hub</div>
        {mainNav.map(item => (
          <a
            key={item.id}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              active === item.id
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.count && <span className="ml-auto bg-gray-200 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">{item.count}</span>}
          </a>
        ))}

        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-1.5 mt-4">⭐ My Workspace</div>
        {workspaceItems.map(item => (
          <a
            key={item.id}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              active === item.id
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.count && <span className="ml-auto bg-gray-200 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">{item.count}</span>}
          </a>
        ))}

        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-1.5 mt-4">🏷 Tags</div>
        <a
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            active === 'tags'
              ? 'bg-indigo-50 text-indigo-600'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
          onClick={() => onNavigate('tags')}
        >
          <FiTag className="h-4 w-4" />
          <span>Tags</span>
          <span className="ml-auto bg-gray-200 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">{DATA.allTags.length}</span>
        </a>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-t border-gray-200">
        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold text-sm">A</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">Admin User</div>
          <div className="text-xs text-gray-400">System Admin</div>
        </div>
        <div className="text-gray-400 hover:text-gray-700 cursor-pointer" onClick={() => onNavigate('settings')}>
          <FiSettings className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
};

// Top Bar
const TopBar = ({ onSearch, query, onNavigate, toggleMobileSidebar }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
      <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={toggleMobileSidebar}>
        <FiMenu className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-[180px] max-w-xl relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask Knowledge Hub (e.g., 'How to correct Aadhaar DOB?')"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-9 pr-14 py-2 bg-gray-100 border border-transparent rounded-full text-sm focus:outline-none focus:bg-white focus:border-gray-300 transition-all shadow-inner"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded border border-gray-300 font-mono">⌘K</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onNavigate('notifications')} className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <FiBell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        <button onClick={() => onNavigate('bookmarks')} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <FiBookmark className="h-5 w-5" />
        </button>
        <button onClick={() => onNavigate('mentions')} className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <FiAtSign className="h-5 w-5" />
          {DATA.stats.unreadMentions > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          )}
        </button>
      </div>
    </div>
  );
};

// Stat Card
const StatCard = ({ label, value, icon: Icon, color }) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    rose: 'bg-rose-50 text-rose-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
      <div className={`p-2.5 rounded-xl ${colorMap[color] || 'bg-gray-50 text-gray-600'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
};

// Trending Tags
const TrendingTags = ({ tags, onTagClick }) => (
  <div className="flex flex-wrap gap-2">
    {tags.map(tag => (
      <span
        key={tag.name}
        className="px-3 py-1.5 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 border border-transparent hover:border-indigo-200 rounded-full text-sm font-medium text-gray-700 cursor-pointer transition-all"
        onClick={() => onTagClick(tag.name)}
      >
        {tag.name} <span className="text-gray-400 font-normal ml-1">{tag.count}</span>
      </span>
    ))}
  </div>
);

// Announcement Item
const AnnouncementItem = ({ announcement, onClick }) => {
  const categoryColors = {
    government: 'bg-red-100 text-red-700',
    centre: 'bg-blue-100 text-blue-700',
    software: 'bg-green-100 text-green-700',
    training: 'bg-purple-100 text-purple-700',
  };
  const color = categoryColors[announcement.category] || 'bg-gray-100 text-gray-700';
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition" onClick={onClick}>
      {announcement.pinned ? <FiHeart className="text-amber-500 h-4 w-4 flex-shrink-0" /> : <span className="w-4 flex-shrink-0"></span>}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{announcement.title}</div>
        <div className="text-xs text-gray-400">{announcement.time}</div>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
        {announcement.category}
      </span>
    </div>
  );
};

// Discussion Card (with CRM context)
const DiscussionCard = ({ discussion, onClick }) => {
  const typeIcons = {
    question: FiMessageSquare,
    idea: FiZap,
    announcement: FiBell,
    training: FiAward,
    bug: FiAlertCircle,
    problem: FiAlertCircle,
    guide: FiBook,
  };
  const Icon = typeIcons[discussion.type] || FiMessageSquare;
  const colorMap = {
    question: 'bg-blue-50 text-blue-600',
    idea: 'bg-amber-50 text-amber-600',
    announcement: 'bg-red-50 text-red-600',
    training: 'bg-green-50 text-green-600',
    bug: 'bg-yellow-50 text-yellow-600',
    problem: 'bg-orange-50 text-orange-600',
    guide: 'bg-cyan-50 text-cyan-600',
  };
  const typeClass = colorMap[discussion.type] || 'bg-gray-50 text-gray-600';

  return (
    <div className="p-3 bg-white border border-gray-200 rounded-xl mb-2.5 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer" onClick={() => onClick(discussion.id)}>
      <div className="flex gap-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${typeClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-sm font-semibold text-gray-900">{discussion.title}</span>
            {discussion.solved !== undefined && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                discussion.solved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {discussion.solved ? 'Solved' : 'Open'}
              </span>
            )}
            {discussion.service && (
              <span className="text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{discussion.service}</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{discussion.preview}</div>
          {/* CRM Context */}
          {(discussion.customer || discussion.applicationNumber || discussion.trackingStatus) && (
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
              {discussion.customer && <span><FiUser className="inline h-3 w-3 mr-0.5" /> {discussion.customer}</span>}
              {discussion.applicationNumber && <span><FiFile className="inline h-3 w-3 mr-0.5" /> {discussion.applicationNumber}</span>}
              {discussion.trackingStatus && <span><FiTarget className="inline h-3 w-3 mr-0.5" /> {discussion.trackingStatus}</span>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-400">
            <span><FiUser className="inline h-3 w-3 mr-0.5" /> {discussion.author}</span>
            <span><FiClock className="inline h-3 w-3 mr-0.5" /> {discussion.lastReply}</span>
            <span><FiMessageSquare className="inline h-3 w-3 mr-0.5" /> {discussion.replies}</span>
            <span><FiEye className="inline h-3 w-3 mr-0.5" /> {discussion.views}</span>
            <div className="flex gap-1">
              {discussion.tags.map(t => <span key={t} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">#{t}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Knowledge Article Card
const ArticleCard = ({ article, onClick }) => (
  <div className="p-3 bg-white border border-gray-200 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer" onClick={onClick}>
    <div className="font-semibold text-sm text-gray-900">{article.title}</div>
    <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{article.desc}</div>
    <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-gray-400">
      <span><FiFolder className="inline h-3 w-3 mr-0.5" /> {article.category}</span>
      <span><FiUser className="inline h-3 w-3 mr-0.5" /> {article.author}</span>
      <span><FiClock className="inline h-3 w-3 mr-0.5" /> {article.updated}</span>
      <span><FiClock className="inline h-3 w-3 mr-0.5" /> {article.readingTime}</span>
    </div>
  </div>
);

// Activity Feed
const ActivityFeed = ({ activities }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
      <FiRefreshCw className="h-4 w-4 text-indigo-500" />
      Recent Activity
    </h3>
    <div className="space-y-2">
      {activities.map(act => (
        <div key={act.id} className="flex items-start gap-2 text-sm">
          <span className="mt-0.5">
            {act.type === 'solved' && <FiCheckCircle className="h-4 w-4 text-emerald-500" />}
            {act.type === 'article' && <FiFileText className="h-4 w-4 text-blue-500" />}
            {act.type === 'circular' && <FiFile className="h-4 w-4 text-purple-500" />}
            {act.type === 'update' && <FiTrendingUp className="h-4 w-4 text-amber-500" />}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-gray-700">
              <strong>{act.user}</strong> {act.type === 'solved' ? 'solved' : act.type === 'article' ? 'updated article' : act.type === 'circular' ? 'added circular' : 'updated'}{' '}
              <span className="text-indigo-600 font-medium">{act.target}</span>
            </span>
            <span className="block text-xs text-gray-400">{act.time}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Convert Dropdown
const ConvertDropdown = ({ onConvert }) => {
  const [open, setOpen] = useState(false);
  const options = [
    { label: 'Article', icon: FiBook, action: 'article' },
    { label: 'Task', icon: FiCheckSquare, action: 'task' },
    { label: 'Note', icon: FiFileText, action: 'note' },
    { label: 'Announcement', icon: FiBell, action: 'announcement' },
    { label: 'Training Material', icon: FiVideo, action: 'training' },
  ];
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
      >
        <FiMoreHorizontal className="h-4 w-4" /> Convert
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
          {options.map(opt => (
            <div
              key={opt.action}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition"
              onClick={() => { onConvert(opt.action); setOpen(false); }}
            >
              <opt.icon className="h-4 w-4" /> {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// MAIN KNOWLEDGE HUB COMPONENT
// =====================================================================
const KnowledgeHub = () => {
  const [page, setPage] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showAIAnswer, setShowAIAnswer] = useState(false);

  const [newDiscussion, setNewDiscussion] = useState({
    title: '',
    content: '',
    category: 'questions',
    tags: [],
    priority: 'medium',
    visibility: 'everyone',
    relatedTo: 'none',
    attachments: [],
  });
  const [tagInput, setTagInput] = useState('');

  const navigateTo = (target, id = null) => {
    if (target === 'discussion-detail' && id) {
      setPage('discussion-detail');
      setSelectedDiscussionId(id);
    } else {
      setPage(target);
      setSelectedDiscussionId(null);
      if (target !== 'search') setSearchQuery('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (mobileSidebarOpen) setMobileSidebarOpen(false);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      setPage('search');
      setShowAIAnswer(query.toLowerCase().includes('aadhaar') || query.toLowerCase().includes('dob'));
    } else {
      setPage('home');
    }
  };

  const handleTagClick = (tagName) => {
    setSearchQuery(tagName);
    setPage('search');
  };

  const openDiscussionDetail = (id) => navigateTo('discussion-detail', id);

  const addTag = () => {
    if (tagInput.trim() && !newDiscussion.tags.includes(tagInput.trim())) {
      setNewDiscussion(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };
  const removeTag = (tag) => {
    setNewDiscussion(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    toast.success('Discussion created successfully!');
    setShowCreateModal(false);
    setNewDiscussion({
      title: '',
      content: '',
      category: 'questions',
      tags: [],
      priority: 'medium',
      visibility: 'everyone',
      relatedTo: 'none',
      attachments: [],
    });
    setTagInput('');
  };

  const toggleMobileSidebar = () => setMobileSidebarOpen(prev => !prev);

  const renderPage = () => {
    switch (page) {
      case 'home': return <HomePage navigateTo={navigateTo} handleTagClick={handleTagClick} openDiscussion={openDiscussionDetail} />;
      case 'discussions': return <DiscussionsPage navigateTo={navigateTo} openDiscussion={openDiscussionDetail} />;
      case 'discussion-detail': return <DiscussionDetailPage discussionId={selectedDiscussionId} navigateTo={navigateTo} />;
      case 'knowledge': return <KnowledgePage navigateTo={navigateTo} />;
      case 'learning': return <LearningPage navigateTo={navigateTo} />;
      case 'announcements': return <AnnouncementsPage navigateTo={navigateTo} />;
      case 'tags': return <TagsPage navigateTo={navigateTo} handleTagClick={handleTagClick} />;
      case 'bookmarks': return <BookmarksPage />;
      case 'mentions': return <MentionsPage navigateTo={navigateTo} />;
      case 'drafts': return <DraftsPage navigateTo={navigateTo} />;
      case 'following': return <FollowingPage />;
      case 'history': return <HistoryPage />;
      case 'notifications': return <NotificationsPage />;
      case 'search': return <SearchPage query={searchQuery} navigateTo={navigateTo} openDiscussion={openDiscussionDetail} showAIAnswer={showAIAnswer} />;
      default: return <HomePage navigateTo={navigateTo} handleTagClick={handleTagClick} openDiscussion={openDiscussionDetail} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar active={page} onNavigate={navigateTo} />
      </div>

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          onSearch={handleSearch}
          query={searchQuery}
          onNavigate={navigateTo}
          toggleMobileSidebar={toggleMobileSidebar}
        />
        <div className="flex-1 p-4 sm:p-6">
          {renderPage()}
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setMobileSidebarOpen(false)}>
          <div className="w-64 h-full bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <Sidebar active={page} onNavigate={navigateTo} />
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg hover:scale-105 transition-all flex items-center justify-center"
        onClick={() => setShowCreateModal(true)}
      >
        <FiPlus className="h-6 w-6" />
      </button>

      {/* Create Discussion Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Create Discussion</h2>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={() => setShowCreateModal(false)}>
                  <FiX className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={newDiscussion.title}
                    onChange={e => setNewDiscussion(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="What's your question or idea?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <MentionsInput
                    value={newDiscussion.content}
                    onChange={(e, newValue) => setNewDiscussion(prev => ({ ...prev, content: newValue }))}
                    placeholder="Provide details... Use @ to mention a staff member"
                    className="w-full"
                    style={{
                      control: { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', minHeight: '80px' },
                      highlighter: { padding: '0.65rem' },
                      input: { padding: '0.65rem', border: 'none', outline: 'none' },
                      suggestions: { list: { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', zIndex: 100 }, item: { padding: '5px 10px', borderBottom: '1px solid #f1f5f9' } }
                    }}
                  >
                    <Mention trigger="@" data={STAFF_SUGGESTIONS} markup="@[__display__](__id__)" displayTransform={(id, display) => `@${display}`} />
                  </MentionsInput>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={newDiscussion.category}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {DATA.categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.label}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={newDiscussion.priority}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Related To</label>
                    <select
                      value={newDiscussion.relatedTo}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, relatedTo: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="none">None</option><option value="customer">Customer</option><option value="service">Service</option><option value="task">Task</option><option value="team">Team</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                    <select
                      value={newDiscussion.visibility}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, visibility: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="everyone">Everyone</option><option value="centre">Centre</option><option value="private">Private</option><option value="admins">Admins</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500">
                    {newDiscussion.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-1 rounded-full">
                        {tag} <FiX className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                      </span>
                    ))}
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                      placeholder="Add a tag..."
                      className="flex-1 min-w-[80px] border-none outline-none text-sm py-1"
                    />
                    <button type="button" onClick={addTag} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2">Add</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attach Files</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500 hover:border-indigo-400 transition cursor-pointer">
                    <FiPaperclip className="h-6 w-6 mx-auto mb-1" />
                    <p className="text-sm">Click or drag files to upload</p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button type="button" className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">Publish</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =====================================================================
// PAGE COMPONENTS (all Tailwind only)
// =====================================================================

const HomePage = ({ navigateTo, handleTagClick, openDiscussion }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Welcome back, Admin 👋</h2>
      <p className="text-gray-500">Your knowledge hub – stay updated and connected.</p>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard label="Discussions" value={DATA.stats.discussions} icon={FiMessageCircle} color="blue" />
      <StatCard label="Knowledge Articles" value={DATA.stats.articles} icon={FiBook} color="green" />
      <StatCard label="Announcements" value={DATA.stats.announcements} icon={FiBell} color="amber" />
      <StatCard label="Training Materials" value={DATA.stats.trainings} icon={FiAward} color="purple" />
      <StatCard label="Open Questions" value={DATA.stats.openQuestions} icon={FiAlertCircle} color="rose" />
      <StatCard label="Unread Mentions" value={DATA.stats.unreadMentions} icon={FiAtSign} color="indigo" />
    </div>

    {/* Government Updates */}
    <div className="bg-white border-l-4 border-red-500 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <FiFileText className="h-4 w-4 text-red-500" /> Government Updates
        </h3>
        <span className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium" onClick={() => navigateTo('announcements')}>View all →</span>
      </div>
      <div className="space-y-2">
        {DATA.governmentUpdates.map(update => (
          <div key={update.id} className="flex items-center gap-3 text-sm">
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
              update.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            }`}>{update.priority}</span>
            <span className="text-gray-700 flex-1">{update.title}</span>
            <span className="text-xs text-gray-400">{update.date}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><FiMessageCircle className="h-4 w-4 text-indigo-500" /> Unread Discussions</h3>
            <span className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer" onClick={() => navigateTo('discussions')}>View all →</span>
          </div>
          {DATA.discussions.slice(0, 3).map(d => <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />)}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><FiClock className="h-4 w-4 text-gray-500" /> Recent Discussions</h3>
            <span className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer" onClick={() => navigateTo('discussions')}>View all →</span>
          </div>
          {DATA.discussions.slice(3, 6).map(d => <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />)}
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><FiAtSign className="h-4 w-4 text-purple-500" /> My Mentions</h3>
            <span className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer" onClick={() => navigateTo('mentions')}>View all →</span>
          </div>
          {DATA.myMentions.map((m, idx) => (
            <div key={idx} className="p-2 bg-white border border-gray-200 rounded-xl mb-2 hover:border-indigo-200 transition cursor-pointer" onClick={() => navigateTo('mentions')}>
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><FiAtSign className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{m.title}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">{m.excerpt}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{m.time}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><FiEdit2 className="h-4 w-4 text-gray-500" /> My Drafts</h3>
            <span className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer" onClick={() => navigateTo('drafts')}>View all →</span>
          </div>
          {DATA.drafts.map((d, idx) => (
            <div key={idx} className="p-2 bg-white border border-gray-200 rounded-xl mb-2 opacity-70">
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center"><FiFile className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{d.title}</div>
                  <div className="text-[10px] text-gray-400">Updated {d.updated}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <ActivityFeed activities={DATA.activityFeed} />
      </div>
    </div>

    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><FiBell className="h-4 w-4 text-amber-500" /> Latest Announcements</h3>
        <span className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer" onClick={() => navigateTo('announcements')}>View all →</span>
      </div>
      {DATA.announcements.map((a, idx) => <AnnouncementItem key={idx} announcement={a} onClick={() => navigateTo('announcements')} />)}
    </div>
  </div>
);

// Discussions List
const DiscussionsPage = ({ navigateTo, openDiscussion }) => {
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('latest');

  const filtered = useMemo(() => {
    let list = DATA.discussions;
    if (filterCategory !== 'all') list = list.filter(d => d.type === filterCategory);
    if (filterStatus !== 'all') list = list.filter(d => filterStatus === 'solved' ? d.solved : !d.solved);
    if (sortBy === 'latest') list = list.slice().sort((a, b) => new Date(b.lastReply) - new Date(a.lastReply));
    else if (sortBy === 'replies') list = list.slice().sort((a, b) => b.replies - a.replies);
    else if (sortBy === 'views') list = list.slice().sort((a, b) => b.views - a.views);
    return list;
  }, [filterCategory, filterStatus, sortBy]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-gray-900">Discussions</h2>
        <div className="flex flex-wrap gap-2">
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value="all">All Categories</option>
            {DATA.categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.label}</option>))}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value="all">All Status</option><option value="open">Open</option><option value="solved">Solved</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value="latest">Latest</option><option value="replies">Most Replies</option><option value="views">Most Views</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        {filtered.map(d => <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />)}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FiMessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No discussions found</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Discussion Detail
const DiscussionDetailPage = ({ discussionId, navigateTo }) => {
  const discussion = DATA.discussionDetail;
  if (!discussion) return <div className="text-center py-12 text-gray-500">Discussion not found</div>;

  const typeIcons = {
    question: FiMessageSquare,
    idea: FiZap,
    announcement: FiBell,
    training: FiAward,
    bug: FiAlertCircle,
    problem: FiAlertCircle,
    guide: FiBook,
  };
  const Icon = typeIcons[discussion.type] || FiMessageSquare;

  const handleConvert = (action) => toast.success(`Converting to ${action}... (demo)`);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main column */}
      <div className="flex-1 min-w-0 space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full">
              <Icon className="h-3 w-3" /> {discussion.type.charAt(0).toUpperCase() + discussion.type.slice(1)}
            </span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${discussion.solved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {discussion.solved ? 'Solved' : 'Open'}
            </span>
            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{discussion.service}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{discussion.title}</h2>
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
            <span><FiUser className="inline mr-1" /> {discussion.author}</span>
            <span><FiClock className="inline mr-1" /> {discussion.created}</span>
            <span><FiEye className="inline mr-1" /> {discussion.views} views</span>
            <span><FiMessageSquare className="inline mr-1" /> {discussion.replies} replies</span>
          </div>
        </div>

        {/* CRM Context Bar */}
        <div className="flex flex-wrap gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-gray-700">
          {discussion.customer && <span><FiUser className="inline mr-1.5 text-indigo-500" /> Customer: <strong>{discussion.customer}</strong></span>}
          {discussion.applicationNumber && <span><FiFile className="inline mr-1.5 text-indigo-500" /> Application: <strong>{discussion.applicationNumber}</strong></span>}
          {discussion.trackingStatus && <span><FiTarget className="inline mr-1.5 text-indigo-500" /> Status: <strong>{discussion.trackingStatus}</strong></span>}
          {discussion.relatedServiceEntries && (
            <span><FiBriefcase className="inline mr-1.5 text-indigo-500" /> Service Entries: <strong>{discussion.relatedServiceEntries.length}</strong></span>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="text-sm text-gray-800 whitespace-pre-wrap">{discussion.description}</div>
          {discussion.attachments && (
            <div className="flex flex-wrap gap-2">
              {discussion.attachments.map((file, idx) => (
                <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <FiPaperclip className="h-3 w-3" /> {file}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {discussion.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">#{t}</span>)}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">{discussion.repliesList.length} Replies</h3>
          <div className="space-y-3">
            {discussion.repliesList.map(reply => (
              <div key={reply.id} className={`bg-white border rounded-xl p-4 ${reply.best ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <strong className="text-sm text-gray-900">{reply.author}</strong>
                  <span className="text-xs text-gray-400">{reply.time}</span>
                  {reply.best && <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1"><FiCheckCircle className="h-3 w-3" /> Best Answer</span>}
                </div>
                <div className="text-sm text-gray-700">{reply.content}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Write a reply...</h4>
          <MentionsInput
            placeholder="Write your reply... Supports Markdown"
            className="w-full"
            style={{
              control: { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', minHeight: '80px' },
              highlighter: { padding: '0.65rem' },
              input: { padding: '0.65rem', border: 'none', outline: 'none' },
              suggestions: { list: { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', zIndex: 100 }, item: { padding: '5px 10px', borderBottom: '1px solid #f1f5f9' } }
            }}
          >
            <Mention trigger="@" data={STAFF_SUGGESTIONS} markup="@[__display__](__id__)" displayTransform={(id, display) => `@${display}`} />
          </MentionsInput>
          <div className="flex justify-end gap-2 mt-3">
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">Post Reply</button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-full lg:w-64 flex-shrink-0 space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Discussion Details</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-medium text-gray-900">{discussion.status}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className="font-medium text-gray-900">{discussion.priority}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Category</span><span className="font-medium text-gray-900">{discussion.category}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Service</span><span className="font-medium text-gray-900">{discussion.service || 'None'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="font-medium text-gray-900">{discussion.author}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Views</span><span className="font-medium text-gray-900">{discussion.views}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Replies</span><span className="font-medium text-gray-900">{discussion.replies}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Followers</span><span className="font-medium text-gray-900">{discussion.followers}</span></div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Actions</div>
          <div className="space-y-1.5">
            <button className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 px-2 py-1.5 rounded-lg transition" onClick={() => toast.info('Bookmarked')}>
              <FiBookmark className="h-4 w-4" /> Bookmark
            </button>
            <button className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 px-2 py-1.5 rounded-lg transition" onClick={() => toast.info('Watching')}>
              <FiEye className="h-4 w-4" /> Watch
            </button>
            <button className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 px-2 py-1.5 rounded-lg transition" onClick={() => toast.info('Shared')}>
              <FiShare2 className="h-4 w-4" /> Share
            </button>
            <ConvertDropdown onConvert={handleConvert} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Tags</div>
          <div className="flex flex-wrap gap-1">
            {discussion.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">#{t}</span>)}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">People</div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs bg-gray-100 px-2 py-1 rounded-full"><span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold">A</span> Admin</div>
            <div className="flex items-center gap-1.5 text-xs bg-gray-100 px-2 py-1 rounded-full"><span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold">S</span> Sneha M</div>
            <div className="flex items-center gap-1.5 text-xs bg-gray-100 px-2 py-1 rounded-full"><span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] font-bold">R</span> Rahul K</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Similar Discussions</div>
          {discussion.similar.map((s, idx) => (
            <div key={idx} className="py-1.5 border-b border-gray-100 last:border-0 cursor-pointer hover:text-indigo-600 transition" onClick={() => navigateTo('discussions')}>
              <div className="text-sm text-gray-800">{s.title}</div>
              <div className="text-xs text-gray-400">{s.replies} replies</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Knowledge Base
const KnowledgePage = ({ navigateTo }) => (
  <div>
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h2 className="text-xl font-bold text-gray-900">Knowledge Base</h2>
      <div className="flex gap-2">
        <input type="text" placeholder="Search articles..." className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
          <option>All Categories</option>
          {DATA.categories.map(cat => (<option key={cat.id}>{cat.label}</option>))}
        </select>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {DATA.articles.map(article => <ArticleCard key={article.id} article={article} onClick={() => navigateTo('knowledge')} />)}
    </div>
  </div>
);

// Learning Center
const LearningPage = ({ navigateTo }) => {
  const services = ['Passport', 'Aadhaar', 'eDistrict', 'Ration Card'];
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Learning Center</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map(service => {
          const materials = DATA.training.filter(t => t.service === service);
          return (
            <div key={service} className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition" onClick={() => navigateTo('training')}>
              <div className="font-semibold text-gray-900 mb-2">{service}</div>
              {materials.length > 0 ? materials.map(m => (
                <div key={m.id} className="flex items-center gap-2 text-sm py-1 border-b border-gray-50 last:border-0">
                  <span className="text-lg">{m.type.includes('Video') ? '🎬' : m.type.includes('PDF') ? '📄' : '📚'}</span>
                  <span className="flex-1 text-gray-700">{m.title}</span>
                  <span className="text-xs text-gray-400">{m.duration}</span>
                </div>
              )) : <div className="text-sm text-gray-400 py-2">No materials yet</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Announcements
const AnnouncementsPage = ({ navigateTo }) => {
  const [filter, setFilter] = useState('all');
  const filtered = DATA.announcements.filter(a => filter === 'all' || a.category === filter);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-gray-900">Announcements</h2>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
          <option value="all">All</option>
          <option value="government">Government</option>
          <option value="centre">Centre</option>
          <option value="software">Software</option>
          <option value="training">Training</option>
        </select>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        {filtered.map((a, idx) => <AnnouncementItem key={idx} announcement={a} onClick={() => navigateTo('announcements')} />)}
      </div>
    </div>
  );
};

// Tags
const TagsPage = ({ navigateTo, handleTagClick }) => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">All Tags</h2>
    <div className="flex flex-wrap gap-2 mb-6">
      {DATA.allTags.map(tag => (
        <span key={tag.name} className="px-3 py-1.5 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 border border-transparent hover:border-indigo-200 rounded-full text-sm font-medium text-gray-700 cursor-pointer transition-all" onClick={() => handleTagClick(tag.name)}>
          {tag.name} <span className="text-gray-400 font-normal ml-1">{tag.count}</span>
        </span>
      ))}
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-3">Discussions by Tag</h3>
    <div className="space-y-2">
      {DATA.discussions.slice(0, 3).map(d => <DiscussionCard key={d.id} discussion={d} onClick={() => navigateTo('discussions')} />)}
    </div>
  </div>
);

// My Workspace sub-pages (Mentions, Drafts, etc.)
const MentionsPage = ({ navigateTo }) => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">Mentions</h2>
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      {DATA.myMentions.map((m, idx) => (
        <div key={idx} className="p-2 bg-white border border-gray-200 rounded-xl hover:border-indigo-200 transition cursor-pointer" onClick={() => navigateTo('discussions')}>
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><FiAtSign className="h-4 w-4" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{m.title}</div>
              <div className="text-xs text-gray-500 line-clamp-1">{m.excerpt}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{m.time}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const DraftsPage = ({ navigateTo }) => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">My Drafts</h2>
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      {DATA.drafts.map((d, idx) => (
        <div key={idx} className="p-2 bg-white border border-gray-200 rounded-xl opacity-80">
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center"><FiFile className="h-4 w-4" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{d.title}</div>
              <div className="text-[10px] text-gray-400">Updated {d.updated}</div>
              <button className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-0.5" onClick={() => navigateTo('discussions')}>Continue editing →</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const BookmarksPage = () => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">Bookmarks</h2>
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
      <FiBookmark className="h-12 w-12 mx-auto mb-3 text-gray-300" />
      <p>You haven't bookmarked any discussions yet.</p>
    </div>
  </div>
);

const FollowingPage = () => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">Following</h2>
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
      <FiUserPlus className="h-12 w-12 mx-auto mb-3 text-gray-300" />
      <p>You aren't following any discussions yet.</p>
    </div>
  </div>
);

const HistoryPage = () => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">History</h2>
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
      <FiClock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
      <p>No recent history.</p>
    </div>
  </div>
);

const NotificationsPage = () => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">Notifications</h2>
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><FiMessageSquare className="h-4 w-4" /></div>
        <div className="flex-1">
          <p className="text-sm text-gray-700"><strong>Sneha M</strong> replied to <span className="text-indigo-600 font-medium">Passport Police Verification Delay</span></p>
          <span className="text-xs text-gray-400">2 hours ago</span>
        </div>
      </div>
      <div className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><FiCheckCircle className="h-4 w-4" /></div>
        <div className="flex-1">
          <p className="text-sm text-gray-700"><span className="text-indigo-600 font-medium">Income Certificate Rejected</span> was marked as solved</p>
          <span className="text-xs text-gray-400">Yesterday</span>
        </div>
      </div>
      <div className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition">
        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><FiBell className="h-4 w-4" /></div>
        <div className="flex-1">
          <p className="text-sm text-gray-700">New announcement: <span className="text-indigo-600 font-medium">Office Closed on 26th Jan</span></p>
          <span className="text-xs text-gray-400">2 days ago</span>
        </div>
      </div>
    </div>
  </div>
);

// Search Page with AI answer
const SearchPage = ({ query, navigateTo, openDiscussion, showAIAnswer }) => {
  const discussionResults = DATA.discussions.filter(d =>
    d.title.toLowerCase().includes(query.toLowerCase()) ||
    d.preview.toLowerCase().includes(query.toLowerCase())
  );
  const articleResults = DATA.articles.filter(a =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.desc.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Search: "{query}"</h2>
        <p className="text-sm text-gray-500">{discussionResults.length + articleResults.length} results found</p>
      </div>
      {showAIAnswer && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 text-indigo-700 font-semibold mb-1">
            <FiZap className="h-5 w-5" /> AI Answer
          </div>
          <p className="text-sm text-gray-700">
            Based on your query about Aadhaar correction, here's the summary: You can correct your Aadhaar DOB by visiting the e-Aadhaar portal or nearest enrolment centre. The process requires supporting documents (birth certificate, school certificate, etc.). For more details, see the <strong>Knowledge Article</strong> below.
          </p>
        </div>
      )}
      {discussionResults.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Discussions</h3>
          <div className="space-y-2">
            {discussionResults.map(d => <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />)}
          </div>
        </div>
      )}
      {articleResults.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Knowledge Articles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {articleResults.map(a => <ArticleCard key={a.id} article={a} onClick={() => navigateTo('knowledge')} />)}
          </div>
        </div>
      )}
      {discussionResults.length === 0 && articleResults.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FiSearch className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No results found. Try adjusting your search terms.</p>
        </div>
      )}
    </div>
  );
};

export default KnowledgeHub;