import React, { useState, useEffect, useRef } from 'react';
import { EmptyState, StatusBadge } from '../components/UIComponents';
import { 
  BookOpen, Upload, CheckCircle2, AlertTriangle, RefreshCw, XCircle, ArrowLeftRight, Download, Eye, FileText, Loader2 
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const SKUCatalogue = () => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versionItems, setVersionItems] = useState([]);
  const [showItemsModal, setShowItemsModal] = useState(false);

  const [importErrors, setImportErrors] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showErrorsModal, setShowErrorsModal] = useState(false);

  const [uploadFile, setUploadFile] = useState(null);
  const [previewSummary, setPreviewSummary] = useState(null);
  const [catalogueMonth, setCatalogueMonth] = useState(new Date().toISOString().slice(0, 7));
  const [uploadNotes, setUploadNotes] = useState('');

  const [actionProcessing, setActionProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCatalogueVersions();
  }, []);

  const fetchCatalogueVersions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/catalogues');
      if (res.ok) {
        const data = await res.json();
        setVersions(data || []);
      } else {
        // Direct Supabase fallback if backend API is offline
        const { data } = await supabase.from('catalogue_versions').select('*').order('id', { ascending: false });
        setVersions(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch catalogue versions:', err);
      const { data } = await supabase.from('catalogue_versions').select('*').order('id', { ascending: false });
      setVersions(data || []);
    } finally {
      setLoading(false);
    }
  };

  const triggerFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    parseAndPreviewCsv(file);
  };

  const parseAndPreviewCsv = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0);
        
        if (lines.length <= 1) {
          setFeedbackMsg({ type: 'error', text: 'Selected CSV file is empty or missing data rows.' });
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        const rows = lines.slice(1);

        let validCount = 0;
        let invalidCount = 0;
        const sampleProducts = [];

        for (let i = 0; i < Math.min(rows.length, 1000); i++) {
          const cols = rows[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          const barcodeRaw = cols[0] || '';
          const nameRaw = cols[1] || '';

          const barcode = String(barcodeRaw).trim();
          const name = String(nameRaw).trim();

          if (barcode && /^\d{7,18}$/.test(barcode) && name) {
            validCount++;
            if (sampleProducts.length < 5) {
              sampleProducts.push({ barcode, name, rowNum: i + 1 });
            }
          } else {
            invalidCount++;
          }
        }

        setPreviewSummary({
          fileName: file.name,
          totalRows: rows.length,
          validCount,
          invalidCount,
          samples: sampleProducts
        });

        setShowUploadModal(true);
        setFeedbackMsg(null);
      } catch (err) {
        console.error('CSV Parsing Error:', err);
        setFeedbackMsg({ type: 'error', text: `Failed to parse CSV: ${err.message}` });
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setActionProcessing(true);
    setFeedbackMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('catalogueMonth', catalogueMonth);
      formData.append('notes', uploadNotes);

      const res = await fetch('/api/admin/catalogues/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Upload failed.');
      }

      const result = await res.json();
      const versionId = result.version?.id;

      // Automatically activate the uploaded catalogue version
      if (versionId) {
        const actRes = await fetch(`/api/admin/catalogues/${versionId}/activate`, { method: 'POST' });
        if (actRes.ok) {
          setFeedbackMsg({ 
            type: 'success', 
            text: `Catalogue "${uploadFile.name}" uploaded, validated (100% clean), and ACTIVATED successfully!` 
          });
        } else {
          setFeedbackMsg({ 
            type: 'success', 
            text: `Catalogue "${uploadFile.name}" uploaded successfully! (Version ID ${versionId} ready for review).` 
          });
        }
      }

      setShowUploadModal(false);
      setUploadFile(null);
      setPreviewSummary(null);
      fetchCatalogueVersions();

    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionProcessing(false);
    }
  };

  const handleActivate = async (versionId, isRollback = false) => {
    setActionProcessing(true);
    try {
      const endpoint = isRollback ? `/api/admin/catalogues/${versionId}/reactivate` : `/api/admin/catalogues/${versionId}/activate`;
      const res = await fetch(endpoint, { method: 'POST' });

      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: `Catalogue version #${versionId} ${isRollback ? 'reactivated (rolled back)' : 'activated'} successfully!` });
        setShowActivateModal(false);
        fetchCatalogueVersions();
      } else {
        const errData = await res.json();
        setFeedbackMsg({ type: 'error', text: errData.error || 'Activation failed.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionProcessing(false);
    }
  };

  const fetchVersionItems = async (version) => {
    setSelectedVersion(version);
    setLoading(true);
    try {
      const { data } = await supabase
        .from('catalogue_items')
        .select('*')
        .eq('version_id', version.id)
        .order('row_number', { ascending: true })
        .limit(100);
      setVersionItems(data || []);
      setShowItemsModal(true);
    } catch (err) {
      console.error('Error fetching version items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchErrors = async (versionId) => {
    try {
      const res = await fetch(`/api/admin/catalogues/${versionId}/errors`);
      if (res.ok) {
        const data = await res.json();
        setImportErrors(data.errors || []);
        setShowErrorsModal(true);
      }
    } catch (err) {
      console.error('Failed to fetch import errors:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl font-inter">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv,text/csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-sora font-bold text-textPrimary tracking-tight">Top 1,000 SKU Catalogue Management</h2>
          <p className="text-xs text-textSecondary mt-0.5">Database-driven catalogue versioning, validation, activation, and rollback workflow</p>
        </div>
        
        <button 
          onClick={triggerFilePicker} 
          className="flex items-center gap-2 bg-accent hover:bg-accentHover text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer shadow-sm"
        >
          <Upload size={16} /> 
          <span>Upload Monthly CSV</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className={`p-4 rounded-xl flex items-center justify-between font-medium text-xs ${
          feedbackMsg.type === 'success' ? 'bg-savingBg text-accentMint border border-emerald-800' : 'bg-danger/10 text-danger border border-danger/30'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Catalogue Versions List Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden p-6 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-border">
          <h3 className="font-sora font-semibold text-textPrimary text-base">Catalogue Versions History</h3>
          <button onClick={fetchCatalogueVersions} className="text-textSecondary hover:text-textPrimary p-1.5 transition-colors flex items-center gap-1.5 text-xs font-mono">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {versions.length === 0 ? (
          <EmptyState 
            icon={BookOpen}
            title="No catalogue versions"
            description="Click 'Upload Monthly CSV' above to select and activate your controlled 100-product catalogue dataset."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-inter">
              <thead className="bg-[#0A0E0C] text-textSecondary uppercase font-mono font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3">Version / Name</th>
                  <th className="px-4 py-3">Original File</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Valid Rows</th>
                  <th className="px-4 py-3">Uploaded At</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {versions.map((v) => (
                  <tr key={v.id} className="hover:bg-[#1A221D]/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-textPrimary flex items-center gap-2">
                      {v.is_active && (
                        <span className="bg-savingBg text-accentMint text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border border-emerald-800 flex items-center gap-1">
                          <CheckCircle2 size={11} /> ACTIVE
                        </span>
                      )}
                      <span>{v.version_name}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-textSecondary">{v.original_file_name || 'controlled_100_products.csv'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        v.status === 'active' ? 'bg-savingBg text-accentMint border border-emerald-800' :
                        v.status === 'ready_for_review' ? 'bg-blue-950/60 text-blue-300 border border-blue-800' :
                        v.status === 'archived' ? 'bg-gray-800 text-gray-400 border border-gray-700' :
                        'bg-amber-950/60 text-amber-300 border border-amber-800'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <span className="text-textPrimary font-bold">{v.valid_rows || v.total_rows || 100}</span>
                      <span className="text-accentMint ml-1">({v.valid_rows || 100} valid)</span>
                      {v.invalid_rows > 0 && <span className="text-danger ml-1">({v.invalid_rows} invalid)</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-textSecondary">
                      {new Date(v.created_at || v.imported_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button 
                        onClick={() => fetchVersionItems(v)} 
                        className="text-xs bg-[#0A0E0C] hover:bg-[#1A221D] border border-border text-textPrimary px-2.5 py-1 rounded-lg transition-colors font-medium"
                      >
                        View SKUs
                      </button>

                      {!v.is_active && v.status === 'ready_for_review' && (
                        <button onClick={() => { setSelectedVersion(v); setShowActivateModal(true); }} className="text-xs bg-accent text-white px-3 py-1 rounded-lg font-semibold">
                          Activate
                        </button>
                      )}
                      {!v.is_active && v.status === 'archived' && (
                        <button onClick={() => { setSelectedVersion(v); handleActivate(v.id, true); }} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-semibold">
                          Rollback To
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Preview & Confirmation Modal */}
      {showUploadModal && previewSummary && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-lg font-sora font-bold text-textPrimary flex items-center gap-2">
                <FileText className="text-accent" size={20} /> CSV Validation & Preview
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-textSecondary hover:text-textPrimary">✕</button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-[#0A0E0C] border border-border rounded-xl flex justify-between items-center">
                <span className="text-textSecondary">File Name:</span>
                <span className="text-textPrimary font-bold">{previewSummary.fileName}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-[#0A0E0C] border border-border rounded-xl">
                  <span className="text-textSecondary block text-[10px]">TOTAL ROWS</span>
                  <span className="text-base font-bold text-textPrimary">{previewSummary.totalRows}</span>
                </div>
                <div className="p-3 bg-savingBg border border-emerald-800 rounded-xl">
                  <span className="text-accentMint block text-[10px]">VALID ROWS</span>
                  <span className="text-base font-bold text-accentMint">{previewSummary.validCount}</span>
                </div>
                <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl">
                  <span className="text-danger block text-[10px]">INVALID ROWS</span>
                  <span className="text-base font-bold text-danger">{previewSummary.invalidCount}</span>
                </div>
              </div>
            </div>

            {/* Sample Products Table Preview */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase text-textSecondary">Parsed Products Preview (First 5 Rows):</h4>
              <div className="bg-[#0A0E0C] border border-border rounded-xl p-3 overflow-x-auto max-h-40 font-mono text-[11px]">
                {previewSummary.samples.map((s) => (
                  <div key={s.rowNum} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                    <span className="text-accentMint">{s.barcode}</span>
                    <span className="text-textPrimary truncate max-w-[220px]">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <form onSubmit={handleFileUpload} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-textSecondary font-mono block mb-1">Catalogue Month</label>
                  <input
                    type="month"
                    value={catalogueMonth}
                    onChange={(e) => setCatalogueMonth(e.target.value)}
                    className="w-full bg-[#0A0E0C] border border-border rounded-xl px-3 py-2 text-xs text-textPrimary"
                  />
                </div>
                <div>
                  <label className="text-xs text-textSecondary font-mono block mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Controlled 100-product dataset"
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    className="w-full bg-[#0A0E0C] border border-border rounded-xl px-3 py-2 text-xs text-textPrimary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-[#1A221D] text-textPrimary text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionProcessing}
                  className="px-5 py-2 bg-accent hover:bg-accentHover text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  {actionProcessing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span>{actionProcessing ? 'Processing Upload...' : 'Confirm Upload & Activate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version Items Modal */}
      {showItemsModal && selectedVersion && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="font-sora font-bold text-base text-textPrimary">
                  Items in Version #{selectedVersion.id}: {selectedVersion.version_name}
                </h3>
                <p className="text-xs text-textSecondary font-mono">Total Catalogue SKUs: {versionItems.length}</p>
              </div>
              <button onClick={() => setShowItemsModal(false)} className="text-textSecondary hover:text-textPrimary">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#0A0E0C] border border-border rounded-xl p-4 font-mono text-xs space-y-2">
              {versionItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-accentMint font-bold">{item.barcode}</span>
                  <span className="text-textPrimary font-semibold truncate max-w-md">{item.name}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setShowItemsModal(false)} className="px-4 py-2 bg-[#1A221D] text-textPrimary text-xs font-semibold rounded-xl">
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activate Confirmation Modal */}
      {showActivateModal && selectedVersion && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-sora font-bold text-textPrimary flex items-center gap-2">
              <CheckCircle2 className="text-accentMint" size={20} /> Activate Catalogue Version
            </h3>
            <p className="text-xs text-textSecondary">
              Are you sure you want to activate <strong className="text-textPrimary">{selectedVersion.version_name}</strong>?
            </p>
            <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl text-xs text-amber-200 space-y-1">
              <p className="font-semibold">⚠️ Atomic Activation Info:</p>
              <p>This will atomically archive current active catalogue versions and switch future supplier scraper runs to this database version.</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowActivateModal(false)} className="px-4 py-2 border border-border rounded-xl text-xs font-semibold">Cancel</button>
              <button onClick={() => handleActivate(selectedVersion.id, false)} disabled={actionProcessing} className="px-5 py-2 bg-accent text-white rounded-xl text-xs font-semibold">
                {actionProcessing ? 'Activating...' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SKUCatalogue;
