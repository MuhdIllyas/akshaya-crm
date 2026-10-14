// src/components/automations/ServiceLinkChip.jsx
// Small chip that shows which service a task / schedule belongs to,
// and opens that service's tracking page when clicked.
//
// Accepts either a task row (service_name, service_customer_name, tracking_id)
// or a schedule row (service_name, customer_name, tracking_id).

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPackage, FiExternalLink } from 'react-icons/fi';

export const TRACKING_PATH = (trackingId) => `/dashboard/staff/track_service/${trackingId}`;

export default function ServiceLinkChip({ item, compact = false, className = '' }) {
  const navigate = useNavigate();
  if (!item) return null;

  const entryId = item.related_service_entry_id || item.service_entry_id;
  if (!entryId) return null;

  const service = item.subcategory_name || item.service_subcategory_name || item.service_name || 'Service';
  const customer = item.service_customer_name || item.customer_name;
  const trackingId = item.tracking_id;
  const label = customer ? `${service} · ${customer}` : service;

  const content = (
    <>
      <FiPackage className="h-3 w-3 shrink-0" />
      <span className={`truncate ${compact ? 'max-w-[140px]' : 'max-w-[240px]'}`}>{label}</span>
      {trackingId && <FiExternalLink className="h-3 w-3 shrink-0 opacity-70" />}
    </>
  );

  const base =
    'inline-flex items-center gap-1 rounded-md border text-[10px] font-semibold px-1.5 py-0.5 max-w-full';

  if (!trackingId) {
    return (
      <span
        className={`${base} bg-gray-50 text-gray-600 border-gray-200 ${className}`}
        title={`Service entry #${entryId} (no tracking record)`}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // don't trigger card drag / row clicks
        navigate(TRACKING_PATH(trackingId));
      }}
      onMouseDown={(e) => e.stopPropagation()}
      draggable={false}
      className={`${base} bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 hover:border-teal-300 transition ${className}`}
      title={`Open service tracking${item.application_number ? ` · App no. ${item.application_number}` : ''}`}
    >
      {content}
    </button>
  );
}