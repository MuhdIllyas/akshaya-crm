import React, { useState } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  X,
  MapPin,
  Clock,
  User,
  MoreHorizontal,
  Copy,
  Edit3,
  Calendar as CalendarIcon,
  Check,
} from 'lucide-react';

export default function Calendar() {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState({
    title: 'Case Review: Sarah J.',
    type: 'Appointment',
    date: 'Tuesday, Jun 17, 2025',
    time: '11 AM - 12 PM',
    location: 'Office - Meeting Room 2',
    attendees: [
      { name: 'Rachel Windman', role: 'Organizer', img: 'RW' },
      { name: 'Sarah Johnston', role: 'Accepted', img: 'SJ' },
    ],
    color: 'bg-indigo-600',
  });

  const events = [
    {
      id: 1,
      title: 'Court Hearing: Case #20314',
      time: '9:30 AM - 11:30 AM',
      location: 'County Courthouse - Room 304',
      day: 'Mon, 16',
      color: 'bg-purple-50 border-purple-300 text-purple-900',
    },
    {
      id: 2,
      title: 'Case Review: Sarah J.',
      time: '11:00 AM - 12:00 PM',
      location: 'Office - Meeting Room 2',
      day: 'Tue, 17',
      color: 'bg-indigo-600 border-indigo-600 text-white',
    },
    {
      id: 3,
      title: 'Out of Office: Mike. H',
      time: 'All day',
      location: '',
      day: 'Wed, 18',
      color: 'bg-red-50 border-red-200 text-red-900',
      allDay: true,
    },
    {
      id: 4,
      title: 'Out of Office: Personal',
      time: '1 PM - 4 PM',
      location: '',
      day: 'Sat, 21',
      color: 'bg-red-50 border-red-100 text-red-900',
    },
  ];

  const days = [
    { label: 'Sun, 15', date: 15 },
    { label: 'Mon, 16', date: 16 },
    { label: 'Tue, 17', date: 17 },
    { label: 'Wed, 18', date: 18 },
    { label: 'Thu, 19', date: 19 },
    { label: 'Fri, 20', date: 20 },
    { label: 'Sat, 21', date: 21 },
  ];

  const hours = [
    '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM',
  ];

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      
      {/* Header and Controls */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold text-gray-900">Calendar</h1>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64 md:w-80"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-200 rounded-lg p-1 bg-white">
            <button className="p-2 hover:bg-gray-50 rounded-md text-gray-500">
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-sm font-medium text-gray-700 min-w-32 text-center">
              Jun 15-21, 2025
            </span>
            <button className="p-2 hover:bg-gray-50 rounded-md text-gray-500">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex border border-gray-200 rounded-lg bg-white text-sm font-medium text-gray-600">
            <button className="px-3 py-2 hover:bg-gray-50 border-r border-gray-100">Month</button>
            <button className="px-3 py-2 bg-gray-900 text-white rounded-md">Week</button>
            <button className="px-3 py-2 hover:bg-gray-50 border-l border-gray-100">Day</button>
            <button className="px-3 py-2 hover:bg-gray-50 border-l border-gray-100">List</button>
          </div>

          <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 text-gray-700">
            Today
          </button>
          
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 text-gray-700">
            <Filter size={16} />
            Filters
          </button>

          <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition">
            <Plus size={16} />
            New Event
          </button>
        </div>
      </header>

      {/* Calendar Grid Area */}
      <main className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative">
          
          {/* Days Header */}
          <div className="grid grid-cols-8 border-b border-gray-100 text-center text-sm font-medium text-gray-500 bg-gray-50/50">
            <div className="py-4 border-r border-gray-100"></div>
            {days.map((day, idx) => (
              <div 
                key={idx} 
                className={`py-4 border-r border-gray-100 uppercase tracking-wider text-xs font-semibold flex flex-col items-center gap-1 ${
                  day.date === 20 ? 'text-indigo-600 font-bold' : 'text-gray-500'
                }`}
              >
                <span>{day.label.split(',')[0]}</span>
                <span className={`text-base font-bold ${day.date === 20 ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs' : ''}`}>
                  {day.date}
                </span>
              </div>
            ))}
          </div>

          {/* Grid Rows / Time Slots */}
          <div className="grid grid-cols-8 divide-y divide-gray-100 text-sm relative">
            {hours.map((hour, hourIdx) => (
              <React.Fragment key={hourIdx}>
                {/* Time Column */}
                <div className="text-right pr-4 py-8 text-xs text-gray-400 -mt-4 bg-gray-50/20 border-r border-gray-100">
                  {hour}
                </div>

                {/* 7 Day Columns */}
                {Array.from({ length: 7 }).map((_, dayIdx) => (
                  <div 
                    key={dayIdx} 
                    className="h-20 relative border-r border-gray-100 group hover:bg-gray-50/20 transition cursor-pointer" 
                    onClick={() => console.log(`Clicked cell day ${dayIdx}, hour ${hour}`)}
                  >
                    
                    {/* Event indicators can be drawn absolutely within these cells */}
                    {hour === '9 AM' && dayIdx === 1 && (
                      <div 
                        className="absolute top-1 left-1 right-1 p-2 rounded-md bg-purple-50 border border-purple-300 shadow-sm z-0"
                        onClick={(e) => { e.stopPropagation(); handleEventClick(events[0]); }}
                      >
                        <p className="font-semibold text-purple-900 text-xs truncate">Court Hearing: Case #20314</p>
                        <p className="text-[10px] text-purple-600 mt-0.5">9:30 AM - 11:30 AM</p>
                      </div>
                    )}

                    {hour === '11 AM' && dayIdx === 2 && (
                      <div 
                        className="absolute top-1 left-1 right-1 p-2 rounded-md bg-indigo-600 border border-indigo-700 shadow-md z-0"
                        onClick={(e) => { e.stopPropagation(); handleEventClick(events[1]); }}
                      >
                        <p className="font-bold text-white text-xs truncate">Case Review: Sarah J.</p>
                        <p className="text-[10px] text-indigo-200 mt-0.5">11 AM - 12 PM</p>
                      </div>
                    )}

                    {hour === '1 PM' && dayIdx === 6 && (
                      <div 
                        className="absolute top-1 left-1 right-1 p-2 rounded-md bg-red-50 border border-red-200 shadow-sm z-0"
                        onClick={(e) => { e.stopPropagation(); handleEventClick(events[3]); }}
                      >
                        <p className="font-semibold text-red-900 text-xs truncate">Out of Office: Personal</p>
                        <p className="text-[10px] text-red-600 mt-0.5">1 PM - 4 PM</p>
                      </div>
                    )}
                    
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>

          {/* Event Details Popover/Modal */}
          {isModalOpen && (
            <div className="absolute top-24 left-1/3 bg-white w-96 border border-gray-200 rounded-xl shadow-2xl p-5 z-20 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="w-1.5 h-16 bg-indigo-600 rounded-full"></div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{selectedEvent.title}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium mt-1">
                      <CalendarIcon size={12} />
                      <span>{selectedEvent.type}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded-full text-gray-400 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-gray-600 border-b border-gray-50 pb-4">
                <div className="flex items-center gap-2.5">
                  <Clock size={14} className="text-gray-400" />
                  <span className="text-gray-700">{selectedEvent.date}, {selectedEvent.time}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin size={14} className="text-gray-400" />
                  <span className="text-gray-700">{selectedEvent.location}</span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <User size={14} className="text-gray-400" />
                  <span className="text-gray-700">2 Attendees</span>
                </div>
              </div>

              {/* Attendee List */}
              <div className="space-y-2.5">
                {selectedEvent.attendees.map((att, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-[10px]">
                        {att.img}
                      </div>
                      <span className="font-medium text-gray-800">{att.name}</span>
                    </div>
                    <span className="text-gray-400 text-[10px]">{att.role}</span>
                  </div>
                ))}
              </div>

              {/* Notes Input */}
              <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-xs text-gray-400 flex items-center gap-2">
                <span className="text-gray-400">📝</span>
                <input 
                  type="text" 
                  placeholder="Write your notes" 
                  className="bg-transparent text-gray-600 focus:outline-none w-full placeholder-gray-400" 
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center gap-2 border-t border-gray-100 pt-3">
                <div className="flex gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
                    <Edit3 size={13} />
                    Edit
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
                    <Copy size={13} />
                    Duplicate
                  </button>
                </div>
                <button className="p-1.5 text-gray-400 hover:bg-gray-50 border border-transparent hover:border-gray-200 rounded-lg transition">
                  <MoreHorizontal size={14} />
                </button>
              </div>

            </div>
          )}
          
        </div>
      </main>
    </div>
  );
}