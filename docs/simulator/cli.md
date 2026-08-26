# CLI Usage

## Basic Commands

```bash
# Run single simulation with Epidemic routing
python run_simulation.py --router epidemic --nodes 10 --duration 3600

# Run with PRoPHET routing in deep space scenario
python run_simulation.py --router prophet --scenario deepspace --nodes 20

# Spray-and-Wait with military scenario
python run_simulation.py --router spray --scenario military --nodes 15

# Compare all 3 routers side by side
python run_simulation.py --compare --scenario disaster --nodes 15
```

## Custom Configuration

```bash
# Use a custom JSON configuration
python run_simulation.py --config scenarios/custom.json
```

## PCAP Capture

```bash
# Enable PCAP capture for Wireshark
python run_simulation.py --router epidemic --nodes 10 --pcap

# Enable live UDP for real-time Wireshark capture
python run_simulation.py --router epidemic --nodes 10 --pcap --live-udp
```

## Custom Payloads

```bash
# Run with a custom text payload
python run_simulation.py --router epidemic --nodes 10 --payload-text "Hello DTN!"

# Run with a custom file payload (.txt, max 1MB)
python run_simulation.py --router epidemic --nodes 10 --payload-file message.txt
```

## CLI Flags

| Flag | Type | Default | Description |
|---|---|---|---|
| `--router` | string | `epidemic` | Routing algorithm (epidemic, prophet, spray) |
| `--nodes` | int | `10` | Number of nodes |
| `--duration` | int | `3600` | Simulation duration in seconds |
| `--scenario` | string | `disaster` | Preset scenario |
| `--seed` | int | `42` | Random seed |
| `--compare` | flag | `false` | Compare all routers side by side |
| `--pcap` | flag | `false` | Generate PCAP file |
| `--live-udp` | flag | `false` | Enable live UDP packets |
| `--payload-text` | string | `""` | Custom payload text |
| `--payload-file` | string | `""` | Custom payload file path |
| `--config` | string | `""` | Custom JSON config file |
