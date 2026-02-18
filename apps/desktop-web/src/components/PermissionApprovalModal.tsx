import type { PermissionGrant } from "../tauriGateway.js";

type PermissionApprovalModalProps = {
  open: boolean;
  grants: PermissionGrant[];
  skillName: string;
  targetAgentName: string;
  busy: boolean;
  onApproveAll: () => void;
  onDenyAll: () => void;
  onClose: () => void;
};

export function PermissionApprovalModal({
  open,
  grants,
  skillName,
  targetAgentName,
  busy,
  onApproveAll,
  onDenyAll,
  onClose
}: PermissionApprovalModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-xl border border-lobster/40 p-4 shadow-lobster-glow-strong">
        <h3 className="section-title">Pending Approval</h3>
        <p className="mb-3 text-sm text-text-primary">
          Install <span className="text-lobster">{skillName}</span> for <span className="text-lobster">{targetAgentName}</span>
        </p>
        <p className="mb-2 text-xs text-text-secondary">Approve required capabilities before installation:</p>
        <div className="max-h-56 space-y-2 overflow-auto">
          {grants.map((grant) => (
            <div key={grant.id} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-text-secondary">
              {grant.capability}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="lobster-button" type="button" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button className="lobster-button" type="button" onClick={onDenyAll} disabled={busy}>
            Deny
          </button>
          <button className="lobster-button-filled" type="button" onClick={onApproveAll} disabled={busy}>
            {busy ? "Processing..." : "Approve & Install"}
          </button>
        </div>
      </div>
    </div>
  );
}
