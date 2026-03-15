/**
 * StoryTreeOverlay
 *
 * A full-screen overlay that renders the book's branching narrative tree.
 *
 * - Nodes are laid out in a top-down tree using a simple recursive layout algorithm.
 * - Visited nodes (in choiceHistory or currentPageIndex) are highlighted.
 * - Unvisited branches are shown as dimmed/greyed-out.
 * - Ending nodes (no choices, no next pages) are shown with a trophy icon.
 * - Clicking a visited node navigates to that page.
 */

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { X, BookOpen, GitBranch, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Page {
  id: number;
  choiceA?: string | null;
  choiceB?: string | null;
  nextPageIdA?: number | null;
  nextPageIdB?: number | null;
  content?: string | null;
}

interface StoryTreeOverlayProps {
  pages: Page[];
  currentPageIndex: number;
  choiceHistory: number[];
  onClose: () => void;
  onNavigate: (index: number) => void;
}

// ── Tree layout types ──────────────────────────────────────────────────────

interface TreeNode {
  pageIndex: number;
  pageId: number;
  x: number;
  y: number;
  children: TreeNode[];
  isEnding: boolean;
  visited: boolean;
  isCurrent: boolean;
  choiceLabel?: string; // "A" or "B" — label on the edge from parent
}

// ── Layout constants ────────────────────────────────────────────────────────

const NODE_W = 64;
const NODE_H = 36;
const H_GAP  = 24;   // horizontal gap between sibling subtrees
const V_GAP  = 72;   // vertical gap between levels

// ── Recursive subtree width calculation ────────────────────────────────────

function subtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) return NODE_W;
  const childrenWidth = node.children.reduce(
    (sum, c) => sum + subtreeWidth(c) + H_GAP,
    -H_GAP
  );
  return Math.max(NODE_W, childrenWidth);
}

// ── Assign x/y positions recursively ───────────────────────────────────────

function assignPositions(node: TreeNode, x: number, y: number) {
  node.y = y;
  if (node.children.length === 0) {
    node.x = x;
    return;
  }
  const totalW = node.children.reduce(
    (sum, c) => sum + subtreeWidth(c) + H_GAP,
    -H_GAP
  );
  let cx = x - totalW / 2;
  for (const child of node.children) {
    const sw = subtreeWidth(child);
    assignPositions(child, cx + sw / 2, y + V_GAP + NODE_H);
    cx += sw + H_GAP;
  }
  // Center parent over children
  const firstX = node.children[0].x;
  const lastX  = node.children[node.children.length - 1].x;
  node.x = (firstX + lastX) / 2;
}

// ── Build tree from pages array ─────────────────────────────────────────────

function buildTree(
  pages: Page[],
  visitedSet: Set<number>,
  currentIdx: number
): { root: TreeNode | null; allNodes: TreeNode[]; allEdges: Array<{ from: TreeNode; to: TreeNode; label: string }> } {
  if (pages.length === 0) return { root: null, allNodes: [], allEdges: [] };

  const idToIndex = new Map<number, number>();
  pages.forEach((p, i) => idToIndex.set(p.id, i));

  const allNodes: TreeNode[] = [];
  const allEdges: Array<{ from: TreeNode; to: TreeNode; label: string }> = [];
  const built = new Map<number, TreeNode>();

  function buildNode(pageIndex: number, visited: boolean): TreeNode {
    if (built.has(pageIndex)) return built.get(pageIndex)!;

    const page = pages[pageIndex];
    const isEnding = !page.choiceA && !page.choiceB && !page.nextPageIdA && !page.nextPageIdB;

    const node: TreeNode = {
      pageIndex,
      pageId: page.id,
      x: 0,
      y: 0,
      children: [],
      isEnding,
      visited,
      isCurrent: pageIndex === currentIdx,
    };
    built.set(pageIndex, node);
    allNodes.push(node);

    // Recurse into branches
    const branches: Array<{ nextId: number | null | undefined; label: string }> = [
      { nextId: page.nextPageIdA, label: page.choiceA ? "A" : "" },
      { nextId: page.nextPageIdB, label: page.choiceB ? "B" : "" },
    ];

    for (const branch of branches) {
      if (!branch.nextId) continue;
      const childIdx = idToIndex.get(branch.nextId);
      if (childIdx === undefined) continue;
      const childVisited = visited && visitedSet.has(childIdx);
      const child = buildNode(childIdx, childVisited);
      node.children.push(child);
      allEdges.push({ from: node, to: child, label: branch.label });
    }

    return node;
  }

  const root = buildNode(0, visitedSet.has(0) || currentIdx === 0);
  return { root, allNodes, allEdges };
}

