import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FiHome, FiMessageCircle, FiBook, FiBell, FiAward,
  FiTag, FiBookmark, FiAtSign, FiClock, FiPlus, FiSearch,
  FiUser, FiChevronRight, FiChevronLeft, FiX,
  FiStar, FiTrendingUp, FiCalendar, FiEye, FiMessageSquare,
  FiPaperclip, FiLink, FiCheckCircle, FiAlertCircle, FiFilter,
  FiChevronDown, FiCornerDownLeft, FiEdit2, FiTrash2, FiSave,
  FiExternalLink, FiLock, FiMapPin, FiGlobe, FiHeart, FiZap,
  FiThumbsUp, FiThumbsDown, FiLoader, FiInfo,
  FiMenu, FiSettings, FiFile, FiLayers, FiFolder,
  FiMoreHorizontal, FiShare2, FiUserPlus, FiRefreshCw,
  FiArchive, FiClipboard, FiVideo, FiFileText, FiLifeBuoy,
  FiUsers, FiBriefcase, FiTarget, FiCheckSquare, FiMessageCircle as FiMessageCircleOutline,
  FiGrid, FiList, FiFilePlus, FiDatabase, FiServer, FiCloud,
  FiMessageCircle as FiChat, FiFileMinus, FiFilePlus as FiFileAdd,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { MentionsInput, Mention } from 'react-mentions';
import { toast } from 'react-toastify';

