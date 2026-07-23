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
import ServiceWorkspace from './ServiceWorkspace'; // Our new dynamic component
import { getWorkflowServices } from '@/services/serviceService';
import { fetchGlobalHubStats } from '@/services/knowledge';

// =====================================================================
// FULL MOCK DATA (ENHANCED with all new features)
// =====================================================================
const DATA = {
  stats: {
    discussions: 145, articles: 48, announcements: 18, trainings: 27, openQuestions: 13, unreadMentions: 3, cases: 76,
  },
  governmentUpdates: [
    { id: 1, title: 'New Passport Verification SOP – Effective 1st April', date: '2 hours ago', type: 'circular', priority: 'high' },
    { id: 2, title: 'Aadhaar Enrolment Guidelines Updated', date: 'Yesterday', type: 'order', priority: 'medium' },
    { id: 3, title: 'Ration Card Portability Scheme Announced', date: '3 days ago', type: 'circular', priority: 'high' },
  ],
  trending: [
    { name: 'Passport Delay', count: 23 }, { name: 'Income Certificate', count: 18 }, { name: 'Ration Card', count: 14 },
    { name: 'Aadhaar', count: 12 }, { name: 'Police Verification', count: 9 },
  ],
  announcements: [
    { pinned: true, title: 'Office Closed on 26th Jan', time: '2 hours ago', category: 'centre' },
    { pinned: true, title: 'New Circular: Passport SOP Updated', time: '5 hours ago', category: 'government' },
    { pinned: false, title: 'CRM Software Update v2.4.1', time: '1 day ago', category: 'software' },
    { pinned: false, title: 'Training Session on eDistrict', time: '3 days ago', category: 'training' },
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
    },
    {
      id: 'rationcard', name: 'Ration Card', icon: FiDatabase,
      description: 'Ration card issuance, updates, portability, and grievances.',
      todayApplications: 3, pending: 2, latestCircular: 'Ration Card Portability Scheme Announced',
      relatedTags: ['Ration Card', 'Portability']
    },
    {
      id: 'psc', name: 'Kerala PSC', icon: FiUsers,
      description: 'Kerala PSC exam registration, updates, and training.',
      todayApplications: 2, pending: 1, latestCircular: 'PSC Exam Calendar 2026 Released',
      relatedTags: ['Kerala PSC', 'Exam']
    }
  ],
  discussions: [
    {
      id: 1, type: 'question', title: 'Passport Police Verification Delay', preview: 'Customer reported that police verification is taking more than 15 days...',
      tags: ['Passport', 'Urgent', 'Police'], replies: 12, views: 142, lastReply: '2 hours ago', author: 'Admin', solved: true, service: 'passport',
    },
    {
      id: 2, type: 'customer issue', title: 'Income Certificate Rejected – Missing Signature', preview: 'The eDistrict portal rejected the application citing missing officer signature...',
      tags: ['eDistrict', 'Income Certificate'], replies: 8, views: 89, lastReply: 'Yesterday', author: 'Rahul K', solved: false, service: 'edistrict',
    }
  ],
  solvedCases: [
    { id: 101, service: 'passport', title: 'Police Verification Delay Resolved', description: 'The issue was escalated to DCP office; verification completed in 2 days.', solvedBy: 'Admin', solvedDate: '2026-01-15', linkedDiscussion: 1, tags: ['Police', 'Delay'] }
  ],
  popular: [
    { id: 6, title: 'How to Apply for Aadhaar Correction Online', replies: 34, views: 512, tags: ['Aadhaar', 'Guide'] },
  ],
  myMentions: [
    { title: 'Passport Police Verification Delay', time: '2 mins ago', excerpt: '@you please check the status...' },
    { title: 'Income Certificate Rejected', time: 'Yesterday', excerpt: '@you can you resubmit with the corrected signature?' },
  ],
  drafts: [
    { title: 'Draft: Aadhaar Update Process', updated: '2 days ago' },
  ],
  articles: [
    { id: 1, title: 'Passport Application SOP – Complete Guide', desc: 'Step-by-step standard operating procedure for passport applications...', category: 'Passport', updated: '2 days ago', readingTime: '8 min', author: 'Admin', service: 'passport' },
  ],
  allTags: [
    { name: 'Passport', count: 23 }, { name: 'Aadhaar', count: 18 }, { name: 'Finance', count: 44 },
  ],
  training: [
    { id: 1, title: 'Passport Services – Complete Training', type: 'Video', duration: '45 min', service: 'passport' },
  ],
  discussionDetail: {
    id: 1, title: 'Passport Police Verification Delay', solved: true, type: 'question', tags: ['Passport', 'Urgent', 'Police'], service: 'passport',
    author: 'Admin', created: 'Yesterday', views: 142, replies: 18, followers: 25, status: 'Solved', priority: 'High', category: 'Question',
    description: `We have a customer who applied for a passport renewal on 10th Jan. The police verification was scheduled on 15th Jan, but the verification officer has not visited yet.`,
    repliesList: [
      { id: 1, author: 'Sneha M', time: '1 hour ago', best: true, content: 'I faced a similar issue last month. What worked for me was contacting the DCP office directly.' }
    ],
    similar: [{ title: 'Police Verification Not Updating on Portal', replies: 7 }],
  },
  categories: [
    { id: 'question', label: 'Question', icon: FiMessageSquare, color: '#6366f1' },
    { id: 'solved case', label: 'Solved Case', icon: FiCheckCircle, color: '#10b981' },
    { id: 'customer issue', label: 'Customer Issue', icon: FiUser, color: '#f59e0b' },
    { id: 'government order', label: 'Government Order', icon: FiFileText, color: '#8b5cf6' },
    { id: 'bug', label: 'Bug', icon: FiAlertCircle, color: '#f97316' },
    { id: 'feature', label: 'Feature', icon: FiZap, color: '#06b6d4' },
    { id: 'discussion', label: 'Discussion', icon: FiMessageCircleOutline, color: '#ef4444' },
    { id: 'suggestion', label: 'Suggestion', icon: FiThumbsUp, color: '#22c55e' },
  ],
  activityFeed: [
    { id: 1, type: 'solved', user: 'Admin', target: 'Passport Police Verification Delay', time: '10 mins ago' },
    { id: 2, type: 'article', user: 'Shafi', target: 'Aadhaar Correction SOP', time: '1 hour ago' },
  ],
  aiAssistantHistory: [
    { id: 1, query: 'How to correct Aadhaar DOB?', answer: 'Visit enrolment centre with birth certificate or school certificate.', timestamp: '2026-01-16 10:00 AM' },
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

const StatCard = ({ label, value, icon: Icon, color }) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600', purple: 'bg-purple-50 text-purple-600',
    rose: 'bg-rose-50 text-rose-600', indigo: 'bg-indigo-50 text-indigo-600',
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

const AnnouncementItem = ({ announcement, onClick }) => {
  const categoryColors = {
    government: 'bg-red-100 text-red-700', centre: 'bg-blue-100 text-blue-700',
    software: 'bg-green-100 text-green-700', training: 'bg-purple-100 text-purple-700',
  };
  const color = categoryColors[announcement.category] || 'bg-gray-100 text-gray-700';
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition" onClick={onClick}>
      {announcement.pinned ? <FiHeart className="text-amber-500 h-4 w-4 flex-shrink-0" /> : <span className="w-4 flex-shrink-0"></span>}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{announcement.title}</div>
        <div className="text-xs text-gray-400">{announcement.time}</div>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{announcement.category}</span>
    </div>
  );
};

