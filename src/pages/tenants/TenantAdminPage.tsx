import React, { useState, useEffect } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { Building2, Plus, Check, Settings, Shield, Globe, Clock, Upload, Trash2, Palette } from 'lucide-react';
import { CustomPortalKey, Tenant } from '../../types/itsm';
import { getDefaultTenantBranding } from '../../data/freeitsmSeedData';

export const TenantAdminPage: React.FC = () => {
  const {
    tenants, activeTenant, switchTenant, createTenant, updateTenant,
    updateTenantPortalBranding, incidents, assets, contracts, invoices
  } = useITSM();

  const [showNewForm, setShowNewForm] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [plan, setPlan] = useState<Tenant['plan']>('Enterprise');
  const [region, setRegion] = useState('asia-south1');
  const [currency, setCurrency] = useState<Tenant['currency']>('USD');
  const [timezone, setTimezone] = useState('UTC');
  const [contactEmail, setContactEmail] = useState('');

  // Preference template edit state for active tenant
  const [defaultQueue, setDefaultQueue] = useState(activeTenant.preferenceTemplate.defaultQueue);
  const [portalBannerTitle, setPortalBannerTitle] = useState(activeTenant.preferenceTemplate.portalBannerTitle);
  const [p1Sla, setP1Sla] = useState(activeTenant.slaTargets.P1);
  const [p2Sla, setP2Sla] = useState(activeTenant.slaTargets.P2);
  const [savedNotice, setSavedNotice] = useState(false);

  // Per-Tenant Portal Customization (Employees, End-User, IAM)
  const [brandingTenantId, setBrandingTenantId] = useState(activeTenant.id);
  const [brandingPortalTab, setBrandingPortalTab] = useState<CustomPortalKey>('employees');
  const brandingTarget = tenants.find(t => t.id === brandingTenantId) || activeTenant;
  const activeBrandingSet = brandingTarget.portalBranding || getDefaultTenantBranding(brandingTarget.name);
  const currentPortalBrand = activeBrandingSet[brandingPortalTab];

  const [customPortalName, setCustomPortalName] = useState(currentPortalBrand.portalName);
  const [customSubtitle, setCustomSubtitle] = useState(currentPortalBrand.subtitle);
  const [customLogoUrl, setCustomLogoUrl] = useState(currentPortalBrand.logoDataUrl || '');
  const [brandingSavedNotice, setBrandingSavedNotice] = useState(false);

  useEffect(() => {
    setBrandingTenantId(activeTenant.id);
    setDefaultQueue(activeTenant.preferenceTemplate.defaultQueue);
    setPortalBannerTitle(activeTenant.preferenceTemplate.portalBannerTitle);
    setP1Sla(activeTenant.slaTargets.P1);
    setP2Sla(activeTenant.slaTargets.P2);
  }, [activeTenant.id]);

  useEffect(() => {
    const t = tenants.find(item => item.id === brandingTenantId) || activeTenant;
    const setObj = t.portalBranding || getDefaultTenantBranding(t.name);
    const cfg = setObj[brandingPortalTab];
    setCustomPortalName(cfg.portalName);
    setCustomSubtitle(cfg.subtitle);
    setCustomLogoUrl(cfg.logoDataUrl || '');
  }, [brandingTenantId, brandingPortalTab, tenants]);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePortalBranding = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenantPortalBranding(brandingTarget.id, brandingPortalTab, {
      portalName: customPortalName.trim() || getDefaultTenantBranding(brandingTarget.name)[brandingPortalTab].portalName,
      subtitle: customSubtitle.trim() || getDefaultTenantBranding(brandingTarget.name)[brandingPortalTab].subtitle,
      logoDataUrl: customLogoUrl
    });
    setBrandingSavedNotice(true);
    setTimeout(() => setBrandingSavedNotice(false), 3000);
  };

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createTenant({
      name: name.trim(),
      domain: domain.trim() || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.io`,
      plan,
      region,
      currency,
      timezone,
      primaryContactEmail: contactEmail.trim() || `ops@${domain.trim() || 'tenant.io'}`
    });
    setName('');
    setDomain('');
    setContactEmail('');
    setShowNewForm(false);
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenant(activeTenant.id, {
      slaTargets: { ...activeTenant.slaTargets, P1: Number(p1Sla), P2: Number(p2Sla) },
      preferenceTemplate: {
        ...activeTenant.preferenceTemplate,
        defaultQueue,
        portalBannerTitle
      }
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">MULTI-TENANT ARCHITECTURE · ISOLATED DATA PARTITIONS</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <span>TENANT DIRECTORY & ISOLATION</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">{tenants.length} Active Orgs</span>
          </h1>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showNewForm ? 'Cancel' : 'Provision New Tenant'}</span>
        </button>
      </div>

      {/* Provision Tenant Form */}
      {showNewForm && (
        <form onSubmit={handleCreateTenant} className="p-5 border border-neutral-700 bg-neutral-900/50 space-y-4">
          <div className="font-bold text-neutral-200 uppercase tracking-wider">Provision Isolated Tenant Workspace</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-neutral-400 mb-1">Organization Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Orion Logistics EU"
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:border-neutral-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">Primary Domain</label>
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="orionlogistics.eu"
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:border-neutral-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="ops@orionlogistics.eu"
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:border-neutral-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">Tenant Tier</label>
              <select
                value={plan}
                onChange={e => setPlan(e.target.value as Tenant['plan'])}
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none"
              >
                <option value="Enterprise">Enterprise</option>
                <option value="Dedicated">Dedicated</option>
                <option value="Managed MSP">Managed MSP</option>
              </select>
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">Cloud Region</label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none"
              >
                <option value="asia-south1">asia-south1 (Mumbai)</option>
                <option value="eu-west2">eu-west2 (London)</option>
                <option value="us-east1">us-east1 (Virginia)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-neutral-400 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value as Tenant['currency'])}
                  className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none"
                >
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Timezone</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold">
              Create & Switch Tenant
            </button>
          </div>
        </form>
      )}

      {/* Tenant Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tenants.map(t => {
          const isCurrent = t.id === activeTenant.id;
          const enabledCount = Object.values(t.enabledModules).filter(Boolean).length;
          return (
            <div
              key={t.id}
              className={`p-5 border transition-colors flex flex-col justify-between gap-4 ${
                isCurrent
                  ? 'border-rose-600/80 bg-neutral-900/60'
                  : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">{t.slug}</span>
                  <span className={isCurrent ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
                    {isCurrent ? 'ACTIVE CONTEXT' : t.plan}
                  </span>
                </div>
                <div className="text-base font-bold text-neutral-100 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-neutral-400 shrink-0" />
                  <span className="truncate">{t.name}</span>
                </div>
                <div className="text-neutral-400 flex items-center gap-2 text-[11px]">
                  <Globe className="w-3 h-3 text-neutral-500" />
                  <span>{t.domain}</span>
                  <span>·</span>
                  <span>{t.region}</span>
                  <span>·</span>
                  <span>{t.currency}</span>
                </div>
                <div className="pt-2 border-t border-neutral-800/80 grid grid-cols-2 gap-2 text-[11px] text-neutral-400 tabular-nums">
                  <div>Modules: {enabledCount}/31</div>
                  <div>P1 SLA: {t.slaTargets.P1}h</div>
                  <div>Company: {t.companyCode || t.slug.toUpperCase()}</div>
                  <div>Format: {t.preferenceTemplate.dateFormat}</div>
                </div>
              </div>

              <button
                onClick={() => switchTenant(t.id)}
                disabled={isCurrent}
                className={`w-full py-2 text-center font-bold border transition-colors ${
                  isCurrent
                    ? 'border-neutral-700 bg-neutral-800 text-neutral-400 cursor-default'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-100 hover:border-rose-500 hover:text-white'
                }`}
              >
                {isCurrent ? 'Mounted in Workspace' : 'Switch to Tenant'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Active Tenant Partition Telemetry & Preference Template */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 border border-neutral-800 bg-neutral-900/30 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="font-bold text-neutral-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>ACTIVE PARTITION SCOPE</span>
            </span>
            <span className="text-neutral-500">{activeTenant.id}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 tabular-nums">
            <div className="p-3 border border-neutral-800 bg-neutral-950">
              <div className="text-neutral-500">TENANT INCIDENTS</div>
              <div className="text-2xl font-bold text-neutral-100 mt-1">{incidents.length}</div>
            </div>
            <div className="p-3 border border-neutral-800 bg-neutral-950">
              <div className="text-neutral-500">CMDB ASSETS</div>
              <div className="text-2xl font-bold text-neutral-100 mt-1">{assets.length}</div>
            </div>
            <div className="p-3 border border-neutral-800 bg-neutral-950">
              <div className="text-neutral-500">ACTIVE CONTRACTS</div>
              <div className="text-2xl font-bold text-neutral-100 mt-1">{contracts.length}</div>
            </div>
            <div className="p-3 border border-neutral-800 bg-neutral-950">
              <div className="text-neutral-500">TENANT INVOICES</div>
              <div className="text-2xl font-bold text-neutral-100 mt-1">{invoices.length}</div>
            </div>
          </div>
        </div>

        {/* FreeITSM Preference Template Editor */}
        <form onSubmit={handleSavePreferences} className="lg:col-span-7 border border-neutral-800 bg-neutral-900/30 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="font-bold text-neutral-200 flex items-center gap-2">
              <Settings className="w-4 h-4 text-neutral-400" />
              <span>PREFERENCE TEMPLATE & SLA POLICY ({activeTenant.name})</span>
            </span>
            {savedNotice && <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-neutral-400 mb-1">Default Triage Assignment Group</label>
              <input
                type="text"
                value={defaultQueue}
                onChange={e => setDefaultQueue(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">Self-Service Portal Heading</label>
              <input
                type="text"
                value={portalBannerTitle}
                onChange={e => setPortalBannerTitle(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">P1 SLA Target (Hours)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={p1Sla}
                onChange={e => setP1Sla(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none tabular-nums"
              />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">P2 SLA Target (Hours)</label>
              <input
                type="number"
                min="1"
                value={p2Sla}
                onChange={e => setP2Sla(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-neutral-500 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Changes apply immediately across {activeTenant.domain}</span>
            </div>
            <button type="submit" className="px-4 py-2 bg-neutral-100 text-neutral-950 hover:bg-white font-bold">
              Apply Template
            </button>
          </div>
        </form>
      </div>

      {/* Super Admin: Per-Tenant Portal Customization (Employees, End-User, IAM) */}
      <form onSubmit={handleSavePortalBranding} className="border border-neutral-800 bg-neutral-950 p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <div>
            <div className="font-bold text-neutral-100 flex items-center gap-2 uppercase tracking-wider">
              <Palette className="w-4 h-4 text-rose-500" />
              <span>PER-TENANT PORTAL BRANDING &amp; LOGO CUSTOMIZATION</span>
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              Customize portal name and upload logo per tenant for Employees, End-User, and IAM portals. Bottom footer retains Powered by Scribble IT.
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={brandingTenantId}
              onChange={e => setBrandingTenantId(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-neutral-100"
            >
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.companyCode || t.slug})</option>
              ))}
            </select>
            {brandingSavedNotice && (
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <Check className="w-3.5 h-3.5" /> Updated
              </span>
            )}
          </div>
        </div>

        {/* Portal Target Tabs */}
        <div className="flex flex-wrap items-center gap-1 border border-neutral-800 bg-neutral-900/40 p-1 w-fit">
          {[
            { id: 'employees', label: 'Employees IT Portal' },
            { id: 'enduser', label: 'End-User Portal' },
            { id: 'iam', label: 'IAM Portal' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setBrandingPortalTab(tab.id as CustomPortalKey)}
              className={`px-3.5 py-1.5 text-xs font-bold transition-colors ${
                brandingPortalTab === tab.id
                  ? 'bg-rose-600 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div>
              <label className="block text-neutral-400 mb-1">Custom Portal Name *</label>
              <input
                type="text"
                required
                value={customPortalName}
                onChange={e => setCustomPortalName(e.target.value)}
                placeholder="e.g. Acme Corp Employee Hub"
                className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Portal Subtitle / Header Line</label>
              <input
                type="text"
                value={customSubtitle}
                onChange={e => setCustomSubtitle(e.target.value)}
                placeholder="e.g. Enterprise Service Desk"
                className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1.5">Custom Portal Logo Upload (PNG / SVG / JPG)</label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="px-3.5 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-bold cursor-pointer flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Logo File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileUpload}
                    className="hidden"
                  />
                </label>
                {customLogoUrl && (
                  <button
                    type="button"
                    onClick={() => setCustomLogoUrl('')}
                    className="px-3 py-2 border border-neutral-800 text-neutral-400 hover:text-rose-400 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Logo</span>
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold">
                Save {brandingPortalTab.toUpperCase()} Portal Branding
              </button>
            </div>
          </div>

          {/* Live Brand Preview */}
          <div className="lg:col-span-5 border border-neutral-800 bg-neutral-900/30 p-4 space-y-4">
            <div className="text-[10px] text-neutral-500 uppercase font-bold">
              Live Portal Header &amp; Footer Preview
            </div>
            <div className="border border-neutral-800 bg-neutral-950 p-3 flex items-center gap-3">
              {customLogoUrl ? (
                <img
                  src={customLogoUrl}
                  alt={customPortalName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 object-contain border border-neutral-800 bg-neutral-900 p-0.5 shrink-0"
                />
              ) : (
                <span className="w-3 h-3 bg-rose-600 inline-block shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-bold text-neutral-100 truncate">{customPortalName || 'SCRIBBLE IT'}</div>
                <div className="text-[10px] text-neutral-500 truncate">{customSubtitle}</div>
              </div>
            </div>
            <div className="border border-neutral-800 bg-neutral-950 px-3 py-2 flex items-center justify-between text-[10px] text-neutral-500">
              <span className="truncate">{customPortalName}</span>
              <span className="text-neutral-300 font-bold shrink-0">Powered by Scribble IT</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
