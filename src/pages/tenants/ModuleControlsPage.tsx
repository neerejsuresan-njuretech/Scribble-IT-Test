import React from 'react';
import { Link } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { ALL_FREEITSM_MODULES } from '../../data/freeitsmSeedData';
import { Sliders, Check, X, ExternalLink, Lock } from 'lucide-react';

export const ModuleControlsPage: React.FC = () => {
  const { activeTenant, toggleTenantModule, isSuperAdmin } = useITSM();
  const groups = ['Command', 'ITSM', 'CMDB & Assets', 'Knowledge & Automation', 'Platform & Workspace'] as const;

  if (!isSuperAdmin) {
    return (
      <div className="border border-rose-900/70 bg-neutral-950 p-8 font-mono text-xs space-y-4 max-w-xl mx-auto mt-10">
        <div className="flex items-center gap-2 text-[10px] text-rose-500 uppercase font-bold tracking-wider">
          <Lock className="w-3.5 h-3.5" />
          <span>SUPER ADMIN PORTAL EXCLUSIVE</span>
        </div>
        <h2 className="text-base font-bold text-neutral-100">Module Governance Restricted</h2>
        <p className="text-neutral-400">
          Only authenticated Super Admin Portal sessions may toggle company module availability.
        </p>
        <Link
          to="/login/admin"
          className="inline-block px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase tracking-wider"
        >
          Sign In via Super Admin Portal
        </Link>
      </div>
    );
  }

  const enabledTotal = ALL_FREEITSM_MODULES.filter(m => activeTenant.enabledModules[m.id] !== false).length;

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">
            SYSTEM · MODULES · AVAILABILITY ({activeTenant.name}) <span className="text-rose-400 font-bold">· SUPER ADMIN EXCLUSIVE</span>
          </div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <Sliders className="w-5 h-5 text-rose-500" />
            <span>FREEITSM MODULE CONTROLS</span>
            <span className="text-xs font-normal text-neutral-400 tabular-nums">
              {enabledTotal} / {ALL_FREEITSM_MODULES.length} Enabled
            </span>
          </h1>
        </div>
        <Link
          to="/tenants"
          className="px-3.5 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 whitespace-nowrap shrink-0"
        >
          Manage Tenants
        </Link>
      </div>

      <div className="space-y-6">
        {groups.map(group => {
          const mods = ALL_FREEITSM_MODULES.filter(m => m.group === group);
          return (
            <div key={group} className="border border-neutral-800 bg-neutral-950">
              <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/50 font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                <span>{group}</span>
                <span className="text-neutral-500 font-normal tabular-nums">{mods.length} Modules</span>
              </div>
              <div className="divide-y divide-neutral-900">
                {mods.map(mod => {
                  const enabled = activeTenant.enabledModules[mod.id] !== false;
                  return (
                    <div key={mod.id} className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-neutral-900/30">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-100">{mod.label}</span>
                          <span className="text-neutral-500">·</span>
                          <span className="text-neutral-500">{mod.code}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {enabled && (
                          <Link
                            to={mod.path}
                            className="text-neutral-400 hover:text-neutral-100 flex items-center gap-1"
                            title={`Open ${mod.label}`}
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}

                        <button
                          onClick={() => toggleTenantModule(activeTenant.id, mod.id)}
                          className={`px-3 py-1.5 border font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                            enabled
                              ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/70'
                              : 'border-neutral-700 bg-neutral-900 text-neutral-500 hover:text-neutral-200'
                          }`}
                        >
                          {enabled ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          <span>{enabled ? 'Enabled' : 'Disabled'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
