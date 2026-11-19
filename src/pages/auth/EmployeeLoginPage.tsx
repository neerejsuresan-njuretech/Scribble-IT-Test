import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useITSM } from '../../context/ITSMContext';
import { Laptop, ShieldCheck, ArrowLeft, KeyRound, CheckCircle2, XCircle, Lock, ShieldAlert } from 'lucide-react';

export const EmployeeLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    authAccounts,
    managedDevice,
    isManagedDeviceVerified,
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

  // IAM-Verified Device Onboarding & SSO Controls
  const [showEnrollPanel, setShowEnrollPanel] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [enrollEmail, setEnrollEmail] = useState('');
  const [enrollHostname, setEnrollHostname] = useState('');
  const [enrollMdm, setEnrollMdm] = useState('Njure Endpoint Trust MDM');
  const [enrollError, setEnrollError] = useState('');
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
    const targetEmail = managedDevice?.enrolledByEmail || ssoEmail || undefined;
    const res = loginEmployeeDeviceSso(targetEmail, ssoName || undefined);
    if (!res.ok) {
      setError(res.error || 'Device SSO failed.');
      return;
    }
    navigate('/watchtower');
  };

  const handleEnrollDevice = (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError('');
    const res = enrollCompanyDevice(
      verificationCode,
      enrollHostname || undefined,
      enrollMdm || undefined,
      enrollEmail || undefined
    );
    if (!res.ok) {
      setEnrollError(res.error || 'IAM verification code was rejected.');
      return;
    }
    setVerificationCode('');
    setEnrollEmail('');
    setEnrollHostname('');
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 dot-matrix-bg font-mono text-xs flex flex-col justify-between p-4 sm:p-6 overflow-x-clip">
      <div className="max-w-4xl w-full mx-auto flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3.5 sm:pb-4">
        <Link to="/login" className="min-h-[36px] text-neutral-400 hover:text-white flex items-center gap-1.5 whitespace-nowrap">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Portals</span>
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          {empBrand.logoDataUrl && (
            <img
              src={empBrand.logoDataUrl}
              alt={`${empBrand.portalName} logo`}
              referrerPolicy="no-referrer"
              className="h-5 w-auto object-contain shrink-0"
            />
          )}
          <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider truncate">
            {empBrand.portalName} · {empBrand.subtitle}
          </span>
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto my-auto py-5 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left: Corporate Device Posture & IAM-Verified SSO Onboarding */}
        <div className="lg:col-span-6 border border-neutral-800 bg-neutral-950 p-4 sm:p-6 space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sky-400">
              <Laptop className="w-5 h-5" />
              <span className="text-[11px] font-bold uppercase tracking-widest">COMPANY DEVICE SSO</span>
            </div>
            <h2 className="text-lg font-bold text-neutral-100">Corporate Workstation Posture</h2>
            <p className="text-neutral-400">
              Only IAM-verified managed corporate workstations can authenticate via Company Device SSO. Unmanaged devices require a unique verification code issued by the IAM Team.
            </p>
          </div>

          {managedDevice && isManagedDeviceVerified ? (
            <div className="space-y-4 border border-emerald-800/70 bg-emerald-950/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>IAM-VERIFIED CORPORATE DEVICE · SSO ACTIVE</span>
                </div>
                <button
                  type="button"
                  onClick={unenrollCompanyDevice}
                  className="text-[10px] text-neutral-500 hover:text-rose-400 underline shrink-0"
                >
                  Clear Local Profile
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] border-t border-emerald-900/50 pt-3">
                <div>
                  <div className="text-neutral-500">Hostname</div>
                  <div className="text-neutral-100 font-bold">{managedDevice.hostname}</div>
                </div>
                <div>
                  <div className="text-neutral-500">Device ID</div>
                  <div className="text-neutral-100 tabular-nums">{managedDevice.deviceId}</div>
                </div>
                <div>
                  <div className="text-neutral-500">Company / Code</div>
                  <div className="text-neutral-200">{managedDevice.companyCode || managedDevice.domain}</div>
                </div>
                <div>
                  <div className="text-neutral-500">IAM Verification Code</div>
                  <div className="text-emerald-300 font-bold tabular-nums">{managedDevice.enrollmentCode || 'VERIFIED'}</div>
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

              {managedDevice.enrolledByEmail && (
                <div className="p-2.5 border border-emerald-900/60 bg-neutral-950/80 text-[11px] text-emerald-300 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>IAM-Bound Identity: <strong>{managedDevice.enrolledByEmail}</strong></span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <input
                  value={ssoName}
                  onChange={e => setSsoName(e.target.value)}
                  placeholder="Employee Name (optional)"
                  className="bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                />
                <input
                  type="email"
                  value={managedDevice.enrolledByEmail || ssoEmail}
                  disabled={Boolean(managedDevice.enrolledByEmail)}
                  onChange={e => setSsoEmail(e.target.value)}
                  placeholder={`Employee Email (@${managedDevice.domain})`}
                  className="bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-100 disabled:opacity-70"
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
            <div className="space-y-4 border border-amber-800/60 bg-neutral-900/40 p-4">
              {managedDevice && !isManagedDeviceVerified && (
                <div className="p-3 border border-rose-800 bg-rose-950/40 text-rose-300 text-[11px] flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold uppercase">Previous Device Certificate Revoked or Unverified</div>
                    <p className="mt-0.5 text-rose-200/80">
                      This browser holds an unverified or IAM-revoked profile. Enter a fresh IAM verification code below to re-establish managed trust.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>Unmanaged Device — Verification Code Required</span>
              </div>
              <p className="text-neutral-400 text-[11px] leading-relaxed">
                Zero-Trust Endpoint Governance blocks unmanaged devices from self-enrolling onto the corporate network or using SSO. Contact the <strong className="text-neutral-200">IAM Team</strong> to obtain a single-use verification code (<span className="text-amber-300">IAM-XXXX-XXXX</span>) generated exclusively in the IAM Portal.
              </p>

              {!showEnrollPanel ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEnrollPanel(true);
                      setEnrollError('');
                    }}
                    className="w-full py-2.5 border border-amber-700/80 bg-amber-950/30 hover:bg-amber-900/40 text-amber-200 font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Enter IAM Verification Code to Onboard Device</span>
                  </button>
                  <div className="text-[10px] text-neutral-500 text-center">
                    IAM Officer?{' '}
                    <Link to="/login/iam" className="text-amber-400 hover:underline">
                      Sign in to IAM Portal to generate a code &rarr;
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleEnrollDevice} className="space-y-3 border-t border-neutral-800 pt-3">
                  {enrollError && (
                    <div className="p-2.5 border border-rose-800 bg-rose-950/40 text-rose-300 text-[11px]">
                      {enrollError}
                    </div>
                  )}
                  <div>
                    <label className="block text-amber-300 font-bold mb-1">
                      Unique IAM Verification Code *
                    </label>
                    <input
                      required
                      value={verificationCode}
                      onChange={e => setVerificationCode(e.target.value.toUpperCase())}
                      placeholder="IAM-XXXX-XXXX"
                      className="w-full bg-neutral-950 border border-amber-700/80 px-3 py-2 text-neutral-100 uppercase tracking-[0.18em] font-bold focus:outline-none focus:border-amber-500"
                    />
                    <div className="text-[10px] text-neutral-500 mt-1">
                      Shared by the IAM Team from the IAM Portal &rarr; Device Trust &amp; SSO Codes.
                    </div>
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-1">
                      Corporate Employee Email (Required if code is user-bound)
                    </label>
                    <input
                      type="email"
                      value={enrollEmail}
                      onChange={e => setEnrollEmail(e.target.value)}
                      placeholder={`employee@${activeTenant.domain}`}
                      className="w-full bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-neutral-400 mb-1">Corporate Hostname</label>
                      <input
                        value={enrollHostname}
                        onChange={e => setEnrollHostname(e.target.value)}
                        placeholder={`${activeTenant.slug.toUpperCase()}-WS-01`}
                        className="w-full bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-100 uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">MDM Authority</label>
                      <input
                        value={enrollMdm}
                        onChange={e => setEnrollMdm(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-700 px-2.5 py-1.5 text-neutral-100"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEnrollPanel(false);
                        setEnrollError('');
                      }}
                      className="px-3 py-2 border border-neutral-700 text-neutral-400 hover:text-neutral-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold uppercase tracking-wider"
                    >
                      Verify Code &amp; Activate SSO
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right: Standard Employee Credential Login */}
        <div className="lg:col-span-6 border border-neutral-800 bg-neutral-950 p-4 sm:p-6 space-y-5">
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

          <div className="border-t border-neutral-900 pt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] text-neutral-500">
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
