import React, { useState, useEffect, useRef } from 'react';
import { Book, Search, ChevronLeft, ChevronRight, Play, Pause, Volume2, Info, BookOpen, Settings, X, Globe, Headphones, Languages, Type, AlertCircle, Heart, Share2, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  cacheQuranSurah, 
  getCachedQuranSurah, 
  cacheQuranEditions, 
  getCachedQuranEditions,
  cacheQuranPage,
  getCachedQuranPage
} from '../services/dbService';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold">Something went wrong</h2>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-emerald-600 text-white rounded-xl">Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean;
  audio?: string;
}

interface QuranSettings {
  language: string;
  edition: string;
  showAudio: boolean;
  showTransliteration: boolean;
  showTranslation: boolean;
}

interface QuranEdition {
  id: string;
  name: string;
  language: string;
  languageCode: string;
  identifier: string;
  type: string;
}

export default function QuranReader({ onReaderModeChange }: { onReaderModeChange: (active: boolean) => void }) {
  return (
    <ErrorBoundary>
      <QuranReaderContent onReaderModeChange={onReaderModeChange} />
    </ErrorBoundary>
  );
}

function QuranReaderContent({ onReaderModeChange }: { onReaderModeChange: (active: boolean) => void }) {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [translations, setTranslations] = useState<any[]>([]);
  const [transliterations, setTransliterations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'reader'>('list');
  const [isPageView, setIsPageView] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [availableEditions, setAvailableEditions] = useState<QuranEdition[]>([]);
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [selectedLanguage, setSelectedLanguage] = useState<string>('English');
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('quran_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const [settings, setSettings] = useState<QuranSettings>(() => {
    const saved = localStorage.getItem('quran_settings');
    return saved ? JSON.parse(saved) : {
      language: 'English',
      edition: 'en.sahih',
      showAudio: true,
      showTransliteration: true,
      showTranslation: true
    };
  });

  useEffect(() => {
    localStorage.setItem('quran_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  };

  const toggleFavorite = (ayahKey: string) => {
    setFavorites(prev => {
      const isFav = prev.includes(ayahKey);
      if (isFav) {
        showToast('Removed from favorites', 'info');
        return prev.filter(k => k !== ayahKey);
      } else {
        showToast('Added to favorites', 'success');
        return [...prev, ayahKey];
      }
    });
  };

  useEffect(() => {
    onReaderModeChange(viewMode === 'reader');
  }, [viewMode, onReaderModeChange]);

  useEffect(() => {
    if (settings.language) {
      setSelectedLanguage(settings.language);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('quran_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const fetchInitialData = async () => {
      // 1. Try to load surahs from cache first
      const cachedSurahs = localStorage.getItem('quran_surahs_list');
      if (cachedSurahs) {
        setSurahs(JSON.parse(cachedSurahs));
        setIsLoading(false);
      }

      // Fetch fresh list from API
      fetch('https://api.alquran.cloud/v1/surah')
        .then(res => res.json())
        .then(data => {
          setSurahs(data.data);
          localStorage.setItem('quran_surahs_list', JSON.stringify(data.data));
          setIsLoading(false);
        });

      // 2. Fetch available editions (Try cache then Firestore)
      try {
        const cachedEds = await getCachedQuranEditions();
        if (cachedEds && cachedEds.length > 0) {
          setAvailableEditions(cachedEds);
        }

        const q = query(collection(db, 'quran_editions'), where('enabled', '==', true));
        const snap = await getDocs(q);
        const eds = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuranEdition));
        setAvailableEditions(eds);
        await cacheQuranEditions(eds);
      } catch (error) {
        console.error('Error fetching editions:', error);
      }
    };

    fetchInitialData();
  }, []);

  const fetchSurahContent = async (surahNumber: number) => {
    setIsLoading(true);
    try {
      const arabicEdition = 'quran-uthmani-min';
      const translationEdition = settings.edition;

      // Try loading from local IndexedDB cache first
      const cachedArabic = await getCachedQuranSurah(arabicEdition, surahNumber);
      const cachedTrans = await getCachedQuranSurah(translationEdition, surahNumber);

      if (cachedArabic && cachedTrans) {
        setAyahs(cachedArabic.ayahs);
        setTranslations(cachedTrans.ayahs);
        console.info(`Loaded Surah ${surahNumber} from local IndexedDB cache.`);
        setIsLoading(false);
        // If we have both, we can return early unless we need transliteration/audio
        if (!settings.showTransliteration && !settings.showAudio) return;
      }

      // 1. Fetch Arabic (Try Firestore then API)
      let arabicData;
      if (!cachedArabic) {
        try {
          const arabicDoc = await getDoc(doc(db, 'quran_content', arabicEdition, 'surahs', surahNumber.toString()));
          if (arabicDoc.exists()) {
            arabicData = arabicDoc.data();
          } else {
            const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/${arabicEdition}`);
            const json = await res.json();
            arabicData = json.data;
          }
        } catch (e) {
          const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/${arabicEdition}`);
          const json = await res.json();
          arabicData = json.data;
        }
        if (arabicData) {
          await cacheQuranSurah(arabicEdition, surahNumber, arabicData);
          setAyahs(arabicData.ayahs);
        }
      }

      // 2. Fetch Translation (Try Firestore then API)
      let translationData;
      if (!cachedTrans) {
        try {
          const transDoc = await getDoc(doc(db, 'quran_content', translationEdition, 'surahs', surahNumber.toString()));
          if (transDoc.exists()) {
            translationData = transDoc.data();
          } else {
            const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/${translationEdition}`);
            const json = await res.json();
            translationData = json.data;
          }
        } catch (e) {
          const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/${translationEdition}`);
          const json = await res.json();
          translationData = json.data;
        }
        if (translationData) {
          await cacheQuranSurah(translationEdition, surahNumber, translationData);
          setTranslations(translationData.ayahs);
        }
      }
      
      // 3. Optional: Transliteration
      if (settings.showTransliteration) {
        const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/en.transliteration`);
        const json = await res.json();
        setTransliterations(json.data.ayahs);
      }
      
      // 4. Optional: Audio
      if (settings.showAudio) {
        const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/ar.alafasy`);
        const json = await res.json();
        const audioAyahs = json.data.ayahs;
        setAyahs(prev => prev.map((a, i) => ({ ...a, audio: audioAyahs[i].audio })));
      }
    } catch (error) {
      console.error('Error fetching surah content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAudio = (ayah: Ayah) => {
    if (playingAyah === ayah.number) {
      audioRef.current?.pause();
      setPlayingAyah(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = ayah.audio || '';
        audioRef.current.play();
        setPlayingAyah(ayah.number);
      }
    }
  };

  const handleNextSurah = () => {
    if (selectedSurah && selectedSurah < 114) {
      setSelectedSurah(selectedSurah + 1);
      setCurrentAyahIndex(0);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevSurah = () => {
    if (selectedSurah && selectedSurah > 1) {
      setSelectedSurah(selectedSurah - 1);
      setCurrentAyahIndex(0);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const audio = new Audio();
    audio.onended = () => setPlayingAyah(null);
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (selectedSurah && viewMode === 'reader') {
      fetchSurahContent(selectedSurah);
    }
  }, [selectedSurah, viewMode, settings.edition, settings.showTransliteration, settings.showAudio]);

  const filteredSurahs = surahs.filter(s => 
    s.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.number.toString().includes(searchQuery)
  );

  if (isLoading && viewMode === 'list') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-stone-400">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-medium animate-pulse">Opening the Holy Quran...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center justify-between w-full md:w-auto gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-stone-900">The Holy Quran</h2>
                  <p className="text-stone-500 font-medium">Explore the divine message with translations and context.</p>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="md:hidden p-3 bg-white border border-stone-200 text-stone-600 rounded-2xl hover:bg-stone-50 transition-all"
                >
                  <Settings className="w-6 h-6" />
                </button>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search Surah name or number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-2xl pl-12 pr-6 py-4 text-sm focus:ring-2 focus:ring-emerald-600 outline-none shadow-sm transition-all"
                  />
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="hidden md:flex p-4 bg-white border border-stone-200 text-stone-600 rounded-2xl hover:bg-stone-50 transition-all items-center gap-2 shadow-sm"
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-sm font-bold">Settings</span>
                </button>
              </div>
            </div>

            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSurahs.map((surah) => (
                  <motion.button
                    key={surah.number}
                    whileHover={{ y: -4, scale: 1.01 }}
                    onClick={() => {
                      setSelectedSurah(surah.number);
                      setCurrentAyahIndex(0);
                      setViewMode('reader');
                    }}
                    className="bg-white p-6 rounded-2xl border border-stone-200 text-left hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group flex items-center gap-6 shadow-sm h-32"
                  >
                    <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-600 font-bold text-lg group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner shrink-0">
                      {surah.number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-lg text-stone-900 group-hover:text-emerald-900 truncate">{surah.englishName}</h3>
                        <span className="text-xl font-arabic text-emerald-600 shrink-0">{surah.name}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">{surah.revelationType}</span>
                        <span className="w-1 h-1 bg-stone-300 rounded-full"></span>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">{surah.numberOfAyahs} Ayahs</span>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <SurahReader
            key={`reader-${selectedSurah}`}
            selectedSurah={selectedSurah!}
            setSelectedSurah={setSelectedSurah}
            currentAyahIndex={currentAyahIndex}
            setCurrentAyahIndex={setCurrentAyahIndex}
            surahs={surahs}
            ayahs={ayahs}
            isLoading={isLoading}
            viewMode={viewMode}
            setViewMode={setViewMode}
            isPageView={isPageView}
            setIsPageView={setIsPageView}
            setIsSettingsOpen={setIsSettingsOpen}
            handlePrevSurah={handlePrevSurah}
            handleNextSurah={handleNextSurah}
            settings={settings}
            playingAyah={playingAyah}
            toggleAudio={toggleAudio}
            translations={translations}
            transliterations={transliterations}
            scrollContainerRef={scrollContainerRef}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            toast={toast}
            setToast={setToast}
          />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-stone-100"
            >
              <div className="flex justify-between items-center mb-8 border-b border-stone-100 pb-4">
                <div className="flex items-center gap-3">
                  <Settings className="w-6 h-6 text-emerald-600" />
                  <h3 className="text-2xl font-bold text-stone-900">Quran Settings</h3>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-stone-400 hover:text-red-600 transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {/* Favorites Section */}
                {favorites.length > 0 && (
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-widest">
                      <Heart className="w-4 h-4" />
                      Favorite Ayahs
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {favorites.map(fav => {
                        const [surahNum, ayahNum] = fav.split(':').map(Number);
                        const surah = surahs.find(s => s.number === surahNum);
                        return (
                          <button
                            key={fav}
                            onClick={() => {
                              setSelectedSurah(surahNum);
                              setCurrentAyahIndex(ayahNum - 1);
                              setViewMode('reader');
                              setIsSettingsOpen(false);
                            }}
                            className="flex items-center justify-between p-4 bg-stone-50 border border-stone-200 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 transition-all text-left group"
                          >
                            <div>
                              <p className="font-bold text-stone-900 group-hover:text-emerald-900">{surah?.englishName}</p>
                              <p className="text-xs text-stone-500">Ayah {ayahNum}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Language Selection */}
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-widest">
                    <Globe className="w-4 h-4" />
                    Language
                  </label>
                  <select 
                    value={selectedLanguage}
                    onChange={(e) => {
                      const lang = e.target.value;
                      setSelectedLanguage(lang);
                      const firstEd = availableEditions.find(ed => ed.language === lang);
                      if (firstEd) {
                        setSettings({ ...settings, language: lang, edition: firstEd.identifier });
                      }
                    }}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-emerald-600 outline-none transition-all"
                  >
                    {Array.from(new Set(availableEditions.map(ed => ed.language))).sort().map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>

                {/* Edition Selection */}
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-widest">
                    <BookOpen className="w-4 h-4" />
                    Translation Edition
                  </label>
                  <select 
                    value={settings.edition}
                    onChange={(e) => setSettings({ ...settings, edition: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-emerald-600 outline-none transition-all"
                  >
                    {availableEditions
                      .filter(ed => ed.language === selectedLanguage)
                      .map(ed => (
                        <option key={ed.identifier} value={ed.identifier}>
                          {ed.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => setSettings({ ...settings, showTranslation: !settings.showTranslation })}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${settings.showTranslation ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-stone-50 border-stone-200 text-stone-500'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Languages className="w-5 h-5" />
                      <span className="font-bold">Show Translation</span>
                    </div>
                    <div className={`w-10 h-6 rounded-full relative transition-all ${settings.showTranslation ? 'bg-emerald-600' : 'bg-stone-300'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.showTranslation ? 'right-1' : 'left-1'}`} />
                    </div>
                  </button>

                  <button 
                    onClick={() => setSettings({ ...settings, showTransliteration: !settings.showTransliteration })}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${settings.showTransliteration ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-stone-50 border-stone-200 text-stone-500'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Type className="w-5 h-5" />
                      <span className="font-bold">Show Transliteration</span>
                    </div>
                    <div className={`w-10 h-6 rounded-full relative transition-all ${settings.showTransliteration ? 'bg-emerald-600' : 'bg-stone-300'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.showTransliteration ? 'right-1' : 'left-1'}`} />
                    </div>
                  </button>

                  <button 
                    onClick={() => setSettings({ ...settings, showAudio: !settings.showAudio })}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${settings.showAudio ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-stone-50 border-stone-200 text-stone-500'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Headphones className="w-5 h-5" />
                      <span className="font-bold">Show Audio Player</span>
                    </div>
                    <div className={`w-10 h-6 rounded-full relative transition-all ${settings.showAudio ? 'bg-emerald-600' : 'bg-stone-300'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.showAudio ? 'right-1' : 'left-1'}`} />
                    </div>
                  </button>
                </div>

                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold shadow-lg hover:bg-stone-800 transition-all uppercase tracking-widest text-xs"
                >
                  Close Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 bg-stone-900 text-white rounded-full shadow-2xl border border-white/10"
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-stone-600'}`}>
              <Check className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SurahReader({ 
  selectedSurah, 
  setSelectedSurah,
  currentAyahIndex,
  setCurrentAyahIndex,
  surahs, 
  ayahs, 
  isLoading, 
  viewMode,
  setViewMode, 
  isPageView,
  setIsPageView,
  setIsSettingsOpen, 
  handlePrevSurah, 
  handleNextSurah, 
  settings, 
  playingAyah, 
  toggleAudio, 
  translations, 
  transliterations,
  scrollContainerRef,
  favorites,
  toggleFavorite,
  toast,
  setToast
}: any) {
  const [dragX, setDragX] = useState(0);
  const [pageAyahs, setPageAyahs] = useState<any[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<number>(0); // 1 for next, -1 for prev

  const currentAyah = ayahs[currentAyahIndex];

  useEffect(() => {
    if (isPageView && currentAyah?.page) {
      fetchPageData(currentAyah.page);
    }
  }, [isPageView, currentAyah?.page]);

  const fetchPageData = async (pageNumber: number) => {
    setIsPageLoading(true);
    try {
      // Try cache first
      const cachedPage = await getCachedQuranPage(pageNumber);
      if (cachedPage) {
        setPageAyahs(cachedPage.ayahs);
        setIsPageLoading(false);
        return;
      }

      const res = await fetch(`https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthmani`);
      const data = await res.json();
      setPageAyahs(data.data.ayahs);
      await cacheQuranPage(pageNumber, data.data);
    } catch (error) {
      console.error('Error fetching page data:', error);
      if (setToast) setToast({ message: 'Failed to load page view', type: 'info' });
    } finally {
      setIsPageLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    if (setToast) {
      setToast({ message, type });
      setTimeout(() => setToast(null), 2000);
    }
  };

  const toArabicNumber = (num: number) => {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(d => arabicDigits[parseInt(d)]).join('');
  };

  const isRTL = (text: string) => {
    if (!text) return false;
    const rtlChars = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
    return rtlChars.test(text);
  };

  const stripBismillah = (text: string, surahNumber: any, ayahNumber: number) => {
    const sNum = Number(surahNumber);
    if (sNum !== 1 && sNum !== 9 && ayahNumber === 1) {
      const words = text.trim().split(/\s+/);
      // If the first Ayah of a Surah (except 1 and 9) starts with Bismillah, remove it.
      // We check if the first word contains the core letters of 'Bismillah' (Ba, Seen, Meem)
      if (words.length >= 4 && words[0].includes("ب") && words[0].includes("س") && words[0].includes("م")) {
        return words.slice(4).join(" ").trim();
      }
    }
    return text;
  };

  const handleAyahDragEnd = (_: any, info: any) => {
    const threshold = 50;
    if (info.offset.x > threshold || info.velocity.x > 500) {
      // Swipe Right -> Next Ayah (RTL Forward)
      setSwipeDirection(1);
      if (currentAyahIndex < ayahs.length - 1) {
        setCurrentAyahIndex(prev => prev + 1);
      } else {
        handleNextSurah();
      }
    } else if (info.offset.x < -threshold || info.velocity.x < -500) {
      // Swipe Left -> Previous Ayah (RTL Backward)
      setSwipeDirection(-1);
      if (currentAyahIndex > 0) {
        setCurrentAyahIndex(prev => prev - 1);
      } else {
        handlePrevSurah();
      }
    }
    setDragX(0);
  };

  const handlePageDragEnd = async (_: any, info: any) => {
    const threshold = 50;
    const currentPage = currentAyah?.page;
    if (!currentPage) return;

    let targetPage = currentPage;
    if (info.offset.x > threshold || info.velocity.x > 500) {
      // Swipe Right -> Next Page (RTL Forward)
      setSwipeDirection(1);
      if (currentPage < 604) targetPage = currentPage + 1;
    } else if (info.offset.x < -threshold || info.velocity.x < -500) {
      // Swipe Left -> Previous Page (RTL Backward)
      setSwipeDirection(-1);
      if (currentPage > 1) targetPage = currentPage - 1;
    }

    if (targetPage !== currentPage) {
      setIsPageLoading(true);
      try {
        const res = await fetch(`https://api.alquran.cloud/v1/page/${targetPage}/quran-uthmani`);
        const data = await res.json();
        const firstAyah = data.data.ayahs[0];
        
        // Update parent state to the first ayah of the new page
        if (firstAyah.surah.number !== selectedSurah) {
          setSelectedSurah(firstAyah.surah.number);
          // The parent's useEffect will handle fetching new surah content
          // and we've already set currentAyahIndex to 0 in handleSurahSelect
          // but here we need to set it to the specific ayah in the new surah
          setCurrentAyahIndex(firstAyah.numberInSurah - 1);
        } else {
          setCurrentAyahIndex(firstAyah.numberInSurah - 1);
        }
      } catch (error) {
        console.error('Error swiping page:', error);
      } finally {
        setIsPageLoading(false);
      }
    }
    setDragX(0);
  };

  const surahData = surahs.find((s: any) => s.number === selectedSurah);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[40] bg-stone-50 flex flex-col overflow-hidden h-[100dvh] pb-20 md:pb-0"
    >
      {/* Optimized Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 pt-12 pb-3 md:py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setViewMode('list')}
            className="p-2 text-stone-600 hover:bg-stone-100 rounded-full transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="h-8 w-px bg-stone-200 mx-1"></div>
          <div>
            <h3 className="font-bold text-lg text-emerald-900 leading-none mb-1">
              {surahData?.englishName}
            </h3>
            <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
              {isPageView ? `Page ${currentAyah?.page}` : `Surah ${selectedSurah} • Ayah ${currentAyahIndex + 1}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsPageView(!isPageView)}
            className={`p-2 rounded-full transition-all border ${
              isPageView 
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
            }`}
            title={isPageView ? 'Ayat View' : 'Page View'}
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-stone-500 hover:text-emerald-600 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 w-full flex flex-col items-center overflow-hidden p-2 md:p-8 relative">
        {isLoading || (isPageView && isPageLoading) ? (
          <div className="flex flex-col items-center gap-4 text-stone-400">
            <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">
              {isPageView ? 'Loading Page...' : 'Loading Ayah...'}
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 w-full max-w-4xl relative h-full">
            <AnimatePresence mode="wait" initial={false}>
              {isPageView ? (
                <motion.div
                  key={`page-${currentAyah?.page}`}
                  initial={{ opacity: 0, scale: 0.95, x: swipeDirection * -100 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    x: 0,
                    rotate: dragX / 40
                  }}
                  exit={{ opacity: 0, scale: 0.95, x: swipeDirection * 100 }}
                  transition={{ type: "spring", stiffness: 400, damping: 40 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  dragDirectionLock
                  onDrag={(_, info) => setDragX(info.offset.x)}
                  onDragEnd={handlePageDragEnd}
                  className="absolute inset-0 bg-white rounded-[3rem] border border-stone-200 shadow-2xl overflow-hidden flex flex-col cursor-grab active:cursor-grabbing touch-pan-y"
                >
                  {/* Actions Bar (Now at Top) */}
                  <div className="p-3 md:p-4 bg-stone-50/50 border-b border-stone-100 flex items-center justify-between shrink-0 relative z-20">
                    <div className="flex items-center gap-1">
                      {/* Page Number Badge (Semi-circle style) */}
                      <div className="flex items-center justify-center w-12 h-10 bg-emerald-600/10 rounded-r-full -ml-3 md:-ml-4 pr-2 text-emerald-700 font-quran text-lg border-y border-r border-emerald-600/20 shadow-sm">
                        {currentAyah?.page ? toArabicNumber(currentAyah.page) : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {settings.showAudio && currentAyah?.audio && (
                        <button 
                          onClick={() => toggleAudio(currentAyah)}
                          className={`p-3 rounded-full transition-all ${
                            playingAyah === currentAyah.number 
                              ? 'bg-emerald-600 text-white shadow-lg' 
                              : 'text-stone-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={playingAyah === currentAyah.number ? 'Pause' : 'Listen'}
                        >
                          {playingAyah === currentAyah.number ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          const textToCopy = `${currentAyah?.text}\n\n${translations[currentAyahIndex]?.text}`;
                          navigator.clipboard.writeText(textToCopy).then(() => {
                            showToast('Ayah copied to clipboard');
                          });
                        }}
                        className="p-3 text-stone-400 hover:text-emerald-600 transition-colors"
                        title="Copy Ayah"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => toggleFavorite(`${selectedSurah}:${currentAyah?.numberInSurah}`)}
                        className={`p-3 transition-colors ${
                          favorites.includes(`${selectedSurah}:${currentAyah?.numberInSurah}`)
                            ? 'text-rose-500'
                            : 'text-stone-400 hover:text-rose-500'
                        }`}
                        title="Favorite"
                      >
                        <Heart className={`w-5 h-5 ${favorites.includes(`${selectedSurah}:${currentAyah?.numberInSurah}`) ? 'fill-current' : ''}`} />
                      </button>
                      <button className="p-3 text-stone-400 hover:text-emerald-600 transition-colors" title="Share">
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-16 md:pb-16 bg-white scroll-smooth font-quran">
                    <div className="text-right leading-[2.5] text-stone-900 pb-6" style={{ direction: 'rtl' }}>
                      {pageAyahs.map((ayah: any, idx: number) => {
                        return (
                          <span key={ayah.number} className="inline">
                            {/* Surah Header in Page View */}
                            {ayah.numberInSurah === 1 && (
                              <div className="w-full flex flex-col items-center my-12 first:mt-0">
                                <div className="px-8 py-2 bg-emerald-50 rounded-full border border-emerald-100 text-emerald-800 font-sans text-[10px] font-black uppercase tracking-[0.3em] mb-6">
                                  {ayah.surah.englishName}
                                </div>
                                {ayah.surah.number !== 1 && ayah.surah.number !== 9 && (
                                  <div className="text-3xl md:text-4xl text-emerald-800/60 mb-4">
                                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                                  </div>
                                )}
                              </div>
                            )}
                            <span 
                              className="text-3xl md:text-5xl transition-all duration-300 opacity-90 hover:opacity-100 cursor-pointer relative group/ayah"
                              onClick={() => toggleFavorite(`${ayah.surah.number}:${ayah.numberInSurah}`)}
                            >
                              {stripBismillah(ayah.text, ayah.surah.number, ayah.numberInSurah)}
                              <span className={`absolute -top-4 -right-4 opacity-0 group-hover/ayah:opacity-100 transition-opacity ${favorites.includes(`${ayah.surah.number}:${ayah.numberInSurah}`) ? 'opacity-100 text-rose-500' : 'text-stone-300'}`}>
                                <Heart className={`w-4 h-4 ${favorites.includes(`${ayah.surah.number}:${ayah.numberInSurah}`) ? 'fill-current' : ''}`} />
                              </span>
                            </span>
                            <span className="inline-flex items-center justify-center mx-2 text-2xl md:text-3xl text-emerald-700/40 align-middle translate-y-[-2px]">
                              ۝{toArabicNumber(ayah.numberInSurah)}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              ) : currentAyah && (
                <motion.div
                  key={`${selectedSurah}-${currentAyah.number}`}
                  initial={{ opacity: 0, scale: 0.9, x: swipeDirection * -100 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    x: 0,
                    rotate: dragX / 40
                  }}
                  exit={{ opacity: 0, scale: 0.9, x: swipeDirection * 100 }}
                  transition={{ type: "spring", stiffness: 400, damping: 40 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  dragDirectionLock
                  onDrag={(_, info) => setDragX(info.offset.x)}
                  onDragEnd={handleAyahDragEnd}
                  className="absolute inset-0 bg-white rounded-[3rem] border border-stone-200 shadow-2xl overflow-hidden flex flex-col cursor-grab active:cursor-grabbing touch-pan-y"
                >
                  {/* Actions Bar (Now at Top) */}
                  <div className="p-3 md:p-4 bg-stone-50/50 border-b border-stone-100 flex items-center justify-between shrink-0 relative z-20">
                    <div className="flex items-center gap-1">
                      {/* Ayah Number Badge (Semi-circle style) */}
                      <div className="flex items-center justify-center w-12 h-10 bg-emerald-600/10 rounded-r-full -ml-3 md:-ml-4 pr-2 text-emerald-700 font-arabic text-lg border-y border-r border-emerald-600/20 shadow-sm">
                        {toArabicNumber(currentAyah.numberInSurah)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {settings.showAudio && currentAyah.audio && (
                        <button 
                          onClick={() => toggleAudio(currentAyah)}
                          className={`p-3 rounded-full transition-all ${
                            playingAyah === currentAyah.number 
                              ? 'bg-emerald-600 text-white shadow-lg' 
                              : 'text-stone-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={playingAyah === currentAyah.number ? 'Pause' : 'Listen'}
                        >
                          {playingAyah === currentAyah.number ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          const textToCopy = `${currentAyah.text}\n\n${translations[currentAyahIndex]?.text}`;
                          navigator.clipboard.writeText(textToCopy).then(() => {
                            showToast('Ayah copied to clipboard');
                          });
                        }}
                        className="p-3 text-stone-400 hover:text-emerald-600 transition-colors"
                        title="Copy Ayah"
                      >
                        <span className="sr-only">Copy Ayah</span>
                        <Copy className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => toggleFavorite(`${selectedSurah}:${currentAyah.numberInSurah}`)}
                        className={`p-3 transition-colors ${
                          favorites.includes(`${selectedSurah}:${currentAyah.numberInSurah}`)
                            ? 'text-rose-500'
                            : 'text-stone-400 hover:text-rose-500'
                        }`}
                        title="Favorite"
                      >
                        <Heart className={`w-5 h-5 ${favorites.includes(`${selectedSurah}:${currentAyah.numberInSurah}`) ? 'fill-current' : ''}`} />
                      </button>
                      <button className="p-3 text-stone-400 hover:text-emerald-600 transition-colors" title="Share">
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-16 md:pb-16 bg-white scroll-smooth">
                    <div className="min-h-full flex flex-col items-center justify-start py-6 text-center">
                      {currentAyahIndex === 0 && selectedSurah !== 1 && selectedSurah !== 9 && (
                        <p className="text-xl md:text-3xl font-arabic text-emerald-800/60 mb-8">
                          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                        </p>
                      )}
                      
                      <p className="text-4xl md:text-6xl font-arabic text-stone-900 leading-[1.8] mb-12 text-right w-full">
                        {stripBismillah(currentAyah.text, selectedSurah, currentAyah.numberInSurah)}
                      </p>

                      {/* Divider */}
                      <div className="w-24 h-px bg-stone-200 mb-12"></div>
                      
                      <div className="space-y-6 max-w-2xl w-full">
                        {settings.showTransliteration && transliterations[currentAyahIndex] && (
                          <p 
                            className={`text-sm md:text-lg text-emerald-600 italic font-medium leading-relaxed opacity-80 w-full ${isRTL(transliterations[currentAyahIndex].text) ? 'text-right' : 'text-left'}`}
                            style={{ direction: isRTL(transliterations[currentAyahIndex].text) ? 'rtl' : 'ltr' }}
                          >
                            {transliterations[currentAyahIndex].text}
                          </p>
                        )}
                        {settings.showTranslation && translations[currentAyahIndex] && (
                          <p 
                            className={`text-lg md:text-2xl text-stone-600 leading-relaxed font-medium w-full ${isRTL(translations[currentAyahIndex].text) ? 'text-right' : 'text-left'}`}
                            style={{ direction: isRTL(translations[currentAyahIndex].text) ? 'rtl' : 'ltr' }}
                          >
                            {translations[currentAyahIndex].text}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
