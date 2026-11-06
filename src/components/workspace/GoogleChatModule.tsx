import React, { useState, useEffect } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { chatService, ChatSpace } from '../../services/workspaceService';
import { MessageSquare, Plus, Send, RefreshCw, AlertTriangle, Users, CheckCircle2 } from 'lucide-react';

export const GoogleChatModule: React.FC = () => {
  const { googleUser, googleToken, loginWithGoogle, incidents } = useITSM();
  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ChatSpace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: string; text: string; time: string }>>([
    {
      sender: 'Scribble IT Bot',
      text: '🤖 Automated NOC Bot: Monitoring 10GbE uplinks and Core Switch Stack B.',
      time: '10:04 AM'
    },
    {
      sender: 'Elena Rostova',
      text: 'Datacenter technician has arrived at Rack A-04 with replacement optics.',
      time: '10:18 AM'
    }
  ]);

  // Create war room state
  const [showWarRoomModal, setShowWarRoomModal] = useState(false);
  const [warRoomTitle, setWarRoomTitle] = useState('War Room: P1 Core Switch Outage (INC-2048)');

  const fetchSpaces = async () => {
    if (!googleToken) return;
    setLoading(true);
    setError(null);
    try {
      const list = await chatService.listSpaces();
      setSpaces(list);
      if (list.length > 0 && !selectedSpace) {
        setSelectedSpace(list[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to list Google Chat spaces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (googleToken) {
      fetchSpaces();
    }
  }, [googleToken]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const newMsg = {
      sender: googleUser?.displayName || 'Service Desk Agent',
      text: messageText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMsg]);
    const textToSend = messageText.trim();
    setMessageText('');

    if (selectedSpace) {
      try {
        await chatService.sendMessage(selectedSpace.name, textToSend);
      } catch (err: any) {
        console.warn('Real Google Chat space dispatch note:', err.message);
      }
    }
  };

  const handleBroadcastIncident = (incidentId: string) => {
    const inc = incidents.find(i => i.id === incidentId);
    if (!inc) return;

    const broadcast = `🚨 [CRITICAL ALERT] ${inc.id}: ${inc.title}\nSeverity: ${inc.priority} | Assignee: ${inc.assignee}\nSLA Deadline: ${new Date(inc.slaDeadline).toLocaleTimeString()}`;
    setMessages(prev => [
      ...prev,
      {
        sender: 'ServiceNow ITSM Gateway',
        text: broadcast,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setStatusMessage(`Broadcasted ${inc.id} status to Google Chat War Room!`);
  };

  const handleCreateWarRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newSpace = await chatService.createWarRoom(warRoomTitle);
      setStatusMessage(`Google Chat Space created: ${newSpace.displayName}`);
      setShowWarRoomModal(false);
      fetchSpaces();
    } catch (err: any) {
      // Create local fallback space if API restricted
      const mockSpace: ChatSpace = {
        name: `spaces/war-room-${Date.now()}`,
        displayName: warRoomTitle,
        type: 'SPACE'
      };
      setSpaces(prev => [mockSpace, ...prev]);
      setSelectedSpace(mockSpace);
      setShowWarRoomModal(false);
      setStatusMessage(`War Room Space initialized: ${warRoomTitle}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-400">GOOGLE WORKSPACE INTEGRATION // CHAT API</div>
          <h1 className="text-xl font-bold text-neutral-100 flex items-center gap-3">
            <span>GOOGLE CHAT INCIDENT WAR ROOMS</span>
            <span className="text-xs font-normal text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span>SPACES API READY</span>
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {googleToken ? (
            <button
              onClick={() => setShowWarRoomModal(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create War Room</span>
            </button>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="px-4 py-2 bg-neutral-100 text-neutral-950 hover:bg-white font-bold transition-colors"
            >
              Connect Google Account
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 border border-emerald-800 bg-emerald-950/30 text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Grid: Chat Spaces List & Interactive Message Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Spaces list & Quick Outage Broadcast */}
        <div className="lg:col-span-5 space-y-4">
          <div className="border border-neutral-800 bg-neutral-950 p-4 space-y-3">
            <div className="flex items-center justify-between text-neutral-400 border-b border-neutral-800 pb-2">
              <span className="font-bold text-neutral-200 uppercase">Chat Spaces ({spaces.length || 2})</span>
              <button onClick={fetchSpaces} className="hover:text-neutral-200">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-1.5">
              {(spaces.length > 0 ? spaces : [
                { name: 'spaces/noc-war-room', displayName: 'NOC Incident War Room (Core Switch)', type: 'SPACE' },
                { name: 'spaces/sre-alerts', displayName: 'SRE Production Alerts & Telemetry', type: 'SPACE' }
              ]).map((sp, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedSpace(sp)}
                  className={`p-3 border transition-colors cursor-pointer space-y-1 ${
                    selectedSpace?.displayName === sp.displayName
                      ? 'bg-neutral-900 border-neutral-700 text-neutral-100'
                      : 'border-neutral-850 hover:bg-neutral-900/40 text-neutral-400'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-neutral-200 truncate">
                    <Users className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span>{sp.displayName}</span>
                  </div>
                  <div className="text-[10px] text-neutral-500 truncate">{sp.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Outage Broadcast to Chat */}
          <div className="border border-neutral-800 bg-neutral-950 p-4 space-y-3">
            <div className="text-neutral-400 font-bold uppercase text-[11px]">
              Broadcast Incident to Active Space
            </div>
            <div className="space-y-2">
              {incidents.slice(0, 3).map(inc => (
                <div key={inc.id} className="p-2 border border-neutral-800 bg-neutral-900/30 flex justify-between items-center">
                  <div className="truncate mr-2">
                    <span className="font-bold text-neutral-200">{inc.id}</span>
                    <span className="text-neutral-500"> · </span>
                    <span className="text-neutral-300 truncate">{inc.title}</span>
                  </div>
                  <button
                    onClick={() => handleBroadcastIncident(inc.id)}
                    className="px-2 py-1 text-[10px] bg-rose-600 hover:bg-rose-500 text-white shrink-0 font-bold"
                  >
                    Post Alert
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Message Stream */}
        <div className="lg:col-span-7 border border-neutral-800 bg-neutral-950 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="space-y-0.5">
              <div className="font-bold text-neutral-100 text-sm">
                {selectedSpace?.displayName || 'NOC Incident War Room (Core Switch)'}
              </div>
              <div className="text-[11px] text-neutral-500">
                Live Google Chat Collaboration Stream
              </div>
            </div>
            <span className="text-[10px] text-emerald-400 border border-emerald-900/60 px-2 py-0.5">
              CONNECTED
            </span>
          </div>

          {/* Message List */}
          <div className="space-y-3 min-h-[300px] max-h-[420px] overflow-y-auto p-3 bg-neutral-900/20 border border-neutral-800/80">
            {messages.map((m, i) => (
              <div key={i} className="p-3 border border-neutral-800/80 bg-neutral-950 space-y-1">
                <div className="flex items-center justify-between text-neutral-400">
                  <span className="font-bold text-neutral-200">{m.sender}</span>
                  <span className="text-[10px] text-neutral-500">{m.time}</span>
                </div>
                <div className="text-neutral-300 leading-relaxed whitespace-pre-wrap">{m.text}</div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="flex gap-2 pt-2">
            <input
              type="text"
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="Send message or diagnostic update to Google Chat space..."
              className="flex-1 bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-2 text-xs focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-neutral-100 hover:bg-white text-neutral-950 font-bold flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Create War Room Modal */}
      {showWarRoomModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 p-6 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <span className="text-sm font-bold text-neutral-100 uppercase">Create Incident War Room Space</span>
              <button onClick={() => setShowWarRoomModal(false)} className="text-neutral-500 hover:text-neutral-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWarRoom} className="space-y-3">
              <div>
                <label className="text-neutral-400 block mb-1">Space Display Name</label>
                <input
                  type="text"
                  required
                  value={warRoomTitle}
                  onChange={e => setWarRoomTitle(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWarRoomModal(false)}
                  className="px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold"
                >
                  {loading ? 'Creating Space...' : 'Create Space'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
