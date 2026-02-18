type TopBarProps = {
  gatewayRunning: boolean;
  gatewayPort: number | null;
  health: string;
  spendToday: number;
  onStartGateway: () => Promise<void>;
  onStopGateway: () => Promise<void>;
  onBrowseSkills: () => void;
};

function StatusDot({ color }: { color: "green" | "cyan" | "red" }) {
  const map = {
    green: "bg-emerald-400",
    cyan: "bg-cyan animate-live",
    red: "bg-lobster"
  };
  return <span className={`status-dot ${map[color]}`} />;
}

export function TopBar({
  gatewayRunning,
  gatewayPort,
  health,
  spendToday,
  onStartGateway,
  onStopGateway,
  onBrowseSkills
}: TopBarProps) {
  return (
    <header className="relative z-10 flex h-16 items-center justify-between border-b border-lobster/25 bg-void/90 px-5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="neon-red rounded-full bg-lobster/15 p-1 text-[22px] leading-none">🦞</div>
        <div>
          <div className="bg-gradient-to-r from-white to-lobster bg-clip-text text-xl font-bold tracking-tight text-transparent">
            Major Claw
          </div>
          <div className="-mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-lobster">Mission Control</div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-text-secondary">
        <span className="font-medium text-text-primary">Spend today: ${spendToday.toFixed(2)}</span>
        <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1">
          <StatusDot color={gatewayRunning ? "green" : "red"} />
          Gateway: {gatewayRunning ? "running" : "stopped"} {gatewayPort ? `(:${gatewayPort})` : ""}
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-cyan/20 px-2.5 py-1">
          <StatusDot color="cyan" />
          Health: {health}
        </span>
        <button className="lobster-button" type="button" onClick={() => void onStartGateway()}>
          Start
        </button>
        <button className="lobster-button" type="button" onClick={() => void onStopGateway()}>
          Stop
        </button>
        <button className="lobster-button-filled" type="button" onClick={onBrowseSkills}>
          Browse Skills
        </button>
      </div>
    </header>
  );
}
