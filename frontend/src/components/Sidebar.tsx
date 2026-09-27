/**
 * @module components/Sidebar
 * @description Left sidebar — OmegaOS phase 1.
 *
 * Configuration controls use @omega-os/ui (Select, Slider, Textarea,
 * Input, Button, Badge). Bundle list and layout container stay custom
 * until phase 2-3.
 */

import { Select, Slider, Textarea, Input, Button, Badge } from "@omega-os/ui";
import { Settings, FileText, Layers, Package, Save, Download } from "lucide-react";
import type { SimulationConfig, BundleDetail, InspectorTarget } from "../types";
import FileUpload from "./FileUpload";
import { useState } from "react";

/** Props for the Sidebar component. */
interface Props {
  /** Whether the sidebar is collapsed (icon-only mode). */
  collapsed: boolean;

  /** Current simulation configuration. */
  config: SimulationConfig;

  /** Partial-patch updater for the configuration. */
  onConfigChange: (patch: Partial<SimulationConfig>) => void;

  /** Filtered array of bundle details for the bundle list. */
  bundleDetails: BundleDetail[];

  /** Select a bundle for inspection by ID. */
  onSelectBundle: (id: string) => void;

  /** Current inspector panel target (for highlighting selected bundle). */
  selectedTarget: InspectorTarget;

  /** Animation speed multiplier (0.5x - 3x). */
  animationSpeed: number;

  /** Set the animation speed multiplier. */
  onAnimationSpeedChange: (speed: number) => void;

  /** Current bundle list filter. */
  bundleFilter: string;

  /** Set the bundle list filter. */
  onBundleFilterChange: (filter: string) => void;

  /** Save the current config as a named preset. */
  onSavePreset: (name: string) => void;

  /** Load a saved preset. */
  onLoadPreset: (preset: { name: string; config: SimulationConfig }) => void;

  /** Retrieve all saved presets from localStorage. */
  getPresets: () => Array<{ name: string; config: SimulationConfig; savedAt: number }>;

  /** Export the event log as CSV. */
  onExportCsv: () => void;

  /** Whether simulation events exist (enables export button). */
  hasEvents: boolean;

  /** Toggle sidebar collapsed state. */
  onToggleSidebar: () => void;
}

/**
 * Preset scenario definitions.
 */
const scenarios = [
    {
        key: "disaster" as const,
        name: "Disaster Recovery",
        desc: "Node failures, intermittent links, priority message routing",
    },
    {
        key: "deepspace" as const,
        name: "Deep Space",
        desc: "High delay (minutes), rare contacts, critical data integrity",
    },
    {
        key: "military" as const,
        name: "Military Tactical",
        desc: "CP-ABE policy enforcement, attribute-based access, secure multi-hop",
    },
];

/** Bundle list filter options. */
const filterOptions = [
    { key: "all", label: "All" },
    { key: "delivered", label: "Delivered" },
    { key: "dropped", label: "Dropped" },
    { key: "expired", label: "Expired" },
    { key: "intransit", label: "In Transit" },
];

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ot-muted">
      <span className="text-ot-muted">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

/**
 * Left sidebar component (OmegaOS controls).
 */
