import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
  FiGrid, FiList, FiFilePlus, FiDatabase, FiServer, FiCloud,
  FiMessageCircle as FiChat, FiFileMinus, FiFilePlus as FiFileAdd,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { MentionsInput, Mention } from 'react-mentions';
import { toast } from 'react-toastify';
import ServiceWorkspace from './ServiceWorkspace';

// =====================================================================
// FULL MOCK DATA 
// =====================================================================
const DATA = {
  stats: { discussions: 145, articles: 48, announcements: 18, trainings: 27, openQuestions: 13, unreadMentions: 3, cases: 76 },
  governmentUpdates: [
    { id: 1, title: 'New Passport Verification SOP – Effective 1st April', date: '2 hours ago', type: 'circular', priority: 'high' },
    { id: 2, title: 'Aadhaar Enrolment Guidelines Updated', date: 'Yesterday', type: 'order', priority: 'medium' },
    { id: 3, title: 'Ration Card Portability Scheme Announced', date: '3 days ago', type: 'circular', priority: 'high' },
  ],
  trending: [
    { name: 'Passport Delay', count: 23 }, { name: 'Income Certificate', count: 18 }, { name: 'Ration Card', count: 14 }
  ],
  announcements: [
    { pinned: true, title: 'Office Closed on 26th Jan', time: '2 hours ago', category: 'centre' },
    { pinned: false, title: 'CRM Software Update v2.4.1', time: '1 day ago', category: 'software' },
  ],
  services: [
    {
      id: 'passport', name: 'Passport', icon: FiFileText,
      description: 'All services related to passport issuance, renewal, and police verification.',
      todayApplications: 12, pending: 8, latestCircular: 'New Passport Verification SOP – Effective 1st April',
      relatedTags: ['Passport', 'Police', 'Tatkal']
    },
    {
      id: 'aadhaar', name: 'Aadhaar', icon: FiServer,
      description: 'Aadhaar enrolment, update, and correction services.',
      todayApplications: 5, pending: 3, latestCircular: 'Aadhaar Enrolment Guidelines Updated',
      relatedTags: ['Aadhaar', 'UIDAI']
    },
    {
      id: 'edistrict', name: 'eDistrict', icon: FiCloud,
      description: 'eDistrict services including income certificate, caste certificate, and more.',
      todayApplications: 8, pending: 5, latestCircular: 'New eDistrict Services Launched',
      relatedTags: ['eDistrict', 'Income Certificate']
    }
  ],
  discussions: [], solvedCases: [], popular: [], myMentions: [], drafts: [], articles: [], allTags: [], training: [],
  categories: [
    { id: 'question', label: 'Question', icon: FiMessageSquare, color: '#6366f1' },
    { id: 'solved case', label: 'Solved Case', icon: FiCheckCircle, color: '#10b981' }
  ]
};

const STAFF_SUGGESTIONS = [
  { id: 1, display: 'Admin' }, { id: 2, display: 'Sneha M' }, { id: 3, display: 'Rahul K' }
];

// =====================================================================
// HELPER COMPONENTS
// =====================================================================

const Sidebar = ({ active, onNavigate }) => {
  const mainNav = [
    { id: 'home', label: 'Home', icon: FiHome },
    { id: 'services', label: 'Services', icon: FiGrid },
    { id: 'discussions', label: 'Discussions', icon: FiMessageCircle, count: DATA.stats.discussions },
    { id: 'learning', label: 'Learning Center', icon: FiAward, count: DATA.stats.trainings },
    { id: 'announcements', label: 'Announcements', icon: FiBell, count: DATA.stats.announcements },
    { id: 'ai-assistant', label: 'AI Assistant', icon: FiZap },
  ];
  const workspaceItems = [
    { id: 'mentions', label: 'Mentions', icon: FiAtSign, count: DATA.stats.unreadMentions },
    { id: 'bookmarks', label: 'Bookmarks', icon: FiBookmark },
    { id: 'drafts', label: 'Drafts', icon: FiFile, count: DATA.drafts.length },
    { id: 'following', label: 'Following', icon: FiUserPlus },
    { id: 'history', label: 'History', icon: FiClock },
  ];

  return (
    <div className="w-60 h-full bg-white border-r border-gray-200 flex flex-col overflow-y-auto flex-shrink-0">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm">
          <FiZap className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Operations Hub</h1>
        <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full ml-auto">v4.0</span>
      </div>

      <div className="flex-1 px-2.5 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-1.5">⚡ Operations</div>
        {mainNav.map(item => (
          <a
            key={item.id}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              active === item.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
              active === item.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.count && <span className="ml-auto bg-gray-200 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">{item.count}</span>}
          </a>
        ))}
      </div>
    </div>
  );
};

