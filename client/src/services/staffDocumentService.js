// staffDocumentService.js - Updated with all required functions
import axios from "axios";
import { toast } from "react-toastify";

const api = axios.create({
  baseURL: "http://localhost:5000/api/staffcustomerdocuments",
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')?.trim();
  console.log('staffDocumentService.js: Token from localStorage:', token);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('staffDocumentService.js: Sending Authorization header:', `Bearer ${token}`);
  } else {
    console.warn('staffDocumentService.js: No JWT token found in localStorage');
  }
  console.log('staffDocumentService.js: Request URL:', config.url);
  return config;
}, error => {
  console.error('staffDocumentService.js: Request interceptor error:', error);
  return Promise.reject(error);
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error('staffDocumentService.js: API error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    if (error.response?.status === 401) {
      console.warn('staffDocumentService.js: Unauthorized for URL:', error.config?.url);
      toast.error(`Unauthorized access for ${error.config?.url}. Please log in again.`, {
        position: 'top-right',
        autoClose: 3000,
        theme: 'light',
        toastId: `auth-error-${error.config?.url}`,
      });
    }
    return Promise.reject(error);
  }
);

/* ================= APIs ================= */

/** GLOBAL CUSTOMER DOCUMENTS (staff/admin/superadmin) */
export const getCustomerDocuments = (customerId) => {
  return api.get(`/customer/${customerId}`);
};

/**
 * STAFF – Get customer documents
 */
export const getStaffCustomerDocuments = (
  customerId,
  includeOldVersions = false
) => {
  return api.get(
    `/${customerId}/documents`,
    {
      params: {
        include_old_versions: includeOldVersions,
      },
    }
  );
};

/**
 * STAFF – Get document master (Aadhaar, Ration Card, etc.)
 */
export const getDocumentMaster = () => {
  return api.get("/document-master");
};

/**
 * STAFF – Upload document for customer
 */
export const uploadStaffDocument = async (customerId, formData) => {
  const response = await api.post(`/${customerId}/upload-staff`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * STAFF – Review/update document status
 */
export const reviewDocument = (documentId, reviewData) => {
  return api.put(`/${documentId}/review`, reviewData);
};

/**
 * STAFF – Download document
 */
export const downloadDocumentFile = async (documentId) => {
  try {
    const response = await api.get(`/${documentId}/download`, {
      responseType: 'blob'
    });
    
    // Get filename from content-disposition header
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'document';
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }
    
    return {
      blob: response.data,
      filename: filename,
      mimeType: response.headers['content-type']
    };
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
};

/**
 * STAFF – View document (open in new tab)
 */
export const viewDocument = async (documentId) => {
  try {
    const response = await api.get(`/${documentId}/download`, {
      responseType: 'blob'
    });
    
    const blob = new Blob([response.data], { type: response.headers['content-type'] });
    const url = window.URL.createObjectURL(blob);
    return url;
  } catch (error) {
    console.error('View document error:', error);
    throw error;
  }
};

// Get customer's service applications for document linking
export const getCustomerServices = async (customerId) => {
  try {
    const response = await api.get(`/${customerId}/services`);
    return response.data;
  } catch (error) {
    console.error('Error fetching customer services:', error);
    throw error;
  }
};

export const getCustomerHouseholds = async (customerId) => {
  try {
    const response = await api.get(`/${customerId}/services`);
    return response.data;
  } catch (error) {
    console.error('Error fetching customer services:', error);
    throw error;
  }
};

export default api;