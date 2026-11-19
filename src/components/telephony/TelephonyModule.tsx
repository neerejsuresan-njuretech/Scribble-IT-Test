import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  Play,
  FilePlus,
  History,
  Settings2,
  Smartphone,
  QrCode,
  Cloud,
  Server,
  Globe,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  MessageSquare,
  Volume2,
  VolumeX,
  Delete,
  Radio,
  ShieldCheck,
  ExternalLink,
  Send,
  PhoneForwarded,
  Activity,
} from 'lucide-react';
import { useITSM } from '../../context/ITSMContext';
import type { TelephonyProviderConfig, TelephonyProviderType } from '../../types/itsm';
import { apiUrl, parseApiJson } from '../../utils/apiClient';

type TelephonyTab = 'dialer' | 'ccp' | 'mobile' | 'providers';

interface ServerTelephonyStatus {
  twilioConfigured: boolean;
  twilioFromNumber: string | null;
  webhookSecretConfigured: boolean;
  supportedProviders: TelephonyProviderType[];
}

interface ProviderPreset {
  type: TelephonyProviderType;
  label: string;
  tagline: string;
  category: 'cloud' | 'sip' | 'mobile';
  defaultEmbedHint?: string;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    type: 'amazon_connect',
    label: 'Amazon Connect',
    tagline: 'AWS Contact Center CCP v2 embedded softphone & queues',
    category: 'cloud',
    defaultEmbedHint: 'https://<instance-alias>.my.connect.aws/ccp-v2',
  },
  {
    type: 'twilio',
    label: 'Twilio Voice',
    tagline: 'Server-side Programmable Voice & two-leg carrier bridge',
    category: 'cloud',
  },
  {
    type: 'sip_webrtc',
    label: 'SIP / WebRTC Gateway',
    tagline: 'Asterisk, FreeSWITCH, 3CX, Kamailio, or Cisco via WSS',
    category: 'sip',
  },
  {
    type: 'ringcentral',
    label: 'RingCentral',
    tagline: 'RingCentral Embeddable CTI widget & outbound webhooks',
    category: 'cloud',
    defaultEmbedHint: 'https://ringcentral.github.io/ringcentral-embeddable/app.html',
  },
  {
    type: 'genesys',
    label: 'Genesys Cloud CX',
    tagline: 'Genesys Embeddable Framework & enterprise call queues',
    category: 'cloud',
    defaultEmbedHint: 'https://apps.mypurecloud.com/crm/index.html',
  },
  {
    type: 'custom_provider',
    label: 'Custom CTI Provider',
    tagline: 'Five9, Aircall, Vonage, Dialpad, or custom REST webhook',
    category: 'cloud',
    defaultEmbedHint: 'https://cti.your-provider.com/embed',
  },
  {
    type: 'personal_mobile',
    label: 'Personal Mobile System',
    tagline: 'Use any personal smartphone number as your helpdesk line',
    category: 'mobile',
  },
];

const AWS_CONNECT_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-2',
  'eu-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ca-central-1',
];

const DIALPAD_KEYS: Array<{ digit: string; letters: string }> = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

