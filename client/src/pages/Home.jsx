// src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiMessageCircle, FiUsers, FiBriefcase, FiDollarSign, FiPieChart, 
  FiCalendar, FiShield, FiTrendingUp, FiStar, FiArrowRight, FiCheckCircle,
  FiLayers, FiActivity, FiCreditCard, FiBookOpen, FiSmartphone, FiHash, FiTarget,
  FiMapPin, FiPhone, FiMail, FiCheck, FiXCircle, FiAlertCircle
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

// ---------------------------------------------------------------------
// Shared Animations
// ---------------------------------------------------------------------
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
};

// ---------------------------------------------------------------------
// Navbar Component
// ---------------------------------------------------------------------
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/95 backdrop-blur-md shadow-md py-3' : 'bg-transparent py-5'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center group">
            <div className="bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 group-hover:shadow-md transition-all duration-300">
              <img src="/logo-light.png" alt="Akshaya Sahayi" className="h-8 w-8 object-contain" />
            </div>
            <div className="ml-3">
              <h1 className={`text-xl font-bold leading-tight transition-colors ${scrolled ? 'text-navy-900' : 'text-white'}`}>
                Akshaya <span className="text-teal-500">Sahayi</span>
              </h1>
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <a href="#roles" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Solutions</a>
            <a href="#control" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Architecture</a>
            <a href="#features" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Features</a>
            <Link to="/contact" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Contact Us</Link>
          </div>

          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/login')} 
              className={`hidden sm:block text-sm font-bold transition-colors ${scrolled ? 'text-navy-900 hover:text-teal-600' : 'text-white hover:text-teal-300'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => navigate('/login')} 
              className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-navy-900 font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 text-sm"
            >
              Book Service
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

// ---------------------------------------------------------------------
// INTERACTIVE 1: Live Command Centre (Hero)
// ---------------------------------------------------------------------
const CommandCentreHero = () => {
  const [feed, setFeed] = useState([]);
  
  const events = [
    { text: "Token #104 Generated", centre: "Centre A", icon: FiHash, color: "text-indigo-400", bg: "bg-indigo-500/20" },
    { text: "₹1,500 Payment Logged to Cash Wallet", centre: "Centre B", icon: FiDollarSign, color: "text-emerald-400", bg: "bg-emerald-500/20" },
    { text: "Automated WhatsApp Sent to Customer", centre: "Centre A", icon: FaWhatsapp, color: "text-[#25D366]", bg: "bg-[#25D366]/20" },
    { text: "Staff 'Sarah' punched in via GPS", centre: "Centre C", icon: FiUsers, color: "text-blue-400", bg: "bg-blue-500/20" },
    { text: "New 5-Star Review Received ⭐⭐⭐⭐⭐", centre: "Centre A", icon: FiStar, color: "text-amber-400", bg: "bg-amber-500/20" },
    { text: "Online Booking: Passport Application", centre: "Web Portal", icon: FiSmartphone, color: "text-purple-400", bg: "bg-purple-500/20" }
  ];

  useEffect(() => {
    // Initial feed
    setFeed([events[0], events[1], events[2]]);
    
    let currentIndex = 3;
    const interval = setInterval(() => {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      const newEvent = { ...events[currentIndex % events.length], time: timeString, id: Date.now() };
      
      setFeed(prev => {
        const updated = [newEvent, ...prev];
        return updated.slice(0, 4); // Keep only the latest 4
      });
      
      currentIndex++;
    }, 2500); // New event every 2.5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-lg mx-auto perspective-1000">
      <div className="bg-navy-800/90 backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Header */}
        <div className="bg-navy-900 px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-white font-bold text-sm tracking-wider uppercase">Live Operations Feed</span>
          </div>
          <FiActivity className="text-teal-400" />
        </div>
        
        {/* Feed Body */}
        <div className="p-6 h-[340px] relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-navy-800 to-navy-900">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          
          <div className="relative z-10 flex flex-col gap-3">
            <AnimatePresence>
              {feed.map((item, index) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: 50, scale: 0.9 }}
                  animate={{ opacity: 1 - (index * 0.25), x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm flex items-start gap-4 shadow-sm"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-white/5 ${item.bg}`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold tracking-wider text-navy-300 uppercase">{item.centre}</span>
                      <span className="text-[10px] text-navy-400">{item.time || 'Just now'}</span>
                    </div>
                    <p className="text-sm font-semibold text-white truncate">{item.text}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// INTERACTIVE 2: Role Switcher
// ---------------------------------------------------------------------
const RoleSwitcher = () => {
  const [activeTab, setActiveTab] = useState(0);

  const roles = [
    {
      title: "Centre Owner",
      subtitle: "Know where every rupee goes.",
      icon: FiPieChart,
      color: "text-emerald-500",
      bg: "bg-emerald-500",
      lightBg: "bg-emerald-50",
      content: (
        <div className="bg-white p-6 rounded-2xl shadow-inner border border-gray-100 h-full flex flex-col justify-center">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-bold text-gray-900">Financial Overview</h4>
            <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">Today</span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
              <span className="text-gray-500 text-sm">Collected Revenue</span>
              <span className="font-bold text-gray-900">₹48,250</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
              <span className="text-gray-500 text-sm">Pending Payments</span>
              <span className="font-bold text-amber-500">₹12,400</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-emerald-700 font-bold">Net Profit</span>
              <span className="font-black text-emerald-600 text-xl">₹35,850</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Staff Member",
      subtitle: "Clear the queue faster without the stress.",
      icon: FiBriefcase,
      color: "text-blue-500",
      bg: "bg-blue-500",
      lightBg: "bg-blue-50",
      content: (
        <div className="bg-white p-6 rounded-2xl shadow-inner border border-gray-100 h-full flex flex-col justify-center">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-gray-900">My Workspace</h4>
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">Counter 3</span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3 border-l-4 border-l-blue-500">
            <div className="flex justify-between">
              <span className="font-bold text-gray-900 text-sm">Passport Renewal</span>
              <span className="font-black text-blue-600">A-104</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Status: Processing Documents</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 opacity-60">
            <div className="flex justify-between">
              <span className="font-bold text-gray-900 text-sm">Aadhaar Update</span>
              <span className="font-black text-gray-500">A-105</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Status: Waiting in Queue</p>
          </div>
        </div>
      )
    },
    {
      title: "Citizen",
      subtitle: "Book from home. Track on WhatsApp.",
      icon: FiSmartphone,
      color: "text-teal-500",
      bg: "bg-teal-500",
      lightBg: "bg-teal-50",
      content: (
        <div className="bg-white p-6 rounded-2xl shadow-inner border border-gray-100 h-full flex flex-col justify-center items-center relative">
          <div className="w-full max-w-[220px] bg-gray-50 border-[6px] border-gray-800 rounded-[2rem] h-[280px] p-3 relative overflow-hidden shadow-lg">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-gray-800 rounded-b-xl z-10"></div>
            <div className="bg-[#128C7E] text-white p-3 rounded-t-xl mb-2 text-xs font-bold flex items-center">
              <FaWhatsapp className="mr-2" /> Akshaya Centre
            </div>
            <div className="bg-green-50 border border-green-100 p-3 rounded-xl rounded-tl-none shadow-sm relative">
              <p className="text-[10px] text-gray-800 leading-relaxed mb-2">
                <strong>Service Complete! ✅</strong><br/>
                Your certificate is ready to download.
              </p>
              <button className="w-full py-1.5 bg-white border border-gray-200 rounded text-[10px] font-bold text-blue-600 shadow-sm">
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Superadmin",
      subtitle: "Control your entire network from one chair.",
      icon: FiLayers,
      color: "text-purple-500",
      bg: "bg-purple-500",
      lightBg: "bg-purple-50",
      content: (
        <div className="bg-white p-6 rounded-2xl shadow-inner border border-gray-100 h-full flex flex-col justify-center">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-bold text-gray-900">Network Overview</h4>
            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">3 Centres</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-purple-50 p-3 rounded-xl text-center border border-purple-100">
              <p className="text-[10px] font-bold text-purple-800 uppercase">Centre A</p>
              <p className="text-lg font-black text-gray-900 mt-1">98%</p>
              <p className="text-[9px] text-gray-500">Efficiency</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl text-center border border-blue-100">
              <p className="text-[10px] font-bold text-blue-800 uppercase">Centre B</p>
              <p className="text-lg font-black text-gray-900 mt-1">92%</p>
              <p className="text-[9px] text-gray-500">Efficiency</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl text-center border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-800 uppercase">Centre C</p>
              <p className="text-lg font-black text-gray-900 mt-1">95%</p>
              <p className="text-[9px] text-gray-500">Efficiency</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-8">
        {roles.map((role, idx) => {
          const isActive = activeTab === idx;
          return (
            <button 
              key={idx} 
              onClick={() => setActiveTab(idx)}
              className={`p-4 rounded-2xl flex flex-col items-center text-center transition-all duration-300 border-2 ${
                isActive 
                  ? `bg-white ${role.lightBg.replace('bg-', 'border-')} shadow-md scale-105` 
                  : 'bg-gray-50 border-transparent hover:bg-gray-100 text-gray-500'
              }`}
            >
              <role.icon className={`w-6 h-6 mb-2 ${isActive ? role.color : 'text-gray-400'}`} />
              <span className={`text-sm sm:text-base font-bold ${isActive ? 'text-gray-900' : ''}`}>{role.title}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center min-h-[350px]">
        <AnimatePresence mode="wait">
          <motion.div 
            key={`text-${activeTab}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${roles[activeTab].lightBg}`}>
               {React.createElement(roles[activeTab].icon, { className: `w-8 h-8 ${roles[activeTab].color}` })}
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-4">{roles[activeTab].subtitle}</h3>
            <p className="text-gray-600 text-lg leading-relaxed mb-6">
              Akshaya Sahayi provides a dedicated, purpose-built interface for {roles[activeTab].title.toLowerCase()}s. Secure, role-based access ensures you only see exactly what you need to do your job perfectly.
            </p>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div 
            key={`ui-${activeTab}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full bg-gray-50 rounded-3xl p-4 sm:p-6"
          >
            {roles[activeTab].content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// INTERACTIVE 3: Chaos vs Control Toggle
// ---------------------------------------------------------------------
const ChaosControlToggle = () => {
  const [isSahayi, setIsSahayi] = useState(true);

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Toggle Button */}
      <div className="flex justify-center mb-12 relative z-20">
        <div className="bg-gray-200 p-1.5 rounded-full inline-flex relative shadow-inner">
          <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-full shadow-md transition-all duration-300 ease-in-out ${isSahayi ? 'left-[calc(50%+3px)]' : 'left-1.5'}`} />
          
          <button 
            onClick={() => setIsSahayi(false)}
            className={`relative z-10 px-6 sm:px-8 py-3 rounded-full text-sm font-bold transition-colors ${!isSahayi ? 'text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ❌ Without Sahayi
          </button>
          <button 
            onClick={() => setIsSahayi(true)}
            className={`relative z-10 px-6 sm:px-8 py-3 rounded-full text-sm font-bold transition-colors ${isSahayi ? 'text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ✨ With Sahayi
          </button>
        </div>
      </div>

      {/* Visual Area */}
      <div className={`w-full h-[400px] rounded-3xl border transition-all duration-700 relative overflow-hidden flex items-center justify-center ${
        isSahayi ? 'bg-navy-900 border-navy-800 shadow-2xl' : 'bg-gray-100 border-gray-300 shadow-inner'
      }`}>
        
        <AnimatePresence mode="wait">
          {!isSahayi ? (
            /* CHAOS STATE */
            <motion.div 
              key="chaos" 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 w-full h-full"
            >
              {/* Scattered Elements */}
              <motion.div animate={{ y: [0, -5, 5, 0], rotate: [-2, 2, -2] }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} className="absolute top-[15%] left-[10%] bg-yellow-200 p-4 shadow-lg rotate-[-12deg] w-40 text-sm font-handwriting text-gray-800">
                Where is the passport file for Token 42??
              </motion.div>
              <motion.div animate={{ y: [0, 4, -4, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }} className="absolute top-[60%] left-[20%] bg-white p-3 rounded-xl shadow-md rotate-[5deg] border border-red-200 text-red-600 flex items-center text-sm font-bold">
                <FiAlertCircle className="mr-2 h-5 w-5" /> Mismatched Balance
              </motion.div>
              <motion.div animate={{ x: [0, 5, -5, 0], rotate: [0, -5, 5, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }} className="absolute top-[25%] right-[15%] w-14 h-14 bg-[#25D366] rounded-full shadow-lg flex items-center justify-center relative">
                <FaWhatsapp className="text-white text-3xl" />
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-white">99+</span>
              </motion.div>
              <motion.div animate={{ y: [0, 6, -3, 0] }} transition={{ repeat: Infinity, duration: 3.5, ease: "linear" }} className="absolute bottom-[20%] right-[25%] bg-white p-4 rounded-md shadow-xl rotate-[8deg] text-center border border-gray-200">
                <p className="text-xs text-gray-500 font-bold uppercase mb-1">Paper Token</p>
                <p className="text-2xl font-black text-gray-900"># 102</p>
              </motion.div>
              <motion.div animate={{ y: [0, -2, 2, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="absolute top-[40%] left-[40%] bg-white p-5 rounded-lg shadow-2xl rotate-[-3deg] border border-gray-300">
                <FiPieChart className="text-gray-300 h-16 w-16 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-400">Analytics Unavailable</p>
              </motion.div>
            </motion.div>
          ) : (
            /* CONTROL STATE (SAHAYI) */
            <motion.div 
              key="control" 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
              className="absolute inset-0 w-full h-full flex items-center justify-center p-8"
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:40px_40px]"></div>
              
              <div className="grid grid-cols-3 gap-6 w-full max-w-3xl relative z-10">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex flex-col items-center justify-center text-center shadow-lg transform transition-transform hover:scale-105">
                  <FiUsers className="text-blue-400 h-8 w-8 mb-3" />
                  <p className="text-white font-bold text-sm">Customers Synced</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex flex-col items-center justify-center text-center shadow-lg transform transition-transform hover:scale-105">
                  <FiDollarSign className="text-emerald-400 h-8 w-8 mb-3" />
                  <p className="text-white font-bold text-sm">Wallets Reconciled</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex flex-col items-center justify-center text-center shadow-lg transform transition-transform hover:scale-105">
                  <FaWhatsapp className="text-[#25D366] h-8 w-8 mb-3" />
                  <p className="text-white font-bold text-sm">All Updates Sent</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex flex-col items-center justify-center text-center shadow-lg transform transition-transform hover:scale-105">
                  <FiHash className="text-indigo-400 h-8 w-8 mb-3" />
                  <p className="text-white font-bold text-sm">Digital Queue Active</p>
                </div>
                <div className="bg-teal-500/20 backdrop-blur-md rounded-2xl p-5 border border-teal-500/50 flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(20,184,166,0.2)] transform transition-transform hover:scale-105">
                  <img src="/logo-light.png" alt="Logo" className="w-10 h-10 object-contain mb-2 brightness-0 invert" />
                  <p className="text-teal-300 font-bold text-sm uppercase tracking-wider">Sahayi Hub</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex flex-col items-center justify-center text-center shadow-lg transform transition-transform hover:scale-105">
                  <FiPieChart className="text-pink-400 h-8 w-8 mb-3" />
                  <p className="text-white font-bold text-sm">Live Analytics On</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Contact Section Component
// ---------------------------------------------------------------------
const ContactSection = () => {
  const [formData, setFormData] = useState({
    name: '', centreName: '', phone: '', email: '', centres: '', interest: '', message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    alert('Thank you! Your enquiry has been received. Our team will contact you shortly.');
    setFormData({ name: '', centreName: '', phone: '', email: '', centres: '', interest: '', message: '' });
  };

  return (
    <section id="contact" className="py-24 bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">
            Let’s Build a Smarter Akshaya Centre
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-lg text-gray-600 max-w-2xl mx-auto">
            Have questions about Akshaya Sahayi, pricing, onboarding, or setting up your centre? Send us a message and our team will get back to you.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column: Form */}
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:col-span-2 bg-white rounded-3xl p-8 sm:p-10 shadow-lg border border-gray-100">
            <div className="mb-8 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <FiMail className="mr-3 text-teal-500" /> GET IN TOUCH
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                  <input type="text" required placeholder="Your full name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Centre Name</label>
                  <input type="text" placeholder="Your Akshaya Centre name" value={formData.centreName} onChange={(e) => setFormData({...formData, centreName: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
                  <input type="tel" required placeholder="WhatsApp/Contact number" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <input type="email" placeholder="Your email address" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Centres</label>
                  <input type="number" min="1" placeholder="e.g. 1" value={formData.centres} onChange={(e) => setFormData({...formData, centres: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Interested In</label>
                  <select value={formData.interest} onChange={(e) => setFormData({...formData, interest: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-700">
                    <option value="">Select a topic...</option>
                    <option value="Demo">Akshaya Sahayi Demo</option>
                    <option value="WhatsApp">WhatsApp Integration</option>
                    <option value="Customers">Customer Management</option>
                    <option value="Tokens">Token & Campaign System</option>
                    <option value="Finance">Finance & Accounts</option>
                    <option value="Staff">Staff & Payroll</option>
                    <option value="App">Companion App</option>
                    <option value="Multi-Centre">Multi-Centre Management</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Message *</label>
                <textarea required rows="4" placeholder="Tell us how we can help..." value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all resize-none"></textarea>
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full sm:w-auto px-8 py-3.5 bg-navy-900 hover:bg-navy-800 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center">
                  Send Enquiry <FiArrowRight className="ml-2" />
                </button>
              </div>
            </form>
          </motion.div>

          {/* Right Column: Direct Contact */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:col-span-1 space-y-6">
            <div className="bg-navy-900 text-white rounded-3xl p-8 shadow-xl">
              <h3 className="text-xl font-bold mb-6">Talk to us</h3>
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 mr-4">
                    <FiPhone className="text-teal-400" />
                  </div>
                  <div>
                    <p className="text-sm text-navy-200 font-medium mb-1">Phone</p>
                    <p className="font-semibold">+91 80865 15301</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 mr-4">
                    <FaWhatsapp className="text-green-400 text-lg" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-navy-300 uppercase tracking-wider mb-1">WhatsApp Support</p>
                    <a href="https://wa.me/919633975301" target="_blank" rel="noreferrer" className="font-medium text-lg hover:text-green-400 transition-colors">
                      +91 96339 75301
                    </a>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 mr-4">
                    <FiMail className="text-teal-400" />
                  </div>
                  <div>
                    <p className="text-sm text-navy-200 font-medium mb-1">Email</p>
                    <p className="font-semibold text-sm">support@akshayasahayi.com</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 mr-4">
                    <FiMapPin className="text-teal-400" />
                  </div>
                  <div>
                    <p className="text-sm text-navy-200 font-medium mb-1">Location</p>
                    <p className="font-semibold text-sm leading-relaxed">Centre Park<br/>Malappuram, Kerala - 673638</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-white/10">
                <button onClick={() => window.open('https://wa.me/919633975301', '_blank')} className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center">
                  <FaWhatsapp className="mr-2 text-xl" /> Chat on WhatsApp
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------
// Main App / Homepage Container
// ---------------------------------------------------------------------
const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 font-sans selection:bg-teal-500 selection:text-white overflow-hidden">
      <Navbar />

      {/* 1. HERO SECTION (Live Command Centre) */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-24 bg-navy-900 overflow-hidden min-h-[90vh] flex items-center">
        {/* Background Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-500/20 blur-[150px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[150px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-4 items-center">
            
            {/* Hero Copy (Left Column) */}
            <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="pr-0 lg:pr-10 text-center lg:text-left">
              <motion.div variants={fadeUp} className="inline-flex items-center px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6 backdrop-blur-sm shadow-xl">
                <span className="flex h-2 w-2 rounded-full bg-red-500 mr-2 animate-pulse"></span>
                <span className="text-xs font-bold tracking-wider text-white uppercase">Your Entire Operations. Live.</span>
              </motion.div>
              
              <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
                Control Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400 drop-shadow-sm">Akshaya Centre</span> From One Platform.
              </motion.h1>
              
              <motion.p variants={fadeUp} className="text-lg text-navy-200 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Empower citizens to book online, while giving your staff and management a powerful, real-time command centre for services, WhatsApp, and finances.
              </motion.p>
              
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button onClick={() => navigate('/login')} className="px-8 py-4 bg-teal-500 hover:bg-teal-400 text-navy-900 font-bold rounded-xl shadow-[0_0_20px_rgba(20,184,166,0.4)] transition-all flex items-center justify-center group text-lg">
                  Book Service <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
                <button onClick={() => navigate('/login')} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all flex items-center justify-center text-lg backdrop-blur-md">
                  Sign In
                </button>
              </motion.div>
            </motion.div>

            {/* Live Feed (Right Column) */}
            <motion.div 
              initial={{ opacity: 0, y: 50 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative w-full"
            >
              <CommandCentreHero />
            </motion.div>

          </div>
        </div>
      </section>

      {/* 2. CHOOSE YOUR ROLE SWITCHER */}
      <section id="roles" className="py-24 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">One Platform. Built for Everyone.</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Akshaya Sahayi isn't just a billing tool. It's a complete operating system with purpose-built views for every person in your ecosystem.</p>
          </motion.div>
          
          <RoleSwitcher />
        </div>
      </section>

      {/* 3. CHAOS VS CONTROL TOGGLE */}
      <section id="control" className="py-24 bg-gray-50 border-b border-gray-200 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">From Chaos to Complete Control.</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Stop jumping between unread WhatsApps, lost paper tokens, and mismatched ledgers. See the difference.</p>
          </motion.div>
          
          <ChaosControlToggle />
        </div>
      </section>

      {/* 4. CORE FEATURES (Grid) */}
      <section id="features" className="py-24 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">Tools for Every Part of Your Centre.</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                <FiMessageCircle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">WhatsApp Business</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Meta-linked WhatsApp for customer conversations, automated updates, and payment reminders via templates.</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FiUsers className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Customer Management</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Self-registration via WhatsApp OTP, online service booking, payment history, and reviews stored centrally.</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <FiLayers className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Service Operations</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Manage complete service catalogues, customer entries, staff allocations, and track workflows.</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <FiSmartphone className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Companion App</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Staff mobile app for GPS attendance, push notifications, instant customer lookup, and daily tasks.</p>
            </div>
            
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <FiHash className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Token & Queue</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Generate daily tokens, manage queue status, assign staff dynamically, and send live queue alerts.</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <FiTarget className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Campaigns</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Create targeted service drives, track conversions, and broadcast WhatsApp updates effortlessly.</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <FiStar className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Reviews & Feedback</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Collect post-service feedback automatically to measure citizen satisfaction and staff ratings.</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-green-600 group-hover:text-white transition-colors">
                <FiCalendar className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Calendar & Tasks</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Schedule appointments, track government deadlines, set task reminders, and coordinate work.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CONTACT SECTION */}
      <ContactSection />

      {/* 6. FINAL CTA SECTION */}
      <section className="py-24 relative bg-teal-500 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          
          <motion.div 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true }} 
            className="flex justify-center items-center gap-2 sm:gap-6 mb-8"
          >
            <motion.div variants={fadeUp} className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30"><FiUsers className="text-white text-xl" /></motion.div>
            <motion.div variants={fadeUp} className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30"><FiLayers className="text-white text-xl" /></motion.div>
            <motion.div variants={fadeUp} className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30"><FiDollarSign className="text-white text-xl" /></motion.div>
            <motion.div variants={fadeUp} className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30"><FaWhatsapp className="text-white text-xl" /></motion.div>
          </motion.div>

          <h2 className="text-4xl md:text-5xl font-extrabold text-navy-900 mb-6 tracking-tight">Ready to Modernize Your Centre?</h2>
          <p className="text-teal-900 text-lg mb-10 font-medium max-w-2xl mx-auto">
            Customers. Services. Staff. Finance. WhatsApp.<br />One connected platform.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/login')} 
              className="px-8 py-4 bg-navy-900 hover:bg-navy-800 text-white font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5"
            >
              Sign In to Sahayi
            </button>
            <button 
              onClick={() => navigate('/login')} 
              className="px-8 py-4 bg-white/20 hover:bg-white/30 text-navy-900 font-bold rounded-xl border border-navy-900/10 transition-all"
            >
              Book Service Online
            </button>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="bg-navy-900 text-navy-200 py-16 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center mb-6">
                <div className="bg-white p-1 rounded-lg mr-3">
                  <img src="/logo-light.png" alt="Akshaya Sahayi" className="h-6 w-6 object-contain" />
                </div>
                <h1 className="text-2xl font-bold text-white">Akshaya <span className="text-teal-500">Sahayi</span></h1>
              </div>
              <p className="text-sm text-navy-300 max-w-sm leading-relaxed">
                The complete management platform for modern Akshaya centres. Unifying customer self-service, operations, accounting, staff, and communication.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><button onClick={() => navigate('/login')} className="hover:text-teal-400 transition-colors">Service Booking Portal</button></li>
                <li><a href="#features" className="hover:text-teal-400 transition-colors">WhatsApp Integration</a></li>
                <li><a href="#features" className="hover:text-teal-400 transition-colors">Token Management</a></li>
                <li><a href="#features" className="hover:text-teal-400 transition-colors">Accounting &amp; Wallets</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Company</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-teal-400 transition-colors">About Us</a></li>
                <li><Link to="/contact" className="hover:text-teal-400 transition-colors">Contact Support</Link></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-xs text-navy-400">
            <p>© {new Date().getFullYear()} Muhammed Illyas. All rights reserved.</p>
            <p className="mt-2 md:mt-0 flex items-center">
              Built with <span className="text-teal-500 mx-1">❤️</span> for Digital Kerala
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;