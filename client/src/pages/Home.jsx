// src/pages/LandingPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import {
  FiSmartphone, FiFileText, FiCreditCard, FiShield,
  FiUsers, FiAward, FiClock, FiMapPin, FiPhone,
  FiMail, FiChevronRight, FiCheckCircle, FiStar,
  FiCalendar, FiArrowRight, FiSend, FiBell, FiX,
  FiMenu, FiChevronDown, FiExternalLink, FiHome,
  FiInfo, FiHelpCircle, FiMessageCircle, FiGlobe,
  FiTrendingUp, FiPackage, FiDollarSign, FiUserPlus,
  FiDownload, FiSearch, FiAlertCircle, FiThumbsUp,
  FiFacebook, FiTwitter, FiInstagram, FiYoutube,
  FiLinkedin, FiShare2, FiBookOpen, FiVideo
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

// ---------------------------------------------------------------------
// UI Components
// ---------------------------------------------------------------------

// Animated Counter Component
const AnimatedCounter = ({ value, duration = 2000 }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (inView) {
      let start = 0;
      const increment = value / (duration / 16);
      const timer = setInterval(() => {
        start += increment;
        if (start >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, 16);
      return () => clearInterval(timer);
    }
  }, [inView, value, duration]);

  return <span ref={ref}>{count.toLocaleString()}+</span>;
};

// Service Card Component
const ServiceCard = ({ service, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.1 }}
    whileHover={{ y: -8, scale: 1.02 }}
    className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 group"
  >
    <div className="w-14 h-14 bg-gradient-to-br from-navy-500 to-navy-700 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
      {service.icon}
    </div>
    <h3 className="text-xl font-bold text-gray-900 mb-2">{service.title}</h3>
    <p className="text-gray-600 mb-4 line-clamp-2">{service.description}</p>
    <Link
      to={service.link || '#'}
      className="inline-flex items-center text-navy-600 font-medium hover:text-navy-700"
    >
      Learn More <FiArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
    </Link>
  </motion.div>
);

// News Card Component
const NewsCard = ({ news, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.1 }}
    className="bg-white rounded-xl p-5 shadow-md hover:shadow-xl transition-all border border-gray-100"
  >
    <div className="flex items-start space-x-3">
      {news.image && (
        <img src={news.image} alt={news.title} className="w-20 h-20 rounded-lg object-cover" />
      )}
      <div className="flex-1">
        <div className="flex items-center space-x-2 mb-1">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            news.category === 'New' ? 'bg-green-100 text-green-700' :
            news.category === 'Update' ? 'bg-blue-100 text-blue-700' :
            'bg-orange-100 text-orange-700'
          }`}>
            {news.category}
          </span>
          <span className="text-xs text-gray-500">{news.date}</span>
        </div>
        <h4 className="font-semibold text-gray-900 mb-1">{news.title}</h4>
        <p className="text-sm text-gray-600 line-clamp-2">{news.description}</p>
      </div>
    </div>
  </motion.div>
);

// Testimonial Card Component
const TestimonialCard = ({ testimonial, index }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.1 }}
    className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
  >
    <div className="flex items-center mb-4">
      {[...Array(5)].map((_, i) => (
        <FiStar key={i} className={`h-5 w-5 ${i < testimonial.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
      ))}
    </div>
    <p className="text-gray-700 mb-4 italic">"{testimonial.content}"</p>
    <div className="flex items-center">
      <div className="w-12 h-12 bg-gradient-to-br from-navy-100 to-navy-200 rounded-full flex items-center justify-center">
        <span className="text-navy-700 font-bold text-lg">
          {testimonial.name.charAt(0)}
        </span>
      </div>
      <div className="ml-3">
        <p className="font-semibold text-gray-900">{testimonial.name}</p>
        <p className="text-sm text-gray-500">{testimonial.location}</p>
      </div>
    </div>
  </motion.div>
);

