/**
 * @module components/WikiModal
 * @description Full-screen modal displaying the DTN Crypto wiki documentation.
 *
 * Covers DTN concepts, hybrid encryption, bundle structure, routing algorithms,
 * simulation scenarios, and feature highlights. Click the overlay or close button
 * to dismiss.
 *
 * @example
 * ```tsx
 * {showWiki && <WikiModal onClose={() => setShowWiki(false)} />}
 * ```
 */

/** Props for the WikiModal component. */
interface Props {
  /** Callback to close the wiki modal. */
  onClose: () => void;
}

/**
 * Wiki documentation modal.
 *
 * Renders a scrollable content panel with sections for:
 * - What is DTN?
 * - Hybrid Encryption (RSA-AES + CP-ABE)
 * - Bundle Structure
 * - Routing Algorithms (Epidemic, PRoPHET, Spray-and-Wait)
 * - Simulation Scenarios (Disaster, Deep Space, Military)
 * - Features (path visualization, timing waterfall, etc.)
 */
export default function WikiModal({ onClose }: Props) {
    return (
        <div className="wiki-overlay" onClick={onClose}>
            <div className="wiki-modal" onClick={(e) => e.stopPropagation()}>
                <div className="wiki-header">
                    <h2>DTN Crypto Wiki</h2>
                    <button className="wiki-close" onClick={onClose}>&times;</button>
                </div>
                <div className="wiki-content">
                    <div className="wiki-section">
                        <h3><span className="icon">&#x1f310;</span> What is DTN?</h3>
                        <p>
                            <strong>Delay-Tolerant Networking (DTN)</strong> is a network architecture designed for environments
                            where continuous end-to-end connectivity cannot be guaranteed. DTN uses a &quot;store-carry-forward&quot;
                            paradigm where intermediate nodes buffer data bundles and forward them when contact opportunities arise.
                        </p>
                        <p>DTN is used in:</p>
                        <ul>
                            <li>Interplanetary communication (Mars rovers, deep space probes)</li>
                            <li>Disaster recovery networks where infrastructure is damaged</li>
                            <li>Military tactical networks in contested environments</li>
                            <li>Remote sensor networks and wildlife monitoring</li>
                        </ul>
                    </div>

                    <div className="wiki-section">
                        <h3><span className="icon">&#x1f510;</span> Hybrid Encryption</h3>
                        <p>
                            This simulator uses a <strong>dual-layer encryption</strong> approach for maximum security:
                        </p>
                        <table className="wiki-table">
                            <thead>
                                <tr>
                                    <th>Layer</th>
                                    <th>Technology</th>
                                    <th>Purpose</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><span className="wiki-tag encrypt">Outer</span></td>
                                    <td>RSA-OAEP + AES-256-GCM</td>
                                    <td>Confidentiality - only destination can decrypt</td>
                                </tr>
                                <tr>
                                    <td><span className="wiki-tag access">Inner</span></td>
                                    <td>CP-ABE (Attribute-Based)</td>
                                    <td>Access control - policy-based decryption</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="wiki-section">
                        <h3><span className="icon">&#x1f4e6;</span> Bundle Structure</h3>
                        <p>
                            Every DTN bundle contains encrypted payload plus metadata including
                            source, destination, TTL, priority, hop count, and integrity hash.
                        </p>
                        <ul>
                            <li><span className="wiki-tag encrypt">RSA-AES</span> RSA-OAEP wraps an ephemeral AES-256 session key, which encrypts the inner layer</li>
                            <li><span className="wiki-tag access">CP-ABE</span> Ciphertext-Policy Attribute-Based Encryption enforces access policies like &quot;role:doctor AND dept:emergency&quot;</li>
                            <li><span className="wiki-tag integrity">SHA-256</span> End-to-end integrity hash computed before encryption, verified after decryption</li>
                        </ul>
                    </div>

                    <div className="wiki-section">
                        <h3><span className="icon">&#x1f6e3;&#xfe0f;</span> Routing Algorithms</h3>
                        <table className="wiki-table">
                            <thead>
                                <tr>
                                    <th>Algorithm</th>
                                    <th>Strategy</th>
                                    <th>Best For</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>Epidemic</strong></td>
                                    <td>Flood to all contacts</td>
                                    <td>Disaster recovery, small networks</td>
                                </tr>
                                <tr>
                                    <td><strong>PRoPHET</strong></td>
                                    <td>Probabilistic with predictability</td>
                                    <td>Recurring mobility patterns</td>
                                </tr>
                                <tr>
                                    <td><strong>Spray-and-Wait</strong></td>
                                    <td>Controlled copy replication</td>
                                    <td>Bandwidth-constrained environments</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="wiki-section">
                        <h3><span className="icon">&#x1f3ad;</span> Simulation Scenarios</h3>
                        <p>
                            The simulator includes three pre-configured scenarios that model real-world DTN deployments:
                        </p>
                        <ul>
                            <li><strong>Disaster Recovery</strong> -- Simulates node failures, intermittent links, and priority message routing in environments where infrastructure is damaged or destroyed. Uses Epidemic routing for maximum delivery probability with high message rates.</li>
                            <li><strong>Deep Space</strong> -- Models interplanetary communication with high delays (minutes to hours), rare contact opportunities between nodes, and critical data integrity requirements. Uses PRoPHET routing to leverage predictable orbital patterns.</li>
                            <li><strong>Military Tactical</strong> -- Enforces CP-ABE policy-based access control with attribute-based decryption rights (e.g., &quot;role:officer AND clearance:secret&quot). Supports secure multi-hop routing in contested environments using Spray-and-Wait to limit exposure.</li>
                        </ul>
                    </div>

                    <div className="wiki-section">
                        <h3><span className="icon">&#x1f50d;</span> Features</h3>
                        <ul>
                            <li><strong>Bundle Path Visualization</strong> -- Click any bundle in the sidebar to see its complete journey through relay nodes</li>
                            <li><strong>Message Content Inspection</strong> -- View plaintext, encrypted, and decrypted content stages</li>
                            <li><strong>Timing Waterfall</strong> -- Per-bundle breakdown of encrypt/transmit/decrypt time</li>
                            <li><strong>Crypto Key Panel</strong> -- Click any node in the graph to inspect its RSA key and CP-ABE attributes</li>
                            <li><strong>File Upload</strong> -- Upload .txt files directly as custom payloads</li>
                            <li><strong>Wireshark PCAP</strong> -- Generate BPv7 protocol captures for analysis</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
