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
        else navigate("/");
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
    <div className="min-h-screen bg-sra-light flex items-center justify-center p-4">
      <div className="w-full max-w-[520px]">
        <div className="sra-card shadow-lg">
          {/* Header */}
          <div className="text-center pt-6 pb-2">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-sra-primary flex items-center justify-center mx-auto mb-3">
              <i className="bi bi-person-plus-fill text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-sra-dark">Create Account</h1>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-sra-border mx-6">
            <button onClick={() => setActiveTab("user")} className={`flex-1 py-3 text-center font-medium text-sm border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === "user" ? "border-sra-primary text-sra-primary" : "border-transparent text-sra-muted hover:text-sra-dark"}`}>
              <i className="bi bi-person"></i>Community Member
            </button>
            <button onClick={() => setActiveTab("volunteer")} className={`flex-1 py-3 text-center font-medium text-sm border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === "volunteer" ? "border-sra-primary text-sra-primary" : "border-transparent text-sra-muted hover:text-sra-dark"}`}>
              <i className="bi bi-people"></i>Volunteer / Field Worker
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2 fade-in-up">
              <i className="bi bi-exclamation-circle"></i>{error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-3">
            <div className="form-floating">
              <input type="text" className="form-control rounded-xl border-sra-border" id="reg-name" placeholder="Full Name" value={form.name} onChange={e => updateField("name", e.target.value)} required />
              <label htmlFor="reg-name">Full Name *</label>
            </div>
            <div className="form-floating">
              <input type="email" className="form-control rounded-xl border-sra-border" id="reg-email" placeholder="Email" value={form.email} onChange={e => updateField("email", e.target.value)} required />
              <label htmlFor="reg-email">Email Address *</label>
            </div>
            <div className="form-floating">
              <input type="tel" className="form-control rounded-xl border-sra-border" id="reg-phone" placeholder="Phone" value={form.phone} onChange={e => updateField("phone", e.target.value)} required={activeTab === "volunteer"} />
              <label htmlFor="reg-phone">Phone Number {activeTab === "volunteer" ? "*" : "(optional)"}</label>
            </div>
            <div className="form-floating">
              <input type="password" className="form-control rounded-xl border-sra-border" id="reg-pass" placeholder="Password" value={form.password} onChange={e => updateField("password", e.target.value)} required minLength={8} />
              <label htmlFor="reg-pass">Password * (min 8 characters)</label>
            </div>
            <div className="form-floating">
              <input type="password" className="form-control rounded-xl border-sra-border" id="reg-confirm" placeholder="Confirm" value={form.confirmPassword} onChange={e => updateField("confirmPassword", e.target.value)} required />
              <label htmlFor="reg-confirm">Confirm Password *</label>
            </div>

            {/* Volunteer-only fields */}
            {activeTab === "volunteer" && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-sra-muted mb-2 block">Skills *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SKILLS_LIST.map(skill => (
                      <label key={skill} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors ${form.skills.includes(skill) ? "border-sra-primary bg-blue-50 text-sra-primary" : "border-sra-border text-sra-muted hover:border-sra-primary"}`}>
                        <input type="checkbox" className="form-check-input m-0" checked={form.skills.includes(skill)} onChange={() => toggleSkill(skill)} />
                        {skill}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-floating">
                  <input type="text" className="form-control rounded-xl border-sra-border" id="reg-zone" placeholder="Zone" value={form.zone} onChange={e => updateField("zone", e.target.value)} />
                  <label htmlFor="reg-zone">Zone / Area of Operation</label>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-sra-muted mb-2 block">Current Location</label>
                  <div className="flex gap-2">
                    <div className="form-floating flex-1">
                      <input type="text" className="form-control rounded-xl border-sra-border" id="reg-lat" placeholder="Latitude" value={form.lat} onChange={e => updateField("lat", e.target.value)} />
                      <label htmlFor="reg-lat">Latitude</label>
                    </div>
                    <div className="form-floating flex-1">
                      <input type="text" className="form-control rounded-xl border-sra-border" id="reg-lng" placeholder="Longitude" value={form.lng} onChange={e => updateField("lng", e.target.value)} />
                      <label htmlFor="reg-lng">Longitude</label>
                    </div>
                  </div>
                  <button type="button" onClick={getMyLocation} className="btn btn-sm btn-outline-primary mt-2 rounded-xl">
                    <i className="bi bi-crosshair me-1"></i>Use My Location
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full btn bg-sra-primary text-white py-3 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 border-0 mt-4">
              {loading ? (<><span className="spinner-border spinner-border-sm" role="status"></span>Creating account...</>) : activeTab === "volunteer" ? (<><i className="bi bi-person-check"></i>Register as Volunteer</>) : (<><i className="bi bi-person-plus"></i>Create Account</>)}
            </button>
          </form>

          <div className="text-center pb-6">
            <span className="text-sra-muted text-sm">Already have an account? </span>
            <a href="/login" className="text-sra-primary font-semibold text-sm no-underline hover:underline" onClick={e => { e.preventDefault(); navigate("/login"); }}>Sign in</a>
          </div>
        </div>
      </div>
    </div>
  );
}
