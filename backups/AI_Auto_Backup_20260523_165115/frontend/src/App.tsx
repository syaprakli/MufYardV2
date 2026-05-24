import { HashRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { ChatProvider } from "./lib/context/ChatContext";
import { ConfirmProvider } from "./lib/context/ConfirmContext";
import { NotificationProvider } from "./lib/context/NotificationContext";
import { ThemeProvider } from "./lib/context/ThemeContext";
import { PresenceProvider } from "./lib/context/PresenceContext";

import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth, isElectron } from "./lib/firebase";
import { Toaster } from "react-hot-toast";
import { Loader2 } from "lucide-react";

import ScrollToTop from "./components/ScrollToTop";

import { useVersionCheck } from "./lib/hooks/useVersionCheck";
import { UpdateModal } from "./components/ui/UpdateModal";
import { logPerfSample } from "./lib/performance";

const MainLayout = lazy(() => import("./components/layout/MainLayout").then((module) => ({ default: module.MainLayout })));
const ChatContainer = lazy(() => import("./components/ChatContainer"));
const IntroPresentation = lazy(() => import("./components/IntroPresentation"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const Audit = lazy(() => import("./pages/Audit"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Assistant = lazy(() => import("./pages/Assistant"));
const AIKnowledge = lazy(() => import("./pages/AIKnowledge"));
const Legislation = lazy(() => import("./pages/Legislation"));
const Notes = lazy(() => import("./pages/Notes"));
const Files = lazy(() => import("./pages/Files"));
const Settings = lazy(() => import("./pages/Settings"));
const Calendar = lazy(() => import("./pages/Calendar"));
const ReportEditor = lazy(() => import("./pages/ReportEditor"));
const PublicSpace = lazy(() => import("./pages/PublicSpace"));
const About = lazy(() => import("./pages/About"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Messages = lazy(() => import("./pages/Messages"));
const Feedback = lazy(() => import("./pages/Feedback"));
const ReportAnalytics = lazy(() => import("./pages/ReportAnalytics"));
const FounderHub = lazy(() => import("./pages/FounderHub"));
const AdminFeedback = lazy(() => import("./pages/AdminFeedback"));
const AdminInspectors = lazy(() => import("./pages/AdminInspectors"));
const AdminRoleSettings = lazy(() => import("./pages/AdminRoleSettings"));
const AdminLicenses = lazy(() => import("./pages/AdminLicenses"));

const RouteLoadingFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center">
    <div className="flex flex-col items-center gap-3 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-xs font-bold uppercase tracking-[0.2em]">Sayfa Yükleniyor</p>
    </div>
  </div>
);

function RoutePerformanceTracker() {
  const location = useLocation();
  const routeStartRef = useRef<number>(performance.now());
  const previousPathRef = useRef(location.pathname + location.search);

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    if (currentPath !== previousPathRef.current) {
      routeStartRef.current = performance.now();
      previousPathRef.current = currentPath;
    }

    const raf = window.requestAnimationFrame(() => {
      const elapsed = performance.now() - routeStartRef.current;
      logPerfSample("route-render", elapsed, { path: currentPath });
    });

    return () => window.cancelAnimationFrame(raf);
  }, [location.pathname, location.search]);

  return null;
}

function App() {
  const { updateAvailable, currentVersion } = useVersionCheck();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    // Sadece giriş yapmış kullanıcılar için intro göster
    // Eğer deneme süresi başlatılmadıysa (ve admin değilse) intro zorunlu olsun
    if (user) {
      // Global data yüklendikten sonra kontrol et (MainLayout veya burası fark etmez ama App'te kalabilir)
      const hasSeenIntro = localStorage.getItem(`mufyard_intro_seen_${user.uid}`);
      
      // NOT: Gerçek kontrolü IntroPresentation içinde yapıyoruz zaten, 
      // burası sadece otomatik tetikleme için.
      if (!hasSeenIntro) {
        const timer = setTimeout(() => setShowIntro(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  const handleCloseIntro = () => {
    if (user) {
      localStorage.setItem(`mufyard_intro_seen_${user.uid}`, "true");
    }
    setShowIntro(false);
  };

  useEffect(() => {
    const handleTriggerIntro = () => setShowIntro(true);
    window.addEventListener('trigger-mufyard-intro', handleTriggerIntro);
    return () => window.removeEventListener('trigger-mufyard-intro', handleTriggerIntro);
  }, []);

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
          
          const bypassUids = ["mufettis-gsb-unique-id", "test-user-trial-99", "sefa-yaprakli-gsb-unique-id", "expired-user-trial-99"];
          if (localUser && bypassUids.includes(localUser.uid)) {
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
    <ChatProvider>
        <PresenceProvider>
          <ThemeProvider>
            <ConfirmProvider>
              <NotificationProvider>
                <Toaster
                  position="top-right"
                  containerStyle={{ zIndex: 2147483647 }}
                  toastOptions={{
                    style: { zIndex: 2147483647 }
                  }}
                />
                {showUpdateModal && (
                  <UpdateModal 
                    isOpen={showUpdateModal}
                    onClose={() => setShowUpdateModal(false)}
                    latestVersion={updateAvailable || ""}
                    currentVersion={currentVersion}
                  />
                )}
                {showIntro && (
                  <Suspense fallback={null}>
                    <IntroPresentation onClose={handleCloseIntro} />
                  </Suspense>
                )}
                <Router>
                  <ScrollToTop />
                  <RoutePerformanceTracker />
                  <Suspense fallback={<RouteLoadingFallback />}>
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
                        <Route path="settings/billing" element={<Settings initialTab="Lisans & Abonelik" />} />
                        <Route path="calendar" element={<Calendar />} />
                        <Route path="audit/:id/report" element={<ReportEditor />} />
                        <Route path="public-space" element={<PublicSpace />} />
                        <Route path="about" element={<About />} />
                        <Route path="notifications" element={<Notifications />} />
                        <Route path="messages" element={<Messages />} />
                        <Route path="feedback" element={<Feedback />} />
                        <Route path="report-analytics" element={<ReportAnalytics />} />
                        <Route path="admin" element={<FounderHub />} />
                        <Route path="admin/feedback" element={<AdminFeedback />} />
                        <Route path="admin/inspectors" element={<AdminInspectors />} />
                        <Route path="admin/roles" element={<AdminRoleSettings />} />
                        <Route path="admin/licenses" element={<AdminLicenses />} />
                      </Route>
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                    {user && <ChatContainer />}
                  </Suspense>
                </Router>
              </NotificationProvider>
            </ConfirmProvider>
        </ThemeProvider>
      </PresenceProvider>
    </ChatProvider>
  );
}

export default App;
