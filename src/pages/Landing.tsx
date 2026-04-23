import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  const statsRef = useRef<HTMLDivElement>(null);
  const statsAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !statsAnimated.current) {
          statsAnimated.current = true;
          animateCounters();
        }
      });
    }, { threshold: 0.3 });
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const animateCounters = () => {
    document.querySelectorAll("[data-count]").forEach(el => {
      const target = parseInt(el.getAttribute("data-count") || "0");
      const suffix = el.getAttribute("data-suffix") || "";
      let current = 0;
      const step = Math.ceil(target / 60);
      const timer = setInterval(() => {
        current += step;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = current.toLocaleString() + suffix;
      }, 16);
    });
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#1E293B] via-[#1e3a5f] to-[#2563EB] text-white overflow-hidden">
        <div className="hero-pattern absolute inset-0" />
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-6 leading-tight fade-in-up">
            Community Data.<br />Real Action.<br /><span className="text-sra-secondary">Real Impact.</span>
          </h1>
          <p className="text-lg md:text-xl text-blue-200 max-w-2xl mx-auto mb-10 fade-in-up" style={{ animationDelay: "0.2s" }}>
            Connecting NGOs with the right volunteers for the most urgent community needs — powered by AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center fade-in-up" style={{ animationDelay: "0.4s" }}>
            <Link to="/register" className="inline-flex items-center justify-center gap-2 bg-white text-sra-primary font-semibold px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors text-lg no-underline shadow-lg">
              <i className="bi bi-rocket-takeoff"></i>Get Started
            </Link>
            <a href="#features" onClick={e => { e.preventDefault(); document.getElementById("features")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="inline-flex items-center justify-center gap-2 border-2 border-white/30 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-white/10 hover:border-white/50 transition-all duration-300 text-lg no-underline">
              <i className="bi bi-arrow-down-circle"></i>Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section ref={statsRef} className="bg-white border-b border-sra-border py-10">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { count: 2400, suffix: "+", label: "Needs Addressed", icon: "bi-check-circle" },
            { count: 580, suffix: "+", label: "Volunteers", icon: "bi-people" },
            { count: 94, suffix: "%", label: "Match Success Rate", icon: "bi-bullseye" },
            { count: 12, suffix: "", label: "NGO Partners", icon: "bi-building" },
          ].map((s, i) => (
            <div key={i} className="fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <i className={`${s.icon} text-2xl text-sra-primary mb-2 block`}></i>
              <div data-count={s.count} data-suffix={s.suffix} className="text-3xl md:text-4xl font-bold text-sra-dark">0{s.suffix}</div>
              <div className="text-sra-muted text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-sra-light">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-sra-dark mb-4">How It Works</h2>
          <p className="text-sra-muted text-center mb-12 max-w-2xl mx-auto">Our platform uses AI to match community needs with the best-suited volunteers based on skills, proximity, and urgency.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "bi-upload", title: "Smart Data Ingestion", desc: "Upload CSV, images, or PDFs. Our AI extracts, cleans, and classifies community needs automatically." },
              { icon: "bi-graph-up-arrow", title: "Priority Intelligence", desc: "Every need is scored by severity, urgency, and volunteer gap. The most critical needs always surface first." },
              { icon: "bi-geo-alt", title: "Location-Aware Matching", desc: "Volunteers are matched by skills AND proximity. High urgency means nearby. Low urgency means best fit." },
            ].map((f, i) => (
              <div key={i} className="sra-card feature-card p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-sra-primary flex items-center justify-center mx-auto mb-5">
                  <i className={`bi ${f.icon} text-3xl`}></i>
                </div>
                <h3 className="text-xl font-semibold text-sra-dark mb-3">{f.title}</h3>
                <p className="text-sra-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Timeline */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-sra-dark mb-12">Step by Step</h2>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {["Upload Data", "AI Processes", "Needs Prioritized", "Volunteer Matched", "Task Assigned", "Community Helped"].map((step, i) => (
              <div key={i} className="flex md:flex-col items-center gap-3 flex-1 relative">
                <div className="w-12 h-12 rounded-full bg-sra-primary text-white flex items-center justify-center font-bold text-lg flex-shrink-0 relative z-10">
                  {i + 1}
                </div>
                {i < 5 && <div className="hidden md:block absolute top-6 left-[calc(50%+24px)] w-[calc(100%-48px)] h-0.5 bg-sra-border"></div>}
                <span className="text-sm font-medium text-sra-dark text-center">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-20 bg-sra-light">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-sra-dark mb-12">Join as...</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "bi-shield-check", role: "Admin", color: "bg-purple-50 text-purple-600",
                bullets: ["Upload CSV / image / PDF field data", "View analytics dashboard with charts", "Review AI matches and assign tasks"],
                btnLabel: "Register as Admin", btnLink: "/register"
              },
              {
                icon: "bi-person-badge", role: "Volunteer", color: "bg-green-50 text-green-600",
                bullets: ["Accept or decline assigned tasks", "Enable live GPS tracking on task", "Rate task completion and view history"],
                btnLabel: "Register as Volunteer", btnLink: "/register"
              },
              {
                icon: "bi-people", role: "Community Member", color: "bg-blue-50 text-blue-600",
                bullets: ["Submit community needs via form", "Track status of submitted needs", "Chat with assigned volunteer"],
                btnLabel: "Join as Member", btnLink: "/register"
              },
            ].map((r, i) => (
              <div key={i} className="sra-card p-6">
                <div className={`w-14 h-14 rounded-2xl ${r.color} flex items-center justify-center mb-4`}>
                  <i className={`bi ${r.icon} text-2xl`}></i>
                </div>
                <h3 className="text-xl font-semibold text-sra-dark mb-3">{r.role}</h3>
                <ul className="space-y-2 mb-5">
                  {r.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2 text-sra-muted text-sm">
                      <i className="bi bi-check2 text-sra-secondary mt-0.5"></i>{b}
                    </li>
                  ))}
                </ul>
                <Link to={r.btnLink} className="inline-flex items-center gap-2 text-sra-primary font-semibold text-sm hover:underline no-underline">
                  {r.btnLabel} <i className="bi bi-arrow-right"></i>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1E293B] text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <i className="bi bi-geo-alt-fill text-sra-primary text-xl"></i>
                <span className="font-bold text-lg">Smart Resource Allocation</span>
              </div>
              <p className="text-slate-400 text-sm">Bridging the gap between community needs and volunteer action.</p>
            </div>
            <div className="text-slate-400 text-sm text-center md:text-right">
              <p className="mb-1">H2S × Google for Developers</p>
              <div className="flex gap-4 justify-center md:justify-end">
                <a href="#" className="text-slate-400 hover:text-white transition-colors no-underline">About</a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors no-underline">Privacy</a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors no-underline">Contact</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
