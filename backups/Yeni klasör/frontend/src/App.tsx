import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChatProvider } from "./lib/context/ChatContext";
import { ConfirmProvider } from "./lib/context/ConfirmContext";
import { NotificationProvider } from "./lib/context/NotificationContext";

import ChatContainer from "./components/ChatContainer";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Toaster, toast } from "react-hot-toast";

const APP_VERSION = "2.0.0";
import { MainLayout } from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Audit from "./pages/Audit";
import Tasks from "./pages/Tasks";
import Contacts from "./pages/Contacts";
import Assistant from "./pages/Assistant";
import AIKnowledge from "./pages/AIKnowledge";
import Legislation from "./pages/Legislation";
import Notes from "./pages/Notes";
import Files from "./pages/Files";
import Settings from "./pages/Settings";
import Calendar from "./pages/Calendar";
import ReportEditor from "./pages/ReportEditor";
import PublicSpace from "./pages/PublicSpace";
import About from "./pages/About";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Theme initialization
    const applyTheme = () => {
      document.documentElement.classList.remove('dark', 'theme-navy');
    };

    applyTheme();

    // Firebase auth observer
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        // Demo oturumu kontrolü
        const demoUser = localStorage.getItem("demo_user");
        if (demoUser) {
          setUser(JSON.parse(demoUser));
        } else {
          setUser(null);
        }
      }
      setLoading(false);
      applyTheme(); // Re-apply theme after auth state change
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const configRef = doc(db, 'system_config', 'app_info');
        const configSnap = await getDoc(configRef);
        
        if (configSnap.exists()) {
          const remoteVersion = configSnap.data().latest_version;
          if (remoteVersion && remoteVersion !== APP_VERSION) {
            toast.success(`Yeni bir güncelleme mevcut (v${remoteVersion}). Lütfen en yeni sürümü indiriniz.`, {
              duration: 8000,
              icon: '🚀'
            });
          }
        }
      } catch (error) {
        console.error("Versiyon kontrol hatası:", error);
      }
    };

    checkUpdate();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ChatProvider>
      <ConfirmProvider>
        <NotificationProvider>
          <Toaster 
            position="top-center" 
            toastOptions={{ 
                style: { 
                    borderRadius: '16px', 
                    background: '#ffffff', 
                    color: '#0f172a', 
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
                    padding: '12px 24px',
                    fontWeight: 'bold',
                    fontSize: '14px'
                }
            }} 
          />
          <Router>
            <Routes>
              <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />

              <Route element={user ? <MainLayout /> : <Navigate to="/login" />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/audit" element={<Audit />} />
                <Route path="/audit/:id/report" element={<ReportEditor />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/assistant" element={<Assistant />} />
                <Route path="/ai-knowledge" element={<AIKnowledge />} />
                <Route path="/legislation" element={<Legislation />} />
                <Route path="/public-space" element={<PublicSpace />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/files" element={<Files />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/about" element={<About />} />
                <Route path="/" element={<Navigate to="/dashboard" />} />
              </Route>
              
              {/* Fallback route for undefined paths */}
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </Router>
          <ChatContainer />
        </NotificationProvider>
      </ConfirmProvider>
    </ChatProvider>
  );
}

export default App;
