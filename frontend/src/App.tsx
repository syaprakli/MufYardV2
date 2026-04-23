import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChatProvider } from "./lib/context/ChatContext";
import { ConfirmProvider } from "./lib/context/ConfirmContext";
import { NotificationProvider } from "./lib/context/NotificationContext";
import { ThemeProvider } from "./lib/context/ThemeContext";

import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth } from "./lib/firebase";
import { Toaster } from "react-hot-toast";

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

import { useVersionCheck } from "./lib/hooks/useVersionCheck";
import { UpdateModal } from "./components/ui/UpdateModal";

function App() {
  const { updateAvailable, currentVersion } = useVersionCheck();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    if (updateAvailable) {
      setShowUpdateModal(true);
    }
  }, [updateAvailable]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <ChatProvider>
        <ConfirmProvider>
          <NotificationProvider>
            <Toaster 
              position="top-center" 
              toastOptions={{ 
                className: 'dark:bg-slate-950 dark:text-white dark:border dark:border-slate-800',
                style: { 
                  borderRadius: '16px', 
                  padding: '12px 24px',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }
              }} 
            />
            {updateAvailable && (
              <UpdateModal 
                isOpen={showUpdateModal} 
                onClose={() => setShowUpdateModal(false)}
                latestVersion={updateAvailable}
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
                </Route>
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Router>
          </NotificationProvider>
        </ConfirmProvider>
      </ChatProvider>
    </ThemeProvider>
  );
}

export default App;
