import { getRestaurantSettings as getLibRestaurantSettings, DEFAULT_RESTAURANT_SETTINGS } from './lib/restaurantSettings';

export function toStandardDigits(str: string | null | undefined): string {
  if (!str) return '';
  const bengaliToEnglish: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  return str.replace(/[০-৯]/g, match => bengaliToEnglish[match] || match);
}

export function parseDescriptionData(rawDescription: string | null | undefined) {
  if (!rawDescription) return { description: '', portion: null, variants: [] };
  
  let description = rawDescription;
  let portion = null;
  let variants: any[] = [];

  const portionMatch = description.match(/\|\|PORTION:(.*?)\|\|/);
  if (portionMatch) {
    portion = portionMatch[1];
    description = description.replace(portionMatch[0], '').trim();
  }

  const variantsMatch = description.match(/\|\|VARIANTS:(.*?)\|\|/);
  if (variantsMatch) {
    try {
      variants = JSON.parse(variantsMatch[1]);
    } catch (e) {
      console.error("Failed to parse variants", e);
    }
    description = description.replace(variantsMatch[0], '').trim();
  } else if (description.includes('|||')) {
    const parts = description.split('|||');
    description = parts[0].trim();
    if (parts[1]) {
      try {
        variants = JSON.parse(parts[1]);
      } catch (e) {
        console.error("Failed to parse ||| variants", e);
      }
    }
  }

  return { description, portion, variants };
}

export function combineDescriptionData(description: string, portion: string, variants: any[]) {
  let cleanDesc = description ? description.replace(/\|\|PORTION:.*?\|\|/g, '').replace(/\|\|VARIANTS:.*?\|\|/g, '').split('|||')[0].trim() : '';
  
  if (portion && portion.trim() !== '') {
    cleanDesc += ` ||PORTION:${portion.trim()}||`;
  }
  
  if (variants && variants.length > 0) {
    cleanDesc += ` ||VARIANTS:${JSON.stringify(variants)}||`;
  }
  
  return cleanDesc;
}

// Keep old exports for backward compatibility during transition
export const parseDescriptionAndPortion = (raw: string) => parseDescriptionData(raw);
export const combineDescriptionAndPortion = (desc: string, port: string) => combineDescriptionData(desc, port, []);

export function parseCategoryData(rawName: string | null | undefined) {
  if (!rawName) return { name: '', portions: [] };
  
  const match = rawName.match(/\|\|PORTIONS:(.*?)\|\|/);
  if (match) {
    const portions = match[1].split(',').map(p => p.trim()).filter(Boolean);
    const name = rawName.replace(match[0], '').trim();
    return { name, portions };
  }

  if (rawName.includes('|||')) {
    const parts = rawName.split('|||');
    const name = parts[0].trim();
    const portions = (parts[1] || '').split('|').map(p => p.trim()).filter(Boolean);
    return { name, portions };
  }

  return { name: rawName, portions: [] };
}

export function combineCategoryData(name: string, portions: string[]) {
  let cleanName = name.replace(/\|\|PORTIONS:.*?\|\|/g, '').split('|||')[0].trim();
  if (portions && portions.length > 0) {
    return `${cleanName} ||PORTIONS:${portions.join(',')}||`;
  }
  return cleanName;
}

export interface CategoryVisualInfo {
  emoji: string;
  subtitle: string;
  themeColor?: string;
}

