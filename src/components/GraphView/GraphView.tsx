import { useEffect, useRef, useCallback, useState } from 'react';
import { useEditorStore } from '../../store';
import type { GraphWorkerApi, GraphResult, GraphData, GraphNode, GraphEdge } from '../../workers/types';
import { GraphCanvas } from './GraphCanvas';
import { GraphToolbar } from './GraphToolbar';
import { GraphLegend } from './GraphLegend';
import { createLazyWorker } from '../../services/worker-factory';

const getGraphWorker = createLazyWorker<GraphWorkerApi>('graph');

export function GraphView() {
  const parsedSpec = useEditorStore((state) => state.parsedSpec);
  const graphData = useEditorStore((state) => state.graphData);
  const graphFilter = useEditorStore((state) => state.graphFilter);
  const isGraphLoading = useEditorStore((state) => state.isGraphLoading);
  const setGraphData = useEditorStore((state) => state.setGraphData);
  const setGraphLoading = useEditorStore((state) => state.setGraphLoading);
  const sourceMap = useEditorStore((state) => state.sourceMap);
  const goToLine = useEditorStore((state) => state.goToLine);

  const [includeEndpoints, setIncludeEndpoints] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!parsedSpec) {
      setGraphData(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const buildGraph = async () => {
      setGraphLoading(true);
      try {
        const worker = getGraphWorker();
        const result: GraphResult = await worker.buildGraph(parsedSpec, includeEndpoints);

        if (!controller.signal.aborted) {
          setGraphData(result.data);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Graph build error:', error);
          setGraphData(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setGraphLoading(false);
        }
      }
    };

    buildGraph();

    return () => {
      controller.abort();
    };
  }, [parsedSpec, includeEndpoints, setGraphData, setGraphLoading]);

  const handleNodeClick = useCallback(
    (_nodeId: string, jsonPath: string) => {
      const position = sourceMap[jsonPath];
      if (position) {
        goToLine(position.line, position.column);
      }
    },
    [sourceMap, goToLine]
  );

  const filteredData = graphData
    ? filterGraphData(graphData, graphFilter)
    : null;

  if (!parsedSpec) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950 text-zinc-500">
        No valid specification to visualise
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <GraphToolbar
        includeEndpoints={includeEndpoints}
        onToggleEndpoints={setIncludeEndpoints}
        nodeCount={filteredData?.nodes.length ?? 0}
        edgeCount={filteredData?.edges.length ?? 0}
        isLoading={isGraphLoading}
      />

      <div className="flex-1 relative min-h-0">
        {isGraphLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 text-zinc-400">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Building graph...</span>
            </div>
          </div>
        ) : filteredData && filteredData.nodes.length > 0 ? (
          <GraphCanvas data={filteredData} onNodeClick={handleNodeClick} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
            {graphFilter !== 'all' ? 'No schemas match the current filter' : 'No schemas found in specification'}
          </div>
        )}
      </div>

      <GraphLegend />
    </div>
  );
}

function filterGraphData(
  data: GraphData,
  filter: 'all' | 'referenced' | 'orphaned'
): GraphData {
  if (filter === 'all') return data;

  const filteredNodes = data.nodes.filter((node: GraphNode) => {
    if (node.type === 'endpoint') return true;
    return filter === 'referenced' ? node.referenced : !node.referenced;
  });

  const nodeIds = new Set(filteredNodes.map((n: GraphNode) => n.id));
  const filteredEdges = data.edges.filter(
    (edge: GraphEdge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}
