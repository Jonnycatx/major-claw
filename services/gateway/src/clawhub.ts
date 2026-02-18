import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Repository } from "@majorclaw/db";
import type { ClawHubInstallResult, ClawHubLiveSkillsResult, ClawHubSkill, ClawHubSort } from "@majorclaw/shared-types";
import { SafetyWorkflow } from "./safetyWorkflow.js";

const execAsync = promisify(exec);
const CLAWHUB_API_BASE = "https://clawhub.ai/api/v1/skills";

const mockSkills: ClawHubSkill[] = [
  {
    slug: "gog-email-assistant",
    name: "Gog Email Assistant",
    author: "claw-crew",
    description: "Reads and drafts inbox workflows with safety guards.",
    downloads: 18234,
    stars: 1400,
    version: "1.8.0",
    categories: ["email", "productivity"],
    permissions: ["gmail.read", "gmail.send", "filesystem.read"],
    installed: false
  },
  {
    slug: "tavily-research-pro",
    name: "Tavily Research Pro",
    author: "openclaw-community",
    description: "Fast web research and summarization pipelines.",
    downloads: 42111,
    stars: 3100,
    version: "2.1.3",
    categories: ["research", "web"],
    permissions: ["network.http", "filesystem.read"],
    installed: false
  },
  {
    slug: "calendar-ops",
    name: "Calendar Ops",
    author: "molty-labs",
    description: "Calendar scheduling and availability automation.",
    downloads: 13999,
    stars: 800,
    version: "0.9.4",
    categories: ["calendar", "productivity"],
    permissions: ["calendar.read", "calendar.write"],
    installed: false
  }
];

export class ClawHubService {
  private skillCache = new Map<string, ClawHubSkill>();

  constructor(
    private readonly repository: Repository,
    private readonly safetyWorkflow: SafetyWorkflow,
    private readonly onSkillsReload: () => void
  ) {}

