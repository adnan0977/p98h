import React, { useState, useEffect } from 'react';
import { Sun, RotateCcw, History, Save, Trash2, Plus, Minus, Info, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Tasbih() {
  const [count, setCount] = useState(0);
  const [target, setTarget] = useState(33);
  const [dhikr, setDhikr] = useState('SubhanAllah');
  const [history, setHistory] = useState<{ id: string; count: number; dhikr: string; date: Date }[]>([]);

  const dhikrOptions = [
    { name: 'SubhanAllah', translation: 'Glory be to Allah' },
    { name: 'Alhamdulillah', translation: 'Praise be to Allah' },
    { name: 'Allahu Akbar', translation: 'Allah is the Greatest' },
    { name: 'Astaghfirullah', translation: 'I seek forgiveness from Allah' },
    { name: 'La ilaha illallah', translation: 'There is no god but Allah' },
  ];

  const handleIncrement = () => {
    setCount(prev => prev + 1);
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const handleReset = () => {
    if (count > 0) {
      const newHistory = {
        id: Date.now().toString(),
        count,
        dhikr,
        date: new Date(),
      };
      setHistory(prev => [newHistory, ...prev]);
    }
    setCount(0);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">Digital Tasbih</h2>
          <p className="text-stone-500 font-medium italic">Maintain your daily dhikr and spiritual consistency.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-stone-200 shadow-sm">
          <button 
            onClick={handleReset}
            className="px-6 py-3 bg-stone-50 text-stone-600 rounded-xl font-bold text-sm hover:bg-stone-100 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Session
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Counter Section */}
        <div className="bg-white p-10 rounded-[3rem] border border-stone-200 shadow-2xl flex flex-col items-center justify-center gap-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full -mr-10 -mt-10 blur-3xl opacity-50"></div>
          
          <div className="text-center space-y-2 relative z-10">
            <h3 className="text-2xl font-bold text-emerald-900">{dhikr}</h3>
            <p className="text-xs text-stone-400 font-bold uppercase tracking-widest">
              {dhikrOptions.find(d => d.name === dhikr)?.translation}
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleIncrement}
            className="w-64 h-64 rounded-full bg-emerald-900 text-white shadow-2xl shadow-emerald-200 flex flex-col items-center justify-center gap-2 relative group overflow-hidden border-8 border-emerald-800"
          >
            <div className="absolute inset-0 bg-emerald-800 opacity-0 group-hover:opacity-20 transition-all"></div>
            <span className="text-7xl font-bold tracking-tighter">{count}</span>
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-emerald-400">Tap to Count</span>
          </motion.button>

          <div className="flex items-center gap-8 relative z-10">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-1">Target</p>
              <div className="flex items-center gap-3 bg-stone-50 px-4 py-2 rounded-xl border border-stone-100">
                <button onClick={() => setTarget(Math.max(1, target - 1))} className="text-stone-400 hover:text-emerald-600 transition-all"><Minus className="w-4 h-4" /></button>
                <span className="font-bold text-stone-900">{target}</span>
                <button onClick={() => setTarget(target + 1)} className="text-stone-400 hover:text-emerald-600 transition-all"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-1">Progress</p>
              <div className="w-32 h-2 bg-stone-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (count / target) * 100)}%` }}
                  className="h-full bg-emerald-600"
                ></motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Options & History */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
            <h3 className="font-bold text-lg flex items-center gap-2 text-emerald-900 border-b border-stone-100 pb-4">
              <Settings className="w-5 h-5" />
              Select Dhikr
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {dhikrOptions.map((option) => (
                <button
                  key={option.name}
                  onClick={() => {
                    setDhikr(option.name);
                    setCount(0);
                  }}
                  className={`p-4 rounded-2xl text-left transition-all border ${
                    dhikr === option.name 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm' 
                      : 'bg-stone-50 border-stone-100 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <p className="font-bold">{option.name}</p>
                  <p className="text-[10px] opacity-60 uppercase tracking-widest font-bold">{option.translation}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
            <h3 className="font-bold text-lg flex items-center gap-2 text-emerald-900 border-b border-stone-100 pb-4">
              <History className="w-5 h-5" />
              Recent History
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {history.length === 0 ? (
                <div className="text-center py-10 text-stone-400">
                  <p className="text-sm font-medium italic">No history yet.</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-100 flex justify-between items-center group">
                    <div>
                      <p className="font-bold text-stone-900">{item.dhikr}</p>
                      <p className="text-[10px] text-stone-400 font-medium">
                        {item.date.toLocaleDateString()} · {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-emerald-600">{item.count}</p>
                      <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Counts</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