// =====================================================================
// FULL MOCK DATA (ENHANCED with all new features)
// =====================================================================
const DATA = {
  stats: {
    discussions: 145,
    articles: 48,
    announcements: 18,
    trainings: 27,
    openQuestions: 13,
    unreadMentions: 3,
    cases: 76,
  },
  governmentUpdates: [
    { id: 1, title: 'New Passport Verification SOP – Effective 1st April', date: '2 hours ago', type: 'circular', priority: 'high' },
    { id: 2, title: 'Aadhaar Enrolment Guidelines Updated', date: 'Yesterday', type: 'order', priority: 'medium' },
    { id: 3, title: 'Ration Card Portability Scheme Announced', date: '3 days ago', type: 'circular', priority: 'high' },
  ],
  trending: [
    { name: 'Passport Delay', count: 23 },
    { name: 'Income Certificate', count: 18 },
    { name: 'Ration Card', count: 14 },
    { name: 'Aadhaar', count: 12 },
    { name: 'Police Verification', count: 9 },
  ],
  announcements: [
    { pinned: true, title: 'Office Closed on 26th Jan', time: '2 hours ago', category: 'centre' },
    { pinned: true, title: 'New Circular: Passport SOP Updated', time: '5 hours ago', category: 'government' },
    { pinned: false, title: 'CRM Software Update v2.4.1', time: '1 day ago', category: 'software' },
    { pinned: false, title: 'Training Session on eDistrict', time: '3 days ago', category: 'training' },
  ],
  // Service-centric data with enhanced structure
  services: [
    {
      id: 'passport',
      name: 'Passport',
      icon: FiFileText,
      description: 'All services related to passport issuance, renewal, and police verification.',
      overview: 'Passport services include new applications, renewals, tatkal, and police verification. We handle the entire lifecycle.',
      // Structured SOP
      sop: {
        eligibility: 'Indian citizens above 18 years. Minors require guardian consent.',
        documents: ['Birth certificate', 'Address proof (Aadhaar, Voter ID, etc.)', 'Education certificate', 'Marriage certificate (if applicable)'],
        workflow: [
          '1. Collect application form and fill details.',
          '2. Verify all documents with originals.',
          '3. Schedule appointment at Passport Seva Kendra.',
          '4. Pay fees (online or offline).',
          '5. Biometric and photo capture.',
          '6. Police verification initiated.',
          '7. Passport printed and dispatched.'
        ],
        fees: 'New passport: ₹1500 (Normal), ₹2500 (Tatkal). Renewal: ₹1200 (Normal), ₹2200 (Tatkal).',
        exceptions: 'Tatkal applications require additional document verification. Police verification may be waived for re-issues with valid previous passport.',
        commonMistakes: [
          'Incorrect date of birth or spelling.',
          'Missing address proof (name mismatch).',
          'Photos not matching specifications.',
          'Not carrying originals for verification.'
        ],
        checklist: [
          'Check all personal details.',
          'Ensure documents are self-attested.',
          'Carry photocopies of all documents.',
          'Reach centre 30 minutes early.'
        ],
        escalation: 'For delays >15 days, contact DCP office or file grievance on CPGRAMS. For Tatkal, call 1800-258-1800.',
        history: [
          { version: '1.2', date: '2026-01-10', changes: 'Updated fees as per new circular', author: 'Admin' },
          { version: '1.1', date: '2025-12-01', changes: 'Added police verification steps', author: 'Govt Desk' },
        ]
      },
      faqs: [
        { q: 'How long does police verification take?', a: 'Usually 7-15 days, but can vary by location.' },
        { q: 'Can I apply for Tatkal without a prior appointment?', a: 'No, you need to book a Tatkal slot online.' },
      ],
      resources: [
        { title: 'Official Passport Website', url: 'https://passport.gov.in' },
        { title: 'Fee Structure PDF', url: '/docs/passport-fees.pdf' },
      ],
      officialResources: {
        website: 'https://passport.gov.in',
        portal: 'https://passport.seva.gov.in',
        helpline: '1800-258-1800',
        forms: [{ name: 'Passport Application Form', url: '/forms/passport-form.pdf' }],
        circulars: [{ title: 'Police Verification SOP', date: '2026-01-15', file: '/circulars/pv-sop.pdf' }],
        videos: [{ title: 'How to Fill Application', url: 'https://youtube.com/...' }],
        qrCode: 'data:image/png;base64,...'
      },
      relatedTags: ['Passport', 'Police', 'Tatkal'],
      owner: 'Admin',
      reviewer: 'Sneha M',
      approvedBy: 'DCP Office',
      lastVerified: '2026-01-20',
      nextReview: '2026-04-20',
      // For dashboard
      todayApplications: 12,
      pending: 8,
      latestCircular: 'New Passport Verification SOP – Effective 1st April',
      articles: [],
      trainings: [],
      discussions: [],
      cases: [], // will be filled from solved cases
    },
    {
      id: 'aadhaar',
      name: 'Aadhaar',
      icon: FiServer,
      description: 'Aadhaar enrolment, update, and correction services.',
      overview: 'We assist with Aadhaar enrolment, demographic updates, biometric corrections, and linking to services.',
      sop: {
        eligibility: 'All Indian residents. No age restriction.',
        documents: ['Proof of identity (PAN, Voter ID, etc.)', 'Proof of address (Ration card, utility bill)', 'Proof of date of birth (Birth certificate, SSLC)'],
        workflow: [
          '1. Fill enrolment/update form.',
          '2. Provide supporting documents.',
          '3. Biometric capture (photo, fingerprints, iris).',
          '4. Acknowledgement slip generated.',
          '5. Aadhaar letter sent to address.'
        ],
        fees: 'Enrolment is free. Updates are free. Correction may require a fee if done at centre (₹50).',
        exceptions: 'For children below 5 years, biometrics not captured; UID based on parents.',
        commonMistakes: [
          'Name mismatch with documents.',
          'Incorrect address format.',
          'Missing parental consent for minors.'
        ],
        checklist: [
          'Carry original and photocopies.',
          'Check spellings carefully.',
          'Wait for OTP if updating online.'
        ],
        escalation: 'Contact UIDAI helpline 1947 or visit any enrolment centre for unresolved issues.',
        history: [
          { version: '2.0', date: '2026-01-01', changes: 'Biometric update process simplified', author: 'UIDAI' }
        ]
      },
      faqs: [
        { q: 'How to correct DOB?', a: 'Visit an enrolment centre with valid proof (birth certificate, school cert).' },
        { q: 'Can I update address online?', a: 'Yes, through the UIDAI portal using OTP or by visiting a centre.' },
      ],
      resources: [
        { title: 'UIDAI Official', url: 'https://uidai.gov.in' },
        { title: 'Update Form', url: '/docs/aadhaar-update.pdf' },
      ],
      officialResources: {
        website: 'https://uidai.gov.in',
        portal: 'https://myaadhaar.uidai.gov.in',
        helpline: '1947',
        forms: [{ name: 'Update Form', url: '/forms/aadhaar-update.pdf' }],
        circulars: [{ title: 'Biometric Update Guidelines', date: '2025-12-20', file: '/circulars/biometric-update.pdf' }],
        videos: [],
        qrCode: ''
      },
      relatedTags: ['Aadhaar', 'UIDAI'],
      owner: 'Admin',
      reviewer: 'Rahul K',
      approvedBy: 'UIDAI Regional Office',
      lastVerified: '2026-01-15',
      nextReview: '2026-04-15',
      todayApplications: 5,
      pending: 3,
      latestCircular: 'Aadhaar Enrolment Guidelines Updated',
      articles: [],
      trainings: [],
      discussions: [],
      cases: [],
    },
    // ... other services (edistrict, rationcard, psc) would have similar structures, but for brevity I'll keep them minimal
    {
      id: 'edistrict',
      name: 'eDistrict',
      icon: FiCloud,
      description: 'eDistrict services including income certificate, caste certificate, and more.',
      overview: 'eDistrict portal for various certificates and government services.',
      sop: {
        eligibility: 'All residents of the state.',
        documents: ['ID proof', 'Residence proof', 'Application form'],
        workflow: ['1. Login to eDistrict. 2. Select service. 3. Fill details. 4. Upload documents. 5. Submit and track.'],
        fees: 'Nominal fee for certificate (₹50-200)',
        exceptions: 'Some certificates require physical verification.',
        commonMistakes: ['Incorrect personal details', 'Document not clear'],
        checklist: ['Scan documents clearly', 'Double-check form'],
        escalation: 'Contact eDistrict helpdesk.',
        history: []
      },
      faqs: [
        { q: 'Why was my income certificate rejected?', a: 'Common reasons: missing signature, incorrect details, or document mismatch.' },
        { q: 'How to track application status?', a: 'Use the reference number on the eDistrict portal.' },
      ],
      resources: [
        { title: 'eDistrict Portal', url: 'https://edistrict.gov.in' },
        { title: 'User Manual', url: '/docs/edistrict-manual.pdf' },
      ],
      officialResources: {
        website: 'https://edistrict.gov.in',
        portal: 'https://edistrict.gov.in',
        helpline: '1800-123-456',
        forms: [],
        circulars: [],
        videos: [],
        qrCode: ''
      },
      relatedTags: ['eDistrict', 'Income Certificate'],
      owner: 'Rahul K',
      reviewer: 'Admin',
      approvedBy: 'District Collector',
      lastVerified: '2026-01-10',
      nextReview: '2026-04-10',
      todayApplications: 8,
      pending: 5,
      latestCircular: 'New eDistrict Services Launched',
      articles: [],
      trainings: [],
      discussions: [],
      cases: [],
    },
    {
      id: 'rationcard',
      name: 'Ration Card',
      icon: FiDatabase,
      description: 'Ration card issuance, updates, portability, and grievances.',
      overview: 'We handle new ration cards, family member updates, inter-state portability, and grievance redressal.',
      sop: {
        eligibility: 'Residents below poverty line or with valid income proof.',
        documents: ['Aadhaar', 'Address proof', 'Income certificate'],
        workflow: ['1. Fill application. 2. Submit documents. 3. Verification. 4. Issue card.'],
        fees: 'Free for BPL families; others ₹200.',
        exceptions: 'Portability requires NOC from current state.',
        commonMistakes: ['Mismatch in family members', 'Incorrect address'],
        checklist: ['Verify family details', 'Attach all documents'],
        escalation: 'Contact Food & Civil Supplies office.',
        history: []
      },
      faqs: [
        { q: 'Can I transfer my ration card to another state?', a: 'Yes, under the portability scheme, you can apply for inter-state transfer.' },
        { q: 'How to add a family member?', a: 'Visit the local food and civil supplies office with required proof.' },
      ],
      resources: [
        { title: 'Food & Civil Supplies Portal', url: 'https://fcsca.gov.in' },
        { title: 'Portability Guidelines', url: '/docs/ration-portability.pdf' },
      ],
      officialResources: {
        website: 'https://fcsca.gov.in',
        portal: 'https://fcsca.gov.in',
        helpline: '1800-222-333',
        forms: [],
        circulars: [],
        videos: [],
        qrCode: ''
      },
      relatedTags: ['Ration Card', 'Portability'],
      owner: 'Govt Desk',
      reviewer: 'Admin',
      approvedBy: 'Food & Civil Supplies',
      lastVerified: '2026-01-05',
      nextReview: '2026-04-05',
      todayApplications: 3,
      pending: 2,
      latestCircular: 'Ration Card Portability Scheme Announced',
      articles: [],
      trainings: [],
      discussions: [],
      cases: [],
    },
    {
      id: 'psc',
      name: 'Kerala PSC',
      icon: FiUsers,
      description: 'Kerala PSC exam registration, updates, and training.',
      overview: 'We provide guidance for one-time registration, exam notifications, and training materials.',
      sop: {
        eligibility: 'Any Indian citizen with minimum educational qualifications.',
        documents: ['SSLC certificate', 'ID proof', 'Photograph'],
        workflow: ['1. One-time registration. 2. Apply for exams. 3. Download admit card. 4. Check results.'],
        fees: 'Free for all candidates.',
        exceptions: 'Reserved category candidates need caste certificate.',
        commonMistakes: ['Wrong category selection', 'Upload photo not as per specs'],
        checklist: ['Check notification dates', 'Keep documents ready'],
        escalation: 'Contact PSC helpdesk.',
        history: []
      },
      faqs: [
        { q: 'What is the one-time registration fee?', a: 'It is free for all candidates.' },
        { q: 'How to update profile details?', a: 'Login to the PSC portal and edit your profile.' },
      ],
      resources: [
        { title: 'Kerala PSC Official', url: 'https://keralapsc.gov.in' },
        { title: 'Exam Calendar', url: '/docs/psc-calendar.pdf' },
      ],
      officialResources: {
        website: 'https://keralapsc.gov.in',
        portal: 'https://keralapsc.gov.in',
        helpline: '0471-2445111',
        forms: [],
        circulars: [],
        videos: [],
        qrCode: ''
      },
      relatedTags: ['Kerala PSC', 'Exam'],
      owner: 'Training Team',
      reviewer: 'Admin',
      approvedBy: 'PSC',
      lastVerified: '2026-01-12',
      nextReview: '2026-04-12',
      todayApplications: 2,
      pending: 1,
      latestCircular: 'PSC Exam Calendar 2026 Released',
      articles: [],
      trainings: [],
      discussions: [],
      cases: [],
    }
  ],
  discussions: [
    {
      id: 1,
      type: 'question', // will map to new categories
      title: 'Passport Police Verification Delay',
      preview: 'Customer reported that police verification is taking more than 15 days...',
      tags: ['Passport', 'Urgent', 'Police'],
      replies: 12,
      views: 142,
      lastReply: '2 hours ago',
      author: 'Admin',
      solved: true,
      service: 'passport',
      customer: 'Muhammed',
      applicationNumber: 'A10293',
      trackingStatus: 'Police Verification – Pending',
      relatedRecords: { customerId: 101, serviceEntryId: 202, taskId: 303, noteId: 404, messengerThread: 'thread-1' },
    },
    {
      id: 2,
      type: 'customer issue',
      title: 'Income Certificate Rejected – Missing Signature',
      preview: 'The eDistrict portal rejected the application citing missing officer signature...',
      tags: ['eDistrict', 'Income Certificate'],
      replies: 8,
      views: 89,
      lastReply: 'Yesterday',
      author: 'Rahul K',
      solved: false,
      service: 'edistrict',
      customer: 'Sreelakshmi',
      applicationNumber: 'E202456',
      trackingStatus: 'Rejected – Resubmission needed',
    },
    {
      id: 3,
      type: 'bug',
      title: 'CRM: Service Entry Form Not Submitting',
      preview: 'When trying to save a new service entry, the form hangs and shows a 500 error...',
      tags: ['CRM', 'Bug', 'Developer'],
      replies: 3,
      views: 34,
      lastReply: '3 hours ago',
      author: 'Dev Team',
      solved: false,
      service: null,
      customer: null,
      applicationNumber: null,
      trackingStatus: null,
    },
    {
      id: 4,
      type: 'feature',
      title: 'Suggestion: Bulk Upload for Service Entries',
      preview: 'It would save a lot of time if we could import services via CSV or Excel...',
      tags: ['Feature Request', 'Productivity'],
      replies: 5,
      views: 56,
      lastReply: '1 day ago',
      author: 'Sneha M',
      solved: false,
      service: null,
      customer: null,
      applicationNumber: null,
      trackingStatus: null,
    },
    {
      id: 5,
      type: 'government order',
      title: 'New Government Order on Ration Card Portability',
      preview: 'The Ministry has issued a new order allowing inter-state portability of ration cards...',
      tags: ['Ration Card', 'Government Order'],
      replies: 2,
      views: 203,
      lastReply: '4 days ago',
      author: 'Govt Desk',
      solved: false,
      service: 'rationcard',
      customer: null,
      applicationNumber: null,
      trackingStatus: null,
    },
    {
      id: 6,
      type: 'question',
      title: 'Aadhaar DOB Correction Process',
      preview: 'How to correct date of birth in Aadhaar? Customer visited centre but was asked for additional documents.',
      tags: ['Aadhaar', 'Correction'],
      replies: 15,
      views: 210,
      lastReply: '1 hour ago',
      author: 'Sneha M',
      solved: false,
      service: 'aadhaar',
      customer: 'Anjali',
      applicationNumber: 'AAD-3456',
      trackingStatus: 'In Progress',
    },
  ],
  // New: Solved cases (for Cases Library)
  solvedCases: [
    {
      id: 101,
      service: 'passport',
      title: 'Police Verification Delay Resolved',
      description: 'The issue was escalated to DCP office; verification completed in 2 days.',
      solution: 'Contacted DCP office directly; they assigned a dedicated officer.',
      tags: ['Police', 'Delay'],
      solvedBy: 'Admin',
      solvedDate: '2026-01-15',
      linkedDiscussion: 1,
      attachments: ['resolution-note.pdf'],
    },
    {
      id: 102,
      service: 'aadhaar',
      title: 'Aadhaar DOB Correction after multiple attempts',
      description: 'Customer visited centre 3 times; finally resolved by providing additional documents.',
      solution: 'We asked customer to bring school certificate and birth certificate; after verification, correction was done.',
      tags: ['Correction', 'DOB'],
      solvedBy: 'Sneha M',
      solvedDate: '2026-01-12',
      linkedDiscussion: 6,
      attachments: [],
    },
  ],
  popular: [
    { id: 6, title: 'How to Apply for Aadhaar Correction Online', replies: 34, views: 512, tags: ['Aadhaar', 'Guide'] },
    { id: 7, title: 'Passport Tatkal vs Normal – Which is Faster?', replies: 28, views: 401, tags: ['Passport', 'FAQ'] },
    { id: 8, title: 'Income Tax Return Filing for FY 2025-26', replies: 19, views: 298, tags: ['Finance', 'ITR'] },
  ],
  myMentions: [
    { title: 'Passport Police Verification Delay', time: '2 mins ago', excerpt: '@you please check the status...' },
    { title: 'Income Certificate Rejected', time: 'Yesterday', excerpt: '@you can you resubmit with the corrected signature?' },
  ],
  drafts: [
    { title: 'Draft: Aadhaar Update Process', updated: '2 days ago' },
    { title: 'Draft: New Service Onboarding', updated: '5 days ago' },
  ],
  articles: [
    {
      id: 1,
      title: 'Passport Application SOP – Complete Guide',
      desc: 'Step-by-step standard operating procedure for passport applications...',
      category: 'Passport',
      updated: '2 days ago',
      readingTime: '8 min',
      author: 'Admin',
      service: 'passport',
    },
    {
      id: 2,
      title: 'Income Certificate – How to Apply on eDistrict',
      desc: 'Detailed guide with screenshots for applying income certificate online...',
      category: 'eDistrict',
      updated: '1 week ago',
      readingTime: '6 min',
      author: 'Rahul K',
      service: 'edistrict',
    },
    {
      id: 3,
      title: 'Ration Card Portability – New Rules Explained',
      desc: 'Everything you need to know about the new inter-state portability scheme...',
      category: 'Ration Card',
      updated: '3 days ago',
      readingTime: '5 min',
      author: 'Govt Desk',
      service: 'rationcard',
    },
    {
      id: 4,
      title: 'Kerala PSC – One Time Registration Process',
      desc: 'How to register on the Kerala PSC portal for various exams...',
      category: 'Kerala PSC',
      updated: '2 weeks ago',
      readingTime: '4 min',
      author: 'Training Team',
      service: 'psc',
    },
  ],
  allTags: [
    { name: 'Passport', count: 23 },
    { name: 'Aadhaar', count: 18 },
    { name: 'Finance', count: 44 },
    { name: 'Training', count: 17 },
    { name: 'eDistrict', count: 12 },
    { name: 'Ration Card', count: 14 },
    { name: 'Government Order', count: 9 },
    { name: 'CRM', count: 21 },
    { name: 'Bug', count: 8 },
    { name: 'Feature Request', count: 15 },
  ],
  training: [
    { id: 1, title: 'Passport Services – Complete Training', type: 'Video', duration: '45 min', modules: 6, updated: '1 week ago', service: 'passport' },
    { id: 2, title: 'Aadhaar Update & Correction', type: 'PDF + Quiz', duration: '30 min', modules: 4, updated: '2 weeks ago', service: 'aadhaar' },
    { id: 3, title: 'eDistrict Portal Masterclass', type: 'Video + PDF', duration: '60 min', modules: 8, updated: '3 days ago', service: 'edistrict' },
  ],
  discussionDetail: {
    id: 1,
    title: 'Passport Police Verification Delay',
    solved: true,
    type: 'question',
    tags: ['Passport', 'Urgent', 'Police'],
    service: 'passport',
    customer: 'Muhammed',
    applicationNumber: 'A10293',
    trackingStatus: 'Police Verification – Pending',
    relatedServiceEntries: [
      { id: 101, date: '2026-01-10', status: 'completed' },
      { id: 102, date: '2026-01-15', status: 'pending' },
    ],
    author: 'Admin',
    created: 'Yesterday',
    views: 142,
    replies: 18,
    followers: 25,
    status: 'Solved',
    priority: 'High',
    category: 'Question',
    description: `We have a customer who applied for a passport renewal on 10th Jan. The police verification was scheduled on 15th Jan, but the verification officer has not visited yet. The customer has been calling the police station daily but no response.

We need guidance on how to escalate this issue. The customer's travel date is approaching (5th Feb) and they are very anxious.

Steps we've tried:
1. Called the police station – no response
2. Visited the station – officer not available
3. Raised a complaint on the passport portal – no update yet

Please suggest any other escalation channels or contacts.`,
    attachments: ['PDF_Verification.pdf', 'Screenshot_Status.png'],
    repliesList: [
      {
        id: 1,
        author: 'Sneha M',
        time: '1 hour ago',
        best: true,
        content: 'I faced a similar issue last month. What worked for me was contacting the DCP office directly. They have a dedicated passport cell. Here\'s the number: 0484-2567890. Also, you can file a grievance on the CPGRAMS portal – they respond within 48 hours.'
      },
      {
        id: 2,
        author: 'Rahul K',
        time: '2 hours ago',
        best: false,
        content: 'Additionally, you can ask the customer to check the status on the Passport Seva app. Sometimes the verification officer\'s contact details are available there. Also, try sending a formal email to the SP office with all the details.'
      },
      {
        id: 3,
        author: 'Admin',
        time: '3 hours ago',
        best: false,
        content: 'Thanks for the suggestions. I\'ll try the DCP office first thing tomorrow. Will update here once we get a resolution.'
      },
    ],
    similar: [
      { title: 'Police Verification Not Updating on Portal', replies: 7 },
      { title: 'Passport Application Stuck – No Verification', replies: 12 },
      { title: 'How to Expedite Police Verification?', replies: 5 },
    ],
    relatedContent: {
      articles: [{ id: 1, title: 'Passport Application SOP – Complete Guide' }],
      trainings: [{ id: 1, title: 'Passport Services – Complete Training' }],
      announcements: [{ id: 1, title: 'New Passport Verification SOP' }],
    },
    // Expanded related objects
    relatedObjects: {
      customer: { id: 101, name: 'Muhammed', phone: '9876543210', email: 'muhammed@example.com' },
      serviceEntries: [
        { id: 201, date: '2026-01-10', service: 'Passport Renewal', status: 'Completed' },
        { id: 202, date: '2026-01-15', service: 'Police Verification', status: 'Pending' },
      ],
      tracking: { currentStage: 'Police Verification', lastUpdated: '2026-01-16' },
      notes: [{ id: 301, author: 'Admin', date: '2026-01-16', content: 'Called police station; no response.' }],
      messenger: { threadId: 'thread-1', lastMessage: '2026-01-16 10:30 AM' },
      tasks: [{ id: 401, title: 'Escalate to DCP', status: 'Pending', due: '2026-01-18' }],
      attachments: [
        { name: 'PDF_Verification.pdf', size: '2.3 MB' },
        { name: 'Screenshot_Status.png', size: '1.1 MB' },
      ]
    }
  },
  categories: [
    // Updated categories
    { id: 'question', label: 'Question', icon: FiMessageSquare, color: '#6366f1' },
    { id: 'solved case', label: 'Solved Case', icon: FiCheckCircle, color: '#10b981' },
    { id: 'customer issue', label: 'Customer Issue', icon: FiUser, color: '#f59e0b' },
    { id: 'government order', label: 'Government Order', icon: FiFileText, color: '#8b5cf6' },
    { id: 'bug', label: 'Bug', icon: FiAlertCircle, color: '#f97316' },
    { id: 'feature', label: 'Feature', icon: FiZap, color: '#06b6d4' },
    { id: 'discussion', label: 'Discussion', icon: FiMessageCircleOutline, color: '#ef4444' },
    { id: 'suggestion', label: 'Suggestion', icon: FiThumbsUp, color: '#22c55e' },
  ],
  activityFeed: [
    { id: 1, type: 'solved', user: 'Admin', target: 'Passport Police Verification Delay', time: '10 mins ago' },
    { id: 2, type: 'article', user: 'Shafi', target: 'Aadhaar Correction SOP', time: '1 hour ago' },
    { id: 3, type: 'circular', user: 'Govt Desk', target: 'Ration Card Portability Order', time: '3 hours ago' },
    { id: 4, type: 'update', user: 'Training Team', target: 'eDistrict Masterclass', time: 'Yesterday' },
  ],
  aiAssistantHistory: [
    { id: 1, query: 'How to correct Aadhaar DOB?', answer: 'Visit enrolment centre with birth certificate or school certificate. Also, online update via UIDAI portal.', timestamp: '2026-01-16 10:00 AM' },
  ]
};

