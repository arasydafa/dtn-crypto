import type { NodeDetail } from "../types";

interface Props {
  node: NodeDetail;
}

export default function NodeCryptoPanel({ node }: Props) {
  return (
    <>
      {/* Role badges */}
      <div className="inspector-section">
        <h3>Attributes</h3>
        {node.attributes.length === 0 ? (
          <p style={{ color: "var(--text2)", fontSize: 12 }}>No attributes assigned</p>
        ) : (
          <div className="attr-chips">
            {node.attributes.map((attr) => (
              <span className="attr-chip" key={attr}>
                {attr}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* RSA Key Preview */}
      <div className="inspector-section">
        <h3>RSA Public Key</h3>
        {node.rsa_public_key_pem ? (
          <pre className="pem-preview">{node.rsa_public_key_pem}</pre>
        ) : (
          <p style={{ color: "var(--text2)", fontSize: 12 }}>No RSA key generated</p>
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
        </div>
      </div>
    </>
  );
}
