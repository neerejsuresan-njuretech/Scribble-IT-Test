import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { Asset, AssetStatus, AssetType } from '../../types/itsm';
import { MinimalStatus, DotMatrixText } from '../common/DotMatrixDisplay';
import { Server, Laptop, Shield, Cpu, Monitor, Plus, QrCode, Search, Check, Tag } from 'lucide-react';

interface AssetModuleProps {
  onOpenCreate: () => void;
}

export const AssetModule: React.FC<AssetModuleProps> = ({ onOpenCreate }) => {
  const { assets, updateAssetStatus, role } = useITSM();
  const [selectedId, setSelectedId] = useState<string>(assets[0]?.id || '');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);

  const selectedAsset = assets.find(a => a.id === selectedId) || assets[0];

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.assetTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.assignedTo && a.assignedTo.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'all' || a.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getAssetIcon = (type: AssetType) => {
    switch (type) {
      case 'server': return <Server className="w-4 h-4 text-neutral-300" />;
      case 'laptop': return <Laptop className="w-4 h-4 text-neutral-300" />;
      case 'networking': return <Cpu className="w-4 h-4 text-neutral-300" />;
      case 'security_key': return <Shield className="w-4 h-4 text-neutral-300" />;
      case 'monitor': return <Monitor className="w-4 h-4 text-neutral-300" />;
      default: return <Server className="w-4 h-4 text-neutral-300" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-xs font-mono text-neutral-400">CONFIGURATION MANAGEMENT DATABASE (CMDB) // IT ASSETS</div>
          <h1 className="text-xl font-bold font-mono text-neutral-100 flex items-center gap-3">
            <span>ENTERPRISE ASSET REPOSITORY</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">({filteredAssets.length} Tracked CIs)</span>
          </h1>
        </div>
        {role === 'admin' && (
          <button
            onClick={onOpenCreate}
            className="px-4 py-2 text-xs font-mono tracking-wider bg-rose-600 text-white hover:bg-rose-500 transition-colors flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Asset</span>
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Asset Tag, Serial, Assignee, Model..."
            className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 pl-8 pr-3 py-1.5 focus:border-neutral-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 border border-neutral-800 bg-neutral-900/60 p-0.5">
          {['all', 'laptop', 'server', 'networking', 'security_key'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 uppercase tracking-wider transition-colors ${
                typeFilter === t ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {t === 'all' ? 'All Types' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Grid: Assets Master-Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List */}
        <div className="lg:col-span-5 border border-neutral-800 divide-y divide-neutral-800 bg-neutral-950 max-h-[750px] overflow-y-auto">
          {filteredAssets.map(asset => {
            const isSelected = selectedAsset?.id === asset.id;
            return (
              <div
                key={asset.id}
                onClick={() => setSelectedId(asset.id)}
                className={`p-4 transition-colors cursor-pointer space-y-2 ${
                  isSelected ? 'bg-neutral-900 border-l-2 border-l-rose-500' : 'hover:bg-neutral-900/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    {getAssetIcon(asset.type)}
                    <span className="font-bold text-neutral-200">{asset.assetTag}</span>
                    <span aria-hidden="true">·</span>
                    <span className="uppercase text-neutral-500 text-[11px]">{asset.type}</span>
                  </div>
                  <MinimalStatus
                    status={asset.status}
                    variant={asset.status === 'in_use' ? 'emerald' : asset.status === 'in_stock' ? 'neutral' : 'amber'}
                  />
                </div>

                <div className="text-xs font-medium text-neutral-200 line-clamp-1">
                  {asset.name}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 pt-1">
                  <span>{asset.assignedTo || 'Unassigned (In Depot)'}</span>
                  <span className="tabular-nums font-bold text-neutral-400">
                    ${asset.currentBookValue.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Detail */}
        {selectedAsset ? (
          <div className="lg:col-span-7 border border-neutral-800 bg-neutral-950 p-6 space-y-6">
            <div className="space-y-3 border-b border-neutral-800 pb-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-neutral-400">
                  <span className="text-base font-bold text-neutral-100">{selectedAsset.assetTag}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-neutral-400 uppercase">{selectedAsset.manufacturer}</span>
                </div>
                {role === 'admin' && (
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500">Status:</span>
                    <select
                      value={selectedAsset.status}
                      onChange={e => updateAssetStatus(selectedAsset.id, e.target.value as AssetStatus)}
                      className="bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs font-mono px-2 py-1 focus:outline-none"
                    >
                      <option value="in_use">In Use</option>
                      <option value="in_stock">In Stock</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="retired">Retired</option>
                    </select>
                  </div>
                )}
              </div>

              <h2 className="text-lg font-bold text-neutral-100 font-mono">
                {selectedAsset.name}
              </h2>
              <div className="text-xs font-mono text-neutral-400">
                Model: <span className="text-neutral-200">{selectedAsset.model}</span>
              </div>
            </div>

            {/* Hardware Token or Asset Image Showcase */}
            {selectedAsset.type === 'security_key' && (
              <div className="p-4 border border-neutral-800 bg-neutral-900/30 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-24 h-24 shrink-0 bg-neutral-950 border border-neutral-800 overflow-hidden">
                  <img
                    src="/src/assets/images/scribble_hardware_token_1793899657390.jpg"
                    alt="Scribble Hardware Security Token"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="text-neutral-200 font-bold">Njure Tech Dot-Matrix Security Hardware</div>
                  <p className="text-neutral-400">
                    Transparent polycarbonate enclosure with integrated dot-matrix status LCD. Provisioned for zero-trust single sign-on authentication.
                  </p>
                </div>
              </div>
            )}

            {/* Technical Specifications */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono border-b border-neutral-800 pb-4">
              <div className="space-y-1">
                <span className="text-neutral-500">SERIAL NUMBER</span>
                <div className="text-neutral-200 font-bold">{selectedAsset.serialNumber}</div>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-500">MAC ADDRESS</span>
                <div className="text-neutral-200">{selectedAsset.macAddress || 'N/A (Non-networked)'}</div>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-500">LOCATION</span>
                <div className="text-neutral-200 truncate">{selectedAsset.location}</div>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-500">ASSIGNED TO</span>
                <div className="text-neutral-200 truncate">{selectedAsset.assignedTo || 'Unassigned / Stock'}</div>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-500">WARRANTY EXPIRY</span>
                <div className="text-neutral-200 tabular-nums">{selectedAsset.warrantyExpiry}</div>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-500">PURCHASE VALUE</span>
                <div className="text-neutral-200 tabular-nums">${selectedAsset.purchaseCost.toLocaleString()}</div>
              </div>
            </div>

            {/* Barcode & QR Audit Tag Display */}
            <div className="p-4 border border-neutral-800 bg-neutral-900/20 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-neutral-400 font-bold uppercase">PHYSICAL ASSET AUDIT TAG</span>
                <span className="text-neutral-500">{selectedAsset.assetTag}</span>
              </div>

              <div className="p-4 bg-white text-black flex flex-col sm:flex-row items-center justify-between gap-4 font-mono select-none">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="text-xs font-bold tracking-widest">NJURE TECH // IT ASSET</div>
                  <div className="text-sm font-bold">{selectedAsset.assetTag}</div>
                  <div className="text-[10px] text-neutral-600 truncate max-w-xs">{selectedAsset.name}</div>
                  <div className="text-[10px] text-neutral-600">SN: {selectedAsset.serialNumber}</div>
                </div>

                {/* Dot Matrix Barcode Simulator */}
                <div className="flex items-center gap-0.5 h-10 overflow-hidden">
                  {[2, 1, 3, 1, 4, 1, 2, 3, 1, 2, 4, 1, 1, 3, 2, 1, 3, 1, 2, 4, 2, 1, 3].map((w, i) => (
                    <div
                      key={i}
                      className="bg-black h-full"
                      style={{ width: `${w * 1.5}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
