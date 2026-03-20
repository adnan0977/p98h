import React, { useState, useEffect } from 'react';
import { Moon, Search, Book, ChevronRight, Info, Star, Bookmark, Share2, RefreshCw, Globe, Settings, List, LayoutGrid, CheckCircle2, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { HadithBook, HadithEdition } from '../types';

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
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
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
    } else {
      setEditions([]);
      setSelectedLanguage(null);
    }
  }, [selectedBook]);

  useEffect(() => {
    if (selectedBook && selectedLanguage) {
      fetchHadiths();
      setSelectedHadithIndex(0);
    } else {
      setHadiths([]);
      setSelectedHadithIndex(0);
    }
  }, [selectedBook, selectedLanguage]);

  useEffect(() => {
    if (selectedBook && editions.length > 0 && !selectedLanguage) {
      // Default to English if available and synced, otherwise first synced edition
      const englishEd = editions.find(e => e.language === 'English' && e.lastSyncedAt);
      const firstSynced = editions.find(e => e.lastSyncedAt);
      if (englishEd) {
        setSelectedLanguage('English');
      } else if (firstSynced) {
        setSelectedLanguage(firstSynced.language);
      } else {
        // If nothing synced, default to English anyway to show the "No Hadiths" message
        setSelectedLanguage('English');
      }
    }
  }, [selectedBook, editions, selectedLanguage]);

  const fetchBooks = async () => {
    setIsBooksLoading(true);
    try {
      const snap = await getDocs(collection(db, 'hadith_books'));
      const booksData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HadithBook));
      setBooks(booksData);
    } catch (error) {
      console.error('Error fetching books:', error);
    } finally {
      setIsBooksLoading(false);
    }
  };

  const fetchEditions = async () => {
    if (!selectedBook) return;
    try {
      const q = query(collection(db, 'hadith_editions'), where('bookId', '==', selectedBook));
      const snap = await getDocs(q);
      setEditions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HadithEdition)));
    } catch (error) {
      console.error('Error fetching editions:', error);
    }
  };

  const fetchHadiths = async () => {
    if (!selectedBook || !selectedLanguage) return;
    setIsLoading(true);
    try {
      // Fetch chapters for this book and language to show chapter names
      const chaptersQuery = query(
        collection(db, 'hadith_index'),
        where('bookId', '==', selectedBook),
        where('language', '==', selectedLanguage)
      );
      const chaptersSnap = await getDocs(chaptersQuery);
      const chaptersMap: Record<number, string> = {};
      const chaptersArr: Chapter[] = [];
      chaptersSnap.docs.forEach(doc => {
        const data = doc.data();
        chaptersMap[data.id] = data.chapterName;
        chaptersArr.push({
          id: doc.id,
          chapterNumber: data.chapterNumber,
          chapterName: data.chapterName,
          chapterArabic: data.chapterArabic || '',
          language: data.language
        });
      });
      setChapters(chaptersMap);
      setChaptersList(chaptersArr.sort((a, b) => a.chapterNumber - b.chapterNumber));

      const q = query(
        collection(db, 'hadith_content', selectedBook, 'hadiths'),
        orderBy('number'),
        limit(50)
      );
      const snap = await getDocs(q);
      const hadithList = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          hadithNumber: data.number?.toString() || '',
          arabic: data.arab || '',
          chapterId: data.chapterId,
          english: data.english ? {
            narrator: data.english.narrator || 'Unknown',
            text: data.english.text || 'No translation available.'
          } : undefined,
          urdu: data.urdu ? {
            narrator: data.urdu.narrator || 'Unknown',
            text: data.urdu.text || 'No translation available.'
          } : undefined
        } as Hadith;
      });
      setHadiths(hadithList);
    } catch (error) {
      console.error('Error fetching hadiths:', error);
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
    <div className="space-y-8">
      {/* Header Section */}
      <div className={`shrink-0 ${selectedBook ? 'sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200 -mx-4 px-4 py-3 mb-6' : 'mb-8'}`}>
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
                  } else if (selectedLanguage) {
                    setSelectedLanguage(null);
                  } else {
                    setSelectedBook(null);
                  }
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
                  {displayMode === 'reader' ? `Hadith ${hadiths[selectedHadithIndex]?.hadithNumber}` : `${activeBook?.author}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => setDisplayMode(displayMode === 'list' ? 'reader' : 'list')}
                className={`p-2 rounded-full transition-all border ${
                  displayMode === 'reader' 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                    : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                }`}
                title={displayMode === 'list' ? 'Reader Mode' : 'List View'}
              >
                {displayMode === 'list' ? <Book className="w-5 h-5" /> : <List className="w-5 h-5" />}
              </button>
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

      <AnimatePresence mode="wait">
        {!selectedBook ? (
          <motion.div
            key="books-grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-2 gap-4"
          >
            {isBooksLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm animate-pulse aspect-square" />
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
                  className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm hover:shadow-xl transition-all group text-center relative overflow-hidden aspect-square flex flex-col items-center justify-center"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                  
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-12 h-12 bg-emerald-900 text-emerald-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-900/20">
                      <Book className="w-6 h-6" />
                    </div>
                    
                    <h3 className="text-lg font-bold text-stone-900 mb-1 group-hover:text-emerald-700 transition-colors line-clamp-1">
                      {book.name}
                    </h3>
                    <p className="text-stone-500 text-[10px] font-medium mb-4 line-clamp-1">
                      {book.author}
                    </p>
                    
                    <div className="flex flex-col items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-stone-400">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        {book.hadithsCount || 0} Hadiths
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-stone-300" />
                        {book.chaptersCount || 0} Chapters
                      </div>
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
            className="space-y-6"
          >
            {/* Language Selector Tabs (Hidden if settings used, but keeping for quick access if preferred) */}
            {viewMode === 'hadiths' && displayMode === 'list' && (
              <div className="flex gap-2 p-1 bg-stone-100 rounded-2xl w-fit mb-4 shrink-0">
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
              <div className="grid grid-cols-1 gap-4">
                {chaptersList.map((chapter) => (
                  <motion.div
                    key={`chapter-${chapter.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-center gap-6 group"
                  >
                    <div className="flex items-center gap-6 w-full md:w-auto">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center font-bold text-sm shadow-sm border border-emerald-100">
                        {chapter.chapterNumber}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Chapter {chapter.chapterNumber}</p>
                        <h4 className="text-lg font-bold text-stone-900 group-hover:text-emerald-700 transition-colors">{chapter.chapterName}</h4>
                      </div>
                    </div>
                    
                    <div className="flex-1 text-right w-full md:w-auto">
                      <p className="text-2xl font-arabic text-stone-900 leading-relaxed">
                        {chapter.chapterArabic}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setViewMode('hadiths')}
                        className="p-3 bg-stone-50 text-stone-400 hover:bg-emerald-900 hover:text-white rounded-xl transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
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
                className="fixed inset-0 z-[40] bg-stone-50 flex flex-col overflow-hidden pb-24 md:pb-0 h-[100dvh]"
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
                        {activeBook?.name}
                      </h3>
                      <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                        Hadith {hadiths[selectedHadithIndex]?.hadithNumber}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setDisplayMode('list')}
                      className="p-2 bg-emerald-600 text-white rounded-full shadow-md border border-emerald-600"
                      title="List View"
                    >
                      <List className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setShowSettings(!showSettings)}
                      className="p-2 text-stone-500 hover:text-emerald-600 transition-colors"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                </header>

                <div className="flex-1 relative flex flex-col items-center justify-center p-2 md:p-8 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`reader-hadith-${hadiths[selectedHadithIndex].id}`}
                      initial={{ opacity: 0, x: 100 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -100 && selectedHadithIndex < hadiths.length - 1) {
                          setSelectedHadithIndex(prev => prev + 1);
                        } else if (info.offset.x > 100 && selectedHadithIndex > 0) {
                          setSelectedHadithIndex(prev => prev - 1);
                        }
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
                              <span className="text-[10px] md:text-xs text-emerald-700 font-bold truncate max-w-[150px] md:max-w-[200px] block">
                                {chapters[hadiths[selectedHadithIndex].chapterId] || 'General'}
                              </span>
                            </div>
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

                  {/* Navigation Controls */}
                  <div className="absolute bottom-6 left-0 right-0 px-6 md:px-10 flex items-center justify-between pointer-events-none z-[60]">
                    <button 
                      disabled={selectedHadithIndex === 0}
                      onClick={() => setSelectedHadithIndex(prev => prev - 1)}
                      className="p-3 md:p-4 bg-white border border-stone-200 rounded-2xl text-stone-600 hover:bg-stone-50 transition-all shadow-xl pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5 md:w-6 md:h-6 rotate-180" />
                    </button>
                    <div className="bg-emerald-900/90 text-white px-6 md:px-8 py-2 md:py-3 rounded-full text-xs md:text-sm font-bold tracking-widest pointer-events-auto shadow-xl backdrop-blur-sm border border-emerald-800/50">
                      {selectedHadithIndex + 1} / {hadiths.length}
                    </div>
                    <button 
                      disabled={selectedHadithIndex === hadiths.length - 1}
                      onClick={() => setSelectedHadithIndex(prev => prev + 1)}
                      className="p-3 md:p-4 bg-white border border-stone-200 rounded-2xl text-stone-600 hover:bg-stone-50 transition-all shadow-xl pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                  </div>
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
                  className="bg-white rounded-[2.5rem] border border-stone-200 shadow-sm overflow-hidden flex flex-col group transition-all hover:shadow-md cursor-pointer h-fit"
                >
                  {/* Actions Bar (Matches Quran Style) */}
                  <div className="p-4 bg-stone-50/50 border-b border-stone-100 flex items-center justify-between shrink-0 relative z-20">
                    <div className="flex items-center gap-1">
                      <div className="flex items-center justify-center w-14 h-10 bg-emerald-600/10 rounded-r-full -ml-8 pr-3 text-emerald-700 font-arabic text-lg border-y border-r border-emerald-600/20 shadow-sm">
                        {toArabicNumber(hadith.hadithNumber)}
                      </div>
                      <div className="ml-3">
                        <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest block">
                          Hadith {hadith.hadithNumber}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold truncate max-w-[150px] block">
                          {chapters[hadith.chapterId] || 'General'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleCopy(hadith); }}
                        className="p-2 text-stone-400 hover:text-emerald-600 transition-colors"
                      >
                        {copiedId === hadith.id.toString() ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button onClick={(e) => e.stopPropagation()} className="p-2 text-stone-400 hover:text-rose-500 transition-colors">
                        <Bookmark className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => e.stopPropagation()} className="p-2 text-stone-400 hover:text-emerald-600 transition-colors">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="text-right leading-[2.2] text-stone-900" style={{ direction: 'rtl' }}>
                      <p className="text-2xl font-arabic opacity-90 group-hover:opacity-100 transition-opacity line-clamp-4">
                        {hadith.arabic}
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-px bg-emerald-100 flex-1"></div>
                        <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-[0.2em] px-2">
                          Translation
                        </span>
                        <div className="h-px bg-emerald-100 flex-1"></div>
                      </div>
                      
                      <div className="pl-4 border-l-2 border-emerald-100/50">
                        <p className="text-stone-500 text-[9px] font-bold uppercase tracking-widest mb-1">
                          Narrated by {selectedLanguage === 'English' ? (hadith.english?.narrator || 'Unknown') : (hadith.urdu?.narrator || 'Unknown')}
                        </p>
                        <p className="text-sm text-stone-700 leading-relaxed font-medium italic line-clamp-3">
                          {selectedLanguage === 'English' ? (hadith.english?.text || 'No English translation available.') : 
                           selectedLanguage === 'Urdu' ? (hadith.urdu?.text || 'No Urdu translation available.') : 
                           'No translation selected.'}
                        </p>
                      </div>
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
