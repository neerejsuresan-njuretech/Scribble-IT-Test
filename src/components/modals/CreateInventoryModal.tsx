import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { InventoryItem } from '../../types/itsm';
import { X } from 'lucide-react';

interface CreateInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateInventoryModal: React.FC<CreateInventoryModalProps> = ({ isOpen, onClose }) => {
  const { createInventoryItem } = useITSM();

  const [name, setName] = useState('');
  const [sku, setSku] = useState(`SKU-${Math.floor(100 + Math.random() * 900)}`);
  const [category, setCategory] = useState<InventoryItem['category']>('components');
  const [quantity, setQuantity] = useState(10);
  const [minThreshold, setMinThreshold] = useState(5);
  const [unitCost, setUnitCost] = useState(85);
  const [location, setLocation] = useState('Storage Bay A-02');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createInventoryItem({
      name: name.trim(),
      sku: sku.trim(),
      category,
      quantity,
      minThreshold,
      unitCost,
      location: location.trim()
    });

    onClose();
    setName('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 p-5 font-mono text-xs max-h-[90vh] overflow-y-auto space-y-4">
        {/* Form Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <div className="text-[10px] text-neutral-500 uppercase">NJURE TECH // TABLE: alm_hardware.do</div>
            <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">New Inventory Item</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">SKU Code *</label>
              <input
                type="text"
                required
                value={sku}
                onChange={e => setSku(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Category *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
              >
                <option value="components">Components</option>
                <option value="cabling">Cabling</option>
                <option value="peripherals">Peripherals</option>
                <option value="storage">Storage</option>
                <option value="accessories">Accessories</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Item Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. 10GBASE-SR SFP+ Optical Transceiver"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 focus:outline-none focus:border-neutral-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Stock Qty</label>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none tabular-nums"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Min Alert Qty</label>
              <input
                type="number"
                value={minThreshold}
                onChange={e => setMinThreshold(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none tabular-nums"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Unit Cost ($)</label>
              <input
                type="number"
                value={unitCost}
                onChange={e => setUnitCost(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Warehouse Storage Bin</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Rack Bay A-02 Shelf 3"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
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
              Save Inventory Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
