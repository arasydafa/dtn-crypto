# Scenarios

The simulator includes three pre-configured scenarios modeling real-world DTN deployments.

## Scenario Comparison

| Scenario | Nodes | Bandwidth | Contact Pattern | Use Case |
|---|---|---|---|---|
| **Disaster** | 10 | 100,000 bps | Random mobility | Post-disaster mesh |
| **Deep Space** | 8 | 1,000 bps | Scheduled orbital | Interplanetary comms |
| **Military** | 12 | 50,000 bps | Formation-based | Tactical networks |

## Disaster Recovery

Simulates node failures, intermittent links, and priority message routing in environments where infrastructure is damaged or destroyed.

- **Bandwidth**: 100,000 bps
- **Contact pattern**: Random mobility-based
- **Default router**: Epidemic (maximum delivery probability)
- **Message rate**: High (1.0 msg/min)

## Deep Space

Models interplanetary communication with high delays (minutes to hours), rare contact opportunities between nodes, and critical data integrity requirements.

- **Bandwidth**: 1,000 bps
- **Contact pattern**: Scheduled orbital windows
- **Default router**: PRoPHET (leverages predictable orbital patterns)
- **Message rate**: Low (0.5 msg/min)

## Military Tactical

Enforces CP-ABE policy-based access control with attribute-based decryption rights. Supports secure multi-hop routing in contested environments.

- **Bandwidth**: 50,000 bps
- **Contact pattern**: Formation-based with jamming
- **Default router**: Spray-and-Wait (limits exposure)
- **Message rate**: Medium (0.8 msg/min)
