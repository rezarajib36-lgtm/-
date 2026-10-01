import { RestaurantSettings, getRestaurantSettings } from '../lib/restaurantSettings';
import { INITIAL_MENU_ITEMS } from '../data/initialMenuData';
import { toStandardDigits, parseDescriptionData } from '../utils';

export interface PrinterSettings {
  paperWidth: '58mm' | '80mm';
  restaurantName: string;
  branchName?: string;
  address: string;
  phone: string;
  footerGreeting: string;
  showVat: boolean;
  vatPercent: number;
  vatNumber?: string;
  printKitchenCopy: boolean;
}

const STORAGE_KEY = 'thermal_printer_settings';

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  paperWidth: '58mm', // Standard mobile bluetooth thermal printer
  restaurantName: 'ইলিশের বাড়ি রেস্টুরেন্ট',
  branchName: 'শ্রীরায়েরচর বাজার শাখা',
  address: 'ব্রিজ সংলগ্ন, গালিমখা, মতলব উত্তর, চাঁদপুর',
  phone: '০১৯১৮৩০৮৭০৬',
  footerGreeting: 'আমাদের সাথে থাকার জন্য ধন্যবাদ! আবার আসবেন।',
  showVat: false,
  vatPercent: 5,
  vatNumber: 'BIN-123456789',
  printKitchenCopy: true,
};

export function getPrinterSettings(): PrinterSettings {
  if (typeof window === 'undefined') return DEFAULT_PRINTER_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Sync restaurant name & phone from general settings if available
      const rSettings = getRestaurantSettings();
      return {
        ...DEFAULT_PRINTER_SETTINGS,
        restaurantName: rSettings.name || DEFAULT_PRINTER_SETTINGS.restaurantName,
        address: rSettings.address || DEFAULT_PRINTER_SETTINGS.address,
        phone: rSettings.phone || DEFAULT_PRINTER_SETTINGS.phone,
      };
    }
    return { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(stored) };
  } catch (e) {
    console.error('Failed to parse printer settings:', e);
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export function savePrinterSettings(settings: Partial<PrinterSettings>): PrinterSettings {
  const current = getPrinterSettings();
  const updated = { ...current, ...settings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('printer_settings_updated', { detail: updated }));
  } catch (e) {
    console.error('Failed to save printer settings:', e);
  }
  return updated;
}

export interface ParsedOrderItem {
  qty: number;
  name: string;
  note?: string;
  price: number;
  total: number;
}

/**
 * Extract any discount amount and clean note from order summary string
 */
export function extractDiscountFromSummary(itemsSummary: string): { cleanSummary: string; discount: number; discountNote?: string } {
  if (!itemsSummary || typeof itemsSummary !== 'string') return { cleanSummary: '', discount: 0 };
  let discount = 0;
  let discountNote: string | undefined = undefined;

  const regex = /\[(?:ছাড়|ছাড়|Discount)[^:\]]*:?\s*[-৳Tk]*\s*(\d+(?:\.\d+)?)\s*(?:\(([^)]+)\))?\]/gi;
  let match;
  while ((match = regex.exec(itemsSummary)) !== null) {
    if (match[1]) {
      discount += parseFloat(match[1]);
    }
    if (match[2]) {
      discountNote = match[2].trim();
    }
  }

  // Clean the summary by removing discount bracket tags
  const cleanSummary = itemsSummary
    .replace(/,\s*\[(?:ছাড়|ছাড়|Discount)[^\]]*\]/gi, '')
    .replace(/\[(?:ছাড়|ছাড়|Discount)[^\]]*\]\s*,?/gi, '')
    .replace(/,\s*,+/g, ',')
    .trim();

  return { cleanSummary, discount, discountNote };
}

