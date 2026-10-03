// src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiMessageCircle, FiUsers, FiBriefcase, FiDollarSign, FiPieChart, 
  FiCalendar, FiShield, FiTrendingUp, FiStar, FiArrowRight, FiCheckCircle,
  FiLayers, FiActivity, FiCreditCard, FiBookOpen, FiSmartphone, FiHash, FiTarget,
  FiGlobe, FiUserCheck, FiClock, FiFileText
} from 'react-icons/fi';

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
            <a href="#citizen-portal" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Customer Portal</a>
            <a href="#workflow" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Workflow</a>
            <a href="#finances" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Finances</a>
            <a href="#multi-centre" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Multi-Centre</a>
          </div>

          <div className="flex items-center space-x-3">
            <button 
              onClick={() => navigate('/login')} 
              className={`hidden sm:block text-sm font-bold transition-colors ${scrolled ? 'text-navy-900 hover:text-teal-600' : 'text-white hover:text-teal-300'}`}
            >
              Sign In
            </button>
            <Link 
              to="/login" 
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-teal-300 border border-teal-500/30 text-xs sm:text-sm font-bold rounded-xl transition-all backdrop-blur-sm hidden lg:inline-flex items-center"
            >
              <FiGlobe className="mr-1.5" /> Citizen Portal
            </Link>
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
// Main Page Component
// ---------------------------------------------------------------------
const Home = () => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans selection:bg-teal-500 selection:text-white overflow-hidden">
      <Navbar />

      {/* 1. HERO SECTION */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 bg-navy-900 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-500/20 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            
            {/* Hero Copy */}
            <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
              <motion.div variants={fadeUp} className="inline-flex items-center px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6 backdrop-blur-sm">
                <span className="flex h-2 w-2 rounded-full bg-teal-400 mr-2 animate-pulse"></span>
                <span className="text-xs font-bold tracking-wider text-teal-300 uppercase">Unified e-Governance Platform</span>
              </motion.div>
              
              <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
                Run Your Entire <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400">Akshaya Centre</span> From One Platform.
              </motion.h1>
              
              <motion.p variants={fadeUp} className="text-lg text-navy-200 mb-8 max-w-xl leading-relaxed">
                Empower citizens to register and book services online, while bringing operations, staff, WhatsApp notifications, accounting, and multi-centre analytics together seamlessly.
              </motion.p>
              
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
                <Link to="/login" className="px-8 py-4 bg-teal-500 hover:bg-teal-400 text-navy-900 font-bold rounded-xl shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-all flex items-center justify-center group">
                  Book a Service <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a href="#citizen-portal" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all flex items-center justify-center">
                  Customer Portal
                </a>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-6 text-sm text-navy-300 font-medium">
                <span className="flex items-center"><FiCheckCircle className="text-teal-500 mr-2" /> Self Registration</span>
                <span className="flex items-center"><FiCheckCircle className="text-teal-500 mr-2" /> Online Booking</span>
                <span className="flex items-center"><FiCheckCircle className="text-teal-500 mr-2" /> Live Tracking</span>
                <span className="flex items-center"><FiCheckCircle className="text-teal-500 mr-2" /> WhatsApp Updates</span>
              </motion.div>
            </motion.div>

            {/* Stylized Dashboard Preview */}
            <motion.div 
              initial={{ opacity: 0, x: 50, rotateY: 15 }} 
              animate={{ opacity: 1, x: 0, rotateY: 0 }} 
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative perspective-1000"
            >
              <div className="bg-navy-800 rounded-2xl border border-white/10 shadow-2xl overflow-hidden transform rotate-1 hover:rotate-0 transition-transform duration-500">
                {/* Header */}
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
                
                {/* Dashboard Stats */}
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

                  {/* Mock Chart Area */}
                  <div className="bg-white/5 rounded-xl border border-white/5 p-4 mb-6 relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm font-semibold text-white">Service Volume & Bookings</p>
                      <span className="text-xs text-teal-400 bg-teal-400/10 px-2 py-1 rounded-md">+24% portal usage</span>
                    </div>
                    <div className="h-24 flex items-end gap-2">
                      {[40, 70, 45, 90, 65, 85, 110].map((h, i) => (
                        <div key={i} className="flex-1 bg-gradient-to-t from-teal-500/20 to-teal-400 rounded-t-sm relative group" style={{ height: `${h}%` }}>
                          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Stats */}
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

      {/* NEW SECTION: CITIZEN REGISTRATION & SERVICE BOOKING PORTAL */}
      <section id="citizen-portal" className="py-20 bg-gradient-to-b from-white to-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 rounded-3xl p-8 sm:p-12 text-white border border-navy-700 shadow-2xl relative overflow-hidden">
            {/* Background subtle glow */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7">
                <span className="px-3.5 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold rounded-full uppercase tracking-wider">
                  For Citizens & Applicants
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold mt-4 mb-4 leading-tight">
                  Customer Self-Registration & Online Service Booking
                </h2>
                <p className="text-navy-200 text-base sm:text-lg mb-8 leading-relaxed">
                  Citizens don't need to stand in long queues. With the Akshaya Sahayi Customer Portal, customers can register with their WhatsApp number, explore available certificates and services, book applications online, and track progress right from their smartphones.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                      <FiUserCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Instant WhatsApp OTP Registration</h4>
                      <p className="text-xs text-navy-300 mt-0.5">Passwordless, verified registration in under 15 seconds.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                      <FiGlobe className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">24/7 Online Service Booking</h4>
                      <p className="text-xs text-navy-300 mt-0.5">Browse the service catalogue and apply anytime from home.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                      <FiClock className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Live Application Tracking</h4>
                      <p className="text-xs text-navy-300 mt-0.5">Real-time status updates from submission to completion.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                      <FiFileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Digital Document Vault</h4>
                      <p className="text-xs text-navy-300 mt-0.5">Upload required proofs and download completed certificates.</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Link 
                    to="/customer/register" 
                    className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-navy-900 font-bold rounded-xl transition-all shadow-md flex items-center"
                  >
                    Register as Customer <FiArrowRight className="ml-2" />
                  </Link>
                  <Link 
                    to="/login" 
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all border border-white/20"
                  >
                    Citizen Login
                  </Link>
                </div>
              </div>

              {/* Visual Simulated Customer Portal Card */}
              <div className="lg:col-span-5">
                <div className="bg-white rounded-2xl p-6 text-gray-900 shadow-xl border border-gray-100">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                        JD
                      </div>
                      <div>
                        <p className="font-bold text-sm">Customer Portal</p>
                        <p className="text-xs text-green-600 font-medium">● WhatsApp Verified</p>
                      </div>
                    </div>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 font-medium">Public Access</span>
                  </div>

                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Book a Service</p>
                  <div className="space-y-2 mb-4">
                    <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between border border-gray-200/60 hover:border-teal-500 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <FiFileText className="text-teal-600 h-4 w-4" />
                        <span className="text-xs font-bold text-gray-800">Income Certificate</span>
                      </div>
                      <span className="text-xs font-bold text-teal-600">Apply →</span>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between border border-gray-200/60 hover:border-teal-500 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <FiCreditCard className="text-blue-600 h-4 w-4" />
                        <span className="text-xs font-bold text-gray-800">PAN Card Application</span>
                      </div>
                      <span className="text-xs font-bold text-teal-600">Apply →</span>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">My Active Applications</p>
                  <div className="p-3 bg-teal-50 rounded-xl border border-teal-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-teal-900">Aadhaar Demographic Update</p>
                      <p className="text-[10px] text-teal-700 mt-0.5">Token #TK-1084 • In Progress</p>
                    </div>
                    <span className="text-[10px] bg-teal-600 text-white font-bold px-2 py-0.5 rounded-full">Stage 3/4</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 11. SIGNATURE SECTION: EVERYTHING CONNECTED */}
      <section id="workflow" className="py-24 bg-white relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">Everything Works Together.</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">Citizen registers or books online → service application created → staff processes it → payment collected → WhatsApp delivers real-time notifications → accounting records the money → management sees real-time performance.</p>
          </motion.div>

          {/* Connected Workflow Visual */}
          <div className="relative py-10">
            <div className="flex flex-col items-center">
              
              {/* Level 1: Customer */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-navy-50 border border-navy-100 rounded-xl p-4 flex items-center gap-3 w-64 justify-center z-10 relative shadow-sm">
                <FiUsers className="text-navy-600 h-5 w-5" />
                <span className="font-bold text-navy-900 text-sm">CUSTOMER (ONLINE / WALKIN)</span>
              </motion.div>
              
              <div className="h-8 border-l-2 border-dashed border-gray-300 my-2"></div>
              
              {/* Level 2: Services & Bookings */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="bg-teal-500 text-white rounded-xl p-4 flex items-center gap-3 w-72 justify-center z-10 relative shadow-md">
                <FiLayers className="h-5 w-5" />
                <span className="font-bold tracking-wider text-sm">SERVICES &amp; BOOKINGS</span>
              </motion.div>

              <div className="h-8 border-l-2 border-dashed border-gray-300 my-2 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-64 md:w-96 border-t-2 border-dashed border-gray-300"></div>
              </div>

              {/* Level 3: Ops Row */}
              <div className="grid grid-cols-3 gap-4 md:gap-12 w-full max-w-3xl z-10 relative">
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="flex flex-col items-center">
                  <div className="bg-white border-2 border-gray-100 rounded-xl p-3 w-full text-center shadow-sm">
                    <FiBriefcase className="mx-auto text-blue-500 h-5 w-5 mb-2" />
                    <span className="font-bold text-gray-800 text-xs md:text-sm">STAFF</span>
                  </div>
                  <div className="h-6 border-l-2 border-dashed border-gray-300 my-1"></div>
                  <div className="bg-blue-50 text-blue-700 text-[10px] md:text-xs font-bold px-3 py-1 rounded-full border border-blue-100 w-full text-center">ATTENDANCE</div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="flex flex-col items-center">
                  <div className="bg-white border-2 border-gray-100 rounded-xl p-3 w-full text-center shadow-sm">
                    <FiCreditCard className="mx-auto text-green-500 h-5 w-5 mb-2" />
                    <span className="font-bold text-gray-800 text-xs md:text-sm">PAYMENT</span>
                  </div>
                  <div className="h-6 border-l-2 border-dashed border-gray-300 my-1"></div>
                  <div className="bg-green-50 text-green-700 text-[10px] md:text-xs font-bold px-3 py-1 rounded-full border border-green-100 w-full text-center">WALLET</div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="flex flex-col items-center">
                  <div className="bg-white border-2 border-gray-100 rounded-xl p-3 w-full text-center shadow-sm">
                    <FiMessageCircle className="mx-auto text-teal-500 h-5 w-5 mb-2" />
                    <span className="font-bold text-gray-800 text-xs md:text-sm">WHATSAPP</span>
                  </div>
                  <div className="h-6 border-l-2 border-dashed border-gray-300 my-1"></div>
                  <div className="bg-teal-50 text-teal-700 text-[10px] md:text-xs font-bold px-3 py-1 rounded-full border border-teal-100 w-full text-center">NOTIFICATIONS</div>
                </motion.div>
              </div>

              <div className="h-8 border-l-2 border-dashed border-gray-300 my-2 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-64 md:w-96 border-t-2 border-dashed border-gray-300"></div>
              </div>

              {/* Level 4: Analytics */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 }} className="bg-navy-900 text-white rounded-xl p-4 flex items-center gap-3 w-64 justify-center z-10 relative shadow-lg">
                <FiPieChart className="h-5 w-5 text-teal-400" />
                <span className="font-bold tracking-wider">ANALYTICS</span>
              </motion.div>

              <div className="h-6 border-l-2 border-navy-900 my-1"></div>
              <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.6 }} className="text-center">
                <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-navy-900 to-teal-600 text-xl tracking-tight uppercase">
                  Business Insights
                </span>
              </motion.div>
            </div>
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
              <h3 className="text-lg font-bold text-gray-900 mb-2">Customer 360° &amp; Portal</h3>
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
            
            {/* Visual Dashboard for Teams */}
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

            {/* Copy */}
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
              {/* Super Admin */}
              <div className="bg-navy-900 text-white font-bold px-8 py-3 rounded-xl shadow-lg z-10 flex flex-col items-center">
                <span>SUPERADMIN</span>
                <span className="text-[10px] font-normal text-navy-300 mt-0.5 uppercase tracking-wide">Network Control</span>
              </div>
              
              {/* Branching Lines */}
              <div className="w-full flex justify-center mt-[-2px]">
                <div className="w-px h-8 bg-gray-300"></div>
              </div>
              <div className="w-2/3 md:w-1/2 border-t-2 border-gray-300 h-8 flex justify-between">
                <div className="w-px h-8 bg-gray-300"></div>
                <div className="w-px h-8 bg-gray-300"></div>
                <div className="w-px h-8 bg-gray-300 hidden sm:block"></div>
              </div>

              {/* Centres */}
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
            <Link to="/login" className="px-8 py-4 bg-navy-900 hover:bg-navy-800 text-white font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5">
              Start Using Sahayi
            </Link>
            <Link to="/customer/register" className="px-8 py-4 bg-white/20 hover:bg-white/30 text-navy-900 font-bold rounded-xl border border-navy-900/10 transition-all">
              Citizen Self-Registration
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
                <li><Link to="/customer/register" className="hover:text-teal-400 transition-colors">Citizen Registration</Link></li>
                <li><a href="#citizen-portal" className="hover:text-teal-400 transition-colors">Service Booking Portal</a></li>
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
                <li><a href="#" className="hover:text-teal-400 transition-colors">Contact Support</a></li>
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