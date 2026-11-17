import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { InventoryItem } from '../../types/itsm';
import { ArrowLeft } from 'lucide-react';

export const NewInventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { createInventoryItem } = useITSM();

  const [name, setName] = useState('');
  const [sku, setSku] = useState(`SKU-${Math.floor(100 + Math.random() * 900)}`);
  const [category, setCategory] = useState<InventoryItem['category']>('components');
  const [quantity, setQuantity] = useState(10);
  const [minThreshold, setMinThreshold] = useState(5);
  const [unitCost, setUnitCost] = useState(85);
  const [location, setLocation] = useState('Storage Bay A-02');

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

    navigate('/inventory');
  };

  return (
    <div className="space-y-5 font-mono text-xs max-w-4xl mx-auto">
      {/* Page Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <Link to="/inventory" className="hover:text-neutral-300 transition-colors">INVENTORY</Link>
            <span>&gt;</span>
            <span className="text-neutral-400 font-bold">NEW SKU (alm_hardware.do)</span>
            <span>·</span>
            <span>NJURE TECH</span>
          </div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <span>NEW INVENTORY SKU FORM</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/inventory"
            className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Inventory</span>
          </Link>
        </div>
      </div>

      {/* Full Page Dedicated Inventory Form */}
      <form onSubmit={handleSubmit} className="border border-neutral-800 bg-neutral-950 p-6 space-y-6">
        <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
          <div className="text-xs font-bold text-neutral-200 uppercase">Stock Logistics & Storage Bin</div>
          <span className="text-[10px] text-neutral-500 uppercase">SYS_ID: AUTO-GENERATED</span>
        </div>

        {/* Row 1: SKU & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">SKU Code *</label>
            <input
              type="text"
              required
              value={sku}
              onChange={e => setSku(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Stock Category *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none uppercase"
            >
              <option value="components">Components</option>
              <option value="cabling">Cabling</option>
              <option value="peripherals">Peripherals</option>
              <option value="storage">Storage</option>
              <option value="accessories">Accessories</option>
            </select>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">Item Description / Part Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. 10GBASE-SR SFP+ 850nm Optical Transceiver Module"
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
          />
        </div>

        {/* Quantities & Pricing */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Initial Stock On-Hand</label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none tabular-nums"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Reorder Alert Threshold</label>
            <input
              type="number"
              value={minThreshold}
              onChange={e => setMinThreshold(Number(e.target.value))}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none tabular-nums"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Unit Replacement Cost ($)</label>
            <input
              type="number"
              value={unitCost}
              onChange={e => setUnitCost(Number(e.target.value))}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none tabular-nums"
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">Warehouse Storage Bin / Shelf Location</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Datacenter Parts Depot - Aisle 2, Bin 14"
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
          />
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-800 pt-4">
          <Link
            to="/inventory"
            className="px-4 py-2 border border-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors"
          >
            Add SKU Item
          </button>
        </div>
      </form>
    </div>
  );
};
