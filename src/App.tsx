import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';
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

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('prayers');
  const [editingEditionId, setEditingEditionId] = useState<string | null>(null);
  const [editingHadithId, setEditingHadithId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

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
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'app_settings', 'global'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    const fetchSettings = async () => {
      const path = 'app_settings/global';
      try {
        const docRef = doc(db, 'app_settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAppSettings(docSnap.data() as AppSettings);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    };
    fetchSettings();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const path = `users/${currentUser.uid}`;
        try {
          const profileDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (profileDoc.exists()) {
            setUserProfile(profileDoc.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              role: currentUser.email === 'adnan0977@gmail.com' ? 'admin' : 'user',
            };
            await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            setUserProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path);
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
        hideFooter={(activeTab === 'quran' && isReaderMode) || (activeTab === 'hadith' && isHadithReaderMode)}
      >
        {renderContent()}
      </Layout>
    </ErrorBoundary>
  );
}
