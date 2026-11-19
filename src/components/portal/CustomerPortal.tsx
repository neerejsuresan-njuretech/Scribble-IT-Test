import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { CustomFormDefinition } from '../../types/itsm';
import { DotMatrixText, MinimalStatus } from '../common/DotMatrixDisplay';
import {
  Search, Plus, ArrowRight,
  CheckCircle2, Activity, BookOpen, FormInput
} from 'lucide-react';

interface CustomerPortalProps {
  onOpenNewTicket?: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ onOpenNewTicket }) => {
  const navigate = useNavigate();
  const {
    currentUser, requests, incidents, assets, invoices,
    createServiceRequest, activeTenant, statusComponents,
    kbArticles, customForms, submitCustomFormToRequest,
    isModuleEnabled, getPortalBranding
  } = useITSM();
  const endUserBrand = getPortalBranding('enduser');

  const [searchQuery, setSearchQuery] = useState('');
  const [orderedItemNotice, setOrderedItemNotice] = useState<string | null>(null);
  const [showSomethingElse, setShowSomethingElse] = useState(false);
  const [somethingElseTitle, setSomethingElseTitle] = useState('');
  const [somethingElseCategory, setSomethingElseCategory] = useState('others');
  const [somethingElseDetails, setSomethingElseDetails] = useState('');
  const [somethingElseCost, setSomethingElseCost] = useState(0);

  // Interactive Custom Form modal/inline state
  const [activeCustomForm, setActiveCustomForm] = useState<CustomFormDefinition | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const currencySymbol = activeTenant.currency === 'GBP' ? '£' : activeTenant.currency === 'EUR' ? '€' : '$';

  const myIncidents = incidents.filter(i => i.requesterEmail === currentUser.email || i.requesterName === currentUser.name);
  const myRequests = requests.filter(r => r.requesterEmail === currentUser.email || r.requesterName === currentUser.name);
  const myAssets = assets.filter(a => a.assignedTo === currentUser.name);
  const myInvoices = invoices.filter(inv => inv.customerEmail === currentUser.email || inv.customerName === currentUser.name);

  const publishedForms = customForms.filter(f =>
    f.publishedToPortal &&
    (!searchQuery ||
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const publicKb = kbArticles
    .filter(k => k.visibility === 'public')
    .filter(k =>
      !searchQuery ||
      k.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleOpenCustomForm = (form: CustomFormDefinition) => {
    const defaults: Record<string, string> = {};
    form.fields.forEach(f => {
      defaults[f.id] = f.type === 'select' && f.options?.length ? f.options[0] : '';
    });
    setFormValues(defaults);
    setActiveCustomForm(form);
  };

  const handleSubmitCustomForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomForm) return;
    const req = submitCustomFormToRequest(activeCustomForm.id, formValues);
    setOrderedItemNotice(`Form "${activeCustomForm.title}" submitted as ${req.id}.`);
    setActiveCustomForm(null);
    setTimeout(() => setOrderedItemNotice(null), 4000);
  };

  const handleSubmitSomethingElse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!somethingElseTitle.trim()) return;
    const req = createServiceRequest({
      catalogItemId: 'CAT-SOMETHING-ELSE',
      catalogItemName: `I Need Something Else: ${somethingElseTitle.trim()}`,
      description: `[Category: ${somethingElseCategory.toUpperCase()}] ${somethingElseDetails.trim() || 'Custom self-service request submitted via I Need Something Else catalogue.'}`,
      cost: somethingElseCost,
      deliveryEstimateDays: 3
    });
    setOrderedItemNotice(`Request ${req.id} submitted via "I Need Something Else" catalogue.`);
    setSomethingElseTitle('');
    setSomethingElseDetails('');
    setSomethingElseCost(0);
    setShowSomethingElse(false);
    setTimeout(() => setOrderedItemNotice(null), 4500);
  };

  const degradedCount = statusComponents.filter(c => c.status !== 'operational').length;

  return (
    <div className="space-y-8 font-mono">
      {/* Top Banner / User Welcome */}
      <div className="p-4 sm:p-6 border border-neutral-800 bg-neutral-900/30 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          {endUserBrand.logoDataUrl && (
            <img
              src={endUserBrand.logoDataUrl}
              alt={endUserBrand.portalName}
              referrerPolicy="no-referrer"
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain border border-neutral-800 bg-neutral-950 p-1 shrink-0"
            />
          )}
          <div className="space-y-1.5 sm:space-y-2 min-w-0 flex-1">
            <div className="text-[11px] sm:text-xs text-neutral-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-bold text-neutral-200">{activeTenant.name.toUpperCase()}</span>
              <span aria-hidden="true">·</span>
              <span>{endUserBrand.subtitle}</span>
              <span aria-hidden="true">·</span>
              <span className="text-neutral-200">{currentUser.name}</span>
            </div>
            <div className="max-w-full">
              <DotMatrixText text={endUserBrand.portalName.toUpperCase()} size="md" />
            </div>
            <div className="text-xs text-neutral-400 leading-relaxed">
              {activeTenant.preferenceTemplate.portalBannerTitle}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
          {isModuleEnabled('status_page') && (
            <button
              onClick={() => navigate('/status')}
              className="w-full sm:w-auto min-h-[40px] px-3.5 py-2 text-xs border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Activity className={`w-3.5 h-3.5 shrink-0 ${degradedCount > 0 ? 'text-amber-400' : statusComponents.length === 0 ? 'text-neutral-500' : 'text-emerald-400'}`} />
              <span>
                {statusComponents.length === 0
                  ? 'Service Status'
                  : degradedCount > 0
                  ? `${degradedCount} Service Alert(s)`
                  : 'All Systems Operational'}
              </span>
            </button>
          )}
          <button
            onClick={() => onOpenNewTicket ? onOpenNewTicket() : navigate('/portal/new')}
            className="w-full sm:w-auto min-h-[40px] px-4 py-2 text-xs font-mono tracking-wider bg-rose-600 text-white hover:bg-rose-500 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Report Incident</span>
          </button>
        </div>
      </div>

      {orderedItemNotice && (
        <div className="p-3 border border-emerald-800 bg-emerald-950/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{orderedItemNotice}</span>
        </div>
      )}

      {/* Quick Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search service catalog, custom forms, or knowledge articles..."
          className="w-full bg-neutral-900/80 border border-neutral-800 text-neutral-200 pl-10 pr-4 py-3 text-xs focus:border-neutral-600 focus:outline-none"
        />
      </div>

      {/* Published Custom Intake Forms (FreeITSM Custom Forms) */}
      {isModuleEnabled('custom_forms') && publishedForms.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-xs">
            <span className="font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              <FormInput className="w-3.5 h-3.5 text-rose-500" />
              <span>Custom Tenant Intake Forms</span>
            </span>
            <span className="text-neutral-500 tabular-nums">{publishedForms.length} Published</span>
          </div>

          {activeCustomForm ? (
            <form onSubmit={handleSubmitCustomForm} className="border border-neutral-700 bg-neutral-950 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div>
                  <div className="font-bold text-neutral-100 text-sm">{activeCustomForm.title}</div>
                  <div className="text-[11px] text-neutral-500 uppercase">{activeCustomForm.category}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCustomForm(null)}
                  className="px-2.5 py-1 border border-neutral-700 text-neutral-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeCustomForm.fields.map(field => (
                  <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <label className="text-[11px] text-neutral-400 block mb-1">
                      {field.label} {field.required && <span className="text-rose-500">*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={formValues[field.id] || ''}
                        onChange={e => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                        required={field.required}
                        className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-xs text-neutral-200 focus:outline-none"
                      >
                        {(field.options || []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        value={formValues[field.id] || ''}
                        onChange={e => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                        required={field.required}
                        className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-xs text-neutral-200 focus:outline-none"
                      />
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 text-xs text-neutral-300">
                        <input
                          type="checkbox"
                          checked={formValues[field.id] === 'true'}
                          onChange={e => setFormValues(prev => ({ ...prev, [field.id]: e.target.checked ? 'true' : 'false' }))}
                          className="accent-rose-600"
                        />
                        <span>Confirm</span>
                      </label>
                    ) : (
                      <input
                        type={field.type}
                        value={formValues[field.id] || ''}
                        onChange={e => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                        required={field.required}
                        className="w-full bg-neutral-900 border border-neutral-700 px-2.5 py-2 text-xs text-neutral-200 focus:outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                >
                  Submit Intake Request
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {publishedForms.map(form => (
                <div key={form.id} className="p-4 border border-neutral-800 bg-neutral-950 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[10px] text-neutral-500 uppercase">{form.category}</div>
                    <div className="text-sm font-bold text-neutral-100 mt-1">{form.title}</div>
                    <div className="text-[11px] text-neutral-400 mt-1">{form.fields.length} schema fields</div>
                  </div>
                  <button
                    onClick={() => handleOpenCustomForm(form)}
                    className="w-full py-1.5 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs flex items-center justify-center gap-1"
                  >
                    <span>Launch Form</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Service Catalog: "I Need Something Else" & Request Intake */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-xs">
          <span className="font-bold text-neutral-200 uppercase tracking-wider">Service Catalog</span>
          <button
            onClick={() => navigate('/requests/new')}
            className="text-neutral-400 hover:text-neutral-100 text-[11px] flex items-center gap-1"
          >
            <span>Full Request Form</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 border border-neutral-800 bg-neutral-950 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-[10px] text-rose-400 uppercase tracking-wider font-bold">Custom Catalogue</div>
              <div className="text-sm font-bold text-neutral-100">I Need Something Else</div>
              <div className="text-[11px] text-neutral-400">
                Request any unlisted hardware, peripherals, consumables, software, or special access for {activeTenant.name}.
              </div>
            </div>
            <div>
              <button
                onClick={() => setShowSomethingElse(!showSomethingElse)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showSomethingElse ? 'Close Request Form' : 'Open "I Need Something Else"'}</span>
              </button>
            </div>
          </div>

          <div className="p-5 border border-neutral-800 bg-neutral-950 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Standard Intake</div>
              <div className="text-sm font-bold text-neutral-100">Service Requests & Access Provisioning</div>
              <div className="text-[11px] text-neutral-400">
                Submit structured requests routed through manager, security, and fulfillment stages.
              </div>
            </div>
            <div>
              <button
                onClick={() => navigate('/requests/new')}
                className="px-4 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Service Request</span>
              </button>
            </div>
          </div>
        </div>

        {showSomethingElse && (
          <form onSubmit={handleSubmitSomethingElse} className="border border-neutral-700 bg-neutral-950 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="font-bold text-neutral-100 text-xs uppercase">I Need Something Else · Custom Catalogue Request</div>
              <button type="button" onClick={() => setShowSomethingElse(false)} className="text-neutral-400 hover:text-white text-xs">
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-neutral-400 mb-1">What do you need? *</label>
                <input
                  type="text"
                  required
                  value={somethingElseTitle}
                  onChange={e => setSomethingElseTitle(e.target.value)}
                  placeholder="Describe the unlisted hardware, consumable, software, or access..."
                  className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">Category</label>
                <select
                  value={somethingElseCategory}
                  onChange={e => setSomethingElseCategory(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-neutral-100 focus:outline-none uppercase"
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-neutral-400 mb-1">Business Justification & Specifications</label>
                <textarea
                  rows={2}
                  value={somethingElseDetails}
                  onChange={e => setSomethingElseDetails(e.target.value)}
                  placeholder="Specify quantities, specs, delivery location, or project need..."
                  className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-neutral-100 focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">Estimated Cost ({currencySymbol})</label>
                <input
                  type="number"
                  min="0"
                  value={somethingElseCost}
                  onChange={e => setSomethingElseCost(Number(e.target.value) || 0)}
                  className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-neutral-100 focus:outline-none tabular-nums"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs">
                Submit Custom Request
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Public Knowledge Bank Articles */}
      {isModuleEnabled('knowledge') && publicKb.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-xs">
            <span className="font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
              <span>Knowledge Bank Self-Help</span>
            </span>
            <button onClick={() => navigate('/knowledge')} className="text-neutral-400 hover:text-white text-[11px]">
              Browse All Articles
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {publicKb.slice(0, 4).map(kb => (
              <div
                key={kb.id}
                onClick={() => navigate('/knowledge')}
                className="p-4 border border-neutral-800 bg-neutral-950 hover:border-neutral-700 cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px] text-neutral-500">
                  <span>{kb.id} · {kb.category}</span>
                  <span>{kb.views} views</span>
                </div>
                <div className="text-xs font-bold text-neutral-100">{kb.title}</div>
                <div className="text-[11px] text-neutral-400 line-clamp-2">{kb.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2-Column Split: My Active Tickets & My Assigned Hardware */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-xs">
            <span className="font-bold text-neutral-200 uppercase">My Active Tickets & Requests</span>
            <span className="text-neutral-500 tabular-nums">({myIncidents.length + myRequests.length})</span>
          </div>

          <div className="space-y-3">
            {myIncidents.length === 0 && myRequests.length === 0 ? (
              <div className="text-xs text-neutral-500 py-6 text-center">
                No open tickets under {activeTenant.name}.
              </div>
            ) : (
              <>
                {myIncidents.map(inc => (
                  <div
                    key={inc.id}
                    onClick={() => navigate('/incidents')}
                    className="p-3 border border-neutral-800/80 bg-neutral-900/30 hover:bg-neutral-900/60 transition-colors cursor-pointer space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-200">{inc.id}</span>
                      <MinimalStatus
                        status={inc.status}
                        variant={inc.status === 'in_progress' ? 'amber' : inc.status === 'resolved' ? 'emerald' : 'neutral'}
                      />
                    </div>
                    <div className="text-neutral-300 truncate">{inc.title}</div>
                    <div className="text-[11px] text-neutral-500 flex justify-between">
                      <span>Assignee: {inc.assignee}</span>
                      <span>Target: {new Date(inc.slaDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}

                {myRequests.map(req => (
                  <div
                    key={req.id}
                    onClick={() => navigate('/requests')}
                    className="p-3 border border-neutral-800/80 bg-neutral-900/30 hover:bg-neutral-900/60 transition-colors cursor-pointer space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-200">{req.id}</span>
                      <MinimalStatus
                        status={req.status}
                        variant={req.status === 'completed' ? 'emerald' : 'amber'}
                      />
                    </div>
                    <div className="text-neutral-300 truncate">{req.catalogItemName}</div>
                    <div className="text-[11px] text-neutral-500 flex justify-between">
                      <span>Stage {req.currentStage} of 4</span>
                      <span>Est: {req.deliveryEstimateDays} days</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-xs">
              <span className="font-bold text-neutral-200 uppercase">My Assigned Hardware Devices</span>
              <span className="text-neutral-500 tabular-nums">({myAssets.length} CIs)</span>
            </div>

            <div className="space-y-3">
              {myAssets.length === 0 ? (
                <div className="text-xs text-neutral-500 py-4 text-center">
                  No hardware devices assigned to your profile.
                </div>
              ) : (
                myAssets.map(asset => (
                  <div key={asset.id} className="p-3 border border-neutral-800/80 bg-neutral-900/30 space-y-1 text-xs">
                    <div className="flex justify-between font-bold text-neutral-200">
                      <span>{asset.assetTag}</span>
                      <span className="text-neutral-400 font-normal">{asset.type}</span>
                    </div>
                    <div className="text-neutral-300">{asset.name}</div>
                    <div className="text-[11px] text-neutral-500 flex justify-between">
                      <span>SN: {asset.serialNumber}</span>
                      <span>Warranty: {asset.warrantyExpiry}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {myInvoices.length > 0 && (
            <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-xs">
                <span className="font-bold text-neutral-200 uppercase">My Support Invoices</span>
                <button onClick={() => navigate('/billing')} className="text-rose-400 hover:underline">
                  View All
                </button>
              </div>
              <div className="space-y-2 text-xs">
                {myInvoices.map(inv => (
                  <div key={inv.id} className="p-2.5 border border-neutral-800 bg-neutral-900/20 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-neutral-200">{inv.id}</div>
                      <div className="text-[11px] text-neutral-500">{inv.organization}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-neutral-200">{currencySymbol}{inv.amount.toFixed(2)}</div>
                      <span className={inv.status === 'paid' ? 'text-emerald-400 text-[11px]' : 'text-amber-400 text-[11px]'}>
                        {inv.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