export function parseOrderItems(itemsSummary: string, totalAmount?: number): ParsedOrderItem[] {
  if (!itemsSummary || itemsSummary.trim() === '') return [];
  
  // Filter out any discount tags so they NEVER get counted as food items or added to food totals!
  const parts = itemsSummary
    .split(',')
    .map(s => s.trim())
    .filter(s => Boolean(s) && !s.match(/\[?(?:ছাড়|ছাড়|discount)/i));

  // Retrieve cached or initial menu items for fast and accurate price lookup
  let menuList = INITIAL_MENU_ITEMS;
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('cached_menu_items');
      if (cached) {
        const parsedCached = JSON.parse(cached);
        if (Array.isArray(parsedCached) && parsedCached.length > 0) {
          menuList = parsedCached;
        }
      }
    } catch (e) {}
  }

  const findPriceInMenu = (foodName: string, noteStr?: string): number => {
    if (!foodName) return 0;
    const cleanName = foodName.toLowerCase().trim();
    
    // Exact or partial name match
    const matched = menuList.find(m => {
      const mName = m.name?.toLowerCase().trim();
      return mName === cleanName || cleanName.includes(mName) || mName.includes(cleanName);
    });

    if (matched) {
      if (noteStr && matched.description) {
        const parsed = parseDescriptionData(matched.description);
        if (parsed.variants && parsed.variants.length > 0) {
          const vMatch = parsed.variants.find((v: any) => 
            v.name && noteStr.toLowerCase().includes(v.name.toLowerCase())
          );
          if (vMatch && vMatch.price) return Number(vMatch.price);
        }
      }
      return Number(matched.price || 0);
    }
    return 0;
  };

  const parsed = parts.map((part) => {
    const match = part.match(/^(\d+)x\s*(.*)$/);
    const qty = match ? parseInt(match[1], 10) : 1;
    let rest = match ? match[2].trim() : part.trim();
    let note: string | undefined = undefined;
    let price: number | undefined = undefined;

    // 1. Check for bracketed price: [৳180] or [180] or [Tk 180] or [৳১৮০]
    const bracketMatch = rest.match(/\[(.*?)\]/);
    if (bracketMatch) {
      const insideBracket = bracketMatch[1].trim();
      const numMatch = toStandardDigits(insideBracket).match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        price = parseFloat(numMatch[1]);
      }
      rest = rest.replace(bracketMatch[0], '').trim();
    }

    // 2. Check for parentheses (could be special instruction note OR a price tag like (৳180))
    if (rest.includes('(') && rest.includes(')')) {
      const parenMatch = rest.match(/^(.*?)\s*\((.*?)\)$/);
      if (parenMatch) {
        const potentialName = parenMatch[1].trim();
        const insideParen = parenMatch[2].trim();
        
        const stdParen = toStandardDigits(insideParen);
        const parenNumMatch = stdParen.match(/^(?:৳|tk|টাকা)?\s*(\d+(?:\.\d+)?)\s*(?:৳|tk|টাকা)?$/i);
        
        if (parenNumMatch && !price) {
          price = parseFloat(parenNumMatch[1]);
          rest = potentialName;
        } else {
          rest = potentialName;
          note = insideParen;
        }
      }
    }

    // 3. Fallback: lookup food price from menu database if not explicitly tagged in string
    if (!price || isNaN(price) || price <= 0) {
      const menuPrice = findPriceInMenu(rest, note);
      if (menuPrice > 0) {
        price = menuPrice;
      }
    }

    const safeQty = qty > 0 ? qty : 1;
    const safePrice = price && !isNaN(price) ? price : 0;

    return {
      qty: safeQty,
      name: rest,
      note,
      price: safePrice,
      total: safePrice * safeQty,
    };
  });

  // Filter out any invalid items or accidentally parsed discount tags
  const validItems = parsed.filter(i => 
    i.name && 
    i.name.trim().length > 0 && 
    !i.name.match(/^(?:ছাড়|ছাড়|discount)/i)
  );

  // 4. Fallback if any items are still unpriced (e.g. unknown custom food) and totalAmount is given
  const knownTotal = validItems.reduce((sum, item) => sum + item.total, 0);
  const unpriced = validItems.filter(i => i.price === 0);

  if (unpriced.length > 0 && totalAmount && totalAmount > knownTotal) {
    const remainingAmount = totalAmount - knownTotal;
    const remainingQty = unpriced.reduce((sum, i) => sum + i.qty, 0);
    const avgPrice = remainingQty > 0 ? Math.round(remainingAmount / remainingQty) : 0;
    unpriced.forEach(i => {
      i.price = avgPrice;
      i.total = avgPrice * i.qty;
    });
  }

  return validItems;
}

