import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPatch, formatDate, getCategoryColor } from "../utils/api";

interface User {
  id: number; name: string; email: string; role: string;
  is_active: boolean; created_at: string;
}
interface DeadLetter {
  id: number; source_id: string; reason: string;
  raw_data: any; created_at: string; reviewed: boolean;
}

const PIPELINE_STAGES = ["extracted", "cleaned", "classified", "scored", "matched", "notified"];

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [expandedDL, setExpandedDL] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Category weights (mock)
  const categoryWeights = [
    { category: "Medical", severity: 0.35, frequency: 0.25, gap: 0.40 },
    { category: "Food", severity: 0.30, frequency: 0.35, gap: 0.35 },
    { category: "Shelter", severity: 0.25, frequency: 0.30, gap: 0.45 },
    { category: "Education", severity: 0.20, frequency: 0.25, gap: 0.55 },
    { category: "Mental Health", severity: 0.40, frequency: 0.15, gap: 0.45 },
    { category: "Construction", severity: 0.30, frequency: 0.20, gap: 0.50 },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [usersData, dlData] = await Promise.all([apiGet("/api/admin/users"), apiGet("/api/admin/dead-letters")]);
    if (usersData?.users) setUsers(usersData.users);
    if (dlData?.items) setDeadLetters(dlData.items);
  };

  const toggleUserActive = async (userId: number, currentActive: boolean) => {
    await apiPatch(`/api/admin/users/${userId}`, { is_active: !currentActive });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentActive } : u));
  };

  const changeUserRole = async (userId: number, newRole: string) => {
    await apiPatch(`/api/admin/users/${userId}`, { role: newRole });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const markReviewed = async (dlId: number) => {
    await apiPatch(`/api/admin/dead-letters/${dlId}/review`);
    setDeadLetters(prev => prev.map(d => d.id === dlId ? { ...d, reviewed: true } : d));
  };

  const searchPipeline = async () => {
    if (!pipelineSearch.trim()) return;
    const data = await apiGet(`/api/admin/pipeline/${pipelineSearch}`);
    setPipelineResult(data);
  };

  const filteredUsers = users.filter(u => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (searchQuery && !u.name.toLowerCase().includes(searchQuery.toLowerCase()) && !u.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const unreviewedCount = deadLetters.filter(d => !d.reviewed).length;

  return (
    <div className="flex min-h-screen bg-sra-light">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-0 overflow-hidden"} lg:w-56 sra-sidebar flex-shrink-0 transition-all duration-300`}>
        <div className="px-4 py-3 border-b border-white/10">
          <span className="text-white font-bold text-sm">Smart Resource Allocation</span>
        </div>
        <nav className="mt-2">
          {[
            { to: "/dashboard", icon: "bi-speedometer2", label: "Dashboard" },
            { to: "/map", icon: "bi-map", label: "Live Map" },
            { to: "/dashboard", icon: "bi-upload", label: "Upload Data" },
            { to: "/dashboard", icon: "bi-list-check", label: "Needs Queue" },
            { to: "/admin", icon: "bi-people", label: "Volunteers" },
            { to: "/admin", icon: "bi-gear", label: "Admin Panel", active: true },
          ].map((link, i) => (
            <Link key={i} to={link.to} className={`nav-link no-underline ${link.active ? "active" : ""}`}>
              <i className={`bi ${link.icon}`}></i>{link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-4 py-3 border-t border-white/10">
          <div className="text-white text-sm font-medium">{localStorage.getItem("sra_name")}</div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Admin</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden btn btn-sm btn-outline-secondary mb-3">
          <i className="bi bi-list"></i>Menu
        </button>

        {/* Section 1: User Management */}
        <div className="sra-card p-5 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-sra-dark"><i className="bi bi-people me-2"></i>User Management</h2>
            <button className="btn btn-sm btn-outline-primary rounded-xl mt-2 sm:mt-0"><i className="bi bi-person-plus me-1"></i>Invite User</button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <input type="text" className="form-control rounded-xl border-sra-border" placeholder="Search by name or email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select className="form-select rounded-xl border-sra-border w-auto" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="volunteer">Volunteer</option>
              <option value="user">User</option>
            </select>
          </div>

          <div className="table-responsive">
            <table className="table table-hover sra-table mb-0">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td className="fw-medium text-sra-dark text-sm">{user.name}</td>
                    <td className="text-sm text-sra-muted">{user.email}</td>
                    <td>
                      <select className="form-select form-select-sm rounded-lg border-sra-border w-auto" value={user.role} onChange={e => changeUserRole(user.id, e.target.value)} style={{ fontSize: "0.75rem" }}>
                        <option value="admin">Admin</option>
                        <option value="volunteer">Volunteer</option>
                        <option value="user">User</option>
                      </select>
                    </td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-xs text-sra-muted">{formatDate(user.created_at)}</td>
                    <td>
                      <button onClick={() => toggleUserActive(user.id, user.is_active)} className={`btn btn-sm ${user.is_active ? "btn-outline-danger" : "btn-outline-success"} rounded-xl px-2`}>
                        {user.is_active ? <><i className="bi bi-x-circle me-1"></i>Disable</> : <><i className="bi bi-check-circle me-1"></i>Enable</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && <div className="empty-state"><i className="bi bi-people"></i><p className="text-sm">No users found</p></div>}
        </div>

        {/* Section 2: Failed Ingestions */}
        <div className="sra-card p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-sra-dark"><i className="bi bi-exclamation-triangle me-2"></i>Failed Ingestions</h2>
            {unreviewedCount > 0 && <span className="bg-sra-danger text-white text-xs px-2 py-0.5 rounded-full">{unreviewedCount}</span>}
          </div>

          {unreviewedCount > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4 flex items-center gap-2">
              <i className="bi bi-exclamation-triangle"></i>⚠ {unreviewedCount} failed ingestion{unreviewedCount > 1 ? "s need" : " needs"} review
            </div>
          )}

          <div className="table-responsive">
            <table className="table table-hover sra-table mb-0">
              <thead>
                <tr><th>Source ID</th><th>Failure Reason</th><th>Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {deadLetters.map(dl => (
                  <>
                    <tr key={dl.id}>
                      <td className="text-sm font-mono text-sra-muted">{dl.source_id.slice(0, 16)}...</td>
                      <td className="text-sm">{dl.reason}</td>
                      <td className="text-xs text-sra-muted">{formatDate(dl.created_at)}</td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${dl.reviewed ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {dl.reviewed ? "Reviewed" : "Pending"}
                        </span>
                      </td>
                      <td className="flex gap-1">
                        <button onClick={() => setExpandedDL(expandedDL === dl.id ? null : dl.id)} className="btn btn-sm btn-outline-secondary rounded-xl px-2"><i className="bi bi-eye"></i>Raw</button>
                        {!dl.reviewed && (
                          <button onClick={() => markReviewed(dl.id)} className="btn btn-sm btn-outline-success rounded-xl px-2"><i className="bi bi-check2"></i>Reviewed</button>
                        )}
                      </td>
                    </tr>
                    {expandedDL === dl.id && (
                      <tr key={`${dl.id}-raw`}>
                        <td colSpan={5} className="bg-slate-50 p-4">
                          <pre className="text-xs text-sra-dark mb-0 overflow-auto" style={{ maxHeight: "200px" }}>{JSON.stringify(dl.raw_data, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          {deadLetters.length === 0 && <div className="empty-state"><i className="bi bi-check-circle"></i><p className="text-sm">No failed ingestions</p></div>}
        </div>

        {/* Section 3: Pipeline Tracker */}
        <div className="sra-card p-5 mb-6">
          <h2 className="text-lg font-bold text-sra-dark mb-4"><i className="bi bi-gear-wide-connected me-2"></i>Active Pipeline Jobs</h2>
          <div className="flex gap-2 mb-4">
            <input type="text" className="form-control rounded-xl border-sra-border" placeholder="Enter Source ID..." value={pipelineSearch} onChange={e => setPipelineSearch(e.target.value)} />
            <button onClick={searchPipeline} className="btn bg-sra-primary text-white rounded-xl border-0 px-4"><i className="bi bi-search me-1"></i>Search</button>
          </div>
          {pipelineResult && (
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs text-sra-muted mb-2">Stage: <strong className="text-sra-dark">{pipelineResult.stage}</strong></div>
              <div className="pipeline-steps">
                {PIPELINE_STAGES.map((stage, i) => {
                  const currentIdx = PIPELINE_STAGES.indexOf(pipelineResult.stage);
                  const isDone = i < currentIdx;
                  const isActive = i === currentIdx;
                  return (
                    <div key={stage} className={`pipeline-step ${isDone ? "done" : ""}`}>
                      <div className={`step-icon ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}>
                        {isDone ? <i className="bi bi-check"></i> : isActive ? <i className="bi bi-arrow-repeat"></i> : <span className="text-xs">{i + 1}</span>}
                      </div>
                      <span className="step-label">{stage.charAt(0).toUpperCase() + stage.slice(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Category Weights */}
        <div className="sra-card p-5">
          <h2 className="text-lg font-bold text-sra-dark mb-2"><i className="bi bi-sliders me-2"></i>AI Priority Weights (Learned)</h2>
          <p className="text-sm text-sra-muted mb-4">These weights self-calibrate based on task outcomes</p>
          <div className="space-y-3">
            {categoryWeights.map(cw => (
              <div key={cw.category} className="flex items-center gap-4">
                <div className="w-28 text-sm font-medium text-sra-dark flex-shrink-0">
                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: getCategoryColor(cw.category) }}></span>
                  {cw.category}
                </div>
                <div className="flex-1 flex gap-1 items-center">
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden flex">
                    <div className="bg-sra-danger h-full rounded-l-full" style={{ width: `${cw.severity * 100}%` }}></div>
                    <div className="bg-sra-warning h-full" style={{ width: `${cw.frequency * 100}%` }}></div>
                    <div className="bg-sra-primary h-full rounded-r-full" style={{ width: `${cw.gap * 100}%` }}></div>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px] text-sra-muted w-36 flex-shrink-0">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sra-danger inline-block"></span>S:{(cw.severity * 100).toFixed(0)}%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sra-warning inline-block"></span>F:{(cw.frequency * 100).toFixed(0)}%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sra-primary inline-block"></span>G:{(cw.gap * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
