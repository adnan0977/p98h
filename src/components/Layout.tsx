import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Moon, 
  Sun, 
  Compass, 
  BookOpen, 
  MessageCircle, 
  Calculator, 
  Clock, 
  Settings,
  Menu,
  X,
  User,
  LogOut,
  ShieldCheck,
  Video,
  Home,
  MoreHorizontal
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  isAdmin: boolean;
  announcement?: string;
  hideHeader?: boolean;
  hideFooter?: boolean;
}

export default function Layout({ children, activeTab, setActiveTab, user, isAdmin, announcement, hideHeader, hideFooter }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const navItems = [
    { id: 'prayers', name: 'Prayers', icon: Clock },
    { id: 'quran', name: 'Quran', icon: BookOpen },
    { id: 'hadith', name: 'Hadith', icon: Moon },
    { id: 'qibla', name: 'Qibla', icon: Compass },
    { id: 'zakat', name: 'Zakat', icon: Calculator },
    { id: 'tasbih', name: 'Tasbih', icon: Sun },
    { id: 'videos', name: 'Videos', icon: Video },
    { id: 'chat', name: 'AI Chat', icon: MessageCircle },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', name: 'Admin', icon: ShieldCheck });
  }

  const handleSignOut = () => {
    signOut(auth);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col">
      {/* Global Announcement */}
      {announcement && (
        <div className="bg-emerald-900 text-white py-2 px-4 text-center text-[10px] font-bold uppercase tracking-[0.2em] relative z-[60]">
          <span className="opacity-70 mr-2">Announcement:</span>
          {announcement}
        </div>
      )}

      {/* Header */}
      {!hideHeader && (
        <header className="sticky top-0 z-50 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <Moon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-emerald-900">Al-Hidayah</h1>
              <p className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">Islamic Companion</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === item.id 
                    ? 'bg-emerald-50 text-emerald-700' 
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-stone-900">{user.displayName || 'User'}</p>
                  <p className="text-[10px] text-stone-500">{user.email}</p>
                </div>
                <button 
                  onClick={handleSignOut}
                  className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setActiveTab('login')}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-emerald-700 transition-all"
              >
                Sign In
              </button>
            )}
          </div>
        </header>
      )}

      {/* Bottom Navigation for Mobile */}
      {!hideFooter && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-6 py-3 z-50 flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <button 
            onClick={() => { setActiveTab('prayers'); setIsMenuOpen(false); }}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'prayers' ? 'text-emerald-600' : 'text-stone-400'}`}
          >
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
          </button>
          <button 
            onClick={() => { setActiveTab('quran'); setIsMenuOpen(false); }}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'quran' ? 'text-emerald-600' : 'text-stone-400'}`}
          >
            <BookOpen className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Quran</span>
          </button>
          <button 
            onClick={() => { setActiveTab('hadith'); setIsMenuOpen(false); }}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'hadith' ? 'text-emerald-600' : 'text-stone-400'}`}
          >
            <Moon className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Hadith</span>
          </button>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex flex-col items-center gap-1 transition-all ${isMenuOpen ? 'text-emerald-600' : 'text-stone-400'}`}
          >
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">More</span>
          </button>
        </nav>
      )}

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="md:hidden fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[2.5rem] p-8 pb-32 shadow-2xl border-t border-stone-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-stone-900">All Services</h3>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 text-stone-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMenuOpen(false);
                    }}
                    className={`p-4 rounded-2xl flex flex-col items-center gap-2 border transition-all ${
                      activeTab === item.id 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                        : 'bg-stone-50 border-stone-100 text-stone-600'
                    }`}
                  >
                    <item.icon className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-tight text-center">{item.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={`flex-1 max-w-7xl mx-auto w-full px-4 py-2 md:py-8 ${hideFooter ? 'pb-1' : 'pb-1 md:pb-8'}`}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      {!hideFooter && (
        <footer className="mt-auto border-t border-stone-200 bg-white py-2 md:py-8 px-4 pb-16 md:pb-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-1 md:gap-6">
            <div className="flex items-center gap-2">
              <Moon className="w-3 h-3 md:w-5 md:h-5 text-emerald-600" />
              <span className="font-bold text-stone-900 text-[10px] md:text-base">Al-Hidayah</span>
            </div>
            <p className="text-stone-500 text-[8px] md:text-sm">© 2026 Al-Hidayah. All rights reserved.</p>
            <div className="hidden md:flex gap-4 md:gap-6 text-[10px] md:text-sm font-medium text-stone-500">
              <a href="#" className="hover:text-emerald-600">Privacy</a>
              <a href="#" className="hover:text-emerald-600">Terms</a>
              <a href="#" className="hover:text-emerald-600">Contact</a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
