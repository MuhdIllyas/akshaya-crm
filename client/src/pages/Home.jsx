// src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiMessageCircle, FiUsers, FiBriefcase, FiDollarSign, FiPieChart, 
  FiCalendar, FiShield, FiTrendingUp, FiStar, FiArrowRight, FiCheckCircle,
  FiLayers, FiCreditCard, FiBookOpen, FiSmartphone, FiHash, FiTarget,
  FiSettings, FiFolder
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

// ---------------------------------------------------------------------
// Animation Variants
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
            <a href="#features" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Features</a>
            <a href="#workflow" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Workflow</a>
            <a href="#finances" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Finances</a>
            <a href="#multi-centre" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Multi-Centre</a>
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
// Interactive 11-Stage Flow Animation Component (Big & Unboxed)
// ---------------------------------------------------------------------
const HeroAnimation = () => {
  const [activeStage, setActiveStage] = useState(0);

  const stages = [
    { id: 0, title: "Customer", icon: FiUsers },
    { id: 1, title: "Service Request", icon: FiLayers },
    { id: 2, title: "Token", icon: FiHash },
    { id: 3, title: "Staff", icon: FiBriefcase },
    { id: 4, title: "Documents", icon: FiFolder },
    { id: 5, title: "Processing", icon: FiSettings },
    { id: 6, title: "Payment", icon: FiCreditCard },
    { id: 7, title: "Wallets", icon: FiDollarSign },
    { id: 8, title: "WhatsApp", icon: FaWhatsapp },
    { id: 9, title: "Review", icon: FiStar },
    { id: 10, title: "Analytics", icon: FiPieChart },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % stages.length);
    }, 2800); // Transitions every 2.8 seconds
    return () => clearInterval(timer);
  }, [stages.length]);

  return (
    <div className="flex items-center w-full h-[600px] relative mt-10 lg:mt-0">
      
      {/* LEFT: Sleek Vertical Timeline */}
      <div className="w-[120px] sm:w-[150px] shrink-0 h-[500px] flex flex-col justify-between relative z-10">
        {/* Background faded line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-white/10 rounded-full" />
        
        {/* Glowing active progress line */}
        <motion.div
          className="absolute left-[15px] top-2 w-[2px] bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.8)] rounded-full"
          animate={{ height: `${(activeStage / (stages.length - 1)) * 100}%` }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />

        {stages.map((stage, idx) => {
          const isActive = idx === activeStage;
          const isPassed = idx < activeStage;
          return (
            <div key={stage.id} className="flex items-center gap-4 group cursor-default">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 z-10 ${
                isActive 
                  ? 'bg-teal-400 border-teal-400 text-navy-900 shadow-[0_0_20px_rgba(45,212,191,0.6)] scale-125' 
                  : isPassed 
                    ? 'bg-navy-900 border-teal-500/50 text-teal-400' 
                    : 'bg-navy-900 border-white/10 text-white/20'
              }`}>
                <stage.icon className={`transition-all duration-500 ${isActive ? 'w-4 h-4' : 'w-3 h-3'}`} />
              </div>
              <span className={`text-xs sm:text-sm font-bold transition-all duration-500 whitespace-nowrap ${
                isActive ? 'text-white scale-105 origin-left' : isPassed ? 'text-white/60' : 'text-white/20'
              }`}>
                {stage.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* RIGHT: Massive Floating Card Visuals */}
      <div className="flex-1 relative h-[500px] flex items-center justify-center pl-4 sm:pl-8 perspective-1000">
        <AnimatePresence mode="wait">
          
          {/* Card Base Styling (Glassmorphism, Floating, Big) */}
          {activeStage === 0 && (
            <motion.div key="stage0" initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-center">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-500/30 to-transparent rounded-[2.5rem] blur-xl opacity-50 -z-10"></div>
              <FiUsers className="w-20 h-20 text-blue-400 mb-6 drop-shadow-lg" />
              <h3 className="text-3xl font-black text-white mb-2">Customer Walk-in</h3>
              <p className="text-navy-200 text-lg">Muhammed Illyas</p>
              <div className="mt-8 px-5 py-2 bg-blue-500/20 text-blue-300 rounded-full text-sm font-bold border border-blue-500/30">ID: CUST-8492</div>
            </motion.div>
          )}

          {activeStage === 1 && (
            <motion.div key="stage1" initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-center">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-purple-500/30 to-transparent rounded-[2.5rem] blur-xl opacity-50 -z-10"></div>
              <FiLayers className="w-20 h-20 text-purple-400 mb-6 drop-shadow-lg" />
              <h3 className="text-3xl font-black text-white mb-2">Service Request</h3>
              <p className="text-navy-200 text-lg">Passport Application</p>
              <div className="mt-8 px-5 py-2 bg-purple-500/20 text-purple-300 rounded-full text-sm font-bold border border-purple-500/30">Standard Processing</div>
            </motion.div>
          )}

          {activeStage === 2 && (
            <motion.div key="stage2" initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-indigo-500/30 rounded-[2.5rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-center">
              <div className="border-4 border-dashed border-indigo-400/50 p-6 rounded-3xl mb-6 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                <FiHash className="w-16 h-16 text-indigo-400" />
              </div>
              <h3 className="text-5xl font-black text-indigo-300 tracking-widest mb-3 drop-shadow-lg">A-104</h3>
              <p className="text-navy-200 text-lg">Token Generated</p>
            </motion.div>
          )}

          {activeStage === 3 && (
            <motion.div key="stage3" initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-center">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-teal-500/30 to-transparent rounded-[2.5rem] blur-xl opacity-50 -z-10"></div>
              <FiBriefcase className="w-20 h-20 text-teal-400 mb-6 drop-shadow-lg" />
              <h3 className="text-3xl font-black text-white mb-2">Staff Assigned</h3>
              <p className="text-navy-200 text-lg">Counter 03 • Sarah</p>
              <div className="mt-8 px-5 py-2 bg-teal-500/20 text-teal-300 rounded-full text-sm font-bold border border-teal-500/30">Status: Serving</div>
            </motion.div>
          )}

          {activeStage === 4 && (
            <motion.div key="stage4" initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-center">
              <FiFolder className="w-20 h-20 text-amber-400 mb-8 drop-shadow-lg" />
              <h3 className="text-3xl font-black text-white mb-6">Documents Ready</h3>
              <div className="flex flex-col gap-3 w-full text-left">
                <span className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center text-white font-medium shadow-inner"><FiCheckCircle className="text-green-400 mr-3 text-xl"/> Aadhaar Uploaded</span>
                <span className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center text-white font-medium shadow-inner"><FiCheckCircle className="text-green-400 mr-3 text-xl"/> Photo Verified</span>
              </div>
            </motion.div>
          )}

          {activeStage === 5 && (
            <motion.div key="stage5" initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-center">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-pink-500/30 to-transparent rounded-[2.5rem] blur-xl opacity-50 -z-10"></div>
              <FiSettings className="w-24 h-24 text-pink-400 mb-6 drop-shadow-lg animate-spin-slow" />
              <h3 className="text-3xl font-black text-white mb-2">Processing</h3>
              <p className="text-navy-200 text-lg">Filing on Govt Portal...</p>
              <div className="w-full h-2.5 bg-white/10 rounded-full mt-8 overflow-hidden shadow-inner">
                 <motion.div initial={{ width: "0%" }} animate={{ width: "75%" }} transition={{ duration: 2, ease: "easeOut" }} className="h-full bg-pink-400 rounded-full shadow-[0_0_10px_rgba(244,114,182,0.8)]"></motion.div>
              </div>
            </motion.div>
          )}

          {activeStage === 6 && (
            <motion.div key="stage6" initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-green-500/20 rounded-[2.5rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                <FiCreditCard className="w-12 h-12 text-green-400 drop-shadow-lg" />
              </div>
              <p className="text-navy-200 text-lg uppercase tracking-wider mb-2">Payment Collected</p>
              <h3 className="text-5xl font-black text-green-400 drop-shadow-md">₹1,500</h3>
            </motion.div>
          )}

          {activeStage === 7 && (
            <motion.div key="stage7" initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-center">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-emerald-500/30 to-transparent rounded-[2.5rem] blur-xl opacity-50 -z-10"></div>
              <FiDollarSign className="w-20 h-20 text-emerald-400 mb-6 drop-shadow-lg" />
              <h3 className="text-3xl font-black text-white mb-2">Wallet Updated</h3>
              <p className="text-navy-200 text-lg">Cash Account</p>
              <div className="mt-8 px-6 py-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl text-base font-bold border border-emerald-500/30 shadow-inner">+ ₹1,500 Logged</div>
            </motion.div>
          )}

          {activeStage === 8 && (
            <motion.div key="stage8" initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-center">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-[#25D366]/20 to-transparent rounded-[2.5rem] blur-xl opacity-50 -z-10"></div>
              <FaWhatsapp className="w-20 h-20 text-[#25D366] mb-8 drop-shadow-lg animate-pulse" />
              <div className="bg-[#056162] p-5 rounded-2xl rounded-tl-none w-full text-left relative shadow-2xl border border-white/10">
                <p className="text-white text-base leading-relaxed">Your Passport application is complete. Receipt attached.</p>
                <span className="text-xs text-white/50 absolute bottom-2 right-3">✓✓</span>
              </div>
              <p className="text-navy-200 mt-8 font-bold tracking-wide uppercase">Customer Notified</p>
            </motion.div>
          )}

          {activeStage === 9 && (
            <motion.div key="stage9" initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-center">
              <div className="flex gap-2 mb-8">
                {[1,2,3,4,5].map(i => (
                  <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1, type: 'spring' }}>
                    <FiStar className="w-10 h-10 text-yellow-400 fill-current drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]" />
                  </motion.div>
                ))}
              </div>
              <h3 className="text-3xl font-black text-white mb-4">5-Star Review</h3>
              <p className="text-navy-200 text-lg italic bg-white/5 p-4 rounded-xl shadow-inner border border-white/10">"Very fast and helpful service!"</p>
            </motion.div>
          )}

          {activeStage === 10 && (
            <motion.div key="stage10" initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-center">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-500/30 to-transparent rounded-[2.5rem] blur-xl opacity-50 -z-10"></div>
              <FiPieChart className="w-20 h-20 text-blue-400 mb-8 drop-shadow-lg" />
              <h3 className="text-3xl font-black text-white mb-6">Analytics Synced</h3>
              <div className="flex flex-col gap-3 w-full">
                <div className="flex justify-between items-center text-base text-navy-100 bg-white/5 border border-white/10 p-4 rounded-xl shadow-inner">
                  <span>Daily Revenue</span> <span className="text-green-400 font-bold">↑ ₹1,500</span>
                </div>
                <div className="flex justify-between items-center text-base text-navy-100 bg-white/5 border border-white/10 p-4 rounded-xl shadow-inner">
                  <span>Completed</span> <span className="text-blue-400 font-bold">+1</span>
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
// Main App / Homepage Component
// ---------------------------------------------------------------------
const Home = () => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans selection:bg-teal-500 selection:text-white overflow-hidden">
      <Navbar />

      {/* 1. HERO SECTION (Massive Unboxed Animation) */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 bg-navy-900 overflow-hidden min-h-screen flex items-center">
        {/* Deep Glowing Backgrounds */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-500/20 blur-[150px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[150px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-4 items-center">
            
            {/* Hero Copy (Left Column) */}
            <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="pr-0 lg:pr-10">
              <motion.div variants={fadeUp} className="inline-flex items-center px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6 backdrop-blur-sm shadow-xl">
                <span className="flex h-2 w-2 rounded-full bg-teal-400 mr-2 animate-pulse"></span>
                <span className="text-xs font-bold tracking-wider text-teal-300 uppercase">One Customer. One Complete Journey.</span>
              </motion.div>
              
              <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
                Run Your Entire <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400 drop-shadow-sm">Akshaya Centre</span> From One Platform.
              </motion.h1>
              
              <motion.p variants={fadeUp} className="text-lg text-navy-200 mb-10 max-w-xl leading-relaxed">
                Watch how a single service seamlessly moves from customer booking, through staff processing and payments, directly into automated WhatsApp updates and accounting analytics.
              </motion.p>
              
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
                <Link to="/login" className="px-8 py-4 bg-teal-500 hover:bg-teal-400 text-navy-900 font-bold rounded-xl shadow-[0_0_20px_rgba(20,184,166,0.4)] transition-all flex items-center justify-center group text-lg">
                  Book Service <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/login" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all flex items-center justify-center text-lg backdrop-blur-md">
                  Sign In
                </Link>
              </motion.div>
            </motion.div>

            {/* Interactive Unboxed Animation (Right Column) */}
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ duration: 1, delay: 0.2 }}
              className="relative w-full"
            >
              <HeroAnimation />
            </motion.div>

          </div>
        </div>
      </section>

      {/* 2. CORE FEATURES (Complete 8-Card Grid) */}
      <section id="features" className="py-24 bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">One Platform. Your Entire Centre.</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Stop jumping between spreadsheets, physical paper tokens, and chat apps. Sahayi connects your operations.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1: WhatsApp */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                <FiMessageCircle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">WhatsApp Business</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">Meta-linked WhatsApp for customer conversations, automated service status updates, and payment reminders via templates.</p>
            </motion.div>

            {/* Feature 2: Customer 360 & Online Booking */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FiUsers className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Customer Management</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">Self-registration via WhatsApp OTP, online service booking, digital documents, payment history, and reviews all stored centrally.</p>
            </motion.div>

            {/* Feature 3: Service Operations */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <FiLayers className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Service Operations</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">Manage complete service catalogues, customer entries, staff allocations, and track pending vs completed service workflows.</p>
            </motion.div>

            {/* Feature 4: Companion App */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <FiSmartphone className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Companion App</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">Staff mobile app for GPS attendance punch in-out, push notifications, instant customer lookup, quick calling, and daily tasks.</p>
            </motion.div>

            {/* Feature 5: Token Management */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <FiHash className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Token &amp; Queue</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">Generate daily and campaign tokens. Manage queue status, assign staff dynamically, and send live WhatsApp queue alerts to customers.</p>
            </motion.div>

            {/* Feature 6: Campaign Management */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <FiTarget className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Campaigns</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">Create targeted service drives, issue campaign-specific tokens, track conversions, and broadcast WhatsApp updates effortlessly.</p>
            </motion.div>

            {/* Feature 7: Reviews & Feedback */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.6 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <FiStar className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Reviews &amp; Feedback</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">Collect post-service customer feedback automatically to measure citizen satisfaction, staff helpfulness, and service ratings.</p>
            </motion.div>

            {/* Feature 8: Calendar & Tasks */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.7 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-green-600 group-hover:text-white transition-colors">
                <FiCalendar className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Calendar &amp; Tasks</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">Schedule appointments, track centre holidays and government deadlines, set task reminders, and coordinate staff work.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. FINANCIAL MANAGEMENT */}
      <section id="finances" className="py-24 bg-navy-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="lg:w-1/3">
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-4">Know Where Your Money Is.</motion.h2>
              <motion.p variants={fadeUp} className="text-navy-200 text-lg mb-8">Manage your centre's finances with real-time wallets, transactions, expenses, ledgers, and strict accounting controls.</motion.p>
              <motion.button variants={fadeUp} className="text-teal-400 font-bold flex items-center hover:text-teal-300 transition-colors">
                Explore Finance Features <FiArrowRight className="ml-2" />
              </motion.button>
            </motion.div>

            <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-navy-800 border border-navy-700 p-6 rounded-2xl">
                <FiDollarSign className="text-green-400 h-8 w-8 mb-4" />
                <h3 className="font-bold text-lg mb-2">Wallet Management</h3>
                <p className="text-navy-300 text-sm">Track Cash, Bank, and Digital wallets. Handle secure transactions, wallet transfers, and automated wallet reconciliation.</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="bg-navy-800 border border-navy-700 p-6 rounded-2xl">
                <FiBookOpen className="text-blue-400 h-8 w-8 mb-4" />
                <h3 className="font-bold text-lg mb-2">Accounts &amp; Ledger</h3>
                <p className="text-navy-300 text-sm">Maintain a comprehensive ledger for tracking all income, expenses, account corrections, and executing seamless daily closing.</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="bg-navy-800 border border-navy-700 p-6 rounded-2xl">
                <FiCreditCard className="text-amber-400 h-8 w-8 mb-4" />
                <h3 className="font-bold text-lg mb-2">Expense Management</h3>
                <p className="text-navy-300 text-sm">Record precise expenses with approval workflows. Link expenses directly to specific wallets or operational teams.</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="bg-navy-800 border border-navy-700 p-6 rounded-2xl">
                <FiPieChart className="text-teal-400 h-8 w-8 mb-4" />
                <h3 className="font-bold text-lg mb-2">Profit Analytics</h3>
                <p className="text-navy-300 text-sm">Instantly visualize Gross Revenue vs Service Charges vs Expenses to calculate true Net Profit and perform deep financial analytics.</p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 & 5. STAFF & TEAMS */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-gray-50 rounded-3xl p-6 border border-gray-200 shadow-inner">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-navy-900 text-white p-4 font-bold flex justify-between items-center">
                  <span>Team Performance</span>
                  <span className="text-xs bg-white/20 px-2 py-1 rounded">This Month</span>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                    <span className="text-gray-500 text-sm">Expected Revenue</span>
                    <span className="font-bold text-gray-900">₹4,80,000</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                    <span className="text-gray-500 text-sm">Collected Revenue</span>
                    <span className="font-bold text-green-600">₹4,35,000</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                    <span className="text-gray-500 text-sm">Pending Revenue</span>
                    <span className="font-bold text-amber-500">₹45,000</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-gray-500 text-sm">Service Profit</span>
                    <span className="font-bold text-gray-900">₹1,72,000</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                    <span className="text-gray-500 text-sm">Team Expenses</span>
                    <span className="font-bold text-red-500">- ₹42,000</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 bg-teal-50 p-3 rounded-xl border border-teal-100">
                    <span className="text-teal-800 font-bold">Team Net Profit</span>
                    <span className="font-black text-teal-700 text-lg">₹1,30,000</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">Turn Staff Activity Into Business Insights.</motion.h2>
              <motion.p variants={fadeUp} className="text-gray-600 text-lg mb-8">Know exactly who is working, what applications they are handling, and how much value they generate for the centre.</motion.p>
              
              <div className="space-y-6">
                <motion.div variants={fadeUp} className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <FiUsers className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Staff &amp; HR Management</h4>
                    <p className="text-sm text-gray-600 mt-1">Manage GPS-verified attendance (punch in/out), leave tracking, salary structures, payroll, and staff performance metrics.</p>
                  </div>
                </motion.div>
                
                <motion.div variants={fadeUp} className="flex gap-4">
                  <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center shrink-0">
                    <FiTrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Team Profitability &amp; Performance</h4>
                    <p className="text-sm text-gray-600 mt-1">Create multiple teams, assign staff, measure exact team revenue, track team expenses, and analyze overall team profit.</p>
                  </div>
                </motion.div>
                
                <motion.div variants={fadeUp} className="flex gap-4">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                    <FiTarget className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Staff Targets &amp; Incentives</h4>
                    <p className="text-sm text-gray-600 mt-1">Set clear staff targets, monitor completion rates, and calculate performance-based incentives automatically.</p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 10. MULTI-CENTRE MANAGEMENT */}
      <section id="multi-centre" className="py-24 bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">One Business. Multiple Centres. One Control Panel.</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-16">Akshaya Sahayi is built for scale. Manage a single shop or an entire network of centres with consolidated business analytics.</p>
          </motion.div>

          <div className="flex justify-center mb-12">
            <div className="flex flex-col items-center w-full max-w-4xl">
              <div className="bg-navy-900 text-white font-bold px-8 py-3 rounded-xl shadow-lg z-10 flex flex-col items-center">
                <span>SUPERADMIN</span>
                <span className="text-[10px] font-normal text-navy-300 mt-0.5 uppercase tracking-wide">Network Control</span>
              </div>
              <div className="w-full flex justify-center mt-[-2px]">
                <div className="w-px h-8 bg-gray-300"></div>
              </div>
              <div className="w-2/3 md:w-1/2 border-t-2 border-gray-300 h-8 flex justify-between">
                <div className="w-px h-8 bg-gray-300"></div>
                <div className="w-px h-8 bg-gray-300"></div>
                <div className="w-px h-8 bg-gray-300 hidden sm:block"></div>
              </div>
              <div className="w-full flex justify-center gap-4 sm:gap-16">
                <div className="flex flex-col items-center">
                  <div className="bg-teal-500 text-white font-bold px-6 py-2 rounded-lg shadow mb-3 z-10 text-sm flex flex-col items-center">
                    <span>Centre A</span>
                    <span className="text-[10px] font-medium text-teal-100">Management</span>
                  </div>
                  <div className="w-px h-6 bg-gray-300"></div>
                  <div className="bg-white border border-gray-200 text-gray-700 font-semibold px-4 py-1.5 rounded text-xs mb-2">Centre Admin</div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="bg-gray-100 text-gray-600 px-4 py-1 rounded text-xs">Centre Staff</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="bg-blue-500 text-white font-bold px-6 py-2 rounded-lg shadow mb-3 z-10 text-sm flex flex-col items-center">
                    <span>Centre B</span>
                    <span className="text-[10px] font-medium text-blue-100">Management</span>
                  </div>
                  <div className="w-px h-6 bg-gray-300"></div>
                  <div className="bg-white border border-gray-200 text-gray-700 font-semibold px-4 py-1.5 rounded text-xs mb-2">Centre Admin</div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="bg-gray-100 text-gray-600 px-4 py-1 rounded text-xs">Centre Staff</div>
                </div>
                <div className="hidden sm:flex flex-col items-center">
                  <div className="bg-purple-500 text-white font-bold px-6 py-2 rounded-lg shadow mb-3 z-10 text-sm flex flex-col items-center">
                    <span>Centre C</span>
                    <span className="text-[10px] font-medium text-purple-100">Management</span>
                  </div>
                  <div className="w-px h-6 bg-gray-300"></div>
                  <div className="bg-white border border-gray-200 text-gray-700 font-semibold px-4 py-1.5 rounded text-xs mb-2">Centre Admin</div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="bg-gray-100 text-gray-600 px-4 py-1 rounded text-xs">Centre Staff</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 12 & 13. WHY US & SECURITY */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">Built Around the Way Your Centre Actually Works.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <FiShield className="h-8 w-8 text-teal-600 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Secure &amp; Role Based</h3>
              <p className="text-sm text-gray-600">Strict access controls. Superadmins, Admins, Staff, and Customers only see what they are supposed to see.</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <FiMessageCircle className="h-8 w-8 text-teal-600 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Connected Comms</h3>
              <p className="text-sm text-gray-600">Customer booking updates, queue alerts, and staff coordination happen in a single, unbroken workflow.</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <FiDollarSign className="h-8 w-8 text-teal-600 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Financial Control</h3>
              <p className="text-sm text-gray-600">Stop leaking revenue. Track every rupee across wallets, service fees, online payments, and expenses.</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <FiTrendingUp className="h-8 w-8 text-teal-600 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Business Visibility</h3>
              <p className="text-sm text-gray-600">Understand your centre using real-time operational reports, citizen feedback ratings, and financial metrics.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 14. CTA SECTION */}
      <section className="py-20 relative bg-teal-500 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-extrabold text-navy-900 mb-6">Ready to Modernize Your Centre?</h2>
          <p className="text-teal-900 text-lg mb-10 font-medium max-w-2xl mx-auto">
            Bring your customers, service bookings, staff, WhatsApp notifications, and finances together into one intelligent platform.
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
            <Link 
              to="/contact" 
              className="px-8 py-4 bg-white hover:bg-gray-50 text-teal-600 font-bold rounded-xl shadow-md transition-all transform hover:-translate-y-0.5"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* 15. FOOTER */}
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
                <li><a href="#" className="hover:text-teal-400 transition-colors">WhatsApp Integration</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Staff Companion App</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Token Management</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Accounting &amp; Wallets</a></li>
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