// FAQ Item Component
const FAQItem = ({ faq, isOpen, onToggle }) => (
  <div className="border-b border-gray-200 last:border-0">
    <button
      onClick={onToggle}
      className="w-full py-4 flex items-center justify-between text-left hover:text-navy-600 transition-colors"
    >
      <span className="font-medium text-gray-900">{faq.question}</span>
      <FiChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <p className="pb-4 text-gray-600">{faq.answer}</p>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// Navigation Bar Component
const Navbar = ({ onLoginClick, scrolled }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'Services', href: '#services' },
    { name: 'About', href: '#about' },
    { name: 'News', href: '#news' },
    { name: 'Contact', href: '#contact' },
  ];

  const handleSmoothScroll = (e, href) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-navy-600 to-navy-800 rounded-xl flex items-center justify-center">
                <FiShield className="h-6 w-6 text-white" />
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-navy-900">Akshaya</h1>
                <p className="text-xs text-navy-600">e-Centre Pukayur</p>
              </div>
            </motion.div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => handleSmoothScroll(e, link.href)}
                className="text-gray-700 hover:text-navy-600 font-medium transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <button
              onClick={onLoginClick}
              className="px-5 py-2.5 bg-gradient-to-r from-navy-600 to-navy-700 text-white rounded-xl hover:shadow-lg transition-all duration-300 font-medium"
            >
              Sign In
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {mobileMenuOpen ? <FiX className="h-6 w-6" /> : <FiMenu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleSmoothScroll(e, link.href)}
                  className="block py-2 text-gray-700 hover:text-navy-600 font-medium"
                >
                  {link.name}
                </a>
              ))}
              <button
                onClick={() => {
                  onLoginClick();
                  setMobileMenuOpen(false);
                }}
                className="w-full mt-4 px-5 py-2.5 bg-gradient-to-r from-navy-600 to-navy-700 text-white rounded-xl font-medium"
              >
                Sign In
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// Newsletter Subscription Component
const NewsletterSection = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email || !name) {
      toast.error('Please enter your name and email');
      return;
    }

    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      await axios.post(`${apiUrl}/api/newsletter/subscribe`, { name, email });
      
      setSubscribed(true);
      toast.success('Successfully subscribed to newsletter!');
      setEmail('');
      setName('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Subscription failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-16 bg-gradient-to-br from-navy-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-navy-100"
        >
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex p-3 bg-navy-100 rounded-2xl mb-6">
              <FiMail className="h-8 w-8 text-navy-600" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Stay Updated with Akshaya
            </h2>
            <p className="text-gray-600 mb-8 text-lg">
              Subscribe to our newsletter for the latest services, announcements, and digital empowerment initiatives.
            </p>

            {subscribed ? (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="bg-green-50 rounded-xl p-6 border border-green-200"
              >
                <FiCheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <h3 className="text-xl font-semibold text-green-800 mb-2">Thank You for Subscribing!</h3>
                <p className="text-green-700">
                  You'll now receive updates about new services and announcements.
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 px-5 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                  disabled={loading}
                />
                <input
                  type="email"
                  placeholder="Your Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-5 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-navy-600 to-navy-700 text-white rounded-xl hover:shadow-lg transition-all duration-300 font-medium disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Subscribe <FiSend className="ml-2 h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}
            <p className="text-xs text-gray-500 mt-4">
              We respect your privacy. Unsubscribe at any time.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------
// Main Landing Page Component
// ---------------------------------------------------------------------
const Home = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [services, setServices] = useState([]);
  const [news, setNews] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [stats, setStats] = useState({
    customers: 0,
    services: 0,
    applications: 0,
    satisfaction: 0
  });
  const [openFAQ, setOpenFAQ] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch public data
  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        
        const [
          servicesRes,
          newsRes,
          testimonialsRes,
          statsRes,
          announcementsRes
        ] = await Promise.allSettled([
          axios.get(`${apiUrl}/api/public/services`),
          axios.get(`${apiUrl}/api/public/news`),
          axios.get(`${apiUrl}/api/public/testimonials`),
          axios.get(`${apiUrl}/api/public/stats`),
          axios.get(`${apiUrl}/api/public/announcements`)
        ]);

        // Process services
        if (servicesRes.status === 'fulfilled' && servicesRes.value.data) {
          setServices(servicesRes.value.data.services || mockServices);
        } else {
          setServices(mockServices);
        }

        // Process news
        if (newsRes.status === 'fulfilled' && newsRes.value.data) {
          setNews(newsRes.value.data.news || mockNews);
        } else {
          setNews(mockNews);
        }

        // Process testimonials
        if (testimonialsRes.status === 'fulfilled' && testimonialsRes.value.data) {
          setTestimonials(testimonialsRes.value.data.testimonials || mockTestimonials);
        } else {
          setTestimonials(mockTestimonials);
        }

        // Process stats
        if (statsRes.status === 'fulfilled' && statsRes.value.data) {
          setStats(statsRes.value.data);
        } else {
          setStats(mockStats);
        }

        // Process announcements
        if (announcementsRes.status === 'fulfilled' && announcementsRes.value.data) {
          setAnnouncements(announcementsRes.value.data.announcements || mockAnnouncements);
        } else {
          setAnnouncements(mockAnnouncements);
        }

      } catch (error) {
        console.error('Error fetching public data:', error);
        // Set mock data on error
        setServices(mockServices);
        setNews(mockNews);
        setTestimonials(mockTestimonials);
        setStats(mockStats);
        setAnnouncements(mockAnnouncements);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicData();
  }, []);

  // Mock data
  const mockServices = [
    {
      id: 1,
      icon: <FiFileText className="h-7 w-7 text-white" />,
      title: 'Certificate Services',
      description: 'Income, Caste, Birth, Death, Marriage certificates and more from government portals.',
      link: '#'
    },
    {
      id: 2,
      icon: <FiSmartphone className="h-7 w-7 text-white" />,
      title: 'Aadhaar Services',
      description: 'New enrolment, updates, PVC card, and demographic changes for Aadhaar.',
      link: '#'
    },
    {
      id: 3,
      icon: <FiCreditCard className="h-7 w-7 text-white" />,
      title: 'PAN Card Services',
      description: 'New PAN application, corrections, reprint, and e-PAN download services.',
      link: '#'
    },
    {
      id: 4,
      icon: <FiShield className="h-7 w-7 text-white" />,
      title: 'Digital Life Certificate',
      description: 'Jeevan Pramaan for pensioners - easy and convenient digital certification.',
      link: '#'
    },
    {
      id: 5,
      icon: <FiUsers className="h-7 w-7 text-white" />,
      title: 'Welfare Schemes',
      description: 'Assistance with various government welfare schemes and applications.',
      link: '#'
    },
    {
      id: 6,
      icon: <FiGlobe className="h-7 w-7 text-white" />,
      title: 'e-District Services',
      description: 'Online services from revenue department and other government agencies.',
      link: '#'
    }
  ];

  const mockNews = [
    {
      id: 1,
      title: 'New Digital Service: e-Filing of Income Tax Returns',
      description: 'We now offer assistance with e-filing income tax returns for individuals and businesses.',
      category: 'New',
      date: '2 days ago',
      image: null
    },
    {
      id: 2,
      title: 'Extended Working Hours for Certificate Services',
      description: 'Certificate services now available from 9 AM to 6 PM on all working days.',
      category: 'Update',
      date: '5 days ago',
      image: null
    },
    {
      id: 3,
      title: 'Digital Literacy Program Registration Open',
      description: 'Free digital literacy classes for senior citizens. Limited seats available.',
      category: 'Announcement',
      date: '1 week ago',
      image: null
    }
  ];

  const mockTestimonials = [
    {
      id: 1,
      name: 'Rajesh Kumar',
      location: 'Pukayur',
      rating: 5,
      content: 'Excellent service! Got my Aadhaar update done quickly without any hassle. Staff is very helpful and professional.'
    },
    {
      id: 2,
      name: 'Lakshmi Menon',
      location: 'Koduvally',
      rating: 5,
      content: 'Very efficient service for income certificate. The staff guided me through the entire process. Highly recommended!'
    },
    {
      id: 3,
      name: 'Mohammed Aslam',
      location: 'Thamarassery',
      rating: 4,
      content: 'Got my PAN card correction done here. Quick service and reasonable charges. Will definitely come back.'
    }
  ];

  const mockStats = {
    customers: 15000,
    services: 50,
    applications: 25000,
    satisfaction: 98
  };

  const mockAnnouncements = [
    {
      id: 1,
      title: 'New Service Alert! 🎉',
      message: 'Digital Life Certificate (Jeevan Pramaan) for pensioners now available at our centre.',
      type: 'success'
    },
    {
      id: 2,
      title: 'Holiday Notice',
      message: 'Centre will remain closed on upcoming public holidays. Please plan your visit accordingly.',
      type: 'warning'
    }
  ];

  const faqs = [
    {
      question: 'What documents are required for Aadhaar update?',
      answer: 'You need to bring your original Aadhaar card and supporting documents for the specific update (e.g., address proof, ID proof). Our staff will guide you through the process.'
    },
    {
      question: 'What are the working hours of Akshaya Centre?',
      answer: 'We are open Monday to Saturday from 9:00 AM to 6:00 PM. The centre remains closed on Sundays and public holidays.'
    },
    {
      question: 'How long does it take to get a certificate?',
      answer: 'Most certificates are issued within 7-15 working days depending on the type of certificate and government processing time. Some services offer tatkal (urgent) options.'
    },
    {
      question: 'Do I need to book an appointment?',
      answer: 'Walk-ins are welcome, but we recommend booking an appointment for faster service. You can book through our website or by calling our centre.'
    },
    {
      question: 'What payment methods are accepted?',
      answer: 'We accept cash, UPI, debit/credit cards, and digital wallets for your convenience.'
    }
  ];

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleWhatsAppClick = () => {
    window.open('https://wa.me/919876543210', '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-navy-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Akshaya e-Centre...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <Navbar onLoginClick={handleLoginClick} scrolled={scrolled} />

      {/* Announcement Bar */}
      {announcements.length > 0 && (
        <div className="fixed top-16 md:top-20 left-0 right-0 z-40">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <div className="max-w-7xl mx-auto px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FiBell className="h-4 w-4 animate-pulse" />
                  <p className="text-sm font-medium">{announcements[0].message}</p>
                </div>
                <button className="text-white/80 hover:text-white">
                  <FiX className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section id="home" className="relative min-h-screen flex items-center pt-20">
        {/* Background Pattern */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-navy-100 rounded-full opacity-20" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-100 rounded-full opacity-20" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Hero Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center px-3 py-1 bg-navy-50 rounded-full mb-6">
                <FiAward className="h-4 w-4 text-navy-600 mr-2" />
                <span className="text-sm font-medium text-navy-700">Kerala's Trusted e-Governance Partner</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Your Gateway to
                <span className="text-navy-600 block">Digital Empowerment</span>
              </h1>
              
              <p className="text-lg text-gray-600 mb-8 max-w-lg">
                Akshaya e-Centre Pukayur provides seamless access to government services, 
                certificates, and digital solutions for citizens across Kerala.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button
                  onClick={handleLoginClick}
                  className="px-8 py-4 bg-gradient-to-r from-navy-600 to-navy-700 text-white rounded-xl hover:shadow-xl transition-all duration-300 font-medium text-lg flex items-center justify-center"
                >
                  Access Services <FiArrowRight className="ml-2 h-5 w-5" />
                </button>
                <a
                  href="#services"
                  className="px-8 py-4 border-2 border-navy-600 text-navy-600 rounded-xl hover:bg-navy-50 transition-all duration-300 font-medium text-lg flex items-center justify-center"
                >
                  Explore Services
                </a>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-white rounded-xl shadow-md">
                  <p className="text-2xl font-bold text-navy-600">
                    <AnimatedCounter value={stats.customers} />
                  </p>
                  <p className="text-xs text-gray-600">Happy Customers</p>
                </div>
                <div className="text-center p-3 bg-white rounded-xl shadow-md">
                  <p className="text-2xl font-bold text-navy-600">
                    <AnimatedCounter value={stats.services} />
                  </p>
                  <p className="text-xs text-gray-600">Services</p>
                </div>
                <div className="text-center p-3 bg-white rounded-xl shadow-md">
                  <p className="text-2xl font-bold text-navy-600">
                    <AnimatedCounter value={stats.applications} />
                  </p>
                  <p className="text-xs text-gray-600">Applications</p>
                </div>
                <div className="text-center p-3 bg-white rounded-xl shadow-md">
                  <p className="text-2xl font-bold text-navy-600">{stats.satisfaction}%</p>
                  <p className="text-xs text-gray-600">Satisfaction</p>
                </div>
              </div>
            </motion.div>

            {/* Hero Image/Illustration */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative z-10 bg-gradient-to-br from-navy-600 to-navy-800 rounded-3xl p-8 shadow-2xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <FiFileText className="h-8 w-8 text-white mb-3" />
                    <h3 className="text-white font-semibold mb-1">Certificates</h3>
                    <p className="text-navy-100 text-sm">Income, Caste, Birth & More</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <FiSmartphone className="h-8 w-8 text-white mb-3" />
                    <h3 className="text-white font-semibold mb-1">Aadhaar</h3>
                    <p className="text-navy-100 text-sm">Enrolment & Updates</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <FiCreditCard className="h-8 w-8 text-white mb-3" />
                    <h3 className="text-white font-semibold mb-1">PAN Card</h3>
                    <p className="text-navy-100 text-sm">New & Correction</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <FiGlobe className="h-8 w-8 text-white mb-3" />
                    <h3 className="text-white font-semibold mb-1">e-District</h3>
                    <p className="text-navy-100 text-sm">Online Services</p>
                  </div>
                </div>
                
                {/* Floating Elements */}
                <div className="absolute -top-4 -right-4 bg-green-500 rounded-full p-3 shadow-lg">
                  <FiCheckCircle className="h-6 w-6 text-white" />
                </div>
                <div className="absolute -bottom-4 -left-4 bg-blue-500 rounded-full p-3 shadow-lg">
                  <FiStar className="h-6 w-6 text-white" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <a href="#services" className="text-gray-400 hover:text-navy-600 transition-colors">
            <FiChevronDown className="h-6 w-6" />
          </a>
        </motion.div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Our <span className="text-navy-600">Services</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Comprehensive range of government and digital services at your fingertips
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <ServiceCard key={service.id} service={service} index={index} />
            ))}
          </div>

          <div className="text-center mt-12">
            <button
              onClick={handleLoginClick}
              className="px-8 py-3 bg-navy-600 text-white rounded-xl hover:bg-navy-700 transition-all duration-300 font-medium inline-flex items-center"
            >
              View All Services <FiArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                About <span className="text-navy-600">Akshaya e-Centre</span>
              </h2>
              <p className="text-gray-600 mb-6">
                Akshaya is a flagship project of the Kerala State IT Mission, designed to bridge 
                the digital divide and provide e-governance services to citizens across the state.
              </p>
              <p className="text-gray-600 mb-6">
                Our centre at Pukayur is committed to delivering efficient, transparent, and 
                accessible government services to the local community. We strive to empower 
                citizens through digital literacy and convenient access to essential services.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">ISO Certified Centre</span>
                </div>
                <div className="flex items-center">
                  <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Trained and Experienced Staff</span>
                </div>
                <div className="flex items-center">
                  <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Quick and Reliable Service</span>
                </div>
                <div className="flex items-center">
                  <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Affordable Service Charges</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-navy-50 to-blue-50 rounded-3xl p-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-6 text-center shadow-md">
                    <FiClock className="h-8 w-8 text-navy-600 mx-auto mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-1">Working Hours</h4>
                    <p className="text-sm text-gray-600">Mon-Sat: 9AM - 6PM</p>
                    <p className="text-sm text-gray-600">Sunday: Closed</p>
                  </div>
                  <div className="bg-white rounded-xl p-6 text-center shadow-md">
                    <FiMapPin className="h-8 w-8 text-navy-600 mx-auto mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-1">Location</h4>
                    <p className="text-sm text-gray-600">Main Road, Pukayur</p>
                    <p className="text-sm text-gray-600">Kozhikode, Kerala</p>
                  </div>
                  <div className="bg-white rounded-xl p-6 text-center shadow-md">
                    <FiPhone className="h-8 w-8 text-navy-600 mx-auto mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-1">Contact</h4>
                    <p className="text-sm text-gray-600">+91 98765 43210</p>
                    <p className="text-sm text-gray-600">pukayur@akshaya.gov.in</p>
                  </div>
                  <div className="bg-white rounded-xl p-6 text-center shadow-md">
                    <FiAward className="h-8 w-8 text-navy-600 mx-auto mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-1">Experience</h4>
                    <p className="text-sm text-gray-600">15+ Years</p>
                    <p className="text-sm text-gray-600">of Excellence</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* News & Updates Section */}
      <section id="news" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Latest <span className="text-navy-600">News & Updates</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Stay informed about new services, announcements, and important updates
            </p>
          </motion.div>

          <div className="space-y-4">
            {news.map((item, index) => (
              <NewsCard key={item.id} news={item} index={index} />
            ))}
          </div>

          <div className="text-center mt-8">
            <button className="text-navy-600 hover:text-navy-700 font-medium inline-flex items-center">
              View All News <FiArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              What Our <span className="text-navy-600">Customers Say</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Hear from thousands of satisfied customers who trust Akshaya e-Centre
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <TestimonialCard key={testimonial.id} testimonial={testimonial} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked <span className="text-navy-600">Questions</span>
            </h2>
            <p className="text-gray-600">
              Find answers to common questions about our services
            </p>
          </motion.div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                faq={faq}
                isOpen={openFAQ === index}
                onToggle={() => setOpenFAQ(openFAQ === index ? null : index)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <NewsletterSection />

      {/* Contact & Footer Section */}
      <footer id="contact" className="bg-gradient-to-br from-navy-900 to-navy-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {/* About Column */}
            <div>
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <FiShield className="h-6 w-6 text-white" />
                </div>
                <div className="ml-3">
                  <h3 className="text-xl font-bold">Akshaya</h3>
                  <p className="text-xs text-navy-200">e-Centre Pukayur</p>
                </div>
              </div>
              <p className="text-navy-200 mb-4">
                Your trusted partner for e-governance and digital services in Kerala.
              </p>
              <div className="flex space-x-3">
                <a href="#" className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors">
                  <FiFacebook className="h-5 w-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors">
                  <FiTwitter className="h-5 w-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors">
                  <FiInstagram className="h-5 w-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors">
                  <FiYoutube className="h-5 w-5" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><a href="#home" className="text-navy-200 hover:text-white transition-colors">Home</a></li>
                <li><a href="#services" className="text-navy-200 hover:text-white transition-colors">Services</a></li>
                <li><a href="#about" className="text-navy-200 hover:text-white transition-colors">About Us</a></li>
                <li><a href="#news" className="text-navy-200 hover:text-white transition-colors">News</a></li>
                <li><button onClick={handleLoginClick} className="text-navy-200 hover:text-white transition-colors">Login</button></li>
              </ul>
            </div>

            {/* Services Links */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Our Services</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-navy-200 hover:text-white transition-colors">Aadhaar Services</a></li>
                <li><a href="#" className="text-navy-200 hover:text-white transition-colors">Certificates</a></li>
                <li><a href="#" className="text-navy-200 hover:text-white transition-colors">PAN Card</a></li>
                <li><a href="#" className="text-navy-200 hover:text-white transition-colors">e-District</a></li>
                <li><a href="#" className="text-navy-200 hover:text-white transition-colors">Digital Life Certificate</a></li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <FiMapPin className="h-5 w-5 text-navy-200 mr-3 mt-0.5" />
                  <span className="text-navy-200">Main Road, Pukayur, Kozhikode, Kerala - 673571</span>
                </li>
                <li className="flex items-center">
                  <FiPhone className="h-5 w-5 text-navy-200 mr-3" />
                  <span className="text-navy-200">+91 98765 43210</span>
                </li>
                <li className="flex items-center">
                  <FiMail className="h-5 w-5 text-navy-200 mr-3" />
                  <span className="text-navy-200">pukayur@akshaya.gov.in</span>
                </li>
              </ul>
              
              {/* WhatsApp Contact */}
              <button
                onClick={handleWhatsAppClick}
                className="mt-4 w-full flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                <FaWhatsapp className="h-5 w-5 mr-2" />
                <span>Chat on WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/10">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-navy-200 text-sm mb-4 md:mb-0">
                © 2025 Muhammed Illyas. All rights reserved.
              </p>
              <div className="flex space-x-6">
                <a href="#" className="text-navy-200 hover:text-white text-sm transition-colors">Privacy Policy</a>
                <a href="#" className="text-navy-200 hover:text-white text-sm transition-colors">Terms of Service</a>
                <a href="#" className="text-navy-200 hover:text-white text-sm transition-colors">Cookie Policy</a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        onClick={handleWhatsAppClick}
        className="fixed bottom-6 right-6 z-50 bg-green-500 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all"
      >
        <FaWhatsapp className="h-6 w-6" />
      </motion.button>

      {/* Custom Styles */}
      <style>{`
        .bg-navy-50 { background-color: #f0f4f8; }
        .bg-navy-100 { background-color: #d9e2ec; }
        .bg-navy-200 { background-color: #bccde0; }
        .bg-navy-500 { background-color: #3b6ea5; }
        .bg-navy-600 { background-color: #2c5282; }
        .bg-navy-700 { background-color: #1e3a5f; }
        .bg-navy-800 { background-color: #172a45; }
        .bg-navy-900 { background-color: #0a192f; }
        .text-navy-100 { color: #d9e2ec; }
        .text-navy-200 { color: #bccde0; }
        .text-navy-600 { color: #2c5282; }
        .text-navy-700 { color: #1e3a5f; }
        .text-navy-900 { color: #0a192f; }
        .border-navy-100 { border-color: #d9e2ec; }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
};

export default Home;
