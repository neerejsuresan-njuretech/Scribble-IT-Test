import React, { useState, useEffect } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { driveService, DriveFile } from '../../services/workspaceService';
import { HardDrive, Plus, ExternalLink, RefreshCw, FileText, Search, CheckCircle2, AlertCircle } from 'lucide-react';

export const GoogleDriveModule: React.FC = () => {
  const { googleUser, googleToken, loginWithGoogle } = useITSM();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docName, setDocName] = useState('P1-Incident-Post-Mortem-Report-INC-2048.txt');
  const [docContent, setDocContent] = useState(
    'INCIDENT POST-MORTEM REPORT\n============================\nIncident: INC-2048\nTitle: Core Distribution Switch Stack B flapping\nRoot Cause: Optical transceiver thermal saturation\nResolution: Industrial rated SFP-10G-SR-X deployed with 4U slotted baffles.'
  );

  const fetchFiles = async () => {
    if (!googleToken) return;
    setLoading(true);
    setError(null);
    try {
      const list = await driveService.listFiles();
      setFiles(list);
    } catch (err: any) {
      setError(err.message || 'Failed to list Google Drive files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (googleToken) {
      fetchFiles();
    }
  }, [googleToken]);

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const uploaded = await driveService.uploadTextFile(docName, docContent);
      setStatusMessage(`Document uploaded to Google Drive: ${uploaded.name}`);
      setShowUploadModal(false);
      fetchFiles();
    } catch (err: any) {
      setError(err.message || 'Failed to upload document to Google Drive');
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-400">GOOGLE WORKSPACE INTEGRATION // DRIVE API</div>
          <h1 className="text-xl font-bold text-neutral-100 flex items-center gap-3">
            <span>GOOGLE DRIVE IT DOCUMENT REPOSITORY</span>
            <span className="text-xs font-normal text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span>DRIVE v3 ACTIVE</span>
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {googleToken ? (
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider transition-colors flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload IT Report</span>
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

      {/* Drive File Browser */}
      {googleToken ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search IT documents, diagrams, RCA post-mortems in Drive..."
                className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 pl-8 pr-3 py-1.5 focus:outline-none"
              />
            </div>
            <button
              onClick={fetchFiles}
              disabled={loading}
              className="px-3 py-1.5 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="border border-neutral-800 bg-neutral-950 divide-y divide-neutral-800/80">
            {filteredFiles.length === 0 && !loading ? (
              <div className="p-8 text-center text-neutral-500">
                No matching Google Drive files found. Click "Upload IT Report" to store documents in Drive.
              </div>
            ) : (
              filteredFiles.map(file => (
                <div key={file.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-neutral-900/40 transition-colors">
                  <div className="flex items-center gap-3 truncate">
                    <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                    <div className="truncate">
                      <div className="text-neutral-200 font-bold truncate">{file.name}</div>
                      <div className="text-[11px] text-neutral-500 truncate">{file.mimeType}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {file.modifiedTime && (
                      <span className="text-[11px] text-neutral-500 tabular-nums">
                        {new Date(file.modifiedTime).toLocaleDateString()}
                      </span>
                    )}
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 border border-neutral-700 bg-neutral-900 text-rose-400 hover:text-white flex items-center gap-1 text-[11px]"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 border border-neutral-800 bg-neutral-900/20 text-center space-y-4">
          <HardDrive className="w-8 h-8 text-neutral-500 mx-auto" />
          <div className="space-y-1">
            <div className="text-sm font-bold text-neutral-200">Connect Google Drive Repository</div>
            <p className="text-neutral-400 max-w-md mx-auto">
              Store ticket evidence, change validation receipts, and network topologies directly in Google Drive with enterprise permission isolation.
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

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 p-6 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <span className="text-sm font-bold text-neutral-100 uppercase">Upload Document to Google Drive</span>
              <button onClick={() => setShowUploadModal(false)} className="text-neutral-500 hover:text-neutral-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadDoc} className="space-y-3">
              <div>
                <label className="text-neutral-400 block mb-1">File Name</label>
                <input
                  type="text"
                  required
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">File Content</label>
                <textarea
                  rows={5}
                  value={docContent}
                  onChange={e => setDocContent(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold"
                >
                  {loading ? 'Uploading to Drive...' : 'Upload File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
