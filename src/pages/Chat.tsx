import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet, SRA, formatDate } from "../utils/api";

interface Message {
  id: number; sender_id: number; sender_name: string;
  content: string; created_at: string; is_read: boolean; role?: string;
}

export default function Chat() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = SRA.userId;
  const userName = SRA.name || "User";

  useEffect(() => {
    loadHistory();
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadHistory = async () => {
    const data = await apiGet(`/api/chat/${roomId}/history`);
    if (data?.messages) setMessages(data.messages);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setShowScrollFab(scrollHeight - scrollTop - clientHeight > 50);
  };

  const sendMessage = () => {
    const content = newMessage.trim();
    if (!content) return;

    const msg: Message = {
      id: Date.now(),
      sender_id: userId || 0,
      sender_name: userName,
      content,
      created_at: new Date().toISOString(),
      is_read: false,
      role: SRA.role || "user",
    };

    setMessages(prev => [...prev, msg]);
    setNewMessage("");

    // Reset textarea height
    const textarea = document.getElementById("message-input") as HTMLTextAreaElement;
    if (textarea) textarea.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleInputChange = (val: string) => {
    setNewMessage(val);
    // Simulate typing indicator briefly
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1500);
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0" style={{ background: "var(--sra-bg-card-solid)", borderColor: "var(--sra-border)" }}>
        <button onClick={() => navigate(-1)} className="btn btn-sm btn-link text-sra-muted p-0" aria-label="Go back">
          <i className="bi bi-arrow-left text-lg"></i>
        </button>
        <div className="flex-1">
          <div className="font-semibold text-sra-dark text-sm">
            {roomId?.startsWith("task_") ? `Task Chat — ${roomId}` : `Chat — ${roomId}`}
          </div>
          <div className="flex items-center gap-1 text-xs text-sra-muted">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Online
          </div>
        </div>
        <button onClick={() => setShowInfo(!showInfo)} className="btn btn-sm btn-link text-sra-muted" aria-label="Info">
          <i className="bi bi-info-circle text-lg"></i>
        </button>
      </div>

      {/* Messages */}
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4" style={{ background: "var(--sra-bg)" }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-sra-muted">
            <i className="bi bi-chat-dots text-5xl opacity-30 mb-3"></i>
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-1">
            {messages.map(msg => {
              const isOwn = msg.sender_id === userId;
              return (
                <div key={msg.id} className={`flex mb-2 ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[72%]">
                    <div className={`text-xs font-medium mb-0.5 ${isOwn ? "text-right text-sra-muted" : "text-sra-muted"}`}>{msg.sender_name}</div>
                    <div className={isOwn ? "bubble-own" : "bubble-other"}>
                      {msg.content}
                    </div>
                    <div className={`text-[10px] text-sra-muted mt-0.5 ${isOwn ? "text-right" : ""}`}>
                      {formatDate(msg.created_at)}
                      {isOwn && <i className="bi bi-check2-all ms-1 text-sra-primary"></i>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll FAB */}
        {showScrollFab && (
          <button onClick={scrollToBottom} className="fixed bottom-24 right-6 w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-sra-primary z-10" id="scroll-fab" aria-label="Scroll to bottom" style={{ background: "var(--sra-bg-card-solid)", border: "1px solid var(--sra-border)" }}>
            <i className="bi bi-chevron-double-down"></i>
          </button>
        )}
      </div>

      {/* Typing Indicator */}
      {isTyping && (
        <div className="px-4 py-1 text-xs text-sra-muted italic" style={{ background: "var(--sra-bg)" }}>
          Someone is typing...
        </div>
      )}

      {/* Input Bar */}
      <div className="px-4 py-3 border-t flex-shrink-0" style={{ background: "var(--sra-bg-card-solid)", borderColor: "var(--sra-border)" }}>
        <div className="max-w-2xl mx-auto flex items-end gap-2.5">
          <div className="flex-1 relative">
            <textarea
              id="message-input"
              className="sra-chat-input"
              placeholder="Type a message..."
              rows={1}
              maxLength={1000}
              value={newMessage}
              onChange={e => { setNewMessage(e.target.value); autoResize(e.target); handleInputChange(e.target.value); }}
              onKeyDown={handleKeyDown}
              style={{ maxHeight: "120px" }}
            />
            {newMessage.length > 200 && (
              <div className="text-right text-[10px] mt-1" style={{ color: "var(--sra-text-muted)" }}>{newMessage.length}/1000</div>
            )}
          </div>
          <button onClick={sendMessage} disabled={!newMessage.trim()}
            className="btn rounded-full w-11 h-11 flex items-center justify-center flex-shrink-0 border-0 text-white shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #2563EB, #6366F1)" }}
            aria-label="Send message">
            <i className="bi bi-send-fill"></i>
          </button>
        </div>
      </div>

      {/* Info Offcanvas */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex justify-end" onClick={() => setShowInfo(false)}>
          <div className="w-80 h-full shadow-2xl p-5 overflow-y-auto fade-in-up border-l" style={{ background: "var(--sra-bg-card-solid)", borderColor: "var(--sra-border)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sra-dark">Room Info</h3>
              <button onClick={() => setShowInfo(false)} className="btn-close"></button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-sra-muted uppercase tracking-wider mb-1">Room ID</div>
                <div className="text-sm text-sra-dark font-mono">{roomId}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-sra-muted uppercase tracking-wider mb-1">Your Role</div>
                <div className="text-sm text-sra-dark capitalize">{SRA.role}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-sra-muted uppercase tracking-wider mb-1">Messages</div>
                <div className="text-sm text-sra-dark">{messages.length}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
