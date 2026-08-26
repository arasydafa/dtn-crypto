# Inspector

The inspector system provides detailed views of individual bundles and nodes.

## Node Inspector Modal

Click any node in the network graph to open the full-screen 4-tab modal.

### Overview Tab

- **Role badge** — Derived from attributes (e.g., "relay", "sender", "receiver")
- **Status indicator** — Current node state (idle, transmitting, receiving)
- **Attributes** — CP-ABE attributes as colored chips
- **RSA public key** — PEM format preview
- **Statistics grid** — Bundles created, delivered, forwarded, dropped, expired
- **Buffer utilization** — Visual bar showing buffer usage
- **Next contact** — Time and peer for next scheduled contact

### Buffer Tab

Lists all bundles currently in the node's buffer:

- Bundle ID
- Source → Destination
- Payload size
- Priority level (0-3)
- Hop count
- Click to open bundle inspector

### Routing Tab

Router-specific state visualization:

**PRoPHET Router:**
- Per-destination predictability values as horizontal bars
- Encounter history and aging

**Spray-and-Wait Router:**
- Token distribution per bundle
- Number of remaining copies

**Epidemic Router:**
- Buffer statistics
- Total forwarded/dropped counts

### Contacts Tab

Visualizes the node's contact schedule as a timeline:

- Contact pairs (node A ↔ node B)
- Start and end times
- Duration of each contact
- Color-coded by activity

## Bundle Inspector

Select a bundle from the sidebar list to open the right-side InspectorPanel.

### Header

- Status badge (Delivered/Dropped/Expired/In Transit)
- Source → Destination
- Creation time, delivery time
- Hop count, payload size

### Bundle Path

Hop-by-hop timeline showing:

- Transfer from → to
- Simulation time
- Transmission time per hop

### Timing Breakdown

Horizontal stacked bar chart showing:

- **Encrypt** (blue) — Time to encrypt at source
- **Transmit** (orange) — Total transmission time across all hops
- **Decrypt** (green) — Time to decrypt at destination

### Content Stages

Three collapsible accordion sections:

1. **Plaintext (Source)** — Original payload text
2. **Encrypted (Transit)** — Ciphertext preview, SHA-256 hash, CP-ABE policy
3. **Decrypted (Destination)** — Integrity verification status, decrypted payload
