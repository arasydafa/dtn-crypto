import type { InspectorTarget, BundleDetail, NodeDetail } from "../types";
import BundleInspector from "./BundleInspector";
import NodeCryptoPanel from "./NodeCryptoPanel";

interface Props {
  target: InspectorTarget;
  bundleDetails: Record<string, BundleDetail>;
  nodeDetails: Record<string, NodeDetail>;
  onClose: () => void;
}

export default function InspectorPanel({
  target,
  bundleDetails,
  nodeDetails,
  onClose,
}: Props) {
  if (!target) return null;

  let content: React.ReactNode = null;
  let title = "";

  if (target.type === "bundle") {
    const bundle = bundleDetails[target.id];
    if (!bundle) {
      content = <p style={{ color: "var(--text2)", fontSize: 13 }}>Bundle details not available yet. Run simulation to completion first.</p>;
      title = `Bundle ${target.id}`;
    } else {
      content = <BundleInspector bundle={bundle} />;
      title = `Bundle ${bundle.bundle_id}`;
    }
  } else if (target.type === "node") {
    const node = nodeDetails[target.id];
    if (!node) {
      content = <p style={{ color: "var(--text2)", fontSize: 13 }}>Node details not available yet. Run simulation to completion first.</p>;
      title = target.id;
    } else {
      content = <NodeCryptoPanel node={node} />;
      title = node.node_id;
    }
  }

  return (
    <div className="inspector-float">
      <div className="inspector-float-header">
        <h2>{title}</h2>
        <button className="inspector-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="inspector-float-content">
        {content}
      </div>
    </div>
  );
}
