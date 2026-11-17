import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { X } from 'lucide-react';

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRequestModal: React.FC<CreateRequestModalProps> = ({ isOpen, onClose }) => {
  const { createServiceRequest, currentUser } = useITSM();

  const [catalogItem, setCatalogItem] = useState('MacBook Pro M3 Max 64GB Hardware Provisioning');
  const [department, setDepartment] = useState(currentUser.department);
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(3400);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogItem.trim()) return;

    createServiceRequest({
      catalogItemId: `CAT-${Math.floor(100 + Math.random() * 900)}`,
      catalogItemName: catalogItem.trim(),
      description: description.trim() || 'Standard enterprise catalog fulfillment request.',
      department: department.trim() || currentUser.department,
      cost
    });

    onClose();
    setDescription('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 p-5 font-mono text-xs max-h-[90vh] overflow-y-auto space-y-4">
        {/* Form Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <div className="text-[10px] text-neutral-500 uppercase">NJURE TECH // TABLE: sc_req_item.do</div>
            <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">New Service Request</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Catalog Item Selection */}
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Catalog Item *</label>
            <select
              value={catalogItem}
              onChange={e => {
                setCatalogItem(e.target.value);
                if (e.target.value.includes('MacBook')) setCost(3400);
                else if (e.target.value.includes('Monitor')) setCost(850);
                else if (e.target.value.includes('YubiKey')) setCost(120);
                else if (e.target.value.includes('AWS')) setCost(0);
                else setCost(500);
              }}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-2 focus:outline-none"
            >
              <option value="MacBook Pro M3 Max 64GB Hardware Provisioning">MacBook Pro M3 Max 64GB ($3,400)</option>
              <option value="Dell UltraSharp 32 4K USB-C Hub Monitor">Dell UltraSharp 32" 4K Monitor ($850)</option>
              <option value="YubiKey 5C NFC Security Key Pair">YubiKey 5C NFC Security Key Pair ($120)</option>
              <option value="AWS Production Environment Access Grant">AWS Production Environment Access ($0)</option>
              <option value="JetBrains All Products License Renewal">JetBrains All Products License ($500)</option>
              <option value="Custom Hardware / Software Request">Custom Hardware / Software Request</option>
            </select>
          </div>

          {/* Requester & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Requester</label>
              <input
                type="text"
                readOnly
                value={`${currentUser.name}`}
                className="w-full bg-neutral-900/60 border border-neutral-800 text-neutral-300 px-2.5 py-1.5 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Department</label>
              <input
                type="text"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
              />
            </div>
          </div>

          {/* Cost Allocation */}
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Chargeback Cost ($ USD)</label>
            <input
              type="number"
              value={cost}
              onChange={e => setCost(Number(e.target.value))}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none tabular-nums"
            />
          </div>

          {/* Business Justification */}
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Business Justification / Specifications</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="State reason for request, project code, or required configurations..."
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
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
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
