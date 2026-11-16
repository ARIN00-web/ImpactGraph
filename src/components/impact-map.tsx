"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { List, Maximize2, Minus, Plus, RotateCcw, Waypoints } from "lucide-react";

type Edge = { sourcePath: string; importedPath: string };
type Evidence = {
  snippet: string | null;
  document: { path: string | null } | null;
  chunk: { startLine: number | null; endLine: number | null } | null;
};
type FindingNode = {
  id: string;
  filePath: string | null;
  verified: boolean;
  component?: string | null;
  impactType?: string | null;
  confidence?: number | null;
  reason?: string | null;
  evidence?: Evidence[];
};
type Position = { x: number; y: number; depth: number };

const NODE_WIDTH = 238;
const NODE_HEIGHT = 64;
const COLUMN_GAP = 112;
const ROW_GAP = 24;
const MARGIN = 36;

function fullLabel(path: string) {
  if (path.length <= 32) return [path];
  const slash = path.lastIndexOf("/");
  if (slash > 0) {
    const folder = path.slice(0, slash);
    const file = path.slice(slash + 1);
    const maxFolderLength = Math.max(8, 31 - file.length);
    return [
      `${folder.length > maxFolderLength ? `…${folder.slice(-maxFolderLength + 1)}` : folder}/`,
      file,
    ];
  }
  return [`…${path.slice(-29)}`];
}

