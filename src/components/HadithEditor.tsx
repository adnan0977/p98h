import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, getDoc, query, orderBy, limit, startAfter } from 'firebase/firestore';
import { 
  ArrowLeft, Save, Search, ChevronRight, ChevronLeft, 
  Moon, Edit3, CheckCircle2, AlertTriangle, Loader2, RefreshCw
} from 'lucide-react';
import { HadithBook } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../services/firestoreService';

interface HadithEditorProps {
  bookId: string;
  onBack: () => void;
}

interface HadithContent {
  number: number;
  arab: string;
  id: string; // Indonesian translation in this API
  status?: 'Verified' | 'Weak' | 'Marfu' | 'Sahih' | 'Hasan' | 'Daif' | 'Maudu';
}

export default function HadithEditor({ bookId, onBack }: HadithEditorProps) {
  const [book, setBook] = useState<HadithBook | null>(null);
  const [hadiths, setHadiths] = useState<HadithContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const HADITHS_PER_PAGE = 20;

  useEffect(() => {
    const fetchBookAndHadiths = async () => {
      setIsLoading(true);
      const bookPath = `hadith_books/${bookId}`;
      const hadithsPath = `hadith_content/${bookId}/hadiths`;
      try {
        // Fetch book metadata
        const bookSnap = await getDoc(doc(db, 'hadith_books', bookId));
        if (bookSnap.exists()) {
          setBook({ id: bookSnap.id, ...bookSnap.data() } as HadithBook);
        }

        // Fetch hadiths for the current page
        const start = (currentPage - 1) * HADITHS_PER_PAGE + 1;
        
        const hadithsSnap = await getDocs(
          query(
            collection(db, 'hadith_content', bookId, 'hadiths'),
            orderBy('number'),
            limit(HADITHS_PER_PAGE),
            startAfter(start - 1)
          )
        );
        
        const hadithList = hadithsSnap.docs.map(doc => doc.data() as HadithContent);
        setHadiths(hadithList);

        const match = bookSnap.data()?.description?.match(/Available Hadiths: (\d+)/);
        if (match) {
          const total = parseInt(match[1]);
          setTotalPages(Math.ceil(total / HADITHS_PER_PAGE));
        }
      } catch (error) {
        console.error('Error fetching Hadith content:', error);
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
        if (errorMessage.includes('quota') || errorMessage.includes('permission')) {
          handleFirestoreError(error, OperationType.LIST, hadithsPath);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookAndHadiths();
  }, [bookId, currentPage]);

  const handleHadithChange = (index: number, field: keyof HadithContent, newValue: any) => {
    const updatedHadiths = [...hadiths];
    updatedHadiths[index] = { ...updatedHadiths[index], [field]: newValue };
    setHadiths(updatedHadiths);
  };

  const handleSave = async (hadith: HadithContent) => {
    setIsSaving(true);
    setSaveStatus('idle');
    const path = `hadith_content/${bookId}/hadiths/${hadith.number}`;
    try {
      const hadithRef = doc(db, 'hadith_content', bookId, 'hadiths', hadith.number.toString());
      await updateDoc(hadithRef, { 
        arab: hadith.arab,
        id: hadith.id,
        status: hadith.status || null
      });
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving hadith:', error);
      setSaveStatus('error');
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      if (errorMessage.includes('quota') || errorMessage.includes('permission')) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const filteredHadiths = hadiths.filter(h => 
    h.arab.includes(searchQuery) || 
    h.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.number.toString().includes(searchQuery)
  );

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-stone-400">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="font-medium">Loading Hadith Content...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-white border border-stone-200 rounded-2xl text-stone-600 hover:bg-stone-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-stone-900">Hadith Content Editor</h2>
            <p className="text-stone-500 font-medium flex items-center gap-2">
              <Moon className="w-4 h-4" />
              {book?.name} ({book?.language})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {saveStatus === 'success' && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100"
              >
                <CheckCircle2 className="w-4 h-4" />
                Changes Saved
              </motion.div>
            )}
            {saveStatus === 'error' && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2 text-red-600 font-bold text-sm bg-red-50 px-4 py-2 rounded-xl border border-red-100"
              >
                <AlertTriangle className="w-4 h-4" />
                Save Failed
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-[2.5rem] shadow-xl overflow-hidden">
        <div className="p-8 border-b border-stone-100 bg-stone-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input 
              type="text" 
              placeholder="Search in this page..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none transition-all shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-2xl px-4 py-2 shadow-sm">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-1 text-stone-400 hover:text-emerald-600 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-stone-600 min-w-[80px] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-1 text-stone-400 hover:text-emerald-600 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/50">
                <th className="px-8 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest w-24">Number</th>
                <th className="px-8 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Arabic Content</th>
                <th className="px-8 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Translation</th>
                <th className="px-8 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest w-40">Status</th>
                <th className="px-8 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredHadiths.map((hadith, index) => (
                <tr key={hadith.number} className="hover:bg-stone-50/30 transition-all group">
                  <td className="px-8 py-6 align-top">
                    <span className="w-12 h-12 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center text-xs font-bold group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all">
                      {hadith.number}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <textarea 
                      value={hadith.arab}
                      onChange={(e) => handleHadithChange(index, 'arab', e.target.value)}
                      className="w-full p-4 bg-stone-50 border border-transparent rounded-2xl text-stone-800 text-lg font-arabic text-right focus:bg-white focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50 outline-none transition-all resize-none min-h-[120px]"
                      dir="rtl"
                    />
                  </td>
                  <td className="px-8 py-6">
                    <textarea 
                      value={hadith.id}
                      onChange={(e) => handleHadithChange(index, 'id', e.target.value)}
                      className="w-full p-4 bg-stone-50 border border-transparent rounded-2xl text-stone-800 text-sm focus:bg-white focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50 outline-none transition-all resize-none min-h-[120px]"
                    />
                  </td>
                  <td className="px-8 py-6">
                    <select
                      value={hadith.status || ''}
                      onChange={(e) => handleHadithChange(index, 'status', e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                    >
                      <option value="">Select Status</option>
                      <option value="Sahih">Sahih</option>
                      <option value="Hasan">Hasan</option>
                      <option value="Verified">Verified</option>
                      <option value="Weak">Weak</option>
                      <option value="Daif">Da'if</option>
                      <option value="Marfu">Marfu'</option>
                      <option value="Maudu">Maudu'</option>
                    </select>
                  </td>
                  <td className="px-8 py-6 align-top">
                    <button 
                      onClick={() => handleSave(hadith)}
                      disabled={isSaving}
                      className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-700 disabled:opacity-50 transition-all"
                      title="Save this Hadith"
                    >
                      {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
