import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocFromServer, getDocFromCache } from 'firebase/firestore';
import Layout from './components/Layout';
import PrayerTimesDisplay from './components/PrayerTimes';
import QuranReader from './components/QuranReader';
import HadithLibrary from './components/HadithLibrary';
import Chatbot from './components/Chatbot';
import ZakatCalculator from './components/ZakatCalculator';
import Tasbih from './components/Tasbih';
import VideoGallery from './components/VideoGallery';
import AdminPanel from './components/AdminPanel';
import QuranEditor from './components/QuranEditor';
import HadithEditor from './components/HadithEditor';
import { UserProfile, AppSettings } from './types';
import { LogIn, Moon, ShieldCheck, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from './services/firestoreService';

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
      let isQuotaError = false;
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) {
          errorMessage = parsed.error;
          if (errorMessage.toLowerCase().includes('quota exceeded') || errorMessage.toLowerCase().includes('quota limit exceeded')) {
            isQuotaError = true;
            errorMessage = "Firestore Quota Exceeded. The free tier limit for database operations has been reached for today. The quota will automatically reset tomorrow (usually at midnight Pacific Time).";
          } else {
            errorMessage = `Permission Error: ${parsed.error} at ${parsed.path}`;
          }
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-8 text-center gap-6">
          <div className={`w-24 h-24 ${isQuotaError ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'} rounded-[2.5rem] flex items-center justify-center shadow-inner`}>
            {isQuotaError ? <Moon className="w-12 h-12" /> : <ShieldCheck className="w-12 h-12" />}
          </div>
          <div className="space-y-4 max-w-md">
            <h1 className="text-3xl font-bold text-stone-900">{isQuotaError ? 'Daily Limit Reached' : 'System Error'}</h1>
            <p className="text-stone-500 font-medium leading-relaxed">{errorMessage}</p>
            {isQuotaError && (
              <p className="text-stone-400 text-sm italic">
                Detailed quota information can be found under the Spark plan column in the Enterprise edition section of <a href="https://firebase.google.com/pricing#cloud-firestore" target="_blank" rel="noopener noreferrer" className="underline">firebase.google.com/pricing</a>
              </p>
            )}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className={`px-8 py-4 ${isQuotaError ? 'bg-amber-600' : 'bg-emerald-600'} text-white rounded-2xl font-bold shadow-lg`}
          >
            Try Reloading
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [activeTab, setActiveTab] = useState('prayers');
  const [editingEditionId, setEditingEditionId] = useState<string | null>(null);
  const [editingHadithId, setEditingHadithId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(() => {
    const saved = localStorage.getItem('app_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('user_profile', JSON.stringify(userProfile));
    } else {
      localStorage.removeItem('user_profile');
    }
  }, [userProfile]);

  useEffect(() => {
    if (appSettings) {
      localStorage.setItem('app_settings', JSON.stringify(appSettings));
    }
  }, [appSettings]);

  const [isReaderMode, setIsReaderMode] = useState(false);
  const [isHadithReaderMode, setIsHadithReaderMode] = useState(false);

  useEffect(() => {
    // Reset reader mode when switching tabs
    if (activeTab !== 'quran') {
      setIsReaderMode(false);
    }
    if (activeTab !== 'hadith') {
      setIsHadithReaderMode(false);
    }
  }, [activeTab]);

  useEffect(() => {
    const initializeApp = async () => {
      const path = 'app_settings/global';
      const docRef = doc(db, 'app_settings', 'global');
      
      try {
        // Try server first
        const docSnap = await getDocFromServer(docRef);
        if (docSnap.exists()) {
          setAppSettings(docSnap.data() as AppSettings);
          return; // Success
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
        console.warn("Server fetch failed, trying cache:", errorMessage);
        
        if (errorMessage.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }

      // Fallback to cache
      try {
        const docSnap = await getDocFromCache(docRef);
        if (docSnap.exists()) {
          setAppSettings(docSnap.data() as AppSettings);
          console.info("Loaded settings from Firestore cache.");
          return;
        }
      } catch (cacheError) {
        console.warn("Failed to fetch settings from Firestore cache:", cacheError);
      }

      // Final fallback: localStorage (already loaded in useState, but we check if it's enough)
      if (appSettings) {
        console.info("Using settings from localStorage.");
      } else {
        // Provide hardcoded defaults so the app doesn't crash
        console.warn("Using hardcoded default settings.");
        setAppSettings({
          maintenanceMode: false,
          announcement: "Welcome to Al-Hidayah. Daily Firestore quota may be limited."
        });
      }
    };
    initializeApp();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        try {
          console.log(`[App] Fetching user profile for UID: ${currentUser.uid}`);
          // Try fetching profile (getDoc handles cache automatically if offline/quota)
          let profileDoc = null;
          try {
            profileDoc = await getDoc(userDocRef);
            console.log(`[App] getDoc result exists: ${profileDoc.exists()}`);
          } catch (getErr) {
            const getErrMsg = getErr instanceof Error ? getErr.message.toLowerCase() : '';
            console.warn(`[App] getDoc failed: ${getErrMsg}`);
            
            if (getErrMsg.includes('permission')) {
              handleFirestoreError(getErr, OperationType.GET, `users/${currentUser.uid}`);
            }

            if (getErrMsg.includes('quota') || getErrMsg.includes('offline')) {
              console.warn("[App] getDoc failed (quota/offline), trying cache explicitly.");
              try {
                profileDoc = await getDocFromCache(userDocRef);
                console.log(`[App] getDocFromCache result exists: ${profileDoc?.exists()}`);
              } catch (cacheErr) {
                console.warn("[App] Profile not found in cache. Treating as new/guest user for this session.");
                // We'll proceed to the 'else' block below by leaving profileDoc as null
              }
            } else {
              console.error("[App] getDoc failed with non-quota/offline error:", getErr);
              throw getErr;
            }
          }

          if (profileDoc && profileDoc.exists()) {
            const data = profileDoc.data() as UserProfile;
            console.log("[App] User profile loaded:", data.role);
            setUserProfile(data);
          } else {
            // Create new profile (or fallback for quota-blocked existing users)
            console.log("[App] Profile doesn't exist or not found. Creating new profile...");
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              role: currentUser.email === 'adnan0977@gmail.com' ? 'admin' : 'user',
            };
            
            // Optimistically set local state
            setUserProfile(newProfile);

            // Try to save to server, but don't crash if it fails (e.g. quota)
            try {
              console.log("[App] Attempting to save new profile to Firestore...");
              await setDoc(userDocRef, newProfile);
              console.log("[App] Profile saved successfully.");
            } catch (saveError) {
              const saveMsg = saveError instanceof Error ? saveError.message.toLowerCase() : '';
              if (saveMsg.includes('permission')) {
                handleFirestoreError(saveError, OperationType.CREATE, `users/${currentUser.uid}`);
              }
              if (saveMsg.includes('quota')) {
                console.warn("[App] Quota exceeded while saving profile. Profile is active locally.");
              } else {
                console.error("[App] Error saving profile:", saveError);
              }
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
          console.error("[App] Error handling user profile (outer catch):", error);
          
          // If we have a profile in localStorage, we're okay
          if (userProfile) {
            console.warn("[App] Using user profile from localStorage due to error.");
          } else if (errorMessage.includes('quota') || errorMessage.includes('permission') || errorMessage.includes('cache')) {
            // If it's a new user and we hit quota/cache error, just use a basic profile
            console.warn("[App] Falling back to guest profile due to error.");
            const guestProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Guest User',
              role: currentUser.email === 'adnan0977@gmail.com' ? 'admin' : 'user',
            };
            setUserProfile(guestProfile);
          }
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-6">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 bg-emerald-600 rounded-3xl flex items-center justify-center text-white shadow-2xl"
        >
          <Moon className="w-10 h-10" />
        </motion.div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-emerald-900">Al-Hidayah</h1>
          <p className="text-stone-400 font-medium animate-pulse">Initializing your spiritual companion...</p>
        </div>
      </div>
    );
  }

  // Maintenance Mode Check
  if (appSettings?.maintenanceMode && userProfile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-8 text-center gap-6">
        <div className="w-24 h-24 bg-red-100 rounded-[2.5rem] flex items-center justify-center text-red-600 shadow-inner">
          <ShieldCheck className="w-12 h-12" />
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-3xl font-bold text-stone-900">Under Maintenance</h1>
          <p className="text-stone-500 font-medium leading-relaxed">
            Al-Hidayah is currently undergoing scheduled maintenance to improve your experience. 
            We'll be back shortly. JazakAllah for your patience.
          </p>
        </div>
        {!user && (
          <button 
            onClick={() => setActiveTab('login')}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg"
          >
            Sign In as Admin
          </button>
        )}
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'prayers': return <PrayerTimesDisplay />;
      case 'quran': return <QuranReader onReaderModeChange={setIsReaderMode} />;
      case 'hadith': return <HadithLibrary onDisplayModeChange={setIsHadithReaderMode} />;
      case 'chat': return <Chatbot />;
      case 'zakat': return <ZakatCalculator />;
      case 'tasbih': return <Tasbih />;
      case 'videos': return <VideoGallery />;
      case 'admin': return userProfile?.role === 'admin' ? (
        <AdminPanel 
          onEditEdition={(id) => {
            setEditingEditionId(id);
            setActiveTab('quran_editor');
          }} 
          onEditHadith={(id) => {
            setEditingHadithId(id);
            setActiveTab('hadith_editor');
          }}
        />
      ) : <PrayerTimesDisplay />;
      case 'quran_editor': return editingEditionId ? (
        <QuranEditor 
          editionId={editingEditionId} 
          onBack={() => setActiveTab('admin')} 
        />
      ) : <AdminPanel 
          onEditEdition={(id) => {
            setEditingEditionId(id);
            setActiveTab('quran_editor');
          }} 
          onEditHadith={(id) => {
            setEditingHadithId(id);
            setActiveTab('hadith_editor');
          }}
        />;
      case 'hadith_editor': return editingHadithId ? (
        <HadithEditor 
          bookId={editingHadithId} 
          onBack={() => setActiveTab('admin')} 
        />
      ) : <AdminPanel 
          onEditEdition={(id) => {
            setEditingEditionId(id);
            setActiveTab('quran_editor');
          }} 
          onEditHadith={(id) => {
            setEditingHadithId(id);
            setActiveTab('hadith_editor');
          }}
        />;
      case 'login': return (
        <div className="max-w-md mx-auto py-20 text-center space-y-8">
          <div className="w-24 h-24 bg-emerald-100 rounded-[2.5rem] flex items-center justify-center text-emerald-600 mx-auto shadow-inner">
            <UserIcon className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-stone-900">Welcome to Al-Hidayah</h2>
            <p className="text-stone-500 font-medium">Sign in to save your progress, zakat history, and preferences.</p>
          </div>
          <button 
            onClick={handleSignIn}
            className="w-full py-4 bg-white border border-stone-200 rounded-2xl font-bold text-stone-700 shadow-sm hover:bg-stone-50 transition-all flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
          <p className="text-[10px] text-stone-400 font-medium uppercase tracking-widest">
            Secure authentication by Firebase
          </p>
        </div>
      );
      default: return <PrayerTimesDisplay />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
        isAdmin={userProfile?.role === 'admin'}
        announcement={appSettings?.announcement}
        hideHeader={(activeTab === 'quran' && isReaderMode) || (activeTab === 'hadith' && isHadithReaderMode)}
        hideFooter={false}
      >
        {renderContent()}
      </Layout>
    </ErrorBoundary>
  );
}
