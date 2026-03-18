# simulator/pcap_logger.py — PCAP file writer with BPv7 bundle protocol frames.
# Purpose: Generates Wireshark-readable PCAP files containing BPv7-encoded
#          bundle protocol frames over UDP, enabling visual inspection of DTN
#          bundle transfers during simulation.
# Dependencies: struct, socket (stdlib only)
# Usage:
#   logger = PcapBundleLogger("output.pcap")
#   logger.log_bundle_transfer("node-0", "node-1", bundle, sim_time=100.5)
#   logger.close()

"""PCAP file writer for BPv7 Bundle Protocol frames.

Generates standard PCAP files that Wireshark can open and dissect as
Bundle Protocol version 7 (RFC 9171). Each bundle transfer in the
simulation is recorded as an Ethernet/IP/UDP/BPv7 frame.

To view in Wireshark:
1. Open the .pcap file
2. Right-click any UDP packet -> Decode As -> BPv7
   (or set UDP port 4556 to decode as BPv7 in preferences)
3. Expand the "Bundle Protocol Version 7" tree to see bundle fields

Optionally, the logger can also send live UDP packets on localhost so
Wireshark can capture in real-time during simulation.
"""

from __future__ import annotations

import socket
import struct
import time
from typing import Any

# ---------- Minimal CBOR encoder (subset needed for BPv7) ----------


def _cbor_uint(value: int, major: int = 0) -> bytes:
    """Encode a CBOR unsigned integer with the given major type.

    Args:
        value: Non-negative integer to encode.
        major: CBOR major type (0-7), shifted into high 3 bits.

    Returns:
        CBOR-encoded bytes.
    """
    major_byte = major << 5
    if value < 24:
        return bytes([major_byte | value])
    elif value < 256:
        return bytes([major_byte | 24, value])
    elif value < 65536:
        return bytes([major_byte | 25]) + value.to_bytes(2, "big")
    elif value < 2**32:
        return bytes([major_byte | 26]) + value.to_bytes(4, "big")
    else:
        return bytes([major_byte | 27]) + value.to_bytes(8, "big")


def _cbor_encode_uint(value: int) -> bytes:
    """Encode CBOR major type 0: unsigned integer."""
    return _cbor_uint(value, major=0)


def _cbor_encode_bstr(data: bytes) -> bytes:
    """Encode CBOR major type 2: byte string."""
    return _cbor_uint(len(data), major=2) + data


def _cbor_encode_tstr(text: str) -> bytes:
    """Encode CBOR major type 3: text string."""
    encoded = text.encode("utf-8")
    return _cbor_uint(len(encoded), major=3) + encoded


def _cbor_encode_array(items: list[bytes]) -> bytes:
    """Encode CBOR major type 4: definite-length array."""
    result = _cbor_uint(len(items), major=4)
    for item in items:
        result += item
    return result


def _cbor_indef_array_start() -> bytes:
    """CBOR indefinite-length array start marker (0x9F)."""
    return b"\x9f"


def _cbor_break() -> bytes:
    """CBOR break code to end indefinite-length items (0xFF)."""
    return b"\xff"


# ---------- BPv7 Bundle Encoding (RFC 9171) ----------

# DTN_EPOCH is 2000-01-01T00:00:00Z in Unix time
_DTN_EPOCH = 946684800


def _encode_eid_dtn(node_name: str) -> bytes:
    """Encode a DTN Endpoint ID as CBOR.

    Format: [1, "//node-name/"] for dtn scheme (scheme code 1).
    dtn:none is encoded as [1, 0].

    Args:
        node_name: The node name (e.g., "node-0").

    Returns:
        CBOR-encoded EID array.
    """
    if not node_name:
        # dtn:none
        return _cbor_encode_array([_cbor_encode_uint(1), _cbor_encode_uint(0)])
    ssp = f"//{node_name}/"
    return _cbor_encode_array([_cbor_encode_uint(1), _cbor_encode_tstr(ssp)])


