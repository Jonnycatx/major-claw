import { randomUUID } from "node:crypto";
import type { ChatMessage } from "@majorclaw/shared-types";
import { ChatLogService, type LogEvent } from "./chatLogs.js";

export class UnifiedChatApi {
  constructor(private readonly chatLogs: ChatLogService) {}

  sendToCso(threadId: string, body: string): ChatMessage {
    const message: ChatMessage = {
      id: randomUUID(),
      threadId,
      sender: "user",
      body,
      createdAt: new Date().toISOString()
    };
    this.chatLogs.sendMessage(message);
    this.chatLogs.appendLog({
      id: randomUUID(),
      level: "info",
      category: "chat",
      message: `message.sent thread=${threadId} route=cso`,
      createdAt: new Date().toISOString()
    });
    return message;
  }

  sendDirect(agentId: string, threadId: string, body: string): ChatMessage {
    const message: ChatMessage = {
      id: randomUUID(),
      threadId,
      sender: `@${agentId}`,
      body,
      createdAt: new Date().toISOString()
    };
    this.chatLogs.sendMessage(message);
    this.chatLogs.appendLog({
      id: randomUUID(),
      level: "info",
      category: "chat",
      message: `message.sent thread=${threadId} route=${agentId}`,
      createdAt: new Date().toISOString()
    });
    return message;
  }

  streamThread(threadId: string): ChatMessage[] {
    return this.chatLogs.listMessages(threadId);
  }

  filterLogs(query: { level?: LogEvent["level"]; category?: string; text?: string }): LogEvent[] {
    return this.chatLogs.filterLogs(query);
  }

  exportLogs(): string {
    return this.chatLogs.exportLogs();
  }
}
