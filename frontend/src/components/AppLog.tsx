/**
 * @module components/AppLog
 * @description Application log viewer — OmegaOS phase 3.
 *
 * Entries render through @omega-os/ui LogViewer (filter + follow + copy).
 */

import type { AppLogEntry } from "../hooks/useSimulation";
import { LogViewer } from "@omega-os/ui";
import type { LogLevel } from "@omega-os/ui";

/** Props for the AppLog component. */
interface Props {
  /** Array of application log entries (newest first). */
  logs: AppLogEntry[];

  /** Callback to clear all log entries. */
  onClear: () => void;
}

const levelMap: Record<AppLogEntry["level"], LogLevel> = {
    info: "info",
    warn: "warn",
    error: "error",
    success: "success",
};

export default function AppLog({ logs, onClear }: Props) {
    return (
        <LogViewer
            lines={[...logs].reverse().map((log) => ({
                id: String(log.id),
                level: levelMap[log.level],
                text: log.detail ? `${log.message} — ${log.detail}` : log.message,
                time: log.time,
            }))}
            onClear={onClear}
        />
    );
}