def encode_bpv7_bundle(
    source: str,
    destination: str,
    payload: bytes,
    creation_time: float = 0.0,
    sequence: int = 0,
    lifetime_ms: int = 3600000,
    bundle_flags: int = 0,
    bundle_id: str = "",
) -> bytes:
    """Encode a BPv7 bundle as CBOR (RFC 9171).

    Creates a valid BPv7 bundle with primary block and payload block
    that Wireshark's BPv7 dissector can parse.

    Args:
        source: Source node name for the EID.
        destination: Destination node name for the EID.
        payload: Bundle payload bytes.
        creation_time: Unix timestamp of creation (converted to DTN time).
        sequence: Sequence number for the creation timestamp.
        lifetime_ms: Bundle lifetime in milliseconds.
        bundle_flags: Bundle processing control flags.
        bundle_id: Optional bundle ID to embed in payload.

    Returns:
        CBOR-encoded BPv7 bundle bytes.
    """
    # Convert Unix time to DTN time (seconds since 2000-01-01)
    dtn_time = max(0, int(creation_time - _DTN_EPOCH))

    # Primary Block: [version, flags, crc_type, dest, source, report_to, timestamp, lifetime]
    primary_block = _cbor_encode_array([
        _cbor_encode_uint(7),                          # version = 7
        # bundle processing flags
        _cbor_encode_uint(bundle_flags),
        _cbor_encode_uint(0),                          # CRC type = none
        _encode_eid_dtn(destination),                  # destination EID
        _encode_eid_dtn(source),                       # source EID
        # report-to EID (same as source)
        _encode_eid_dtn(source),
        _cbor_encode_array([                           # creation timestamp
            _cbor_encode_uint(dtn_time),
            _cbor_encode_uint(sequence),
        ]),
        _cbor_encode_uint(lifetime_ms),                # lifetime in ms
    ])

    # Annotate payload with bundle_id if provided
    if bundle_id:
        full_payload = f"[{bundle_id}] ".encode() + payload
    else:
        full_payload = payload

    # Payload Block: [block_type=1, block_num=1, flags=0, crc_type=0, data]
    payload_block = _cbor_encode_array([
        _cbor_encode_uint(1),                          # block type = payload
        _cbor_encode_uint(1),                          # block number
        _cbor_encode_uint(0),                          # block processing flags
        _cbor_encode_uint(0),                          # CRC type = none
        _cbor_encode_bstr(full_payload),               # payload data
    ])

    # Bundle = indefinite-length CBOR array [ primary_block, payload_block, break ]
    bundle = _cbor_indef_array_start() + primary_block + \
        payload_block + _cbor_break()
    return bundle


# ---------- Network Frame Construction ----------

def _build_ethernet_header(src_mac: bytes, dst_mac: bytes, ethertype: int = 0x0800) -> bytes:
    """Build an Ethernet II frame header.

    Args:
        src_mac: Source MAC address (6 bytes).
        dst_mac: Destination MAC address (6 bytes).
        ethertype: EtherType field (default 0x0800 = IPv4).

    Returns:
        14-byte Ethernet header.
    """
    return dst_mac + src_mac + struct.pack("!H", ethertype)


def _build_ip_header(
    src_ip: str,
    dst_ip: str,
    payload_length: int,
    protocol: int = 17,  # UDP
) -> bytes:
    """Build a minimal IPv4 header (no options).

    Args:
        src_ip: Source IPv4 address string.
        dst_ip: Destination IPv4 address string.
        payload_length: Length of the IP payload (UDP header + data).
        protocol: IP protocol number (17 = UDP).

    Returns:
        20-byte IPv4 header with correct checksum.
    """
    version_ihl = (4 << 4) | 5  # IPv4, 5 32-bit words (no options)
    total_length = 20 + payload_length
    identification = 0
    flags_offset = 0x4000  # Don't Fragment
    ttl = 64

    # Pack header without checksum
    header = struct.pack(
        "!BBHHHBBH4s4s",
        version_ihl,
        0,  # DSCP/ECN
        total_length,
        identification,
        flags_offset,
        ttl,
        protocol,
        0,  # checksum placeholder
        socket.inet_aton(src_ip),
        socket.inet_aton(dst_ip),
    )

    # Compute IP header checksum
    checksum = _ip_checksum(header)
    header = header[:10] + struct.pack("!H", checksum) + header[12:]
    return header


def _ip_checksum(header: bytes) -> int:
    """Compute the IP header checksum.

    Args:
        header: Raw IP header bytes.

    Returns:
        16-bit checksum value.
    """
    if len(header) % 2 == 1:
        header += b"\x00"
    total = 0
    for i in range(0, len(header), 2):
        word = (header[i] << 8) + header[i + 1]
        total += word
    total = (total >> 16) + (total & 0xFFFF)
    total += total >> 16
    return ~total & 0xFFFF


def _build_udp_header(src_port: int, dst_port: int, payload_length: int) -> bytes:
    """Build a UDP header.

    Args:
        src_port: Source UDP port.
        dst_port: Destination UDP port.
        payload_length: Length of the UDP payload.

    Returns:
        8-byte UDP header (checksum set to 0 = disabled for IPv4).
    """
    udp_length = 8 + payload_length
    return struct.pack("!HHHH", src_port, dst_port, udp_length, 0)


