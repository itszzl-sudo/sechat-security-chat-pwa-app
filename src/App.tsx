import { Routes, Route, Navigate } from "react-router-dom";
import { useStore } from "./store/useStore";
import { ScreenshotGuard } from "./components/ScreenshotGuard";
import { WebGPUGuard } from "./components/WebGPUGuard";
import AuthPage from "./pages/AuthPage";
import ChatListPage from "./pages/ChatListPage";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/SettingsPage";
import VoiceCall from "./components/VoiceCall";

export default function App() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  return (
    <ScreenshotGuard>
      <WebGPUGuard>
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
