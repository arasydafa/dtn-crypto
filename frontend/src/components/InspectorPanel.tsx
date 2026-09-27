import type { InspectorTarget, BundleDetail, NodeDetail } from "../types";
import BundleInspector from "./BundleInspector";
import { Button } from "@omega-os/ui";
import { X } from "lucide-react";

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
    <div className="absolute right-4 top-4 z-40 flex max-h-[calc(100%-2rem)] w-[340px] flex-col overflow-hidden rounded-ot-lg border border-ot-border bg-ot-bg shadow-ot-lg">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-ot-border px-4 py-3.5">
        <h2 className="truncate text-sm font-semibold text-ot-text">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} icon={<X size={16} aria-hidden />} aria-label="Close inspector" />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {bundle ? (
          <BundleInspector bundle={bundle} />
        ) : (
          <p className="text-[13px] text-ot-muted">Bundle details not available yet. Run simulation to completion first.</p>
        )}
      </div>
    </div>
  );
}
