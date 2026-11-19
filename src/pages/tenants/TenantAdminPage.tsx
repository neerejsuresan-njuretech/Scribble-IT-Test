import React, { useState, useEffect, useRef } from 'react';
import { useITSM } from '../../context/ITSMContext';
import {
  Building2,
  Plus,
  Check,
  Settings,
  Shield,
  Globe,
  Clock,
  Upload,
  Trash2,
  Palette,
  Cloud,
  CloudOff,
  Layers,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { CustomPortalKey, Tenant } from '../../types/itsm';
import { getDefaultTenantBranding } from '../../data/freeitsmSeedData';
import { processLogoFile } from '../../utils/logoProcessor';

export const TenantAdminPage: React.FC = () => {
  const {
    tenants,
    activeTenant,
    switchTenant,
    createTenant,
    updateTenant,
    updateTenantPortalBranding,
    applyCompanyLogoToAllPortals,
    incidents,
    assets,
    contracts,
    invoices,
    googleUser,
    cloudSyncStatus,
    loginWithGoogle,
    showToast,
  } = useITSM();

  const brandingSectionRef = useRef<HTMLFormElement | null>(null);

  const [showNewForm, setShowNewForm] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [plan, setPlan] = useState<Tenant['plan']>('Enterprise');
  const [region, setRegion] = useState('asia-south1');
  const [currency, setCurrency] = useState<Tenant['currency']>('USD');
  const [timezone, setTimezone] = useState('UTC');
  const [contactEmail, setContactEmail] = useState('');
  const [newTenantLogoUrl, setNewTenantLogoUrl] = useState('');
  const [newTenantLogoProcessing, setNewTenantLogoProcessing] = useState(false);
  const [newTenantLogoError, setNewTenantLogoError] = useState<string | null>(null);

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
  const [customLogoUrl, setCustomLogoUrl] = useState(
    currentPortalBrand.logoDataUrl || brandingTarget.companyLogoDataUrl || ''
  );
  const [logoProcessing, setLogoProcessing] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoMetaText, setLogoMetaText] = useState<string | null>(null);
  const [brandingSavedNotice, setBrandingSavedNotice] = useState(false);

  // Sync active tenant preferences only when switching activeTenant.id
  useEffect(() => {
    setBrandingTenantId(activeTenant.id);
    setDefaultQueue(activeTenant.preferenceTemplate.defaultQueue);
    setPortalBannerTitle(activeTenant.preferenceTemplate.portalBannerTitle);
    setP1Sla(activeTenant.slaTargets.P1);
    setP2Sla(activeTenant.slaTargets.P2);
  }, [activeTenant.id]);

  // Reload branding editor draft ONLY when the user selects another company profile or switches portal tab
  useEffect(() => {
    const t = tenants.find(item => item.id === brandingTenantId) || activeTenant;
    const setObj = t.portalBranding || getDefaultTenantBranding(t.name);
    const cfg = setObj[brandingPortalTab];
    setCustomPortalName(cfg.portalName);
    setCustomSubtitle(cfg.subtitle);
    setCustomLogoUrl(cfg.logoDataUrl || t.companyLogoDataUrl || '');
    setLogoUploadError(null);
    setLogoMetaText(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandingTenantId, brandingPortalTab]);

  const handleNewTenantLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setNewTenantLogoProcessing(true);
    setNewTenantLogoError(null);
    const result = await processLogoFile(file);
    setNewTenantLogoProcessing(false);
    if (!result.ok) {
      setNewTenantLogoError(result.error);
      showToast({ variant: 'error', title: 'Logo Upload Failed', description: result.error });
      return;
    }
    setNewTenantLogoUrl(result.dataUrl);
    showToast({
      variant: 'success',
      title: 'Company Logo Ready',
      description: `Optimized to ${result.width}x${result.height}px (${result.sizeKb} KB).`,
    });
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value immediately so selecting the same or different file across multiple companies always fires onChange
    e.target.value = '';
    if (!file) return;
    setLogoProcessing(true);
    setLogoUploadError(null);
    const result = await processLogoFile(file);
    setLogoProcessing(false);
    if (!result.ok) {
      setLogoUploadError(result.error);
      showToast({ variant: 'error', title: 'Logo Upload Failed', description: result.error });
      return;
    }
    setCustomLogoUrl(result.dataUrl);
    setLogoMetaText(`Optimized ${result.width}×${result.height}px · ${result.sizeKb} KB`);
    showToast({
      variant: 'info',
      title: 'Logo Ready to Save',
      description: `Click "Save ${brandingPortalTab.toUpperCase()} Branding" or "Apply Logo to All 3 Portals" for ${brandingTarget.name}.`,
    });
  };

  const handleSavePortalBranding = (e: React.FormEvent) => {
    e.preventDefault();
    const fallback = getDefaultTenantBranding(brandingTarget.name)[brandingPortalTab];
    updateTenantPortalBranding(brandingTarget.id, brandingPortalTab, {
      portalName: customPortalName.trim() || fallback.portalName,
      subtitle: customSubtitle.trim() || fallback.subtitle,
      logoDataUrl: customLogoUrl,
    });
    setBrandingSavedNotice(true);
    setTimeout(() => setBrandingSavedNotice(false), 3000);
  };

  const handleApplyLogoToAllPortals = () => {
    applyCompanyLogoToAllPortals(brandingTarget.id, customLogoUrl);
    setBrandingSavedNotice(true);
    setTimeout(() => setBrandingSavedNotice(false), 3000);
  };

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const created = createTenant({
      name: name.trim(),
      domain: domain.trim() || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.io`,
      plan,
      region,
      currency,
      timezone,
      primaryContactEmail: contactEmail.trim() || `ops@${domain.trim() || 'tenant.io'}`,
      companyLogoDataUrl: newTenantLogoUrl,
    });
    setBrandingTenantId(created.id);
    setName('');
    setDomain('');
    setContactEmail('');
    setNewTenantLogoUrl('');
    setNewTenantLogoError(null);
    setShowNewForm(false);
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenant(activeTenant.id, {
      slaTargets: { ...activeTenant.slaTargets, P1: Number(p1Sla), P2: Number(p2Sla) },
      preferenceTemplate: {
        ...activeTenant.preferenceTemplate,
        defaultQueue,
        portalBannerTitle,
      },
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const openBrandingForTenant = (tenantId: string) => {
    setBrandingTenantId(tenantId);
    brandingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getTenantDisplayLogo = (t: Tenant): string =>
    t.companyLogoDataUrl ||
    t.portalBranding?.employees?.logoDataUrl ||
    t.portalBranding?.enduser?.logoDataUrl ||
    t.portalBranding?.iam?.logoDataUrl ||
    '';

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">MULTI-TENANT ARCHITECTURE · ISOLATED DATA PARTITIONS</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex flex-wrap items-center gap-3">
            <span>TENANT DIRECTORY &amp; COMPANY BRANDING</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">{tenants.length} Active Orgs</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {googleUser ? (
            <div className="px-3 py-1.5 border border-emerald-800/70 bg-emerald-950/30 text-emerald-300 flex items-center gap-2 text-[11px]">
              <Cloud className="w-3.5 h-3.5 shrink-0" />
              <span>
                {cloudSyncStatus === 'syncing'
                  ? 'Syncing to Cloud DB...'
                  : cloudSyncStatus === 'error'
                  ? 'Cloud Sync Warning'
                  : 'Cloud DB Synced'}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void loginWithGoogle()}
              className="px-3 py-2 border border-amber-700/70 bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 font-bold flex items-center gap-2 text-[11px]"
              title="Sign in with Google to persist all company profiles, logos, incidents, and settings across devices"
            >
              <CloudOff className="w-3.5 h-3.5 shrink-0" />
              <span>Local Only · Connect Cloud DB</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowNewForm(!showNewForm)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showNewForm ? 'Cancel' : 'Provision New Tenant'}</span>
          </button>
        </div>
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

          {/* Optional Initial Company Logo Upload */}
          <div className="pt-2 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {newTenantLogoUrl ? (
                <img
                  src={newTenantLogoUrl}
                  alt="New Company Logo Preview"
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 object-contain border border-neutral-700 bg-neutral-950 p-1"
                />
              ) : (
                <div className="w-10 h-10 border border-dashed border-neutral-700 bg-neutral-950 flex items-center justify-center text-neutral-500">
                  <Building2 className="w-4 h-4" />
                </div>
              )}
              <div className="space-y-1">
                <div className="text-neutral-300 font-bold">Company Logo (Optional · Applied to All 3 Portals)</div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 border border-neutral-700 bg-neutral-950 hover:bg-neutral-800 text-neutral-200 font-bold cursor-pointer flex items-center gap-1.5">
                    {newTenantLogoProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{newTenantLogoProcessing ? 'Optimizing...' : 'Upload Company Logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleNewTenantLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {newTenantLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setNewTenantLogoUrl('')}
                      className="px-2.5 py-1.5 border border-neutral-800 text-neutral-400 hover:text-rose-400 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
                {newTenantLogoError && (
                  <div className="text-rose-400 flex items-center gap-1 text-[11px]">
                    <AlertCircle className="w-3 h-3" />
                    <span>{newTenantLogoError}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={newTenantLogoProcessing}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold"
            >
              Create &amp; Switch Tenant
            </button>
          </div>
        </form>
      )}

      {/* Tenant Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tenants.map(t => {
          const isCurrent = t.id === activeTenant.id;
          const enabledCount = Object.values(t.enabledModules).filter(Boolean).length;
          const logoUrl = getTenantDisplayLogo(t);
          return (
            <div
              key={t.id}
              className={`p-5 border transition-colors flex flex-col justify-between gap-4 ${
                isCurrent
                  ? 'border-rose-600/80 bg-neutral-900/60'
                  : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">{t.slug}</span>
                  <span className={isCurrent ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
                    {isCurrent ? 'ACTIVE CONTEXT' : t.plan}
                  </span>
                </div>
                <div className="text-base font-bold text-neutral-100 flex items-center gap-2.5">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={t.name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 object-contain border border-neutral-800 bg-neutral-900 p-0.5 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 border border-neutral-800 bg-neutral-900 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-neutral-400" />
                    </div>
                  )}
                  <span className="truncate">{t.name}</span>
                </div>
                <div className="text-neutral-400 flex items-center gap-2 text-[11px]">
                  <Globe className="w-3 h-3 text-neutral-500 shrink-0" />
                  <span className="truncate">{t.domain}</span>
                  <span>·</span>
                  <span>{t.region}</span>
                  <span>·</span>
                  <span>{t.currency}</span>
                </div>
                <div className="pt-2 border-t border-neutral-800/80 grid grid-cols-2 gap-2 text-[11px] text-neutral-400 tabular-nums">
                  <div>Modules: {enabledCount}/31</div>
                  <div>P1 SLA: {t.slaTargets.P1}h</div>
                  <div className="truncate">Code: {t.companyCode || t.slug.toUpperCase()}</div>
                  <div>Logo: {logoUrl ? 'Configured' : 'Default'}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => switchTenant(t.id)}
                  disabled={isCurrent}
                  className={`flex-1 py-2 text-center font-bold border transition-colors ${
                    isCurrent
                      ? 'border-neutral-700 bg-neutral-800 text-neutral-400 cursor-default'
                      : 'border-neutral-700 bg-neutral-900 text-neutral-100 hover:border-rose-500 hover:text-white'
                  }`}
                >
                  {isCurrent ? 'Mounted in Workspace' : 'Switch to Tenant'}
                </button>
                <button
                  type="button"
                  onClick={() => openBrandingForTenant(t.id)}
                  className="px-3 py-2 border border-neutral-700 bg-neutral-900 hover:border-rose-500 text-neutral-300 hover:text-white flex items-center gap-1.5"
                  title={`Customize logo and portals for ${t.name}`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Logo</span>
                </button>
              </div>
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
            <span className="text-neutral-500 truncate max-w-[140px]">{activeTenant.id}</span>
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
              <span>PREFERENCE TEMPLATE &amp; SLA POLICY ({activeTenant.name})</span>
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
      <form
        ref={brandingSectionRef}
        onSubmit={handleSavePortalBranding}
        className="border border-neutral-800 bg-neutral-950 p-5 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <div>
            <div className="font-bold text-neutral-100 flex items-center gap-2 uppercase tracking-wider">
              <Palette className="w-4 h-4 text-rose-500" />
              <span>PER-COMPANY PORTAL BRANDING &amp; LOGO CUSTOMIZATION</span>
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              Upload high-res logos (auto-optimized for fast multi-company cloud sync) per company profile and apply across all 3 portals or customize each portal independently.
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="text-neutral-500 uppercase text-[10px]">Company:</label>
            <select
              value={brandingTarget.id}
              onChange={e => setBrandingTenantId(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-neutral-100 font-bold"
            >
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.companyCode || t.slug})
                </option>
              ))}
            </select>
            {brandingSavedNotice && (
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>
        </div>

        {/* Portal Target Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 border border-neutral-800 bg-neutral-900/40 p-1 w-fit">
            {[
              { id: 'employees', label: 'Employees IT Portal' },
              { id: 'enduser', label: 'End-User Portal' },
              { id: 'iam', label: 'IAM Portal' },
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
          <div className="text-[11px] text-neutral-400">
            Editing profile: <span className="text-neutral-100 font-bold">{brandingTarget.name}</span>
          </div>
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
              <label className="block text-neutral-400 mb-1.5">
                Company / Portal Logo Upload (PNG, SVG, JPG, WebP up to 5 MB · Auto-Optimized)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="px-3.5 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-bold cursor-pointer flex items-center gap-2">
                  {logoProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{logoProcessing ? 'Optimizing Image...' : 'Upload Logo File'}</span>
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
                    onClick={() => {
                      setCustomLogoUrl('');
                      setLogoMetaText(null);
                    }}
                    className="px-3 py-2 border border-neutral-800 text-neutral-400 hover:text-rose-400 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Logo</span>
                  </button>
                )}
              </div>
              {logoMetaText && (
                <div className="text-[11px] text-emerald-400 mt-1.5">{logoMetaText}</div>
              )}
              {logoUploadError && (
                <div className="text-[11px] text-rose-400 mt-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{logoUploadError}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              <button
                type="submit"
                disabled={logoProcessing}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold"
              >
                Save {brandingPortalTab.toUpperCase()} Portal Branding
              </button>
              <button
                type="button"
                disabled={logoProcessing}
                onClick={handleApplyLogoToAllPortals}
                className="px-4 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 font-bold flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Apply Logo to All 3 Portals ({brandingTarget.name})</span>
              </button>
            </div>
          </div>

          {/* Live Brand Preview */}
          <div className="lg:col-span-5 border border-neutral-800 bg-neutral-900/30 p-4 space-y-4">
            <div className="text-[10px] text-neutral-500 uppercase font-bold flex items-center justify-between">
              <span>Live Portal Header &amp; Footer Preview</span>
              <span>{brandingTarget.companyCode || brandingTarget.slug}</span>
            </div>
            <div className="border border-neutral-800 bg-neutral-950 p-3 flex items-center gap-3">
              {customLogoUrl ? (
                <img
                  src={customLogoUrl}
                  alt={customPortalName}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 object-contain border border-neutral-800 bg-neutral-900 p-0.5 shrink-0"
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
            <div className="text-[10px] text-neutral-500 border-t border-neutral-800 pt-2.5 space-y-1">
              <div>
                Employees Logo: <span className="text-neutral-300">{activeBrandingSet.employees?.logoDataUrl ? 'Custom' : brandingTarget.companyLogoDataUrl ? 'Company Default' : 'None'}</span>
              </div>
              <div>
                End-User Logo: <span className="text-neutral-300">{activeBrandingSet.enduser?.logoDataUrl ? 'Custom' : brandingTarget.companyLogoDataUrl ? 'Company Default' : 'None'}</span>
              </div>
              <div>
                IAM Logo: <span className="text-neutral-300">{activeBrandingSet.iam?.logoDataUrl ? 'Custom' : brandingTarget.companyLogoDataUrl ? 'Company Default' : 'None'}</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
