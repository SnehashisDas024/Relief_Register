import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { SRA, logout, apiGet } from "../utils/api";

interface Notification {
  id: number;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

function getInitialTheme(): boolean {
  const stored = localStorage.getItem("sra_theme");
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifCount, setNotifCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("sra_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (SRA.token) {
      apiGet("/api/notifications").then((data: any) => {
        if (data?.unread_count) setNotifCount(data.unread_count);
        if (data?.notifications) setNotifications(data.notifications);
      });
    }
  }, [location.pathname]);

  const role = SRA.role;
  const name = SRA.name || "User";

  const navLinks = () => {
    if (role === "admin") return [
      { to: "/dashboard", icon: "bi-speedometer2", label: "Dashboard" },
      { to: "/map", icon: "bi-map", label: "Live Map" },
      { to: "/admin", icon: "bi-gear", label: "Admin Panel" },
    ];
    if (role === "volunteer") return [
      { to: "/volunteer", icon: "bi-list-task", label: "My Tasks" },
      { to: "/volunteer", icon: "bi-upload", label: "Upload Data" },
    ];
    if (role === "user") return [
      { to: "/", icon: "bi-plus-circle", label: "Submit Need" },
      { to: "/", icon: "bi-list-check", label: "My Needs" },
    ];
    return [];
  };

  if (!SRA.token) return null;

  return (
    <nav className="bg-[#1E293B] shadow-lg sticky top-0 z-50 transition-colors duration-300">
      <div className="max-w-full mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <button className="lg:hidden text-white mr-2" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
              <i className={`bi ${mobileOpen ? "bi-x-lg" : "bi-list"} text-xl`}></i>
            </button>
            <Link to="/" className="flex items-center gap-2 text-white no-underline">
              <i className="bi bi-geo-alt-fill text-sra-primary text-xl"></i>
              <span className="font-bold text-lg hidden sm:inline">Smart Resource Allocation</span>
              <span className="font-bold text-lg sm:hidden">SRA</span>
            </Link>
          </div>

          <div className="hidden lg:flex items-center gap-1">
            {navLinks().map((link, i) => (
              <Link key={i} to={link.to} className={`text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm no-underline transition-all duration-200 hover:bg-white/10 ${location.pathname === link.to ? "bg-white/10 text-white" : ""}`}>
                <i className={`bi ${link.icon} mr-1`}></i>{link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Dark Mode Toggle */}
            <button onClick={() => setDarkMode(!darkMode)} className="text-slate-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all duration-200" aria-label="Toggle dark mode">
              <i className={`bi ${darkMode ? "bi-sun-fill text-yellow-400" : "bi-moon-stars-fill"} text-lg`}></i>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button onClick={() => { setShowNotifs(!showNotifs); setShowUserMenu(false); }} className="text-slate-300 hover:text-white relative p-2 rounded-lg hover:bg-white/10 transition-all duration-200" aria-label="Notifications">
                <i className="bi bi-bell-fill text-lg"></i>
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-sra-danger text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{notifCount}</span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-sra-border z-50 fade-in-up">
                  <div className="p-3 border-b border-sra-border font-semibold text-sra-dark text-sm">Notifications</div>
                  {notifications.length > 0 ? notifications.map(n => (
                    <div key={n.id} className={`p-3 border-b border-sra-border text-sm hover:bg-slate-50 cursor-pointer transition-colors ${!n.is_read ? "bg-blue-50" : ""}`}>
                      <div className="text-sra-dark">{n.message}</div>
                      <div className="text-xs text-sra-muted mt-1">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  )) : <div className="p-4 text-center text-sra-muted text-sm">No notifications</div>}
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifs(false); }} className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors" aria-label="User menu">
                <div className="w-8 h-8 rounded-full bg-sra-primary flex items-center justify-center text-white text-sm font-bold">{name.charAt(0)}</div>
                <span className="hidden md:inline text-sm">{name}</span>
                <i className="bi bi-chevron-down text-xs hidden md:inline"></i>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-sra-border z-50 fade-in-up">
                  <div className="p-3 border-b border-sra-border">
                    <div className="font-semibold text-sra-dark">{name}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${role === "admin" ? "bg-purple-100 text-purple-700" : role === "volunteer" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{role?.charAt(0).toUpperCase()}{role?.slice(1)}</span>
                  </div>
                  <button onClick={() => { logout(); navigate("/login"); }} className="w-full text-left p-3 text-red-600 hover:bg-red-50 text-sm flex items-center gap-2 rounded-b-xl transition-colors">
                    <i className="bi bi-box-arrow-right"></i>Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-white/10 pb-3 fade-in-up">
            {navLinks().map((link, i) => (
              <Link key={i} to={link.to} onClick={() => setMobileOpen(false)} className={`block text-slate-300 hover:text-white hover:bg-white/10 px-3 py-2.5 rounded-lg text-sm mt-1 no-underline transition-all duration-200 ${location.pathname === link.to ? "bg-white/10 text-white" : ""}`}>
                <i className={`bi ${link.icon} mr-2`}></i>{link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
