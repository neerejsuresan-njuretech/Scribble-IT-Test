import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { AssetType, AssetStatus } from '../../types/itsm';
import { ArrowLeft } from 'lucide-react';

export const NewAssetPage: React.FC = () => {
  const navigate = useNavigate();
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

    navigate('/assets');
  };

  return (
    <div className="space-y-5 font-mono text-xs max-w-4xl mx-auto">
      {/* Page Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <Link to="/assets" className="hover:text-neutral-300 transition-colors">CMDB ASSETS</Link>
            <span>&gt;</span>
            <span className="text-neutral-400 font-bold">REGISTER CI (cmdb_ci.do)</span>
            <span>·</span>
            <span>NJURE TECH</span>
          </div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <span>REGISTER CMDB CONFIGURATION ITEM</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/assets"
            className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Assets</span>
          </Link>
        </div>
      </div>

      {/* Full Page Dedicated Asset Form */}
      <form onSubmit={handleSubmit} className="border border-neutral-800 bg-neutral-950 p-6 space-y-6">
        <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
          <div className="text-xs font-bold text-neutral-200 uppercase">Hardware & Lifecycle Specifications</div>
          <span className="text-[10px] text-neutral-500 uppercase">SYS_ID: AUTO-GENERATED</span>
        </div>

        {/* Row 1: Tag, Type, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Asset Tag / Barcode *</label>
            <input
              type="text"
              required
              value={assetTag}
              onChange={e => setAssetTag(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">CI Type *</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as AssetType)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none uppercase"
            >
              <option value="laptop">Laptop / Notebook</option>
              <option value="workstation">Desktop Workstation</option>
              <option value="server">Server Rack Unit</option>
              <option value="networking">Network Switch / Router</option>
              <option value="monitor">External Monitor</option>
              <option value="mobile">Mobile Device</option>
              <option value="security_key">Security Key (FIDO2)</option>
              <option value="peripherals">Peripherals (Mouse, Keyboard, Dock)</option>
              <option value="consumables">Consumables (Toner, Cables, Adapters)</option>
              <option value="others">Others</option>
            </select>
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Operational Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as AssetStatus)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none uppercase"
            >
              <option value="in_use">In Use / Deployed</option>
              <option value="in_stock">In Stock / Pool</option>
              <option value="maintenance">Under Maintenance</option>
              <option value="retired">Decommissioned / Retired</option>
            </select>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">Configuration Item Display Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Core Switch or Workstation"
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
          />
        </div>

        {/* Manufacturer & Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Manufacturer</label>
            <input
              type="text"
              value={manufacturer}
              onChange={e => setManufacturer(e.target.value)}
              placeholder="e.g. Cisco Systems, Apple, Dell"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Model / Part Number</label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="e.g. Catalyst 9300 48-Port PoE+"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            />
          </div>
        </div>

        {/* Serial Number & Cost */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Serial Number (Chassis S/N)</label>
            <input
              type="text"
              value={serialNumber}
              onChange={e => setSerialNumber(e.target.value)}
              placeholder="e.g. FOC2419X01L"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Purchase Cost ($ USD)</label>
            <input
              type="number"
              value={purchaseCost}
              onChange={e => setPurchaseCost(Number(e.target.value))}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none tabular-nums"
            />
          </div>
        </div>

        {/* Department & Physical Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Assigned Department</label>
            <input
              type="text"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Physical Data Center / Office Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Datacenter Floor 1, Rack A-04"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-800 pt-4">
          <Link
            to="/assets"
            className="px-4 py-2 border border-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors"
          >
            Register Asset
          </button>
        </div>
      </form>
    </div>
  );
};