export function toBanglishOrEnglish(text: string): string {
  if (!text) return '';
  
  // 1. Convert Bangla digits to English
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const enDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  let s = text;
  for (let i = 0; i < 10; i++) {
    s = s.replace(new RegExp(bnDigits[i], 'g'), enDigits[i]);
  }

  // 2. Common Word Translation / Transliteration
  const dict: { [key: string]: string } = {
    'ইলিশ': 'Ilish',
    'খিচুড়ি': 'Khichuri',
    'খিচুড়ি': 'Khichuri',
    'ভাত': 'Bhat',
    'ডাল': 'Dal',
    'মুরগি': 'Murgi',
    'মুরগী': 'Murgi',
    'বিরিয়ানি': 'Biryani',
    'বিরিয়ানি': 'Biryani',
    'পোলাও': 'Polao',
    'মাছ': 'Mach',
    'মাংস': 'Mangso',
    'গরু': 'Goru',
    'খাসি': 'Khasi',
    'চিংড়ি': 'Chingri',
    'চingড়ি': 'Chingri',
    'ভর্তা': 'Vorta',
    'ভাজি': 'Vhaji',
    'সালাদ': 'Salad',
    'পানি': 'Pani',
    'কোমল পানীয়': 'Soft Drink',
    'কোমল পানীয়': 'Soft Drink',
    'চা': 'Cha',
    'কফি': 'Coffee',
    'মিষ্টি': 'Misti',
    'দই': 'Doi',
    'ফুল': 'Full',
    'হাফ': 'Half',
    'প্লেট': 'Plate',
    'কাপ': 'Cup',
    'গ্লাস': 'Glass',
    'পিস': 'Pcs',
    'ডেলিভারি': 'Delivery',
    'টেবিল': 'Table',
    'টেবিলে': 'Table',
    'টেকওয়ে': 'Takeaway',
    'টেক-ওয়ে': 'Takeaway',
    'ক্যাশ': 'Cash',
    'বিকাশ': 'Bkash',
    'নগদ': 'Nagad',
    'রকেট': 'Rocket',
    'কার্ড': 'Card',
    'অনলাইন': 'Online',
    'পেমেন্ট': 'Payment',
    'ডাইনিং': 'Dine-in',
    'কাস্টমার': 'Customer',
    'ফোন': 'Phone',
    'ঠিকানা': 'Address',
    'শাখা': 'Branch',
    'ইনভয়েস': 'Invoice',
    'রসিদ': 'Receipt',
    'ক্যাটারিং': 'Catering',
    'ভ্যাট': 'VAT',
    'টাকা': 'Tk',
    'রেস্টুরেন্ট': 'Restaurant',
    'ছাড়': 'Discount',
    'ছাড়': 'Discount',
    'ডিসকাউন্ট': 'Discount'
  };

  // Replace whole or partial matches of these common words
  Object.keys(dict).forEach(key => {
    s = s.replace(new RegExp(key, 'g'), dict[key]);
  });

  // 3. Basic phonetic transliteration for other Bengali characters if they remain, 
  // to avoid garbage characters on the printer.
  const charMap: { [key: string]: string } = {
    'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
    'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'ny',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
    'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
    'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y',
    'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
    '্': '', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n',
    'ৎ': 't'
  };

  let result = '';
  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    // If it's a Bengali character, map it
    if (char >= '\u0980' && char <= '\u09FF') {
      result += charMap[char] !== undefined ? charMap[char] : '';
    } else {
      result += char;
    }
  }

  // Clean double spaces or clean characters
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Format plain text receipt for thermal printers or copying
 */
