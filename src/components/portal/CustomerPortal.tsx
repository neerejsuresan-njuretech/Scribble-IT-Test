import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { CATALOG_ITEMS } from '../../data/seedData';
import { CatalogItem } from '../../types/itsm';
import { DotMatrixText, MinimalStatus } from '../common/DotMatrixDisplay';
import { Search, Plus, Laptop, Shield, Cloud, Phone, Clock, ArrowRight, CheckCircle2, AlertTriangle, CreditCard } from 'lucide-react';

interface CustomerPortalProps {
  onOpenNewTicket: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ onOpenNewTicket }) => {
  const {
    currentUser, requests, incidents, assets, invoices,
    createServiceRequest, setActiveTab, setRole
  } = useITSM();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [orderedItemNotice, setOrderedItemNotice] = useState<string | null>(null);

  // User's tickets
  const myIncidents = incidents.filter(i => i.requesterEmail === currentUser.email || i.requesterName === currentUser.name);
  const myRequests = requests.filter(r => r.requesterEmail === currentUser.email || r.requesterName === currentUser.name);
  const myAssets = assets.filter(a => a.assignedTo === currentUser.name);
  const myInvoices = invoices.filter(inv => inv.customerEmail === currentUser.email || inv.customerName === currentUser.name);

  const filteredCatalog = CATALOG_ITEMS.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleOrderCatalogItem = (item: CatalogItem) => {
    const newReq = createServiceRequest({
      catalogItemId: item.id,
      catalogItemName: item.title,
      description: `Requested from Self-Service Catalog: ${item.description}`,
      cost: item.price,
      deliveryEstimateDays: Math.ceil(item.estimatedHours / 8)
    });
    setOrderedItemNotice(`Service Request ${newReq.id} submitted for ${item.title}`);
    setTimeout(() => setOrderedItemNotice(null), 4000);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'hardware': return <Laptop className="w-4 h-4 text-neutral-300" />;
      case 'cloud': return <Cloud className="w-4 h-4 text-neutral-300" />;
      case 'access': return <Shield className="w-4 h-4 text-neutral-300" />;
      case 'telephony': return <Phone className="w-4 h-4 text-neutral-300" />;
      default: return <Laptop className="w-4 h-4 text-neutral-300" />;
    }
  };

  return (
    <div className="space-y-8 font-mono">
      {/* Top Banner / User Welcome */}
      <div className="p-6 border border-neutral-800 bg-neutral-900/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="text-xs text-neutral-400 flex items-center gap-2">
            <span>SELF-SERVICE PORTAL</span>
            <span aria-hidden="true">·</span>
            <span className="text-neutral-200">{currentUser.name}</span>
            <span aria-hidden="true">·</span>
            <span>{currentUser.department}</span>
          </div>
          <div>
            <DotMatrixText text="SELF SERVICE" size="md" activeColor="#ffffff" dimColor="#262626" />
          </div>
          <p className="text-xs text-neutral-400 max-w-xl">
            Request IT equipment, cloud permissions, report operational incidents, and review assigned hardware.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenNewTicket}
            className="px-4 py-2 text-xs font-mono tracking-wider bg-rose-600 text-white hover:bg-rose-500 transition-colors flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
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
          placeholder="How can IT help you today? Search hardware, software, VPN, cloud access..."
          className="w-full bg-neutral-900/80 border border-neutral-800 text-neutral-200 pl-10 pr-4 py-3 text-xs focus:border-neutral-600 focus:outline-none"
        />
      </div>

      {/* Service Catalog Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-2">
          <div className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
            Standard Service Catalog
          </div>
          <div className="flex items-center gap-1 text-xs">
            {['all', 'hardware', 'cloud', 'access', 'telephony'].map(c => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-2.5 py-1 uppercase transition-colors ${
                  selectedCategory === c ? 'bg-neutral-800 text-neutral-100 font-bold border border-neutral-700' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCatalog.map(item => (
            <div
              key={item.id}
              className="p-5 border border-neutral-800 bg-neutral-950 hover:border-neutral-700 transition-colors flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(item.category)}
                    <span className="uppercase text-[11px]">{item.category}</span>
                  </div>
                  <span className="tabular-nums font-bold text-neutral-200">
                    {item.price > 0 ? `$${item.price.toLocaleString()}` : 'Free'}
                  </span>
                </div>

                <div className="text-sm font-bold text-neutral-100">
                  {item.title}
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="pt-2 border-t border-neutral-900 flex items-center justify-between text-xs">
                <span className="text-neutral-500 text-[11px]">
                  Est: {item.estimatedHours}h
                </span>
                <button
                  onClick={() => handleOrderCatalogItem(item)}
                  className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:border-neutral-500 transition-colors flex items-center gap-1 text-xs"
                >
                  <span>Request</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2-Column Split: My Active Tickets & My Assigned Hardware */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: My Active Tickets */}
        <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-xs">
            <span className="font-bold text-neutral-200 uppercase">My Active Tickets & Requests</span>
            <span className="text-neutral-500 tabular-nums">({myIncidents.length + myRequests.length})</span>
          </div>

          <div className="space-y-3">
            {myIncidents.length === 0 && myRequests.length === 0 ? (
              <div className="text-xs text-neutral-500 py-6 text-center">
                You have no open tickets at this time.
              </div>
            ) : (
              <>
                {myIncidents.map(inc => (
                  <div
                    key={inc.id}
                    onClick={() => setActiveTab('incidents')}
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
                    onClick={() => setActiveTab('requests')}
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

        {/* Right: My Assigned Hardware & Invoices */}
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

          {/* User Invoices if any */}
          {myInvoices.length > 0 && (
            <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-xs">
                <span className="font-bold text-neutral-200 uppercase">My Support Invoices</span>
                <button onClick={() => setActiveTab('billing')} className="text-rose-400 hover:underline">
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
                      <div className="font-bold text-neutral-200">${inv.amount.toFixed(2)}</div>
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
