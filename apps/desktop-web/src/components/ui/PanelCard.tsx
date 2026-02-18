import type { PropsWithChildren } from "react";

type PanelCardProps = PropsWithChildren<{
  title?: string;
  className?: string;
}>;

export function PanelCard({ title, className, children }: PanelCardProps) {
  return (
    <section
      className={`glass-panel border border-lobster/20 p-3 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-lobster-glow-strong ${className ?? ""}`}
    >
      {title ? <h4 className="section-title">{title}</h4> : null}
      {children}
    </section>
  );
}
