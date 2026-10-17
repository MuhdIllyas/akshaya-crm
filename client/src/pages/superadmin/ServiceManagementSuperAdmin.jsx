import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiPlus, FiSearch, FiX, FiEdit2, FiTrash2, FiChevronDown, FiExternalLink, FiFileText,
  FiClock, FiCreditCard, FiZap, FiGitBranch, FiLayers, FiCheckCircle, FiLoader, FiAlertCircle,
  FiBriefcase,
} from "react-icons/fi";
import {
  getServices,
  createService,
  updateService,
  deleteService,
  addSubcategory,
  deleteSubcategory,
  updateSubcategory,
} from "@/services/serviceService";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* ---------------- shared styles ---------------- */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20";
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 transition-colors";
const btnPrimary = `${btnBase} bg-navy-700 text-white shadow-sm hover:bg-navy-800`;
const btnGhost = `${btnBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const iconBtn =
  "rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(amount || 0);

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ---------------- small building blocks ---------------- */

const KpiTile = ({ label, value, icon: Icon, chip }) => (
  <div className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:gap-3 sm:p-4">
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${chip}`}>
      <Icon className="h-5 w-5" />
    </span>
    <div className="min-w-0">
      <p className="truncate text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  </div>
);

const Pill = ({ icon: Icon, tone = "slate", children, title }) => {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-navy-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
};

const Field = ({ label, hint, children }) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
    {children}
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </div>
);

const Check = ({ label, hint, ...props }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
    <input
      type="checkbox"
      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
      {...props}
    />
    <span>
      <span className="block text-sm font-medium text-slate-800">{label}</span>
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </span>
  </label>
);

const Modal = ({ title, subtitle, onClose, onSubmit, submitLabel, children }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <motion.form
        onSubmit={onSubmit}
        initial={{ scale: 0.97, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, y: 12 }}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className={iconBtn} aria-label="Close">
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary}>
            {submitLabel}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

/* ---------------- page ---------------- */

