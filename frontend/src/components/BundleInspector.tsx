/**
 * @module components/BundleInspector
 * @description Detailed bundle inspector — OmegaOS phase 2.
 *
 * Status -> Badge, path -> Timeline, content stages -> Accordion + CodeBlock.
 * Timing waterfall stays custom (stacked encrypt/transmit/decrypt has no
 * OmegaOS equivalent yet — candidate for a future OmegaOS component).
 */

import { Badge, Accordion, Timeline, CodeBlock } from "@omega-os/ui";
import type { BundleDetail } from "../types";

/** Props for the BundleInspector component. */
interface Props {
  /** Complete bundle detail data. */
  bundle: BundleDetail;
}

function StatusBadge({ bundle }: { bundle: BundleDetail }) {
  if (bundle.delivered) return <Badge tone="success">Delivered</Badge>;
  if (bundle.dropped) return <Badge tone="danger">Dropped</Badge>;
  if (bundle.expired) return <Badge tone="grey">Expired</Badge>;
  return <Badge tone="warning">In Transit</Badge>;
}

/**
 * Horizontal stacked bar showing encrypt/transmit/decrypt time breakdown.
 * Custom — no OmegaOS equivalent for a 3-segment timing bar yet.
 */
function TimingWaterfall({ bundle }: { bundle: BundleDetail }) {
  const enc = bundle.encrypt_time_ms;
  const tx = bundle.transmission_time_ms;
  const dec = bundle.decrypt_time_ms ?? 0;
  const total = enc + tx + dec;
  if (total === 0) return <p className="text-xs text-ot-muted">No timing data</p>;

  const pEnc = (enc / total) * 100;
  const pTx = (tx / total) * 100;
  const pDec = (dec / total) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-5 flex-1 overflow-hidden rounded-ot-sm bg-ot-surface-2">
        {pEnc > 0 && (
          <div className="flex h-full items-center justify-center text-[10px] font-semibold text-white bg-navy" style={{ width: `${pEnc}%` }}>
            {enc >= 0.1 ? `${enc.toFixed(1)}ms` : ""}
          </div>
        )}
        {pTx > 0 && (
          <div className="flex h-full items-center justify-center text-[10px] font-semibold text-white bg-warning" style={{ width: `${pTx}%` }}>
            {tx >= 0.1 ? `${tx.toFixed(1)}ms` : ""}
          </div>
        )}
        {pDec > 0 && (
          <div className="flex h-full items-center justify-center text-[10px] font-semibold text-white bg-success" style={{ width: `${pDec}%` }}>
            {dec >= 0.1 ? `${dec.toFixed(1)}ms` : ""}
          </div>
        )}
      </div>
      <div className="flex gap-3 text-[11px] text-ot-muted">
        <span className="font-medium text-navy-text">Encrypt</span>
        <span className="font-medium text-warning">Transmit</span>
        <span className="font-medium text-success">Decrypt</span>
      </div>
      <div className="text-right text-[11px] text-ot-muted">Total: {total.toFixed(2)} ms</div>
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
  const hops = bundle.hop_history;
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge bundle={bundle} />
          <span className="text-xs text-ot-muted">
            {bundle.source} → {bundle.destination}
          </span>
        </div>
        <div className="text-[11px] text-ot-muted">
          Created at t={bundle.creation_time.toFixed(1)}s
          {bundle.delivery_time != null && ` | Delivered at t=${bundle.delivery_time.toFixed(1)}s`}
          {" | "}{bundle.hop_count} hop{bundle.hop_count !== 1 ? "s" : ""}
          {" | "}{bundle.payload_size_bytes} bytes
        </div>
      </div>

      {/* Path Timeline */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ot-muted">Bundle Path</h3>
        {hops.length === 0 ? (
          <p className="text-xs text-ot-muted">No hops recorded (bundle may not have been transferred)</p>
        ) : (
          <Timeline
            items={hops.map((hop, i) => ({
              id: `hop-${i}`,
              title: `${hop.from_node} → ${hop.to_node}`,
              time: `t=${hop.time.toFixed(1)}s`,
              description: `tx=${hop.transmission_time_ms.toFixed(2)}ms`,
              tone: i === hops.length - 1 ? "success" : i === 0 ? "navy" : "grey",
            }))}
          />
        )}
      </div>

      {/* Timing Waterfall */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ot-muted">Timing Breakdown</h3>
        <TimingWaterfall bundle={bundle} />
      </div>

      {/* Content Stages */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ot-muted">Content Stages</h3>
        <Accordion
          mode="multiple"
          items={[
            {
              id: "plaintext",
              title: "Plaintext (Source)",
              defaultOpen: true,
              content: (
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="text-ot-text">{bundle.plaintext_preview || "<empty>"}</div>
                  <div className="text-[11px] text-ot-muted">Size: {bundle.payload_size_bytes} bytes</div>
                </div>
              ),
            },
            {
              id: "encrypted",
              title: "Encrypted (Transit)",
              content: (
                <div className="flex flex-col gap-2 text-xs">
                  {bundle.encrypted_preview ? (
                    <CodeBlock code={`${bundle.encrypted_preview}...`} language="ciphertext" maxHeight={120} />
                  ) : (
                    <div className="text-ot-muted">No encrypted data</div>
                  )}
                  {bundle.payload_hash && (
                    <CodeBlock code={bundle.payload_hash} language="sha-256" maxHeight={64} />
                  )}
                  {bundle.cpabe_policy && (
                    <div>
                      <span className="text-[11px] text-ot-muted">Policy: </span>
                      <span className="text-xs text-navy-text">{bundle.cpabe_policy}</span>
                    </div>
                  )}
                </div>
              ),
            },
            {
              id: "decrypted",
              title: "Decrypted (Destination)",
              content: (
                <div className="flex flex-col gap-1.5 text-xs">
                  {bundle.integrity_verified === true && (
                    <div><Badge tone="success">Integrity Verified</Badge></div>
                  )}
                  {bundle.integrity_verified === false && (
                    <div><Badge tone="danger">Integrity Failed</Badge></div>
                  )}
                  {bundle.integrity_verified === null && (
                    <div className="text-ot-muted">Not yet verified</div>
                  )}
                  {bundle.delivered && bundle.plaintext_preview && (
                    <div className="text-ot-text">{bundle.plaintext_preview}</div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
