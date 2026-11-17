import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { Shield, ArrowLeft, KeyRound } from 'lucide-react';

export const IamLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    authAccounts,
    registerAccount,
    loginWithCredentials,
    loginAsTestAccount,
    loginViaGooglePortal,
    activeTenant,
    getPortalBranding
  } = useITSM();

  const iamBrand = getPortalBranding('iam');
  const existingIam = authAccounts.filter(a => a.portalType === 'iam');
  const [mode, setMode] = useState<'login' | 'register'>(existingIam.length === 0 ? 'register' : 'login');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register') {
      const res = registerAccount('iam', {
        name,
        email,
        password,
        department: 'Identity & Access'
      });
      if (!res.ok) {
        setError(res.error || 'Registration failed.');
        return;
      }
    } else {
      const res = loginWithCredentials('iam', email, password);
      if (!res.ok) {
        setError(res.error || 'Invalid IAM credentials.');
        return;
      }
    }
    navigate('/iam');
  };

  const handleGoogleIam = async () => {
    setError('');
    const res = await loginViaGooglePortal('iam');
    if (res.ok) {
      navigate('/iam');
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
        <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">IAM PORTAL AUTH</span>
      </div>

      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div className="border border-neutral-800 bg-neutral-950 p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-amber-400">
              {iamBrand.logoDataUrl ? (
                <img
                  src={iamBrand.logoDataUrl}
                  alt={iamBrand.portalName}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 object-contain border border-neutral-800 bg-neutral-900 p-0.5 shrink-0"
                />
              ) : (
                <Shield className="w-5 h-5" />
              )}
              <span className="text-[11px] font-bold uppercase tracking-widest">
                {activeTenant.name}
              </span>
            </div>
            <h1 className="text-xl font-bold text-neutral-100">{iamBrand.portalName}</h1>
            <p className="text-neutral-400">{iamBrand.subtitle}</p>
          </div>

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
              Register Officer
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
                <label className="block text-neutral-400 mb-1">IAM Officer Name *</label>
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-neutral-400 mb-1">IAM Login Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={`iam@${activeTenant.domain}`}
                className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Password *</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter IAM password"
                className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{mode === 'register' ? 'Create IAM Account' : 'Sign In to IAM Portal'}</span>
            </button>
          </form>

          <div className="border-t border-neutral-800 pt-4 space-y-2.5">
            <button
              type="button"
              onClick={() => {
                loginAsTestAccount('iam');
                navigate('/iam');
              }}
              className="w-full py-2 border border-amber-700/80 bg-amber-950/30 hover:bg-amber-900/50 text-amber-300 font-bold uppercase tracking-wider"
            >
              Test Login (IAM · iam@njuretech.io)
            </button>
            <button
              type="button"
              onClick={handleGoogleIam}
              className="w-full py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-bold"
            >
              Sign in with Google Workspace
            </button>
          </div>

          <div className="border-t border-neutral-900 pt-3 flex items-center justify-between text-[11px] text-neutral-500">
            <Link to="/login/employee" className="hover:text-neutral-300">Employee SSO &rarr;</Link>
            <Link to="/login/admin" className="hover:text-neutral-300">Super Admin &rarr;</Link>
          </div>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto text-center text-[10px] text-neutral-500 uppercase tracking-widest">
        Powered by Scribble IT · Njure Tech
      </div>
    </div>
  );
};
