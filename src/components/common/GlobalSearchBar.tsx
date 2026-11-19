import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { Search, X, AlertTriangle, Package, Server, ShieldCheck, ArrowRight, Lock } from 'lucide-react';

interface SearchResultItem {
  id: string;
  group: 'Incidents' | 'Tickets & Requests' | 'Assets (CMDB)' | 'Problems & Changes';
  title: string;
  subtitle: string;
  status: string;
  path: string;
}

interface GlobalSearchBarProps {
  variant?: 'inline' | 'mobile-overlay';
  onResultSelected?: () => void;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  variant = 'inline',
  onResultSelected,
}) => {
  const navigate = useNavigate();
  const {
    role,
    currentUser,
    activeTenant,
    incidents,
    requests,
    assets,
    problems,
    changes,
    isModuleEnabled,
    hasPermission
  } = useITSM();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Access-controlled record sets derived strictly from context
  const accessibleData = useMemo(() => {
    const isCustomer = role === 'customer';

    const incPool =
      isModuleEnabled('incidents') && hasPermission('incidents:read')
        ? isCustomer
          ? incidents.filter(
              i =>
                i.requesterEmail.toLowerCase() === currentUser.email.toLowerCase() ||
                i.requesterName.toLowerCase() === currentUser.name.toLowerCase()
            )
          : incidents
        : [];

    const reqPool = isModuleEnabled('requests') || isCustomer
      ? isCustomer
        ? requests.filter(
            r =>
              r.requesterEmail.toLowerCase() === currentUser.email.toLowerCase() ||
              r.requesterName.toLowerCase() === currentUser.name.toLowerCase()
          )
        : requests
      : [];

    const assetPool =
      isModuleEnabled('assets') && hasPermission('assets:read')
        ? isCustomer
          ? assets.filter(
              a => (a.assignedTo || '').toLowerCase() === currentUser.name.toLowerCase()
            )
          : assets
        : [];

    const prbPool = !isCustomer && isModuleEnabled('problems') ? problems : [];
    const chgPool = !isCustomer && isModuleEnabled('changes') ? changes : [];

    return { incPool, reqPool, assetPool, prbPool, chgPool, isCustomer };
  }, [role, currentUser, incidents, requests, assets, problems, changes, isModuleEnabled, hasPermission]);

  const results = useMemo<SearchResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matches: SearchResultItem[] = [];

    accessibleData.incPool.forEach(inc => {
      const hay = `${inc.id} ${inc.title} ${inc.description} ${inc.category} ${inc.assignee} ${inc.affectedCI || ''}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: inc.id,
          group: 'Incidents',
          title: inc.title,
          subtitle: `${inc.priority} · ${inc.category} · ${inc.assignee}`,
          status: inc.status,
          path: accessibleData.isCustomer ? '/portal' : '/incidents'
        });
      }
    });

    accessibleData.reqPool.forEach(req => {
      const hay = `${req.id} ${req.catalogItemName} ${req.description} ${req.department} ${req.requesterName}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: req.id,
          group: 'Tickets & Requests',
          title: req.catalogItemName,
          subtitle: `${req.department} · Stage ${req.currentStage}/4`,
          status: req.status,
          path: accessibleData.isCustomer ? '/portal' : '/requests'
        });
      }
    });

    accessibleData.assetPool.forEach(ast => {
      const hay = `${ast.id} ${ast.assetTag} ${ast.name} ${ast.serialNumber} ${ast.ipAddress || ''} ${ast.model} ${ast.manufacturer} ${ast.type}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: ast.assetTag || ast.id,
          group: 'Assets (CMDB)',
          title: ast.name,
          subtitle: `${ast.type} · SN: ${ast.serialNumber}${ast.assignedTo ? ` · ${ast.assignedTo}` : ''}`,
          status: ast.status,
          path: accessibleData.isCustomer ? '/portal' : '/assets'
        });
      }
    });

    accessibleData.prbPool.forEach(prb => {
      const hay = `${prb.id} ${prb.title} ${prb.description} ${prb.rootCauseAnalysis}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: prb.id,
          group: 'Problems & Changes',
          title: prb.title,
          subtitle: `Problem · ${prb.severity}`,
          status: prb.status,
          path: '/problems'
        });
      }
    });

    accessibleData.chgPool.forEach(chg => {
      const hay = `${chg.id} ${chg.title} ${chg.type} ${chg.reason}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: chg.id,
          group: 'Problems & Changes',
          title: chg.title,
          subtitle: `Change (${chg.type}) · Risk ${chg.riskScore}`,
          status: chg.status,
          path: '/changes'
        });
      }
    });

    return matches.slice(0, 12);
  }, [query, accessibleData]);

  const handleSelectResult = (item: SearchResultItem) => {
    setIsOpen(false);
    setQuery('');
    onResultSelected?.();
    navigate(item.path);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) {
      handleSelectResult(results[0]);
      return;
    }

    const q = query.trim().toUpperCase();
    if (!q) return;

    if (role === 'customer') {
      navigate('/portal');
      setIsOpen(false);
      return;
    }

    if (q.includes('IAM') || q.includes('POLICY') || q.includes('IDENTITY')) navigate('/iam');
    else if (q.includes('TICKET WORKFLOW') || q.includes('TRIAGE')) navigate('/ticket-workflows');
    else if (q.includes('WORKFLOW') || q.startsWith('WF')) navigate('/workflows');
    else if (q.startsWith('INC') || q.includes('TICKET')) navigate('/incidents');
    else if (q.startsWith('REQ') || q.includes('CATALOG')) navigate('/requests');
    else if (q.startsWith('AST') || q.includes('ASSET')) navigate('/assets');
    else if (q.includes('TENANT') && role === 'admin') navigate('/tenants');
    else if (q.includes('MOD') && role === 'admin') navigate('/system/modules');
    else navigate('/incidents');

    setIsOpen(false);
    onResultSelected?.();
  };

  const renderGroupIcon = (group: SearchResultItem['group']) => {
    switch (group) {
      case 'Incidents':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'Tickets & Requests':
        return <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'Assets (CMDB)':
        return <Server className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      default:
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
  };

  const groups: SearchResultItem['group'][] = [
    'Incidents',
    'Tickets & Requests',
    'Assets (CMDB)',
    'Problems & Changes'
  ];

  const isMobileOverlay = variant === 'mobile-overlay';

  return (
    <div
      ref={containerRef}
      className={isMobileOverlay ? 'w-full relative' : 'hidden md:block flex-1 max-w-lg mx-2 relative'}
    >
      <form onSubmit={handleSubmit} className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          autoFocus={isMobileOverlay}
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              onResultSelected?.();
            }
          }}
          placeholder={
            role === 'customer'
              ? 'Search my tickets, requests & assigned devices...'
              : 'Search incidents, assets, tickets, CIs, workflows...'
          }
          className={`w-full bg-neutral-900/90 border border-neutral-800 text-neutral-200 pl-8 pr-9 text-xs focus:border-neutral-600 focus:outline-none placeholder:text-neutral-500 ${
            isMobileOverlay ? 'py-2.5 min-h-[44px]' : 'py-2'
          }`}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200 p-1"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>

      {isOpen && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-neutral-950 border border-neutral-800 shadow-2xl z-50 max-h-[26rem] overflow-y-auto font-mono text-xs">
          {/* Access Scope Header */}
          <div className="px-3 py-2 border-b border-neutral-800 bg-neutral-900/60 flex items-center justify-between text-[10px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-neutral-500" />
              <span>
                {accessibleData.isCustomer
                  ? `Access Scope: My Records Only (${currentUser.email})`
                  : `Tenant Scope: ${activeTenant.name} (${role.toUpperCase()})`}
              </span>
            </span>
            <span className="tabular-nums text-neutral-500">{results.length} matches</span>
          </div>

          {results.length === 0 ? (
            <div className="p-5 text-center space-y-1">
              <div className="text-neutral-300 font-bold">No Accessible Records Found</div>
              <div className="text-[11px] text-neutral-500">
                No matching incidents, tickets, or assets under your current access permissions.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-neutral-900">
              {groups.map(groupName => {
                const groupItems = results.filter(r => r.group === groupName);
                if (groupItems.length === 0) return null;
                return (
                  <div key={groupName} className="py-1">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      {groupName}
                    </div>
                    {groupItems.map(item => (
                      <button
                        key={`${groupName}-${item.id}`}
                        type="button"
                        onClick={() => handleSelectResult(item)}
                        className="w-full text-left px-3 py-2 hover:bg-neutral-900/90 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="mt-0.5">{renderGroupIcon(item.group)}</div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-neutral-100 font-bold truncate">
                              <span className="tabular-nums text-rose-400 shrink-0">{item.id}</span>
                              <span className="truncate">{item.title}</span>
                            </div>
                            <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                              {item.subtitle} · {item.status.toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
