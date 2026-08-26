import type { InspectorTarget, BundleDetail, NodeDetail } from "../types";
import BundleInspector from "./BundleInspector";

interface Props {
  target: InspectorTarget;
  bundleDetails: Record<string, BundleDetail>;
  nodeDetails: Record<string, NodeDetail>;
  onClose: () => void;
  onSelectBundle: (id: string) => void;
}

export default function InspectorPanel({
  target,
  bundleDetails,
  onClose,
}: Props) {
  if (!target || target.type !== "bundle") return null;

  const bundle = bundleDetails[target.id];
  const title = bundle ? `Bundle ${bundle.bundle_id}` : `Bundle ${target.id}`;

  return (
    <div className="inspector-float">
      <div className="inspector-float-header">
        <h2>{title}</h2>
        <button className="inspector-close" onClick={onClose}>×</button>
      </div>
      <div className="inspector-float-content">
        {bundle ? (
          <BundleInspector bundle={bundle} />
        ) : (
          <p style={{ color: "var(--text2)", fontSize: 13 }}>Bundle details not available yet. Run simulation to completion first.</p>
        )}
      </div>
    </div>
  );
}
