import React, { useState, useEffect, useMemo } from 'react';
import {
  FiTrendingUp, FiTrendingDown, FiDollarSign, FiBriefcase,
  FiUsers, FiStar, FiCalendar, FiClock, FiAward, FiTarget,
  FiBarChart2, FiPieChart, FiCheckCircle, FiAlertCircle,
  FiRefreshCw, FiDownload, FiFilter, FiChevronRight, FiChevronLeft,
  FiUser, FiPhone, FiMail, FiMapPin, FiActivity, FiSmile,
  FiThumbsUp, FiThumbsDown, FiLoader, FiInfo, FiEye, FiZap, FiHeart, FiGift, FiX,
  FiMessageCircle, FiBookOpen, FiFlag, FiBell, FiUsers as FiTeam, FiAward as FiTrophy,
  FiCalendar as FiEvent, FiClock as FiTime, FiUserCheck, FiUserX, FiGift as FiBirthday,
  FiLogOut, FiMenu, FiGrid, FiList, FiPlus, FiEdit, FiTrash2
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  RadialLinearScale
} from 'chart.js';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';
import { toast } from 'react-toastify';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  RadialLinearScale
);

// Formatting utilities (reused from StaffPerformance)
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN', {
    maximumFractionDigits: 0
  })}`;
};

const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatTime = (time) => {
  if (!time) return '—';
  return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getDatesFromPeriod = (period) => {
  const toDate = new Date();
  let fromDate = new Date();

  switch (period) {
    case 'week':
      fromDate.setDate(fromDate.getDate() - fromDate.getDay()); // Sunday of this week
      break;
    case 'month':
      fromDate.setDate(1); // 1st of this month
      break;
    case 'quarter':
      fromDate.setMonth(Math.floor(fromDate.getMonth() / 3) * 3);
      fromDate.setDate(1); // 1st of current quarter
      break;
    case 'year':
      fromDate.setMonth(0);
      fromDate.setDate(1); // Jan 1st of this year
      break;
    default:
      fromDate.setDate(1); // Default to month
  }
  
  return { 
    from: fromDate.toISOString().split('T')[0], 
    to: toDate.toISOString().split('T')[0] 
  };
};

// ============ SUB-COMPONENTS ============

// Stat Card (reused from StaffPerformance)
const StatCard = ({ title, value, icon: Icon, color, subtitle, trend, onClick, loading, trendValue }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer p-5"
    onClick={onClick}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-600 mb-1 text-sm">{title}</p>
        {loading ? (
          <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
        ) : (
          <p className="font-bold text-gray-900 mb-1 text-2xl">{value}</p>
        )}
        {subtitle && (
          <p className="text-gray-500 text-sm">{subtitle}</p>
        )}
        {trend !== undefined && trendValue !== undefined && (
          <p className={`font-medium text-sm mt-1 flex items-center ${trendValue >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trendValue >= 0 ? <FiTrendingUp className="mr-1 h-3 w-3" /> : <FiTrendingDown className="mr-1 h-3 w-3" />}
            {Math.round(Math.abs(trendValue))}% {trend}
          </p>
        )}
      </div>
      <div className={`rounded-xl ${color} p-3`}>
        <Icon className="text-white h-6 w-6" />
      </div>
    </div>
  </motion.div>
);

