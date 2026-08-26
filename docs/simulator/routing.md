# Routing Algorithms

The simulator implements three routing algorithms, each with different trade-offs for DTN environments.

## Comparison

| Algorithm | Strategy | Buffer Usage | Delivery Ratio | Best For |
|---|---|---|---|---|
| **Epidemic** | Flood to all contacts | High | Highest | Disaster recovery, small networks |
| **PRoPHET** | Probabilistic forwarding | Medium | Good | Recurring mobility patterns |
| **Spray-and-Wait** | Token-limited replication | Low | Moderate | Bandwidth-constrained environments |

## Epidemic Routing

Floods bundles to every contact. When two nodes meet, they exchange all bundles the other doesn't have.

**Advantages:**
- Maximizes delivery probability
- Simple implementation
- Works well in small networks

**Disadvantages:**
- High buffer usage
- Many redundant transfers
- Doesn't scale well

**Parameters:**
- `buffer_size` — Maximum bundles per node

## PRoPHET Routing

Probabilistic routing based on encounter history. Each node maintains a predictability value for every destination, which ages over time and updates on encounters.

**Predictability Update:**

```
P(a,b) = P(a,b)_old + (1 - P(a,b)_old) × P_init
```

**Aging:**

```
P(a,b) = P(a,b)_old × gamma^k
```

where `k` is the number of time units since last encounter.

**Transitivity:**

```
P(a,c) = P(a,c)_old + (1 - P(a,c)_old) × P(a,b) × P(b,c) × beta
```

**Parameters:**
- `P_init` — Initial predictability on encounter (default: 0.75)
- `gamma` — Aging factor (default: 0.98)
- `beta` — Transitivity factor (default: 0.5)

## Spray-and-Wait

Binary spray mode: source starts with `L` copies. When forwarding, it gives `floor(n/2)` copies to the relay. Relays wait for direct delivery to destination.

**Two Phases:**

1. **Spray Phase** — Source distributes copies to encountered nodes
2. **Wait Phase** — Relays wait for direct contact with destination

**Parameters:**
- `L` — Initial number of copies (default: 8)

**Advantages:**
- Low buffer usage
- Bounded number of copies
- Good for large networks
