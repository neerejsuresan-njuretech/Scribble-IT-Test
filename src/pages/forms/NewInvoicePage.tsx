import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { Invoice } from '../../types/itsm';
import { ArrowLeft } from 'lucide-react';

export const NewInvoicePage: React.FC = () => {
  const navigate = useNavigate();
  const { createInvoice } = useITSM();

  const [client, setClient] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(1250);
  const [paymentMethod, setPaymentMethod] = useState<Invoice['paymentMethod']>('stripe');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!client.trim()) return;

    createInvoice({
      customerName: client.trim(),
      organization: client.trim(),
      amount,
      status: 'pending',
      paymentMethod,
      dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
      lineItems: [
        {
          description: description.trim() || 'IT Managed Infrastructure & Telephony Support',
          quantity: 1,
          unitPrice: amount
        }
      ]
    });

    navigate('/billing');
  };

  return (
    <div className="space-y-5 font-mono text-xs max-w-4xl mx-auto">
      {/* Page Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <Link to="/billing" className="hover:text-neutral-300 transition-colors">INVOICES & SETTLEMENTS</Link>
            <span>&gt;</span>
            <span className="text-neutral-400 font-bold">NEW INVOICE (billing_invoice.do)</span>
            <span>·</span>
            <span>NJURE TECH</span>
          </div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <span>GENERATE BILLING INVOICE</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/billing"
            className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Invoices</span>
          </Link>
        </div>
      </div>

      {/* Full Page Dedicated Invoice Form */}
      <form onSubmit={handleSubmit} className="border border-neutral-800 bg-neutral-950 p-6 space-y-6">
        <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
          <div className="text-xs font-bold text-neutral-200 uppercase">Client Settlement & Terms</div>
          <span className="text-[10px] text-neutral-500 uppercase">SYS_ID: AUTO-GENERATED</span>
        </div>

        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">Client / Organization Name *</label>
          <input
            type="text"
            required
            value={client}
            onChange={e => setClient(e.target.value)}
            placeholder="e.g. Apex FinTech Labs Europe Ltd"
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Billed Amount ($ USD) *</label>
            <input
              type="number"
              required
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none tabular-nums"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Settlement Gateway *</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as any)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none uppercase"
            >
              <option value="stripe">Stripe Online Payment</option>
              <option value="credit_card">Credit Card Terminal</option>
              <option value="wire_ach">SWIFT Wire / Direct ACH</option>
              <option value="purchase_order">Corporate Purchase Order (NET30)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">Service Description & SLA Coverage Details</label>
          <textarea
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="State service deliverables, Tier-3 monitoring hours, or hardware replacement..."
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none leading-relaxed"
          />
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-800 pt-4">
          <Link
            to="/billing"
            className="px-4 py-2 border border-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors"
          >
            Generate Invoice
          </button>
        </div>
      </form>
    </div>
  );
};
