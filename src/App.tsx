import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useStore } from "./store/useStore";
import { ScreenshotGuard } from "./components/ScreenshotGuard";
import { WebGPUGuard } from "./components/WebGPUGuard";
import AuthPage from "./pages/AuthPage";
import ChatListPage from "./pages/ChatListPage";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/SettingsPage";
import GroupDetailPage from "./pages/GroupDetailPage";
import VoiceCall from "./components/VoiceCall";
import SponsorEffect from "./components/SponsorEffect";

export default function App() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const navigate = useNavigate();

  // Listen for sponsor-click events from SponsorEffect flyers
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.displayName) {
        // Navigate to chat list where user can search/add the sponsor
        navigate("/chats");
        console.log("[Sponsor] Clicked:", detail.displayName);
      }
    };
    window.addEventListener("sponsor-click", handler);
    return () => window.removeEventListener("sponsor-click", handler);
  }, [navigate]);

  return (
    <ScreenshotGuard>
      <WebGPUGuard>
        <SponsorEffect />
        <VoiceCall />
        <div className="app-container">
          <Routes>
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <Navigate to="/chats" />
                ) : (
                  <Navigate to="/auth" />
                )
              }
            />
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/chats"
              element={
                isAuthenticated ? <ChatListPage /> : <Navigate to="/auth" />
              }
            />
            <Route
              path="/chat/:id"
              element={isAuthenticated ? <ChatPage /> : <Navigate to="/auth" />}
            />
            <Route
              path="/group/:id"
              element={
                isAuthenticated ? <GroupDetailPage /> : <Navigate to="/auth" />
              }
            />
            <Route
              path="/settings"
              element={
                isAuthenticated ? <SettingsPage /> : <Navigate to="/auth" />
              }
            />
          </Routes>
        </div>
      </WebGPUGuard>
    </ScreenshotGuard>
  );
}
