import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { authAccounts, registerAccount, loginWithCredentials, loginAsTestAccount, loginViaGooglePortal, activeTenant } = useITSM();

  const existingAdmins = authAccounts.filter(a => a.portalType === 'super_admin');
  const [mode, setMode] = useState<'login' | 'register'>(existingAdmins.length === 0 ? 'register' : 'login');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register') {
      const res = registerAccount('super_admin', {
        name,
        email,
        password,
        department: 'Platform Governance'
      });
      if (!res.ok) {
        setError(res.error || 'Registration failed.');
        return;
      }
    } else {
      const res = loginWithCredentials('super_admin', email, password);
      if (!res.ok) {
        setError(res.error || 'Invalid Super Admin credentials.');
        return;
      }
    }
    navigate('/watchtower');
  };

  const handleGoogleAdmin = async () => {
    setError('');
    const res = await loginViaGooglePortal('super_admin');
    if (res.ok) {
      navigate('/watchtower');
    } else if (res.error) {
      setError(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 dot-matrix-bg font-mono text-xs flex flex-col justify-between p-6">
      <div className="max-w-md w-full mx-auto flex items-center justify-between border-b border-neutral-800 pb-4">
        <Link to="/login" className="text-neutral-400 hover:text-white flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Portals</span>
        </Link>
        <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">SUPER ADMIN AUTH</span>
      </div>

      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div className="border border-neutral-800 bg-neutral-950 p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-rose-500">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-[11px] font-bold uppercase tracking-widest">NJURE TECH · SCRIBBLE IT</span>
            </div>
            <h1 className="text-xl font-bold text-neutral-100">Super Admin Login</h1>
            <p className="text-neutral-400">
              Required for Tenant Directory, Module Controls, Database Sync, and Root Governance.
            </p>
          </div>

          {/* Mode Switch */}
          <div className="grid grid-cols-2 border border-neutral-800">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`py-2 font-bold uppercase text-[11px] ${
                mode === 'login' ? 'bg-neutral-800 text-white' : 'bg-neutral-950 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`py-2 font-bold uppercase text-[11px] ${
                mode === 'register' ? 'bg-neutral-800 text-white' : 'bg-neutral-950 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Initialize Admin
            </button>
          </div>

          {error && (
            <div className="p-3 border border-rose-800 bg-rose-950/40 text-rose-300 text-[11px]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-neutral-400 mb-1">Administrator Name *</label>
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:border-rose-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-neutral-400 mb-1">Super Admin Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={`admin@${activeTenant.domain}`}
                className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Password *</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter root password"
                className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{mode === 'register' ? 'Create Super Admin & Enter' : 'Authenticate Super Admin'}</span>
            </button>
          </form>

          <div className="relative border-t border-neutral-800 pt-4 space-y-2.5">
            <button
              type="button"
              onClick={() => {
                loginAsTestAccount('super_admin');
                navigate('/watchtower');
              }}
              className="w-full py-2 border border-rose-700/80 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 font-bold flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <span>Test Login (Super Admin · admin@njuretech.io)</span>
            </button>
            <button
              type="button"
              onClick={handleGoogleAdmin}
              className="w-full py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-bold flex items-center justify-center gap-2"
            >
              <span>Sign in with Google Workspace Admin</span>
            </button>
          </div>

          <div className="border-t border-neutral-900 pt-3 flex items-center justify-between text-[11px] text-neutral-500">
            <Link to="/login/employee" className="hover:text-neutral-300">Employee SSO &rarr;</Link>
            <Link to="/login/portal" className="hover:text-neutral-300">Self-Service Login &rarr;</Link>
          </div>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto text-center text-[10px] text-neutral-600">
        {existingAdmins.length} Super Admin profile(s) registered in local workspace
      </div>
    </div>
  );
};
