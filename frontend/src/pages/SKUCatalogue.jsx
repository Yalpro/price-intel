import React, { useState, useEffect } from 'react';
import { EmptyState, StatusBadge } from '../components/UIComponents';
import { BookOpen, Upload, CheckCircle2, AlertTriangle, RefreshCw, XCircle, ArrowLeftRight, Download, Eye, FileText } from 'lucide-react';

const SKUCatalogue = () => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showErrorsModal, setShowErrorsModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [catalogueMonth, setCatalogueMonth] = useState(new Date().toISOString().slice(0, 7));
  const [uploadNotes, setUploadNotes] = useState('');
  const [actionProcessing, setActionProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  useEffect(() => {
    fetchCatalogueVersions();
  }, []);

  const fetchCatalogueVersions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/catalogues');
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch (err) {
      console.error('Failed to fetch catalogue versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setActionProcessing(true);
    setFeedbackMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('originalFileName', uploadFile.name);
      formData.append('catalogueMonth', catalogueMonth);
      formData.append('notes', uploadNotes);

      const res = await fetch('/api/admin/catalogues/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filePath: uploadFile.name, // Mock local stream path for demo
          originalFileName: uploadFile.name,
          catalogueMonth,
          notes: uploadNotes
        })
      });

      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Catalogue CSV uploaded and validated successfully!' });
        setShowUploadModal(false);
        fetchCatalogueVersions();
      } else {
        const errData = await res.json();
        setFeedbackMsg({ type: 'error', text: errData.error || 'Upload failed.' });
      }
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
        setFeedbackMsg({ type: 'success', text: `Catalogue version ${versionId} ${isRollback ? 'reactivated (rolled back)' : 'activated'} successfully!` });
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
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-sora font-semibold text-textPrimary">Top 1,000 SKU Catalogue Management</h2>
          <p className="text-sm text-textSecondary">Database-driven catalogue versioning, validation, activation, and rollback workflow</p>
        </div>
        <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg font-medium">
          <Upload size={18} /> Upload Monthly CSV
        </button>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${feedbackMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span className="text-sm font-medium">{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-sm opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Catalogue Versions List */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-gray-50 flex justify-between items-center">
          <h3 className="font-semibold text-textPrimary text-sm">Catalogue Versions History</h3>
          <button onClick={fetchCatalogueVersions} className="text-textSecondary hover:text-accent p-1 transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {versions.length === 0 ? (
          <EmptyState 
            icon={BookOpen}
            title="No catalogue versions"
            description="Upload a monthly Top 1000 CSV file to create your first active catalogue version."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-textSecondary">
              <thead className="bg-gray-50 text-xs font-semibold text-textPrimary uppercase border-b border-border">
                <tr>
                  <th className="px-6 py-3">Version / Month</th>
                  <th className="px-6 py-3">File Name</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Rows (Valid / Invalid)</th>
                  <th className="px-6 py-3">Uploaded At</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {versions.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-textPrimary flex items-center gap-2">
                      {v.is_active && (
                        <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-semibold border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 size={12} /> ACTIVE
                        </span>
                      )}
                      <span>{v.version_name}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{v.original_file_name || 'top_1000_products.csv'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        v.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        v.status === 'ready_for_review' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        v.status === 'archived' ? 'bg-gray-100 text-gray-700 border border-gray-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span>{v.total_rows || 1000}</span>
                      <span className="text-emerald-600 text-xs ml-1 font-semibold">({v.valid_rows || 1000} valid)</span>
                      {v.invalid_rows > 0 && <span className="text-red-600 text-xs ml-1 font-semibold">({v.invalid_rows} invalid)</span>}
                    </td>
                    <td className="px-6 py-4 text-xs">{new Date(v.created_at || v.imported_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {v.invalid_rows > 0 && (
                        <button onClick={() => fetchErrors(v.id)} className="text-xs text-amber-600 hover:text-amber-800 font-medium underline">
                          Errors ({v.invalid_rows})
                        </button>
                      )}
                      {!v.is_active && v.status === 'ready_for_review' && (
                        <button onClick={() => { setSelectedVersion(v); setShowActivateModal(true); }} className="text-xs bg-emerald-600 text-white px-3 py-1 rounded">
                          Activate
                        </button>
                      )}
                      {!v.is_active && v.status === 'archived' && (
                        <button onClick={() => { setSelectedVersion(v); handleActivate(v.id, true); }} className="text-xs bg-blue-600 text-white px-3 py-1 rounded">
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

      {/* Activate Confirmation Modal */}
      {showActivateModal && selectedVersion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-sora font-semibold text-textPrimary flex items-center gap-2">
              <CheckCircle2 className="text-emerald-600" size={20} /> Activate Catalogue Version
            </h3>
            <p className="text-sm text-textSecondary">
              Are you sure you want to activate <strong className="text-textPrimary">{selectedVersion.version_name}</strong>?
            </p>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800 space-y-1">
              <p className="font-semibold">⚠️ Activation Warning:</p>
              <p>This will atomically archive the current active catalogue and switch future daily scraper runs to this new database version.</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowActivateModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleActivate(selectedVersion.id, false)} disabled={actionProcessing} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">
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
