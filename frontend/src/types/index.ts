export interface SimulationConfig {
    router: "epidemic" | "prophet" | "spray";
    nodes: number;
    duration: number;
    scenario: "disaster" | "deepspace" | "military" | "custom";
    seed: number;
    message_rate: number;
    enable_pcap: boolean;
    payload_text?: string | null;
}

export interface MetricsResponse {
    total_bundles: number;
    delivered_bundles: number;
    dropped_bundles: number;
    expired_bundles: number;
    delivery_ratio: number;
    avg_latency_seconds: number;
    bundle_drop_rate: number;
    avg_encrypt_overhead_ms: number;
    avg_decrypt_overhead_ms: number;
    total_transfers: number;
    integrity_failures: number;
    avg_transmission_time_ms: number;
    hop_count_distribution: Record<string, number>;
    router_name: string;
    duration: number;
    num_nodes: number;
}

export interface SimulationEvent {
    type: string;
    time: number;
    node_from: string;
    node_to: string;
    bundle_id: string;
    event_data: Record<string, unknown>;
}

export interface HopEntry {
    from_node: string;
    to_node: string;
    time: number;
    transmission_time_ms: number;
}

export interface BundleDetail {
    bundle_id: string;
    source: string;
    destination: string;
    creation_time: number;
    delivered: boolean;
    delivery_time: number | null;
    expired: boolean;
    dropped: boolean;
    hop_count: number;
    hop_history: HopEntry[];
    encrypt_time_ms: number;
    decrypt_time_ms: number | null;
    transmission_time_ms: number;
    payload_size_bytes: number;
    payload_hash: string;
    integrity_verified: boolean | null;
    cpabe_policy: string;
    plaintext_preview: string;
    encrypted_preview: string | null;
}

export interface NodeDetail {
    node_id: string;
    attributes: string[];
    delivered_count: number;
    buffer_count: number;
    rsa_public_key_pem: string;
}

export type InspectorTarget =
    | { type: "bundle"; id: string }
    | { type: "node"; id: string }
    | null;

export interface SimulationResult {
    metrics: MetricsResponse;
    event_log: SimulationEvent[];
    pcap_file?: string | null;
    bundle_details?: Record<string, BundleDetail>;
    node_details?: Record<string, NodeDetail>;
}

export interface ScenarioInfo {
    key: string;
    name: string;
    description: string;
}

export type SimStatus = "idle" | "running" | "done" | "error";
