import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { Laptop, ShieldCheck, ArrowLeft, KeyRound, CheckCircle2, XCircle } from 'lucide-react';

export const EmployeeLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    authAccounts,
    managedDevice,
    activeTenant,
    enrollCompanyDevice,
    unenrollCompanyDevice,
    loginEmployeeDeviceSso,
    loginWithCredentials,
    loginAsTestAccount,
    registerAccount,
    loginViaGooglePortal,
    getPortalBranding
  } = useITSM();

  const empBrand = getPortalBranding('employees');

  const employeeAccounts = authAccounts.filter(a => a.portalType === 'employee');
  const [mode, setMode] = useState<'login' | 'register'>(employeeAccounts.length === 0 ? 'register' : 'login');

  // Device SSO Controls
  const [showEnrollPanel, setShowEnrollPanel] = useState(false);
  const [enrollHostname, setEnrollHostname] = useState('');
  const [enrollMdm, setEnrollMdm] = useState('Njure Endpoint Trust MDM');
  const [ssoEmail, setSsoEmail] = useState('');
  const [ssoName, setSsoName] = useState('');

  // Standard Employee Credentials
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('IT Operations');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleDeviceSsoLogin = () => {
    setError('');
    const res = loginEmployeeDeviceSso(ssoEmail || undefined, ssoName || undefined);
    if (!res.ok) {
      setError(res.error || 'Device SSO failed.');
      return;
    }
    navigate('/watchtower');
  };

  const handleEnrollDevice = (e: React.FormEvent) => {
    e.preventDefault();
    enrollCompanyDevice(enrollHostname || undefined, enrollMdm || undefined);
    setShowEnrollPanel(false);
  };

  const handleCredentialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register') {
      const res = registerAccount('employee', { name, email, password, department });
      if (!res.ok) {
        setError(res.error || 'Employee registration failed.');
        return;
      }
    } else {
      const res = loginWithCredentials('employee', email, password);
      if (!res.ok) {
        setError(res.error || 'Invalid employee credentials.');
        return;
      }
    }
    navigate('/watchtower');
  };

  const handleGoogleEmployee = async () => {
    setError('');
    const res = await loginViaGooglePortal('employee');
    if (res.ok) {
      navigate('/watchtower');
    } else if (res.error) {
      setError(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 dot-matrix-bg font-mono text-xs flex flex-col justify-between p-6">
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between border-b border-neutral-800 pb-4">
        <Link to="/login" className="text-neutral-400 hover:text-white flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Portals</span>
        </Link>
        <div className="flex items-center gap-2.5">
          {empBrand.logoDataUrl && (
            <img
              src={empBrand.logoDataUrl}
              alt={`${empBrand.portalName} logo`}
              referrerPolicy="no-referrer"
              className="h-5 w-auto object-contain"
            />
          )}
          <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">
            {empBrand.portalName} · {empBrand.subtitle}
          </span>
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Company Device SSO Detection Panel */}
        <div className="lg:col-span-6 border border-neutral-800 bg-neutral-950 p-6 space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sky-400">
              <Laptop className="w-5 h-5" />
              <span className="text-[11px] font-bold uppercase tracking-widest">COMPANY DEVICE SSO</span>
            </div>
            <h2 className="text-lg font-bold text-neutral-100">Corporate Workstation Posture</h2>
            <p className="text-neutral-400">
              Employees logging in from an enrolled company device authenticate via device certificate SSO without entering a password.
            </p>
          </div>

          {managedDevice ? (
            <div className="space-y-4 border border-emerald-800/70 bg-emerald-950/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>MANAGED CORPORATE DEVICE VERIFIED</span>
                </div>
                <button
                  type="button"
                  onClick={unenrollCompanyDevice}
                  className="text-[10px] text-neutral-500 hover:text-rose-400 underline"
                >
                  Revoke Trust
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-emerald-900/50 pt-3">
                <div>
                  <div className="text-neutral-500">Hostname</div>
                  <div className="text-neutral-100 font-bold">{managedDevice.hostname}</div>
                </div>
                <div>
                  <div className="text-neutral-500">Device ID</div>
                  <div className="text-neutral-100 tabular-nums">{managedDevice.deviceId}</div>
                </div>
                <div>
                  <div className="text-neutral-500">MDM Authority</div>
                  <div className="text-neutral-300">{managedDevice.mdmProvider}</div>
                </div>
                <div>
                  <div className="text-neutral-500">Cert Thumbprint</div>
                  <div className="text-neutral-300 truncate">{managedDevice.certificateThumbprint}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <input
                  value={ssoName}
                  onChange={e => setSsoName(e.target.value)}
                  placeholder="Employee Name (optional)"
                  className="bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                />
                <input
                  type="email"
                  value={ssoEmail}
                  onChange={e => setSsoEmail(e.target.value)}
                  placeholder={`Employee Email (@${managedDevice.domain})`}
                  className="bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                />
              </div>

              <button
                type="button"
                onClick={handleDeviceSsoLogin}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Continue with Company Device SSO</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 border border-neutral-800 bg-neutral-900/40 p-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>Unmanaged / Personal Device Detected</span>
              </div>
              <p className="text-neutral-400 text-[11px]">
                No corporate MDM trust certificate was detected on this browser. Sign in with employee credentials on the right, or enroll this workstation as a managed company device.
              </p>

              {!showEnrollPanel ? (
                <button
                  type="button"
                  onClick={() => setShowEnrollPanel(true)}
                  className="w-full py-2 border border-neutral-700 bg-neutral-950 hover:bg-neutral-800 text-neutral-200 font-bold"
                >
                  Enroll This Workstation for Company SSO
                </button>
              ) : (
                <form onSubmit={handleEnrollDevice} className="space-y-2.5 border-t border-neutral-800 pt-3">
                  <div>
                    <label className="block text-neutral-400 mb-1">Corporate Hostname</label>
                    <input
                      value={enrollHostname}
                      onChange={e => setEnrollHostname(e.target.value)}
                      placeholder={`${activeTenant.slug.toUpperCase()}-WS-01`}
                      className="w-full bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-1">MDM Provider</label>
                    <input
                      value={enrollMdm}
                      onChange={e => setEnrollMdm(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEnrollPanel(false)}
                      className="px-3 py-1.5 border border-neutral-700 text-neutral-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold"
                    >
                      Issue Device Certificate
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right: Standard Employee Credential Login */}
        <div className="lg:col-span-6 border border-neutral-800 bg-neutral-950 p-6 space-y-5">
          <div className="space-y-1">
            <div className="text-[11px] text-neutral-500 uppercase">STANDARD EMPLOYEE CREDENTIALS</div>
            <h1 className="text-lg font-bold text-neutral-100">Employee Sign In</h1>
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
              Register Employee
            </button>
          </div>

          {error && (
            <div className="p-3 border border-rose-800 bg-rose-950/40 text-rose-300 text-[11px]">
              {error}
            </div>
          )}

          <form onSubmit={handleCredentialSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Full Name *</label>
                  <input
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Employee Name"
                    className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Department</label>
                  <input
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    placeholder="IT Operations"
                    className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-neutral-400 mb-1">Corporate Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={`engineer@${activeTenant.domain}`}
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
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{mode === 'register' ? 'Create Employee Account' : 'Sign In as Employee'}</span>
            </button>
          </form>

          <div className="border-t border-neutral-800 pt-4 space-y-2.5">
            <button
              type="button"
              onClick={() => {
                loginAsTestAccount('employee');
                navigate('/watchtower');
              }}
              className="w-full py-2 border border-sky-700/80 bg-sky-950/30 hover:bg-sky-900/50 text-sky-300 font-bold uppercase tracking-wider"
            >
              Test Login (Employee · employee@njuretech.io)
            </button>
            <button
              type="button"
              onClick={handleGoogleEmployee}
              className="w-full py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-bold"
            >
              Sign in with Google Workspace
            </button>
          </div>

          <div className="border-t border-neutral-900 pt-3 flex items-center justify-between text-[11px] text-neutral-500">
            <Link to="/login/iam" className="hover:text-neutral-300">IAM Portal &rarr;</Link>
            <Link to="/login/admin" className="hover:text-neutral-300">Super Admin &rarr;</Link>
            <Link to="/login/portal" className="hover:text-neutral-300">Self-Service &rarr;</Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto text-center text-[10px] text-neutral-500">
        {empBrand.portalName} · Powered by Scribble IT · Njure Tech
      </div>
    </div>
  );
};
