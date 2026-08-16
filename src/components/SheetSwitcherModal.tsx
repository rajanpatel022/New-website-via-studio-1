import React, { useState, useEffect } from 'react';
import {
  SavedSheet,
  getSavedSheets,
  getActiveSheet,
  setActiveSheet,
  addOrUpdateSheet,
  deleteSavedSheet,
  testSheetConnection,
} from '../lib/sheetService';
import {
  FileSpreadsheet,
  Plus,
  Check,
  Trash2,
  Edit2,
  X,
  ExternalLink,
  Loader2,
  Sparkles,
  Layers,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

interface SheetSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSheetChanged: (newSheet: SavedSheet) => void;
}

export const SheetSwitcherModal: React.FC<SheetSwitcherModalProps> = ({
  isOpen,
  onClose,
  onSheetChanged,
}) => {
  const [sheets, setSheets] = useState<SavedSheet[]>([]);
  const [activeSheet, setActiveSheetState] = useState<SavedSheet | null>(null);

  // Add / Edit form state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // In-app delete confirmation state (avoids blocked window.confirm in iframes)
  const [sheetToDelete, setSheetToDelete] = useState<SavedSheet | null>(null);

  const loadData = () => {
    const list = getSavedSheets();
    setSheets(list);
    setActiveSheetState(getActiveSheet());
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setIsAdding(false);
      setEditingId(null);
      setFormError(null);
      setSheetToDelete(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectSheet = (sheet: SavedSheet) => {
    const activated = setActiveSheet(sheet.id);
    setActiveSheetState(activated);
    onSheetChanged(activated);
    onClose();
  };

  const handleStartAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormName('');
    setFormUrl('');
    setFormError(null);
  };

  const handleStartEdit = (sheet: SavedSheet, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(sheet.id);
    setIsAdding(true);
    setFormName(sheet.name);
    setFormUrl(sheet.scriptUrl);
    setFormError(null);
  };

  const handlePromptDelete = (sheet: SavedSheet, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sheets.length <= 1) {
      setFormError('You must keep at least one sheet configured.');
      return;
    }
    setSheetToDelete(sheet);
  };

  const confirmDeleteSheet = () => {
    if (!sheetToDelete) return;
    const remainingActive = deleteSavedSheet(sheetToDelete.id);
    loadData();
    if (activeSheet?.id === sheetToDelete.id) {
      onSheetChanged(remainingActive);
    }
    setSheetToDelete(null);
  };

  const handleSaveSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    const cleanUrl = formUrl.trim();

    if (!cleanName) {
      setFormError('Please enter a descriptive sheet name.');
      return;
    }
    if (!cleanUrl || !cleanUrl.startsWith('https://script.google.com/macros/s/')) {
      setFormError('Please provide a valid Google Apps Script Web App URL (starts with https://script.google.com/macros/s/...)');
      return;
    }

    setIsTesting(true);
    setFormError(null);

    try {
      const testResult = await testSheetConnection(cleanUrl);
      const saved = addOrUpdateSheet({
        id: editingId || undefined,
        name: cleanName,
        scriptUrl: cleanUrl,
        sheetTitle: testResult.title || cleanName,
      });

      loadData();
      setIsAdding(false);
      setEditingId(null);
      setFormName('');
      setFormUrl('');

      onSheetChanged(saved);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Could not connect to Google Apps Script. Please verify the URL.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Switch & Manage Sheets</h3>
              <p className="text-xs text-slate-400">
                Seamlessly toggle between your different Google Sheets / Web Ledgers
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Add / Edit Form */}
          {isAdding ? (
            <form
              onSubmit={handleSaveSheet}
              className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {editingId ? 'Edit Sheet Connection' : 'Add New Google Sheet'}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Sheet Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Personal Expenses, Business 2026, Store Ledger"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Apps Script Web App URL
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Paste the deployment Web App URL from your Google Sheet's Apps Script.
                </p>
              </div>

              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTesting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing & Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingId ? 'Save Changes' : 'Connect & Switch'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={handleStartAdd}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 text-slate-300 hover:text-emerald-300 flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Another Google Sheet</span>
            </button>
          )}

          {/* List of Saved Sheets */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Your Sheets ({sheets.length})
            </h4>

            {sheets.map((sheet) => {
              const isActive = activeSheet?.id === sheet.id;

              return (
                <div
                  key={sheet.id}
                  onClick={() => handleSelectSheet(sheet)}
                  className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isActive
                      ? 'bg-emerald-950/30 border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/20'
                      : 'bg-slate-950/40 hover:bg-slate-800/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-200 truncate">
                          {sheet.name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                        {sheet.scriptUrl}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handleStartEdit(sheet, e)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Edit sheet details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {sheets.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => handlePromptDelete(sheet, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete this sheet profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => handleSelectSheet(sheet)}
                        className="ml-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>Switch</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* In-app Sheet Delete Confirmation Modal */}
        {sheetToDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-100">Remove Sheet Profile?</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Remove <span className="font-semibold text-slate-200">"{sheetToDelete.name}"</span> from your saved profiles list? Your data in Google Sheets remains safe.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSheetToDelete(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteSheet}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Sheet</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
          <span>Click any sheet above to switch your live dashboard view.</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
