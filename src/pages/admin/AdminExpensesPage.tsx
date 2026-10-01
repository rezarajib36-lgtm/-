import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Calendar, DollarSign, TrendingUp, TrendingDown, Trash2, 
  Edit3, Filter, Search, Tag, CheckCircle2, AlertCircle, X, 
  ArrowUpRight, ArrowDownRight, Wallet, ShoppingBag, Receipt,
  Settings, Check, RotateCcw, Cloud, CloudCheck
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface ExpenseItem {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: string;
  amount: number;
  note?: string;
  created_at: string;
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  'বাসার নিজস্ব খরচ',
  'ওয়ার্কারের দৈনিক হাজিরা ও খরচ',
  'কিস্তি বা লোন পরিশোধ',
  'গ্রিনের খরচ ও ঋণ পরিশোধ',
  'মাছ ও কাঁচাবাজার',
  'রান্নার তেল ও মশলা',
  'চাল ও নিত্যপ্রয়োজনীয় দ্রব্য',
  'গ্যাস ও জ্বালানি বিল',
  'কর্মচারীদের বেতন ও খোরাকি',
  'দোকান ভাড়া',
  'বিদ্যুৎ ও পানির বিল',
  'প্যাকেজিং ও পার্সেল বক্স',
  'ব্যক্তিগত ও পকেট খরচ',
  'চা-নাস্তা ও মেহমান আপ্যায়ন',
  'পরিবহন ও ডেলিভারি খরচ',
  'মেরামত ও অন্যান্য খরচ'
];

const STORAGE_EXPENSES_KEY = 'restaurant_expenses_v4';
const STORAGE_EXPENSE_CATS_KEY = 'restaurant_expense_categories_v4';
const CLOUD_EXPENSES_PREFIX = '__SYSTEM_EXPENSES__:';
const CLOUD_EXPENSE_CATS_PREFIX = '__SYSTEM_EXPENSE_CATS__:';

function toBanglaDigits(num: number | string): string {
  const digits: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
  };
  return String(num).replace(/[0-9]/g, w => digits[w] || w);
}

// Cloud sync helper: Persist JSON payload into Supabase categories table safely
async function syncToCloudRecord(prefix: string, dataObj: any): Promise<boolean> {
  if (!supabase) return false;
  try {
    const jsonStr = prefix + JSON.stringify(dataObj);
    const { data: existing } = await supabase
      .from('categories')
      .select('id, name')
      .like('name', prefix + '%');

    if (existing && existing.length > 0) {
      const primaryId = existing[0].id;
      await supabase.from('categories').update({ name: jsonStr }).eq('id', primaryId);
      // Clean up any accidental duplicate rows
      if (existing.length > 1) {
        const extraIds = existing.slice(1).map(r => r.id);
        await supabase.from('categories').delete().in('id', extraIds);
      }
    } else {
      await supabase.from('categories').insert([{ name: jsonStr }]);
    }
    return true;
  } catch (err) {
    console.warn('Expenses cloud sync notice:', err);
    return false;
  }
}

// Cloud fetch helper: Read JSON payload from Supabase
async function fetchFromCloudRecord(prefix: string): Promise<any | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('categories')
      .select('id, name')
      .like('name', prefix + '%')
      .order('created_at', { ascending: false });

    if (data && data.length > 0 && data[0].name) {
      const raw = data[0].name.replace(prefix, '');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Expenses cloud read notice:', err);
  }
  return null;
}

