# tests/test_pcap.py — Unit tests for the PCAP bundle protocol logger.
# Purpose: Tests PCAP file generation, BPv7 CBOR encoding, network frame
#          construction, and Wireshark compatibility of generated captures.
# Dependencies: pytest, simulator.pcap_logger
# Usage: pytest tests/test_pcap.py -v

"""Tests for the PCAP bundle protocol logger module."""

from __future__ import annotations

import os
import struct
import tempfile

from simulator.pcap_logger import (
    PcapBundleLogger,
    _build_ethernet_header,
    _build_ip_header,
    _build_udp_header,
    _cbor_break,
    _cbor_encode_array,
    _cbor_encode_bstr,
    _cbor_encode_tstr,
    _cbor_encode_uint,
    _cbor_indef_array_start,
    _ip_checksum,
    _node_to_ip,
    _node_to_mac,
    encode_bpv7_bundle,
)


class TestCborEncoding:
    """Tests for minimal CBOR encoder functions."""

    def test_uint_small(self) -> None:
        """Small unsigned integers encode to single byte."""
        assert _cbor_encode_uint(0) == b"\x00"
        assert _cbor_encode_uint(23) == b"\x17"

    def test_uint_one_byte(self) -> None:
        """Values 24-255 encode with 1 additional byte."""
        result = _cbor_encode_uint(24)
        assert result == b"\x18\x18"
        result = _cbor_encode_uint(255)
        assert result == b"\x18\xff"

    def test_uint_two_bytes(self) -> None:
        """Values 256-65535 encode with 2 additional bytes."""
        result = _cbor_encode_uint(256)
        assert result == b"\x19\x01\x00"

    def test_uint_four_bytes(self) -> None:
        """Values up to 2^32-1 encode with 4 additional bytes."""
        result = _cbor_encode_uint(70000)
        assert len(result) == 5
        assert result[0] == 0x1A

    def test_bstr(self) -> None:
        """Byte strings encode with correct length prefix."""
        result = _cbor_encode_bstr(b"hello")
        assert result[0] == (2 << 5) | 5  # major type 2, length 5
        assert result[1:] == b"hello"

    def test_bstr_empty(self) -> None:
        """Empty byte string encodes to single byte."""
        result = _cbor_encode_bstr(b"")
        assert result == bytes([2 << 5])

    def test_tstr(self) -> None:
        """Text strings encode with correct length prefix."""
        result = _cbor_encode_tstr("hi")
        assert result[0] == (3 << 5) | 2  # major type 3, length 2
        assert result[1:] == b"hi"

    def test_array(self) -> None:
        """Arrays encode with correct length prefix and concatenated items."""
        items = [_cbor_encode_uint(1), _cbor_encode_uint(2)]
        result = _cbor_encode_array(items)
        assert result[0] == (4 << 5) | 2  # major type 4, length 2
        assert result[1:] == b"\x01\x02"

    def test_indef_array_markers(self) -> None:
        """Indefinite array start and break markers are correct."""
        assert _cbor_indef_array_start() == b"\x9f"
        assert _cbor_break() == b"\xff"


class TestBpv7Encoding:
    """Tests for BPv7 bundle encoding."""

    def test_basic_bundle(self) -> None:
        """A basic BPv7 bundle encodes without error."""
        result = encode_bpv7_bundle(
            source="node-0",
            destination="node-1",
            payload=b"Hello DTN",
        )
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_bundle_starts_with_indef_array(self) -> None:
        """BPv7 bundle starts with CBOR indefinite array (0x9F)."""
        result = encode_bpv7_bundle(
            source="src", destination="dst", payload=b"test",
        )
        assert result[0] == 0x9F

    def test_bundle_ends_with_break(self) -> None:
        """BPv7 bundle ends with CBOR break code (0xFF)."""
        result = encode_bpv7_bundle(
            source="src", destination="dst", payload=b"test",
        )
        assert result[-1] == 0xFF

    def test_bundle_contains_version_7(self) -> None:
        """The primary block contains version number 7."""
        result = encode_bpv7_bundle(
            source="src", destination="dst", payload=b"data",
        )
        # Version 7 is encoded as CBOR uint 7 = byte 0x07
        # It appears right after the indef array start and primary block array header
        assert b"\x07" in result[:10]

    def test_bundle_with_id_annotation(self) -> None:
        """Bundle ID is annotated in the payload."""
        result = encode_bpv7_bundle(
            source="src", destination="dst", payload=b"data",
            bundle_id="test-123",
        )
        assert b"[test-123]" in result

    def test_different_bundles_differ(self) -> None:
        """Bundles with different payloads produce different bytes."""
        b1 = encode_bpv7_bundle(source="a", destination="b", payload=b"one")
        b2 = encode_bpv7_bundle(source="a", destination="b", payload=b"two")
        assert b1 != b2


