import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, setDoc, getDoc, writeBatch, where } from 'firebase/firestore';
import { 
  ShieldCheck, Plus, Trash2, Edit2, Save, X, BookOpen, Moon, Book,
  Languages, Globe, Info, Video as VideoIcon, Settings, Users, 
  LayoutDashboard, Search, ExternalLink, AlertTriangle, CheckCircle2, RefreshCw,
  ChevronRight, Database
} from 'lucide-react';
import { QuranEdition, QuranEditionType, Language, HadithBook, HadithEdition, Video, AppSettings, UserProfile } from '../types';
import { 
  cacheQuranSurah, 
  cacheHadiths, 
  cacheHadithBooks, 
  cacheQuranEditions 
} from '../services/dbService';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = `Permission Error: ${parsed.error} at ${parsed.path}`;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto" />
          <h2 className="text-xl font-bold text-red-900">System Error</h2>
          <p className="text-red-700 font-medium">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type AdminTab = 'quran' | 'hadith' | 'videos' | 'app' | 'users' | 'quran_types' | 'languages';

interface AdminPanelProps {
  onEditEdition: (id: string) => void;
  onEditHadith: (id: string) => void;
}

export default function AdminPanel({ onEditEdition, onEditHadith }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('quran');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Data states
  const [editions, setEditions] = useState<QuranEdition[]>([]);
  const [quranTypes, setQuranTypes] = useState<QuranEditionType[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [books, setBooks] = useState<HadithBook[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedHadithBook, setSelectedHadithBook] = useState<HadithBook | null>(null);
  const [hadithEditions, setHadithEditions] = useState<HadithEdition[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    maintenanceMode: false,
    announcement: '',
  });

  // Form states
  const [quranForm, setQuranForm] = useState<Partial<QuranEdition>>({ name: '', language: '', languageCode: '', type: 'translation', author: '' });
  const [hadithForm, setHadithForm] = useState<Partial<HadithBook>>({ name: '', author: '', language: '', description: '' });
  const [videoForm, setVideoForm] = useState<Partial<Video>>({ title: '', url: '', category: '', description: '' });
  const [languageForm, setLanguageForm] = useState<Partial<Language>>({ code: '', name: '' });

  // Filter states
  const [quranFilterType, setQuranFilterType] = useState<string>('all');
  const [quranFilterLanguage, setQuranFilterLanguage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewingIndex, setViewingIndex] = useState<{ book: HadithBook, edition: HadithEdition } | null>(null);
  const [indexChapters, setIndexChapters] = useState<any[]>([]);
  const [isIndexLoading, setIsIndexLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    isSyncing: boolean;
    currentSurah: number;
    totalSurahs: number;
    editionName: string;
    error: string | null;
  }>({
    isSyncing: false,
    currentSurah: 0,
    totalSurahs: 114,
    editionName: '',
    error: null,
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'hadith' && !isLoading && books.length === 0) {
      syncHadithBooks();
    }
  }, [activeTab, isLoading, books.length]);

  const fetchData = async () => {
    setIsLoading(true);
    let path = '';
    try {
      if (activeTab === 'quran') {
        path = 'quran_editions';
        const snap = await getDocs(collection(db, path));
        setEditions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuranEdition)));
        
        // Also fetch types and languages for filters
        const typesSnap = await getDocs(collection(db, 'quran_edition_types'));
        setQuranTypes(typesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuranEditionType)));
        
        const langSnap = await getDocs(collection(db, 'languages'));
        setLanguages(langSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Language)));
      } else if (activeTab === 'hadith') {
        if (selectedHadithBook) {
          await fetchHadithEditions(selectedHadithBook);
        } else {
          path = 'hadith_books';
          const snap = await getDocs(collection(db, path));
          setBooks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HadithBook)));
        }
      } else if (activeTab === 'videos') {
        path = 'videos';
        const snap = await getDocs(collection(db, path));
        setVideos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video)));
      } else if (activeTab === 'users') {
        path = 'users';
        const snap = await getDocs(collection(db, path));
        setUsers(snap.docs.map(doc => ({ ...doc.data() } as UserProfile)));
      } else if (activeTab === 'quran_types') {
        path = 'quran_edition_types';
        const snap = await getDocs(collection(db, path));
        setQuranTypes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuranEditionType)));
      } else if (activeTab === 'languages') {
        path = 'languages';
        const snap = await getDocs(collection(db, path));
        setLanguages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Language)));
      } else if (activeTab === 'app') {
        path = 'app_settings/global';
        const docRef = doc(db, 'app_settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAppSettings(docSnap.data() as AppSettings);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    let path = '';
    try {
      if (activeTab === 'quran') {
        path = 'quran_editions';
        await addDoc(collection(db, path), { ...quranForm, enabled: true });
        setQuranForm({ name: '', language: '', languageCode: '', type: 'translation', author: '' });
      } else if (activeTab === 'hadith') {
        path = 'hadith_books';
        await addDoc(collection(db, path), hadithForm);
        setHadithForm({ name: '', author: '', language: '', description: '' });
      } else if (activeTab === 'videos') {
        path = 'videos';
        await addDoc(collection(db, path), { ...videoForm, createdAt: new Date().toISOString() });
        setVideoForm({ title: '', url: '', category: '', description: '' });
      } else if (activeTab === 'languages') {
        path = 'languages';
        await setDoc(doc(db, 'languages', languageForm.code!), languageForm);
        setLanguageForm({ code: '', name: '' });
      }
      setIsAdding(false);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleDelete = async (coll: string, id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      const path = `${coll}/${id}`;
      try {
        await deleteDoc(doc(db, coll, id));
        fetchData();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  };

  const handleUpdateRole = async (uid: string, newRole: 'admin' | 'user') => {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const fetchHadithEditions = async (book: HadithBook) => {
    setIsLoading(true);
    try {
      const editionsRef = collection(db, 'hadith_editions');
      const q = query(editionsRef, where('bookId', '==', book.id));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        // Create 3 entries: Urdu, Arabic, English
        const newEditions: HadithEdition[] = [
          { id: `${book.id}_arabic`, bookId: book.id, bookSlug: book.id, language: 'Arabic', languageCode: 'ar' },
          { id: `${book.id}_english`, bookId: book.id, bookSlug: book.id, language: 'English', languageCode: 'en' },
          { id: `${book.id}_urdu`, bookId: book.id, bookSlug: book.id, language: 'Urdu', languageCode: 'ur' },
        ];
        
        for (const ed of newEditions) {
          await setDoc(doc(db, 'hadith_editions', ed.id), ed);
        }
        setHadithEditions(newEditions);
      } else {
        setHadithEditions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HadithEdition)));
      }
    } catch (error) {
      console.error('Error fetching hadith editions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    const path = 'app_settings/global';
    try {
      await setDoc(doc(db, 'app_settings', 'global'), appSettings);
      alert('Settings saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const syncEditionTypes = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('https://api.alquran.cloud/v1/edition/type');
      const data = await response.json();
      if (data.code === 200) {
        const types = data.data;
        for (const typeName of types) {
          await setDoc(doc(db, 'quran_edition_types', typeName), { name: typeName });
        }
        alert('Edition types synced successfully!');
        if (activeTab === 'quran_types') fetchData();
      }
    } catch (error) {
      console.error('Error syncing edition types:', error);
      alert('Failed to sync edition types.');
    } finally {
      setIsLoading(false);
    }
  };

  const syncLanguages = async () => {
    setIsLoading(true);
    try {
      const languageData: Record<string, string> = {
        "aa": "Afar",
        "ab": "Abkhazian",
        "ae": "Avestan",
        "af": "Afrikaans",
        "ak": "Akan",
        "am": "Amharic",
        "an": "Aragonese",
        "ar": "Arabic",
        "as": "Assamese",
        "av": "Avaric",
        "ay": "Aymara",
        "az": "Azerbaijani",
        "ba": "Bashkir",
        "be": "Belarusian",
        "bg": "Bulgarian",
        "bh": "Bihari languages",
        "bi": "Bislama",
        "bm": "Bambara",
        "bn": "Bengali",
        "bo": "Tibetan",
        "br": "Breton",
        "bs": "Bosnian",
        "ca": "Catalan; Valencian",
        "ce": "Chechen",
        "ch": "Chamorro",
        "co": "Corsican",
        "cr": "Cree",
        "cs": "Czech",
        "cu": "Church Slavic; Old Slavonic; Church Slavonic; Old Bulgarian; Old Church Slavonic",
        "cv": "Chuvash",
        "cy": "Welsh",
        "da": "Danish",
        "de": "German",
        "dv": "Divehi; Dhivehi; Maldivian",
        "dz": "Dzongkha",
        "ee": "Ewe",
        "el": "Greek, Modern (1453-)",
        "en": "English",
        "eo": "Esperanto",
        "es": "Spanish; Castilian",
        "et": "Estonian",
        "eu": "Basque",
        "fa": "Persian",
        "ff": "Fulah",
        "fi": "Finnish",
        "fj": "Fijian",
        "fo": "Faroese",
        "fr": "French",
        "fy": "Western Frisian",
        "ga": "Irish",
        "gd": "Gaelic; Scomttish Gaelic",
        "gl": "Galician",
        "gn": "Guarani",
        "gu": "Gujarati",
        "gv": "Manx",
        "ha": "Hausa",
        "he": "Hebrew",
        "hi": "Hindi",
        "ho": "Hiri Motu",
        "hr": "Croatian",
        "ht": "Haitian; Haitian Creole",
        "hu": "Hungarian",
        "hy": "Armenian",
        "hz": "Herero",
        "ia": "Interlingua (International Auxiliary Language Association)",
        "id": "Indonesian",
        "ie": "Interlingue; Occidental",
        "ig": "Igbo",
        "ii": "Sichuan Yi; Nuosu",
        "ik": "Inupiaq",
        "io": "Ido",
        "is": "Icelandic",
        "it": "Italian",
        "iu": "Inuktitut",
        "ja": "Japanese",
        "jv": "Javanese",
        "ka": "Georgian",
        "kg": "Kongo",
        "ki": "Kikuyu; Gikuyu",
        "kj": "Kuanyama; Kwanyama",
        "kk": "Kazakh",
        "kl": "Kalaallisut; Greenlandic",
        "km": "Central Khmer",
        "kn": "Kannada",
        "ko": "Korean",
        "kr": "Kanuri",
        "ks": "Kashmiri",
        "ku": "Kurdish",
        "kv": "Komi",
        "kw": "Cornish",
        "ky": "Kirghiz; Kyrgyz",
        "la": "Latin",
        "lb": "Luxembourgish; Letzeburgesch",
        "lg": "Ganda",
        "li": "Limburgan; Limburger; Limburgish",
        "ln": "Lingala",
        "lo": "Lao",
        "lt": "Lithuanian",
        "lu": "Luba-Katanga",
        "lv": "Latvian",
        "mg": "Malagasy",
        "mh": "Marshallese",
        "mi": "Maori",
        "mk": "Macedonian",
        "ml": "Malayalam",
        "mn": "Mongolian",
        "mr": "Marathi",
        "ms": "Malay",
        "mt": "Maltese",
        "my": "Burmese",
        "na": "Nauru",
        "nb": "Bokmål, Norwegian; Norwegian Bokmål",
        "nd": "Ndebele, North; North Ndebele",
        "ne": "Nepali",
        "ng": "Ndonga",
        "nl": "Dutch; Flemish",
        "nn": "Norwegian Nynorsk; Nynorsk, Norwegian",
        "no": "Norwegian",
        "nr": "Ndebele, South; South Ndebele",
        "nv": "Navajo; Navaho",
        "ny": "Chichewa; Chewa; Nyanja",
        "oc": "Occitan (post 1500)",
        "oj": "Ojibwa",
        "om": "Oromo",
        "or": "Oriya",
        "os": "Ossetian; Ossetic",
        "pa": "Panjabi; Punjabi",
        "pi": "Pali",
        "pl": "Polish",
        "ps": "Pushto; Pashto",
        "pt": "Portuguese",
        "qu": "Quechua",
        "rm": "Romansh",
        "rn": "Rundi",
        "ro": "Romanian; Moldavian; Moldovan",
        "ru": "Russian",
        "rw": "Kinyarwanda",
        "sa": "Sanskrit",
        "sc": "Sardinian",
        "sd": "Sindhi",
        "se": "Northern Sami",
        "sg": "Sango",
        "si": "Sinhala; Sinhalese",
        "sk": "Slovak",
        "sl": "Slovenian",
        "sm": "Samoan",
        "sn": "Shona",
        "so": "Somali",
        "sq": "Albanian",
        "sr": "Serbian",
        "ss": "Swati",
        "st": "Sotho, Southern",
        "su": "Sundanese",
        "sv": "Swedish",
        "sw": "Swahili",
        "ta": "Tamil",
        "te": "Telugu",
        "tg": "Tajik",
        "th": "Thai",
        "ti": "Tigrinya",
        "tk": "Turkmen",
        "tl": "Tagalog",
        "tn": "Tswana",
        "to": "Tonga (Tonga Islands)",
        "tr": "Turkish",
        "ts": "Tsonga",
        "tt": "Tatar",
        "tw": "Twi",
        "ty": "Tahitian",
        "ug": "Uighur; Uyghur",
        "uk": "Ukrainian",
        "ur": "Urdu",
        "uz": "Uzbek",
        "ve": "Venda",
        "vi": "Vietnamese",
        "vo": "Volapük",
        "wa": "Walloon",
        "wo": "Wolof",
        "xh": "Xhosa",
        "yi": "Yiddish",
        "yo": "Yoruba",
        "za": "Zhuang; Chuang",
        "zh": "Chinese",
        "zu": "Zulu"
      };

      for (const [code, name] of Object.entries(languageData)) {
        await setDoc(doc(db, 'languages', code), { 
          code, 
          name 
        });
      }
      alert('Languages saved successfully!');
      fetchData();
    } catch (error) {
      console.error('Error saving languages:', error);
      alert('Failed to save languages.');
    } finally {
      setIsLoading(false);
    }
  };

  const syncEditions = async () => {
    setIsLoading(true);
    try {
      // First, get all languages from Firestore to create a mapping
      const langSnap = await getDocs(collection(db, 'languages'));
      if (langSnap.empty) {
        alert('Please sync languages first to ensure correct language names.');
        setIsLoading(false);
        return;
      }
      
      const langMap: Record<string, string> = {};
      langSnap.forEach(doc => {
        const data = doc.data();
        langMap[doc.id] = data.name; // Use doc.id as the code (join key)
      });

      const response = await fetch('https://api.alquran.cloud/v1/edition');
      const data = await response.json();
      if (data.code === 200) {
        const editionsData = data.data;
        const editionsToCache = [];
        for (const ed of editionsData) {
          const edRef = doc(db, 'quran_editions', ed.identifier);
          const edPayload = {
            name: ed.name,
            englishName: ed.englishName,
            language: langMap[ed.language] || ed.language, // Use mapped name from languages table
            languageCode: ed.language,
            type: ed.type,
            format: ed.format,
            identifier: ed.identifier,
            author: ed.englishName,
            enabled: true
          };
          await setDoc(edRef, edPayload, { merge: true });
          editionsToCache.push({ id: ed.identifier, ...edPayload });
        }
        await cacheQuranEditions(editionsToCache);
        alert('Quran editions synced successfully!');
        if (activeTab === 'quran') fetchData();
      }
    } catch (error) {
      console.error('Error syncing editions:', error);
      alert('Failed to sync editions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowIndex = async (book: HadithBook, edition: HadithEdition) => {
    setViewingIndex({ book, edition });
    setIsIndexLoading(true);
    try {
      const q = query(
        collection(db, 'hadith_index'),
        where('bookId', '==', book.id),
        where('language', '==', edition.language)
      );
      const snap = await getDocs(q);
      const chapters = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory to avoid composite index requirement
      chapters.sort((a: any, b: any) => {
        const numA = typeof a.chapterNumber === 'string' ? parseInt(a.chapterNumber) : a.chapterNumber;
        const numB = typeof b.chapterNumber === 'string' ? parseInt(b.chapterNumber) : b.chapterNumber;
        return numA - numB;
      });
      setIndexChapters(chapters);
    } catch (error: any) {
      console.error('Error fetching index:', error);
    } finally {
      setIsIndexLoading(false);
    }
  };

  const syncHadithBooks = async () => {
    setIsLoading(true);
    try {
      // Fetch languages to map codes to names
      const langSnap = await getDocs(collection(db, 'languages'));
      const langMap: Record<string, string> = {};
      langSnap.forEach(doc => {
        const data = doc.data();
        langMap[doc.id] = data.name;
      });

      // Using the requested Hadith API
      const response = await fetch('https://hadithapi.com/api/books?apiKey=$2y$10$zBKMN41uis6ihOJnGbQGqOMvAugri3bY191hZlhdFtsfPjiCYO');
      const data = await response.json();
      
      // The API returns status 200 on success
      if (data.status === 200 || data.status === 'success') {
        const booksData = data.books || [];
        for (const book of booksData) {
          const bookRef = doc(db, 'hadith_books', book.bookSlug);
          // Default to English if not specified
          const langCode = 'en'; 
          await setDoc(bookRef, {
            id: book.bookSlug,
            name: book.bookName,
            author: book.writerName,
            language: langMap[langCode] || 'English',
            languageCode: langCode,
            description: `Hadiths: ${book.hadiths_count}, Chapters: ${book.chapters_count}. ${book.aboutWriter || ''}`,
            hadithsCount: book.hadiths_count,
            chaptersCount: book.chapters_count,
          }, { merge: true });
        }
        alert('Hadith books synced successfully from HadithAPI!');
        if (activeTab === 'hadith') fetchData();
      } else {
        alert(`API Error: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error syncing hadith books:', error);
      alert('Failed to sync hadith books. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleEdition = async (editionId: string, currentStatus: boolean) => {
    try {
      const edRef = doc(db, 'quran_editions', editionId);
      await updateDoc(edRef, { enabled: !currentStatus });
      setEditions(prev => prev.map(ed => ed.id === editionId ? { ...ed, enabled: !currentStatus } : ed));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'quran_editions');
    }
  };

  const syncQuranContent = async (edition: QuranEdition) => {
    if (!edition.identifier) {
      alert('This edition does not have an identifier.');
      return;
    }

    setSyncProgress({
      isSyncing: true,
      currentSurah: 0,
      totalSurahs: 114,
      editionName: edition.name,
      error: null,
    });

    try {
      const response = await fetch(`https://api.alquran.cloud/v1/quran/${edition.identifier}`);
      if (!response.ok) throw new Error('Failed to fetch Quran content from API');
      
      const data = await response.json();
      const surahs = data.data.surahs;

      for (let i = 0; i < surahs.length; i++) {
        const surah = surahs[i];
        setSyncProgress(prev => ({ ...prev, currentSurah: i + 1 }));
        
        const surahData = {
          number: surah.number,
          name: surah.name,
          englishName: surah.englishName,
          englishNameTranslation: surah.englishNameTranslation,
          revelationType: surah.revelationType,
          ayahs: surah.ayahs.map((a: any) => ({
            number: a.number,
            text: a.text,
            numberInSurah: a.numberInSurah,
            juz: a.juz,
            manzil: a.manzil,
            page: a.page,
            ruku: a.ruku,
            hizbQuarter: a.hizbQuarter,
            sajda: a.sajda
          }))
        };

        const surahRef = doc(db, 'quran_content', edition.id, 'surahs', surah.number.toString());
        await setDoc(surahRef, surahData);
        
        // Also cache locally
        await cacheQuranSurah(edition.id, surah.number, surahData);
      }

      // Update edition to mark as synced
      await updateDoc(doc(db, 'quran_editions', edition.id), {
        lastSyncedAt: new Date().toISOString()
      });

      setSyncProgress(prev => ({ ...prev, isSyncing: false }));
      fetchData(); // Refresh list to show synced status
    } catch (error: any) {
      console.error('Sync Error:', error);
      setSyncProgress(prev => ({ ...prev, isSyncing: false, error: error.message }));
    }
  };

  const syncHadithIndex = async (book: HadithBook, editionId: string) => {
    const edition = hadithEditions.find(e => e.id === editionId);
    const language = edition?.language || 'English';

    setSyncProgress({
      isSyncing: true,
      currentSurah: 0,
      totalSurahs: 1,
      editionName: `${book.name} (${language}) Index`,
      error: null,
    });

    try {
      const apiKey = '$2y$10$zBKMN41uis6ihOJnGbQGqOMvAugri3bY191hZlhdFtsfPjiCYO';
      
      const chaptersResponse = await fetch(`https://hadithapi.com/api/${book.id}/chapters?apiKey=${apiKey}`);
      const chaptersData = await chaptersResponse.json();
      
      if (chaptersData.status === 200 || chaptersData.status === 'success') {
        const chapters = chaptersData.chapters || [];
        setSyncProgress(prev => ({ ...prev, totalSurahs: chapters.length }));
        
        const chapterBatch = writeBatch(db);
        let count = 0;
        
        for (const chapter of chapters) {
          count++;
          setSyncProgress(prev => ({ ...prev, currentSurah: count }));
          
          // Determine chapterName based on language
          let chapterName = '';
          if (language === 'Arabic') chapterName = chapter.chapterArabic;
          else if (language === 'English') chapterName = chapter.chapterEnglish;
          else if (language === 'Urdu') chapterName = chapter.chapterUrdu;

          // Save to hadith_index flat collection
          const chapterId = `${book.id}_${language}_${chapter.chapterNumber}`;
          const chapterRef = doc(db, 'hadith_index', chapterId);
          
          chapterBatch.set(chapterRef, {
            id: chapter.id,
            bookId: book.id,
            bookSlug: chapter.bookSlug,
            chapterNumber: typeof chapter.chapterNumber === 'string' ? parseInt(chapter.chapterNumber) : chapter.chapterNumber,
            chapterName: chapterName,
            chapterArabic: chapter.chapterArabic,
            language: language,
          });
        }
        await chapterBatch.commit();

        await updateDoc(doc(db, 'hadith_editions', editionId), {
          lastSyncedAt: new Date().toISOString()
        });

        setSyncProgress(prev => ({ ...prev, isSyncing: false }));
        fetchData();
      } else {
        throw new Error(chaptersData.message || 'Failed to fetch chapters');
      }
    } catch (error: any) {
      console.error('Hadith Index Sync Error:', error);
      setSyncProgress(prev => ({ ...prev, isSyncing: false, error: error.message }));
    }
  };

  const syncHadithContent = async (book: HadithBook, editionId?: string) => {
    setSyncProgress({
      isSyncing: true,
      currentSurah: 0,
      totalSurahs: 1, 
      editionName: editionId ? `${book.name} (${hadithEditions.find(e => e.id === editionId)?.language})` : book.name,
      error: null,
    });

    try {
      const apiKey = '$2y$10$zBKMN41uis6ihOJnGbQGqOMvAugri3bY191hZlhdFtsfPjiCYO';
      
      // 1. Sync Chapters to hadith_index
      const chaptersResponse = await fetch(`https://hadithapi.com/api/${book.id}/chapters?apiKey=${apiKey}`);
      const chaptersData = await chaptersResponse.json();
      
      const language = editionId ? (hadithEditions.find(e => e.id === editionId)?.language || 'English') : 'English';

      if (chaptersData.status === 200 || chaptersData.status === 'success') {
        const chapters = chaptersData.chapters || [];
        const chapterBatch = writeBatch(db);
        
        for (const chapter of chapters) {
          // Determine chapterName based on language
          let chapterName = '';
          if (language === 'Arabic') chapterName = chapter.chapterArabic;
          else if (language === 'English') chapterName = chapter.chapterEnglish;
          else if (language === 'Urdu') chapterName = chapter.chapterUrdu;

          const chapterId = `${book.id}_${language}_${chapter.chapterNumber}`;
          const chapterRef = doc(db, 'hadith_index', chapterId);
          
          chapterBatch.set(chapterRef, {
            id: chapter.id,
            bookId: book.id,
            bookSlug: chapter.bookSlug,
            chapterNumber: typeof chapter.chapterNumber === 'string' ? parseInt(chapter.chapterNumber) : chapter.chapterNumber,
            chapterName: chapterName,
            chapterArabic: chapter.chapterArabic,
            language: language,
          });
        }
        await chapterBatch.commit();
      }

      // 2. Sync Hadiths
      // Fetch the first page to get total pages
      const response = await fetch(`https://hadithapi.com/api/hadiths?apiKey=${apiKey}&book=${book.id}&page=1`);
      const data = await response.json();
      
      if (data.status !== 200 && data.status !== 'success') {
        throw new Error(data.message || 'Failed to fetch hadiths from API');
      }

      const lastPage = data.hadiths.last_page;
      setSyncProgress(prev => ({ ...prev, totalSurahs: lastPage }));

      for (let page = 1; page <= lastPage; page++) {
        setSyncProgress(prev => ({ ...prev, currentSurah: page }));
        
        let pageData;
        if (page === 1) {
          pageData = data;
        } else {
          const pageResponse = await fetch(`https://hadithapi.com/api/hadiths?apiKey=${apiKey}&book=${book.id}&page=${page}`);
          pageData = await pageResponse.json();
        }

        const hadiths = pageData.hadiths.data;
        const batch = writeBatch(db);
        const hadithsToCache = [];
        
        for (const hadith of hadiths) {
          const hadithData = {
            number: hadith.hadithNumber,
            arab: hadith.hadithArabic,
            english: {
              narrator: hadith.englishNarrator,
              text: hadith.hadithEnglish
            },
            urdu: {
              narrator: hadith.urduNarrator,
              text: hadith.hadithUrdu
            },
            chapterId: hadith.chapterId,
            bookSlug: hadith.bookSlug,
            status: hadith.status
          };

          const hadithRef = doc(db, 'hadith_content', book.id, 'hadiths', hadith.hadithNumber.toString());
          batch.set(hadithRef, hadithData);
          hadithsToCache.push({ hadithNumber: hadith.hadithNumber, ...hadithData });
        }
        
        await batch.commit();
        // Cache locally
        await cacheHadiths(book.id, language, hadithsToCache);
      }

      if (editionId) {
        await updateDoc(doc(db, 'hadith_editions', editionId), {
          lastSyncedAt: new Date().toISOString()
        });
      }

      await updateDoc(doc(db, 'hadith_books', book.id), {
        lastSyncedAt: new Date().toISOString()
      });

      setSyncProgress(prev => ({ ...prev, isSyncing: false }));
      fetchData();
    } catch (error: any) {
      console.error('Hadith Sync Error:', error);
      setSyncProgress(prev => ({ ...prev, isSyncing: false, error: error.message }));
    }
  };

  const syncChapterHadiths = async (book: HadithBook, chapter: any) => {
    setSyncProgress({
      isSyncing: true,
      currentSurah: 0,
      totalSurahs: 1,
      editionName: `${book.name} - Chapter ${chapter.chapterNumber}`,
      error: null,
    });

    try {
      const apiKey = '$2y$10$zBKMN41uis6ihOJnGbQGqOMvAugri3bY191hZlhdFtsfPjiCYO';
      // Use the public API as requested by the user
      const response = await fetch(`https://hadithapi.com/public/api/hadiths?apiKey=${apiKey}&bookslug=${book.id}&chapter=${chapter.chapterNumber}`);
      const data = await response.json();

      if (data.status !== 200 && data.status !== 'success') {
        throw new Error(data.message || 'Failed to fetch hadiths from API');
      }

      const hadiths = data.hadiths.data;
      const batch = writeBatch(db);
      
      for (const hadith of hadiths) {
        const hadithData = {
          number: hadith.hadithNumber,
          arabic: hadith.hadithArabic,
          english: {
            narrator: hadith.englishNarrator,
            text: hadith.hadithEnglish
          },
          urdu: {
            narrator: hadith.urduNarrator,
            text: hadith.hadithUrdu
          },
          chapterId: typeof hadith.chapterId === 'string' ? parseInt(hadith.chapterId) : hadith.chapterId,
          bookSlug: hadith.bookSlug,
          status: hadith.status
        };

        const hadithRef = doc(db, 'hadith_content', book.id, 'hadiths', hadith.hadithNumber.toString());
        batch.set(hadithRef, hadithData);
      }
      
      await batch.commit();
      
      // Update chapter in index to mark as synced
      const chapterRef = doc(db, 'hadith_index', chapter.id);
      await updateDoc(chapterRef, {
        lastSyncedAt: new Date().toISOString()
      });

      // Update local state
      setIndexChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, lastSyncedAt: new Date().toISOString() } : c));

      setSyncProgress(prev => ({ ...prev, isSyncing: false }));
      alert(`Chapter ${chapter.chapterNumber} synced successfully!`);
    } catch (error: any) {
      console.error('Chapter Sync Error:', error);
      setSyncProgress(prev => ({ ...prev, isSyncing: false, error: error.message }));
    }
  };

  const filteredEditions = editions.filter(ed => {
    const matchesType = quranFilterType === 'all' || ed.type === quranFilterType;
    const matchesLanguage = quranFilterLanguage === 'all' || ed.language === quranFilterLanguage;
    const matchesSearch = ed.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (ed.englishName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         ed.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesLanguage && matchesSearch;
  });

  const menuItems = [
    { id: 'quran', label: 'Quran', icon: BookOpen },
    { id: 'quran_types', label: 'Edition Types', icon: Languages },
    { id: 'languages', label: 'Languages', icon: Globe },
    { id: 'hadith', label: 'Hadith', icon: Moon },
    { id: 'videos', label: 'Video Gallery', icon: VideoIcon },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'app', label: 'App Management', icon: Settings },
  ];

  return (
    <ErrorBoundary>
      <div className="flex flex-col lg:flex-row gap-8 min-h-[80vh]">
      {/* Admin Sidebar */}
      <aside className="lg:w-64 space-y-2">
        <div className="p-4 mb-6 bg-emerald-900 text-white rounded-2xl shadow-lg">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h2 className="font-bold text-lg">Admin Panel</h2>
          </div>
          <p className="text-[10px] text-emerald-300 uppercase tracking-widest mt-1 font-bold">System Control</p>
        </div>
        
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as AdminTab);
                setIsAdding(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeTab === item.id 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-stone-500 hover:bg-white hover:text-emerald-600'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-2xl font-bold text-stone-900 capitalize">{activeTab.replace('_', ' ')}</h3>
          <div className="flex gap-3">
            {activeTab === 'quran' && (
              <button 
                onClick={syncEditions}
                className="px-6 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-all flex items-center gap-2 text-sm"
              >
                <Globe className="w-4 h-4" />
                Sync from API
              </button>
            )}
            {(activeTab === 'quran' || activeTab === 'hadith' || activeTab === 'videos' || activeTab === 'languages') && (
              <button 
                onClick={() => setIsAdding(true)}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add New
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Content Sections */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-stone-400">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="font-medium">Fetching data...</p>
            </div>
          ) : (
            <>
              {activeTab === 'quran' && (
                <div className="space-y-6">
                  {/* Filters & Search */}
                  <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input 
                        type="text" 
                        placeholder="Search by name, author..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none transition-all"
                      />
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                      <select 
                        value={quranFilterType}
                        onChange={(e) => setQuranFilterType(e.target.value)}
                        className="flex-1 md:w-40 px-4 py-3 bg-white border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none appearance-none cursor-pointer"
                      >
                        <option value="all">All Types</option>
                        {quranTypes.map(t => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                      <select 
                        value={quranFilterLanguage}
                        onChange={(e) => setQuranFilterLanguage(e.target.value)}
                        className="flex-1 md:w-40 px-4 py-3 bg-white border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none appearance-none cursor-pointer"
                      >
                        <option value="all">All Languages</option>
                        {languages.map(l => (
                          <option key={l.id} value={l.name}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEditions.map(ed => (
                      <div 
                        key={ed.id} 
                        onClick={() => {
                          if (ed.enabled === false) return;
                          if ((ed as any).lastSyncedAt) {
                            onEditEdition(ed.id);
                          } else {
                            syncQuranContent(ed);
                          }
                        }}
                        className={`bg-stone-50 border ${ed.enabled === false ? 'opacity-60 grayscale cursor-default' : 'border-stone-100 cursor-pointer hover:border-emerald-200'} rounded-3xl p-6 flex flex-col justify-between hover:shadow-lg transition-all group relative`}
                      >
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div className={`w-12 h-12 ${ed.enabled === false ? 'bg-stone-200 text-stone-400' : 'bg-emerald-100 text-emerald-600'} rounded-2xl flex items-center justify-center`}>
                              <BookOpen className="w-6 h-6" />
                            </div>
                            <div className="flex gap-2">
                              <span className="px-3 py-1 bg-white border border-stone-200 text-stone-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                                {ed.type}
                              </span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleEdition(ed.id, ed.enabled || false);
                                }}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                                  ed.enabled === false 
                                  ? 'bg-stone-200 text-stone-500 hover:bg-emerald-100 hover:text-emerald-600' 
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                }`}
                              >
                                {ed.enabled === false ? 'Enable' : 'Disable'}
                              </button>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-bold text-stone-900 line-clamp-1">{ed.name}</h4>
                            <p className="text-xs text-stone-500 font-medium mt-1">{ed.author}</p>
                          </div>

                          {ed.enabled !== false && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                syncQuranContent(ed);
                              }}
                              className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-stone-100 hover:bg-emerald-50 hover:text-emerald-600 text-stone-600 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                            >
                              <RefreshCw className="w-3 h-3" />
                              {(ed as any).lastSyncedAt ? 'Re-Sync' : 'Sync Content'}
                            </button>
                          )}

                          <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">Identifier</p>
                              <p className="text-xs font-mono text-stone-600">{ed.identifier || 'manual'}</p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest text-right">Language</p>
                              <p className="text-xs text-stone-600 font-bold">
                                {languages.find(l => l.id === ed.languageCode || l.id === ed.language)?.name || ed.language}
                              </p>
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete('quran_editions', ed.id);
                          }}
                          className="absolute top-4 right-4 p-2 text-stone-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'quran_types' && (
                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-center bg-stone-50 p-6 rounded-3xl border border-stone-100">
                    <div>
                      <h2 className="text-xl font-bold text-stone-900">Quran Edition Types</h2>
                      <p className="text-sm text-stone-500">Fetch and sync the latest edition types from Al Quran Cloud API</p>
                    </div>
                    <button 
                      onClick={syncEditionTypes}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                    >
                      <Globe className="w-4 h-4" />
                      Sync from API
                    </button>
                  </div>
                  
                  {quranTypes.length === 0 ? (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-16 h-16 bg-stone-100 rounded-3xl flex items-center justify-center text-stone-300 mx-auto">
                        <Languages className="w-8 h-8" />
                      </div>
                      <p className="text-stone-500 font-medium">No edition types found. Click sync to fetch them.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                      {quranTypes.map(type => (
                        <div key={type.id} className="p-5 bg-white border border-stone-100 rounded-2xl flex justify-between items-center shadow-sm hover:shadow-md transition-shadow group">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 font-bold text-xs uppercase">
                              {type.name.substring(0, 2)}
                            </div>
                            <span className="font-bold text-stone-900 capitalize">{type.name}</span>
                          </div>
                          <button 
                            onClick={() => handleDelete('quran_edition_types', type.id)}
                            className="p-2 text-stone-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'languages' && (
                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-center bg-stone-50 p-6 rounded-3xl border border-stone-100">
                    <div>
                      <h2 className="text-xl font-bold text-stone-900">Languages</h2>
                      <p className="text-sm text-stone-500">Manage language codes and full names for Quran editions</p>
                    </div>
                    <button 
                      onClick={syncLanguages}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                    >
                      <Globe className="w-4 h-4" />
                      Sync Codes from API
                    </button>
                  </div>
                  
                  {languages.length === 0 ? (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-16 h-16 bg-stone-100 rounded-3xl flex items-center justify-center text-stone-300 mx-auto">
                        <Globe className="w-8 h-8" />
                      </div>
                      <p className="text-stone-500 font-medium">No languages found. Click sync to fetch codes.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                      {languages.map(lang => (
                        <div key={lang.id} className="p-5 bg-white border border-stone-100 rounded-2xl flex justify-between items-center shadow-sm hover:shadow-md transition-shadow group">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 font-bold text-xs uppercase">
                              {lang.code}
                            </div>
                            <span className="font-bold text-stone-900 capitalize">{lang.name}</span>
                          </div>
                          <button 
                            onClick={() => handleDelete('languages', lang.id)}
                            className="p-2 text-stone-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'hadith' && (
                <div className="space-y-6">
                  <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      {selectedHadithBook && (
                        <button 
                          onClick={() => setSelectedHadithBook(null)}
                          className="p-2 bg-white border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                      <div>
                        <h3 className="text-xl font-bold text-stone-900">
                          {selectedHadithBook ? `${selectedHadithBook.name} Editions` : 'Hadith Books'}
                        </h3>
                        <p className="text-sm text-stone-500">
                          {selectedHadithBook ? `Manage language editions for ${selectedHadithBook.name}` : 'Manage and sync hadith collections'}
                        </p>
                      </div>
                    </div>
                    {!selectedHadithBook && (
                      <button 
                        onClick={syncHadithBooks}
                        className="px-6 py-3 bg-stone-900 text-white rounded-2xl font-bold shadow-lg hover:bg-stone-800 transition-all flex items-center gap-2"
                      >
                        <RefreshCw className="w-5 h-5" />
                        Sync Books
                      </button>
                    )}
                  </div>

                  {selectedHadithBook ? (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                      {hadithEditions.map(edition => (
                        <div 
                          key={`edition-${edition.id}`}
                          className="bg-stone-50 border border-stone-100 rounded-3xl p-8 flex flex-col justify-between hover:shadow-lg transition-all group relative"
                        >
                          <div>
                            <div className="w-14 h-14 bg-emerald-900 text-emerald-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-900/20">
                              <Globe className="w-7 h-7" />
                            </div>
                            <h4 className="text-xl font-bold text-stone-900 mb-2">{edition.language} Edition</h4>
                            <p className="text-stone-500 text-sm font-medium mb-6">
                              Full index and hadith content for {selectedHadithBook.name} in {edition.language}.
                            </p>
                          </div>

                          <div className="pt-6 border-t border-stone-100 flex flex-col gap-4">
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                              <span className="text-stone-400">Status</span>
                              {edition.lastSyncedAt ? (
                                <span className="text-emerald-600 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Synced
                                </span>
                              ) : (
                                <span className="text-amber-600 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Not Synced
                                </span>
                              )}
                            </div>
                            
                            <button 
                              onClick={() => syncHadithIndex(selectedHadithBook, edition.id)}
                              className="w-full py-4 bg-white border border-stone-200 text-stone-900 rounded-2xl font-bold hover:bg-emerald-900 hover:text-white hover:border-emerald-900 transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                              <RefreshCw className="w-4 h-4" />
                              {edition.lastSyncedAt ? 'Resync Index' : 'Sync Index'}
                            </button>

                            {edition.lastSyncedAt && (
                              <button 
                                onClick={() => handleShowIndex(selectedHadithBook, edition)}
                                className="w-full py-4 bg-emerald-900 text-white rounded-2xl font-bold hover:bg-emerald-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                              >
                                <BookOpen className="w-4 h-4" />
                                Show Index
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {books.map(book => (
                        <div 
                          key={`book-${book.id}`} 
                          onClick={() => {
                            setSelectedHadithBook(book);
                            fetchHadithEditions(book);
                          }}
                          className="bg-stone-50 border border-stone-100 rounded-3xl p-6 flex flex-col justify-between hover:shadow-lg transition-all group relative cursor-pointer"
                        >
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <div className="w-12 h-12 bg-emerald-900 text-emerald-400 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
                                <Book className="w-6 h-6" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-100">
                                  {languages.find(l => l.id === book.languageCode || l.id === book.language)?.name || book.language}
                                </span>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete('hadith_books', book.id);
                                  }}
                                  className="p-2 text-stone-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <h4 className="text-lg font-bold text-stone-900 mb-1 group-hover:text-emerald-700 transition-colors">{book.name}</h4>
                            <p className="text-sm text-stone-500 font-medium mb-4">{book.author}</p>
                            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {book.hadithsCount || 0} Hadiths
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                                {book.chaptersCount || 0} Chapters
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-6 pt-6 border-t border-stone-100 flex justify-between items-center">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                              {book.lastSyncedAt ? (
                                <span className="text-emerald-600">Synced {new Date(book.lastSyncedAt).toLocaleDateString()}</span>
                              ) : (
                                <span className="text-amber-600">Not Synced</span>
                              )}
                            </div>
                            <div className="w-8 h-8 bg-white border border-stone-200 rounded-lg flex items-center justify-center text-stone-400 group-hover:bg-emerald-900 group-hover:text-white group-hover:border-emerald-900 transition-all">
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'videos' && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                  {videos.map(video => (
                    <div key={video.id} className="bg-stone-50 rounded-2xl border border-stone-100 overflow-hidden group relative">
                      <div className="aspect-video bg-stone-200 relative">
                        {video.thumbnail ? (
                          <img src={video.thumbnail} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400">
                            <VideoIcon className="w-10 h-10" />
                          </div>
                        )}
                        <button 
                          onClick={() => handleDelete('videos', video.id)}
                          className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="p-4">
                        <h4 className="font-bold text-stone-900 truncate">{video.title}</h4>
                        <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mt-1">{video.category || 'Uncategorized'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'users' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">User</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Email</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Role</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {users.map(u => (
                        <tr key={u.uid} className="hover:bg-stone-50/50">
                          <td className="px-6 py-4 font-bold">{u.displayName || 'Anonymous'}</td>
                          <td className="px-6 py-4 text-sm text-stone-600">{u.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                              u.role === 'admin' ? 'bg-emerald-900 text-emerald-400' : 'bg-stone-100 text-stone-600'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleUpdateRole(u.uid, u.role === 'admin' ? 'user' : 'admin')}
                              className="text-xs font-bold text-emerald-600 hover:underline"
                            >
                              Toggle Role
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'app' && (
                <div className="p-8 space-y-8 max-w-2xl">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-6 bg-stone-50 rounded-2xl border border-stone-100">
                      <div>
                        <h4 className="font-bold text-stone-900">Maintenance Mode</h4>
                        <p className="text-xs text-stone-500">Disable app access for regular users.</p>
                      </div>
                      <button 
                        onClick={() => setAppSettings(prev => ({ ...prev, maintenanceMode: !prev.maintenanceMode }))}
                        className={`w-14 h-8 rounded-full transition-all relative ${appSettings.maintenanceMode ? 'bg-red-600' : 'bg-stone-200'}`}
                      >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${appSettings.maintenanceMode ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Global Announcement</label>
                      <textarea 
                        value={appSettings.announcement}
                        onChange={e => setAppSettings(prev => ({ ...prev, announcement: e.target.value }))}
                        placeholder="Enter message for all users..."
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-emerald-600 outline-none h-32 resize-none"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveSettings}
                    className="w-full py-4 bg-emerald-900 text-white rounded-2xl font-bold shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3"
                  >
                    <Save className="w-5 h-5" />
                    Save Global Settings
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {syncProgress.isSyncing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-[3rem] shadow-2xl w-full max-w-md text-center space-y-6 border border-emerald-100"
            >
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"></div>
                <motion.div 
                  className="absolute inset-0 border-4 border-emerald-600 border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                ></motion.div>
                <div className="absolute inset-0 flex items-center justify-center text-emerald-600 font-bold text-xl">
                  {Math.round((syncProgress.currentSurah / syncProgress.totalSurahs) * 100)}%
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-stone-900">
                  {syncProgress.totalSurahs === 114 ? 'Syncing Quran Content' : 'Syncing Hadith Content'}
                </h3>
                <p className="text-stone-500 text-sm font-medium">{syncProgress.editionName}</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                  <span>Progress</span>
                  <span>
                    {syncProgress.totalSurahs === 114 ? 'Surah' : 'Batch'} {syncProgress.currentSurah} of {syncProgress.totalSurahs}
                  </span>
                </div>
                <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-emerald-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${(syncProgress.currentSurah / syncProgress.totalSurahs) * 100}%` }}
                  ></motion.div>
                </div>
              </div>

              <p className="text-xs text-stone-400 italic">Please do not close this window until sync is complete.</p>
            </motion.div>
          </motion.div>
        )}

        {syncProgress.error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
          >
            <motion.div className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-center space-y-4 border border-red-100">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-stone-900">Sync Failed</h3>
              <p className="text-stone-500 text-sm">{syncProgress.error}</p>
              <button 
                onClick={() => setSyncProgress(prev => ({ ...prev, error: null }))}
                className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold"
              >
                Dismiss
              </button>
            </motion.div>
          </motion.div>
        )}

        {isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-xl border border-stone-100"
            >
              <div className="flex justify-between items-center mb-8 border-b border-stone-100 pb-4">
                <h3 className="text-2xl font-bold text-emerald-900">Add New {activeTab}</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 text-stone-400 hover:text-red-600 transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAdd} className="space-y-6">
                {activeTab === 'quran' && (
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Edition Name" required value={quranForm.name} onChange={e => setQuranForm({...quranForm, name: e.target.value})} className="col-span-2 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none" />
                    <select 
                      required 
                      value={quranForm.languageCode} 
                      onChange={e => {
                        const selectedLang = languages.find(l => l.id === e.target.value);
                        setQuranForm({
                          ...quranForm, 
                          languageCode: e.target.value,
                          language: selectedLang ? selectedLang.name : e.target.value
                        });
                      }} 
                      className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                    >
                      <option value="">Select Language</option>
                      {languages.map(l => (
                        <option key={l.id} value={l.id}>{l.name} ({l.id})</option>
                      ))}
                    </select>
                    <input placeholder="Author" required value={quranForm.author} onChange={e => setQuranForm({...quranForm, author: e.target.value})} className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none" />
                  </div>
                )}

                {activeTab === 'hadith' && (
                  <div className="space-y-4">
                    <input placeholder="Book Name" required value={hadithForm.name} onChange={e => setHadithForm({...hadithForm, name: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none" />
                    <input placeholder="Author" required value={hadithForm.author} onChange={e => setHadithForm({...hadithForm, author: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none" />
                    <textarea placeholder="Description" required value={hadithForm.description} onChange={e => setHadithForm({...hadithForm, description: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none h-24" />
                  </div>
                )}

                {activeTab === 'videos' && (
                  <div className="space-y-4">
                    <input placeholder="Video Title" required value={videoForm.title} onChange={e => setVideoForm({...videoForm, title: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none" />
                    <input placeholder="Video URL (YouTube/Vimeo)" required value={videoForm.url} onChange={e => setVideoForm({...videoForm, url: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none" />
                    <input placeholder="Category" value={videoForm.category} onChange={e => setVideoForm({...videoForm, category: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none" />
                  </div>
                )}

                {activeTab === 'languages' && (
                  <div className="space-y-4">
                    <input placeholder="Language Code (e.g. en)" required value={languageForm.code} onChange={e => setLanguageForm({...languageForm, code: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none" />
                    <input placeholder="Full Language Name (e.g. English)" required value={languageForm.name} onChange={e => setLanguageForm({...languageForm, name: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none" />
                  </div>
                )}

                <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition-all uppercase tracking-widest text-xs">
                  Save Entry
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
        {viewingIndex && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col border border-stone-100"
            >
              <div className="flex justify-between items-center mb-6 border-b border-stone-100 pb-4">
                <div>
                  <h3 className="text-2xl font-bold text-emerald-900">{viewingIndex.book.name} Index</h3>
                  <p className="text-sm text-stone-500">{viewingIndex.edition.language} Edition - {indexChapters.length} Chapters</p>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => syncHadithContent(viewingIndex.book, viewingIndex.edition.id)}
                    className="px-4 py-2 bg-emerald-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-800 transition-all flex items-center gap-2"
                  >
                    <Database className="w-3.5 h-3.5" />
                    Sync Full Content
                  </button>
                  <button onClick={() => setViewingIndex(null)} className="p-2 text-stone-400 hover:text-red-600 transition-all">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {isIndexLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-stone-400">
                    <RefreshCw className="w-10 h-10 animate-spin" />
                    <p className="font-medium">Loading index...</p>
                  </div>
                ) : indexChapters.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <Info className="w-12 h-12 text-stone-300 mx-auto" />
                    <p className="text-stone-500 font-medium">No chapters found for this index.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {indexChapters.map((chapter) => (
                      <div key={`chapter-index-${chapter.id}`} className="p-4 bg-stone-50 border border-stone-100 rounded-2xl flex justify-between items-center hover:bg-white hover:border-emerald-200 transition-all group">
                        <div className="flex items-center gap-4">
                          <span className="w-10 h-10 bg-white border border-stone-200 rounded-xl flex items-center justify-center text-xs font-bold text-stone-600">
                            {chapter.chapterNumber}
                          </span>
                          <div>
                            <p className="font-bold text-stone-900">{chapter.chapterName}</p>
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Chapter {chapter.chapterNumber}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-stone-400">{chapter.id}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              syncChapterHadiths(viewingIndex.book, chapter);
                            }}
                            className="p-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Sync
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}
