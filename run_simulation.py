# run_simulation.py — CLI entry point for the DTN Crypto Simulator.
# Purpose: Provides command-line interface to run DTN simulations with
#          configurable routing algorithms, scenarios, and parameters.
# Dependencies: simulator, dtn_crypto
# Usage:
#   python run_simulation.py --router epidemic --nodes 10 --duration 3600
#   python run_simulation.py --scenario deepspace --compare
#   python run_simulation.py --config path/to/config.json

"""CLI entry point for the DTN Crypto Simulator.

Run DTN network simulations with hybrid RSA-AES + CP-ABE encryption
using interchangeable routing algorithms.
"""

from __future__ import annotations

import argparse
import os
import sys

from simulator.engine import SimulationEngine, create_router
from simulator.metrics import (
    SimulationMetrics,
    export_comparison_csv,
    print_comparison_table,
)
from simulator.scenarios import load_custom_config


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments.

    Args:
        argv: Argument list (defaults to sys.argv[1:]).

    Returns:
        Parsed arguments namespace.
    """
    parser = argparse.ArgumentParser(
        prog="run_simulation",
        description=(
            "DTN Crypto Simulator — Simulate Delay-Tolerant Network "
            "communication with hybrid RSA-AES + CP-ABE encryption."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python run_simulation.py --router epidemic --nodes 10 --duration 3600\n"
            "  python run_simulation.py --scenario deepspace --router prophet\n"
            "  python run_simulation.py --compare --scenario disaster --nodes 15\n"
            "  python run_simulation.py --config scenarios/custom.json\n"
        ),
    )

    parser.add_argument(
        "--router",
        type=str,
        choices=["epidemic", "prophet", "spray"],
        default="epidemic",
        help="Routing algorithm to use (default: epidemic)",
    )
    parser.add_argument(
        "--nodes",
        type=int,
        default=10,
        help="Number of network nodes (default: 10)",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=3600,
        help="Simulation duration in seconds (default: 3600)",
    )
    parser.add_argument(
        "--scenario",
        type=str,
        choices=["deepspace", "disaster", "military", "custom"],
        default="disaster",
        help="Preset scenario configuration (default: disaster)",
    )
    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Path to custom JSON configuration file",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="./results/",
        help="Output directory for results (default: ./results/)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42)",
    )
    parser.add_argument(
        "--message-rate",
        type=float,
        default=1.0,
        help="Message generation rate in messages/minute (default: 1.0)",
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Run all 3 routers and output comparison table",
    )
    parser.add_argument(
        "--pcap",
        action="store_true",
        help="Enable PCAP capture of BPv7 bundle protocol frames for Wireshark",
    )
    parser.add_argument(
        "--live-udp",
        action="store_true",
        help="Send live UDP packets on localhost (requires --pcap) for real-time Wireshark capture",
    )
    parser.add_argument(
        "--payload-file",
        type=str,
        default=None,
        help="Path to .txt file to use as payload for all bundles (max 1MB)",
    )
    parser.add_argument(
        "--payload-text",
        type=str,
        default=None,
        help="Custom text string to use as payload for all bundles",
    )

    return parser.parse_args(argv)


_MAX_PAYLOAD_SIZE = 1_048_576  # 1 MB


def _load_custom_payload(args: argparse.Namespace) -> bytes | None:
    """Load and validate custom payload from CLI args.

    Args:
        args: Parsed command-line arguments.

    Returns:
        Payload bytes, or None if not specified.

    Raises:
        SystemExit: On validation failure.
    """
    if args.payload_file and args.payload_text:
        print("Error: --payload-file and --payload-text are mutually exclusive.",
              file=sys.stderr)
        sys.exit(1)

    if args.payload_text:
        payload = args.payload_text.encode("utf-8")
        if len(payload) > _MAX_PAYLOAD_SIZE:
            print(f"Error: payload text exceeds 1MB limit ({len(payload)} bytes).",
                  file=sys.stderr)
            sys.exit(1)
        return payload

    if args.payload_file:
        path = args.payload_file
        if not os.path.isfile(path):
            print(f"Error: file not found: {path}", file=sys.stderr)
            sys.exit(1)
        if not path.lower().endswith(".txt"):
            print("Error: --payload-file only accepts .txt files.", file=sys.stderr)
            sys.exit(1)
        with open(path, "rb") as f:
            payload = f.read()
        if len(payload) > _MAX_PAYLOAD_SIZE:
            print(f"Error: file exceeds 1MB limit ({len(payload)} bytes).",
                  file=sys.stderr)
            sys.exit(1)
        return payload

    return None


def run_single(args: argparse.Namespace) -> SimulationMetrics:
    """Run a single simulation with the specified configuration.

    Args:
        args: Parsed command-line arguments.

    Returns:
        Computed simulation metrics.
    """
    # Load config
    config = None
    if args.config:
        config = load_custom_config(args.config)

    custom_payload = _load_custom_payload(args)
    router = create_router(args.router)

    engine = SimulationEngine(
        router=router,
        num_nodes=args.nodes,
        duration=args.duration,
        scenario=args.scenario,
        seed=args.seed,
        message_rate=args.message_rate,
        config=config,
        output_path=args.output,
        enable_pcap=args.pcap,
        live_udp=args.live_udp,
        custom_payload=custom_payload,
    )

    return engine.run()


def run_comparison(args: argparse.Namespace) -> list[SimulationMetrics]:
    """Run all 3 routers and collect comparison metrics.

    Args:
        args: Parsed command-line arguments.

    Returns:
        List of metrics from all 3 router runs.
    """
    all_metrics: list[SimulationMetrics] = []
    router_names = ["epidemic", "prophet", "spray"]

    config = None
    if args.config:
        config = load_custom_config(args.config)

    custom_payload = _load_custom_payload(args)

    for router_name in router_names:
        router = create_router(router_name)

        engine = SimulationEngine(
            router=router,
            num_nodes=args.nodes,
            duration=args.duration,
            scenario=args.scenario,
            seed=args.seed,
            message_rate=args.message_rate,
            config=config,
            output_path=args.output,
            custom_payload=custom_payload,
        )

        metrics = engine.run()
        all_metrics.append(metrics)

    # Print comparison table
    print_comparison_table(all_metrics)

    # Export comparison CSV
    export_comparison_csv(all_metrics, args.output)

    return all_metrics


def main(argv: list[str] | None = None) -> int:
    """Main entry point.

    Args:
        argv: Argument list (defaults to sys.argv[1:]).

    Returns:
        Exit code (0 for success).
    """
    args = parse_args(argv)

    try:
        if args.compare:
            run_comparison(args)
        else:
            run_single(args)
    except KeyboardInterrupt:
        print("\nSimulation interrupted by user.")
        return 1
    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