class TestNetworkFrames:
    """Tests for Ethernet/IP/UDP frame construction."""

    def test_ethernet_header_length(self) -> None:
        """Ethernet header is exactly 14 bytes."""
        src = bytes(6)
        dst = bytes(6)
        header = _build_ethernet_header(src, dst)
        assert len(header) == 14

    def test_ethernet_ethertype(self) -> None:
        """Ethernet header contains correct IPv4 EtherType."""
        src = bytes(6)
        dst = bytes(6)
        header = _build_ethernet_header(src, dst, ethertype=0x0800)
        assert header[12:14] == b"\x08\x00"

    def test_ip_header_length(self) -> None:
        """IP header is exactly 20 bytes (no options)."""
        header = _build_ip_header("10.0.0.1", "10.0.0.2", 100)
        assert len(header) == 20

    def test_ip_header_version(self) -> None:
        """IP header has version 4 and IHL 5."""
        header = _build_ip_header("10.0.0.1", "10.0.0.2", 100)
        assert header[0] == 0x45  # version=4, ihl=5

    def test_ip_header_protocol_udp(self) -> None:
        """IP header has protocol 17 (UDP)."""
        header = _build_ip_header("10.0.0.1", "10.0.0.2", 100)
        assert header[9] == 17

    def test_ip_checksum_valid(self) -> None:
        """IP header checksum validates to zero when rechecked."""
        header = _build_ip_header("10.0.0.1", "10.0.0.2", 100)
        assert _ip_checksum(header) == 0

    def test_udp_header_length(self) -> None:
        """UDP header is exactly 8 bytes."""
        header = _build_udp_header(4556, 4556, 50)
        assert len(header) == 8

    def test_udp_port_encoding(self) -> None:
        """UDP header encodes source and destination ports correctly."""
        header = _build_udp_header(4556, 4556, 50)
        src_port = struct.unpack("!H", header[0:2])[0]
        dst_port = struct.unpack("!H", header[2:4])[0]
        assert src_port == 4556
        assert dst_port == 4556

    def test_node_to_ip_mapping(self) -> None:
        """Node IDs map to deterministic IP addresses."""
        assert _node_to_ip("node-0") == "10.0.0.1"
        assert _node_to_ip("node-1") == "10.0.0.2"
        assert _node_to_ip("node-9") == "10.0.0.10"

    def test_node_to_mac_mapping(self) -> None:
        """Node IDs map to deterministic MAC addresses."""
        mac = _node_to_mac("node-0")
        assert len(mac) == 6
        assert mac[0] == 0x02  # Locally administered

    def test_node_to_mac_unique(self) -> None:
        """Different nodes get different MAC addresses."""
        assert _node_to_mac("node-0") != _node_to_mac("node-1")


