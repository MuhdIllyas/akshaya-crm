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

  // Fetch all team data
  const fetchTeamData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const centreId = localStorage.getItem('centre_id');

      // In a real implementation, these would be actual API calls
      // For now, we simulate with mock data and console logs
      
      // 1. Team Overview
      const teamOverviewRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/team/overview?centre_id=${centreId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (teamOverviewRes.ok) {
        const overview = await teamOverviewRes.json();
        setTeamData(overview.data);
      } else {
        // Fallback mock data
        setTeamData({
          name: 'Digital Services Team',
          leader: 'Muhammed',
          member_count: 6,
          is_primary: true,
          created_at: '2026-01-12',
          monthly_target: 300000,
          status: 'active'
        });
      }

      // 2. Team Members
      const membersRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/team/members?centre_id=${centreId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (membersRes.ok) {
        const members = await membersRes.json();
        setTeamMembers(members.data);
      } else {
        // Mock
        setTeamMembers([
          { id: 1, name: 'Muhammed', role: 'Leader', applications: 120, rating: 4.8, revenue: 54000, is_online: true, is_leader: true },
          { id: 2, name: 'Rahul', role: 'Senior Staff', applications: 83, rating: 4.9, revenue: 42000, is_online: true },
          { id: 3, name: 'Shibil', role: 'Staff', applications: 71, rating: 4.6, revenue: 38000, is_online: false },
          { id: 4, name: 'Nisha', role: 'Staff', applications: 65, rating: 4.7, revenue: 35000, is_online: true },
          { id: 5, name: 'Akhil', role: 'Staff', applications: 58, rating: 4.5, revenue: 31000, is_online: true },
          { id: 6, name: 'Priya', role: 'Staff', applications: 45, rating: 4.4, revenue: 28000, is_online: false }
        ]);
      }

      // 3. Notices
      const noticesRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/team/notices?centre_id=${centreId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (noticesRes.ok) {
        const notices = await noticesRes.json();
        setNotices(notices.data);
      } else {
        setNotices([
          { id: 1, title: 'Passport documents changed', content: 'All members please use new checklist for passport applications.', author: 'Muhammed', created_at: '2026-02-10' },
          { id: 2, title: 'Training on New Software', content: 'Training session on updated CRM will be held on Friday.', author: 'Admin', created_at: '2026-02-09' }
        ]);
      }

      // 4. Events
      const eventsRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/team/events?centre_id=${centreId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (eventsRes.ok) {
        const events = await eventsRes.json();
        setEvents(events.data);
      } else {
        setEvents([
          { id: 1, title: 'Passport Camp', date: '2026-02-14', description: 'Special camp for passport services' },
          { id: 2, title: 'Training', date: '2026-02-15', description: 'CRM training for all staff' },
          { id: 3, title: 'Collector Visit', date: '2026-02-17', description: 'District collector inspection' }
        ]);
      }

      // 5. Achievements
      const achRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/team/achievements?centre_id=${centreId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (achRes.ok) {
        const ach = await achRes.json();
        setAchievements(ach.data);
      } else {
        setAchievements([
          { id: 1, icon: '🏆', title: 'Best Team', description: 'Best performing team of June', date: '2026-06-30' },
          { id: 2, icon: '💰', title: 'Revenue Target Achieved', description: 'Exceeded monthly target by 20%', date: '2026-07-31' },
          { id: 3, icon: '⭐', title: 'Customer Rating 4.9★', description: 'Highest customer satisfaction rating', date: '2026-08-15' },
          { id: 4, icon: '😊', title: 'Zero Complaints', description: 'No complaints received in August', date: '2026-08-31' }
        ]);
      }

      // 6. Pending Work
      const pendingRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/team/pending-work?centre_id=${centreId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (pendingRes.ok) {
        const pending = await pendingRes.json();
        setPendingWork(pending.data);
      } else {
        setPendingWork({
          pending_services: 14,
          pending_payments: 2500,
          applications_waiting: 8,
          documents_missing: 3
        });
      }

      // 7. Leader's Message
      const msgRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/team/leader-message`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (msgRes.ok) {
        const msg = await msgRes.json();
        setLeaderMessage(msg.data);
      } else {
        setLeaderMessage({
          content: 'Today\'s Goal: Finish Passport backlog. Everyone update tracking before 5PM.',
          author: 'Muhammed',
          date: '2026-02-12'
        });
      }

      // 8. Birthdays
      const bdayRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/team/birthdays`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (bdayRes.ok) {
        const bday = await bdayRes.json();
        setBirthdays(bday.data);
      } else {
        setBirthdays([
          { id: 1, name: 'Rahul', date: '2026-02-13' },
          { id: 2, name: 'Nisha', date: '2026-08-12' }
        ]);
      }

      // 9. Leave Status
      const leaveRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/team/leave-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (leaveRes.ok) {
        const leave = await leaveRes.json();
        setLeaveStatus(leave.data);
      } else {
        setLeaveStatus([
          { id: 1, name: 'Rahul', status: 'Full Day', date: '2026-02-12' },
          { id: 2, name: 'Shibil', status: 'Half Day', date: '2026-02-12' }
        ]);
      }

      // 10. My Stats (from StaffPerformance)
      const myStatsRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/staffperformance/dashboard?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (myStatsRes.ok) {
        const stats = await myStatsRes.json();
        setMyStats(stats.data.summary);
        // Also get rank
        const rankRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/team/my-rank`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (rankRes.ok) {
          const rankData = await rankRes.json();
          setRank(rankData.data.rank);
        } else {
          setRank(2); // mock
        }
      }

      // 11. Performance Trend (Team)
      const trendRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/team/performance-trend?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (trendRes.ok) {
        const trend = await trendRes.json();
        setPerformanceTrend(trend.data);
      } else {
        // Mock trend data
        setPerformanceTrend({
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          applications: [65, 72, 80, 85, 90, 95],
          revenue: [180000, 190000, 210000, 230000, 245000, 260000]
        });
      }

    } catch (error) {
      console.error('Error fetching team data:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, [period]);

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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FiTeam className="text-indigo-600" />
              Team Dashboard
            </h1>
            <p className="text-gray-500 text-sm">Overview of your team's performance and activities</p>
          </div>
          <div className="flex items-center gap-3 mt-3 md:mt-0">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
            <button
              onClick={fetchTeamData}
              className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              disabled={loading}
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

        {/* ========== PERFORMANCE TREND ========== */}
        {trendChartData && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-4">
              <FiBarChart2 className="text-indigo-600" />
              Performance Trend
            </h3>
            <div className="h-64">
              <Line data={trendChartData} options={trendOptions} />
            </div>
          </div>
        )}

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