def _node_to_ip(node_id: str) -> str:
    """Map a node ID to a deterministic IPv4 address.

    Args:
        node_id: Node identifier (e.g., "node-3").

    Returns:
        IPv4 address string (e.g., "10.0.0.4").
    """
    try:
        num = int(node_id.split("-")[-1])
    except (ValueError, IndexError):
        num = hash(node_id) % 254
    return f"10.0.0.{(num % 254) + 1}"


def _node_to_mac(node_id: str) -> bytes:
    """Map a node ID to a deterministic MAC address.

    Args:
        node_id: Node identifier.

    Returns:
        6-byte MAC address.
    """
    try:
        num = int(node_id.split("-")[-1])
    except (ValueError, IndexError):
        num = hash(node_id) % 254
    return bytes([0x02, 0x00, 0x00, 0x00, 0x00, (num % 254) + 1])


# ---------- PCAP File Writer ----------

# PCAP global header constants
_PCAP_MAGIC = 0xA1B2C3D4
_PCAP_VERSION_MAJOR = 2
_PCAP_VERSION_MINOR = 4
_PCAP_SNAPLEN = 65535
_PCAP_LINKTYPE_ETHERNET = 1

# Bundle Protocol UDP port
BUNDLE_PROTOCOL_PORT = 4556


