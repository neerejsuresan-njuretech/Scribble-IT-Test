import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { DotMatrixText } from '../common/DotMatrixDisplay';
import { Phone, PhoneCall, PhoneForwarded, PhoneOff, Mic, MicOff, Pause, Play, FilePlus, User, History } from 'lucide-react';

export const TelephonyModule: React.FC = () => {
  const {
    calls, activeCall, startTelephonyCall, simulateIncomingCall,
    answerIncomingCall, endTelephonyCall, toggleHoldCall, popTicketFromCall,
    setActiveTab
  } = useITSM();

  const [dialNumber, setDialNumber] = useState('');
  const [callerNameInput, setCallerNameInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [poppedTicketId, setPoppedTicketId] = useState<string | null>(null);

  const handleDial = (digit: string) => {
    setDialNumber(prev => prev + digit);
  };

  const handleStartCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialNumber.trim()) return;
    startTelephonyCall(dialNumber.trim(), callerNameInput || undefined);
    setDialNumber('');
    setCallerNameInput('');
  };

  const handlePopTicket = (callId: string) => {
    const newInc = popTicketFromCall(callId);
    setPoppedTicketId(newInc.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-xs font-mono text-neutral-400">COMPUTER TELEPHONY INTEGRATION (CTI) // SIP VOIP DESK</div>
          <h1 className="text-xl font-bold font-mono text-neutral-100 flex items-center gap-3">
            <span>TELEPHONY & CALL AUTOMATION</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">({calls.length} Call Records)</span>
          </h1>
        </div>
        <button
          onClick={simulateIncomingCall}
          className="px-4 py-2 text-xs font-mono tracking-wider border border-emerald-600 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Simulate Inbound Caller</span>
        </button>
      </div>

      {/* Grid: Softphone Dialpad / Active Call Console & Call History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Softphone Instrument Console */}
        <div className="lg:col-span-5 border border-neutral-800 bg-neutral-950 p-6 space-y-6 font-mono">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <span className="text-xs font-bold text-neutral-300 uppercase">SIP Softphone Extension #4401</span>
            <span className="text-xs text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span>GATEWAY REGISTERED</span>
            </span>
          </div>

          {/* Dot Matrix LCD Display Screen */}
          <div className="p-4 border border-neutral-800 bg-neutral-900/60 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] text-neutral-500">
              <span>LINE 01 // 10.200.4.1</span>
              <span className="tabular-nums">
                {activeCall ? `${Math.floor(activeCall.durationSec / 60).toString().padStart(2, '0')}:${(activeCall.durationSec % 60).toString().padStart(2, '0')}` : '00:00 IDLE'}
              </span>
            </div>

            {activeCall ? (
              <div className="space-y-1">
                <div className="text-xs font-bold text-neutral-100 truncate">
                  {activeCall.callerName}
                </div>
                <div className="text-sm text-neutral-300 tabular-nums">
                  {activeCall.callerNumber}
                </div>
                <div className="text-[11px] text-neutral-400 truncate">
                  {activeCall.callerCompany}
                </div>
                <div className="text-[11px] text-amber-400 font-bold uppercase pt-1">
                  STATUS: {activeCall.status}
                </div>
              </div>
            ) : (
              <div className="py-2">
                <div className="text-base text-neutral-200 tabular-nums min-h-[1.5rem] tracking-wider">
                  {dialNumber || 'READY TO DIAL'}
                </div>
                <div className="text-[11px] text-neutral-500">
                  Enter extension or E.164 phone number
                </div>
              </div>
            )}
          </div>

          {/* Active Call Controls */}
          {activeCall ? (
            <div className="space-y-3">
              {activeCall.status === 'ringing' ? (
                <div className="flex gap-2">
                  <button
                    onClick={answerIncomingCall}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Answer Call</span>
                  </button>
                  <button
                    onClick={endTelephonyCall}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>Decline</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={`p-2 border transition-colors flex flex-col items-center gap-1 ${
                        isMuted ? 'border-amber-500 bg-amber-950/40 text-amber-300' : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      <span className="text-[10px]">{isMuted ? 'Muted' : 'Mute'}</span>
                    </button>

                    <button
                      onClick={toggleHoldCall}
                      className={`p-2 border transition-colors flex flex-col items-center gap-1 ${
                        activeCall.status === 'held' ? 'border-amber-500 bg-amber-950/40 text-amber-300' : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      {activeCall.status === 'held' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      <span className="text-[10px]">{activeCall.status === 'held' ? 'Resume' : 'Hold'}</span>
                    </button>

                    <button
                      onClick={endTelephonyCall}
                      className="p-2 border border-rose-900 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 transition-colors flex flex-col items-center gap-1"
                    >
                      <PhoneOff className="w-4 h-4" />
                      <span className="text-[10px]">Hang Up</span>
                    </button>
                  </div>

                  {/* Pop Ticket from Call Action */}
                  <div className="p-3 border border-neutral-800 bg-neutral-900/40 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400">CTI CRM Link</span>
                      {poppedTicketId && (
                        <span className="text-emerald-400 font-bold">{poppedTicketId} Created!</span>
                      )}
                    </div>
                    <button
                      onClick={() => handlePopTicket(activeCall.id)}
                      className="w-full py-2 bg-neutral-100 hover:bg-white text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <FilePlus className="w-4 h-4" />
                      <span>Pop Ticket from Call</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Dialpad Grid */
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(digit => (
                  <button
                    key={digit}
                    onClick={() => handleDial(digit)}
                    className="p-3 border border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 text-sm font-bold transition-colors"
                  >
                    {digit}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setDialNumber('')}
                  className="px-3 py-2 border border-neutral-800 text-neutral-500 hover:text-neutral-300 text-xs"
                >
                  Clear
                </button>
                <button
                  onClick={handleStartCall}
                  disabled={!dialNumber}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Place Call</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Call Transcript & Call Records History */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Call Live Transcript */}
          {activeCall && (
            <div className="border border-neutral-800 bg-neutral-950 p-6 space-y-3 font-mono">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-xs font-bold text-neutral-200 uppercase">Real-Time Call Transcript</span>
                <span className="text-xs text-neutral-500">Audio Codec: G.711u / 64kbps</span>
              </div>

              <div className="p-4 bg-neutral-900/30 border border-neutral-800/80 space-y-2 text-xs max-h-48 overflow-y-auto">
                {activeCall.liveTranscript.map((line, idx) => (
                  <div key={idx} className="text-neutral-300 leading-relaxed">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historical Call Logs */}
          <div className="border border-neutral-800 bg-neutral-950 p-6 space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-200 uppercase">
                <History className="w-4 h-4 text-neutral-400" />
                <span>Telephony Call Detail Records (CDR)</span>
              </div>
              <span className="text-xs text-neutral-500">{calls.length} logged sessions</span>
            </div>

            <div className="divide-y divide-neutral-800/80">
              {calls.map(call => (
                <div key={call.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-neutral-200">{call.callerName}</span>
                      <span className="text-neutral-500">·</span>
                      <span className="text-neutral-400 tabular-nums">{call.callerNumber}</span>
                    </div>
                    <div className="text-neutral-500 text-[11px]">
                      {call.callerCompany} · {new Date(call.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-neutral-300 tabular-nums font-bold">
                        {Math.floor(call.durationSec / 60)}m {call.durationSec % 60}s
                      </div>
                      <div className="text-[11px] text-neutral-500 uppercase">{call.disposition || 'inquiry_resolved'}</div>
                    </div>

                    {call.relatedTicketId ? (
                      <button
                        onClick={() => setActiveTab('incidents')}
                        className="px-2 py-1 text-[11px] border border-neutral-700 bg-neutral-900 text-rose-400 hover:text-rose-300"
                      >
                        {call.relatedTicketId}
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePopTicket(call.id)}
                        className="px-2 py-1 text-[11px] border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600"
                      >
                        + Pop Ticket
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
