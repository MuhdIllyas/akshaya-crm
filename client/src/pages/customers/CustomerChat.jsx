// Customer portal → Messages. Chats with a centre, or with the staff member
// handling one of the customer's applications. Staff answer from Messenger.
//
// Opened with ?centre=<id> or ?booking=<id> it finds or starts that chat.
// New messages are fetched every few seconds while the page is open.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { FiArrowLeft, FiGlobe, FiUser, FiSend, FiMessageSquare, FiPlus } from "react-icons/fi";
import { usePortalCentres, getPreferredCentreId } from "@/tenancy/centres";

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api/customer/chat` });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("customer_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const POLL_MS = 5000;

const titleOf = (c) =>
  c.context_type === "customer_service"
    ? c.staff_name || "Your application"
    : c.centre_name || "Centre";

const subtitleOf = (c) =>
  c.context_type === "customer_service"
    ? `${c.service_name || "Application"}${c.application_number ? ` · ${c.application_number}` : ""}`
    : "Centre team";

const timeOf = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default function CustomerChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { centres } = usePortalCentres();
  const [conversations, setConversations] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);
  const lastIdRef = useRef(0);
  const bottomRef = useRef(null);

  const active = useMemo(() => (conversations || []).find((c) => c.id === activeId) || null, [conversations, activeId]);

  const loadList = () =>
    api
      .get("/conversations")
      .then(({ data }) => {
        setConversations(Array.isArray(data) ? data : []);
        return data;
      })
      .catch((err) => {
        if (err.response?.status === 401) navigate("/login");
        setConversations([]);
        return [];
      });

  const start = async (body) => {
    try {
      const { data } = await api.post("/conversations", body);
      await loadList();
      setActiveId(data.id);
      setPicking(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't start the chat");
    }
  };

  // First load, then open what the link asked for (?centre= / ?booking=).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const booking = Number(params.get("booking"));
    const centre = Number(params.get("centre"));
    loadList().then((list) => {
      if (booking) start({ booking_id: booking });
      else if (centre) start({ centre_id: centre });
      else if (list?.[0]) setActiveId(list[0].id);
      if (booking || centre) navigate(location.pathname, { replace: true });
    });
  }, []);

  // Messages for the open chat, then only the new ones every few seconds.
  useEffect(() => {
    if (!activeId) return undefined;
    let cancelled = false;
    lastIdRef.current = 0;
    setMessages([]);
    let timer;

    const fetchNew = async () => {
      try {
        const { data } = await api.get(`/conversations/${activeId}/messages`, { params: { after: lastIdRef.current } });
        if (cancelled || !data.messages?.length) return;
        lastIdRef.current = data.messages[data.messages.length - 1].id;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...data.messages.filter((m) => !seen.has(m.id))];
        });
      } catch (err) {
        // Signed out (e.g. logged out in another tab): stop polling and go to login.
        if (err.response?.status === 401) {
          cancelled = true;
          clearInterval(timer);
          navigate("/login");
        }
        /* otherwise try again next round */
      }
    };
    fetchNew();
    timer = setInterval(() => {
      if (!document.hidden) fetchNew();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !activeId) return;
    setSending(true);
    try {
      const { data } = await api.post(`/conversations/${activeId}/messages`, { text: body });
      setText("");
      lastIdRef.current = Math.max(lastIdRef.current, data.id);
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      loadList();
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't send your message");
    } finally {
      setSending(false);
    }
  };

  const preferred = getPreferredCentreId();
  const centreChoices = [...centres].sort((a, b) => (String(b.id) === preferred) - (String(a.id) === preferred));

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-5xl min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Chat list */}
      <aside className={`${activeId ? "hidden md:flex" : "flex"} w-full flex-col border-r border-slate-200 md:w-72`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h1 className="font-semibold text-slate-900">Messages</h1>
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-navy-700 hover:bg-slate-50"
          >
            <FiPlus className="h-4 w-4" /> New
          </button>
        </div>

        {picking && (
          <div className="border-b border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">Chat with a centre</p>
            <div className="space-y-1">
              {centreChoices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => start({ centre_id: c.id })}
                  className="block w-full truncate rounded-lg bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  {c.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">To message the staff member handling an application, open it in My Services.</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {conversations === null ? (
            <p className="p-4 text-sm text-slate-500">Loading…</p>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <FiMessageSquare className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-2 text-sm text-slate-600">No messages yet.</p>
              <button type="button" onClick={() => setPicking(true)} className="mt-3 text-sm font-medium text-navy-700 hover:underline">
                Start a chat with a centre
              </button>
            </div>
          ) : (
            conversations.map((c) => {
              const Icon = c.context_type === "customer_service" ? FiUser : FiGlobe;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${c.id === activeId ? "bg-slate-50" : ""}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-500/10 text-navy-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{titleOf(c)}</span>
                    <span className="block truncate text-xs text-slate-500">{c.last_message || subtitleOf(c)}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={`${activeId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {active ? (
          <>
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
              <button type="button" onClick={() => setActiveId(null)} className="md:hidden" aria-label="Back to chats">
                <FiArrowLeft className="h-5 w-5 text-slate-600" />
              </button>
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{titleOf(active)}</p>
                <p className="truncate text-xs text-slate-500">
                  {subtitleOf(active)}
                  {active.centre_name && active.context_type === "customer_service" ? ` · ${active.centre_name}` : ""}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 px-4 py-4">
              {messages.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">
                  Send a message. {active.context_type === "customer_service" ? "They'll" : "The centre will"} reply here.
                </p>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.is_mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      m.is_mine ? "bg-navy-700 text-white" : "border border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    {!m.is_mine && m.sender_name && <p className="mb-0.5 text-xs font-medium text-navy-700">{m.sender_name}</p>}
                    {m.file_url && !m.text ? (
                      <a href={/^https?:/.test(m.file_url) ? m.file_url : `${import.meta.env.VITE_API_URL}${m.file_url}`} target="_blank" rel="noopener noreferrer" className="underline">
                        {m.file_name || "Attachment"}
                      </a>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    )}
                    <p className={`mt-1 text-[11px] ${m.is_mine ? "text-white/70" : "text-slate-400"}`}>{timeOf(m.created_at)}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-200 p-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) send(e);
                }}
                rows={1}
                maxLength={2000}
                placeholder="Type a message"
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-700 text-white hover:bg-navy-800 disabled:opacity-50"
                aria-label="Send message"
              >
                <FiSend className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">Choose a chat, or start a new one.</div>
        )}
      </section>
    </div>
  );
}
