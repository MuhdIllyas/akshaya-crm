// A booking's documents and the Submit button.
//
// Uploading is optional: each required document shows whether the customer
// already uploaded it. Anything not uploaded is simply brought to the centre
// (or uploaded later from My Documents). Fees are paid at the centre.

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import {
  FiArrowLeft, FiCheckCircle, FiClock, FiAlertCircle, FiFileText, FiUpload, FiInfo, FiSend,
} from "react-icons/fi";

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000" });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("customer_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const STATE = {
  uploaded: { label: "Uploaded", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: FiCheckCircle },
  pending: { label: "Uploaded, being checked", cls: "bg-sky-50 text-sky-700 border-sky-200", icon: FiClock },
  rejected: { label: "Needs a new copy", cls: "bg-rose-50 text-rose-700 border-rose-200", icon: FiAlertCircle },
  missing: { label: "Bring to the centre", cls: "bg-slate-50 text-slate-600 border-slate-200", icon: FiFileText },
};

const SUBMITTABLE = ["draft", "pending_documents", "action_required"];

export default function ContinueApplication() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const res = await API.get(`/api/customer/bookings/${id}/required-documents`);
      setData(res.data);
      setError("");
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login");
        return;
      }
      setError(err.response?.data?.message || "Couldn't load this application");
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await API.put(`/api/customer/bookings/${id}/submit`);
      toast.success(res.data.message || "Application submitted");
      navigate("/customer/myservices");
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't submit the application");
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <FiAlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-600" />
          <p className="text-rose-800">{error}</p>
          <button onClick={() => navigate("/customer/myservices")} className="mt-4 rounded-xl bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800">
            Back to My Services
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-500">
        <div className="mr-3 h-6 w-6 animate-spin rounded-full border-b-2 border-navy-700" /> Loading…
      </div>
    );
  }

  const docs = data.required_documents || [];
  const missing = docs.filter((d) => d.state === "missing" || d.state === "rejected");
  const canSubmit = SUBMITTABLE.includes(data.status);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <button onClick={() => navigate("/customer/myservices")} className="inline-flex items-center text-sm font-medium text-navy-700 hover:text-navy-800">
        <FiArrowLeft className="mr-2" /> Back to My Services
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Application {data.application_number}</p>
        <h1 className="mt-0.5 text-xl font-semibold text-slate-900">{data.service_name}</h1>
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          <FiInfo className="mt-0.5 h-4 w-4 shrink-0 text-navy-700" />
          Fees are paid at the centre when your work is done.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Documents needed</h2>
            <p className="text-sm text-slate-500">
              Uploading is optional. Anything you don't upload, bring with you to the centre.
            </p>
          </div>
          <button
            onClick={() => navigate("/customer/mydocuments")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-navy-700 hover:bg-slate-50"
          >
            <FiUpload className="h-4 w-4" /> Upload documents
          </button>
        </div>

        {docs.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No documents are needed for this service.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {docs.map((doc, i) => {
              const s = STATE[doc.state] || STATE.missing;
              const Icon = s.icon;
              return (
                <li key={`${doc.document_type_id}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{doc.type_name || doc.document_name}</p>
                    {doc.note && <p className="text-xs text-slate-500">{doc.note}</p>}
                    {doc.state === "rejected" && doc.review_remarks && (
                      <p className="mt-0.5 text-xs text-rose-600">{doc.review_remarks}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${s.cls}`}>
                    <Icon className="h-3.5 w-3.5" /> {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {canSubmit ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {missing.length === 0
                ? "All documents are uploaded. You're ready to submit."
                : `${missing.length} document${missing.length === 1 ? "" : "s"} to bring to the centre. You can still submit now.`}
            </p>
            <button
              onClick={submit}
              disabled={submitting}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-navy-700 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
            >
              <FiSend className="h-4 w-4" /> {submitting ? "Submitting…" : "Submit application"}
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <FiCheckCircle className="h-4 w-4 text-emerald-600" />
            Submitted. {missing.length > 0 ? "You can still upload the remaining documents from My Documents." : "The centre will contact you."}
          </p>
        )}
      </div>
    </div>
  );
}
