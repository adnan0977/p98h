import React, { useEffect, useState } from 'react';
import { getPrayerTimes, getQiblaDirection, PrayerTime } from '../services/prayerService';
import { Clock, MapPin, Compass, Bell, BellOff, Info, Sun, Moon } from 'lucide-react';
import { motion } from 'motion/react';

export default function PrayerTimesDisplay() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const [qibla, setQibla] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<boolean>(true);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ lat: latitude, lng: longitude });
          setPrayerTimes(getPrayerTimes(latitude, longitude));
          setQibla(getQiblaDirection(latitude, longitude));
        },
        (err) => {
          setError("Please enable location permissions to see precise prayer times.");
          console.error(err);
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  }, []);

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-start gap-4 text-amber-800 shadow-sm">
        <Info className="w-6 h-6 shrink-0" />
        <div>
          <h3 className="font-bold text-lg">Location Access Required</h3>
          <p className="text-sm opacity-90">{error}</p>
        </div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-stone-400">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-medium animate-pulse">Calculating prayer times...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-emerald-900 text-white p-6 md:p-8 rounded-3xl shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-800/50 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-300 mb-2">
              <MapPin className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Current Location</span>
            </div>
            <h2 className="text-4xl font-bold mb-1">Makkah Time</h2>
            <p className="text-emerald-200/80 font-medium">Thursday, 19 March 2026 · 1 Ramadan 1447</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold mb-1">Qibla Direction</p>
              <div className="flex items-center gap-2 bg-emerald-800/50 px-4 py-2 rounded-xl border border-emerald-700/50">
                <Compass className="w-5 h-5 text-emerald-400" />
                <span className="text-xl font-bold">{Math.round(qibla || 0)}°</span>
              </div>
            </div>
            <button 
              onClick={() => setNotifications(!notifications)}
              className={`p-4 rounded-2xl transition-all ${notifications ? 'bg-emerald-600 text-white shadow-lg' : 'bg-emerald-800/50 text-emerald-400'}`}
            >
              {notifications ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Prayer Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {prayerTimes.map((prayer) => (
          <motion.div
            key={prayer.name}
            whileHover={{ y: -5 }}
            className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-3 ${
              prayer.isNext 
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-xl shadow-emerald-200 scale-105 z-10' 
                : 'bg-white border-stone-200 text-stone-900 hover:border-emerald-200 hover:bg-emerald-50/30'
            }`}
          >
            <Clock className={`w-6 h-6 ${prayer.isNext ? 'text-emerald-200' : 'text-emerald-600'}`} />
            <div className="text-center">
              <p className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${prayer.isNext ? 'text-emerald-200' : 'text-stone-400'}`}>
                {prayer.name}
              </p>
              <p className="text-xl font-bold">{prayer.time}</p>
            </div>
            {prayer.isNext && (
              <span className="bg-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                Next
              </span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Additional Timings */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-6">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <Sun className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-stone-900">Imsak (Suhoor)</h4>
            <p className="text-sm text-stone-500">Fast begins at 04:32 AM</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-6">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Moon className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-stone-900">Iftar (Maghrib)</h4>
            <p className="text-sm text-stone-500">Fast ends at 06:15 PM</p>
          </div>
        </div>
      </div>
    </div>
  );
}