const STAFF_SUGGESTIONS = [
  { id: 1, display: 'Admin' },
  { id: 2, display: 'Sneha M' },
  { id: 3, display: 'Rahul K' },
  { id: 4, display: 'Dev Team' },
  { id: 5, display: 'Govt Desk' },
];

// =====================================================================
// HELPER COMPONENTS
// =====================================================================

// Sidebar (updated: removed Knowledge, added AI Assistant)
const Sidebar = ({ active, onNavigate }) => {
  const mainNav = [
    { id: 'home', label: 'Home', icon: FiHome },
    { id: 'services', label: 'Services', icon: FiGrid },
    { id: 'discussions', label: 'Discussions', icon: FiMessageCircle, count: DATA.stats.discussions },
    { id: 'learning', label: 'Learning Center', icon: FiAward, count: DATA.stats.trainings },
    { id: 'announcements', label: 'Announcements', icon: FiBell, count: DATA.stats.announcements },
    { id: 'ai-assistant', label: 'AI Assistant', icon: FiZap },
  ];
  const workspaceItems = [
    { id: 'mentions', label: 'Mentions', icon: FiAtSign, count: DATA.stats.unreadMentions },
    { id: 'bookmarks', label: 'Bookmarks', icon: FiBookmark },
    { id: 'drafts', label: 'Drafts', icon: FiFile, count: DATA.drafts.length },
    { id: 'following', label: 'Following', icon: FiUserPlus },
    { id: 'history', label: 'History', icon: FiClock },
  ];

  return (
    <div className="w-60 h-full bg-white border-r border-gray-200 flex flex-col overflow-y-auto flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm">
          <FiZap className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Operations Hub</h1>
        <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full ml-auto">v4.0</span>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-2.5 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-1.5">⚡ Operations</div>
        {mainNav.map(item => (
          <a
            key={item.id}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              active === item.id
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.count && <span className="ml-auto bg-gray-200 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">{item.count}</span>}
          </a>
        ))}

        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-1.5 mt-4">⭐ My Workspace</div>
        {workspaceItems.map(item => (
          <a
            key={item.id}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              active === item.id
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.count && <span className="ml-auto bg-gray-200 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">{item.count}</span>}
          </a>
        ))}

        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-1.5 mt-4">🏷 Tags</div>
        <a
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            active === 'tags'
              ? 'bg-indigo-50 text-indigo-600'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
          onClick={() => onNavigate('tags')}
        >
          <FiTag className="h-4 w-4" />
          <span>Tags</span>
          <span className="ml-auto bg-gray-200 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">{DATA.allTags.length}</span>
        </a>
      </div>
    </div>
  );
};

