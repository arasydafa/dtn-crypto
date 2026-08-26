# API Schemas

::: api.schemas
    options:
      show_source: false
      members: false

## SimulationConfig

Configuration for running a DTN simulation.

| Field | Type | Default | Description |
|---|---|---|---|
| `router` | string | `"epidemic"` | Routing algorithm: epidemic, prophet, spray |
| `nodes` | int | `10` | Number of nodes (5-50) |
| `duration` | int | `3600` | Simulation duration in seconds |
| `scenario` | string | `"disaster"` | Preset scenario |
| `seed` | int | `42` | Random seed |
| `message_rate` | float | `1.0` | Messages per minute |
| `enable_pcap` | bool | `false` | Enable PCAP capture |
| `priority` | int | `1` | Default bundle priority (0-3) |

## SimulationResult

Complete simulation output returned by `POST /simulate` or the `FINAL_RESULT` WebSocket message.

| Field | Type | Description |
|---|---|---|
| `metrics` | MetricsResponse | Aggregated metrics |
| `event_log` | SimulationEvent[] | All simulation events |
| `bundle_details` | dict | Bundle ID → BundleDetail |
| `node_details` | dict | Node ID → NodeDetail |

## MetricsResponse

| Field | Type | Description |
|---|---|---|
| `total_bundles` | int | Bundles created |
| `delivered_bundles` | int | Bundles delivered |
| `dropped_bundles` | int | Bundles dropped |
| `expired_bundles` | int | Bundles expired |
| `delivery_ratio` | float | Delivery ratio (0.0-1.0) |
| `avg_latency_seconds` | float | Average latency in seconds |
| `avg_encrypt_overhead_ms` | float | Average encrypt time |
| `avg_decrypt_overhead_ms` | float | Average decrypt time |
| `avg_transmission_time_ms` | float | Average transmission time |
| `total_transfers` | int | Total bundle transfers |
| `integrity_failures` | int | Integrity check failures |

## BundleDetail

| Field | Type | Description |
|---|---|---|
| `bundle_id` | string | Unique identifier |
| `source` | string | Source node ID |
| `destination` | string | Destination node ID |
| `hop_count` | int | Hops traversed |
| `priority` | int | Bundle priority (0-3) |
| `remaining_hops` | int | Remaining hops before drop |
| `hop_history` | HopEntry[] | Complete routing path |
| `encrypt_time_ms` | float | Encryption time |
| `decrypt_time_ms` | float? | Decryption time |
| `transmission_time_ms` | float | Total transmission time |
| `plaintext_preview` | string | Base64 plaintext preview |
| `encrypted_preview` | string? | Base64 ciphertext preview |
| `integrity_verified` | bool? | Integrity check result |
| `cpabe_policy` | string | CP-ABE policy string |

## NodeDetail

| Field | Type | Description |
|---|---|---|
| `node_id` | string | Node identifier |
| `role` | string | Node role (derived from attributes) |
| `status` | string | Current status |
| `attributes` | string[] | CP-ABE attributes |
| `rsa_public_key_pem` | string | RSA public key PEM |
| `buffer_size` | int | Bundles in buffer |
| `buffer_utilization` | float | Buffer usage (0.0-1.0) |
| `total_forwarded` | int | Bundles forwarded |
| `total_dropped` | int | Bundles dropped |
| `total_expired` | int | Bundles expired |
| `contact_count` | int | Scheduled contacts |
| `next_contact_time` | float? | Next contact time |
| `next_contact_peer` | string? | Next contact peer |
| `routing_state` | object | Router-specific state |
| `buffer_bundles` | BufferBundleSummary[] | Bundles in buffer |

## BufferBundleSummary

| Field | Type | Description |
|---|---|---|
| `bundle_id` | string | Bundle identifier |
| `source` | string | Source node |
| `destination` | string | Destination node |
| `size` | int | Payload size in bytes |
| `priority` | int | Priority level (0-3) |
| `hop_count` | int | Current hop count |
