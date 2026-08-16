import React, { useState, useEffect, useCallback } from 'react';
import { Expense } from './types';
import { Header } from './components/Header';
import { AuthBanner } from './components/AuthBanner';
import { Dashboard } from './components/Dashboard';
import { ExpenseTable } from './components/ExpenseTable';
import { ExpenseForm } from './components/ExpenseForm';
import { SheetConnectorModal } from './components/SheetConnectorModal';
import { CategoryColorModal } from './components/CategoryColorModal';
import { SheetSwitcherModal } from './components/SheetSwitcherModal';
import { AlertCircle, RefreshCw, Loader2, FileSpreadsheet } from 'lucide-react';
import {
  getStoredScriptUrl,
  getStoredSheetMeta,
  getActiveSheet,
  SavedSheet,
  fetchExpensesFromSheet,
  saveExpenseToSheet,
  deleteExpenseFromSheet,
  batchDeleteExpensesFromSheet,
  batchUpdateCategoryInSheet,
  seedSampleExpensesInSheet,
  SheetMeta,
} from './lib/sheetService';

const DEMO_EXPENSES: Expense[] = [
  {
    id: 'demo_1',
    date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    type: 'income',
    category: 'Salary',
    amount: 55000,
    paymentMethod: 'Bank Transfer',
    notes: 'Direct deposit',
    rowIndex: 2,
  },
  {
    id: 'demo_2',
    date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
    type: 'expense',
    category: 'Housing & Rent',
    amount: 15000,
    paymentMethod: 'Bank Transfer',
    notes: 'Monthly apartment rent',
    rowIndex: 3,
  },
  {
    id: 'demo_3',
    date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    type: 'expense',
    category: 'Groceries',
    amount: 3200,
    paymentMethod: 'UPI',
    notes: 'Supermarket & weekly food',
    rowIndex: 4,
  },
  {
    id: 'demo_4',
    date: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    type: 'expense',
    category: 'Utilities & Bills',
    amount: 1850,
    paymentMethod: 'UPI',
    notes: 'Electricity & broadband bill',
    rowIndex: 5,
  },
  {
    id: 'demo_5',
    date: new Date(Date.now() - 9 * 86400000).toISOString().split('T')[0],
    type: 'expense',
    category: 'Dining & Drinks',
    amount: 1450,
    paymentMethod: 'Credit Card',
    notes: 'Weekend dinner with family',
    rowIndex: 6,
  },
  {
    id: 'demo_6',
    date: new Date(Date.now() - 11 * 86400000).toISOString().split('T')[0],
    type: 'income',
    category: 'Freelance & Consulting',
    amount: 12000,
    paymentMethod: 'UPI',
    notes: 'UI/UX design milestone bonus',
    rowIndex: 7,
  },
  {
    id: 'demo_7',
    date: new Date(Date.now() - 13 * 86400000).toISOString().split('T')[0],
    type: 'expense',
    category: 'Transportation',
    amount: 850,
    paymentMethod: 'UPI',
    notes: 'Fuel & metro recharge',
    rowIndex: 8,
  },
];

