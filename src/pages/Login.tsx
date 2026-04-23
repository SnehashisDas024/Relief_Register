import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost, SRA } from "../utils/api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (SRA.token) {
      const role = SRA.role;
      if (role === "admin") navigate("/dashboard");
      else if (role === "volunteer") navigate("/volunteer");
      else navigate("/");
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const data = await apiPost("/api/auth/login", { email, password });
      if (data.token) {
        localStorage.setItem("sra_token", data.token);
        localStorage.setItem("sra_role", data.role);
        localStorage.setItem("sra_name", data.name);
        localStorage.setItem("sra_user_id", String(data.user_id));
        if (data.role === "admin") navigate("/dashboard");
        else if (data.role === "volunteer") navigate("/volunteer");
        else navigate("/");
      } else {
        setError(data.message || "Invalid credentials. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page flex items-center justify-center p-4">
      {/* Animated background bubbles */}
      <div className="auth-bubble"></div>
      <div className="auth-bubble"></div>
      <div className="auth-bubble"></div>
      <div className="auth-bubble"></div>
      <div className="auth-bubble"></div>

      <div className="w-full max-w-[440px]">
        <div className="auth-card p-8 sm:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="relative inline-block">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#6366F1] flex items-center justify-center mx-auto mb-5 shadow-lg" style={{ animation: "pulseGlow 3s ease-in-out infinite" }}>
                <i className="bi bi-geo-alt-fill text-white text-2xl"></i>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-sra-dark tracking-tight">Welcome back</h1>
            <p className="text-sra-muted text-sm mt-2">Sign in to your Smart Resource Allocation account</p>
          </div>

          {/* Error */}
          {error && (
            <div className="sra-error-box mb-5">
              <i className="bi bi-exclamation-circle text-base"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="sra-input-group">
              <label htmlFor="email">Email Address</label>
              <div className="sra-input-wrapper">
                <i className="bi bi-envelope sra-input-icon"></i>
                <input
                  type="email"
                  className="sra-input"
                  id="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="sra-input-group">
              <label htmlFor="password">Password</label>
              <div className="sra-input-wrapper">
                <i className="bi bi-lock sra-input-icon"></i>
                <input
                  type={showPassword ? "text" : "password"}
                  className="sra-input"
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="sra-password-toggle" aria-label="Toggle password visibility">
                  <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <label className="flex items-center gap-2 text-sm text-sra-muted cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-sra-border text-sra-primary accent-[#2563EB]" />
                Remember me
              </label>
              <a href="#" className="text-sm font-medium text-sra-primary hover:text-blue-700 no-underline transition-colors">Forgot password?</a>
            </div>

            <button type="submit" disabled={loading} className="sra-btn-primary">
              {loading ? (
                <><span className="spinner-border spinner-border-sm" role="status"></span>Signing in...</>
              ) : (
                <>Sign In <i className="bi bi-arrow-right"></i></>
              )}
            </button>
          </form>

          <div className="sra-divider">
            <span>New here?</span>
          </div>

          <div className="text-center">
            <button onClick={() => navigate("/register")} className="inline-flex items-center gap-2 text-sra-primary font-semibold text-sm hover:text-blue-700 bg-transparent border-0 cursor-pointer transition-colors">
              Create an account <i className="bi bi-arrow-right"></i>
            </button>
          </div>
        </div>

        {/* Bottom tagline */}
        <p className="text-center text-xs text-blue-200/50 mt-6 relative z-10">
          Smart Resource Allocation • H2S × Google for Developers
        </p>
      </div>
    </div>
  );
}