const ServiceManagementSuperAdmin = () => {
  const [services, setServices] = useState([]);
  const [expandedService, setExpandedService] = useState(null);
  const [expandedSubCategory, setExpandedSubCategory] = useState(null);
  const [addSubFor, setAddSubFor] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // add sub-category
  const [newSubcategory, setNewSubcategory] = useState("");
  const [newSubcategoryDeptCharges, setNewSubcategoryDeptCharges] = useState("");
  const [newSubcategoryServiceCharges, setNewSubcategoryServiceCharges] = useState("");
  const [newSubcategoryDocuments, setNewSubcategoryDocuments] = useState("");

  // add service
  const [newServiceDocuments, setNewServiceDocuments] = useState("");
  const [newServiceRequiresWallet, setNewServiceRequiresWallet] = useState(false);
  const [newServiceRequiresWorkflow, setNewServiceRequiresWorkflow] = useState(true);
  const [newServiceHasExpiry, setNewServiceHasExpiry] = useState(false);

  // edit service
  const [editServiceDocuments, setEditServiceDocuments] = useState("");
  const [editServiceRequiresWallet, setEditServiceRequiresWallet] = useState(true);
  const [editServiceRequiresWorkflow, setEditServiceRequiresWorkflow] = useState(true);
  const [editServiceHasExpiry, setEditServiceHasExpiry] = useState(false);

  // edit sub-category
  const [showEditSubcategoryModal, setShowEditSubcategoryModal] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [editingSubcategoryServiceId, setEditingSubcategoryServiceId] = useState(null);
  const [editSubcategoryName, setEditSubcategoryName] = useState("");
  const [editSubcategoryDeptCharges, setEditSubcategoryDeptCharges] = useState("");
  const [editSubcategoryServiceCharges, setEditSubcategoryServiceCharges] = useState("");
  const [editSubcategoryDocuments, setEditSubcategoryDocuments] = useState("");

  const [loading, setLoading] = useState(true); // first load only
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  /* ---------------- data ---------------- */

  // wait a moment after typing before asking the server
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setRefreshing(true);
      try {
        const servicesResponse = await getServices(debouncedQuery);
        if (cancelled) return;
        setServices(Array.isArray(servicesResponse.data) ? servicesResponse.data : []);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching data:", err.response?.data || err.message);
        setLoadError("Failed to load services. Please try again.");
        toast.error("Failed to load data.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, reloadKey]);

  const refetchServices = async () => {
    const servicesResponse = await getServices(debouncedQuery);
    setServices(Array.isArray(servicesResponse.data) ? servicesResponse.data : []);
  };

  /* ---------------- derived ---------------- */

  const counts = useMemo(
    () => ({
      all: services.length,
      active: services.filter((s) => s.status === "active").length,
      inactive: services.filter((s) => s.status !== "active").length,
      subs: services.reduce((sum, s) => sum + (s.subcategories?.length || 0), 0),
    }),
    [services]
  );

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return services.filter((service) => {
      if (statusFilter === "active" && service.status !== "active") return false;
      if (statusFilter === "inactive" && service.status === "active") return false;
      if (!q) return true;
      return (
        service.name?.toLowerCase().includes(q) ||
        service.description?.toLowerCase().includes(q) ||
        (service.subcategories || []).some((sc) => sc.name?.toLowerCase().includes(q))
      );
    });
  }, [services, searchQuery, statusFilter]);

  const highlightMatch = (text) => {
    const q = searchQuery.trim();
    if (!q || !text) return text;
    // split() with a capture group puts the matches at the odd positions
    return String(text)
      .split(new RegExp(`(${escapeRegExp(q)})`, "gi"))
      .map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-amber-100 px-0.5 text-slate-900">
            {part}
          </mark>
        ) : (
          part
        )
      );
  };

  const splitLines = (text) =>
    text
      .split("\n")
      .map((doc) => doc.trim())
      .filter((doc) => doc.length > 0);

  /* ---------------- actions ---------------- */

  const resetNewSubcategoryForm = () => {
    setNewSubcategory("");
    setNewSubcategoryDeptCharges("");
    setNewSubcategoryServiceCharges("");
    setNewSubcategoryDocuments("");
  };

  const toggleServiceDetails = (id) => {
    setExpandedService(expandedService === id ? null : id);
    setExpandedSubCategory(null);
    setAddSubFor(null);
    resetNewSubcategoryForm();
  };

  const toggleSubCategory = (id) => {
    setExpandedSubCategory(expandedSubCategory === id ? null : id);
  };

  const handleAddSubcategory = async (serviceId) => {
    if (!newSubcategory.trim()) {
      toast.error("Subcategory name is required.");
      return;
    }

    try {
      await addSubcategory(serviceId, {
        name: newSubcategory,
        department_charges: parseInt(newSubcategoryDeptCharges) || 0,
        service_charges: parseInt(newSubcategoryServiceCharges) || 0,
        requires_wallet: services.find((s) => s.id === serviceId)?.requires_wallet || false,
        requiredDocuments: splitLines(newSubcategoryDocuments),
      });

      await refetchServices();
      resetNewSubcategoryForm();
      setAddSubFor(null);
      toast.success("Subcategory added successfully!");
    } catch (err) {
      console.error("Error adding subcategory:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Failed to add subcategory.");
    }
  };

  const handleDeleteSubcategory = async (serviceId, subId, name) => {
    if (!window.confirm(`Delete the sub-category "${name}"?`)) return;
    try {
      await deleteSubcategory(serviceId, subId);
      await refetchServices();
      toast.success("Subcategory deleted successfully!");
    } catch (err) {
      console.error("Error deleting subcategory:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Failed to delete subcategory.");
    }
  };

  const handleDeleteService = async (service) => {
    if (!window.confirm(`Delete the service "${service.name}" and its sub-categories?`)) return;
    try {
      await deleteService(service.id);
      setServices((prev) => prev.filter((s) => s.id !== service.id));
      toast.success("Service deleted successfully!");
    } catch (err) {
      console.error("Error deleting service:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Failed to delete service.");
    }
  };

  const openAddModal = () => {
    setNewServiceDocuments("");
    setNewServiceRequiresWallet(false);
    setNewServiceRequiresWorkflow(true);
    setNewServiceHasExpiry(false);
    setShowAddModal(true);
  };

  const openEditModal = (service) => {
    setEditingService(service);
    setEditServiceDocuments(service.required_documents?.map((doc) => doc.document_name).join("\n") || "");
    setEditServiceHasExpiry(service.has_expiry || false);
    setEditServiceRequiresWallet(!!service.requires_wallet);
    // only an explicit false means "quick service"
    setEditServiceRequiresWorkflow(service.requires_workflow !== false);
    setShowEditModal(true);
  };

  const openEditSubcategoryModal = (serviceId, subcategory) => {
    setEditingSubcategoryServiceId(serviceId);
    setEditingSubcategory(subcategory);
    setEditSubcategoryName(subcategory.name);
    setEditSubcategoryDeptCharges(subcategory.department_charges);
    setEditSubcategoryServiceCharges(subcategory.service_charges);
    setEditSubcategoryDocuments(subcategory.required_documents?.map((doc) => doc.document_name).join("\n") || "");
    setShowEditSubcategoryModal(true);
  };

  const handleEditSubcategory = async (e) => {
    e.preventDefault();
    if (!editSubcategoryName.trim()) {
      toast.error("Subcategory name is required.");
      return;
    }

    try {
      await updateSubcategory(editingSubcategoryServiceId, editingSubcategory.id, {
        name: editSubcategoryName,
        department_charges: parseInt(editSubcategoryDeptCharges) || 0,
        service_charges: parseInt(editSubcategoryServiceCharges) || 0,
        requires_wallet: services.find((s) => s.id === editingSubcategoryServiceId)?.requires_wallet || false,
        requiredDocuments: splitLines(editSubcategoryDocuments),
      });

      await refetchServices();
      setShowEditSubcategoryModal(false);
      setEditingSubcategory(null);
      toast.success("Subcategory updated successfully!");
    } catch (err) {
      console.error("Error updating subcategory:", err);
      toast.error(err.response?.data?.error || "Failed to update subcategory.");
    }
  };

  const buildServiceData = (formData, { requiresWallet, requiresWorkflow, hasExpiry, documents }) => {
    return {
      name: formData.get("name"),
      description: formData.get("description"),
      website: formData.get("website"),
      status: formData.get("status"),
      department_charges: parseInt(formData.get("departmentCharges")) || 0,
      service_charges: parseInt(formData.get("serviceCharges")) || 0,
      requires_wallet: requiresWallet,
      requires_workflow: requiresWorkflow,
      requiredDocuments: documents,
      has_expiry: hasExpiry,
    };
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
      const serviceData = buildServiceData(formData, {
        requiresWallet: newServiceRequiresWallet,
        requiresWorkflow: newServiceRequiresWorkflow,
        hasExpiry: newServiceHasExpiry,
        documents: splitLines(newServiceDocuments),
      });

      const response = await createService(serviceData);
      setServices((prev) => [...prev, response.data]);
      setShowAddModal(false);
      toast.success("Service added successfully!");
    } catch (err) {
      console.error("Error adding service:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || err.message || "Failed to add service.");
    }
  };

  const handleEditService = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
      const serviceData = buildServiceData(formData, {
        requiresWallet: editServiceRequiresWallet,
        requiresWorkflow: editServiceRequiresWorkflow,
        hasExpiry: editServiceHasExpiry,
        documents: splitLines(editServiceDocuments),
      });

      const response = await updateService(editingService.id, serviceData);
      setServices((prev) => prev.map((s) => (s.id === editingService.id ? response.data : s)));
      setShowEditModal(false);
      setEditingService(null);
      toast.success("Service updated successfully!");
    } catch (err) {
      console.error("Error updating service:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || err.message || "Failed to update service.");
    }
  };

  /* ---------------- render ---------------- */

  const showList = !loading && !loadError;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">Service Management</h1>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-700">Superadmin</span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Services, charges and sub-categories available to all centres
            </p>
          </div>
          <button onClick={openAddModal} className={btnPrimary}>
            <FiPlus className="h-4 w-4" />
            Add service
          </button>
        </div>

        {/* KPI tiles */}
        {showList && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <KpiTile label="Total services" value={counts.all} icon={FiBriefcase} chip="bg-blue-50 text-navy-700" />
            <KpiTile label="Active services" value={counts.active} icon={FiCheckCircle} chip="bg-emerald-50 text-emerald-600" />
            <KpiTile label="Sub-categories" value={counts.subs} icon={FiLayers} chip="bg-amber-50 text-amber-600" />
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search services or sub-categories"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${inputCls} pl-9 pr-9`}
              aria-label="Search services"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <FiX className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="inline-flex shrink-0 overflow-x-auto rounded-lg bg-slate-100 p-0.5" role="tablist">
            {STATUS_TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={statusFilter === t.id}
                onClick={() => setStatusFilter(t.id)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === t.id ? "bg-white text-navy-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
                <span className="ml-1.5 tabular-nums text-slate-400">{counts[t.id]}</span>
              </button>
            ))}
          </div>
          {refreshing && !loading && <FiLoader className="hidden h-4 w-4 shrink-0 animate-spin text-slate-400 sm:block" />}
        </div>

        {/* Load error */}
        {loadError && !loading && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <span className="flex items-center gap-2">
              <FiAlertCircle className="h-4 w-4 shrink-0" />
              {loadError}
            </span>
            <button onClick={() => setReloadKey((k) => k + 1)} className={btnGhost}>
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-lg bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-slate-100" />
                    <div className="h-3 w-1/3 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-14 rounded-lg bg-slate-100" />
                  <div className="h-14 rounded-lg bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Services grid */}
        {showList && filteredServices.length > 0 && (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service) => {
              const isActive = service.status === "active";
              const isQuick = service.requires_workflow === false;
              const open = expandedService === service.id;
              const subs = service.subcategories || [];
              const docs = service.required_documents || [];

              return (
                <div
                  key={service.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="p-4">
                    {/* title row */}
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-navy-700">
                        <FiFileText className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-semibold text-slate-900" title={service.name}>
                          {highlightMatch(service.name)}
                        </h2>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Pill tone={isActive ? "green" : "slate"}>{isActive ? "Active" : "Inactive"}</Pill>
                          {isQuick ? (
                            <Pill icon={FiZap} tone="amber" title="No workflow or tracking">Quick service</Pill>
                          ) : (
                            <Pill icon={FiGitBranch} tone="blue" title="Has tracking and stages">Workflow</Pill>
                          )}
                        </div>
                      </div>
                      {service.website && (
                        <a
                          href={service.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={iconBtn}
                          title="Open official website"
                          aria-label={`Open ${service.name} website`}
                        >
                          <FiExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>

                    <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-slate-600">
                      {highlightMatch(service.description)}
                    </p>

                    {/* charges */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-medium text-slate-500">Dept. charges</p>
                        <p className="text-base font-semibold tabular-nums text-slate-800">
                          {formatCurrency(service.department_charges)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                        <p className="text-[11px] font-medium text-emerald-700">Service charges</p>
                        <p className="text-base font-semibold tabular-nums text-emerald-700">
                          {formatCurrency(service.service_charges)}
                        </p>
                      </div>
                    </div>

                    {/* facts */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Pill icon={FiClock} tone={service.has_expiry ? "blue" : "slate"}>
                        {service.has_expiry ? "Has expiry date" : "No expiry"}
                      </Pill>
                      <Pill icon={FiCreditCard} tone={service.requires_wallet ? "blue" : "slate"}>
                        {service.requires_wallet ? "Wallet required" : "No wallet"}
                      </Pill>
                      <Pill icon={FiLayers}>
                        {subs.length} sub-categor{subs.length === 1 ? "y" : "ies"}
                      </Pill>
                    </div>
                  </div>

                  {/* footer */}
                  <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-3 py-2">
                    <button
                      onClick={() => toggleServiceDetails(service.id)}
                      aria-expanded={open}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-navy-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
                    >
                      {open ? "Hide details" : "View details"}
                      <FiChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    <div className="flex gap-1">
                      <button onClick={() => openEditModal(service)} className={iconBtn} title="Edit service" aria-label={`Edit ${service.name}`}>
                        <FiEdit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteService(service)}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
                        title="Delete service"
                        aria-label={`Delete ${service.name}`}
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* details */}
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-slate-100"
                      >
                        <div className="space-y-5 p-4">
                          {/* required documents */}
                          <section>
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Required documents
                            </h3>
                            {docs.length > 0 ? (
                              <ul className="flex flex-wrap gap-1.5">
                                {docs.map((doc, index) => (
                                  <li
                                    key={index}
                                    className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 ring-1 ring-amber-100"
                                  >
                                    {doc.document_name}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-slate-500">No documents listed.</p>
                            )}
                          </section>

                          {/* sub-categories */}
                          <section>
                            <div className="mb-2 flex items-center justify-between">
                              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Sub-categories <span className="ml-1 font-medium text-slate-400">{subs.length}</span>
                              </h3>
                              {addSubFor !== service.id && (
                                <button
                                  onClick={() => {
                                    resetNewSubcategoryForm();
                                    setAddSubFor(service.id);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:underline"
                                >
                                  <FiPlus className="h-3.5 w-3.5" /> Add
                                </button>
                              )}
                            </div>

                            {subs.length > 0 ? (
                              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                                {subs.map((subCat) => {
                                  const q = searchQuery.trim().toLowerCase();
                                  const isMatch = q && subCat.name?.toLowerCase().includes(q);
                                  const subOpen = expandedSubCategory === subCat.id;
                                  const subDocs = subCat.required_documents || [];
                                  return (
                                    <div
                                      key={subCat.id}
                                      className={`overflow-hidden rounded-lg border bg-white ${
                                        isMatch ? "border-navy-500 ring-1 ring-navy-500/30" : "border-slate-200"
                                      }`}
                                    >
                                      <button
                                        onClick={() => toggleSubCategory(subCat.id)}
                                        aria-expanded={subOpen}
                                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-medium text-slate-900">
                                            {highlightMatch(subCat.name)}
                                          </p>
                                          <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                                            Dept {formatCurrency(subCat.department_charges)} ·{" "}
                                            <span className="font-medium text-emerald-700">
                                              Service {formatCurrency(subCat.service_charges)}
                                            </span>
                                          </p>
                                        </div>
                                        <FiChevronDown
                                          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${subOpen ? "rotate-180" : ""}`}
                                        />
                                      </button>

                                      <AnimatePresence initial={false}>
                                        {subOpen && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                                              {subDocs.length > 0 ? (
                                                <ul className="flex flex-wrap gap-1.5">
                                                  {subDocs.map((doc, index) => (
                                                    <li
                                                      key={index}
                                                      className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                                                    >
                                                      {doc.document_name}
                                                    </li>
                                                  ))}
                                                </ul>
                                              ) : (
                                                <p className="text-xs text-slate-500">No documents listed.</p>
                                              )}
                                              <div className="flex justify-end gap-2">
                                                <button
                                                  onClick={() => openEditSubcategoryModal(service.id, subCat)}
                                                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                                >
                                                  <FiEdit2 className="h-3.5 w-3.5" /> Edit
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteSubcategory(service.id, subCat.id, subCat.name)}
                                                  className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                                                >
                                                  <FiTrash2 className="h-3.5 w-3.5" /> Delete
                                                </button>
                                              </div>
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              addSubFor !== service.id && (
                                <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">
                                  No sub-categories yet.
                                </p>
                              )
                            )}

                            {/* add sub-category */}
                            {addSubFor === service.id && (
                              <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="text-sm font-medium text-slate-800">New sub-category</p>
                                <Field label="Name *">
                                  <input
                                    type="text"
                                    value={newSubcategory}
                                    onChange={(e) => setNewSubcategory(e.target.value)}
                                    placeholder="Sub-category name"
                                    className={inputCls}
                                    autoFocus
                                  />
                                </Field>
                                <div className="grid grid-cols-2 gap-3">
                                  <Field label="Dept. charges (₹)">
                                    <input
                                      type="number"
                                      min="0"
                                      value={newSubcategoryDeptCharges}
                                      onChange={(e) => setNewSubcategoryDeptCharges(e.target.value)}
                                      className={inputCls}
                                    />
                                  </Field>
                                  <Field label="Service charges (₹)">
                                    <input
                                      type="number"
                                      min="0"
                                      value={newSubcategoryServiceCharges}
                                      onChange={(e) => setNewSubcategoryServiceCharges(e.target.value)}
                                      className={inputCls}
                                    />
                                  </Field>
                                </div>
                                <Field label="Required documents" hint="One per line">
                                  <textarea
                                    value={newSubcategoryDocuments}
                                    onChange={(e) => setNewSubcategoryDocuments(e.target.value)}
                                    className={inputCls}
                                    rows={3}
                                  />
                                </Field>
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setAddSubFor(null);
                                      resetNewSubcategoryForm();
                                    }}
                                    className={btnGhost}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleAddSubcategory(service.id)}
                                    disabled={!newSubcategory.trim()}
                                    className={btnPrimary}
                                  >
                                    Add sub-category
                                  </button>
                                </div>
                              </div>
                            )}
                          </section>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {showList && filteredServices.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <FiBriefcase className="h-6 w-6" />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">
              {searchQuery || statusFilter !== "all" ? "No services match" : "No services yet"}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              {searchQuery || statusFilter !== "all"
                ? "Try different keywords or another status filter."
                : "Add your first service to get started."}
            </p>
            {searchQuery || statusFilter !== "all" ? (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className={`${btnGhost} mt-4`}
              >
                Clear filters
              </button>
            ) : (
              <button onClick={openAddModal} className={`${btnPrimary} mt-4`}>
                <FiPlus className="h-4 w-4" /> Add service
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add service */}
      <AnimatePresence>
        {showAddModal && (
          <Modal
            title="Add service"
            subtitle="Added for every centre"
            onClose={() => setShowAddModal(false)}
            onSubmit={handleAddService}
            submitLabel="Add service"
          >
            <Field label="Service name *">
              <input type="text" name="name" className={inputCls} required />
            </Field>
            <Field label="Description *">
              <textarea name="description" className={inputCls} rows={3} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Department charges (₹) *">
                <input type="number" name="departmentCharges" min="0" className={inputCls} required />
              </Field>
              <Field label="Service charges (₹) *">
                <input type="number" name="serviceCharges" min="0" className={inputCls} required />
              </Field>
            </div>
            <Check
              label="Has an expiry date"
              hint="For services that issue something that expires, such as a licence"
              checked={newServiceHasExpiry}
              onChange={(e) => setNewServiceHasExpiry(e.target.checked)}
            />
            <Check
              label="Quick service"
              hint="No workflow or tracking stages"
              checked={!newServiceRequiresWorkflow}
              onChange={(e) => setNewServiceRequiresWorkflow(!e.target.checked)}
            />
            <Check
              label="Requires wallet"
              hint="The service uses a wallet for transactions"
              name="requiresWallet"
              checked={newServiceRequiresWallet}
              onChange={(e) => setNewServiceRequiresWallet(e.target.checked)}
            />
            <Field label="Website *">
              <input type="url" name="website" placeholder="https://" className={inputCls} required />
            </Field>
            <Field label="Status *">
              <select name="status" className={inputCls} required>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Required documents" hint="One per line">
              <textarea
                value={newServiceDocuments}
                onChange={(e) => setNewServiceDocuments(e.target.value)}
                className={inputCls}
                rows={3}
              />
            </Field>
          </Modal>
        )}
      </AnimatePresence>

      {/* Edit service */}
      <AnimatePresence>
        {showEditModal && editingService && (
          <Modal
            title="Edit service"
            subtitle={editingService.name}
            onClose={() => setShowEditModal(false)}
            onSubmit={handleEditService}
            submitLabel="Save changes"
          >
            <Field label="Service name *">
              <input type="text" name="name" defaultValue={editingService.name} className={inputCls} required />
            </Field>
            <Field label="Description *">
              <textarea name="description" defaultValue={editingService.description} className={inputCls} rows={3} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Department charges (₹) *">
                <input
                  type="number"
                  name="departmentCharges"
                  min="0"
                  defaultValue={editingService.department_charges}
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="Service charges (₹) *">
                <input
                  type="number"
                  name="serviceCharges"
                  min="0"
                  defaultValue={editingService.service_charges}
                  className={inputCls}
                  required
                />
              </Field>
            </div>
            <Check
              label="Has an expiry date"
              hint="For services that issue something that expires, such as a licence"
              checked={editServiceHasExpiry}
              onChange={(e) => setEditServiceHasExpiry(e.target.checked)}
            />
            <Check
              label="Quick service"
              hint="No workflow or tracking stages"
              checked={!editServiceRequiresWorkflow}
              onChange={(e) => setEditServiceRequiresWorkflow(!e.target.checked)}
            />
            <Check
              label="Requires wallet"
              hint="The service uses a wallet for transactions"
              name="requiresWallet"
              checked={editServiceRequiresWallet}
              onChange={(e) => setEditServiceRequiresWallet(e.target.checked)}
            />
            <Field label="Website *">
              <input type="url" name="website" defaultValue={editingService.website} className={inputCls} required />
            </Field>
            <Field label="Status *">
              <select name="status" defaultValue={editingService.status} className={inputCls} required>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Required documents" hint="One per line">
              <textarea
                value={editServiceDocuments}
                onChange={(e) => setEditServiceDocuments(e.target.value)}
                className={inputCls}
                rows={3}
              />
            </Field>
          </Modal>
        )}
      </AnimatePresence>

      {/* Edit sub-category */}
      <AnimatePresence>
        {showEditSubcategoryModal && editingSubcategory && (
          <Modal
            title="Edit sub-category"
            subtitle={editingSubcategory.name}
            onClose={() => setShowEditSubcategoryModal(false)}
            onSubmit={handleEditSubcategory}
            submitLabel="Save changes"
          >
            <Field label="Name *">
              <input
                type="text"
                value={editSubcategoryName}
                onChange={(e) => setEditSubcategoryName(e.target.value)}
                className={inputCls}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dept. charges (₹) *">
                <input
                  type="number"
                  min="0"
                  value={editSubcategoryDeptCharges}
                  onChange={(e) => setEditSubcategoryDeptCharges(e.target.value)}
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="Service charges (₹) *">
                <input
                  type="number"
                  min="0"
                  value={editSubcategoryServiceCharges}
                  onChange={(e) => setEditSubcategoryServiceCharges(e.target.value)}
                  className={inputCls}
                  required
                />
              </Field>
            </div>
            <Field label="Required documents" hint="One per line">
              <textarea
                value={editSubcategoryDocuments}
                onChange={(e) => setEditSubcategoryDocuments(e.target.value)}
                className={inputCls}
                rows={3}
              />
            </Field>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ServiceManagementSuperAdmin;