export function generatePlainTextReceipt(
  order: any, 
  settings: PrinterSettings = getPrinterSettings(), 
  type: 'bill' | 'kot' = 'bill',
  lang: 'bn' | 'en' = 'bn'
): string {
  const is58mm = settings.paperWidth === '58mm';
  const width = is58mm ? 32 : 44; // Characters per line
  const divider = '-'.repeat(width);
  const doubleDivider = '='.repeat(width);

  const center = (text: string) => {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(pad) + text;
  };

  const line2Col = (left: string, right: string) => {
    const space = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(space) + right;
  };

  const items = parseOrderItems(order.items_summary);
  const orderDate = new Date(order.created_at || Date.now());
  
  let dateStr = orderDate.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
  let timeStr = orderDate.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });

  if (lang === 'en') {
    dateStr = orderDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    timeStr = orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  let receipt = '';

  const t = (text: string) => {
    return lang === 'en' ? toBanglishOrEnglish(text) : text;
  };

  if (type === 'kot') {
    receipt += doubleDivider + '\n';
    receipt += center(lang === 'en' ? '** KITCHEN ORDER TOKEN (KOT) **' : '** কিচেন অর্ডার টোকেন (KOT) **') + '\n';
    receipt += center(t(settings.restaurantName)) + '\n';
    receipt += doubleDivider + '\n';
    receipt += line2Col(lang === 'en' ? `Order: ${order.order_number}` : `অর্ডার: ${order.order_number}`, timeStr) + '\n';
    receipt += line2Col(lang === 'en' ? `Date: ${dateStr}` : `তারিখ: ${dateStr}`, lang === 'en' ? `Type: ${t(order.order_type)}` : `ধরণ: ${order.order_type}`) + '\n';
    receipt += line2Col(lang === 'en' ? `Table/Loc:` : `স্থান/টেবিল:`, t(order.location || 'N/A')) + '\n';
    receipt += divider + '\n';
    receipt += line2Col(lang === 'en' ? 'Item' : 'আইটেম', lang === 'en' ? 'Qty' : 'পরিমাণ') + '\n';
    receipt += divider + '\n';

    items.forEach((item, idx) => {
      receipt += line2Col(`${idx + 1}. ${t(item.name)}`, `[ ${item.qty}x ]`) + '\n';
      if (item.note) {
        receipt += `   * ${lang === 'en' ? 'Note' : 'নোট'}: ${t(item.note)}\n`;
      }
    });

    receipt += divider + '\n';
    receipt += center(lang === 'en' ? `-- Kitchen Copy --` : `-- রান্নাঘরের জন্য প্রযোজ্য --`) + '\n';
    receipt += doubleDivider + '\n\n';
    return receipt;
  }

  // Customer Bill
  receipt += doubleDivider + '\n';
  receipt += center(t(settings.restaurantName)) + '\n';
  if (settings.branchName) {
    receipt += center(t(settings.branchName)) + '\n';
  }
  receipt += center(t(settings.address)) + '\n';
  receipt += center(lang === 'en' ? `Mobile: ${settings.phone}` : `মোবাইল: ${settings.phone}`) + '\n';
  if (settings.showVat && settings.vatNumber) {
    receipt += center(lang === 'en' ? `VAT Reg: ${settings.vatNumber}` : `ভ্যাট রেজি: ${settings.vatNumber}`) + '\n';
  }
  receipt += doubleDivider + '\n';
  receipt += center(lang === 'en' ? 'CASH MEMO / INVOICE' : 'ক্যাশ মেমো / ইনভয়েস') + '\n';
  receipt += divider + '\n';
  receipt += line2Col(lang === 'en' ? `Order No: ${order.order_number}` : `অর্ডার নং: ${order.order_number}`, timeStr) + '\n';
  receipt += line2Col(lang === 'en' ? `Date: ${dateStr}` : `তারিখ: ${dateStr}`, lang === 'en' ? `Type: ${t(order.order_type)}` : `ধরণ: ${order.order_type}`) + '\n';
  receipt += line2Col(lang === 'en' ? `Table/Loc: ${t(order.location || 'N/A')}` : `টেবিল/স্থান: ${order.location || 'N/A'}`, '') + '\n';
  receipt += line2Col(lang === 'en' ? `Customer: ${t(order.customer_name)}` : `কাস্টমার: ${order.customer_name}`, '') + '\n';
  if (order.customer_phone && order.customer_phone !== 'প্রযোজ্য নয়') {
    receipt += line2Col(lang === 'en' ? `Phone: ${order.customer_phone}` : `ফোন: ${order.customer_phone}`, '') + '\n';
  }
  receipt += divider + '\n';
  receipt += line2Col(lang === 'en' ? 'Item Description' : 'খাবারের নাম ও বিবরণ', lang === 'en' ? 'Qty x Rate   Total' : 'পরিমাণ x দর   মোট') + '\n';
  receipt += divider + '\n';

  items.forEach((item, idx) => {
    const itemPrice = item.price || 0;
    const itemTotal = item.total || (item.qty * itemPrice);
    
    // Line 1: Item Name with counter
    receipt += `${idx + 1}. ${t(item.name)}\n`;
    
    // Line 2: Quantity x Unit Rate aligned with Total
    const qtyRate = `   ${item.qty} x ${lang === 'en' ? 'Tk ' : '৳'}${itemPrice}`;
    const totalCol = `${lang === 'en' ? 'Tk ' : '৳'}${itemTotal}`;
    receipt += line2Col(qtyRate, totalCol) + '\n';

    if (item.note) {
      receipt += `   * ${lang === 'en' ? 'Note' : 'নোট'}: ${t(item.note)}\n`;
    }
  });

  receipt += divider + '\n';
  const subtotal = items.reduce((sum, it) => sum + (it.total || (it.qty * (it.price || 0))), 0);
  
  // Extract discount reliably
  const { discount: extractedDiscount } = extractDiscountFromSummary(order.items_summary || '');
  let discount = 0;
  if (order.discount_amount !== undefined && order.discount_amount !== null && Number(order.discount_amount) > 0) {
    discount = Number(order.discount_amount);
  } else if (order.discount !== undefined && order.discount !== null && Number(order.discount) > 0) {
    discount = Number(order.discount);
  } else if (extractedDiscount > 0) {
    discount = extractedDiscount;
  }

  // Final total MUST ALWAYS be subtotal MINUS discount
  const finalTotal = discount > 0 
    ? Math.max(0, subtotal - discount) 
    : (Number(order.total_amount) > 0 ? Number(order.total_amount) : subtotal);

  if (discount > 0) {
    receipt += line2Col(lang === 'en' ? 'Subtotal:' : 'খাবারের মোট মূল্য:', lang === 'en' ? `TK ${subtotal.toFixed(0)}` : `৳ ${subtotal.toFixed(0)}`) + '\n';
    receipt += line2Col(lang === 'en' ? 'Discount:' : 'বিশেষ ছাড় (Discount):', lang === 'en' ? `-TK ${discount.toFixed(0)}` : `-৳ ${discount.toFixed(0)}`) + '\n';
    receipt += divider + '\n';
  }

  receipt += line2Col(lang === 'en' ? 'TOTAL BILL:' : 'সর্বমোট বিল (TOTAL):', lang === 'en' ? `TK ${finalTotal.toFixed(0)}` : `৳ ${finalTotal.toFixed(0)}`) + '\n';
  receipt += doubleDivider + '\n';
  receipt += center(t(settings.footerGreeting)) + '\n';
  receipt += center(lang === 'en' ? 'Software: Elish-er Bari Smart Restaurant' : 'সফ্টওয়্যার: ইলিশের বাড়ি স্মার্ট রেস্টুরেন্ট') + '\n';
  receipt += doubleDivider + '\n\n\n';

  return receipt;
}

