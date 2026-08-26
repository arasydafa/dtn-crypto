/**
 * @module components/BundleInspector
 * @description Detailed bundle inspector showing path, timing, and content stages.
 *
 * Renders the complete bundle lifecycle: status badge, routing path timeline,
 * encrypt/transmit/decrypt timing waterfall, and three content stages
 * (plaintext at source, encrypted in transit, decrypted at destination).
 *
 * Contains three internal helper components:
 * - {@link StatusBadge} — colored badge for bundle status
 * - {@link TimingWaterfall} — horizontal stacked bar for timing breakdown
 * - {@link AccordionSection} — collapsible section for content stages
 *
 * @example
 * ```tsx
 * <BundleInspector bundle={bundleDetails["abc-123"]} />
 * ```
 */

import { useState } from "react";
import type { BundleDetail } from "../types";

/** Props for the BundleInspector component. */
interface Props {
  /** Complete bundle detail data. */
  bundle: BundleDetail;
}

/**
 * Colored badge indicating bundle delivery status.
 * @param bundle - Bundle to display status for.
 */
function StatusBadge({ bundle }: { bundle: BundleDetail }) {
  if (bundle.delivered)
    return <span className="badge badge-delivered">Delivered</span>;
  if (bundle.dropped)
    return <span className="badge badge-dropped">Dropped</span>;
  if (bundle.expired)
    return <span className="badge badge-expired">Expired</span>;
  return <span className="badge badge-transit">In Transit</span>;
}

/**
 * Horizontal stacked bar showing encrypt/transmit/decrypt time breakdown.
 * @param bundle - Bundle with timing data.
 */
function TimingWaterfall({ bundle }: { bundle: BundleDetail }) {
  const enc = bundle.encrypt_time_ms;
  const tx = bundle.transmission_time_ms;
  const dec = bundle.decrypt_time_ms ?? 0;
  const total = enc + tx + dec;
  if (total === 0) return <p style={{ color: "var(--text2)", fontSize: 12 }}>No timing data</p>;

  const pEnc = (enc / total) * 100;
  const pTx = (tx / total) * 100;
  const pDec = (dec / total) * 100;

  return (
    <div className="timing-waterfall">
      <div className="timing-bar-row">
        <div className="timing-bar-track">
          {pEnc > 0 && (
            <div className="timing-segment encrypt" style={{ width: `${pEnc}%` }}>
              {enc >= 0.1 ? `${enc.toFixed(1)}ms` : ""}
            </div>
          )}
          {pTx > 0 && (
            <div className="timing-segment transmit" style={{ width: `${pTx}%` }}>
              {tx >= 0.1 ? `${tx.toFixed(1)}ms` : ""}
            </div>
          )}
          {pDec > 0 && (
            <div className="timing-segment decrypt" style={{ width: `${pDec}%` }}>
              {dec >= 0.1 ? `${dec.toFixed(1)}ms` : ""}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text2)", marginTop: 4 }}>
        <span><span style={{ color: "var(--accent)" }}>Encrypt</span></span>
        <span><span style={{ color: "var(--warn)" }}>Transmit</span></span>
        <span><span style={{ color: "var(--accent2)" }}>Decrypt</span></span>
      </div>
      <div className="timing-total">Total: {total.toFixed(2)} ms</div>
    </div>
  );
}

/**
 * Collapsible accordion section with a trigger button.
 * @param title - Section header text.
 * @param defaultOpen - Whether the section starts expanded.
 * @param children - Section content.
 */
function AccordionSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="accordion-item">
      <button
        className="accordion-trigger"
        data-open={open}
        onClick={() => setOpen(!open)}
      >
        {title}
        <span className="arrow">{"\u25B6"}</span>
      </button>
      {open && <div className="accordion-content">{children}</div>}
    </div>
  );
}

/**
 * Bundle inspector component.
 *
 * Sections:
 * 1. **Header** — Status badge, source→destination, creation time, hop count, payload size
 * 2. **Bundle Path** — Hop-by-hop timeline with transfer times
 * 3. **Timing Breakdown** — Encrypt/transmit/decrypt waterfall chart
 * 4. **Content Stages** — Plaintext (source), Encrypted (transit), Decrypted (destination)
 */
