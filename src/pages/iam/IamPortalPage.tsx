import React, { useMemo, useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { AuthPortalType, IamPermissionScope, Role } from '../../types/itsm';
import { Shield, Plus, UserPlus, Building2, KeyRound, Trash2, Power, Check, Lock, ChevronLeft, ChevronRight, Phone } from 'lucide-react';

const ALL_SCOPES: { id: IamPermissionScope; label: string }[] = [
  { id: 'incidents:read', label: 'Incidents Read' },
  { id: 'incidents:write', label: 'Incidents Write' },
  { id: 'assets:read', label: 'Assets / CMDB Read' },
  { id: 'assets:write', label: 'Assets / CMDB Write' },
  { id: 'requests:approve', label: 'Approve Service Requests' },
  { id: 'changes:cab_vote', label: 'CAB Change Voting' },
  { id: 'workflows:manage', label: 'Manage Workflows' },
  { id: 'iam:manage', label: 'IAM Directory Admin' },
  { id: 'tenants:admin', label: 'Tenant Governance' },
  { id: 'billing:read', label: 'Billing Read' }
];

export const IamPortalPage: React.FC = () => {
  const {
    activeTenant,
    tenants,
    authAccounts,
    iamPolicies,
    createIamIdentity,
    updateIamIdentity,
    deleteIamIdentity,
    createIamPolicy,
    deleteIamPolicy,
    getPortalBranding
  } = useITSM();

  const iamBranding = getPortalBranding('iam');
  const [activeTab, setActiveTab] = useState<'identities' | 'policies' | 'companies'>('identities');
  const [searchFilter, setSearchFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [identityPage, setIdentityPage] = useState<number>(1);
  const [policySearch, setPolicySearch] = useState<string>('');
  const [policyPage, setPolicyPage] = useState<number>(1);
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});
  const IDENTITIES_PER_PAGE = 25;
  const POLICIES_PER_PAGE = 16;

  // Create Identity Form
  const [showCreateId, setShowCreateId] = useState(false);
  const [customId, setCustomId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState(activeTenant.companyCode || `COMP-${activeTenant.slug.toUpperCase()}`);
  const [selectedTenantId, setSelectedTenantId] = useState(activeTenant.id);
  const [assignedRole, setAssignedRole] = useState<Role>('technician');
  const [portalType, setPortalType] = useState<AuthPortalType>('employee');
  const [department, setDepartment] = useState('IT Operations');
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>(['POL-EMPLOYEE-OPS']);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [idError, setIdError] = useState('');

  // Create Policy Form
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [policyName, setPolicyName] = useState('');
  const [policyDesc, setPolicyDesc] = useState('');
  const [policyScopes, setPolicyScopes] = useState<IamPermissionScope[]>(['incidents:read', 'assets:read']);
  const [policyMfa, setPolicyMfa] = useState(false);
  const [policySsoOnly, setPolicySsoOnly] = useState(false);

  // Edit Identity Policy Drawer
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  const handleToggleCreatePolicy = (polId: string) => {
    setSelectedPolicies(prev =>
      prev.includes(polId) ? prev.filter(p => p !== polId) : [...prev, polId]
    );
  };

  const handleCreateIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    setIdError('');
    const res = createIamIdentity({
      id: customId || undefined,
      name: fullName,
      email,
      password,
      companyId,
      tenantId: selectedTenantId,
      role: assignedRole,
      portalType,
      department,
      policyIds: selectedPolicies,
      mfaEnabled
    });
    if (!res.ok) {
      setIdError(res.error || 'Could not create identity.');
      return;
    }
    setCustomId('');
    setFullName('');
    setEmail('');
    setPassword('');
    setShowCreateId(false);
  };

  const handleCreatePolicySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyName.trim()) return;
    createIamPolicy({
      name: policyName,
      description: policyDesc,
      permissions: policyScopes,
      mfaRequired: policyMfa,
      ssoOnly: policySsoOnly
    });
    setPolicyName('');
    setPolicyDesc('');
    setPolicyScopes(['incidents:read', 'assets:read']);
    setShowCreatePolicy(false);
  };

  const toggleScopeInNewPolicy = (scope: IamPermissionScope) => {
    setPolicyScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const handleToggleAccountPolicy = (accountId: string, policyId: string) => {
    const target = authAccounts.find(a => a.id === accountId);
    if (!target) return;
    const current = target.policyIds || [];
    const next = current.includes(policyId)
      ? current.filter(id => id !== policyId)
      : [...current, policyId];
    updateIamIdentity(accountId, { policyIds: next });
  };

  const filteredAccounts = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return authAccounts.filter(acc => {
      if (roleFilter !== 'all' && acc.role !== roleFilter) return false;
      if (companyFilter !== 'all' && (acc.companyId || 'UNASSIGNED') !== companyFilter) return false;
      if (!q) return true;
      return (
        acc.id.toLowerCase().includes(q) ||
        acc.name.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        (acc.phone || '').toLowerCase().includes(q) ||
        (acc.department || '').toLowerCase().includes(q) ||
        (acc.companyId || '').toLowerCase().includes(q)
      );
    });
  }, [authAccounts, roleFilter, companyFilter, searchFilter]);

  const totalIdentityPages = Math.max(1, Math.ceil(filteredAccounts.length / IDENTITIES_PER_PAGE));
  const safeIdentityPage = Math.min(identityPage, totalIdentityPages);
  const pagedAccounts = useMemo(
    () =>
      filteredAccounts.slice(
        (safeIdentityPage - 1) * IDENTITIES_PER_PAGE,
        safeIdentityPage * IDENTITIES_PER_PAGE
      ),
    [filteredAccounts, safeIdentityPage]
  );

  const filteredPolicies = useMemo(() => {
    const q = policySearch.trim().toLowerCase();
    if (!q) return iamPolicies;
    return iamPolicies.filter(
      p =>
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.permissions.some(sc => sc.toLowerCase().includes(q))
    );
  }, [iamPolicies, policySearch]);

  const totalPolicyPages = Math.max(1, Math.ceil(filteredPolicies.length / POLICIES_PER_PAGE));
  const safePolicyPage = Math.min(policyPage, totalPolicyPages);
  const pagedPolicies = useMemo(
    () =>
      filteredPolicies.slice(
        (safePolicyPage - 1) * POLICIES_PER_PAGE,
        safePolicyPage * POLICIES_PER_PAGE
      ),
    [filteredPolicies, safePolicyPage]
  );

  const companyGroups = useMemo(
    () =>
      Array.from(new Set(authAccounts.map(a => a.companyId || 'UNASSIGNED'))).map(cid => ({
        companyId: cid,
        accounts: authAccounts.filter(a => (a.companyId || 'UNASSIGNED') === cid),
        tenant: tenants.find(
          t => t.companyCode === cid || authAccounts.some(a => a.companyId === cid && a.tenantId === t.id)
        ),
      })),
    [authAccounts, tenants]
  );

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Customized IAM Portal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3.5">
          {iamBranding.logoDataUrl && (
            <img
              src={iamBranding.logoDataUrl}
              alt={iamBranding.portalName}
              referrerPolicy="no-referrer"
              className="h-10 w-10 object-contain border border-neutral-800 bg-neutral-900 p-1 shrink-0"
            />
          )}
          <div>
            <div className="text-neutral-500 uppercase tracking-wider">
              {activeTenant.name} · {iamBranding.subtitle}
            </div>
            <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
              <Shield className="w-5 h-5 text-rose-500 shrink-0" />
              <span>{iamBranding.portalName.toUpperCase()}</span>
              <span className="text-xs font-normal text-neutral-500 tabular-nums">
                {authAccounts.length} Identities · {iamPolicies.length} Policies
              </span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setActiveTab('policies');
              setShowCreatePolicy(true);
            }}
            className="px-3.5 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-bold flex items-center gap-2 whitespace-nowrap"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>New Policy</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('identities');
              setShowCreateId(!showCreateId);
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{showCreateId ? 'Close Form' : 'Create Identity ID'}</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-neutral-800 divide-y lg:divide-y-0 lg:divide-x divide-neutral-800 bg-neutral-950">
        <div className="p-4">
          <div className="text-[11px] text-neutral-500 uppercase">Provisioned IDs</div>
          <div className="text-2xl font-bold text-neutral-100 mt-1 tabular-nums">{authAccounts.length}</div>
        </div>
        <div className="p-4">
          <div className="text-[11px] text-neutral-500 uppercase">Active Access</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
            {authAccounts.filter(a => a.status !== 'suspended').length}
          </div>
        </div>
        <div className="p-4">
          <div className="text-[11px] text-neutral-500 uppercase">Company IDs Mapped</div>
          <div className="text-2xl font-bold text-neutral-100 mt-1 tabular-nums">{companyGroups.length}</div>
        </div>
        <div className="p-4">
          <div className="text-[11px] text-neutral-500 uppercase">Access Policies</div>
          <div className="text-2xl font-bold text-neutral-100 mt-1 tabular-nums">{iamPolicies.length}</div>
        </div>
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-800 pb-2">
        {[
          { id: 'identities', label: 'Identities & Role Assignment' },
          { id: 'policies', label: 'Access Policies & Scopes' },
          { id: 'companies', label: 'Company ID Registry' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: IDENTITIES */}
      {activeTab === 'identities' && (
        <div className="space-y-5">
          {showCreateId && (
            <form onSubmit={handleCreateIdentity} className="border border-neutral-700 bg-neutral-900/40 p-5 space-y-4">
              <div className="font-bold text-neutral-200 uppercase tracking-wider border-b border-neutral-800 pb-2">
                Create IAM Identity &amp; Assign Company / Role / Policy
              </div>

              {idError && (
                <div className="p-3 border border-rose-800 bg-rose-950/40 text-rose-300 text-[11px]">
                  {idError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-neutral-400 mb-1">Identity ID (Optional)</label>
                  <input
                    value={customId}
                    onChange={e => setCustomId(e.target.value)}
                    placeholder="Auto (e.g. EMP-1045)"
                    className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Full Name *</label>
                  <input
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Identity holder name"
                    className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Login Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={`user@${activeTenant.domain}`}
                    className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Initial credential"
                    className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-neutral-400 mb-1">Assign Tenant Org</label>
                  <select
                    value={selectedTenantId}
                    onChange={e => {
                      const t = tenants.find(item => item.id === e.target.value);
                      setSelectedTenantId(e.target.value);
                      if (t) setCompanyId(t.companyCode || `COMP-${t.slug.toUpperCase()}`);
                    }}
                    className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
                  >
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Assign Company ID *</label>
                  <input
                    required
                    value={companyId}
                    onChange={e => setCompanyId(e.target.value)}
                    placeholder="COMP-NJURE-01"
                    className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Assign Role</label>
                  <select
                    value={assignedRole}
                    onChange={e => setAssignedRole(e.target.value as Role)}
                    className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
                  >
                    <option value="admin">Admin (Full Privilege)</option>
                    <option value="technician">Technician / Employee</option>
                    <option value="customer">Customer / End-User</option>
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Target Login Portal</label>
                  <select
                    value={portalType}
                    onChange={e => setPortalType(e.target.value as AuthPortalType)}
                    className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
                  >
                    <option value="employee">Employee Portal</option>
                    <option value="end_user">Self-Service Portal</option>
                    <option value="iam">IAM Portal</option>
                    <option value="super_admin">Super Admin Console</option>
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Department</label>
                  <input
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
                  />
                </div>
              </div>

              {/* Policy Assignment */}
              <div className="border border-neutral-800 bg-neutral-950 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-neutral-400">
                    Attach IAM Policies
                  </span>
                  <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mfaEnabled}
                      onChange={e => setMfaEnabled(e.target.checked)}
                      className="accent-rose-600"
                    />
                    <span>Enforce MFA Verification</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {iamPolicies.map(pol => (
                    <label
                      key={pol.id}
                      className={`p-2.5 border cursor-pointer flex items-start gap-2.5 ${
                        selectedPolicies.includes(pol.id)
                          ? 'border-rose-600 bg-rose-950/20 text-neutral-100'
                          : 'border-neutral-800 bg-neutral-900/40 text-neutral-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPolicies.includes(pol.id)}
                        onChange={() => handleToggleCreatePolicy(pol.id)}
                        className="mt-0.5 accent-rose-600"
                      />
                      <div>
                        <div className="font-bold text-neutral-100">
                          {pol.name} <span className="text-neutral-500 font-normal">· {pol.id}</span>
                        </div>
                        <div className="text-[11px] text-neutral-500">{pol.permissions.join(', ')}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateId(false)}
                  className="px-4 py-2 border border-neutral-700 text-neutral-300 hover:bg-neutral-900"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold">
                  Provision Identity
                </button>
              </div>
            </form>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <input
              type="text"
              value={searchFilter}
              onChange={e => {
                setSearchFilter(e.target.value);
                setIdentityPage(1);
              }}
              placeholder="Filter 500+ profiles by ID, name, email, phone, department, or Company ID..."
              className="flex-1 bg-neutral-950 border border-neutral-800 px-3 py-2 text-neutral-100 focus:border-neutral-600 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={companyFilter}
                onChange={e => {
                  setCompanyFilter(e.target.value);
                  setIdentityPage(1);
                }}
                className="bg-neutral-950 border border-neutral-800 px-2.5 py-2 text-[11px] text-neutral-200 focus:outline-none"
              >
                <option value="all">All Companies ({companyGroups.length})</option>
                {companyGroups.map(g => (
                  <option key={g.companyId} value={g.companyId}>
                    {g.tenant ? `${g.tenant.name} (${g.accounts.length})` : `${g.companyId} (${g.accounts.length})`}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1 border border-neutral-800 p-1 bg-neutral-950">
                {(['all', 'admin', 'technician', 'customer'] as const).map(rf => (
                  <button
                    key={rf}
                    onClick={() => {
                      setRoleFilter(rf);
                      setIdentityPage(1);
                    }}
                    className={`px-2.5 py-1 text-[11px] uppercase font-bold ${
                      roleFilter === rf ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-200'
                    }`}
                  >
                    {rf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Identities Table */}
          <div className="border border-neutral-800 bg-neutral-950 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/50 text-[11px] text-neutral-400 uppercase">
                  <th className="py-3 px-4">Identity ID / User</th>
                  <th className="py-3 px-4">Company ID</th>
                  <th className="py-3 px-4">Role / Portal</th>
                  <th className="py-3 px-4">Assigned Policies</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {pagedAccounts.map(acc => {
                  const isSuspended = acc.status === 'suspended';
                  const assignedPolObjs = iamPolicies.filter(p => (acc.policyIds || []).includes(p.id));
                  return (
                    <React.Fragment key={acc.id}>
                      <tr className="hover:bg-neutral-900/30">
                        <td className="py-3 px-4">
                          <div className="font-bold text-neutral-100">
                            {acc.name}
                            {acc.jobTitle && <span className="text-neutral-500 font-normal"> · {acc.jobTitle}</span>}
                          </div>
                          <div className="text-[11px] text-neutral-500 flex flex-wrap items-center gap-1.5">
                            <span className="text-rose-400">{acc.id}</span>
                            <span>·</span>
                            <span>{acc.email}</span>
                            {acc.phone && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1 text-neutral-400 tabular-nums">
                                  <Phone className="w-2.5 h-2.5" />
                                  {acc.phone}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            value={acc.companyId || ''}
                            onChange={e => updateIamIdentity(acc.id, { companyId: e.target.value.toUpperCase() })}
                            className="bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-200 w-32 text-[11px] uppercase focus:border-neutral-600 focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            <select
                              value={acc.role}
                              onChange={e => updateIamIdentity(acc.id, { role: e.target.value as Role })}
                              className="bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100 text-[11px] uppercase"
                            >
                              <option value="admin">admin</option>
                              <option value="technician">technician</option>
                              <option value="customer">customer</option>
                            </select>
                            <span className="text-[10px] text-neutral-500 uppercase">Portal: {acc.portalType}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-neutral-200">
                            {assignedPolObjs.length > 0
                              ? assignedPolObjs.map(p => p.name).join(' · ')
                              : 'Default Scope'}
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingAccountId(editingAccountId === acc.id ? null : acc.id)}
                            className="text-[11px] text-sky-400 hover:underline mt-0.5"
                          >
                            {editingAccountId === acc.id ? 'Done Editing Policies' : 'Edit Policy Bindings'}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <span className={isSuspended ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                            {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                          </span>
                          {acc.mfaEnabled && <div className="text-[10px] text-neutral-500">MFA Enforced</div>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateIamIdentity(acc.id, {
                                  status: isSuspended ? 'active' : 'suspended'
                                })
                              }
                              className="px-2.5 py-1 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 flex items-center gap-1"
                              title={isSuspended ? 'Reactivate Identity' : 'Suspend Identity'}
                            >
                              <Power className="w-3 h-3" />
                              <span>{isSuspended ? 'Enable' : 'Suspend'}</span>
                            </button>
                            <button
                              onClick={() => deleteIamIdentity(acc.id)}
                              className="p-1.5 border border-neutral-800 text-neutral-500 hover:text-rose-400 hover:border-rose-900"
                              title="Revoke identity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editingAccountId === acc.id && (
                        <tr className="bg-neutral-900/50">
                          <td colSpan={6} className="p-4 border-t border-neutral-800">
                            <div className="text-[11px] text-neutral-400 uppercase font-bold mb-2">
                              Policy Bindings for {acc.id} ({acc.name})
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                              {iamPolicies.map(pol => {
                                const bound = (acc.policyIds || []).includes(pol.id);
                                return (
                                  <button
                                    key={pol.id}
                                    type="button"
                                    onClick={() => handleToggleAccountPolicy(acc.id, pol.id)}
                                    className={`p-2.5 border text-left transition-colors ${
                                      bound
                                        ? 'border-emerald-700 bg-emerald-950/30 text-neutral-100'
                                        : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-600'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between font-bold">
                                      <span>{pol.name}</span>
                                      {bound && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                                    </div>
                                    <div className="text-[10px] text-neutral-500 mt-0.5 truncate">
                                      {pol.permissions.join(', ')}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Identities Pagination Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-neutral-800 bg-neutral-950 px-4 py-3 text-[11px]">
            <div className="text-neutral-400 tabular-nums">
              Showing{' '}
              <span className="text-neutral-100 font-bold">
                {filteredAccounts.length === 0 ? 0 : (safeIdentityPage - 1) * IDENTITIES_PER_PAGE + 1}–
                {Math.min(safeIdentityPage * IDENTITIES_PER_PAGE, filteredAccounts.length)}
              </span>{' '}
              of <span className="text-neutral-100 font-bold">{filteredAccounts.length}</span> matching identities
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safeIdentityPage <= 1}
                onClick={() => setIdentityPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 border border-neutral-800 bg-neutral-900 text-neutral-200 disabled:opacity-40 hover:bg-neutral-800 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <span className="text-neutral-300 tabular-nums px-2">
                Page {safeIdentityPage} / {totalIdentityPages}
              </span>
              <button
                type="button"
                disabled={safeIdentityPage >= totalIdentityPages}
                onClick={() => setIdentityPage(p => Math.min(totalIdentityPages, p + 1))}
                className="px-2.5 py-1.5 border border-neutral-800 bg-neutral-900 text-neutral-200 disabled:opacity-40 hover:bg-neutral-800 flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IAM POLICIES */}
      {activeTab === 'policies' && (
        <div className="space-y-5">
          {showCreatePolicy && (
            <form onSubmit={handleCreatePolicySubmit} className="border border-neutral-700 bg-neutral-900/40 p-5 space-y-4">
              <div className="font-bold text-neutral-200 uppercase tracking-wider border-b border-neutral-800 pb-2">
                Create IAM Access Policy
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-400 mb-1">Policy Name *</label>
                  <input
                    required
                    value={policyName}
                    onChange={e => setPolicyName(e.target.value)}
                    placeholder="e.g. Security Analyst Read & Write"
                    className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Description</label>
                  <input
                    value={policyDesc}
                    onChange={e => setPolicyDesc(e.target.value)}
                    placeholder="Scope summary for audit logs"
                    className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase text-neutral-400">Permission Scopes</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {ALL_SCOPES.map(sc => {
                    const checked = policyScopes.includes(sc.id);
                    return (
                      <label
                        key={sc.id}
                        className={`p-2 border cursor-pointer flex items-center gap-2 ${
                          checked
                            ? 'border-rose-600 bg-rose-950/20 text-neutral-100'
                            : 'border-neutral-800 bg-neutral-950 text-neutral-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleScopeInNewPolicy(sc.id)}
                          className="accent-rose-600"
                        />
                        <span className="truncate">{sc.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyMfa}
                    onChange={e => setPolicyMfa(e.target.checked)}
                    className="accent-rose-600"
                  />
                  <span>Require MFA Hardware Token</span>
                </label>
                <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policySsoOnly}
                    onChange={e => setPolicySsoOnly(e.target.checked)}
                    className="accent-rose-600"
                  />
                  <span>Restrict to Company Device SSO Only</span>
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePolicy(false)}
                  className="px-4 py-2 border border-neutral-700 text-neutral-300"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold">
                  Save IAM Policy
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="text"
              value={policySearch}
              onChange={e => {
                setPolicySearch(e.target.value);
                setPolicyPage(1);
              }}
              placeholder={`Search ${iamPolicies.length} IAM access policies by code, title, or scope...`}
              className="flex-1 bg-neutral-950 border border-neutral-800 px-3 py-2 text-neutral-100 focus:border-neutral-600 focus:outline-none"
            />
            <span className="text-[11px] text-neutral-400 tabular-nums shrink-0">
              {filteredPolicies.length} policies matching
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pagedPolicies.map(pol => (
              <div key={pol.id} className="border border-neutral-800 bg-neutral-950 p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-neutral-500 flex items-center gap-2">
                      <span>{pol.id}</span>
                      {pol.mfaRequired && (
                        <>
                          <span>·</span>
                          <span className="text-amber-400 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> MFA
                          </span>
                        </>
                      )}
                      {pol.ssoOnly && (
                        <>
                          <span>·</span>
                          <span className="text-sky-400">SSO ONLY</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm font-bold text-neutral-100 mt-0.5">{pol.name}</div>
                  </div>
                  <button
                    onClick={() => deleteIamPolicy(pol.id)}
                    className="p-1.5 border border-neutral-800 text-neutral-500 hover:text-rose-400"
                    title="Delete policy"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {pol.description && <p className="text-neutral-400 text-[11px]">{pol.description}</p>}
                <div className="border-t border-neutral-900 pt-2.5 text-[11px] text-neutral-300">
                  Scopes: {pol.permissions.join(' · ')}
                </div>
              </div>
            ))}
          </div>

          {totalPolicyPages > 1 && (
            <div className="flex items-center justify-between border border-neutral-800 bg-neutral-950 px-4 py-3 text-[11px]">
              <span className="text-neutral-400 tabular-nums">
                Page {safePolicyPage} of {totalPolicyPages} ({filteredPolicies.length} policies)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePolicyPage <= 1}
                  onClick={() => setPolicyPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 border border-neutral-800 bg-neutral-900 text-neutral-200 disabled:opacity-40 hover:bg-neutral-800"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={safePolicyPage >= totalPolicyPages}
                  onClick={() => setPolicyPage(p => Math.min(totalPolicyPages, p + 1))}
                  className="px-2.5 py-1.5 border border-neutral-800 bg-neutral-900 text-neutral-200 disabled:opacity-40 hover:bg-neutral-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COMPANY ID REGISTRY */}
      {activeTab === 'companies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companyGroups.map(grp => {
            const expanded = Boolean(expandedCompanies[grp.companyId]);
            const visibleAccounts = expanded ? grp.accounts : grp.accounts.slice(0, 8);
            return (
              <div key={grp.companyId} className="border border-neutral-800 bg-neutral-950 p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 gap-2">
                  <div className="flex items-center gap-2.5 font-bold text-neutral-100 min-w-0">
                    {grp.tenant?.companyLogoDataUrl ? (
                      <img
                        src={grp.tenant.companyLogoDataUrl}
                        alt={grp.tenant.name}
                        className="w-7 h-7 object-contain border border-neutral-800 bg-neutral-900 p-0.5 shrink-0"
                      />
                    ) : (
                      <Building2 className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                    <span className="truncate">{grp.companyId}</span>
                  </div>
                  <span className="text-neutral-500 tabular-nums shrink-0">{grp.accounts.length} IDs</span>
                </div>
                <div className="text-[11px] text-neutral-400">
                  Tenant Mapping: {grp.tenant ? `${grp.tenant.name} (${grp.tenant.domain})` : 'Custom External Company'}
                </div>
                <div className="space-y-1.5 pt-1 max-h-64 overflow-y-auto pr-1">
                  {visibleAccounts.map(acc => (
                    <div key={acc.id} className="flex items-center justify-between text-[11px] py-1 border-b border-neutral-900 gap-2">
                      <span className="text-neutral-200 truncate">{acc.name} ({acc.id})</span>
                      <span className="text-neutral-500 uppercase shrink-0">{acc.role}</span>
                    </div>
                  ))}
                </div>
                {grp.accounts.length > 8 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCompanies(prev => ({
                        ...prev,
                        [grp.companyId]: !prev[grp.companyId],
                      }))
                    }
                    className="w-full py-1.5 border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 text-[11px] font-semibold"
                  >
                    {expanded ? 'Show Less' : `View All ${grp.accounts.length} Users`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
