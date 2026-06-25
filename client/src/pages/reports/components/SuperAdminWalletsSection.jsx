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
      <div className="bg-white p-6 rounded-lg border text-gray-600">
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