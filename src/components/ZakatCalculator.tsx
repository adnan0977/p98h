import React, { useState } from 'react';
import { Calculator, Info, Save, History, Trash2, DollarSign, Coins, Landmark, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ZakatCalculator() {
  const [assets, setAssets] = useState({
    cash: 0,
    gold: 0,
    silver: 0,
    investments: 0,
    business: 0,
    debts: 0,
  });

  const [nisab, setNisab] = useState({
    gold: 5800, // Example value in USD
    silver: 450, // Example value in USD
  });

  const totalAssets = assets.cash + assets.gold + assets.silver + assets.investments + assets.business;
  const netAssets = totalAssets - assets.debts;
  const isEligible = netAssets >= nisab.gold;
  const zakatAmount = isEligible ? netAssets * 0.025 : 0;

  const handleInputChange = (field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setAssets(prev => ({ ...prev, [field]: numValue }));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 md:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">Zakat Calculator</h2>
          <p className="text-stone-500 font-medium italic">Fulfill your third pillar of Islam with precision.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-stone-200 shadow-sm">
          <button className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </button>
          <button className="px-6 py-3 bg-stone-50 text-stone-600 rounded-xl font-bold text-sm hover:bg-stone-100 transition-all flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Input Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-xl grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="font-bold text-lg flex items-center gap-2 text-emerald-900 border-b border-stone-100 pb-4">
                <DollarSign className="w-5 h-5" />
                Personal Assets
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Cash & Bank Savings</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                    <input
                      type="number"
                      value={assets.cash}
                      onChange={(e) => handleInputChange('cash', e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Gold Value</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                    <input
                      type="number"
                      value={assets.gold}
                      onChange={(e) => handleInputChange('gold', e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Silver Value</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                    <input
                      type="number"
                      value={assets.silver}
                      onChange={(e) => handleInputChange('silver', e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="font-bold text-lg flex items-center gap-2 text-emerald-900 border-b border-stone-100 pb-4">
                <Briefcase className="w-5 h-5" />
                Business & Debts
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Investments (Stocks/Crypto)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                    <input
                      type="number"
                      value={assets.investments}
                      onChange={(e) => handleInputChange('investments', e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Business Assets</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                    <input
                      type="number"
                      value={assets.business}
                      onChange={(e) => handleInputChange('business', e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-red-400">Debts & Liabilities</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400 font-bold">$</span>
                    <input
                      type="number"
                      value={assets.debts}
                      onChange={(e) => handleInputChange('debts', e.target.value)}
                      className="w-full bg-red-50/50 border border-red-100 rounded-xl pl-8 pr-4 py-3 text-sm focus:ring-2 focus:ring-red-600 outline-none transition-all text-red-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-start gap-4 text-amber-800 shadow-sm">
            <Info className="w-6 h-6 shrink-0" />
            <div className="text-sm">
              <h4 className="font-bold mb-1">About Nisab</h4>
              <p className="opacity-90 leading-relaxed">
                Nisab is the minimum amount of wealth a Muslim must possess for a full year before Zakat becomes obligatory. 
                Current Nisab (Gold): <strong>${nisab.gold}</strong>. If your net assets are below this, Zakat is not mandatory.
              </p>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="space-y-6">
          <div className="bg-emerald-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-800/50 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div className="relative z-10 space-y-8">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold mb-2">Net Wealth</p>
                <h3 className="text-4xl font-bold">${netAssets.toLocaleString()}</h3>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm border-b border-emerald-800 pb-3">
                  <span className="text-emerald-300 font-medium">Status</span>
                  <span className={`font-bold px-3 py-1 rounded-lg ${isEligible ? 'bg-emerald-600 text-white' : 'bg-amber-600/50 text-amber-200'}`}>
                    {isEligible ? 'Eligible' : 'Not Eligible'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-emerald-800 pb-3">
                  <span className="text-emerald-300 font-medium">Zakat Rate</span>
                  <span className="font-bold">2.5%</span>
                </div>
              </div>

              <div className="pt-4">
                <p className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold mb-2">Total Zakat Due</p>
                <div className="bg-white/10 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <h2 className="text-5xl font-bold text-emerald-400">${zakatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                </div>
              </div>

              <button 
                disabled={!isEligible}
                className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-all uppercase tracking-widest text-xs"
              >
                Proceed to Payment
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900">Zakat al-Fitr</h4>
              <p className="text-xs text-stone-500">Fixed amount due before Eid prayer.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
