import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { Invoice } from '../../types/itsm';
import { MinimalStatus, DotMatrixText } from '../common/DotMatrixDisplay';
import { CreditCard, DollarSign, Plus, CheckCircle2, FileText, Printer, Shield } from 'lucide-react';

export const BillingModule: React.FC = () => {
  const { invoices, payInvoice, createInvoice, role, currentUser } = useITSM();
  const [selectedId, setSelectedId] = useState<string>(invoices[0]?.id || '');
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<Invoice['paymentMethod']>('credit_card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInv, setNewInv] = useState({
    customerName: '',
    customerEmail: '',
    organization: '',
    amount: 500,
    lineDesc: 'Professional IT Services (Tier 3)',
    hours: 2,
    rate: 250
  });

  const selectedInvoice = invoices.find(inv => inv.id === selectedId) || invoices[0];

  const handlePay = () => {
    if (!selectedInvoice) return;
    setIsProcessing(true);
    setTimeout(() => {
      payInvoice(selectedInvoice.id, selectedPaymentMethod);
      setIsProcessing(false);
      setShowCheckout(false);
    }, 900);
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    createInvoice({
      customerName: newInv.customerName || currentUser.name,
      customerEmail: newInv.customerEmail || currentUser.email,
      organization: newInv.organization || 'Corporate Client',
      amount: newInv.hours * newInv.rate,
      lineItems: [
        {
          description: newInv.lineDesc,
          quantity: newInv.hours,
          unitPrice: newInv.rate
        }
      ]
    });
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-xs font-mono text-neutral-400">FINANCIAL MANAGEMENT // INVOICES & MSP BILLING</div>
          <h1 className="text-xl font-bold font-mono text-neutral-100 flex items-center gap-3">
            <span>INVOICE & PAYMENT GATEWAY</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">({invoices.length} Invoices)</span>
          </h1>
        </div>
        {role === 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-xs font-mono tracking-wider bg-rose-600 text-white hover:bg-rose-500 transition-colors flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate Invoice</span>
          </button>
        )}
      </div>

      {/* Grid: Invoice List & Detailed Printable Receipt */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List */}
        <div className="lg:col-span-5 border border-neutral-800 divide-y divide-neutral-800 bg-neutral-950 max-h-[750px] overflow-y-auto">
          {invoices.map(inv => {
            const isSelected = selectedInvoice?.id === inv.id;
            return (
              <div
                key={inv.id}
                onClick={() => setSelectedId(inv.id)}
                className={`p-4 transition-colors cursor-pointer space-y-2 ${
                  isSelected ? 'bg-neutral-900 border-l-2 border-l-rose-500' : 'hover:bg-neutral-900/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-neutral-200">{inv.id}</span>
                  <MinimalStatus
                    status={inv.status}
                    variant={inv.status === 'paid' ? 'emerald' : inv.status === 'pending' ? 'amber' : 'red'}
                  />
                </div>

                <div className="text-xs font-medium text-neutral-200 line-clamp-1">
                  {inv.organization}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 pt-1">
                  <span>{inv.customerName}</span>
                  <span className="tabular-nums font-bold text-neutral-200 text-sm">
                    ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Detail: Dot Matrix Printable Invoice Preview */}
        {selectedInvoice ? (
          <div className="lg:col-span-7 border border-neutral-800 bg-neutral-950 p-6 space-y-6 font-mono text-xs">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
              <div className="space-y-1">
                <div className="text-base font-bold text-neutral-100">{selectedInvoice.id}</div>
                <div className="text-neutral-400">Issue Date: {selectedInvoice.issueDate} · Due: {selectedInvoice.dueDate}</div>
              </div>

              <div className="flex items-center gap-3">
                {selectedInvoice.status !== 'paid' ? (
                  <button
                    onClick={() => setShowCheckout(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-wider transition-colors flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pay Now (${selectedInvoice.amount.toFixed(2)})</span>
                  </button>
                ) : (
                  <div className="px-3 py-1.5 border border-emerald-800 bg-emerald-950/30 text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>PAID ON {selectedInvoice.paidAt ? new Date(selectedInvoice.paidAt).toLocaleDateString() : 'RECORD'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bill To & Issuer Details */}
            <div className="grid grid-cols-2 gap-4 border-b border-neutral-800 pb-4">
              <div className="space-y-1">
                <span className="text-neutral-500 uppercase text-[10px]">ISSUED BY</span>
                <div className="font-bold text-neutral-200">NJURE TECH LTD</div>
                <div className="text-neutral-400">Enterprise Managed Services</div>
                <div className="text-neutral-500">VAT ID: GB 902 481 22</div>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-500 uppercase text-[10px]">BILLED TO</span>
                <div className="font-bold text-neutral-200">{selectedInvoice.customerName}</div>
                <div className="text-neutral-400">{selectedInvoice.organization}</div>
                <div className="text-neutral-500">{selectedInvoice.customerEmail}</div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2">
              <div className="text-neutral-400 uppercase text-[10px]">LINE ITEMS</div>
              <div className="border border-neutral-800 divide-y divide-neutral-800">
                <div className="p-2.5 bg-neutral-900/40 text-neutral-400 grid grid-cols-12 text-[11px] uppercase">
                  <div className="col-span-7">Description</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-3 text-right">Price</div>
                </div>
                {selectedInvoice.lineItems.map((item, idx) => (
                  <div key={idx} className="p-2.5 grid grid-cols-12 text-neutral-200">
                    <div className="col-span-7">{item.description}</div>
                    <div className="col-span-2 text-center tabular-nums">{item.quantity}</div>
                    <div className="col-span-3 text-right tabular-nums">${(item.quantity * item.unitPrice).toFixed(2)}</div>
                  </div>
                ))}
              </div>

              {/* Total Row */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1 text-right">
                  <div className="flex justify-between text-neutral-400">
                    <span>Subtotal</span>
                    <span className="tabular-nums">${selectedInvoice.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Applicable Tax (0%)</span>
                    <span className="tabular-nums">$0.00</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-neutral-100 border-t border-neutral-800 pt-1">
                    <span>Total Due</span>
                    <span className="tabular-nums">${selectedInvoice.amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dot-matrix printed receipt footer */}
            <div className="p-4 border border-dashed border-neutral-800 bg-neutral-900/10 space-y-2 text-[11px] text-neutral-500">
              <div className="flex justify-between">
                <span>SCRIBBLE IT // PAYMENT RECEIPT ENGINE</span>
                <span>SECURE CRYPTO SIGNED</span>
              </div>
              <div>{selectedInvoice.notes}</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Checkout Modal Simulation */}
      {showCheckout && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 p-6 space-y-5 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-neutral-100">PAYMENT CHECKOUT</div>
                <div className="text-neutral-500">Invoice {selectedInvoice.id} · ${selectedInvoice.amount.toFixed(2)}</div>
              </div>
              <button onClick={() => setShowCheckout(false)} className="text-neutral-500 hover:text-neutral-200">
                ✕
              </button>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-neutral-400 block uppercase">Select Payment Channel</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'credit_card', label: 'Card' },
                  { id: 'wire_ach', label: 'Wire / ACH' },
                  { id: 'purchase_order', label: 'Internal PO' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedPaymentMethod(m.id as any)}
                    className={`p-2.5 border text-center transition-colors ${
                      selectedPaymentMethod === m.id ? 'border-neutral-300 bg-neutral-900 text-white font-bold' : 'border-neutral-800 text-neutral-400 hover:bg-neutral-900'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment form mock input */}
            <div className="space-y-3 p-3 bg-neutral-900/40 border border-neutral-800/80">
              {selectedPaymentMethod === 'credit_card' ? (
                <>
                  <div>
                    <label className="text-neutral-500 block mb-1">Card Number</label>
                    <input
                      type="text"
                      readOnly
                      value="•••• •••• •••• 4242"
                      className="w-full bg-neutral-900 border border-neutral-700 text-neutral-300 px-3 py-1.5 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-neutral-500 block mb-1">Expiry</label>
                      <input
                        type="text"
                        readOnly
                        value="12 / 28"
                        className="w-full bg-neutral-900 border border-neutral-700 text-neutral-300 px-3 py-1.5 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-neutral-500 block mb-1">CVC</label>
                      <input
                        type="text"
                        readOnly
                        value="•••"
                        className="w-full bg-neutral-900 border border-neutral-700 text-neutral-300 px-3 py-1.5 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              ) : selectedPaymentMethod === 'wire_ach' ? (
                <div className="space-y-1 text-neutral-400">
                  <div>Routing Number: <span className="text-neutral-200">021000021</span></div>
                  <div>Account Number: <span className="text-neutral-200">9912048128</span></div>
                  <div>Bank: <span className="text-neutral-200">Silicon Valley B2B Clearing</span></div>
                </div>
              ) : (
                <div>
                  <label className="text-neutral-500 block mb-1">Purchase Order (PO) Number</label>
                  <input
                    type="text"
                    defaultValue="PO-2024-9104"
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-300 px-3 py-1.5 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>TLS 1.3 / 256-Bit Encrypted Payment Authorization</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                className="px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handlePay}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition-colors"
              >
                {isProcessing ? 'Processing Transaction...' : `Confirm Payment ($${selectedInvoice.amount.toFixed(2)})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 p-6 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <span className="text-sm font-bold text-neutral-100 uppercase">Generate MSP Support Invoice</span>
              <button onClick={() => setShowCreateModal(false)} className="text-neutral-500 hover:text-neutral-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-3">
              <div>
                <label className="text-neutral-400 block mb-1">Client Organization</label>
                <input
                  type="text"
                  required
                  value={newInv.organization}
                  onChange={e => setNewInv({ ...newInv, organization: e.target.value })}
                  placeholder="e.g. Acme Corp Infrastructure"
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={newInv.customerName}
                    onChange={e => setNewInv({ ...newInv, customerName: e.target.value })}
                    placeholder="e.g. Alex Mercer"
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={newInv.customerEmail}
                    onChange={e => setNewInv({ ...newInv, customerEmail: e.target.value })}
                    placeholder="alex@acmecorp.com"
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Service Description</label>
                <input
                  type="text"
                  value={newInv.lineDesc}
                  onChange={e => setNewInv({ ...newInv, lineDesc: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Billable Hours / Units</label>
                  <input
                    type="number"
                    min="1"
                    value={newInv.hours}
                    onChange={e => setNewInv({ ...newInv, hours: parseInt(e.target.value) || 1 })}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Hourly Rate ($)</label>
                  <input
                    type="number"
                    min="1"
                    value={newInv.rate}
                    onChange={e => setNewInv({ ...newInv, rate: parseFloat(e.target.value) || 150 })}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  />
                </div>
              </div>

              <div className="text-right text-neutral-300 font-bold">
                Total Amount: ${(newInv.hours * newInv.rate).toFixed(2)}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  Create Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
