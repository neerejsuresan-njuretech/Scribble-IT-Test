import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { SoftwareLicense } from '../../types/itsm';
import { Key, Plus, Minus, Search } from 'lucide-react';

export const SoftwareInventoryPage: React.FC = () => {
  const { activeTenant, softwareLicenses, createSoftwareLicense, adjustSoftwareSeats } = useITSM();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [version, setVersion] = useState('2026.1');
  const [totalSeats, setTotalSeats] = useState(50);
  const [usedSeats, setUsedSeats] = useState(12);
  const [annualCost, setAnnualCost] = useState(4500);
  const [renewalDate, setRenewalDate] = useState('2027-06-01');
  const [source, setSource] = useState<SoftwareLicense['source']>('Intune');

  const filtered = softwareLicenses.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.vendor.toLowerCase().includes(search.toLowerCase())
  );

  const totalAnnualSpend = softwareLicenses.reduce((acc, s) => acc + s.annualCost, 0);
  const complianceAlerts = softwareLicenses.filter(s => s.complianceStatus !== 'compliant').length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createSoftwareLicense({ name, vendor, version, totalSeats, usedSeats, annualCost, renewalDate, source });
    setName('');
    setVendor('');
    setShowForm(false);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · SOFTWARE ASSET MANAGEMENT (SAM)</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <Key className="w-5 h-5 text-rose-500" />
            <span>SOFTWARE & LICENCES</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">
              {softwareLicenses.length} Titles · {activeTenant.currency} {totalAnnualSpend.toLocaleString()}/yr · {complianceAlerts} Alerts
            </span>
          </h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showForm ? 'Cancel' : 'Register Software Licence'}</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 border border-neutral-700 bg-neutral-900/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="sm:col-span-2">
            <label className="block text-neutral-400 mb-1">Software Title *</label>
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Adobe Creative Cloud" className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Vendor</label>
            <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Adobe" className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Discovery Source</label>
            <select value={source} onChange={e => setSource(e.target.value as SoftwareLicense['source'])} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100">
              <option value="Intune">Microsoft Intune</option>
              <option value="PowerShell">PowerShell Endpoint Scan</option>
              <option value="Manual">Manual Entry</option>
            </select>
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Purchased Seats</label>
            <input type="number" min="1" value={totalSeats} onChange={e => setTotalSeats(Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 tabular-nums" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Active Installs</label>
            <input type="number" min="0" value={usedSeats} onChange={e => setUsedSeats(Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 tabular-nums" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Annual Cost ({activeTenant.currency})</label>
            <input type="number" min="0" value={annualCost} onChange={e => setAnnualCost(Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 tabular-nums" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Renewal Date</label>
            <input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button type="submit" className="w-full sm:w-auto min-h-[38px] px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold">Save Licence</button>
          </div>
        </form>
      )}

      <div className="relative max-w-md">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter software or vendor..."
          className="w-full bg-neutral-900 border border-neutral-800 pl-8 pr-3 py-2 text-neutral-200 focus:outline-none"
        />
      </div>

      <div className="border border-neutral-800 bg-neutral-950 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400 uppercase text-[11px]">
              <th className="py-2.5 px-4">ID / Software</th>
              <th className="py-2.5 px-4">Vendor · Source</th>
              <th className="py-2.5 px-4 text-right">Seats Used / Total</th>
              <th className="py-2.5 px-4 text-right">Annual Spend</th>
              <th className="py-2.5 px-4">Renewal</th>
              <th className="py-2.5 px-4">Compliance</th>
              <th className="py-2.5 px-4 text-right">Seat Allocation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900 tabular-nums">
            {filtered.map(sw => (
              <tr key={sw.id} className="hover:bg-neutral-900/40">
                <td className="py-3 px-4">
                  <div className="font-bold text-neutral-100">{sw.name}</div>
                  <div className="text-neutral-500">{sw.id} · v{sw.version}</div>
                </td>
                <td className="py-3 px-4 text-neutral-300">{sw.vendor} · {sw.source}</td>
                <td className="py-3 px-4 text-right font-bold text-neutral-100">
                  {sw.usedSeats} / {sw.totalSeats}
                </td>
                <td className="py-3 px-4 text-right text-neutral-200">{activeTenant.currency} {sw.annualCost.toLocaleString()}</td>
                <td className="py-3 px-4 text-neutral-400">{sw.renewalDate}</td>
                <td className="py-3 px-4">
                  <span className={
                    sw.complianceStatus === 'over_allocated' ? 'text-rose-400 font-bold' :
                    sw.complianceStatus === 'expiring_soon' ? 'text-amber-400 font-bold' :
                    'text-emerald-400'
                  }>
                    {sw.complianceStatus.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button onClick={() => adjustSoftwareSeats(sw.id, -1)} className="p-1 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white" title="Reclaim 1 seat">
                      <Minus className="w-3 h-3" />
                    </button>
                    <button onClick={() => adjustSoftwareSeats(sw.id, 1)} className="p-1 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white" title="Assign 1 seat">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-neutral-500">No software licences recorded for {activeTenant.name}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
