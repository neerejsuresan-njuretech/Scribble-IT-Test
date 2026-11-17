import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { CustomFormDefinition, CustomFormField } from '../../types/itsm';
import { LayoutList, Plus, Trash2, Check, Globe } from 'lucide-react';

export const CustomFormsBuilderPage: React.FC = () => {
  const { activeTenant, customForms, createCustomForm, toggleFormPublish } = useITSM();
  const [selectedId, setSelectedId] = useState<string>(customForms[0]?.id || '');

  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<CustomFormDefinition['category']>('access');
  const [fields, setFields] = useState<CustomFormField[]>([]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFormField['type']>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(true);

  const selected = customForms.find(f => f.id === selectedId) || customForms[0];

  const handleAddFieldToDraft = () => {
    if (!newFieldLabel.trim()) return;
    setFields(prev => [
      ...prev,
      {
        id: `f-${Date.now()}`,
        label: newFieldLabel.trim(),
        type: newFieldType,
        required: newFieldRequired,
        options: newFieldType === 'select' ? ['Option A', 'Option B', 'Option C'] : undefined
      }
    ]);
    setNewFieldLabel('');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || fields.length === 0) return;
    const created = createCustomForm({ title: formTitle.trim(), category: formCategory, fields, publishedToPortal: true });
    setSelectedId(created.id);
    setFormTitle('');
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · DYNAMIC SELF-SERVICE INTAKE FORMS</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <LayoutList className="w-5 h-5 text-rose-500" />
            <span>CUSTOM FORMS BUILDER</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">{customForms.length} Forms</span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Form Builder */}
        <form onSubmit={handleSaveForm} className="lg:col-span-6 border border-neutral-800 bg-neutral-900/30 p-5 space-y-4">
          <div className="font-bold text-neutral-200 border-b border-neutral-800 pb-2">BUILD NEW INTAKE FORM</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-neutral-400 mb-1">Form Title *</label>
              <input required value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Cloud Sandbox Provisioning" className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
            </div>
            <div>
              <label className="block text-neutral-400 mb-1">Catalog Category</label>
              <select value={formCategory} onChange={e => setFormCategory(e.target.value as CustomFormDefinition['category'])} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100">
                <option value="access">Access</option>
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
                <option value="cloud">Cloud</option>
                <option value="telephony">Telephony</option>
              </select>
            </div>
          </div>

          <div className="p-3 border border-neutral-800 bg-neutral-950 space-y-3">
            <div className="text-neutral-400 font-bold">ADD FORM FIELD</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
              <input value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} placeholder="Field label..." className="sm:col-span-2 bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-neutral-100" />
              <select value={newFieldType} onChange={e => setNewFieldType(e.target.value as CustomFormField['type'])} className="bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-neutral-100">
                <option value="text">Text</option>
                <option value="textarea">Long Text</option>
                <option value="select">Dropdown</option>
                <option value="date">Date</option>
                <option value="number">Number</option>
                <option value="checkbox">Checkbox</option>
              </select>
              <button type="button" onClick={handleAddFieldToDraft} className="px-3 py-1.5 border border-neutral-600 bg-neutral-800 text-white font-bold flex items-center justify-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <label className="flex items-center gap-2 text-neutral-400 text-[11px]">
              <input type="checkbox" checked={newFieldRequired} onChange={e => setNewFieldRequired(e.target.checked)} className="accent-rose-600" />
              <span>Required field</span>
            </label>
          </div>

          <div className="space-y-1.5">
            <div className="text-neutral-400">FIELD SCHEMA ({fields.length})</div>
            {fields.map((f, idx) => (
              <div key={f.id} className="px-3 py-2 border border-neutral-800 bg-neutral-950 flex items-center justify-between">
                <span>{idx + 1}. <span className="text-neutral-100 font-bold">{f.label}</span> · {f.type} {f.required ? '*' : ''}</span>
                <button type="button" onClick={() => setFields(prev => prev.filter(x => x.id !== f.id))} className="text-neutral-500 hover:text-rose-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button type="submit" className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold">
            Publish Custom Form to Self-Service Portal
          </button>
        </form>

        {/* Right: Existing Forms & Preview */}
        <div className="lg:col-span-6 space-y-4">
          <div className="border border-neutral-800 bg-neutral-950 divide-y divide-neutral-900">
            {customForms.length === 0 ? (
              <div className="p-6 text-center text-neutral-500">
                No custom forms created yet. Add fields and publish a form on the left.
              </div>
            ) : (
              customForms.map(frm => (
                <div
                  key={frm.id}
                  onClick={() => setSelectedId(frm.id)}
                  className={`p-4 flex items-center justify-between gap-3 cursor-pointer ${selected?.id === frm.id ? 'bg-neutral-900' : 'hover:bg-neutral-900/40'}`}
                >
                  <div>
                    <div className="text-[11px] text-neutral-500">{frm.id} · {frm.category.toUpperCase()} · {frm.submissionsCount} submissions</div>
                    <div className="font-bold text-neutral-100 mt-0.5">{frm.title}</div>
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); toggleFormPublish(frm.id); }}
                    className={`px-2.5 py-1 border text-[10px] font-bold flex items-center gap-1 shrink-0 ${
                      frm.publishedToPortal ? 'border-emerald-700 text-emerald-400 bg-emerald-950/30' : 'border-neutral-700 text-neutral-500'
                    }`}
                  >
                    {frm.publishedToPortal ? <Check className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                    <span>{frm.publishedToPortal ? 'LIVE ON PORTAL' : 'DRAFT'}</span>
                  </button>
                </div>
              ))
            )}
          </div>

          {selected && (
            <div className="border border-neutral-800 bg-neutral-900/20 p-5 space-y-3">
              <div className="text-neutral-400 font-bold uppercase">FORM PREVIEW: {selected.title}</div>
              {selected.fields.map(fld => (
                <div key={fld.id} className="space-y-1">
                  <div className="text-neutral-300">{fld.label} {fld.required ? '*' : ''}</div>
                  <div className="px-3 py-2 border border-neutral-800 bg-neutral-950 text-neutral-500">
                    [{fld.type.toUpperCase()} INPUT]
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