function sanitizeDialableNumber(raw: string): string {
  return raw.replace(/[^\d+*#]/g, '');
}

function formatDuration(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const TelephonyModule: React.FC = () => {
  const navigate = useNavigate();
  const {
    activeTenant,
    calls,
    activeCall,
    telephonyConfig,
    updateTelephonyConfig,
    startTelephonyCall,
    appendCallNote,
    simulateIncomingCall,
    answerIncomingCall,
    endTelephonyCall,
    toggleHoldCall,
    popTicketFromCall,
    showToast,
  } = useITSM();

  const [activeTab, setActiveTab] = useState<TelephonyTab>('dialer');

  // Softphone state
  const [dialNumber, setDialNumber] = useState('');
  const [callerNameInput, setCallerNameInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [dtmfMuted, setDtmfMuted] = useState(false);
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);
  const [showQrOnDialer, setShowQrOnDialer] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [callNoteDraft, setCallNoteDraft] = useState('');
  const [poppedTicketId, setPoppedTicketId] = useState<string | null>(null);
  const [bridgingCall, setBridgingCall] = useState(false);

  // Server telephony status
  const [serverStatus, setServerStatus] = useState<ServerTelephonyStatus | null>(null);

  // Provider configuration form draft
  const [draftConfig, setDraftConfig] = useState<TelephonyProviderConfig>(telephonyConfig);
  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<{ ok: boolean; detail: string; latencyMs?: number } | null>(null);

  // CCP state
  const [ccpReloadKey, setCcpReloadKey] = useState(0);
  const [ccpCallerNumber, setCcpCallerNumber] = useState('');
  const [ccpCallerName, setCcpCallerName] = useState('');
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // QR code data URLs
  const [dialerQrUrl, setDialerQrUrl] = useState<string | null>(null);
  const [mobileTestNumber, setMobileTestNumber] = useState('+14155550192');
  const [mobileQrUrl, setMobileQrUrl] = useState<string | null>(null);

  // Browser microphone check (Web Audio API)
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micRafRef = useRef<number | null>(null);
  const dtmfCtxRef = useRef<AudioContext | null>(null);

  // Sync draftConfig when tenant or saved telephonyConfig updates
  useEffect(() => {
    setDraftConfig(telephonyConfig);
  }, [telephonyConfig]);

  // Fetch server-side telephony bridge readiness
  useEffect(() => {
    let active = true;
    fetch(apiUrl('/api/telephony/status'))
      .then(res => (res.ok && (res.headers.get('content-type') || '').includes('application/json') ? res.json() : null))
      .then((data: ServerTelephonyStatus | null) => {
        if (active && data) setServerStatus(data);
      })
      .catch(() => {
        // Non-blocking
      });
    return () => {
      active = false;
    };
  }, []);

  // Live active call duration ticker
  useEffect(() => {
    if (!activeCall) {
      setLiveSeconds(0);
      setShowInCallKeypad(false);
      return;
    }
    setLiveSeconds(activeCall.durationSec);
    if (activeCall.status !== 'active') return;
    const timer = window.setInterval(() => {
      setLiveSeconds(prev => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeCall?.id, activeCall?.status]);

  // Generate QR code for dialer number
  const cleanDialNumber = useMemo(() => sanitizeDialableNumber(dialNumber), [dialNumber]);
  useEffect(() => {
    if (!cleanDialNumber || !showQrOnDialer) {
      setDialerQrUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(`tel:${cleanDialNumber}`, {
      width: 200,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(url => {
        if (!cancelled) setDialerQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDialerQrUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cleanDialNumber, showQrOnDialer]);

  // Generate QR code for Personal Mobile studio tab
  const cleanMobileTestNumber = useMemo(() => sanitizeDialableNumber(mobileTestNumber), [mobileTestNumber]);
  useEffect(() => {
    if (!cleanMobileTestNumber) {
      setMobileQrUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(`tel:${cleanMobileTestNumber}`, {
      width: 220,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(url => {
        if (!cancelled) setMobileQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setMobileQrUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cleanMobileTestNumber]);

  // Cleanup microphone & audio resources on unmount
  const stopMicTest = () => {
    if (micRafRef.current !== null) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (micAudioCtxRef.current) {
      micAudioCtxRef.current.close().catch(() => {});
      micAudioCtxRef.current = null;
    }
    setMicTesting(false);
    setMicLevel(0);
  };

  useEffect(() => {
    return () => {
      stopMicTest();
      if (dtmfCtxRef.current) {
        dtmfCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const playDtmfTone = (digit: string) => {
    if (dtmfMuted) return;
    const freqs = DTMF_FREQUENCIES[digit];
    if (!freqs) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!dtmfCtxRef.current || dtmfCtxRef.current.state === 'closed') {
        dtmfCtxRef.current = new AudioCtx();
      }
      const ctx = dtmfCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      gain.connect(ctx.destination);

      freqs.forEach(freq => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.14);
      });
    } catch {
      // Ignore audio autoplay blocks
    }
  };

  const toggleMicTest = async () => {
    if (micTesting) {
      stopMicTest();
      return;
    }
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Microphone API unavailable in this browser context.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      micAudioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setMicTesting(true);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        micRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'Microphone permission denied.');
      stopMicTest();
    }
  };

  const handleDialDigit = (digit: string) => {
    playDtmfTone(digit);
    if (activeCall) {
      appendCallNote(activeCall.id, `Sent DTMF tone: ${digit}`);
    } else {
      setDialNumber(prev => prev + digit);
    }
  };

  const handleStartSoftphoneCall = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!dialNumber.trim()) return;
    startTelephonyCall(dialNumber.trim(), callerNameInput.trim() || undefined);
    setDialNumber('');
    setCallerNameInput('');
    setShowQrOnDialer(false);
  };

  const handleNativeMobileCall = (targetNum: string, contactName?: string) => {
    const cleaned = sanitizeDialableNumber(targetNum);
    if (!cleaned) return;
    startTelephonyCall(cleaned, contactName?.trim() || undefined, {
      providerType: 'personal_mobile',
      providerLabel: 'Personal Mobile Carrier',
      initialNote: `Handed off to personal mobile native dialer (${telephonyConfig.personalMobileNumber || 'Device SIM'}) for ${cleaned}.`,
    });
    showToast({
      variant: 'info',
      title: 'Personal mobile dialer launched',
      description: 'Active ITSM call session opened for live notes and 1-click ticket pop.',
    });
  };

  const handleServerBridgeCall = async (targetNum: string, contactName?: string) => {
    const cleaned = sanitizeDialableNumber(targetNum);
    if (!cleaned) return;
    setBridgingCall(true);
    try {
      const response = await fetch(apiUrl('/api/telephony/bridge-call'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerType: telephonyConfig.providerType,
          targetNumber: cleaned,
          personalMobileNumber: telephonyConfig.personalMobileNumber || undefined,
          callerName: contactName?.trim() || undefined,
          tenantName: activeTenant.name,
          outboundWebhookUrl: telephonyConfig.outboundWebhookUrl || undefined,
        }),
      });
      const payload = await parseApiJson<{
        ok?: boolean;
        message?: string;
        callSid?: string;
        status?: string;
        error?: string;
      }>(response, 'Carrier Call Bridge');
      if (!response.ok || !payload.ok) {
        showToast({
          variant: 'error',
          title: 'Carrier bridge unavailable',
          description: payload.error || 'Could not dispatch outbound bridge call.',
        });
        return;
      }

      const created = startTelephonyCall(cleaned, contactName?.trim() || undefined, {
        providerType: telephonyConfig.providerType,
        providerLabel: telephonyConfig.providerLabel,
        initialNote: `${payload.message || 'Server carrier bridge initiated.'}${payload.callSid ? ` [SID: ${payload.callSid}]` : ''}`,
      });
      if (payload.status) {
        appendCallNote(created.id, `Carrier state: ${payload.status.toUpperCase()}`);
      }
      showToast({
        variant: 'success',
        title: 'Carrier bridge initiated',
        description: payload.message || `Bridging call to ${cleaned}`,
      });
      setDialNumber('');
      setCallerNameInput('');
    } catch (err) {
      showToast({
        variant: 'error',
        title: 'Bridge network error',
        description: err instanceof Error ? err.message : 'Unable to reach telephony server.',
      });
    } finally {
      setBridgingCall(false);
    }
  };

  const handleAppendNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCall || !callNoteDraft.trim()) return;
    appendCallNote(activeCall.id, callNoteDraft.trim());
    setCallNoteDraft('');
  };

  const handlePopTicket = (callId: string) => {
    const newInc = popTicketFromCall(callId);
    setPoppedTicketId(newInc.id);
  };

  const resolvedCcpUrl = useMemo(() => {
    if (telephonyConfig.providerType === 'amazon_connect') {
      if (telephonyConfig.amazonConnectCcpUrl?.trim()) {
        return telephonyConfig.amazonConnectCcpUrl.trim();
      }
      if (telephonyConfig.amazonConnectInstanceAlias?.trim()) {
        return `https://${telephonyConfig.amazonConnectInstanceAlias.trim()}.my.connect.aws/ccp-v2`;
      }
      return '';
    }
    return telephonyConfig.customCtiEmbedUrl?.trim() || '';
  }, [telephonyConfig]);

  const canUseServerBridge = Boolean(
    serverStatus?.twilioConfigured || telephonyConfig.outboundWebhookUrl?.trim()
  );

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const copyText = (value: string, key: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    if (key === 'origin') {
      setCopiedOrigin(true);
      window.setTimeout(() => setCopiedOrigin(false), 1800);
    } else {
      setCopiedCode(key);
      window.setTimeout(() => setCopiedCode(null), 1800);
    }
    showToast({ variant: 'info', title: 'Copied to clipboard', description: value });
  };

  const selectProviderPreset = (preset: ProviderPreset) => {
    setConnResult(null);
    setDraftConfig(prev => ({
      ...prev,
      providerType: preset.type,
      providerLabel: preset.label,
      personalMobileEnabled: preset.type === 'personal_mobile' ? true : prev.personalMobileEnabled,
    }));
  };

  const handleSaveProviderConfig = (e?: React.FormEvent) => {
    e?.preventDefault();
    updateTelephonyConfig(draftConfig);
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    setConnResult(null);
    try {
      let endpointUrl = '';
      if (draftConfig.providerType === 'amazon_connect') {
        endpointUrl = draftConfig.amazonConnectCcpUrl?.trim() || '';
      } else if (draftConfig.providerType === 'sip_webrtc') {
        endpointUrl = draftConfig.sipWssUrl?.trim() || '';
      } else if (
        draftConfig.providerType === 'ringcentral' ||
        draftConfig.providerType === 'genesys' ||
        draftConfig.providerType === 'custom_provider'
      ) {
        endpointUrl = draftConfig.outboundWebhookUrl?.trim() || draftConfig.customCtiEmbedUrl?.trim() || '';
      } else if (draftConfig.providerType === 'personal_mobile') {
        if (!draftConfig.personalMobileNumber?.trim()) {
          setConnResult({ ok: false, detail: 'Enter your personal mobile number (E.164 format, e.g. +14155550199).' });
          setTestingConn(false);
          return;
        }
        setConnResult({
          ok: true,
          latencyMs: 1,
          detail: `Personal mobile line ${draftConfig.personalMobileNumber} validated for ${
            draftConfig.personalMobileBridgeMode === 'carrier_two_leg'
              ? serverStatus?.twilioConfigured
                ? 'Server Two-Leg Carrier Bridge (Twilio Ready)'
                : 'Two-Leg Bridge (configure Twilio secrets in Settings > Secrets, or switch to Native Dialer / QR)'
              : draftConfig.personalMobileBridgeMode === 'qr_handoff'
              ? 'Desktop-to-Mobile QR Scan-to-Call'
              : 'Native Carrier Dialer (tel:/sms:) + Live CTI Logging'
          }.`,
        });
        setTestingConn(false);
        return;
      }

      const res = await fetch(apiUrl('/api/telephony/test-connection'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerType: draftConfig.providerType,
          endpointUrl,
          amazonConnectInstanceAlias: draftConfig.amazonConnectInstanceAlias,
          amazonConnectRegion: draftConfig.amazonConnectRegion,
        }),
      });
      const data = await parseApiJson<{ ok?: boolean; detail?: string; error?: string; latencyMs?: number }>(
        res,
        'Telephony Connection Probe'
      );
      if (!res.ok || !data.ok) {
        setConnResult({
          ok: false,
          latencyMs: data.latencyMs,
          detail: data.error || 'Provider endpoint verification failed.',
        });
      } else {
        setConnResult({
          ok: true,
          latencyMs: data.latencyMs,
          detail: data.detail || 'Provider reachable and verified.',
        });
      }
    } catch (err) {
      setConnResult({
        ok: false,
        detail: err instanceof Error ? err.message : 'Network error while probing provider.',
      });
    } finally {
      setTestingConn(false);
    }
  };

  const handleCcpScreenPop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ccpCallerNumber.trim()) return;
    const call = startTelephonyCall(ccpCallerNumber.trim(), ccpCallerName.trim() || undefined, {
      providerType: telephonyConfig.providerType,
      providerLabel: telephonyConfig.providerLabel,
      initialNote: `Synchronized live call from embedded ${telephonyConfig.providerLabel} CCP.`,
    });
    const inc = popTicketFromCall(call.id);
    setPoppedTicketId(inc.id);
    setCcpCallerNumber('');
    setCcpCallerName('');
  };

  const deskForwardDigits = sanitizeDialableNumber(telephonyConfig.forwardToDeskNumber || '+18005550199');
  const personalMobileDigits = sanitizeDialableNumber(telephonyConfig.personalMobileNumber || '+14155550144');
  const forwardToDeskCode = `*21*${deskForwardDigits}#`;
  const forwardToMobileCode = `*21*${personalMobileDigits}#`;
  const cancelForwardCode = '#21#';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div className="space-y-1">
          <div className="text-[11px] font-mono-strict text-neutral-500 uppercase tracking-wider">
            {activeTenant.name} // OMNICHANNEL CTI TELEPHONY
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-neutral-100 tracking-tight">
              Telephony Softphone &amp; Carrier Hub
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-mono-strict border border-emerald-700/60 bg-emerald-950/40 text-emerald-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              <span>{telephonyConfig.providerLabel}</span>
            </span>
            {telephonyConfig.personalMobileEnabled && telephonyConfig.personalMobileNumber && (
              <span className="px-2 py-0.5 text-[11px] font-mono-strict border border-sky-700/60 bg-sky-950/30 text-sky-300 flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                <span className="tabular-nums">{telephonyConfig.personalMobileNumber}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={simulateIncomingCall}
            className="px-3.5 py-2 min-h-[40px] text-xs font-semibold border border-emerald-600 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 transition-colors flex items-center gap-2"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Test Inbound Call</span>
          </button>
          <button
            onClick={() => setActiveTab('providers')}
            className="px-3.5 py-2 min-h-[40px] text-xs font-semibold border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors flex items-center gap-2"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Connect Provider</span>
          </button>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-800 overflow-x-auto pb-px">
        {[
          { id: 'dialer' as const, label: 'Softphone & Dialer', icon: Phone },
          { id: 'ccp' as const, label: 'Amazon Connect / Provider CCP', icon: Cloud },
          { id: 'mobile' as const, label: 'Personal Mobile System', icon: Smartphone },
          { id: 'providers' as const, label: 'Provider Connectors', icon: Server },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap flex items-center gap-2 border-b-2 transition-colors ${
                active
                  ? 'border-neutral-100 text-neutral-100 bg-neutral-900/60'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ======================================================= */}
      {/* TAB 1: SOFTPHONE & DIALER                               */}
      {/* ======================================================= */}
      {activeTab === 'dialer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Softphone Instrument Console */}
          <div className="lg:col-span-5 border border-neutral-800 bg-neutral-950 p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-neutral-200 uppercase truncate">
                  {telephonyConfig.providerLabel}
                </div>
                <div className="text-[11px] font-mono-strict text-neutral-500 truncate">
                  {telephonyConfig.providerType === 'amazon_connect'
                    ? `AWS ${telephonyConfig.amazonConnectRegion || 'us-east-1'} · ${telephonyConfig.amazonConnectInstanceAlias || 'Instance Unset'}`
                    : telephonyConfig.providerType === 'personal_mobile'
                    ? `Mobile Endpoint · ${telephonyConfig.personalMobileNumber || 'Configure Number'}`
                    : `EXT #${telephonyConfig.sipExtension || '4401'} · ${telephonyConfig.sipDomain || activeTenant.domain}`}
                </div>
              </div>
              <button
                onClick={() => setDtmfMuted(prev => !prev)}
                title={dtmfMuted ? 'Unmute keypad DTMF tones' : 'Mute keypad DTMF tones'}
                className="p-2 border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                {dtmfMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* LCD Call Screen */}
            <div className="p-4 border border-neutral-800 bg-neutral-900/60 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono-strict text-neutral-500">
                <span className="truncate">
                  {activeCall ? `${activeCall.direction.toUpperCase()} // ${activeCall.providerLabel || telephonyConfig.providerLabel}` : 'LINE 01 // READY'}
                </span>
                <span className="tabular-nums text-neutral-300 font-semibold">
                  {activeCall ? formatDuration(liveSeconds) : '00:00 IDLE'}
                </span>
              </div>

              {activeCall ? (
                <div className="space-y-1">
                  <div className="text-sm font-bold text-neutral-100 truncate">
                    {activeCall.callerName}
                  </div>
                  <div className="text-base font-mono-strict text-neutral-200 tabular-nums">
                    {activeCall.callerNumber}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-neutral-400 truncate">{activeCall.callerCompany}</span>
                    <span
                      className={`text-[10px] font-mono-strict font-bold uppercase px-1.5 py-0.5 border ${
                        activeCall.status === 'active'
                          ? 'border-emerald-700 bg-emerald-950/50 text-emerald-300'
                          : activeCall.status === 'ringing'
                          ? 'border-amber-600 bg-amber-950/50 text-amber-300'
                          : 'border-sky-700 bg-sky-950/50 text-sky-300'
                      }`}
                    >
                      {activeCall.status}
                    </span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleStartSoftphoneCall} className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="tel"
                      value={dialNumber}
                      onChange={e => setDialNumber(e.target.value)}
                      placeholder="+1 (415) 555-0199 or ext"
                      className="w-full bg-transparent text-base font-mono-strict text-neutral-100 placeholder:text-neutral-600 focus:outline-none tabular-nums"
                    />
                    {dialNumber && (
                      <button
                        type="button"
                        onClick={() => setDialNumber(prev => prev.slice(0, -1))}
                        aria-label="Backspace digit"
                        className="p-1.5 text-neutral-400 hover:text-neutral-200"
                      >
                        <Delete className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={callerNameInput}
                    onChange={e => setCallerNameInput(e.target.value)}
                    placeholder="Optional caller / contact name..."
                    className="w-full bg-neutral-950/70 border border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
                  />
                </form>
              )}
            </div>

            {/* Active Call Controls OR Dialpad */}
            {activeCall ? (
              <div className="space-y-3">
                {activeCall.status === 'ringing' ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={answerIncomingCall}
                      className="min-h-[44px] py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Answer Call</span>
                    </button>
                    <button
                      onClick={endTelephonyCall}
                      className="min-h-[44px] py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-colors"
                    >
                      <PhoneOff className="w-4 h-4" />
                      <span>Decline</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`min-h-[52px] p-2 border transition-colors flex flex-col items-center justify-center gap-1 ${
                          isMuted
                            ? 'border-amber-500 bg-amber-950/40 text-amber-300'
                            : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                        }`}
                      >
                        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        <span className="text-[10px]">{isMuted ? 'Muted' : 'Mute'}</span>
                      </button>

                      <button
                        onClick={toggleHoldCall}
                        className={`min-h-[52px] p-2 border transition-colors flex flex-col items-center justify-center gap-1 ${
                          activeCall.status === 'held'
                            ? 'border-amber-500 bg-amber-950/40 text-amber-300'
                            : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                        }`}
                      >
                        {activeCall.status === 'held' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        <span className="text-[10px]">{activeCall.status === 'held' ? 'Resume' : 'Hold'}</span>
                      </button>

                      <button
                        onClick={() => setShowInCallKeypad(prev => !prev)}
                        className={`min-h-[52px] p-2 border transition-colors flex flex-col items-center justify-center gap-1 ${
                          showInCallKeypad
                            ? 'border-sky-500 bg-sky-950/40 text-sky-300'
                            : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                        }`}
                      >
                        <Radio className="w-4 h-4" />
                        <span className="text-[10px]">DTMF</span>
                      </button>

                      <button
                        onClick={endTelephonyCall}
                        className="min-h-[52px] p-2 border border-rose-900 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 transition-colors flex flex-col items-center justify-center gap-1"
                      >
                        <PhoneOff className="w-4 h-4" />
                        <span className="text-[10px]">Hang Up</span>
                      </button>
                    </div>

                    {showInCallKeypad && (
                      <div className="grid grid-cols-3 gap-1.5 p-2 border border-neutral-800 bg-neutral-900/40">
                        {DIALPAD_KEYS.map(key => (
                          <button
                            key={key.digit}
                            type="button"
                            onClick={() => handleDialDigit(key.digit)}
                            className="py-2 border border-neutral-800 bg-neutral-950 hover:bg-neutral-800 text-neutral-200 font-mono-strict text-xs font-bold"
                          >
                            {key.digit}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* CTI Ticket Pop & SMS Follow-up */}
                    <div className="p-3 border border-neutral-800 bg-neutral-900/40 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400 font-medium">CTI Ticket Screen-Pop</span>
                        {poppedTicketId && (
                          <button
                            onClick={() => navigate('/incidents')}
                            className="text-emerald-400 hover:underline font-mono-strict font-bold"
                          >
                            {poppedTicketId} Created
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          onClick={() => handlePopTicket(activeCall.id)}
                          className="min-h-[40px] px-3 py-2 bg-neutral-100 hover:bg-white text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                        >
                          <FilePlus className="w-4 h-4" />
                          <span>Pop Ticket from Call</span>
                        </button>
                        <a
                          href={`sms:${sanitizeDialableNumber(activeCall.callerNumber)}`}
                          className="min-h-[40px] px-3 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>SMS Follow-Up</span>
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* 3x4 DTMF Keypad */}
                <div className="grid grid-cols-3 gap-2">
                  {DIALPAD_KEYS.map(item => (
                    <button
                      key={item.digit}
                      type="button"
                      onClick={() => handleDialDigit(item.digit)}
                      className="min-h-[48px] py-2 border border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800 active:scale-[0.98] text-neutral-100 transition-all flex flex-col items-center justify-center"
                    >
                      <span className="text-sm font-mono-strict font-bold leading-none">{item.digit}</span>
                      {item.letters && (
                        <span className="text-[9px] font-mono-strict text-neutral-500 mt-1 tracking-widest">
                          {item.letters}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Primary Dial Actions */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDialNumber('');
                        setCallerNameInput('');
                        setShowQrOnDialer(false);
                      }}
                      className="px-3 min-h-[42px] border border-neutral-800 text-neutral-400 hover:text-neutral-200 text-xs font-medium"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartSoftphoneCall()}
                      disabled={!cleanDialNumber}
                      className="flex-1 min-h-[42px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Place CTI Call</span>
                    </button>
                  </div>

                  {/* Personal Mobile Carrier Handoff & QR Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cleanDialNumber ? (
                      <a
                        href={`tel:${cleanDialNumber}`}
                        onClick={() => handleNativeMobileCall(cleanDialNumber, callerNameInput)}
                        className="min-h-[40px] px-3 py-2 border border-sky-700/70 bg-sky-950/30 hover:bg-sky-900/40 text-sky-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Dial via Personal Mobile</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="min-h-[40px] px-3 py-2 border border-neutral-800 bg-neutral-900/40 text-neutral-600 text-xs font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Dial via Personal Mobile</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={!cleanDialNumber}
                      onClick={() => setShowQrOnDialer(prev => !prev)}
                      className={`min-h-[40px] px-3 py-2 border text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 ${
                        showQrOnDialer
                          ? 'border-neutral-400 bg-neutral-800 text-neutral-100'
                          : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>{showQrOnDialer ? 'Hide Phone QR' : 'Scan-to-Call QR'}</span>
                    </button>
                  </div>

                  {/* Optional Server Two-Leg Carrier Bridge Action */}
                  {canUseServerBridge && (
                    <button
                      type="button"
                      disabled={!cleanDialNumber || bridgingCall}
                      onClick={() => handleServerBridgeCall(cleanDialNumber, callerNameInput)}
                      className="w-full min-h-[40px] px-3 py-2 border border-amber-700/70 bg-amber-950/30 hover:bg-amber-900/40 disabled:opacity-40 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <PhoneForwarded className="w-3.5 h-3.5" />
                      <span>
                        {bridgingCall
                          ? 'Bridging via Carrier...'
                          : serverStatus?.twilioConfigured
                          ? `Bridge via Twilio (${telephonyConfig.personalMobileNumber || 'Direct'})`
                          : 'Dispatch via Provider Webhook'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Inline Desktop-to-Mobile QR Code */}
                {showQrOnDialer && dialerQrUrl && (
                  <div className="p-3.5 border border-neutral-700 bg-neutral-900/70 flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={dialerQrUrl}
                      alt={`Scan to dial ${cleanDialNumber}`}
                      className="w-28 h-28 bg-white p-1 border border-neutral-700 shrink-0"
                    />
                    <div className="space-y-1.5 text-center sm:text-left">
                      <div className="text-xs font-bold text-neutral-100">
                        Scan with Personal Mobile Camera
                      </div>
                      <div className="text-[11px] font-mono-strict text-neutral-400">
                        tel:{cleanDialNumber}
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        Places the call from your personal smartphone while keeping this console open for notes.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleNativeMobileCall(cleanDialNumber, callerNameInput)}
                        className="px-2.5 py-1 text-[11px] border border-emerald-700 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50"
                      >
                        Start Tracking Session Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Real Browser Microphone Diagnostics */}
            <div className="pt-3 border-t border-neutral-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono-strict text-neutral-400 uppercase flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-neutral-500" />
                  <span>WebRTC Audio Check</span>
                </span>
                <button
                  type="button"
                  onClick={toggleMicTest}
                  className={`px-2.5 py-1 text-[11px] font-medium border transition-colors ${
                    micTesting
                      ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  {micTesting ? 'Stop Mic Test' : 'Test Microphone'}
                </button>
              </div>
              {micTesting && (
                <div className="space-y-1">
                  <div className="h-2 w-full bg-neutral-900 border border-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-75"
                      style={{ width: `${Math.max(4, micLevel)}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-mono-strict text-neutral-500 flex justify-between">
                    <span>MIC INPUT ACTIVE</span>
                    <span className="tabular-nums">{micLevel}%</span>
                  </div>
                </div>
              )}
              {micError && (
                <div className="text-[11px] text-amber-400">{micError}</div>
              )}
            </div>
          </div>

          {/* Right Column: Live Call Notes/Transcript & CDR History */}
          <div className="lg:col-span-7 space-y-6">
            {/* Active Call Live Notes & Transcript */}
            {activeCall && (
              <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-neutral-100 uppercase tracking-wide">
                      Live Call Session Log &amp; Agent Notes
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-strict text-neutral-500">
                    {activeCall.providerLabel || telephonyConfig.providerLabel}
                  </span>
                </div>

                <div className="p-3.5 bg-neutral-900/40 border border-neutral-800 space-y-2 text-xs max-h-52 overflow-y-auto font-mono-strict">
                  {activeCall.liveTranscript.map((line, idx) => (
                    <div key={idx} className="text-neutral-300 leading-relaxed">
                      {line}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAppendNote} className="flex gap-2">
                  <input
                    type="text"
                    value={callNoteDraft}
                    onChange={e => setCallNoteDraft(e.target.value)}
                    placeholder="Log troubleshooting note, callback number, or issue summary..."
                    className="flex-1 bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600"
                  />
                  <button
                    type="submit"
                    disabled={!callNoteDraft.trim()}
                    className="px-3.5 py-2 bg-neutral-100 hover:bg-white disabled:opacity-40 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Log</span>
                  </button>
                </form>
              </div>
            )}

            {/* Quick Provider Status Strip when Idle */}
            {!activeCall && (
              <div className="border border-neutral-800 bg-neutral-950 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 border border-neutral-800/80 bg-neutral-900/40 space-y-1">
                  <div className="text-[10px] font-mono-strict text-neutral-500 uppercase">Active Connector</div>
                  <div className="text-xs font-bold text-neutral-100 truncate">{telephonyConfig.providerLabel}</div>
                  <button
                    onClick={() => setActiveTab('providers')}
                    className="text-[11px] text-sky-400 hover:underline"
                  >
                    Switch provider →
                  </button>
                </div>
                <div className="p-3 border border-neutral-800/80 bg-neutral-900/40 space-y-1">
                  <div className="text-[10px] font-mono-strict text-neutral-500 uppercase">Personal Mobile Line</div>
                  <div className="text-xs font-bold font-mono-strict text-neutral-100 truncate tabular-nums">
                    {telephonyConfig.personalMobileNumber || 'Not Linked'}
                  </div>
                  <button
                    onClick={() => setActiveTab('mobile')}
                    className="text-[11px] text-sky-400 hover:underline"
                  >
                    Configure mobile →
                  </button>
                </div>
                <div className="p-3 border border-neutral-800/80 bg-neutral-900/40 space-y-1">
                  <div className="text-[10px] font-mono-strict text-neutral-500 uppercase">Server Carrier Bridge</div>
                  <div className="text-xs font-bold text-neutral-100">
                    {serverStatus?.twilioConfigured
                      ? 'Twilio Ready'
                      : telephonyConfig.outboundWebhookUrl
                      ? 'Webhook Ready'
                      : 'Client Handoff Mode'}
                  </div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    {serverStatus?.twilioFromNumber || 'Native tel: & QR active'}
                  </div>
                </div>
              </div>
            )}

            {/* Historical Call Detail Records (CDR) */}
            <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-200 uppercase">
                  <History className="w-4 h-4 text-neutral-400" />
                  <span>Call Detail Records (CDR)</span>
                </div>
                <span className="text-xs font-mono-strict text-neutral-500 tabular-nums">
                  {calls.length} logged sessions
                </span>
              </div>

              <div className="divide-y divide-neutral-800/80">
                {calls.length === 0 ? (
                  <div className="py-8 text-center text-neutral-500 text-xs">
                    No call detail records logged yet. Dial out via Softphone, Personal Mobile, or test an inbound call.
                  </div>
                ) : (
                  calls.map(call => (
                    <div
                      key={call.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-neutral-100">{call.callerName}</span>
                          <span className="text-neutral-600">·</span>
                          <span className="text-neutral-300 font-mono-strict tabular-nums">{call.callerNumber}</span>
                          {call.providerLabel && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono-strict border border-neutral-800 bg-neutral-900 text-neutral-400">
                              {call.providerLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-neutral-500 text-[11px] flex flex-wrap items-center gap-2">
                          <span>{call.callerCompany}</span>
                          <span>·</span>
                          <span className="uppercase">{call.direction}</span>
                          <span>·</span>
                          <span className="font-mono-strict tabular-nums">
                            {new Date(call.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-left sm:text-right">
                          <div className="text-neutral-200 font-mono-strict tabular-nums font-bold">
                            {Math.floor(call.durationSec / 60)}m {call.durationSec % 60}s
                          </div>
                          <div className="text-[10px] font-mono-strict text-neutral-500 uppercase">
                            {call.disposition || call.status}
                          </div>
                        </div>

                        {call.relatedTicketId ? (
                          <button
                            onClick={() => navigate('/incidents')}
                            className="px-2.5 py-1.5 text-[11px] font-mono-strict border border-neutral-700 bg-neutral-900 text-rose-400 hover:text-rose-300"
                          >
                            {call.relatedTicketId}
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePopTicket(call.id)}
                            className="px-2.5 py-1.5 text-[11px] font-semibold border border-neutral-800 text-neutral-300 hover:text-neutral-100 hover:border-neutral-600"
                          >
                            + Pop Ticket
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* TAB 2: AMAZON CONNECT / PROVIDER EMBEDDED CCP           */}
      {/* ======================================================= */}
      {activeTab === 'ccp' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 cols: Embedded CCP Viewport */}
          <div className="lg:col-span-8 border border-neutral-800 bg-neutral-950 flex flex-col">
            <div className="p-4 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-neutral-100 uppercase flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-sky-400" />
                  <span>{telephonyConfig.providerLabel} — Embedded Contact Control Panel</span>
                </div>
                <div className="text-[11px] font-mono-strict text-neutral-500 truncate max-w-xl">
                  {resolvedCcpUrl || 'No Amazon Connect Instance Alias or Provider CTI Embed URL configured'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {resolvedCcpUrl && (
                  <button
                    onClick={() => setCcpReloadKey(k => k + 1)}
                    className="px-3 py-1.5 text-xs border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reload CCP</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('providers')}
                  className="px-3 py-1.5 text-xs border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
                >
                  Configure URL
                </button>
              </div>
            </div>

            {resolvedCcpUrl ? (
              <div className="relative bg-neutral-900/40 min-h-[540px]">
                <iframe
                  key={ccpReloadKey}
                  src={resolvedCcpUrl}
                  title="Telephony Provider Contact Control Panel"
                  allow="microphone; autoplay; clipboard-write; camera"
                  className="w-full h-[540px] border-0 bg-white"
                />
              </div>
            ) : (
              <div className="p-8 sm:p-12 text-center space-y-4">
                <Cloud className="w-10 h-10 text-neutral-600 mx-auto" />
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h2 className="text-sm font-bold text-neutral-100">
                    Connect Amazon Connect or Any Cloud CTI Softphone
                  </h2>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Enter your Amazon Connect Instance Alias (e.g., <span className="font-mono-strict text-neutral-300">acme-servicedesk</span>)
                    or paste an embeddable softphone URL from RingCentral, Genesys Cloud, Five9, or Aircall to load the live CCP right inside Scribble IT.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setDraftConfig(prev => ({
                      ...prev,
                      providerType: 'amazon_connect',
                      providerLabel: 'Amazon Connect',
                    }));
                    setActiveTab('providers');
                  }}
                  className="px-4 py-2.5 bg-neutral-100 hover:bg-white text-neutral-950 font-bold text-xs inline-flex items-center gap-2 transition-colors"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Set Up Amazon Connect / CTI URL</span>
                </button>
              </div>
            )}
          </div>

          {/* Right 4 cols: AWS Approved Origin Helper & Synchronized Screen-Pop */}
          <div className="lg:col-span-4 space-y-5">
            {/* AWS Approved Origin Box */}
            <div className="border border-neutral-800 bg-neutral-950 p-4 space-y-3">
              <div className="text-xs font-bold text-neutral-100 uppercase flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>AWS Approved Origin Setup</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Amazon Connect requires your ITSM domain to be whitelisted under{' '}
                <span className="text-neutral-200 font-medium">AWS Console → Amazon Connect → Approved Origins</span>{' '}
                before the CCP iframe will render.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-2.5 py-2 bg-neutral-900 border border-neutral-800 text-[11px] font-mono-strict text-emerald-300 truncate">
                  {appOrigin || 'https://your-itsm-domain'}
                </code>
                <button
                  type="button"
                  onClick={() => copyText(appOrigin, 'origin')}
                  className="px-2.5 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs flex items-center gap-1"
                >
                  {copiedOrigin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              {telephonyConfig.amazonConnectQueueArn && (
                <div className="text-[11px] font-mono-strict text-neutral-500 break-all">
                  Queue ARN: {telephonyConfig.amazonConnectQueueArn}
                </div>
              )}
            </div>

            {/* Live CCP Screen-Pop to Incident */}
            <form onSubmit={handleCcpScreenPop} className="border border-neutral-800 bg-neutral-950 p-4 space-y-3">
              <div className="text-xs font-bold text-neutral-100 uppercase flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-amber-400" />
                <span>Instant CCP Ticket Screen-Pop</span>
              </div>
              <p className="text-xs text-neutral-400">
                Log the caller shown in your embedded CCP and immediately generate a linked Incident record.
              </p>
              <div className="space-y-2">
                <input
                  type="tel"
                  required
                  value={ccpCallerNumber}
                  onChange={e => setCcpCallerNumber(e.target.value)}
                  placeholder="Caller E.164 Number (e.g. +14155550101)"
                  className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600"
                />
                <input
                  type="text"
                  value={ccpCallerName}
                  onChange={e => setCcpCallerName(e.target.value)}
                  placeholder="Caller Name (optional)"
                  className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[40px] bg-neutral-100 hover:bg-white text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <FilePlus className="w-4 h-4" />
                <span>Log Call &amp; Pop Incident</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* TAB 3: PERSONAL MOBILE TELEPHONY SYSTEM                 */}
      {/* ======================================================= */}
      {activeTab === 'mobile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 cols: Personal Mobile Configuration & Bridge Modes */}
          <div className="lg:col-span-7 space-y-5">
            <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-5">
              <div className="border-b border-neutral-800 pb-3 space-y-1">
                <div className="text-xs font-bold text-neutral-100 uppercase flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  <span>Use Any Personal Mobile Number as a Telephony System</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Turn any iOS or Android personal mobile number into a Scribble IT helpdesk endpoint — choose zero-config
                  carrier handoff, desktop-to-phone QR dialing, or a server-side two-leg bridge that protects your personal Caller ID.
                </p>
              </div>

              {/* Bridge Mode Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'native_dialer' as const,
                    title: 'Native Carrier Dialer',
                    desc: 'Uses iOS/Android SIM, macOS Continuity, or Windows Phone Link (tel:/sms:) with instant ITSM call tracking.',
                    badge: 'Zero Config',
                  },
                  {
                    id: 'qr_handoff' as const,
                    title: 'Desktop QR Handoff',
                    desc: 'Scan a live QR code on screen with your personal mobile camera to dial immediately while logging notes on desktop.',
                    badge: 'Best for Desktop',
                  },
                  {
                    id: 'carrier_two_leg' as const,
                    title: 'Two-Leg Server Bridge',
                    desc: 'Server rings your personal mobile first, then dials the customer showing your company Helpdesk Caller ID.',
                    badge: serverStatus?.twilioConfigured ? 'Twilio Active' : 'Needs Secrets',
                  },
                ].map(mode => {
                  const selected = (draftConfig.personalMobileBridgeMode || 'native_dialer') === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() =>
                        setDraftConfig(prev => ({
                          ...prev,
                          personalMobileEnabled: true,
                          personalMobileBridgeMode: mode.id,
                        }))
                      }
                      className={`p-3.5 text-left border transition-colors space-y-1.5 ${
                        selected
                          ? 'border-sky-500 bg-sky-950/30 text-neutral-100'
                          : 'border-neutral-800 bg-neutral-900/40 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold">{mode.title}</span>
                      </div>
                      <div className="text-[10px] font-mono-strict text-sky-400 uppercase">{mode.badge}</div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">{mode.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Mobile Number Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                    Agent Personal Mobile Number (E.164)
                  </label>
                  <input
                    type="tel"
                    value={draftConfig.personalMobileNumber || ''}
                    onChange={e =>
                      setDraftConfig(prev => ({
                        ...prev,
                        personalMobileNumber: e.target.value,
                        personalMobileEnabled: true,
                      }))
                    }
                    placeholder="+14155550199"
                    className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                    Helpdesk / Queue Forwarding Number
                  </label>
                  <input
                    type="tel"
                    value={draftConfig.forwardToDeskNumber || ''}
                    onChange={e =>
                      setDraftConfig(prev => ({
                        ...prev,
                        forwardToDeskNumber: e.target.value,
                      }))
                    }
                    placeholder="+18005550199"
                    className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(draftConfig.autoPopTicketOnInbound)}
                  onChange={e =>
                    setDraftConfig(prev => ({
                      ...prev,
                      autoPopTicketOnInbound: e.target.checked,
                    }))
                  }
                  className="accent-emerald-500"
                />
                <span>Prompt automatic Incident screen-pop whenever a personal mobile call session begins</span>
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    updateTelephonyConfig({
                      ...draftConfig,
                      providerType: 'personal_mobile',
                      providerLabel: 'Personal Mobile System',
                      personalMobileEnabled: true,
                    });
                  }}
                  className="px-4 py-2.5 bg-neutral-100 hover:bg-white text-neutral-950 font-bold text-xs flex items-center gap-2 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Activate Personal Mobile as Active Telephony System</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateTelephonyConfig({ ...draftConfig, personalMobileEnabled: true })}
                  className="px-4 py-2.5 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold text-xs transition-colors"
                >
                  Save Mobile Settings Only
                </button>
              </div>
            </div>

            {/* GSM Carrier Call Forwarding Helper */}
            <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-4">
              <div className="border-b border-neutral-800 pb-3 space-y-1">
                <div className="text-xs font-bold text-neutral-100 uppercase flex items-center gap-2">
                  <PhoneForwarded className="w-4 h-4 text-emerald-400" />
                  <span>Carrier Shift Call-Forwarding Codes (GSM / LTE / 5G)</span>
                </div>
                <p className="text-xs text-neutral-400">
                  Route inbound calls between your personal mobile and the central service desk queue on any standard GSM mobile carrier.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    key: 'fwd-desk',
                    label: 'Forward Mobile → Helpdesk',
                    code: forwardToDeskCode,
                    hint: 'Tap when going off-shift',
                  },
                  {
                    key: 'fwd-mobile',
                    label: 'Forward Desk SIM → Mobile',
                    code: forwardToMobileCode,
                    hint: 'Tap for on-call duty',
                  },
                  {
                    key: 'fwd-cancel',
                    label: 'Cancel All Forwarding',
                    code: cancelForwardCode,
                    hint: 'Restores normal ringing',
                  },
                ].map(item => (
                  <div key={item.key} className="p-3 border border-neutral-800 bg-neutral-900/50 space-y-2">
                    <div className="text-xs font-bold text-neutral-200">{item.label}</div>
                    <div className="font-mono-strict text-xs text-emerald-400 tabular-nums break-all">
                      {item.code}
                    </div>
                    <div className="text-[10px] text-neutral-500">{item.hint}</div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <a
                        href={`tel:${encodeURIComponent(item.code)}`}
                        className="flex-1 py-1.5 text-center text-[11px] font-semibold border border-emerald-700/60 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40"
                      >
                        Dial Code
                      </a>
                      <button
                        type="button"
                        onClick={() => copyText(item.code, item.key)}
                        className="px-2 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-neutral-100"
                      >
                        {copiedCode === item.key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 5 cols: Live Scan-to-Call QR Launcher */}
          <div className="lg:col-span-5 border border-neutral-800 bg-neutral-950 p-5 space-y-4">
            <div className="border-b border-neutral-800 pb-3">
              <div className="text-xs font-bold text-neutral-100 uppercase flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-400" />
                <span>Instant Mobile Scan-to-Call Launcher</span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Enter any customer phone number to generate a camera-scannable QR code for your personal smartphone.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                Customer / Target Number
              </label>
              <input
                type="tel"
                value={mobileTestNumber}
                onChange={e => setMobileTestNumber(e.target.value)}
                placeholder="+14155550192"
                className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm font-mono-strict text-neutral-100 tabular-nums focus:outline-none focus:border-neutral-600"
              />
            </div>

            <div className="p-5 border border-neutral-800 bg-neutral-900/40 flex flex-col items-center text-center space-y-3">
              {mobileQrUrl ? (
                <img
                  src={mobileQrUrl}
                  alt={`QR code to dial ${cleanMobileTestNumber}`}
                  className="w-44 h-44 bg-white p-2 border border-neutral-700"
                />
              ) : (
                <div className="w-44 h-44 border border-dashed border-neutral-700 flex items-center justify-center text-xs text-neutral-500">
                  Enter a valid number
                </div>
              )}
              <div className="text-xs font-mono-strict text-neutral-300 tabular-nums">
                {cleanMobileTestNumber ? `tel:${cleanMobileTestNumber}` : 'Waiting for number...'}
              </div>
              <div className="w-full grid grid-cols-2 gap-2 pt-1">
                {cleanMobileTestNumber ? (
                  <>
                    <a
                      href={`tel:${cleanMobileTestNumber}`}
                      onClick={() => handleNativeMobileCall(cleanMobileTestNumber)}
                      className="min-h-[40px] px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call on Mobile</span>
                    </a>
                    <a
                      href={`sms:${cleanMobileTestNumber}`}
                      className="min-h-[40px] px-3 py-2 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Send SMS</span>
                    </a>
                  </>
                ) : null}
              </div>

              {canUseServerBridge && cleanMobileTestNumber && (
                <button
                  type="button"
                  disabled={bridgingCall}
                  onClick={() => handleServerBridgeCall(cleanMobileTestNumber)}
                  className="w-full min-h-[40px] px-3 py-2 border border-amber-700 bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 font-semibold text-xs flex items-center justify-center gap-2"
                >
                  <PhoneForwarded className="w-3.5 h-3.5" />
                  <span>{bridgingCall ? 'Bridging...' : 'Ring My Mobile & Bridge Customer'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* TAB 4: MULTI-PROVIDER CONNECTORS SETUP                  */}
      {/* ======================================================= */}
      {activeTab === 'providers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5 cols: Provider Selector Catalog */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="text-xs font-bold text-neutral-300 uppercase px-1">
              Select Telephony Service Provider
            </div>
            <div className="space-y-2">
              {PROVIDER_PRESETS.map(preset => {
                const selected = draftConfig.providerType === preset.type;
                const isLive = telephonyConfig.providerType === preset.type;
                return (
                  <button
                    key={preset.type}
                    type="button"
                    onClick={() => selectProviderPreset(preset)}
                    className={`w-full p-3.5 text-left border transition-colors flex items-start justify-between gap-3 ${
                      selected
                        ? 'border-neutral-200 bg-neutral-900 text-neutral-100'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900/50'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{preset.label}</span>
                        {isLive && (
                          <span className="px-1.5 py-0.5 text-[9px] font-mono-strict uppercase border border-emerald-700 bg-emerald-950/50 text-emerald-300">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-snug">{preset.tagline}</p>
                    </div>
                    <div className="text-neutral-500 shrink-0 mt-0.5">
                      {preset.category === 'mobile' ? (
                        <Smartphone className="w-4 h-4" />
                      ) : preset.category === 'sip' ? (
                        <Server className="w-4 h-4" />
                      ) : (
                        <Cloud className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right 7 cols: Dynamic Provider Configuration Form */}
          <form
            onSubmit={handleSaveProviderConfig}
            className="lg:col-span-7 border border-neutral-800 bg-neutral-950 p-5 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
              <div>
                <div className="text-xs font-bold text-neutral-100 uppercase">
                  {draftConfig.providerLabel} Configuration
                </div>
                <div className="text-[11px] text-neutral-500">
                  Saved per tenant ({activeTenant.name}) · Zero client-side secrets stored
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-mono-strict border border-neutral-800 bg-neutral-900 text-neutral-400 uppercase">
                {draftConfig.providerType}
              </span>
            </div>

            {/* AMAZON CONNECT FIELDS */}
            {draftConfig.providerType === 'amazon_connect' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      Amazon Connect Instance Alias *
                    </label>
                    <input
                      type="text"
                      value={draftConfig.amazonConnectInstanceAlias || ''}
                      onChange={e =>
                        setDraftConfig(prev => ({ ...prev, amazonConnectInstanceAlias: e.target.value }))
                      }
                      placeholder="e.g. scribble-it-support"
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      AWS Region
                    </label>
                    <select
                      value={draftConfig.amazonConnectRegion || 'us-east-1'}
                      onChange={e =>
                        setDraftConfig(prev => ({ ...prev, amazonConnectRegion: e.target.value }))
                      }
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                    >
                      {AWS_CONNECT_REGIONS.map(r => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                    Custom CCP v2 URL Override (Optional)
                  </label>
                  <input
                    type="url"
                    value={draftConfig.amazonConnectCcpUrl || ''}
                    onChange={e => setDraftConfig(prev => ({ ...prev, amazonConnectCcpUrl: e.target.value }))}
                    placeholder={
                      draftConfig.amazonConnectInstanceAlias
                        ? `https://${draftConfig.amazonConnectInstanceAlias}.my.connect.aws/ccp-v2`
                        : 'https://your-instance.my.connect.aws/ccp-v2'
                    }
                    className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      Default Contact Queue ARN (Optional)
                    </label>
                    <input
                      type="text"
                      value={draftConfig.amazonConnectQueueArn || ''}
                      onChange={e => setDraftConfig(prev => ({ ...prev, amazonConnectQueueArn: e.target.value }))}
                      placeholder="arn:aws:connect:us-east-1:...:queue/..."
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      Outbound Lambda / API Gateway Webhook (Optional)
                    </label>
                    <input
                      type="url"
                      value={draftConfig.outboundWebhookUrl || ''}
                      onChange={e => setDraftConfig(prev => ({ ...prev, outboundWebhookUrl: e.target.value }))}
                      placeholder="https://api.example.com/connect/outbound"
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TWILIO FIELDS (No secret inputs in UI) */}
            {draftConfig.providerType === 'twilio' && (
              <div className="space-y-4">
                <div
                  className={`p-3.5 border text-xs space-y-1.5 ${
                    serverStatus?.twilioConfigured
                      ? 'border-emerald-700/70 bg-emerald-950/30 text-emerald-200'
                      : 'border-amber-700/70 bg-amber-950/30 text-amber-200'
                  }`}
                >
                  <div className="font-bold flex items-center gap-2">
                    {serverStatus?.twilioConfigured ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                    <span>
                      {serverStatus?.twilioConfigured
                        ? `Twilio Server Bridge Configured (${serverStatus.twilioFromNumber})`
                        : 'Twilio Server Credentials Required in Environment Secrets'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    For security, Twilio credentials are never entered in browser forms. Configure{' '}
                    <code className="font-mono-strict">TWILIO_ACCOUNT_SID</code>,{' '}
                    <code className="font-mono-strict">TWILIO_AUTH_TOKEN</code>, and{' '}
                    <code className="font-mono-strict">TWILIO_FROM_NUMBER</code> in{' '}
                    <span className="font-semibold">Settings &gt; Secrets</span>, then click Test Provider Connection below.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      Agent Personal Mobile for Two-Leg Bridge
                    </label>
                    <input
                      type="tel"
                      value={draftConfig.personalMobileNumber || ''}
                      onChange={e =>
                        setDraftConfig(prev => ({
                          ...prev,
                          personalMobileNumber: e.target.value,
                          personalMobileEnabled: true,
                        }))
                      }
                      placeholder="+14155550199"
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      Display Caller ID Label
                    </label>
                    <input
                      type="text"
                      value={draftConfig.callerIdNumber || serverStatus?.twilioFromNumber || ''}
                      onChange={e => setDraftConfig(prev => ({ ...prev, callerIdNumber: e.target.value }))}
                      placeholder="+18005550100"
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SIP / WEBRTC FIELDS */}
            {draftConfig.providerType === 'sip_webrtc' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      SIP WebSocket (WSS) URI *
                    </label>
                    <input
                      type="text"
                      value={draftConfig.sipWssUrl || ''}
                      onChange={e => setDraftConfig(prev => ({ ...prev, sipWssUrl: e.target.value }))}
                      placeholder="wss://pbx.example.com:8089/ws"
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      SIP Domain / Realm
                    </label>
                    <input
                      type="text"
                      value={draftConfig.sipDomain || ''}
                      onChange={e => setDraftConfig(prev => ({ ...prev, sipDomain: e.target.value }))}
                      placeholder={`sip.${activeTenant.domain}`}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      Agent Extension
                    </label>
                    <input
                      type="text"
                      value={draftConfig.sipExtension || ''}
                      onChange={e => setDraftConfig(prev => ({ ...prev, sipExtension: e.target.value }))}
                      placeholder="4401"
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      STUN / TURN Server
                    </label>
                    <input
                      type="text"
                      value={draftConfig.stunServer || ''}
                      onChange={e => setDraftConfig(prev => ({ ...prev, stunServer: e.target.value }))}
                      placeholder="stun:stun.l.google.com:19302"
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* RINGCENTRAL / GENESYS / CUSTOM PROVIDER FIELDS */}
            {(draftConfig.providerType === 'ringcentral' ||
              draftConfig.providerType === 'genesys' ||
              draftConfig.providerType === 'custom_provider') && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      Provider Display Name
                    </label>
                    <input
                      type="text"
                      value={draftConfig.providerLabel || ''}
                      onChange={e => setDraftConfig(prev => ({ ...prev, providerLabel: e.target.value }))}
                      placeholder="e.g. RingCentral, Genesys, Five9, Aircall"
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      Caller ID / Queue Number
                    </label>
                    <input
                      type="text"
                      value={draftConfig.callerIdNumber || ''}
                      onChange={e => setDraftConfig(prev => ({ ...prev, callerIdNumber: e.target.value }))}
                      placeholder="+18005550142"
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                    Embeddable Softphone / CTI Widget URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={draftConfig.customCtiEmbedUrl || ''}
                    onChange={e => setDraftConfig(prev => ({ ...prev, customCtiEmbedUrl: e.target.value }))}
                    placeholder={
                      PROVIDER_PRESETS.find(p => p.type === draftConfig.providerType)?.defaultEmbedHint ||
                      'https://cti.provider.com/embed'
                    }
                    className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                    Outbound Click-to-Call Webhook URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={draftConfig.outboundWebhookUrl || ''}
                    onChange={e => setDraftConfig(prev => ({ ...prev, outboundWebhookUrl: e.target.value }))}
                    placeholder="https://hooks.provider.com/v1/calls/outbound"
                    className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                  />
                  <div className="text-[11px] text-neutral-500">
                    Server signs webhook requests with <code className="font-mono-strict">TELEPHONY_WEBHOOK_SECRET</code> if set in Settings &gt; Secrets.
                  </div>
                </div>
              </div>
            )}

            {/* PERSONAL MOBILE QUICK FIELDS */}
            {draftConfig.providerType === 'personal_mobile' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      Personal Mobile Number (E.164) *
                    </label>
                    <input
                      type="tel"
                      value={draftConfig.personalMobileNumber || ''}
                      onChange={e =>
                        setDraftConfig(prev => ({
                          ...prev,
                          personalMobileNumber: e.target.value,
                          personalMobileEnabled: true,
                        }))
                      }
                      placeholder="+14155550199"
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs font-mono-strict text-neutral-100 focus:outline-none focus:border-neutral-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono-strict text-neutral-400 uppercase block">
                      Calling Mode
                    </label>
                    <select
                      value={draftConfig.personalMobileBridgeMode || 'native_dialer'}
                      onChange={e =>
                        setDraftConfig(prev => ({
                          ...prev,
                          personalMobileBridgeMode: e.target.value as TelephonyProviderConfig['personalMobileBridgeMode'],
                        }))
                      }
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-600"
                    >
                      <option value="native_dialer">Native Carrier Dialer (tel:/sms:)</option>
                      <option value="qr_handoff">Desktop QR Scan-to-Call</option>
                      <option value="carrier_two_leg">Server Two-Leg Carrier Bridge</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('mobile')}
                  className="text-xs text-sky-400 hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open full Personal Mobile QR &amp; GSM Forwarding Studio</span>
                </button>
              </div>
            )}

            {/* Connectivity Probe Result */}
            {connResult && (
              <div
                className={`p-3 border text-xs flex items-start gap-2.5 ${
                  connResult.ok
                    ? 'border-emerald-700/70 bg-emerald-950/30 text-emerald-200'
                    : 'border-rose-700/70 bg-rose-950/30 text-rose-200'
                }`}
              >
                {connResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-semibold">
                    {connResult.ok ? 'Verification Succeeded' : 'Verification Failed'}
                    {connResult.latencyMs !== undefined && (
                      <span className="ml-2 font-mono-strict text-[11px] opacity-80">
                        ({connResult.latencyMs}ms)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] opacity-90">{connResult.detail}</div>
                </div>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800">
              <button
                type="button"
                disabled={testingConn}
                onClick={handleTestConnection}
                className="px-4 py-2.5 border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-neutral-200 text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Globe className={`w-3.5 h-3.5 ${testingConn ? 'animate-spin' : ''}`} />
                <span>{testingConn ? 'Probing Endpoint...' : 'Test Provider Connection'}</span>
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 bg-neutral-100 hover:bg-white text-neutral-950 font-bold text-xs flex items-center gap-2 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save &amp; Activate Provider</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
