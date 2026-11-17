import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { GraduationCap, CheckSquare, Square, Award } from 'lucide-react';

export const LmsPage: React.FC = () => {
  const { activeTenant, lmsCourses, toggleLmsLesson, completeLmsQuiz } = useITSM();
  const [selectedId, setSelectedId] = useState<string>(lmsCourses[0]?.id || '');

  const selected = lmsCourses.find(c => c.id === selectedId) || lmsCourses[0];

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-500 uppercase tracking-wider">{activeTenant.name} · SCORM-COMPLIANT TRAINING & COMPLIANCE</div>
          <h1 className="text-xl font-bold text-neutral-100 mt-0.5 flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-rose-500" />
            <span>LEARNING MANAGEMENT (LMS)</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">
              {lmsCourses.filter(c => c.certified).length}/{lmsCourses.length} Certified
            </span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 border border-neutral-800 divide-y divide-neutral-900 bg-neutral-950">
          {lmsCourses.length === 0 ? (
            <div className="p-6 text-center text-neutral-500">
              No training courses registered for {activeTenant.name}.
            </div>
          ) : (
            lmsCourses.map(c => {
              const doneCount = c.lessons.filter(l => l.completed).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left p-4 transition-colors ${selected?.id === c.id ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-900/40 text-neutral-300'}`}
                >
                  <div className="flex items-center justify-between text-[11px] text-neutral-500">
                    <span>{c.category.toUpperCase()} · {c.durationMins}m</span>
                    <span className={c.certified ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {c.certified ? 'CERTIFIED' : c.mandatory ? 'MANDATORY' : 'OPTIONAL'}
                    </span>
                  </div>
                  <div className="font-bold text-neutral-100 mt-1">{c.title}</div>
                  <div className="text-neutral-500 mt-1 tabular-nums">{doneCount}/{c.lessons.length} Lessons Completed</div>
                </button>
              );
            })
          )}
        </div>

        {selected ? (
          <div className="lg:col-span-7 border border-neutral-800 bg-neutral-900/30 p-6 space-y-5">
            <div className="border-b border-neutral-800 pb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-neutral-500">{selected.id} · {selected.category} · {selected.durationMins} Minutes</div>
                <h2 className="text-lg font-bold text-neutral-100 mt-1">{selected.title}</h2>
              </div>
              {selected.certified && (
                <div className="text-emerald-400 font-bold flex items-center gap-1.5 shrink-0">
                  <Award className="w-4 h-4" />
                  <span>Certified {selected.scorePct ? `(${selected.scorePct}%)` : ''}</span>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="text-neutral-400 font-bold uppercase">COURSE MODULES</div>
              {selected.lessons.map(lesson => (
                <button
                  key={lesson.id}
                  onClick={() => toggleLmsLesson(selected.id, lesson.id)}
                  className="w-full p-3.5 border border-neutral-800 bg-neutral-950 hover:border-neutral-600 text-left flex items-start gap-3"
                >
                  {lesson.completed ? <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <Square className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />}
                  <div>
                    <div className={`font-bold ${lesson.completed ? 'text-neutral-400 line-through' : 'text-neutral-100'}`}>{lesson.title}</div>
                    <div className="text-neutral-400 mt-1">{lesson.summary}</div>
                  </div>
                </button>
              ))}
            </div>

            {!selected.certified && (
              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                <span className="text-neutral-400">Complete all modules or pass the final assessment to earn tenant compliance certification.</span>
                <button
                  onClick={() => completeLmsQuiz(selected.id, 100)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold shrink-0"
                >
                  Complete Assessment (100%)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-7 border border-neutral-800 bg-neutral-950 p-10 text-center text-neutral-500">
            No LMS courses available in this workspace yet.
          </div>
        )}
      </div>
    </div>
  );
};
