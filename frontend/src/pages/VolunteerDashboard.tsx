import { useState, useEffect, useRef } from "react";
import { apiGet, apiPost, apiUpload, apiPatch, getUrgencyClass, getUrgencyLabel, getGreeting, SRA, formatDate } from "../utils/api";

interface Task {
  id: number;
  need: { category: string; description: string; urgency_score: number; location: string; zone: string };
  status: string; assigned_at: string; completed_at?: string; chat_room: string; rating?: number;
}

export default function VolunteerDashboard() {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [history, setHistory] = useState<Task[]>([]);
  const [available, setAvailable] = useState(true);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingTaskId, setRatingTaskId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const gpsWatchRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const volName = SRA.name || "Volunteer";

  useEffect(() => {
    loadDashboard();
    return () => { if (gpsWatchRef.current !== null) navigator.geolocation.clearWatch(gpsWatchRef.current); };
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    const data = await apiGet("/api/volunteers/tasks");
    if (data) {
      setActiveTask(data.active?.[0] || null);
      setHistory(data.history || []);
    }
    setLoading(false);
  };

  const toggleAvailability = async (val: boolean) => {
    setAvailable(val);
    await apiPatch("/api/volunteers/profile", { is_available: val });
  };

  const acceptTask = async (taskId: number) => {
    await apiPost("/api/volunteers/accept", { task_id: taskId });
    loadDashboard();
  };

  const declineTask = async (taskId: number) => {
    if (!window.confirm("Decline this task? It will be re-assigned.")) return;
    await apiPost("/api/volunteers/decline", { task_id: taskId });
    loadDashboard();
  };

  const completeTask = async (taskId: number) => {
    await apiPost("/api/volunteers/complete", { task_id: taskId });
    stopGPS();
    setRatingTaskId(taskId);
    setShowRating(true);
    loadDashboard();
  };

  const submitRating = async () => {
    if (ratingTaskId && ratingValue > 0) {
      await apiPost(`/api/feedback/${ratingTaskId}`, { rating: ratingValue, comment: ratingComment });
      setShowRating(false);
      setRatingValue(0);
      setRatingComment("");
      loadDashboard();
    }
  };

  const toggleGPS = (enable: boolean) => {
    if (enable) {
      if (!navigator.geolocation) return;
      gpsWatchRef.current = navigator.geolocation.watchPosition(
        pos => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000 },
      );
      setGpsActive(true);
    } else {
      stopGPS();
    }
  };

  const stopGPS = () => {
    if (gpsWatchRef.current !== null) navigator.geolocation.clearWatch(gpsWatchRef.current);
    gpsWatchRef.current = null;
    setGpsActive(false);
    setGpsCoords(null);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);
    await apiUpload("/api/upload", formData);
    setUploading(false);
    setUploadFile(null);
  };

  const completedCount = history.length;
  const activeCount = activeTask ? 1 : 0;
  const avgRating = history.filter(h => h.rating).length > 0 ? (history.reduce((a, h) => a + (h.rating || 0), 0) / history.filter(h => h.rating).length).toFixed(1) : "—";

  if (loading) return (
    <div className="min-h-screen bg-sra-light flex items-center justify-center">
      <div className="spinner-border text-sra-primary" role="status"><span className="visually-hidden">Loading...</span></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-sra-light py-4 px-4 md:px-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sra-dark">{getGreeting()}, {volName} 👋</h1>
          <p className="text-sra-muted text-sm">Here's your task overview</p>
        </div>
        <div className="flex items-center gap-3 mt-3 sm:mt-0">
          <span className={`text-sm px-3 py-1 rounded-full ${available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`} id="availability-badge">
            {available ? "Available" : "Not Available"}
          </span>
          <div className={`toggle-switch ${available ? "active" : ""}`} onClick={() => toggleAvailability(!available)} role="switch" aria-label="Toggle availability" aria-checked={available}></div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Tasks Completed", value: completedCount, icon: "bi-check-circle text-sra-secondary" },
          { label: "Active Tasks", value: activeCount, icon: "bi-lightning text-sra-warning" },
          { label: "Rating", value: avgRating, icon: "bi-star text-yellow-500" },
        ].map((s, i) => (
          <div key={i} className="sra-card p-4 text-center">
            <i className={`bi ${s.icon} text-xl`}></i>
            <div className="text-2xl font-bold text-sra-dark mt-1">{s.value}</div>
            <div className="text-xs text-sra-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Active Task + Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Active Task */}
        <div className="lg:col-span-3">
          {activeTask ? (
            <div className={`sra-card p-5 task-card urgency-${getUrgencyClass(activeTask.need.urgency_score)}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">{activeTask.need.category}</span>
                <span className={`text-xs px-2 py-1 rounded-full badge-${getUrgencyClass(activeTask.need.urgency_score) === "danger" ? "open" : getUrgencyClass(activeTask.need.urgency_score) === "warning" ? "assigned" : "completed"}`}>
                  {getUrgencyLabel(activeTask.need.urgency_score)} Priority
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${activeTask.status === "assigned" ? "badge-assigned" : activeTask.status === "in_progress" ? "badge-in-progress" : "badge-completed"}`}>{activeTask.status.replace("_", " ")}</span>
              </div>
              <p className="text-sm text-sra-dark mb-3">{activeTask.need.description}</p>
              <div className="flex items-center gap-4 text-xs text-sra-muted mb-4">
                <span><i className="bi bi-geo-alt me-1"></i>{activeTask.need.location} • {activeTask.need.zone}</span>
                <span><i className="bi bi-person me-1"></i>Community Member, {activeTask.need.zone}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {activeTask.status === "assigned" && (
                  <>
                    <button onClick={() => acceptTask(activeTask.id)} className="btn btn-sm rounded-xl px-4 border-0 text-white" style={{ background: "#10B981" }}><i className="bi bi-check-circle me-1"></i>Accept Task</button>
                    <button onClick={() => declineTask(activeTask.id)} className="btn btn-sm btn-outline-danger rounded-xl px-4"><i className="bi bi-x-circle me-1"></i>Decline</button>
                  </>
                )}
                {activeTask.status === "in_progress" && (
                  <button onClick={() => completeTask(activeTask.id)} className="btn btn-sm rounded-xl px-4 border-0 text-white" style={{ background: "#10B981" }}><i className="bi bi-check2-all me-1"></i>Mark Complete</button>
                )}
                <a href={`/chat/${activeTask.chat_room}`} className="btn btn-sm btn-outline-primary rounded-xl px-4"><i className="bi bi-chat me-1"></i>Open Chat</a>
              </div>

              {/* GPS Tracking */}
              {activeTask.status === "in_progress" && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-sra-dark"><i className="bi bi-crosshair me-1"></i>Live GPS Tracking</span>
                    <div className="flex items-center gap-2">
                      <span id="gps-indicator" className={`text-xs ${gpsActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"} px-2 py-0.5 rounded-full`}>
                        {gpsActive ? <><span className="gps-pulse inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>Active</> : "Off"}
                      </span>
                      <div className={`toggle-switch ${gpsActive ? "active" : ""}`} onClick={() => toggleGPS(!gpsActive)} style={{ transform: "scale(0.85)" }} role="switch" aria-label="Toggle GPS"></div>
                    </div>
                  </div>
                  {gpsActive && gpsCoords && (
                    <div className="text-xs text-sra-muted font-mono">
                      Lat: {gpsCoords.lat.toFixed(6)} • Lng: {gpsCoords.lng.toFixed(6)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="sra-card empty-state">
              <i className="bi bi-clipboard-check"></i>
              <h3 className="text-lg font-semibold text-sra-dark mb-2">No active task</h3>
              <p className="text-sm">Toggle availability above to receive tasks</p>
            </div>
          )}
        </div>

        {/* Upload Card */}
        <div className="lg:col-span-2 sra-card p-5 upload-compact">
          <h3 className="text-sm font-semibold text-sra-dark mb-3">Upload Field Data</h3>
          <div className="upload-zone py-4" onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" className="d-none" accept=".csv,.png,.jpg,.jpeg" onChange={e => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); }} />
            {uploadFile ? (
              <div className="text-sm">
                <i className="bi bi-file-earmark text-sra-primary text-xl mb-1"></i>
                <div className="font-medium text-sra-dark">{uploadFile.name}</div>
                <button onClick={e => { e.stopPropagation(); setUploadFile(null); }} className="btn btn-sm btn-outline-danger mt-2 rounded-xl"><i className="bi bi-x-lg"></i></button>
              </div>
            ) : (
              <div className="text-sm">
                <i className="bi bi-cloud-upload text-2xl text-sra-muted mb-1"></i>
                <div className="text-sra-muted">Click to upload image or CSV</div>
              </div>
            )}
          </div>
          {uploadFile && (
            <button onClick={handleUpload} disabled={uploading} className="btn btn-sm bg-sra-primary text-white w-full mt-3 rounded-xl border-0">
              {uploading ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-upload me-1"></i>Submit</>}
            </button>
          )}
        </div>
      </div>

      {/* Task History */}
      <div className="sra-card p-5">
        <h3 className="text-sm font-semibold text-sra-dark mb-4">Task History</h3>
        {history.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-hover sra-table mb-0">
              <thead>
                <tr><th>Category</th><th>Location</th><th>Completed</th><th>Rating</th><th>Chat</th></tr>
              </thead>
              <tbody>
                {history.map(task => (
                  <tr key={task.id}>
                    <td className="text-sm">{task.need.category}</td>
                    <td className="text-sm text-sra-muted">{task.need.location}</td>
                    <td className="text-sm text-sra-muted">{task.completed_at ? formatDate(task.completed_at) : "—"}</td>
                    <td>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <i key={i} className={`bi ${i < (task.rating || 0) ? "bi-star-fill text-yellow-400" : "bi-star text-gray-300"} text-xs`}></i>
                        ))}
                      </div>
                    </td>
                    <td><a href={`/chat/${task.chat_room}`} className="btn btn-sm btn-outline-secondary rounded-lg px-2"><i className="bi bi-chat"></i></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><i className="bi bi-clock-history"></i><p className="text-sm">No history yet</p></div>
        )}
      </div>

      {/* Rating Modal */}
      {showRating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl shadow-2xl w-full max-w-md p-6 fade-in-up" style={{ background: "var(--sra-bg-card-solid)" }}>
            <h3 className="text-lg font-bold text-sra-dark mb-4 text-center">How did this task go?</h3>
            <div className="star-rating flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(star => (
                <i key={star} className={`bi ${star <= ratingValue ? "bi-star-fill" : "bi-star"} cursor-pointer`}
                  onClick={() => setRatingValue(star)} onMouseEnter={e => (e.currentTarget.className = "bi bi-star-fill cursor-pointer")} onMouseLeave={e => (e.currentTarget.className = `bi ${star <= ratingValue ? "bi-star-fill" : "bi-star"} cursor-pointer`)}></i>
              ))}
            </div>
            <textarea className="form-control mb-4" rows={3} placeholder="Share your experience (optional)..." value={ratingComment} onChange={e => setRatingComment(e.target.value)}></textarea>
            <button onClick={submitRating} disabled={ratingValue === 0} className="btn bg-sra-primary text-white w-full py-2.5 rounded-xl font-semibold border-0">Submit Rating</button>
          </div>
        </div>
      )}
    </div>
  );
}
