import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, MoreVertical, Filter, Image as ImageIcon, Check, X, Upload, AlertTriangle, Loader2, CheckCircle, ArrowUp, ArrowDown, Layers, GripVertical, RotateCw, Sun, Camera, Sparkles, Tag, Zap, UtensilsCrossed, ChevronDown, ChevronRight, ChevronUp, Crop, Sliders, ZoomIn, ZoomOut, RefreshCw, HardDrive, Maximize2, Sparkle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { 
  parseCategoryData, combineCategoryData, parseDescriptionData, combineDescriptionData, 
  sortCategoriesByOrder, saveCategoryOrder, 
  sortMenuItemsByOrder, saveItemOrder 
} from '../../utils';
import { INITIAL_CATEGORIES, INITIAL_MENU_ITEMS } from '../../data/initialMenuData';
import { saveImagesToIDB, getAllImagesFromIDB, safeCacheMenuItemsMetadata } from '../../lib/imageStorage';

interface Category {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category_id: string;
  is_available: boolean;
  created_at?: string;
}

interface DeleteTarget {
  type: 'category' | 'item';
  id: string;
  name: string;
  itemCount?: number;
}

const TABS = ['খাবার ও মেনু (Menusa View)', 'ক্যাটাগরি সাজান ও পরিচালনা'];

