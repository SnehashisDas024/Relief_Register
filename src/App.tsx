import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/AdminDashboard";
import LiveMap from "./pages/LiveMap";
import VolunteerDashboard from "./pages/VolunteerDashboard";
import Chat from "./pages/Chat";
import AdminPanel from "./pages/AdminPanel";
import { SRA, checkAuth } from "./utils/api";

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  if (!SRA.token) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(SRA.role || "")) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  useEffect(() => {
    // Check JWT on load
    const token = localStorage.getItem("sra_token");
    if (token && !checkAuth()) {
      localStorage.removeItem("sra_token");
      localStorage.removeItem("sra_role");
      localStorage.removeItem("sra_name");
      localStorage.removeItem("sra_user_id");
    }
    // Initialize dark mode
    const theme = localStorage.getItem("sra_theme");
    if (theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return (
    <Router>
      <div className="min-h-screen">
        {/* Global Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-[9999] min-w-[320px] fade-in-up">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm ${
              toast.type === "success" ? "bg-green-600 text-white" :
              toast.type === "error" ? "bg-red-600 text-white" :
              toast.type === "warning" ? "bg-amber-500 text-white" :
              "bg-sra-primary text-white"
            }`}>
              <i className={`bi ${
                toast.type === "success" ? "bi-check-circle" :
                toast.type === "error" ? "bi-exclamation-circle" :
                toast.type === "warning" ? "bi-exclamation-triangle" :
                "bi-info-circle"
              }`}></i>
              <span className="flex-1">{toast.message}</span>
              <button onClick={() => setToast(null)} className="btn-close btn-close-white" aria-label="Close"></button>
            </div>
          </div>
        )}

        {/* Global Loader — hidden by default, JS adds .active to show */}
        <div id="global-loader" className="global-loader">
          <div className="text-center">
            <div className="spinner-border text-sra-primary mb-3" style={{ width: "3rem", height: "3rem" }} role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div className="text-sra-muted text-sm">Processing...</div>
          </div>
        </div>

        {/* Navbar - shown on all pages except landing, login, register */}
        <Navbar />

        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Admin Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute roles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/map" element={
            <ProtectedRoute roles={["admin"]}>
              <LiveMap />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute roles={["admin"]}>
              <AdminPanel />
            </ProtectedRoute>
          } />

          {/* Volunteer Routes */}
          <Route path="/volunteer" element={
            <ProtectedRoute roles={["volunteer"]}>
              <VolunteerDashboard />
            </ProtectedRoute>
          } />

          {/* Chat - All authenticated */}
          <Route path="/chat/:roomId" element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
