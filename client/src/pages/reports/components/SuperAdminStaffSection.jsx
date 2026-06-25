import React, { useState, useEffect } from "react";
import StaffPerformanceSection from "./StaffPerformanceSection";

const SuperAdminStaffSection = ({ centreId }) => {
  const [showCharts, setShowCharts] = useState(true);
  const [timePeriod, setTimePeriod] = useState("monthly");
  const [ratingDistribution, setRatingDistribution] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Fetch rating distribution whenever centreId or timePeriod changes
  useEffect(() => {
    if (!centreId) return;

    const fetchRatingDistribution = async () => {
      try {
        setLoadingReviews(true);
        const token = localStorage.getItem("token");
        
        // Calculate dates based on timePeriod (similar to StaffPerformanceSection)
        const now = new Date();
        const to = now.toISOString().slice(0, 10);
        
        let from;
        if (timePeriod === "monthly") {
          from = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (timePeriod === "quarterly") {
          const q = Math.floor(now.getMonth() / 3) * 3;
          from = new Date(now.getFullYear(), q, 1);
        } else {
          from = new Date(now.getFullYear(), 0, 1);
        }
        const fromDate = from.toISOString().slice(0, 10);
        
        const params = new URLSearchParams({ 
          centreId,
          from: fromDate,
          to 
        });
        
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/staffreport/rating-distribution?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        if (!res.ok) throw new Error("Failed to fetch rating distribution");
        
        const data = await res.json();
        setRatingDistribution(data);
      } catch (err) {
        console.error("Rating distribution error:", err);
        setRatingDistribution([]);
      } finally {
        setLoadingReviews(false);
      }
    };

    fetchRatingDistribution();
  }, [centreId, timePeriod]); // Re-fetch when centreId or timePeriod changes

  if (!centreId) {
    return (
      <div className="bg-white p-6 rounded-lg border text-gray-600">
        Select a centre to view staff performance
      </div>
    );
  }

  return (
    <StaffPerformanceSection
      centreId={centreId}
      showCharts={showCharts}
      timePeriod={timePeriod}
      setTimePeriod={setTimePeriod}
      ratingDistribution={ratingDistribution}
      loadingReviews={loadingReviews}
      isSuperAdmin={true}
    />
  );
};

export default SuperAdminStaffSection;
