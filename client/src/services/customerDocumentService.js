import axios from "axios";
import { toast } from "react-toastify";

const customerDocumentApi = axios.create({
  baseURL: "http://localhost:5000/api/customer/documents",
});

/* ================= REQUEST INTERCEPTOR ================= */
customerDocumentApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token")?.trim();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn("customerDocumentService: No token found");
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ================= RESPONSE INTERCEPTOR ================= */
customerDocumentApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("customerDocumentService API error:", {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
    });

    if (error.response?.status === 401) {
      toast.error("Unauthorized. Please login again.");
    }

    return Promise.reject(error);
  }
);

/* ================= APIs ================= */

/** GLOBAL CUSTOMER DOCUMENTS (staff/admin/superadmin) */
export const getCustomerDocuments = (customerId) => {
  return customerDocumentApi.get(`/customer/${customerId}`);
};

/**
 * STAFF – Get customer documents
 * GET /api/customer/documents/staff/customer/:customerId/documents
 */
export const getStaffCustomerDocuments = (
  customerId,
  includeOldVersions = false
) => {
  return customerDocumentApi.get(
    `/staff/customer/${customerId}/documents`,
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
  return customerDocumentApi.get("/document-master");
};

export default customerDocumentApi;