export default function Sidebar({
    collapsed,
    config,
    onConfigChange,
    bundleDetails,
    onSelectBundle,
    selectedTarget,
    animationSpeed,
    onAnimationSpeedChange,
    bundleFilter,
    onBundleFilterChange,
    onSavePreset,
    onLoadPreset,
    getPresets,
    onExportCsv,
    hasEvents,
    onToggleSidebar,
}: Props) {
    const [presetName, setPresetName] = useState("");

    if (collapsed) {
        return (
            <div className="flex w-16 flex-shrink-0 flex-col items-center gap-2 border-r border-ot-border bg-ot-bg py-5">
                <Button variant="ghost" size="sm" onClick={onToggleSidebar} icon={<Settings size={16} aria-hidden />} aria-label="Expand sidebar" />
                <Button variant="ghost" size="sm" onClick={onToggleSidebar} icon={<FileText size={16} aria-hidden />} aria-label="Configuration" />
                <Button variant="ghost" size="sm" onClick={onToggleSidebar} icon={<Layers size={16} aria-hidden />} aria-label="Scenarios" />
                {bundleDetails.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={onToggleSidebar} icon={<Package size={16} aria-hidden />} aria-label={`Bundles (${bundleDetails.length})`} />
                )}
            </div>
        );
    }

    const presets = getPresets();
    const bundleCounts = {
        all: bundleDetails.length,
        delivered: bundleDetails.filter((b) => b.delivered).length,
        dropped: bundleDetails.filter((b) => b.dropped).length,
        expired: bundleDetails.filter((b) => b.expired).length,
        intransit: bundleDetails.filter((b) => !b.delivered && !b.dropped && !b.expired).length,
    };

    return (
        <div className="flex w-[280px] flex-shrink-0 flex-col gap-5 overflow-y-auto border-r border-ot-border bg-ot-bg p-5">
            <div className="flex flex-col gap-2.5">
                <SectionTitle icon={<Settings size={16} aria-hidden />}>Configuration</SectionTitle>

                <Select
                    label="Routing Algorithm"
                    value={config.router}
                    onChange={(e) =>
                        onConfigChange({
                            router: e.target.value as SimulationConfig["router"],
                        })
                    }
                >
                    <option value="epidemic">Epidemic (Flood)</option>
                    <option value="prophet">PRoPHET (Probabilistic)</option>
                    <option value="spray">Spray-and-Wait (Binary)</option>
                </Select>

                <Slider
                    label={`Node Count (${config.nodes})`}
                    showValue={false}
                    min={5}
                    max={50}
                    value={config.nodes}
                    onChange={(v) => onConfigChange({ nodes: v })}
                />

                <Slider
                    label={`Duration (sec) (${config.duration})`}
                    showValue={false}
                    min={60}
                    max={7200}
                    step={60}
                    value={config.duration}
                    onChange={(v) => onConfigChange({ duration: v })}
                />

                <Slider
                    label={`Message Rate (msg/min) (${config.message_rate.toFixed(1)})`}
                    showValue={false}
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={config.message_rate}
                    onChange={(v) => onConfigChange({ message_rate: v })}
                />
            </div>

            <div className="flex flex-col gap-2.5">
                <SectionTitle icon={<Settings size={16} aria-hidden />}>Animation</SectionTitle>
                <Slider
                    label={`Speed (${animationSpeed.toFixed(1)}x)`}
                    showValue={false}
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={animationSpeed}
                    onChange={(v) => onAnimationSpeedChange(v)}
                />
            </div>

            <div className="flex flex-col gap-2.5">
                <SectionTitle icon={<FileText size={16} aria-hidden />}>Custom Payload</SectionTitle>
                <Textarea
                    label="Payload Text"
                    placeholder="Enter custom payload text (max 1MB)..."
                    rows={3}
                    value={config.payload_text ?? ""}
                    onChange={(e) =>
                        onConfigChange({
                            payload_text: e.target.value || null,
                        })
                    }
                />
                <FileUpload
                    onFileContent={(content) =>
                        onConfigChange({ payload_text: content || null })
                    }
                    currentPayload={config.payload_text}
                />
            </div>

            <div className="flex flex-col gap-2.5">
                <SectionTitle icon={<Layers size={16} aria-hidden />}>Scenarios</SectionTitle>
                <div className="flex flex-col gap-1.5">
                    {scenarios.map((s) => (
                        <Button
                            key={s.key}
                            variant={config.scenario === s.key ? "primary" : "secondary"}
                            size="sm"
                            onClick={() => onConfigChange({ scenario: s.key })}
                            title={s.desc}
                            className="justify-start"
                        >
                            {s.name}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-2.5">
                <SectionTitle icon={<Save size={16} aria-hidden />}>Presets</SectionTitle>
                <div className="flex gap-1.5">
                    <Input
                        placeholder="Preset name..."
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && presetName.trim()) {
                                onSavePreset(presetName.trim());
                                setPresetName("");
                            }
                        }}
                        className="flex-1"
                    />
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            if (presetName.trim()) {
                                onSavePreset(presetName.trim());
                                setPresetName("");
                            }
                        }}
                        disabled={!presetName.trim()}
                    >
                        Save
                    </Button>
                </div>
                {presets.length > 0 && (
                    <div className="flex max-h-[120px] flex-col gap-1 overflow-y-auto">
                        {presets.map((p, i) => (
                            <button
                                key={i}
                                className="flex items-center justify-between rounded-ot-sm border border-ot-border bg-ot-surface px-2.5 py-1.5 text-left transition-colors hover:border-navy"
                                onClick={() => onLoadPreset(p)}
                                title={`Load ${p.name}`}
                            >
                                <span className="text-xs font-semibold text-ot-text">{p.name}</span>
                                <span className="text-[10px] text-ot-muted">
                                    {new Date(p.savedAt).toLocaleDateString()}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {bundleDetails.length > 0 && (
                <div className="flex flex-col gap-2.5">
                    <SectionTitle icon={<Package size={16} aria-hidden />}>Bundles</SectionTitle>
                    <div className="flex flex-wrap gap-1.5">
                        {filterOptions.map((f) => (
                            <Button
                                key={f.key}
                                variant={bundleFilter === f.key ? "primary" : "secondary"}
                                size="sm"
                                onClick={() => onBundleFilterChange(f.key)}
                            >
                                {f.label}
                                <Badge tone={bundleFilter === f.key ? "navy" : "grey"}>
                                    {bundleCounts[f.key as keyof typeof bundleCounts]}
                                </Badge>
                            </Button>
                        ))}
                    </div>
                    <div className="flex max-h-[200px] flex-col gap-1 overflow-y-auto">
                        {bundleDetails.slice(0, 50).map((b) => (
                            <button
                                key={b.bundle_id}
                                className={`flex items-center justify-between rounded-ot-sm border px-2.5 py-1.5 text-xs transition-colors ${
                                    selectedTarget?.type === "bundle" && selectedTarget.id === b.bundle_id
                                        ? "border-navy bg-navy-bg"
                                        : "border-ot-border bg-ot-surface hover:border-navy"
                                }`}
                                onClick={() => onSelectBundle(b.bundle_id)}
                            >
                                <span className="font-mono font-medium text-ot-text">{b.bundle_id}</span>
                                <span className="text-[11px] text-ot-muted">
                                    {b.source} &rarr; {b.destination}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-2.5">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onExportCsv}
                    disabled={!hasEvents}
                    icon={<Download size={14} aria-hidden />}
                    title={hasEvents ? "Export events as CSV" : "Run simulation to generate events"}
                >
                    Export Events CSV
                </Button>
            </div>

            <div className="mt-auto border-t border-ot-border pt-4 text-center">
                <p className="text-[10px] leading-relaxed text-ot-muted">
                    Made by <span className="font-semibold text-navy">Arasy Dafa Sulistya Kurniawan</span>
                </p>
            </div>

        </div>
    );
}
