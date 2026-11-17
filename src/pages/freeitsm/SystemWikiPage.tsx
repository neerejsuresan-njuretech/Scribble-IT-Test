import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { WikiPage } from '../../types/itsm';
import {
  FileCode2,
  Plus,
  Save,
  Globe,
  RefreshCw,
  Newspaper,
  BookOpen,
  ExternalLink,
  Search,
  AlertCircle,
  Check,
  FilePlus2,
  ListPlus
} from 'lucide-react';

type GroundingMode = 'documentation_update' | 'industry_news' | 'page_refresh';

interface GroundingSource {
  title: string;
  uri: string;
}

interface GroundingResponse {
  summary: string;
  sources: GroundingSource[];
  searchQueries: string[];
  model: string;
  generatedAt: string;
}

const PRESET_TOPICS: Array<{ label: string; query: string; mode: GroundingMode }> = [
  {
    label: 'Critical CVEs & Security Advisories',
    query: 'Critical CVEs, CISA KEV additions, and enterprise security advisories this week',
    mode: 'industry_news'
  },
  {
    label: 'Cloud & Kubernetes Releases',
    query: 'Latest Kubernetes, Linux LTS kernel, and major cloud provider infrastructure advisories',
    mode: 'industry_news'
  },
  {
    label: 'Microsoft 365 & Entra ID Changes',
    query: 'Latest Microsoft 365, Entra ID, and Windows Server admin documentation updates and deprecations',
    mode: 'documentation_update'
  },
  {
    label: 'ITIL 4 & ISO 27001 Standards',
    query: 'Current ISO/IEC 27001:2022 and ITIL 4 incident and change management guidance updates',
    mode: 'documentation_update'
  }
];