export function getCategoryVisualInfo(categoryName: string | null | undefined): CategoryVisualInfo {
  if (!categoryName) return { emoji: '🍽️', subtitle: 'আমাদের স্পেশাল আয়োজন' };
  const raw = categoryName.toLowerCase().trim();

  if (raw.includes('পিজ্জা') || raw.includes('pizza')) {
    return { emoji: '🍕', subtitle: 'চিজি ও ক্রিস্পি ক্রাস্টের স্পেশাল পিজ্জা' };
  }
  if (raw.includes('বার্গার') || raw.includes('burger')) {
    return { emoji: '🍔', subtitle: 'জুসি চিকেন ও খাঁটি সসের মজাদার বার্গার' };
  }
  if (raw.includes('শর্মা') || raw.includes('shawarma')) {
    return { emoji: '🌯', subtitle: 'স্পেশাল ফ্রেশ রোল, চিকেন ও তাজা সালাদ' };
  }
  if (raw.includes('চিকেন চাপ') || raw.includes('নান') || raw.includes('chaap')) {
    return { emoji: '🫓', subtitle: 'ঐতিহ্যবাহী গরম নরম নান ও স্পেশাল মাসালা চাপ' };
  }
  if (raw.includes('মিট বক্স') || raw.includes('meat box')) {
    return { emoji: '🍱', subtitle: 'মাংস, ফ্রাই ও চিজি টপিংসের ভরপুর বক্স' };
  }
  if (raw.includes('ফ্রাই') || raw.includes('উইংস') || raw.includes('fry') || raw.includes('wings')) {
    return { emoji: '🍗', subtitle: 'মুচমুচে গরম ও দারুণ স্বাদের ক্রিস্পি ফ্রাই' };
  }
  if (raw.includes('চাওমিন') || raw.includes('chowmein') || raw.includes('নুডলস')) {
    return { emoji: '🍜', subtitle: 'চাইনিজ স্টাইল তাজা সবজি ও চিকেন চাওমিন' };
  }
  if (raw.includes('পাস্তা') || raw.includes('pasta')) {
    return { emoji: '🍝', subtitle: 'ক্রিমি ইতালিয়ান সস ও চিজের অপূর্ব স্বাদের পাস্তা' };
  }
  if (raw.includes('স্যুপ') || raw.includes('soup')) {
    return { emoji: '🍲', subtitle: 'গরম, আরামদায়ক ও পুষ্টিকর স্পেশাল স্যুপ' };
  }
  if (raw.includes('বিরিয়ানি') || raw.includes('বিরিয়ানি') || raw.includes('তেহারি') || raw.includes('biryani')) {
    return { emoji: '🍛', subtitle: 'সুগন্ধি চাল ও খাঁটি মসলায় দমে রান্না করা আসল স্বাদ' };
  }
  if (raw.includes('খিচুড়ি') || raw.includes('খিচুড়ি') || raw.includes('khichuri')) {
    return { emoji: '🍚', subtitle: 'খাঁটি দেশি ভুনা খিচুড়ির ঐতিহ্যবাহী স্বাদ' };
  }
  if (raw.includes('সেট মেনু') || raw.includes('set menu') || raw.includes('কম্বো')) {
    return { emoji: '🍱', subtitle: 'একত্রে সব পছন্দের খাবারের তৃপ্তিদায়ক পূর্ণাঙ্গ মিল' };
  }
  if (raw.includes('রাইস') || raw.includes('ভাত') || raw.includes('rice')) {
    return { emoji: '🍚', subtitle: 'সুস্বাদু ফ্রাইড রাইস ও পোলাও আইটেম' };
  }
  if (raw.includes('কারি') || raw.includes('ভেজিটেবল') || raw.includes('curry')) {
    return { emoji: '🥗', subtitle: 'তাজা সবজি ও সুস্বাদু মসলাদার কারি' };
  }
  if (raw.includes('সালাদ') || raw.includes('salad')) {
    return { emoji: '🥗', subtitle: 'তাজা, ক্রাঞ্চি ও স্বাস্থ্যকর রিফ্রেশিং সালাদ' };
  }
  if (raw.includes('হট কফি') || raw.includes('hot coffee')) {
    return { emoji: '☕', subtitle: 'অ্যারোমেটিক ফ্রেশ ব্রুড গরম কফি' };
  }
  if (raw.includes('কোল্ড কফি') || raw.includes('cold coffee')) {
    return { emoji: '🧋', subtitle: 'ঠান্ডা, রিফ্রেশিং ও ঘন ক্রিমি কোল্ড কফি' };
  }
  if (raw.includes('লাচ্ছি') || raw.includes('lassi')) {
    return { emoji: '🥛', subtitle: 'ঘন মিষ্টি দই ও পেস্তার খাঁটি দেশি লাচ্ছি' };
  }
  if (raw.includes('মিল্ক শেখ') || raw.includes('মিল্কশেক') || raw.includes('milkshake')) {
    return { emoji: '🥤', subtitle: 'চকলেট, স্ট্রবেরি ও ফ্রুট রিচ মিল্কশেক' };
  }
  if (raw.includes('ভেবারেজ') || raw.includes('পানীয়') || raw.includes('beverage') || raw.includes('কোল্ড ড্রিংকস')) {
    return { emoji: '🍹', subtitle: 'ঠান্ডা তৃষ্ণা মেটানো পছন্দের কোমল পানীয়' };
  }
  if (raw.includes('আপ্যাটিজার') || raw.includes('appetizer') || raw.includes('অনথন') || raw.includes('নাচুস')) {
    return { emoji: '🥟', subtitle: 'খাবারের শুরুতেই মচমচে ও দারুণ স্টার্টার' };
  }
  if (raw.includes('পানি') || raw.includes('water')) {
    return { emoji: '💧', subtitle: 'বিশুদ্ধ ও নিরাপদ মিনারেল ড্রিংকিং ওয়াটার' };
  }
  if (raw.includes('কফি') || raw.includes('coffee')) {
    return { emoji: '☕', subtitle: 'রিফ্রেশিং সুস্বাদু প্রিমিয়াম কফি' };
  }
  if (raw.includes('চা') || raw.includes('tea')) {
    return { emoji: '🍵', subtitle: 'গরম ও সুগন্ধি স্পেশাল চা' };
  }
  if (raw.includes('মিষ্টি') || raw.includes('আইসক্রিম') || raw.includes('ডেজার্ট')) {
    return { emoji: '🍨', subtitle: 'মিষ্টি মুখের দারুণ সব লোভনীয় ডেজার্ট' };
  }

  return { emoji: '🍽️', subtitle: 'তাজা উপকরণে প্রস্তুত আমাদের স্পেশাল আয়োজন' };
}