export function ImpactMap({
  edges = [],
  findings = [],
  changedPaths = [],
  unindexedPaths = [],
}: {
  edges?: Edge[];
  findings?: FindingNode[];
  changedPaths?: string[];
  unindexedPaths?: string[];
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [view, setView] = useState<"graph" | "list">("graph");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const paths = useMemo(() => [...new Set(changedPaths.filter(Boolean))], [changedPaths]);
  const unindexed = useMemo(() => new Set(unindexedPaths), [unindexedPaths]);
  const impact = useMemo(() => {
    const depth = new Map<string, number>(paths.map((path) => [path, 0]));
    const importers = new Map<string, Set<string>>();
    for (const edge of edges) {
      const sourceSet = importers.get(edge.importedPath) ?? new Set<string>();
      sourceSet.add(edge.sourcePath);
      importers.set(edge.importedPath, sourceSet);
    }

    let frontier = [...paths];
    for (let currentDepth = 1; currentDepth <= 4 && frontier.length > 0; currentDepth += 1) {
      const next: string[] = [];
      for (const path of frontier) {
        for (const importer of importers.get(path) ?? []) {
          if (depth.has(importer)) continue;
          depth.set(importer, currentDepth);
          next.push(importer);
        }
      }
      frontier = next;
    }

    const layers = new Map<number, string[]>();
    for (const [path, level] of depth) {
      const layer = layers.get(level) ?? [];
      layer.push(path);
      layers.set(level, layer);
    }

    const positions = new Map<string, Position>();
    const maxLayerSize = Math.max(1, ...[...layers.values()].map((items) => items.length));
    for (const [level, items] of layers) {
      items.forEach((path, index) => {
        positions.set(path, {
          x: MARGIN + level * (NODE_WIDTH + COLUMN_GAP),
          y: MARGIN + index * (NODE_HEIGHT + ROW_GAP),
          depth: level,
        });
      });
    }

    const graphEdges = edges.filter((edge) => {
      const source = positions.get(edge.sourcePath);
      const dependency = positions.get(edge.importedPath);
      return source && dependency && source.depth === dependency.depth + 1;
    });
    const maxDepth = Math.max(0, ...depth.values());
    return {
      depth,
      positions,
      edges: graphEdges,
      width: MARGIN * 2 + (maxDepth + 1) * NODE_WIDTH + maxDepth * COLUMN_GAP,
      height: MARGIN * 2 + maxLayerSize * NODE_HEIGHT + Math.max(0, maxLayerSize - 1) * ROW_GAP,
      maxDepth,
    };
  }, [edges, paths]);

  const fitToView = useCallback(() => {
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const scale = Math.min(
      (bounds.width - MARGIN * 2) / impact.width,
      (bounds.height - MARGIN * 2) / impact.height,
      1
    );
    setZoom(scale);
    setOffset({
      x: (bounds.width - impact.width * scale) / 2,
      y: (bounds.height - impact.height * scale) / 2,
    });
  }, [impact.height, impact.width]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || !("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(() => fitToView());
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitToView]);

  const visiblePaths = [...impact.positions.keys()];
  const selectedPath = focusedPath && impact.positions.has(focusedPath)
    ? focusedPath
    : visiblePaths[0] ?? null;
  const selectedDepth = selectedPath ? impact.depth.get(selectedPath) ?? 0 : 0;
  const selectedFindings = selectedPath
    ? findings.filter((finding) => finding.filePath === selectedPath)
    : [];
  const adjacentEdges = selectedPath
    ? edges.filter((edge) => edge.sourcePath === selectedPath || edge.importedPath === selectedPath)
    : [];

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || view !== "graph") return;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.offsetX + event.clientX - dragRef.current.x,
      y: dragRef.current.offsetY + event.clientY - dragRef.current.y,
    });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  if (paths.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--l)] bg-[var(--q)] px-6 text-center">
        <Waypoints size={22} className="text-[var(--m)]" aria-hidden="true" />
        <h3 className="mt-3 text-[14px] font-bold text-[var(--t)]">No changed file paths to map</h3>
        <p className="mt-1 max-w-lg text-[13px] leading-6 text-[var(--m)]">
          This analysis used a change description without a pull request diff. Its findings are shown below, but indexed dependency paths cannot be anchored to changed files.
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Dependency impact graph" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[11px] text-[var(--m)]">
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[var(--r)]" /> Changed</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[var(--a)]" /> Direct</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[var(--v)]" /> Indirect</span>
          {unindexed.size > 0 && <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[var(--missing)]" /> Not indexed</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <div role="group" aria-label="Impact map view" className="flex rounded-lg border border-[var(--l)] bg-[var(--q)] p-0.5">
            <button type="button" onClick={() => setView("graph")} aria-pressed={view === "graph"} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${view === "graph" ? "bg-[var(--p)] text-[var(--t)]" : "text-[var(--m)] hover:text-[var(--t)]"}`}>Graph</button>
            <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${view === "list" ? "bg-[var(--p)] text-[var(--t)]" : "text-[var(--m)] hover:text-[var(--t)]"}`}><List size={13} /> List</button>
          </div>
          {view === "graph" && (
            <>
              <button type="button" onClick={() => setZoom((value) => Math.max(0.1, value / 1.2))} aria-label="Zoom out" className="icon-button"><Minus size={15} /></button>
              <button type="button" onClick={() => setZoom((value) => Math.min(2, value * 1.2))} aria-label="Zoom in" className="icon-button"><Plus size={15} /></button>
              <button type="button" onClick={fitToView} aria-label="Fit graph to view" className="icon-button"><Maximize2 size={14} /></button>
              <button type="button" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} aria-label="Reset graph view" className="icon-button"><RotateCcw size={14} /></button>
            </>
          )}
        </div>
      </div>

      {view === "graph" ? (
        <div
          ref={viewportRef}
          className="relative h-[420px] cursor-grab overflow-hidden rounded-xl border border-[var(--l)] bg-[var(--g)] active:cursor-grabbing sm:h-[520px]"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ touchAction: "none" }}
        >
          <svg
            width={impact.width}
            height={impact.height}
            viewBox={`0 0 ${impact.width} ${impact.height}`}
            role="group"
            aria-label="Changed files and indexed dependent files"
            className="absolute left-0 top-0 max-w-none"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "top left" }}
          >
            <defs>
              <marker id="impact-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L8,4 L0,8 z" fill="var(--l)" />
              </marker>
            </defs>
            {impact.edges.map((edge, index) => {
              const from = impact.positions.get(edge.importedPath)!;
              const to = impact.positions.get(edge.sourcePath)!;
              const startX = from.x + NODE_WIDTH;
              const startY = from.y + NODE_HEIGHT / 2;
              const endX = to.x;
              const endY = to.y + NODE_HEIGHT / 2;
              const midX = (startX + endX) / 2;
              return (
                <path
                  key={`${edge.importedPath}-${edge.sourcePath}-${index}`}
                  d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                  fill="none"
                  stroke="var(--l)"
                  strokeWidth="1.5"
                  markerEnd="url(#impact-arrow)"
                />
              );
            })}
            {[...impact.positions.entries()].map(([path, position]) => {
              const selected = path === selectedPath;
              const missing = unindexed.has(path);
              const color = missing ? "var(--missing)" : position.depth === 0 ? "var(--r)" : position.depth === 1 ? "var(--a)" : "var(--v)";
              const labels = fullLabel(path);
              const findingsAtPath = findings.filter((finding) => finding.filePath === path);
              const verified = findingsAtPath.some((finding) => finding.verified);
              return (
                <g
                  key={path}
                  role="button"
                  tabIndex={0}
                  aria-label={`${position.depth === 0 ? "Changed" : position.depth === 1 ? "Direct impact" : "Indirect impact"}: ${path}`}
                  aria-pressed={selected}
                  onClick={(event) => { event.stopPropagation(); setFocusedPath(path); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setFocusedPath(path);
                    }
                  }}
                  className="cursor-pointer outline-none"
                >
                  <rect x={position.x} y={position.y} width={NODE_WIDTH} height={NODE_HEIGHT} rx="10" fill="var(--p)" stroke={color} strokeWidth={selected ? 2.5 : 1.5} />
                  <circle cx={position.x + 17} cy={position.y + 18} r="4" fill={color} />
                  <text x={position.x + 29} y={position.y + 21} fill="var(--m)" fontSize="10" className="font-mono">
                    {missing ? "CHANGED · NOT INDEXED" : position.depth === 0 ? "CHANGED FILE" : position.depth === 1 ? "DIRECT DEPENDENT" : `INDIRECT · ${position.depth} STEPS`}
                  </text>
                  {labels.map((label, index) => (
                    <text key={`${path}-${index}`} x={position.x + 14} y={position.y + (labels.length === 1 ? 45 : 41 + index * 14)} fill="var(--t)" fontSize="11" className="font-mono">
                      {label}
                    </text>
                  ))}
                  {findingsAtPath.length > 0 && (
                    <text x={position.x + NODE_WIDTH - 12} y={position.y + 19} textAnchor="end" fill={verified ? "var(--ok)" : "var(--w)"} fontSize="9" className="font-sans">
                      {verified ? "EVIDENCE" : "FINDING"}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <span className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-[var(--l)] bg-[var(--p)]/90 px-2 py-1 text-[10px] text-[var(--m)]">
            Drag to pan · {Math.round(zoom * 100)}%
          </span>
          {visiblePaths.length === paths.length && impact.edges.length === 0 && (
            <div className="pointer-events-none absolute bottom-3 right-3 max-w-[240px] rounded-lg border border-[var(--l)] bg-[var(--p)]/95 p-3 text-[11px] leading-5 text-[var(--m)]">
              No indexed dependents were found for these changed paths.
            </div>
          )}
        </div>
      ) : (
        <div className="max-h-[520px] overflow-y-auto rounded-xl border border-[var(--l)] bg-[var(--g)] p-3">
          <ol className="space-y-2">
            {visiblePaths.map((path) => {
              const depth = impact.depth.get(path) ?? 0;
              return (
                <li key={path}>
                  <button type="button" onClick={() => setFocusedPath(path)} aria-pressed={selectedPath === path} className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 text-left ${selectedPath === path ? "border-[var(--a)] bg-[var(--q)]" : "border-[var(--l)] bg-[var(--p)] hover:bg-[var(--q)]"}`}>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${unindexed.has(path) ? "bg-[var(--missing)]" : depth === 0 ? "bg-[var(--r)]" : depth === 1 ? "bg-[var(--a)]" : "bg-[var(--v)]"}`} />
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--t)]">{path}</span>
                    <span className="shrink-0 text-[10px] text-[var(--m)]">{depth === 0 ? "Changed" : depth === 1 ? "Direct" : `Indirect · ${depth}`}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {selectedPath && (
        <div className="mt-3 rounded-xl border border-[var(--l)] bg-[var(--p)] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[12px] text-[var(--m)]">{selectedPath}</p>
              <p className="mt-1 text-[12px] font-bold text-[var(--t)]">
                {unindexed.has(selectedPath)
                  ? "Changed file · not present in the indexed repository"
                  : selectedDepth === 0
                    ? "Changed file"
                    : selectedDepth === 1
                      ? "Directly affected"
                      : `Indirectly affected · ${selectedDepth} dependency steps`}
              </p>
            </div>
            {selectedFindings.length > 0 && <span className="rounded-md border border-[var(--l)] px-2 py-1 text-[10px] font-semibold text-[var(--ok)]">{selectedFindings.length} finding{selectedFindings.length === 1 ? "" : "s"}</span>}
          </div>
          {adjacentEdges.length > 0 && (
            <div className="mt-3 border-t border-[var(--l)] pt-3">
              <p className="text-[11px] font-semibold text-[var(--m)]">Indexed import relationships</p>
              <ul className="mt-2 space-y-1.5">
                {adjacentEdges.slice(0, 8).map((edge) => (
                  <li key={`${edge.sourcePath}-${edge.importedPath}`} className="break-all font-mono text-[11px] text-[var(--t)]">
                    {edge.sourcePath} <span className="text-[var(--a)]">imports</span> {edge.importedPath}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selectedFindings.map((finding) => (
            <article key={finding.id} className="mt-3 border-t border-[var(--l)] pt-3">
              <div className="flex flex-wrap items-center gap-2">
                {finding.impactType && <span className="rounded-md bg-[var(--q)] px-2 py-1 text-[10px] text-[var(--m)]">{finding.impactType}</span>}
                {typeof finding.confidence === "number" && <span className="font-mono text-[10px] text-[var(--m)]">Confidence {Math.round(finding.confidence * 100)}%</span>}
                <span className={`text-[10px] font-semibold ${finding.verified ? "text-[var(--ok)]" : "text-[var(--w)]"}`}>{finding.verified ? "Grounded" : "Unverified"}</span>
              </div>
              {finding.component && <h4 className="mt-2 text-[13px] font-bold text-[var(--t)]">{finding.component}</h4>}
              {finding.reason && <p className="mt-1 text-[12px] leading-5 text-[var(--m)]">{finding.reason}</p>}
              {finding.evidence?.map((evidence, index) => evidence.snippet && (
                <div key={`${finding.id}-${index}`} className="mt-2 overflow-hidden rounded-lg border border-[var(--l)] bg-[var(--g)]">
                  <div className="border-b border-[var(--l)] px-3 py-1.5 font-mono text-[10px] text-[var(--m)]">
                    {evidence.document?.path ?? selectedPath}
                    {evidence.chunk?.startLine != null && ` · lines ${evidence.chunk.startLine}${evidence.chunk.endLine != null && evidence.chunk.endLine !== evidence.chunk.startLine ? `–${evidence.chunk.endLine}` : ""}`}
                  </div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-5 text-[var(--t)]">{evidence.snippet}</pre>
                </div>
              ))}
            </article>
          ))}
          {selectedFindings.length === 0 && <p className="mt-2 text-[12px] text-[var(--m)]">No saved finding is attached to this path.</p>}
        </div>
      )}
    </section>
  );
}
