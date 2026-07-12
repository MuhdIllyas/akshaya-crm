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
  FiMenu, FiSettings, FiFile, FiLayers, FiFolder
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { MentionsInput, Mention } from 'react-mentions';
import { toast } from 'react-toastify';

// ---------------------------------------------------------------------
// MOCK DATA – Replace with API calls
// ---------------------------------------------------------------------
const DATA = {
  stats: {
    discussions: 145,
    articles: 48,
    announcements: 18,
    trainings: 27,
    openQuestions: 13,
  },
  trending: [
    { name: 'Passport Delay', count: 23 },
    { name: 'Income Certificate', count: 18 },
    { name: 'Ration Card', count: 14 },
    { name: 'Aadhaar', count: 12 },
    { name: 'Police Verification', count: 9 },
  ],
  announcements: [
    { pinned: true, title: 'Office Closed on 26th Jan', time: '2 hours ago' },
    { pinned: true, title: 'New Circular: Passport SOP Updated', time: '5 hours ago' },
    { pinned: false, title: 'CRM Software Update v2.4.1', time: '1 day ago' },
    { pinned: false, title: 'Training Session on eDistrict', time: '3 days ago' },
  ],
  discussions: [
    {
      id: 1,
      type: 'question',
      title: 'Passport Police Verification Delay',
      preview: 'Customer reported that police verification is taking more than 15 days...',
      tags: ['Passport', 'Urgent', 'Police'],
      replies: 12,
      views: 142,
      lastReply: '2 hours ago',
      author: 'Admin',
      solved: true,
      service: 'Passport',
    },
    {
      id: 2,
      type: 'question',
      title: 'Income Certificate Rejected – Missing Signature',
      preview: 'The eDistrict portal rejected the application citing missing officer signature...',
      tags: ['eDistrict', 'Income Certificate'],
      replies: 8,
      views: 89,
      lastReply: 'Yesterday',
      author: 'Rahul K',
      solved: false,
      service: 'eDistrict',
    },
    {
      id: 3,
      type: 'bug',
      title: 'CRM: Service Entry Form Not Submitting',
      preview: 'When trying to save a new service entry, the form hangs and shows a 500 error...',
      tags: ['CRM', 'Bug', 'Developer'],
      replies: 3,
      views: 34,
      lastReply: '3 hours ago',
      author: 'Dev Team',
      solved: false,
      service: 'CRM',
    },
    {
      id: 4,
      type: 'idea',
      title: 'Suggestion: Bulk Upload for Service Entries',
      preview: 'It would save a lot of time if we could import services via CSV or Excel...',
      tags: ['Feature Request', 'Productivity'],
      replies: 5,
      views: 56,
      lastReply: '1 day ago',
      author: 'Sneha M',
      solved: false,
      service: 'CRM',
    },
    {
      id: 5,
      type: 'announcement',
      title: 'New Government Order on Ration Card Portability',
      preview: 'The Ministry has issued a new order allowing inter-state portability of ration cards...',
      tags: ['Ration Card', 'Government Order'],
      replies: 2,
      views: 203,
      lastReply: '4 days ago',
      author: 'Govt Desk',
      solved: false,
      service: 'Ration Card',
    },
  ],
  popular: [
    { id: 6, title: 'How to Apply for Aadhaar Correction Online', replies: 34, views: 512, tags: ['Aadhaar', 'Guide'] },
    { id: 7, title: 'Passport Tatkal vs Normal – Which is Faster?', replies: 28, views: 401, tags: ['Passport', 'FAQ'] },
    { id: 8, title: 'Income Tax Return Filing for FY 2025-26', replies: 19, views: 298, tags: ['Finance', 'ITR'] },
  ],
  myMentions: [
    { title: 'Passport Police Verification Delay', time: '2 mins ago', excerpt: '@you please check the status...' },
    { title: 'Income Certificate Rejected', time: 'Yesterday', excerpt: '@you can you resubmit with the corrected signature?' },
  ],
  drafts: [
    { title: 'Draft: Aadhaar Update Process', updated: '2 days ago' },
    { title: 'Draft: New Service Onboarding', updated: '5 days ago' },
  ],
  articles: [
    {
      id: 1,
      title: 'Passport Application SOP – Complete Guide',
      desc: 'Step-by-step standard operating procedure for passport applications...',
      category: 'Passport',
      updated: '2 days ago',
      readingTime: '8 min',
      author: 'Admin',
    },
    {
      id: 2,
      title: 'Income Certificate – How to Apply on eDistrict',
      desc: 'Detailed guide with screenshots for applying income certificate online...',
      category: 'eDistrict',
      updated: '1 week ago',
      readingTime: '6 min',
      author: 'Rahul K',
    },
    {
      id: 3,
      title: 'Ration Card Portability – New Rules Explained',
      desc: 'Everything you need to know about the new inter-state portability scheme...',
      category: 'Ration Card',
      updated: '3 days ago',
      readingTime: '5 min',
      author: 'Govt Desk',
    },
    {
      id: 4,
      title: 'Kerala PSC – One Time Registration Process',
      desc: 'How to register on the Kerala PSC portal for various exams...',
      category: 'Kerala PSC',
      updated: '2 weeks ago',
      readingTime: '4 min',
      author: 'Training Team',
    },
  ],
  allTags: [
    { name: 'Passport', count: 23 },
    { name: 'Aadhaar', count: 18 },
    { name: 'Finance', count: 44 },
    { name: 'Training', count: 17 },
    { name: 'eDistrict', count: 12 },
    { name: 'Ration Card', count: 14 },
    { name: 'Government Order', count: 9 },
    { name: 'CRM', count: 21 },
    { name: 'Bug', count: 8 },
    { name: 'Feature Request', count: 15 },
  ],
  training: [
    { id: 1, title: 'Passport Services – Complete Training', type: 'Video', duration: '45 min', modules: 6, updated: '1 week ago' },
    { id: 2, title: 'Aadhaar Update & Correction', type: 'PDF + Quiz', duration: '30 min', modules: 4, updated: '2 weeks ago' },
    { id: 3, title: 'eDistrict Portal Masterclass', type: 'Video + PDF', duration: '60 min', modules: 8, updated: '3 days ago' },
  ],
  discussionDetail: {
    id: 1,
    title: 'Passport Police Verification Delay',
    solved: true,
    type: 'question',
    tags: ['Passport', 'Urgent', 'Police'],
    service: 'Passport',
    author: 'Admin',
    created: 'Yesterday',
    views: 142,
    replies: 18,
    followers: 25,
    status: 'Solved',
    priority: 'High',
    category: 'Question',
    description: `We have a customer who applied for a passport renewal on 10th Jan. The police verification was scheduled on 15th Jan, but the verification officer has not visited yet. The customer has been calling the police station daily but no response.

We need guidance on how to escalate this issue. The customer's travel date is approaching (5th Feb) and they are very anxious.

Steps we've tried:
1. Called the police station – no response
2. Visited the station – officer not available
3. Raised a complaint on the passport portal – no update yet

Please suggest any other escalation channels or contacts.`,
    attachments: ['PDF_Verification.pdf', 'Screenshot_Status.png'],
    repliesList: [
      {
        id: 1,
        author: 'Sneha M',
        time: '1 hour ago',
        best: true,
        content: 'I faced a similar issue last month. What worked for me was contacting the DCP office directly. They have a dedicated passport cell. Here\'s the number: 0484-2567890. Also, you can file a grievance on the CPGRAMS portal – they respond within 48 hours.'
      },
      {
        id: 2,
        author: 'Rahul K',
        time: '2 hours ago',
        best: false,
        content: 'Additionally, you can ask the customer to check the status on the Passport Seva app. Sometimes the verification officer\'s contact details are available there. Also, try sending a formal email to the SP office with all the details.'
      },
      {
        id: 3,
        author: 'Admin',
        time: '3 hours ago',
        best: false,
        content: 'Thanks for the suggestions. I\'ll try the DCP office first thing tomorrow. Will update here once we get a resolution.'
      },
    ],
    similar: [
      { title: 'Police Verification Not Updating on Portal', replies: 7 },
      { title: 'Passport Application Stuck – No Verification', replies: 12 },
      { title: 'How to Expedite Police Verification?', replies: 5 },
    ]
  },
  categories: [
    { id: 'questions', label: 'Questions', icon: 'fa-circle-question', color: '#6366f1' },
    { id: 'ideas', label: 'Ideas', icon: 'fa-lightbulb', color: '#f59e0b' },
    { id: 'announcements', label: 'Announcements', icon: FiBell, color: '#ef4444' },
    { id: 'training', label: 'Training', icon: FiAward, color: '#10b981' },
    { id: 'problems', label: 'Problems', icon: 'fa-triangle-exclamation', color: '#eab308' },
    { id: 'bugs', label: 'Bugs', icon: 'fa-bug', color: '#f97316' },
    { id: 'government_orders', label: 'Government Orders', icon: 'fa-file-lines', color: '#8b5cf6' },
    { id: 'guides', label: 'Guides', icon: 'fa-book', color: '#06b6d4' },
  ]
};

