import React, { useState, useRef, useEffect } from 'react';
import { ActivityEntry, ActivityType, FieldChange } from '../../types/itsm';
import { useITSM } from '../../context/ITSMContext';
import {
  MessageSquare, Lock, Globe, AlertCircle, RefreshCw, Send,
  Filter, Search, Clock, ChevronRight, ChevronLeft, HardDrive,
  CheckCircle2, Sparkles, User, Tag
} from 'lucide-react';

interface ActivityStreamPanelProps {
  recordId: string;
  recordTitle: string;
  recordType: 'incident' | 'change';
  activityLog: ActivityEntry[];
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export const ActivityStreamPanel: React.FC<ActivityStreamPanelProps> = ({
  recordId,
  recordTitle,
  recordType,
  activityLog,
  isOpen,
  onToggle,
  className = ''
}) => {
  const { addRecordActivity, currentUser } = useITSM();

  // Composer state
  const [composerType, setComposerType] = useState<'work_note' | 'comment'>('work_note');
  const [composerNote, setComposerNote] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [postNotice, setPostNotice] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when activity log changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activityLog.length]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!composerNote.trim()) return;

    addRecordActivity(
      recordId,
      recordType,
      composerNote.trim(),
      composerType,
      composerType === 'work_note' ? 'Work Note Added' : 'Customer Comment Posted'
    );

    setComposerNote('');
    setPostNotice(composerType === 'work_note' ? 'Work note appended to stream' : 'Customer comment broadcasted');
    setTimeout(() => setPostNotice(null), 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInsertSnippet = (snippet: string) => {
    setComposerNote(prev => prev ? `${prev}\n${snippet}` : snippet);
  };

  // Filter items
  const filteredLog = activityLog.filter(entry => {
    // Determine category
    const isWorkNote = entry.type === 'work_note' || entry.action?.includes('WORK NOTE');
    const isComment = entry.type === 'comment' || entry.action?.includes('Customer Comment');
    const isFieldChange = entry.type === 'field_change' || entry.action?.includes('Status') || entry.action?.includes('State') || !!entry.fieldChanges;
    const isSystem = entry.type === 'system_alert' || entry.type === 'audit' || entry.author?.toLowerCase().includes('bot') || entry.author?.toLowerCase().includes('system') || entry.author?.toLowerCase().includes('zabbix');

    let matchesType = true;
    if (filterType === 'work_note') matchesType = isWorkNote;
    else if (filterType === 'comment') matchesType = isComment;
    else if (filterType === 'field_change') matchesType = isFieldChange;
    else if (filterType === 'system') matchesType = isSystem;

    const matchesSearch = !searchQuery ||
      entry.note.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.action.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesSearch;
  });

  const countWorkNotes = activityLog.filter(a => a.type === 'work_note' || a.action?.includes('WORK NOTE')).length;
  const countComments = activityLog.filter(a => a.type === 'comment' || a.action?.includes('Customer Comment')).length;
  const countFieldChanges = activityLog.filter(a => a.type === 'field_change' || a.fieldChanges || a.action?.includes('Status') || a.action?.includes('State')).length;

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800 p-2 font-mono text-xs flex flex-col items-center gap-2 shadow-2xl transition-all"
        title="Open Activity Stream Side-Panel"
      >
        <ChevronLeft className="w-4 h-4 text-rose-500" />
        <span className="[writing-mode:vertical-rl] tracking-widest uppercase font-bold text-[10px]">
          ACTIVITY STREAM ({activityLog.length})
        </span>
      </button>
    );
  }

  return (
    <aside
      className={`w-96 shrink-0 bg-neutral-950 border-l border-neutral-800 flex flex-col font-mono text-xs h-[calc(100vh-3.5rem)] sticky top-14 z-30 shadow-2xl ${className}`}
      aria-label="Activity Stream Side Panel"
    >
      {/* Panel Header */}
      <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-rose-500" />
          <div>
            <div className="font-bold text-neutral-100 flex items-center gap-1.5">
              <span>STREAM</span>
              <span className="text-neutral-500">·</span>
              <span className="text-neutral-200">{recordId}</span>
            </div>
            <div className="text-[10px] text-neutral-500 truncate max-w-[200px]">
              {recordTitle}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 border border-emerald-900/60 bg-emerald-950/40">
            LIVE
          </span>
          <button
            onClick={onToggle}
            className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors"
            title="Collapse Activity Stream"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {postNotice && (
        <div className="px-3 py-1.5 bg-emerald-950/40 border-b border-emerald-900/60 text-emerald-300 text-[11px] flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{postNotice}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-2.5 border-b border-neutral-800 bg-neutral-900/30 space-y-2">
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes, audits, telemetry..."
            className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 pl-7 pr-2.5 py-1 text-[11px] focus:outline-none focus:border-neutral-600 placeholder:text-neutral-600"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto text-[10px] scrollbar-none pb-0.5">
          {[
            { id: 'all', label: `All (${activityLog.length})` },
            { id: 'work_note', label: `Work Notes (${countWorkNotes})` },
            { id: 'comment', label: `Comments (${countComments})` },
            { id: 'field_change', label: `Changes (${countFieldChanges})` },
            { id: 'system', label: 'System' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-2 py-0.5 transition-colors whitespace-nowrap shrink-0 border uppercase font-medium ${
                filterType === f.id
                  ? 'border-neutral-500 bg-neutral-800 text-neutral-100 font-bold'
                  : 'border-neutral-900 bg-neutral-950 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chronological Stream Entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3.5 divide-y divide-neutral-900">
        {filteredLog.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-[11px]">
            No activity stream entries match the current filter.
          </div>
        ) : (
          filteredLog.map(entry => {
            const isWorkNote = entry.type === 'work_note' || entry.action?.includes('WORK NOTE');
            const isComment = entry.type === 'comment' || entry.action?.includes('Customer Comment');
            const isFieldChange = entry.type === 'field_change' || !!entry.fieldChanges || entry.action?.includes('Status');
            const isSystemAlert = entry.type === 'system_alert' || entry.author?.toLowerCase().includes('zabbix') || entry.author?.toLowerCase().includes('bot');

            return (
              <div key={entry.id} className="pt-3 first:pt-0 space-y-1.5">
                {/* Entry Header */}
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-bold text-neutral-200 truncate">{entry.author}</span>
                    <span className="text-neutral-600">·</span>
                    <span className="text-[10px] text-neutral-500 uppercase">{entry.action}</span>
                  </div>

                  <span className="text-[10px] text-neutral-500 tabular-nums shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Badge Tag */}
                <div className="flex items-center gap-1 text-[10px]">
                  {isWorkNote && (
                    <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Work Note (Internal)</span>
                    </span>
                  )}
                  {isComment && (
                    <span className="inline-flex items-center gap-1 text-sky-400 font-medium">
                      <Globe className="w-2.5 h-2.5" />
                      <span>Customer Visible</span>
                    </span>
                  )}
                  {isFieldChange && (
                    <span className="inline-flex items-center gap-1 text-neutral-400 font-medium">
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Audit Trail</span>
                    </span>
                  )}
                  {isSystemAlert && (
                    <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                      <AlertCircle className="w-2.5 h-2.5" />
                      <span>Automated Diagnostic</span>
                    </span>
                  )}
                </div>

                {/* Field Change Diff Box if applicable */}
                {entry.fieldChanges && entry.fieldChanges.length > 0 && (
                  <div className="p-2 border border-neutral-800 bg-neutral-900/40 text-[10px] space-y-1">
                    {entry.fieldChanges.map((fc, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-neutral-500 uppercase font-bold">{fc.field}:</span>
                        <span className="line-through text-neutral-500">{fc.from}</span>
                        <span className="text-neutral-600">→</span>
                        <span className="text-emerald-400 font-bold">{fc.to}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Note Content */}
                <div
                  className={`p-2.5 border text-xs leading-relaxed whitespace-pre-wrap ${
                    isWorkNote
                      ? 'border-amber-900/50 bg-amber-950/20 text-amber-200/90'
                      : isComment
                      ? 'border-neutral-800 bg-neutral-900/30 text-neutral-200'
                      : 'border-neutral-900 bg-neutral-950 text-neutral-400'
                  }`}
                >
                  {entry.note}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Interactive Composer */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-900/40 space-y-2.5">
        {/* Toggle Composer Type */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setComposerType('work_note')}
            className={`flex-1 py-1 text-center transition-colors border text-[10px] uppercase font-bold flex items-center justify-center gap-1 ${
              composerType === 'work_note'
                ? 'border-amber-600 bg-amber-950/40 text-amber-300'
                : 'border-neutral-800 bg-neutral-950 text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Lock className="w-3 h-3" />
            <span>Work Note</span>
          </button>

          <button
            type="button"
            onClick={() => setComposerType('comment')}
            className={`flex-1 py-1 text-center transition-colors border text-[10px] uppercase font-bold flex items-center justify-center gap-1 ${
              composerType === 'comment'
                ? 'border-neutral-400 bg-neutral-800 text-neutral-100'
                : 'border-neutral-800 bg-neutral-950 text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>Customer Comment</span>
          </button>
        </div>

        {/* Canned Snippet Chips */}
        <div className="flex items-center gap-1 overflow-x-auto text-[10px] scrollbar-none pb-0.5">
          <span className="text-neutral-500 uppercase text-[9px] shrink-0">Snippets:</span>
          {[
            'Optical test normal',
            'Rollback plan staged',
            'Pending vendor escalation',
            'Client notified by phone'
          ].map((snip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleInsertSnippet(snip)}
              className="px-1.5 py-0.5 border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:border-neutral-600 shrink-0 whitespace-nowrap"
            >
              +{snip}
            </button>
          ))}
        </div>

        {/* Text Area */}
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            rows={3}
            value={composerNote}
            onChange={e => setComposerNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              composerType === 'work_note'
                ? 'Add technical work note (Ctrl+Enter to post)...'
                : 'Post customer visible comment (Ctrl+Enter to post)...'
            }
            className={`w-full p-2 border focus:outline-none text-xs resize-none ${
              composerType === 'work_note'
                ? 'bg-amber-950/10 border-amber-900/60 text-amber-100 placeholder:text-amber-700/60'
                : 'bg-neutral-950 border-neutral-700 text-neutral-200 placeholder:text-neutral-600'
            }`}
          />

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-500">
              Author: {currentUser.name}
            </span>

            <button
              type="submit"
              disabled={!composerNote.trim()}
              className="px-3.5 py-1.5 bg-neutral-100 hover:bg-white disabled:opacity-40 text-neutral-950 font-bold flex items-center gap-1.5 transition-colors text-xs"
            >
              <Send className="w-3 h-3" />
              <span>Post</span>
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
};
