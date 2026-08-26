import { useState } from "react";
import type { NodeDetail, BundleDetail } from "../types";

interface Props {
  node: NodeDetail;
  nodeBundles: BundleDetail[];
  onSelectBundle: (id: string) => void;
}

function StatusBadge({ bundle }: { bundle: BundleDetail }) {
  if (bundle.delivered) return <span className="badge badge-delivered">Delivered</span>;
  if (bundle.dropped) return <span className="badge badge-dropped">Dropped</span>;
  if (bundle.expired) return <span className="badge badge-expired">Expired</span>;
  return <span className="badge badge-transit">In Transit</span>;
}

export default function NodeCryptoPanel({ node, nodeBundles, onSelectBundle }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const inTransit = nodeBundles.filter((b) => !b.delivered && !b.dropped && !b.expired);

  return (
    <>
      {/* Attributes */}
      <div className="inspector-section">
        <h3>Attributes</h3>
        {node.attributes.length === 0 ? (
          <p style={{ color: "var(--text2)", fontSize: 12 }}>No attributes assigned</p>
        ) : (
          <div className="attr-chips">
            {node.attributes.map((attr) => (
              <span className="attr-chip" key={attr}>{attr}</span>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="inspector-section">
        <h3>Statistics</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{node.delivered_count}</div>
            <div className="stat-label">Delivered</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{node.buffer_count}</div>
            <div className="stat-label">In Buffer</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{inTransit.length}</div>
            <div className="stat-label">Relayed</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{nodeBundles.length}</div>
            <div className="stat-label">Total Seen</div>
          </div>
        </div>
      </div>

      {/* RSA Key */}
      <div className="inspector-section">
        <h3>RSA Public Key</h3>
        {node.rsa_public_key_pem ? (
          <pre className="pem-preview">{node.rsa_public_key_pem}</pre>
        ) : (
          <p style={{ color: "var(--text2)", fontSize: 12 }}>No RSA key generated</p>
        )}
      </div>

      {/* Bundles */}
      {nodeBundles.length > 0 && (
        <div className="inspector-section">
          <h3>Bundles ({nodeBundles.length})</h3>
          <div className="bundle-list" style={{ maxHeight: 400 }}>
            {nodeBundles.map((b) => {
              const isExpanded = expanded === b.bundle_id;
              return (
                <div
                  key={b.bundle_id}
                  className="bundle-list-item"
                  style={{ flexDirection: "column", alignItems: "stretch", cursor: "pointer" }}
                  onClick={() => setExpanded(isExpanded ? null : b.bundle_id)}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <StatusBadge bundle={b} />
                      <span className="bundle-id" style={{ fontSize: 11 }}>{b.bundle_id.slice(0, 8)}...</span>
                    </div>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
                    {b.source} → {b.destination} | t={b.creation_time.toFixed(1)}s | {b.hop_count} hop{b.hop_count !== 1 ? "s" : ""} | {b.payload_size_bytes}B
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: 8, padding: "8px 0", borderTop: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
                      {/* Timing */}
                      <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 6 }}>
                        <div>Encrypt: {b.encrypt_time_ms.toFixed(2)}ms</div>
                        <div>Transmit: {b.transmission_time_ms.toFixed(2)}ms</div>
                        {b.decrypt_time_ms != null && <div>Decrypt: {b.decrypt_time_ms.toFixed(2)}ms</div>}
                        {b.delivery_time != null && <div>Delivered at: t={b.delivery_time.toFixed(1)}s</div>}
                      </div>

                      {/* Plaintext preview */}
                      {b.plaintext_preview && (
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>Plaintext</div>
                          <div style={{
                            fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent2)",
                            background: "var(--bg)", padding: "4px 6px", borderRadius: 3,
                            maxHeight: 40, overflow: "hidden", wordBreak: "break-all"
                          }}>
                            {b.plaintext_preview}
                          </div>
                        </div>
                      )}

                      {/* Encrypted preview */}
                      {b.encrypted_preview && (
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>Encrypted</div>
                          <div style={{
                            fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent)",
                            background: "var(--bg)", padding: "4px 6px", borderRadius: 3,
                            maxHeight: 40, overflow: "hidden", wordBreak: "break-all"
                          }}>
                            {b.encrypted_preview}...
                          </div>
                        </div>
                      )}

                      {/* Hash & Policy */}
                      {b.payload_hash && (
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>
                          SHA-256: <span style={{ fontFamily: "var(--font-mono)", color: "var(--text2)" }}>{b.payload_hash.slice(0, 16)}...</span>
                        </div>
                      )}
                      {b.cpabe_policy && (
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          Policy: <span style={{ color: "var(--accent)" }}>{b.cpabe_policy}</span>
                        </div>
                      )}

                      {/* Hop history */}
                      {b.hop_history.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Path</div>
                          {b.hop_history.map((hop, i) => (
                            <div key={i} style={{ fontSize: 10, color: "var(--text2)", fontFamily: "var(--font-mono)" }}>
                              {hop.from_node} → {hop.to_node} @ t={hop.time.toFixed(1)}s ({hop.transmission_time_ms.toFixed(1)}ms)
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Open full bundle inspector */}
                      <button
                        className="btn btn-secondary"
                        style={{ marginTop: 8, fontSize: 11, padding: "4px 10px", flex: "none" }}
                        onClick={() => onSelectBundle(b.bundle_id)}
                      >
                        Open Full Inspector
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
