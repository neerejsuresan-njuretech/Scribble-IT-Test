import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { AssetType, AssetStatus } from '../../types/itsm';
import { X } from 'lucide-react';

interface CreateAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateAssetModal: React.FC<CreateAssetModalProps> = ({ isOpen, onClose }) => {
  const { createAsset } = useITSM();

  const [name, setName] = useState('');
  const [assetTag, setAssetTag] = useState(`NJURE-${Math.floor(100 + Math.random() * 900)}`);
  const [type, setType] = useState<AssetType>('laptop');
  const [status, setStatus] = useState<AssetStatus>('in_use');
  const [serialNumber, setSerialNumber] = useState('');
  const [model, setModel] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [purchaseCost, setPurchaseCost] = useState(0);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createAsset({
      name: name.trim(),
      assetTag: assetTag.trim(),
      type,
      status,
      serialNumber: serialNumber.trim() || `SN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      model: model.trim() || 'Enterprise Spec',
      manufacturer: manufacturer.trim(),
      department: department.trim(),
      location: location.trim(),
      purchaseCost,
      currentBookValue: purchaseCost,
      purchaseDate: new Date().toISOString().split('T')[0],
      warrantyExpiry: new Date(Date.now() + 365 * 24 * 3600 * 1000 * 3).toISOString().split('T')[0]
    });

    onClose();
    setName('');
    setModel('');
    setSerialNumber('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-neutral-950 border border-neutral-800 p-5 font-mono text-xs max-h-[90vh] overflow-y-auto space-y-4">
        {/* Form Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <div className="text-[10px] text-neutral-500 uppercase">NJURE TECH // TABLE: cmdb_ci.do</div>
            <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">Register CMDB Asset CI</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Row 1: Tag & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Asset Tag *</label>
              <input
                type="text"
                required
                value={assetTag}
                onChange={e => setAssetTag(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">CI Type *</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as AssetType)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none uppercase"
              >
                <option value="laptop">Laptop</option>
                <option value="workstation">Workstation</option>
                <option value="server">Server</option>
                <option value="networking">Networking Switch</option>
                <option value="monitor">Monitor</option>
                <option value="mobile">Mobile Device</option>
                <option value="security_key">Security Key</option>
                <option value="peripherals">Peripherals</option>
                <option value="consumables">Consumables</option>
                <option value="others">Others</option>
              </select>
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Lifecycle Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as AssetStatus)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none uppercase"
              >
                <option value="in_use">In Use</option>
                <option value="in_stock">In Stock / Pool</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          </div>

          {/* Asset Name */}
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Configuration Item Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Core Switch or Workstation"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 focus:outline-none focus:border-neutral-500"
            />
          </div>

          {/* Manufacturer & Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Manufacturer</label>
              <input
                type="text"
                value={manufacturer}
                onChange={e => setManufacturer(e.target.value)}
                placeholder="e.g. Cisco, Apple, Dell"
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Model / Part Number</label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="e.g. Catalyst 9300 48P"
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
              />
            </div>
          </div>

          {/* Serial Number & Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Serial Number</label>
              <input
                type="text"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                placeholder="e.g. C02G194FL05"
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Purchase Cost ($)</label>
              <input
                type="number"
                value={purchaseCost}
                onChange={e => setPurchaseCost(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none tabular-nums"
              />
            </div>
          </div>

          {/* Department & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Department</label>
              <input
                type="text"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1 text-[11px]">Physical Location</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Datacenter Rack A-04 or London HQ"
                className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-2.5 py-1.5 focus:outline-none"
              />
            </div>
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
              Register Asset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
