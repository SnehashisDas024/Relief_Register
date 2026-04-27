// frontend/src/utils/api.ts
// Shared API utilities.
// In development, Vite proxies /api/* → http://localhost:5000.
// In production (served by Flask), /api/* hits the same origin.
// Mock data kicks in automatically when the real API is unreachable.

export interface SRAState {
  token: string | null;
  role: string | null;
  name: string | null;
  userId: number | null;
}

export const SRA: SRAState = {
  get token()  { return localStorage.getItem("sra_token"); },
  get role()   { return localStorage.getItem("sra_role"); },
  get name()   { return localStorage.getItem("sra_name"); },
  get userId() { const v = localStorage.getItem("sra_user_id"); return v ? parseInt(v) : null; },
};

export function getAuthHeaders(includeContentType = true): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${SRA.token || ""}` };
  if (includeContentType) h["Content-Type"] = "application/json";
  return h;
}

// ─── Mock data (used as fallback when API is unreachable) ──────────────────

const MOCK_NEEDS = [
  { id: 1, category: "Medical", description: "Emergency medical supplies needed for flood-affected families in North Delhi.", severity: 0.9, urgency_score: 0.92, score_breakdown: { severity: 0.9, frequency: 0.8, gap: 0.95 }, status: "open", location: "North Delhi", zone: "North Delhi", lat: 28.7041, lng: 77.1025, created_at: "2024-12-15T10:30:00Z" },
  { id: 2, category: "Food", description: "Food distribution required for 200+ families displaced by recent demolition.", severity: 0.75, urgency_score: 0.78, score_breakdown: { severity: 0.75, frequency: 0.7, gap: 0.85 }, status: "open", location: "South Delhi", zone: "South Delhi", lat: 28.5285, lng: 77.2290, created_at: "2024-12-15T09:15:00Z" },
  { id: 3, category: "Shelter", description: "Temporary shelter needed for 50 families whose homes were damaged in last night's storm.", severity: 0.65, urgency_score: 0.68, score_breakdown: { severity: 0.65, frequency: 0.6, gap: 0.75 }, status: "assigned", location: "East Delhi", zone: "East Delhi", lat: 28.6280, lng: 77.3680, created_at: "2024-12-15T08:00:00Z" },
  { id: 4, category: "Education", description: "School supplies and volunteer teachers needed for community learning center.", severity: 0.35, urgency_score: 0.38, score_breakdown: { severity: 0.35, frequency: 0.4, gap: 0.3 }, status: "open", location: "West Delhi", zone: "West Delhi", lat: 28.6510, lng: 77.0920, created_at: "2024-12-14T16:00:00Z" },
  { id: 5, category: "Mental Health", description: "Counseling services needed for trauma-affected community members.", severity: 0.55, urgency_score: 0.58, score_breakdown: { severity: 0.55, frequency: 0.5, gap: 0.65 }, status: "open", location: "Central Delhi", zone: "Central Delhi", lat: 28.6320, lng: 77.2200, created_at: "2024-12-14T14:30:00Z" },
  { id: 6, category: "Food", description: "Community kitchen needs volunteers and supplies to serve 150 daily meals.", severity: 0.50, urgency_score: 0.52, score_breakdown: { severity: 0.5, frequency: 0.6, gap: 0.45 }, status: "assigned", location: "South Delhi", zone: "South Delhi", lat: 28.5400, lng: 77.2500, created_at: "2024-12-14T11:00:00Z" },
  { id: 7, category: "Medical", description: "First aid training workshop for community health workers.", severity: 0.25, urgency_score: 0.28, score_breakdown: { severity: 0.25, frequency: 0.3, gap: 0.2 }, status: "completed", location: "North Delhi", zone: "North Delhi", lat: 28.7100, lng: 77.1100, created_at: "2024-12-13T09:00:00Z" },
  { id: 8, category: "Construction", description: "Community center roof repair needed before monsoon season.", severity: 0.42, urgency_score: 0.45, score_breakdown: { severity: 0.42, frequency: 0.35, gap: 0.55 }, status: "open", location: "East Delhi", zone: "East Delhi", lat: 28.6350, lng: 77.3100, created_at: "2024-12-15T07:45:00Z" },
];

const MOCK_VOLUNTEERS = [
  { id: 1, name: "Priya Sharma",  email: "priya@example.com",  lat: 28.6900, lng: 77.1200, is_available: true,  rating: 4.5, skills: ["Medical & First Aid", "Counseling & Mental Health"], zone: "North Delhi",   is_active: true, role: "volunteer", created_at: "2024-01-15T00:00:00Z" },
  { id: 2, name: "Arjun Patel",   email: "arjun@example.com",  lat: 28.5400, lng: 77.2400, is_available: true,  rating: 4.8, skills: ["Food Distribution", "Logistics & Transport"],        zone: "South Delhi",   is_active: true, role: "volunteer", created_at: "2024-02-20T00:00:00Z" },
  { id: 3, name: "Meera Gupta",   email: "meera@example.com",  lat: 28.6300, lng: 77.3500, is_available: false, rating: 4.2, skills: ["Teaching & Education", "Community Outreach"],         zone: "East Delhi",    is_active: true, role: "volunteer", created_at: "2024-03-10T00:00:00Z" },
  { id: 4, name: "Ravi Kumar",    email: "ravi@example.com",   lat: 28.6500, lng: 77.0900, is_available: true,  rating: 4.0, skills: ["Construction & Shelter", "Data Collection & Reporting"], zone: "West Delhi",  is_active: true, role: "volunteer", created_at: "2024-04-05T00:00:00Z" },
  { id: 5, name: "Sunita Devi",   email: "sunita@example.com", lat: 28.6200, lng: 77.2100, is_available: true,  rating: 4.7, skills: ["Counseling & Mental Health", "Medical & First Aid"],  zone: "Central Delhi", is_active: true, role: "volunteer", created_at: "2024-05-01T00:00:00Z" },
];

const MOCK_USERS = [
  { id: 10, name: "Admin User",   email: "admin@sra.org",           role: "admin",     is_active: true,  created_at: "2024-01-01T00:00:00Z" },
  { id: 11, name: "Rahul Verma",  email: "rahul@community.org",     role: "user",      is_active: true,  created_at: "2024-06-15T00:00:00Z" },
  { id: 12, name: "Anita Singh",  email: "anita@community.org",     role: "user",      is_active: true,  created_at: "2024-07-20T00:00:00Z" },
  { id: 13, name: "Deepak Joshi", email: "deepak@community.org",    role: "user",      is_active: false, created_at: "2024-08-10T00:00:00Z" },
  ...MOCK_VOLUNTEERS.map(v => ({ ...v, is_active: true })),
];

const MOCK_STATS = {
  open_needs: 47, completed_today: 12, active_volunteers: 23,
  match_success_rate: 0.94,
  needs_by_category: { Medical: 14, Food: 11, Shelter: 8, Education: 5, "Mental Health": 4, Construction: 5 },
  status_distribution: { open: 47, assigned: 18, completed: 89 },
};

const MOCK_MESSAGES = [
  { id: 1, sender_id: 10, sender_name: "Admin User",    content: "Hi! A new high-urgency medical need has been reported in your zone. Can you take a look?",                       created_at: "2024-12-15T09:00:00Z", is_read: true,  role: "admin"     },
  { id: 2, sender_id: 1,  sender_name: "Priya Sharma",  content: "Yes, I'm available. What's the exact location and what supplies are needed?",                                   created_at: "2024-12-15T09:05:00Z", is_read: true,  role: "volunteer" },
  { id: 3, sender_id: 10, sender_name: "Admin User",    content: "It's near the community center in North Delhi. They need first aid kits and wound care supplies for ~30 people.", created_at: "2024-12-15T09:10:00Z", is_read: true,  role: "admin"     },
  { id: 4, sender_id: 1,  sender_name: "Priya Sharma",  content: "Perfect. I'll head there now. Should arrive within 20 minutes.",                                               created_at: "2024-12-15T09:12:00Z", is_read: true,  role: "volunteer" },
  { id: 5, sender_id: 10, sender_name: "Admin User",    content: "Great! GPS tracking enabled on the map. Stay safe. 🙏",                                                          created_at: "2024-12-15T09:15:00Z", is_read: false, role: "admin"     },
];

const MOCK_DEAD_LETTERS = [
  { id: 1, source_id: "src_abc123def", reason: "Invalid CSV format: missing required 'category' column",       raw_data: { filename: "field_report_dec.csv",        rows_attempted: 150, error_line: 3 },        created_at: "2024-12-15T08:30:00Z", reviewed: false },
  { id: 2, source_id: "src_xyz789ghi", reason: "Image processing failed: unable to extract text from image",   raw_data: { filename: "photo_need_42.jpg",           size_kb: 2400, ocr_confidence: 0.12 },      created_at: "2024-12-15T07:15:00Z", reviewed: false },
  { id: 3, source_id: "src_qrs456tuv", reason: "PDF parsing error: encrypted document",                        raw_data: { filename: "community_assessment.pdf",    pages: 8, encrypted: true },                created_at: "2024-12-14T22:00:00Z", reviewed: true  },
];

const MOCK_PIPELINE: Record<string, { stage: string; timestamp: string; meta: Record<string, string> }> = {
  "src_test123": { stage: "matched", timestamp: "2024-12-15T10:00:00Z", meta: { extracted: "2024-12-15T09:55:00Z", cleaned: "2024-12-15T09:56:00Z", classified: "2024-12-15T09:57:00Z", scored: "2024-12-15T09:58:00Z", matched: "2024-12-15T10:00:00Z" } },
};

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, fallback: T, options?: RequestInit): Promise<T> {
  try {
    const isFormData = options?.body instanceof FormData;
    const res = await fetch(url, {
      ...options,
      headers: { ...getAuthHeaders(!isFormData), ...(options?.headers || {}) },
    });
    if (res.status === 401) { logout(); return fallback; }
    if (res.ok) return (await res.json()) as T;
    console.warn(`API ${url} returned ${res.status}, using fallback`);
    return fallback;
  } catch {
    console.warn(`API ${url} unreachable, using mock fallback`);
    return fallback;
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function apiGet(url: string): Promise<any> {
  if (url.includes("/api/needs"))                  return apiFetch(url, { needs: MOCK_NEEDS });
  if (url.includes("/api/admin/stats"))            return apiFetch(url, MOCK_STATS);
  if (url.includes("/api/volunteers/location"))    return apiFetch(url, { volunteers: MOCK_VOLUNTEERS });
  if (url.includes("/api/volunteers/tasks"))       return apiFetch(url, {
    active: [{ id: 101, need: MOCK_NEEDS[0], status: "assigned", assigned_at: "2024-12-15T10:30:00Z", chat_room: "task_101" }],
    history: [
      { id: 99, need: MOCK_NEEDS[6], status: "completed", assigned_at: "2024-12-13T09:00:00Z", completed_at: "2024-12-13T16:00:00Z", chat_room: "task_99", rating: 5 },
      { id: 98, need: MOCK_NEEDS[3], status: "completed", assigned_at: "2024-12-10T08:00:00Z", completed_at: "2024-12-10T14:00:00Z", chat_room: "task_98", rating: 4 },
    ],
  });
  if (url.includes("/api/match/"))                 return apiFetch(url, {
    matches: MOCK_VOLUNTEERS.filter(v => v.is_available).map(v => ({
      volunteer_id: v.id, name: v.name, skills: v.skills,
      distance_km: +(Math.random() * 15 + 1).toFixed(1),
      skill_score:  +(0.6 + Math.random() * 0.35).toFixed(2),
      geo_score:    +(0.5 + Math.random() * 0.4).toFixed(2),
      final_score:  +(0.7 + Math.random() * 0.25).toFixed(2),
    })).sort((a, b) => b.final_score - a.final_score),
  });
  if (url.includes("/api/chat/") && url.includes("/history")) return apiFetch(url, { messages: MOCK_MESSAGES });
  if (url.includes("/api/notifications"))          return apiFetch(url, { notifications: [{ id: 1, message: "New high-urgency need in your zone", notification_type: "task", is_read: false, created_at: "2024-12-15T10:30:00Z" }], unread_count: 3 });
  if (url.includes("/api/admin/users"))            return apiFetch(url, { users: MOCK_USERS, total: MOCK_USERS.length, page: 1 });
  if (url.includes("/api/admin/dead-letters"))     return apiFetch(url, { items: MOCK_DEAD_LETTERS, total_unreviewed: MOCK_DEAD_LETTERS.filter(d => !d.reviewed).length });
  if (url.includes("/api/admin/pipeline/")) {
    const sid = url.split("/api/admin/pipeline/")[1];
    return apiFetch(url, MOCK_PIPELINE[sid] || { stage: "extracted", timestamp: new Date().toISOString(), meta: {} });
  }
  return apiFetch(url, {});
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function apiPost(url: string, data?: any): Promise<any> {
  if (url.includes("/api/auth/login")) {
    const fallback = (() => {
      const { email = "", password = "" } = data || {};
      if (!email || !password) throw new Error("Credentials required");
      if (email.includes("admin"))     return { token: "mock_jwt_admin_"     + Date.now(), role: "admin",     name: "Admin User",   user_id: 10 };
      if (email.includes("volunteer") || email.includes("priya")) return { token: "mock_jwt_vol_" + Date.now(), role: "volunteer", name: "Priya Sharma", user_id: 1 };
      return { token: "mock_jwt_user_" + Date.now(), role: "user", name: "Rahul Verma", user_id: 11 };
    })();
    return apiFetch(url, fallback, { method: "POST", body: JSON.stringify(data) });
  }
  if (url.includes("/api/auth/register")) {
    const role = data?.role || "user";
    return apiFetch(url, { token: "mock_jwt_" + role + "_" + Date.now(), role, name: data?.name || "New User", user_id: Math.floor(Math.random() * 1000) }, { method: "POST", body: JSON.stringify(data) });
  }
  if (url.includes("/api/assign"))             return apiFetch(url, { task_id: Math.floor(Math.random() * 1000), chat_room: `task_${Math.floor(Math.random() * 1000)}`, status: "assigned" },  { method: "POST", body: JSON.stringify(data) });
  if (url.includes("/api/volunteers/accept"))  return apiFetch(url, { status: "in_progress" }, { method: "POST", body: JSON.stringify(data) });
  if (url.includes("/api/volunteers/decline")) return apiFetch(url, { status: "declined" },    { method: "POST", body: JSON.stringify(data) });
  if (url.includes("/api/volunteers/complete"))return apiFetch(url, { status: "completed" },   { method: "POST", body: JSON.stringify(data) });
  if (url.includes("/api/volunteers/location"))return apiFetch(url, { status: "ok" },          { method: "POST", body: JSON.stringify(data) });
  if (url.includes("/api/feedback/"))          return apiFetch(url, { status: "recorded" },    { method: "POST", body: JSON.stringify(data) });
  if (url.includes("/api/upload"))             return apiFetch(url, { source_id: "src_" + Math.random().toString(36).slice(2, 12), file_url: "/uploads/mock_file.csv", status: "processing" }, { method: "POST", body: JSON.stringify(data) });
  return apiFetch(url, { status: "ok" }, { method: "POST", body: JSON.stringify(data) });
}


// ─── FILE UPLOAD (multipart/form-data — never JSON-stringifies) ───────────────

export async function apiUpload(url: string, formData: FormData): Promise<any> {
  try {
    const res = await fetch(url, {
      method: "POST",
      // Do NOT set Content-Type — browser must set it with the boundary
      headers: { Authorization: `Bearer ${SRA.token || ""}` },
      body: formData,
    });
    if (res.status === 401) { logout(); return null; }
    const json = await res.json();
    if (!res.ok) {
      console.warn(`API ${url} returned ${res.status}:`, json);
      return null;
    }
    return json;
  } catch (err) {
    console.warn(`apiUpload ${url} failed:`, err);
    return null;
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function apiPatch(url: string, data?: any): Promise<any> {
  return apiFetch(url, { status: "updated" }, { method: "PATCH", body: JSON.stringify(data) });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " at " +
         d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export function getUrgencyClass(score: number): string {
  return score > 0.70 ? "danger" : score > 0.40 ? "warning" : "success";
}

export function getUrgencyLabel(score: number): string {
  return score > 0.70 ? "High" : score > 0.40 ? "Medium" : "Low";
}

export function getUrgencyColor(score: number): string {
  return score > 0.70 ? "#EF4444" : score > 0.40 ? "#F59E0B" : "#10B981";
}

export function truncate(str: string, maxLen = 80): string {
  return str.length > maxLen ? str.substring(0, maxLen) + "…" : str;
}

export function getCategoryColor(cat: string): string {
  const c: Record<string, string> = { Medical: "#EF4444", Food: "#F59E0B", Shelter: "#2563EB", Education: "#8B5CF6", "Mental Health": "#EC4899", Construction: "#F97316", Other: "#6366F1" };
  return c[cat] || "#6366F1";
}

export function logout() {
  ["sra_token", "sra_role", "sra_name", "sra_user_id"].forEach(k => localStorage.removeItem(k));
  window.location.href = "/login";
}

export function checkAuth(): boolean {
  const token = localStorage.getItem("sra_token");
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) { logout(); return false; }
    }
    return true; // mock tokens pass through
  } catch { return true; }
}

export function getGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const SKILLS_LIST = [
  "Medical & First Aid", "Teaching & Education", "Food Distribution",
  "Construction & Shelter", "Counseling & Mental Health", "Logistics & Transport",
  "Data Collection & Reporting", "Community Outreach",
];

export const CATEGORY_LIST = ["Medical", "Food", "Shelter", "Education", "Mental Health", "Construction", "Other"];