const TopBar = ({ onSearch, query, onNavigate, toggleMobileSidebar, onAIAssistant }) => {
  const inputRef = useRef(null);

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
      <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={toggleMobileSidebar}>
        <FiMenu className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-[180px] max-w-xl relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask Operations Hub (e.g., 'How to correct Aadhaar DOB?')"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-9 pr-14 py-2 bg-gray-100 border border-transparent rounded-full text-sm focus:outline-none focus:bg-white focus:border-gray-300 transition-all shadow-inner"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded border border-gray-300 font-mono">⌘K</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={onAIAssistant} className="relative p-2 rounded-full hover:bg-indigo-50 text-indigo-500 hover:text-indigo-700 transition" title="Ask Akshaya Assistant">
          <FiZap className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

const ServicesPage = ({ navigateTo, openServiceDetail }) => {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">All Services</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DATA.services.map(service => (
          <div key={service.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition cursor-pointer" onClick={() => openServiceDetail(service.id)}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><service.icon className="h-6 w-6" /></div>
              <div>
                <h3 className="font-semibold text-gray-900">{service.name}</h3>
                <p className="text-xs text-gray-500">{service.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// =====================================================================
// MAIN SHELL COMPONENT
// =====================================================================
const OperationsHub = () => {
  const { serviceId } = useParams(); // Gets ID from React Router

  // Initialize page to 'service-detail' if URL has an ID, else 'home'
  const [page, setPage] = useState(serviceId ? 'service-detail' : 'home');
  const [selectedServiceId, setSelectedServiceId] = useState(serviceId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Sync with URL changes
  useEffect(() => {
    if (serviceId) {
      setPage('service-detail');
      setSelectedServiceId(serviceId);
    }
  }, [serviceId]);

  const navigateTo = (target, id = null) => {
    if (target === 'service-detail' && id) {
      setPage('service-detail');
      setSelectedServiceId(id);
    } else {
      setPage(target);
      setSelectedServiceId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMobileSidebarOpen(false);
  };

  const renderPage = () => {
    switch (page) {
      case 'home': 
        return <HomePage navigateTo={navigateTo} handleTagClick={handleTagClick} openDiscussion={openDiscussionDetail} />;
      case 'services': 
        return <ServicesPage navigateTo={navigateTo} openServiceDetail={(id) => navigateTo('service-detail', id)} />;
      case 'service-detail': 
        // Our new dynamic workspace!
        return <ServiceWorkspace serviceId={selectedServiceId} navigateTo={navigateTo} mockService={DATA.services.find(s => s.id === selectedServiceId)} />;
      case 'discussions': 
        return <DiscussionsPage navigateTo={navigateTo} openDiscussion={openDiscussionDetail} />;
      case 'discussion-detail': 
        return <DiscussionDetailPage discussionId={selectedDiscussionId} navigateTo={navigateTo} />;
      case 'learning': 
        return <LearningPage navigateTo={navigateTo} />;
      case 'announcements': 
        return <AnnouncementsPage navigateTo={navigateTo} />;
      case 'tags': 
        return <TagsPage navigateTo={navigateTo} handleTagClick={handleTagClick} />;
      case 'bookmarks': 
        return <BookmarksPage />;
      case 'mentions': 
        return <MentionsPage navigateTo={navigateTo} />;
      case 'drafts': 
        return <DraftsPage navigateTo={navigateTo} />;
      case 'following': 
        return <FollowingPage />;
      case 'history': 
        return <HistoryPage />;
      case 'notifications': 
        return <NotificationsPage />;
      case 'ai-assistant': 
        return <AIAssistantPage navigateTo={navigateTo} aiQuery={aiQuery} setAiQuery={setAiQuery} />;
      case 'search': 
        return <SearchPage query={searchQuery} navigateTo={navigateTo} openDiscussion={openDiscussionDetail} showAIAnswer={showAIAnswer} />;
      default: 
        return <HomePage navigateTo={navigateTo} handleTagClick={handleTagClick} openDiscussion={openDiscussionDetail} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar active={page} onNavigate={navigateTo} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          onSearch={(q) => setSearchQuery(q)}
          query={searchQuery}
          onNavigate={navigateTo}
          toggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          onAIAssistant={() => navigateTo('ai-assistant')}
        />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {renderPage()}
        </div>
      </div>
    </div>
  );
};

export default OperationsHub;