import { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import type { SimulationEvent } from "../types";

interface GraphNode extends d3.SimulationNodeDatum {
    id: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
    active: boolean;
}

interface ActiveTransfer {
    bundleId: string;
    from: string;
    to: string;
    payloadPreview?: string;
}

interface PersistentTransfer {
    key: string;
    from: string;
    to: string;
}

type NodeRole = "source" | "relay" | "destination";

interface Props {
    numNodes: number;
    events: SimulationEvent[];
    onNodeSelect?: (nodeId: string) => void;
    highlightPath?: string[];
    animationSpeed?: number;
    runId?: number;
}

export default function NetworkGraph({ numNodes, events, onNodeSelect, highlightPath, animationSpeed = 1, runId = 0 }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
    const nodesRef = useRef<GraphNode[]>([]);
    const linksRef = useRef<GraphLink[]>([]);
    const activeContactsRef = useRef<Set<string>>(new Set());
    const nodeStatesRef = useRef<Record<string, string>>({});
    const bundleTransitsRef = useRef<
        { id: string; x: number; y: number; color: string }[]
    >([]);
    const processedRef = useRef(0);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const bufferCountsRef = useRef<Record<string, number>>({});
    const deliverCountsRef = useRef<Record<string, number>>({});
    const draggedRef = useRef(false);
    const activeTransfersRef = useRef<ActiveTransfer[]>([]);
    const persistentTransfersRef = useRef<PersistentTransfer[]>([]);
    const nodeRolesRef = useRef<Record<string, Set<NodeRole>>>({});

    const renderGraph = useCallback(() => {
        const svg = d3.select(svgRef.current);
        const linkGroup = svg.select<SVGGElement>("g.links");
        const nodeGroup = svg.select<SVGGElement>("g.nodes");
        const labelGroup = svg.select<SVGGElement>("g.labels");

        // Links - only active ones (use class selector to avoid picking up transfer/highlight lines)
        const visLinks = linksRef.current.filter((l) => l.active);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const linkSel = linkGroup.selectAll<any, any>("line.link-base")
            .data(visLinks, (d: any) => {
                if (!d) return "";
                const s = typeof d.source === "object" ? (d.source as GraphNode).id : String(d.source);
                const t = typeof d.target === "object" ? (d.target as GraphNode).id : String(d.target);
                return s + "-" + t;
            });
        linkSel.exit().remove();
        linkSel.enter().append("line").attr("class", "link link-base active");

        // Nodes
        const nodes = nodesRef.current;
        const nodeStates = nodeStatesRef.current;
        const nodeSel = nodeGroup
            .selectAll<SVGCircleElement, GraphNode>("circle")
            .data(nodes, (d) => d.id);
        nodeSel.exit().remove();
        const enter = nodeSel
            .enter()
            .append("circle")
            .attr("r", 12)
            .attr("filter", "url(#glow)")
            .attr("cursor", "pointer")
            .on("mouseover", function (event: MouseEvent, d: GraphNode) {
                if (!tooltipRef.current || !containerRef.current) return;
                const st = nodeStates[d.id] || "idle";
                const buf = bufferCountsRef.current[d.id] || 0;
                const del = deliverCountsRef.current[d.id] || 0;

                const nodeTransfers = activeTransfersRef.current.filter(
                    (t: ActiveTransfer) => t.from === d.id || t.to === d.id,
                );

                let html = `<div class="tt-title">${d.id}</div>`;
                html += `<div class="tt-row"><span>Status</span><span class="tt-val">${st}</span></div>`;
                html += `<div class="tt-row"><span>Buffer</span><span class="tt-val">${buf}</span></div>`;
                html += `<div class="tt-row"><span>Delivered</span><span class="tt-val">${del}</span></div>`;

                if (nodeTransfers.length > 0) {
                    html += `<div class="tt-divider"></div>`;
                    html += `<div class="tt-row"><span style="color: var(--warn); font-weight: 600;">Transfers (${nodeTransfers.length})</span></div>`;
                    for (const transfer of nodeTransfers.slice(0, 3)) {
                        html += `<div class="tt-row" style="font-size: 11px;">`;
                        html += `<span>${transfer.from} → ${transfer.to}</span>`;
                        html += `</div>`;
                        if (transfer.payloadPreview) {
                            html += `<div class="tt-payload">${transfer.payloadPreview.length > 50 ? transfer.payloadPreview.slice(0, 50) + '...' : transfer.payloadPreview}</div>`;
                        }
                    }
                }

                tooltipRef.current.innerHTML = html;
                tooltipRef.current.style.display = "block";
                const rect = containerRef.current.getBoundingClientRect();
                tooltipRef.current.style.left = event.clientX - rect.left + 15 + "px";
                tooltipRef.current.style.top = event.clientY - rect.top - 10 + "px";
            })
            .on("mouseout", function () {
                if (tooltipRef.current) tooltipRef.current.style.display = "none";
            })
            .on("click", function (_event: MouseEvent, d: GraphNode) {
                if (!draggedRef.current && onNodeSelect) {
                    onNodeSelect(d.id);
                }
            });

        if (simRef.current) {
            enter.call(
                d3
                    .drag<SVGCircleElement, GraphNode>()
                    .on("start", (event, d) => {
                        draggedRef.current = false;
                        if (!event.active) simRef.current!.alphaTarget(0.3).restart();
                        d.fx = d.x;
                        d.fy = d.y;
                    })
                    .on("drag", (_event, d) => {
                        draggedRef.current = true;
                        d.fx = _event.x;
                        d.fy = _event.y;
                    })
                    .on("end", (event, d) => {
                        if (!event.active) simRef.current!.alphaTarget(0);
                        d.fx = null;
                        d.fy = null;
                    }),
            );
        }

        enter.merge(nodeSel).attr("fill", (d) => {
            const st = nodeStates[d.id] || "idle";
            if (st === "delivering") return "var(--delivered)";
            if (st === "active") return "var(--active)";
            return "var(--idle)";
        });

        // Labels
        const labelSel = labelGroup
            .selectAll<SVGTextElement, GraphNode>("text")
            .data(nodes, (d) => d.id);
        labelSel.exit().remove();
        labelSel
            .enter()
            .append("text")
            .attr("class", "node-label")
            .attr("dy", 26)
            .merge(labelSel)
            .text((d) => d.id);
    }, [onNodeSelect]);

    // Compute node roles from events
    const computeNodeRoles = useCallback((evts: SimulationEvent[]) => {
        const roles: Record<string, Set<NodeRole>> = {};
        for (const evt of evts) {
            if (evt.type === "BUNDLE_CREATE") {
                if (!roles[evt.node_from]) roles[evt.node_from] = new Set();
                roles[evt.node_from].add("source");
            } else if (evt.type === "BUNDLE_TRANSFER") {
                if (!roles[evt.node_from]) roles[evt.node_from] = new Set();
                roles[evt.node_from].add("relay");
                if (!roles[evt.node_to]) roles[evt.node_to] = new Set();
                roles[evt.node_to].add("relay");
            } else if (evt.type === "BUNDLE_DELIVER") {
                if (!roles[evt.node_to]) roles[evt.node_to] = new Set();
                roles[evt.node_to].add("destination");
            }
        }
        return roles;
    }, []);

    // Render role rings
    const renderRoleRings = useCallback(() => {
        if (!svgRef.current) return;
        const svg = d3.select(svgRef.current);
        const roleRingsGroup = svg.select<SVGGElement>("g.role-rings");
        if (!roleRingsGroup) return;

        // Flatten roles into array of {nodeId, role, r, ringClass}
        const ringData: Array<{ nodeId: string; role: NodeRole; r: number; ringClass: string }> = [];
        const roleConfig: Record<NodeRole, { r: number; ringClass: string }> = {
            source: { r: 17, ringClass: "source-ring" },
            relay: { r: 15, ringClass: "relay-ring" },
            destination: { r: 13, ringClass: "destination-ring" },
        };

        for (const [nodeId, roleSet] of Object.entries(nodeRolesRef.current)) {
            for (const role of roleSet) {
                ringData.push({ nodeId, role, ...roleConfig[role] });
            }
        }

        const ringSel = roleRingsGroup
            .selectAll<any, typeof ringData[number]>("circle.role-ring")
            .data(ringData, (d: typeof ringData[number]) => `${d.nodeId}-${d.role}`);
        ringSel.exit().remove();
        ringSel.enter().append("circle")
            .attr("class", (d) => `role-ring ${d.ringClass}`)
            .attr("r", (d) => d.r)
            .attr("fill", "none")
            .attr("stroke-width", 1.5)
            .merge(ringSel)
            .attr("cx", (d: typeof ringData[number]) => {
                const node = nodesRef.current.find(n => n.id === d.nodeId);
                return node?.x ?? 0;
            })
            .attr("cy", (d: typeof ringData[number]) => {
                const node = nodesRef.current.find(n => n.id === d.nodeId);
                return node?.y ?? 0;
            });
    }, []);

    // Initialize D3 graph
    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;
        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // Defs
        const defs = svg.append("defs");
        const filter = defs.append("filter").attr("id", "glow");
        filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
        const merge = filter.append("feMerge");
        merge.append("feMergeNode").attr("in", "blur");
        merge.append("feMergeNode").attr("in", "SourceGraphic");

        // Link gradient
        const linkGrad = defs.append("linearGradient")
            .attr("id", "linkGradient")
            .attr("gradientUnits", "userSpaceOnUse");
        linkGrad.append("stop").attr("offset", "0%").attr("stop-color", "var(--accent)");
        linkGrad.append("stop").attr("offset", "100%").attr("stop-color", "var(--accent2)");

        // Path highlight gradient
        const pathGrad = defs.append("linearGradient")
            .attr("id", "pathGradient")
            .attr("gradientUnits", "userSpaceOnUse");
        pathGrad.append("stop").attr("offset", "0%").attr("stop-color", "var(--accent)");
        pathGrad.append("stop").attr("offset", "50%").attr("stop-color", "var(--warn)");
        pathGrad.append("stop").attr("offset", "100%").attr("stop-color", "var(--accent2)");

        const zoomGroup = svg.append("g").attr("class", "zoom-group");
        const linkGroup = zoomGroup.append("g").attr("class", "links");
        zoomGroup.append("g").attr("class", "role-rings");
        zoomGroup.append("g").attr("class", "bundles");
        const nodeGroup = zoomGroup.append("g").attr("class", "nodes");
        const labelGroup = zoomGroup.append("g").attr("class", "labels");

        // Zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.3, 4])
            .on("zoom", (event) => {
                zoomGroup.attr("transform", event.transform.toString());
            });
        svg.call(zoom);

        // Double-click to reset zoom
        svg.on("dblclick.zoom", () => {
            svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
        });

        // Create nodes
        const nodes: GraphNode[] = Array.from({ length: numNodes }, (_, i) => ({
            id: `node-${i}`,
            x: width / 2 + (Math.random() - 0.5) * 100,
            y: height / 2 + (Math.random() - 0.5) * 100,
        }));
        nodesRef.current = nodes;

        // Create all possible links
        const links: GraphLink[] = [];
        for (let i = 0; i < numNodes; i++) {
            for (let j = i + 1; j < numNodes; j++) {
                links.push({ source: `node-${i}`, target: `node-${j}`, active: false });
            }
        }
        linksRef.current = links;

        // Reset state
        activeContactsRef.current = new Set();
        const nodeStates: Record<string, string> = {};
        nodes.forEach((n) => (nodeStates[n.id] = "idle"));
        nodeStatesRef.current = nodeStates;
        bundleTransitsRef.current = [];
        persistentTransfersRef.current = [];
        nodeRolesRef.current = {};
        bufferCountsRef.current = {};
        deliverCountsRef.current = {};
        processedRef.current = 0;

        const simulation = d3
            .forceSimulation(nodes)
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide(30))
            .force("x", d3.forceX(width / 2).strength(0.05))
            .force("y", d3.forceY(height / 2).strength(0.05))
            .on("tick", () => {
                // Update data-bound links
                linkGroup
                    .selectAll<any, any>("line.link-base")
                    .attr("x1", (d: any) => ((d.source as GraphNode).x ?? 0))
                    .attr("y1", (d: any) => ((d.source as GraphNode).y ?? 0))
                    .attr("x2", (d: any) => ((d.target as GraphNode).x ?? 0))
                    .attr("y2", (d: any) => ((d.target as GraphNode).y ?? 0));

                // Update persistent transfer lines
                linkGroup
                    .selectAll<any, PersistentTransfer>("line.transfer-line")
                    .attr("x1", (d: any) => {
                        const node = nodesRef.current.find(n => n.id === d.from);
                        return node?.x ?? 0;
                    })
                    .attr("y1", (d: any) => {
                        const node = nodesRef.current.find(n => n.id === d.from);
                        return node?.y ?? 0;
                    })
                    .attr("x2", (d: any) => {
                        const node = nodesRef.current.find(n => n.id === d.to);
                        return node?.x ?? 0;
                    })
                    .attr("y2", (d: any) => {
                        const node = nodesRef.current.find(n => n.id === d.to);
                        return node?.y ?? 0;
                    });

                nodeGroup
                    .selectAll<SVGCircleElement, GraphNode>("circle")
                    .attr("cx", (d) => d.x ?? 0)
                    .attr("cy", (d) => d.y ?? 0);

                labelGroup
                    .selectAll<SVGTextElement, GraphNode>("text")
                    .attr("x", (d) => d.x ?? 0)
                    .attr("y", (d) => d.y ?? 0);

                // Update role rings
                const roleRingsGroup = svgRef.current ? d3.select(svgRef.current).select<SVGGElement>("g.role-rings") : null;
                if (roleRingsGroup) {
                    roleRingsGroup
                        .selectAll<SVGCircleElement, { nodeId: string; role: NodeRole; r: number; ringClass: string }>("circle.role-ring")
                        .attr("cx", (d) => {
                            const node = nodesRef.current.find(n => n.id === d.nodeId);
                            return node?.x ?? 0;
                        })
                        .attr("cy", (d) => {
                            const node = nodesRef.current.find(n => n.id === d.nodeId);
                            return node?.y ?? 0;
                        });
                }

                // Bundle dots
                const bundleGroup = d3.select(svgRef.current).select<SVGGElement>("g.bundles");
                const bSel = bundleGroup
                    .selectAll<SVGCircleElement, { id: string; x: number; y: number; color: string }>("circle")
                    .data(bundleTransitsRef.current, (d) => d.id);
                bSel.exit().remove();
                bSel
                    .enter()
                    .append("circle")
                    .attr("r", 5)
                    .attr("fill", (d) => d.color)
                    .merge(bSel)
                    .attr("cx", (d) => d.x)
                    .attr("cy", (d) => d.y);
            });

        simRef.current = simulation;
        renderGraph();

        // Resize handler
        const handleResize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            simulation.force("center", d3.forceCenter(w / 2, h / 2));
            simulation.force("x", d3.forceX(w / 2).strength(0.05));
            simulation.force("y", d3.forceY(h / 2).strength(0.05));
            simulation.alpha(0.3).restart();
        };
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            simulation.stop();
        };
    }, [numNodes, renderGraph]);

    // Process a single simulation event (mutates refs only)
    const processEvent = useCallback(
        (evt: SimulationEvent) => {
            const nodes = nodesRef.current;
            const links = linksRef.current;
            const activeContacts = activeContactsRef.current;
            const nodeStates = nodeStatesRef.current;

            if (evt.type === "CONTACT_START") {
                const key = [evt.node_from, evt.node_to].sort().join("-");
                activeContacts.add(key);
                const link = links.find((l) => {
                    const s = typeof l.source === "object" ? (l.source as GraphNode).id : String(l.source);
                    const t = typeof l.target === "object" ? (l.target as GraphNode).id : String(l.target);
                    return [s, t].sort().join("-") === key;
                });
                if (link) link.active = true;
                nodeStates[evt.node_from] = "active";
                nodeStates[evt.node_to] = "active";
            } else if (evt.type === "CONTACT_END") {
                const key = [evt.node_from, evt.node_to].sort().join("-");
                activeContacts.delete(key);
                const link = links.find((l) => {
                    const s = typeof l.source === "object" ? (l.source as GraphNode).id : String(l.source);
                    const t = typeof l.target === "object" ? (l.target as GraphNode).id : String(l.target);
                    return [s, t].sort().join("-") === key;
                });
                if (link) link.active = false;
                [evt.node_from, evt.node_to].forEach((nid) => {
                    const hasContact = [...activeContacts].some((k) => k.includes(nid));
                    if (!hasContact) nodeStates[nid] = "idle";
                });
            } else if (evt.type === "BUNDLE_CREATE") {
                bufferCountsRef.current[evt.node_from] =
                    (bufferCountsRef.current[evt.node_from] || 0) + 1;
            } else if (evt.type === "BUNDLE_TRANSFER") {
                const src = nodes.find((n) => n.id === evt.node_from);
                const dst = nodes.find((n) => n.id === evt.node_to);
                if (src && dst && src.x != null && src.y != null && dst.x != null && dst.y != null) {
                    // Add persistent transfer line (stays visible after simulation)
                    const transferKey = `${evt.bundle_id}:${evt.node_from}->${evt.node_to}`;
                    persistentTransfersRef.current.push({
                        key: transferKey,
                        from: evt.node_from,
                        to: evt.node_to,
                    });

                    // Render transfer line with data binding
                    const svg = d3.select(svgRef.current);
                    const linkGroup = svg.select<SVGGElement>("g.links");
                    const transferSel = linkGroup
                        .selectAll<any, PersistentTransfer>("line.transfer-line")
                        .data(persistentTransfersRef.current, (d: any) => d.key);
                    transferSel.exit().remove();
                    transferSel.enter().append("line")
                        .attr("class", "link transfer-line")
                        .attr("x1", src.x)
                        .attr("y1", src.y)
                        .attr("x2", dst.x)
                        .attr("y2", dst.y);

                    // Track active transfer for tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const preview = (evt as any).plaintext_preview as string | undefined;
                    activeTransfersRef.current.push({
                        bundleId: evt.bundle_id,
                        from: evt.node_from,
                        to: evt.node_to,
                        payloadPreview: preview ? preview.slice(0, 100) : undefined,
                    });

                    // Animated dot
                    const dotId = evt.bundle_id + "-" + Math.random().toString(36).slice(2, 6);
                    const dot = { id: dotId, x: src.x, y: src.y, color: "var(--warn)" };
                    bundleTransitsRef.current.push(dot);
                    const dur = Math.max(50, 400 / animationSpeed);
                    const startTime = performance.now();
                    const srcX = src.x, srcY = src.y, dstX = dst.x, dstY = dst.y;
                    const animate = (now: number) => {
                        const t = Math.min((now - startTime) / dur, 1);
                        dot.x = srcX + (dstX - srcX) * t;
                        dot.y = srcY + (dstY - srcY) * t;
                        if (t < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            bundleTransitsRef.current = bundleTransitsRef.current.filter(
                                (b) => b.id !== dotId,
                            );
                            activeTransfersRef.current = activeTransfersRef.current.filter(
                                (tr: ActiveTransfer) => !(tr.bundleId === evt.bundle_id && tr.to === evt.node_to),
                            );
                        }
                    };
                    requestAnimationFrame(animate);
                }
                bufferCountsRef.current[evt.node_to] =
                    (bufferCountsRef.current[evt.node_to] || 0) + 1;
            } else if (evt.type === "BUNDLE_DELIVER") {
                deliverCountsRef.current[evt.node_to] =
                    (deliverCountsRef.current[evt.node_to] || 0) + 1;
                nodeStates[evt.node_to] = "delivering";
                const nodeId = evt.node_to;
                setTimeout(() => {
                    if (nodeStatesRef.current[nodeId] === "delivering") {
                        const hasContact = [...activeContactsRef.current].some((k) =>
                            k.includes(nodeId),
                        );
                        nodeStatesRef.current[nodeId] = hasContact ? "active" : "idle";
                        renderGraph();
                    }
                }, 600);
            }
        },
        [renderGraph, animationSpeed],
    );

    // Reset event processor when a new simulation starts
    useEffect(() => {
        processedRef.current = 0;
    }, [runId]);

    // Process new events
    useEffect(() => {
        const start = processedRef.current;
        if (start >= events.length) return;

        const newEvents = events.slice(start);
        processedRef.current = events.length;

        for (const evt of newEvents) {
            processEvent(evt);
        }

        // Update node roles from all events
        nodeRolesRef.current = computeNodeRoles(events);
        renderRoleRings();
        renderGraph();
    }, [events, renderGraph, processEvent, computeNodeRoles, renderRoleRings]);

    // Highlight path when a bundle is selected
    useEffect(() => {
        if (!svgRef.current) return;
        const svg = d3.select(svgRef.current);
        const linkGroup = svg.select<SVGGElement>("g.links");

        // Remove previous highlights
        linkGroup.selectAll("line.highlighted").remove();

        if (!highlightPath || highlightPath.length < 2) return;

        const nodes = nodesRef.current;
        for (let i = 0; i < highlightPath.length - 1; i++) {
            const srcId = highlightPath[i];
            const dstId = highlightPath[i + 1];
            const src = nodes.find((n) => n.id === srcId);
            const dst = nodes.find((n) => n.id === dstId);
            if (src && dst && src.x != null && src.y != null && dst.x != null && dst.y != null) {
                linkGroup
                    .append("line")
                    .attr("class", "link highlighted")
                    .attr("x1", src.x)
                    .attr("y1", src.y)
                    .attr("x2", dst.x)
                    .attr("y2", dst.y);
            }
        }
    }, [highlightPath]);

    return (
        <div className="main" ref={containerRef}>
            <svg ref={svgRef} id="network-svg" />
            <div className="tooltip" ref={tooltipRef} />
            <div className="graph-legend">
                <div className="legend-section">
                    <div className="legend-title">Node Roles</div>
                    <div className="legend-item">
                        <span className="legend-dot source"></span>
                        <span>Source</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot relay"></span>
                        <span>Relay</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot destination"></span>
                        <span>Destination</span>
                    </div>
                </div>
                <div className="legend-section">
                    <div className="legend-title">Connections</div>
                    <div className="legend-item">
                        <span className="legend-line active"></span>
                        <span>Active Contact</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-line transfer"></span>
                        <span>Transfer</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
