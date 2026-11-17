import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { TaskColumn } from '../../types/itsm';
import { Kanban, Plus, Clock, ArrowRight, CheckSquare, Square } from 'lucide-react';

const COLUMNS: { id: TaskColumn; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' }
];

export const TasksKanbanPage: React.FC = () => {
  const { activeTenant, tasks, createTask, moveTaskColumn, toggleSubtask, logTaskTime, incidents, projects } = useITSM();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [dueDate, setDueDate] = useState('2026-11-24');
  const [linkedRecordId, setLinkedRecordId] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createTask({ title: title.trim(), priority, dueDate, linkedRecordId: linkedRecordId || undefined });
    setTitle('');
    setLinkedRecordId('');
    setShowNew(false);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · KANBAN TASK BOARD</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <Kanban className="w-5 h-5 text-rose-500" />
            <span>TASKS & SUBTASKS</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">{tasks.length} Tasks</span>
          </h1>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showNew ? 'Cancel' : 'New Task'}</span>
        </button>
      </div>

      {showNew && (
        <form onSubmit={handleAdd} className="p-4 border border-neutral-700 bg-neutral-900/50 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-neutral-400 mb-1">Task Title *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Patch nginx ingress nodes" className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100" />
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low')} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-neutral-400 mb-1">Link Ticket / Project</label>
            <select value={linkedRecordId} onChange={e => setLinkedRecordId(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100">
              <option value="">None</option>
              {incidents.map(i => <option key={i.id} value={i.id}>{i.id}</option>)}
              {projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 px-2 py-2 text-neutral-100" />
            <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold shrink-0">Add</button>
          </div>
        </form>
      )}

      {/* 5-Column Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
        {COLUMNS.map((col, colIdx) => {
          const colTasks = tasks.filter(t => t.column === col.id);
          const nextCol = COLUMNS[colIdx + 1];
          return (
            <div key={col.id} className="border border-neutral-800 bg-neutral-950 flex flex-col">
              <div className="px-3 py-2.5 border-b border-neutral-800 bg-neutral-900/60 flex items-center justify-between font-bold text-neutral-200 uppercase">
                <span>{col.label}</span>
                <span className="text-neutral-500 tabular-nums">{colTasks.length}</span>
              </div>

              <div className="p-2.5 space-y-2.5 min-h-[260px]">
                {colTasks.map(task => (
                  <div key={task.id} className="p-3 border border-neutral-800 bg-neutral-900/30 space-y-2.5">
                    <div className="flex items-center justify-between text-[10px] text-neutral-500">
                      <span>{task.id} {task.linkedRecordId ? `· ${task.linkedRecordId}` : ''}</span>
                      <span className={task.priority === 'high' ? 'text-rose-400 font-bold' : task.priority === 'medium' ? 'text-amber-400' : 'text-neutral-400'}>
                        {task.priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="font-bold text-neutral-100 leading-snug">{task.title}</div>

                    {/* Subtasks checklist */}
                    {task.subtasks.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-neutral-800/80">
                        {task.subtasks.map(st => (
                          <button
                            key={st.id}
                            onClick={() => toggleSubtask(task.id, st.id)}
                            className="w-full text-left flex items-start gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-200"
                          >
                            {st.done ? <CheckSquare className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" /> : <Square className="w-3 h-3 text-neutral-600 shrink-0 mt-0.5" />}
                            <span className={st.done ? 'line-through text-neutral-600' : ''}>{st.title}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500 tabular-nums">
                      <span>{task.assignee.split(' ')[0]} · {task.dueDate}</span>
                      <button
                        onClick={() => logTaskTime(task.id, 15)}
                        className="flex items-center gap-1 hover:text-neutral-200"
                        title="Log +15m time"
                      >
                        <Clock className="w-3 h-3" />
                        <span>{task.timeLoggedMins}m</span>
                      </button>
                    </div>

                    {nextCol && (
                      <button
                        onClick={() => moveTaskColumn(task.id, nextCol.id)}
                        className="w-full py-1 border border-neutral-800 hover:border-neutral-600 bg-neutral-950 text-neutral-400 hover:text-neutral-100 flex items-center justify-center gap-1 text-[10px]"
                      >
                        <span>Move to {nextCol.label}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <div className="py-8 text-center text-neutral-600">Empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