class PcapBundleLogger:
    """Writes BPv7 bundle protocol frames to a PCAP file.

    Each bundle transfer in the simulation is recorded as a full
    Ethernet/IPv4/UDP/BPv7 frame that Wireshark can dissect.

    Optionally sends live UDP packets on localhost for real-time capture.

    Args:
        pcap_path: File path for the output PCAP file.
        live_udp: If True, also send live UDP packets on localhost.
        live_port: UDP port for live packets (default 4556).

    Example:
        >>> logger = PcapBundleLogger("sim_capture.pcap")
        >>> logger.log_bundle_transfer("node-0", "node-1", bundle_data, sim_time=100.0)
        >>> logger.close()
    """

    def __init__(
        self,
        pcap_path: str,
        live_udp: bool = False,
        live_port: int = BUNDLE_PROTOCOL_PORT,
    ) -> None:
        """Initialize the PCAP logger.

        Args:
            pcap_path: Output PCAP file path.
            live_udp: Whether to also send live UDP packets.
            live_port: Port for live UDP packets.
        """
        self._pcap_path = pcap_path
        self._live_udp = live_udp
        self._live_port = live_port
        self._packet_count = 0
        self._sequence = 0

        # Open PCAP file and write global header
        self._file = open(pcap_path, "wb")
        self._write_pcap_global_header()

        # Set up live UDP socket if requested
        self._udp_sock: socket.socket | None = None
        if live_udp:
            self._udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    def _write_pcap_global_header(self) -> None:
        """Write the PCAP global header (24 bytes)."""
        header = struct.pack(
            "<IHHiIII",
            _PCAP_MAGIC,
            _PCAP_VERSION_MAJOR,
            _PCAP_VERSION_MINOR,
            0,  # timezone offset
            0,  # timestamp accuracy
            _PCAP_SNAPLEN,
            _PCAP_LINKTYPE_ETHERNET,
        )
        self._file.write(header)

    def _write_pcap_packet(self, frame: bytes, timestamp: float) -> None:
        """Write a single packet record to the PCAP file.

        Args:
            frame: Complete Ethernet frame bytes.
            timestamp: Packet timestamp (Unix epoch float).
        """
        ts_sec = int(timestamp)
        ts_usec = int((timestamp - ts_sec) * 1_000_000)
        cap_len = len(frame)

        # PCAP packet header: ts_sec, ts_usec, cap_len, orig_len
        pkt_header = struct.pack("<IIII", ts_sec, ts_usec, cap_len, cap_len)
        self._file.write(pkt_header)
        self._file.write(frame)
        self._packet_count += 1

    def log_bundle_transfer(
        self,
        from_node: str,
        to_node: str,
        bundle_payload: bytes,
        sim_time: float,
        bundle_id: str = "",
        source: str = "",
        destination: str = "",
        creation_time: float = 0.0,
        ttl: int = 3600,
        bundle_flags: int = 0,
    ) -> None:
        """Log a bundle transfer as a PCAP packet.

        Encodes the transfer as Ethernet/IPv4/UDP/BPv7 and writes it
        to the PCAP file. Optionally sends a live UDP packet.

        Args:
            from_node: Sending node ID.
            to_node: Receiving node ID.
            bundle_payload: The bundle payload bytes.
            sim_time: Simulation timestamp (used as packet timestamp).
            bundle_id: Bundle identifier for annotation.
            source: Original source node of the bundle.
            destination: Final destination node of the bundle.
            creation_time: Bundle creation timestamp.
            ttl: Bundle TTL in seconds.
            bundle_flags: BPv7 bundle processing flags.
        """
        self._sequence += 1

        # Encode BPv7 bundle
        bpv7_data = encode_bpv7_bundle(
            source=source or from_node,
            destination=destination or to_node,
            payload=bundle_payload,
            creation_time=creation_time or sim_time,
            sequence=self._sequence,
            lifetime_ms=ttl * 1000,
            bundle_flags=bundle_flags,
            bundle_id=bundle_id,
        )

        # Build UDP segment
        udp_header = _build_udp_header(
            src_port=BUNDLE_PROTOCOL_PORT,
            dst_port=BUNDLE_PROTOCOL_PORT,
            payload_length=len(bpv7_data),
        )

        # Build IP packet
        ip_payload = udp_header + bpv7_data
        ip_header = _build_ip_header(
            src_ip=_node_to_ip(from_node),
            dst_ip=_node_to_ip(to_node),
            payload_length=len(ip_payload),
        )

        # Build Ethernet frame
        eth_header = _build_ethernet_header(
            src_mac=_node_to_mac(from_node),
            dst_mac=_node_to_mac(to_node),
        )

        frame = eth_header + ip_header + ip_payload

        # Use wall-clock base time + sim_time offset for realistic timestamps
        # Anchor at current wall time if creation_time is sim-relative
        packet_ts = time.time() - 3600 + sim_time  # sim starts "1 hour ago"
        if sim_time == 0.0:
            packet_ts = time.time()

        self._write_pcap_packet(frame, packet_ts)

        # Send live UDP if enabled
        if self._udp_sock is not None:
            try:
                self._udp_sock.sendto(
                    bpv7_data, ("127.0.0.1", self._live_port)
                )
            except OSError:
                pass  # Non-critical: live capture is best-effort

    def log_bundle_creation(
        self,
        source: str,
        destination: str,
        bundle_payload: bytes,
        sim_time: float,
        bundle_id: str = "",
        ttl: int = 3600,
    ) -> None:
        """Log a bundle creation event as a PCAP packet.

        The bundle appears as a packet from the source to itself,
        representing the initial creation.

        Args:
            source: Source node ID.
            destination: Final destination node ID.
            bundle_payload: Bundle payload bytes.
            sim_time: Simulation timestamp.
            bundle_id: Bundle identifier.
            ttl: Bundle TTL in seconds.
        """
        # Bundle creation flags: bit 0 = bundle is a fragment (no),
        # bit 2 = bundle must not be fragmented
        self.log_bundle_transfer(
            from_node=source,
            to_node=source,  # "sent to self" = creation
            bundle_payload=bundle_payload,
            sim_time=sim_time,
            bundle_id=bundle_id,
            source=source,
            destination=destination,
            creation_time=sim_time,
            ttl=ttl,
            bundle_flags=0x0004,  # must not fragment
        )

    def log_bundle_delivery(
        self,
        from_node: str,
        to_node: str,
        bundle_payload: bytes,
        sim_time: float,
        bundle_id: str = "",
        source: str = "",
        destination: str = "",
        ttl: int = 3600,
    ) -> None:
        """Log a bundle delivery event as a PCAP packet.

        Same as transfer but with delivery-specific flags.

        Args:
            from_node: Last-hop node ID.
            to_node: Destination node ID.
            bundle_payload: Bundle payload bytes.
            sim_time: Simulation timestamp.
            bundle_id: Bundle identifier.
            source: Original source node.
            destination: Final destination node.
            ttl: Bundle TTL in seconds.
        """
        # Delivery report requested flag
        self.log_bundle_transfer(
            from_node=from_node,
            to_node=to_node,
            bundle_payload=bundle_payload,
            sim_time=sim_time,
            bundle_id=bundle_id,
            source=source,
            destination=destination,
            creation_time=sim_time,
            ttl=ttl,
            bundle_flags=0x0040,  # delivery report requested
        )

    @property
    def packet_count(self) -> int:
        """Number of packets written so far."""
        return self._packet_count

    @property
    def pcap_path(self) -> str:
        """Path to the PCAP file."""
        return self._pcap_path

    def close(self) -> None:
        """Flush and close the PCAP file and UDP socket."""
        if self._file and not self._file.closed:
            self._file.flush()
            self._file.close()
        if self._udp_sock is not None:
            self._udp_sock.close()
            self._udp_sock = None

    def __enter__(self) -> PcapBundleLogger:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def __del__(self) -> None:
        self.close()
