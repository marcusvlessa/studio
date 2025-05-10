
"use client";

import type { Edge, Node } from "reactflow";
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import type { FindEntityRelationshipsOutput } from "@/ai/flows/find-entity-relationships";
import { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface LinkAnalysisGraphProps {
  relationshipsData: FindEntityRelationshipsOutput['relationships'] | null;
}

interface NodeData {
  label: string;
  type?: string;
}

interface EdgeData {
  relationship: string;
  strength?: number;
}

export function LinkAnalysisGraph({ relationshipsData }: LinkAnalysisGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>([]);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!relationshipsData) {
      return { initialNodes: [], initialEdges: [] };
    }

    const uniqueEntities = new Map<string, Node<NodeData>>();
    const generatedEdges: Edge<EdgeData>[] = [];

    relationshipsData.forEach((rel, index) => {
      if (!uniqueEntities.has(rel.entity1)) {
        uniqueEntities.set(rel.entity1, {
          id: rel.entity1,
          type: 'default',
          data: { label: `${rel.entity1}${rel.entity1Type ? ` (${rel.entity1Type})` : ''}`, type: rel.entity1Type },
          position: { x: Math.random() * 400, y: Math.random() * 400 },
        });
      }
      if (!uniqueEntities.has(rel.entity2)) {
        uniqueEntities.set(rel.entity2, {
          id: rel.entity2,
          type: 'default',
          data: { label: `${rel.entity2}${rel.entity2Type ? ` (${rel.entity2Type})` : ''}`, type: rel.entity2Type },
          position: { x: Math.random() * 400 + 50, y: Math.random() * 400 + 50 }, // Offset slightly
        });
      }

      generatedEdges.push({
        id: `e-${rel.entity1}-${rel.entity2}-${index}`,
        source: rel.entity1,
        target: rel.entity2,
        label: rel.relationship + (rel.strength ? ` (${(rel.strength * 100).toFixed(0)}%)` : ''),
        type: 'smoothstep',
        markerEnd: {
            type: MarkerType.ArrowClosed,
        },
        data: {
            relationship: rel.relationship,
            strength: rel.strength
        }
      });
    });
    
    return { initialNodes: Array.from(uniqueEntities.values()), initialEdges: generatedEdges };
  }, [relationshipsData]);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);
  
  if (!relationshipsData || relationshipsData.length === 0) {
    return null; // Don't render anything if no data
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Visualização dos Vínculos</CardTitle>
            <CardDescription>Grafo interativo mostrando as conexões entre as entidades. Você pode arrastar os nós, dar zoom e mover a visualização.</CardDescription>
        </CardHeader>
        <CardContent>
            <div style={{ height: '600px', width: '100%' }} className="rounded-md border bg-muted/10 shadow-inner">
                 <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    fitView
                    nodesDraggable
                    nodesConnectable={false} // For now, not allowing new connections from UI
                    elementsSelectable
                >
                    <Controls />
                    <MiniMap nodeStrokeWidth={3} zoomable pannable />
                    <Background gap={16} color="hsl(var(--border))" />
                </ReactFlow>
            </div>
        </CardContent>
    </Card>
  );
}
