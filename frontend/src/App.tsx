import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChatProvider } from "./lib/context/ChatContext";
import { ConfirmProvider } from "./lib/context/ConfirmContext";
import { NotificationProvider } from "./lib/context/NotificationContext";
import { ThemeProvider } from "./lib/context/ThemeContext";
import { PresenceProvider } from "./lib/context/PresenceContext";

import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth, isElectron } from "./lib/firebase";
import AdminFeedback from "./pages/AdminFeedback";
import { Toaster } from "react-hot-toast";
import { Loader2 } from "lucide-react";

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
import Feedback from "./pages/Feedback";

import { useVersionCheck } from "./lib/hooks/useVersionCheck";
import { UpdateModal } from "./components/ui/UpdateModal";

function App() {
  const { updateAvailable, currentVersion } = useVersionCheck();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    if (updateAvailable && isElectron) {
      setShowUpdateModal(true);
    }
  }, [updateAvailable]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // E-Posta doğrulama kalkanı
          // Sadece gerçek Firebase kullanıcıları için (demo/bypass hariç)
          const isBypass = firebaseUser.uid === "mufettis-gsb-unique-id" || firebaseUser.uid === "demo-user-123";
          
          if (!isBypass && !firebaseUser.emailVerified) {
              console.log("🔒 Onaysız e-posta tespit edildi, oturum kapatılıyor.");
              await auth.signOut();
              setUser(null);
              localStorage.removeItem('demo_user');
          } else {
              setUser(firebaseUser);
          }
        } else {
          // Firebase'de kullanıcı yoksa localStorage'daki bypass'ı kontrol et
          const localUserRaw = localStorage.getItem('demo_user');
          const localUser = localUserRaw ? JSON.parse(localUserRaw) : null;
          
          if (localUser && localUser.uid === "mufettis-gsb-unique-id") {
             setUser(localUser as FirebaseUser);
          } else {
             setUser(null);
             localStorage.removeItem('demo_user');
          }
        }
      } catch (error) {
        console.error("Auth error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-blue-200/50 font-medium animate-pulse">Oturum kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <ChatProvider>
        <ConfirmProvider>
          <NotificationProvider>
            <PresenceProvider>
              <Toaster position="top-right" />
              {showUpdateModal && (
                <UpdateModal 
                  isOpen={showUpdateModal}
                  onClose={() => setShowUpdateModal(false)}
                  latestVersion={updateAvailable || ""}
                  currentVersion={currentVersion}
                />
              )}
              <Router>
                <Routes>
                  <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />

                  <Route element={user ? <MainLayout /> : <Navigate to="/login" />}>
                    <Route index element={<Dashboard />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="audit" element={<Audit />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="contacts" element={<Contacts />} />
                    <Route path="assistant" element={<Assistant />} />
                    <Route path="ai-knowledge" element={<AIKnowledge />} />
                    <Route path="legislation" element={<Legislation />} />
                    <Route path="notes" element={<Notes />} />
                    <Route path="files" element={<Files />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="calendar" element={<Calendar />} />
                    <Route path="audit/:id/report" element={<ReportEditor />} />
                    <Route path="public-space" element={<PublicSpace />} />
                    <Route path="about" element={<About />} />
                    <Route path="notifications" element={<Notifications />} />
                    <Route path="messages" element={<Messages />} />
                    <Route path="feedback" element={<Feedback />} />
                    <Route path="admin/feedback" element={<AdminFeedback />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Router>
            </PresenceProvider>
          </NotificationProvider>
        </ConfirmProvider>
      </ChatProvider>
    </ThemeProvider>
  );
}

export default App;
