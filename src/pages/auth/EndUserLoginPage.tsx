import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { UserCheck, ArrowLeft, LogIn } from 'lucide-react';

export const EndUserLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { authAccounts, registerAccount, loginWithCredentials, loginAsTestAccount, loginViaGooglePortal, activeTenant, getPortalBranding } = useITSM();
  const endUserBrand = getPortalBranding('enduser');

  const endUsers = authAccounts.filter(a => a.portalType === 'end_user');
  const [mode, setMode] = useState<'login' | 'register'>(endUsers.length === 0 ? 'register' : 'login');

  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register') {
      const res = registerAccount('end_user', {
        name,
        email,
        password,
        department: department || 'General'
      });
      if (!res.ok) {
        setError(res.error || 'Registration failed.');
        return;
      }
    } else {
      const res = loginWithCredentials('end_user', email, password);
      if (!res.ok) {
        setError(res.error || 'Invalid email or password.');
        return;
      }
    }
    navigate('/portal');
  };

  const handleGooglePortal = async () => {
    setError('');
    const res = await loginViaGooglePortal('end_user');
    if (res.ok) {
      navigate('/portal');
    } else if (res.error) {
      setError(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 dot-matrix-bg font-mono text-xs flex flex-col justify-between p-4 sm:p-6 overflow-x-clip">
      <div className="max-w-md w-full mx-auto flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3.5 sm:pb-4">
        <Link to="/login" className="min-h-[36px] text-neutral-400 hover:text-white flex items-center gap-1.5 whitespace-nowrap">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Portals</span>
        </Link>
        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider truncate">
          {endUserBrand.portalName}
        </span>
      </div>

      <div className="max-w-md w-full mx-auto my-auto py-6 sm:py-8">
        <div className="border border-neutral-800 bg-neutral-950 p-5 sm:p-8 space-y-5 sm:space-y-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 text-emerald-400">
              {endUserBrand.logoDataUrl ? (
                <img
                  src={endUserBrand.logoDataUrl}
                  alt={`${endUserBrand.portalName} logo`}
                  referrerPolicy="no-referrer"
                  className="h-6 w-auto object-contain"
                />
              ) : (
                <UserCheck className="w-5 h-5" />
              )}
              <span className="text-[11px] font-bold uppercase tracking-widest">
                {endUserBrand.portalName}
              </span>
            </div>
            <h1 className="text-xl font-bold text-neutral-100">Self-Service Portal Login</h1>
            <p className="text-neutral-400">
              {endUserBrand.subtitle || 'Normal sign-in for end users to request catalogue items, report issues, and view ticket progress.'}
            </p>
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
              Create Account
            </button>
          </div>

          {error && (
            <div className="p-3 border border-rose-800 bg-rose-950/40 text-rose-300 text-[11px]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Full Name *</label>
                  <input
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Department</label>
                  <input
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-neutral-400 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={`you@${activeTenant.domain}`}
                className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Password *</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{mode === 'register' ? 'Create End-User Account' : 'Sign In to Self-Service Portal'}</span>
            </button>
          </form>

          <div className="border-t border-neutral-800 pt-4 space-y-2.5">
            <button
              type="button"
              onClick={() => {
                loginAsTestAccount('end_user');
                navigate('/portal');
              }}
              className="w-full py-2 border border-emerald-700/80 bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-300 font-bold uppercase tracking-wider"
            >
              Test Login (End User · user@njuretech.io)
            </button>
            <button
              type="button"
              onClick={handleGooglePortal}
              className="w-full py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-bold"
            >
              Sign in with Google
            </button>
          </div>

          <div className="border-t border-neutral-900 pt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] text-neutral-500">
            <Link to="/login/employee" className="hover:text-neutral-300">Employee / SSO &rarr;</Link>
            <Link to="/login/iam" className="hover:text-neutral-300">IAM Portal &rarr;</Link>
            <Link to="/login/admin" className="hover:text-neutral-300">Super Admin &rarr;</Link>
          </div>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto text-center text-[10px] text-neutral-500">
        {endUserBrand.portalName} · Powered by Scribble IT · Njure Tech
      </div>
    </div>
  );
};
