import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { ShieldAlert, Laptop, UserCheck, Shield, ArrowRight, CheckCircle2, LogIn } from 'lucide-react';

export const PortalGatewayPage: React.FC = () => {
  const navigate = useNavigate();
  const { managedDevice, loginAsTestAccount } = useITSM();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 dot-matrix-bg font-mono text-xs flex flex-col justify-between p-6">
      <div className="max-w-3xl w-full mx-auto my-auto space-y-8">
        {/* Minimal Scribble IT Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-3">
            <span className="w-3.5 h-3.5 bg-rose-600 inline-block" />
            <h1 className="text-3xl sm:text-4xl font-bold tracking-[0.2em] text-neutral-100">
              SCRIBBLE IT
            </h1>
          </div>
          <div className="text-[11px] text-neutral-500 uppercase tracking-[0.25em]">
            NJURE TECH
          </div>
        </div>

        {/* Clean Login Options + Quick Test Login Buttons */}
        <div className="border border-neutral-800 bg-neutral-950/95 divide-y divide-neutral-800">
          <div className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-neutral-900/40 transition-colors">
            <Link to="/login/portal" className="group flex-1 flex items-center gap-4 min-w-[220px]">
              <UserCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-sm font-bold text-neutral-100 group-hover:text-white">
                  End-User Self-Service Portal
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Normal Login · Service Catalog &amp; Tickets
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  loginAsTestAccount('end_user');
                  navigate('/portal');
                }}
                className="px-3 py-1.5 border border-emerald-700/70 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 font-bold flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Test Login</span>
              </button>
              <Link
                to="/login/portal"
                className="flex items-center gap-1.5 text-emerald-400 font-bold hover:text-emerald-300 whitespace-nowrap"
              >
                <span>Login</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-neutral-900/40 transition-colors">
            <Link to="/login/employee" className="group flex-1 flex items-center gap-4 min-w-[220px]">
              <Laptop className="w-5 h-5 text-sky-400 shrink-0" />
              <div>
                <div className="text-sm font-bold text-neutral-100 group-hover:text-white flex items-center gap-2">
                  <span>Employee Login</span>
                  {managedDevice && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-normal">
                      <CheckCircle2 className="w-3 h-3" />
                      SSO Ready ({managedDevice.hostname})
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Credentials or Company Device SSO
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  loginAsTestAccount('employee');
                  navigate('/watchtower');
                }}
                className="px-3 py-1.5 border border-sky-700/70 bg-sky-950/40 hover:bg-sky-900/60 text-sky-300 font-bold flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Test Login</span>
              </button>
              <Link
                to="/login/employee"
                className="flex items-center gap-1.5 text-sky-400 font-bold hover:text-sky-300 whitespace-nowrap"
              >
                <span>Login / SSO</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-neutral-900/40 transition-colors">
            <Link to="/login/iam" className="group flex-1 flex items-center gap-4 min-w-[220px]">
              <Shield className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <div className="text-sm font-bold text-neutral-100 group-hover:text-white">
                  IAM Portal
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Identities · Company IDs · Roles &amp; Policies
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  loginAsTestAccount('iam');
                  navigate('/iam');
                }}
                className="px-3 py-1.5 border border-amber-700/70 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 font-bold flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Test Login</span>
              </button>
              <Link
                to="/login/iam"
                className="flex items-center gap-1.5 text-amber-400 font-bold hover:text-amber-300 whitespace-nowrap"
              >
                <span>IAM Login</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-neutral-900/40 transition-colors">
            <Link to="/login/admin" className="group flex-1 flex items-center gap-4 min-w-[220px]">
              <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <div className="text-sm font-bold text-neutral-100 group-hover:text-white">
                  Super Admin Login
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Tenant Governance · Portal Branding · Module Controls
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  loginAsTestAccount('super_admin');
                  navigate('/watchtower');
                }}
                className="px-3 py-1.5 border border-rose-700/70 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Test Login</span>
              </button>
              <Link
                to="/login/admin"
                className="flex items-center gap-1.5 text-rose-500 font-bold hover:text-rose-400 whitespace-nowrap"
              >
                <span>Admin Login</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl w-full mx-auto text-center text-[10px] text-neutral-500 uppercase tracking-widest">
        Powered by Scribble IT · NJURE TECH
      </div>
    </div>
  );
};
