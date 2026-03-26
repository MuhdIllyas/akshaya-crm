import React, { useEffect, useState } from "react";
import PendingPaymentsSection from "./PendingPaymentsSection";
import { 
  getPendingPayments, 
  getPendingPaymentsHistory 
} from "@/services/serviceService";

/**
 * SuperAdmin adapter for PendingPaymentsSection
 * - centreId is mandatory
 * - handles data fetching
 */

const normalizePayments = (rows = []) => {
  return rows.map(r => ({
    id: String(r.service_entry_id),
    customer: {
      name: r.customer_name || "—",
      phone: r.customer_phone || ""
    },
    service: {
      type: r.service_name || "—",
      subcategory: r.subcategory_name || ""
    },
    staff: {
      id: r.staff_id,
      name: r.staff_name || "—"
    },
    total: Number(r.total_charges || 0),
    paid: Number(r.paid_amount || 0),
    due: Number(r.pending_amount || 0),
    createdAt: r.created_at,
    paymentHistory: Array.isArray(r.payment_history)
      ? r.payment_history
      : []
  }));
};

const SuperAdminPendingPayments = ({ centreId, readOnly = true }) => {
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  if (!centreId) {
    return (
      <div className="bg-white p-6 rounded-lg border text-gray-600">
        Select a centre to view pending payments
      </div>
    );
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Prepare params - ensure undefined for empty values
        const params = {
          from: fromDate || undefined,
          to: toDate || undefined,
          centreId: centreId 
        };

        // Debug logging
        console.log("🔍 SuperAdminPendingPayments - Fetching with params:", {
          ...params,
          filter
        });

        let response;
        if (filter === "history") {
          response = await getPendingPaymentsHistory(params);
        } else {
          response = await getPendingPayments(params);
        }

        // Debug logging
        console.log("📊 SuperAdminPendingPayments - API Response:", {
          response,
          isArray: Array.isArray(response),
          length: Array.isArray(response) ? response.length : 0
        });

        const rows = Array.isArray(response) ? response : [];
        
        // Debug logging
        console.log("📈 SuperAdminPendingPayments - Normalized rows:", {
          rowsCount: rows.length,
          sampleRow: rows.length > 0 ? rows[0] : null,
          hasDates: rows.length > 0 ? {
            fromDate,
            toDate,
            firstRowDate: rows[0]?.created_at
          } : null
        });

        const normalized = normalizePayments(rows);
        setPendingPayments(normalized);

        // Log stats for debugging
        const totalDue = normalized.reduce((sum, p) => sum + p.due, 0);
        const filteredByDate = fromDate || toDate 
          ? normalized.filter(p => {
              const paymentDate = new Date(p.createdAt);
              const from = fromDate ? new Date(fromDate) : null;
              const to = toDate ? new Date(toDate) : null;
              
              let include = true;
              if (from) {
                include = include && paymentDate >= from;
              }
              if (to) {
                const toEndOfDay = new Date(to);
                toEndOfDay.setHours(23, 59, 59, 999);
                include = include && paymentDate <= toEndOfDay;
              }
              return include;
            })
          : normalized;

        console.log("📊 SuperAdminPendingPayments - Stats:", {
          totalPayments: normalized.length,
          totalDue: totalDue,
          filteredByDateCount: filteredByDate.length,
          dateFilterApplied: !!(fromDate || toDate)
        });

      } catch (err) {
        console.error("❌ SuperAdminPendingPayments error:", err);
        setPendingPayments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [centreId, filter, fromDate, toDate]);

  const handleClearFilters = () => {
    setFromDate("");
    setToDate("");
    // Note: The useEffect will automatically re-fetch when these states change
  };

  return (
    <div>
      <PendingPaymentsSection
        pendingPayments={pendingPayments}
        loading={loading}
        filter={filter}
        setFilter={setFilter}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        readOnly={readOnly}
        isSuperAdmin={true}
      />
    </div>
  );
};

export default SuperAdminPendingPayments;