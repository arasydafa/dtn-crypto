/**
 * @module types
 * @description TypeScript type definitions for the DTN Crypto Simulator frontend.
 *
 * These interfaces define the data contracts between the FastAPI backend and the
 * React frontend. They mirror the Pydantic schemas in `api/schemas.py` and are
 * used throughout the application for type-safe API communication, state management,
 * and component props.
 */

/**
 * Configuration for running a DTN simulation.
 *
 * Sent as the request body to `POST /simulate` or as the initial message
 * over the WebSocket connection at `/ws/live`.
 *
 * @example
 * ```typescript
 * const config: SimulationConfig = {
 *   router: "prophet",
 *   nodes: 15,
 *   duration: 1800,
 *   scenario: "deepspace",
 *   seed: 42,
 *   message_rate: 2.0,
 *   enable_pcap: false,
 *   priority: 1,
 * };
 * ```
 */
export interface SimulationConfig {
    /** Routing algorithm to use. `"epidemic"` floods bundles to all contacts, `"prophet"` uses probabilistic routing, `"spray"` uses binary spray-and-wait. */
    router: "epidemic" | "prophet" | "spray";

    /** Number of nodes in the network (range: 5-50). */
    nodes: number;

    /** Simulation duration in seconds (range: 60-7200). */
    duration: number;

    /** Preset scenario defining contact patterns and bandwidth. `"custom"` uses user-provided contacts/messages. */
    scenario: "disaster" | "deepspace" | "military" | "custom";

    /** Random seed for reproducible simulations. Changing this produces different network topologies and contact schedules. */
    seed: number;

    /** Average message generation rate in messages per minute. Higher rates create more bundle traffic. */
    message_rate: number;

    /** When true, generates a Wireshark-readable BPv7 PCAP file at `results/bundles.pcap`. */
    enable_pcap: boolean;

    /** Custom payload text. When set, all generated bundles use this as their payload instead of random data. */
    payload_text?: string | null;

    /** Default bundle priority (0=Bulk, 1=Normal, 2=Expedited, 3=Critical). Higher priority bundles evict lower priority ones when buffers are full. */
    priority?: number;
}

/**
 * Aggregated simulation metrics computed after the simulation completes.
 *
 * Returned in the `metrics` field of {@link SimulationResult}. These values
 * are also streamed incrementally during WebSocket simulations.
 *
 * @example
 * ```typescript
 * const ratio = metrics.delivered_bundles / metrics.total_bundles;
 * console.log(`Delivery ratio: ${(ratio * 100).toFixed(1)}%`);
 * ```
 */
export interface MetricsResponse {
    /** Total number of bundles created during the simulation. */
    total_bundles: number;

    /** Number of bundles successfully delivered to their destination. */
    delivered_bundles: number;

    /** Number of bundles dropped due to buffer overflow or max hop count exceeded. */
    dropped_bundles: number;

    /** Number of bundles that expired (TTL reached) before delivery. */
    expired_bundles: number;

    /** Delivery ratio as a fraction (0.0-1.0). Calculated as `delivered_bundles / total_bundles`. */
    delivery_ratio: number;

    /** Average end-to-end latency in seconds for delivered bundles. */
    avg_latency_seconds: number;

    /** Bundle drop rate as a fraction (0.0-1.0). Calculated as `dropped_bundles / total_bundles`. */
    bundle_drop_rate: number;

    /** Average encryption overhead in milliseconds per bundle. */
    avg_encrypt_overhead_ms: number;

    /** Average decryption overhead in milliseconds per bundle. Only counted for delivered bundles. */
    avg_decrypt_overhead_ms: number;

    /** Total number of bundle transfers between nodes. */
    total_transfers: number;

    /** Number of bundles that failed SHA-256 integrity verification at the destination. */
    integrity_failures: number;

    /** Average transmission time in milliseconds per hop, based on link bandwidth. */
    avg_transmission_time_ms: number;

    /** Distribution of hop counts across all bundles. Keys are hop counts (as strings), values are bundle counts. */
    hop_count_distribution: Record<string, number>;

