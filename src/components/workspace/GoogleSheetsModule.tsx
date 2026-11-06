import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { sheetsService } from '../../services/workspaceService';
import { Sheet, Plus, Download, ExternalLink, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export const GoogleSheetsModule: React.FC = () => {
  const { googleUser, googleToken, loginWithGoogle, incidents, assets } = useITSM();
  const [loading, setLoading] = useState(false);
  const [createdSheetUrl, setCreatedSheetUrl] = useState<string | null>(null);
  const [createdSheetTitle, setCreatedSheetTitle] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Export Incidents to Google Sheet
  const handleExportIncidents = async () => {
    if (!googleToken) {
      loginWithGoogle();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const title = `ServiceNow Incidents Outage Report - ${new Date().toISOString().split('T')[0]}`;
      const sheet = await sheetsService.createSpreadsheet(title);

      // Prepare rows
      const headerRow = ['Incident Number', 'Priority', 'State', 'Category', 'Short Description', 'Caller', 'Assignee', 'Created At'];
      const dataRows = incidents.map(i => [
        i.id,
        i.priority,
        i.status,
        i.category,
        i.title,
        i.requesterName,
        i.assignee,
        new Date(i.createdAt).toLocaleString()
      ]);

      await sheetsService.appendRows(sheet.spreadsheetId, 'Sheet1!A1', [headerRow, ...dataRows]);

      setCreatedSheetTitle(title);
      setCreatedSheetUrl(sheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}`);
      setStatusMessage(`Successfully exported ${incidents.length} Incident records to Google Sheets!`);
    } catch (err: any) {
      setError(err.message || 'Failed to export to Google Sheets');
    } finally {
      setLoading(false);
    }
  };

  // Export CMDB to Google Sheet
  const handleExportCMDB = async () => {
    if (!googleToken) {
      loginWithGoogle();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const title = `ServiceNow CMDB Configuration Items - ${new Date().toISOString().split('T')[0]}`;
      const sheet = await sheetsService.createSpreadsheet(title);

      const headerRow = ['Asset Tag', 'CI Name', 'Type', 'Serial Number', 'Status', 'Location', 'Purchase Cost', 'Current Value'];
      const dataRows = assets.map(a => [
        a.assetTag,
        a.name,
        a.type,
        a.serialNumber,
        a.status,
        a.location,
        a.purchaseCost,
        a.currentBookValue
      ]);

      await sheetsService.appendRows(sheet.spreadsheetId, 'Sheet1!A1', [headerRow, ...dataRows]);

      setCreatedSheetTitle(title);
      setCreatedSheetUrl(sheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}`);
      setStatusMessage(`Successfully exported ${assets.length} CMDB assets to Google Sheets!`);
    } catch (err: any) {
      setError(err.message || 'Failed to export CMDB to Google Sheets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-neutral-400">GOOGLE WORKSPACE INTEGRATION // SHEETS API</div>
          <h1 className="text-xl font-bold text-neutral-100 flex items-center gap-3">
            <span>GOOGLE SHEETS LIVE DATA SYNC</span>
            <span className="text-xs font-normal text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span>SHEETS v4 ACTIVE</span>
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {!googleToken && (
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
        <div className="p-3 border border-emerald-800 bg-emerald-950/30 text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          {createdSheetUrl && (
            <a
              href={createdSheetUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 text-xs"
            >
              <span>Open in Google Sheets</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 border border-rose-900 bg-rose-950/30 text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2 Fast Action Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 border border-neutral-800 bg-neutral-950 space-y-4">
          <div className="flex items-center gap-2 font-bold text-neutral-100 text-sm">
            <Sheet className="w-5 h-5 text-emerald-400" />
            <span>Synchronize Incidents to Spreadsheet</span>
          </div>
          <p className="text-neutral-400 leading-relaxed">
            Exports all active P1-P4 incidents, SLA metrics, assigned technicians, and diagnostic timestamps into a new Google Spreadsheet for executive reporting and BI analysis.
          </p>
          <div className="pt-2">
            <button
              onClick={handleExportIncidents}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{loading ? 'Creating Spreadsheet...' : 'Export Incidents to Sheet'}</span>
            </button>
          </div>
        </div>

        <div className="p-6 border border-neutral-800 bg-neutral-950 space-y-4">
          <div className="flex items-center gap-2 font-bold text-neutral-100 text-sm">
            <Sheet className="w-5 h-5 text-sky-400" />
            <span>Synchronize CMDB Assets to Spreadsheet</span>
          </div>
          <p className="text-neutral-400 leading-relaxed">
            Exports configuration items, servers, networking switches, serial numbers, warranty expiry schedules, and book values into a structured inventory spreadsheet.
          </p>
          <div className="pt-2">
            <button
              onClick={handleExportCMDB}
              disabled={loading}
              className="px-4 py-2 border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 disabled:opacity-50 font-bold transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{loading ? 'Creating Spreadsheet...' : 'Export CMDB to Sheet'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Spreadsheet Data Grid Preview */}
      <div className="border border-neutral-800 bg-neutral-950 p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-neutral-400">
          <span className="font-bold text-neutral-200 uppercase">Live Spreadsheet Sync Preview (Incidents Table)</span>
          <span className="text-neutral-500">Auto-formatted for Google Sheets</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] font-mono">
            <thead className="bg-neutral-900/60 text-neutral-400 uppercase border-b border-neutral-800">
              <tr>
                <th className="p-2.5">Row</th>
                <th className="p-2.5">Incident ID</th>
                <th className="p-2.5">Priority</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Category</th>
                <th className="p-2.5">Summary</th>
                <th className="p-2.5">Assignee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80 text-neutral-300">
              {incidents.slice(0, 5).map((inc, i) => (
                <tr key={inc.id} className="hover:bg-neutral-900/40">
                  <td className="p-2.5 text-neutral-600 tabular-nums">{i + 1}</td>
                  <td className="p-2.5 font-bold text-neutral-100">{inc.id}</td>
                  <td className="p-2.5">
                    <span className={inc.priority === 'P1' ? 'text-rose-500 font-bold' : 'text-amber-500'}>
                      {inc.priority}
                    </span>
                  </td>
                  <td className="p-2.5 uppercase">{inc.status}</td>
                  <td className="p-2.5 uppercase text-neutral-400">{inc.category}</td>
                  <td className="p-2.5 max-w-xs truncate">{inc.title}</td>
                  <td className="p-2.5 text-neutral-400">{inc.assignee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
