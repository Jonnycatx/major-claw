import type { ChatMessage } from "@majorclaw/shared-types";

export interface LogEvent {
  id: string;
  level: "info" | "warn" | "error";
  category: string;
  message: string;
  createdAt: string;
}

export class ChatLogService {
  private readonly messages: ChatMessage[] = [];
  private readonly logs: LogEvent[] = [];

  sendMessage(message: ChatMessage): void {
    this.messages.push(message);
  }

  listMessages(threadId: string): ChatMessage[] {
    return this.messages.filter((msg) => msg.threadId === threadId);
  }

  appendLog(log: LogEvent): void {
    this.logs.push(log);
  }

  filterLogs(input: { level?: LogEvent["level"]; category?: string; text?: string }): LogEvent[] {
    return this.logs.filter((entry) => {
      if (input.level && entry.level !== input.level) {
        return false;
      }
      if (input.category && entry.category !== input.category) {
        return false;
      }
      if (input.text && !entry.message.toLowerCase().includes(input.text.toLowerCase())) {
        return false;
      }
      return true;
    });
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}
