import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { ContractRecord } from '../../types/itsm';
import { FileSpreadsheet, Plus, Sparkles } from 'lucide-react';

export const ContractsRfpPage: React.FC = () => {
  const { activeTenant, contracts, assets, createContract, updateContractStatus } = useITSM();
  const [tab, setTab] = useState<'contracts' | 'rfp'>('contracts');
  const [showNew, setShowNew] = useState(false);

  const [title, setTitle] = useState('');
  const [vendor, setVendor] = useState('');
  const [type, setType] = useState<ContractRecord['type']>('software');
  const [annualValue, setAnnualValue] = useState(12000);
  const [renewalDate, setRenewalDate] = useState('2027-05-01');
  const [rfpNotes, setRfpNotes] = useState('');

  // RFP Builder state
  const [rfpTitle, setRfpTitle] = useState('Enterprise Endpoint & Network Support Renewal RFP');
  const [rfpBudgetCap, setRfpBudgetCap] = useState(25000);
  const [rfpRequirements, setRfpRequirements] = useState('1. 24/7 P1 1-hour SLA response\n2. ISO 27001 & SOC2 Type II attested\n3. Multi-tenant API webhook export');
  const [rfpPublished, setRfpPublished] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createContract({ title, vendor, type, annualValue, renewalDate, rfpNotes });
    setTitle('');
    setVendor('');
    setRfpNotes('');
    setShowNew(false);
  };

  const totalCommit = contracts.reduce((acc, c) => acc + c.annualValue, 0);

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · VENDOR CONTRACTS & RFP PROCUREMENT</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-rose-500" />
            <span>CONTRACTS & RFP BUILDER</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">
              {contracts.length} Contracts · {activeTenant.currency} {totalCommit.toLocaleString()}/yr
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-neutral-800 bg-neutral-900/60 p-0.5">
            <button onClick={() => setTab('contracts')} className={`min-h-[36px] px-3 py-1.5 whitespace-nowrap ${tab === 'contracts' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400'}`}>Contracts Register</button>
            <button onClick={() => setTab('rfp')} className={`min-h-[36px] px-3 py-1.5 whitespace-nowrap ${tab === 'rfp' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400'}`}>RFP Builder</button>
          </div>
          {tab === 'contracts' && (
            <button onClick={() => setShowNew(!showNew)} className="min-h-[38px] px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Contract</span>
            </button>
          )}
        </div>
      </div>

      {tab === 'contracts' && (
        <>
          {showNew && (
            <form onSubmit={handleAdd} className="p-4 sm:p-5 border border-neutral-700 bg-neutral-900/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="sm:col-span-2">
                <label className="block text-neutral-400 mb-1">Contract Title *</label>
                <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Cloudflare Enterprise DNS & WAF" className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Vendor</label>
                <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Cloudflare" className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Category</label>
                <select value={type} onChange={e => setType(e.target.value as ContractRecord['type'])} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100">
                  <option value="hardware">Hardware</option>
                  <option value="software">Software</option>
                  <option value="telecom_sim">Telecom / SIM / Router</option>
                  <option value="cloud">Cloud</option>
                  <option value="support">Support</option>
                </select>
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Annual Value ({activeTenant.currency})</label>
                <input type="number" value={annualValue} onChange={e => setAnnualValue(Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 tabular-nums" />
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Renewal Date</label>
                <input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <input value={rfpNotes} onChange={e => setRfpNotes(e.target.value)} placeholder="RFP / Renewal notes..." className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
                <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold shrink-0">Save</button>
              </div>
            </form>
          )}

          <div className="border border-neutral-800 bg-neutral-950 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400 uppercase text-[11px]">
                  <th className="py-2.5 px-4">Contract / Vendor</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-right">Annual Value</th>
                  <th className="py-2.5 px-4">Renewal · Notice</th>
                  <th className="py-2.5 px-4">Linked Assets</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900 tabular-nums">
                {contracts.map(c => (
                  <tr key={c.id} className="hover:bg-neutral-900/40">
                    <td className="py-3 px-4">
                      <div className="font-bold text-neutral-100">{c.title}</div>
                      <div className="text-neutral-500">{c.id} · {c.vendor}</div>
                    </td>
                    <td className="py-3 px-4 text-neutral-300 uppercase">{c.type.replace('_', ' ')}</td>
                    <td className="py-3 px-4 text-right font-bold text-neutral-100">{activeTenant.currency} {c.annualValue.toLocaleString()}</td>
                    <td className="py-3 px-4 text-neutral-400">{c.renewalDate} · {c.noticeDays}d notice</td>
                    <td className="py-3 px-4 text-neutral-400">
                      {c.linkedAssetIds.length > 0 ? c.linkedAssetIds.map(id => assets.find(a => a.id === id)?.assetTag || id).join(', ') : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={c.status === 'expiring_soon' ? 'text-amber-400 font-bold' : c.status === 'rfp_open' ? 'text-sky-400 font-bold' : 'text-emerald-400'}>
                        {c.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => updateContractStatus(c.id, c.status === 'rfp_open' ? 'active' : 'rfp_open')}
                        className="px-2.5 py-1 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white"
                      >
                        {c.status === 'rfp_open' ? 'Close RFP' : 'Open RFP'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'rfp' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 border border-neutral-800 bg-neutral-900/30 p-5 space-y-4">
            <div className="font-bold text-neutral-200 border-b border-neutral-800 pb-2">RFP TENDER SPECIFICATION BUILDER</div>
            <div>
              <label className="block text-neutral-400 mb-1">RFP Title</label>
              <input value={rfpTitle} onChange={e => setRfpTitle(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">Annual Budget Ceiling ({activeTenant.currency})</label>
              <input type="number" value={rfpBudgetCap} onChange={e => setRfpBudgetCap(Number(e.target.value))} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 tabular-nums" />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">Mandatory Technical & SLA Requirements</label>
              <textarea rows={5} value={rfpRequirements} onChange={e => setRfpRequirements(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
            </div>
            <button
              onClick={() => {
                createContract({ title: `RFP: ${rfpTitle}`, vendor: 'Open Vendor Tender', type: 'support', annualValue: rfpBudgetCap, status: 'rfp_open', rfpNotes: rfpRequirements });
                setRfpPublished(true);
                setTimeout(() => setRfpPublished(false), 3000);
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Publish RFP to Contracts Queue</span>
            </button>
            {rfpPublished && <div className="text-emerald-400">RFP logged in Contracts Register under status RFP_OPEN.</div>}
          </div>

          <div className="lg:col-span-6 border border-neutral-800 bg-neutral-950 p-6 space-y-4">
            <div className="text-neutral-500 uppercase">GENERATED RFP PREVIEW · {activeTenant.name}</div>
            <h3 className="text-base font-bold text-neutral-100">{rfpTitle}</h3>
            <div className="text-neutral-400 tabular-nums">Target Budget Cap: {activeTenant.currency} {rfpBudgetCap.toLocaleString()} / annum · Region: {activeTenant.region}</div>
            <pre className="whitespace-pre-wrap p-4 border border-neutral-800 bg-neutral-900/40 text-neutral-200 leading-relaxed">{rfpRequirements}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