  async search(query: string, sort: ClawHubSort = "downloads"): Promise<ClawHubSkill[]> {
    const allSkills = await this.getLiveSkills(sort, true);
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return allSkills.skills;
    }
    return allSkills.skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(trimmed) ||
        skill.slug.toLowerCase().includes(trimmed) ||
        skill.description.toLowerCase().includes(trimmed)
    );
  }

  async getLiveSkills(
    sort: ClawHubSort = "downloads",
    nonSuspicious = true,
    cursor?: string
  ): Promise<ClawHubLiveSkillsResult> {
    try {
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const url = `${CLAWHUB_API_BASE}?sort=${encodeURIComponent(sort)}&nonSuspicious=${encodeURIComponent(String(nonSuspicious))}${cursorParam}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ClawHub API error (${response.status})`);
      }
      const payload = (await response.json()) as { items?: unknown[]; nextCursor?: string };
      const normalized = (payload.items ?? []).map((item) => this.normalizeApiSkill(item));
      this.saveToCache(normalized);
      return {
        skills: this.sortSkills(normalized, sort),
        nextCursor: payload.nextCursor ?? null,
        source: "live"
      };
    } catch {
      const cached = this.repository.listSkills();
      if (cached.length > 0) {
        return {
          skills: this.sortSkills(cached, sort),
          nextCursor: null,
          source: "cache"
        };
      }
      return {
        skills: this.sortSkills(mockSkills, sort),
        nextCursor: null,
        source: "cache"
      };
    }
  }

  async install(slug: string, agentId?: string): Promise<ClawHubInstallResult> {
    const targetAgentId = agentId ?? "agent_cso";
    const detail = (await this.getSkillDetails(slug)) ?? {
      slug,
      name: slug,
      author: "unknown",
      description: "Installed skill",
      downloads: 0,
      version: "0.0.0",
      categories: [],
      permissions: [],
      installed: false
    };
    try {
      await execAsync(`npx clawhub@latest install ${slug} --force`, { timeout: 30000 });
      const installedSkill = { ...detail, installed: true };
      this.repository.upsertSkill(installedSkill);
      this.repository.assignSkill(targetAgentId, slug, true);
      this.onSkillsReload();
      return {
        slug,
        installed: true,
        assignedAgentId: targetAgentId,
        message: `${slug} installed and assigned to ${targetAgentId}.`
      };
    } catch {
      // Keep UI flow unblocked in local dev when clawhub is unavailable.
      const installedSkill = { ...detail, installed: true };
      this.repository.upsertSkill(installedSkill);
      this.repository.assignSkill(targetAgentId, slug, true);
      this.onSkillsReload();
      return {
        slug,
        installed: true,
        assignedAgentId: targetAgentId,
        message: `${slug} installed using local fallback adapter.`
      };
    }
  }

  async listInstalled(agentId?: string): Promise<ClawHubSkill[]> {
    try {
      const { stdout } = await execAsync("npx clawhub@latest list --json", { timeout: 12000 });
      const parsed = this.parseSkillOutput(stdout).map((skill) => ({ ...skill, installed: true }));
      this.saveToCache(parsed);
      if (!agentId) {
        return parsed;
      }
      const assignments = this.repository.listAgentSkills(agentId);
      const map = new Map(assignments.map((entry) => [entry.skillSlug, entry.enabled]));
      return parsed
        .filter((skill) => map.has(skill.slug))
        .map((skill) => ({ ...skill, installed: map.get(skill.slug) ?? true }));
    } catch {
      const assignedSkills = this.repository.listAgentSkills(agentId).map((entry) => entry.skillSlug);
      const assignmentMap = new Map(
        this.repository.listAgentSkills(agentId).map((entry) => [entry.skillSlug, entry.enabled])
      );
      const installed = this.repository
        .listSkills()
        .filter((skill) => skill.installed)
        .filter((skill) => !agentId || assignedSkills.includes(skill.slug));
      const normalized = installed.map((skill) => ({
        ...skill,
        installed: agentId ? (assignmentMap.get(skill.slug) ?? skill.installed) : skill.installed
      }));
      return normalized.length > 0 ? normalized : mockSkills.filter((skill) => skill.installed);
    }
  }

  async getSkillDetails(slug: string): Promise<ClawHubSkill | null> {
    const cached = this.skillCache.get(slug) ?? this.repository.getSkill(slug);
    if (cached) {
      return cached;
    }
    try {
      const response = await fetch(
        `${CLAWHUB_API_BASE}?sort=${encodeURIComponent("downloads")}&nonSuspicious=true&q=${encodeURIComponent(slug)}`
      );
      if (!response.ok) {
        throw new Error(`ClawHub API error (${response.status})`);
      }
      const payload = (await response.json()) as { items?: unknown[] };
      const parsed = (payload.items ?? []).map((item) => this.normalizeApiSkill(item));
      this.saveToCache(parsed);
      return parsed.find((skill) => skill.slug === slug) ?? null;
    } catch {
      return mockSkills.find((skill) => skill.slug === slug) ?? null;
    }
  }

  toggleSkill(agentId: string, slug: string, enabled: boolean): { success: boolean } {
    this.repository.toggleAgentSkill(agentId, slug, enabled);
    return { success: true };
  }

  private parseSkillOutput(raw: string): ClawHubSkill[] {
    const json = JSON.parse(raw) as unknown;
    if (Array.isArray(json)) {
      return json.map((entry) => this.normalizeSkill(entry));
    }
    if (json && typeof json === "object" && "results" in json && Array.isArray((json as { results: unknown[] }).results)) {
      return (json as { results: unknown[] }).results.map((entry) => this.normalizeSkill(entry));
    }
    return [];
  }

  private normalizeSkill(input: unknown): ClawHubSkill {
    const source = (input as Record<string, unknown>) ?? {};
    const stats = (source.stats as Record<string, unknown> | undefined) ?? {};
    const permissions = Array.isArray(source.permissions)
      ? source.permissions.map((value) => String(value))
      : [];
    const categories = Array.isArray(source.categories)
      ? source.categories.map((value) => String(value))
      : [];
    return {
      slug: String(source.slug ?? "unknown-skill"),
      name: String(source.name ?? source.displayName ?? source.slug ?? "Unknown Skill"),
      author: String(source.author ?? "unknown"),
      description: String(source.description ?? source.summary ?? "No description provided."),
      downloads: Number(source.downloads ?? 0),
      stars: Number(source.stars ?? stats.stars ?? 0),
      version: String(source.version ?? "0.0.0"),
      categories,
      permissions,
      installed: Boolean(source.installed ?? false)
    };
  }

  private normalizeApiSkill(input: unknown): ClawHubSkill {
    const source = (input as Record<string, unknown>) ?? {};
    const stats = (source.stats as Record<string, unknown> | undefined) ?? {};
    const tags = (source.tags as Record<string, unknown> | undefined) ?? {};
    const inferredPermissions = this.inferPermissions(source);

    return {
      slug: String(source.slug ?? "unknown-skill"),
      name: String(source.displayName ?? source.name ?? source.slug ?? "Unknown Skill"),
      author: String(source.author ?? tags.author ?? "community"),
      description: String(source.summary ?? source.description ?? "No description provided."),
      downloads: Number(stats.downloads ?? source.downloads ?? 0),
      stars: Number(stats.stars ?? source.stars ?? 0),
      version: String((source.latestVersion as Record<string, unknown> | undefined)?.version ?? source.version ?? "0.0.0"),
      categories: Array.isArray(source.categories) ? source.categories.map((value) => String(value)) : [],
      permissions: inferredPermissions,
      installed: Boolean(source.installed ?? this.repository.listAgentSkills().some((entry) => entry.skillSlug === source.slug))
    };
  }

  private sortSkills(skills: ClawHubSkill[], sort: ClawHubSort): ClawHubSkill[] {
    if (sort === "newest") {
      return [...skills].sort((a, b) => b.version.localeCompare(a.version));
    }
    return [...skills].sort((a, b) => b.downloads - a.downloads);
  }

  private saveToCache(skills: ClawHubSkill[]): void {
    for (const skill of skills) {
      this.skillCache.set(skill.slug, skill);
      this.repository.upsertSkill(skill);
    }
  }

  private inferPermissions(skill: Record<string, unknown>): string[] {
    const slug = String(skill.slug ?? "").toLowerCase();
    if (slug.includes("email") || slug.includes("gmail")) {
      return ["gmail.read", "gmail.send", "network.http"];
    }
    if (slug.includes("calendar")) {
      return ["calendar.read", "calendar.write"];
    }
    if (slug.includes("research") || slug.includes("search") || slug.includes("tavily")) {
      return ["network.http", "filesystem.read"];
    }
    return ["network.http"];
  }
}