export default function AdminMenuPage() {
  const [activeTab, setActiveTab] = useState('খাবার ও মেনু (Menusa View)');
  
  const [categories, setCategories] = useState<Category[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_menu_categories');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return sortCategoriesByOrder(parsed);
        } catch (e) {}
      }
    }
    return sortCategoriesByOrder(INITIAL_CATEGORIES as any);
  });

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_menu_items');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return sortMenuItemsByOrder(parsed);
        } catch (e) {}
      }
    }
    return sortMenuItemsByOrder(INITIAL_MENU_ITEMS as any);
  });

  const [loading, setLoading] = useState(false);
  
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryPortions, setCategoryPortions] = useState<string[]>([]);
  const [newPortionInput, setNewPortionInput] = useState('');
  
  // Edit Category states
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryPortions, setEditCategoryPortions] = useState<string[]>([]);
  const [editPortionInput, setEditPortionInput] = useState('');

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState<Partial<MenuItem> & { portionPrices?: Record<string, string> }>({
    portionPrices: {},
    name: '', description: '', price: 0, image_url: '', category_id: '', is_available: true
  });

  // Edit Item states
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editItemForm, setEditItemForm] = useState<Partial<MenuItem> & { portionPrices?: Record<string, string> }>({
    portionPrices: {},
    name: '', description: '', price: 0, image_url: '', category_id: '', is_available: true
  });

  // Menusa-style Quick Category & Tags
  const [showQuickCatInput, setShowQuickCatInput] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const POPULAR_TAGS = ['🔥 বেস্টসেলার', '⭐ শেফ স্পেশাল', '🌶️ স্পাইসি', '👑 স্পেশাল', '🆕 নতুন'];

  const createQuickCategory = async (isEdit: boolean = false) => {
    if (!quickCatName.trim()) return;
    const catName = quickCatName.trim();
    try {
      const { data, error } = await supabase.from('categories').insert([{ name: catName }]).select();
      if (error) {
        handleError(error, 'quick add category');
        return;
      }
      const created: Category = (data && data[0]) ? data[0] : { id: 'cat_' + Date.now(), name: catName };
      const updatedCats = [...categories, created];
      updateCachedCategories(updatedCats);
      saveCategoryOrder(updatedCats.map(c => c.id));
      if (isEdit) {
        setEditItemForm(prev => ({ ...prev, category_id: created.id }));
      } else {
        setNewItem(prev => ({ ...prev, category_id: created.id }));
      }
      setQuickCatName('');
      setShowQuickCatInput(false);
      showToast(`'${catName}' ক্যাটাগরি তৈরি ও নির্বাচন করা হয়েছে!`, 'success');
    } catch (e: any) {
      handleError(e, 'quick add category');
    }
  };

  const toggleTagInDescription = (tag: string, isEdit: boolean = false) => {
    const current = isEdit ? (editItemForm.description || '') : (newItem.description || '');
    let updated = '';
    if (current.includes(tag)) {
      updated = current.replace(tag, '').replace(/•\s*•/g, '•').trim().replace(/^•|•$/g, '').trim();
    } else {
      updated = current ? `${tag} • ${current}` : tag;
    }
    if (isEdit) {
      setEditItemForm(prev => ({ ...prev, description: updated }));
    } else {
      setNewItem(prev => ({ ...prev, description: updated }));
    }
  };

  const [rlsError, setRlsError] = useState(false);

  // Validation error state
  const [itemFormError, setItemFormError] = useState<string | null>(null);

  // Category filter state for Food Items tab
  const [foodCategoryFilter, setFoodCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const isCategoryExpanded = (catId: string, index: number) => {
    if (searchQuery.trim().length > 0) return true;
    if (foodCategoryFilter === catId) return true;
    if (expandedCategories[catId] !== undefined) {
      return expandedCategories[catId];
    }
    return index === 0;
  };

  const toggleCategoryExpanded = (catId: string, index: number) => {
    const current = isCategoryExpanded(catId, index);
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !current
    }));
  };

  const expandAllCategories = () => {
    const allOpen: Record<string, boolean> = {};
    categories.forEach(c => { allOpen[c.id] = true; });
    setExpandedCategories(allOpen);
  };

  const collapseAllCategories = () => {
    const allClosed: Record<string, boolean> = {};
    categories.forEach(c => { allClosed[c.id] = false; });
    setExpandedCategories(allClosed);
  };

  // In-app Card Image Editor & Optimizer States
  const [imageEditorFile, setImageEditorFile] = useState<string | null>(null);
  const [imageEditorTarget, setImageEditorTarget] = useState<'new' | 'edit'>('new');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cardRatio, setCardRatio] = useState<'4:3' | '16:9' | '1:1' | '3:2'>('4:3');
  const [cardSizePreset, setCardSizePreset] = useState<'small' | 'medium' | 'hd'>('medium');
  const [quality, setQuality] = useState(75);
  const [estimatedSizeKB, setEstimatedSizeKB] = useState(55);
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 400, height: 300 });
  const [editorActiveTab, setEditorActiveTab] = useState<'card' | 'size' | 'tune'>('card');

  // In-app Delete Confirmation & Feedback
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Immediate Cache and Cross-Tab / Cross-Device Synchronizer
  const updateCachedMenu = (newItems: MenuItem[]) => {
    setMenuItems(newItems);
    if (typeof window !== 'undefined') {
      try {
        safeCacheMenuItemsMetadata(newItems);
        saveImagesToIDB(newItems);
        window.dispatchEvent(new CustomEvent('restaurant_menu_updated'));
        const bc = new BroadcastChannel('restaurant_menu_sync');
        bc.postMessage({ type: 'menu_updated', timestamp: Date.now() });
        bc.close();
      } catch (e) {}
    }
  };

  const updateCachedCategories = (newCats: Category[]) => {
    setCategories(newCats);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cached_menu_categories', JSON.stringify(newCats));
        window.dispatchEvent(new CustomEvent('restaurant_category_order_updated'));
        window.dispatchEvent(new CustomEvent('restaurant_menu_updated'));
        const bc = new BroadcastChannel('restaurant_menu_sync');
        bc.postMessage({ type: 'categories_updated', timestamp: Date.now() });
        bc.close();
      } catch (e) {}
    }
  };

  useEffect(() => {
    // Load images from IndexedDB on startup
    getAllImagesFromIDB().then(idbMap => {
      if (idbMap.size > 0) {
        setMenuItems(prev => {
          let hasChanged = false;
          const updated = prev.map(item => {
            const idbImg = idbMap.get(item.id);
            if (idbImg && idbImg !== item.image_url) {
              hasChanged = true;
              return { ...item, image_url: idbImg };
            }
            return item;
          });
          return hasChanged ? updated : prev;
        });
      }
    }).catch(() => {});

    fetchData();
  }, []);

  const handleError = (error: any, context: string) => {
    console.error(`Error in ${context}:`, error);
    if (error?.code === '42501' || error?.message?.includes('row-level security policy')) {
      setRlsError(true);
    } else {
      showToast(`সমস্যা হয়েছে: ${error?.message || 'Something went wrong'}`, 'error');
    }
  };

  const loadImagesProgressively = async (itemIds: string[], knownImages: Map<string, string>) => {
    // Background load images for items that don't have an image in memory
    const idsToFetch = itemIds.filter(id => !knownImages.has(id) || !knownImages.get(id));
    if (idsToFetch.length === 0) return;

    // Fetch in parallel chunks of 15 items for high performance
    const CHUNK_SIZE = 15;
    const chunks: string[][] = [];
    for (let i = 0; i < idsToFetch.length; i += CHUNK_SIZE) {
      chunks.push(idsToFetch.slice(i, i + CHUNK_SIZE));
    }

    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const { data: imgData } = await supabase
            .from('menu_items')
            .select('id, image_url')
            .in('id', chunk);

          if (imgData && imgData.length > 0) {
            saveImagesToIDB(imgData);
            setMenuItems(prev => {
              let hasChanged = false;
              const updated = prev.map(item => {
                const found = imgData.find(d => d.id === item.id);
                if (found && found.image_url && found.image_url !== item.image_url) {
                  hasChanged = true;
                  return { ...item, image_url: found.image_url };
                }
                return item;
              });
              return hasChanged ? updated : prev;
            });
          }
        } catch (e) {}
      })
    );
  };

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Fetch categories
      const categoriesRes = await supabase.from('categories').select('*').order('created_at');
      if (categoriesRes.data) {
        const cleanCats = categoriesRes.data.filter((c: any) => c.name && !c.name.startsWith('__SYSTEM_') && !c.name.startsWith('__CONFIG_'));
        const sortedCats = sortCategoriesByOrder(cleanCats);
        updateCachedCategories(sortedCats);
      }

      // 2. Fetch all menu items
      const itemsRes = await supabase
        .from('menu_items')
        .select('id, name, description, price, category_id, is_available, created_at')
        .order('created_at');

      if (itemsRes.data && itemsRes.data.length > 0) {
        // Collect existing cached images so images don't vanish while loading
        const cachedMap = new Map<string, string>();
        INITIAL_MENU_ITEMS.forEach(i => {
          if (i.image_url) cachedMap.set(i.id, i.image_url);
        });
        menuItems.forEach(i => {
          if (i.image_url) cachedMap.set(i.id, i.image_url);
        });

        // Also check IndexedDB for cached images
        try {
          const idbMap = await getAllImagesFromIDB();
          idbMap.forEach((val, key) => {
            if (val) cachedMap.set(key, val);
          });
        } catch (e) {}

        const initialMerged: MenuItem[] = itemsRes.data.map(item => ({
          ...item,
          image_url: cachedMap.get(item.id) || '',
          category_id: item.category_id || ''
        }));

        const sortedItems = sortMenuItemsByOrder(initialMerged);
        updateCachedMenu(sortedItems);

        // 3. Progressively fetch remaining images in parallel batches
        loadImagesProgressively(itemsRes.data.map(i => i.id), cachedMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    const finalName = combineCategoryData(newCategoryName, categoryPortions);
    
    try {
      const { data, error } = await supabase.from('categories').insert([{ name: finalName }]).select();
      if (error) {
        handleError(error, 'add category');
        // Local fallback
        const localCat: Category = { id: 'cat_' + Date.now(), name: finalName };
        const updatedCats = [...categories, localCat];
        updateCachedCategories(updatedCats);
        saveCategoryOrder(updatedCats.map(c => c.id));
        setNewCategoryName('');
        setCategoryPortions([]);
        setIsAddingCategory(false);
        showToast('নতুন ক্যাটাগরি তৈরি হয়েছে (লোকাল ব্যাকআপ সংরক্ষিত)!', 'success');
        return;
      }
      if (data && data[0]) {
        const updatedCats = [...categories, data[0]];
        updateCachedCategories(updatedCats);
        saveCategoryOrder(updatedCats.map(c => c.id));
        setNewCategoryName('');
        setCategoryPortions([]);
        setIsAddingCategory(false);
        showToast('নতুন ক্যাটাগরি সফলভাবে তৈরি হয়েছে!');
      }
    } catch (error: any) {
      handleError(error, 'add category');
    }
  }

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newCategories = [...categories];
    const itemToMove = newCategories[index];
    newCategories[index] = newCategories[targetIndex];
    newCategories[targetIndex] = itemToMove;

    updateCachedCategories(newCategories);
    saveCategoryOrder(newCategories.map(c => c.id));
    showToast(`"${parseCategoryData(itemToMove.name).name}" ক্যাটাগরি ${direction === 'up' ? 'উপরে' : 'নিচে'} স্থানান্তর করা হয়েছে!`);
  };

  const displayedItems = foodCategoryFilter === 'All'
    ? menuItems
    : menuItems.filter(i => i.category_id === foodCategoryFilter);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const currentItem = displayedItems[index];
    if (!currentItem) return;

    const targetItem = direction === 'up' ? displayedItems[index - 1] : displayedItems[index + 1];
    if (!targetItem) return;

    const currentIndexInFull = menuItems.findIndex(i => i.id === currentItem.id);
    const targetIndexInFull = menuItems.findIndex(i => i.id === targetItem.id);
    if (currentIndexInFull === -1 || targetIndexInFull === -1) return;

    const newItems = [...menuItems];
    newItems[currentIndexInFull] = targetItem;
    newItems[targetIndexInFull] = currentItem;

    updateCachedMenu(newItems);
    saveItemOrder(newItems.map(i => i.id));
    showToast(`"${currentItem.name}" খাবারটি ${direction === 'up' ? 'উপরে' : 'নিচে'} স্থানান্তর করা হয়েছে!`);
  };

  const openAddItemForCategory = (catId?: string) => {
    setItemFormError(null);
    const targetCatId = catId || (categories.length > 0 ? categories[0].id : '');
    if (targetCatId) {
      setExpandedCategories(prev => ({ ...prev, [targetCatId]: true }));
    }
    setNewItem({
      name: '',
      description: '',
      price: 0,
      image_url: '',
      category_id: targetCatId,
      is_available: true,
      portionPrices: {}
    });
    setIsAddingItem(true);
  };

  const moveItemInCategory = (item: MenuItem, direction: 'up' | 'down', categoryItems: MenuItem[]) => {
    const itemIndex = categoryItems.findIndex(i => i.id === item.id);
    if (itemIndex === -1) return;
    const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
    if (targetIndex < 0 || targetIndex >= categoryItems.length) return;
    const targetItem = categoryItems[targetIndex];

    const currentIndexInFull = menuItems.findIndex(i => i.id === item.id);
    const targetIndexInFull = menuItems.findIndex(i => i.id === targetItem.id);
    if (currentIndexInFull === -1 || targetIndexInFull === -1) return;

    const newItems = [...menuItems];
    newItems[currentIndexInFull] = targetItem;
    newItems[targetIndexInFull] = item;

    updateCachedMenu(newItems);
    saveItemOrder(newItems.map(i => i.id));
    showToast(`"${item.name}" খাবারটি ${direction === 'up' ? 'উপরে' : 'নিচে'} স্থানান্তর করা হয়েছে!`);
  };

  const startEditCategory = (cat: Category) => {
    const { name, portions } = parseCategoryData(cat.name);
    setEditingCategory(cat);
    setEditCategoryName(name);
    setEditCategoryPortions([...portions]);
    setEditPortionInput('');
  };

  async function updateCategory() {
    if (!editingCategory || !editCategoryName.trim()) return;
    const finalName = combineCategoryData(editCategoryName, editCategoryPortions);
    try {
      const { error } = await supabase.from('categories').update({ name: finalName }).eq('id', editingCategory.id);
      if (error) {
        handleError(error, 'update category');
        return;
      }
      const updatedCats = categories.map(c => c.id === editingCategory.id ? { ...c, name: finalName } : c);
      updateCachedCategories(updatedCats);
      setEditingCategory(null);
      showToast('ক্যাটাগরি সফলভাবে আপডেট করা হয়েছে!');
    } catch (error: any) {
      handleError(error, 'update category');
    }
  }

  function deleteCategory(id: string) {
    const cat = categories.find(c => c.id === id);
    const parsed = cat ? parseCategoryData(cat.name).name : 'ক্যাটাগরি';
    const count = menuItems.filter(i => i.category_id === id).length;
    setDeleteTarget({ type: 'category', id, name: parsed, itemCount: count });
  }

  const getPreviewDimensions = (ratio: '4:3' | '16:9' | '1:1' | '3:2') => {
    switch (ratio) {
      case '4:3': return { w: 320, h: 240 };
      case '16:9': return { w: 320, h: 180 };
      case '1:1': return { w: 260, h: 260 };
      case '3:2': return { w: 320, h: 213 };
      default: return { w: 320, h: 240 };
    }
  };

  const getTargetDimensions = (ratio: '4:3' | '16:9' | '1:1' | '3:2', preset: 'small' | 'medium' | 'hd') => {
    const baseWidths = { small: 360, medium: 480, hd: 640 };
    const w = baseWidths[preset] || 480;
    if (ratio === '4:3') return { width: w, height: Math.round(w * (3 / 4)) };
    if (ratio === '16:9') return { width: w, height: Math.round(w * (9 / 16)) };
    if (ratio === '1:1') {
      const sq = preset === 'small' ? 320 : preset === 'medium' ? 420 : 560;
      return { width: sq, height: sq };
    }
    if (ratio === '3:2') return { width: w, height: Math.round(w * (2 / 3)) };
    return { width: w, height: Math.round(w * (3 / 4)) };
  };

  // Dynamically estimate output file size in KB
  useEffect(() => {
    if (!imageEditorFile) return;
    const { width: targetW, height: targetH } = getTargetDimensions(cardRatio, cardSizePreset);
    const totalPixels = targetW * targetH;
    const qFactor = quality / 100;
    const estKB = Math.round((totalPixels * 0.22 * (qFactor * qFactor)) / 1024);
    setEstimatedSizeKB(Math.max(18, estKB));
  }, [cardRatio, cardSizePreset, quality, imageEditorFile]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const testImg = new Image();
        testImg.src = result;
        testImg.onload = () => {
          setImgNaturalSize({ width: testImg.width || 400, height: testImg.height || 300 });
        };
        setImageEditorFile(result);
        setImageEditorTarget(isEdit ? 'edit' : 'new');
        setZoom(1);
        setRotation(0);
        setBrightness(100);
        setContrast(100);
        setPanX(0);
        setPanY(0);
        setCardRatio('4:3');
        setCardSizePreset('medium');
        setQuality(75);
        setEditorActiveTab('card');
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const applyImageEdit = () => {
    if (!imageEditorFile) return;

    const img = new Image();
    img.src = imageEditorFile;
    img.onload = () => {
      const { w: previewW, h: previewH } = getPreviewDimensions(cardRatio);
      const { width: targetW, height: targetH } = getTargetDimensions(cardRatio, cardSizePreset);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Fill clean white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);

      // 2. Color adjustments
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

      // 3. Compute base display size in preview container (cover mode)
      const boxRatio = previewW / previewH;
      const naturalRatio = (img.width || 400) / (img.height || 300);
      let baseW = previewW;
      let baseH = previewH;
      if (naturalRatio > boxRatio) {
        baseH = previewH;
        baseW = previewH * naturalRatio;
      } else {
        baseW = previewW;
        baseH = previewW / naturalRatio;
      }

      // 4. Translate, rotate & scale on canvas matching preview
      const scaleToCanvas = targetW / previewW;
      ctx.save();
      ctx.translate(targetW / 2 + panX * scaleToCanvas, targetH / 2 + panY * scaleToCanvas);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      // 5. Draw image centered
      const canvasBaseW = baseW * scaleToCanvas;
      const canvasBaseH = baseH * scaleToCanvas;
      ctx.drawImage(img, -canvasBaseW / 2, -canvasBaseH / 2, canvasBaseW, canvasBaseH);
      ctx.restore();

      // 6. Compress to optimized lightweight JPEG
      const qualityFloat = Math.max(0.4, Math.min(0.95, quality / 100));
      const editedDataUrl = canvas.toDataURL('image/jpeg', qualityFloat);
      
      if (imageEditorTarget === 'edit') {
        setEditItemForm(prev => ({ ...prev, image_url: editedDataUrl }));
      } else {
        setNewItem(prev => ({ ...prev, image_url: editedDataUrl }));
      }
      setImageEditorFile(null);
      showToast('ছবিটি সুন্দর কার্ড আকারে ক্রপ ও ছোট সাইজে সেভ করা হয়েছে!', 'success');
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPanX(e.touches[0].clientX - dragStart.x);
    setPanY(e.touches[0].clientY - dragStart.y);
  };

  // Helper to place item directly under its category in order
  const placeItemUnderCategory = (currentItems: MenuItem[], itemToAdd: MenuItem): MenuItem[] => {
    const catId = itemToAdd.category_id;
    if (!catId) return [...currentItems, itemToAdd];

    // Find the last item that belongs to the same category
    let lastIndex = -1;
    for (let i = currentItems.length - 1; i >= 0; i--) {
      if (currentItems[i].category_id === catId) {
        lastIndex = i;
        break;
      }
    }

    if (lastIndex !== -1) {
      return [
        ...currentItems.slice(0, lastIndex + 1),
        itemToAdd,
        ...currentItems.slice(lastIndex + 1)
      ];
    }

    // If no item in this category exists yet, place it according to category order
    const catIndex = categories.findIndex(c => c.id === catId);
    if (catIndex !== -1) {
      const laterCatIds = new Set(categories.slice(catIndex + 1).map(c => c.id));
      const nextIndex = currentItems.findIndex(i => i.category_id && laterCatIds.has(i.category_id));
      if (nextIndex !== -1) {
        return [
          ...currentItems.slice(0, nextIndex),
          itemToAdd,
          ...currentItems.slice(nextIndex)
        ];
      }
    }

    return [...currentItems, itemToAdd];
  };

  async function addItem(addAnother: boolean = false) {
    if (!newItem.name?.trim()) {
      setItemFormError('খাবারের নাম দেওয়া আবশ্যক!');
      return;
    }

    if (!newItem.category_id) {
      setItemFormError('অনুগ্রহ করে একটি ক্যাটাগরি নির্বাচন করুন!');
      return;
    }

    const selectedCat = categories.find(c => c.id === newItem.category_id);
    const catPortions = selectedCat ? parseCategoryData(selectedCat.name).portions : [];
    const isMatrix = catPortions.length > 0;

    if (isMatrix) {
       const variants = catPortions.map(p => ({
         name: p,
         price: parseFloat(newItem.portionPrices?.[p] || '0')
       }));
       if (variants.some(v => isNaN(v.price) || v.price <= 0)) {
         setItemFormError('অনুগ্রহ করে সকল পোরশনের সঠিক মূল্য (৳) প্রদান করুন।');
         return;
       }
       
       const minPrice = Math.min(...variants.map(v => v.price));
       const finalDesc = combineDescriptionData(newItem.description || '', '', variants);
       
       const itemToInsert = {
           name: newItem.name.trim(),
           price: minPrice,
           description: finalDesc,
           image_url: newItem.image_url || '',
           category_id: newItem.category_id || null,
           is_available: newItem.is_available ?? true
       };
       
       try {
         const { data, error } = await supabase.from('menu_items').insert([itemToInsert]).select();
         if (error) { 
           handleError(error, 'add item'); 
           // Optimistic local fallback
           const localItem: MenuItem = {
             id: 'item_' + Date.now(),
             ...itemToInsert,
             category_id: itemToInsert.category_id || '',
             created_at: new Date().toISOString()
           };
           const updated = placeItemUnderCategory(menuItems, localItem);
           updateCachedMenu(updated);
           saveItemOrder(updated.map(i => i.id));
           if (addAnother) {
             const keepCat = newItem.category_id;
             setNewItem({ name: '', description: '', price: 0, image_url: '', category_id: keepCat, is_available: true, portionPrices: {} });
             setItemFormError(null);
             showToast(`"${localItem.name}" সেভ হয়েছে! পরবর্তী খাবার লিখুন।`, 'success');
           } else {
             setIsAddingItem(false);
             setNewItem({ name: '', description: '', price: 0, image_url: '', category_id: categories.length > 0 ? categories[0].id : '', is_available: true, portionPrices: {} });
             showToast(`"${localItem.name}" খাবারটি মেনুতে যুক্ত হয়েছে!`, 'success');
           }
           return;
         }
         if (data && data[0]) { 
           const updated = placeItemUnderCategory(menuItems, data[0]);
           updateCachedMenu(updated);
           saveItemOrder(updated.map(i => i.id));
           if (addAnother) {
             const keepCat = newItem.category_id;
             setNewItem({ name: '', description: '', price: 0, image_url: '', category_id: keepCat, is_available: true, portionPrices: {} });
             setItemFormError(null);
             showToast(`"${data[0].name}" সেভ হয়েছে! পরবর্তী খাবার লিখুন।`, 'success');
           } else {
             setIsAddingItem(false); 
             setNewItem({ name: '', description: '', price: 0, image_url: '', category_id: categories.length > 0 ? categories[0].id : '', is_available: true, portionPrices: {} }); 
             showToast(`"${data[0].name}" খাবারটি সফলভাবে মেনুতে যোগ করা হয়েছে!`, 'success');
           }
         }
       } catch (e: any) { handleError(e, 'add item'); }
       return;
    }

    if (!newItem.price || Number(newItem.price) <= 0) {
      setItemFormError('মূল্য (Price) আবশ্যক এবং অবশ্যই ০-এর বেশি হতে হবে।');
      return;
    }
    
    const finalDesc = combineDescriptionData(newItem.description || '', '', []);
    const itemToInsert = {
        name: newItem.name.trim(),
        price: Number(newItem.price),
        description: finalDesc,
        image_url: newItem.image_url || '',
        category_id: newItem.category_id || null,
        is_available: newItem.is_available ?? true
    };

    try {
      const { data, error } = await supabase.from('menu_items').insert([itemToInsert]).select();
      if (error) {
        handleError(error, 'add item');
        // Optimistic local fallback
        const localItem: MenuItem = {
          id: 'item_' + Date.now(),
          ...itemToInsert,
          category_id: itemToInsert.category_id || '',
          created_at: new Date().toISOString()
        };
        const updated = placeItemUnderCategory(menuItems, localItem);
        updateCachedMenu(updated);
        saveItemOrder(updated.map(i => i.id));
        if (addAnother) {
          const keepCat = newItem.category_id;
          setNewItem({ name: '', description: '', price: 0, image_url: '', category_id: keepCat, is_available: true, portionPrices: {} });
          setItemFormError(null);
          showToast(`"${localItem.name}" সেভ হয়েছে! পরবর্তী খাবার লিখুন।`, 'success');
        } else {
          setIsAddingItem(false);
          setNewItem({ name: '', description: '', price: 0, image_url: '', category_id: categories.length > 0 ? categories[0].id : '', is_available: true, portionPrices: {} });
          showToast(`"${localItem.name}" খাবারটি মেনুতে যুক্ত হয়েছে!`, 'success');
        }
        return;
      }
      if (data && data[0]) {
        const updated = placeItemUnderCategory(menuItems, data[0]);
        updateCachedMenu(updated);
        saveItemOrder(updated.map(i => i.id));
        if (addAnother) {
          const keepCat = newItem.category_id;
          setNewItem({ name: '', description: '', price: 0, image_url: '', category_id: keepCat, is_available: true, portionPrices: {} });
          setItemFormError(null);
          showToast(`"${data[0].name}" সেভ হয়েছে! পরবর্তী খাবার লিখুন।`, 'success');
        } else {
          setIsAddingItem(false);
          setNewItem({ name: '', description: '', price: 0, image_url: '', category_id: categories.length > 0 ? categories[0].id : '', is_available: true, portionPrices: {} });
          showToast(`"${data[0].name}" খাবারটি সফলভাবে মেনুতে যোগ করা হয়েছে!`, 'success');
        }
      }
    } catch (error: any) {
      handleError(error, 'add item');
    }
  }

  const startEditItem = (food: MenuItem) => {
    const { description: cleanDesc, variants } = parseDescriptionData(food.description);
    const portionPrices: Record<string, string> = {};
    if (variants && variants.length > 0) {
      variants.forEach((v: any) => {
        portionPrices[v.name] = v.price !== undefined ? String(v.price) : '';
      });
    }
    setEditingItem(food);
    setEditItemForm({
      id: food.id,
      name: food.name,
      description: cleanDesc,
      price: food.price,
      image_url: food.image_url,
      category_id: food.category_id || '',
      is_available: food.is_available,
      portionPrices
    });
  };

  async function updateItem() {
    if (!editingItem || !editItemForm.name?.trim()) {
      setItemFormError('খাবারের নাম দেওয়া আবশ্যক!');
      return;
    }

    if (!editItemForm.category_id) {
      setItemFormError('অনুগ্রহ করে একটি ক্যাটাগরি নির্বাচন করুন!');
      return;
    }

    const selectedCat = categories.find(c => c.id === editItemForm.category_id);
    const catPortions = selectedCat ? parseCategoryData(selectedCat.name).portions : [];
    const isMatrix = catPortions.length > 0;

    const applyItemUpdate = (itemData: any) => {
      const updatedItem: MenuItem = {
        ...editingItem,
        ...itemData,
        category_id: itemData.category_id || ''
      };

      if (editingItem.category_id !== updatedItem.category_id) {
        const withoutCurrent = menuItems.filter(i => i.id !== updatedItem.id);
        const reordered = placeItemUnderCategory(withoutCurrent, updatedItem);
        updateCachedMenu(reordered);
        saveItemOrder(reordered.map(i => i.id));
      } else {
        const updated = menuItems.map(i => i.id === editingItem.id ? updatedItem : i);
        updateCachedMenu(updated);
      }
      setEditingItem(null);
      showToast(`"${itemData.name}" সফলভাবে আপডেট করা হয়েছে!`);
    };

    if (isMatrix) {
      const variants = catPortions.map(p => ({
        name: p,
        price: parseFloat(editItemForm.portionPrices?.[p] || '0')
      }));

      if (variants.some(v => isNaN(v.price) || v.price <= 0)) {
        setItemFormError('অনুগ্রহ করে সকল পোরশনের সঠিক মূল্য (৳) প্রদান করুন।');
        return;
      }

      const minPrice = Math.min(...variants.map(v => v.price));
      const finalDesc = combineDescriptionData(editItemForm.description || '', '', variants);

      const itemToUpdate = {
        name: editItemForm.name.trim(),
        price: minPrice,
        description: finalDesc,
        image_url: editItemForm.image_url || '',
        category_id: editItemForm.category_id || null,
        is_available: editItemForm.is_available ?? true
      };

      try {
        const { error } = await supabase.from('menu_items').update(itemToUpdate).eq('id', editingItem.id);
        if (error) { handleError(error, 'update item'); return; }
        applyItemUpdate(itemToUpdate);
      } catch (e: any) {
        handleError(e, 'update item');
      }
      return;
    }

    if (!editItemForm.price || Number(editItemForm.price) <= 0) {
      setItemFormError('মূল্য (Price) আবশ্যক এবং অবশ্যই ০-এর বেশি হতে হবে।');
      return;
    }

    const finalDesc = combineDescriptionData(editItemForm.description || '', '', []);
    const itemToUpdate = {
      name: editItemForm.name.trim(),
      price: Number(editItemForm.price),
      description: finalDesc,
      image_url: editItemForm.image_url || '',
      category_id: editItemForm.category_id || null,
      is_available: editItemForm.is_available ?? true
    };

    try {
      const { error } = await supabase.from('menu_items').update(itemToUpdate).eq('id', editingItem.id);
      if (error) { handleError(error, 'update item'); return; }
      applyItemUpdate(itemToUpdate);
    } catch (error: any) {
      handleError(error, 'update item');
    }
  }

  function deleteItem(id: string) {
    const item = menuItems.find(i => i.id === id);
    setDeleteTarget({ type: 'item', id, name: item ? item.name : 'খাবার আইটেম' });
  }

  async function executeDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);

    if (deleteTarget.type === 'category') {
      try {
        // Detach any items from this category first to keep them safe and avoid FK restriction
        await supabase.from('menu_items').update({ category_id: null }).eq('category_id', deleteTarget.id);

        const { error } = await supabase.from('categories').delete().eq('id', deleteTarget.id);
        if (error) {
          handleError(error, 'delete category');
          setIsDeleting(false);
          return;
        }

        const updatedCats = categories.filter(c => c.id !== deleteTarget.id);
        updateCachedCategories(updatedCats);
        saveCategoryOrder(updatedCats.map(c => c.id));
        
        const updatedItems = menuItems.map(item => item.category_id === deleteTarget.id ? { ...item, category_id: '' } : item);
        updateCachedMenu(updatedItems);
        
        const deletedName = deleteTarget.name;
        setDeleteTarget(null);
        showToast(`'${deletedName}' ক্যাটাগরি সফলভাবে মুছে ফেলা হয়েছে`);
      } catch (error: any) {
        handleError(error, 'delete category');
      } finally {
        setIsDeleting(false);
      }
    } else if (deleteTarget.type === 'item') {
      try {
        const { error } = await supabase.from('menu_items').delete().eq('id', deleteTarget.id);
        if (error) {
          handleError(error, 'delete item');
          setIsDeleting(false);
          return;
        }

        const updated = menuItems.filter(i => i.id !== deleteTarget.id);
        updateCachedMenu(updated);
        saveItemOrder(updated.map(i => i.id));
        
        const deletedName = deleteTarget.name;
        setDeleteTarget(null);
        showToast(`'${deletedName}' খাবারটি সফলভাবে মুছে ফেলা হয়েছে`);
      } catch (error: any) {
        handleError(error, 'delete item');
      } finally {
        setIsDeleting(false);
      }
    }
  }

  async function toggleItemAvailability(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase.from('menu_items').update({ is_available: !currentStatus }).eq('id', id);
      if (error) {
        handleError(error, 'update item');
        return;
      }
      const updated = menuItems.map(i => i.id === id ? { ...i, is_available: !currentStatus } : i);
      updateCachedMenu(updated);
    } catch (error: any) {
      handleError(error, 'update item');
    }
  }

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col relative">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-stone-900 flex items-center gap-2">
            <span className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-base shadow-sm">
              <UtensilsCrossed size={20} />
            </span>
            মেনু ম্যানেজমেন্ট (Menusa Style)
          </h1>
          <p className="text-stone-500 mt-1 text-xs sm:text-sm">
            যেকোনো ক্যাটাগরির ভেতরে সরাসরি নতুন খাবার যোগ করুন ও সহজে মেনু সাজান।
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Live Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="খাবার খুঁজুন..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm outline-none focus:border-stone-900 shadow-2xs font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button 
            type="button"
            onClick={() => setIsAddingCategory(true)}
            className="px-4 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Plus size={16} className="text-amber-600" />
            <span>নতুন ক্যাটাগরি</span>
          </button>

          <button 
            type="button"
            onClick={() => openAddItemForCategory(foodCategoryFilter !== 'All' ? foodCategoryFilter : undefined)}
            className="bg-stone-900 hover:bg-black text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>নতুন খাবার যোগ</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-stone-200 mb-6 [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-6 px-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-xs sm:text-sm font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                activeTab === tab 
                  ? 'border-amber-500 text-stone-900' 
                  : 'border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-stone-500 flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="animate-spin text-amber-500" />
          <span className="text-xs font-bold text-stone-600">মেনু ডাটা লোড হচ্ছে...</span>
        </div>
      ) : activeTab === 'ক্যাটাগরি সাজান ও পরিচালনা' ? (
        /* CATEGORIES TAB WITH UP/DOWN REORDERING */
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 flex-1 p-4 sm:p-6 space-y-4">
          {/* Reordering Guide Header */}
          <div className="bg-stone-50 border border-stone-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                <Layers size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                  <span>মেনু ক্যাটাগরি আগে-পরে সাজানোর ব্যবস্থা</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-800">
                    মোট {categories.length} টি ক্যাটাগরি
                  </span>
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  নিচের <strong>▲ উপরে</strong> এবং <strong>▼ নিচে</strong> বাটনে ক্লিক করে ক্যাটাগরির ক্রম পরিবর্তন করুন। কাস্টমার মেনুতেও ঠিক এই ক্রমানুসারেই খাবার ও ক্যাটাগরি দেখানো হবে।
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingCategory(true)}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap cursor-pointer shrink-0"
            >
              <Plus size={15} />
              <span>নতুন ক্যাটাগরি</span>
            </button>
          </div>

          {/* Categories List */}
          <div className="space-y-2.5">
            {categories.map((cat, index) => {
              const { name, portions } = parseCategoryData(cat.name);
              const itemCount = menuItems.filter(item => item.category_id === cat.id).length;
              const isFirst = index === 0;
              const isLast = index === categories.length - 1;

              return (
                <div 
                  key={cat.id} 
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white hover:bg-stone-50/80 p-3 sm:p-4 rounded-2xl border border-stone-200 transition-all shadow-2xs group"
                >
                  {/* Left: Position Rank & Category Details */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Position Badge */}
                    <div 
                      className="w-8 h-8 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-xs font-black text-stone-700 shrink-0 shadow-2xs"
                      title={`ক্যাটাগরি অবস্থান #${index + 1}`}
                    >
                      #{index + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-stone-900 text-sm sm:text-base">{name}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                          {itemCount} টি খাবার
                        </span>
                      </div>
                      {portions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {portions.map(p => (
                            <span key={p} className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Reorder Up/Down + Edit + Delete Controls */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                    {/* Reorder Buttons */}
                    <div className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200 mr-1">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => moveCategory(index, 'up')}
                        className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-xs font-bold ${
                          isFirst 
                            ? 'text-stone-300 cursor-not-allowed' 
                            : 'text-stone-700 hover:text-stone-950 hover:bg-white active:scale-95 cursor-pointer shadow-2xs'
                        }`}
                        title="ক্যাটাগরিটি একধাপ উপরে নিন"
                      >
                        <ArrowUp size={15} />
                        <span className="text-[11px] pr-0.5">উপরে</span>
                      </button>

                      <div className="w-[1px] h-4 bg-stone-300 mx-0.5" />

                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => moveCategory(index, 'down')}
                        className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-xs font-bold ${
                          isLast 
                            ? 'text-stone-300 cursor-not-allowed' 
                            : 'text-stone-700 hover:text-stone-950 hover:bg-white active:scale-95 cursor-pointer shadow-2xs'
                        }`}
                        title="ক্যাটাগরিটি একধাপ নিচে নামান"
                      >
                        <ArrowDown size={15} />
                        <span className="text-[11px] pr-0.5">নিচে</span>
                      </button>
                    </div>

                    {/* Edit button */}
                    <button 
                      type="button"
                      onClick={() => startEditCategory(cat)} 
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      title="ক্যাটাগরি সম্পাদনা করুন"
                    >
                      <Edit2 size={13} />
                      <span>এডিট</span>
                    </button>

                    {/* Delete button */}
                    <button 
                      type="button"
                      onClick={() => {
                        const count = menuItems.filter(i => i.category_id === cat.id).length;
                        setDeleteTarget({ type: 'category', id: cat.id, name, itemCount: count });
                      }}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100 cursor-pointer"
                      title="ক্যাটাগরি মুছুন"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}

            {categories.length === 0 && (
              <div className="py-12 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                <Layers size={36} className="mx-auto mb-2 text-stone-300" />
                <p className="font-bold text-stone-600">কোনো ক্যাটাগরি তৈরি করা হয়নি</p>
                <p className="text-xs text-stone-400 mt-1">খাবারগুলো সাজাতে "নতুন ক্যাটাগরি" বাটনে ক্লিক করুন।</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* MENUSA CATEGORY-CENTRIC VIEW */
        <div className="flex-1 flex flex-col space-y-6">
          {/* Category Navigation Pills (Menusa Style) */}
          <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                ক্যাটাগরি নেভিগেশন (Category Switcher)
              </span>
              <span className="text-2xs text-stone-400 font-medium">
                নির্দিষ্ট ক্যাটাগরিতে ক্লিক করে ফোকাস করুন অথবা 'সকল খাবার' দেখুন
              </span>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setFoodCategoryFilter('All')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  foodCategoryFilter === 'All'
                    ? 'bg-stone-900 text-white shadow-xs font-black'
                    : 'bg-stone-100 border border-stone-200 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span>সকল ক্যাটাগরি</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  foodCategoryFilter === 'All' ? 'bg-stone-700 text-white' : 'bg-stone-200 text-stone-700'
                }`}>
                  {menuItems.length}
                </span>
              </button>

              {categories.map(cat => {
                const catName = parseCategoryData(cat.name).name;
                const count = menuItems.filter(i => i.category_id === cat.id).length;
                const isSelected = foodCategoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFoodCategoryFilter(cat.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? 'bg-amber-500 text-white shadow-xs font-black'
                        : 'bg-stone-100 border border-stone-200 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    <span>{catName}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-700'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsAddingCategory(true)}
                className="px-3 py-2 rounded-xl border border-dashed border-amber-400 bg-amber-50 hover:bg-amber-100/70 text-amber-800 text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Plus size={14} className="stroke-[3]" />
                <span>+ ক্যাটাগরি</span>
              </button>
            </div>
          </div>

          {/* Category Sections Container */}
          <div className="space-y-4">
            {categories.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1 pb-1">
                <span className="text-xs font-black text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={15} className="text-amber-600" />
                  <span>ক্যাটাগরি ভিত্তিক মেনু ({categories.length} টি ক্যাটাগরি)</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={expandAllCategories}
                    className="text-2xs font-extrabold text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 border border-stone-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    সবগুলো খুলুন (Expand All)
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllCategories}
                    className="text-2xs font-extrabold text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 border border-stone-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    সবগুলো বন্ধ করুন (Collapse All)
                  </button>
                </div>
              </div>
            )}

            {categories.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-stone-300 p-8 shadow-sm">
                <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-4">
                  <Layers size={32} />
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-1">আপনার মেনুতে এখনো কোনো ক্যাটাগরি নেই</h3>
                <p className="text-xs sm:text-sm text-stone-500 max-w-md mx-auto mb-5">
                  মেনুসা স্টাইলে সহজে খাবার যোগ করতে প্রথমে একটি ক্যাটাগরি (যেমন: বার্গার, পিজ্জা, বিরিয়ানি) তৈরি করুন।
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(true)}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all active:scale-95 inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={18} />
                  <span>প্রথম ক্যাটাগরি তৈরি করুন</span>
                </button>
              </div>
            ) : (
              categories
                .filter(cat => foodCategoryFilter === 'All' || cat.id === foodCategoryFilter)
                .map((cat, catIndex) => {
                  const { name: catName, portions } = parseCategoryData(cat.name);
                  const isExpanded = isCategoryExpanded(cat.id, catIndex);
                  
                  // Filter items inside this category
                  let catItems = menuItems.filter(item => item.category_id === cat.id);
                  if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    catItems = catItems.filter(item => 
                      item.name.toLowerCase().includes(q) || 
                      (item.description && item.description.toLowerCase().includes(q))
                    );
                  }

                  const isFirstCat = catIndex === 0;
                  const isLastCat = catIndex === categories.length - 1;

                  return (
                    <section 
                      key={cat.id} 
                      className={`bg-white rounded-3xl border transition-all duration-200 shadow-2xs overflow-hidden ${
                        isExpanded ? 'border-amber-200 ring-1 ring-amber-100 p-4 sm:p-6 space-y-4' : 'border-stone-200 hover:border-stone-300 p-3.5 sm:p-4'
                      }`}
                    >
                      {/* Clickable Category Header (Nested Accordion Trigger) */}
                      <div 
                        onClick={() => toggleCategoryExpanded(cat.id, catIndex)}
                        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer select-none group transition-colors ${
                          isExpanded ? 'pb-3.5 border-b border-stone-100' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Chevron Icon indicating Expand / Collapse state */}
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                            isExpanded 
                              ? 'bg-amber-500 text-white shadow-xs' 
                              : 'bg-stone-100 text-stone-600 group-hover:bg-amber-100 group-hover:text-amber-800'
                          }`}>
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-base sm:text-lg font-black text-stone-900 tracking-tight flex items-center gap-2">
                                <span>{catName}</span>
                              </h2>
                              <span className="text-2xs font-extrabold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                                {catItems.length} টি খাবার
                              </span>
                              {!isExpanded && (
                                <span className="text-[11px] text-amber-700 font-bold bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md">
                                  খাবার দেখতে ক্লিক করুন
                                </span>
                              )}
                            </div>
                            {portions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {portions.map(p => (
                                  <span key={p} className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.2 rounded text-[10px] font-bold">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Category Controls on Header (stops event bubbling to prevent accidental toggle) */}
                        <div 
                          className="flex items-center gap-1.5 w-full sm:w-auto justify-end"
                          onClick={e => e.stopPropagation()}
                        >
                          {/* Fast Add Button directly on Header */}
                          <button
                            type="button"
                            onClick={() => openAddItemForCategory(cat.id)}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer mr-1 shadow-2xs active:scale-95"
                            title="এই ক্যাটাগরিতে সরাসরি নতুন খাবার যোগ করুন"
                          >
                            <Plus size={14} className="stroke-[3] text-amber-600" />
                            <span>+ খাবার যোগ</span>
                          </button>

                          {/* Up / Down Reorder Category */}
                          <div className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200">
                            <button
                              type="button"
                              disabled={isFirstCat}
                              onClick={() => moveCategory(catIndex, 'up')}
                              className={`p-1.5 rounded-lg transition-all ${
                                isFirstCat 
                                  ? 'text-stone-300 cursor-not-allowed' 
                                  : 'text-stone-700 hover:text-stone-950 hover:bg-white cursor-pointer'
                              }`}
                              title="ক্যাটাগরি উপরে নিন"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={isLastCat}
                              onClick={() => moveCategory(catIndex, 'down')}
                              className={`p-1.5 rounded-lg transition-all ${
                                isLastCat 
                                  ? 'text-stone-300 cursor-not-allowed' 
                                  : 'text-stone-700 hover:text-stone-950 hover:bg-white cursor-pointer'
                              }`}
                              title="ক্যাটাগরি নিচে নামান"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>

                          {/* Edit Category */}
                          <button
                            type="button"
                            onClick={() => startEditCategory(cat)}
                            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-stone-200"
                            title="ক্যাটাগরি এডিট করুন"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Delete Category */}
                          <button
                            type="button"
                            onClick={() => {
                              const count = menuItems.filter(i => i.category_id === cat.id).length;
                              setDeleteTarget({ type: 'category', id: cat.id, name: catName, itemCount: count });
                            }}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                            title="ক্যাটাগরি মুছুন"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Nested Content (Visible when category is expanded) */}
                      {isExpanded && (
                        <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                          {/* ⚡ 'Add New Item' positioned directly under each category header */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 rounded-2xl shadow-2xs">
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                              <div>
                                <h4 className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                                  <span>"{catName}" ক্যাটাগরির খাবার তালিকা</span>
                                  <span className="text-2xs font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                    {catItems.length} টি খাবার
                                  </span>
                                </h4>
                                <p className="text-[11px] text-stone-500">
                                  এই ক্যাটাগরিতে সরাসরি নতুন আইটেম যুক্ত করতে ডানপাশের বাটনে ক্লিক করুন
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openAddItemForCategory(cat.id)}
                              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                            >
                              <Plus size={16} className="stroke-[3]" />
                              <span>নতুন খাবার যোগ করুন (Add New Item)</span>
                            </button>
                          </div>

                          {/* Food Items List inside this Category */}
                          {catItems.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                              {catItems.map((food, itemIndex) => {
                                const { description: cleanDesc, variants } = parseDescriptionData(food.description);
                                const hasVariants = variants && variants.length > 0;
                                const isFirstItem = itemIndex === 0;
                                const isLastItem = itemIndex === catItems.length - 1;

                                return (
                                  <div 
                                    key={food.id}
                                    className="bg-stone-50/70 hover:bg-white border border-stone-200 hover:border-stone-300 rounded-2xl p-3.5 flex flex-col justify-between transition-all shadow-2xs hover:shadow-md group relative"
                                  >
                                    <div className="space-y-2.5">
                                      {/* Top Row: Thumbnail + Name + Price */}
                                      <div className="flex items-start gap-3">
                                        <div className="w-16 h-16 rounded-xl bg-white border border-stone-200 overflow-hidden shrink-0 shadow-2xs relative">
                                          {food.image_url ? (
                                            <img 
                                              src={food.image_url} 
                                              alt={food.name} 
                                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                                            />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                                              <ImageIcon size={22} />
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-1.5">
                                            <h4 className="font-extrabold text-stone-900 text-sm truncate leading-snug">
                                              {food.name}
                                            </h4>
                                            <span className="font-black text-stone-900 text-sm shrink-0">
                                              ৳{food.price}
                                            </span>
                                          </div>

                                          {/* Highlight Tags (if any in description) */}
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {POPULAR_TAGS.filter(tag => (food.description || '').includes(tag)).map(tag => (
                                              <span key={tag} className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                                                {tag}
                                              </span>
                                            ))}
                                          </div>

                                          {/* Description Snippet */}
                                          {cleanDesc && (
                                            <p className="text-[11px] text-stone-500 line-clamp-1 mt-1">
                                              {cleanDesc}
                                            </p>
                                          )}

                                          {/* Matrix Portions Breakdown */}
                                          {hasVariants && (
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                              {variants.map((v: any) => (
                                                <span key={v.name} className="bg-white border border-stone-200 text-stone-700 px-1.5 py-0.2 rounded text-[10px] font-bold">
                                                  {v.name}: ৳{v.price}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Bottom Controls: Availability Switch + Up/Down + Edit + Delete */}
                                    <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-stone-200/80">
                                      {/* Availability Pill Toggle */}
                                      <button
                                        type="button"
                                        onClick={() => toggleItemAvailability(food.id, food.is_available)}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                                          food.is_available 
                                        ? 'bg-emerald-100/90 text-emerald-800 hover:bg-emerald-200' 
                                        : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                                        }`}
                                        title="ক্লিক করে স্টক স্ট্যাটাস পরিবর্তন করুন"
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${food.is_available ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                                        <span>{food.is_available ? 'উপলব্ধ' : 'স্টক আউট'}</span>
                                      </button>

                                      <div className="flex items-center gap-1">
                                        {/* Reorder Up/Down inside Category */}
                                        <div className="flex items-center bg-stone-200/70 p-0.5 rounded-lg border border-stone-300/80 mr-1">
                                          <button
                                            type="button"
                                            disabled={isFirstItem}
                                            onClick={() => moveItemInCategory(food, 'up', catItems)}
                                            className={`p-1 rounded-md transition-all ${
                                              isFirstItem 
                                                ? 'text-stone-300 cursor-not-allowed' 
                                                : 'text-stone-700 hover:text-stone-950 hover:bg-white cursor-pointer'
                                            }`}
                                            title="খাবার উপরে নিন"
                                          >
                                            <ArrowUp size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            disabled={isLastItem}
                                            onClick={() => moveItemInCategory(food, 'down', catItems)}
                                            className={`p-1 rounded-md transition-all ${
                                              isLastItem 
                                                ? 'text-stone-300 cursor-not-allowed' 
                                                : 'text-stone-700 hover:text-stone-950 hover:bg-white cursor-pointer'
                                            }`}
                                            title="খাবার নিচে নামান"
                                          >
                                            <ArrowDown size={12} />
                                          </button>
                                        </div>

                                        {/* Edit Button */}
                                        <button 
                                          type="button"
                                          onClick={() => startEditItem(food)} 
                                          className="px-2.5 py-1 bg-stone-900 hover:bg-black text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                                          title="খাবার সম্পাদনা করুন"
                                        >
                                          <Edit2 size={12} />
                                          <span>এডিট</span>
                                        </button>

                                        {/* Delete Button */}
                                        <button 
                                          type="button"
                                          onClick={() => deleteItem(food.id)} 
                                          className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                          title="খাবার মুছে ফেলুন"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="py-6 px-4 text-center bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
                              <p className="text-xs font-bold text-stone-500">এই ক্যাটাগরিতে এখনো কোনো খাবার যোগ করা হয়নি।</p>
                              <p className="text-2xs text-stone-400 mt-0.5">উপরের বা নিচের বাটনে চাপ দিয়ে সরাসরি এই ক্যাটাগরিতে খাবার যুক্ত করুন।</p>
                            </div>
                          )}

                          {/* Direct Add Food Button Under This Category */}
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => openAddItemForCategory(cat.id)}
                              className="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-100/70 text-amber-900 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs hover:shadow-xs group active:scale-[0.99]"
                            >
                              <span className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs group-hover:scale-110 transition-transform shadow-xs">
                                <Plus size={14} className="stroke-[3]" />
                              </span>
                              <span>"{catName}" ক্যাটাগরিতে নতুন খাবার যোগ করুন</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })
            )}

            {/* Uncategorized Items (if any exist) */}
            {(() => {
              const uncategorizedItems = menuItems.filter(
                i => !categories.some(c => c.id === i.category_id)
              );
              if (uncategorizedItems.length === 0) return null;

              return (
                <section className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-black">
                        ?
                      </span>
                      <h3 className="text-base font-black text-stone-900">অন্যান্য / অনির্ধারিত খাবার (Uncategorized)</h3>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                        {uncategorizedItems.length} টি
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {uncategorizedItems.map(food => (
                      <div 
                        key={food.id}
                        className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-white border border-stone-200 overflow-hidden shrink-0">
                            {food.image_url ? (
                              <img src={food.image_url} alt={food.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-300">
                                <ImageIcon size={18} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-stone-900 text-xs truncate">{food.name}</h4>
                            <span className="font-black text-stone-900 text-xs">৳{food.price}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditItem(food)}
                            className="px-2.5 py-1 bg-stone-900 text-white rounded-lg text-xs font-bold"
                          >
                            এডিট
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(food.id)}
                            className="p-1 text-stone-400 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}
          </div>
        </div>
      )}

      {/* Menusa Style Add Item Modal */}
      {isAddingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-stone-200 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-stone-100 bg-stone-50/80">
              <div>
                <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm shadow-xs font-bold">
                    <Plus size={18} />
                  </span>
                  নতুন খাবার যোগ করুন (Add Food Item)
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">সব তথ্য দিয়ে আপনার রেস্টুরেন্ট মেনু আকর্ষণীয় করে তুলুন</p>
              </div>
              <button 
                onClick={() => { setIsAddingItem(false); setItemFormError(null); }} 
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {itemFormError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-shake">
                  <AlertTriangle size={16} className="shrink-0 text-red-500" />
                  <span>{itemFormError}</span>
                </div>
              )}

              {/* 1. Hero Food Photo Upload Box (Menusa App Style) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                  খাবারের ছবি (Food Photo)
                </label>
                {newItem.image_url ? (
                  <div className="relative h-48 w-full rounded-2xl overflow-hidden border border-stone-200 bg-stone-900 group shadow-inner">
                    <img 
                      src={newItem.image_url} 
                      alt="Preview" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-between p-3.5">
                      <div className="flex gap-2">
                        <label className="px-3 py-1.5 bg-white/95 hover:bg-white text-stone-900 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95">
                          <Camera size={14} className="text-amber-600" />
                          <span>ছবি পরিবর্তন</span>
                          <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, false)} className="hidden" />
                        </label>
                        <button 
                          type="button"
                          onClick={() => {
                            setImageEditorFile(newItem.image_url || null);
                            setImageEditorTarget('new');
                            setZoom(1);
                            setRotation(0);
                            setBrightness(100);
                            setContrast(100);
                            setPanX(0);
                            setPanY(0);
                            setCardRatio('4:3');
                            setCardSizePreset('medium');
                            setQuality(75);
                            setEditorActiveTab('card');
                          }}
                          className="px-3 py-1.5 bg-stone-800/90 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                        >
                          <Crop size={14} className="text-amber-400" />
                          <span>কার্ড ক্রপ ও এডিট</span>
                        </button>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setNewItem({ ...newItem, image_url: '' })}
                        className="p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-xl shadow-md transition-all active:scale-95"
                        title="ছবি মুছে ফেলুন"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="relative h-40 w-full rounded-2xl border-2 border-dashed border-stone-300 hover:border-amber-500 bg-stone-50/70 hover:bg-amber-50/30 transition-all cursor-pointer flex flex-col items-center justify-center p-4 text-center group">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-stone-200 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform mb-2">
                      <Camera size={22} />
                    </div>
                    <span className="text-sm font-bold text-stone-800 group-hover:text-amber-700">খাবারের ছবি আপলোড করুন</span>
                    <span className="text-xs text-stone-500 mt-0.5">ট্যাপ করে ছবি তুলুন বা গ্যালারি থেকে সিলেক্ট করুন (Square/4:3 সাজেস্টেড)</span>
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, false)} className="hidden" />
                  </label>
                )}
              </div>

              {/* 2. Food Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  খাবারের নাম (Item Name) *
                </label>
                <input 
                  type="text" 
                  placeholder="যেমন: স্পেশাল চিকেন পিজ্জা, বিফ তেহারি, বা কাচ্চি বিরিয়ানি..."
                  className="w-full px-4 py-2.5 bg-stone-50/50 border border-stone-300 rounded-xl outline-none focus:border-stone-900 focus:bg-white text-sm font-medium text-stone-900 transition-all shadow-xs"
                  value={newItem.name} 
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                  autoFocus
                />
              </div>

              {/* 3. Category with Quick Add */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                    ক্যাটাগরি (Category) *
                  </label>
                  {!showQuickCatInput && (
                    <button 
                      type="button" 
                      onClick={() => setShowQuickCatInput(true)} 
                      className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 hover:underline"
                    >
                      <Plus size={13} />
                      নতুন ক্যাটাগরি তৈরি
                    </button>
                  )}
                </div>

                {showQuickCatInput && (
                  <div className="mb-2 p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
                    <input 
                      type="text"
                      placeholder="নতুন ক্যাটাগরির নাম লিখুন..."
                      className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs outline-none focus:border-amber-600 font-medium"
                      value={quickCatName}
                      onChange={e => setQuickCatName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createQuickCategory(false); } }}
                    />
                    <button 
                      type="button"
                      onClick={() => createQuickCategory(false)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                    >
                      যোগ করুন
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setShowQuickCatInput(false); setQuickCatName(''); }}
                      className="px-2 py-1.5 text-stone-500 hover:text-stone-800 text-xs font-medium"
                    >
                      বাতিল
                    </button>
                  </div>
                )}

                <select 
                  className="w-full px-4 py-2.5 border border-stone-300 rounded-xl bg-white outline-none focus:border-stone-900 text-sm font-semibold text-stone-800 shadow-xs"
                  value={newItem.category_id} 
                  onChange={e => setNewItem({...newItem, category_id: e.target.value})}
                >
                  <option value="" disabled>-- ক্যাটাগরি নির্বাচন করুন (আবশ্যক) --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{parseCategoryData(cat.name).name}</option>
                  ))}
                </select>
              </div>

              {/* 4. Pricing & Portions */}
              <div>
                {(() => {
                   const selectedCat = categories.find(c => c.id === newItem.category_id);
                   const catPortions = selectedCat ? parseCategoryData(selectedCat.name).portions : [];
                   
                   if (catPortions.length > 0) {
                     return (
                       <div className="border border-amber-200 rounded-2xl p-4 bg-amber-50/40">
                         <div className="flex items-center gap-1.5 mb-2.5">
                           <Layers size={15} className="text-amber-600" />
                           <label className="text-xs font-bold uppercase tracking-wider text-amber-900">
                             বিভিন্ন পোরশন অনুযায়ী মূল্য (৳) *
                           </label>
                         </div>
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                           {catPortions.map(portion => (
                             <div key={portion} className="bg-white p-2.5 rounded-xl border border-stone-200 shadow-2xs">
                               <label className="block text-xs font-bold text-stone-700 mb-1">{portion}</label>
                               <div className="relative">
                                 <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">৳</span>
                                 <input 
                                   type="number" 
                                   placeholder="0"
                                   className="w-full pl-6 pr-2.5 py-1.5 border border-stone-300 rounded-lg outline-none focus:border-stone-900 text-sm font-bold text-stone-900"
                                   value={newItem.portionPrices?.[portion] || ''} 
                                   onChange={e => setNewItem({
                                     ...newItem, 
                                     portionPrices: { ...(newItem.portionPrices || {}), [portion]: e.target.value }
                                   })}
                                 />
                                </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     );
                   }
                   
                   return (
                     <div>
                       <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                         মূল্য (Price ৳) *
                       </label>
                       <div className="relative">
                         <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">৳</span>
                         <input 
                           type="number" 
                           placeholder="যেমন: 250"
                           className="w-full pl-8 pr-4 py-2.5 bg-stone-50/50 border border-stone-300 rounded-xl outline-none focus:border-stone-900 focus:bg-white text-sm font-bold text-stone-900 shadow-xs"
                           value={newItem.price || ''} 
                           onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value) || 0})}
                         />
                       </div>
                     </div>
                   );
                })()}
              </div>

              {/* 5. Quick Highlight Tags (Menusa App Style) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2 flex items-center gap-1.5">
                  <Tag size={13} className="text-amber-600" />
                  খাবারের স্পেশাল হাইলাইট ট্যাগ (ক্লিক করে যোগ/বাদ দিন)
                </label>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_TAGS.map(tag => {
                    const isSelected = (newItem.description || '').includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTagInDescription(tag, false)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                          isSelected 
                            ? 'bg-amber-500 text-white shadow-xs border border-amber-600 scale-105' 
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                        }`}
                      >
                        <span>{tag}</span>
                        {isSelected && <Check size={12} className="stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6. Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  খাবারের বিবরণ ও উপকরণ (Description)
                </label>
                <textarea 
                  className="w-full px-4 py-2.5 bg-stone-50/50 border border-stone-300 rounded-xl outline-none focus:border-stone-900 focus:bg-white text-xs text-stone-800 leading-relaxed shadow-xs" 
                  rows={2}
                  placeholder="যেমন: সুস্বাদু তাজা মুরগির মাংস, মোজারেলা চিজ ও স্পেশাল মসলায় প্রস্তুত..."
                  value={newItem.description} 
                  onChange={e => setNewItem({...newItem, description: e.target.value})}
                />
              </div>

              {/* 7. Stock Availability Switch */}
              <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                <div>
                  <span className="text-xs font-bold text-stone-800 block">মেনুতে বিক্রির জন্য উপলব্ধ</span>
                  <span className="text-2xs text-stone-500">অন থাকলে গ্রাহকরা খাবারটি অর্ডার করতে পারবেন</span>
                </div>
                <button
                  type="button"
                  onClick={() => setNewItem({ ...newItem, is_available: !newItem.is_available })}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${newItem.is_available ? 'bg-emerald-500' : 'bg-stone-300'}`}
                >
                  <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${newItem.is_available ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* Modal Footer (Action Buttons) */}
            <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button 
                type="button"
                onClick={() => { setIsAddingItem(false); setItemFormError(null); }} 
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-700 font-bold text-xs hover:bg-stone-100 transition-colors"
              >
                বাতিল (Cancel)
              </button>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button 
                  type="button"
                  onClick={() => addItem(true)} 
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                  title="এই খাবার সেভ করে সরাসরি পরের খাবার যোগ করার ফর্ম খুলবে"
                >
                  <Zap size={15} />
                  <span>সেভ করে আরেকটি যোগ করুন</span>
                </button>
                <button 
                  type="button"
                  onClick={() => addItem(false)} 
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <Check size={16} />
                  <span>সেভ করুন</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menusa Style Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-stone-200 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-stone-100 bg-stone-50/80">
              <div>
                <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm shadow-xs font-bold">
                    <Edit2 size={16} />
                  </span>
                  খাবার এডিট করুন (Edit Food Item)
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">খাবারের তথ্য ও মূল্য আপডেট করুন</p>
              </div>
              <button 
                onClick={() => { setEditingItem(null); setItemFormError(null); }} 
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {itemFormError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-shake">
                  <AlertTriangle size={16} className="shrink-0 text-red-500" />
                  <span>{itemFormError}</span>
                </div>
              )}

              {/* 1. Hero Food Photo Upload Box */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                  খাবারের ছবি (Food Photo)
                </label>
                {editItemForm.image_url ? (
                  <div className="relative h-48 w-full rounded-2xl overflow-hidden border border-stone-200 bg-stone-900 group shadow-inner">
                    <img 
                      src={editItemForm.image_url} 
                      alt="Preview" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-between p-3.5">
                      <div className="flex gap-2">
                        <label className="px-3 py-1.5 bg-white/95 hover:bg-white text-stone-900 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95">
                          <Camera size={14} className="text-amber-600" />
                          <span>ছবি পরিবর্তন</span>
                          <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, true)} className="hidden" />
                        </label>
                        <button 
                          type="button"
                          onClick={() => {
                            setImageEditorFile(editItemForm.image_url || null);
                            setImageEditorTarget('edit');
                            setZoom(1);
                            setRotation(0);
                            setBrightness(100);
                            setContrast(100);
                            setPanX(0);
                            setPanY(0);
                            setCardRatio('4:3');
                            setCardSizePreset('medium');
                            setQuality(75);
                            setEditorActiveTab('card');
                          }}
                          className="px-3 py-1.5 bg-stone-800/90 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                        >
                          <Crop size={14} className="text-amber-400" />
                          <span>কার্ড ক্রপ ও এডিট</span>
                        </button>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setEditItemForm({ ...editItemForm, image_url: '' })}
                        className="p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-xl shadow-md transition-all active:scale-95"
                        title="ছবি মুছে ফেলুন"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="relative h-40 w-full rounded-2xl border-2 border-dashed border-stone-300 hover:border-blue-500 bg-stone-50/70 hover:bg-blue-50/30 transition-all cursor-pointer flex flex-col items-center justify-center p-4 text-center group">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-stone-200 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform mb-2">
                      <Camera size={22} />
                    </div>
                    <span className="text-sm font-bold text-stone-800 group-hover:text-blue-700">খাবারের ছবি আপলোড করুন</span>
                    <span className="text-xs text-stone-500 mt-0.5">ট্যাপ করে ছবি তুলুন বা গ্যালারি থেকে সিলেক্ট করুন</span>
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, true)} className="hidden" />
                  </label>
                )}
              </div>

              {/* 2. Food Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  খাবারের নাম (Item Name) *
                </label>
                <input 
                  type="text" 
                  placeholder="যেমন: স্পেশাল চিকেন পিজ্জা..."
                  className="w-full px-4 py-2.5 bg-stone-50/50 border border-stone-300 rounded-xl outline-none focus:border-stone-900 focus:bg-white text-sm font-medium text-stone-900 transition-all shadow-xs"
                  value={editItemForm.name || ''} 
                  onChange={e => setEditItemForm({...editItemForm, name: e.target.value})}
                />
              </div>

              {/* 3. Category */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  ক্যাটাগরি (Category) *
                </label>
                <select 
                  className="w-full px-4 py-2.5 border border-stone-300 rounded-xl bg-white outline-none focus:border-stone-900 text-sm font-semibold text-stone-800 shadow-xs"
                  value={editItemForm.category_id || ''} 
                  onChange={e => setEditItemForm({...editItemForm, category_id: e.target.value})}
                >
                  <option value="" disabled>-- ক্যাটাগরি নির্বাচন করুন --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{parseCategoryData(cat.name).name}</option>
                  ))}
                </select>
              </div>

              {/* 4. Pricing & Portions */}
              <div>
                {(() => {
                   const selectedCat = categories.find(c => c.id === editItemForm.category_id);
                   const catPortions = selectedCat ? parseCategoryData(selectedCat.name).portions : [];
                   
                   if (catPortions.length > 0) {
                     return (
                       <div className="border border-blue-200 rounded-2xl p-4 bg-blue-50/30">
                         <div className="flex items-center gap-1.5 mb-2.5">
                           <Layers size={15} className="text-blue-600" />
                           <label className="text-xs font-bold uppercase tracking-wider text-blue-900">
                             বিভিন্ন পোরশন অনুযায়ী মূল্য (৳) *
                           </label>
                         </div>
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                           {catPortions.map(portion => (
                             <div key={portion} className="bg-white p-2.5 rounded-xl border border-stone-200 shadow-2xs">
                               <label className="block text-xs font-bold text-stone-700 mb-1">{portion}</label>
                               <div className="relative">
                                 <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">৳</span>
                                 <input 
                                   type="number" 
                                   placeholder="0"
                                   className="w-full pl-6 pr-2.5 py-1.5 border border-stone-300 rounded-lg outline-none focus:border-stone-900 text-sm font-bold text-stone-900"
                                   value={editItemForm.portionPrices?.[portion] || ''} 
                                   onChange={e => setEditItemForm({
                                     ...editItemForm, 
                                     portionPrices: { ...(editItemForm.portionPrices || {}), [portion]: e.target.value }
                                   })}
                                 />
                                </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     );
                   }
                   
                   return (
                     <div>
                       <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                         মূল্য (Price ৳) *
                       </label>
                       <div className="relative">
                         <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">৳</span>
                         <input 
                           type="number" 
                           placeholder="যেমন: 250"
                           className="w-full pl-8 pr-4 py-2.5 bg-stone-50/50 border border-stone-300 rounded-xl outline-none focus:border-stone-900 focus:bg-white text-sm font-bold text-stone-900 shadow-xs"
                           value={editItemForm.price || ''} 
                           onChange={e => setEditItemForm({...editItemForm, price: parseFloat(e.target.value) || 0})}
                         />
                       </div>
                     </div>
                   );
                })()}
              </div>

              {/* 5. Quick Highlight Tags */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2 flex items-center gap-1.5">
                  <Tag size={13} className="text-blue-600" />
                  খাবারের স্পেশাল হাইলাইট ট্যাগ (ক্লিক করে যোগ/বাদ দিন)
                </label>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_TAGS.map(tag => {
                    const isSelected = (editItemForm.description || '').includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTagInDescription(tag, true)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                          isSelected 
                            ? 'bg-blue-600 text-white shadow-xs border border-blue-700 scale-105' 
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                        }`}
                      >
                        <span>{tag}</span>
                        {isSelected && <Check size={12} className="stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6. Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                  খাবারের বিবরণ ও উপকরণ (Description)
                </label>
                <textarea 
                  className="w-full px-4 py-2.5 bg-stone-50/50 border border-stone-300 rounded-xl outline-none focus:border-stone-900 focus:bg-white text-xs text-stone-800 leading-relaxed shadow-xs" 
                  rows={2}
                  value={editItemForm.description || ''} 
                  onChange={e => setEditItemForm({...editItemForm, description: e.target.value})}
                />
              </div>

              {/* 7. Stock Availability Switch */}
              <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                <div>
                  <span className="text-xs font-bold text-stone-800 block">মেনুতে বিক্রির জন্য উপলব্ধ</span>
                  <span className="text-2xs text-stone-500">অন থাকলে গ্রাহকরা খাবারটি দেখতে ও অর্ডার করতে পারবেন</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditItemForm({ ...editItemForm, is_available: !editItemForm.is_available })}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${editItemForm.is_available ? 'bg-emerald-500' : 'bg-stone-300'}`}
                >
                  <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${editItemForm.is_available ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
              <button 
                type="button"
                onClick={() => { setEditingItem(null); setItemFormError(null); }} 
                className="px-5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-700 font-bold text-xs hover:bg-stone-100 transition-colors"
              >
                বাতিল (Cancel)
              </button>
              <button 
                type="button"
                onClick={updateItem} 
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              >
                <Check size={16} />
                <span>আপডেট করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {isAddingCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">New Category</h2>
              <button onClick={() => setIsAddingCategory(false)} className="text-gray-400 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Chowmein, Pizza" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                />
              </div>
              
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <label className="block text-sm font-bold text-gray-900 mb-1">Portion Pricing (Optional)</label>
                <p className="text-xs text-gray-500 mb-3">If you add portions here (e.g. 1 person, 3 person), all items added to this category will automatically ask for prices for these portions.</p>
                
                <div className="flex gap-2 mb-3">
                  <input 
                    type="text" 
                    placeholder="e.g. 1 person" 
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                    value={newPortionInput}
                    onChange={e => setNewPortionInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newPortionInput.trim()) {
                        e.preventDefault();
                        if (!categoryPortions.includes(newPortionInput.trim())) {
                          setCategoryPortions([...categoryPortions, newPortionInput.trim()]);
                        }
                        setNewPortionInput('');
                      }
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (newPortionInput.trim() && !categoryPortions.includes(newPortionInput.trim())) {
                        setCategoryPortions([...categoryPortions, newPortionInput.trim()]);
                        setNewPortionInput('');
                      }
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                  >
                    Add
                  </button>
                </div>
                
                {categoryPortions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {categoryPortions.map(p => (
                      <span key={p} className="inline-flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1 rounded-md text-xs font-medium text-gray-700 shadow-sm">
                        {p}
                        <button 
                          onClick={() => setCategoryPortions(categoryPortions.filter(x => x !== p))}
                          className="text-gray-400 hover:text-red-500 ml-1"
                        ><X size={12}/></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button onClick={() => setIsAddingCategory(false)} className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={addCategory} className="px-4 py-2 rounded-lg bg-gray-900 text-white font-medium flex items-center gap-2 hover:bg-gray-800">
                <Check size={18} /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Edit Category</h2>
              <button onClick={() => setEditingCategory(null)} className="text-gray-400 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Chowmein, Pizza" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                  value={editCategoryName}
                  onChange={e => setEditCategoryName(e.target.value)}
                />
              </div>
              
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <label className="block text-sm font-bold text-gray-900 mb-1">Portion Pricing (Optional)</label>
                <p className="text-xs text-gray-500 mb-3">If you add portions here (e.g. 1 person, 3 person), all items added to this category will automatically ask for prices for these portions.</p>
                
                <div className="flex gap-2 mb-3">
                  <input 
                    type="text" 
                    placeholder="e.g. 1 person" 
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                    value={editPortionInput}
                    onChange={e => setEditPortionInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && editPortionInput.trim()) {
                        e.preventDefault();
                        if (!editCategoryPortions.includes(editPortionInput.trim())) {
                          setEditCategoryPortions([...editCategoryPortions, editPortionInput.trim()]);
                        }
                        setEditPortionInput('');
                      }
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (editPortionInput.trim() && !editCategoryPortions.includes(editPortionInput.trim())) {
                        setEditCategoryPortions([...editCategoryPortions, editPortionInput.trim()]);
                        setEditPortionInput('');
                      }
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                  >
                    Add
                  </button>
                </div>
                
                {editCategoryPortions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editCategoryPortions.map(p => (
                      <span key={p} className="inline-flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1 rounded-md text-xs font-medium text-gray-700 shadow-sm">
                        {p}
                        <button 
                          onClick={() => setEditCategoryPortions(editCategoryPortions.filter(x => x !== p))}
                          className="text-gray-400 hover:text-red-500 ml-1"
                        ><X size={12}/></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button onClick={() => setEditingCategory(null)} className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={updateCategory} className="px-4 py-2 rounded-lg bg-gray-900 text-white font-medium flex items-center gap-2 hover:bg-gray-800">
                <Check size={18} /> Update
              </button>
            </div>
          </div>
        </div>
      )}
      {/* RLS Error Modal */}
      {rlsError && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="bg-red-50 p-6 border-b border-red-100 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
                <X size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-900">Database Security Error (RLS)</h2>
                <p className="text-red-700 mt-1 text-sm">
                  Supabase is blocking the action because Row-Level Security (RLS) is enabled and we are not using user authentication in this preview.
                </p>
              </div>
            </div>
            <div className="p-6">
              <h3 className="font-bold text-gray-900 mb-2">How to fix this:</h3>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-3 mb-6">
                <li>Go to your <a href="https://supabase.com/dashboard/project/_/sql" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">Supabase SQL Editor</a>.</li>
                <li>Click <strong>+ New Query</strong>.</li>
                <li>Copy the SQL code below and paste it into the editor.</li>
                <li>Click the green <strong>Run</strong> button.</li>
              </ol>
              
              <div className="bg-gray-900 rounded-lg p-4 relative group">
                <pre className="text-sm text-green-400 font-mono overflow-x-auto">
{`-- Disable RLS for all tables to allow public access
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;`}
                </pre>
              </div>
              <p className="text-xs text-gray-500 mt-4 italic">
                * Note: Disabling RLS allows anyone to read/write data. This is fine for development, but for a real production app, you would create explicit RLS Policies instead.
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50">
              <button 
                onClick={() => setRlsError(false)} 
                className="px-6 py-2.5 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors"
              >
                I understand, close this
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
          onClick={() => {
            if (!isDeleting) setDeleteTarget(null);
          }}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center mx-auto mb-4 shadow-xs">
                <Trash2 size={26} />
              </div>

              <h3 className="text-xl font-extrabold text-gray-900 mb-2">
                {deleteTarget.type === 'category' ? 'ক্যাটাগরি ডিলিট করবেন?' : 'খাবারটি ডিলিট করবেন?'}
              </h3>

              <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 my-3 text-left">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  {deleteTarget.type === 'category' ? 'ক্যাটাগরির নাম' : 'আইটেমের নাম'}
                </span>
                <span className="font-extrabold text-gray-900 text-base block">
                  {deleteTarget.name}
                </span>
                {deleteTarget.type === 'category' && (
                  <div className="mt-2 pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs">
                    <span className="text-gray-500">সংযুক্ত খাবারের সংখ্যা:</span>
                    <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {deleteTarget.itemCount || 0} টি খাবার
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                {deleteTarget.type === 'category'
                  ? 'এই ক্যাটাগরিটি মুছে ফেলা হবে। সংযুক্ত খাবারগুলো ডিলিট হবে না, তবে সেগুলোর ক্যাটাগরি আনক্যাটাগোরাইজড (Uncategorized) হয়ে যাবে।'
                  : 'আপনি কি নিশ্চিতভাবে এই মেনু আইটেমটি মেনু তালিকা থেকে স্থায়ীভাবে মুছে ফেলতে চান?'}
              </p>
            </div>

            <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeDelete}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>মুছে ফেলা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>হ্যাঁ, ডিলিট করুন (Delete)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP CARD IMAGE STUDIO & RESIZE OPTIMIZER MODAL */}
      {imageEditorFile && (() => {
        const { w: previewW, h: previewH } = getPreviewDimensions(cardRatio);
        const boxRatio = previewW / previewH;
        const naturalRatio = (imgNaturalSize.width || 400) / (imgNaturalSize.height || 300);
        let baseW = previewW;
        let baseH = previewH;
        if (naturalRatio > boxRatio) {
          baseH = previewH;
          baseW = previewH * naturalRatio;
        } else {
          baseW = previewW;
          baseH = previewW / naturalRatio;
        }
        const currentDimensions = getTargetDimensions(cardRatio, cardSizePreset);

        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-stone-200 flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-stone-100 bg-stone-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center">
                    <Crop size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-stone-900">কার্ড ছবি এডিটর ও সাইজ অপটিমাইজার</h2>
                    <p className="text-xs text-stone-500 font-medium">মেনু কার্ড অনুপাতে ক্রপ করুন এবং দ্রুত লোডিংয়ের জন্য ছোট সাইজে সেভ করুন</p>
                  </div>
                </div>
                <button 
                  onClick={() => setImageEditorFile(null)} 
                  className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mode Tabs */}
              <div className="flex items-center border-b border-stone-100 px-6 bg-stone-50/40 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setEditorActiveTab('card')}
                  className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
                    editorActiveTab === 'card'
                      ? 'border-amber-500 text-stone-900 font-black'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Crop size={14} className={editorActiveTab === 'card' ? 'text-amber-500' : ''} />
                  <span>১. কার্ড রেশিও ({cardRatio})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditorActiveTab('size')}
                  className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
                    editorActiveTab === 'size'
                      ? 'border-amber-500 text-stone-900 font-black'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <HardDrive size={14} className={editorActiveTab === 'size' ? 'text-emerald-500' : ''} />
                  <span>২. ছোট সেভ সাইজ (~{estimatedSizeKB} KB)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditorActiveTab('tune')}
                  className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
                    editorActiveTab === 'tune'
                      ? 'border-amber-500 text-stone-900 font-black'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Sun size={14} className={editorActiveTab === 'tune' ? 'text-amber-500' : ''} />
                  <span>৩. আলো ও রঙ</span>
                </button>
              </div>

              {/* Editor Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 flex flex-col items-center custom-scrollbar">
                {/* Visual Card Stage */}
                <div className="w-full flex flex-col items-center justify-center py-2 bg-stone-100/60 rounded-2xl border border-stone-200/80">
                  <div 
                    className="rounded-2xl border-2 border-stone-300 bg-white relative overflow-hidden select-none cursor-grab active:cursor-grabbing shadow-lg shrink-0 transition-all duration-200"
                    style={{ width: `${previewW}px`, height: `${previewH}px` }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleMouseUp}
                  >
                    {/* Checkerboard Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,#999_25%,transparent_25%),linear-gradient(-45deg,#999_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#999_75%),linear-gradient(-45deg,transparent_75%,#999_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]" />
                    
                    {/* Visual Guidelines (Rule of Thirds) */}
                    <div className="absolute inset-0 pointer-events-none border border-black/10 z-10">
                      <div className="absolute left-1/3 top-0 bottom-0 border-l border-dashed border-black/15" />
                      <div className="absolute left-2/3 top-0 bottom-0 border-l border-dashed border-black/15" />
                      <div className="absolute top-1/3 left-0 right-0 border-t border-dashed border-black/15" />
                      <div className="absolute top-2/3 left-0 right-0 border-t border-dashed border-black/15" />
                    </div>

                    {/* The Editable Image */}
                    <img 
                      src={imageEditorFile} 
                      alt="Editor Source" 
                      onLoad={(e) => {
                        const target = e.currentTarget;
                        if (target.naturalWidth && target.naturalHeight) {
                          setImgNaturalSize({ width: target.naturalWidth, height: target.naturalHeight });
                        }
                      }}
                      className="absolute origin-center pointer-events-none select-none transition-transform duration-75"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: `${baseW}px`,
                        height: `${baseH}px`,
                        maxWidth: 'none',
                        transform: `translate(-50%, -50%) translate(${panX}px, ${panY}px) rotate(${rotation}deg) scale(${zoom})`,
                        filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                      }}
                    />

                    {/* Floating Info Badges on Preview */}
                    <div className="absolute top-2 left-2 z-20 pointer-events-none">
                      <span className="bg-stone-900/85 backdrop-blur-xs text-white text-[10px] font-black px-2 py-0.5 rounded-md border border-white/10 shadow-xs flex items-center gap-1">
                        <Crop size={10} className="text-amber-400" />
                        {cardRatio} কার্ড • {currentDimensions.width}×{currentDimensions.height}px
                      </span>
                    </div>

                    <div className="absolute top-2 right-2 z-20 pointer-events-none">
                      <span className="bg-emerald-700/90 backdrop-blur-xs text-white text-[10px] font-black px-2 py-0.5 rounded-md border border-white/10 shadow-xs flex items-center gap-1">
                        <HardDrive size={10} />
                        ~{estimatedSizeKB} KB
                      </span>
                    </div>

                    {/* Bottom Drag Hint */}
                    <div className="absolute bottom-1.5 inset-x-0 flex justify-center z-20 pointer-events-none">
                      <span className="bg-stone-900/60 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        মাউস বা আঙুল দিয়ে টেনে সেন্টারিং করুন
                      </span>
                    </div>
                  </div>

                  {/* Fast Manipulation Toolbar below card */}
                  <div className="flex items-center justify-center gap-2 mt-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setZoom(z => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}
                      className="p-1.5 bg-white border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 shadow-2xs"
                      title="জুম আউট"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <input 
                      type="range" min="0.6" max="2.5" step="0.05"
                      value={zoom} onChange={e => setZoom(parseFloat(e.target.value))}
                      className="w-28 sm:w-36 accent-stone-900 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                      title={`জুম: ${Math.round(zoom * 100)}%`}
                    />
                    <button
                      type="button"
                      onClick={() => setZoom(z => Math.min(2.5, Math.round((z + 0.1) * 10) / 10))}
                      className="p-1.5 bg-white border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 shadow-2xs"
                      title="জুম ইন"
                    >
                      <ZoomIn size={14} />
                    </button>

                    <div className="h-4 w-px bg-stone-300 mx-1" />

                    <button
                      type="button"
                      onClick={() => setRotation(r => (r - 90) % 360)}
                      className="p-1.5 bg-white border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 shadow-2xs"
                      title="বামাবর্তে ৯০° ঘোরান"
                    >
                      <RotateCw size={14} className="scale-x-[-1]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotation(r => (r + 90) % 360)}
                      className="p-1.5 bg-white border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 shadow-2xs"
                      title="ডানাবর্তে ৯০° ঘোরান"
                    >
                      <RotateCw size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => { setPanX(0); setPanY(0); setZoom(1); setRotation(0); }}
                      className="px-2 py-1 bg-white border border-stone-300 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-50 text-[11px] font-bold shadow-2xs flex items-center gap-1"
                      title="রিসেট করুন"
                    >
                      <RefreshCw size={11} />
                      ফিট
                    </button>
                  </div>
                </div>

                {/* TAB 1: CARD RATIO OPTIONS */}
                {editorActiveTab === 'card' && (
                  <div className="w-full space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-stone-800 uppercase tracking-wider">
                        মেনু কার্ড রেশিও নির্বাচন করুন:
                      </span>
                      <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        সুপারিশ: ৪:৩ কার্ড
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* 4:3 Ratio */}
                      <button
                        type="button"
                        onClick={() => { setCardRatio('4:3'); setPanX(0); setPanY(0); }}
                        className={`p-3 rounded-2xl border text-left transition-all relative ${
                          cardRatio === '4:3'
                            ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20 shadow-xs'
                            : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-7 h-5 rounded bg-amber-500 text-white flex items-center justify-center font-black text-[10px] shadow-2xs">
                            4:3
                          </div>
                          <span className="font-extrabold text-xs text-stone-900">ফুড কার্ড (৪:৩)</span>
                        </div>
                        <p className="text-[10px] text-stone-500 leading-tight">
                          মেনু কার্ডের জন্য সবচেয়ে পারফেক্ট ও আকর্ষণীয় স্ট্যান্ডার্ড সাইজ।
                        </p>
                      </button>

                      {/* 16:9 Ratio */}
                      <button
                        type="button"
                        onClick={() => { setCardRatio('16:9'); setPanX(0); setPanY(0); }}
                        className={`p-3 rounded-2xl border text-left transition-all relative ${
                          cardRatio === '16:9'
                            ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20 shadow-xs'
                            : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-8 h-4.5 rounded bg-stone-800 text-white flex items-center justify-center font-black text-[9px] shadow-2xs">
                            16:9
                          </div>
                          <span className="font-extrabold text-xs text-stone-900">ওয়াইড কার্ড (১৬:৯)</span>
                        </div>
                        <p className="text-[10px] text-stone-500 leading-tight">
                          বড় ব্যানার ডিসপ্লে বা ল্যান্ডস্কেপ রেস্তোরাঁ ফটোর জন্য সেরা।
                        </p>
                      </button>

                      {/* 1:1 Ratio */}
                      <button
                        type="button"
                        onClick={() => { setCardRatio('1:1'); setPanX(0); setPanY(0); }}
                        className={`p-3 rounded-2xl border text-left transition-all relative ${
                          cardRatio === '1:1'
                            ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20 shadow-xs'
                            : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-5 h-5 rounded bg-stone-800 text-white flex items-center justify-center font-black text-[10px] shadow-2xs">
                            1:1
                          </div>
                          <span className="font-extrabold text-xs text-stone-900">স্কয়ার কার্ড (১:১)</span>
                        </div>
                        <p className="text-[10px] text-stone-500 leading-tight">
                          ইনস্টাগ্রাম স্টাইল সমানুপাতিক বর্গাকার থাম্বনেইল গ্রিড।
                        </p>
                      </button>

                      {/* 3:2 Ratio */}
                      <button
                        type="button"
                        onClick={() => { setCardRatio('3:2'); setPanX(0); setPanY(0); }}
                        className={`p-3 rounded-2xl border text-left transition-all relative ${
                          cardRatio === '3:2'
                            ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20 shadow-xs'
                            : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-7 h-4.5 rounded bg-stone-800 text-white flex items-center justify-center font-black text-[10px] shadow-2xs">
                            3:2
                          </div>
                          <span className="font-extrabold text-xs text-stone-900">ক্লাসিক কার্ড (৩:২)</span>
                        </div>
                        <p className="text-[10px] text-stone-500 leading-tight">
                          ফটোজেনিক ফুড পোর্টফোলিও ও ডিশ হাইলাইট ভিউ।
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: SAVE SIZE & OPTIMIZATION OPTIONS */}
                {editorActiveTab === 'size' && (
                  <div className="w-full space-y-3.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-stone-800 uppercase tracking-wider">
                        ছোট আকারে সেভ করার অপশন (ফাইল সাইজ ও গতি):
                      </span>
                      <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <Zap size={11} className="text-emerald-600" />
                        দ্রুত লোডিং অপ্টিমাইজড
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Super Light */}
                      <button
                        type="button"
                        onClick={() => { setCardSizePreset('small'); setQuality(68); }}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          cardSizePreset === 'small'
                            ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-stone-900">⚡ সুপার লাইট</span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                            ~২৫-৪৫ KB
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-500">রেজোলিউশন: ৩৬০px</div>
                        <p className="text-[10px] text-stone-600 mt-1 leading-tight">
                          খুব দ্রুত খোলে, দুর্বল ৩জি নেটওয়ার্কেও চোখের পলকে মেনু লোড হবে।
                        </p>
                      </button>

                      {/* Standard Medium (Recommended) */}
                      <button
                        type="button"
                        onClick={() => { setCardSizePreset('medium'); setQuality(75); }}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          cardSizePreset === 'medium'
                            ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20 shadow-xs'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-stone-900">⭐ স্ট্যান্ডার্ড</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
                            ~৫০-৮০ KB
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-500">রেজোলিউশন: ৪৮০px</div>
                        <p className="text-[10px] text-stone-600 mt-1 leading-tight font-medium">
                          সেরা ব্যালেন্স: ক্রিস্প কোয়ালিটি এবং দ্রুত লোডিং নিশ্চিত করে।
                        </p>
                      </button>

                      {/* HD */}
                      <button
                        type="button"
                        onClick={() => { setCardSizePreset('hd'); setQuality(84); }}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          cardSizePreset === 'hd'
                            ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-stone-900">💎 এইচডি কার্ড</span>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded">
                            ~১১০-১৬০ KB
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-500">রেজোলিউশন: ৬৪০px</div>
                        <p className="text-[10px] text-stone-600 mt-1 leading-tight">
                          বড় ট্যাবলেট বা মনিটরের জন্য সুপার স্পষ্ট ও নিখুঁত পিকচার।
                        </p>
                      </button>
                    </div>

                    {/* Fine-tune Quality Slider */}
                    <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3">
                      <div className="flex justify-between items-center text-xs font-bold text-stone-700 mb-1.5">
                        <span className="flex items-center gap-1.5">
                          <HardDrive size={13} className="text-stone-500" />
                          কম্প্রেশন কোয়ালিটি (Image Quality & Compression)
                        </span>
                        <span className="text-stone-900 bg-white px-2 py-0.5 rounded-md border border-stone-200 shadow-2xs font-black">
                          {quality}%
                        </span>
                      </div>
                      <input 
                        type="range" min="50" max="92" step="2"
                        value={quality} onChange={e => setQuality(parseInt(e.target.value))}
                        className="w-full accent-amber-600 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                        <span>৫০% (ক্ষুদ্র সাইজ)</span>
                        <span>৭৫% (সাজেস্টেড ব্যালেন্স)</span>
                        <span>৯২% (হাই ডেফিনিশন)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: BRIGHTNESS & CONTRAST */}
                {editorActiveTab === 'tune' && (
                  <div className="w-full space-y-3.5 animate-in fade-in duration-150">
                    <span className="text-xs font-black text-stone-800 uppercase tracking-wider block">
                      খাবারের ছবির উজ্জ্বলতা ও কালার অ্যাডজাস্টমেন্ট:
                    </span>

                    <div className="space-y-3 bg-stone-50 border border-stone-200/80 rounded-2xl p-3.5">
                      {/* Brightness */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-bold text-stone-700">
                          <span className="flex items-center gap-1.5">
                            <Sun size={14} className="text-amber-500" /> উজ্জ্বলতা (Brightness)
                          </span>
                          <span className="text-stone-900 bg-white border border-stone-200 px-2 py-0.5 rounded-md text-[11px] font-black">
                            {brightness}%
                          </span>
                        </div>
                        <input 
                          type="range" min="60" max="150" step="1"
                          value={brightness} onChange={e => setBrightness(parseInt(e.target.value))}
                          className="w-full accent-stone-900 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Contrast */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-bold text-stone-700">
                          <span className="flex items-center gap-1.5">
                            <Sliders size={14} className="text-stone-600" /> কন্ট্রাস্ট (Contrast)
                          </span>
                          <span className="text-stone-900 bg-white border border-stone-200 px-2 py-0.5 rounded-md text-[11px] font-black">
                            {contrast}%
                          </span>
                        </div>
                        <input 
                          type="range" min="70" max="150" step="1"
                          value={contrast} onChange={e => setContrast(parseInt(e.target.value))}
                          className="w-full accent-stone-900 h-1.5 bg-stone-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => { setBrightness(100); setContrast(100); }}
                          className="text-[11px] font-bold text-stone-500 hover:text-stone-800 flex items-center gap-1"
                        >
                          <RefreshCw size={11} /> অরিজিনাল কালারে রিসেট
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 sm:px-6 sm:py-3.5 border-t border-stone-100 flex items-center justify-between gap-3 bg-stone-50 shrink-0">
                <div className="flex items-center gap-2">
                  <label className="px-3 py-2 rounded-xl bg-white border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-100 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95">
                    <Camera size={14} className="text-amber-600" />
                    <span className="hidden sm:inline">অন্য ছবি বেছে নিন</span>
                    <span className="sm:hidden">ছবি বদলান</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleImageUpload(e, imageEditorTarget === 'edit')} 
                      className="hidden" 
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2.5">
                  <button 
                    type="button"
                    onClick={() => setImageEditorFile(null)}
                    className="px-4 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-100 transition-colors cursor-pointer active:scale-95"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="button"
                    onClick={applyImageEdit}
                    className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Check size={15} className="text-amber-400" />
                    <span>কার্ড হিসেবে সেভ করুন (~{estimatedSizeKB} KB)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* IN-APP TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200 pointer-events-none">
          <div className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-sm font-bold ${
            toastMessage.type === 'error'
              ? 'bg-red-600 text-white border-red-500 shadow-red-500/20'
              : 'bg-gray-900 text-white border-gray-800 shadow-black/20'
          }`}>
            {toastMessage.type === 'error' ? (
              <AlertTriangle size={18} className="text-white shrink-0" />
            ) : (
              <CheckCircle size={18} className="text-emerald-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
