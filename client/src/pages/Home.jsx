// src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiMessageCircle, FiUsers, FiBriefcase, FiDollarSign, FiPieChart, 
  FiCalendar, FiShield, FiTrendingUp, FiStar, FiArrowRight, FiCheckCircle,
  FiLayers, FiActivity, FiCreditCard, FiBookOpen, FiSmartphone, FiHash, FiTarget,
  FiMapPin, FiPhone, FiMail, FiRefreshCw, FiUser, FiFileText, FiClock
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
// INTERACTIVE CINEMATIC ANIMATION
// ---------------------------------------------------------------------
const CinematicHero = () => {
  const [activeStage, setActiveStage] = useState(0);

  const stages = [
    { id: 0, title: "Omnichannel Booking", icon: FiUsers },
    { id: 1, title: "Smart Queueing", icon: FiLayers },
    { id: 2, title: "Processing & WA", icon: FiBriefcase },
    { id: 3, title: "Status Updates", icon: FiRefreshCw },
    { id: 4, title: "Payments & Wallets", icon: FiCreditCard },
    { id: 5, title: "Service Completed", icon: FiCheckCircle },
    { id: 6, title: "Admin Overview", icon: FiPieChart },
    { id: 7, title: "Happy Customers", icon: FiStar },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % stages.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [stages.length]);

  return (
    <div className="flex flex-col lg:flex-row items-center w-full h-[650px] relative mt-10 lg:mt-0">
      
      {/* LEFT: Sleek Vertical Timeline */}
      <div className="hidden sm:flex w-[180px] shrink-0 h-[550px] flex-col justify-between relative z-10">
        <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-white/10 rounded-full" />
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
                isActive ? 'text-white scale-105 origin-left shadow-sm' : isPassed ? 'text-white/60' : 'text-white/20'
              }`}>
                {stage.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* RIGHT: Massive Cinematic Unboxed Cards */}
      <div className="flex-1 relative h-[550px] w-full flex items-center justify-center lg:pl-8 perspective-1000">
        <AnimatePresence mode="wait">
          
          {activeStage === 0 && (
            <motion.div key="stage0" initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-lg flex flex-col sm:flex-row gap-6 items-center justify-center">
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center w-full relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 border border-blue-500/30"><FiUser className="w-8 h-8 text-blue-400" /></div>
                <h3 className="text-xl font-bold text-white mb-1">Walk-in Visit</h3>
                <p className="text-navy-200 text-sm text-center">Customer arrives at the desk</p>
                <div className="mt-4 px-4 py-1.5 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold border border-blue-500/30">Service: Aadhaar Update</div>
              </div>
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center w-full relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 border border-purple-500/30"><FiSmartphone className="w-8 h-8 text-purple-400" /></div>
                <h3 className="text-xl font-bold text-white mb-1">Online Portal</h3>
                <p className="text-navy-200 text-sm text-center">Customer books from phone</p>
                <div className="mt-4 px-4 py-1.5 bg-purple-500/20 text-purple-300 rounded-full text-xs font-bold border border-purple-500/30">Service: Passport Renewal</div>
              </div>
            </motion.div>
          )}

          {activeStage === 1 && (
            <motion.div key="stage1" initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-lg bg-navy-800/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden">
              <div className="bg-navy-900 px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <span className="text-white font-bold text-sm">Staff Dashboard Queue</span>
                <FiLayers className="text-teal-400" />
              </div>
              <div className="p-6 flex gap-4 w-full">
                <div className="flex-1 bg-navy-900/50 p-4 rounded-xl border border-white/5">
                  <h4 className="text-xs text-blue-400 mb-3 font-bold flex items-center"><FiUser className="mr-1.5"/> WALK-IN TOKENS</h4>
                  <div className="bg-white/10 p-4 rounded-lg border border-white/10 shadow-inner mb-3">
                    <div className="flex justify-between items-center mb-1"><span className="text-white font-bold">W-102</span><span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">Waiting</span></div>
                    <p className="text-xs text-navy-200">Aadhaar Update</p>
                  </div>
                </div>
                <div className="flex-1 bg-navy-900/50 p-4 rounded-xl border border-white/5">
                  <h4 className="text-xs text-purple-400 mb-3 font-bold flex items-center"><FiSmartphone className="mr-1.5"/> ONLINE TOKENS</h4>
                  <div className="bg-white/10 p-4 rounded-lg border border-white/10 shadow-inner">
                    <div className="flex justify-between items-center mb-1"><span className="text-white font-bold">O-405</span><span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">Waiting</span></div>
                    <p className="text-xs text-navy-200">Passport Renewal</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeStage === 2 && (
            <motion.div key="stage2" initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm flex flex-col items-center">
              <div className="w-full bg-white/5 backdrop-blur-2xl border border-teal-500/30 rounded-3xl p-8 shadow-[0_30px_60px_rgba(20,184,166,0.15)] flex flex-col items-center relative z-10">
                <div className="w-20 h-20 bg-teal-500/20 rounded-full flex items-center justify-center mb-4 border border-teal-500/40">
                  <FiBriefcase className="w-10 h-10 text-teal-400" />
                </div>
                <h3 className="text-2xl font-black text-white mb-1">Staff Takes Ticket</h3>
                <p className="text-teal-200 font-bold mb-4">Processing O-405</p>
                <div className="w-full h-2 bg-navy-900 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: "20%" }} transition={{ duration: 1 }} className="h-full bg-teal-400"></motion.div></div>
              </div>
              
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: -30, x: 60, opacity: 1 }} transition={{ delay: 0.8 }} className="absolute -bottom-10 right-[-20%] bg-[#056162] text-white p-4 rounded-2xl rounded-tl-none shadow-2xl border border-[#128C7E]/50 w-72 text-left z-20">
                <div className="flex items-center gap-2 mb-2"><FaWhatsapp className="text-[#25D366] text-lg"/> <span className="text-xs font-bold text-gray-200">Automated Message</span></div>
                <p className="text-sm leading-relaxed">Hi Muhammed, we have received your Passport Renewal request and our staff has just started processing it. 🚀</p>
              </motion.div>
            </motion.div>
          )}

          {activeStage === 3 && (
            <motion.div key="stage3" initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm flex flex-col items-center">
              <div className="w-full bg-white/5 backdrop-blur-2xl border border-blue-500/30 rounded-3xl p-8 shadow-[0_30px_60px_rgba(59,130,246,0.15)] flex flex-col items-center relative z-10">
                <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 border border-blue-500/40">
                  <FiSettings className="w-10 h-10 text-blue-400 animate-spin-slow" />
                </div>
                <h3 className="text-2xl font-black text-white mb-1">Status Updated</h3>
                <p className="text-blue-200 font-bold mb-4">Documents Verified</p>
                <div className="w-full h-2 bg-navy-900 rounded-full overflow-hidden"><motion.div initial={{ width: "20%" }} animate={{ width: "70%" }} transition={{ duration: 1 }} className="h-full bg-blue-400"></motion.div></div>
              </div>
              
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: -30, x: 60, opacity: 1 }} transition={{ delay: 0.8 }} className="absolute -bottom-10 right-[-20%] bg-[#056162] text-white p-4 rounded-2xl rounded-tl-none shadow-2xl border border-[#128C7E]/50 w-72 text-left z-20">
                <div className="flex items-center gap-2 mb-2"><FaWhatsapp className="text-[#25D366] text-lg"/> <span className="text-xs font-bold text-gray-200">Automated Update</span></div>
                <p className="text-sm leading-relaxed">Update: Your documents have been successfully verified! We are now filing your application on the portal.</p>
              </motion.div>
            </motion.div>
          )}

          {activeStage === 4 && (
            <motion.div key="stage4" initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-md flex flex-col items-center">
              <div className="flex flex-col items-center w-full">
                
                <motion.div initial={{ y: -20 }} animate={{ y: 0 }} className="w-full bg-emerald-500/20 backdrop-blur-xl border border-emerald-500/40 rounded-2xl p-6 shadow-2xl flex items-center justify-between z-20 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent"></div>
                  <div className="relative z-10">
                    <p className="text-emerald-200 font-bold text-xs uppercase tracking-wider mb-1">Payment Received</p>
                    <h3 className="text-4xl font-black text-emerald-400">₹1,500</h3>
                  </div>
                  <FiCreditCard className="w-12 h-12 text-emerald-400/50 relative z-10" />
                </motion.div>

                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 40, opacity: 1 }} transition={{ delay: 0.6 }} className="w-[2px] bg-emerald-500/50 my-2 shadow-[0_0_10px_rgba(16,185,129,1)]"></motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1 }} className="w-11/12 bg-navy-800/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl flex items-center justify-between z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-navy-900 rounded-lg border border-white/5 flex items-center justify-center"><FiBookOpen className="text-white/50 w-5 h-5"/></div>
                    <div>
                      <p className="text-white font-bold text-sm mb-0.5">UPI Wallet Ledger</p>
                      <p className="text-emerald-400 text-xs font-bold">+ ₹1,500 Logged & Reconciled</p>
                    </div>
                  </div>
                </motion.div>

              </div>
            </motion.div>
          )}

          {activeStage === 5 && (
            <motion.div key="stage5" initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm flex flex-col items-center">
              <div className="w-full bg-white/5 backdrop-blur-2xl border border-green-500/30 rounded-3xl p-8 shadow-[0_30px_60px_rgba(34,197,94,0.15)] flex flex-col items-center relative z-10">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(34,197,94,0.5)]">
                  <FiCheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-black text-white mb-1">Service Completed</h3>
                <p className="text-green-200 font-bold mb-4">Transaction Closed</p>
                <div className="w-full h-2 bg-navy-900 rounded-full overflow-hidden"><motion.div initial={{ width: "70%" }} animate={{ width: "100%" }} transition={{ duration: 0.5 }} className="h-full bg-green-400"></motion.div></div>
              </div>
              
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: -30, x: 60, opacity: 1 }} transition={{ delay: 0.8 }} className="absolute -bottom-10 right-[-20%] bg-[#056162] text-white p-4 rounded-2xl rounded-tl-none shadow-2xl border border-[#128C7E]/50 w-72 text-left z-20">
                <div className="flex items-center gap-2 mb-2"><FaWhatsapp className="text-[#25D366] text-lg"/> <span className="text-xs font-bold text-gray-200">Service Complete</span></div>
                <p className="text-sm leading-relaxed mb-3">Your Passport Renewal is successfully completed! Thank you for choosing us.</p>
                <div className="bg-white/10 p-2 rounded flex items-center border border-white/20"><FiFileText className="mr-2 text-red-300"/> <span className="text-xs font-bold">Receipt_O-405.pdf</span></div>
              </motion.div>
            </motion.div>
          )}

          {activeStage === 6 && (
            <motion.div key="stage6" initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-lg bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] p-6 overflow-hidden">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center"><FiPieChart className="mr-3 text-pink-400"/> Admin Command Centre</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-navy-900/60 p-4 rounded-2xl border border-white/5">
                  <p className="text-xs text-navy-300 mb-1 font-bold uppercase tracking-wider">Today's Revenue</p>
                  <p className="text-2xl font-black text-emerald-400 flex items-center"><FiTrendingUp className="mr-2 w-5 h-5"/> ₹12,400</p>
                </motion.div>
                
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="bg-navy-900/60 p-4 rounded-2xl border border-white/5">
                  <p className="text-xs text-navy-300 mb-1 font-bold uppercase tracking-wider">Staff Leaderboard</p>
                  <div className="flex justify-between items-center"><span className="text-white font-bold text-sm">1. Sarah</span> <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-bold">18 Services</span></div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="col-span-2 bg-navy-900/60 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-navy-300 mb-1 font-bold uppercase tracking-wider">Accounting Status</p>
                    <p className="text-sm font-bold text-white">All Ledgers Reconciled</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30"><FiCheckCircle className="text-green-400" /></div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {activeStage === 7 && (
            <motion.div key="stage7" initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.5 }} className="absolute w-full max-w-sm flex flex-col items-center text-center">
              
              <div className="flex gap-2 mb-8">
                {[1,2,3,4,5].map(i => (
                  <motion.div key={i} initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}>
                    <FiStar className="w-12 h-12 text-yellow-400 fill-current drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" />
                  </motion.div>
                ))}
              </div>
              
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }} className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-2xl mb-8 relative">
                <div className="absolute -top-3 -left-3 text-4xl text-white/20 font-serif">"</div>
                <p className="text-white text-lg font-medium leading-relaxed z-10 relative">
                  Loved the automated WhatsApp updates. I didn't even have to call the centre to check my status!
                </p>
                <p className="text-navy-300 text-sm mt-3 font-bold">— Muhammed I.</p>
              </motion.div>

              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.2 }} className="px-6 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full font-bold flex items-center shadow-[0_0_20px_rgba(20,184,166,0.2)]">
                <FiTrendingUp className="mr-2" /> Centre Growth +18%
              </motion.div>

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

      {/* 1. HERO SECTION (Static Dashboard Profile) */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 bg-navy-900 overflow-hidden min-h-[90vh] flex items-center">
        {/* Background Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-500/20 blur-[150px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[150px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-4 items-center">
            
            {/* Hero Copy */}
            <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="pr-0 lg:pr-10 text-center lg:text-left mt-8 lg:mt-0">
              <motion.div variants={fadeUp} className="inline-flex items-center px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6 backdrop-blur-sm shadow-xl">
                <span className="flex h-2 w-2 rounded-full bg-teal-400 mr-2 animate-pulse"></span>
                <span className="text-xs font-bold tracking-wider text-teal-300 uppercase">Unified e-Governance Platform</span>
              </motion.div>
              
              <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
                Run Your Entire <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400 drop-shadow-sm">Akshaya Centre</span> From One Platform.
              </motion.h1>
              
              <motion.p variants={fadeUp} className="text-lg text-navy-200 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Empower citizens to book services online, while bringing your operations, staff, WhatsApp notifications, accounting, and multi-centre analytics together seamlessly.
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

            {/* Static Dashboard Card */}
            <motion.div 
              initial={{ opacity: 0, x: 50, rotateY: 15 }} 
              animate={{ opacity: 1, x: 0, rotateY: 0 }} 
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative perspective-1000 w-full"
            >
              <div className="bg-navy-800 rounded-2xl border border-white/10 shadow-2xl overflow-hidden transform rotate-1 hover:rotate-0 transition-transform duration-500">
                <div className="bg-navy-900/50 px-6 py-4 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center border border-teal-500/30">
                      <FiActivity className="text-teal-400 h-4 w-4" />
                    </div>
                    <span className="text-white font-bold text-sm">Akshaya Sahayi Workspace</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <p className="text-navy-300 text-xs mb-1">Revenue</p>
                      <p className="text-white font-bold">₹48,250</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <p className="text-navy-300 text-xs mb-1">Wallets</p>
                      <p className="text-white font-bold">₹1,24,500</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <p className="text-navy-300 text-xs mb-1">Staff</p>
                      <p className="text-white font-bold">12 Active</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <p className="text-navy-300 text-xs mb-1">Online Bookings</p>
                      <p className="text-white font-bold">29 New</p>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-xl border border-white/5 p-4 mb-6 relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm font-semibold text-white">Service Volume & Bookings</p>
                      <span className="text-xs text-teal-400 bg-teal-400/10 px-2 py-1 rounded-md">+24% this week</span>
                    </div>
                    <div className="h-24 flex items-end gap-2">
                      {[40, 70, 45, 90, 65, 85, 110].map((h, i) => (
                        <div key={i} className="flex-1 bg-gradient-to-t from-teal-500/20 to-teal-400 rounded-t-sm relative group" style={{ height: `${h}%` }}>
                          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-blue-300 text-xs mb-1">Completed Services</p>
                        <p className="text-white font-bold text-lg">186</p>
                      </div>
                      <FiLayers className="text-blue-400 h-6 w-6 opacity-50" />
                    </div>
                    <div className="bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-amber-300 text-xs mb-1">Pending Clearance</p>
                        <p className="text-white font-bold text-lg">₹23,450</p>
                      </div>
                      <FiDollarSign className="text-amber-400 h-6 w-6 opacity-50" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* 2. THE CINEMATIC JOURNEY SECTION */}
      <section id="workflow" className="py-24 bg-navy-800 relative overflow-hidden border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            
            <div className="pr-0 lg:pr-10 text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">One Platform. One Complete Journey.</h2>
              <p className="text-lg text-navy-200 mb-8 leading-relaxed">
                Watch how a single service seamlessly moves from customer booking, through staff processing and payments, directly into automated WhatsApp updates and accounting analytics.
              </p>
            </div>
            
            <div className="relative w-full">
              <CinematicHero />
            </div>

          </div>
        </div>
      </section>

      {/* 3. CORE FEATURES GRID */}
      <section id="features" className="py-24 bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">Tools for Every Part of Your Centre.</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">From managing the front-desk queue to reconciling the backend accounts.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                <FiMessageCircle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">WhatsApp Business</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Meta-linked WhatsApp for customer conversations, automated updates, and payment reminders via templates.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FiUsers className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Customer Management</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Self-registration via WhatsApp OTP, online service booking, payment history, and reviews stored centrally.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <FiLayers className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Service Operations</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Manage complete service catalogues, customer entries, staff allocations, and track workflows.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <FiSmartphone className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Companion App</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Staff mobile app for GPS attendance, push notifications, instant customer lookup, and daily tasks.</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <FiHash className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Token & Queue</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Generate daily tokens, manage queue status, assign staff dynamically, and send live queue alerts.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <FiTarget className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Campaigns</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Create targeted service drives, track conversions, and broadcast WhatsApp updates effortlessly.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <FiStar className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Reviews & Feedback</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Collect post-service feedback automatically to measure citizen satisfaction and staff ratings.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mb-5 group-hover:bg-green-600 group-hover:text-white transition-colors">
                <FiCalendar className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Calendar & Tasks</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Schedule appointments, track government deadlines, set task reminders, and coordinate work.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FINANCIAL MANAGEMENT */}
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

      {/* 5. TEAMS & PERFORMANCE */}
      <section className="py-24 bg-white border-b border-gray-200">
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
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 6. MULTI-CENTRE MANAGEMENT */}
      <section id="multi-centre" className="py-24 bg-gray-50 border-b border-gray-200">
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

      {/* 7. CONTACT SECTION */}
      <ContactSection />

      {/* 8. FINAL CTA SECTION */}
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

      {/* 9. FOOTER */}
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
                <li><a href="#features" className="hover:text-teal-400 transition-colors">Staff Companion App</a></li>
                <li><a href="#features" className="hover:text-teal-400 transition-colors">Token Management</a></li>
                <li><a href="#finances" className="hover:text-teal-400 transition-colors">Accounting &amp; Wallets</a></li>
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