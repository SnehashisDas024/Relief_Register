import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SRA } from "../utils/api";

const API_BASE = "";

export default function AdminRegister() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", confirmPassword: "",
    ngo_name: "", ngo_head_id: "",
  });

  useEffect(() => {
    if (SRA.token) navigate("/");
  }, [navigate]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 10 * 1024 * 1024) {
      setError("Proof file must be under 10 MB.");
      return;
    }
    setProofFile(f);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (!form.name || !form.email || !form.password || !form.ngo_name || !form.ngo_head_id)
      return setError("Please fill in all required fields.");
    if (form.password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirmPassword)
      return setError("Passwords do not match.");
    if (!proofFile)
      return setError("Please upload proof of NGO registration.");

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("email", form.email);
      fd.append("phone", form.phone);
      fd.append("password", form.password);
      fd.append("ngo_name", form.ngo_name);
      fd.append("ngo_head_id", form.ngo_head_id);
      fd.append("proof_file", proofFile);

      const res = await fetch(`${API_BASE}/api/auth/admin-register`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Registration submitted! Your account will be reviewed by a superadmin. You will be notified once approved.");
        setForm({ name:"", email:"", phone:"", password:"", confirmPassword:"", ngo_name:"", ngo_head_id:"" });
        setProofFile(null);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        setError(data.message || "Registration failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="auth-page flex items-center justify-center p-4 py-8">
      <div className="auth-bubble"></div>
      <div className="auth-bubble"></div>
      <div className="auth-bubble"></div>

      <div className="w-full" style={{ maxWidth: 560 }}>
        <div className="auth-card p-8 sm:p-10">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
              style={{ background: "linear-gradient(135deg,#7C3AED,#2563EB)", animation: "pulseGlow 3s ease-in-out infinite" }}>
              <i className="bi bi-building-check text-white text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-sra-dark tracking-tight">NGO Admin Registration</h1>
            <p className="text-sra-muted text-sm mt-2">
              Register your NGO to manage resources and volunteers. Accounts are reviewed before activation.
            </p>
          </div>

          {/* Error / Success */}
          {error && (
            <div className="sra-error-box mb-5">
              <i className="bi bi-exclamation-circle text-base"></i><span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-5 flex items-start gap-3 p-4 rounded-xl border"
              style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.3)", color: "#059669" }}>
              <i className="bi bi-check-circle-fill text-lg flex-shrink-0 mt-0.5"></i>
              <div>
                <div className="font-semibold text-sm mb-1">Application Submitted!</div>
                <div className="text-xs opacity-80">{success}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Section: Personal Info */}
            <div className="text-xs font-semibold text-sra-muted uppercase tracking-wider mb-3">
              <i className="bi bi-person me-1"></i>Your Details
            </div>

            <div className="sra-input-group">
              <label>Full Name <span className="text-red-500">*</span></label>
              <div className="sra-input-wrapper">
                <i className="bi bi-person sra-input-icon"></i>
                <input className="sra-input" type="text" placeholder="Jane Doe" value={form.name} onChange={set("name")} required />
              </div>
            </div>

            <div className="sra-input-group">
              <label>Email Address <span className="text-red-500">*</span></label>
              <div className="sra-input-wrapper">
                <i className="bi bi-envelope sra-input-icon"></i>
                <input className="sra-input" type="email" placeholder="you@ngo.org" value={form.email} onChange={set("email")} required />
              </div>
            </div>

            <div className="sra-input-group">
              <label>Phone Number</label>
              <div className="sra-input-wrapper">
                <i className="bi bi-phone sra-input-icon"></i>
                <input className="sra-input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="sra-input-group">
                <label>Password <span className="text-red-500">*</span></label>
                <div className="sra-input-wrapper">
                  <i className="bi bi-lock sra-input-icon"></i>
                  <input className="sra-input" type="password" placeholder="Min. 8 characters" value={form.password} onChange={set("password")} required minLength={8} />
                </div>
              </div>
              <div className="sra-input-group">
                <label>Confirm Password <span className="text-red-500">*</span></label>
                <div className="sra-input-wrapper">
                  <i className="bi bi-lock-fill sra-input-icon"></i>
                  <input className="sra-input" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={set("confirmPassword")} required />
                </div>
              </div>
            </div>

            {/* Section: NGO Info */}
            <div className="text-xs font-semibold text-sra-muted uppercase tracking-wider mt-5 mb-3 pt-4 border-t border-sra-border">
              <i className="bi bi-building me-1"></i>NGO Details
            </div>

            <div className="sra-input-group">
              <label>NGO / Organisation Name <span className="text-red-500">*</span></label>
              <div className="sra-input-wrapper">
                <i className="bi bi-building sra-input-icon"></i>
                <input className="sra-input" type="text" placeholder="e.g. Helping Hands Foundation" value={form.ngo_name} onChange={set("ngo_name")} required />
              </div>
            </div>

            <div className="sra-input-group">
              <label>
                NGO Head / Registration ID <span className="text-red-500">*</span>
                <span className="text-sra-muted font-normal text-xs ml-1">(Gov-issued registration number or DARPAN ID)</span>
              </label>
              <div className="sra-input-wrapper">
                <i className="bi bi-fingerprint sra-input-icon"></i>
                <input className="sra-input" type="text" placeholder="e.g. MH/2023/0012345 or NITI-GJ-2023-0001234"
                  value={form.ngo_head_id} onChange={set("ngo_head_id")} required />
              </div>
            </div>

            {/* Proof upload */}
            <div className="sra-input-group">
              <label>
                Proof of Registration <span className="text-red-500">*</span>
                <span className="text-sra-muted font-normal text-xs ml-1">(PDF, JPG, or PNG — max 10 MB)</span>
              </label>
              <div
                className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors"
                style={{
                  borderColor: proofFile ? "#10B981" : "var(--sra-border)",
                  background: proofFile ? "rgba(16,185,129,0.05)" : "var(--sra-bg-input)",
                }}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFile} className="hidden" style={{ display: "none" }} />
                {proofFile ? (
                  <div className="flex items-center justify-center gap-2" style={{ color: "#10B981" }}>
                    <i className="bi bi-file-earmark-check-fill text-xl"></i>
                    <div className="text-left">
                      <div className="text-sm font-semibold">{proofFile.name}</div>
                      <div className="text-xs opacity-70">{(proofFile.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button type="button" className="ml-3 text-xs opacity-60 hover:opacity-100"
                      onClick={e => { e.stopPropagation(); setProofFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
                      <i className="bi bi-x-circle"></i>
                    </button>
                  </div>
                ) : (
                  <div>
                    <i className="bi bi-cloud-upload text-3xl text-sra-muted mb-2 block"></i>
                    <div className="text-sm text-sra-muted">Click to upload or drag & drop</div>
                    <div className="text-xs text-sra-muted mt-1">Certificate of Incorporation, 12A, 80G, or similar</div>
                  </div>
                )}
              </div>
            </div>

            {/* Info box */}
            <div className="rounded-xl p-3 mb-5 flex gap-3"
              style={{ background: "rgba(37,99,235,0.07)", border: "1px solid rgba(37,99,235,0.2)" }}>
              <i className="bi bi-info-circle text-blue-500 flex-shrink-0 mt-0.5"></i>
              <p className="text-xs text-sra-muted m-0">
                Your application will be reviewed by a platform superadmin. Once verified, your account will be activated and you will have full admin access to manage needs, volunteers, and resources.
              </p>
            </div>

            <button type="submit" disabled={loading} className="sra-btn-primary">
              {loading
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Submitting application...</>
                : <><i className="bi bi-send me-2"></i>Submit NGO Registration</>
              }
            </button>
          </form>

          <div className="sra-divider"><span>Already have an account?</span></div>
          <div className="text-center">
            <button onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 text-sra-primary font-semibold text-sm bg-transparent border-0 cursor-pointer">
              <i className="bi bi-box-arrow-in-right"></i> Sign in instead
            </button>
          </div>
          <div className="text-center mt-3">
            <button onClick={() => navigate("/register")}
              className="inline-flex items-center gap-2 text-sra-muted text-xs bg-transparent border-0 cursor-pointer">
              <i className="bi bi-arrow-left"></i> Register as volunteer or community member
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-6 relative z-10" style={{ color: "rgba(147,197,253,0.5)" }}>
          Smart Resource Allocation • NGO Admin Portal
        </p>
      </div>
    </div>
  );
}
