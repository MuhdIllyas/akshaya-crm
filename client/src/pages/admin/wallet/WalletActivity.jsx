import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, Filter, Download, Search, 
  BarChart, PieChart, LineChart, Wallet, CreditCard,
  ChevronDown, ChevronUp, Plus, Banknote, Landmark, 
  Smartphone, PiggyBank, Activity, ArrowDown, ArrowUp, 
  FileText, Calendar, Tag, RefreshCw, X, 
  ArrowLeftCircle, ArrowRightCircle, Minus,
  TrendingUp, TrendingDown, User, ChevronRight, ChevronLeft
} from "lucide-react";
import {
  BarChart as ReBarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { format, isValid, subDays, startOfDay, endOfDay } from 'date-fns';
import { 
  getWallets, 
  getWalletTransactions,
  getStaff,
  rechargeWallet, getWalletById , getWalletTodayBalance , getWalletDailyBalances
} from "@/services/walletService";

// Predefined color palette for consistent service colors
const SERVICE_COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#a4de6c",
  "#d0ed57", "#ff8042", "#00ced1", "#ff6e6e", "#a05195"
];

const WalletActivity = () => {
  const { walletId } = useParams();
  console.log("WalletActivity : Component rendered with walletId:", walletId);

  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [todayBalance, setTodayBalance] = useState(null);
  const [todayBalanceLoading, setTodayBalanceLoading] = useState(false);
  const [staffMembers, setStaffMembers] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState("month");
  const [typeFilter, setTypeFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date())
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({
    key: 'date',
    direction: 'desc'
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [chartType, setChartType] = useState('bar');
  const [showChartMenu, setShowChartMenu] = useState(false);
  const [trendAnalysis, setTrendAnalysis] = useState(null);
  const [trendTimeFrame, setTrendTimeFrame] = useState('month');
  const [expandedTrendAnalysis, setExpandedTrendAnalysis] = useState(false);
  const [error, setError] = useState(null);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeDescription, setRechargeDescription] = useState("");
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const chartMenuRef = useRef(null);
  const transactionsPerPage = 8;

  // Wallet types
  const walletTypes = [
    { id: "bank", name: "Bank Account", icon: Landmark, color: "bg-blue-100 text-blue-700" },
    { id: "cash", name: "Cash", icon: Banknote, color: "bg-green-100 text-green-700" },
    { id: "card", name: "Credit Card", icon: CreditCard, color: "bg-purple-100 text-purple-700" },
    { id: "digital", name: "Digital Wallet", icon: Smartphone, color: "bg-amber-100 text-amber-700" },
    { id: "savings", name: "Savings", icon: PiggyBank, color: "bg-yellow-100 text-yellow-700" },
  ];

  // Services with predefined colors
  const services = [
    { id: "income", name: "Income", color: SERVICE_COLORS[0] },
    { id: "possession_certificate", name: "Possession Certificate", color: SERVICE_COLORS[1] },
    { id: "passport", name: "Passport", color: SERVICE_COLORS[2] },
    { id: "neet_registration", name: "NEET Registration", color: SERVICE_COLORS[3] },
    { id: "other", name: "Other", color: SERVICE_COLORS[4] },
  ];

  // Map category to service ID
  const mapCategoryToServiceId = (category) => {
    const mapping = {
      "Income": "income",
      "Possession Certificate": "possession_certificate",
      "Passport": "passport",
      "NEET Registration": "neet_registration",
      "Transfer": "other",
      "Recharge": "other"
    };
    return mapping[category] || "other";
  };

  const getDateRangeForFilter = (filter, currentRange) => {
    const now = new Date();
    let start, end;

    switch (filter) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'yesterday':
        start = startOfDay(subDays(now, 1));
        end = endOfDay(subDays(now, 1));
        break;
      case 'week':
        start = startOfDay(subDays(now, 6));
        end = endOfDay(now);
        break;
      case 'month':
        start = startOfDay(subDays(now, 29));
        end = endOfDay(now);
        break;
      case 'quarter':
        start = startOfDay(subDays(now, 89));
        end = endOfDay(now);
        break;
      case 'year':
        start = startOfDay(subDays(now, 364));
        end = endOfDay(now);
        break;
      case 'custom':
        start = currentRange.start;
        end = currentRange.end;
        break;
      default:
        start = null;
        end = null;
    }

    return { start, end };
  };

  // Fetch wallet data and transactions
  const fetchData = useCallback(async () => {
    console.log("fetchData: Initiating with walletId:", walletId);

    if (!walletId) {
      console.error("fetchData: No walletId provided");
      setError("Invalid or missing wallet ID");
      setLoading(false);
      return;
    }

    if (isNaN(walletId)) {
      console.error("fetchData: walletId is not a valid number:", walletId);
      setError("Wallet ID must be a valid number");
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      console.log("fetchData: Fetching wallet data for walletId:", walletId);

      // Fetch wallet details
      const walletRes = await getWalletById(walletId);
      console.log("fetchData: Wallet response:", walletRes);
      const walletData = walletRes.data || {};

      // Validate wallet data
      if (!walletData.id) {
        console.error("fetchData: Invalid wallet data received:", walletData);
        throw new Error("Wallet data is incomplete or invalid");
      }

      // Fetch transactions for this wallet
      console.log("fetchData: Fetching transactions for walletId:", walletId);
      const transactionsRes = await getWalletTransactions(walletId);
      console.log("fetchData: Transactions response:", transactionsRes);
      const transactionsData = Array.isArray(transactionsRes.data) ? transactionsRes.data : [];

      try {
          setTodayBalanceLoading(true);
          const todayBalanceRes = await getWalletTodayBalance(walletId);
          setTodayBalance(todayBalanceRes);
        } catch (e) {
          console.error("Failed to fetch today balance", e);
          setTodayBalance(null);
        } finally {
          setTodayBalanceLoading(false);
        }

      // Fetch staff members
      console.log("fetchData: Fetching staff data");
      const staffRes = await getStaff();
      console.log("fetchData: Staff response:", staffRes);
      const staffData = Array.isArray(staffRes) ? staffRes.map(staff => ({
        ...staff,
        id: staff.id.toString()
      })) : [];

      // Map transactions to component format
      const mappedTransactions = transactionsData.map(t => {
        const rawAmount = Number(t.amount) || 0; // Convert to number, default to 0 if invalid
        const mappedTransaction = {
          id: t.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
          date: t.created_at || new Date().toISOString(),
          description: t.description || "No description",
          amount: t.type === 'credit' ? rawAmount : -rawAmount,
          type: t.type || "unknown",
          walletId: t.wallet_id || walletId,
          service: mapCategoryToServiceId(t.category || ""),
          notes: t.category || "",
          staffId: t.staff_id ? t.staff_id.toString() : null
        };
        return mappedTransaction;
      });
      console.log("Transactions fetched:", transactionsData.map(t => ({ id: t.id, wallet_id: t.wallet_id })));

      const walletSummary = {
        id: walletData.id || walletId,
        name: walletData.name || `Wallet ${walletId}`,
        balance: walletData.balance || 0,
        type: walletData.wallet_type || "bank",
        lastTransaction: walletData.updated_at && isValid(new Date(walletData.updated_at))
          ? walletData.updated_at
          : new Date().toISOString(),
        isShared: walletData.is_shared || false,
        status: walletData.status || "online",
        transactions: transactionsData.length
      };
      console.log("fetchData: Wallet summary:", walletSummary);

      setWallet(walletSummary);
      setStaffMembers(staffData);
      setTransactions(mappedTransactions);
      setFilteredTransactions(mappedTransactions);
    } catch (err) {
      const errorMessage = err.response?.status === 404
        ? `Wallet not found for ID ${walletId}. Please check the wallet ID.`
        : err.response?.status === 401
        ? "Unauthorized: Please log in again."
        : `Failed to load wallet data: ${err.message}`;
      setError(errorMessage);
      console.error("fetchData Error:", {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        walletId,
      });
      if (err.response?.status === 401) {
        console.log("fetchData: Redirecting to login due to 401 error");
        window.location.href = "/login";
      }
    } finally {
      setLoading(false);
      console.log("fetchData: Completed, loading set to false");
    }
  }, [walletId]);

  useEffect(() => {
    console.log("WalletActivity: useEffect triggered with walletId:", walletId);
    fetchData();
  }, [fetchData, walletId]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchInput]);

  useEffect(() => {
    if (transactions.length > 0) {
      const calculateTrends = () => {
        const now = new Date();
        const timeFrames = {
          week: subDays(now, 7),
          month: subDays(now, 30),
          quarter: subDays(now, 90),
          year: subDays(now, 365)
        };
        
        const periodStart = timeFrames[trendTimeFrame];
        const result = {
          credits: 0,
          debits: 0,
          services: {},
          dailyAverage: {},
          largestTransaction: null,
          mostActiveService: null,
          comparison: {}
        };
        
        const periodTransactions = transactions.filter(t => 
          new Date(t.date) > periodStart
        );
        
        if (periodTransactions.length === 0) {
          return result;
        }
        
        periodTransactions.forEach(t => {
        const amount = Number(t.amount) || 0;
        console.log(`Transaction id: ${t.id}, type: ${t.type}, raw amount: ${t.amount}, parsed amount: ${amount}`);
        if (t.type === 'credit') {
          result.credits += amount;
        } else if (t.type === 'debit') {
          result.debits += Math.abs(amount);
        }
          
          if (t.service) {
            if (!result.services[t.service]) {
              result.services[t.service] = {
                count: 0,
                total: 0
              };
            }
            result.services[t.service].count++;
            result.services[t.service].total += Math.abs(t.amount);
          }
          
          if (!result.largestTransaction || 
              Math.abs(t.amount) > Math.abs(result.largestTransaction.amount)) {
            result.largestTransaction = t;
          }
        });
        
        const serviceEntries = Object.entries(result.services);
        if (serviceEntries.length > 0) {
          const sortedServices = serviceEntries.sort((a, b) => b[1].count - a[1].count);
          result.mostActiveService = sortedServices[0][0];
        }
        
        const daysInPeriod = Math.max(1, Math.floor((now - periodStart) / (1000 * 60 * 60 * 24)));
        result.dailyAverage = {
          credits: result.credits / daysInPeriod,
          debits: result.debits / daysInPeriod,
          transactions: periodTransactions.length / daysInPeriod
        };
        
        const prevPeriodStart = subDays(periodStart, daysInPeriod);
        const prevPeriodTransactions = transactions.filter(t => 
          new Date(t.date) > prevPeriodStart && new Date(t.date) <= periodStart
        );
        
        const prevCredits = prevPeriodTransactions
          .filter(t => t.type === 'credit')
          .reduce((sum, t) => sum + t.amount, 0);
        
        const prevDebits = prevPeriodTransactions
          .filter(t => t.type === 'debit')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        result.comparison = {
          creditChange: result.credits - prevCredits,
          debitChange: result.debits - prevDebits,
          transactionChange: periodTransactions.length - prevPeriodTransactions.length
        };
        
        return result;
      };
      
      setTrendAnalysis(calculateTrends());
    }
  }, [transactions, trendTimeFrame]);

  const filterTransactions = useCallback(() => {
    let result = [...(transactions || [])];
    
    const displayRange = getDateRangeForFilter(timeFilter, dateRange);
    
    if (displayRange.start && displayRange.end) {
      result = result.filter(t => {
        try {
          const transactionDate = new Date(t.date);
          return transactionDate >= displayRange.start && transactionDate <= displayRange.end;
        } catch (error) {
          console.error("Invalid date format in transaction:", t.date);
          return false;
        }
      });
    }
    
    if (typeFilter !== "all") {
      result = result.filter(t => t.type === typeFilter);
    }
    
    if (serviceFilter !== "all") {
      result = result.filter(t => t.service === serviceFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => {
        const description = t.description ? t.description.toLowerCase() : '';
        const notes = t.notes ? t.notes.toLowerCase() : '';
        const staff = t.staffId ? staffMembers.find(s => s.id === t.staffId) : null;
        const staffName = staff ? staff.name.toLowerCase() : '';
        
        return (
          description.includes(query) || 
          notes.includes(query) || 
          staffName.includes(query)
        );
      });
    }
    
    return result;
  }, [transactions, timeFilter, typeFilter, serviceFilter, searchQuery, dateRange, staffMembers]);

  useEffect(() => {
    const filtered = filterTransactions();
    setFilteredTransactions(filtered);
    setCurrentPage(1);
  }, [filterTransactions]);

  const sortedTransactions = useMemo(() => {
    try {
      const items = Array.isArray(filteredTransactions) ? filteredTransactions : [];
      if (items.length === 0) return [];

      const sortableItems = [...items];
      
      if (sortConfig.key) {
        sortableItems.sort((a, b) => {
          if (!a || !b) return 0;
          
          let comparison = 0;
          
          if (sortConfig.key === 'date') {
            const dateA = a.date ? new Date(a.date) : new Date(0);
            const dateB = b.date ? new Date(b.date) : new Date(0);
            comparison = dateA - dateB;
          } else if (sortConfig.key === 'amount') {
            const amountA = Math.abs(a.amount || 0);
            const amountB = Math.abs(b.amount || 0);
            comparison = amountA - amountB;
          } else if (sortConfig.key === 'description') {
            const descA = a.description || '';
            const descB = b.description || '';
            comparison = descA.localeCompare(descB);
          }
          
          return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
      }
      return sortableItems;
    } catch (error) {
      console.error("Sorting error:", error);
      return filteredTransactions;
    }
  }, [filteredTransactions, sortConfig]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleDateChange = (e, type) => {
    const newDate = new Date(e.target.value);
    const newRange = {...dateRange, [type]: newDate};
    setDateRange(newRange);
    setTimeFilter("custom");
  };

  const quickSelectDateRange = (range) => {
    const now = new Date();
    let startDate, endDate;
    
    if (range === 'today') {
      startDate = startOfDay(now);
      endDate = endOfDay(now);
    } else if (range === 'yesterday') {
      startDate = startOfDay(subDays(now, 1));
      endDate = endOfDay(subDays(now, 1));
    } else if (range === 'week') {
      startDate = startOfDay(subDays(now, 6));
      endDate = endOfDay(now);
    } else if (range === 'month') {
      startDate = startOfDay(subDays(now, 29));
      endDate = endOfDay(now);
    }
    
    setDateRange({
      start: startDate,
      end: endDate
    });
    setTimeFilter(range);
  };
  
  const formatAmount = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString, formatStr = 'dd MMM yyyy') => {
    try {
      const date = new Date(dateString);
      return format(date, formatStr);
    } catch (error) {
      console.error("Invalid date format:", dateString);
      return "Invalid Date";
    }
  };

  const getWalletIcon = (typeId) => {
    const type = walletTypes.find(t => t.id === typeId);
    return type ? type.icon : Wallet;
  };

  const getServiceName = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return service ? service.name : "Unknown Service";
  };
  
  const getStaffInfo = (staffId) => {
    return staffMembers.find(s => s.id === staffId) || 
      { name: "Unknown Staff", position: "N/A" };
  };

  const exportToCSV = () => {
    try {
      const headers = ['Date', 'Description', 'Service', 'Type', 'Amount (₹)', 'Notes', 'Staff'];
      const csvContent = [
        headers.join(','),
        ...filteredTransactions.map(t => {
          const staff = getStaffInfo(t.staffId);
          return `"${formatDate(t.date)}","${t.description ? t.description.replace(/"/g, '""') : ''}","${getServiceName(t.service)}",` +
            `"${t.type ? t.type.charAt(0).toUpperCase() + t.type.slice(1) : ''}","${formatAmount(t.amount).replace(/[^\d.,-]/g, '')}",` +
            `"${(t.notes || '').replace(/"/g, '""')}","${staff.name}"`
        })
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${wallet ? wallet.name.replace(/\s+/g, '-') : 'wallet'}-transactions-${formatDate(new Date(), 'yyyyMMdd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Failed to export CSV. Please try again.");
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setChartLoading(true);
    try {
      // Refetch wallet data
      const walletRes = await getWallets(walletId);
      const walletData = walletRes.data;
      
      // Refetch transactions
      const transactionsRes = await getWalletTransactions(walletId);
      const transactionsData = transactionsRes.data;
      
      // Map transactions to component format
      const mappedTransactions = transactionsData.map(t => {
      const rawAmount = Number(t.amount) || 0; // Convert to number, default to 0 if invalid
      const mappedTransaction = {
        id: t.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
        date: t.created_at || new Date().toISOString(),
        description: t.description || "No description",
        amount: t.type === 'credit' ? rawAmount : -rawAmount,
        type: t.type || "unknown",
        walletId: t.wallet_id || walletId,
        service: mapCategoryToServiceId(t.category || ""),
        notes: t.category || "",
        staffId: t.staff_id ? t.staff_id.toString() : null
      };
      return mappedTransaction;
    });
      
      // Update state
      setWallet(prev => ({
        ...prev,
        balance: walletData.balance,
        lastTransaction: walletData.updated_at
      }));
      
      setTransactions(mappedTransactions);
      setFilteredTransactions(mappedTransactions);
    } catch (err) {
      setError("Failed to refresh data. Please try again.");
      console.error("Refresh error:", err);
    } finally {
      setLoading(false);
      setChartLoading(false);
    }
  };

  const handleZoom = (direction) => {
    setZoomLevel(prev => {
      const newLevel = direction === 'in' 
        ? Math.min(prev + 0.1, 1.5) 
        : Math.max(prev - 0.1, 0.7);
      return newLevel;
    });
  };

  const calculateStats = useMemo(() => {
  return filteredTransactions.reduce((stats, transaction) => {
    const amount = Number(transaction.amount) || 0; // Ensure amount is a number
    if (transaction.type === 'credit') {
      stats.credits += amount;
    } else if (transaction.type === 'debit') {
      stats.debits += Math.abs(amount);
    }
    stats.count++;
    if (transaction.staffId) {
      stats.staffTransactions[transaction.staffId] = 
        (stats.staffTransactions[transaction.staffId] || 0) + 1;
    }
    return stats;
  }, { 
    credits: 0, 
    debits: 0, 
    count: 0,
    staffTransactions: {} 
  });
}, [filteredTransactions]);
  
  const topStaff = useMemo(() => {
    const staffCounts = calculateStats.staffTransactions;
    let topStaffId = null;
    let maxTransactions = 0;
    
    for (const staffId in staffCounts) {
      if (staffCounts[staffId] > maxTransactions) {
        maxTransactions = staffCounts[staffId];
        topStaffId = staffId;
      }
    }
    
    if (!topStaffId) return null;
    
    const staffInfo = staffMembers.find(staff => staff.id === topStaffId);
    return {
      ...staffInfo,
      transactionCount: maxTransactions
    };
  }, [calculateStats, staffMembers]);

  // Generate chart data for monthly summary
  const chartData = useMemo(() => {
  if (!transactions || transactions.length === 0) return [];
  
  const grouped = {};
  transactions.forEach(t => {
    const amount = Number(t.amount) || 0;
    const date = new Date(t.date);
    const monthYear = format(date, 'MMM yyyy');
    
    if (!grouped[monthYear]) {
      grouped[monthYear] = {
        credits: 0,
        debits: 0,
        net: 0
      };
    }
    
    if (t.type === 'credit') {
      grouped[monthYear].credits += amount;
      grouped[monthYear].net += amount;
    } else {
      grouped[monthYear].debits += Math.abs(amount);
      grouped[monthYear].net -= Math.abs(amount);
    }
  });

  const result = Object.keys(grouped).map(month => ({
    name: month,
    credits: grouped[month].credits,
    debits: grouped[month].debits,
    net: grouped[month].net
  })).sort((a, b) => new Date(a.name) - new Date(b.name));
  
  console.log("chartData:", result);
  return result;
}, [transactions]);

  // Generate service data for pie chart
  const serviceData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    
    const serviceTotals = {};
    transactions.forEach(t => {
      const service = t.service;
      if (!serviceTotals[service]) {
        serviceTotals[service] = 0;
      }
      serviceTotals[service] += Math.abs(t.amount);
    });

    return Object.keys(serviceTotals).map(serviceId => {
      const service = services.find(s => s.id === serviceId) || { 
        name: serviceId, 
        color: SERVICE_COLORS[Object.keys(serviceTotals).indexOf(serviceId) % SERVICE_COLORS.length]
      };
      return {
        name: service.name,
        value: serviceTotals[serviceId],
        color: service.color
      };
    });
  }, [transactions]);

  const highlightSearch = (text) => {
    if (!searchQuery || !text) return text;
    
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === searchQuery.toLowerCase() 
        ? <mark key={i} className="bg-yellow-200">{part}</mark> 
        : part
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setTimeFilter("month");
    setTypeFilter("all");
    setServiceFilter("all");
    setSearchInput("");
    setDateRange({
      start: startOfDay(subDays(new Date(), 30)),
      end: endOfDay(new Date())
    });
  };

  // Toggle trend analysis view
  const toggleTrendAnalysis = () => {
    setExpandedTrendAnalysis(!expandedTrendAnalysis);
  };

  const handleRecharge = async () => {
    if (!rechargeAmount || Number(rechargeAmount) <= 0) {
      alert("Please enter a valid recharge amount");
      return;
    }
    
    try {
      const amount = Number(rechargeAmount);
      const payload = {
        wallet_id: walletId,
        amount,
        description: rechargeDescription || "Wallet Recharge",
        category: "Recharge",
        staff_id: localStorage.getItem("id") ? parseInt(localStorage.getItem("id")) : null
      };

      // Call the API to recharge the wallet
      await rechargeWallet(payload);

      // Refresh wallet and transaction data
      await handleRefresh();

      // Reset states
      setRechargeAmount("");
      setRechargeDescription("");
      setShowRechargeModal(false);

      alert(`Successfully recharged ${formatAmount(amount)} to wallet`);
    } catch (err) {
      console.error("Recharge failed:", err);
      alert("Recharge failed. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto"></div>
          <p className="mt-4 text-slate-700">Loading wallet activity...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md p-6 bg-white rounded-xl shadow-md border border-red-200">
          <div className="bg-red-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Error Loading Data</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </button>
            <Link to="/dashboard/admin/wallets" className="px-4 py-2 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Wallets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Wallet className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Wallet Not Found</h2>
          <p className="text-slate-600 mb-6">The wallet you're looking for doesn't exist or has been removed.</p>
          <Link to="/dashboard/admin/wallets" className="inline-flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Wallets
          </Link>
        </div>
      </div>
    );
  }

  const WalletIcon = getWalletIcon(wallet.type);
  const walletType = walletTypes.find(t => t.id === wallet.type) || walletTypes[0];

  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = sortedTransactions.slice(indexOfFirstTransaction, indexOfLastTransaction);
  const totalPages = Math.ceil(sortedTransactions.length / transactionsPerPage);

  const displayRange = getDateRangeForFilter(timeFilter, dateRange);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
            <div className="flex items-center">
              <Link 
                to="/dashboard/admin/wallets" 
                className="mr-3 p-1 sm:p-2 rounded-full hover:bg-slate-100"
                aria-label="Back to wallets"
              >
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Wallet Activity</h1>
                <p className="text-slate-600 text-sm sm:text-base mt-1">Detailed transaction history and analytics</p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 flex-wrap justify-center sm:justify-end">
              <Button 
                variant="outline"
                onClick={handleRefresh}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button 
                variant="outline"
                onClick={exportToCSV}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
              <Button 
                onClick={() => setShowRechargeModal(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Recharge</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Wallet Summary Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          {/* Left: Wallet Info */}
          <div className="flex items-center gap-3">
            <div className={`p-2 sm:p-3 rounded-xl ${walletType.color}`}>
              <WalletIcon className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {wallet.name}
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm flex items-center gap-1 mt-1">
                <span className={`w-2 h-2 rounded-full ${
                  wallet.status === 'online' ? 'bg-green-500' : 'bg-slate-400'
                }`} />
                {wallet.status === 'online' ? 'Online' : 'Offline'} • Last activity:{" "}
                {formatDate(wallet.lastTransaction)}
              </p>
            </div>
          </div>

          {/* Right: Balances */}
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">
              {formatAmount(wallet.balance)}
            </div>

            <div className="mt-1 text-xs text-slate-600 space-y-0.5">
              <div>
                Opening:{" "}
                <span className="font-medium">
                  {todayBalanceLoading || !todayBalance?.opening_balance
                    ? "N/A"
                    : formatAmount(todayBalance.opening_balance)}
                </span>
              </div>
              <div>
                Closing:{" "}
                <span className="font-medium">
                  {todayBalanceLoading || !todayBalance?.closing_balance
                    ? "N/A"
                    : formatAmount(todayBalance.closing_balance)}
                </span>
              </div>
              <div className="text-slate-500">
                {wallet.transactions} transactions
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search transactions by description, notes, or staff..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-3 py-2 border border-slate-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent shadow-sm"
                aria-label="Search transactions"
              />
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1 w-full sm:w-auto justify-center px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 text-sm"
                aria-expanded={showFilters}
                aria-controls="filters-section"
              >
                <Filter className="h-4 w-4" />
                <span>Filters</span>
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showFilters && (
                <button 
                  onClick={clearFilters}
                  className="flex items-center gap-1 w-full sm:w-auto justify-center px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 text-sm"
                  aria-label="Clear all filters"
                >
                  <X className="h-4 w-4" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
          
          {showFilters && (
            <div id="filters-section" className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200 pt-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1 text-slate-700">Time Period</label>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  aria-label="Select time period"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="quarter">Last 3 Months</option>
                  <option value="year">Last Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              
              {timeFilter === "custom" && (
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-1 text-slate-700">Start Date</label>
                    <input
                      type="date"
                      value={formatDate(dateRange.start, 'yyyy-MM-dd')}
                      onChange={(e) => handleDateChange(e, 'start')}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      aria-label="Select start date"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-1 text-slate-700">End Date</label>
                    <input
                      type="date"
                      value={formatDate(dateRange.end, 'yyyy-MM-dd')}
                      onChange={(e) => handleDateChange(e, 'end')}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      aria-label="Select end date"
                    />
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1 text-slate-700">Transaction Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  aria-label="Select transaction type"
                >
                  <option value="all">All Types</option>
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1 text-slate-700">Service</label>
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  aria-label="Select service"
                >
                  <option value="all">All Services</option>
                  {services.map(service => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900">Transactions</h3>
              <div className="p-1 sm:p-2 bg-slate-100 rounded-lg">
                <FileText className="h-4 w-4 text-slate-600" />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-bold text-slate-900">{calculateStats.count}</p>
            <p className="text-xs text-slate-500 mt-1">filtered transactions</p>
          </div>
          
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900">Total Credits</h3>
              <div className="p-1 sm:p-2 bg-green-100 rounded-lg">
                <ArrowDown className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <p className="text-base sm:text-lg font-bold text-green-600">
              {formatAmount(calculateStats.credits)}
            </p>
            <p className="text-xs text-slate-500 mt-1">{filteredTransactions.filter(t => t.type === 'credit').length} transactions</p>
          </div>
          
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900">Total Debits</h3>
              <div className="p-1 sm:p-2 bg-red-100 rounded-lg">
                <ArrowUp className="h-4 w-4 text-red-600" />
              </div>
            </div>
            <p className="text-base sm:text-lg font-bold text-red-600">
              {formatAmount(calculateStats.debits)}
            </p>
            <p className="text-xs text-slate-500 mt-1">{filteredTransactions.filter(t => t.type === 'debit').length} transactions</p>
          </div>
          
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900">Date Range</h3>
              <div className="p-1 sm:p-2 bg-slate-100 rounded-lg">
                <Calendar className="h-4 w-4 text-slate-600" />
              </div>
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {timeFilter === 'all' 
                ? 'All time' 
                : `${formatDate(displayRange.start)} - ${formatDate(displayRange.end)}`
              }
            </p>
            <p className="text-xs text-slate-500 mt-1 truncate">
              {timeFilter === "custom" ? "custom" : timeFilter} period
            </p>
          </div>
          
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900">Top Staff</h3>
              <div className="p-1 sm:p-2 bg-indigo-100 rounded-lg">
                <User className="h-4 w-4 text-indigo-600" />
              </div>
            </div>
            {topStaff ? (
              <>
                <p className="text-sm sm:text-base font-bold text-slate-900 truncate">{topStaff.name}</p>
                <p className="text-xs text-slate-600 mt-1 truncate">{topStaff.position}</p>
                <p className="text-xs text-slate-500 mt-1">
                  <span className="font-medium">{topStaff.transactionCount}</span> transactions
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500">No staff data</p>
            )}
          </div>
          
          <div 
            className={`bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 cursor-pointer hover:bg-slate-50 ${
              expandedTrendAnalysis ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={toggleTrendAnalysis}
            tabIndex={0}
            role="button"
            aria-label={expandedTrendAnalysis ? "Collapse trend analysis" : "Expand trend analysis"}
            onKeyDown={(e) => e.key === 'Enter' && toggleTrendAnalysis()}
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900">Trend Analysis</h3>
              <div className="p-1 sm:p-2 bg-blue-100 rounded-lg">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            {trendAnalysis ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-600">Credit Change</span>
                  <div className="flex items-center mt-1">
                    <span className={`text-xs sm:text-sm font-medium ${
                      trendAnalysis.comparison.creditChange >= 0 ? 
                      'text-green-600' : 'text-red-600'
                    }`}>
                      {trendAnalysis.comparison.creditChange >= 0 ? '+' : ''}
                      {formatAmount(trendAnalysis.comparison.creditChange)}
                    </span>
                    {trendAnalysis.comparison.creditChange >= 0 ? (
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 ml-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 ml-1" />
                    )}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-600">Debit Change</span>
                  <div className="flex items-center mt-1">
                    <span className={`text-xs sm:text-sm font-medium ${
                      trendAnalysis.comparison.debitChange >= 0 ? 
                      'text-red-600' : 'text-green-600'
                    }`}>
                      {trendAnalysis.comparison.debitChange >= 0 ? '+' : ''}
                      {formatAmount(trendAnalysis.comparison.debitChange)}
                    </span>
                    {trendAnalysis.comparison.debitChange >= 0 ? (
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 ml-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 ml-1" />
                    )}
                  </div>
                </div>
                <div className="col-span-2 text-center mt-2">
                  <span className="text-xs text-slate-500 truncate">
                    vs previous {trendTimeFrame}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Calculating trends...</p>
            )}
          </div>
        </div>

        {/* Expanded Trend Analysis Section */}
        {expandedTrendAnalysis && trendAnalysis && (
          <div className="mt-4 sm:mt-6 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 mb-6">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
              <h3 className="text-lg sm:text-xl font-bold text-slate-800">Transaction Trend Analysis</h3>
              <button 
                onClick={toggleTrendAnalysis}
                className="p-1 sm:p-2 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
                aria-label="Close trend analysis"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6">
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h4 className="text-base sm:text-lg font-semibold text-slate-800">Time Period</h4>
                  <select
                    value={trendTimeFrame}
                    onChange={(e) => setTrendTimeFrame(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm sm:text-base bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    aria-label="Select trend time frame"
                  >
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="quarter">Last 90 Days</option>
                    <option value="year">Last 365 Days</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-5 shadow-sm">
                  <h4 className="font-semibold text-slate-800 mb-3 sm:mb-4 flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                    </div>
                    <span>Financial Summary</span>
                  </h4>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-700">Total Credits</span>
                      <span className="font-medium text-lg text-green-600">
                        {formatAmount(trendAnalysis.credits)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-700">Total Debits</span>
                      <span className="font-medium text-lg text-red-600">
                        {formatAmount(trendAnalysis.debits)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-700">Net Flow</span>
                      <span className={`font-medium text-lg ${
                        trendAnalysis.credits > trendAnalysis.debits ? 
                        'text-green-600' : 'text-red-600'
                      }`}>
                        {formatAmount(trendAnalysis.credits - trendAnalysis.debits)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                      <span className="text-sm text-slate-700">Transactions</span>
                      <span className="font-medium text-lg text-slate-800">
                        {transactions.filter(t => 
                          new Date(t.date) > subDays(new Date(), 
                          trendTimeFrame === 'week' ? 7 : 
                          trendTimeFrame === 'month' ? 30 : 
                          trendTimeFrame === 'quarter' ? 90 : 365)
                        ).length}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-5 shadow-sm">
                  <h4 className="font-semibold text-slate-800 mb-3 sm:mb-4 flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Activity className="h-5 w-5 text-blue-600" />
                    </div>
                    <span>Period Comparison</span>
                  </h4>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-700">Credit Change</span>
                      <div className="flex items-center">
                        <span className={`font-medium text-base ${
                          trendAnalysis.comparison.creditChange >= 0 ? 
                          'text-green-600' : 'text-red-600'
                        }`}>
                          {trendAnalysis.comparison.creditChange >= 0 ? '+' : ''}
                          {formatAmount(trendAnalysis.comparison.creditChange)}
                        </span>
                        {trendAnalysis.comparison.creditChange >= 0 ? (
                          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 ml-1" />
                        ) : (
                          <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 ml-1" />
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-700">Debit Change</span>
                      <div className="flex items-center">
                        <span className={`font-medium text-base ${
                          trendAnalysis.comparison.debitChange >= 0 ? 
                          'text-red-600' : 'text-green-600'
                        }`}>
                          {trendAnalysis.comparison.debitChange >= 0 ? '+' : ''}
                          {formatAmount(trendAnalysis.comparison.debitChange)}
                        </span>
                        {trendAnalysis.comparison.debitChange >= 0 ? (
                          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 ml-1" />
                        ) : (
                          <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 ml-1" />
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                      <span className="text-sm text-slate-700">Transaction Change</span>
                      <div className="flex items-center">
                        <span className={`font-medium text-base ${
                          trendAnalysis.comparison.transactionChange >= 0 ? 
                          'text-blue-600' : 'text-orange-600'
                        }`}>
                          {trendAnalysis.comparison.transactionChange >= 0 ? '+' : ''}
                          {trendAnalysis.comparison.transactionChange}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="md:col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-5 shadow-sm">
                  <h4 className="font-semibold text-slate-800 mb-3 sm:mb-4 flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <BarChart className="h-5 w-5 text-blue-600" />
                    </div>
                    <span>Key Insights</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm">
                      <p className="text-xs sm:text-sm text-slate-600 mb-1">Most Active Service</p>
                      <p className="font-semibold text-slate-800 truncate">
                        {trendAnalysis.mostActiveService ? 
                          getServiceName(trendAnalysis.mostActiveService) : 
                          "N/A"}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-600 mt-1">
                        {trendAnalysis.mostActiveService ? 
                          `${trendAnalysis.services[trendAnalysis.mostActiveService].count} transactions` : 
                          "No service data"}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm">
                      <p className="text-xs sm:text-sm text-slate-600 mb-1">Daily Average</p>
                      <p className="font-semibold text-slate-800">
                        {formatAmount(trendAnalysis.dailyAverage.transactions)} transactions/day
                      </p>
                      <p className="text-xs sm:text-sm text-slate-600 mt-1">
                        {formatAmount(trendAnalysis.dailyAverage.debits)} spent daily
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm">
                      <p className="text-xs sm:text-sm text-slate-600 mb-1">Largest Transaction</p>
                      {trendAnalysis.largestTransaction ? (
                        <>
                          <p className="font-semibold text-slate-800 truncate">
                            {trendAnalysis.largestTransaction.description}
                          </p>
                          <p className={`text-sm ${
                            trendAnalysis.largestTransaction.type === 'credit' ? 
                            'text-green-600' : 'text-red-600'
                          }`}>
                            {formatAmount(trendAnalysis.largestTransaction.amount)}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs sm:text-sm text-slate-600">No data</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 sm:mt-8">
                <h4 className="font-semibold text-slate-800 mb-3 sm:mb-4 flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <PieChart className="h-5 w-5 text-blue-600" />
                  </div>
                  <span>Service Distribution</span>
                </h4>
                <div className="h-64 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart data={
                      Object.entries(trendAnalysis.services)
                        .map(([service, data]) => ({
                          name: getServiceName(service),
                          transactions: data.count,
                          amount: data.total,
                        }))
                        .sort((a, b) => b.transactions - a.transactions)
                        .slice(0, 5)
                    }>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name === 'transactions') return [value, 'Transactions'];
                          return [`₹${value}`, 'Amount'];
                        }}
                      />
                      <Bar dataKey="transactions" name="Transactions" fill="#8884d8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="amount" name="Amount" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">Monthly Financial Summary</h3>
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-1 sm:gap-2">
                  <button 
                    onClick={() => handleZoom('out')}
                    className="p-1 bg-slate-100 rounded-md hover:bg-slate-200"
                    disabled={zoomLevel <= 0.7}
                    aria-label="Zoom out"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleZoom('in')}
                    className="p-1 bg-slate-100 rounded-md hover:bg-slate-200"
                    disabled={zoomLevel >= 1.5}
                    aria-label="Zoom in"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative flex-grow sm:flex-grow-0" ref={chartMenuRef}>
                  <button 
                    onClick={() => setShowChartMenu(!showChartMenu)}
                    className="flex items-center gap-1 text-sm px-2 sm:px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-md w-full sm:w-auto"
                    aria-expanded={showChartMenu}
                    aria-haspopup="true"
                  >
                    {chartType === 'bar' ? <BarChart className="h-4 w-4" /> : 
                     chartType === 'line' ? <LineChart className="h-4 w-4" /> : 
                     <PieChart className="h-4 w-4" />}
                    <span className="hidden sm:inline">
                      {chartType === 'bar' ? 'Bar' : chartType === 'line' ? 'Line' : 'Pie'} Chart
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {showChartMenu && (
                    <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-slate-200 z-10">
                      <button 
                        onClick={() => setChartType('bar')}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                          chartType === 'bar' ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <BarChart className="h-4 w-4" />
                        Bar Chart
                      </button>
                      <button 
                        onClick={() => setChartType('line')}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                          chartType === 'line' ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <LineChart className="h-4 w-4" />
                        Line Chart
                      </button>
                      <button 
                        onClick={() => setChartType('pie')}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                          chartType === 'pie' ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <PieChart className="h-4 w-4" />
                        Pie Chart
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="h-60 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <ReBarChart
                      data={chartData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" tickFormatter={value => {
                        if (Math.abs(value) >= 1000000) return `₹${Math.round(value/1000000)}M`;
                        if (Math.abs(value) >= 1000) return `₹${Math.round(value/1000)}K`;
                        return `₹${Math.round(value)}`;
                      }} />
                      <Tooltip 
                        formatter={(value, name) => [`₹${Math.round(value)}`, name]}
                        labelFormatter={(name) => `Month: ${name}`}
                      />
                    <Legend />
                    <Bar dataKey="credits" name="Credits" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="debits" name="Debits" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" name="Net" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </ReBarChart>
                ) : chartType === 'line' ? (
                  <ReLineChart
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" tickFormatter={value => `₹${value/1000}K`} />
                    <Tooltip 
                      formatter={(value) => [`₹${value}`, '']}
                      labelFormatter={(name) => `Month: ${name}`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="credits" name="Credits" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="debits" name="Debits" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="net" name="Net" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
                  </ReLineChart>
                ) : (
                  <RePieChart>
                    <Pie
                      data={serviceData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {serviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`₹${value}`, '']} />
                    <Legend />
                  </RePieChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">Service Distribution</h3>
              <div className="text-sm text-slate-600 mt-1 sm:mt-0">Total: {formatAmount(serviceData.reduce((sum, item) => sum + item.value, 0))}</div>
            </div>
            <div className="h-60 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={serviceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {serviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`₹${value}`, '']} />
                  <Legend layout="vertical" verticalAlign="middle" align="right" />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">Transaction History</h3>
            <p className="text-sm text-slate-600">{filteredTransactions.length} transactions</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th 
                    className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('date')}
                    scope="col"
                  >
                    <div className="flex items-center">
                      Date
                      {sortConfig.key === 'date' && (
                        sortConfig.direction === 'asc' ? 
                        <ChevronUp className="h-4 w-4 ml-1" /> : 
                        <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th className="px-3 sm:px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider" scope="col">
                    Description
                  </th>
                  <th className="hidden xs:table-cell px-3 sm:px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider" scope="col">
                    Service
                  </th>
                  <th className="hidden sm:table-cell px-3 sm:px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider" scope="col">
                    Staff
                  </th>
                  <th 
                    className="px-3 sm:px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('amount')}
                    scope="col"
                  >
                    <div className="flex items-center justify-end">
                      Amount
                      {sortConfig.key === 'amount' && (
                        sortConfig.direction === 'asc' ? 
                        <ChevronUp className="h-4 w-4 ml-1" /> : 
                        <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {currentTransactions.length > 0 ? (
                  currentTransactions.map((transaction) => {
                    const staffInfo = getStaffInfo(transaction.staffId);
                    return (
                      <tr 
                        key={transaction.id} 
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => setSelectedTransaction(transaction)}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedTransaction(transaction)}
                      >
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-slate-600">
                          {formatDate(transaction.date, 'dd MMM')}
                        </td>
                        <td className="px-3 sm:px-6 py-4 max-w-[150px] sm:max-w-xs">
                          <div className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                            {highlightSearch(transaction.description)}
                          </div>
                          {transaction.notes && (
                            <div className="text-xs text-slate-500 mt-1 truncate">
                              {highlightSearch(transaction.notes)}
                            </div>
                          )}
                          <div className="xs:hidden mt-1">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                              {getServiceName(transaction.service)}
                            </span>
                          </div>
                        </td>
                        <td className="hidden xs:table-cell px-3 sm:px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                            {getServiceName(transaction.service)}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-3 sm:px-6 py-4 whitespace-nowrap">
                          {transaction.staffId && (
                            <>
                              <div className="text-xs sm:text-sm text-slate-700 truncate">{staffInfo.name}</div>
                              <div className="text-xs text-slate-500 truncate">{staffInfo.position}</div>
                            </>
                          )}
                        </td>
                        <td className={`px-3 sm:px-6 py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium ${
                          transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <div className="flex justify-end items-center">
                            {transaction.type === 'credit' ? (
                              <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mr-1" />
                            ) : (
                              <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 mr-1" />
                            )}
                            {formatAmount(Math.abs(transaction.amount))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Search className="h-10 w-10 text-slate-400 mb-3" />
                        <h3 className="text-base font-medium text-slate-700">No transactions found</h3>
                        <p className="text-slate-500 text-sm mt-1">
                          {searchQuery ? 'Try different search terms' : 'No transactions match your filters'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {filteredTransactions.length > 0 && (
            <div className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-xs sm:text-sm text-slate-600">
                Showing {indexOfFirstTransaction + 1} to {Math.min(indexOfLastTransaction, filteredTransactions.length)} of {filteredTransactions.length} transactions
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-md ${currentPage === 1 ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-50'}`}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-xs sm:text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-md ${currentPage === totalPages ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-50'}`}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div 
            className="bg-white rounded-xl w-full max-w-md mx-2 sm:mx-0 max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-details-title"
          >
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4 sm:mb-5">
                <h3 id="transaction-details-title" className="text-lg sm:text-xl font-bold text-slate-800">Transaction Details</h3>
                <button 
                  onClick={() => setSelectedTransaction(null)}
                  className="text-slate-500 hover:text-slate-700"
                  aria-label="Close transaction details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Description</p>
                  <p className="font-medium text-slate-900">{selectedTransaction.description}</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Date</p>
                    <p className="font-medium text-slate-900">{formatDate(selectedTransaction.date, 'dd MMM yyyy, hh:mm a')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Amount</p>
                    <p className={`font-medium ${
                      selectedTransaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatAmount(selectedTransaction.amount)}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Type</p>
                    <p className={`font-medium ${
                      selectedTransaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedTransaction.type.charAt(0).toUpperCase() + selectedTransaction.type.slice(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Service</p>
                    <p className="font-medium text-slate-900">
                      {getServiceName(selectedTransaction.service)}
                    </p>
                  </div>
                </div>
                
                {selectedTransaction.staffId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Staff</p>
                      <p className="font-medium text-slate-900">
                        {getStaffInfo(selectedTransaction.staffId).name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Position</p>
                      <p className="font-medium text-slate-900">
                        {getStaffInfo(selectedTransaction.staffId).position}
                      </p>
                    </div>
                  </div>
                )}
                
                {selectedTransaction.notes && (
                  <div>
                    <p className="text-sm text-slate-500">Notes</p>
                    <p className="font-medium text-slate-900">{selectedTransaction.notes}</p>
                  </div>
                )}
                
                <div className="mt-4 sm:mt-6 pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-500">Wallet ID</p>
                  <p className="font-medium text-slate-900">#{wallet.id}</p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => setSelectedTransaction(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-sm sm:text-base"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRechargeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-slate-800">Recharge Wallet</h3>
                <button 
                  onClick={() => setShowRechargeModal(false)}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">₹</span>
                    <input
                      type="number"
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      placeholder="Enter amount"
                      min="1"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">Description (Optional)</label>
                  <input
                    type="text"
                    value={rechargeDescription}
                    onChange={(e) => setRechargeDescription(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    placeholder="e.g. Cash deposit"
                  />
                </div>
              </div>
              
              <div className="mt-7 flex justify-end gap-3">
                <button 
                  onClick={() => setShowRechargeModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRecharge}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                  disabled={!rechargeAmount || Number(rechargeAmount) <= 0}
                >
                  Confirm Recharge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletActivity;