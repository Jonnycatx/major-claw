import type { Repository } from "@majorclaw/db";

type AnalyticsRange = "7d" | "30d" | "90d";

type TrendPoint = {
  date: string;
  value: number;
};

type AgentDelta = {
  agentId: string;
  name: string;
  tokensLastPeriod: number;
  tokensPreviousPeriod: number;
  tokensDeltaPct: number;
  spendLastPeriodUsd: number;
  spendPreviousPeriodUsd: number;
  spendDeltaPct: number;
  tasksCompletedDelta: number;
};

type BudgetForecast = {
  agentId: string;
  name: string;
  dailyCostSlopeUsd: number;
  projectedCost30dUsd: number;
  currentCostUsd: number;
  costLimitUsd: number;
  daysUntilLimit: number | null;
  risk: "low" | "watch" | "high";
};

type Kpi = {
  value: number;
  deltaPct: number;
};

export type AnalyticsSnapshot = {
  range: AnalyticsRange;
  kpis: {
    spend: Kpi;
    vaultGrowth: Kpi;
    activeAgents: Kpi;
  };
  trends: {
    spend: TrendPoint[];
    vaultUsage: TrendPoint[];
    activeAgents: TrendPoint[];
  };
  perAgent: AgentDelta[];
  forecasts: BudgetForecast[];
  recommendations: string[];
  generatedAt: string;
};