// ── Flatten all nodes for SVG bounds ───────────────────────────────────────

function collectNodes(node: TreeNode, out: TreeNode[] = []): TreeNode[] {
  out.push(node);
  node.children.forEach(c => collectNodes(c, out));
  return out;
}

// ── Component ──────────────────────────────────────────────────────────────

export function StoryTreeOverlay({
  pages,
  currentPageIndex,
  choiceHistory,
  onClose,
  onNavigate,
}: StoryTreeOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);

  const zoomIn  = useCallback(() => setZoom(z => Math.min(z + 0.2, 3)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(z - 0.2, 0.3)), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  // Escape key closes the overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
      if (e.key === "0") zoomReset();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, zoomIn, zoomOut, zoomReset]);

  const visitedSet = useMemo(() => {
    const s = new Set<number>(choiceHistory);
    s.add(currentPageIndex);
    return s;
  }, [choiceHistory, currentPageIndex]);

  const { root, allEdges } = useMemo(() => {
    return buildTree(pages, visitedSet, currentPageIndex);
  }, [pages, visitedSet, currentPageIndex]);

  // Assign positions
  const flatNodes = useMemo(() => {
    if (!root) return [];
    assignPositions(root, 0, 0);
    return collectNodes(root);
  }, [root]);

  // SVG viewport
  const { minX, minY, svgW, svgH } = useMemo(() => {
    if (flatNodes.length === 0) return { minX: 0, minY: 0, svgW: 400, svgH: 200 };
    const xs = flatNodes.map(n => n.x);
    const ys = flatNodes.map(n => n.y);
    const pad = 60;
    const minX = Math.min(...xs) - NODE_W / 2 - pad;
    const minY = Math.min(...ys) - NODE_H / 2 - pad;
    const maxX = Math.max(...xs) + NODE_W / 2 + pad;
    const maxY = Math.max(...ys) + NODE_H / 2 + pad;
    return { minX, minY, svgW: maxX - minX, svgH: maxY - minY };
  }, [flatNodes]);

  // Auto-scroll to current node
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const currentNode = flatNodes.find(n => n.isCurrent);
    if (!currentNode) return;
    const container = svg.parentElement;
    if (!container) return;
    const scaleX = container.clientWidth / svgW;
    const scaleY = container.clientHeight / svgH;
    const scale = Math.min(scaleX, scaleY, 1);
    const cx = (currentNode.x - minX) * scale;
    const cy = (currentNode.y - minY) * scale;
    container.scrollTo({
      left: cx - container.clientWidth / 2,
      top:  cy - container.clientHeight / 2,
      behavior: "smooth",
    });
  }, [flatNodes, minX, minY, svgW, svgH]);

  const visitedCount = flatNodes.filter(n => n.visited).length;
  const endingCount  = flatNodes.filter(n => n.isEnding).length;
  const visitedEndings = flatNodes.filter(n => n.isEnding && n.visited).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Story Map"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-purple-900/40 bg-[#0D0B1A]/90">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-[#7C3AED]" />
          <h2 className="text-lg font-bold text-white">Story Map</h2>
          <span className="text-xs text-gray-400 bg-purple-900/30 px-2 py-0.5 rounded-full">
            {visitedCount} / {flatNodes.length} pages visited
          </span>
          {endingCount > 0 && (
            <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">
              {visitedEndings} / {endingCount} endings found
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            className="text-gray-400 hover:text-white h-8 w-8 p-0"
            aria-label="Zoom out (-)" title="Zoom out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <button
            onClick={zoomReset}
            className="text-xs text-gray-400 hover:text-white w-10 text-center tabular-nums"
            title="Reset zoom (0)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            className="text-gray-400 hover:text-white h-8 w-8 p-0"
            aria-label="Zoom in (+)" title="Zoom in (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomReset}
            className="text-gray-400 hover:text-white h-8 w-8 p-0 ml-1"
            aria-label="Reset zoom" title="Reset zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <div className="w-px h-5 bg-gray-700 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white h-8 w-8 p-0"
            aria-label="Close story map (Esc)"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-6 py-2 bg-[#0D0B1A]/70 text-xs text-gray-400 border-b border-purple-900/20">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#7C3AED] inline-block" />
          Current page
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#4B2D8A] inline-block" />
          Visited
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#1A1033] border border-gray-600 inline-block" />
          Undiscovered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#F59E0B] inline-block" />
          Ending
        </span>
        <span className="text-gray-500 ml-auto">Click a visited node to jump to that page</span>
      </div>

      {/* SVG Tree */}
      <div className="flex-1 overflow-auto p-4" style={{ scrollBehavior: "smooth" }}>
        {flatNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
            <BookOpen className="w-12 h-12 opacity-30" />
            <p className="text-sm">No story pages yet.</p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
            width={svgW * zoom}
            height={svgH * zoom}
            className="mx-auto block transition-all duration-200"
            style={{ minWidth: svgW * zoom, minHeight: svgH * zoom }}
          >
            {/* Edges */}
            {allEdges.map((edge, i) => {
              const x1 = edge.from.x;
              const y1 = edge.from.y + NODE_H / 2;
              const x2 = edge.to.x;
              const y2 = edge.to.y - NODE_H / 2;
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              const isVisited = edge.from.visited && edge.to.visited;
              return (
                <g key={i}>
                  <path
                    d={`M ${x1} ${y1} C ${x1} ${y1 + V_GAP * 0.4}, ${x2} ${y2 - V_GAP * 0.4}, ${x2} ${y2}`}
                    fill="none"
                    stroke={isVisited ? "#7C3AED" : "#2D1B69"}
                    strokeWidth={isVisited ? 2 : 1}
                    strokeDasharray={isVisited ? undefined : "4 3"}
                    opacity={isVisited ? 0.9 : 0.4}
                  />
                  {/* Edge label (A / B) */}
                  {edge.label && (
                    <text
                      x={mx}
                      y={my}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fill={isVisited ? "#F59E0B" : "#6B7280"}
                      fontWeight="bold"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {flatNodes.map(node => {
              const nx = node.x - NODE_W / 2;
              const ny = node.y - NODE_H / 2;
              const isCurrentNode = node.isCurrent;
              const isVisited = node.visited;
              const isEnding = node.isEnding;

              const fill = isCurrentNode
                ? "#7C3AED"
                : isVisited
                ? "#4B2D8A"
                : "#1A1033";
              const stroke = isCurrentNode
                ? "#A78BFA"
                : isEnding
                ? "#F59E0B"
                : isVisited
                ? "#6D28D9"
                : "#374151";
              const strokeWidth = isCurrentNode ? 2.5 : isEnding ? 2 : 1;
              const opacity = isVisited ? 1 : 0.5;

              return (
                <g
                  key={node.pageIndex}
                  transform={`translate(${nx}, ${ny})`}
                  style={{ cursor: isVisited ? "pointer" : "default" }}
                  onClick={() => {
                    if (isVisited) onNavigate(node.pageIndex);
                  }}
                  role={isVisited ? "button" : undefined}
                  aria-label={isVisited ? `Go to page ${node.pageIndex + 1}` : `Undiscovered page`}
                  tabIndex={isVisited ? 0 : undefined}
                  onKeyDown={e => {
                    if (isVisited && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onNavigate(node.pageIndex);
                    }
                  }}
                >
                  {/* Node background */}
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={isEnding ? NODE_H / 2 : 6}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                  />

                  {/* Ending trophy icon */}
                  {isEnding && (
                    <text
                      x={NODE_W / 2}
                      y={NODE_H / 2 - 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={12}
                      opacity={opacity}
                    >
                      🏆
                    </text>
                  )}

                  {/* Page number label */}
                  <text
                    x={NODE_W / 2}
                    y={isEnding ? NODE_H / 2 + 8 : NODE_H / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={isEnding ? 8 : 10}
                    fill={isCurrentNode ? "#FFFFFF" : isVisited ? "#C4B5FD" : "#6B7280"}
                    fontWeight={isCurrentNode ? "bold" : "normal"}
                    opacity={opacity}
                  >
                    {isEnding ? "End" : `p.${node.pageIndex + 1}`}
                  </text>

                  {/* "YOU ARE HERE" indicator */}
                  {isCurrentNode && (
                    <>
                      <circle
                        cx={NODE_W / 2}
                        cy={-8}
                        r={4}
                        fill="#A78BFA"
                      />
                      <line
                        x1={NODE_W / 2}
                        y1={-4}
                        x2={NODE_W / 2}
                        y2={0}
                        stroke="#A78BFA"
                        strokeWidth={1.5}
                      />
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
