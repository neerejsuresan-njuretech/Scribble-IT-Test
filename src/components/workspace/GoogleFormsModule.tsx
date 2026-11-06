import React, { useState, useEffect } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { formsService, DriveFile, FormResponse } from '../../services/workspaceService';
import { FileText, Plus, ExternalLink, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export const GoogleFormsModule: React.FC = () => {
  const { googleUser, googleToken, loginWithGoogle, createIncident } = useITSM();
  const [forms, setForms] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Create form modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formTitle, setFormTitle] = useState('Employee IT Incident Intake Form');
  const [formDesc, setFormDesc] = useState('Report hardware, software, or network anomalies to Scribble IT Service Desk');

  // Load forms
  const fetchForms = async () => {
    if (!googleToken) return;
    setLoading(true);
    setError(null);
    try {
      const list = await formsService.listForms();
      setForms(list);
    } catch (err: any) {
      setError(err.message || 'Failed to list Google Forms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (googleToken) {
      fetchForms();
    }
  }, [googleToken]);

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newForm = await formsService.createITIntakeForm(formTitle, formDesc);
      setStatusMessage(`Google Form created: ${newForm.info.title}`);
      setShowCreateModal(false);
      fetchForms();
    } catch (err: any) {
      setError(err.message || 'Failed to create Google Form');
    } finally {
      setLoading(false);
    }
  };

  // Simulate or ingest form response into an Incident
  const handleSimulateIntake = (formName: string) => {
    const newInc = createIncident({
      title: `Google Form Submission: ${formName}`,
      description: `Ingested automatically via Google Forms API Integration.\nForm: ${formName}\nSubmission Timestamp: ${new Date().toLocaleString()}\nRequester: Field Employee\nIssue: Workstation VPN unable to authenticate against primary RADIUS cluster.`,
      category: 'software',
      priority: 'P3',
      requesterName: 'Google Form Respondent'
    });
    setStatusMessage(`Created ServiceNow record ${newInc.id} from Form intake!`);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-400">GOOGLE WORKSPACE INTEGRATION // FORMS API</div>
          <h1 className="text-xl font-bold text-neutral-100 flex items-center gap-3">
            <span>GOOGLE FORMS INTAKE PIPELINE</span>
            <span className="text-xs font-normal text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span>LIVE API READY</span>
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {googleToken ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create IT Form</span>
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

      {error && (
        <div className="p-3 border border-rose-900 bg-rose-950/30 text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!googleToken && (
        <div className="p-8 border border-neutral-800 bg-neutral-900/20 text-center space-y-4">
          <FileText className="w-8 h-8 text-neutral-500 mx-auto" />
          <div className="space-y-1">
            <div className="text-sm font-bold text-neutral-200">Connect to Google Workspace to manage Forms</div>
            <p className="text-neutral-400 max-w-md mx-auto">
              Integrate Google Forms to collect customer feedback, employee hardware requests, and automatically ingest form submissions into ServiceNow Incident records.
            </p>
          </div>
          <button
            onClick={loginWithGoogle}
            className="px-4 py-2 bg-neutral-100 text-neutral-950 hover:bg-white font-bold transition-colors inline-flex items-center gap-2"
          >
            <span>Sign In with Google</span>
          </button>
        </div>
      )}

      {/* Forms Grid */}
      {googleToken && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-neutral-400 border-b border-neutral-800/80 pb-2">
            <span>Configured Google Forms ({forms.length})</span>
            <button
              onClick={fetchForms}
              disabled={loading}
              className="flex items-center gap-1.5 hover:text-neutral-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {forms.length === 0 && !loading ? (
            <div className="p-6 border border-neutral-800 bg-neutral-950 text-neutral-400 space-y-3">
              <div>No Google Forms found in connected Google Drive.</div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
              >
                + Create your first IT Survey Form
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forms.map(form => (
                <div
                  key={form.id}
                  className="p-5 border border-neutral-800 bg-neutral-950 hover:border-neutral-700 transition-colors flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                      <span>GOOGLE FORM</span>
                      <span className="text-emerald-400">SYNCED</span>
                    </div>
                    <div className="text-sm font-bold text-neutral-100 line-clamp-2">
                      {form.name}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      ID: {form.id.substring(0, 16)}...
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-900 space-y-2">
                    {form.webViewLink && (
                      <a
                        href={form.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-rose-400 hover:underline flex items-center gap-1.5 text-xs"
                      >
                        <span>Open in Google Forms</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      onClick={() => handleSimulateIntake(form.name)}
                      className="w-full py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ArrowRight className="w-3 h-3" />
                      <span>Ingest Responses to Incident</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 p-6 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <span className="text-sm font-bold text-neutral-100 uppercase">Create New Google Form</span>
              <button onClick={() => setShowCreateModal(false)} className="text-neutral-500 hover:text-neutral-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateForm} className="space-y-3">
              <div>
                <label className="text-neutral-400 block mb-1">Form Title</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Form Description</label>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold"
                >
                  {loading ? 'Creating via API...' : 'Create Form'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
