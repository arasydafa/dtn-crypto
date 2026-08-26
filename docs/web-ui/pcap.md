# PCAP Capture

The simulator generates Wireshark-readable PCAP files containing BPv7 (Bundle Protocol version 7) encoded frames per RFC 9171.

## Generating a PCAP File

```bash
# Via CLI
python run_simulation.py --router epidemic --nodes 10 --pcap

# Output: results/bundles.pcap
```

## Real-time Wireshark Capture

```bash
# Start simulation with live UDP packets
python run_simulation.py --router epidemic --nodes 10 --pcap --live-udp

# In Wireshark: capture on loopback interface, filter: udp.port == 4556
```

## Viewing in Wireshark

1. Open the generated `.pcap` file in Wireshark
2. Right-click any UDP packet → **Decode As** → select **BPv7**
   (or set UDP port 4556 to decode as BPv7 in Edit → Preferences → Protocols → BPv7)
3. Expand the **"Bundle Protocol Version 7"** tree to inspect:
   - Bundle version (7)
   - Bundle processing control flags
   - Source / Destination endpoint IDs (`dtn://nodeX/`)
   - Creation timestamp and sequence number
   - Bundle lifetime
   - Payload block content
4. Each frame represents one bundle transfer between nodes during the simulation

## PCAP Technical Details

| Property | Value |
|---|---|
| **Protocol** | BPv7 over UDP port 4556 |
| **Encoding** | CBOR (RFC 8949) as specified by RFC 9171 |
| **Frame structure** | Ethernet II → IPv4 → UDP → BPv7 CBOR bundle |
| **Node addressing** | Deterministic IP (10.0.X.X) and MAC mapping per node |
| **Endpoint IDs** | DTN scheme URIs (`dtn://node-X/`) |

## Enabling via Web UI

In the web dashboard, PCAP capture is controlled by the `enable_pcap` field in `SimulationConfig`. When enabled, the PCAP file path is returned in the `SimulationResult.pcap_file` field.