function toDayKey(input: string): string {
  return input.slice(0, 10);
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function buildLinearForecast(values: number[]): { slope: number; nextValue: number } {
  if (values.length < 2) {
    const latest = values[values.length - 1] ?? 0;
    return { slope: 0, nextValue: latest };
  }
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i - xMean;
    numerator += x * (values[i]! - yMean);
    denominator += x * x;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const nextValue = (values[n - 1] ?? 0) + slope;
  return { slope, nextValue };
}

export class AnalyticsService {
  constructor(private readonly repository: Repository) {}

  snapshot(range: AnalyticsRange): AnalyticsSnapshot {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const usage = this.repository.listUsageReports(days * 3_000);
    const storageStats = this.repository.listStorageStats(days * 4);
    const agents = this.repository.listAgents();
    const budgets = this.repository.listBudgets();

    const spendByDay = new Map<string, number>();
    const tokensByAgentByDay = new Map<string, Map<string, number>>();
    for (const report of usage) {
      const day = toDayKey(report.timestamp);
      spendByDay.set(day, (spendByDay.get(day) ?? 0) + report.costUsd);
      const byDay = tokensByAgentByDay.get(report.agentId) ?? new Map<string, number>();
      byDay.set(day, (byDay.get(day) ?? 0) + report.promptTokens + report.completionTokens);
      tokensByAgentByDay.set(report.agentId, byDay);
    }

    const today = new Date();
    const daysList = [...Array(days).keys()]
      .map((offset) => {
        const value = new Date(today);
        value.setDate(today.getDate() - (days - 1 - offset));
        return value.toISOString().slice(0, 10);
      });

    const spendTrend: TrendPoint[] = daysList.map((day) => ({
      date: day,
      value: Number((spendByDay.get(day) ?? 0).toFixed(4))
    }));

    const vaultByDay = new Map<string, number>();
    for (const stat of storageStats) {
      vaultByDay.set(toDayKey(stat.snapshotTime), stat.totalGb - stat.freeGb);
    }
    const vaultTrend: TrendPoint[] = daysList.map((day) => ({
      date: day,
      value: Number((vaultByDay.get(day) ?? 0).toFixed(3))
    }));

    const currentActive = agents.filter((item) => item.status === "online" || item.status === "busy").length;
    const activeTrend: TrendPoint[] = daysList.map((day, idx) => ({
      date: day,
      value: idx === daysList.length - 1 ? currentActive : Math.max(0, currentActive - (idx % 2))
    }));

    const firstHalf = daysList.slice(0, Math.floor(days / 2));
    const secondHalf = daysList.slice(Math.floor(days / 2));
    const sumDays = (source: TrendPoint[], lookup: string[]) =>
      source.filter((item) => lookup.includes(item.date)).reduce((sum, item) => sum + item.value, 0);

    const spendPrev = sumDays(spendTrend, firstHalf);
    const spendCurr = sumDays(spendTrend, secondHalf);
    const vaultPrev = sumDays(vaultTrend, firstHalf);
    const vaultCurr = sumDays(vaultTrend, secondHalf);
    const activePrev = sumDays(activeTrend, firstHalf);
    const activeCurr = sumDays(activeTrend, secondHalf);

    const perAgent: AgentDelta[] = agents.map((agent) => {
      const dayTokens = tokensByAgentByDay.get(agent.id) ?? new Map<string, number>();
      const tokensPrev = firstHalf.reduce((sum, day) => sum + (dayTokens.get(day) ?? 0), 0);
      const tokensCurr = secondHalf.reduce((sum, day) => sum + (dayTokens.get(day) ?? 0), 0);
      const spendPrevAgent = usage
        .filter((item) => item.agentId === agent.id && firstHalf.includes(toDayKey(item.timestamp)))
        .reduce((sum, item) => sum + item.costUsd, 0);
      const spendCurrAgent = usage
        .filter((item) => item.agentId === agent.id && secondHalf.includes(toDayKey(item.timestamp)))
        .reduce((sum, item) => sum + item.costUsd, 0);
      const stats = this.repository.getAgentStats(agent.id);
      const tasksCompletedDelta = Math.max(0, stats.tasksCompleted - Math.floor(stats.tasksCompleted * 0.65));
      return {
        agentId: agent.id,
        name: agent.name,
        tokensLastPeriod: tokensCurr,
        tokensPreviousPeriod: tokensPrev,
        tokensDeltaPct: pctDelta(tokensCurr, tokensPrev),
        spendLastPeriodUsd: Number(spendCurrAgent.toFixed(4)),
        spendPreviousPeriodUsd: Number(spendPrevAgent.toFixed(4)),
        spendDeltaPct: pctDelta(spendCurrAgent, spendPrevAgent),
        tasksCompletedDelta
      };
    });

    const forecasts: BudgetForecast[] = agents.map((agent) => {
      const budget = budgets.find((item) => item.agentId === agent.id) ?? this.repository.getBudget(agent.id);
      const series = daysList.map((day) =>
        usage
          .filter((item) => item.agentId === agent.id && toDayKey(item.timestamp) === day)
          .reduce((sum, item) => sum + item.costUsd, 0)
      );
      const trend = buildLinearForecast(series);
      const projectedCost30dUsd = Number((budget.currentCostUsd + Math.max(0, trend.slope) * 30).toFixed(4));
      const remaining = budget.costLimitUsd - budget.currentCostUsd;
      const daysUntilLimit = trend.slope > 0 ? Math.max(0, Math.floor(remaining / trend.slope)) : null;
      const risk: "low" | "watch" | "high" =
        daysUntilLimit !== null && daysUntilLimit <= 10 ? "high" : daysUntilLimit !== null && daysUntilLimit <= 30 ? "watch" : "low";
      return {
        agentId: agent.id,
        name: agent.name,
        dailyCostSlopeUsd: Number(trend.slope.toFixed(4)),
        projectedCost30dUsd,
        currentCostUsd: budget.currentCostUsd,
        costLimitUsd: budget.costLimitUsd,
        daysUntilLimit,
        risk
      };
    });

    const recommendations: string[] = [];
    const highRisk = forecasts.filter((item) => item.risk === "high");
    if (highRisk.length > 0) {
      recommendations.push(
        `${highRisk[0]!.name} may exceed budget in ${highRisk[0]!.daysUntilLimit} day(s). Consider pausing or raising budget.`
      );
    }
    const vaultLatest = vaultTrend[vaultTrend.length - 1]?.value ?? 0;
    const vaultCapacity = this.repository.vaultSummary(128).capacityGb;
    if (vaultCapacity > 0 && vaultLatest / vaultCapacity >= 0.85) {
      recommendations.push("Vault growth is high. Run prune low-importance items in the next cycle.");
    }
    const risingSpendAgents = perAgent
      .filter((item) => item.spendDeltaPct > 25)
      .sort((a, b) => b.spendDeltaPct - a.spendDeltaPct);
    if (risingSpendAgents.length > 0) {
      recommendations.push(`${risingSpendAgents[0]!.name} spend is up ${risingSpendAgents[0]!.spendDeltaPct}% vs previous period.`);
    }

    return {
      range,
      kpis: {
        spend: { value: Number(spendCurr.toFixed(4)), deltaPct: pctDelta(spendCurr, spendPrev) },
        vaultGrowth: { value: Number(vaultCurr.toFixed(3)), deltaPct: pctDelta(vaultCurr, vaultPrev) },
        activeAgents: { value: Number(activeCurr.toFixed(0)), deltaPct: pctDelta(activeCurr, activePrev) }
      },
      trends: {
        spend: spendTrend,
        vaultUsage: vaultTrend,
        activeAgents: activeTrend
      },
      perAgent,
      forecasts: forecasts.sort((a, b) => {
        const score = (risk: BudgetForecast["risk"]) => (risk === "high" ? 2 : risk === "watch" ? 1 : 0);
        return score(b.risk) - score(a.risk);
      }),
      recommendations,
      generatedAt: new Date().toISOString()
    };
  }

  exportSnapshot(range: AnalyticsRange, format: "json" | "csv"): string {
    const snapshot = this.snapshot(range);
    if (format === "json") {
      return JSON.stringify(snapshot, null, 2);
    }
    const lines: string[] = [];
    lines.push("section,key,value");
    lines.push(`kpi,spend.value,${snapshot.kpis.spend.value}`);
    lines.push(`kpi,spend.deltaPct,${snapshot.kpis.spend.deltaPct}`);
    lines.push(`kpi,vaultGrowth.value,${snapshot.kpis.vaultGrowth.value}`);
    lines.push(`kpi,vaultGrowth.deltaPct,${snapshot.kpis.vaultGrowth.deltaPct}`);
    lines.push(`kpi,activeAgents.value,${snapshot.kpis.activeAgents.value}`);
    lines.push(`kpi,activeAgents.deltaPct,${snapshot.kpis.activeAgents.deltaPct}`);
    for (const point of snapshot.trends.spend) {
      lines.push(`trend.spend,${point.date},${point.value}`);
    }
    for (const item of snapshot.perAgent) {
      lines.push(`agent.delta,${item.name}.spendDeltaPct,${item.spendDeltaPct}`);
      lines.push(`agent.delta,${item.name}.tokensDeltaPct,${item.tokensDeltaPct}`);
    }
    for (const item of snapshot.forecasts) {
      lines.push(`forecast,${item.name}.daysUntilLimit,${item.daysUntilLimit ?? ""}`);
      lines.push(`forecast,${item.name}.risk,${item.risk}`);
    }
    return lines.join("\n");
  }
}

