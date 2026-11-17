import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { Globe, Plus, ShieldCheck, AlertTriangle } from 'lucide-react';

export const DomainsRegisterPage: React.FC = () => {
  const { activeTenant, domains, createDomainRecord } = useITSM();
  const [showNew, setShowNew] = useState(false);
  const [domain, setDomain] = useState('');
  const [registrar, setRegistrar] = useState('Cloudflare Registrar');
  const [domainExpiry, setDomainExpiry] = useState('2028-01-01');
  const [sslExpiry, setSslExpiry] = useState('2027-03-01');
  const [dmarcPolicy, setDmarcPolicy] = useState<'reject' | 'quarantine' | 'none'>('reject');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;
    createDomainRecord({
      domain: domain.trim().toLowerCase(),
      registrar,
      domainExpiry,
      sslExpiry,
      dmarcPolicy,
      securityGrade: dmarcPolicy === 'reject' ? 'A+' : dmarcPolicy === 'quarantine' ? 'B' : 'D'
    });
    setDomain('');
    setShowNew(false);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · RDAP / DNSSEC / DMARC / SSL REGISTER</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <Globe className="w-5 h-5 text-rose-500" />
            <span>DOMAINS & SSL CERTIFICATES</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">{domains.length} Tracked Domains</span>
          </h1>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 whitespace-nowrap shrink-0">
          <Plus className="w-3.5 h-3.5" />
          <span>Register Domain</span>
        </button>
      </div>

      {showNew && (
        <form onSubmit={handleAdd} className="p-4 border border-neutral-700 bg-neutral-900/50 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-neutral-400 mb-1">FQDN *</label>
            <input required value={domain} onChange={e => setDomain(e.target.value)} placeholder="portal.company.io" className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Registrar</label>
            <input value={registrar} onChange={e => setRegistrar(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Domain Expiry</label>
            <input type="date" value={domainExpiry} onChange={e => setDomainExpiry(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">SSL Expiry</label>
            <input type="date" value={sslExpiry} onChange={e => setSslExpiry(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          </div>
          <div className="flex gap-2">
            <select value={dmarcPolicy} onChange={e => setDmarcPolicy(e.target.value as 'reject' | 'quarantine' | 'none')} className="w-full bg-neutral-950 border border-neutral-700 px-2 py-2 text-neutral-100">
              <option value="reject">DMARC: reject</option>
              <option value="quarantine">DMARC: quarantine</option>
              <option value="none">DMARC: none</option>
            </select>
            <button type="submit" className="px-4 py-2 bg-rose-600 text-white font-bold shrink-0">Add</button>
          </div>
        </form>
      )}

      <div className="border border-neutral-800 bg-neutral-950 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400 uppercase text-[11px]">
              <th className="py-2.5 px-4">Domain / Registrar</th>
              <th className="py-2.5 px-4">Grade</th>
              <th className="py-2.5 px-4">DNSSEC / Lock</th>
              <th className="py-2.5 px-4">SPF · DKIM · DMARC</th>
              <th className="py-2.5 px-4">Domain Expiry</th>
              <th className="py-2.5 px-4">SSL Expiry</th>
              <th className="py-2.5 px-4 text-right">Lookalike Threats</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900 tabular-nums">
            {domains.map(d => (
              <tr key={d.id} className="hover:bg-neutral-900/40">
                <td className="py-3 px-4">
                  <div className="font-bold text-neutral-100">{d.domain}</div>
                  <div className="text-neutral-500">{d.id} · {d.registrar}</div>
                </td>
                <td className="py-3 px-4">
                  <span className={`font-bold text-sm ${d.securityGrade.startsWith('A') ? 'text-emerald-400' : d.securityGrade === 'B' ? 'text-sky-400' : 'text-rose-400'}`}>
                    {d.securityGrade}
                  </span>
                </td>
                <td className="py-3 px-4 text-neutral-300">
                  {d.dnssecEnabled ? 'DNSSEC ON' : 'NO DNSSEC'} · {d.registrarLocked ? 'LOCKED' : 'UNLOCKED'}
                </td>
                <td className="py-3 px-4 text-neutral-300">
                  {d.spfValid ? 'SPF OK' : 'SPF FAIL'} · {d.dkimValid ? 'DKIM OK' : 'NO DKIM'} · {d.dmarcPolicy.toUpperCase()}
                </td>
                <td className="py-3 px-4 text-neutral-400">{d.domainExpiry}</td>
                <td className="py-3 px-4 text-neutral-400">{d.sslExpiry}</td>
                <td className="py-3 px-4 text-right">
                  {d.lookalikeAlerts > 0 ? (
                    <span className="text-rose-400 font-bold inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {d.lookalikeAlerts} Detected
                    </span>
                  ) : (
                    <span className="text-emerald-400 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Clean
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
