import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost, SRA, SKILLS_LIST } from "../utils/api";

export default function Register() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"user" | "volunteer">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", confirmPassword: "",
    zone: "", lat: "", lng: "", skills: [] as string[],
  });

  useEffect(() => {
    if (SRA.token) navigate("/");
  }, [navigate]);

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleSkill = (skill: string) => {
    setForm(prev => ({
      ...prev,
      skills: prev.skills.includes(skill) ? prev.skills.filter(s => s !== skill) : [...prev.skills, skill],
    }));
  };

  const getMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { updateField("lat", pos.coords.latitude.toString()); updateField("lng", pos.coords.longitude.toString()); },
        () => setError("Unable to get your location. Please enter manually."),
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name || !form.email || !form.password) { setError("Please fill in all required fields."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (activeTab === "volunteer" && form.skills.length === 0) { setError("Please select at least one skill."); return; }

    setLoading(true);
    try {
      const payload: any = {
        name: form.name, email: form.email, password: form.password,
        role: activeTab, phone: form.phone || undefined,
      };
      if (activeTab === "volunteer") {
        payload.skills = form.skills;
        payload.skills_vector = form.skills.map(() => 1);
        payload.zone = form.zone;
        if (form.lat && form.lng) { payload.lat = parseFloat(form.lat); payload.lng = parseFloat(form.lng); }
      }

      const data = await apiPost("/api/auth/register", payload);
      if (data.token) {
        localStorage.setItem("sra_token", data.token);
        localStorage.setItem("sra_role", data.role);
        localStorage.setItem("sra_name", data.name);
        localStorage.setItem("sra_user_id", String(data.user_id));
        if (data.role === "admin") navigate("/dashboard");
        else if (data.role === "volunteer") navigate("/volunteer");
        else navigate("/user");
      } else {
        setError(data.message || "Registration failed. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page flex items-center justify-center p-4 py-8">
      {/* Animated background bubbles */}
      <div className="auth-bubble"></div>
      <div className="auth-bubble"></div>
      <div className="auth-bubble"></div>
      <div className="auth-bubble"></div>
      <div className="auth-bubble"></div>

      <div className="w-full max-w-[520px]">
        <div className="auth-card p-8 sm:p-10">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#2563EB] flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ animation: "pulseGlow 3s ease-in-out infinite" }}>
              <i className="bi bi-person-plus-fill text-white text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-sra-dark tracking-tight">Create Account</h1>
            <p className="text-sra-muted text-sm mt-2">Join the platform making a real difference</p>
          </div>

          {/* Tabs */}
          <div className="sra-tabs mb-6">
            <button onClick={() => setActiveTab("user")} className={`sra-tab ${activeTab === "user" ? "active" : ""}`}>
              <i className="bi bi-person"></i>Community Member
            </button>
            <button onClick={() => setActiveTab("volunteer")} className={`sra-tab ${activeTab === "volunteer" ? "active" : ""}`}>
              <i className="bi bi-people"></i>Volunteer
            </button>
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
            {/* Full Name */}
            <div className="sra-input-group">
              <label htmlFor="reg-name">Full Name</label>
              <div className="sra-input-wrapper">
                <i className="bi bi-person sra-input-icon"></i>
                <input type="text" className="sra-input" id="reg-name" placeholder="John Doe" value={form.name} onChange={e => updateField("name", e.target.value)} required />
              </div>
            </div>

            {/* Email */}
            <div className="sra-input-group">
              <label htmlFor="reg-email">Email Address</label>
              <div className="sra-input-wrapper">
                <i className="bi bi-envelope sra-input-icon"></i>
                <input type="email" className="sra-input" id="reg-email" placeholder="you@example.com" value={form.email} onChange={e => updateField("email", e.target.value)} required />
              </div>
            </div>

            {/* Phone */}
            <div className="sra-input-group">
              <label htmlFor="reg-phone">Phone Number {activeTab !== "volunteer" && <span className="text-sra-muted font-normal normal-case">(optional)</span>}</label>
              <div className="sra-input-wrapper">
                <i className="bi bi-phone sra-input-icon"></i>
                <input type="tel" className="sra-input" id="reg-phone" placeholder="+91 98765 43210" value={form.phone} onChange={e => updateField("phone", e.target.value)} required={activeTab === "volunteer"} />
              </div>
            </div>

            {/* Password */}
            <div className="sra-input-group">
              <label htmlFor="reg-pass">Password</label>
              <div className="sra-input-wrapper">
                <i className="bi bi-lock sra-input-icon"></i>
                <input type="password" className="sra-input" id="reg-pass" placeholder="Minimum 8 characters" value={form.password} onChange={e => updateField("password", e.target.value)} required minLength={8} />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="sra-input-group">
              <label htmlFor="reg-confirm">Confirm Password</label>
              <div className="sra-input-wrapper">
                <i className="bi bi-lock-fill sra-input-icon"></i>
                <input type="password" className="sra-input" id="reg-confirm" placeholder="Re-enter your password" value={form.confirmPassword} onChange={e => updateField("confirmPassword", e.target.value)} required />
              </div>
            </div>

            {/* Volunteer-only fields */}
            {activeTab === "volunteer" && (
              <div className="space-y-4 pt-2 border-t border-sra-border mt-2">
                {/* Skills */}
                <div className="sra-input-group" style={{ animationDelay: "0.45s" }}>
                  <label>Skills & Expertise</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {SKILLS_LIST.map(skill => (
                      <div key={skill} className={`skill-chip ${form.skills.includes(skill) ? "selected" : ""}`} onClick={() => toggleSkill(skill)}>
                        <span className="chip-check"><i className="bi bi-check"></i></span>
                        <span className="text-xs leading-tight">{skill}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Zone */}
                <div className="sra-input-group" style={{ animationDelay: "0.5s" }}>
                  <label htmlFor="reg-zone">Zone / Area of Operation</label>
                  <div className="sra-input-wrapper">
                    <i className="bi bi-geo sra-input-icon"></i>
                    <input type="text" className="sra-input" id="reg-zone" placeholder="e.g. North Delhi" value={form.zone} onChange={e => updateField("zone", e.target.value)} />
                  </div>
                </div>

                {/* Location */}
                <div className="sra-input-group" style={{ animationDelay: "0.55s" }}>
                  <label>Current Location</label>
                  <div className="flex gap-2 mt-1">
                    <div className="flex-1">
                      <div className="sra-input-wrapper">
                        <i className="bi bi-crosshair sra-input-icon"></i>
                        <input type="text" className="sra-input" placeholder="Latitude" value={form.lat} onChange={e => updateField("lat", e.target.value)} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="sra-input-wrapper">
                        <i className="bi bi-crosshair sra-input-icon"></i>
                        <input type="text" className="sra-input" placeholder="Longitude" value={form.lng} onChange={e => updateField("lng", e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={getMyLocation} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-sra-primary hover:text-blue-700 bg-transparent border-0 cursor-pointer transition-colors">
                    <i className="bi bi-geo-alt"></i>Use My Current Location
                  </button>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="mt-6">
              <button type="submit" disabled={loading} className="sra-btn-primary">
                {loading ? (
                  <><span className="spinner-border spinner-border-sm" role="status"></span>Creating account...</>
                ) : activeTab === "volunteer" ? (
                  <>Register as Volunteer <i className="bi bi-arrow-right"></i></>
                ) : (
                  <>Create Account <i className="bi bi-arrow-right"></i></>
                )}
              </button>
            </div>
          </form>

          <div className="sra-divider">
            <span>Already have an account?</span>
          </div>

          <div className="text-center">
            <button onClick={() => navigate("/login")} className="inline-flex items-center gap-2 text-sra-primary font-semibold text-sm hover:text-blue-700 bg-transparent border-0 cursor-pointer transition-colors">
              <i className="bi bi-box-arrow-in-right"></i> Sign in instead
            </button>
          </div>

          <div className="text-center mt-3">
            <button onClick={() => navigate("/register/admin")} className="inline-flex items-center gap-2 text-sra-muted text-xs hover:text-sra-dark bg-transparent border-0 cursor-pointer transition-colors">
              <i className="bi bi-building"></i> Registering an NGO? Apply for admin access
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
