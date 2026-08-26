# Changelog

All notable changes to the DTN Crypto Simulator project.

## [0.2.0] - 2026-08-24

### Added
- Node inspector modal with 4 tabs (Overview, Buffer, Routing, Contacts)
- Real-time node state streaming via NODE_UPDATE WebSocket events
- Bundle priority support (Bulk/Normal/Expedited/Critical) with priority-based buffer replacement
- Role-based node classification from CP-ABE attributes
- PRoPHET predictability visualization in routing tab
- Spray-and-Wait token distribution view
- Contact timeline visualization
- Enhanced tooltip with live forwarded/dropped counts
- Buffer inspection with bundle details
- MkDocs documentation site with Material theme
- CONTRIBUTING.md guide
- Comprehensive JSDoc for all TypeScript exports

### Changed
- Node click now opens full-screen modal instead of right-side panel
- Bundle inspector shows priority badge and remaining hops
- Sidebar includes priority selector dropdown
- WebSocket event list expanded to include NODE_UPDATE

### Fixed
- Bundle priority field missing from API response
- Remaining hops not tracked in bundle details

## [0.1.0] - 2026-08-01

### Added
- Hybrid RSA-AES + CP-ABE encryption library
- DTN network simulator with 3 routing algorithms
- 3 preset scenarios (deep space, disaster, military)
- FastAPI backend with REST and WebSocket endpoints
- React + TypeScript web dashboard with D3.js visualization
- BPv7 PCAP capture for Wireshark
- SHA-256 bundle integrity verification
- Transmission timing simulation
- Custom payload support (text and file upload)
- Bundle path visualization and timing waterfall
- Crypto key management panel
