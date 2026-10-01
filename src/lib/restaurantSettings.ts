import { supabase } from './supabase';

export interface RestaurantSettings {
  // Brand & Identity
  name: string;
  shortDesc: string;
  logo: string;
  backgroundArt: string;
  status: string; // 'Open' | 'Closed' (Legacy/Direct)
  statusMode?: 'Auto' | 'Open' | 'Closed'; // Auto = Check Bangladesh Time 11:00 AM - 10:30 PM
  closingTime: string;

  // Hero Section (Ilisher Bari Style)
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  heroPrimaryBtnText: string;
  heroSecondaryBtnText: string;

  // About Section ("আমাদের কথা")
  aboutBadge: string;
  aboutTitle: string;
  aboutText1: string;
  aboutText2: string;
  aboutTagline: string;

  // Contact & Location
  locationTitle: string;
  address: string;
  mapLink: string;
  openingHours: string;
  phone: string;
  whatsapp: string;
  autoOpenWhatsApp: boolean;
  facebookUrl: string;

  // Theme & Layout
  primaryColor: string;
  menuStyle: 'rows' | 'cards'; // rows = Ilisher Bari style, cards = modern card grid
  footerCopyright: string;

  // Delivery Tiers
  deliveryFeeTiers: {
    km1: number;
    km5: number;
    km10: number;
    km15: number;
  };
}

export const DEFAULT_RESTAURANT_SETTINGS: RestaurantSettings = {
  name: "ইলিশের বাড়ি রেস্টুরেন্ট",
  shortDesc: "নতুন স্বাদ, নতুন অভিজ্ঞতা, নতুন বন্ধুত্ব",
  logo: "/images/ilisher-bari/logo.png",
  backgroundArt: "/images/ilisher-bari/background.png",
  status: "Open",
  statusMode: "Auto",
  closingTime: "১০:৩০ PM",

  heroEyebrow: "নদীর হাওয়া, বাংলার স্বাদে",
  heroTitle: "খাবার নয়, এক টুকরো অনুভব",
  heroSubtitle: "স্বাদ, গল্প আর প্রিয়জনের আড্ডা—সব একসঙ্গে।",
  heroImage: "/images/ilisher-bari/hero.png",
  heroPrimaryBtnText: "আমাদের আয়োজন ও মেনু ›",
  heroSecondaryBtnText: "⌖ ঠিকানা ও লোকেশন",

  aboutBadge: "আমাদের কথা",
  aboutTitle: "স্বাদ আর আনন্দের এক আপন ঠিকানা",
  aboutText1: "শ্রীরায়েরচর বাজার ব্রিজ সংলগ্ন ইলিশের বাড়ি রেস্টুরেন্ট—পরিবার ও বন্ধুদের সঙ্গে পছন্দের খাবার উপভোগ করার মনোরম জায়গা।",
  aboutText2: "পিজ্জা, বার্গার, বিরিয়ানি, খিচুড়ি, চাইনিজ, কফি, লাচ্ছি ও ফ্রেশ জুসসহ আমাদের বিস্তৃত আয়োজনে সবার জন্য রয়েছে পছন্দের কিছু না কিছু।",
  aboutTagline: "ইলিশের বাড়ি—নতুন স্বাদ, নতুন অভিজ্ঞতা, নতুন বন্ধুত্ব।",

  locationTitle: "শ্রীরায়েরচর বাজার, মতলব উত্তর",
  address: "ব্রিজ সংলগ্ন, গালিমখা, বাংলাবাজার, মতলব উত্তর, চাঁদপুর",
  mapLink: "https://maps.app.goo.gl/dUSj2s41bhvhfK8bA?g_st=ac",
  openingHours: "প্রতিদিন সকাল ১১:০০ AM — রাত ১০:৩০ PM",
  phone: "০১৯১৮৩০৮৭০৬",
  whatsapp: "01918308706",
  autoOpenWhatsApp: true,
  facebookUrl: "https://www.facebook.com/share/1CD4oVaw8U/",

  primaryColor: "#c2410c", // terracotta/brick orange matching ilisherbari.lovable.app
  menuStyle: "rows",
  footerCopyright: "© ২০২৬ ইলিশের বাড়ি রেস্টুরেন্ট। সর্বস্বত্ব সংরক্ষিত。",
  
  deliveryFeeTiers: {
    km1: 0,
    km5: 50,
    km10: 100,
    km15: 150
  }
};

const STORAGE_KEY = 'restaurantSettings';
const SETTINGS_EVENT = 'restaurant_settings_updated';

/**
 * Calculates whether the restaurant is currently Open or Closed based on settings and Bangladesh Time (GMT+6)
 * Schedule: 11:00 AM to 10:30 PM everyday
 */
