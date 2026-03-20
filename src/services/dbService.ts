import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'al_hidayah_cache';
const DB_VERSION = 2;

export interface QuranSurahCache {
  id: string; // editionId_surahNumber
  editionId: string;
  surahNumber: number;
  data: any;
  timestamp: number;
}

export interface HadithCache {
  id: string; // bookId_language_hadithNumber
  bookId: string;
  language: string;
  hadithNumber: string;
  data: any;
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('quran_surahs')) {
          db.createObjectStore('quran_surahs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('hadiths')) {
          db.createObjectStore('hadiths', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('hadith_books')) {
          db.createObjectStore('hadith_books', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('quran_editions')) {
          db.createObjectStore('quran_editions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('quran_pages')) {
          db.createObjectStore('quran_pages', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export const cacheQuranSurah = async (editionId: string, surahNumber: number, data: any) => {
  const db = await getDB();
  const id = `${editionId}_${surahNumber}`;
  await db.put('quran_surahs', {
    id,
    editionId,
    surahNumber,
    data,
    timestamp: Date.now(),
  });
};

export const getCachedQuranSurah = async (editionId: string, surahNumber: number) => {
  const db = await getDB();
  const id = `${editionId}_${surahNumber}`;
  const cached = await db.get('quran_surahs', id);
  return cached ? cached.data : null;
};

export const cacheQuranPage = async (pageNumber: number, data: any) => {
  const db = await getDB();
  await db.put('quran_pages', {
    id: pageNumber,
    data,
    timestamp: Date.now(),
  });
};

export const getCachedQuranPage = async (pageNumber: number) => {
  const db = await getDB();
  const cached = await db.get('quran_pages', pageNumber);
  return cached ? cached.data : null;
};

export const cacheHadiths = async (bookId: string, language: string, hadiths: any[]) => {
  const db = await getDB();
  const tx = db.transaction('hadiths', 'readwrite');
  const store = tx.objectStore('hadiths');
  
  for (const hadith of hadiths) {
    const id = `${bookId}_${language}_${hadith.hadithNumber}`;
    await store.put({
      id,
      bookId,
      language,
      hadithNumber: hadith.hadithNumber,
      data: hadith,
      timestamp: Date.now(),
    });
  }
  await tx.done;
};

export const getCachedHadiths = async (bookId: string, language: string) => {
  const db = await getDB();
  const all = await db.getAll('hadiths');
  return all
    .filter(h => h.bookId === bookId && h.language === language)
    .map(h => h.data);
};

export const cacheHadithBooks = async (books: any[]) => {
  const db = await getDB();
  const tx = db.transaction('hadith_books', 'readwrite');
  const store = tx.objectStore('hadith_books');
  for (const book of books) {
    await store.put(book);
  }
  await tx.done;
};

export const getCachedHadithBooks = async () => {
  const db = await getDB();
  return db.getAll('hadith_books');
};

export const cacheHadithBook = async (bookId: string, hadiths: any[]) => {
  const db = await getDB();
  await db.put('hadith_books', {
    id: bookId,
    hadiths,
    timestamp: Date.now(),
  });
};

export const getCachedHadithBook = async (bookId: string) => {
  const db = await getDB();
  return db.get('hadith_books', bookId);
};

export const cacheQuranEditions = async (editions: any[]) => {
  const db = await getDB();
  const tx = db.transaction('quran_editions', 'readwrite');
  const store = tx.objectStore('quran_editions');
  for (const edition of editions) {
    await store.put(edition);
  }
  await tx.done;
};

export const getCachedQuranEditions = async () => {
  const db = await getDB();
  return db.getAll('quran_editions');
};
