import React, { useState, useEffect } from 'react';
import { Moon, Search, Book, ChevronRight, Info, Star, Bookmark, Share2, RefreshCw, Globe, Settings, List, LayoutGrid, CheckCircle2, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { HadithBook, HadithEdition } from '../types';
import { 
  cacheHadithBook, 
  getCachedHadithBook, 
  cacheHadithBooks, 
  getCachedHadithBooks 
} from '../services/dbService';
import { handleFirestoreError, OperationType } from '../services/firestoreService';

interface Chapter {
  id: string | number;
  chapterNumber: number;
  chapterName: string;
  chapterArabic: string;
  language: string;
}

interface Hadith {
  id: string | number;
  hadithNumber: string;
  arabic: string;
  chapterId: number;
  status?: string;
  english?: {
    narrator: string;
    text: string;
  };
  urdu?: {
    narrator: string;
    text: string;
  };
}

interface HadithLibraryProps {
  onDisplayModeChange?: (isReader: boolean) => void;
}

export default function HadithLibrary({ onDisplayModeChange }: HadithLibraryProps) {
  const [hadiths, setHadiths] = useState<Hadith[]>([]);
  const [chapters, setChapters] = useState<Record<number, string>>({});
  const [chaptersList, setChaptersList] = useState<Chapter[]>([]);
  const [books, setBooks] = useState<HadithBook[]>([]);
  const [editions, setEditions] = useState<HadithEdition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBooksLoading, setIsBooksLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>('English');
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [viewMode, setViewMode] = useState<'hadiths' | 'index'>('index');
  const [displayMode, setDisplayMode] = useState<'list' | 'reader'>('list');

  useEffect(() => {
    if (onDisplayModeChange) {
      onDisplayModeChange(!!selectedBook);
    }
  }, [selectedBook, onDisplayModeChange]);

  const [selectedHadithIndex, setSelectedHadithIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<number>(0); // 1 for next, -1 for prev

  const toArabicNumber = (num: string | number) => {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(d => {
      const digit = parseInt(d);
      return isNaN(digit) ? d : arabicDigits[digit];
    }).join('');
  };

  const handleCopy = (hadith: Hadith) => {
    const textToCopy = `${hadith.arabic}\n\n${selectedLanguage === 'English' ? hadith.english?.text : hadith.urdu?.text}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(hadith.id.toString());
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  useEffect(() => {
    if (selectedBook) {
      fetchEditions();
      setViewMode('index');
      // If no language is selected, default to English
      if (!selectedLanguage || selectedLanguage === 'ar') {
        setSelectedLanguage('English');
      }
    } else {
      setEditions([]);
      setSelectedLanguage('English');
      setViewMode('index');
      setSelectedChapter(null);
    }
  }, [selectedBook]);

  useEffect(() => {
    if (selectedBook && selectedLanguage) {
      if (selectedChapter) {
        fetchHadiths(selectedChapter);
      } else {
        // Build index
        fetchHadiths();
      }
      setSelectedHadithIndex(0);
    } else {
      setHadiths([]);
      setSelectedHadithIndex(0);
    }
  }, [selectedBook, selectedLanguage, selectedChapter]);

  useEffect(() => {
    if (selectedBook && editions.length > 0 && !selectedLanguage) {
      // Default to Arabic if available and synced, otherwise English, otherwise first synced edition
      const arabicEd = editions.find(e => e.language === 'Arabic' && e.lastSyncedAt);
      const englishEd = editions.find(e => e.language === 'English' && e.lastSyncedAt);
      const firstSynced = editions.find(e => e.lastSyncedAt);
      
      if (arabicEd) {
        setSelectedLanguage('Arabic');
      } else if (englishEd) {
        setSelectedLanguage('English');
      } else if (firstSynced) {
        setSelectedLanguage(firstSynced.language);
      } else {
        // If nothing synced, default to Arabic anyway to show the "No Hadiths" message
        setSelectedLanguage('Arabic');
      }
    }
  }, [selectedBook, editions, selectedLanguage]);

  const fetchBooks = async () => {
    setIsBooksLoading(true);
    const path = 'hadith_books';
    try {
      // Try cache first
      const cachedBooks = await getCachedHadithBooks();
      if (cachedBooks && cachedBooks.length > 0) {
        setBooks(cachedBooks);
        setIsBooksLoading(false);
        return;
      }

      const snap = await getDocs(collection(db, path));
      const booksData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HadithBook));
      setBooks(booksData);
      await cacheHadithBooks(booksData);
    } catch (error) {
      console.error('Error fetching books:', error);
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      if (errorMessage.includes('quota') || errorMessage.includes('permission')) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    } finally {
      setIsBooksLoading(false);
    }
  };

  const fetchEditions = async () => {
    if (!selectedBook) return;
    const path = 'hadith_editions';
    try {
      const q = query(collection(db, path), where('bookId', '==', selectedBook));
      const snap = await getDocs(q);
      setEditions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HadithEdition)));
    } catch (error) {
      console.error('Error fetching editions:', error);
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      if (errorMessage.includes('quota') || errorMessage.includes('permission')) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  };

  const fetchHadiths = async (chapter?: Chapter) => {
    if (!selectedBook || !selectedLanguage) return;
    setIsLoading(true);
    
    try {
      // 1. Always fetch chapters for this book and language to show chapter names/index
      const indexPath = 'hadith_index';
      let chaptersQuery = query(
        collection(db, indexPath),
        where('bookId', '==', selectedBook),
        where('language', '==', selectedLanguage)
      );
      let chaptersSnap = await getDocs(chaptersQuery);

      // Fallback: if no chapters found for selected language, try to find any chapters for this book
      if (chaptersSnap.empty) {
        chaptersQuery = query(
          collection(db, indexPath),
          where('bookId', '==', selectedBook),
          limit(300)
        );
        chaptersSnap = await getDocs(chaptersQuery);
      }

      const chaptersMap: Record<number, string> = {};
      const chaptersArr: Chapter[] = [];
      const seenChapters = new Set<number>();

      chaptersSnap.docs.forEach(doc => {
        const data = doc.data();
        const chNum = typeof data.chapterNumber === 'string' ? parseInt(data.chapterNumber) : data.chapterNumber;
        
        if (!seenChapters.has(chNum) || data.language === selectedLanguage) {
          chaptersMap[chNum] = data.chapterName;
          
          const existingIndex = chaptersArr.findIndex(c => c.chapterNumber === chNum);
          const chapterData = {
            id: doc.id,
            chapterNumber: chNum,
            chapterName: data.chapterName,
            chapterArabic: data.chapterArabic || '',
            language: data.language
          };

          if (existingIndex >= 0) {
            if (data.language === selectedLanguage) {
              chaptersArr[existingIndex] = chapterData;
            }
          } else {
            chaptersArr.push(chapterData);
            seenChapters.add(chNum);
          }
        }
      });
      setChapters(chaptersMap);
      setChaptersList(chaptersArr.sort((a, b) => a.chapterNumber - b.chapterNumber));

      // 2. If a chapter is selected, fetch hadiths from the external API
      if (chapter) {
        const apiKey = '$2y$10$zBKMN41uis6ihOJnGbQGqOMvAugri3bY191hZlhdFtsfPjiCYO';
        const response = await fetch(`https://hadithapi.com/public/api/hadiths?apiKey=${apiKey}&bookslug=${selectedBook}&chapter=${chapter.chapterNumber}`);
        const data = await response.json();

        if (data.status === 200 || data.status === 'success') {
          const hadithsData = data.hadiths.data.map((h: any) => ({
            id: h.id,
            hadithNumber: h.hadithNumber,
            arabic: h.hadithArabic,
            chapterId: typeof h.chapterId === 'string' ? parseInt(h.chapterId) : h.chapterId,
            status: h.status,
            english: {
              narrator: h.englishNarrator,
              text: h.hadithEnglish
            },
            urdu: {
              narrator: h.urduNarrator,
              text: h.hadithUrdu
            }
          }));
          setHadiths(hadithsData);
        } else {
          console.error('API Error:', data.message);
          setHadiths([]);
        }
      } else {
        // If no chapter selected, we are in index mode, clear hadiths
        setHadiths([]);
      }
    } catch (error) {
      console.error('Error in fetchHadiths:', error);
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      if (errorMessage.includes('quota') || errorMessage.includes('permission')) {
        handleFirestoreError(error, OperationType.LIST, 'hadith_index');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBooks = books.filter(book => 
    book.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeBook = books.find(b => b.id === selectedBook);

  return (
    <div className="space-y-2 md:space-y-8">
      {/* Header Section - Only show when not in full-screen reader/index modes */}
      {!(selectedBook && (viewMode === 'index' || displayMode === 'reader')) && (
        <div className={`shrink-0 ${selectedBook ? 'sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200 -mx-4 px-4 py-3 mb-3' : 'mb-4'}`}>
          {!selectedBook ? (
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-stone-900">Hadith Library</h2>
                  <p className="text-stone-500 font-medium italic">
                    Verified collections of the Prophet's (ﷺ) sayings and actions.
                  </p>
                </div>
              </div>
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search collections..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-2xl pl-12 pr-6 py-4 text-sm focus:ring-2 focus:ring-emerald-600 outline-none shadow-sm transition-all"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    if (displayMode === 'reader') {
                      setDisplayMode('list');
                    } else if (viewMode === 'hadiths') {
                      setViewMode('index');
                      setSelectedChapter(null);
                    } else {
                      setSelectedBook(null);
                      setSelectedLanguage('English');
                    }
                  }}
                  className="p-2 text-stone-600 hover:bg-stone-100 rounded-full transition-all"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <div className="h-8 w-px bg-stone-200 mx-1"></div>
                <div>
                  <h3 className="font-bold text-lg text-emerald-900 leading-none">
                    {selectedChapter ? selectedChapter.chapterName : activeBook?.name}
                  </h3>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mt-1">
                    {selectedChapter ? activeBook?.name : (selectedBook ? 'Collection' : '')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <div className="relative">
                  <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-2 rounded-full transition-all ${showSettings ? 'bg-emerald-50 text-emerald-600' : 'text-stone-500 hover:text-emerald-600'}`}
                  >
                    <Settings className="w-5 h-5" />
                  </button>

                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-4 w-64 bg-white border border-stone-100 rounded-3xl shadow-2xl z-[70] p-4 space-y-4"
                      >
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-2">View Mode</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => { setViewMode('hadiths'); setShowSettings(false); }}
                              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'hadiths' ? 'bg-emerald-900 text-white' : 'bg-stone-50 text-stone-600 hover:bg-stone-100'}`}
                            >
                              <List className="w-3.5 h-3.5" />
                              Hadiths
                            </button>
                            <button 
                              onClick={() => { setViewMode('index'); setShowSettings(false); }}
                              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'index' ? 'bg-emerald-900 text-white' : 'bg-stone-50 text-stone-600 hover:bg-stone-100'}`}
                            >
                              <LayoutGrid className="w-3.5 h-3.5" />
                              Index
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-2">Translation Language</p>
                          <div className="space-y-1">
                            {['English', 'Urdu'].map((lang) => {
                              const edition = editions.find(e => e.language === lang);
                              const isSynced = !!edition?.lastSyncedAt;
                              return (
                                <button
                                  key={`lang-setting-${lang}`}
                                  disabled={!isSynced}
                                  onClick={() => { setSelectedLanguage(lang); setShowSettings(false); }}
                                  className={`w-full flex items-center justify-between px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedLanguage === lang ? 'bg-emerald-50 text-emerald-700' : isSynced ? 'text-stone-600 hover:bg-stone-50' : 'text-stone-300 cursor-not-allowed'}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Globe className="w-3.5 h-3.5" />
                                    {lang}
                                  </div>
                                  {selectedLanguage === lang && <CheckCircle2 className="w-3.5 h-3.5" />}
                                  {!isSynced && <span className="text-[8px] opacity-50">Soon</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {!selectedBook ? (
          <motion.div
            key="books-grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {isBooksLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm animate-pulse h-32" />
              ))
            ) : filteredBooks.length === 0 ? (
              <div className="col-span-full py-20 text-center">
                <p className="text-stone-400 font-medium">No collections found matching your search.</p>
              </div>
            ) : (
              filteredBooks.map((book) => (
                <button
                  key={`book-${book.id}`}
                  onClick={() => setSelectedBook(book.id)}
                  className="bg-white p-6 rounded-2xl border border-stone-200 text-left hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group flex items-center gap-6 shadow-sm h-32 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                  
                  <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-600 font-bold text-lg group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner shrink-0 relative z-10">
                    <Book className="w-6 h-6" />
                  </div>
                  
                  <div className="flex-1 min-w-0 relative z-10">
                    <h3 className="font-bold text-lg text-stone-900 group-hover:text-emerald-900 truncate">{book.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">{book.hadithsCount || 0} Hadiths</span>
                      <span className="w-1 h-1 bg-stone-300 rounded-full"></span>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">{book.chaptersCount || 0} Chapters</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div
            key="hadith-list"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-2"
          >
            {/* Language Selector Tabs (Hidden if settings used, but keeping for quick access if preferred) */}
            {viewMode === 'hadiths' && displayMode === 'list' && (
              <div className="flex gap-2 p-1 bg-stone-100 rounded-2xl w-fit mb-2 shrink-0">
                {['Arabic', 'English', 'Urdu'].map((lang) => {
                  const edition = editions.find(e => e.language === lang);
                  const isSynced = !!edition?.lastSyncedAt;
                  return (
                    <button
                      key={`lang-tab-${lang}`}
                      onClick={() => isSynced && setSelectedLanguage(lang)}
                      className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                        selectedLanguage === lang 
                          ? 'bg-white text-emerald-700 shadow-sm' 
                          : isSynced 
                            ? 'text-stone-500 hover:text-stone-900' 
                            : 'text-stone-300 cursor-not-allowed'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {lang}
                      {!isSynced && <span className="text-[8px] opacity-50">(Soon)</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-stone-400">
                <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="font-medium animate-pulse">Loading {viewMode === 'hadiths' ? 'Hadiths' : 'Index'}...</p>
              </div>
            ) : viewMode === 'index' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[40] bg-stone-50 flex flex-col overflow-hidden h-[100dvh] pb-20 md:pb-0"
              >
                {/* Fixed Header for Index (Matches Quran/Hadith Reader Style) */}
                <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 py-3 flex items-center justify-between z-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setSelectedBook(null);
                        setSelectedLanguage(null);
                      }}
                      className="p-2 text-stone-600 hover:bg-stone-100 rounded-full transition-all"
                    >
                      <ChevronRight className="w-5 h-5 rotate-180" />
                    </button>
                    <div className="h-8 w-px bg-stone-200 mx-1"></div>
                    <div>
                      <h3 className="font-bold text-lg text-emerald-900 leading-none mb-1">
                        {activeBook?.name}
                      </h3>
                      <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                        Table of Contents
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setShowSettings(!showSettings)}
                      className="p-2 text-stone-500 hover:text-emerald-600 transition-colors"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-4 pb-16">
                  <div className="max-w-4xl mx-auto grid grid-cols-1 gap-3">
                    {chaptersList.length === 0 ? (
                      <div className="bg-white p-12 rounded-[2.5rem] border border-stone-100 shadow-sm text-center">
                        <Info className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                        <p className="text-stone-500 font-medium">No chapters found for this collection.</p>
                        <p className="text-stone-400 text-sm mt-2">Admins can sync the index from the dashboard.</p>
                      </div>
                    ) : (
                      chaptersList.map((chapter) => (
                        <motion.div
                          key={`chapter-${chapter.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => {
                            setSelectedChapter(chapter);
                            setViewMode('hadiths');
                            setDisplayMode('reader');
                            setSelectedHadithIndex(0);
                          }}
                          className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all flex justify-between items-center gap-4 group cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm border border-emerald-100 shrink-0">
                              {chapter.chapterNumber}
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Chapter {chapter.chapterNumber}</p>
                              <p className="text-[10px] text-stone-500 font-medium italic">{chapter.language} Translation</p>
                            </div>
                          </div>
                          
                          <div className="flex-1 text-right">
                            <p className="text-lg font-arabic text-stone-900 leading-relaxed line-clamp-1">
                              {chapter.chapterArabic}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="p-3 bg-stone-50 text-stone-400 group-hover:bg-emerald-900 group-hover:text-white rounded-xl transition-all">
                              <ChevronRight className="w-5 h-5" />
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            ) : hadiths.length === 0 ? (
              <div className="bg-white p-12 rounded-[2.5rem] border border-stone-100 shadow-sm text-center">
                <Info className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                <p className="text-stone-500 font-medium">No Hadiths synced for this collection yet.</p>
                <p className="text-stone-400 text-sm mt-2">Admins can sync content from the dashboard.</p>
              </div>
            ) : displayMode === 'reader' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[40] bg-stone-50 flex flex-col overflow-hidden h-[100dvh] pb-20 md:pb-0"
              >
                {/* Optimized Header (Matches Quran Style) */}
                <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 py-3 flex items-center justify-between z-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setDisplayMode('list')}
                      className="p-2 text-stone-600 hover:bg-stone-100 rounded-full transition-all"
                    >
                      <ChevronRight className="w-5 h-5 rotate-180" />
                    </button>
                    <div className="h-8 w-px bg-stone-200 mx-1"></div>
                    <div>
                      <h3 className="font-bold text-lg text-emerald-900 leading-none mb-1">
                        {selectedChapter?.chapterName || chapters[hadiths[selectedHadithIndex]?.chapterId] || 'General'}
                      </h3>
                      <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                        {activeBook?.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setShowSettings(!showSettings)}
                      className="p-2 text-stone-500 hover:text-emerald-600 transition-colors"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                </header>

                <div className="flex-1 relative flex flex-col items-center justify-center p-2 md:p-8 overflow-hidden pb-16 md:pb-8">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`reader-hadith-${hadiths[selectedHadithIndex].id}`}
                      initial={{ opacity: 0, scale: 0.9, x: swipeDirection * -100 }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1, 
                        x: 0,
                        rotate: dragX / 40
                      }}
                      exit={{ opacity: 0, scale: 0.9, x: swipeDirection * 100 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      onDrag={(_, info) => setDragX(info.offset.x)}
                      onDragEnd={(_, info) => {
                        const threshold = 100;
                        if (info.offset.x > threshold) {
                          // Swipe Right -> Next Hadith
                          setSwipeDirection(1);
                          if (selectedHadithIndex < hadiths.length - 1) {
                            setSelectedHadithIndex(prev => prev + 1);
                          }
                        } else if (info.offset.x < -threshold) {
                          // Swipe Left -> Previous Hadith
                          setSwipeDirection(-1);
                          if (selectedHadithIndex > 0) {
                            setSelectedHadithIndex(prev => prev - 1);
                          }
                        }
                        setDragX(0);
                      }}
                      className="w-full max-w-4xl cursor-grab active:cursor-grabbing h-full relative"
                    >
                      <div className="bg-white rounded-[3rem] border border-stone-200 shadow-2xl overflow-hidden flex flex-col h-full">
                        {/* Actions Bar */}
                        <div className="p-4 md:p-6 bg-stone-50/50 border-b border-stone-100 flex items-center justify-between shrink-0">
                          <div className="flex items-center gap-1">
                            <div className="flex items-center justify-center w-14 md:w-16 h-10 md:h-12 bg-emerald-600/10 rounded-r-full -ml-4 md:-ml-8 pr-2 md:pr-4 text-emerald-700 font-arabic text-lg md:text-xl border-y border-r border-emerald-600/20 shadow-sm">
                              {toArabicNumber(hadiths[selectedHadithIndex].hadithNumber)}
                            </div>
                            <div className="ml-2 md:ml-4">
                              <span className="text-[9px] md:text-[10px] text-stone-400 font-bold uppercase tracking-widest block">
                                Hadith {hadiths[selectedHadithIndex].hadithNumber}
                              </span>
                            </div>
                            {hadiths[selectedHadithIndex].status && (
                              <div className={`ml-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                hadiths[selectedHadithIndex].status === 'Sahih' || hadiths[selectedHadithIndex].status === 'Verified' ? 'bg-emerald-100 text-emerald-700' :
                                hadiths[selectedHadithIndex].status === 'Hasan' ? 'bg-blue-100 text-blue-700' :
                                hadiths[selectedHadithIndex].status === 'Weak' || hadiths[selectedHadithIndex].status === 'Daif' ? 'bg-amber-100 text-amber-700' :
                                hadiths[selectedHadithIndex].status === 'Maudu' ? 'bg-red-100 text-red-700' :
                                'bg-stone-100 text-stone-700'
                              }`}>
                                {hadiths[selectedHadithIndex].status}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 md:gap-1">
                            <button 
                              onClick={() => handleCopy(hadiths[selectedHadithIndex])}
                              className="p-2 md:p-3 text-stone-400 hover:text-emerald-600 transition-colors"
                            >
                              {copiedId === hadiths[selectedHadithIndex].id.toString() ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                            </button>
                            <button className="p-2 md:p-3 text-stone-400 hover:text-rose-500 transition-colors">
                              <Bookmark className="w-5 h-5" />
                            </button>
                            <button className="p-2 md:p-3 text-stone-400 hover:text-emerald-600 transition-colors">
                              <Share2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-16 space-y-12 bg-white">
                          <div className="text-right leading-[2.5] text-stone-900" style={{ direction: 'rtl' }}>
                            <p className="text-3xl md:text-5xl font-arabic leading-relaxed">
                              {hadiths[selectedHadithIndex].arabic}
                            </p>
                          </div>
                          
                          <div className="space-y-6">
                            <div className="flex items-center gap-2">
                              <div className="h-px bg-emerald-100 flex-1"></div>
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] px-4">
                                Translation
                              </span>
                              <div className="h-px bg-emerald-100 flex-1"></div>
                            </div>
                            
                            <div className="pl-4 md:pl-8 border-l-4 border-emerald-100/50">
                              <p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest mb-4">
                                Narrated by {selectedLanguage === 'English' ? (hadiths[selectedHadithIndex].english?.narrator || 'Unknown') : (hadiths[selectedHadithIndex].urdu?.narrator || 'Unknown')}
                              </p>
                              <p className="text-xl md:text-2xl text-stone-700 leading-relaxed font-medium italic">
                                {selectedLanguage === 'English' ? (hadiths[selectedHadithIndex].english?.text || 'No English translation available.') : 
                                 selectedLanguage === 'Urdu' ? (hadiths[selectedHadithIndex].urdu?.text || 'No Urdu translation available.') : 
                                 'No translation selected.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* Navigation Controls removed as per user request */}
                </div>
              </motion.div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hadiths.map((hadith) => (
                <motion.div
                  key={`hadith-${hadith.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    setSelectedHadithIndex(hadiths.indexOf(hadith));
                    setDisplayMode('reader');
                  }}
                  className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col group transition-all hover:shadow-md cursor-pointer h-32"
                >
                  {/* Actions Bar (Matches Quran Style) */}
                  <div className="p-3 bg-stone-50/50 border-b border-stone-100 flex items-center justify-between shrink-0 relative z-20">
                    <div className="flex items-center gap-1">
                      <div className="flex items-center justify-center w-12 h-8 bg-emerald-600/10 rounded-r-full -ml-8 pr-2 text-emerald-700 font-arabic text-base border-y border-r border-emerald-600/20 shadow-sm">
                        {toArabicNumber(hadith.hadithNumber)}
                      </div>
                      <div className="ml-2">
                        <span className="text-[8px] text-stone-400 font-bold uppercase tracking-widest block">
                          Hadith {hadith.hadithNumber}
                        </span>
                      </div>
                      {hadith.status && (
                        <div className={`ml-2 px-2 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest ${
                          hadith.status === 'Sahih' || hadith.status === 'Verified' ? 'bg-emerald-100 text-emerald-700' :
                          hadith.status === 'Hasan' ? 'bg-blue-100 text-blue-700' :
                          hadith.status === 'Weak' || hadith.status === 'Daif' ? 'bg-amber-100 text-amber-700' :
                          hadith.status === 'Maudu' ? 'bg-red-100 text-red-700' :
                          'bg-stone-100 text-stone-700'
                        }`}>
                          {hadith.status}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleCopy(hadith); }}
                        className="p-1.5 text-stone-400 hover:text-emerald-600 transition-colors"
                      >
                        {copiedId === hadith.id.toString() ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 space-y-2 overflow-hidden flex-1">
                    <div className="text-right leading-relaxed text-stone-900" style={{ direction: 'rtl' }}>
                      <p className="text-base font-arabic opacity-90 group-hover:opacity-100 transition-opacity line-clamp-1">
                        {hadith.arabic}
                      </p>
                    </div>
                    
                    <div className="pl-3 border-l-2 border-emerald-100/50">
                      <p className="text-xs text-stone-700 leading-snug font-medium italic line-clamp-1">
                        {selectedLanguage === 'English' ? (hadith.english?.text || 'No English translation available.') : 
                         selectedLanguage === 'Urdu' ? (hadith.urdu?.text || 'No Urdu translation available.') : 
                         'No translation selected.'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
}
