
"use client";

import type { Edge, Node, NodeProps } from "reactflow";
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
import { cn } from "@/lib/utils";


interface CustomNodeData {
  label: string; // Entity name
  type?: string;  // Entity type
  isHighlighted?: boolean;
}


const CustomNodeComponent = ({ data }: NodeProps<CustomNodeData>) => {
  // Basic styling, can be expanded
  const nodeStyle: React.CSSProperties = {
    padding: '10px 15px',
    borderRadius: '8px',
    border: data.isHighlighted ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
    background: 'hsl(var(--card))',
    color: 'hsl(var(--card-foreground))',
    fontSize: '12px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    minWidth: '120px',
    maxWidth: '250px',
  };

  const typeStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'hsl(var(--muted-foreground))',
    marginTop: '4px',
    fontStyle: 'italic',
  };

  return (
    <div style={nodeStyle}>
      <div style={{ fontWeight: 'bold' }}>{data.label}</div>
      {data.type && <div style={typeStyle}>({data.type})</div>}
    </div>
  );
};

const nodeTypes = {
  custom: CustomNodeComponent,
};

interface LinkAnalysisGraphProps {
    relationshipsData: FindEntityRelationshipsOutput['relationships'];
}

interface EdgeData {
  relationship: string;
  strength?: number;
}

export function LinkAnalysisGraph({ relationshipsData }: LinkAnalysisGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>([]);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!relationshipsData) {
      return { initialNodes: [], initialEdges: [] };
    }

    const uniqueEntities = new Map<string, Node<CustomNodeData>>();
    const generatedEdges: Edge<EdgeData>[] = [];

    relationshipsData.forEach((rel, index) => {
      if (!uniqueEntities.has(rel.entity1)) {
        uniqueEntities.set(rel.entity1, {
          id: rel.entity1,
          type: 'custom',
          data: { label: rel.entity1, type: rel.entity1Type || "Desconhecido" },
          position: { x: 0, y: 0 }, // Placeholder, will be set below
        });
      }
      if (!uniqueEntities.has(rel.entity2)) {
        uniqueEntities.set(rel.entity2, {
          id: rel.entity2,
          type: 'custom',
          data: { label: rel.entity2, type: rel.entity2Type || "Desconhecido" },
          position: { x: 0, y: 0 }, // Placeholder
        });
      }

      generatedEdges.push({
        id: `e-${rel.entity1}-${rel.entity2}-${index}`,
        source: rel.entity1,
        target: rel.entity2,
        label: rel.relationship + (rel.strength ? ` (${(rel.strength * 100).toFixed(0)}%)` : ''),
        type: 'smoothstep',
        animated: rel.strength && rel.strength > 0.7,
        markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: 'hsl(var(--primary))',
        },
        style: {
          strokeWidth: rel.strength ? Math.max(1, rel.strength * 3) : 1.5,
          stroke: rel.strength && rel.strength < 0.3 ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))',
        },
        labelStyle: { fill: 'hsl(var(--foreground))', fontWeight: 500, fontSize: '10px' },
        labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.7 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 2,
        data: {
            relationship: rel.relationship,
            strength: rel.strength
        }
      });
    });
    
    // Basic grid layout for nodes
    const nodesArray = Array.from(uniqueEntities.values());
    const numNodes = nodesArray.length;
    const nodesPerRow = Math.max(1, Math.ceil(Math.sqrt(numNodes)));
    const xSpacing = 250; // Horizontal spacing between nodes
    const ySpacing = 150; // Vertical spacing between nodes

    nodesArray.forEach((node, index) => {
      const row = Math.floor(index / nodesPerRow);
      const col = index % nodesPerRow;
      node.position = { x: col * xSpacing, y: row * ySpacing };
    });
    
    return { initialNodes: nodesArray, initialEdges: generatedEdges };
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
            <CardDescription>Grafo interativo mostrando as conexões entre as entidades. Você pode arrastar os nós, dar zoom e mover a visualização. Os tipos de entidade são inferidos pela IA.</CardDescription>
        </CardHeader>
        <CardContent>
            <div style={{ height: '600px', width: '100%' }} className="rounded-md border bg-muted/10 shadow-inner">
                 <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    nodesDraggable
                    nodesConnectable={false} 
                    elementsSelectable
                    attributionPosition="bottom-right"
                    proOptions={{ hideAttribution: true }} // Hides "React Flow" attribution if you have a pro license
                >
                    <Controls showInteractive={false} />
                    <MiniMap nodeStrokeWidth={3} zoomable pannable nodeColor={(n) => {
                        const typeLower = n.data?.type?.toLowerCase();
                        if (typeLower?.includes('pessoa')) return 'hsl(var(--chart-1))';
                        if (typeLower?.includes('organiza')) return 'hsl(var(--chart-2))';
                        if (typeLower?.includes('local')) return 'hsl(var(--chart-3))';
                        if (typeLower?.includes('telefon') || typeLower?.includes('número') || typeLower?.includes('imei')) return 'hsl(var(--chart-4))';
                        if (typeLower?.includes('financeir') || typeLower?.includes('conta') || typeLower?.includes('valor')) return 'hsl(var(--chart-5))';
                        if (typeLower?.includes('ip') || typeLower?.includes('email') || typeLower?.includes('site')) return 'hsl(var(--accent))';
                        return 'hsl(var(--muted))';
                    }}/>
                    <Background gap={16} color={cn("text-border")} />
                </ReactFlow>
            </div>
        </CardContent>
    </Card>
  );
}