export function isRestaurantCurrentlyOpen(settings: RestaurantSettings): {
  isOpen: boolean;
  statusText: string;
  badgeColor: string;
  subText: string;
} {
  // If explicitly forced in manual mode
  if (settings.statusMode === 'Open') {
    return {
      isOpen: true,
      statusText: 'এখন খোলা আছে',
      badgeColor: '#16a34a',
      subText: `রাত ${settings.closingTime || '১০:৩০ PM'} পর্যন্ত খোলা`
    };
  }

  if (settings.statusMode === 'Closed') {
    return {
      isOpen: false,
      statusText: 'এখন বন্ধ আছে',
      badgeColor: '#dc2626',
      subText: 'সকাল ১১:০০ টায় আবার অর্ডার নেওয়া শুরু হবে'
    };
  }

  // AUTO MODE: Check Bangladesh Time (Asia/Dhaka - UTC+6)
  try {
    const now = new Date();
    const bdtString = now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" });
    const bdtDate = new Date(bdtString);
    const hour = bdtDate.getHours();
    const minute = bdtDate.getMinutes();
    const currentTotalMinutes = hour * 60 + minute;

    // 11:00 AM = 11 * 60 = 660 mins
    // 10:30 PM = 22 * 60 + 30 = 1350 mins
    const openTotalMinutes = 11 * 60;
    const closeTotalMinutes = 22 * 60 + 30;

    const isOpen = currentTotalMinutes >= openTotalMinutes && currentTotalMinutes < closeTotalMinutes;

    if (isOpen) {
      return {
        isOpen: true,
        statusText: 'এখন খোলা আছে',
        badgeColor: '#16a34a',
        subText: `রাত ${settings.closingTime || '১০:৩০ PM'} পর্যন্ত খোলা`
      };
    } else {
      return {
        isOpen: false,
        statusText: 'এখন বন্ধ আছে',
        badgeColor: '#dc2626',
        subText: 'সকাল ১১:০০ টায় আবার অর্ডার নেওয়া শুরু হবে'
      };
    }
  } catch (e) {
    const isLegacyOpen = settings.status !== 'Closed';
    return {
      isOpen: isLegacyOpen,
      statusText: isLegacyOpen ? 'এখন খোলা আছে' : 'এখন বন্ধ আছে',
      badgeColor: isLegacyOpen ? '#16a34a' : '#dc2626',
      subText: isLegacyOpen ? 'রাত ১০:৩০ PM পর্যন্ত খোলা' : 'সকাল ১১:০০ টায় আবার খুলবে'
    };
  }
}

export function getRestaurantSettings(): RestaurantSettings {
  if (typeof window === 'undefined') return DEFAULT_RESTAURANT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_RESTAURANT_SETTINGS;
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_RESTAURANT_SETTINGS, ...parsed };
  } catch (e) {
    console.error('Failed to parse restaurant settings', e);
    return DEFAULT_RESTAURANT_SETTINGS;
  }
}

export async function syncRestaurantSettingsToCloud(settings: RestaurantSettings): Promise<boolean> {
  if (!supabase) return false;
  try {
    const payload = JSON.stringify(settings);
    const prefix = '__SYSTEM_SETTINGS__:';
    const { data: existing } = await supabase
      .from('categories')
      .select('id, name')
      .like('name', `${prefix}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('categories')
        .update({ name: prefix + payload })
        .eq('id', existing[0].id);
    } else {
      await supabase
        .from('categories')
        .insert([{ name: prefix + payload }]);
    }
    return true;
  } catch (e) {
    console.error('Failed to sync restaurant settings to cloud', e);
    return false;
  }
}

export async function fetchRestaurantSettingsFromCloud(): Promise<RestaurantSettings | null> {
  if (!supabase) return null;
  try {
    const prefix = '__SYSTEM_SETTINGS__:';
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .like('name', `${prefix}%`)
      .limit(1);

    if (data && data.length > 0 && data[0].name.startsWith(prefix)) {
      const jsonStr = data[0].name.slice(prefix.length);
      const parsed = JSON.parse(jsonStr);
      const merged: RestaurantSettings = { ...DEFAULT_RESTAURANT_SETTINGS, ...parsed };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: merged }));
        } catch (e) {}
      }
      return merged;
    }
  } catch (e) {
    console.error('Failed to fetch restaurant settings from cloud', e);
  }
  return null;
}

export function saveRestaurantSettings(settings: Partial<RestaurantSettings>): RestaurantSettings {
  const current = getRestaurantSettings();
  const updated = { ...current, ...settings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: updated }));
  } catch (e) {
    console.error('Failed to save restaurant settings', e);
  }
  // Sync permanently to Supabase cloud database
  syncRestaurantSettingsToCloud(updated).catch(() => {});
  return updated;
}

export function subscribeRestaurantSettings(callback: (settings: RestaurantSettings) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<RestaurantSettings>;
    if (custom.detail) {
      callback(custom.detail);
    } else {
      callback(getRestaurantSettings());
    }
  };

  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      callback(getRestaurantSettings());
    }
  };

  window.addEventListener(SETTINGS_EVENT, handler);
  window.addEventListener('storage', storageHandler);

  return () => {
    window.removeEventListener(SETTINGS_EVENT, handler);
    window.removeEventListener('storage', storageHandler);
  };
}
