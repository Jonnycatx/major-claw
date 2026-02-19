import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentProfile } from "@majorclaw/shared-types";
import type { SwarmChatMessage, SwarmSummary } from "../tauriGateway.js";
import { chatMessages, chatQuickAction, chatSend, chatSummary, chatThreads, gatewaySessionToken } from "../tauriGateway.js";
import { emitAppError } from "../utils/errorBus.js";
import { normalizeError } from "../utils/errorMapper.js";

type ChatCommandPanelProps = {
  agents: AgentProfile[];
  onJumpToAgent: (agentId: string) => void;
  onInstallSuggestedSkill: (slug: string, targetAgentId: string) => Promise<void>;
  onOpenMarketplaceForSkill: (slug: string) => void;
};

function messageAccent(type: SwarmChatMessage["type"]): string {
  if (type === "cso" || type === "delegation") {
    return "border-l-lobster";
  }
  if (type === "agent_update") {
    return "border-l-cyan";
  }
  if (type === "skill_suggestion") {
    return "border-l-amber-300";
  }
  return "border-l-white/20";
}

function mergeMessages(previous: SwarmChatMessage[], incoming: SwarmChatMessage[]): SwarmChatMessage[] {
  const map = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) {
    map.set(message.id, message);
  }
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function statusChipClass(status: AgentProfile["status"] | undefined): string {
  if (status === "online") {
    return "border-emerald-300/40 bg-emerald-400/20 text-emerald-100";
  }
  if (status === "busy") {
    return "border-amber-300/40 bg-amber-300/20 text-amber-100";
  }
  if (status === "error" || status === "offline") {
    return "border-rose-300/40 bg-rose-400/20 text-rose-100";
  }
  return "border-white/20 bg-white/10 text-text-secondary";
}

function messageContentWithRecallToggle(content: string, showRecallContext: boolean): string {
  if (showRecallContext) {
    return content;
  }
  if (!content.startsWith("### Vault Recall")) {
    return content;
  }
  const splitAt = content.indexOf("\n\n");
  if (splitAt === -1) {
    return content;
  }
  return content.slice(splitAt + 2).trimStart();
}