export default function BundleInspector({ bundle }: Props) {
  return (
    <>
      {/* Header */}
      <div className="inspector-section">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge bundle={bundle} />
          <span style={{ fontSize: 12, color: "var(--text2)" }}>
            {bundle.source} → {bundle.destination}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>
          Created at t={bundle.creation_time.toFixed(1)}s
          {bundle.delivery_time != null && ` | Delivered at t=${bundle.delivery_time.toFixed(1)}s`}
          {" | "}{bundle.hop_count} hop{bundle.hop_count !== 1 ? "s" : ""}
          {" | "}{bundle.payload_size_bytes} bytes
        </div>
      </div>

      {/* Path Timeline (R1) */}
      <div className="inspector-section">
        <h3>Bundle Path</h3>
        {bundle.hop_history.length === 0 ? (
          <p style={{ color: "var(--text2)", fontSize: 12 }}>No hops recorded (bundle may not have been transferred)</p>
        ) : (
          <div className="hop-timeline">
            {bundle.hop_history.map((hop, i) => (
              <div className="hop-step" key={i}>
                <div className="hop-info">
                  <div className="hop-nodes">
                    {hop.from_node} → {hop.to_node}
                  </div>
                  <div className="hop-meta">
                    t={hop.time.toFixed(1)}s | tx={hop.transmission_time_ms.toFixed(2)}ms
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timing Waterfall (R4) */}
      <div className="inspector-section">
        <h3>Timing Breakdown</h3>
        <TimingWaterfall bundle={bundle} />
      </div>

      {/* Content Stages (R2) */}
      <div className="inspector-section">
        <h3>Content Stages</h3>
        <div className="content-accordion">
          <AccordionSection title="Plaintext (Source)" defaultOpen>
            <div style={{ fontSize: 12 }}>
              <div style={{ marginBottom: 6, color: "var(--text)" }}>
                {bundle.plaintext_preview || "<empty>"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>
                Size: {bundle.payload_size_bytes} bytes
              </div>
            </div>
          </AccordionSection>

          <AccordionSection title="Encrypted (Transit)">
            <div style={{ fontSize: 12 }}>
              {bundle.encrypted_preview ? (
                <div className="pem-preview" style={{ marginBottom: 6 }}>
                  {bundle.encrypted_preview}...
                </div>
              ) : (
                <div style={{ color: "var(--text2)", marginBottom: 6 }}>No encrypted data</div>
              )}
              {bundle.payload_hash && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: "var(--text2)", fontSize: 11 }}>SHA-256: </span>
                  <span className="hash-display">{bundle.payload_hash}</span>
                </div>
              )}
              {bundle.cpabe_policy && (
                <div>
                  <span style={{ color: "var(--text2)", fontSize: 11 }}>Policy: </span>
                  <span style={{ color: "var(--accent)", fontSize: 12 }}>{bundle.cpabe_policy}</span>
                </div>
              )}
            </div>
          </AccordionSection>

          <AccordionSection title="Decrypted (Destination)">
            <div style={{ fontSize: 12 }}>
              {bundle.integrity_verified === true && (
                <div style={{ marginBottom: 6 }}>
                  <span className="badge badge-verified">Integrity Verified</span>
                </div>
              )}
              {bundle.integrity_verified === false && (
                <div style={{ marginBottom: 6 }}>
                  <span className="badge badge-failed">Integrity Failed</span>
                </div>
              )}
              {bundle.integrity_verified === null && (
                <div style={{ color: "var(--text2)", marginBottom: 6 }}>Not yet verified</div>
              )}
              {bundle.delivered && bundle.plaintext_preview && (
                <div style={{ color: "var(--text)" }}>
                  {bundle.plaintext_preview}
                </div>
              )}
            </div>
          </AccordionSection>
        </div>
      </div>
    </>
  );
}
