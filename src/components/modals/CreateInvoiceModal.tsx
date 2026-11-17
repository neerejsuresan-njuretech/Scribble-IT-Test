import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { Invoice } from '../../types/itsm';
import { X } from 'lucide-react';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({ isOpen, onClose }) => {
  const { createInvoice } = useITSM();

  const [client, setClient] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(1250);
  const [paymentMethod, setPaymentMethod] = useState<Invoice['paymentMethod']>('stripe');

  if (!isOpen) return null;

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

    onClose();
    setClient('');
    setDescription('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 p-5 font-mono text-xs max-h-[90vh] overflow-y-auto space-y-4">
        {/* Form Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <div className="text-[10px] text-neutral-500 uppercase">NJURE TECH // TABLE: billing_invoice.do</div>
            <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">New Billing Invoice</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Client / Organization *</label>
            <input
              type="text"
              required
              value={client}
              onChange={e => setClient(e.target.value)}
              placeholder="e.g. Apex FinTech Labs"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 focus:outline-none focus:border-neutral-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Invoice Amount ($ USD) *</label>
              <input
                type="number"
                required
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none tabular-nums"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Payment Gateway *</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none uppercase"
              >
                <option value="stripe">Stripe Online</option>
                <option value="credit_card">Credit Card Terminal</option>
                <option value="wire_ach">SWIFT Wire / ACH</option>
                <option value="purchase_order">Corporate PO</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Service Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Monthly Tier-3 NOC Monitoring and SLA coverage"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-neutral-800 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:text-neutral-200 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors"
            >
              Issue Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