class TestPcapBundleLogger:
    """Tests for the PCAP file writer."""

    def test_creates_valid_pcap_file(self) -> None:
        """PcapBundleLogger creates a file with valid PCAP global header."""
        with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as f:
            pcap_path = f.name

        try:
            logger = PcapBundleLogger(pcap_path)
            logger.close()

            with open(pcap_path, "rb") as f:
                data = f.read()

            # PCAP global header is 24 bytes
            assert len(data) >= 24

            # Check magic number (little-endian)
            magic = struct.unpack("<I", data[0:4])[0]
            assert magic == 0xA1B2C3D4

            # Check version
            major = struct.unpack("<H", data[4:6])[0]
            minor = struct.unpack("<H", data[6:8])[0]
            assert major == 2
            assert minor == 4

            # Check link type = Ethernet (1)
            link_type = struct.unpack("<I", data[20:24])[0]
            assert link_type == 1
        finally:
            os.unlink(pcap_path)

    def test_log_bundle_transfer_writes_packet(self) -> None:
        """Logging a bundle transfer writes at least one packet."""
        with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as f:
            pcap_path = f.name

        try:
            logger = PcapBundleLogger(pcap_path)
            logger.log_bundle_transfer(
                from_node="node-0",
                to_node="node-1",
                bundle_payload=b"Test payload",
                sim_time=100.0,
                bundle_id="test-001",
                source="node-0",
                destination="node-1",
            )
            assert logger.packet_count == 1
            logger.close()

            with open(pcap_path, "rb") as f:
                data = f.read()

            # Should be larger than just the global header
            # global header + at least one packet header
            assert len(data) > 24 + 16
        finally:
            os.unlink(pcap_path)

    def test_multiple_transfers(self) -> None:
        """Multiple transfers produce multiple packets."""
        with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as f:
            pcap_path = f.name

        try:
            logger = PcapBundleLogger(pcap_path)
            for i in range(5):
                logger.log_bundle_transfer(
                    from_node=f"node-{i}",
                    to_node=f"node-{i+1}",
                    bundle_payload=f"msg-{i}".encode(),
                    sim_time=float(i * 10),
                )
            assert logger.packet_count == 5
            logger.close()
        finally:
            os.unlink(pcap_path)

    def test_context_manager(self) -> None:
        """PcapBundleLogger works as a context manager."""
        with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as f:
            pcap_path = f.name

        try:
            with PcapBundleLogger(pcap_path) as logger:
                logger.log_bundle_creation(
                    source="node-0",
                    destination="node-5",
                    bundle_payload=b"creation test",
                    sim_time=0.0,
                )
                assert logger.packet_count == 1
        finally:
            os.unlink(pcap_path)

    def test_log_bundle_delivery(self) -> None:
        """Bundle delivery events are logged correctly."""
        with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as f:
            pcap_path = f.name

        try:
            with PcapBundleLogger(pcap_path) as logger:
                logger.log_bundle_delivery(
                    from_node="node-3",
                    to_node="node-7",
                    bundle_payload=b"delivered!",
                    sim_time=500.0,
                    bundle_id="del-001",
                    source="node-0",
                    destination="node-7",
                )
                assert logger.packet_count == 1
        finally:
            os.unlink(pcap_path)

    def test_pcap_path_property(self) -> None:
        """The pcap_path property returns the correct path."""
        with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as f:
            pcap_path = f.name

        try:
            logger = PcapBundleLogger(pcap_path)
            assert logger.pcap_path == pcap_path
            logger.close()
        finally:
            os.unlink(pcap_path)

    def test_pcap_frame_contains_bpv7_payload(self) -> None:
        """Generated PCAP packets contain BPv7-encoded data."""
        with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as f:
            pcap_path = f.name

        try:
            logger = PcapBundleLogger(pcap_path)
            logger.log_bundle_transfer(
                from_node="node-0",
                to_node="node-1",
                bundle_payload=b"MARKER_PAYLOAD",
                sim_time=10.0,
            )
            logger.close()

            with open(pcap_path, "rb") as f:
                data = f.read()

            # The BPv7 bundle should contain our payload as a CBOR bstr
            assert b"MARKER_PAYLOAD" in data
            # The frame should start with Ethernet (after PCAP headers)
            # and contain the BPv7 indefinite array start somewhere
            assert b"\x9f" in data[24:]
        finally:
            os.unlink(pcap_path)