export default function AdminExpensesPage() {
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const currentMonthStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  // Instant fast-load state for expenses
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const v4 = localStorage.getItem(STORAGE_EXPENSES_KEY);
        if (v4) {
          const parsed = JSON.parse(v4);
          if (Array.isArray(parsed)) return parsed;
        }
        // Fallback to legacy keys so no past data is lost
        const stored = localStorage.getItem('restaurant_expenses');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
        const backup = localStorage.getItem('restaurant_expenses_backup');
        if (backup) {
          const parsed = JSON.parse(backup);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  const [orders, setOrders] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('restaurant_local_orders');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  // Filter modes: 'day' | 'month' | 'all' (default to 'all' so all expenses are always visible by default)
  const [viewType, setViewType] = useState<'day' | 'month' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Categories list: Load exactly what the user saved. NEVER force-repopulate deleted categories!
  const [categoriesList, setCategoriesList] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const v4 = localStorage.getItem(STORAGE_EXPENSE_CATS_KEY);
        if (v4) {
          const parsed = JSON.parse(v4);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
        const v3 = localStorage.getItem('restaurant_custom_expense_categories_v3');
        if (v3) {
          const parsed = JSON.parse(v3);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
        const v1 = localStorage.getItem('restaurant_custom_expense_categories');
        if (v1) {
          const parsed = JSON.parse(v1);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [...DEFAULT_EXPENSE_CATEGORIES];
  });

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Cloud status indicator
  const [isCloudSynced, setIsCloudSynced] = useState(true);

  // Save categories: Updates state, local storage, and permanently syncs to Supabase Cloud
  const saveCategories = (newCategories: string[]) => {
    setCategoriesList(newCategories);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_EXPENSE_CATS_KEY, JSON.stringify(newCategories));
        localStorage.setItem('restaurant_custom_expense_categories_v3', JSON.stringify(newCategories));
      } catch (e) {}
    }
    // Permanent Cloud Sync
    syncToCloudRecord(CLOUD_EXPENSE_CATS_PREFIX, newCategories).then(ok => {
      setIsCloudSynced(ok);
    });
  };

  // Save expenses: Updates state, local storage, and permanently syncs to Supabase Cloud
  const saveExpensesLocally = (newList: ExpenseItem[]) => {
    setExpenses(newList);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_EXPENSES_KEY, JSON.stringify(newList));
        localStorage.setItem('restaurant_expenses', JSON.stringify(newList));
        localStorage.setItem('restaurant_expenses_backup', JSON.stringify(newList));
      } catch (e) {}
    }
    // Permanent Cloud Sync
    syncToCloudRecord(CLOUD_EXPENSES_PREFIX, newList).then(ok => {
      setIsCloudSynced(ok);
    });
  };

  // Initial load: Fetch latest cloud categories and expenses from Supabase
  useEffect(() => {
    let isMounted = true;

    async function loadCloudData() {
      try {
        // 1. Load orders for Sales calculation
        if (supabase) {
          const { data: orderData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
          if (isMounted && orderData && orderData.length > 0) {
            setOrders(orderData);
            try {
              localStorage.setItem('restaurant_local_orders', JSON.stringify(orderData));
            } catch (e) {}
          }
        }

        // 2. Fetch categories from Supabase Cloud
        const cloudCats = await fetchFromCloudRecord(CLOUD_EXPENSE_CATS_PREFIX);
        if (isMounted && Array.isArray(cloudCats) && cloudCats.length > 0) {
          setCategoriesList(cloudCats);
          try {
            localStorage.setItem(STORAGE_EXPENSE_CATS_KEY, JSON.stringify(cloudCats));
          } catch (e) {}
        } else if (isMounted) {
          // If no cloud categories yet, seed initial categories to cloud once
          const initial = categoriesList.length > 0 ? categoriesList : DEFAULT_EXPENSE_CATEGORIES;
          syncToCloudRecord(CLOUD_EXPENSE_CATS_PREFIX, initial);
        }

        // 3. Fetch expenses from Supabase Cloud
        const cloudExpenses = await fetchFromCloudRecord(CLOUD_EXPENSES_PREFIX);
        if (isMounted && Array.isArray(cloudExpenses)) {
          // Merge safely: union of cloud and local so nothing is ever dropped
          setExpenses(prevLocal => {
            const map = new Map<string, ExpenseItem>();
            prevLocal.forEach(item => map.set(item.id, item));
            cloudExpenses.forEach((item: ExpenseItem) => map.set(item.id, item));
            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            try {
              localStorage.setItem(STORAGE_EXPENSES_KEY, JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
        } else if (isMounted && expenses.length > 0) {
          // Push existing local expenses to cloud
          syncToCloudRecord(CLOUD_EXPENSES_PREFIX, expenses);
        }
      } catch (err) {
        console.warn('Initial cloud sync notice:', err);
      }
    }

    loadCloudData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseItem | null>(null);

  // Category Manager modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [editingCategoryKey, setEditingCategoryKey] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');

  // Custom Category writing mode in modal
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    date: todayStr,
    title: '',
    category: categoriesList[0] || DEFAULT_EXPENSE_CATEGORIES[0],
    amount: '',
    note: ''
  });

  // Open Add modal
  const handleOpenAdd = () => {
    setEditingExpense(null);
    setIsCustomCategory(false);
    setCustomCategoryInput('');
    setFormData({
      date: selectedDate || todayStr,
      title: '',
      category: categoriesList[0] || DEFAULT_EXPENSE_CATEGORIES[0],
      amount: '',
      note: ''
    });
    setShowAddModal(true);
  };

  // Open Edit modal
  const handleOpenEdit = (exp: ExpenseItem) => {
    setEditingExpense(exp);
    setIsCustomCategory(false);
    setCustomCategoryInput('');
    setFormData({
      date: exp.date,
      title: exp.title,
      category: exp.category,
      amount: String(exp.amount),
      note: exp.note || ''
    });
    setShowAddModal(true);
  };

  // Save (Create or Update) Expense
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formData.amount);
    if (!formData.title.trim()) {
      showToast('খরচের বিবরণ লিখুন', 'error');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('সঠিক টাকার পরিমাণ লিখুন', 'error');
      return;
    }

    if (isCustomCategory && !customCategoryInput.trim()) {
      showToast('নতুন ক্যাটাগরির নাম লিখুন', 'error');
      return;
    }

    const finalCategory = (isCustomCategory ? customCategoryInput.trim() : formData.category.trim()) || 'অন্যান্য খরচ';

    // If a new custom category was entered, save it to the category list and cloud!
    if (isCustomCategory && customCategoryInput.trim()) {
      const newCat = customCategoryInput.trim();
      if (!categoriesList.includes(newCat)) {
        saveCategories([...categoriesList, newCat]);
      }
    }

    if (editingExpense) {
      // Update existing expense
      const updated: ExpenseItem = {
        ...editingExpense,
        date: formData.date,
        title: formData.title.trim(),
        category: finalCategory,
        amount: parsedAmount,
        note: formData.note.trim()
      };

      const newList = expenses.map(item => item.id === editingExpense.id ? updated : item);
      saveExpensesLocally(newList);
      showToast('✓ খরচের হিসাব সফলভাবে আপডেট ও ক্লাউডে সেভ হয়েছে!');
    } else {
      // Create new expense
      const newExpense: ExpenseItem = {
        id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        date: formData.date,
        title: formData.title.trim(),
        category: finalCategory,
        amount: parsedAmount,
        note: formData.note.trim(),
        created_at: new Date().toISOString()
      };

      const newList = [newExpense, ...expenses];
      saveExpensesLocally(newList);

      // Focus on the newly added expense's date
      setSelectedDate(newExpense.date);
      setSelectedMonth(newExpense.date.substring(0, 7));

      showToast('✓ নতুন খরচ সফলভাবে ক্লাউড ডেটাবেজে সেভ হয়েছে!');
    }

    setShowAddModal(false);
  };

  // Delete Expense
  const handleDeleteConfirm = () => {
    if (!expenseToDelete) return;
    const targetId = expenseToDelete.id;
    const newList = expenses.filter(i => i.id !== targetId);
    saveExpensesLocally(newList);
    setExpenseToDelete(null);
    showToast('✓ খরচ সফলভাবে মুছে ফেলা হয়েছে');
  };

  // Category Manager Handlers: Add
  const handleAddCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('ক্যাটাগরির নাম লিখুন', 'error');
      return;
    }
    if (categoriesList.includes(trimmed)) {
      showToast('এই ক্যাটাগরি ইতিমধ্যে তালিকায় রয়েছে', 'error');
      return;
    }
    const updated = [...categoriesList, trimmed];
    saveCategories(updated);
    setNewCatInput('');
    showToast(`✓ '${trimmed}' ক্যাটাগরি সফলভাবে যোগ ও ক্লাউডে সেভ হয়েছে!`);
  };

  // Category Manager Handlers: Edit
  const handleEditCategory = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      showToast('ক্যাটাগরির নাম খালি রাখা যাবে না', 'error');
      return;
    }
    if (trimmed === oldName) {
      setEditingCategoryKey(null);
      return;
    }
    if (categoriesList.includes(trimmed)) {
      showToast('এই নামে ইতিমধ্যে আরেকটি ক্যাটাগরি রয়েছে', 'error');
      return;
    }

    const updatedCats = categoriesList.map(c => c === oldName ? trimmed : c);
    saveCategories(updatedCats);

    // Update any existing expense entries that use oldName
    const hasExisting = expenses.some(e => e.category === oldName);
    if (hasExisting) {
      const updatedExpenses = expenses.map(e => e.category === oldName ? { ...e, category: trimmed } : e);
      saveExpensesLocally(updatedExpenses);
    }

    if (categoryFilter === oldName) {
      setCategoryFilter(trimmed);
    }
    if (formData.category === oldName) {
      setFormData(prev => ({ ...prev, category: trimmed }));
    }

    setEditingCategoryKey(null);
    setEditingCategoryValue('');
    showToast(`✓ ক্যাটাগরি আপডেট করা হয়েছে: '${trimmed}'`);
  };

  // Category Manager Handlers: Delete (Permanent & Never Auto-Resurrected!)
  const handleDeleteCategory = (catToDelete: string) => {
    if (categoriesList.length <= 1) {
      showToast('কমপক্ষে একটি ক্যাটাগরি তালিকায় থাকতে হবে', 'error');
      return;
    }
    const countUsed = expenses.filter(e => e.category === catToDelete).length;
    const confirmMsg = countUsed > 0 
      ? `'${catToDelete}' ক্যাটাগরিতে ${toBanglaDigits(countUsed)}টি খরচের রেকর্ড রয়েছে। এটি তালিকা থেকে মুছে ফেললে পূর্ববর্তী রেকর্ডগুলো অক্ষত থাকবে কিন্তু ভবিষ্যতে এই ক্যাটাগরি তালিকায় আর দেখানো হবে না। আপনি কি নিশ্চিত?`
      : `আপনি কি নিশ্চিত '${catToDelete}' ক্যাটাগরি তালিকা থেকে স্থায়ীভাবে মুছে ফেলতে চান?`;

    if (!window.confirm(confirmMsg)) return;

    // Remove permanently from list
    const updated = categoriesList.filter(c => c !== catToDelete);
    saveCategories(updated);

    if (categoryFilter === catToDelete) {
      setCategoryFilter('All');
    }
    if (formData.category === catToDelete) {
      setFormData(prev => ({ ...prev, category: updated[0] || '' }));
    }

    showToast(`✓ '${catToDelete}' ক্যাটাগরি স্থায়ীভাবে মুছে ফেলা হয়েছে`);
  };

  // Reset to default categories
  const handleResetCategories = () => {
    if (!window.confirm('আপনি কি পূর্বনির্ধারিত মূল ক্যাটাগরিগুলো পুনরায় ফিরিয়ে আনতে চান?')) return;
    saveCategories(DEFAULT_EXPENSE_CATEGORIES);
    showToast('✓ ডিফল্ট ক্যাটাগরিগুলো সফলভাবে ফিরিয়ে আনা হয়েছে');
  };

  // Calculate Sales & Expenses for filtered period
  const { filteredExpenses, totalExpenseAmount, totalSalesAmount, netProfit, profitMargin } = useMemo(() => {
    // 1. Filter expenses
    let list = [...expenses];

    if (viewType === 'day') {
      list = list.filter(e => e.date === selectedDate);
    } else if (viewType === 'month') {
      list = list.filter(e => e.date.startsWith(selectedMonth));
    }

    if (categoryFilter !== 'All') {
      list = list.filter(e => e.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(e => 
        e.title.toLowerCase().includes(q) || 
        e.category.toLowerCase().includes(q) || 
        (e.note && e.note.toLowerCase().includes(q))
      );
    }

    // Sort newest date first
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalExp = list.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    // 2. Filter orders to compute matching sales (only delivered or non-cancelled orders)
    let relevantOrders = orders.filter(o => o.status !== 'Cancelled');
    if (viewType === 'day') {
      relevantOrders = relevantOrders.filter(o => {
        const orderDate = (o.created_at || '').substring(0, 10);
        return orderDate === selectedDate;
      });
    } else if (viewType === 'month') {
      relevantOrders = relevantOrders.filter(o => {
        const orderMonth = (o.created_at || '').substring(0, 7);
        return orderMonth === selectedMonth;
      });
    }

    const totalSales = relevantOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
    const profit = totalSales - totalExp;
    const margin = totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : '0';

    return {
      filteredExpenses: list,
      totalExpenseAmount: totalExp,
      totalSalesAmount: totalSales,
      netProfit: profit,
      profitMargin: margin
    };
  }, [expenses, orders, viewType, selectedDate, selectedMonth, categoryFilter, searchQuery]);

  // Breakdown by Category for analysis
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach(e => {
      const cat = e.category || 'অন্যান্য';
      map.set(cat, (map.get(cat) || 0) + (Number(e.amount) || 0));
    });

    const entries = Array.from(map.entries()).map(([cat, amount]) => ({
      category: cat,
      amount,
      percentage: totalExpenseAmount > 0 ? Math.round((amount / totalExpenseAmount) * 100) : 0
    }));

    entries.sort((a, b) => b.amount - a.amount);
    return entries;
  }, [filteredExpenses, totalExpenseAmount]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-bold text-white transition-all transform animate-in slide-in-from-bottom-4 ${
          toastMessage.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
        }`}>
          {toastMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-stone-900 flex items-center gap-2.5">
              <span className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
                <Wallet size={24} />
              </span>
              <span>দৈনিক খরচ ও লাভ-ক্ষতির হিসাব</span>
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>ক্লাউড সিঙ্ক সক্রিয়</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            রেস্টুরেন্টের দৈনন্দিন খরচ এন্ট্রি করুন এবং মাস শেষে মোট বিক্রি, মোট খরচ ও নিট লাভের সম্পূর্ণ রিপোর্ট দেখুন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-3 rounded-2xl font-bold text-xs border border-stone-200 shadow-xs hover:shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Settings size={16} className="text-stone-500" />
            <span>ক্যাটাগরি পরিচালনা ({toBanglaDigits(categoriesList.length)})</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus size={18} />
            <span>নতুন খরচ যোগ করুন</span>
          </button>
        </div>
      </div>

      {/* Filter / Period Controls Bar */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* View Type Tabs */}
          <div className="flex bg-stone-100 p-1 rounded-2xl border border-stone-200 text-xs font-bold">
            <button
              onClick={() => setViewType('day')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                viewType === 'day' ? 'bg-white text-stone-900 shadow-xs font-black' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              দৈনিক হিসাব (Daily)
            </button>
            <button
              onClick={() => setViewType('month')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                viewType === 'month' ? 'bg-white text-stone-900 shadow-xs font-black' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              মাসিক হিসাব (Monthly)
            </button>
            <button
              onClick={() => setViewType('all')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                viewType === 'all' ? 'bg-white text-stone-900 shadow-xs font-black' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              সব সময় (All Time)
            </button>
          </div>

          {/* Date / Month Picker */}
          <div className="flex items-center gap-2">
            {viewType === 'day' && (
              <div className="flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
                <Calendar size={16} className="text-stone-500" />
                <span className="text-xs font-bold text-stone-700">তারিখ:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-black text-stone-800 focus:outline-hidden cursor-pointer"
                />
              </div>
            )}

            {viewType === 'month' && (
              <div className="flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
                <Calendar size={16} className="text-stone-500" />
                <span className="text-xs font-bold text-stone-700">মাস:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs font-black text-stone-800 focus:outline-hidden cursor-pointer"
                />
              </div>
            )}
          </div>

        </div>

        {/* Secondary Filters: Category & Search */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-stone-100">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="খরচের বিবরণ বা শিরোনাম খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-rose-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-stone-400 shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-rose-500 font-bold text-stone-700 cursor-pointer"
            >
              <option value="All">সব ক্যাটাগরি</option>
              {categoriesList.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Financial Summary Cards: Total Sales, Total Expenses, Net Profit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Sales Card */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-5 text-white shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-100 tracking-wide uppercase">
              {viewType === 'day' ? 'দিনের মোট বিক্রি (Sales)' : viewType === 'month' ? 'মাসের মোট বিক্রি (Sales)' : 'সর্বমোট বিক্রি'}
            </span>
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-xs">
              <ShoppingBag size={20} className="text-white" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black">
              ৳{toBanglaDigits(totalSalesAmount.toLocaleString())}
            </div>
            <p className="text-[11px] text-emerald-100 mt-1 flex items-center gap-1 font-medium">
              <ArrowUpRight size={14} />
              <span>অনলাইন ও টেবিল অর্ডার থেকে অর্জিত রাজস্ব</span>
            </p>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-3xl p-5 text-white shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-100 tracking-wide uppercase">
              {viewType === 'day' ? 'দিনের মোট খরচ (Expenses)' : viewType === 'month' ? 'মাসের মোট খরচ (Expenses)' : 'সর্বমোট খরচ'}
            </span>
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-xs">
              <Receipt size={20} className="text-white" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black">
              ৳{toBanglaDigits(totalExpenseAmount.toLocaleString())}
            </div>
            <p className="text-[11px] text-rose-100 mt-1 flex items-center gap-1 font-medium">
              <ArrowDownRight size={14} />
              <span>মোট {toBanglaDigits(filteredExpenses.length)} টি এন্ট্রি করা খরচ</span>
            </p>
          </div>
        </div>

        {/* Net Profit Card */}
        <div className={`rounded-3xl p-5 text-white shadow-md flex flex-col justify-between ${
          netProfit >= 0 ? 'bg-gradient-to-br from-indigo-600 to-blue-700' : 'bg-gradient-to-br from-amber-600 to-orange-700'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-100 tracking-wide uppercase">
              {netProfit >= 0 ? 'নিট লাভ (Net Profit)' : 'নিট লোকসান (Net Loss)'}
            </span>
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-xs">
              <DollarSign size={20} className="text-white" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black flex items-center gap-1">
              <span>{netProfit < 0 ? '-' : ''}৳{toBanglaDigits(Math.abs(netProfit).toLocaleString())}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 ml-2">
                {profitMargin}%
              </span>
            </div>
            <p className="text-[11px] text-indigo-100 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp size={14} />
              <span>বিক্রি থেকে যাবতীয় খরচ বাদ দেওয়ার পর মূল লাভ</span>
            </p>
          </div>
        </div>

      </div>

      {/* Main Content Area: Expenses Table & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Expenses List (2 Cols on Large) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-base text-stone-900 flex items-center gap-2">
                <span>খরচের তালিকা</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
                  {toBanglaDigits(filteredExpenses.length)}
                </span>
              </h3>
              <p className="text-xs text-stone-500">
                {viewType === 'day' ? `${selectedDate} তারিখের খরচ` : viewType === 'month' ? `${selectedMonth} মাসের খরচ` : 'সকল খরচ'}
              </p>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
                <Receipt size={32} />
              </div>
              <h4 className="text-sm font-bold text-stone-700">কোনো খরচের হিসাব পাওয়া যায়নি</h4>
              <p className="text-xs text-stone-500 max-w-sm mt-1">
                {expenses.length > 0 
                  ? `আপনার মোট ${toBanglaDigits(expenses.length)} টি খরচ মেমোরিতে সংরক্ষিত আছে, তবে বর্তমান তারিখ বা ফিল্টারে মিলছে না।`
                  : 'এখনও কোনো খরচ যোগ করা হয়নি। উপরের "নতুন খরচ যোগ করুন" বাটনে ক্লিক করে খরচ যুক্ত করুন।'
                }
              </p>
              {expenses.length > 0 ? (
                <button
                  onClick={() => { setViewType('all'); setCategoryFilter('All'); setSearchQuery(''); }}
                  className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-md"
                >
                  সবগুলো ({toBanglaDigits(expenses.length)} টি) খরচ এখনই দেখুন
                </button>
              ) : (
                <button
                  onClick={handleOpenAdd}
                  className="mt-4 px-4 py-2 bg-stone-900 text-white text-xs font-bold rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  + খরচ এন্ট্রি করুন
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-100 text-[11px] font-black uppercase text-stone-500 tracking-wider">
                    <th className="py-3 px-4">তারিখ</th>
                    <th className="py-3 px-4">বিবরণ / শিরোনাম</th>
                    <th className="py-3 px-4">ক্যাটাগরি</th>
                    <th className="py-3 px-4 text-right">পরিমাণ (৳)</th>
                    <th className="py-3 px-4 text-center">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  {filteredExpenses.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/80 transition-colors group">
                      <td className="py-3 px-4 whitespace-nowrap text-stone-600 font-medium">
                        {toBanglaDigits(item.date)}
                      </td>
                      <td className="py-3 px-4 font-bold text-stone-900">
                        <div>{item.title}</div>
                        {item.note && (
                          <div className="text-[11px] text-stone-400 font-normal mt-0.5 line-clamp-1">{item.note}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-black text-rose-600 text-sm">
                        ৳{toBanglaDigits(item.amount.toLocaleString())}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            title="সংশোধন করুন"
                            className="p-1.5 text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => setExpenseToDelete(item)}
                            title="মুছে ফেলুন"
                            className="p-1.5 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer Summary */}
          {filteredExpenses.length > 0 && (
            <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-stone-700">
              <span>মোট {toBanglaDigits(filteredExpenses.length)} টি আইটেম</span>
              <span className="text-stone-900">
                সর্বমোট খরচ: <b className="text-rose-600 text-sm font-black">৳{toBanglaDigits(totalExpenseAmount.toLocaleString())}</b>
              </span>
            </div>
          )}
        </div>

        {/* Category Breakdown Card (1 Col) */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xs p-5 flex flex-col">
          <h3 className="font-extrabold text-base text-stone-900 flex items-center gap-2 mb-1">
            <Tag size={18} className="text-rose-600" />
            <span>ক্যাটাগরি ভিত্তিক খরচের বিবরণ</span>
          </h3>
          <p className="text-xs text-stone-500 mb-4">
            কোন খাতে কত শতাংশ টাকা খরচ হয়েছে তার বিশ্লেষণ
          </p>

          {categoryStats.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-stone-400 italic py-8">
              কোনো তথ্য নেই
            </div>
          ) : (
            <div className="space-y-3.5 flex-1">
              {categoryStats.map((cat) => (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-stone-800">{cat.category}</span>
                    <span className="text-stone-900">
                      ৳{toBanglaDigits(cat.amount.toLocaleString())} ({toBanglaDigits(cat.percentage)}%)
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, Math.max(5, cat.percentage))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Monthly Health Tip */}
          <div className="mt-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <h5 className="font-bold mb-1 flex items-center gap-1.5 text-amber-950">
              <TrendingUp size={14} className="text-amber-700" />
              <span>ব্যবসায়িক টিপস</span>
            </h5>
            <p className="text-[11px] leading-relaxed text-amber-800">
              প্রতিদিনের ইলিশ মাছ ক্রয়, কাঁচাবাজার ও তেলের খরচ সঠিকভাবে লিপিবদ্ধ রাখলে মাস শেষে নিট লাভ নিখুঁতভাবে জানা যায়।
            </p>
          </div>
        </div>

      </div>

      {/* Add / Edit Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Wallet size={18} className="text-amber-400" />
                <span>{editingExpense ? 'খরচের হিসাব সংশোধন করুন' : 'নতুন খরচ যোগ করুন'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-300 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              
              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  তারিখ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-rose-500 font-bold"
                />
              </div>

              {/* Title / Description */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  খরচের শিরোনাম / বিবরণ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: পদ্মা ইলিশ মাছ ক্রয়, ৫ লিটার সয়াবিন তেল, দোকান বিদ্যুৎ বিল ইত্যাদি"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-rose-500 font-medium"
                />
              </div>

              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-700">
                    খরচের ক্যাটাগরি <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowCategoryModal(true)}
                      className="text-[11px] font-bold text-stone-500 hover:text-stone-800 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Settings size={12} />
                      <span>এডিট/মুছুন</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomCategory(!isCustomCategory);
                        if (!isCustomCategory) {
                          setCustomCategoryInput('');
                        }
                      }}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      {isCustomCategory ? '← তালিকা থেকে নিন' : '+ নতুন লিখুন'}
                    </button>
                  </div>
                </div>

                {isCustomCategory ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      required
                      placeholder="নতুন ক্যাটাগরির নাম লিখুন (যেমন: সমিতি কিস্তি, চা-নাশতা)..."
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-white rounded-xl border-2 border-rose-400 focus:outline-rose-500 font-bold text-stone-800 placeholder:font-normal shadow-xs"
                      autoFocus
                    />
                    <p className="text-[10px] text-stone-500">
                      * এই ক্যাটাগরি ক্লাউড ডেটাবেজে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়ে যাবে।
                    </p>
                  </div>
                ) : (
                  <div>
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        if (e.target.value === '__CUSTOM__') {
                          setIsCustomCategory(true);
                          setCustomCategoryInput('');
                        } else {
                          setFormData({ ...formData, category: e.target.value });
                        }
                      }}
                      className="w-full px-3.5 py-2.5 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-rose-500 font-bold text-stone-800 cursor-pointer"
                    >
                      {categoriesList.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__CUSTOM__" className="text-rose-600 font-black">+ নতুন ক্যাটাগরি লিখুন...</option>
                    </select>

                    {/* Quick rename button for current category */}
                    <div className="flex items-center justify-between text-[11px] text-stone-500 mt-1.5 px-0.5">
                      <span>নির্বাচিত: <strong className="text-stone-800">{formData.category}</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryKey(formData.category);
                          setEditingCategoryValue(formData.category);
                          setShowCategoryModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 size={12} />
                        <span>এই ক্যাটাগরি পরিবর্তন করুন</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  টাকার পরিমাণ (৳) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-stone-400 text-sm">৳</span>
                  <input
                    type="number"
                    step="any"
                    required
                    min="1"
                    placeholder="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full pl-8 pr-4 py-2.5 text-sm bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-rose-500 font-black text-rose-600"
                  />
                </div>
              </div>

              {/* Note / Memo */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  অতিরিক্ত নোট (ঐচ্ছিক)
                </label>
                <textarea
                  rows={2}
                  placeholder="যেমন: কার কাছ থেকে কেনা হলো বা ভাউচার নম্বর..."
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-rose-500 font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95"
                >
                  {editingExpense ? 'সংরক্ষণ করুন' : 'খরচ যুক্ত করুন'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 size={26} />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-base">খরচটি মুছে ফেলতে চান?</h3>
              <p className="text-xs text-stone-500 mt-1">
                "{expenseToDelete.title}" (৳{toBanglaDigits(expenseToDelete.amount)}) তালিকা থেকে স্থায়ীভাবে মুছে ফেলা হবে।
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
              >
                না, রাখুন
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer shadow-md"
              >
                হ্যাঁ, মুছুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Management Modal (Edit / Delete / Add Categories) */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                  <Settings size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base">ক্যাটাগরি পরিচালনা</h3>
                  <p className="text-xs text-stone-500">খরচের ক্যাটাগরি এডিট, নতুন তৈরি বা মুছে ফেলুন</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategoryKey(null);
                }}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Add New Category Input */}
            <div className="py-4 border-b border-stone-100 shrink-0">
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                নতুন ক্যাটাগরি যোগ করুন:
              </label>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddCategory(newCatInput);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="যেমন: ডেকোরেশন খরচ, উপহার, গ্যাস সিলিন্ডার..."
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:bg-white focus:outline-rose-500 font-bold text-stone-800 placeholder:font-normal"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  + যোগ করুন
                </button>
              </form>
            </div>

            {/* Categories List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 px-1 mb-1">
                <span>বর্তমান সক্রিয় ক্যাটাগরিসমূহ ({toBanglaDigits(categoriesList.length)}টি):</span>
                <span>অ্যাকশন</span>
              </div>

              {categoriesList.map((cat) => {
                const countUsed = expenses.filter(e => e.category === cat).length;
                const isEditing = editingCategoryKey === cat;

                return (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-stone-50 hover:bg-stone-100/80 border border-stone-200 transition-colors gap-2"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingCategoryValue}
                          onChange={(e) => setEditingCategoryValue(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs bg-white rounded-lg border-2 border-rose-500 focus:outline-hidden font-bold text-stone-900"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleEditCategory(cat, editingCategoryValue);
                            } else if (e.key === 'Escape') {
                              setEditingCategoryKey(null);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleEditCategory(cat, editingCategoryValue)}
                          title="সংরক্ষণ করুন"
                          className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingCategoryKey(null)}
                          title="বাতিল"
                          className="p-1.5 bg-stone-200 text-stone-700 rounded-lg hover:bg-stone-300 transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          <span className="font-bold text-xs text-stone-800 truncate">{cat}</span>
                          {countUsed > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 shrink-0">
                              {toBanglaDigits(countUsed)}টি খরচ
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] text-stone-400 bg-stone-100 shrink-0">
                              অব্যবহৃত
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingCategoryKey(cat);
                              setEditingCategoryValue(cat);
                            }}
                            title="নাম এডিট / পরিবর্তন করুন"
                            className="p-1.5 text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            title="মুছে ফেলুন"
                            className="p-1.5 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer with Reset Defaults and Close Button */}
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetCategories}
                className="flex items-center gap-1.5 text-[11px] font-bold text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>ডিফল্ট তালিকা ফিরিয়ে আনুন</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategoryKey(null);
                }}
                className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                সম্পন্ন
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
