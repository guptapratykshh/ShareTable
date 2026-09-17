import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "../services/api";
import { Button, inputClass } from "./Form";

type ChatRole = "user" | "assistant";

type ChatLine = {
  role: ChatRole;
  content: string;
  pendingActionId?: string;
};

type AssistantResponse = {
  reply: string;
  pendingActionId?: string;
};

export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatLine[]>([
    {
      role: "assistant",
      content: "I can explain pickup rules, check your open pickup, or send a late / instructions / arrived update after you confirm it.",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  const pendingActionId = [...messages].reverse().find((m) => m.pendingActionId)?.pendingActionId;

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setError("");
    setBusy(true);
    const history = messages
      .filter((m) => m.content)
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      const data = await api<AssistantResponse>("/api/assistant", {
        method: "POST",
        body: JSON.stringify({ message: text, history }),
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, pendingActionId: data.pendingActionId },
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the assistant.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!pendingActionId || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<AssistantResponse>("/api/assistant/confirm", {
        method: "POST",
        body: JSON.stringify({ pendingActionId }),
      });
      setMessages((prev) => [
        ...prev.map((m) => ({ ...m, pendingActionId: undefined })),
        { role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send that update.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!pendingActionId || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<AssistantResponse>("/api/assistant/cancel", {
        method: "POST",
        body: JSON.stringify({ pendingActionId }),
      });
      setMessages((prev) => [
        ...prev.map((m) => ({ ...m, pendingActionId: undefined })),
        { role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-4 z-[2000] sm:right-8">
      {open && (
        <div className="mb-3 flex h-[min(28rem,70vh)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[0_16px_40px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">ShareTable Assistant</p>
              <p className="text-xs text-muted">Confirm before anything is sent</p>
            </div>
            <button type="button" className="rounded-full p-1.5 text-muted hover:bg-secondary" onClick={() => setOpen(false)} aria-label="Close assistant">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {messages.map((line, i) => (
              <div key={`${line.role}-${i}`} className={line.role === "user" ? "ml-8 rounded-2xl bg-primary px-3 py-2 text-primary-foreground" : "mr-6 rounded-2xl bg-secondary px-3 py-2"}>
                {line.content}
              </div>
            ))}
            {pendingActionId && (
              <div className="flex gap-2">
                <Button type="button" onClick={confirm} disabled={busy} className="px-4 py-2">
                  Confirm
                </Button>
                <Button type="button" variant="outline" onClick={cancel} disabled={busy} className="px-4 py-2">
                  Cancel
                </Button>
              </div>
            )}
            {error && <p className="text-sm text-alert">{error}</p>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
            <input
              className={inputClass}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask or send an update…"
              disabled={busy}
            />
            <Button type="submit" disabled={busy || !draft.trim()} className="px-3 py-2" aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_12px_30px_rgba(15,23,42,0.2)]"
      >
        <MessageCircle className="h-4 w-4" />
        Assistant
      </button>
    </div>
  );
}