export function ChatCommandPanel({
  agents,
  onJumpToAgent,
  onInstallSuggestedSkill,
  onOpenMarketplaceForSkill
}: ChatCommandPanelProps) {
  const [threadId, setThreadId] = useState("thread_cso_default");
  const [messages, setMessages] = useState<SwarmChatMessage[]>([]);
  const [summary, setSummary] = useState<SwarmSummary | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "cso" | "agent" | "skills">("all");
  const [showRecallContext, setShowRecallContext] = useState(true);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastStreamErrorAtRef = useRef(0);

  useEffect(() => {
    const boot = async () => {
      const token = await gatewaySessionToken();
      setSessionToken(token);
      const threads = await chatThreads();
      const selected = threads[0]?.id ?? "thread_cso_default";
      setThreadId(selected);
      const [loadedMessages, loadedSummary] = await Promise.all([chatMessages(selected), chatSummary()]);
      setMessages(loadedMessages);
      setSummary(loadedSummary);
    };
    void boot();
  }, []);

  useEffect(() => {
    const tokenQuery = sessionToken ? `&token=${encodeURIComponent(sessionToken)}` : "";
    const stream = new EventSource(`http://127.0.0.1:4455/chat/stream?threadId=${encodeURIComponent(threadId)}${tokenQuery}`);
    stream.addEventListener("messages", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as SwarmChatMessage[];
      setMessages((current) => mergeMessages(current, payload));
    });
    stream.addEventListener("summary", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as SwarmSummary;
      setSummary(payload);
    });
    stream.onerror = () => {
      const now = Date.now();
      if (now - lastStreamErrorAtRef.current > 15000) {
        lastStreamErrorAtRef.current = now;
        emitAppError({
          context: "Chat stream",
          error: normalizeError(new Error("chat stream disconnected"), "Chat stream")
        });
      }
      void (async () => {
        const [loadedMessages, loadedSummary] = await Promise.all([chatMessages(threadId), chatSummary()]);
        setMessages(loadedMessages);
        setSummary(loadedSummary);
      })();
    };
    return () => {
      stream.close();
    };
  }, [threadId, sessionToken]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const filteredMessages = useMemo(() => {
    if (filter === "all") {
      return messages;
    }
    if (filter === "cso") {
      return messages.filter((message) => message.type === "cso" || message.type === "delegation");
    }
    if (filter === "agent") {
      return messages.filter((message) => message.type === "agent_update");
    }
    return messages.filter((message) => message.type === "skill_suggestion");
  }, [messages, filter]);

  const statusByAgentId = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.status])), [agents]);

  const threaded = useMemo(() => {
    const visible = new Map(filteredMessages.map((message) => [message.id, message]));
    const children = new Map<string, SwarmChatMessage[]>();
    const roots: SwarmChatMessage[] = [];
    for (const message of filteredMessages) {
      if (message.parentMessageId && visible.has(message.parentMessageId)) {
        const entry = children.get(message.parentMessageId) ?? [];
        entry.push(message);
        children.set(message.parentMessageId, entry);
      } else {
        roots.push(message);
      }
    }
    roots.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const [key, value] of children.entries()) {
      children.set(
        key,
        [...value].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      );
    }
    return { roots, children };
  }, [filteredMessages]);

  const send = async () => {
    if (!draft.trim()) {
      return;
    }
    setBusy(true);
    const emitted = await chatSend(threadId, draft.trim(), "user");
    setMessages((current) => mergeMessages(current, emitted));
    setDraft("");
    setBusy(false);
  };

  const quick = async (action: "morning_briefing" | "status_report" | "suggest_skills" | "delegate_task") => {
    setBusy(true);
    const emitted = await chatQuickAction(threadId, action);
    setMessages((current) => mergeMessages(current, emitted));
    setBusy(false);
  };

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-lobster/20 bg-panel/70">
      <header className="flex items-center justify-between border-b border-lobster/20 px-4 py-3">
        <div>
          <h3 className="text-lg font-semibold text-lobster">CSO Command Chat</h3>
          <p className="text-xs text-text-secondary">Direct orchestration channel for your swarm.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span>{summary?.onlineAgents ?? 0} agents online</span>
          <span className="text-cyan">${(summary?.spendTodayUsd ?? 0).toFixed(2)} today</span>
          <span>{summary?.activeTasks ?? 0} active tasks</span>
        </div>
      </header>

      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs">
        <button type="button" className={`rounded-full px-2 py-1 ${filter === "all" ? "bg-lobster/20 text-lobster" : "text-text-secondary"}`} onClick={() => setFilter("all")}>
          All
        </button>
        <button type="button" className={`rounded-full px-2 py-1 ${filter === "cso" ? "bg-lobster/20 text-lobster" : "text-text-secondary"}`} onClick={() => setFilter("cso")}>
          CSO only
        </button>
        <button type="button" className={`rounded-full px-2 py-1 ${filter === "agent" ? "bg-cyan/20 text-cyan" : "text-text-secondary"}`} onClick={() => setFilter("agent")}>
          Agent updates
        </button>
        <button type="button" className={`rounded-full px-2 py-1 ${filter === "skills" ? "bg-amber-300/20 text-amber-200" : "text-text-secondary"}`} onClick={() => setFilter("skills")}>
          Skill suggestions
        </button>
        <button
          type="button"
          className={`ml-auto rounded-full border px-2.5 py-1 ${
            showRecallContext ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-white/20 bg-black/30 text-text-secondary"
          }`}
          onClick={() => setShowRecallContext((value) => !value)}
        >
          {showRecallContext ? "Vault Recall: On" : "Vault Recall: Off"}
        </button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {threaded.roots.map((message) => {
          const replies = threaded.children.get(message.id) ?? [];
          const showReplies = !collapsedParents[message.id];
          const isAgent = message.author.startsWith("@");
          const agentId = isAgent ? message.author.slice(1) : "";
          const status = isAgent ? statusByAgentId.get(agentId) : undefined;
          return (
            <div key={message.id} className={`rounded-xl border border-white/10 bg-black/30 p-3 text-sm animate-fadeIn border-l-2 ${messageAccent(message.type)}`}>
            <div className="mb-1 flex items-center justify-between text-[11px] text-text-secondary">
              <div className="flex items-center gap-2">
                <span>{message.author}</span>
                {isAgent ? (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusChipClass(status)}`}>
                    {status ?? "unknown"}
                  </span>
                ) : null}
              </div>
              <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
            </div>
            <p className="whitespace-pre-wrap text-text-primary">{messageContentWithRecallToggle(message.content, showRecallContext)}</p>

            {message.type === "delegation" && Array.isArray(message.metadata?.steps) ? (
              <details className="mt-2 rounded-lg border border-lobster/25 bg-black/20 p-2 text-xs">
                <summary className="cursor-pointer text-lobster">Delegation Plan</summary>
                <div className="mt-2 space-y-1">
                  {(message.metadata.steps as Array<{ id: string; task: string; agentId: string; status: string }>).map((step) => (
                    <div key={step.id} className="rounded-md border border-white/10 bg-black/20 px-2 py-1">
                      <button type="button" className="text-cyan underline-offset-2 hover:underline" onClick={() => onJumpToAgent(step.agentId)}>
                        @{step.agentId}
                      </button>{" "}
                      <span className="mr-1">{step.task}</span>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${statusChipClass(statusByAgentId.get(step.agentId))}`}>
                        {statusByAgentId.get(step.agentId) ?? "unknown"}
                      </span>
                      <span className="ml-1 text-text-secondary">({step.status})</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            {message.type === "skill_suggestion" && message.metadata ? (
              <div className="mt-2 rounded-lg border border-amber-300/30 bg-amber-300/10 p-2">
                <p className="text-xs text-amber-100">Suggestion: {String((message.metadata as Record<string, unknown>).name ?? "Skill")}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="lobster-button-filled"
                    onClick={() =>
                      void onInstallSuggestedSkill(
                        String((message.metadata as Record<string, unknown>).slug ?? ""),
                        String((message.metadata as Record<string, unknown>).targetAgentId ?? "agent_cso")
                      )
                    }
                  >
                    Install Now
                  </button>
                  <button
                    type="button"
                    className="lobster-button"
                    onClick={() => onOpenMarketplaceForSkill(String((message.metadata as Record<string, unknown>).slug ?? ""))}
                  >
                    Open Marketplace
                  </button>
                </div>
              </div>
            ) : null}

            {replies.length > 0 ? (
              <div className="mt-2">
                <button
                  type="button"
                  className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-text-secondary hover:border-lobster/40 hover:text-text-primary"
                  onClick={() =>
                    setCollapsedParents((current) => ({
                      ...current,
                      [message.id]: !current[message.id]
                    }))
                  }
                >
                  {showReplies ? "Hide replies" : "Show replies"} ({replies.length})
                </button>
                {showReplies ? (
                  <div className="mt-2 space-y-2 border-l border-white/10 pl-3">
                    {replies.map((reply) => {
                      const replyIsAgent = reply.author.startsWith("@");
                      const replyAgentId = replyIsAgent ? reply.author.slice(1) : "";
                      const replyStatus = replyIsAgent ? statusByAgentId.get(replyAgentId) : undefined;
                      return (
                        <div key={reply.id} className={`rounded-lg border border-white/10 bg-black/25 p-2 text-xs border-l-2 ${messageAccent(reply.type)}`}>
                          <div className="mb-1 flex items-center justify-between text-[10px] text-text-secondary">
                            <div className="flex items-center gap-2">
                              <span>{reply.author}</span>
                              {replyIsAgent ? (
                                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${statusChipClass(replyStatus)}`}>
                                  {replyStatus ?? "unknown"}
                                </span>
                              ) : null}
                            </div>
                            <span>{new Date(reply.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="whitespace-pre-wrap text-text-primary">{messageContentWithRecallToggle(reply.content, showRecallContext)}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          );
        })}
      </div>

      <footer className="border-t border-lobster/20 px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-2">
          <button type="button" className="lobster-button" onClick={() => void quick("morning_briefing")}>
            Morning Briefing
          </button>
          <button type="button" className="lobster-button" onClick={() => void quick("status_report")}>
            Status Report
          </button>
          <button type="button" className="lobster-button" onClick={() => void quick("suggest_skills")}>
            Suggest Skills
          </button>
          <button type="button" className="lobster-button" onClick={() => void quick("delegate_task")}>
            Delegate Task
          </button>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask the CSO anything... (e.g. 'Plan my Q2 marketing campaign')"
            className="min-h-[56px] flex-1 resize-none rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-text-primary outline-none focus:border-lobster/60"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void send();
              }
            }}
          />
          <button type="button" className="lobster-button-filled h-[56px] px-4" disabled={busy} onClick={() => void send()}>
            🦞 Send
          </button>
        </div>
      </footer>
    </section>
  );
}
