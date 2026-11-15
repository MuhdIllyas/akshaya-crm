import React, { useEffect, useState } from 'react';
import { FiUserPlus, FiX, FiAlertCircle, FiInfo } from 'react-icons/fi';
import { createCustomer } from '@/services/customerService';

const FIELD =
  'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-navy-500/40 focus:outline-none focus:ring-2 focus:ring-navy-500/30 disabled:bg-slate-50 sm:text-sm';
const LABEL = 'mb-1.5 block text-sm font-medium text-slate-700';

const EMPTY = { name: '', phone: '', aadhaar: '', email: '', address: '', pincode: '', district: '', state: 'Kerala' };

const digits = (v, max) => String(v || '').replace(/\D/g, '').slice(0, max);
// 1234 5678 9012 while typing
const groupAadhaar = (v) => digits(v, 12).replace(/(\d{4})(?=\d)/g, '$1 ');

/**
 * Staff registers a customer at the counter.
 * onCreated({ id, name, existing }) is called after a successful save, or when
 * the Aadhaar already belongs to a customer (existing: true).
 */
export default function NewCustomerModal({ open, onClose, onCreated, onOpenCustomer }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null); // { message, id? }

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const phoneOk = digits(form.phone, 10).length === 10;
  const aadhaarOk = digits(form.aadhaar, 12).length === 12;
  const canSave = form.name.trim().length >= 2 && phoneOk && aadhaarOk && !saving;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await createCustomer({
        ...form,
        phone: digits(form.phone, 10),
        aadhaar: digits(form.aadhaar, 12),
        pincode: digits(form.pincode, 6),
      });
      onCreated?.(res.data);
    } catch (err) {
      setError({
        message: err.response?.data?.message || 'Could not save the customer. Please try again.',
        id: err.response?.data?.id,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-700 text-white">
            <FiUserPlus className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900 sm:text-lg">New customer</h3>
            <p className="text-xs text-slate-500 sm:text-sm">Register a customer at the counter</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p>{error.message}</p>
                  {error.id && onOpenCustomer && (
                    <button
                      type="button"
                      onClick={() => onOpenCustomer(error.id)}
                      className="mt-1 font-medium text-navy-700 underline underline-offset-2"
                    >
                      Open that customer
                    </button>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className={LABEL} htmlFor="nc-name">Full name <span className="text-rose-500">*</span></label>
              <input id="nc-name" className={FIELD} value={form.name} onChange={set('name')} placeholder="As on Aadhaar" autoFocus disabled={saving} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="nc-phone">Phone <span className="text-rose-500">*</span></label>
                <input
                  id="nc-phone"
                  className={FIELD}
                  inputMode="numeric"
                  value={digits(form.phone, 10)}
                  onChange={set('phone')}
                  placeholder="10-digit mobile"
                  disabled={saving}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="nc-aadhaar">Aadhaar number <span className="text-rose-500">*</span></label>
                <input
                  id="nc-aadhaar"
                  className={FIELD}
                  inputMode="numeric"
                  autoComplete="off"
                  value={groupAadhaar(form.aadhaar)}
                  onChange={set('aadhaar')}
                  placeholder="12 digits"
                  disabled={saving}
                />
              </div>
            </div>

            <div>
              <label className={LABEL} htmlFor="nc-email">Email <span className="font-normal text-slate-400">(optional)</span></label>
              <input id="nc-email" type="email" className={FIELD} value={form.email} onChange={set('email')} placeholder="name@example.com" disabled={saving} />
            </div>

            <div>
              <label className={LABEL} htmlFor="nc-address">Address <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea
                id="nc-address"
                rows={2}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-navy-500/40 focus:outline-none focus:ring-2 focus:ring-navy-500/30 disabled:bg-slate-50 sm:text-sm"
                value={form.address}
                onChange={set('address')}
                disabled={saving}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="nc-pincode">Pincode</label>
                <input id="nc-pincode" className={FIELD} inputMode="numeric" value={digits(form.pincode, 6)} onChange={set('pincode')} disabled={saving} />
              </div>
              <div>
                <label className={LABEL} htmlFor="nc-district">District</label>
                <input id="nc-district" className={FIELD} value={form.district} onChange={set('district')} disabled={saving} />
              </div>
              <div>
                <label className={LABEL} htmlFor="nc-state">State</label>
                <input id="nc-state" className={FIELD} value={form.state} onChange={set('state')} disabled={saving} />
              </div>
            </div>

            <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <FiInfo className="mt-0.5 h-4 w-4 shrink-0 text-navy-700" />
              Only the last 4 digits of the Aadhaar are shown anywhere. The customer can sign in to the portal later with
              this phone number (OTP). Earlier walk-in applications with this Aadhaar are added to their profile.
            </p>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-700 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiUserPlus className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
