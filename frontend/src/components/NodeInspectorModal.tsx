import { useState } from "react";
import type { NodeDetail, BundleDetail } from "../types";
import { Modal, Tabs, Badge, Accordion, CodeBlock, Button } from "@omega-os/ui";
import { Server, Package, KeyRound } from "lucide-react";

interface Props {
  node: NodeDetail;
  nodeBundles: BundleDetail[];
  onSelectBundle: (id: string) => void;
  onClose: () => void;
}

function StatusBadge({ bundle }: { bundle: BundleDetail }) {
  if (bundle.delivered) return <Badge tone="success">Delivered</Badge>;
  if (bundle.dropped) return <Badge tone="danger">Dropped</Badge>;
  if (bundle.expired) return <Badge tone="grey">Expired</Badge>;
  return <Badge tone="warning">In Transit</Badge>;
}

export default function NodeInspectorModal({ node, nodeBundles, onSelectBundle, onClose }: Props) {
  const [activeTab, setActiveTab] = useState("overview");

  const inTransit = nodeBundles.filter((b) => !b.delivered && !b.dropped && !b.expired);
  const role = node.attributes.find((a) => a.startsWith("role:"))?.split(":")[1] ?? "node";

  return (
    <Modal
      open
      onClose={onClose}
      title={node.node_id}
      size="lg"
      icon={<Server size={16} aria-hidden className="text-ot-muted" />}
    >
      <div className="flex max-h-[70vh] flex-col gap-3">
        <div>
          <Badge tone="navy">{role}</Badge>
        </div>

        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          label="Node details"
          tabs={[
            { id: "overview", label: "Overview", icon: <Server size={15} aria-hidden /> },
            {
              id: "bundles",
              label: `Bundles${nodeBundles.length > 0 ? ` (${nodeBundles.length})` : ""}`,
              icon: <Package size={15} aria-hidden />,
            },
            { id: "key", label: "Crypto", icon: <KeyRound size={15} aria-hidden /> },
          ]}
        />

        <div className="overflow-y-auto">
          {activeTab === "overview" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ot-muted">Attributes</h3>
                {node.attributes.length === 0 ? (
                  <p className="text-xs text-ot-muted">No attributes assigned</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {node.attributes.map((attr) => (
                      <Badge key={attr} tone="navy">{attr}</Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ot-muted">Statistics</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: node.delivered_count, label: "Delivered" },
                    { value: node.buffer_count, label: "In Buffer" },
                    { value: inTransit.length, label: "Relayed" },
                    { value: nodeBundles.length, label: "Total Seen" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-ot-md border border-ot-border bg-ot-bg px-3 py-2.5 text-center">
                      <div className="text-xl font-bold text-navy-text">{s.value}</div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-ot-muted">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "bundles" && (
            <div>
              {nodeBundles.length === 0 ? (
                <p className="px-1 py-5 text-center text-xs text-ot-muted">
                  No bundles associated with this node yet.
                </p>
              ) : (
                <Accordion
                  mode="multiple"
                  items={nodeBundles.map((b) => ({
                    id: b.bundle_id,
                    title: (
                      <span className="flex items-center gap-1.5">
                        <StatusBadge bundle={b} />
                        <span className="font-mono text-[11px]">{b.bundle_id.slice(0, 8)}...</span>
                      </span>
                    ),
                    content: (
                      <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                        <div className="text-[11px] text-ot-muted">
                          {b.source} → {b.destination} | t={b.creation_time.toFixed(1)}s | {b.hop_count} hop{b.hop_count !== 1 ? "s" : ""} | {b.payload_size_bytes}B
                        </div>
                        <div className="text-[11px] text-ot-muted">
                          <div>Encrypt: {b.encrypt_time_ms.toFixed(2)}ms</div>
                          <div>Transmit: {b.transmission_time_ms.toFixed(2)}ms</div>
                          {b.decrypt_time_ms != null && <div>Decrypt: {b.decrypt_time_ms.toFixed(2)}ms</div>}
                          {b.delivery_time != null && <div>Delivered at: t={b.delivery_time.toFixed(1)}s</div>}
                        </div>
                        {b.plaintext_preview && (
                          <CodeBlock code={b.plaintext_preview} language="plaintext" maxHeight={80} />
                        )}
                        {b.encrypted_preview && (
                          <CodeBlock code={`${b.encrypted_preview}...`} language="ciphertext" maxHeight={80} />
                        )}
                        {b.payload_hash && (
                          <div className="text-[10px] text-ot-muted">
                            SHA-256: <span className="font-mono">{b.payload_hash.slice(0, 16)}...</span>
                          </div>
                        )}
                        {b.cpabe_policy && (
                          <div className="text-[10px] text-ot-muted">
                            Policy: <span className="text-navy-text">{b.cpabe_policy}</span>
                          </div>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onSelectBundle(b.bundle_id)}
                        >
                          Open Full Inspector
                        </Button>
                      </div>
                    ),
                  }))}
                />
              )}
            </div>
          )}

          {activeTab === "key" && (
            <div className="flex flex-col gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ot-muted">RSA Public Key</h3>
              {node.rsa_public_key_pem ? (
                <CodeBlock code={node.rsa_public_key_pem} language="pem" maxHeight={320} />
              ) : (
                <p className="text-xs text-ot-muted">No RSA key generated</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
