import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { aiService, type CopilotTurnMessage } from '../../services/aiService';
import { Sparkles, X, Send, Trash2, BookMarked, Copy, Check, AlertCircle } from 'lucide-react';

interface AiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  'Summarize active incidents & highlight SLA risks',
  'Review pending CAB changes & deployment readiness',
  'Draft an executive status update for current tenant',
  'Suggest automation workflows & KB gaps for open tickets'
];

export const AiCopilotDrawer: React.FC<AiCopilotDrawerProps> = ({ isOpen, onClose }) => {
  const {
    activeTenant,
    incidents,
    requests,
    problems,
    changes,
    assets,
    inventory,
    statusComponents,
    workflows,
    createWikiPage,
    showToast
  } = useITSM();

  const [messages, setMessages] = useState<CopilotTurnMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const tenantContext = useMemo(() => {
    const openInc = incidents.filter(i => i.status !== 'resolved' && i.status !== 'closed');
    const pendingChg = changes.filter(c => c.status !== 'completed' && c.status !== 'cancelled');
    const lowStock = inventory.filter(i => i.quantity <= i.minThreshold);
    const degradedSvc = statusComponents.filter(s => s.status !== 'operational');

    return [
      `Tenant: ${activeTenant.name} (${activeTenant.slug}) | Region: ${activeTenant.region} | SLA P1/P2: ${activeTenant.slaTargets.P1}h/${activeTenant.slaTargets.P2}h`,
      `Totals: ${incidents.length} incidents (${openInc.length} open), ${requests.length} requests, ${problems.length} problems, ${changes.length} changes (${pendingChg.length} active), ${assets.length} assets, ${workflows.length} workflows.`,
      openInc.length > 0
        ? `Open Incidents:\n${openInc.slice(0, 12).map(i => `- ${i.id} [${i.priority}/${i.status}] ${i.title} (Assignee: ${i.assignee}, SLA: ${i.slaDeadline})`).join('\n')}`
        : 'Open Incidents: None.',
      pendingChg.length > 0
        ? `Active Changes (CAB):\n${pendingChg.slice(0, 8).map(c => `- ${c.id} [${c.type}/${c.riskScore}/${c.status}] ${c.title}`).join('\n')}`
        : 'Active Changes: None.',
      degradedSvc.length > 0
        ? `Degraded Services:\n${degradedSvc.map(s => `- ${s.name}: ${s.status}`).join('\n')}`
        : 'Service Status: All monitored components operational (or unconfigured).',
      lowStock.length > 0
        ? `Low Stock Inventory:\n${lowStock.slice(0, 8).map(x => `- ${x.name}: qty ${x.quantity} (min ${x.minThreshold})`).join('\n')}`
        : 'Low Stock Inventory: None.'
    ].join('\n\n');
  }, [activeTenant, incidents, requests, problems, changes, assets, inventory, statusComponents, workflows]);

  if (!isOpen) return null;

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const nextHistory: CopilotTurnMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextHistory);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const res = await aiService.askCopilot({
        message: trimmed,
        history: messages,
        tenantContext
      });
      setMessages(prev => [...prev, { role: 'model', text: res.reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI Copilot request failed.';
      setError(msg);
      showToast({ variant: 'error', title: 'AI Copilot Error', description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (idx: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSaveToWiki = (text: string) => {
    const dateTag = new Date().toISOString().split('T')[0];
    createWikiPage({
      title: `AI Ops Brief · ${activeTenant.name} (${dateTag})`,
      section: 'Runbooks',
      content: text
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-[1px] font-mono text-xs">
      <div
        className="w-full max-w-xl bg-neutral-950 border-l border-neutral-800 h-full flex flex-col shadow-2xl"
        role="dialog"
        aria-label="Scribble IT AI Copilot"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between gap-3 bg-neutral-900/50">
          <div className="min-w-0">
            <div className="text-[10px] text-sky-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SCRIBBLE IT · AI OPERATIONS COPILOT</span>
            </div>
            <div className="text-[11px] text-neutral-400 truncate mt-0.5">
              Context: {activeTenant.name} · {incidents.length} Incidents · {changes.length} Changes · {assets.length} CIs
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setError(null);
                }}
                title="Clear conversation"
                className="p-1.5 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-neutral-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close AI Copilot"
              className="p-1.5 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-neutral-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4 py-4">
              <div className="border border-neutral-800 bg-neutral-900/30 p-4 space-y-2">
                <div className="text-neutral-100 font-bold">Operational AI grounded in {activeTenant.name}</div>
                <p className="text-neutral-400 leading-relaxed">
                  Ask questions about active tickets, SLA risks, CAB change readiness, workflow design, or ask for an executive outage summary.
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] text-neutral-500 uppercase font-bold">Quick Actions</div>
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_PROMPTS.map(prompt => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="text-left p-3 border border-neutral-800 bg-neutral-900/40 hover:border-sky-600 text-neutral-200 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={`border p-3.5 space-y-2 ${
                  m.role === 'user'
                    ? 'border-neutral-700 bg-neutral-900/70 ml-6'
                    : 'border-sky-900/60 bg-neutral-950 mr-2'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] uppercase font-bold">
                  <span className={m.role === 'user' ? 'text-neutral-400' : 'text-sky-400'}>
                    {m.role === 'user' ? 'Operator' : 'AI Operations Copilot'}
                  </span>
                  {m.role === 'model' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopy(idx, m.text)}
                        className="px-1.5 py-0.5 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
                      >
                        {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveToWiki(m.text)}
                        className="px-1.5 py-0.5 border border-neutral-800 hover:border-sky-600 text-neutral-300 hover:text-sky-300 flex items-center gap-1"
                      >
                        <BookMarked className="w-3 h-3" />
                        <span>Save to Wiki</span>
                      </button>
                    </div>
                  )}
                </div>
                <pre className="whitespace-pre-wrap font-mono text-neutral-200 leading-relaxed">
                  {m.text}
                </pre>
              </div>
            ))
          )}

          {isLoading && (
            <div className="border border-sky-900/50 bg-neutral-900/30 p-3 text-sky-400">
              Analyzing {activeTenant.name} telemetry &amp; generating response...
            </div>
          )}

          {error && (
            <div className="border border-rose-800 bg-rose-950/40 p-3 text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={e => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="p-3 border-t border-neutral-800 bg-neutral-900/40 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask AI Copilot about tickets, CAB changes, runbooks..."
            className="flex-1 bg-neutral-950 border border-neutral-700 focus:border-sky-500 outline-none px-3 py-2 text-neutral-100"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