export default function App() {
  const [scriptUrl, setScriptUrl] = useState<string>(() => getStoredScriptUrl());
  const [activeSheet, setActiveSheetState] = useState<SavedSheet>(() => getActiveSheet());
  const [sheetMeta, setSheetMeta] = useState<SheetMeta | null>(() => getStoredSheetMeta());
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    // If connected, start empty then fetch; if not connected, show demo data
    const url = getStoredScriptUrl();
    return url ? [] : DEMO_EXPENSES;
  });

  // Loading States
  const [isLoadingExpenses, setIsLoadingExpenses] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals
  const [isConnectorOpen, setIsConnectorOpen] = useState<boolean>(false);
  const [isSheetSwitcherOpen, setIsSheetSwitcherOpen] = useState<boolean>(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [isCategoryColorModalOpen, setIsCategoryColorModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [colorVersion, setColorVersion] = useState<number>(0);

  useEffect(() => {
    const handleColorUpdate = () => {
      setColorVersion((v) => v + 1);
    };
    window.addEventListener('category-colors-updated', handleColorUpdate);
    return () => window.removeEventListener('category-colors-updated', handleColorUpdate);
  }, []);

  const isConnected = Boolean(scriptUrl && scriptUrl.trim());

  // Handle switching to a different sheet
  const handleSheetChanged = (newSheet: SavedSheet) => {
    setActiveSheetState(newSheet);
    setScriptUrl(newSheet.scriptUrl);
    setSheetMeta({
      title: newSheet.name,
      connectedAt: new Date().toISOString(),
    });
    loadExpenses(newSheet.scriptUrl);
  };

  // Fetch expenses from connected Google Sheet
  const loadExpenses = useCallback(
    async (urlToFetch?: string) => {
      const activeUrl = urlToFetch || scriptUrl;
      if (!activeUrl) {
        setExpenses(DEMO_EXPENSES);
        return;
      }

      setIsLoadingExpenses(true);
      setErrorMsg(null);

      try {
        const { expenses: loadedExpenses, sheetTitle } = await fetchExpensesFromSheet(activeUrl);
        setExpenses(loadedExpenses);
        if (sheetTitle) {
          setSheetMeta((prev) => ({
            title: sheetTitle,
            id: prev?.id,
            connectedAt: new Date().toISOString(),
          }));
        }
      } catch (err: any) {
        console.error('Error fetching expenses from Google Sheet:', err);
        setErrorMsg(err.message || 'Could not load expenses from Google Sheet. Check Web App URL permissions.');
      } finally {
        setIsLoadingExpenses(false);
      }
    },
    [scriptUrl]
  );

  useEffect(() => {
    if (scriptUrl) {
      loadExpenses(scriptUrl);
    }
  }, [scriptUrl, loadExpenses]);

  // Handle Sheet Connection
  const handleConnected = (newUrl: string) => {
    setScriptUrl(newUrl);
    setSheetMeta(getStoredSheetMeta());
    loadExpenses(newUrl);
  };

  // Handle Disconnect
  const handleDisconnected = () => {
    setScriptUrl('');
    setSheetMeta(null);
    setExpenses(DEMO_EXPENSES);
  };

  // Save / Update Expense
  const handleSaveExpense = async (expenseData: Partial<Expense>) => {
    setErrorMsg(null);

    // If connected to Google Sheet, sync with backend
    if (isConnected) {
      try {
        await saveExpenseToSheet(scriptUrl, expenseData);
        await loadExpenses(scriptUrl);
      } catch (err: any) {
        console.error('Save expense error:', err);
        setErrorMsg(err.message || 'Failed to save expense to Google Sheet');
        throw err;
      }
    } else {
      // Local demo mode update
      if (expenseData.id) {
        setExpenses((prev) =>
          prev.map((e) => (e.id === expenseData.id ? ({ ...e, ...expenseData } as Expense) : e))
        );
      } else {
        const newExp: Expense = {
          id: 'local_' + Date.now(),
          date: expenseData.date || new Date().toISOString().split('T')[0],
          type: expenseData.type || 'expense',
          category: expenseData.category || 'Miscellaneous',
          amount: expenseData.amount || 0,
          paymentMethod: expenseData.paymentMethod || 'Other',
          notes: expenseData.notes || '',
          rowIndex: expenses.length + 2,
        };
        setExpenses((prev) => [newExp, ...prev]);
      }
    }
  };

  // Delete Single Expense
  const handleDeleteExpense = async (rowIndex: number) => {
    setErrorMsg(null);
    if (isConnected) {
      try {
        await deleteExpenseFromSheet(scriptUrl, rowIndex);
        await loadExpenses(scriptUrl);
      } catch (err: any) {
        console.error('Delete expense error:', err);
        setErrorMsg(err.message || 'Failed to delete row from Google Sheet');
      }
    } else {
      setExpenses((prev) => prev.filter((e) => e.rowIndex !== rowIndex));
    }
  };

  // Batch Delete Expenses
  const handleBatchDeleteExpenses = async (rowIndices: number[]) => {
    if (rowIndices.length === 0) return;
    setErrorMsg(null);
    if (isConnected) {
      try {
        await batchDeleteExpensesFromSheet(scriptUrl, rowIndices);
        await loadExpenses(scriptUrl);
      } catch (err: any) {
        console.error('Batch delete error:', err);
        setErrorMsg(err.message || 'Failed to batch delete rows from Google Sheet');
        throw err;
      }
    } else {
      setExpenses((prev) => prev.filter((e) => !rowIndices.includes(e.rowIndex || -1)));
    }
  };

  // Batch Update Category
  const handleBatchUpdateCategory = async (rowIndices: number[], category: string) => {
    if (rowIndices.length === 0 || !category) return;
    setErrorMsg(null);
    if (isConnected) {
      try {
        await batchUpdateCategoryInSheet(scriptUrl, rowIndices, category);
        await loadExpenses(scriptUrl);
      } catch (err: any) {
        console.error('Batch category update error:', err);
        setErrorMsg(err.message || 'Failed to update categories in Google Sheet');
        throw err;
      }
    } else {
      setExpenses((prev) =>
        prev.map((e) =>
          rowIndices.includes(e.rowIndex || -1) ? { ...e, category } : e
        )
      );
    }
  };

  // Seed Sample Data
  const handleSeedSampleData = async () => {
    setIsSeeding(true);
    setErrorMsg(null);
    if (isConnected) {
      try {
        await seedSampleExpensesInSheet(scriptUrl);
        await loadExpenses(scriptUrl);
      } catch (err: any) {
        console.error('Seed data error:', err);
        setErrorMsg(err.message || 'Could not seed sample data into Google Sheet');
      } finally {
        setIsSeeding(false);
      }
    } else {
      setTimeout(() => {
        setExpenses(DEMO_EXPENSES);
        setIsSeeding(false);
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950 flex flex-col">
      {/* Top Header */}
      <Header
        isConnected={isConnected}
        sheetTitle={sheetMeta?.title}
        activeSheetName={activeSheet?.name}
        onOpenConnector={() => setIsConnectorOpen(true)}
        onOpenSheetSwitcher={() => setIsSheetSwitcherOpen(true)}
        onOpenNewExpenseModal={() => {
          setEditingExpense(null);
          setIsExpenseModalOpen(true);
        }}
        onOpenCategoryColors={() => setIsCategoryColorModalOpen(true)}
        onRefresh={() => loadExpenses(scriptUrl)}
        isRefreshing={isLoadingExpenses}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Global Error Banner */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 flex items-center justify-between text-sm shadow-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs text-rose-300 hover:text-white underline ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Banner if Google Sheet is not yet connected */}
        {!isConnected && (
          <AuthBanner onOpenConnector={() => setIsConnectorOpen(true)} />
        )}

        {/* Dashboard Analytics & Summary Cards */}
        <Dashboard
          expenses={expenses}
          onOpenNewExpenseModal={() => {
            setEditingExpense(null);
            setIsExpenseModalOpen(true);
          }}
          onSeedSampleData={handleSeedSampleData}
          isSeeding={isSeeding}
        />

        {/* Expense Records Table */}
        <div className="space-y-4 pt-2">
          <ExpenseTable
            expenses={expenses}
            onEditExpense={(exp) => {
              setEditingExpense(exp);
              setIsExpenseModalOpen(true);
            }}
            onDeleteExpense={handleDeleteExpense}
            onBatchDeleteExpenses={handleBatchDeleteExpenses}
            onBatchUpdateCategory={handleBatchUpdateCategory}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-400">
        <p className="flex items-center justify-center gap-2">
          <span>SheetExpense Tracker</span> • <span>Google Sheets Database Sync</span>
        </p>
      </footer>

      {/* Google Sheet Connector Modal */}
      <SheetConnectorModal
        isOpen={isConnectorOpen}
        onClose={() => setIsConnectorOpen(false)}
        currentUrl={scriptUrl}
        sheetMeta={sheetMeta}
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
      />

      {/* Multi-Sheet Switcher Modal */}
      <SheetSwitcherModal
        isOpen={isSheetSwitcherOpen}
        onClose={() => setIsSheetSwitcherOpen(false)}
        onSheetChanged={handleSheetChanged}
      />

      {/* Category Color Palette Customizer Modal */}
      <CategoryColorModal
        isOpen={isCategoryColorModalOpen}
        onClose={() => setIsCategoryColorModalOpen(false)}
        existingCustomCategories={expenses.map((e) => e.category).filter(Boolean)}
      />

      {/* Add / Edit Expense Modal */}
      <ExpenseForm
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSave={handleSaveExpense}
        editingExpense={editingExpense}
      />
    </div>
  );
}
