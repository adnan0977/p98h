export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'user';
  preferences?: {
    language: string;
    calculationMethod: string;
    madhab: string;
  };
}

export interface QuranEdition {
  id: string;
  name: string;
  englishName?: string;
  language: string;
  languageCode?: string;
  type: string;
  format?: string;
  identifier?: string;
  author: string;
  enabled?: boolean;
  lastSyncedAt?: string;
}

export interface QuranEditionType {
  id: string;
  name: string;
}

export interface Language {
  id: string;
  code: string;
  name: string;
}

export interface HadithBook {
  id: string;
  name: string;
  author: string;
  language: string;
  languageCode?: string;
  description: string;
  lastSyncedAt?: string;
  hadithsCount?: number;
  chaptersCount?: number;
}

export interface HadithEdition {
  id: string;
  bookId: string;
  bookSlug: string;
  language: string;
  languageCode: string;
  lastSyncedAt?: string;
}

export interface ZakatRecord {
  id?: string;
  userId: string;
  date: string;
  amount: number;
  assets: {
    cash: number;
    gold: number;
    silver: number;
    investments: number;
  };
}

export interface TasbihHistory {
  id?: string;
  userId: string;
  date: string;
  count: number;
  dhikr: string;
}

export interface PrayerTime {
  name: string;
  time: string;
  isNext: boolean;
}

export interface Video {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  category?: string;
  description?: string;
  createdAt: string;
}

export interface AppSettings {
  maintenanceMode: boolean;
  announcement: string;
  featuredVideoId?: string;
}