/**
 * Generate standard ESC/POS bytes for Bluetooth / USB Thermal Printers
 */
export function generateEscPosBytes(
  order: any, 
  settings: PrinterSettings = getPrinterSettings(), 
  type: 'bill' | 'kot' = 'bill',
  lang: 'bn' | 'en' = 'bn'
): Uint8Array {
  const encoder = new TextEncoder();
  const plain = generatePlainTextReceipt(order, settings, type, lang);
  const textBytes = encoder.encode(plain);

  // ESC/POS Commands
  const ESC = 0x1B;
  const GS = 0x1D;

  const init = [ESC, 0x40]; // Initialize printer
  const alignCenter = [ESC, 0x61, 0x01];
  const feed3 = [ESC, 0x64, 0x03]; // Feed 3 lines
  const cutPaper = [GS, 0x56, 0x41, 0x10]; // Cut paper

  const fullBytes = new Uint8Array([
    ...init,
    ...alignCenter,
    ...textBytes,
    ...feed3,
    ...cutPaper
  ]);

  return fullBytes;
}

/**
 * Helper to convert Uint8Array to Base64
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Print via RawBT app on Android
 * RawBT supports standard Android intents & custom URL schemes
 */
export function printViaRawBT(
  order: any, 
  settings: PrinterSettings = getPrinterSettings(), 
  type: 'bill' | 'kot' = 'bill',
  lang: 'bn' | 'en' = 'bn'
) {
  const escPosBytes = generateEscPosBytes(order, settings, type, lang);
  const base64Data = uint8ArrayToBase64(escPosBytes);

  // Method 1: Android Intent for RawBT
  // intent:base64,...#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;
  const intentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.browser_fallback_url=${encodeURIComponent('https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter')};end;`;

  // Method 2: RawBT URL scheme
  const rawbtScheme = `rawbt:data:application/octet-stream;base64,${base64Data}`;

  // Method 3: RawBT local server (if desktop/android background service runs)
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  if (isAndroid) {
    try {
      window.location.href = intentUrl;
      return;
    } catch (e) {
      console.warn('Intent redirect failed, trying rawbt scheme:', e);
      window.location.href = rawbtScheme;
      return;
    }
  }

  // Desktop or fallback: open RawBT scheme or copy text
  window.location.href = rawbtScheme;
}

/**
 * Direct Web Bluetooth Connection (ESC/POS)
 * Modern Chrome on Android and PC supports direct wireless Bluetooth ESC/POS printing!
 */
export class BluetoothPrinterService {
  private static instance: BluetoothPrinterService | null = null;
  private device: any = null;
  private characteristic: any = null;
  private isConnecting: boolean = false;

  public static getInstance(): BluetoothPrinterService {
    if (!BluetoothPrinterService.instance) {
      BluetoothPrinterService.instance = new BluetoothPrinterService();
    }
    return BluetoothPrinterService.instance;
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public isConnected(): boolean {
    return !!(this.device && this.device.gatt && this.device.gatt.connected && this.characteristic);
  }

  public getDeviceName(): string {
    return this.device?.name || 'কোনো প্রিন্টার কানেক্ট নেই';
  }

  public async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('আপনার ব্রাউজারে Web Bluetooth সুবিধা নেই (Chrome ব্রাউজার ব্যবহার করুন)');
    }

    if (this.isConnecting) return false;
    this.isConnecting = true;

    try {
      // Standard Bluetooth Thermal Printer GATT Services & Serial Ports
      const nav: any = navigator;
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Common thermal printer service
          '0000ffe0-0000-1000-8000-00805f9b34fb', // HMSoft / Serial BLE
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent
          '0000af30-0000-1000-8000-00805f9b34fb', // Alternative POS
          '0000ff00-0000-1000-8000-00805f9b34fb', // Rongta / RPPO2N / Goojprt
          '0000ae00-0000-1000-8000-00805f9b34fb', // MPT / PT-210 series
          '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent / Portable BLE
        ]
      });

      this.device = device;
      const server = await device.gatt.connect();

      // Find primary service and writable characteristic
      const services = await server.getPrimaryServices();
      let writeChar: any = null;

      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              writeChar = char;
              break;
            }
          }
        } catch (e) {
          // ignore service iteration error
        }
        if (writeChar) break;
      }

      if (!writeChar) {
        throw new Error('প্রিন্টারের Writable Characteristic পাওয়া যায়নি। দয়া করে আবার চেষ্টা করুন।');
      }

      this.characteristic = writeChar;
      return true;
    } catch (err: any) {
      console.error('Bluetooth connection failed:', err);
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.device && this.device.gatt) {
      try {
        this.device.gatt.disconnect();
      } catch (e) {
        // ignore
      }
    }
    this.device = null;
    this.characteristic = null;
  }

  public async print(bytes: Uint8Array): Promise<void> {
    if (!this.isConnected()) {
      const connected = await this.connect();
      if (!connected) throw new Error('প্রিন্টার সংযুক্ত করা যায়নি');
    }

    // Send in chunks of 512 bytes (GATT MTU limit safe)
    const CHUNK_SIZE = 512;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.slice(i, i + CHUNK_SIZE);
      if (this.characteristic.writeValueWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
    }
  }
}

/**
 * Standard browser print triggering
 */
export function printReceiptViaBrowser(): void {
  window.print();
}