const TargetProgressBar = ({ label, current, target }) => {
  const safeTarget = target || 1;
  const percentage = Math.min((current / safeTarget) * 100, 100).toFixed(0);
  const formatCurrency = (val) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val || 0);

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-600 font-semibold">{formatCurrency(current)} / {formatCurrency(target)} ({percentage}%)</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <motion.div 
          initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1 }}
          className={`h-2.5 rounded-full ${percentage >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
        />
      </div>
    </div>
  );
};

// Member Card
const MemberCard = ({ member, rank, isLeader }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
  >
    <div className="flex items-start justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
          {member.name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900">{member.name}</h4>
            {isLeader && <span className="text-amber-500" title="Team Leader">👑</span>}
            {member.is_online && <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online"></span>}
          </div>
          <p className="text-sm text-gray-500">{member.role || 'Member'}</p>
        </div>
      </div>
      {rank && (
        <div className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
          <FiTrophy className="h-3 w-3" />
          #{rank}
        </div>
      )}
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
      <div>
        <p className="text-gray-500 text-xs">Applications</p>
        <p className="font-semibold text-gray-900">{member.applications || 0}</p>
      </div>
      <div>
        <p className="text-gray-500 text-xs">Rating</p>
        <div className="flex items-center">
          <FiStar className="text-yellow-400 h-3 w-3 fill-current" />
          <span className="font-semibold text-gray-900 ml-1">{member.rating || 0}</span>
        </div>
      </div>
      <div>
        <p className="text-gray-500 text-xs">Revenue</p>
        <p className="font-semibold text-emerald-600">{formatCurrency(member.revenue || 0)}</p>
      </div>
    </div>
  </motion.div>
);

// Notice Item
const NoticeItem = ({ notice }) => (
  <div className="border-b border-gray-100 py-3 last:border-0">
    <div className="flex items-start gap-3">
      <div className="bg-blue-50 p-2 rounded-lg mt-0.5">
        <FiBell className="h-4 w-4 text-blue-600" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{notice.title}</p>
        <p className="text-xs text-gray-600 mt-1">{notice.content}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span>Posted by {notice.author}</span>
          <span>•</span>
          <span>{formatDate(notice.created_at)}</span>
        </div>
      </div>
    </div>
  </div>
);

// Event Item
const EventItem = ({ event }) => (
  <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
    <div className="bg-amber-50 p-2 rounded-lg mt-0.5">
      <FiEvent className="h-4 w-4 text-amber-600" />
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-900">{event.title}</p>
      <p className="text-xs text-gray-600">{formatDate(event.date)}</p>
      <p className="text-xs text-gray-500">{event.description}</p>
    </div>
  </div>
);

// Achievement Badge
const AchievementBadge = ({ achievement }) => (
  <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-3">
    <div className="text-3xl">{achievement.icon}</div>
    <div>
      <p className="font-semibold text-gray-900 text-sm">{achievement.title}</p>
      <p className="text-xs text-gray-600">{achievement.description}</p>
      {achievement.date && <p className="text-xs text-gray-400 mt-1">{formatDate(achievement.date)}</p>}
    </div>
  </div>
);

// ============ MAIN COMPONENT ============

const StaffTeamDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [notices, setNotices] = useState([]);
  const [events, setEvents] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [pendingWork, setPendingWork] = useState({});
  const [leaderMessage, setLeaderMessage] = useState(null);
  const [birthdays, setBirthdays] = useState([]);
  const [leaveStatus, setLeaveStatus] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [rank, setRank] = useState(null);
  const [period, setPeriod] = useState('month');
  const [performanceTrend, setPerformanceTrend] = useState(null);

  // Target Settings & Team Switcher State
  const [teamSettings, setTeamSettings] = useState({ targets_enabled: false, monthly_target: 250000 });
  const [myTeams, setMyTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [myUserId, setMyUserId] = useState(null);

  // 1. Initial Load: Get User Identity & Their Teams
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const token = localStorage.getItem('token');
        const payload = JSON.parse(atob(token.split(".")[1]));
        setMyUserId(payload.id);

        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/teams`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const teamsList = await res.json();
        
        if (teamsList && teamsList.length > 0) {
          setMyTeams(teamsList);
          const primaryTeam = teamsList.find(t => t.is_primary) || teamsList[0];
          setSelectedTeamId(primaryTeam.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load teams", err);
        setLoading(false);
      }
    };
    initializeDashboard();
  }, []);

  // 2. Fetch specific team data when selectedTeamId or period changes
  const fetchSpecificTeamData = async () => {
    if (!selectedTeamId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Calculate the from and to dates based on the dropdown
      const { from, to } = getDatesFromPeriod(period);

      // Set basic team info from the dropdown selection
      const currentTeam = myTeams.find(t => t.id === Number(selectedTeamId));
      if (currentTeam) setTeamData({ name: currentTeam.name, leader: 'Leader', member_count: currentTeam.member_count, status: 'active' });

      // Run real API calls (Passing from & to into the analytics summary!)
      const [summaryRes, contribRes, trendRes, mixRes, annRes, revRes, settingsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/teams/analytics/summary?team_id=${selectedTeamId}&from=${from}&to=${to}`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/api/teams/${selectedTeamId}/contribution`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/api/teams/${selectedTeamId}/trend?year=${new Date().getFullYear()}`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/api/teams/${selectedTeamId}/service-mix`, { headers }).catch(() => ({ ok: false })),
        fetch(`${import.meta.env.VITE_API_URL}/api/knowledge/hub/announcements?teamId=${selectedTeamId}`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/api/reviews/team/${selectedTeamId}`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/api/teams/${selectedTeamId}/settings`, { headers }).catch(() => ({ ok: false }))
      ]);

      const summary = await summaryRes.json();
      if (summary.teams && summary.teams.length > 0) setTeamStats(summary.teams[0]);
      
      setTeamMembers(await contribRes.json());
      
      if (trendRes.ok) {
        const trendData = await trendRes.json();
        setPerformanceTrend({
          labels: trendData.map(t => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][t.month - 1]),
          revenue: trendData.map(t => t.collected_revenue),
          applications: trendData.map(t => t.collected_revenue / 1000) // Mocking apps for the line chart
        });
      }

      if(mixRes.ok) setServiceMix(await mixRes.json());
      setAnnouncements(await annRes.json());
      
      if(revRes.ok) {
        const revData = await revRes.json();
        setReviews(revData.reviews.slice(0, 5));
      }

      if(settingsRes.ok) {
        setTeamSettings(await settingsRes.json());
      } else {
        setTeamSettings({ targets_enabled: false, monthly_target: 250000 });
      }

      // Mock remaining items (Notices, Events, etc.)
      setNotices([{ id: 1, title: 'Welcome to your team', content: 'Check out the new dashboard!', author: 'Admin' }]);
      setPendingWork({ pending_services: 14, pending_payments: 2500, applications_waiting: 8, documents_missing: 3 });

    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecificTeamData();
  }, [selectedTeamId, period]);

  // Compute team performance stats
  const teamStats = useMemo(() => {
    if (!teamMembers || teamMembers.length === 0) return null;
    const totalRevenue = teamMembers.reduce((sum, m) => sum + (m.revenue || 0), 0);
    const totalApps = teamMembers.reduce((sum, m) => sum + (m.applications || 0), 0);
    const avgRating = teamMembers.reduce((sum, m) => sum + (m.rating || 0), 0) / teamMembers.length;
    return {
      revenue: totalRevenue,
      applications: totalApps,
      avgRating: avgRating,
      members: teamMembers.length,
      target: teamData?.monthly_target || 300000,
      goalCompletion: Math.round((totalRevenue / (teamData?.monthly_target || 300000)) * 100)
    };
  }, [teamMembers, teamData]);

  // My stats from myStats
  const myContribution = useMemo(() => {
    if (!myStats) return null;
    return {
      applications: myStats.total_services || 0,
      collectedRevenue: myStats.total_collected || 0,
      serviceProfit: myStats.total_service_charges || 0,
      departmentPayments: myStats.total_department_charges || 0,
      expenses: myStats.total_expenses || 0,
      rating: myStats.csat_score || 0,
      pendingCollections: (myStats.total_billed || 0) - (myStats.total_collected || 0)
    };
  }, [myStats]);

  // Chart data for performance trend
  const trendChartData = useMemo(() => {
    if (!performanceTrend) return null;
    return {
      labels: performanceTrend.labels || [],
      datasets: [
        {
          label: 'Applications',
          data: performanceTrend.applications || [],
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Revenue (₹)',
          data: performanceTrend.revenue || [],
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1',
        }
      ]
    };
  }, [performanceTrend]);

  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            let value = context.raw;
            if (context.dataset.label?.includes('Revenue')) {
              return `${label}: ${formatCurrency(value)}`;
            }
            return `${label}: ${value}`;
          }
        }
      }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true, text: 'Applications', font: { size: 10 } },
        ticks: { font: { size: 10 } }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: { display: true, text: 'Revenue (₹)', font: { size: 10 } },
        grid: { drawOnChartArea: false },
        ticks: { 
          font: { size: 10 },
          callback: (value) => `₹${value/1000}k`
        }
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiLoader className="animate-spin h-10 w-10 text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading team dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* ========== HEADER ========== */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FiTeam className="text-indigo-600" />
              My Workspace
            </h1>
            <p className="text-gray-500 text-sm">Overview of your team's performance</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 mt-4 lg:mt-0 w-full lg:w-auto">
            
            {/* DATE / PERIOD FILTER */}
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 w-full sm:w-auto flex-1 sm:flex-none">
              <FiCalendar className="text-gray-400" />
              <select 
                value={period} 
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-transparent font-semibold text-gray-700 outline-none cursor-pointer w-full text-sm"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
              </select>
            </div>

            {/* THE TEAM SWITCHER */}
            {myTeams.length > 0 ? (
              <div className="flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 w-full sm:w-auto flex-1 sm:flex-none shadow-sm">
                <span className="text-sm text-indigo-500 font-medium whitespace-nowrap">Viewing:</span>
                <select 
                  value={selectedTeamId || ""} 
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className={`bg-transparent font-bold text-indigo-900 outline-none w-full text-sm ${myTeams.length > 1 ? 'cursor-pointer' : 'cursor-default appearance-none'}`}
                  disabled={myTeams.length === 1}
                >
                  {myTeams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} {team.is_primary ? '(Primary)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
               <div className="text-sm font-medium text-amber-700 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200 w-full sm:w-auto text-center">
                 No Teams Assigned
               </div>
            )}

            {/* REFRESH BUTTON */}
            <button
              onClick={fetchSpecificTeamData}
              className="p-2.5 bg-gray-50 rounded-lg hover:bg-gray-200 transition border border-gray-200 flex-shrink-0"
              disabled={loading}
              title="Refresh Dashboard"
            >
              <FiRefreshCw className={`h-5 w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ========== TEAM OVERVIEW ========== */}
        {teamData && (
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-5 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-3 rounded-xl">
                  <FiTeam className="text-white h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{teamData.name}</h2>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-1">
                    <span className="flex items-center gap-1">
                      <span className="text-amber-500">👑</span> Leader: {teamData.leader}
                    </span>
                    <span className="flex items-center gap-1">
                      <FiUsers /> {teamData.member_count} members
                    </span>
                    {teamData.is_primary && (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        Primary Team
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      Created {formatDate(teamData.created_at)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Monthly Target</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(teamData.monthly_target)}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  teamData.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {teamData.status === 'active' ? '🟢 Active' : '⚪ Inactive'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== TEAM PERFORMANCE ========== */}
        {teamStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Revenue"
              value={formatCurrency(teamStats.revenue)}
              icon={FiDollarSign}
              color="bg-emerald-600"
              loading={false}
              subtitle={`Goal: ${formatCurrency(teamStats.target)}`}
            />
            <StatCard
              title="Completed Services"
              value={teamStats.applications}
              icon={FiBriefcase}
              color="bg-blue-600"
              loading={false}
            />
            <StatCard
              title="Goal Completion"
              value={`${teamStats.goalCompletion}%`}
              icon={FiTarget}
              color="bg-purple-600"
              loading={false}
            />
            <StatCard
              title="Average Rating"
              value={teamStats.avgRating.toFixed(1) + '★'}
              icon={FiStar}
              color="bg-amber-600"
              loading={false}
              subtitle={`${teamStats.members} members`}
            />
          </div>
        )}

        {/* ========== MY CONTRIBUTION + RANK ========== */}
        {myContribution && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                <FiUser className="text-indigo-600" />
                My Contribution
              </h3>
              {rank && (
                <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  <FiTrophy className="h-4 w-4" />
                  Rank #{rank} of {teamMembers.length}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Applications</p>
                <p className="text-xl font-bold text-gray-900">{myContribution.applications}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Collected Revenue</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(myContribution.collectedRevenue)}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Service Profit</p>
                <p className="text-xl font-bold text-indigo-600">{formatCurrency(myContribution.serviceProfit)}</p>
              </div>
              <div className="bg-rose-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Dept Payments</p>
                <p className="text-xl font-bold text-rose-600">{formatCurrency(myContribution.departmentPayments)}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Expenses</p>
                <p className="text-xl font-bold text-amber-600">{formatCurrency(myContribution.expenses)}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Customer Rating</p>
                <p className="text-xl font-bold text-yellow-600">{myContribution.rating}★</p>
              </div>
            </div>
            {myContribution.pendingCollections > 0 && (
              <div className="mt-3 text-sm text-amber-600 flex items-center gap-2 bg-amber-50 p-2 rounded-lg">
                <FiClock /> Pending Collections: {formatCurrency(myContribution.pendingCollections)}
              </div>
            )}
          </div>
        )}

        {/* ========== TEAM MEMBERS ========== */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
              <FiUsers className="text-indigo-600" />
              Team Members ({teamMembers.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((member, idx) => (
              <MemberCard
                key={member.id}
                member={member}
                rank={idx + 1}
                isLeader={member.is_leader}
              />
            ))}
          </div>
        </div>

        {/* ========== NOTICES + CALENDAR ========== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Notices */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-3">
              <FiBell className="text-indigo-600" />
              Team Notices
            </h3>
            {notices.length === 0 ? (
              <p className="text-gray-500 text-sm">No notices</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {notices.map(notice => (
                  <NoticeItem key={notice.id} notice={notice} />
                ))}
              </div>
            )}
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-3">
              <FiCalendar className="text-indigo-600" />
              Team Calendar
            </h3>
            {events.length === 0 ? (
              <p className="text-gray-500 text-sm">No upcoming events</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {events.map(event => (
                  <EventItem key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========== ACHIEVEMENTS ========== */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-3">
            <FiAward className="text-yellow-500" />
            Team Achievements
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {achievements.map(ach => (
              <AchievementBadge key={ach.id} achievement={ach} />
            ))}
          </div>
        </div>

        {/* ========== PENDING WORK + LEADER MESSAGE ========== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Pending Work */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-3">
              <FiAlertCircle className="text-amber-500" />
              My Pending Work
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Pending Services</p>
                <p className="text-xl font-bold text-amber-600">{pendingWork.pending_services || 0}</p>
              </div>
              <div className="bg-rose-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Pending Payments</p>
                <p className="text-xl font-bold text-rose-600">{formatCurrency(pendingWork.pending_payments || 0)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Applications Waiting</p>
                <p className="text-xl font-bold text-blue-600">{pendingWork.applications_waiting || 0}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Documents Missing</p>
                <p className="text-xl font-bold text-purple-600">{pendingWork.documents_missing || 0}</p>
              </div>
            </div>
          </div>

          {/* Leader's Message */}
          {leaderMessage && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-5">
              <div className="flex items-start gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <FiMessageCircle className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Leader's Message</h3>
                  <p className="text-gray-700 text-sm mt-2 leading-relaxed">{leaderMessage.content}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                    <span>— {leaderMessage.author}</span>
                    <span>{formatDate(leaderMessage.date)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========== MONTHLY TRAJECTORY (TARGETS VS GROWTH) ========== */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-6">
            <FiTrendingUp className="text-indigo-600" /> Monthly Trajectory
          </h3>
          
          {teamSettings.targets_enabled ? (
            <div className="mb-8">
              <TargetProgressBar 
                label="Revenue Target Progress" 
                current={teamStats?.revenue || 0} 
                target={teamSettings.monthly_target} 
              />
            </div>
          ) : (
            <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-xl text-center mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left flex items-center gap-4">
                <div className="bg-indigo-100 p-3 rounded-full hidden sm:block">
                  <FiTrendingUp className="text-xl text-indigo-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-indigo-900">Growth Mindset Active</h4>
                  <p className="text-indigo-700 mt-1 text-xs max-w-md">Keep up the great work! Focus on quality service and beating last month's pace rather than a strict quota.</p>
                </div>
              </div>
              <div className="bg-white px-5 py-3 rounded-xl shadow-sm border border-indigo-100 w-full sm:w-auto text-center">
                <p className="text-[10px] text-indigo-500 uppercase tracking-wider font-bold">Current Pace</p>
                <p className="text-xl font-bold text-indigo-700 mt-1">{formatCurrency(teamStats?.revenue)}</p>
              </div>
            </div>
          )}

          {trendChartData && (
            <div className="h-64 mt-4 border-t border-gray-50 pt-6">
              <Line data={trendChartData} options={trendOptions} />
            </div>
          )}
        </div>

        {/* ========== BADGES (Gamification) ========== */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-3">
            <FiStar className="text-yellow-500" />
            Your Badges
          </h3>
          <div className="flex flex-wrap gap-3">
            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <span className="text-sm font-medium text-gray-800">Top Performer</span>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <span className="text-2xl">⭐</span>
              <span className="text-sm font-medium text-gray-800">Customer Favourite</span>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <span className="text-sm font-medium text-gray-800">30 Days Attendance</span>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <span className="text-sm font-medium text-gray-800">Fast Processor</span>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <span className="text-sm font-medium text-gray-800">Revenue Champion</span>
            </div>
          </div>
        </div>

        {/* ========== BIRTHDAYS + LEAVE STATUS ========== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Birthdays */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-3">
              <FiBirthday className="text-pink-500" />
              Upcoming Birthdays
            </h3>
            {birthdays.length === 0 ? (
              <p className="text-gray-500 text-sm">No upcoming birthdays</p>
            ) : (
              <div className="space-y-2">
                {birthdays.map(bday => (
                  <div key={bday.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎂</span>
                      <span className="font-medium text-gray-900">{bday.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">{formatDate(bday.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leave Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-3">
              <FiUserCheck className="text-indigo-500" />
              Leave Status
            </h3>
            {leaveStatus.length === 0 ? (
              <p className="text-gray-500 text-sm">No leave records today</p>
            ) : (
              <div className="space-y-2">
                {leaveStatus.map(leave => (
                  <div key={leave.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${leave.status === 'Full Day' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                      <span className="font-medium text-gray-900">{leave.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`text-xs font-medium ${leave.status === 'Full Day' ? 'text-rose-600' : 'text-amber-600'}`}>
                        {leave.status}
                      </span>
                      <span className="text-gray-400">{formatDate(leave.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========== TEAM CHAT SHORTCUT ========== */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-5 text-white flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">💬 Open Team Chat</h3>
            <p className="text-indigo-100 text-sm">Connect with your team instantly</p>
          </div>
          <button className="bg-white text-indigo-600 px-5 py-2.5 rounded-lg font-medium hover:bg-gray-100 transition shadow-lg">
            Join Chat →
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffTeamDashboard;