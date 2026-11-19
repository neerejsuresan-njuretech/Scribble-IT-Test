import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { BookOpen, Plus, Search, ThumbsUp, Sparkles, RefreshCw } from 'lucide-react';
import { aiService } from '../../services/aiService';

export const KnowledgeBasePage: React.FC = () => {
  const { activeTenant, kbArticles, createKbArticle, voteKbHelpful, showToast } = useITSM();
  const [search, setSearch] = useState('');
  const [visFilter, setVisFilter] = useState<'all' | 'public' | 'internal'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [selectedId, setSelectedId] = useState<string>(kbArticles[0]?.id || '');
  const [showNew, setShowNew] = useState(false);
  const PAGE_SIZE = 15;

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Operations');
  const [visibility, setVisibility] = useState<'public' | 'internal'>('public');
  const [content, setContent] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [isDraftingAi, setIsDraftingAi] = useState(false);

  const handleAiDraftKb = async () => {
    const topic = (aiTopic || title).trim();
    if (!topic) {
      showToast({ variant: 'warning', title: 'Topic Required', description: 'Enter a topic or article title for AI drafting.' });
      return;
    }
    setIsDraftingAi(true);
    try {
      const draft = await aiService.draftKbArticle({ topic, category });
      setTitle(draft.title);
      setCategory(draft.category);
      setContent(draft.content);
      showToast({ variant: 'success', title: 'AI Runbook Drafted', description: `Populated "${draft.title}"` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to draft KB article.';
      showToast({ variant: 'error', title: 'AI Draft Failed', description: msg });
    } finally {
      setIsDraftingAi(false);
    }
  };

  const categories = Array.from(new Set(kbArticles.map(k => k.category))).sort();

  const filtered = kbArticles.filter(k => {
    const matchesSearch = k.title.toLowerCase().includes(search.toLowerCase()) ||
      k.content.toLowerCase().includes(search.toLowerCase()) ||
      k.category.toLowerCase().includes(search.toLowerCase()) ||
      k.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchesVis = visFilter === 'all' || k.visibility === visFilter;
    const matchesCat = categoryFilter === 'all' || k.category === categoryFilter;
    return matchesSearch && matchesVis && matchesCat;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedArticles = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selected = filtered.find(k => k.id === selectedId) || pagedArticles[0] || filtered[0];

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const created = createKbArticle({ title: title.trim(), category, visibility, content });
    setSelectedId(created.id);
    setTitle('');
    setContent('');
    setShowNew(false);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · KNOWLEDGE BANK</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-rose-500" />
            <span>KNOWLEDGE BASE</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">{kbArticles.length} Articles</span>
          </h1>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showNew ? 'Cancel' : 'Publish Article'}</span>
        </button>
      </div>

      {showNew && (
        <form onSubmit={handlePublish} className="p-5 border border-neutral-700 bg-neutral-900/50 space-y-4">
          <div className="p-3 border border-sky-900/60 bg-sky-950/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={aiTopic}
              onChange={e => setAiTopic(e.target.value)}
              placeholder="AI Draft Prompt: e.g. Step-by-step SOP for rotating expired TLS certificates on Nginx"
              className="flex-1 bg-neutral-950 border border-neutral-700 px-3 py-1.5 text-neutral-100"
            />
            <button
              type="button"
              disabled={isDraftingAi}
              onClick={handleAiDraftKb}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1.5 shrink-0"
            >
              {isDraftingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{isDraftingAi ? 'Drafting...' : 'AI Draft Runbook'}</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-neutral-400 mb-1">Article Title *</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. How to Enroll FIDO2 Security Key" className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-neutral-400 mb-1">Category</label>
                <input value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
              </div>
              <div>
                <label className="block text-neutral-400 mb-1">Visibility</label>
                <select value={visibility} onChange={e => setVisibility(e.target.value as 'public' | 'internal')} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100">
                  <option value="public">Public Portal</option>
                  <option value="internal">Internal IT</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Runbook / Article Body</label>
            <textarea rows={4} required value={content} onChange={e => setContent(e.target.value)} placeholder="Step-by-step resolution instructions..." className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold">Publish to Knowledge Bank</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search 100+ SOPs, runbooks, tags, error codes..."
            className="w-full bg-neutral-900 border border-neutral-800 pl-8 pr-3 py-2 text-neutral-200 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={e => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="bg-neutral-900 border border-neutral-800 px-2.5 py-2 text-[11px] text-neutral-200 focus:outline-none"
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="flex border border-neutral-800 bg-neutral-900/60 p-0.5">
            {(['all', 'public', 'internal'] as const).map(v => (
              <button
                key={v}
                onClick={() => {
                  setVisFilter(v);
                  setPage(1);
                }}
                className={`px-3 py-1 uppercase text-[11px] ${visFilter === v ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 border border-neutral-800 bg-neutral-950 flex flex-col">
          <div className="divide-y divide-neutral-900">
            {pagedArticles.map(art => (
              <button
                key={art.id}
                onClick={() => setSelectedId(art.id)}
                className={`w-full text-left p-4 transition-colors ${selected?.id === art.id ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-900/40 text-neutral-300'}`}
              >
                <div className="text-[11px] text-neutral-500 flex items-center justify-between gap-2">
                  <span className="truncate">{art.id} · {art.category}</span>
                  <span className="shrink-0">{art.visibility.toUpperCase()}</span>
                </div>
                <div className="font-bold text-neutral-100 mt-1">{art.title}</div>
                <div className="text-[11px] text-neutral-500 mt-1 tabular-nums">
                  {art.views} views · {art.helpfulVotes} helpful · Updated {art.updatedAt}
                </div>
              </button>
            ))}
            {pagedArticles.length === 0 && <div className="p-6 text-center text-neutral-500">No articles match your filter.</div>}
          </div>
          {totalPages > 1 && (
            <div className="border-t border-neutral-800 px-3 py-2.5 flex items-center justify-between text-[11px] bg-neutral-900/40">
              <span className="text-neutral-400 tabular-nums">
                Page {safePage}/{totalPages} ({filtered.length} docs)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 border border-neutral-800 bg-neutral-950 text-neutral-200 disabled:opacity-40 hover:bg-neutral-800"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 border border-neutral-800 bg-neutral-950 text-neutral-200 disabled:opacity-40 hover:bg-neutral-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-7 border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-neutral-800 pb-4">
                <div>
                  <div className="text-neutral-500">{selected.id} · {selected.category} · {selected.visibility.toUpperCase()}</div>
                  <h2 className="text-lg font-bold text-neutral-100 mt-1">{selected.title}</h2>
                  <div className="text-neutral-500 mt-1">Author: {selected.author} · Updated {selected.updatedAt}</div>
                </div>
                <button
                  onClick={() => voteKbHelpful(selected.id)}
                  className="px-3 py-1.5 border border-neutral-700 hover:border-emerald-600 text-neutral-300 hover:text-emerald-300 flex items-center gap-1.5 shrink-0 tabular-nums"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>Helpful ({selected.helpfulVotes})</span>
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-neutral-200 leading-relaxed text-xs bg-neutral-950 p-4 border border-neutral-800">
                {selected.content}
              </pre>
            </>
          ) : (
            <div className="text-neutral-500">Select an article to view its contents.</div>
          )}
        </div>
      </div>
    </div>
  );
};
