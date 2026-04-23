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
    <div className="min-h-screen bg-sra-light flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="sra-card shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-sra-primary flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-geo-alt-fill text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-sra-dark">Welcome Back</h1>
            <p className="text-sra-muted text-sm mt-1">Sign in to continue</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4 flex items-center gap-2 fade-in-up">
              <i className="bi bi-exclamation-circle"></i>{error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-floating mb-3">
              <input type="email" className="form-control form-control-lg rounded-xl border-sra-border" id="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              <label htmlFor="email">Email address</label>
            </div>
            <div className="form-floating mb-3 position-relative">
              <input type={showPassword ? "text" : "password"} className="form-control form-control-lg rounded-xl border-sra-border pe-12" id="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
              <label htmlFor="password">Password</label>
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-sra-muted me-3 p-0" aria-label="Toggle password visibility">
                <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
              </button>
            </div>

            <div className="text-end mb-4">
              <a href="#" className="text-sra-primary text-sm no-underline hover:underline">Forgot password?</a>
            </div>

            <button type="submit" disabled={loading} className="w-full btn bg-sra-primary text-white py-3 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 border-0">
              {loading ? (<><span className="spinner-border spinner-border-sm" role="status"></span>Signing in...</>) : (<><i className="bi bi-box-arrow-in-right"></i>Sign In</>)}
            </button>
          </form>

          <div className="text-center mt-5">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-sra-border"></div></div>
              <span className="relative bg-white px-4 text-sm text-sra-muted">Don't have an account?</span>
            </div>
            <a href="/register" className="text-sra-primary font-semibold no-underline hover:underline" onClick={e => { e.preventDefault(); navigate("/register"); }}>Create an account <i className="bi bi-arrow-right"></i></a>
          </div>
        </div>
      </div>
    </div>
  );
}