export interface FoodBadge {
  text: string;
  icon: string;
  className: string;
}

export function getFoodBadges(foodName: string | null | undefined): FoodBadge[] {
  if (!foodName) return [];
  const name = foodName.toLowerCase();
  const badges: FoodBadge[] = [];

  if (name.includes('ইলিশের বাড়ি') || name.includes('ইলিশের বাড়ি')) {
    badges.push({
      text: 'রেস্টুরেন্ট স্পেশাল',
      icon: '👑',
      className: 'bg-amber-500 text-white border-amber-600 shadow-xs'
    });
  } else if (name.includes('স্পেশাল') || name.includes('special')) {
    badges.push({
      text: 'শেফস স্পেশাল',
      icon: '✨',
      className: 'bg-amber-100 text-amber-900 border-amber-300'
    });
  }

  if (name.includes('প্রিমিয়াম') || name.includes('প্রিমিয়াম') || name.includes('premium')) {
    badges.push({
      text: 'প্রিমিয়াম কোয়ালিটি',
      icon: '⭐',
      className: 'bg-purple-100 text-purple-900 border-purple-300'
    });
  }

  if (name.includes('b b q') || name.includes('bbq') || name.includes('বারবিকিউ')) {
    badges.push({
      text: 'বারবিকিউ স্মোকি',
      icon: '🔥',
      className: 'bg-rose-100 text-rose-900 border-rose-300'
    });
  }

  if (name.includes('নাগা') || name.includes('naga') || name.includes('হট')) {
    badges.push({
      text: 'স্পাইসি নাগা',
      icon: '🌶️',
      className: 'bg-red-100 text-red-900 border-red-300'
    });
  }

  if (name.includes('ক্রিস্পি') || name.includes('crispy')) {
    badges.push({
      text: 'মচমচে ক্রিস্পি',
      icon: '✨',
      className: 'bg-orange-100 text-orange-900 border-orange-300'
    });
  }

  if (name.includes('চিজ') || name.includes('cheese')) {
    badges.push({
      text: 'এক্সট্রা চিজি',
      icon: '🧀',
      className: 'bg-amber-50 text-amber-900 border-amber-200'
    });
  }

  if (name.includes('ক্লাসিক') || name.includes('classic')) {
    badges.push({
      text: 'ক্লাসিক চয়েস',
      icon: '⭐',
      className: 'bg-emerald-100 text-emerald-900 border-emerald-300'
    });
  }

  return badges;
}

/* ==========================================================================
   WhatsApp & Phone Contact Utilities
   ========================================================================== */

export function formatWhatsAppNumber(phone: string | null | undefined): string {
  if (!phone) return '8801918308706';
  const normalized = toStandardDigits(phone);
  const digits = normalized.replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    return `88${digits}`;
  }
  if (digits.startsWith('8801')) {
    return digits;
  }
  if (digits.startsWith('1') && digits.length === 10) {
    return `880${digits}`;
  }
  return digits ? (digits.startsWith('88') ? digits : `88${digits}`) : '8801918308706';
}

export function formatTelNumber(phone: string | null | undefined): string {
  if (!phone) return '+8801918308706';
  const normalized = toStandardDigits(phone);
  const digits = normalized.replace(/\D/g, '');
  if (digits.startsWith('01')) {
    return `+88${digits}`;
  }
  if (digits.startsWith('8801')) {
    return `+${digits}`;
  }
  return digits ? `+${digits}` : '+8801918308706';
}

export function getRestaurantSettings() {
  return getLibRestaurantSettings();
}

export interface WhatsAppOrderData {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  orderType: string;
  location: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    instruction?: string;
  }>;
  itemsSummary?: string;
  subtotal: number;
  deliveryFee?: number;
  total: number;
  restaurantName?: string;
  lat?: number;
  lng?: number;
}

