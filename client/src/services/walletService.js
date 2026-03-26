import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Create a new wallet
export const createWallet = async (walletData) => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token found");
  }
  
  const response = await axios.post(`${API_URL}/api/wallet/create`, walletData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response;
};

// Update a wallet
export const updateWallet = async (walletId, walletData) => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token found");
  }
  
  const response = await axios.put(`${API_URL}/api/wallet/${walletId}`, walletData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response;
};

// Delete a wallet
export const deleteWallet = async (walletId) => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token found");
  }
  
  try {
    const response = await axios.delete(`${API_URL}/api/wallet/${walletId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log("deleteWallet response:", response.data);
    return response;
  } catch (error) {
    console.error("deleteWallet Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

// Get audit logs
export const getAuditLogs = async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token found");
  }
  try {
    const response = await axios.get(`${API_URL}/api/wallet/audit-logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log("getAuditLogs response:", response.data);
    return response;
  } catch (error) {
    console.error("getAuditLogs Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

// Get all wallets (used by WalletManagement)
export const getWallets = async () => {
  const token = localStorage.getItem("token");
  console.log("getWallets: Requesting wallets with token:", token ? "Present" : "Missing");
  
  if (!token) {
    throw new Error("No authentication token found");
  }
  
  try {
    const response = await axios.get(`${API_URL}/api/wallet/wallets`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log("getWallets response:", response.data);
    return response;
  } catch (error) {
    console.error("getWallets Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};


export const getWalletsForCentre = async () => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("No authentication token found");

  const response = await axios.get(`${API_URL}/api/wallet/my-centre-wallets`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data; // Now only wallets from current centre
};

// Get a single wallet by ID (for WalletActivity)
export const getWalletById = async (walletId) => {
  if (!walletId) {
    console.error("getWalletById: No walletId provided");
    throw new Error("Wallet ID is required");
  }
  const token = localStorage.getItem("token");
  console.log("getWalletById: Requesting walletId:", walletId, "Token:", token ? "Present" : "Missing");
  if (!token) {
    throw new Error("No authentication token found");
  }
  try {
    const response = await axios.get(`${API_URL}/api/wallet/wallets/${walletId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log("getWalletById response:", response.data);
    return response;
  } catch (error) {
    console.error("getWalletById Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      walletId,
    });
    throw error;
  }
};

// Get transactions for a specific wallet (for WalletActivity)
export const getWalletTransactions = async (walletId) => {
  if (!walletId) {
    console.error("getWalletTransactions: No walletId provided");
    throw new Error("Wallet ID is required");
  }
  const token = localStorage.getItem("token");
  console.log("getWalletTransactions: Requesting walletId:", walletId, "Token:", token ? "Present" : "Missing");
  if (!token) {
    throw new Error("No authentication token found");
  }
  try {
    const response = await axios.get(`${API_URL}/api/wallet/transactions/${walletId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log("getWalletTransactions response:", response.data);
    console.log("Calling getWalletTransactions for walletId:", walletId);
    return response;
  } catch (error) {
    console.error("getWalletTransactions Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      walletId,
    });
    throw error;
  }
};

// Get all transactions (used by WalletManagement)
export const getTransactions = async () => {
  const token = localStorage.getItem("token");
  console.log("getTransactions: Requesting transactions with token:", token ? "Present" : "Missing");
  
  if (!token) {
    throw new Error("No authentication token found");
  }
  
  try {
    const response = await axios.get(`${API_URL}/api/wallet/transactions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log("getTransactions response:", response.data);
    return response;
  } catch (error) {
    console.error("getTransactions Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

// Get all staff
export const getStaff = async () => {
  const token = localStorage.getItem("token");
  console.log("getStaff: Requesting:", `${API_URL}/api/staff/all`, "Token:", token ? "Present" : "Missing");
  if (!token) {
    throw new Error("No authentication token found");
  }
  try {
    const response = await axios.get(`${API_URL}/api/staff/all`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log("getStaff response:", response.data);
    return response.data;
  } catch (error) {
    console.error("getStaff Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

// Recharge wallet
export const rechargeWallet = async (rechargeData) => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token found");
  }
  try {
    const transactionData = {
      wallet_id: rechargeData.wallet_id,
      amount: rechargeData.amount,
      type: "credit",
      description: rechargeData.description,
      category: rechargeData.category,
      staff_id: rechargeData.staff_id,
    };
    const response = await axios.post(
      `${API_URL}/api/wallet/transactions`,
      transactionData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("rechargeWallet response:", response.data);
    return response;
  } catch (error) {
    console.error("rechargeWallet Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

// Transfer wallet
export const transferWallet = async (transferData) => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No authentication token found");
  }
  try {
    console.log("transferWallet: Sending payload:", transferData);
    const response = await axios.post(
      `${API_URL}/api/wallet/transfer`,
      transferData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("transferWallet response:", response.data);
    return response;
  } catch (error) {
    console.error("transferWallet Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    if (error.response?.status === 401) {
      alert("Session expired. Please log in again.");
      window.location.href = "/login";
    }
    throw error;
  }
};

//superadmin - centre wise wallet selection for salary creation
export const getWalletsByCentre = async (centreId) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("No authentication token");

  const response = await axios.get(
    `${API_URL}/api/wallet/centre/${centreId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return response.data;
};

//for quickservicemodal wallet transactions
export const createWalletTransaction = async (data) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("No authentication token");

  return axios.post(
    `${API_URL}/api/wallet/transactions`,
    {
      wallet_id: data.wallet_id,
      amount: data.amount,
      type: data.type, // credit | debit
      description: data.description,
      category: data.category,
      staff_id: data.staff_id,
      service_entry_id: data.service_entry_id || null,
      reference: data.reference || null,
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
};

//daily balances auto updates
export const getWalletTodayBalance = async (walletId) => {
  const res = await axios.get(
    `${API_URL}/api/wallet/${walletId}/today-balance`,
  {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  }
  );
  return res.data;
};

export const getWalletDailyBalances = async (walletId, from, to) => {
  const res = await axios.get(
    `${API_URL}/api/wallet/${walletId}/daily-balances`,
  {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  }
  );
  return res.data;
};