    /** Name of the routing algorithm used (e.g., `"epidemic"`, `"prophet"`, `"spray"`). */
    router_name: string;

    /** Simulation duration in seconds (mirrors config). */
    duration: number;

    /** Number of nodes in the simulation (mirrors config). */
    num_nodes: number;
}

/**
 * A real-time simulation event streamed over WebSocket or included in the REST response.
 *
 * Events are processed by the frontend to animate the network graph, update metrics,
 * and populate the event log. The `type` field determines the event's meaning and
 * which fields are populated.
 *
 * @see {@link SimEventTypes} for the complete list of event types.
 */
export interface SimulationEvent {
    /** Event type identifier. Common types: `"CONTACT_START"`, `"CONTACT_END"`, `"BUNDLE_TRANSFER"`, `"BUNDLE_CREATED"`, `"BUNDLE_DELIVERED"`, `"BUNDLE_EXPIRED"`, `"NODE_UPDATE"`, `"FINAL_RESULT"`. */
    type: string;

    /** Simulation time in seconds when this event occurred. */
    time: number;

    /** Source node ID for contact/transfer events. Empty string for non-transfer events. */
    node_from: string;

    /** Destination node ID for contact/transfer events. Empty string for non-transfer events. */
    node_to: string;

    /** Bundle ID associated with this event. Empty string for contact events. */
    bundle_id: string;

    /** Additional event-specific data. Structure varies by event type (e.g., contains `duration` for CONTACT_START, `size` for BUNDLE_TRANSFER). */
    event_data: Record<string, unknown>;

    /** End-to-end latency in seconds. Only populated for DELIVERY events. */
    latency?: number;
}

/**
 * A single hop in a bundle's delivery path.
 *
 * Each hop represents a transfer from one node to another, recording the
 * simulation time and transmission duration. The collection of hops forms
 * the bundle's complete routing history.
 *
 * @example
 * ```typescript
 * // Hop from node-0 to node-3 at time 120.5s, took 81.9ms to transmit
 * const hop: HopEntry = {
 *   from_node: "node-0",
 *   to_node: "node-3",
 *   time: 120.5,
 *   transmission_time_ms: 81.9,
 * };
 * ```
 */
export interface HopEntry {
    /** Source node ID for this hop. */
    from_node: string;

    /** Destination node ID for this hop. */
    to_node: string;

    /** Simulation time in seconds when this transfer started. */
    time: number;

    /** Transmission time in milliseconds for this hop, calculated from payload size and link bandwidth. */
    transmission_time_ms: number;
}

/**
 * Complete details for a single bundle, used by the bundle inspector panel.
 *
 * Contains the bundle's metadata, delivery status, routing history,
 * cryptographic timing, and content previews at each stage (plaintext,
 * encrypted, decrypted).
 *
 * @example
 * ```typescript
 * // Access the bundle's path
 * bundle.hop_history.forEach((hop, i) => {
 *   console.log(`Hop ${i + 1}: ${hop.from_node} → ${hop.to_node} at ${hop.time}s`);
 * });
 * ```
 */
export interface BundleDetail {
    /** Unique bundle identifier (UUID format). */
    bundle_id: string;

    /** Source node ID that created this bundle. */
    source: string;

    /** Destination node ID this bundle is intended for. */
    destination: string;

    /** Simulation time in seconds when this bundle was created. */
    creation_time: number;

    /** Whether this bundle was successfully delivered to its destination. */
    delivered: boolean;

    /** Simulation time in seconds when delivered, or null if not delivered. */
    delivery_time: number | null;

    /** Whether this bundle expired (TTL reached) before delivery. */
    expired: boolean;

    /** Whether this bundle was dropped due to buffer overflow or max hops. */
    dropped: boolean;

    /** Number of hops this bundle traversed. */
    hop_count: number;

    /** Complete routing history as an ordered list of hops from source to current location. */
    hop_history: HopEntry[];

    /** Time in milliseconds spent encrypting this bundle at the source. */
    encrypt_time_ms: number;

    /** Time in milliseconds spent decrypting this bundle at the destination, or null if not delivered. */
    decrypt_time_ms: number | null;

