/**
 * @module components/WikiModal
 * @description DTN Crypto wiki — OmegaOS phase 2.
 *
 * Content renders through @omega-os/ui Markdown (GFM tables included)
 * inside a Modal. Section icons are lucide-only, no emoji.
 */

import { Modal, Markdown } from "@omega-os/ui";
import { BookOpen } from "lucide-react";

/** Props for the WikiModal component. */
interface Props {
  /** Callback to close the wiki modal. */
  onClose: () => void;
}

const WIKI_MD = `## What is DTN?

**Delay-Tolerant Networking (DTN)** is a network architecture designed for environments
where continuous end-to-end connectivity cannot be guaranteed. DTN uses a "store-carry-forward"
paradigm where intermediate nodes buffer data bundles and forward them when contact opportunities arise.

DTN is used in:

- Interplanetary communication (Mars rovers, deep space probes)
- Disaster recovery networks where infrastructure is damaged
- Military tactical networks in contested environments
- Remote sensor networks and wildlife monitoring

## Hybrid Encryption

This simulator uses a **dual-layer encryption** approach for maximum security:

| Layer | Technology | Purpose |
| ----- | ---------- | ------- |
| Outer | RSA-OAEP + AES-256-GCM | Confidentiality — only destination can decrypt |
| Inner | CP-ABE (Attribute-Based) | Access control — policy-based decryption |

## Bundle Structure

Every DTN bundle contains encrypted payload plus metadata including
source, destination, TTL, priority, hop count, and integrity hash.

- \`RSA-AES\` — RSA-OAEP wraps an ephemeral AES-256 session key, which encrypts the inner layer
- \`CP-ABE\` — Ciphertext-Policy Attribute-Based Encryption enforces access policies like \`role:doctor AND dept:emergency\`
- \`SHA-256\` — End-to-end integrity hash computed before encryption, verified after decryption

## Routing Algorithms

| Algorithm | Strategy | Best For |
| --------- | -------- | -------- |
| **Epidemic** | Flood to all contacts | Disaster recovery, small networks |
| **PRoPHET** | Probabilistic with predictability | Recurring mobility patterns |
| **Spray-and-Wait** | Controlled copy replication | Bandwidth-constrained environments |

## Simulation Scenarios

The simulator includes three pre-configured scenarios that model real-world DTN deployments:

- **Disaster Recovery** — Simulates node failures, intermittent links, and priority message routing in environments where infrastructure is damaged or destroyed. Uses Epidemic routing for maximum delivery probability with high message rates.
- **Deep Space** — Models interplanetary communication with high delays (minutes to hours), rare contact opportunities between nodes, and critical data integrity requirements. Uses PRoPHET routing to leverage predictable orbital patterns.
- **Military Tactical** — Enforces CP-ABE policy-based access control with attribute-based decryption rights (e.g. \`role:officer AND clearance:secret\`). Supports secure multi-hop routing in contested environments using Spray-and-Wait to limit exposure.

## Features

- **Bundle Path Visualization** — Click any bundle in the sidebar to see its complete journey through relay nodes
- **Message Content Inspection** — View plaintext, encrypted, and decrypted content stages
- **Timing Waterfall** — Per-bundle breakdown of encrypt/transmit/decrypt time
- **Crypto Key Panel** — Click any node in the graph to inspect its RSA key and CP-ABE attributes
- **File Upload** — Upload .txt files directly as custom payloads
- **Wireshark PCAP** — Generate BPv7 protocol captures for analysis
`;

/**
 * Wiki documentation modal.
 */
export default function WikiModal({ onClose }: Props) {
    return (
        <Modal
            open
            onClose={onClose}
            title="DTN Crypto Wiki"
            icon={<BookOpen size={16} aria-hidden className="text-ot-muted" />}
        >
            <div className="max-h-[70vh] overflow-y-auto pr-1">
                <Markdown source={WIKI_MD} />
            </div>
        </Modal>
    );
}
