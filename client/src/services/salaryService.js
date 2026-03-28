import axios from 'axios';
import { toast } from 'react-toastify';

const api = axios.create({
  baseURL: `import.meta.env.VITE_API_URL/api/salary`,  
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')?.trim();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      toast.error('Unauthorized access. Please log in again.');
    }
    return Promise.reject(error);
  }
);

// Fetch staff list (extend from existing staff API if needed, but assuming salary context)
export const getStaffList = async () => {
  return (await api.get('/staff')).data;
};

// Fetch all attendance for a month
export const getAllAttendance = async (month) => {
  return (await api.get('/attendance', { params: { month } })).data;
};

export const postAttendance = async data => {
  return (await api.post('/attendance', data)).data;
};

// Update attendance record
export const updateAttendance = async (id, data) => {
  return (await api.put(`/attendance/${id}`, data)).data;
};

// Fetch pending leaves
export const getPendingLeaves = async () => {
  return (await api.get('/leaves/pending')).data;
};

export const getLeaves = async (month) => {
  return (await api.get('/leaves', { params: month ? { month } : {} })).data;
};

export const submitLeave = async data => {
  return (await api.post('/leaves', data)).data;
};

// Update leave status (approve/reject)
export const updateLeave = async (id, status) => {
  return (await api.put(`/leaves/${id}`, { status })).data;
};

// creating salaries
export const createSalary = async (data) => {
  try {
    return (await api.post('/salaries', data)).data;
  } catch (error) {
    console.error('Error creating salary:', error);
    throw error;
  }
};

// creating salaries
export const getAllSalaries = async (data) => {
  try {
    return (await api.post('/salaries', data)).data;
  } catch (error) {
    console.error('Error creating salary:', error);
    throw error;
  }
};

// Fetch salary data for a month
export const getSalaryData = async (month) => {
  return (await api.get('/salaries', { params: { month } })).data;
};

// Update salary record
export const updateSalary = async (id, data) => {
  return (await api.put(`/salaries/${id}`, data)).data;
};

// Send individual salary slip
export const sendSalary = async (id) => {
  return (await api.post(`/salaries/${id}/send`)).data;
};

// Bulk send salaries for a month
export const bulkSendSalaries = async (month) => {
  return (await api.post('/salaries/bulk-send', { month })).data;
};

// Fetch calendar data (working days/holidays)
export const getCalendarData = async () => {
  return (await api.get('/calendar')).data;
};

// Add calendar event (holiday/working day)
export const addCalendarEvent = async (data) => {
  return (await api.post('/calendar', data)).data;
};

// Add Break
export const postBreak = async (data) => {
  return (await api.post('/attendance/break', data)).data;
};

// Delete Calendar Event
export const deleteCalendarEvent = async (id) => {
  console.log('Deleting calendar event with ID:', id);
  return (await api.delete(`/calendar/${id}`)).data;
};

// Update Calendar Event
export const updateCalendarEvent = async (id, data) => {
  console.log('Updating calendar event with ID:', id, 'Data:', data);
  return (await api.put(`/calendar/${id}`, data)).data;
};

// Getting Staff Schedules
export const getStaffSchedules = async (staffId) => {
  try {
    const response = await api.get(`/staff/${staffId}/schedules`);
    return response.data;
  } catch (error) {
    console.error('Error fetching staff schedules:', error);
    throw error;
  }
};

// src/services/salaryService.js
export const getAutoCalc = async (staffId, month) => {
  try {
    const response = await api.get(`/auto-calc`, {
      params: { staff_id: staffId, month },
    });
    return response.data;
  } catch (error) {
    console.error('Auto-calc failed:', error);
    toast.error('Failed to load working days / hours');
    throw error;
  }
};

// Super Admin Services
export const getAllCenters = async () => {
  return (await api.get('/super-admin/centers')).data;
};

export const getStaffByCenter = async (centerId) => {
  return (await api.get(`/super-admin/centers/${centerId}/staff`)).data;
};

export const getAttendanceByCenter = async (centerId, month) => {
  return (await api.get(`/super-admin/centers/${centerId}/attendance`, { params: { month } })).data;
};

export const getLeavesByCenter = async (centerId, month) => {
  return (await api.get(`/super-admin/centers/${centerId}/leaves`, { params: { month } })).data;
};

export const getSalaryByCenter = async (centerId, month) => {
  return (await api.get(`/super-admin/centers/${centerId}/salaries`, { params: { month } })).data;
};

export const getCalendarByCenter = async (centerId) => {
  return (await api.get(`/super-admin/centers/${centerId}/calendar`)).data;
};

export const getOverallStats = async () => {
  return (await api.get('/super-admin/stats')).data;
};

export const getCenterSummary = async () => {
  return (await api.get('/super-admin/centers-summary')).data;
};

export const exportCenterData = async (centerId, month) => {
  const response = await api.get(`/super-admin/export/center/${centerId}`, {
    params: { month },
    responseType: 'blob'
  });
  return response.data;
};

export const exportAllCentersData = async (month) => {
  const response = await api.get('/super-admin/export/all-centers', {
    params: { month },
    responseType: 'blob'
  });
  return response.data;
};

export const updateSalaryByCenter = async (centerId, salaryId, data) => {
  return (
    await api.put(
      `/centers/${centerId}/salaries/${salaryId}`,
      data
    )
  ).data;
};

export const updateLeaveByCenter = async (centerId, leaveId, status) => {
  return (
    await api.put(
      `/centers/${centerId}/leaves/${leaveId}`,
      { status }
    )
  ).data;
};

export const sendSalaryByCenter = async (centerId, salaryId) => {
  return (
    await api.post(
      `/centers/${centerId}/salaries/${salaryId}/send`
    )
  ).data;
};

export const bulkSendSalariesByCenter = async (centerId, month) => {
  return (
    await api.post(
      `/centers/${centerId}/salaries/bulk-send`,
      { month }
    )
  ).data;
};

export const deleteCalendarEventByCenter = async (centerId, eventId) => {
  return (
    await api.delete(
      `/centers/${centerId}/calendar/${eventId}`
    )
  ).data;
};