// Staff suggestions for @mentions
const STAFF_SUGGESTIONS = [
  { id: 1, display: 'Admin' },
  { id: 2, display: 'Sneha M' },
  { id: 3, display: 'Rahul K' },
  { id: 4, display: 'Dev Team' },
  { id: 5, display: 'Govt Desk' },
];

// ---------------------------------------------------------------------
// HELPER COMPONENTS
// ---------------------------------------------------------------------

// Sidebar Navigation
const Sidebar = ({ active, onNavigate }) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: FiHome },
    { id: 'discussions', label: 'Discussions', icon: FiMessageCircle, count: DATA.stats.discussions },
    { id: 'knowledge', label: 'Knowledge Base', icon: FiBook, count: DATA.stats.articles },
    { id: 'announcements', label: 'Announcements', icon: FiBell, count: DATA.stats.announcements },
    { id: 'training', label: 'Training', icon: FiAward, count: DATA.stats.trainings },
    { id: 'tags', label: 'Tags', icon: FiTag },
    { id: 'bookmarks', label: 'Bookmarks', icon: FiBookmark },
    { id: 'mentions', label: 'Mentions', icon: FiAtSign, count: 3 },
    { id: 'history', label: 'History', icon: FiClock },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon"><FiZap className="h-5 w-5" /></div>
        <h1>Knowledge Hub</h1>
        <span className="badge">v2.0</span>
      </div>
      <div className="sidebar-nav">
        <div className="nav-label">💡 Knowledge Hub</div>
        {navItems.map(item => (
          <a
            key={item.id}
            className={`nav-link ${active === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
            {item.count && <span className="count">{item.count}</span>}
          </a>
        ))}
      </div>
      <div className="sidebar-footer">
        <div className="avatar">A</div>
        <div className="user-info">
          <div className="name">Admin User</div>
          <div className="role">System Admin</div>
        </div>
        <div className="settings-btn" onClick={() => onNavigate('settings')}>
          <FiSettings className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
};

// Top Bar with Global Search
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
    <div className="topbar">
      <button className="mobile-menu-btn" onClick={toggleMobileSidebar}>
        <FiMenu className="h-5 w-5" />
      </button>
      <div className="search-wrap">
        <FiSearch className="search-icon" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask Knowledge Hub..."
          value={query}
          onChange={(e) => onSearch(e.target.value)}
        />
        <span className="kbd">⌘K</span>
      </div>
      <div className="actions">
        <button onClick={() => onNavigate('notifications')} title="Notifications">
          <FiBell className="h-5 w-5" />
          <span className="dot"></span>
        </button>
        <button onClick={() => onNavigate('bookmarks')} title="Bookmarks">
          <FiBookmark className="h-5 w-5" />
        </button>
        <button onClick={() => onNavigate('mentions')} title="Mentions">
          <FiAtSign className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

// Stat Card
const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="stat-item">
    <div className={`icon-wrap ${color}`}><Icon className="h-5 w-5" /></div>
    <div className="info">
      <div className="num">{value}</div>
      <div className="label">{label}</div>
    </div>
  </div>
);

// Trending Tags
const TrendingTags = ({ tags, onTagClick }) => (
  <div className="trending-tags">
    {tags.map(tag => (
      <span key={tag.name} className="tag" onClick={() => onTagClick(tag.name)}>
        {tag.name} <span className="count">{tag.count}</span>
      </span>
    ))}
  </div>
);

// Announcement Item
const AnnouncementItem = ({ announcement, onClick }) => (
  <div className="announce-item" onClick={onClick}>
    {announcement.pinned ? <FiHeart className="pin" /> : <span style={{ width: 18 }}></span>}
    <div className="content">
      <div className="title">{announcement.title}</div>
      <div className="time">{announcement.time}</div>
    </div>
    {announcement.pinned && <span className="pinned-badge">Pinned</span>}
  </div>
);

// Discussion Card (used in lists)
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
    question: 'question',
    idea: 'idea',
    announcement: 'announcement',
    training: 'training',
    bug: 'bug',
    problem: 'problem',
    guide: 'guide',
  };
  const typeClass = colorMap[discussion.type] || 'question';

  return (
    <div className="discuss-card" onClick={() => onClick(discussion.id)}>
      <div className="top">
        <div className={`icon ${typeClass}`}><Icon className="h-4 w-4" /></div>
        <div className="info">
          <div className="title">
            {discussion.title}
            {discussion.solved !== undefined && (
              <span className={`badge ${discussion.solved ? 'solved' : 'open'}`}>
                {discussion.solved ? 'Solved' : 'Open'}
              </span>
            )}
            {discussion.service && (
              <span className="service-tag">{discussion.service}</span>
            )}
          </div>
          <div className="preview">{discussion.preview}</div>
        </div>
      </div>
      <div className="bottom">
        <div className="meta"><FiUser className="h-3 w-3" /> {discussion.author}</div>
        <div className="meta"><FiClock className="h-3 w-3" /> {discussion.lastReply}</div>
        <div className="meta"><FiMessageSquare className="h-3 w-3" /> {discussion.replies}</div>
        <div className="meta"><FiEye className="h-3 w-3" /> {discussion.views}</div>
        <div className="tags">
          {discussion.tags.map(t => <span key={t} className="t">{t}</span>)}
        </div>
      </div>
    </div>
  );
};

// Knowledge Article Card
const ArticleCard = ({ article, onClick }) => (
  <div className="article-card" onClick={onClick}>
    <div className="title">{article.title}</div>
    <div className="desc">{article.desc}</div>
    <div className="meta">
      <span><FiFolder className="h-3 w-3" /> {article.category}</span>
      <span><FiUser className="h-3 w-3" /> {article.author}</span>
      <span><FiClock className="h-3 w-3" /> {article.updated}</span>
      <span><FiClock className="h-3 w-3" /> {article.readingTime}</span>
    </div>
  </div>
);

// ---------------------------------------------------------------------
// MAIN KNOWLEDGE HUB COMPONENT
// ---------------------------------------------------------------------
const KnowledgeHub = () => {
  const [page, setPage] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // For create discussion form
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

  // Navigation
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
    } else {
      setPage('home');
    }
  };

  const handleTagClick = (tagName) => {
    setSearchQuery(tagName);
    setPage('search');
  };

  const openDiscussionDetail = (id) => navigateTo('discussion-detail', id);

  // Create discussion modal handlers
  const addTag = () => {
    if (tagInput.trim() && !newDiscussion.tags.includes(tagInput.trim())) {
      setNewDiscussion(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };
  const removeTag = (tag) => {
    setNewDiscussion(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    // In real app, send to API
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
    // Refresh discussions list (mock)
  };

  // Toggle mobile sidebar
  const toggleMobileSidebar = () => setMobileSidebarOpen(prev => !prev);

  // Render page content based on current page
  const renderPage = () => {
    switch (page) {
      case 'home':
        return <HomePage navigateTo={navigateTo} handleTagClick={handleTagClick} openDiscussion={openDiscussionDetail} />;
      case 'discussions':
        return <DiscussionsPage navigateTo={navigateTo} openDiscussion={openDiscussionDetail} />;
      case 'discussion-detail':
        return <DiscussionDetailPage discussionId={selectedDiscussionId} navigateTo={navigateTo} />;
      case 'knowledge':
        return <KnowledgePage navigateTo={navigateTo} />;
      case 'announcements':
        return <AnnouncementsPage navigateTo={navigateTo} />;
      case 'training':
        return <TrainingPage navigateTo={navigateTo} />;
      case 'tags':
        return <TagsPage navigateTo={navigateTo} handleTagClick={handleTagClick} />;
      case 'bookmarks':
        return <BookmarksPage />;
      case 'mentions':
        return <MentionsPage navigateTo={navigateTo} />;
      case 'notifications':
        return <NotificationsPage />;
      case 'search':
        return <SearchPage query={searchQuery} navigateTo={navigateTo} openDiscussion={openDiscussionDetail} />;
      default:
        return <HomePage navigateTo={navigateTo} handleTagClick={handleTagClick} openDiscussion={openDiscussionDetail} />;
    }
  };

  return (
    <div className="main-wrap">
      {/* Sidebar - Desktop */}
      <Sidebar active={page} onNavigate={navigateTo} />

      {/* Main Content */}
      <div className="main-content">
        <TopBar
          onSearch={handleSearch}
          query={searchQuery}
          onNavigate={navigateTo}
          toggleMobileSidebar={toggleMobileSidebar}
        />

        <div className="page-content">
          {renderPage()}
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="mobile-sidebar open" onClick={() => setMobileSidebarOpen(false)}>
          <div className="inner" onClick={e => e.stopPropagation()}>
            <div className="mobile-sidebar-header">
              <div className="brand">
                <FiZap className="h-5 w-5" />
                <span>Knowledge Hub</span>
              </div>
              <button onClick={() => setMobileSidebarOpen(false)}>
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <Sidebar active={page} onNavigate={navigateTo} />
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button className="fab" onClick={() => setShowCreateModal(true)}>
        <FiPlus className="h-6 w-6" />
      </button>

      {/* Create Discussion Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="modal-box"
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Create Discussion</h2>
                <button className="close" onClick={() => setShowCreateModal(false)}>
                  <FiX className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreateSubmit}>
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={newDiscussion.title}
                    onChange={e => setNewDiscussion(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="What's your question or idea?"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <MentionsInput
                    value={newDiscussion.content}
                    onChange={(e, newValue) => setNewDiscussion(prev => ({ ...prev, content: newValue }))}
                    placeholder="Provide details... Use @ to mention a staff member"
                    className="mentions-input"
                    style={{
                      control: { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', minHeight: '80px' },
                      highlighter: { padding: '0.65rem' },
                      input: { padding: '0.65rem', border: 'none', outline: 'none' },
                      suggestions: {
                        list: { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', zIndex: 100 },
                        item: { padding: '5px 10px', borderBottom: '1px solid #f1f5f9' }
                      }
                    }}
                  >
                    <Mention
                      trigger="@"
                      data={STAFF_SUGGESTIONS}
                      markup="@[__display__](__id__)"
                      displayTransform={(id, display) => `@${display}`}
                    />
                  </MentionsInput>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={newDiscussion.category}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, category: e.target.value }))}
                    >
                      {DATA.categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      value={newDiscussion.priority}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, priority: e.target.value }))}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Related To</label>
                    <select
                      value={newDiscussion.relatedTo}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, relatedTo: e.target.value }))}
                    >
                      <option value="none">None</option>
                      <option value="customer">Customer</option>
                      <option value="service">Service</option>
                      <option value="task">Task</option>
                      <option value="team">Team</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Visibility</label>
                    <select
                      value={newDiscussion.visibility}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, visibility: e.target.value }))}
                    >
                      <option value="everyone">Everyone</option>
                      <option value="centre">Centre</option>
                      <option value="private">Private</option>
                      <option value="admins">Admins</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Tags</label>
                  <div className="tag-input-wrap">
                    {newDiscussion.tags.map(tag => (
                      <span key={tag} className="tag-pill">
                        {tag} <FiX className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                      </span>
                    ))}
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                      placeholder="Add a tag..."
                    />
                    <button type="button" onClick={addTag} className="add-tag-btn">Add</button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Attach Files</label>
                  <div className="file-drop-zone">
                    <FiPaperclip className="h-6 w-6" />
                    <p>Click or drag files to upload</p>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Publish</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------
// PAGE COMPONENTS
// ---------------------------------------------------------------------

// Home Page
const HomePage = ({ navigateTo, handleTagClick, openDiscussion }) => (
  <div>
    <div className="welcome-section">
      <h2>Welcome back, Admin 👋</h2>
      <p>Here's what's happening in your Knowledge Hub.</p>
    </div>

    <div className="stat-grid">
      <StatCard label="Discussions" value={DATA.stats.discussions} icon={FiMessageCircle} color="blue" />
      <StatCard label="Knowledge Articles" value={DATA.stats.articles} icon={FiBook} color="green" />
      <StatCard label="Announcements" value={DATA.stats.announcements} icon={FiBell} color="amber" />
      <StatCard label="Training Materials" value={DATA.stats.trainings} icon={FiAward} color="purple" />
      <StatCard label="Open Questions" value={DATA.stats.openQuestions} icon={FiAlertCircle} color="rose" />
    </div>

    <div className="trending-section">
      <h3>🔥 Trending Topics</h3>
      <TrendingTags tags={DATA.trending} onTagClick={handleTagClick} />
    </div>

    <div className="two-column-grid">
      <div>
        <div className="card">
          <div className="card-header">
            <h3><FiMessageCircle className="h-4 w-4" /> Recent Discussions</h3>
            <span className="see-all" onClick={() => navigateTo('discussions')}>View all →</span>
          </div>
          {DATA.discussions.slice(0, 4).map(d => (
            <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />
          ))}
        </div>
        <div className="card">
          <div className="card-header">
            <h3><FiStar className="h-4 w-4" /> Popular Discussions</h3>
          </div>
          {DATA.popular.map(p => (
            <div key={p.id} className="discuss-card" onClick={() => navigateTo('discussions')}>
              <div className="top">
                <div className="icon" style={{ background: '#fef3c7', color: '#d97706' }}><FiHeart className="h-4 w-4" /></div>
                <div className="info">
                  <div className="title">{p.title}</div>
                  <div className="bottom" style={{ marginTop: 2 }}>
                    <span className="meta"><FiMessageSquare className="h-3 w-3" /> {p.replies} replies</span>
                    <span className="meta"><FiEye className="h-3 w-3" /> {p.views} views</span>
                    {p.tags.map(t => <span key={t} className="t">{t}</span>)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="card">
          <div className="card-header">
            <h3><FiAtSign className="h-4 w-4" /> My Mentions</h3>
            <span className="see-all" onClick={() => navigateTo('mentions')}>View all →</span>
          </div>
          {DATA.myMentions.map((m, idx) => (
            <div key={idx} className="discuss-card" onClick={() => navigateTo('discussions')}>
              <div className="top">
                <div className="icon" style={{ background: '#ede9fe', color: '#7c3aed' }}><FiAtSign className="h-4 w-4" /></div>
                <div className="info">
                  <div className="title">{m.title}</div>
                  <div className="preview">{m.excerpt}</div>
                  <div className="meta">{m.time}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-header">
            <h3><FiEdit2 className="h-4 w-4" /> Draft Discussions</h3>
            <span className="see-all" onClick={() => navigateTo('discussions')}>View all →</span>
          </div>
          {DATA.drafts.map((d, idx) => (
            <div key={idx} className="discuss-card" style={{ opacity: 0.7 }}>
              <div className="top">
                <div className="icon" style={{ background: '#f1f5f9', color: '#64748b' }}><FiFile className="h-4 w-4" /></div>
                <div className="info">
                  <div className="title">{d.title}</div>
                  <div className="meta">Updated {d.updated}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="card">
      <div className="card-header">
        <h3><FiBell className="h-4 w-4" /> Latest Announcements</h3>
        <span className="see-all" onClick={() => navigateTo('announcements')}>View all →</span>
      </div>
      {DATA.announcements.map((a, idx) => (
        <AnnouncementItem key={idx} announcement={a} onClick={() => navigateTo('announcements')} />
      ))}
    </div>
  </div>
);

// Discussions List Page
const DiscussionsPage = ({ navigateTo, openDiscussion }) => {
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('latest');

  const filtered = useMemo(() => {
    let list = DATA.discussions;
    if (filterCategory !== 'all') {
      list = list.filter(d => d.type === filterCategory);
    }
    if (filterStatus !== 'all') {
      list = list.filter(d => filterStatus === 'solved' ? d.solved : !d.solved);
    }
    // Sort
    if (sortBy === 'latest') {
      list = list.slice().sort((a, b) => new Date(b.lastReply) - new Date(a.lastReply));
    } else if (sortBy === 'replies') {
      list = list.slice().sort((a, b) => b.replies - a.replies);
    } else if (sortBy === 'views') {
      list = list.slice().sort((a, b) => b.views - a.views);
    }
    return list;
  }, [filterCategory, filterStatus, sortBy]);

  return (
    <div>
      <div className="page-header">
        <h2>Discussions</h2>
        <div className="filters">
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {DATA.categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="solved">Solved</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="latest">Latest</option>
            <option value="replies">Most Replies</option>
            <option value="views">Most Views</option>
          </select>
        </div>
      </div>
      <div className="discussion-list">
        {filtered.map(d => (
          <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <FiMessageCircle className="h-12 w-12" />
            <p>No discussions found</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Discussion Detail Page
const DiscussionDetailPage = ({ discussionId, navigateTo }) => {
  const discussion = DATA.discussionDetail; // In real app, fetch by ID
  if (!discussion) return <div>Discussion not found</div>;

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

  return (
    <div className="detail-layout">
      <div className="detail-main">
        <div className="detail-header">
          <div className="detail-meta">
            <span className="type-badge">
              <Icon className="h-3 w-3" /> {discussion.type.charAt(0).toUpperCase() + discussion.type.slice(1)}
            </span>
            <span className={`status-badge ${discussion.solved ? 'solved' : 'open'}`}>
              {discussion.solved ? 'Solved' : 'Open'}
            </span>
            <span className="service-tag">{discussion.service}</span>
          </div>
          <h2>{discussion.title}</h2>
          <div className="detail-actions">
            <span><FiUser className="h-3 w-3" /> {discussion.author}</span>
            <span><FiClock className="h-3 w-3" /> {discussion.created}</span>
            <span><FiEye className="h-3 w-3" /> {discussion.views} views</span>
            <span><FiMessageSquare className="h-3 w-3" /> {discussion.replies} replies</span>
          </div>
        </div>

        <div className="detail-body card">
          <div className="description">{discussion.description}</div>
          {discussion.attachments && (
            <div className="attachments">
              {discussion.attachments.map((file, idx) => (
                <span key={idx}><FiPaperclip className="h-3 w-3" /> {file}</span>
              ))}
            </div>
          )}
          <div className="tags">
            {discussion.tags.map(t => <span key={t} className="t">#{t}</span>)}
          </div>
        </div>

        <div className="replies-section">
          <h3>{discussion.repliesList.length} Replies</h3>
          {discussion.repliesList.map(reply => (
            <div key={reply.id} className={`reply-card ${reply.best ? 'best' : ''}`}>
              <div className="reply-header">
                <strong>{reply.author}</strong>
                <span className="reply-time">{reply.time}</span>
                {reply.best && <span className="best-badge"><FiCheckCircle className="h-3 w-3" /> Best Answer</span>}
              </div>
              <div className="reply-content">{reply.content}</div>
            </div>
          ))}
        </div>

        <div className="reply-editor card">
          <h4>Write a reply...</h4>
          <MentionsInput
            placeholder="Write your reply... Supports Markdown"
            className="mentions-input"
            style={{
              control: { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', minHeight: '80px' },
              highlighter: { padding: '0.65rem' },
              input: { padding: '0.65rem', border: 'none', outline: 'none' },
              suggestions: {
                list: { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', zIndex: 100 },
                item: { padding: '5px 10px', borderBottom: '1px solid #f1f5f9' }
              }
            }}
          >
            <Mention
              trigger="@"
              data={STAFF_SUGGESTIONS}
              markup="@[__display__](__id__)"
              displayTransform={(id, display) => `@${display}`}
            />
          </MentionsInput>
          <div className="reply-actions">
            <button className="btn-secondary">Cancel</button>
            <button className="btn-primary">Post Reply</button>
          </div>
        </div>
      </div>

      <div className="detail-sidebar">
        <div className="block">
          <div className="label">Discussion Details</div>
          <div className="row"><span className="key">Status</span><span className="value">{discussion.status}</span></div>
          <div className="row"><span className="key">Priority</span><span className="value">{discussion.priority}</span></div>
          <div className="row"><span className="key">Category</span><span className="value">{discussion.category}</span></div>
          <div className="row"><span className="key">Service</span><span className="value">{discussion.service || 'None'}</span></div>
          <div className="row"><span className="key">Created</span><span className="value">{discussion.author}</span></div>
          <div className="row"><span className="key">Views</span><span className="value">{discussion.views}</span></div>
          <div className="row"><span className="key">Replies</span><span className="value">{discussion.replies}</span></div>
          <div className="row"><span className="key">Followers</span><span className="value">{discussion.followers}</span></div>
        </div>
        <div className="block">
          <div className="label">Tags</div>
          <div className="tags-mini">
            {discussion.tags.map(t => <span key={t} className="t">#{t}</span>)}
          </div>
        </div>
        <div className="block">
          <div className="label">People</div>
          <div className="people">
            <div className="p"><span className="dot">A</span> Admin</div>
            <div className="p"><span className="dot" style={{ background: '#10b981' }}>S</span> Sneha M</div>
            <div className="p"><span className="dot" style={{ background: '#f59e0b' }}>R</span> Rahul K</div>
          </div>
        </div>
        <div className="block">
          <div className="label">Similar Discussions</div>
          {discussion.similar.map((s, idx) => (
            <div key={idx} className="similar-item" onClick={() => navigateTo('discussions')}>
              <div className="title">{s.title}</div>
              <div className="meta">{s.replies} replies</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Knowledge Base Page
const KnowledgePage = ({ navigateTo }) => (
  <div>
    <div className="page-header">
      <h2>Knowledge Base</h2>
      <div className="filters">
        <input type="text" placeholder="Search articles..." className="search-input" />
        <select>
          <option>All Categories</option>
          {DATA.categories.map(cat => (
            <option key={cat.id}>{cat.label}</option>
          ))}
        </select>
      </div>
    </div>
    <div className="article-grid">
      {DATA.articles.map(article => (
        <ArticleCard key={article.id} article={article} onClick={() => navigateTo('knowledge')} />
      ))}
    </div>
  </div>
);

// Announcements Page
const AnnouncementsPage = ({ navigateTo }) => (
  <div>
    <h2>Announcements</h2>
    <div className="card">
      {DATA.announcements.map((a, idx) => (
        <AnnouncementItem key={idx} announcement={a} onClick={() => navigateTo('announcements')} />
      ))}
    </div>
  </div>
);

// Training Page
const TrainingPage = ({ navigateTo }) => (
  <div>
    <h2>Training Materials</h2>
    <div className="training-grid">
      {DATA.training.map(t => (
        <div key={t.id} className="training-card" onClick={() => navigateTo('training')}>
          <div className="training-icon">
            {t.type.includes('Video') ? '🎬' : t.type.includes('PDF') ? '📄' : '📚'}
          </div>
          <div className="training-info">
            <div className="title">{t.title}</div>
            <div className="meta">{t.type} · {t.duration}</div>
            <div className="meta"><FiLayers className="h-3 w-3" /> {t.modules} modules</div>
          </div>
          <div className="training-updated">{t.updated}</div>
        </div>
      ))}
    </div>
  </div>
);

// Tags Page
const TagsPage = ({ navigateTo, handleTagClick }) => (
  <div>
    <h2>All Tags</h2>
    <div className="tags-list">
      {DATA.allTags.map(tag => (
        <span key={tag.name} className="tag" onClick={() => handleTagClick(tag.name)}>
          {tag.name} <span className="count">{tag.count}</span>
        </span>
      ))}
    </div>
    <div className="tag-discussions">
      <h3>Discussions by Tag</h3>
      {DATA.discussions.slice(0, 3).map(d => (
        <DiscussionCard key={d.id} discussion={d} onClick={() => navigateTo('discussions')} />
      ))}
    </div>
  </div>
);

// Mentions Page
const MentionsPage = ({ navigateTo }) => (
  <div>
    <h2>Mentions</h2>
    <div className="card">
      {DATA.myMentions.map((m, idx) => (
        <div key={idx} className="discuss-card" onClick={() => navigateTo('discussions')}>
          <div className="top">
            <div className="icon" style={{ background: '#ede9fe', color: '#7c3aed' }}><FiAtSign className="h-4 w-4" /></div>
            <div className="info">
              <div className="title">{m.title}</div>
              <div className="preview">{m.excerpt}</div>
              <div className="meta">{m.time}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Bookmarks Page
const BookmarksPage = () => (
  <div>
    <h2>Bookmarks</h2>
    <div className="card empty-state">
      <FiBookmark className="h-12 w-12" />
      <p>You haven't bookmarked any discussions yet.</p>
    </div>
  </div>
);

// Notifications Page
const NotificationsPage = () => (
  <div>
    <h2>Notifications</h2>
    <div className="card">
      <div className="notification-item">
        <div className="notification-icon" style={{ background: '#eef2ff', color: '#6366f1' }}><FiMessageSquare /></div>
        <div className="notification-content">
          <p><strong>Sneha M</strong> replied to <span className="highlight">Passport Police Verification Delay</span></p>
          <span className="time">2 hours ago</span>
        </div>
      </div>
      <div className="notification-item">
        <div className="notification-icon" style={{ background: '#ecfdf5', color: '#10b981' }}><FiCheckCircle /></div>
        <div className="notification-content">
          <p><span className="highlight">Income Certificate Rejected</span> was marked as solved</p>
          <span className="time">Yesterday</span>
        </div>
      </div>
      <div className="notification-item">
        <div className="notification-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}><FiBell /></div>
        <div className="notification-content">
          <p>New announcement: <span className="highlight">Office Closed on 26th Jan</span></p>
          <span className="time">2 days ago</span>
        </div>
      </div>
    </div>
  </div>
);

// Search Page
const SearchPage = ({ query, navigateTo, openDiscussion }) => {
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
      <div className="search-header">
        <h2>Search: "{query}"</h2>
        <p>{discussionResults.length + articleResults.length} results found</p>
      </div>
      {discussionResults.length > 0 && (
        <div className="search-section">
          <h3>Discussions</h3>
          {discussionResults.map(d => (
            <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />
          ))}
        </div>
      )}
      {articleResults.length > 0 && (
        <div className="search-section">
          <h3>Knowledge Articles</h3>
          {articleResults.map(a => (
            <ArticleCard key={a.id} article={a} onClick={() => navigateTo('knowledge')} />
          ))}
        </div>
      )}
      {discussionResults.length === 0 && articleResults.length === 0 && (
        <div className="empty-state">
          <FiSearch className="h-12 w-12" />
          <p>No results found. Try adjusting your search terms.</p>
        </div>
      )}
    </div>
  );
};

export default KnowledgeHub;