    /** Total transmission time in milliseconds across all hops. */
    transmission_time_ms: number;

    /** Payload size in bytes. */
    payload_size_bytes: number;

    /** SHA-256 hash of the plaintext payload, computed before encryption. Used for integrity verification. */
    payload_hash: string;

    /** Whether integrity verification passed at the destination. Null if not yet delivered. */
    integrity_verified: boolean | null;

    /** CP-ABE access policy string (e.g., `"role:receiver AND clearance:top"`). */
    cpabe_policy: string;

    /** Base64-encoded plaintext preview (first 200 bytes). Only available at the source node. */
    plaintext_preview: string;

    /** Base64-encoded encrypted ciphertext preview, or null if not available. */
    encrypted_preview: string | null;
}

/**
 * Complete details for a single node, used by the node inspector modal.
 *
 * Contains the node's cryptographic credentials, buffer state,
 * delivery statistics, and scheduled contacts.
 *
 * @example
 * ```typescript
 * // Check node role from attributes
 * const role = node.attributes.find(a => a.startsWith("role:"))?.split(":")[1] ?? "unknown";
 * ```
 */
export interface NodeDetail {
    /** Node identifier (e.g., `"node-0"`, `"node-1"`). */
    node_id: string;

    /** CP-ABE attributes assigned to this node (e.g., `["role:relay", "zone:alpha"]`). */
    attributes: string[];

    /** Number of bundles delivered to this node as the final destination. */
    delivered_count: number;

    /** Number of bundles currently in this node's buffer. */
    buffer_count: number;

    /** RSA public key in PEM format (truncated preview). Used for hybrid encryption. */
    rsa_public_key_pem: string;
}

/**
 * Discriminated union type for the inspector panel target.
 *
 * Determines whether the right-side inspector panel shows bundle details
 * or node details. The `type` field acts as the discriminant.
 *
 * @example
 * ```typescript
 * const target: InspectorTarget = { type: "bundle", id: "abc-123" };
 * if (target?.type === "bundle") {
 *   // Show bundle inspector
 * }
 * ```
 */
export type InspectorTarget =
    | { type: "bundle"; id: string }
    | { type: "node"; id: string }
    | null;

/**
 * Complete simulation result returned by `POST /simulate` or sent as the
 * final WebSocket message (`FINAL_RESULT` event).
 *
 * Contains all data needed to populate the dashboard: metrics, event log,
 * bundle details, and node details.
 */
export interface SimulationResult {
    /** Aggregated simulation metrics. */
    metrics: MetricsResponse;

    /** Chronological list of all simulation events. */
    event_log: SimulationEvent[];

    /** Path to the generated PCAP file, or null if PCAP was not enabled. */
    pcap_file?: string | null;

    /** Map of bundle IDs to their detailed information. Only populated when using WebSocket mode. */
    bundle_details?: Record<string, BundleDetail>;

    /** Map of node IDs to their detailed information. Only populated when using WebSocket mode. */
    node_details?: Record<string, NodeDetail>;
}

/**
 * Metadata for a preset simulation scenario.
 *
 * Returned by `GET /scenarios`. Used to populate the scenario selection
 * buttons in the sidebar.
 */
export interface ScenarioInfo {
    /** Unique scenario key (e.g., `"deepspace"`, `"disaster"`, `"military"`). */
    key: string;

    /** Human-readable scenario name (e.g., `"Deep Space"`, `"Disaster Relief"`). */
    name: string;

    /** Brief description of the scenario's use case and characteristics. */
    description: string;
}

/**
 * Simulation lifecycle state.
 *
 * Controls UI behavior: which buttons are enabled, whether to show
 * loading indicators, and whether results are available.
 *
 * - `"idle"` — No simulation running. Config panel is editable.
 * - `"running"` — Simulation in progress. Config panel is locked, events are streaming.
 * - `"done"` — Simulation completed. Results and metrics are available.
 * - `"error"` — Simulation failed. Error message is displayed.
 */
export type SimStatus = "idle" | "running" | "done" | "error";