export function generateWhatsAppOrderMessage(data: WhatsAppOrderData): string {
  const restName = data.restaurantName || "ইলিশের বাড়ি রেস্টুরেন্ট";
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-GB');

  let msg = `🍽️ *নতুন অর্ডার - ${restName}*\n`;
  msg += `🔢 *অর্ডার নং:* ${data.orderNumber}\n`;
  msg += `--------------------------------\n`;
  if (data.customerName && data.customerName.trim() !== '') {
    msg += `👤 *কাস্টমার:* ${data.customerName}\n`;
  }
  if (data.customerPhone && data.customerPhone.trim() !== '' && data.customerPhone !== 'প্রযোজ্য নয়') {
    msg += `📱 *ফোন:* ${data.customerPhone}\n`;
  }
  msg += `📍 *অর্ডারের ধরণ:* ${data.orderType === 'Dine-in' ? 'টেবিলে খাওয়া (Dine-in)' : 'হোম ডেলিভারি (Delivery)'}\n`;
  msg += `📌 *ঠিকানা/টেবিল:* ${data.location}\n`;
  if (data.orderType !== 'Dine-in' && data.lat && data.lng) {
    msg += `🗺️ *গুগল ম্যাপে কাস্টমারের লোকেশন:*\nhttps://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}\n`;
  }
  msg += `🕒 *তারিখ ও সময়:* ${dateStr}, ${timeStr}\n`;
  msg += `--------------------------------\n`;
  msg += `📋 *অর্ডারকৃত খাবার:*\n`;

  if (data.items && data.items.length > 0) {
    data.items.forEach((item, index) => {
      msg += `${index + 1}. *${item.quantity}x ${item.name}* - ৳${item.price * item.quantity}\n`;
      if (item.instruction && item.instruction.trim() !== '') {
        msg += `   └ 📝 _নোট: ${item.instruction.trim()}_\n`;
      }
    });
  } else if (data.itemsSummary) {
    msg += `${data.itemsSummary}\n`;
  }

  msg += `--------------------------------\n`;
  msg += `💵 *সাবটোটাল:* ৳${data.subtotal}\n`;
  if (data.deliveryFee && data.deliveryFee > 0) {
    msg += `🛵 *ডেলিভারি চার্জ:* ৳${data.deliveryFee}\n`;
  }
  msg += `💰 *সর্বমোট বিল:* ৳${data.total}\n`;
  msg += `--------------------------------\n`;
  msg += `✅ *অর্ডারটি গ্রহণ করে নিশ্চিত করুন। ধন্যবাদ!*`;

  return msg;
}

export function createWhatsAppOrderLink(phone: string, orderData: WhatsAppOrderData): string {
  const formattedNumber = formatWhatsAppNumber(phone);
  const message = generateWhatsAppOrderMessage(orderData);
  return `https://api.whatsapp.com/send?phone=${formattedNumber}&text=${encodeURIComponent(message)}`;
}

/* ==========================================================================
   Category Order & Sorting Utilities
   ========================================================================== */

const CATEGORY_ORDER_KEY = 'restaurant_category_order';
const CATEGORY_ORDER_EVENT = 'restaurant_category_order_updated';

export function getSavedCategoryOrder(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CATEGORY_ORDER_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to get saved category order:', e);
    return [];
  }
}

export function saveCategoryOrder(orderIds: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(orderIds));
    window.dispatchEvent(new CustomEvent(CATEGORY_ORDER_EVENT, { detail: orderIds }));
  } catch (e) {
    console.error('Failed to save category order:', e);
  }
}

export function sortCategoriesByOrder<T extends { id: string }>(categories: T[], orderIds: string[] = getSavedCategoryOrder()): T[] {
  if (!categories || categories.length === 0) return [];
  if (!orderIds || orderIds.length === 0) return categories;

  const orderMap = new Map<string, number>();
  orderIds.forEach((id, index) => {
    orderMap.set(id, index);
  });

  return [...categories].sort((a, b) => {
    const posA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
    const posB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
    return posA - posB;
  });
}

const ITEM_ORDER_KEY = 'restaurant_item_order';
const ITEM_ORDER_EVENT = 'restaurant_item_order_updated';

export function getSavedItemOrder(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(ITEM_ORDER_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to get saved item order:', e);
    return [];
  }
}

export function saveItemOrder(orderIds: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ITEM_ORDER_KEY, JSON.stringify(orderIds));
    window.dispatchEvent(new CustomEvent(ITEM_ORDER_EVENT, { detail: orderIds }));
  } catch (e) {
    console.error('Failed to save item order:', e);
  }
}

export function sortMenuItemsByOrder<T extends { id: string }>(items: T[], orderIds: string[] = getSavedItemOrder()): T[] {
  if (!items || items.length === 0) return [];
  if (!orderIds || orderIds.length === 0) return items;

  const orderMap = new Map<string, number>();
  orderIds.forEach((id, index) => {
    orderMap.set(id, index);
  });

  return [...items].sort((a, b) => {
    const posA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
    const posB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
    return posA - posB;
  });
}