const DiscussionCard = ({ discussion, onClick }) => {
  const typeMap = {
    question: { icon: FiMessageSquare, color: 'bg-blue-50 text-blue-600' },
    'customer issue': { icon: FiUser, color: 'bg-amber-50 text-amber-600' },
    bug: { icon: FiAlertCircle, color: 'bg-yellow-50 text-yellow-600' },
  };
  const { icon: Icon, color: typeClass } = typeMap[discussion.type] || { icon: FiMessageSquare, color: 'bg-gray-50 text-gray-600' };
  const serviceObj = DATA.services.find(s => s.id === discussion.service);
  const serviceName = serviceObj ? serviceObj.name : null;

  return (
    <div className="p-3 bg-white border border-gray-200 rounded-xl mb-2.5 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer" onClick={() => onClick(discussion.id)}>
      <div className="flex gap-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${typeClass}`}><Icon className="h-4 w-4" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-sm font-semibold text-gray-900">{discussion.title}</span>
            {discussion.solved !== undefined && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${discussion.solved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {discussion.solved ? 'Solved' : 'Open'}
              </span>
            )}
            {serviceName && <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{serviceName}</span>}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{discussion.preview}</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-400">
            <span><FiUser className="inline h-3 w-3 mr-0.5" /> {discussion.author}</span>
            <span><FiClock className="inline h-3 w-3 mr-0.5" /> {discussion.lastReply}</span>
            <span><FiMessageSquare className="inline h-3 w-3 mr-0.5" /> {discussion.replies}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ArticleCard = ({ article, onClick }) => {
  const serviceObj = DATA.services.find(s => s.id === article.service);
  const serviceName = serviceObj ? serviceObj.name : null;
  return (
    <div className="p-3 bg-white border border-gray-200 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer" onClick={onClick}>
      <div className="font-semibold text-sm text-gray-900">{article.title}</div>
      <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{article.desc}</div>
      <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-gray-400">
        <span><FiFolder className="inline h-3 w-3 mr-0.5" /> {article.category}</span>
        <span><FiUser className="inline h-3 w-3 mr-0.5" /> {article.author}</span>
        <span><FiClock className="inline h-3 w-3 mr-0.5" /> {article.updated}</span>
        {serviceName && <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{serviceName}</span>}
      </div>
    </div>
  );
};

const ActivityFeed = ({ activities }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
      <FiRefreshCw className="h-4 w-4 text-indigo-500" /> Recent Activity
    </h3>
    <div className="space-y-2">
      {activities.map(act => (
        <div key={act.id} className="flex items-start gap-2 text-sm">
          <span className="mt-0.5">
            {act.type === 'solved' && <FiCheckCircle className="h-4 w-4 text-emerald-500" />}
            {act.type === 'article' && <FiFileText className="h-4 w-4 text-blue-500" />}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-gray-700">
              <strong>{act.user}</strong> {act.type === 'solved' ? 'solved' : 'updated'}{' '}
              <span className="text-indigo-600 font-medium">{act.target}</span>
            </span>
            <span className="block text-xs text-gray-400">{act.time}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ConvertDropdown = ({ onConvert }) => {
  const [open, setOpen] = useState(false);
  const options = [{ label: 'Solved Case', icon: FiCheckCircle, action: 'case' }];
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition">
        <FiMoreHorizontal className="h-4 w-4" /> Convert
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
          {options.map(opt => (
            <div key={opt.action} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer" onClick={() => { onConvert(opt.action); setOpen(false); }}>
              <opt.icon className="h-4 w-4" /> {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// PAGE COMPONENTS
// =====================================================================

const HomePage = ({ services, hubStats, navigateTo, openDiscussion }) => {
  // THE FIX: Sort services by most pending, then slice to only show the Top 6!
  const topServices = [...services]
    .sort((a, b) => (b.pending || 0) - (a.pending || 0))
    .slice(0, 6);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome back, Admin 👋</h2>
        <p className="text-gray-500">Your operations hub – everything about your services at a glance.</p>
      </div>

      {/* THE FIX: Real Live Data for the Stat Cards! */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Discussions" value={hubStats.discussions} icon={FiMessageCircle} color="blue" />
        <StatCard label="Services" value={services.length} icon={FiGrid} color="green" />
        <StatCard label="Announcements" value={hubStats.announcements} icon={FiBell} color="amber" />
        <StatCard label="Trainings" value={hubStats.trainings} icon={FiAward} color="purple" />
        <StatCard label="Solved Cases" value={hubStats.cases} icon={FiCheckCircle} color="rose" />
        <StatCard label="Mentions" value={hubStats.mentions} icon={FiAtSign} color="indigo" />
      </div>

      <div className="flex items-center justify-between mt-8 mb-2">
        <h3 className="text-lg font-bold text-gray-900">High Priority Services</h3>
        <button onClick={() => navigateTo('services')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
          View All {services.length} Services &rarr;
        </button>
      </div>

      {/* THE FIX: Only map over the topServices (Max 6) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {topServices.map(service => (
          <div key={service.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition cursor-pointer" onClick={() => navigateTo('service-detail', service.id)}>
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <FiLayers className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 truncate">{service.name}</h4>
                <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">{service.description}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium border-t border-gray-100 pt-3">
              <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">Today: {service.todayApplications || 0}</span>
              <span className={`${(service.pending > 0) ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'} px-2 py-1 rounded-lg`}>
                Pending: {service.pending || 0}
              </span>
            </div>
          </div>
        ))}
      </div>

    <div className="bg-white border-l-4 border-red-500 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <FiFileText className="h-4 w-4 text-red-500" /> Government Updates
        </h3>
      </div>
      <div className="space-y-2">
        {DATA.governmentUpdates.map(update => (
          <div key={update.id} className="flex items-center gap-3 text-sm">
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700">{update.priority}</span>
            <span className="text-gray-700 flex-1">{update.title}</span>
            <span className="text-xs text-gray-400">{update.date}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><FiMessageCircle className="h-4 w-4 text-indigo-500" /> Unread Discussions</h3>
          {DATA.discussions.slice(0, 3).map(d => <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />)}
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><FiAtSign className="h-4 w-4 text-purple-500" /> My Mentions</h3>
          {DATA.myMentions.map((m, idx) => (
            <div key={idx} className="p-2 bg-white border border-gray-200 rounded-xl mb-2 cursor-pointer" onClick={() => navigateTo('mentions')}>
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><FiAtSign className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{m.title}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">{m.excerpt}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <ActivityFeed activities={DATA.activityFeed} />
      </div>
    </div>
  </div>
  );
};

const ServicesPage = ({ services, navigateTo, openServiceDetail }) => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">All Services</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* 2. Map over the "services" prop instead of DATA.services */}
      {services.map(service => (
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

const DiscussionsPage = ({ navigateTo, openDiscussion }) => (
  <div>
    <div className="flex justify-between mb-4">
      <h2 className="text-xl font-bold text-gray-900">Discussions</h2>
    </div>
    <div className="space-y-2">
      {DATA.discussions.map(d => <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />)}
    </div>
  </div>
);

const DiscussionDetailPage = ({ discussionId, navigateTo }) => {
  const discussion = DATA.discussionDetail;
  if (!discussion) return <div>Not found</div>;
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0 space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">{discussion.title}</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="text-sm text-gray-800 whitespace-pre-wrap">{discussion.description}</div>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Replies</h3>
        <div className="space-y-3">
          {discussion.repliesList.map(reply => (
            <div key={reply.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <strong className="text-sm text-gray-900">{reply.author}</strong>
              <div className="text-sm text-gray-700 mt-2">{reply.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const LearningPage = () => <div className="p-4">Learning Center - Coming Soon</div>;
const AnnouncementsPage = () => <div className="p-4">Announcements - Coming Soon</div>;
const TagsPage = () => <div className="p-4">Tags - Coming Soon</div>;
const BookmarksPage = () => <div className="p-4">Bookmarks - Coming Soon</div>;
const FollowingPage = () => <div className="p-4">Following - Coming Soon</div>;
const HistoryPage = () => <div className="p-4">History - Coming Soon</div>;
const MentionsPage = () => <div className="p-4">Mentions - Coming Soon</div>;
const DraftsPage = () => <div className="p-4">Drafts - Coming Soon</div>;
const NotificationsPage = () => <div className="p-4">Notifications - Coming Soon</div>;

const AIAssistantPage = () => {
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hello! I am your Akshaya Assistant.' }]);
  const [input, setInput] = useState('');
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Akshaya Assistant</h2>
      <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 mb-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`mb-3 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span className={`inline-block p-3 rounded-xl max-w-xl text-sm ${msg.role === 'user' ? 'bg-indigo-100 text-gray-800' : 'bg-gray-100 text-gray-800'}`}>
              {msg.content}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask a question..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none" />
        <button onClick={() => { setMessages([...messages, { role: 'user', content: input }]); setInput(''); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Send</button>
      </div>
    </div>
  );
};

const SearchPage = ({ query }) => (
  <div className="p-4"><h2 className="text-xl font-bold text-gray-900">Search: "{query}"</h2></div>
);


// =====================================================================
// MAIN SHELL COMPONENT
// =====================================================================
const OperationsHub = () => {
  const { serviceId } = useParams(); 

  const isDbId = serviceId && !isNaN(serviceId);

  const [page, setPage] = useState(isDbId ? 'service-detail' : (serviceId || 'home'));
  const [selectedServiceId, setSelectedServiceId] = useState(isDbId ? serviceId : null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // === 1. ADD THIS REAL DATABASE STATE ===
  const [realServices, setRealServices] = useState([]);
  const [hubStats, setHubStats] = useState({ discussions: 0, cases: 0, resources: 0, announcements: 0, trainings: 0, mentions: 0 });
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  // === 2. ADD THIS FETCH EFFECT ===
  useEffect(() => {
    const fetchRealServices = async () => {
      try {
        setIsLoadingServices(true);
        // CHANGE THIS LINE to use the new function:
        const response = await getWorkflowServices(); 
        
        const formatted = response.data.map(s => ({
          id: s.id, 
          name: s.name,
          icon: FiLayers,
          description: s.description || 'Manage operations for this service.',
          todayApplications: 0, 
          pending: 0,
        }));
        
        setRealServices(formatted);
      } catch (error) {
        console.error("Failed to load real services:", error);
        toast.error("Failed to load services");
      } finally {
        setIsLoadingServices(false);
      }
    };
    
    fetchRealServices();
  }, []);

  // === UPDATE THE FETCH EFFECT ===
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoadingServices(true);
        
        // Fetch Services AND Global Stats simultaneously
        const [servicesResponse, statsResponse] = await Promise.all([
           getWorkflowServices(),
           fetchGlobalHubStats() // The new API function we just added!
        ]);
        
        const formatted = servicesResponse.data.map(s => ({
          id: s.id, 
          name: s.name,
          description: s.description || 'Manage operations for this service.',
          // Note: If your getWorkflowServices backend doesn't return today_count yet, 
          // you can replace these with the real DB columns later!
          todayApplications: s.today_count || 0, 
          pending: s.pending_count || 0,
        }));
        
        setRealServices(formatted);
        setHubStats(statsResponse);

      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        toast.error("Failed to load operations dashboard");
      } finally {
        setIsLoadingServices(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  // Sync with URL changes
  useEffect(() => {
      if (serviceId) {
        if (!isNaN(serviceId)) {
          // It's a real database ID, open the workspace!
          setPage('service-detail');
          setSelectedServiceId(serviceId);
        } else {
          // It's just a text page like 'services' or 'home'
          setPage(serviceId); 
          setSelectedServiceId(null);
        }
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
    // Show a loader while fetching services from PostgreSQL
    if (isLoadingServices) return <div className="p-12 flex justify-center"><FiLoader className="animate-spin h-8 w-8 text-indigo-500" /></div>;

    switch (page) {
      case 'home': 
        return <HomePage services={realServices} hubStats={hubStats} navigateTo={navigateTo} openDiscussion={(id) => navigateTo('discussion-detail', id)} />;
      case 'services': 
        return <ServicesPage services={realServices} navigateTo={navigateTo} openServiceDetail={(id) => navigateTo('service-detail', id)} />;
      case 'service-detail': 
        return (
          <ServiceWorkspace 
            serviceId={selectedServiceId} 
            navigateTo={navigateTo} 
            // We use String() here just in case selectedServiceId from URL is a string but DB id is a number
            mockService={realServices.find(s => String(s.id) === String(selectedServiceId))} 
          />
        );
      case 'discussions': 
        return <DiscussionsPage navigateTo={navigateTo} openDiscussion={(id) => navigateTo('discussion-detail', id)} />;
      case 'discussion-detail': 
        return <DiscussionDetailPage discussionId={1} navigateTo={navigateTo} />;
      case 'learning': return <LearningPage navigateTo={navigateTo} />;
      case 'announcements': return <AnnouncementsPage navigateTo={navigateTo} />;
      case 'tags': return <TagsPage navigateTo={navigateTo} />;
      case 'bookmarks': return <BookmarksPage />;
      case 'mentions': return <MentionsPage navigateTo={navigateTo} />;
      case 'drafts': return <DraftsPage navigateTo={navigateTo} />;
      case 'following': return <FollowingPage />;
      case 'history': return <HistoryPage />;
      case 'notifications': return <NotificationsPage />;
      case 'ai-assistant': return <AIAssistantPage navigateTo={navigateTo} />;
      case 'search': return <SearchPage query={searchQuery} navigateTo={navigateTo} />;
      default: 
        return <HomePage navigateTo={navigateTo} />;
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