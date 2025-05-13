
"use client";

import * as React from "react"; 
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
import { useEffect, useMemo, useCallback, useRef } from "react"; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Share2, ZoomIn, ZoomOut, Download } from "lucide-react";

import dagre from 'dagre';
import type { IdentifiedEntity, Relationship } from "@/ai/flows/find-entity-relationships"; // Assuming these types are exported


interface CustomNodeData {
  label: string; 
  type?: string;  
  isHighlighted?: boolean;
  properties?: Record<string, string>; // Changed from any to string based on AI flow update
}


const CustomNodeComponent = React.memo(({ data, selected }: NodeProps<CustomNodeData>) => {
  const nodeStyle: React.CSSProperties = {
    padding: '10px 15px',
    borderRadius: '8px',
    border: selected ? '2px solid hsl(var(--ring))' : (data.isHighlighted ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))'),
    background: 'hsl(var(--card))',
    color: 'hsl(var(--card-foreground))',
    fontSize: '12px',
    textAlign: 'center',
    boxShadow: selected ? '0 0 0 2px hsl(var(--ring))' : '0 2px 4px rgba(0,0,0,0.05)',
    minWidth: '100px',
    maxWidth: '200px',
    cursor: 'grab',
    transition: 'box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out',
  };

  const typeStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'hsl(var(--muted-foreground))',
    marginTop: '2px',
    fontStyle: 'italic',
    textTransform: 'capitalize',
  };

  return (
    <div style={nodeStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{data.label}</div>
      {data.type && <div style={typeStyle}>({data.type})</div>}
      {data.properties && Object.keys(data.properties).length > 0 && (
        <div style={{...typeStyle, marginTop: '4px', fontSize: '9px', textAlign: 'left'}}>
          {Object.entries(data.properties).slice(0,2).map(([key, value]) => (
            <div key={key} style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={`${key}: ${String(value)}`}>{`${key.substring(0,10)}: ${String(value).substring(0,15)}...`}</div>
          ))}
           {Object.keys(data.properties).length > 2 && <div>...</div>}
        </div>
      )}
    </div>
  );
});
CustomNodeComponent.displayName = 'CustomNode';


const customNodeTypes = {
  custom: CustomNodeComponent,
};

interface LinkAnalysisGraphProps {
    relationshipsData: Relationship[]; // Use specific type from AI flow
    identifiedEntitiesData: IdentifiedEntity[]; // Use specific type from AI flow
}

interface EdgeData {
  label: string;
  type?: string;
  strength?: number;
  properties?: Record<string, string>; // Changed to string
  direction?: "direcional" | "bidirecional" | "nao_direcional";
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 100 }); 

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 180, height: 70 + (node.data.properties && Object.keys(node.data.properties).length > 0 ? 20 * Math.min(2, Object.keys(node.data.properties).length) : 0) }); 
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? 'left' : 'top';
    node.sourcePosition = isHorizontal ? 'right' : 'bottom';
    node.position = { x: nodeWithPosition.x - (180/2), y: nodeWithPosition.y - ( (70 + (node.data.properties && Object.keys(node.data.properties).length > 0 ? 20 * Math.min(2, Object.keys(node.data.properties).length) : 0))/2 ) };
  });

  return { nodes: [...nodes], edges: [...edges] };
};


