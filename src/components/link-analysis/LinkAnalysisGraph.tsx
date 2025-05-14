// src/components/link-analysis/LinkAnalysisGraph.tsx
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
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import type { FindEntityRelationshipsOutput } from "@/ai/flows/find-entity-relationships";
import { useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Share2, ZoomIn, ZoomOut } from "lucide-react";

import dagre from 'dagre';

type IdentifiedEntityForGraph = FindEntityRelationshipsOutput['identifiedEntities'][number];
type RelationshipForGraph = FindEntityRelationshipsOutput['relationships'][number];

interface CustomNodeData {
  label: string;
  type?: string;
  isHighlighted?: boolean;
  properties?: Record<string, string>;
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
    minWidth: '120px',
    maxWidth: '220px',
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

  const propertiesStyle: React.CSSProperties = {
    ...typeStyle,
    marginTop: '5px',
    fontSize: '9px',
    textAlign: 'left',
    maxHeight: '60px',
    overflowY: 'auto',
    paddingRight: '5px'
  };

  return (
    <div style={nodeStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: '2px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{data.label}</div>
      {data.type && <div style={typeStyle}>({data.type})</div>}
      {data.properties && Object.keys(data.properties).length > 0 && (
        <div style={propertiesStyle}>
          {Object.entries(data.properties).map(([key, value]) => (
            <div key={key} style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={`${key}: ${String(value)}`}>
              <span style={{fontWeight: 500}}>{`${key.substring(0,15)}${key.length > 15 ? '...' : ''}`}: </span>
              {String(value).substring(0,20)}{String(value).length > 20 ? '...' : ''}
            </div>
          ))}
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
    relationshipsData: RelationshipForGraph[];
    identifiedEntitiesData: IdentifiedEntityForGraph[];
}

interface EdgeData {
  label: string;
  type?: string;
  strength?: number;
  properties?: Record<string, string>;
  direction?: "direcional" | "bidirecional" | "nao_direcional";
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 120, ranksep: 120, marginx: 20, marginy: 20 });

  nodes.forEach((node) => {
    let height = 60;
    if (node.data.type) height += 15;
    if (node.data.properties && Object.keys(node.data.properties).length > 0) {
        height += Math.min(3, Object.keys(node.data.properties).length) * 12;
    }
    height = Math.min(height, 150); 
    dagreGraph.setNode(node.id, { width: 180, height: Math.max(70, height) }); 
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
        ...node,
        targetPosition: isHorizontal ? 'left' : 'top',
        sourcePosition: isHorizontal ? 'right' : 'bottom',
        position: { x: nodeWithPosition.x - (180/2), y: nodeWithPosition.y - (nodeWithPosition.height/2) },
    };
  });

  return { nodes: layoutedNodes, edges: [...edges] }; 
};

function InnerGraph({ relationshipsData, identifiedEntitiesData }: LinkAnalysisGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>([]);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  React.useEffect(() => {
    console.log("[InnerGraph] Props received - identifiedEntitiesData (count, sample IDs):", 
      identifiedEntitiesData?.length, 
      identifiedEntitiesData?.slice(0,5).map(e => e.id)
    );
    console.log("[InnerGraph] Props received - relationshipsData (count, sample source/target):", 
      relationshipsData?.length,
      relationshipsData?.slice(0,5).map(r => ({ source: r.source, target: r.target, label: r.label }))
    );
  }, [identifiedEntitiesData, relationshipsData]);


  useEffect(() => {
    console.log("[LinkAnalysisGraph] useEffect triggered by data change. identifiedEntitiesData count:", identifiedEntitiesData?.length, "relationshipsData count:", relationshipsData?.length);

    if (!identifiedEntitiesData || !relationshipsData) {
      console.warn("[LinkAnalysisGraph] Data is null or incomplete. Setting empty nodes/edges.");
      setNodes([]);
      setEdges([]);
      return;
    }
    
    const finalNodes: Node<CustomNodeData>[] = identifiedEntitiesData.map(entity => ({
      id: entity.id, // This ID *must* be the final, sanitized ID used by ReactFlow
      type: 'custom',
      data: {
        label: entity.label,
        type: entity.type,
        properties: entity.properties,
      },
      position: { x: Math.random() * 400, y: Math.random() * 400 }, // Initial position, will be overwritten by layout
    }));
    
    console.log("[LinkAnalysisGraph] Processed nodes for React Flow (IDs should be final):", finalNodes.map(n => ({id: n.id, label: n.data.label})));

    const nodeIds = new Set(finalNodes.map(n => n.id)); // Create a set of valid node IDs for quick lookup

    const finalEdges: Edge<EdgeData>[] = relationshipsData
    .filter(rel => {
        if (!rel.source || !rel.target) {
            console.warn(`[LinkAnalysisGraph] Relationship in props has missing source ('${rel.source}') or target ('${rel.target}'). Relation:`, rel);
            return false;
        }
        // IMPORTANT: Check if the source and target IDs from relationshipsData exist in the finalNodes
        const sourceExists = nodeIds.has(rel.source);
        const targetExists = nodeIds.has(rel.target);
        
        if (!sourceExists) {
            console.warn(`[LinkAnalysisGraph] Edge prop filtered: Source node ID '${rel.source}' for relation '${rel.label}' not found in finalNodes. Node IDs present: [${Array.from(nodeIds).join(', ')}]`);
        }
        if (!targetExists) {
            console.warn(`[LinkAnalysisGraph] Edge prop filtered: Target node ID '${rel.target}' for relation '${rel.label}' not found in finalNodes. Node IDs present: [${Array.from(nodeIds).join(', ')}]`);
        }
        return sourceExists && targetExists;
    })
    .map((rel, index) => ({ 
      id: rel.id || `edge-${index}-${rel.source}-${rel.target}`, 
      source: rel.source, // This should be a valid node ID from finalNodes
      target: rel.target, // This should be a valid node ID from finalNodes
      label: rel.label,
      type: 'smoothstep', 
      animated: rel.strength !== undefined && rel.strength > 0.75,
      markerEnd: rel.direction === "direcional" || rel.direction === "bidirecional" ? {
          type: MarkerType.ArrowClosed,
          width: 15, // Adjusted size
          height: 15, // Adjusted size
          color: 'hsl(var(--primary))',
      } : undefined,
      markerStart: rel.direction === "bidirecional" ? {
          type: MarkerType.ArrowClosed,
          width: 15, // Adjusted size
          height: 15, // Adjusted size
          color: 'hsl(var(--primary))',
      } : undefined,
      style: {
        strokeWidth: rel.strength !== undefined ? Math.max(1, 1 + (rel.strength * 2)) : 1.5, 
        stroke: rel.strength !== undefined && rel.strength < 0.3 ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))',
        opacity: rel.strength !== undefined ? Math.max(0.3, 0.4 + (rel.strength * 0.6)) : 0.8, 
      },
      data: { 
        label: rel.label,
        type: rel.type,
        strength: rel.strength,
        properties: rel.properties,
        direction: rel.direction
      }
    }));
    
    console.log("[LinkAnalysisGraph] Processed edges for React Flow (source/target should be final node IDs):", finalEdges.map(e => ({id: e.id, source: e.source, target: e.target, label: e.label})));

    if (finalNodes.length > 0) {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(finalNodes, finalEdges, 'TB');
        setNodes(layoutedNodes);
        setEdges(layoutedEdges); 
        console.log("[LinkAnalysisGraph] Nodes set for React Flow:", layoutedNodes.length, "Edges set:", layoutedEdges.length);
        if (layoutedEdges.length === 0 && relationshipsData.length > 0) {
            console.warn("[LinkAnalysisGraph] Original relationshipsData had items, but finalEdges is empty. Check filtering logic and ID matching. This is the most common reason for missing edges.");
        }
        setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 200); 
    } else {
        console.warn("[LinkAnalysisGraph] No nodes to layout, setting empty graph.");
        setNodes([]);
        setEdges([]);
    }

  }, [identifiedEntitiesData, relationshipsData, setNodes, setEdges, fitView]);

  const onLayout = useCallback(
    (direction: 'TB' | 'LR') => {
      if (nodes.length === 0) {
        console.warn("[LinkAnalysisGraph] onLayout called but no nodes to layout.");
        return;
      }
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        direction
      );
      setNodes([...layoutedNodes]); // Ensure new array instance
      setEdges([...layoutedEdges]); // Ensure new array instance
      console.log(`[LinkAnalysisGraph] Layout applied: ${direction}. Nodes: ${layoutedNodes.length}, Edges: ${layoutedEdges.length}`);
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 500 }); 
      }, 100);
    },
    [nodes, edges, setNodes, setEdges, fitView]
  );

  if (!identifiedEntitiesData || identifiedEntitiesData.length === 0) {
    // Optionally render a message or a placeholder if there are no entities
    return null; // Or <p>Nenhuma entidade para exibir no grafo.</p>;
  }

  return (
    <Card className="mt-6">
        <CardHeader>
            <CardTitle>Visualização dos Vínculos (Estilo i2)</CardTitle>
            <CardDescription>Grafo interativo mostrando as conexões entre as entidades identificadas. Arraste os nós, dê zoom e mova a visualização. Use os botões para reorganizar o layout.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mb-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => onLayout('TB')} title="Layout Vertical (Cima para Baixo)">
                    <LayoutGrid className="mr-1 h-4 w-4 transform rotate-90" /> Vertical (TB)
                </Button>
                <Button variant="outline" size="sm" onClick={() => onLayout('LR')} title="Layout Horizontal (Esquerda para Direita)">
                    <LayoutGrid className="mr-1 h-4 w-4" /> Horizontal (LR)
                </Button>
                 <Button variant="outline" size="sm" onClick={() => fitView({padding: 0.2, duration: 300})} title="Ajustar à Tela">
                    <Share2 className="mr-1 h-4 w-4" /> Ajustar
                </Button>
                 <Button variant="outline" size="sm" onClick={() => zoomIn({duration:300})} title="Aumentar Zoom">
                    <ZoomIn className="mr-1 h-4 w-4" />
                </Button>
                 <Button variant="outline" size="sm" onClick={() => zoomOut({duration:300})} title="Diminuir Zoom">
                    <ZoomOut className="mr-1 h-4 w-4" />
                </Button>
            </div>
            <div style={{ height: '700px', width: '100%' }} className="rounded-md border bg-muted/10 shadow-inner overflow-hidden">
                 <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={customNodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.2, duration: 200}}
                    nodesDraggable
                    nodesConnectable={false}
                    elementsSelectable
                    attributionPosition="bottom-right"
                    proOptions={{ hideAttribution: true }}
                    connectionLineStyle={{ stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                    defaultEdgeOptions={{
                        style: { strokeWidth: 1.5, stroke: 'hsl(var(--primary))' },
                        labelStyle: { fontSize: 10, fill: 'hsl(var(--foreground))', fontWeight: 500 },
                        labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.7 },
                        labelBgPadding: [4, 2],
                        labelBgBorderRadius: 2,
                        markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
                        type: 'smoothstep'
                    }}
                >
                    <Controls showInteractive={false} className="[&_button]:bg-card [&_button]:border-border [&_button_svg]:fill-foreground hover:[&_button]:bg-muted" />
                    <MiniMap nodeStrokeWidth={3} zoomable pannable
                        nodeColor={(n: Node<CustomNodeData>) => {
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
                        ariaLabel="Minimapa do grafo de vínculos"
                    />
                    <Background gap={16} color={cn("text-border opacity-50")} />
                </ReactFlow>
            </div>
        </CardContent>
    </Card>
  );
}
InnerGraph.displayName = "InnerGraph";


export default function LinkAnalysisGraphWrapper(props: LinkAnalysisGraphProps) {
  // Ensure data is available before rendering the provider and graph
  if (!props.identifiedEntitiesData || !props.relationshipsData) {
    // console.log("[LinkAnalysisGraphWrapper] No data to render, returning null.");
    return null; 
  }
  // console.log("[LinkAnalysisGraphWrapper] Rendering ReactFlowProvider with data:", props);
  return (
    <ReactFlowProvider>
      <InnerGraph {...props} />
    </ReactFlowProvider>
  );
}

