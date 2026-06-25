import axios from 'axios';
import { toast } from 'react-toastify';

// Create the Axios instance for Notes
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/notes`,
});

// Request Interceptor: Attach Token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')?.trim();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn('notesService.js: No JWT token found in localStorage');
  }
  return config;
}, error => {
  console.error('notesService.js: Request interceptor error:', error);
  return Promise.reject(error);
});

// Response Interceptor: Handle 401 Unauthorized
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      console.warn('notesService.js: Unauthorized for URL:', error.config?.url);
      toast.error('Unauthorized access. Please log in again.', {
        position: 'top-right',
        autoClose: 3000,
        theme: 'light',
        toastId: `auth-error-notes`,
      });
    }
    return Promise.reject(error);
  }
);

// ================================
// Notes API Calls
// ================================

// 1. Create a new note
export const createNote = async (noteData) => {
  console.log('notesService.js: Creating note with data:', noteData);
  const response = await api.post('/', noteData);
  return response.data;
};

// 2. Get notes linked to a specific customer
export const getCustomerNotes = async (customerId) => {
  console.log('notesService.js: Fetching notes for customer:', customerId);
  const response = await api.get(`/customer/${customerId}`);
  return response.data;
};

// 3. Get notes linked to a specific service entry
export const getServiceEntryNotes = async (serviceEntryId) => {
  console.log('notesService.js: Fetching notes for service entry:', serviceEntryId);
  const response = await api.get(`/service-entry/${serviceEntryId}`);
  return response.data;
};

// 4. Update an existing note
export const updateNote = async (noteId, noteData) => {
  console.log('notesService.js: Updating note:', { noteId, noteData });
  const response = await api.put(`/${noteId}`, noteData);
  return response.data;
};

// 5. Delete a note
export const deleteNote = async (noteId) => {
  console.log('notesService.js: Deleting note:', noteId);
  const response = await api.delete(`/${noteId}`);
  return response.data;
};

export default api;