export function LinkAnalysisGraph({ relationshipsData, identifiedEntitiesData }: LinkAnalysisGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>([]);
  const reactFlowInstance = useRef<any>(null);


  useEffect(() => {
    if (!identifiedEntitiesData || !relationshipsData) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const generatedNodes: Node<CustomNodeData>[] = identifiedEntitiesData.map(entity => ({
      id: entity.id, 
      type: 'custom',
      data: { 
        label: entity.label, 
        type: entity.type,
        properties: typeof entity.properties === 'object' && entity.properties !== null ? entity.properties : {}
      },
      position: { x: Math.random() * 400, y: Math.random() * 400 }, 
    }));

    const generatedEdges: Edge<EdgeData>[] = relationshipsData
    .filter(rel => rel.source && rel.target && generatedNodes.find(n => n.id === rel.source) && generatedNodes.find(n => n.id === rel.target)) 
    .map((rel, index) => ({
      id: `edge-${rel.source}-${rel.target}-${index}-${rel.label.replace(/[^a-zA-Z0-9]/g, '')}`, 
      source: rel.source,
      target: rel.target,
      label: rel.label,
      type: 'smoothstep', 
      animated: rel.strength !== undefined && rel.strength > 0.7,
      markerEnd: rel.direction === "direcional" || rel.direction === "bidirecional" ? {
          type: MarkerType.ArrowClosed,
          width: 15, 
          height: 15, 
          color: 'hsl(var(--primary))',
      } : undefined,
      markerStart: rel.direction === "bidirecional" ? { 
          type: MarkerType.ArrowClosed,
          width: 15, 
          height: 15, 
          color: 'hsl(var(--primary))',
      } : undefined,
      style: {
        strokeWidth: rel.strength !== undefined ? 1 + (rel.strength * 2) : 1.5, 
        stroke: rel.strength !== undefined && rel.strength < 0.5 ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))',
        opacity: rel.strength !== undefined ? 0.6 + (rel.strength * 0.4) : 0.8,
      },
      data: {
        label: rel.label,
        type: rel.type,
        strength: rel.strength,
        properties: typeof rel.properties === 'object' && rel.properties !== null ? rel.properties : {},
        direction: rel.direction
      }
    }));
    
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(generatedNodes, generatedEdges, 'TB');
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

  }, [identifiedEntitiesData, relationshipsData, setNodes, setEdges]);

  const onLayout = useCallback(
    (direction: 'TB' | 'LR') => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        direction
      );
      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
      
      setTimeout(() => {
        if (reactFlowInstance.current) {
          reactFlowInstance.current.fitView({ padding: 0.1, duration: 500 });
        }
      }, 0);
    },
    [nodes, edges, setNodes, setEdges]
  );
  
  if (!identifiedEntitiesData || identifiedEntitiesData.length === 0) {
    return null; 
  }

  return (
    <Card className="mt-6">
        <CardHeader>
            <CardTitle>Visualização dos Vínculos (Estilo i2)</CardTitle>
            <CardDescription>Grafo interativo mostrando as conexões entre as entidades identificadas e classificadas pela IA. Arraste os nós, dê zoom e mova a visualização. Use os botões para reorganizar o layout.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mb-2 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onLayout('TB')} title="Layout Vertical">
                    <LayoutGrid className="mr-1 h-4 w-4 transform rotate-90" /> Vertical
                </Button>
                <Button variant="outline" size="sm" onClick={() => onLayout('LR')} title="Layout Horizontal">
                    <LayoutGrid className="mr-1 h-4 w-4" /> Horizontal
                </Button>
                 <Button variant="outline" size="sm" onClick={() => reactFlowInstance.current?.fitView({padding: 0.1, duration: 300})} title="Ajustar Visualização">
                    <Share2 className="mr-1 h-4 w-4" /> Ajustar
                </Button>
                 <Button variant="outline" size="sm" onClick={() => reactFlowInstance.current?.zoomIn({duration:300})} title="Zoom In">
                    <ZoomIn className="mr-1 h-4 w-4" /> 
                </Button>
                 <Button variant="outline" size="sm" onClick={() => reactFlowInstance.current?.zoomOut({duration:300})} title="Zoom Out">
                    <ZoomOut className="mr-1 h-4 w-4" /> 
                </Button>
            </div>
            <div style={{ height: '700px', width: '100%' }} className="rounded-md border bg-muted/10 shadow-inner">
                 <ReactFlow
                    ref={reactFlowInstance}
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={customNodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.1, duration: 500}}
                    nodesDraggable
                    nodesConnectable={false} 
                    elementsSelectable
                    attributionPosition="bottom-right"
                    proOptions={{ hideAttribution: true }} 
                    connectionLineStyle={{ stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                    defaultEdgeOptions={{
                        style: { strokeWidth: 1.5, stroke: 'hsl(var(--primary))' },
                        markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
                        type: 'smoothstep'
                    }}
                >
                    <Controls showInteractive={false} className="[&_button]:bg-card [&_button]:border-border [&_button_svg]:fill-foreground hover:[&_button]:bg-muted" />
                    <MiniMap nodeStrokeWidth={3} zoomable pannable 
                        nodeColor={(n) => {
                            const typeLower = n.data?.type?.toLowerCase() || '';
                            if (typeLower.includes('pessoa') || typeLower.includes('organiza')) return 'hsl(var(--chart-1))';
                            if (typeLower.includes('local')) return 'hsl(var(--chart-3))';
                            if (typeLower.includes('telefon') || typeLower.includes('imei') || typeLower.includes('erb')) return 'hsl(var(--chart-4))';
                            if (typeLower.includes('financeir') || typeLower.includes('conta') || typeLower.includes('pix') || typeLower.includes('transa')) return 'hsl(var(--chart-5))';
                            if (typeLower.includes('ip') || typeLower.includes('email') || typeLower.includes('site') || typeLower.includes('digital')) return 'hsl(var(--accent))';
                            if (typeLower.includes('veículo') || typeLower.includes('item')) return 'hsl(var(--chart-2))';
                            if (typeLower.includes('evento') || typeLower.includes('documento')) return 'hsl(var(--secondary-foreground))';
                            return 'hsl(var(--muted-foreground))';
                        }}
                        className="!bg-background !border-border"
                    />
                    <Background gap={16} color={cn("text-border opacity-50")} />
                </ReactFlow>
            </div>
        </CardContent>
    </Card>
  );
}

