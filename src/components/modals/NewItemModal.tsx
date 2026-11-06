import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { IncidentPriority, IncidentCategory, ChangeType, RiskLevel, AssetType } from '../../types/itsm';

interface NewItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'incident' | 'request' | 'change' | 'asset' | 'problem';
}

export const NewItemModal: React.FC<NewItemModalProps> = ({ isOpen, onClose, defaultType = 'incident' }) => {
  const {
    createIncident, createServiceRequest, createChangeRequest,
    createAsset, createProblem, assets, currentUser
  } = useITSM();

  const [type, setType] = useState(defaultType);

  // Common fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Incident specific
  const [priority, setPriority] = useState<IncidentPriority>('P3');
  const [category, setCategory] = useState<IncidentCategory>('software');
  const [affectedCI, setAffectedCI] = useState('');

  // Change specific
  const [changeType, setChangeType] = useState<ChangeType>('normal');
  const [riskScore, setRiskScore] = useState<RiskLevel>('medium');
  const [implementationPlan, setImplementationPlan] = useState('');
  const [rollbackPlan, setRollbackPlan] = useState('');

  // Asset specific
  const [assetTag, setAssetTag] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('laptop');
  const [serialNumber, setSerialNumber] = useState('');
  const [model, setModel] = useState('');
  const [purchaseCost, setPurchaseCost] = useState(1200);

  // Problem specific
  const [rootCause, setRootCause] = useState('');
  const [workaround, setWorkaround] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (type === 'incident') {
      createIncident({
        title,
        description,
        priority,
        category,
        affectedCI: affectedCI || undefined,
        requesterName: currentUser.name,
        requesterEmail: currentUser.email
      });
    } else if (type === 'request') {
      createServiceRequest({
        catalogItemId: 'CAT-GEN-01',
        catalogItemName: title,
        description,
        cost: 0
      });
    } else if (type === 'change') {
      createChangeRequest({
        title,
        type: changeType,
        riskScore,
        reason: description,
        implementationPlan: implementationPlan || '1. Pre-change backup\n2. Binary deployment\n3. Health check validation',
        rollbackPlan: rollbackPlan || 'Revert git commit and redeploy prior stable container image.'
      });
    } else if (type === 'asset') {
      createAsset({
        name: title,
        assetTag: assetTag || `NJURE-${assetType.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
        type: assetType,
        serialNumber: serialNumber || `SN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        model: model || 'Enterprise Standard Spec',
        purchaseCost,
        currentBookValue: purchaseCost
      });
    } else if (type === 'problem') {
      createProblem({
        title,
        description,
        rootCauseAnalysis: rootCause,
        workaround
      });
    }

    onClose();
    // Reset form
    setTitle('');
    setDescription('');
    setImplementationPlan('');
    setRollbackPlan('');
    setRootCause('');
    setWorkaround('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 p-6 space-y-4 font-mono text-xs max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="space-y-0.5">
            <span className="text-sm font-bold text-neutral-100 uppercase">Create IT Record</span>
            <div className="text-neutral-500">FreeITSM Core Engine // Njure Tech</div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
            ✕
          </button>
        </div>

        {/* Type Selector Tabs */}
        <div className="flex border border-neutral-800 bg-neutral-900/60 p-0.5">
          {[
            { id: 'incident', label: 'Incident' },
            { id: 'request', label: 'Service Request' },
            { id: 'change', label: 'Change (RFC)' },
            { id: 'asset', label: 'Asset (CMDB)' },
            { id: 'problem', label: 'Problem' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setType(tab.id as any)}
              className={`flex-1 py-1.5 text-center uppercase tracking-wider transition-colors ${
                type === tab.id ? 'bg-neutral-800 text-neutral-100 font-bold border border-neutral-700' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-neutral-400 block mb-1">Record Title / Summary *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. SFP Transceiver link failure on switch 2"
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-neutral-400 block mb-1">Detailed Description *</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide symptoms, error messages, and reproduction steps..."
              className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 focus:outline-none"
            />
          </div>

          {/* Conditional Fields based on Type */}
          {type === 'incident' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-neutral-400 block mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as IncidentPriority)}
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                >
                  <option value="P1">P1 - Critical (SLA 1h)</option>
                  <option value="P2">P2 - High (SLA 4h)</option>
                  <option value="P3">P3 - Medium (SLA 24h)</option>
                  <option value="P4">P4 - Low (SLA 48h)</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as IncidentCategory)}
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                >
                  <option value="software">Software</option>
                  <option value="hardware">Hardware</option>
                  <option value="network">Network</option>
                  <option value="security">Security</option>
                  <option value="telephony">Telephony</option>
                  <option value="access">Access</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Affected CI (CMDB)</label>
                <select
                  value={affectedCI}
                  onChange={e => setAffectedCI(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                >
                  <option value="">None / Unknown</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.assetTag} - {a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {type === 'change' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Change Type</label>
                  <select
                    value={changeType}
                    onChange={e => setChangeType(e.target.value as ChangeType)}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  >
                    <option value="standard">Standard (Pre-approved)</option>
                    <option value="normal">Normal (Requires CAB)</option>
                    <option value="emergency">Emergency (Critical Outage)</option>
                  </select>
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Risk Rating</label>
                  <select
                    value={riskScore}
                    onChange={e => setRiskScore(e.target.value as RiskLevel)}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  >
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                    <option value="critical">Critical Risk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Implementation Procedure</label>
                <textarea
                  rows={2}
                  value={implementationPlan}
                  onChange={e => setImplementationPlan(e.target.value)}
                  placeholder="Numbered step-by-step rollout commands..."
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Rollback Plan</label>
                <textarea
                  rows={2}
                  value={rollbackPlan}
                  onChange={e => setRollbackPlan(e.target.value)}
                  placeholder="Backout trigger threshold & recovery steps..."
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                />
              </div>
            </div>
          )}

          {type === 'asset' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Asset Tag</label>
                  <input
                    type="text"
                    value={assetTag}
                    onChange={e => setAssetTag(e.target.value)}
                    placeholder="e.g. NJURE-SRV-90"
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Asset Type</label>
                  <select
                    value={assetType}
                    onChange={e => setAssetType(e.target.value as AssetType)}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  >
                    <option value="laptop">Laptop / Notebook</option>
                    <option value="server">Server (Rackmount/Blade)</option>
                    <option value="networking">Networking (Switch/Router)</option>
                    <option value="security_key">Security Key (FIDO2)</option>
                    <option value="monitor">Monitor / Display</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={e => setSerialNumber(e.target.value)}
                    placeholder="e.g. 7XG4B93"
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Purchase Cost ($)</label>
                  <input
                    type="number"
                    value={purchaseCost}
                    onChange={e => setPurchaseCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {type === 'problem' && (
            <div className="space-y-3">
              <div>
                <label className="text-neutral-400 block mb-1">Root Cause Analysis</label>
                <textarea
                  rows={2}
                  value={rootCause}
                  onChange={e => setRootCause(e.target.value)}
                  placeholder="Underlying technical flaw or condition..."
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-neutral-400 block mb-1">Immediate Workaround</label>
                <textarea
                  rows={2}
                  value={workaround}
                  onChange={e => setWorkaround(e.target.value)}
                  placeholder="How can operators bypass this until a permanent fix is released?"
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors"
            >
              Submit {type.toUpperCase()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