// Top Bar (unchanged)
const TopBar = ({ onSearch, query, onNavigate, toggleMobileSidebar, onAIAssistant }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
      <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={toggleMobileSidebar}>
        <FiMenu className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-[180px] max-w-xl relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask Operations Hub (e.g., 'How to correct Aadhaar DOB?')"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-9 pr-14 py-2 bg-gray-100 border border-transparent rounded-full text-sm focus:outline-none focus:bg-white focus:border-gray-300 transition-all shadow-inner"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded border border-gray-300 font-mono">⌘K</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onAIAssistant}
          className="relative p-2 rounded-full hover:bg-indigo-50 text-indigo-500 hover:text-indigo-700 transition"
          title="Ask Akshaya Assistant"
        >
          <FiZap className="h-5 w-5" />
        </button>
        <button onClick={() => onNavigate('notifications')} className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <FiBell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        <button onClick={() => onNavigate('bookmarks')} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <FiBookmark className="h-5 w-5" />
        </button>
        <button onClick={() => onNavigate('mentions')} className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <FiAtSign className="h-5 w-5" />
          {DATA.stats.unreadMentions > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          )}
        </button>
      </div>
    </div>
  );
};

// Stat Card (unchanged)
const StatCard = ({ label, value, icon: Icon, color }) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    rose: 'bg-rose-50 text-rose-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
      <div className={`p-2.5 rounded-xl ${colorMap[color] || 'bg-gray-50 text-gray-600'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
};

// Trending Tags (unchanged)
const TrendingTags = ({ tags, onTagClick }) => (
  <div className="flex flex-wrap gap-2">
    {tags.map(tag => (
      <span
        key={tag.name}
        className="px-3 py-1.5 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 border border-transparent hover:border-indigo-200 rounded-full text-sm font-medium text-gray-700 cursor-pointer transition-all"
        onClick={() => onTagClick(tag.name)}
      >
        {tag.name} <span className="text-gray-400 font-normal ml-1">{tag.count}</span>
      </span>
    ))}
  </div>
);

// Announcement Item (unchanged)
const AnnouncementItem = ({ announcement, onClick }) => {
  const categoryColors = {
    government: 'bg-red-100 text-red-700',
    centre: 'bg-blue-100 text-blue-700',
    software: 'bg-green-100 text-green-700',
    training: 'bg-purple-100 text-purple-700',
  };
  const color = categoryColors[announcement.category] || 'bg-gray-100 text-gray-700';
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition" onClick={onClick}>
      {announcement.pinned ? <FiHeart className="text-amber-500 h-4 w-4 flex-shrink-0" /> : <span className="w-4 flex-shrink-0"></span>}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{announcement.title}</div>
        <div className="text-xs text-gray-400">{announcement.time}</div>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
        {announcement.category}
      </span>
    </div>
  );
};

// Discussion Card (updated categories)
const DiscussionCard = ({ discussion, onClick }) => {
  // map type to icon
  const typeMap = {
    question: { icon: FiMessageSquare, color: 'bg-blue-50 text-blue-600' },
    'solved case': { icon: FiCheckCircle, color: 'bg-emerald-50 text-emerald-600' },
    'customer issue': { icon: FiUser, color: 'bg-amber-50 text-amber-600' },
    'government order': { icon: FiFileText, color: 'bg-purple-50 text-purple-600' },
    bug: { icon: FiAlertCircle, color: 'bg-yellow-50 text-yellow-600' },
    feature: { icon: FiZap, color: 'bg-cyan-50 text-cyan-600' },
    discussion: { icon: FiMessageCircleOutline, color: 'bg-red-50 text-red-600' },
    suggestion: { icon: FiThumbsUp, color: 'bg-green-50 text-green-600' },
  };
  const defaultType = { icon: FiMessageSquare, color: 'bg-gray-50 text-gray-600' };
  const { icon: Icon, color: typeClass } = typeMap[discussion.type] || defaultType;

  const serviceObj = DATA.services.find(s => s.id === discussion.service);
  const serviceName = serviceObj ? serviceObj.name : null;

  return (
    <div className="p-3 bg-white border border-gray-200 rounded-xl mb-2.5 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer" onClick={() => onClick(discussion.id)}>
      <div className="flex gap-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${typeClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-sm font-semibold text-gray-900">{discussion.title}</span>
            {discussion.solved !== undefined && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                discussion.solved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {discussion.solved ? 'Solved' : 'Open'}
              </span>
            )}
            {serviceName && (
              <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{serviceName}</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{discussion.preview}</div>
          {(discussion.customer || discussion.applicationNumber || discussion.trackingStatus) && (
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
              {discussion.customer && <span><FiUser className="inline h-3 w-3 mr-0.5" /> {discussion.customer}</span>}
              {discussion.applicationNumber && <span><FiFile className="inline h-3 w-3 mr-0.5" /> {discussion.applicationNumber}</span>}
              {discussion.trackingStatus && <span><FiTarget className="inline h-3 w-3 mr-0.5" /> {discussion.trackingStatus}</span>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-400">
            <span><FiUser className="inline h-3 w-3 mr-0.5" /> {discussion.author}</span>
            <span><FiClock className="inline h-3 w-3 mr-0.5" /> {discussion.lastReply}</span>
            <span><FiMessageSquare className="inline h-3 w-3 mr-0.5" /> {discussion.replies}</span>
            <span><FiEye className="inline h-3 w-3 mr-0.5" /> {discussion.views}</span>
            <div className="flex gap-1">
              {discussion.tags.map(t => <span key={t} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">#{t}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Article Card (unchanged)
const ArticleCard = ({ article, onClick }) => {
  const serviceObj = DATA.services.find(s => s.id === article.service);
  const serviceName = serviceObj ? serviceObj.name : null;
  return (
    <div className="p-3 bg-white border border-gray-200 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer" onClick={onClick}>
      <div className="font-semibold text-sm text-gray-900">{article.title}</div>
      <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{article.desc}</div>
      <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-gray-400">
        <span><FiFolder className="inline h-3 w-3 mr-0.5" /> {article.category}</span>
        <span><FiUser className="inline h-3 w-3 mr-0.5" /> {article.author}</span>
        <span><FiClock className="inline h-3 w-3 mr-0.5" /> {article.updated}</span>
        <span><FiClock className="inline h-3 w-3 mr-0.5" /> {article.readingTime}</span>
        {serviceName && <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{serviceName}</span>}
      </div>
    </div>
  );
};

// Activity Feed (unchanged)
const ActivityFeed = ({ activities }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
      <FiRefreshCw className="h-4 w-4 text-indigo-500" />
      Recent Activity
    </h3>
    <div className="space-y-2">
      {activities.map(act => (
        <div key={act.id} className="flex items-start gap-2 text-sm">
          <span className="mt-0.5">
            {act.type === 'solved' && <FiCheckCircle className="h-4 w-4 text-emerald-500" />}
            {act.type === 'article' && <FiFileText className="h-4 w-4 text-blue-500" />}
            {act.type === 'circular' && <FiFile className="h-4 w-4 text-purple-500" />}
            {act.type === 'update' && <FiTrendingUp className="h-4 w-4 text-amber-500" />}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-gray-700">
              <strong>{act.user}</strong> {act.type === 'solved' ? 'solved' : act.type === 'article' ? 'updated article' : act.type === 'circular' ? 'added circular' : 'updated'}{' '}
              <span className="text-indigo-600 font-medium">{act.target}</span>
            </span>
            <span className="block text-xs text-gray-400">{act.time}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Convert Dropdown (unchanged)
const ConvertDropdown = ({ onConvert }) => {
  const [open, setOpen] = useState(false);
  const options = [
    { label: 'Article', icon: FiBook, action: 'article' },
    { label: 'Task', icon: FiCheckSquare, action: 'task' },
    { label: 'Note', icon: FiFileText, action: 'note' },
    { label: 'Announcement', icon: FiBell, action: 'announcement' },
    { label: 'Training Material', icon: FiVideo, action: 'training' },
    { label: 'Solved Case', icon: FiCheckCircle, action: 'case' },
  ];
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
      >
        <FiMoreHorizontal className="h-4 w-4" /> Convert
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
          {options.map(opt => (
            <div
              key={opt.action}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition"
              onClick={() => { onConvert(opt.action); setOpen(false); }}
            >
              <opt.icon className="h-4 w-4" /> {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// MAIN KNOWLEDGE HUB COMPONENT
// =====================================================================
const KnowledgeHub = () => {
  const [page, setPage] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(null);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showAIAnswer, setShowAIAnswer] = useState(false);
  // AI Assistant page now handled as a page, not modal
  const [aiQuery, setAiQuery] = useState('');

  const [newDiscussion, setNewDiscussion] = useState({
    title: '',
    content: '',
    category: 'question',
    tags: [],
    priority: 'medium',
    visibility: 'everyone',
    relatedTo: 'none',
    relatedId: '',
    service: '',
    attachments: [],
  });
  const [tagInput, setTagInput] = useState('');

  const navigateTo = (target, id = null) => {
    if (target === 'discussion-detail' && id) {
      setPage('discussion-detail');
      setSelectedDiscussionId(id);
    } else if (target === 'service-detail' && id) {
      setPage('service-detail');
      setSelectedServiceId(id);
    } else {
      setPage(target);
      setSelectedDiscussionId(null);
      setSelectedServiceId(null);
      if (target !== 'search') setSearchQuery('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (mobileSidebarOpen) setMobileSidebarOpen(false);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      setPage('search');
      setShowAIAnswer(
        query.toLowerCase().includes('aadhaar') ||
        query.toLowerCase().includes('dob') ||
        query.toLowerCase().includes('passport') ||
        query.toLowerCase().includes('ration')
      );
    } else {
      setPage('home');
    }
  };

  const handleTagClick = (tagName) => {
    setSearchQuery(tagName);
    setPage('search');
  };

  const openDiscussionDetail = (id) => navigateTo('discussion-detail', id);
  const openServiceDetail = (id) => navigateTo('service-detail', id);

  const addTag = () => {
    if (tagInput.trim() && !newDiscussion.tags.includes(tagInput.trim())) {
      setNewDiscussion(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };
  const removeTag = (tag) => {
    setNewDiscussion(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    toast.success('Discussion created successfully!');
    setShowCreateModal(false);
    setNewDiscussion({
      title: '',
      content: '',
      category: 'question',
      tags: [],
      priority: 'medium',
      visibility: 'everyone',
      relatedTo: 'none',
      relatedId: '',
      service: '',
      attachments: [],
    });
    setTagInput('');
  };

  const toggleMobileSidebar = () => setMobileSidebarOpen(prev => !prev);

  const renderPage = () => {
    switch (page) {
      case 'home': return <HomePage navigateTo={navigateTo} handleTagClick={handleTagClick} openDiscussion={openDiscussionDetail} />;
      case 'services': return <ServicesPage navigateTo={navigateTo} openServiceDetail={openServiceDetail} />;
      case 'service-detail': return <ServiceDetailPage serviceId={selectedServiceId} navigateTo={navigateTo} openDiscussion={openDiscussionDetail} />;
      case 'discussions': return <DiscussionsPage navigateTo={navigateTo} openDiscussion={openDiscussionDetail} />;
      case 'discussion-detail': return <DiscussionDetailPage discussionId={selectedDiscussionId} navigateTo={navigateTo} />;
      case 'learning': return <LearningPage navigateTo={navigateTo} />;
      case 'announcements': return <AnnouncementsPage navigateTo={navigateTo} />;
      case 'tags': return <TagsPage navigateTo={navigateTo} handleTagClick={handleTagClick} />;
      case 'bookmarks': return <BookmarksPage />;
      case 'mentions': return <MentionsPage navigateTo={navigateTo} />;
      case 'drafts': return <DraftsPage navigateTo={navigateTo} />;
      case 'following': return <FollowingPage />;
      case 'history': return <HistoryPage />;
      case 'notifications': return <NotificationsPage />;
      case 'ai-assistant': return <AIAssistantPage navigateTo={navigateTo} aiQuery={aiQuery} setAiQuery={setAiQuery} />;
      case 'search': return <SearchPage query={searchQuery} navigateTo={navigateTo} openDiscussion={openDiscussionDetail} showAIAnswer={showAIAnswer} />;
      default: return <HomePage navigateTo={navigateTo} handleTagClick={handleTagClick} openDiscussion={openDiscussionDetail} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop Sidebar - fixed */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar active={page} onNavigate={navigateTo} />
      </div>

      {/* Main content area - scrollable */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          onSearch={handleSearch}
          query={searchQuery}
          onNavigate={navigateTo}
          toggleMobileSidebar={toggleMobileSidebar}
          onAIAssistant={() => navigateTo('ai-assistant')}
        />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {renderPage()}
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setMobileSidebarOpen(false)}>
          <div className="w-64 h-full bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <Sidebar active={page} onNavigate={navigateTo} />
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg hover:scale-105 transition-all flex items-center justify-center"
        onClick={() => setShowCreateModal(true)}
      >
        <FiPlus className="h-6 w-6" />
      </button>

      {/* Create Discussion Modal (updated categories) */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Create Discussion</h2>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={() => setShowCreateModal(false)}>
                  <FiX className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={newDiscussion.title}
                    onChange={e => setNewDiscussion(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="What's your question or idea?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <MentionsInput
                    value={newDiscussion.content}
                    onChange={(e, newValue) => setNewDiscussion(prev => ({ ...prev, content: newValue }))}
                    placeholder="Provide details... Use @ to mention a staff member"
                    className="w-full"
                    style={{
                      control: { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', minHeight: '80px' },
                      highlighter: { padding: '0.65rem' },
                      input: { padding: '0.65rem', border: 'none', outline: 'none' },
                      suggestions: { list: { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', zIndex: 100 }, item: { padding: '5px 10px', borderBottom: '1px solid #f1f5f9' } }
                    }}
                  >
                    <Mention trigger="@" data={STAFF_SUGGESTIONS} markup="@[__display__](__id__)" displayTransform={(id, display) => `@${display}`} />
                  </MentionsInput>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={newDiscussion.category}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {DATA.categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.label}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={newDiscussion.priority}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
                    <select
                      value={newDiscussion.service}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, service: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">None</option>
                      {DATA.services.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                    <select
                      value={newDiscussion.visibility}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, visibility: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="everyone">Everyone</option><option value="centre">Centre</option><option value="private">Private</option><option value="admins">Admins</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Related To</label>
                    <select
                      value={newDiscussion.relatedTo}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, relatedTo: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="none">None</option>
                      <option value="customer">Customer</option>
                      <option value="serviceEntry">Service Entry</option>
                      <option value="task">Task</option>
                      <option value="note">Note</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Related ID (optional)</label>
                    <input
                      type="text"
                      value={newDiscussion.relatedId}
                      onChange={e => setNewDiscussion(prev => ({ ...prev, relatedId: e.target.value }))}
                      placeholder="e.g., CUST-123"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500">
                    {newDiscussion.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-1 rounded-full">
                        {tag} <FiX className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                      </span>
                    ))}
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                      placeholder="Add a tag..."
                      className="flex-1 min-w-[80px] border-none outline-none text-sm py-1"
                    />
                    <button type="button" onClick={addTag} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2">Add</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attach Files</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500 hover:border-indigo-400 transition cursor-pointer">
                    <FiPaperclip className="h-6 w-6 mx-auto mb-1" />
                    <p className="text-sm">Click or drag files to upload</p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button type="button" className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">Publish</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =====================================================================
// PAGE COMPONENTS
// =====================================================================

// HomePage - now service dashboard
const HomePage = ({ navigateTo, handleTagClick, openDiscussion }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Welcome back, Admin 👋</h2>
      <p className="text-gray-500">Your operations hub – everything about your services at a glance.</p>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard label="Discussions" value={DATA.stats.discussions} icon={FiMessageCircle} color="blue" />
      <StatCard label="Services" value={DATA.services.length} icon={FiGrid} color="green" />
      <StatCard label="Announcements" value={DATA.stats.announcements} icon={FiBell} color="amber" />
      <StatCard label="Training Materials" value={DATA.stats.trainings} icon={FiAward} color="purple" />
      <StatCard label="Solved Cases" value={DATA.stats.cases} icon={FiCheckCircle} color="rose" />
      <StatCard label="Unread Mentions" value={DATA.stats.unreadMentions} icon={FiAtSign} color="indigo" />
    </div>

    {/* Service Dashboard Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {DATA.services.map(service => {
        const articleCount = DATA.articles.filter(a => a.service === service.id).length;
        const discussionCount = DATA.discussions.filter(d => d.service === service.id).length;
        const trainingCount = DATA.training.filter(t => t.service === service.id).length;
        const caseCount = DATA.solvedCases.filter(c => c.service === service.id).length;
        return (
          <div
            key={service.id}
            className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition cursor-pointer"
            onClick={() => navigateTo('service-detail', service.id)}
          >
            <div className="flex items-center gap-3">
              <service.icon className="h-8 w-8 text-indigo-500" />
              <div>
                <h4 className="font-bold text-gray-900">{service.name}</h4>
                <div className="text-xs text-gray-500 flex gap-2 flex-wrap">
                  <span>{articleCount} articles</span>
                  <span>{discussionCount} discussions</span>
                  <span>{trainingCount} trainings</span>
                  <span>{caseCount} cases</span>
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">Today: {service.todayApplications}</span>
              <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded">Pending: {service.pending}</span>
              <span className="text-gray-400 truncate max-w-[150px]">{service.latestCircular}</span>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              {service.relatedTags.slice(0, 3).map(t => `#${t}`).join(' ')}
            </div>
          </div>
        );
      })}
    </div>

    {/* Government Updates */}
    <div className="bg-white border-l-4 border-red-500 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <FiFileText className="h-4 w-4 text-red-500" /> Government Updates
        </h3>
        <span className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium" onClick={() => navigateTo('announcements')}>View all →</span>
      </div>
      <div className="space-y-2">
        {DATA.governmentUpdates.map(update => (
          <div key={update.id} className="flex items-center gap-3 text-sm">
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
              update.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            }`}>{update.priority}</span>
            <span className="text-gray-700 flex-1">{update.title}</span>
            <span className="text-xs text-gray-400">{update.date}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Activity and other sections could remain similar, but we'll keep it concise */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><FiMessageCircle className="h-4 w-4 text-indigo-500" /> Unread Discussions</h3>
            <span className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer" onClick={() => navigateTo('discussions')}>View all →</span>
          </div>
          {DATA.discussions.slice(0, 3).map(d => <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />)}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><FiClock className="h-4 w-4 text-gray-500" /> Recent Discussions</h3>
            <span className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer" onClick={() => navigateTo('discussions')}>View all →</span>
          </div>
          {DATA.discussions.slice(3, 6).map(d => <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />)}
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><FiAtSign className="h-4 w-4 text-purple-500" /> My Mentions</h3>
            <span className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer" onClick={() => navigateTo('mentions')}>View all →</span>
          </div>
          {DATA.myMentions.map((m, idx) => (
            <div key={idx} className="p-2 bg-white border border-gray-200 rounded-xl mb-2 hover:border-indigo-200 transition cursor-pointer" onClick={() => navigateTo('mentions')}>
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><FiAtSign className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{m.title}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">{m.excerpt}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{m.time}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><FiEdit2 className="h-4 w-4 text-gray-500" /> My Drafts</h3>
            <span className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer" onClick={() => navigateTo('drafts')}>View all →</span>
          </div>
          {DATA.drafts.map((d, idx) => (
            <div key={idx} className="p-2 bg-white border border-gray-200 rounded-xl mb-2 opacity-70">
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center"><FiFile className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{d.title}</div>
                  <div className="text-[10px] text-gray-400">Updated {d.updated}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <ActivityFeed activities={DATA.activityFeed} />
      </div>
    </div>

    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><FiBell className="h-4 w-4 text-amber-500" /> Latest Announcements</h3>
        <span className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer" onClick={() => navigateTo('announcements')}>View all →</span>
      </div>
      {DATA.announcements.map((a, idx) => <AnnouncementItem key={idx} announcement={a} onClick={() => navigateTo('announcements')} />)}
    </div>
  </div>
);

// Services Page (unchanged)
const ServicesPage = ({ navigateTo, openServiceDetail }) => {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">All Services</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DATA.services.map(service => (
          <div
            key={service.id}
            className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition cursor-pointer"
            onClick={() => openServiceDetail(service.id)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <service.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{service.name}</h3>
                <p className="text-xs text-gray-500">{service.description}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {service.relatedTags.map(tag => (
                <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">#{tag}</span>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-400">
              {DATA.articles.filter(a => a.service === service.id).length} articles ·{' '}
              {DATA.training.filter(t => t.service === service.id).length} trainings ·{' '}
              {DATA.discussions.filter(d => d.service === service.id).length} discussions
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Service Detail Page - completely revamped with dashboard, structured SOP, official resources, cases, history, ownership
const ServiceDetailPage = ({ serviceId, navigateTo, openDiscussion }) => {
  const service = DATA.services.find(s => s.id === serviceId);
  if (!service) return <div className="text-center py-12 text-gray-500">Service not found</div>;

  const [activeTab, setActiveTab] = useState('dashboard');
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: FiGrid },
    { id: 'sop', label: 'SOP', icon: FiFileText },
    { id: 'faqs', label: 'FAQs', icon: FiMessageSquare },
    { id: 'resources', label: 'Resources', icon: FiLink },
    { id: 'official', label: 'Official', icon: FiGlobe },
    { id: 'cases', label: 'Cases', icon: FiCheckCircle },
    { id: 'history', label: 'History', icon: FiClock },
  ];

  const relatedDiscussions = DATA.discussions.filter(d => d.service === serviceId);
  const relatedArticles = DATA.articles.filter(a => a.service === serviceId);
  const relatedTrainings = DATA.training.filter(t => t.service === serviceId);
  const serviceCases = DATA.solvedCases.filter(c => c.service === serviceId);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={() => navigateTo('services')}>
          <FiChevronLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
          <service.icon className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">{service.name}</h2>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Service</span>
      </div>

      <div className="border-b border-gray-200 mb-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 min-h-[400px]">
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-indigo-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-indigo-600">{service.todayApplications}</div>
                <div className="text-xs text-gray-600">Today's Applications</div>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-amber-600">{service.pending}</div>
                <div className="text-xs text-gray-600">Pending</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{relatedDiscussions.length}</div>
                <div className="text-xs text-gray-600">Discussions</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">{serviceCases.length}</div>
                <div className="text-xs text-gray-600">Solved Cases</div>
              </div>
            </div>
            <div className="mb-4">
              <h4 className="font-semibold text-sm text-gray-900">Latest Circular</h4>
              <p className="text-sm text-gray-700">{service.latestCircular}</p>
            </div>
            <div className="mb-4">
              <h4 className="font-semibold text-sm text-gray-900">Recent Discussions</h4>
              {relatedDiscussions.slice(0, 3).map(d => <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />)}
              {relatedDiscussions.length === 0 && <p className="text-sm text-gray-500">No discussions yet.</p>}
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900">Quick Actions</h4>
              <div className="flex gap-2 mt-1">
                <button className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-100" onClick={() => setActiveTab('sop')}>View SOP</button>
                <button className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-100" onClick={() => navigateTo('discussions')}>Start Discussion</button>
                <button className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-100" onClick={() => setActiveTab('cases')}>View Cases</button>
              </div>
            </div>
          </div>
        )}

        {/* SOP - structured */}
        {activeTab === 'sop' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Standard Operating Procedure</h3>
            <div className="space-y-4">
              <div><strong>Eligibility:</strong> {service.sop.eligibility}</div>
              <div><strong>Required Documents:</strong> <ul className="list-disc ml-4 text-sm">{service.sop.documents.map((d,i) => <li key={i}>{d}</li>)}</ul></div>
              <div><strong>Workflow:</strong> <ol className="list-decimal ml-4 text-sm">{service.sop.workflow.map((step,i) => <li key={i}>{step}</li>)}</ol></div>
              <div><strong>Fees:</strong> {service.sop.fees}</div>
              <div><strong>Exceptions:</strong> {service.sop.exceptions}</div>
              <div><strong>Common Mistakes:</strong> <ul className="list-disc ml-4 text-sm">{service.sop.commonMistakes.map((m,i) => <li key={i}>{m}</li>)}</ul></div>
              <div><strong>Checklist:</strong> <ul className="list-check ml-4 text-sm">{service.sop.checklist.map((item,i) => <li key={i}>✓ {item}</li>)}</ul></div>
              <div><strong>Escalation:</strong> {service.sop.escalation}</div>
              {service.sop.history && service.sop.history.length > 0 && (
                <div><strong>Version History:</strong> {service.sop.history.map((h, i) => <div key={i} className="text-xs text-gray-500">{h.version} - {h.date} by {h.author}: {h.changes}</div>)}</div>
              )}
            </div>
          </div>
        )}

        {/* FAQs - unchanged */}
        {activeTab === 'faqs' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Frequently Asked Questions</h3>
            <div className="space-y-3">
              {service.faqs.map((faq, idx) => (
                <div key={idx} className="border-b border-gray-100 pb-2">
                  <div className="font-medium text-sm text-gray-800">Q: {faq.q}</div>
                  <div className="text-sm text-gray-600 mt-0.5">A: {faq.a}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resources - includes articles and links */}
        {activeTab === 'resources' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Resources & Links</h3>
            <ul className="space-y-2">
              {service.resources.map((res, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm">
                  <FiExternalLink className="h-4 w-4 text-indigo-500" />
                  <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{res.title}</a>
                </li>
              ))}
            </ul>
            <h4 className="font-semibold text-gray-900 mt-4">Related Articles</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {relatedArticles.map(a => <ArticleCard key={a.id} article={a} onClick={() => navigateTo('knowledge')} />)}
            </div>
          </div>
        )}

        {/* Official Resources */}
        {activeTab === 'official' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Official Resources</h3>
            <div className="space-y-3">
              <div><strong>Official Website:</strong> <a href={service.officialResources.website} target="_blank" rel="noopener" className="text-indigo-600 hover:underline">{service.officialResources.website}</a></div>
              <div><strong>Portal:</strong> <a href={service.officialResources.portal} target="_blank" rel="noopener" className="text-indigo-600 hover:underline">{service.officialResources.portal}</a></div>
              <div><strong>Helpline:</strong> {service.officialResources.helpline}</div>
              {service.officialResources.forms && service.officialResources.forms.length > 0 && (
                <div><strong>Forms:</strong> {service.officialResources.forms.map((f,i) => <a key={i} href={f.url} className="text-indigo-600 hover:underline ml-2">{f.name}</a>)}</div>
              )}
              {service.officialResources.circulars && service.officialResources.circulars.length > 0 && (
                <div><strong>Circulars:</strong> {service.officialResources.circulars.map((c,i) => <div key={i} className="text-sm">{c.title} ({c.date}) - <a href={c.file} className="text-indigo-600 hover:underline">Download</a></div>)}</div>
              )}
              {service.officialResources.videos && service.officialResources.videos.length > 0 && (
                <div><strong>Video Tutorials:</strong> {service.officialResources.videos.map((v,i) => <a key={i} href={v.url} className="text-indigo-600 hover:underline ml-2">{v.title}</a>)}</div>
              )}
              {service.officialResources.qrCode && (
                <div><strong>QR Code:</strong> <img src={service.officialResources.qrCode} alt="QR" className="h-20 w-20" /></div>
              )}
            </div>
          </div>
        )}

        {/* Cases Library */}
        {activeTab === 'cases' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Solved Cases ({serviceCases.length})</h3>
              <button className="text-xs text-indigo-600 hover:text-indigo-800">+ Add Case</button>
            </div>
            {serviceCases.length > 0 ? (
              serviceCases.map(c => (
                <div key={c.id} className="border-b border-gray-100 py-2">
                  <div className="font-medium text-sm text-gray-900">{c.title}</div>
                  <div className="text-xs text-gray-500">{c.description}</div>
                  <div className="text-xs text-gray-400">Solved by {c.solvedBy} on {c.solvedDate}</div>
                  <div className="flex gap-1 mt-1">{c.tags.map(t => <span key={t} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">#{t}</span>)}</div>
                  <button className="text-xs text-indigo-600 hover:underline mt-1" onClick={() => navigateTo('discussion-detail', c.linkedDiscussion)}>View Discussion</button>
                </div>
              ))
            ) : <p className="text-sm text-gray-500">No solved cases yet.</p>}
          </div>
        )}

        {/* History (SOP version history, service updates) */}
        {activeTab === 'history' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Service History</h3>
            <div className="space-y-2">
              {service.sop.history && service.sop.history.length > 0 ? service.sop.history.map((h, i) => (
                <div key={i} className="border-b border-gray-100 pb-2">
                  <div className="text-sm font-medium">Version {h.version}</div>
                  <div className="text-xs text-gray-500">Date: {h.date} | By: {h.author}</div>
                  <div className="text-xs text-gray-700">Changes: {h.changes}</div>
                </div>
              )) : <p className="text-sm text-gray-500">No history recorded.</p>}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500">Ownership</div>
                <div className="text-sm">Owner: {service.owner}</div>
                <div className="text-sm">Reviewer: {service.reviewer}</div>
                <div className="text-sm">Approved by: {service.approvedBy}</div>
                <div className="text-sm">Last verified: {service.lastVerified}</div>
                <div className="text-sm">Next review: {service.nextReview}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Discussions Page (updated categories in filter)
const DiscussionsPage = ({ navigateTo, openDiscussion }) => {
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterService, setFilterService] = useState('all');
  const [sortBy, setSortBy] = useState('latest');

  const filtered = useMemo(() => {
    let list = DATA.discussions;
    if (filterCategory !== 'all') list = list.filter(d => d.type === filterCategory);
    if (filterStatus !== 'all') list = list.filter(d => filterStatus === 'solved' ? d.solved : !d.solved);
    if (filterService !== 'all') list = list.filter(d => d.service === filterService);
    if (sortBy === 'latest') list = list.slice().sort((a, b) => new Date(b.lastReply) - new Date(a.lastReply));
    else if (sortBy === 'replies') list = list.slice().sort((a, b) => b.replies - a.replies);
    else if (sortBy === 'views') list = list.slice().sort((a, b) => b.views - a.views);
    return list;
  }, [filterCategory, filterStatus, filterService, sortBy]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-gray-900">Discussions</h2>
        <div className="flex flex-wrap gap-2">
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value="all">All Categories</option>
            {DATA.categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.label}</option>))}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value="all">All Status</option><option value="open">Open</option><option value="solved">Solved</option>
          </select>
          <select value={filterService} onChange={e => setFilterService(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value="all">All Services</option>
            {DATA.services.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value="latest">Latest</option><option value="replies">Most Replies</option><option value="views">Most Views</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        {filtered.map(d => <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />)}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FiMessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No discussions found</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Discussion Detail Page - expanded related objects
const DiscussionDetailPage = ({ discussionId, navigateTo }) => {
  const discussion = DATA.discussionDetail;
  if (!discussion) return <div className="text-center py-12 text-gray-500">Discussion not found</div>;

  const typeMap = {
    question: { icon: FiMessageSquare, label: 'Question' },
    'solved case': { icon: FiCheckCircle, label: 'Solved Case' },
    'customer issue': { icon: FiUser, label: 'Customer Issue' },
    'government order': { icon: FiFileText, label: 'Government Order' },
    bug: { icon: FiAlertCircle, label: 'Bug' },
    feature: { icon: FiZap, label: 'Feature' },
    discussion: { icon: FiMessageCircleOutline, label: 'Discussion' },
    suggestion: { icon: FiThumbsUp, label: 'Suggestion' },
  };
  const defaultType = { icon: FiMessageSquare, label: 'Discussion' };
  const { icon: Icon, label: typeLabel } = typeMap[discussion.type] || defaultType;

  const handleConvert = (action) => {
    if (action === 'case') {
      toast.success('Converted to Solved Case!');
      // In real app, would add to cases list
    } else {
      toast.success(`Converting to ${action}... (demo)`);
    }
  };

  const serviceObj = DATA.services.find(s => s.id === discussion.service);
  const serviceName = serviceObj ? serviceObj.name : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0 space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full">
              <Icon className="h-3 w-3" /> {typeLabel}
            </span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${discussion.solved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {discussion.solved ? 'Solved' : 'Open'}
            </span>
            {serviceName && <span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full">{serviceName}</span>}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{discussion.title}</h2>
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
            <span><FiUser className="inline mr-1" /> {discussion.author}</span>
            <span><FiClock className="inline mr-1" /> {discussion.created}</span>
            <span><FiEye className="inline mr-1" /> {discussion.views} views</span>
            <span><FiMessageSquare className="inline mr-1" /> {discussion.replies} replies</span>
          </div>
        </div>

        {/* CRM Context Bar - expanded */}
        <div className="flex flex-wrap gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-gray-700">
          {discussion.customer && <span><FiUser className="inline mr-1.5 text-indigo-500" /> Customer: <strong>{discussion.customer}</strong></span>}
          {discussion.applicationNumber && <span><FiFile className="inline mr-1.5 text-indigo-500" /> Application: <strong>{discussion.applicationNumber}</strong></span>}
          {discussion.trackingStatus && <span><FiTarget className="inline mr-1.5 text-indigo-500" /> Status: <strong>{discussion.trackingStatus}</strong></span>}
          {discussion.relatedServiceEntries && (
            <span><FiBriefcase className="inline mr-1.5 text-indigo-500" /> Service Entries: <strong>{discussion.relatedServiceEntries.length}</strong></span>
          )}
          <span className="text-xs text-gray-500">Linked to CRM records</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="text-sm text-gray-800 whitespace-pre-wrap">{discussion.description}</div>
          {discussion.attachments && (
            <div className="flex flex-wrap gap-2">
              {discussion.attachments.map((file, idx) => (
                <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <FiPaperclip className="h-3 w-3" /> {file}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {discussion.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">#{t}</span>)}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">{discussion.repliesList.length} Replies</h3>
          <div className="space-y-3">
            {discussion.repliesList.map(reply => (
              <div key={reply.id} className={`bg-white border rounded-xl p-4 ${reply.best ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <strong className="text-sm text-gray-900">{reply.author}</strong>
                  <span className="text-xs text-gray-400">{reply.time}</span>
                  {reply.best && <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1"><FiCheckCircle className="h-3 w-3" /> Best Answer</span>}
                </div>
                <div className="text-sm text-gray-700">{reply.content}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Write a reply...</h4>
          <MentionsInput
            placeholder="Write your reply... Supports Markdown"
            className="w-full"
            style={{
              control: { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', minHeight: '80px' },
              highlighter: { padding: '0.65rem' },
              input: { padding: '0.65rem', border: 'none', outline: 'none' },
              suggestions: { list: { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', zIndex: 100 }, item: { padding: '5px 10px', borderBottom: '1px solid #f1f5f9' } }
            }}
          >
            <Mention trigger="@" data={STAFF_SUGGESTIONS} markup="@[__display__](__id__)" displayTransform={(id, display) => `@${display}`} />
          </MentionsInput>
          <div className="flex justify-end gap-2 mt-3">
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">Post Reply</button>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-64 flex-shrink-0 space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Discussion Details</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-medium text-gray-900">{discussion.status}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className="font-medium text-gray-900">{discussion.priority}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Category</span><span className="font-medium text-gray-900">{discussion.category}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Service</span><span className="font-medium text-gray-900">{serviceName || 'None'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="font-medium text-gray-900">{discussion.author}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Views</span><span className="font-medium text-gray-900">{discussion.views}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Replies</span><span className="font-medium text-gray-900">{discussion.replies}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Followers</span><span className="font-medium text-gray-900">{discussion.followers}</span></div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Actions</div>
          <div className="space-y-1.5">
            <button className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 px-2 py-1.5 rounded-lg transition" onClick={() => toast.info('Bookmarked')}>
              <FiBookmark className="h-4 w-4" /> Bookmark
            </button>
            <button className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 px-2 py-1.5 rounded-lg transition" onClick={() => toast.info('Watching')}>
              <FiEye className="h-4 w-4" /> Watch
            </button>
            <button className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 px-2 py-1.5 rounded-lg transition" onClick={() => toast.info('Shared')}>
              <FiShare2 className="h-4 w-4" /> Share
            </button>
            <ConvertDropdown onConvert={handleConvert} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Tags</div>
          <div className="flex flex-wrap gap-1">
            {discussion.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">#{t}</span>)}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">People</div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs bg-gray-100 px-2 py-1 rounded-full"><span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold">A</span> Admin</div>
            <div className="flex items-center gap-1.5 text-xs bg-gray-100 px-2 py-1 rounded-full"><span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold">S</span> Sneha M</div>
            <div className="flex items-center gap-1.5 text-xs bg-gray-100 px-2 py-1 rounded-full"><span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] font-bold">R</span> Rahul K</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Similar Discussions</div>
          {discussion.similar.map((s, idx) => (
            <div key={idx} className="py-1.5 border-b border-gray-100 last:border-0 cursor-pointer hover:text-indigo-600 transition" onClick={() => navigateTo('discussions')}>
              <div className="text-sm text-gray-800">{s.title}</div>
              <div className="text-xs text-gray-400">{s.replies} replies</div>
            </div>
          ))}
        </div>

        {/* Related Content */}
        {discussion.relatedContent && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Related Content</div>
            {discussion.relatedContent.articles && discussion.relatedContent.articles.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-medium text-gray-600">Articles</div>
                {discussion.relatedContent.articles.map(a => (
                  <div key={a.id} className="text-sm text-indigo-600 hover:underline cursor-pointer" onClick={() => navigateTo('knowledge')}>{a.title}</div>
                ))}
              </div>
            )}
            {discussion.relatedContent.trainings && discussion.relatedContent.trainings.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-medium text-gray-600">Trainings</div>
                {discussion.relatedContent.trainings.map(t => (
                  <div key={t.id} className="text-sm text-indigo-600 hover:underline cursor-pointer" onClick={() => navigateTo('learning')}>{t.title}</div>
                ))}
              </div>
            )}
            {discussion.relatedContent.announcements && discussion.relatedContent.announcements.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-600">Announcements</div>
                {discussion.relatedContent.announcements.map(a => (
                  <div key={a.id} className="text-sm text-indigo-600 hover:underline cursor-pointer" onClick={() => navigateTo('announcements')}>{a.title}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Expanded Related Objects */}
        {discussion.relatedObjects && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">CRM Links</div>
            {discussion.relatedObjects.customer && (
              <div className="mb-2">
                <div className="text-xs font-medium text-gray-600">Customer</div>
                <div className="text-sm">{discussion.relatedObjects.customer.name} ({discussion.relatedObjects.customer.phone})</div>
              </div>
            )}
            {discussion.relatedObjects.serviceEntries && (
              <div className="mb-2">
                <div className="text-xs font-medium text-gray-600">Service Entries</div>
                {discussion.relatedObjects.serviceEntries.map(se => (
                  <div key={se.id} className="text-sm">{se.service} - {se.status}</div>
                ))}
              </div>
            )}
            {discussion.relatedObjects.tracking && (
              <div className="mb-2">
                <div className="text-xs font-medium text-gray-600">Tracking</div>
                <div className="text-sm">{discussion.relatedObjects.tracking.currentStage} (updated {discussion.relatedObjects.tracking.lastUpdated})</div>
              </div>
            )}
            {discussion.relatedObjects.notes && (
              <div className="mb-2">
                <div className="text-xs font-medium text-gray-600">Notes</div>
                {discussion.relatedObjects.notes.map(n => (
                  <div key={n.id} className="text-sm">{n.content} - {n.author}</div>
                ))}
              </div>
            )}
            {discussion.relatedObjects.messenger && (
              <div className="mb-2">
                <div className="text-xs font-medium text-gray-600">Messenger</div>
                <div className="text-sm">Thread: {discussion.relatedObjects.messenger.threadId} (last: {discussion.relatedObjects.messenger.lastMessage})</div>
              </div>
            )}
            {discussion.relatedObjects.tasks && (
              <div className="mb-2">
                <div className="text-xs font-medium text-gray-600">Tasks</div>
                {discussion.relatedObjects.tasks.map(t => (
                  <div key={t.id} className="text-sm">{t.title} - {t.status} (due {t.due})</div>
                ))}
              </div>
            )}
            {discussion.relatedObjects.attachments && (
              <div>
                <div className="text-xs font-medium text-gray-600">Attachments</div>
                {discussion.relatedObjects.attachments.map(a => (
                  <div key={a.name} className="text-sm">{a.name} ({a.size})</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Learning Page (unchanged)
const LearningPage = ({ navigateTo }) => {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Learning Center</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DATA.services.map(service => {
          const materials = DATA.training.filter(t => t.service === service.id);
          return (
            <div key={service.id} className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition" onClick={() => navigateTo('learning')}>
              <div className="font-semibold text-gray-900 mb-2">{service.name}</div>
              {materials.length > 0 ? materials.map(m => (
                <div key={m.id} className="flex items-center gap-2 text-sm py-1 border-b border-gray-50 last:border-0">
                  <span className="text-lg">{m.type.includes('Video') ? '🎬' : m.type.includes('PDF') ? '📄' : '📚'}</span>
                  <span className="flex-1 text-gray-700">{m.title}</span>
                  <span className="text-xs text-gray-400">{m.duration}</span>
                </div>
              )) : <div className="text-sm text-gray-400 py-2">No materials yet</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Announcements Page (unchanged)
const AnnouncementsPage = ({ navigateTo }) => {
  const [filter, setFilter] = useState('all');
  const filtered = DATA.announcements.filter(a => filter === 'all' || a.category === filter);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-gray-900">Announcements</h2>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
          <option value="all">All</option>
          <option value="government">Government</option>
          <option value="centre">Centre</option>
          <option value="software">Software</option>
          <option value="training">Training</option>
        </select>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        {filtered.map((a, idx) => <AnnouncementItem key={idx} announcement={a} onClick={() => navigateTo('announcements')} />)}
      </div>
    </div>
  );
};

// Tags Page (unchanged)
const TagsPage = ({ navigateTo, handleTagClick }) => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">All Tags</h2>
    <div className="flex flex-wrap gap-2 mb-6">
      {DATA.allTags.map(tag => (
        <span key={tag.name} className="px-3 py-1.5 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 border border-transparent hover:border-indigo-200 rounded-full text-sm font-medium text-gray-700 cursor-pointer transition-all" onClick={() => handleTagClick(tag.name)}>
          {tag.name} <span className="text-gray-400 font-normal ml-1">{tag.count}</span>
        </span>
      ))}
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-3">Discussions by Tag</h3>
    <div className="space-y-2">
      {DATA.discussions.slice(0, 3).map(d => <DiscussionCard key={d.id} discussion={d} onClick={() => navigateTo('discussions')} />)}
    </div>
  </div>
);

// My Workspace Pages (unchanged)
const MentionsPage = ({ navigateTo }) => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">Mentions</h2>
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      {DATA.myMentions.map((m, idx) => (
        <div key={idx} className="p-2 bg-white border border-gray-200 rounded-xl hover:border-indigo-200 transition cursor-pointer" onClick={() => navigateTo('discussions')}>
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><FiAtSign className="h-4 w-4" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{m.title}</div>
              <div className="text-xs text-gray-500 line-clamp-1">{m.excerpt}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{m.time}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const DraftsPage = ({ navigateTo }) => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">My Drafts</h2>
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      {DATA.drafts.map((d, idx) => (
        <div key={idx} className="p-2 bg-white border border-gray-200 rounded-xl opacity-80">
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center"><FiFile className="h-4 w-4" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{d.title}</div>
              <div className="text-[10px] text-gray-400">Updated {d.updated}</div>
              <button className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-0.5" onClick={() => navigateTo('discussions')}>Continue editing →</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const BookmarksPage = () => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">Bookmarks</h2>
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
      <FiBookmark className="h-12 w-12 mx-auto mb-3 text-gray-300" />
      <p>You haven't bookmarked any discussions yet.</p>
    </div>
  </div>
);

const FollowingPage = () => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">Following</h2>
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
      <FiUserPlus className="h-12 w-12 mx-auto mb-3 text-gray-300" />
      <p>You aren't following any discussions yet.</p>
    </div>
  </div>
);

const HistoryPage = () => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">History</h2>
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
      <FiClock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
      <p>No recent history.</p>
    </div>
  </div>
);

const NotificationsPage = () => (
  <div>
    <h2 className="text-xl font-bold text-gray-900 mb-4">Notifications</h2>
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><FiMessageSquare className="h-4 w-4" /></div>
        <div className="flex-1">
          <p className="text-sm text-gray-700"><strong>Sneha M</strong> replied to <span className="text-indigo-600 font-medium">Passport Police Verification Delay</span></p>
          <span className="text-xs text-gray-400">2 hours ago</span>
        </div>
      </div>
      <div className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><FiCheckCircle className="h-4 w-4" /></div>
        <div className="flex-1">
          <p className="text-sm text-gray-700"><span className="text-indigo-600 font-medium">Income Certificate Rejected</span> was marked as solved</p>
          <span className="text-xs text-gray-400">Yesterday</span>
        </div>
      </div>
      <div className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition">
        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><FiBell className="h-4 w-4" /></div>
        <div className="flex-1">
          <p className="text-sm text-gray-700">New announcement: <span className="text-indigo-600 font-medium">Office Closed on 26th Jan</span></p>
          <span className="text-xs text-gray-400">2 days ago</span>
        </div>
      </div>
    </div>
  </div>
);

// AI Assistant Page
const AIAssistantPage = ({ navigateTo, aiQuery, setAiQuery }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your Akshaya Assistant. Ask me anything about services, SOPs, or common issues.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);
    // Simulate AI response
    setTimeout(() => {
      let response = '';
      if (userMsg.toLowerCase().includes('aadhaar') || userMsg.toLowerCase().includes('dob')) {
        response = 'To correct Aadhaar DOB, visit the enrolment centre with valid proof (birth certificate, school certificate). Online updates are also available via UIDAI portal.';
      } else if (userMsg.toLowerCase().includes('passport')) {
        response = 'Passport police verification usually takes 7-15 days. For delays, contact the DCP office or file a grievance on CPGRAMS.';
      } else {
        response = 'I\'m not sure about that. Please check the SOP or related discussions for more details.';
      }
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Akshaya Assistant</h2>
      <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 overflow-y-auto mb-4" style={{ maxHeight: '60vh' }}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`mb-3 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block p-3 rounded-xl max-w-xl ${msg.role === 'user' ? 'bg-indigo-100 text-gray-800' : 'bg-gray-100 text-gray-800'}`}>
              <div className="text-sm">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-gray-400">Thinking...</div>}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <button onClick={handleSend} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">Send</button>
      </div>
      <div className="mt-4 text-xs text-gray-400">History: {DATA.aiAssistantHistory.map(h => `${h.query} (${h.timestamp})`).join(' | ')}</div>
    </div>
  );
};

// Search Page (updated with AI answer, service results)
const SearchPage = ({ query, navigateTo, openDiscussion, showAIAnswer }) => {
  const discussionResults = DATA.discussions.filter(d =>
    d.title.toLowerCase().includes(query.toLowerCase()) ||
    d.preview.toLowerCase().includes(query.toLowerCase())
  );
  const articleResults = DATA.articles.filter(a =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.desc.toLowerCase().includes(query.toLowerCase())
  );
  const serviceResults = DATA.services.filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.description.toLowerCase().includes(query.toLowerCase())
  );
  const caseResults = DATA.solvedCases.filter(c =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Search: "{query}"</h2>
        <p className="text-sm text-gray-500">{discussionResults.length + articleResults.length + serviceResults.length + caseResults.length} results found</p>
      </div>
      {showAIAnswer && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 text-indigo-700 font-semibold mb-1">
            <FiZap className="h-5 w-5" /> AI Answer
          </div>
          <p className="text-sm text-gray-700">
            Based on your query, here's a summary: {query.toLowerCase().includes('aadhaar') ? 'You can correct Aadhaar DOB by visiting the enrolment centre with valid proof (birth certificate, school certificate). Online updates are also available via UIDAI portal.' :
            query.toLowerCase().includes('passport') ? 'Passport police verification usually takes 7-15 days. For delays, contact the DCP office or file a grievance on CPGRAMS.' :
            'Please refine your query for more specific guidance.'}
          </p>
        </div>
      )}
      {serviceResults.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Services</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {serviceResults.map(s => (
              <div key={s.id} className="p-3 bg-white border border-gray-200 rounded-xl hover:border-indigo-200 cursor-pointer" onClick={() => navigateTo('service-detail', s.id)}>
                <div className="flex items-center gap-2">
                  <s.icon className="h-5 w-5 text-indigo-500" />
                  <span className="font-medium text-gray-900">{s.name}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {discussionResults.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Discussions</h3>
          <div className="space-y-2">
            {discussionResults.map(d => <DiscussionCard key={d.id} discussion={d} onClick={openDiscussion} />)}
          </div>
        </div>
      )}
      {articleResults.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Knowledge Articles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {articleResults.map(a => <ArticleCard key={a.id} article={a} onClick={() => navigateTo('knowledge')} />)}
          </div>
        </div>
      )}
      {caseResults.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Solved Cases</h3>
          <div className="space-y-2">
            {caseResults.map(c => (
              <div key={c.id} className="p-3 bg-white border border-gray-200 rounded-xl hover:border-indigo-200">
                <div className="font-medium text-gray-900">{c.title}</div>
                <div className="text-xs text-gray-500">{c.description}</div>
                <div className="text-xs text-gray-400 mt-1">Solved by {c.solvedBy} on {c.solvedDate}</div>
                <button className="text-xs text-indigo-600 hover:underline" onClick={() => navigateTo('discussion-detail', c.linkedDiscussion)}>View Discussion</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {discussionResults.length === 0 && articleResults.length === 0 && serviceResults.length === 0 && caseResults.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FiSearch className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No results found. Try adjusting your search terms.</p>
        </div>
      )}
    </div>
  );
};

export default KnowledgeHub;