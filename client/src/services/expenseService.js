import axios from 'axios';
import { toast } from 'react-toastify';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/expense`,
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

/* =====================================================
   STAFF APIs
===================================================== */

/**
 * Create a new expense (Staff/Admin)
 */
export const createExpense = async (expenseData) => {
  const response = await api.post("/", expenseData);
  return response.data;
};

/**
 * Get logged-in staff expenses
 */
export const getMyExpenses = async () => {
  const response = await api.get("/my");
  return response.data;
};

/**
 * Delete expenses which need admin approval
 */
export const deleteExpense = async (expenseId) => {
  const response = await api.delete(`/${expenseId}`);
  return response.data;
};

/* =====================================================
   ADMIN APIs
===================================================== */

/**
 * Get all expenses for current centre (Admin/Superadmin)
 */
export const getCentreExpenses = async () => {
  const response = await api.get("/");
  return response.data;
};

/**
 * Approve an expense
 */
export const approveExpense = async (expenseId) => {
  const response = await api.put(`/${expenseId}/approve`);
  return response.data;
};

/**
 * Reject an expense
 */
export const rejectExpense = async (expenseId) => {
  const response = await api.put(`/${expenseId}/reject`);
  return response.data;
};

/* =====================================================
   REPORTING (Future Ready)
===================================================== */

/**
 * Get expenses by date range (future reports)
 */
export const getExpensesByDateRange = async (from, to) => {
  const response = await api.get("/", {
    params: { from, to },
  });
  return response.data;
};