export const SystemWikiPage: React.FC = () => {
  const { activeTenant, wikiPages, createWikiPage, updateWikiPage, showToast } = useITSM();
  const [selectedId, setSelectedId] = useState<string>(wikiPages[0]?.id || '');
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSection, setNewSection] = useState<WikiPage['section']>('Architecture');
  const [newBody, setNewBody] = useState('');

  // Google Search Grounding state
  const [showGroundingPanel, setShowGroundingPanel] = useState(true);
  const [groundingMode, setGroundingMode] = useState<GroundingMode>('industry_news');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [groundingError, setGroundingError] = useState<string | null>(null);
  const [groundingResult, setGroundingResult] = useState<GroundingResponse | null>(null);
  const [lastTopicLabel, setLastTopicLabel] = useState('');

  const selected = wikiPages.find(w => w.id === selectedId) || wikiPages[0];

  const handleStartEdit = () => {
    if (!selected) return;
    setDraftContent(selected.content);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!selected) return;
    updateWikiPage(selected.id, draftContent);
    setIsEditing(false);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const p = createWikiPage({ title: newTitle, section: newSection, content: newBody });
    setSelectedId(p.id);
    setNewTitle('');
    setNewBody('');
    setShowNew(false);
  };

  const executeGrounding = async (
    queryText: string,
    mode: GroundingMode,
    pageContext?: WikiPage
  ) => {
    const trimmed = queryText.trim();
    if (!trimmed && mode !== 'page_refresh') {
      setGroundingError('Enter an IT topic, product, CVE, or documentation question to search.');
      return;
    }

    setIsSearching(true);
    setGroundingError(null);
    setLastTopicLabel(
      mode === 'page_refresh' && pageContext
        ? `Live Check: ${pageContext.title}`
        : trimmed
    );

    try {
      const res = await fetch('/api/wiki/grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          mode,
          existingTitle: pageContext?.title,
          existingSection: pageContext?.section,
          existingContent: pageContext?.content
        })
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || `Search grounding request failed (${res.status})`;
        setGroundingError(msg);
        showToast({ variant: 'error', title: 'Live Search Failed', description: msg });
        return;
      }

      setGroundingResult(data as GroundingResponse);
      const count = Array.isArray(data.sources) ? data.sources.length : 0;
      showToast({
        variant: 'success',
        title: 'Live Grounded Update Ready',
        description: `Verified with ${count} Google Search source${count === 1 ? '' : 's'}.`
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error reaching grounding service.';
      setGroundingError(msg);
      showToast({ variant: 'error', title: 'Live Search Error', description: msg });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeGrounding(searchQuery, groundingMode, groundingMode === 'page_refresh' ? selected : undefined);
  };

  const handleRefreshSelectedPage = () => {
    if (!selected) return;
    setShowGroundingPanel(true);
    setGroundingMode('page_refresh');
    const q = `Latest updates, deprecations, security advisories, and best practices for ${selected.title}`;
    setSearchQuery(q);
    executeGrounding(q, 'page_refresh', selected);
  };

  const formatGroundedMarkdown = (res: GroundingResponse, heading: string) => {
    const dateTag = new Date(res.generatedAt).toISOString().split('T')[0];
    const sourceLines =
      res.sources.length > 0
        ? `\n\n### Verified Web Sources (${dateTag})\n` +
          res.sources.map(s => `- [${s.title}](${s.uri})`).join('\n')
        : '';
    return `## ${heading} (Live Update · ${dateTag})\n\n${res.summary}${sourceLines}`;
  };

  const handleAppendToSelected = () => {
    if (!selected || !groundingResult) return;
    const block = formatGroundedMarkdown(groundingResult, lastTopicLabel || 'Real-Time Grounded Update');
    const separator = selected.content.trim() ? '\n\n---\n\n' : '';
    const updated = `${selected.content.trim()}${separator}${block}`;
    updateWikiPage(selected.id, updated);
    if (isEditing) {
      setDraftContent(updated);
    }
  };

  const handleSaveAsNewPage = () => {
    if (!groundingResult) return;
    const titleBase = (lastTopicLabel || searchQuery || 'Real-Time IT Update').replace(/^Live Check:\s*/i, '').slice(0, 72);
    const dateTag = new Date(groundingResult.generatedAt).toISOString().split('T')[0];
    const body = formatGroundedMarkdown(groundingResult, titleBase);
    const section: WikiPage['section'] = groundingMode === 'industry_news' ? 'SOPs' : 'Architecture';
    const created = createWikiPage({
      title: `${titleBase} (${dateTag})`,
      section,
      content: body
    });
    setSelectedId(created.id);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · INTERNAL ENGINEERING DOCUMENTATION</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <FileCode2 className="w-5 h-5 text-rose-500" />
            <span>SYSTEM WIKI</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">{wikiPages.length} Pages</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowGroundingPanel(prev => !prev)}
            className={`px-3.5 py-2 border font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
              showGroundingPanel
                ? 'border-sky-600 bg-sky-950/50 text-sky-300'
                : 'border-neutral-700 bg-neutral-950 hover:border-neutral-500 text-neutral-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Live Search Grounding</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Wiki Page</span>
          </button>
        </div>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} className="p-4 border border-neutral-700 bg-neutral-900/50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input required value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Page Title" className="sm:col-span-2 bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
            <select value={newSection} onChange={e => setNewSection(e.target.value as WikiPage['section'])} className="bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100">
              <option value="Architecture">Architecture</option>
              <option value="Runbooks">Runbooks</option>
              <option value="SOPs">SOPs</option>
              <option value="Onboarding">Onboarding</option>
            </select>
          </div>
          <textarea rows={4} value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Documentation markdown / specs..." className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 bg-rose-600 text-white font-bold">Publish Page</button>
          </div>
        </form>
      )}

      {showGroundingPanel && (
        <section className="border border-sky-900/60 bg-neutral-950 p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
            <div>
              <div className="text-[10px] text-sky-400 font-bold uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" />
                <span>GOOGLE SEARCH GROUNDING · REAL-TIME IT INTELLIGENCE</span>
              </div>
              <p className="text-neutral-400 mt-1">
                Fetch live vendor documentation updates, CVEs, release notes, and industry news with verified source links to update or publish Wiki pages.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setGroundingMode('industry_news')}
                className={`px-2.5 py-1.5 border flex items-center gap-1.5 ${
                  groundingMode === 'industry_news'
                    ? 'border-sky-500 bg-sky-950/60 text-sky-200 font-bold'
                    : 'border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Newspaper className="w-3.5 h-3.5" />
                <span>Industry News &amp; CVEs</span>
              </button>
              <button
                type="button"
                onClick={() => setGroundingMode('documentation_update')}
                className={`px-2.5 py-1.5 border flex items-center gap-1.5 ${
                  groundingMode === 'documentation_update'
                    ? 'border-sky-500 bg-sky-950/60 text-sky-200 font-bold'
                    : 'border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>IT Docs Research</span>
              </button>
              {selected && (
                <button
                  type="button"
                  onClick={() => setGroundingMode('page_refresh')}
                  className={`px-2.5 py-1.5 border flex items-center gap-1.5 ${
                    groundingMode === 'page_refresh'
                      ? 'border-sky-500 bg-sky-950/60 text-sky-200 font-bold'
                      : 'border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Verify Selected Page</span>
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  groundingMode === 'page_refresh' && selected
                    ? `Optional focus for verifying "${selected.title}"...`
                    : groundingMode === 'industry_news'
                    ? 'Search real-time IT news, CVEs, vendor outages, EOL dates...'
                    : 'Search latest official IT documentation, RFCs, CLI/cloud updates...'
                }
                className="w-full bg-neutral-900 border border-neutral-700 focus:border-sky-500 outline-none pl-9 pr-3 py-2 text-neutral-100"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
              <span>{isSearching ? 'Searching Web...' : 'Fetch Live Update'}</span>
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-neutral-500 uppercase">Quick Feeds:</span>
            {PRESET_TOPICS.map(preset => (
              <button
                key={preset.label}
                type="button"
                disabled={isSearching}
                onClick={() => {
                  setGroundingMode(preset.mode);
                  setSearchQuery(preset.query);
                  executeGrounding(preset.query, preset.mode);
                }}
                className="px-2.5 py-1 border border-neutral-800 bg-neutral-900/70 hover:border-sky-700 text-neutral-300 hover:text-sky-200 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {groundingError && (
            <div className="border border-rose-800 bg-rose-950/40 p-3 text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-rose-300">Google Search Grounding Unavailable</div>
                <div className="text-rose-200/90">{groundingError}</div>
              </div>
            </div>
          )}

          {groundingResult && (
            <div className="border border-neutral-800 bg-neutral-900/40 p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                <div>
                  <div className="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      GROUNDED BRIEF · {groundingResult.sources.length} SOURCE{groundingResult.sources.length === 1 ? '' : 'S'} ·{' '}
                      {new Date(groundingResult.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-neutral-100 font-bold mt-0.5">{lastTopicLabel}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {selected && (
                    <button
                      type="button"
                      onClick={handleAppendToSelected}
                      className="px-3 py-1.5 border border-emerald-700 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 font-bold flex items-center gap-1.5"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                      <span>Append to &ldquo;{selected.id}&rdquo;</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveAsNewPage}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5"
                  >
                    <FilePlus2 className="w-3.5 h-3.5" />
                    <span>Save as New Wiki Page</span>
                  </button>
                </div>
              </div>

              <pre className="whitespace-pre-wrap bg-neutral-950 border border-neutral-800 p-4 text-neutral-200 leading-relaxed font-mono max-h-96 overflow-y-auto">
                {groundingResult.summary}
              </pre>

              {groundingResult.searchQueries.length > 0 && (
                <div className="text-[11px] text-neutral-400 flex flex-wrap items-center gap-2">
                  <span className="text-neutral-500 uppercase">Queries:</span>
                  {groundingResult.searchQueries.map((q, idx) => (
                    <span key={`${q}-${idx}`} className="px-2 py-0.5 bg-neutral-950 border border-neutral-800 text-neutral-300">
                      {q}
                    </span>
                  ))}
                </div>
              )}

              {groundingResult.sources.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-neutral-500 uppercase font-bold">Verified Grounding Citations</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {groundingResult.sources.map(src => (
                      <a
                        key={src.uri}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 p-2.5 border border-neutral-800 bg-neutral-950 hover:border-sky-600 text-neutral-200 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-sky-300 truncate">{src.title}</div>
                          <div className="text-[10px] text-neutral-500 truncate">{src.uri}</div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 border border-neutral-800 divide-y divide-neutral-900 bg-neutral-950">
          {wikiPages.length === 0 ? (
            <div className="p-6 text-center text-neutral-500">
              No wiki pages yet.
            </div>
          ) : (
            wikiPages.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedId(p.id); setIsEditing(false); }}
                className={`w-full text-left p-4 transition-colors ${selected?.id === p.id ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-900/40 text-neutral-300'}`}
              >
                <div className="text-[11px] text-neutral-500">{p.section.toUpperCase()} · {p.id}</div>
                <div className="font-bold text-neutral-100 mt-1">{p.title}</div>
                <div className="text-[11px] text-neutral-500 mt-1">Updated {p.updatedAt} · {p.author}</div>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-8 border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
          {selected ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-neutral-800 pb-3">
                <div>
                  <div className="text-neutral-500">{selected.section} · Author: {selected.author} · Revised {selected.updatedAt}</div>
                  <h2 className="text-lg font-bold text-neutral-100 mt-1">{selected.title}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isSearching}
                    onClick={handleRefreshSelectedPage}
                    className="px-3 py-1.5 border border-sky-800 bg-sky-950/30 hover:border-sky-500 text-sky-300 font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
                    <span>Check Live Updates</span>
                  </button>
                  {isEditing ? (
                    <button onClick={handleSaveEdit} className="px-3 py-1.5 bg-emerald-600 text-white font-bold flex items-center gap-1.5">
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  ) : (
                    <button onClick={handleStartEdit} className="px-3 py-1.5 border border-neutral-700 hover:border-neutral-500 text-neutral-200">
                      Edit Page
                    </button>
                  )}
                </div>
              </div>

              {isEditing ? (
                <textarea rows={10} value={draftContent} onChange={e => setDraftContent(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 p-4 text-neutral-100 font-mono" />
              ) : (
                <pre className="whitespace-pre-wrap bg-neutral-950 border border-neutral-800 p-4 text-neutral-200 leading-relaxed font-mono">
                  {selected.content}
                </pre>
              )}
            </>
          ) : (
            <div className="text-neutral-500">No wiki pages yet for {activeTenant.name}. Use &ldquo;New Wiki Page&rdquo; or &ldquo;Live Search Grounding&rdquo; to create documentation.</div>
          )}
        </div>
      </div>
    </div>
  );
};
