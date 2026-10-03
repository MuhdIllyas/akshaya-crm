// src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiMessageCircle, FiUsers, FiBriefcase, FiDollarSign, FiPieChart, 
  FiCalendar, FiShield, FiTrendingUp, FiStar, FiArrowRight, FiCheckCircle,
  FiLayers, FiSettings, FiActivity, FiMap, FiCreditCard, FiBookOpen
} from 'react-icons/fi';

// ---------------------------------------------------------------------
// Reusable Animation Variants
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
// UI Components
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
            <div className={`p-1.5 rounded-xl transition-all duration-300 ${scrolled ? 'bg-navy-900' : 'bg-white shadow-lg'}`}>
              <img src="/logo-light.png" alt="Akshaya Sahayi" className={`h-8 w-8 object-contain ${scrolled ? 'brightness-0 invert' : ''}`} />
            </div>
            <div className="ml-3">
              <h1 className={`text-xl font-bold leading-tight ${scrolled ? 'text-navy-900' : 'text-white'}`}>
                Akshaya <span className="text-teal-500">Sahayi</span>
              </h1>
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Features</a>
            <a href="#workflow" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Workflow</a>
            <a href="#finances" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Finances</a>
            <a href="#multi-centre" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Multi-Centre</a>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/login')} className="hidden sm:block text-sm font-bold text-teal-500 hover:text-teal-400 transition-colors">
              Sign In
            </button>
            <button onClick={() => navigate('/login')} className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-navy-900 font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5">
              Get Started
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
                <span className="text-xs font-bold tracking-wider text-teal-300 uppercase">The Modern e-Centre OS</span>
              </motion.div>
              
              <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
                Run Your Entire <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400">Akshaya Centre</span> From One Platform.
              </motion.h1>
              
              <motion.p variants={fadeUp} className="text-lg text-navy-200 mb-8 max-w-xl leading-relaxed">
                Akshaya Sahayi brings customer management, service operations, WhatsApp communication, staff management, accounting, wallets, and business analytics together in one powerful platform.
              </motion.p>
              
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
                <Link to="/login" className="px-8 py-4 bg-teal-500 hover:bg-teal-400 text-navy-900 font-bold rounded-xl shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-all flex items-center justify-center group">
                  Get Started <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a href="#features" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all flex items-center justify-center">
                  Explore Features
                </a>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-10 flex items-center gap-6 text-sm text-navy-300 font-medium">
                <span className="flex items-center"><FiCheckCircle className="text-teal-500 mr-2" /> Customers</span>
                <span className="flex items-center"><FiCheckCircle className="text-teal-500 mr-2" /> Services</span>
                <span className="flex items-center"><FiCheckCircle className="text-teal-500 mr-2" /> WhatsApp</span>
                <span className="flex items-center"><FiCheckCircle className="text-teal-500 mr-2" /> Finance</span>
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
                      <p className="text-navy-300 text-xs mb-1">Tasks</p>
                      <p className="text-white font-bold">18 Pending</p>
                    </div>
                  </div>

                  {/* Mock Chart Area */}
                  <div className="bg-white/5 rounded-xl border border-white/5 p-4 mb-6 relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm font-semibold text-white">Revenue Overview</p>
                      <span className="text-xs text-teal-400 bg-teal-400/10 px-2 py-1 rounded-md">+14% this week</span>
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
                        <p className="text-blue-300 text-xs mb-1">Services</p>
                        <p className="text-white font-bold text-lg">186</p>
                      </div>
                      <FiLayers className="text-blue-400 h-6 w-6 opacity-50" />
                    </div>
                    <div className="bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-amber-300 text-xs mb-1">Pending Payments</p>
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

      {/* 11. SIGNATURE SECTION: EVERYTHING CONNECTED */}
      <section id="workflow" className="py-24 bg-white relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">Everything Works Together.</h2>
            <p className="text-lg text-gray-600">Customer comes in → service is created → staff handles it → payment is collected → WhatsApp keeps the customer updated → wallet/accounting records the money → management sees the performance.</p>
          </motion.div>

          {/* Connected Workflow Visual */}
          <div className="relative py-10">
            <div className="flex flex-col items-center">
              
              {/* Level 1: Customer */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-navy-50 border border-navy-100 rounded-xl p-4 flex items-center gap-3 w-48 justify-center z-10 relative shadow-sm">
                <FiUsers className="text-navy-600 h-5 w-5" />
                <span className="font-bold text-navy-900">CUSTOMER</span>
              </motion.div>
              
              <div className="h-8 border-l-2 border-dashed border-gray-300 my-2"></div>
              
              {/* Level 2: Services */}
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="bg-teal-500 text-white rounded-xl p-4 flex items-center gap-3 w-64 justify-center z-10 relative shadow-md">
                <FiLayers className="h-5 w-5" />
                <span className="font-bold tracking-wider">SERVICES</span>
              </motion.div>

              <div className="h-8 border-l-2 border-dashed border-gray-300 my-2 relative">
                {/* Horizontal branch line */}
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
                  <div className="bg-teal-50 text-teal-700 text-[10px] md:text-xs font-bold px-3 py-1 rounded-full border border-teal-100 w-full text-center">UPDATES</div>
                </motion.div>
              </div>

              <div className="h-8 border-l-2 border-dashed border-gray-300 my-2 relative">
                {/* Horizontal collector line */}
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

      {/* 2. CORE FEATURES (Everything Your Centre Needs) */}
      <section id="features" className="py-24 bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">One Platform. Your Entire Centre.</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Stop jumping between spreadsheets, ledgers, and chat apps. Sahayi connects your operations.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                <FiMessageCircle className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">WhatsApp Business</h3>
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">Connect your centre's WhatsApp communication directly with your customer workflow.</p>
              <ul className="space-y-2 text-sm text-gray-700 font-medium">
                <li className="flex items-center"><FiCheckCircle className="text-teal-500 mr-2" /> Automated Service Updates</li>
                <li className="flex items-center"><FiCheckCircle className="text-teal-500 mr-2" /> Staff & Customer Chat</li>
                <li className="flex items-center"><FiCheckCircle className="text-teal-500 mr-2" /> Message Templates</li>
              </ul>
            </motion.div>

            {/* Feature 2 */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FiUsers className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Customer Management</h3>
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">Keep customer information, service history, reviews, and communication together.</p>
              <ul className="space-y-2 text-sm text-gray-700 font-medium">
                <li className="flex items-center"><FiCheckCircle className="text-blue-500 mr-2" /> Central Database</li>
                <li className="flex items-center"><FiCheckCircle className="text-blue-500 mr-2" /> Pending Payments</li>
                <li className="flex items-center"><FiCheckCircle className="text-blue-500 mr-2" /> Customer Portal</li>
              </ul>
            </motion.div>

            {/* Feature 3 */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-xl transition-shadow group">
              <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <FiLayers className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Service Operations</h3>
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">Manage every application precisely from registration to final completion.</p>
              <ul className="space-y-2 text-sm text-gray-700 font-medium">
                <li className="flex items-center"><FiCheckCircle className="text-purple-500 mr-2" /> Status Tracking</li>
                <li className="flex items-center"><FiCheckCircle className="text-purple-500 mr-2" /> Document Handling</li>
                <li className="flex items-center"><FiCheckCircle className="text-purple-500 mr-2" /> Assignment to Staff</li>
              </ul>
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
              <motion.p variants={fadeUp} className="text-navy-200 text-lg mb-8">Manage your centre's finances with real-time wallets, transactions, expenses and accounting controls.</motion.p>
              <motion.button variants={fadeUp} className="text-teal-400 font-bold flex items-center hover:text-teal-300 transition-colors">
                Explore Finance Features <FiArrowRight className="ml-2" />
              </motion.button>
            </motion.div>

            <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-navy-800 border border-navy-700 p-6 rounded-2xl">
                <FiDollarSign className="text-green-400 h-8 w-8 mb-4" />
                <h3 className="font-bold text-lg mb-2">Wallet Management</h3>
                <p className="text-navy-300 text-sm">Track Cash, Bank, and Digital wallets. Handle transfers, daily closing, and wallet reconciliation automatically.</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="bg-navy-800 border border-navy-700 p-6 rounded-2xl">
                <FiBookOpen className="text-blue-400 h-8 w-8 mb-4" />
                <h3 className="font-bold text-lg mb-2">Accounts & Ledger</h3>
                <p className="text-navy-300 text-sm">Comprehensive ledger for income, expenses, corrections, and automated daily/monthly financial reports.</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="bg-navy-800 border border-navy-700 p-6 rounded-2xl">
                <FiCreditCard className="text-amber-400 h-8 w-8 mb-4" />
                <h3 className="font-bold text-lg mb-2">Expense Management</h3>
                <p className="text-navy-300 text-sm">Record expenses with approval workflows. Link expenses directly to specific wallets or operational teams.</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="bg-navy-800 border border-navy-700 p-6 rounded-2xl">
                <FiPieChart className="text-teal-400 h-8 w-8 mb-4" />
                <h3 className="font-bold text-lg mb-2">Financial Analytics</h3>
                <p className="text-navy-300 text-sm">Instantly visualize Gross Revenue vs Service Charges vs Expenses to calculate true Net Profit.</p>
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
                    <span className="text-gray-500 text-sm">Expenses</span>
                    <span className="font-bold text-red-500">- ₹42,000</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 bg-teal-50 p-3 rounded-xl border border-teal-100">
                    <span className="text-teal-800 font-bold">Net Profit</span>
                    <span className="font-black text-teal-700 text-lg">₹1,30,000</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Copy */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">Turn Staff Activity Into Business Insights.</motion.h2>
              <motion.p variants={fadeUp} className="text-gray-600 text-lg mb-8">Know exactly who is working, what they are handling, and how much value they bring to the centre.</motion.p>
              
              <div className="space-y-6">
                <motion.div variants={fadeUp} className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <FiUsers className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Staff Management</h4>
                    <p className="text-sm text-gray-600 mt-1">Attendance tracking (Punch-in/out), leave management, salary structures, and payroll.</p>
                  </div>
                </motion.div>
                
                <motion.div variants={fadeUp} className="flex gap-4">
                  <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center shrink-0">
                    <FiTrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Team Profitability</h4>
                    <p className="text-sm text-gray-600 mt-1">Assign staff to teams, measure their exact revenue contribution, and track team-specific expenses.</p>
                  </div>
                </motion.div>
                
                <motion.div variants={fadeUp} className="flex gap-4">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                    <FiCalendar className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Task & Calendar</h4>
                    <p className="text-sm text-gray-600 mt-1">Assign service deadlines and internal tasks. Never miss the work that matters.</p>
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
            <p className="text-gray-600 max-w-2xl mx-auto mb-16">Akshaya Sahayi is built for scale. Manage a single shop or an entire network of centres seamlessly with granular permissions.</p>
          </motion.div>

          <div className="flex justify-center mb-12">
            <div className="flex flex-col items-center w-full max-w-4xl">
              {/* Super Admin */}
              <div className="bg-navy-900 text-white font-bold px-8 py-3 rounded-xl shadow-lg z-10">SUPERADMIN</div>
              
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
                  <div className="bg-teal-500 text-white font-bold px-6 py-2 rounded-lg shadow mb-3 z-10 text-sm">Centre A</div>
                  <div className="w-px h-6 bg-gray-300"></div>
                  <div className="bg-white border border-gray-200 text-gray-700 font-semibold px-4 py-1.5 rounded text-xs mb-2">Admin</div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="bg-gray-100 text-gray-600 px-4 py-1 rounded text-xs">Staff</div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className="bg-blue-500 text-white font-bold px-6 py-2 rounded-lg shadow mb-3 z-10 text-sm">Centre B</div>
                  <div className="w-px h-6 bg-gray-300"></div>
                  <div className="bg-white border border-gray-200 text-gray-700 font-semibold px-4 py-1.5 rounded text-xs mb-2">Admin</div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="bg-gray-100 text-gray-600 px-4 py-1 rounded text-xs">Staff</div>
                </div>

                <div className="hidden sm:flex flex-col items-center">
                  <div className="bg-purple-500 text-white font-bold px-6 py-2 rounded-lg shadow mb-3 z-10 text-sm">Centre C</div>
                  <div className="w-px h-6 bg-gray-300"></div>
                  <div className="bg-white border border-gray-200 text-gray-700 font-semibold px-4 py-1.5 rounded text-xs mb-2">Admin</div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="bg-gray-100 text-gray-600 px-4 py-1 rounded text-xs">Staff</div>
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
              <h3 className="font-bold text-gray-900 mb-2">Secure & Role Based</h3>
              <p className="text-sm text-gray-600">Strict access controls. Superadmins, Admins, and Staff only see what they are supposed to see.</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <FiMessageCircle className="h-8 w-8 text-teal-600 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Connected Comms</h3>
              <p className="text-sm text-gray-600">Customer notifications and internal staff coordination happen in a single, unbroken workflow.</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <FiDollarSign className="h-8 w-8 text-teal-600 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Financial Control</h3>
              <p className="text-sm text-gray-600">Stop leaking revenue. Track every rupee across wallets, service charges, and expenses.</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <FiTrendingUp className="h-8 w-8 text-teal-600 mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Business Visibility</h3>
              <p className="text-sm text-gray-600">Understand your centre using real-time operational reports, staff ratings, and financial data.</p>
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
            Bring your customers, staff, services, communication, and finances together into one intelligent platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login" className="px-8 py-4 bg-navy-900 hover:bg-navy-800 text-white font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5">
              Start Using Sahayi
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
                <img src="/logo-light.png" alt="Akshaya Sahayi" className="h-8 w-8 object-contain brightness-0 invert" />
                <h1 className="ml-3 text-2xl font-bold text-white">Akshaya Sahayi</h1>
              </div>
              <p className="text-sm text-navy-300 max-w-sm leading-relaxed">
                The complete management platform for modern Akshaya centres. Unifying services, accounting, and communication.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-teal-400 transition-colors">WhatsApp Integration</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Customer Management</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Staff & Teams</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Accounting & Wallets</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Analytics Dashboard</a></li>
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