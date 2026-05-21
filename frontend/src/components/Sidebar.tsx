import type { SimulationConfig, BundleDetail, InspectorTarget } from "../types";
import FileUpload from "./FileUpload";
import { useState } from "react";

interface Props {
    collapsed: boolean;
    config: SimulationConfig;
    onConfigChange: (patch: Partial<SimulationConfig>) => void;
    bundleDetails: BundleDetail[];
    onSelectBundle: (id: string) => void;
    selectedTarget: InspectorTarget;
    animationSpeed: number;
    onAnimationSpeedChange: (speed: number) => void;
    bundleFilter: string;
    onBundleFilterChange: (filter: string) => void;
    onSavePreset: (name: string) => void;
    onLoadPreset: (preset: { name: string; config: SimulationConfig }) => void;
    getPresets: () => Array<{ name: string; config: SimulationConfig; savedAt: number }>;
    onExportCsv: () => void;
    hasEvents: boolean;
    onToggleSidebar: () => void;
}

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

const iconConfig = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const iconPayload = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </svg>
);

const iconScenario = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
    </svg>
);

const iconBundles = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
);

const iconSpeed = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);

const iconPreset = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </svg>
);

const filterOptions = [
    { key: "all", label: "All" },
    { key: "delivered", label: "Delivered" },
    { key: "dropped", label: "Dropped" },
    { key: "expired", label: "Expired" },
    { key: "intransit", label: "In Transit" },
];

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
            <div className="sidebar sidebar-collapsed">
                <button className="sidebar-section-icon" title="Expand sidebar" onClick={onToggleSidebar}>
                    {iconConfig}
                </button>
                <button className="sidebar-section-icon" title="Configuration" onClick={onToggleSidebar}>
                    {iconPayload}
                </button>
                <button className="sidebar-section-icon" title="Scenarios" onClick={onToggleSidebar}>
                    {iconScenario}
                </button>
                {bundleDetails.length > 0 && (
                    <button className="sidebar-section-icon" title={`Bundles (${bundleDetails.length})`} onClick={onToggleSidebar}>
                        {iconBundles}
                    </button>
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
        <div className="sidebar">
            <div className="sidebar-section">
                <div className="sidebar-section-title">
                    {iconConfig}
                    <span>Configuration</span>
                </div>

                <div className="control-group">
                    <label>Routing Algorithm</label>
                    <select
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
                    </select>
                </div>

                <div className="control-group">
                    <label>
                        Node Count <span className="val">{config.nodes}</span>
                    </label>
                    <input
                        type="range"
                        min={5}
                        max={50}
                        value={config.nodes}
                        onChange={(e) => onConfigChange({ nodes: Number(e.target.value) })}
                    />
                </div>

                <div className="control-group">
                    <label>
                        Duration (sec) <span className="val">{config.duration}</span>
                    </label>
                    <input
                        type="range"
                        min={60}
                        max={7200}
                        step={60}
                        value={config.duration}
                        onChange={(e) => onConfigChange({ duration: Number(e.target.value) })}
                    />
                </div>

                <div className="control-group">
                    <label>
                        Message Rate (msg/min){" "}
                        <span className="val">{config.message_rate.toFixed(1)}</span>
                    </label>
                    <input
                        type="range"
                        min={0.1}
                        max={10}
                        step={0.1}
                        value={config.message_rate}
                        onChange={(e) =>
                            onConfigChange({ message_rate: Number(e.target.value) })
                        }
                    />
                </div>
            </div>

            {/* Animation Speed */}
            <div className="sidebar-section">
                <div className="sidebar-section-title">
                    {iconSpeed}
                    <span>Animation</span>
                </div>
                <div className="control-group">
                    <label>
                        Speed <span className="val">{animationSpeed.toFixed(1)}x</span>
                    </label>
                    <input
                        type="range"
                        min={0.5}
                        max={3}
                        step={0.1}
                        value={animationSpeed}
                        onChange={(e) => onAnimationSpeedChange(Number(e.target.value))}
                    />
                </div>
            </div>

            <div className="sidebar-section">
                <div className="sidebar-section-title">
                    {iconPayload}
                    <span>Custom Payload</span>
                </div>
                <div className="control-group">
                    <label>Payload Text</label>
                    <textarea
                        className="payload-input"
                        placeholder="Enter custom payload text (max 1MB)..."
                        rows={3}
                        value={config.payload_text ?? ""}
                        onChange={(e) =>
                            onConfigChange({
                                payload_text: e.target.value || null,
                            })
                        }
                    />
                </div>
                <FileUpload
                    onFileContent={(content) =>
                        onConfigChange({ payload_text: content || null })
                    }
                    currentPayload={config.payload_text}
                />
            </div>

            <div className="sidebar-section">
                <div className="sidebar-section-title">
                    {iconScenario}
                    <span>Scenarios</span>
                </div>
                <div className="scenarios">
                    {scenarios.map((s) => (
                        <button
                            key={s.key}
                            className={
                                "scenario-btn" + (config.scenario === s.key ? " active" : "")
                            }
                            onClick={() => onConfigChange({ scenario: s.key })}
                            title={s.desc}
                        >
                            <div className="name">{s.name}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Presets */}
            <div className="sidebar-section">
                <div className="sidebar-section-title">
                    {iconPreset}
                    <span>Presets</span>
                </div>
                <div className="preset-save-row">
                    <input
                        type="text"
                        className="preset-input"
                        placeholder="Preset name..."
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && presetName.trim()) {
                                onSavePreset(presetName.trim());
                                setPresetName("");
                            }
                        }}
                    />
                    <button
                        className="preset-save-btn"
                        onClick={() => {
                            if (presetName.trim()) {
                                onSavePreset(presetName.trim());
                                setPresetName("");
                            }
                        }}
                        disabled={!presetName.trim()}
                    >
                        Save
                    </button>
                </div>
                {presets.length > 0 && (
                    <div className="preset-list">
                        {presets.map((p, i) => (
                            <button
                                key={i}
                                className="preset-item"
                                onClick={() => onLoadPreset(p)}
                                title={`Load ${p.name}`}
                            >
                                <span className="preset-item-name">{p.name}</span>
                                <span className="preset-item-date">
                                    {new Date(p.savedAt).toLocaleDateString()}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Bundle Filter & List */}
            {bundleDetails.length > 0 && (
                <div className="sidebar-section">
                    <div className="sidebar-section-title">
                        {iconBundles}
                        <span>Bundles</span>
                    </div>
                    <div className="bundle-filter-chips">
                        {filterOptions.map((f) => (
                            <button
                                key={f.key}
                                className={`bundle-filter-chip${bundleFilter === f.key ? " active" : ""}`}
                                onClick={() => onBundleFilterChange(f.key)}
                            >
                                {f.label}
                                <span className="chip-count">{bundleCounts[f.key as keyof typeof bundleCounts]}</span>
                            </button>
                        ))}
                    </div>
                    <div className="bundle-list">
                        {bundleDetails.slice(0, 50).map((b) => (
                            <button
                                key={b.bundle_id}
                                className={
                                    "bundle-list-item" +
                                    (selectedTarget?.type === "bundle" && selectedTarget.id === b.bundle_id
                                        ? " selected"
                                        : "")
                                }
                                onClick={() => onSelectBundle(b.bundle_id)}
                            >
                                <span className="bundle-id">{b.bundle_id}</span>
                                <span className="bundle-route">
                                    {b.source} &rarr; {b.destination}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Export CSV */}
            <div className="sidebar-section">
                <button
                    className="export-csv-btn"
                    onClick={onExportCsv}
                    disabled={!hasEvents}
                    title={hasEvents ? "Export events as CSV" : "Run simulation to generate events"}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export Events CSV
                </button>
            </div>

            <div className="credit-section">
                <p className="credit-text">
                    Made by <span className="credit-name">Arasy Dafa Sulistya Kurniawan</span>
                </p>
            </div>

        </div>
    );
}
