// src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiMessageCircle, FiUsers, FiBriefcase, FiDollarSign, FiPieChart, 
  FiCalendar, FiShield, FiTrendingUp, FiStar, FiArrowRight, FiCheckCircle,
  FiLayers, FiActivity, FiCreditCard, FiBookOpen, FiSmartphone, FiHash, FiTarget,
  FiMapPin, FiPhone, FiMail, FiCheck, FiRefreshCw, FiClock, FiSettings
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
            <a href="#one-click" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Architecture</a>
            <a href="#day-in-life" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Timeline</a>
            <a href="#finances" className={`text-sm font-semibold hover:text-teal-500 transition-colors ${scrolled ? 'text-gray-700' : 'text-gray-200'}`}>Finances</a>
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
// ANIMATION 1: The Feature Orbit (Hero Section)
// ---------------------------------------------------------------------
const FeatureOrbit = () => {
  const features = [
    { icon: FaWhatsapp, color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30', label: 'WhatsApp' },
    { icon: FiUsers, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30', label: 'Customers' },
    { icon: FiLayers, color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30', label: 'Services' },
    { icon: FiHash, color: 'text-indigo-400', bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', label: 'Tokens' },
    { icon: FiDollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', label: 'Finance' },
    { icon: FiBriefcase, color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30', label: 'Staff' },
    { icon: FiPieChart, color: 'text-pink-400', bg: 'bg-pink-500/20', border: 'border-pink-500/30', label: 'Analytics' },
    { icon: FiSmartphone, color: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', label: 'App' },
  ];

  return (
    <div className="relative w-full max-w-[500px] aspect-square mx-auto flex items-center justify-center">
      {/* Central Core */}
      <div className="absolute z-20 flex flex-col items-center justify-center bg-navy-900/80 backdrop-blur-md rounded-full w-40 h-40 border border-teal-500/30 shadow-[0_0_50px_rgba(20,184,166,0.3)]">
        <img src="/logo-light.png" alt="Logo" className="w-12 h-12 object-contain mb-2" />
        <span className="text-white font-bold text-sm tracking-widest uppercase">Sahayi</span>
      </div>

      {/* Orbit Rings */}
      <div className="absolute inset-0 border border-white/5 rounded-full animate-[spin_60s_linear_infinite]" />
      <div className="absolute inset-12 border border-white/5 rounded-full animate-[spin_40s_linear_infinite_reverse]" />

      {/* Orbiting Elements */}
      <motion.div 
        className="absolute inset-0 z-10"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        {features.map((item, i) => {
          const angle = (i / features.length) * 360;
          return (
            <div 
              key={i}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <motion.div 
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"
                animate={{ rotate: -360 }}
                transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              >
                <div className={`w-14 h-14 ${item.bg} ${item.border} border backdrop-blur-md rounded-2xl flex flex-col items-center justify-center shadow-lg group relative cursor-pointer hover:scale-110 transition-transform`}>
                  <item.icon className={`w-6 h-6 ${item.color}`} />
                  
                  {/* Tooltip on hover */}
                  <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity top-16 bg-white text-navy-900 text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
                    {item.label} Module
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------
// ANIMATION 2: One Click -> Everything Updates
// ---------------------------------------------------------------------
const OneClickAnimation = () => {
  const [isCompleted, setIsCompleted] = useState(false);

  const reset = () => setIsCompleted(false);
  const trigger = () => setIsCompleted(true);

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden flex flex-col h-full">
      {/* Interactive Trigger Area */}
      <div className="bg-gray-50 p-6 sm:p-8 border-b border-gray-200 flex flex-col items-center justify-center text-center">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm mb-6 text-left">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Service Request</p>
              <h3 className="text-lg font-bold text-gray-900">Passport Application</h3>
              <p className="text-sm text-gray-500">Muhammed Illyas • Token A-104</p>
            </div>
            <span className="font-black text-lg text-gray-900">₹1,500</span>
          </div>
          
          <button 
            onClick={isCompleted ? reset : trigger}
            className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center ${
              isCompleted 
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                : 'bg-teal-600 text-white shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] hover:bg-teal-700'
            }`}
          >
            {isCompleted ? <><FiRefreshCw className="mr-2" /> Reset Demonstration</> : 'Complete Service & Collect Payment'}
          </button>
        </div>
      </div>

      {/* Cascading Updates Area */}
      <div className="p-6 sm:p-8 bg-navy-900 flex-1 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-white/10" />
        
        <div className="grid grid-cols-2 gap-4 relative z-10">
          <motion.div initial={{ opacity: 0.4 }} animate={{ opacity: isCompleted ? 1 : 0.4 }} transition={{ delay: isCompleted ? 0.1 : 0 }} className={`p-4 rounded-2xl border ${isCompleted ? 'bg-purple-500/20 border-purple-500/30' : 'bg-white/5 border-white/10'}`}>
            <p className="text-xs text-navy-300 mb-1">Service Status</p>
            <div className="flex items-center text-white font-bold">
              {isCompleted ? <FiCheckCircle className="text-purple-400 mr-2" /> : <FiClock className="text-gray-400 mr-2" />}
              {isCompleted ? 'Completed' : 'Pending'}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0.4 }} animate={{ opacity: isCompleted ? 1 : 0.4 }} transition={{ delay: isCompleted ? 0.3 : 0 }} className={`p-4 rounded-2xl border ${isCompleted ? 'bg-green-500/20 border-green-500/30' : 'bg-white/5 border-white/10'}`}>
            <p className="text-xs text-navy-300 mb-1">Wallet & Accounts</p>
            <div className="flex items-center text-white font-bold">
              {isCompleted ? <FiDollarSign className="text-green-400 mr-1" /> : <FiDollarSign className="text-gray-400 mr-1" />}
              {isCompleted ? '+ ₹1,500 Logged' : 'Waiting...'}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0.4 }} animate={{ opacity: isCompleted ? 1 : 0.4 }} transition={{ delay: isCompleted ? 0.5 : 0 }} className={`p-4 rounded-2xl border ${isCompleted ? 'bg-blue-500/20 border-blue-500/30' : 'bg-white/5 border-white/10'}`}>
            <p className="text-xs text-navy-300 mb-1">Staff Revenue</p>
            <div className="flex items-center text-white font-bold">
              {isCompleted ? <FiBriefcase className="text-blue-400 mr-2" /> : <FiBriefcase className="text-gray-400 mr-2" />}
              {isCompleted ? 'Revenue Updated' : 'Unchanged'}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0.4 }} animate={{ opacity: isCompleted ? 1 : 0.4 }} transition={{ delay: isCompleted ? 0.7 : 0 }} className={`p-4 rounded-2xl border ${isCompleted ? 'bg-[#25D366]/20 border-[#25D366]/30' : 'bg-white/5 border-white/10'}`}>
            <p className="text-xs text-navy-300 mb-1">WhatsApp Customer</p>
            <div className="flex items-center text-white font-bold">
              {isCompleted ? <FaWhatsapp className="text-[#25D366] mr-2" /> : <FaWhatsapp className="text-gray-400 mr-2" />}
              {isCompleted ? 'Receipt Sent' : 'No Action'}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0.4 }} animate={{ opacity: isCompleted ? 1 : 0.4 }} transition={{ delay: isCompleted ? 0.9 : 0 }} className={`p-4 rounded-2xl border ${isCompleted ? 'bg-teal-500/20 border-teal-500/30' : 'bg-white/5 border-white/10'}`}>
            <p className="text-xs text-navy-300 mb-1">Analytics Dashboard</p>
            <div className="flex items-center text-white font-bold">
              {isCompleted ? <FiPieChart className="text-teal-400 mr-2" /> : <FiPieChart className="text-gray-400 mr-2" />}
              {isCompleted ? 'Metrics Synced' : 'Awaiting Data'}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0.4 }} animate={{ opacity: isCompleted ? 1 : 0.4 }} transition={{ delay: isCompleted ? 1.1 : 0 }} className={`p-4 rounded-2xl border ${isCompleted ? 'bg-amber-500/20 border-amber-500/30' : 'bg-white/5 border-white/10'}`}>
            <p className="text-xs text-navy-300 mb-1">Customer Review</p>
            <div className="flex items-center text-white font-bold">
              {isCompleted ? <FiStar className="text-amber-400 mr-2" /> : <FiStar className="text-gray-400 mr-2" />}
              {isCompleted ? 'Request Sent' : 'Pending'}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// ANIMATION 3: A Day at an Akshaya Centre
// ---------------------------------------------------------------------
const DayInLifeTimeline = () => {
  const [activeIdx, setActiveIdx] = useState(0);

  const timeline = [
    { time: '9:00 AM', text: 'Staff punches in via GPS App. Centre Opened.', icon: FiBriefcase, color: 'text-blue-500', bg: 'bg-blue-500' },
    { time: '9:15 AM', text: 'Customer arrives. Token #102 generated.', icon: FiHash, color: 'text-indigo-500', bg: 'bg-indigo-500' },
    { time: '9:18 AM', text: 'Staff receives service request on dashboard.', icon: FiActivity, color: 'text-purple-500', bg: 'bg-purple-500' },
    { time: '9:25 AM', text: 'Documents uploaded to digital vault.', icon: FiLayers, color: 'text-amber-500', bg: 'bg-amber-500' },
    { time: '10:00 AM', text: 'Payment received. Wallet automatically updated.', icon: FiDollarSign, color: 'text-green-500', bg: 'bg-green-500' },
    { time: '10:02 AM', text: 'WhatsApp confirmation & receipt sent to customer.', icon: FaWhatsapp, color: 'text-[#25D366]', bg: 'bg-[#25D366]' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev >= timeline.length - 1 ? 0 : prev + 1));
    }, 2500);
    return () => clearInterval(timer);
  }, [timeline.length]);

  return (
    <div className="relative pl-6 sm:pl-10 py-4 max-w-lg mx-auto">
      {/* Vertical Line */}
      <div className="absolute left-[15px] top-0 bottom-0 w-[2px] bg-gray-200 rounded-full"></div>
      
      {/* Active Line Fill */}
      <motion.div 
        className="absolute left-[15px] top-0 w-[2px] bg-teal-500 rounded-full"
        animate={{ height: `${(activeIdx / (timeline.length - 1)) * 100}%` }}
        transition={{ duration: 0.5 }}
      />

      <div className="space-y-8 relative z-10">
        {timeline.map((item, idx) => {
          const isActive = idx === activeIdx;
          const isPassed = idx < activeIdx;
          
          return (
            <div key={idx} className="relative flex items-start gap-6">
              {/* Dot / Icon */}
              <div className={`absolute -left-[35px] w-10 h-10 rounded-full flex items-center justify-center border-4 border-white transition-all duration-500 shadow-sm ${
                isActive ? `${item.bg} text-white scale-110` : isPassed ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-300'
              }`}>
                <item.icon className="w-4 h-4" />
              </div>

              {/* Content */}
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: isActive || isPassed ? 1 : 0.3, x: 0 }}
                className={`transition-all duration-500 ${isActive ? 'scale-105 origin-left' : ''}`}
              >
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full mb-2 inline-block ${isActive ? `${item.color} bg-gray-100` : 'text-gray-400'}`}>
                  {item.time}
                </span>
                <p className={`text-sm sm:text-base font-semibold ${isActive ? 'text-gray-900' : isPassed ? 'text-gray-600' : 'text-gray-400'}`}>
                  {item.text}
                </p>
              </motion.div>
            </div>
          );
        })}
      </div>
      
      {/* Finale Text */}
      <AnimatePresence>
        {activeIdx === timeline.length - 1 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0 }}
            className="mt-12 bg-navy-900 p-6 rounded-2xl text-center shadow-xl"
          >
            <p className="text-teal-400 font-bold mb-1">Hundreds of daily activities.</p>
            <p className="text-white font-medium text-sm">One system keeping everything connected.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------
// Contact Section Component (Preserved exactly as requested)
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

      {/* 1. HERO SECTION: Feature Orbit */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 bg-navy-900 overflow-hidden min-h-screen flex items-center">
        {/* Background Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-500/20 blur-[150px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[150px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-4 items-center">
            
            {/* Hero Copy */}
            <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="pr-0 lg:pr-10">
              <motion.div variants={fadeUp} className="inline-flex items-center px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6 backdrop-blur-sm shadow-xl">
                <span className="flex h-2 w-2 rounded-full bg-teal-400 mr-2 animate-pulse"></span>
                <span className="text-xs font-bold tracking-wider text-teal-300 uppercase">Unified e-Governance Platform</span>
              </motion.div>
              
              <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
                Run Your Entire <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400 drop-shadow-sm">Akshaya Centre</span> From One Platform.
              </motion.h1>
              
              <motion.p variants={fadeUp} className="text-lg text-navy-200 mb-10 max-w-xl leading-relaxed">
                Stop jumping between disconnected tools. Bring your customers, staff, services, WhatsApp notifications, and finances together in one living ecosystem.
              </motion.p>
              
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => navigate('/login')} className="px-8 py-4 bg-teal-500 hover:bg-teal-400 text-navy-900 font-bold rounded-xl shadow-[0_0_20px_rgba(20,184,166,0.4)] transition-all flex items-center justify-center group text-lg">
                  Book Service <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
                <button onClick={() => navigate('/login')} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all flex items-center justify-center text-lg backdrop-blur-md">
                  Sign In
                </button>
              </motion.div>
            </motion.div>

            {/* Orbit Animation */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              transition={{ duration: 1, delay: 0.2 }}
              className="relative w-full h-[400px] lg:h-[500px]"
            >
              <FeatureOrbit />
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. MIDDLE SECTION: One Click -> Everything Updates */}
      <section id="one-click" className="py-24 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">One Click. Everything Updates.</motion.h2>
              <motion.p variants={fadeUp} className="text-lg text-gray-600 mb-8 leading-relaxed">
                Akshaya Sahayi’s true power is its connected architecture. When your staff completes a service, the system handles the rest instantly.
              </motion.p>
              
              <div className="space-y-5">
                <motion.div variants={fadeUp} className="flex items-start">
                  <FiCheckCircle className="text-teal-500 h-6 w-6 mr-4 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-gray-900">Zero Data Entry Duplication</h4>
                    <p className="text-sm text-gray-600 mt-1">Payment goes straight to the ledger, staff revenue is credited, and analytics are synced without opening another spreadsheet.</p>
                  </div>
                </motion.div>
                <motion.div variants={fadeUp} className="flex items-start">
                  <FiCheckCircle className="text-teal-500 h-6 w-6 mr-4 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-gray-900">Automated Customer Communication</h4>
                    <p className="text-sm text-gray-600 mt-1">Customers receive an instant, formatted WhatsApp confirmation and digital receipt the moment you hit complete.</p>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <OneClickAnimation />
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. CORE FEATURES GRID */}
      <section id="features" className="py-24 bg-gray-50 border-b border-gray-200">
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

      {/* 4. LOWER SECTION: A Day at an Akshaya Centre */}
      <section id="day-in-life" className="py-24 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="order-2 lg:order-1">
              <DayInLifeTimeline />
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} className="order-1 lg:order-2">
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-navy-900 mb-4">A Day at an Akshaya Centre.</motion.h2>
              <motion.p variants={fadeUp} className="text-lg text-gray-600 mb-8 leading-relaxed">
                See exactly how Sahayi handles the chaos of a busy workday, keeping everything structured from the moment the doors open until the final daily closing.
              </motion.p>
              
              <div className="space-y-6">
                <motion.div variants={fadeUp} className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <FiUsers className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Staff & HR Management</h4>
                    <p className="text-sm text-gray-600 mt-1">GPS-verified attendance tracking, leave management, salary structures, and performance metrics handled automatically.</p>
                  </div>
                </motion.div>
                
                <motion.div variants={fadeUp} className="flex gap-4">
                  <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center shrink-0">
                    <FiTrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Team Profitability & Performance</h4>
                    <p className="text-sm text-gray-600 mt-1">Create multiple teams, assign staff, measure exact team revenue, track team expenses, and analyze overall team profit.</p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 5. MULTI-CENTRE MANAGEMENT */}
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

      {/* 6. CONTACT SECTION */}
      <ContactSection />

      {/* 7. FINAL CTA SECTION (With subtle coming together animation) */}
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
            <Link 
              to="/contact" 
              className="px-8 py-4 bg-white hover:bg-gray-50 text-teal-600 font-bold rounded-xl shadow-md transition-all transform hover:-translate-y-0.5"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* 8. FOOTER */}
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