import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { 
  ArrowLeft, Save, Search, ChevronRight, ChevronLeft, 
  BookOpen, Edit3, CheckCircle2, AlertTriangle, Loader2
} from 'lucide-react';
import { QuranEdition } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../services/firestoreService';

interface QuranEditorProps {
  editionId: string;
  onBack: () => void;
}

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
}

interface Surah {
  number: number;
  name: string;
  englishName: string;
  ayahs: Ayah[];
}

export default function QuranEditor({ editionId, onBack }: QuranEditorProps) {
  const [edition, setEdition] = useState<QuranEdition | null>(null);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchEditionAndSurahs = async () => {
      setIsLoading(true);
      const path = `quran_content/${editionId}/surahs`;
      try {
        // Fetch edition metadata
        const edSnap = await getDoc(doc(db, 'quran_editions', editionId));
        if (edSnap.exists()) {
          setEdition({ id: edSnap.id, ...edSnap.data() } as QuranEdition);
        }

        // Fetch surahs
        const surahsSnap = await getDocs(collection(db, path));
        const surahList = surahsSnap.docs.map(doc => doc.data() as Surah);
        surahList.sort((a, b) => a.number - b.number);
        setSurahs(surahList);
        if (surahList.length > 0) {
          setSelectedSurah(surahList[0]);
        }
      } catch (error) {
        console.error('Error fetching Quran content:', error);
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
        if (errorMessage.includes('quota') || errorMessage.includes('permission')) {
          handleFirestoreError(error, OperationType.LIST, path);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchEditionAndSurahs();
  }, [editionId]);

  const handleAyahChange = (index: number, newText: string) => {
    if (!selectedSurah) return;
    const updatedAyahs = [...selectedSurah.ayahs];
    updatedAyahs[index] = { ...updatedAyahs[index], text: newText };
    setSelectedSurah({ ...selectedSurah, ayahs: updatedAyahs });
  };

  const handleSave = async () => {
    if (!selectedSurah || !edition) return;
    setIsSaving(true);
    setSaveStatus('idle');
    const path = `quran_content/${editionId}/surahs/${selectedSurah.number}`;
    try {
      const surahRef = doc(db, 'quran_content', editionId, 'surahs', selectedSurah.number.toString());
      await updateDoc(surahRef, { ayahs: selectedSurah.ayahs });
      
      // Update local surahs list
      setSurahs(prev => prev.map(s => s.number === selectedSurah.number ? selectedSurah : s));
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving surah:', error);
      setSaveStatus('error');
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      if (errorMessage.includes('quota') || errorMessage.includes('permission')) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSurahs = surahs.filter(s => 
    s.name.includes(searchQuery) || 
    s.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.number.toString().includes(searchQuery)
  );

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-stone-500 font-medium">Loading Quran Content...</p>
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
            <h2 className="text-3xl font-bold text-stone-900">Quran Content Editor</h2>
            <p className="text-stone-500 font-medium flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {edition?.name} ({edition?.language.toUpperCase()})
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
          
          <button 
            onClick={handleSave}
            disabled={isSaving || !selectedSurah}
            className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Surah List Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input 
              type="text" 
              placeholder="Search surah..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none transition-all shadow-sm"
            />
          </div>

          <div className="bg-white border border-stone-200 rounded-[2rem] overflow-hidden shadow-sm max-h-[70vh] overflow-y-auto custom-scrollbar">
            {filteredSurahs.map((surah) => (
              <button
                key={surah.number}
                onClick={() => setSelectedSurah(surah)}
                className={`w-full p-4 flex items-center justify-between transition-all border-b border-stone-50 last:border-0 ${
                  selectedSurah?.number === surah.number 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : 'hover:bg-stone-50 text-stone-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    selectedSurah?.number === surah.number ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-400'
                  }`}>
                    {surah.number}
                  </span>
                  <div className="text-left">
                    <p className="font-bold text-sm">{surah.englishName}</p>
                    <p className="text-[10px] opacity-70 uppercase tracking-widest">{surah.name}</p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform ${selectedSurah?.number === surah.number ? 'rotate-90' : ''}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Ayah Editor Table */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-stone-200 rounded-[2.5rem] shadow-xl overflow-hidden">
            <div className="p-8 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-stone-900">
                  Surah {selectedSurah?.englishName}
                </h3>
                <p className="text-stone-500 text-sm font-medium">
                  {selectedSurah?.ayahs.length} Ayahs
                </p>
              </div>
              <div className="flex gap-2">
                <button 
                  disabled={!selectedSurah || selectedSurah.number === 1}
                  onClick={() => setSelectedSurah(surahs[selectedSurah!.number - 2])}
                  className="p-2 bg-white border border-stone-200 rounded-xl text-stone-400 hover:text-stone-600 disabled:opacity-30 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  disabled={!selectedSurah || selectedSurah.number === 114}
                  onClick={() => setSelectedSurah(surahs[selectedSurah!.number])}
                  className="p-2 bg-white border border-stone-200 rounded-xl text-stone-400 hover:text-stone-600 disabled:opacity-30 transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/50">
                    <th className="px-8 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest w-20">Ayah</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Content</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest w-32">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {selectedSurah?.ayahs.map((ayah, index) => (
                    <tr key={ayah.number} className="hover:bg-stone-50/30 transition-all group">
                      <td className="px-8 py-6 align-top">
                        <span className="w-10 h-10 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center text-xs font-bold group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all">
                          {ayah.numberInSurah}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="relative">
                          <textarea 
                            value={ayah.text}
                            onChange={(e) => handleAyahChange(index, e.target.value)}
                            className="w-full p-4 bg-stone-50 border border-transparent rounded-2xl text-stone-800 text-sm focus:bg-white focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50 outline-none transition-all resize-none min-h-[80px]"
                            placeholder="Ayah text..."
                          />
                          <Edit3 className="absolute right-4 top-4 w-4 h-4 text-stone-300 pointer-events-none" />
                        </div>
                      </td>
                      <td className="px-8 py-6 align-top">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                            <span>Juz</span>
                            <span className="text-stone-600">{ayah.juz}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                            <span>Page</span>
                            <span className="text-stone-600">{ayah.page}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
