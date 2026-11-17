import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { ArrowLeft } from 'lucide-react';

export const NewRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const { createServiceRequest, currentUser } = useITSM();

  const [catalogType, setCatalogType] = useState<'standard' | 'something_else'>('something_else');
  const [category, setCategory] = useState('peripherals');
  const [catalogItem, setCatalogItem] = useState('');
  const [department, setDepartment] = useState(currentUser.department);
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogItem.trim()) return;

    createServiceRequest({
      catalogItemId: catalogType === 'something_else' ? 'CAT-SOMETHING-ELSE' : `CAT-${Math.floor(100 + Math.random() * 900)}`,
      catalogItemName: catalogType === 'something_else' ? `I Need Something Else: ${catalogItem.trim()}` : catalogItem.trim(),
      description: `[${category.toUpperCase()}] ${description.trim() || 'Service fulfillment request.'}`,
      department: department.trim() || currentUser.department,
      cost
    });

    navigate('/requests');
  };

  return (
    <div className="space-y-5 font-mono text-xs max-w-4xl mx-auto">
      {/* Page Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <Link to="/requests" className="hover:text-neutral-300 transition-colors">SERVICE CATALOG</Link>
            <span>&gt;</span>
            <span className="text-neutral-400 font-bold">NEW REQUEST (sc_req_item.do)</span>
            <span>·</span>
            <span>NJURE TECH</span>
          </div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <span>NEW SERVICE REQUEST FORM</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/requests"
            className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Requests</span>
          </Link>
        </div>
      </div>

      {/* Full Page Dedicated Request Form */}
      <form onSubmit={handleSubmit} className="border border-neutral-800 bg-neutral-950 p-6 space-y-6">
        <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
          <div className="text-xs font-bold text-neutral-200 uppercase">Item Selection & Allocation</div>
          <span className="text-[10px] text-neutral-500 uppercase">SYS_ID: AUTO-GENERATED</span>
        </div>

        {/* Catalogue Type & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Catalogue Channel</label>
            <select
              value={catalogType}
              onChange={e => setCatalogType(e.target.value as 'standard' | 'something_else')}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            >
              <option value="something_else">I Need Something Else (Custom Catalogue)</option>
              <option value="standard">Standard Service Request</option>
            </select>
          </div>
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Item Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none uppercase"
            >
              <option value="peripherals">Peripherals</option>
              <option value="consumables">Consumables</option>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="access">Access / Permissions</option>
              <option value="others">Others</option>
            </select>
          </div>
        </div>

        {/* Requested Item / Service */}
        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">
            {catalogType === 'something_else' ? 'Describe What You Need (I Need Something Else) *' : 'Requested Service or Item *'}
          </label>
          <input
            type="text"
            required
            value={catalogItem}
            onChange={e => setCatalogItem(e.target.value)}
            placeholder="e.g. Ergonomic dock, toner cartridges, software license, special access..."
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
          />
        </div>

        {/* Requester & Department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Requester</label>
            <input
              type="text"
              readOnly
              value={`${currentUser.name} (${currentUser.email})`}
              className="w-full bg-neutral-900/60 border border-neutral-800 text-neutral-300 px-3 py-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1 text-[11px]">Cost Allocation Department *</label>
            <input
              type="text"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            />
          </div>
        </div>

        {/* Cost */}
        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">Budgetary Chargeback Amount ($ USD)</label>
          <input
            type="number"
            value={cost}
            onChange={e => setCost(Number(e.target.value))}
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none tabular-nums"
          />
        </div>

        {/* Justification */}
        <div>
          <label className="text-neutral-400 block mb-1 text-[11px]">Business Justification & Project Code</label>
          <textarea
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="State business need, required software packages, or project charge code..."
            className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none leading-relaxed"
          />
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-800 pt-4">
          <Link
            to="/requests"
            className="px-4 py-2 border border-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors"
          >
            Submit Request
          </button>
        </div>
      </form>
    </div>
  );
};
