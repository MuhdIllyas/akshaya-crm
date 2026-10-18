import React from "react";
import WalletsSection from "./WalletsSection";

/**
 * SuperAdmin adapter for WalletsSection
 * - centreId is mandatory
 * - readOnly enforced
 */
const SuperAdminWalletsSection = ({ centreId }) => {
  if (!centreId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
        Select a centre to view wallets
      </div>
    );
  }

  return (
    <WalletsSection
      centreId={centreId}
      readOnly={true}
      isSuperAdmin={true}
    />
  );
};

export default SuperAdminWalletsSection;