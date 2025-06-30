import React, { useState, useMemo, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';

interface Triplet {
  subject: string;
  predicate: string;
  object: string;
}

interface Node {
  id: string;
  label: string;
  type: 'entity' | 'property';
  x: number;
  y: number;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  label: string;
}

interface TripletGraphViewerProps {
  content: string;
}

// Drag state
interface DragState {
  isDragging: boolean;
  draggedNodeId: string | null;
  startPos: { x: number; y: number };
  offset: { x: number; y: number };
  currentPos?: { x: number; y: number }; // Add current drag position
}

const TripletGraphViewer: React.FC<TripletGraphViewerProps> = ({ content }) => {
  const [selectedTriplet, setSelectedTriplet] = useState<number | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedNodeId: null,
    startPos: { x: 0, y: 0 },
    offset: { x: 0, y: 0 }
  });
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<{ show: boolean; content: string; x: number; y: number }>({
    show: false,
    content: '',
    x: 0,
    y: 0
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [isViewDragging, setIsViewDragging] = useState(false);
  const [viewDragStart, setViewDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Parse triplet data
  const triplets = useMemo(() => {
    // First check special markers
    const extractGraphContent = (text: string): string => {
      const graphStartPattern = /<Graph\s+START>/i;
      const graphEndPattern = /<Graph\s+END>/i;
      
      const startMatch = text.match(graphStartPattern);
      const endMatch = text.match(graphEndPattern);
      
      if (startMatch && endMatch && startMatch.index !== undefined && endMatch.index !== undefined) {
        const startIndex = startMatch.index + startMatch[0].length;
        const endIndex = endMatch.index;
        
        if (startIndex < endIndex) {
          return text.substring(startIndex, endIndex).trim();
        }
      }
      
      return text;
    };

    const graphContent = extractGraphContent(content);
    
    // Try to parse JSON format
    try {
      const parsed = JSON.parse(graphContent);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          subject: item.subject || item[0] || '',
          predicate: item.predicate || item[1] || '',
          object: item.object || item[2] || ''
        }));
      }
      if (parsed.triplets && Array.isArray(parsed.triplets)) {
        return parsed.triplets;
      }
    } catch (e) {
      // JSON parsing failed, continue trying other formats
    }

    // Parse triplets in parentheses format
    const patterns = [
      /\(([^,)]+),\s*"([^"]*)",\s*"([^"]*)",\s*([^)]+)\)/g,
      /\(([^,)]+),\s*([^,)]+),\s*([^,)]+),\s*([^)]+)\)/g,
      /\(([^,)]+),\s*"([^"]*)",\s*"([^"]*)"\)/g,
      /\(([^,)]+),\s*([^,)]+),\s*([^)]+)\)/g
    ];

    const results: Triplet[] = [];
    
    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex state
      
      while ((match = pattern.exec(graphContent)) !== null) {
        if (match.length >= 4) {
          results.push({
            subject: match[1].trim(),
            predicate: match[2].trim(),
            object: match[3].trim()
          });
        }
      }
    }

    // If no standard format found, try parsing line by line
    if (results.length === 0) {
      const lines = graphContent.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        // Try various separators
        const separators = [',', '|', '\t', '->'];
        
        for (const sep of separators) {
          const parts = line.split(sep).map(p => p.trim());
          if (parts.length >= 3) {
            results.push({
              subject: parts[0].replace(/[()\"]/g, ''),
              predicate: parts[1].replace(/[()\"]/g, ''),
              object: parts[2].replace(/[()\"]/g, '')
            });
            break;
          }
        }
      }
    }

    return results;
  }, [content]);

  // Determine if it's a property value (simple heuristic rules)
  const isProperty = (value: string): boolean => {
    return /^\d+$/.test(value) || // Pure numbers
           /^\d+(\.\d+)?%?$/.test(value) || // Numbers + percentage sign
           /^(yes|no|true|false)$/i.test(value) || // Boolean values
           value.length < 10; // Short strings are usually property values
  };

  // Force-directed layout algorithm
  const calculateForceLayout = (nodeMap: Map<string, Node>, edges: Edge[]) => {
    const nodes = Array.from(nodeMap.values());
    const width = 1000;
    const height = 700;
    const iterations = 100; // Increase iteration count
    const k = Math.sqrt((width * height) / nodes.length) * 2; // Increase ideal distance
    const c = 0.1; // Cooling factor
    
    for (let iter = 0; iter < iterations; iter++) {
      const forces = new Map<string, { x: number, y: number }>();
      
      // Initialize forces
      nodes.forEach(node => {
        forces.set(node.id, { x: 0, y: 0 });
      });
      
      // Calculate repulsion forces
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const node1 = nodes[i];
          const node2 = nodes[j];
          
          const dx = node1.x - node2.x;
          const dy = node1.y - node2.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const repulsion = (k * k) / distance * 1.5; // Increase repulsion force
          const fx = (dx / distance) * repulsion;
          const fy = (dy / distance) * repulsion;
          
          const force1 = forces.get(node1.id)!;
          const force2 = forces.get(node2.id)!;
          
          force1.x += fx;
          force1.y += fy;
          force2.x -= fx;
          force2.y -= fy;
        }
      }
      
              // Calculate attraction forces
      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        
        if (!source || !target) return;
        
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
                  const attraction = (distance * distance) / k * 0.3; // Reduce attraction force
        const fx = (dx / distance) * attraction;
        const fy = (dy / distance) * attraction;
        
        const sourceForce = forces.get(source.id)!;
        const targetForce = forces.get(target.id)!;
        
                  sourceForce.x += fx * 0.3; // Reduce attraction coefficient
        sourceForce.y += fy * 0.3;
        targetForce.x -= fx * 0.3;
        targetForce.y -= fy * 0.3;
      });
      
              // Apply forces and limit positions
      const temperature = c * (iterations - iter) / iterations;
      nodes.forEach(node => {
        const force = forces.get(node.id)!;
        const displacement = Math.sqrt(force.x * force.x + force.y * force.y);
        
        if (displacement > 0) {
          const factor = Math.min(displacement, temperature) / displacement;
          let newX = Math.max(60, Math.min(width - 60, node.x + force.x * factor));
          let newY = Math.max(60, Math.min(height - 60, node.y + force.y * factor));
          
          // Ensure minimum distance from other nodes
          const minDistance = 60; // Minimum distance
          for (const otherNode of nodes) {
            if (otherNode.id !== node.id) {
              const dx = newX - otherNode.x;
              const dy = newY - otherNode.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance < minDistance && distance > 0) {
                const pushX = (dx / distance) * (minDistance - distance) * 0.5;
                const pushY = (dy / distance) * (minDistance - distance) * 0.5;
                newX += pushX;
                newY += pushY;
              }
            }
          }
          
          node.x = Math.max(60, Math.min(width - 60, newX));
          node.y = Math.max(60, Math.min(height - 60, newY));
        }
      });
    }
  };

  // Generate graph nodes and edges
  const { nodes, edges, bidirectionalEdges } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];
    
    triplets.forEach((triplet: Triplet, index: number) => {
      const { subject, predicate, object } = triplet;
      
      // Add subject nodes
      if (!nodeMap.has(subject)) {
        // Increase layout space, use larger radius
        const width = 1000;
        const height = 700;
        const centerX = width / 2;
        const centerY = height / 2;
        const angle = (nodeMap.size / Math.max(triplets.length * 2, 6)) * 2 * Math.PI;
        const radius = Math.min(width, height) * 0.4; // Further increase radius
        
        nodeMap.set(subject, {
          id: subject,
          label: subject,
          type: 'entity',
          x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 100, // Increase random offset
          y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 100
        });
      }
      
      // Add object nodes
      if (!nodeMap.has(object)) {
        const width = 1000;
        const height = 700;
        const centerX = width / 2;
        const centerY = height / 2;
        const angle = (nodeMap.size / Math.max(triplets.length * 2, 6)) * 2 * Math.PI;
        const radius = Math.min(width, height) * 0.4; // Further increase radius
        
        nodeMap.set(object, {
          id: object,
          label: object,
          type: 'entity', // Unified as entity type
          x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 100, // Increase random offset
          y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 100
        });
      }
      
      // Add edges
      edgeList.push({
        id: `edge-${index}`,
        source: subject,
        target: object,
        label: predicate
      });
    });
    
    // Detect bidirectional edges
    const bidirectionalSet = new Set<string>();
    const edgeConnections = new Map<string, Set<string>>();
    
    edgeList.forEach(edge => {
      const key1 = `${edge.source}-${edge.target}`;
      const key2 = `${edge.target}-${edge.source}`;
      
      if (!edgeConnections.has(edge.source)) {
        edgeConnections.set(edge.source, new Set());
      }
      edgeConnections.get(edge.source)!.add(edge.target);
      
      // Check if reverse edge exists
      if (edgeConnections.has(edge.target) && edgeConnections.get(edge.target)!.has(edge.source)) {
        bidirectionalSet.add(key1);
        bidirectionalSet.add(key2);
      }
    });
    
    // Apply force-directed layout
    if (nodeMap.size > 1) {
      calculateForceLayout(nodeMap, edgeList);
    }
    
    return {
      nodes: Array.from(nodeMap.values()),
      edges: edgeList,
      bidirectionalEdges: bidirectionalSet
    };
  }, [triplets]);

  // Drag-related event handling functions
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setDragState({
      isDragging: true,
      draggedNodeId: nodeId,
      startPos: { x: e.clientX, y: e.clientY },
      offset: { 
        x: e.clientX - rect.left - node.x, 
        y: e.clientY - rect.top - node.y 
      }
    });
  }, [nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.draggedNodeId || !svgRef.current) return;
    
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragState.offset.x;
    const newY = e.clientY - rect.top - dragState.offset.y;
    
    // Update node position
    const updatedNodes = nodes.map(node => 
      node.id === dragState.draggedNodeId 
        ? { ...node, x: Math.max(30, Math.min(570, newX)), y: Math.max(30, Math.min(370, newY)) }
        : node
    );
    
    // Force re-render
    setDragState(prev => ({ ...prev, startPos: { x: e.clientX, y: e.clientY } }));
  }, [dragState, nodes]);

  // Update node position state
  const [nodePositions, setNodePositions] = useState<{ [key: string]: { x: number; y: number } }>({});

  // Update node position
  const updateNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    setNodePositions(prev => ({
      ...prev,
      [nodeId]: { x, y }
    }));
  }, []);

  // Get node current position
  const getNodePosition = useCallback((nodeId: string) => {
    // If it's the node being dragged, prioritize using the temporary position during dragging
    if (dragState.isDragging && dragState.draggedNodeId === nodeId && dragState.currentPos) {
      return dragState.currentPos;
    }
    
    const customPosition = nodePositions[nodeId];
    if (customPosition) return customPosition;
    
    const node = nodes.find(n => n.id === nodeId);
    return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
  }, [nodePositions, nodes, dragState]);

  const handleMouseUp = useCallback(() => {
    // If there's a node being dragged, save the final position
    if (dragState.isDragging && dragState.draggedNodeId && dragState.currentPos) {
      updateNodePosition(dragState.draggedNodeId, dragState.currentPos.x, dragState.currentPos.y);
    }
    
    setDragState({
      isDragging: false,
      draggedNodeId: null,
      startPos: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
      currentPos: undefined
    });
    // Also end view dragging
    setIsViewDragging(false);
  }, [dragState, updateNodePosition]);

  // Drag handling function (optimized version)
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const nodePos = getNodePosition(nodeId);
    
    // Consider the effects of view offset and scaling
    const scaledNodeX = nodePos.x * zoomLevel + viewOffset.x;
    const scaledNodeY = nodePos.y * zoomLevel + viewOffset.y;
    
    setDragState({
      isDragging: true,
      draggedNodeId: nodeId,
      startPos: { x: e.clientX, y: e.clientY },
      offset: { 
        x: e.clientX - rect.left - scaledNodeX, 
        y: e.clientY - rect.top - scaledNodeY 
      }
    });
  }, [getNodePosition, viewOffset, zoomLevel]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.draggedNodeId || !svgRef.current) return;
    
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering view dragging
    
    const rect = svgRef.current.getBoundingClientRect();
    // Consider the effects of view offset and scaling
    const rawX = (e.clientX - rect.left - dragState.offset.x - viewOffset.x) / zoomLevel;
    const rawY = (e.clientY - rect.top - dragState.offset.y - viewOffset.y) / zoomLevel;
    
    const newX = Math.max(50, Math.min(950, rawX));
    const newY = Math.max(50, Math.min(650, rawY));
    
    // Only update drag state, not actual node position
    setDragState(prev => ({
      ...prev,
      currentPos: { x: newX, y: newY }
    }));
  }, [dragState, viewOffset, zoomLevel]);

  // 自动聚焦到节点
  const focusOnNode = useCallback((nodeId: string) => {
    setFocusedNodeId(nodeId);
    // 添加一个短暂的高亮效果
    setTimeout(() => {
      setFocusedNodeId(null);
    }, 2000);
  }, []);

  // 提取实体和关系
  const { entities, relationships } = useMemo(() => {
    const entitiesSet = new Set<string>();
    const relationshipsSet = new Set<string>();

    triplets.forEach((triplet: Triplet) => {
      entitiesSet.add(triplet.subject);
      entitiesSet.add(triplet.object);
      relationshipsSet.add(triplet.predicate);
    });

    return {
      entities: Array.from(entitiesSet),
      relationships: Array.from(relationshipsSet)
    };
  }, [triplets]);

  // 初始化选中所有实体（仅在首次加载时）
  const [isInitialized, setIsInitialized] = useState(false);
  React.useEffect(() => {
    if (entities.length > 0 && !isInitialized) {
      setSelectedEntities(new Set(entities));
      setIsInitialized(true);
    }
  }, [entities, isInitialized]);

  // 切换实体选中状态
  const toggleEntitySelection = useCallback((entity: string) => {
    setSelectedEntities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entity)) {
        newSet.delete(entity);
      } else {
        newSet.add(entity);
      }
      return newSet;
    });
  }, []);

  // 处理单击事件（延时执行以区分双击）
  const handleEntityClick = useCallback((entity: string) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    
    clickTimeoutRef.current = setTimeout(() => {
      toggleEntitySelection(entity);
      clickTimeoutRef.current = null;
    }, 200); // 200ms延时
  }, [toggleEntitySelection]);

  // 处理双击事件
  const handleEntityDoubleClick = useCallback((entity: string) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    
    // 只有在实体被选中时才聚焦
    if (selectedEntities.has(entity)) {
      focusOnNode(entity);
    }
  }, [selectedEntities, focusOnNode]);

  // 显示tooltip
  const showTooltip = useCallback((content: string, clientX: number, clientY: number) => {
    setTooltip({ show: true, content, x: clientX, y: clientY });
  }, []);

  // 更新tooltip位置
  const updateTooltipPosition = useCallback((clientX: number, clientY: number) => {
    setTooltip(prev => prev.show ? { ...prev, x: clientX, y: clientY } : prev);
  }, []);

  // 隐藏tooltip
  const hideTooltip = useCallback(() => {
    setTooltip({ show: false, content: '', x: 0, y: 0 });
  }, []);

  // 重置缩放
  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setViewOffset({ x: 0, y: 0 });
  }, []);

  // 开始视图拖拽
  const handleViewDragStart = useCallback((e: React.MouseEvent) => {
    // 只响应鼠标左键
    if (e.button !== 0) return;
    
    // 只有当点击的不是节点、关系文本或控制按钮时才开始视图拖拽
    const target = e.target as Element;
    if (
      target.tagName === 'circle' || 
      target.tagName === 'text' || 
      target.tagName === 'line' ||
      target.closest('g[data-node]') ||
      target.closest('button') ||
      target.closest('.MuiButton-root')
    ) {
      return;
    }
    
    setIsViewDragging(true);
    setViewDragStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  }, []);

  // 视图拖拽中
  const handleViewDrag = useCallback((e: React.MouseEvent) => {
    if (!isViewDragging) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const deltaX = e.clientX - viewDragStart.x;
    const deltaY = e.clientY - viewDragStart.y;
    
    setViewOffset(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));
    
    setViewDragStart({ x: e.clientX, y: e.clientY });
  }, [isViewDragging, viewDragStart]);

  // 结束视图拖拽
  const handleViewDragEnd = useCallback(() => {
    setIsViewDragging(false);
  }, []);

  // 处理滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // 阻止默认的页面滚动行为
    e.preventDefault();
    e.stopPropagation();
    
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoomLevel(prev => Math.max(0.3, Math.min(3, prev + delta)));
  }, []);

  // 全选/全不选
  const toggleSelectAll = useCallback(() => {
    if (selectedEntities.size === entities.length) {
      setSelectedEntities(new Set());
    } else {
      setSelectedEntities(new Set(entities));
    }
  }, [selectedEntities.size, entities]);

  // 过滤后的节点和边
  const { filteredNodes, filteredEdges } = useMemo(() => {
    const filteredNodesList = nodes.filter(node => selectedEntities.has(node.id));
    const filteredEdgesList = edges.filter(edge => 
      selectedEntities.has(edge.source) && selectedEntities.has(edge.target)
    );

    return {
      filteredNodes: filteredNodesList,
      filteredEdges: filteredEdgesList
    };
  }, [nodes, edges, selectedEntities]);

  const handleTripletClick = (index: number) => {
    setSelectedTriplet(selectedTriplet === index ? null : index);
  };

  if (triplets.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          未检测到图形数据
        </Typography>
        <Typography variant="body2" color="text.secondary">
          当前内容不包含可识别的三元组格式数据
        </Typography>
        <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            原始内容预览:
          </Typography>
          <pre style={{ 
            fontSize: '12px', 
            margin: '8px 0 0 0', 
            whiteSpace: 'pre-wrap',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            {content.substring(0, 500)}...
          </pre>
        </Box>
      </Paper>
    );
  }

  // 直接渲染网络图，不需要切换选项卡
  return (
    <Box sx={{ 
      width: '100%', 
      maxWidth: '100%',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {renderNetworkView()}
    </Box>
  );


  // 渲染网络图
  function renderNetworkView() {
    if (nodes.length === 0) return null;
    
    const width = 1000;
    const height = 700;
    
    return (
      <Box sx={{ 
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden'
      }}>
        <Typography variant="h6" gutterBottom>
          关系网络图 {dragState.isDragging && '(拖拽中...)'}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">
                实体筛选 ({selectedEntities.size}/{entities.length})
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={toggleSelectAll}
                sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1 }}
              >
                {selectedEntities.size === entities.length ? '全不选' : '全选'}
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {entities.map((entity, index) => {
                const isSelected = selectedEntities.has(entity);
                return (
                  <Chip
                    key={index}
                    label={entity}
                    size="small"
                    color="primary"
                    variant={isSelected ? "filled" : "outlined"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEntityClick(entity);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleEntityDoubleClick(entity);
                    }}
                    sx={{
                      cursor: 'pointer',
                      opacity: isSelected ? 1 : 0.6,
                      '&:hover': {
                        backgroundColor: isSelected ? 'primary.dark' : 'primary.main',
                        color: 'white',
                        transform: 'scale(1.05)',
                        transition: 'all 0.2s ease-in-out',
                        opacity: 1
                      }
                    }}
                  />
                );
              })}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              单击选择/取消，双击聚焦节点，拖动节点调整布局，空白区域拖动平移视图
            </Typography>
          </Paper>
          
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              关系类型 ({relationships.length})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: '100px', overflow: 'auto' }}>
              {relationships.map((relationship, index) => (
                <Chip
                  key={index}
                  label={relationship}
                  size="small"
                  color="secondary"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
            </Box>
          </Paper>
        </Box>

        <Paper sx={{ 
          p: 2, 
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          <Box 
            ref={containerRef}
            sx={{ 
              width: '100%',
              maxWidth: '100%',
              mb: 2, 
              position: 'relative',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              overflow: 'hidden',
              height: height,
              cursor: isViewDragging ? 'grabbing' : 'grab'
            }}
            onWheel={handleWheel}
            onMouseDown={handleViewDragStart}
            onMouseMove={handleViewDrag}
            onMouseUp={handleViewDragEnd}
            onMouseLeave={handleViewDragEnd}
          >
            {/* 当没有选中实体时的提示覆盖层 */}
            {selectedEntities.size === 0 && (
              <Box sx={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center', 
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                zIndex: 20,
                color: 'text.secondary' 
              }}>
                <Typography variant="h6" gutterBottom>
                  没有选中任何实体
                </Typography>
                <Typography variant="body2">
                  请在上方选择要显示的实体
                </Typography>
              </Box>
            )}
            {/* 重置缩放按钮 */}
            <Button
              variant={zoomLevel !== 1 ? "contained" : "outlined"}
              size="small"
              onClick={resetZoom}
              title="点击重置视图：缩放100%，位置居中"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 10,
                minWidth: 'auto',
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: zoomLevel !== 1 ? 'primary.main' : 'transparent',
                '&:hover': {
                  backgroundColor: zoomLevel !== 1 ? 'primary.dark' : 'rgba(25, 118, 210, 0.04)'
                }
              }}
            >
              {Math.round(zoomLevel * 100)}%
            </Button>
            
            {/* 操作提示 */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                zIndex: 10,
                fontSize: '11px',
                color: 'text.secondary',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '4px 8px',
                borderRadius: '4px',
                opacity: 0.8,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              拖拽平移 | 滚轮缩放
            </Box>
            
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <svg 
                ref={svgRef} 
                width={width} 
                height={height} 
                viewBox={`0 0 ${width} ${height}`} 
                style={{ 
                  cursor: dragState.isDragging ? 'grabbing' : 'inherit',
                  transform: `scale(${zoomLevel}) translate(${viewOffset.x / zoomLevel}px, ${viewOffset.y / zoomLevel}px)`,
                  transformOrigin: 'center center',
                  transition: isViewDragging ? 'none' : 'transform 0.1s ease-out',
                  pointerEvents: 'auto'
                }}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
              >
                {/* 渲染边 */}
                {filteredEdges.map((edge, index) => {
                  const sourcePos = getNodePosition(edge.source);
                  const targetPos = getNodePosition(edge.target);
                  
                  if (!sourcePos || !targetPos) return null;
                  
                  // 统一节点半径
                  const sourceRadius = 25;
                  const targetRadius = 25;
                  
                  // 计算两点间的距离和角度
                  const dx = targetPos.x - sourcePos.x;
                  const dy = targetPos.y - sourcePos.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx);
                  
                  // 如果距离太小，跳过渲染
                  if (distance < sourceRadius + targetRadius + 10) return null;
                  
                  // 检查是否为双向边，且当前边应该显示为曲线
                  const edgeKey = `${edge.source}-${edge.target}`;
                  const reverseKey = `${edge.target}-${edge.source}`;
                  const isBidirectional = bidirectionalEdges.has(edgeKey) && bidirectionalEdges.has(reverseKey);
                  const shouldBeCurved = isBidirectional && edge.source < edge.target; // 字母序较小的作为曲线
                  
                  let pathElement;
                  let labelX, labelY;
                  
                  if (shouldBeCurved) {
                    // 曲线路径
                    const curveOffset = Math.min(distance * 0.3, 80); // 曲线偏移量
                    
                    // 计算控制点（垂直于连线方向）
                    const perpAngle = angle + Math.PI / 2;
                    const controlX = (sourcePos.x + targetPos.x) / 2 + Math.cos(perpAngle) * curveOffset;
                    const controlY = (sourcePos.y + targetPos.y) / 2 + Math.sin(perpAngle) * curveOffset;
                    
                    // 计算曲线上的起点和终点
                    const startAngleToControl = Math.atan2(controlY - sourcePos.y, controlX - sourcePos.x);
                    const endAngleFromControl = Math.atan2(targetPos.y - controlY, targetPos.x - controlX);
                    
                    const startX = sourcePos.x + Math.cos(startAngleToControl) * sourceRadius;
                    const startY = sourcePos.y + Math.sin(startAngleToControl) * sourceRadius;
                    
                    // 对于终点，需要考虑从控制点到目标点的方向
                    const endX = targetPos.x - Math.cos(endAngleFromControl) * (targetRadius + 6);
                    const endY = targetPos.y - Math.sin(endAngleFromControl) * (targetRadius + 6);
                    
                    // 创建二次贝塞尔曲线路径
                    const pathData = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
                    
                    pathElement = (
                      <path
                        d={pathData}
                        stroke="#cbd5e1"
                        strokeWidth="1"
                        fill="none"
                        markerEnd="url(#arrowhead-graph)"
                      />
                    );
                    
                    // 曲线标签位置（在控制点附近）
                    labelX = controlX;
                    labelY = controlY - 5;
                    
                  } else {
                    // 直线路径
                    const startX = sourcePos.x + Math.cos(angle) * sourceRadius;
                    const startY = sourcePos.y + Math.sin(angle) * sourceRadius;
                    const endX = targetPos.x - Math.cos(angle) * (targetRadius + 6);
                    const endY = targetPos.y - Math.sin(angle) * (targetRadius + 6);
                    
                    pathElement = (
                      <line
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke="#cbd5e1"
                        strokeWidth="1"
                        markerEnd="url(#arrowhead-graph)"
                      />
                    );
                    
                    // 直线标签位置
                    const midX = (startX + endX) / 2;
                    const midY = (startY + endY) / 2;
                    
                    const labelOffset = 15;
                    const labelOffsetX = Math.sin(angle) * labelOffset * (index % 2 === 0 ? 1 : -1);
                    const labelOffsetY = -Math.cos(angle) * labelOffset * (index % 2 === 0 ? 1 : -1);
                    
                    labelX = midX + labelOffsetX;
                    labelY = midY + labelOffsetY;
                  }
                  
                  return (
                    <g key={edge.id}>
                      {pathElement}
                      {/* 标签背景 */}
                      <rect
                        x={labelX - (edge.label.length > 6 ? 25 : edge.label.length * 3)}
                        y={labelY - 8}
                        width={edge.label.length > 6 ? 50 : edge.label.length * 6}
                        height={16}
                        fill="rgba(255, 255, 255, 0.9)"
                      />
                      <text
                        x={labelX}
                        y={labelY + 3}
                        textAnchor="middle"
                        fontSize="8"
                        fill="#6b7280"
                        fontWeight="500"
                        style={{ cursor: edge.label.length > 6 ? 'help' : 'default' }}
                        onMouseEnter={(e) => {
                          if (edge.label.length > 6) {
                            showTooltip(edge.label, e.clientX, e.clientY);
                          }
                        }}
                        onMouseMove={(e) => {
                          if (tooltip.show && tooltip.content === edge.label && edge.label.length > 6) {
                            updateTooltipPosition(e.clientX, e.clientY);
                          }
                        }}
                        onMouseLeave={hideTooltip}
                      >
                        {edge.label.length > 6 ? edge.label.substring(0, 6) + '...' : edge.label}
                      </text>
                    </g>
                  );
                })}
                
                {/* 渲染节点 */}
                {filteredNodes.map((node) => {
                  const pos = getNodePosition(node.id);
                  const isDragged = dragState.draggedNodeId === node.id;
                  const isFocused = focusedNodeId === node.id;
                  
                  return (
                    <g 
                      key={node.id}
                      data-node={node.id}
                      style={{ cursor: 'grab' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleNodeMouseDown(e, node.id);
                      }}
                      onMouseEnter={(e) => {
                        if (node.label.length > 8) {
                          showTooltip(node.label, e.clientX, e.clientY);
                        }
                      }}
                      onMouseMove={(e) => {
                        if (tooltip.show && tooltip.content === node.label && node.label.length > 8) {
                          updateTooltipPosition(e.clientX, e.clientY);
                        }
                        e.stopPropagation();
                      }}
                      onMouseLeave={hideTooltip}
                    >
                      {/* 聚焦时的外圈光晕效果 */}
                      {isFocused && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={35}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth="3"
                          opacity="0.7"
                          style={{
                            animation: 'pulse 1s infinite'
                          }}
                        />
                      )}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={25}
                        fill="#3b82f6"
                        stroke={isDragged ? '#fbbf24' : isFocused ? '#fbbf24' : 'white'}
                        strokeWidth={isDragged || isFocused ? 3 : 2}
                        style={{ 
                          filter: isDragged || isFocused ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' : 'none',
                          cursor: isDragged ? 'grabbing' : 'grab',
                          transform: isFocused ? 'scale(1.1)' : 'scale(1)',
                          transition: 'all 0.3s ease-in-out'
                        }}
                      />
                      <text
                        x={pos.x}
                        y={pos.y + 5}
                        textAnchor="middle"
                        fontSize="8"
                        fill="white"
                        fontWeight="500"
                        pointerEvents="none"
                        style={{
                          transform: isFocused ? 'scale(1.1)' : 'scale(1)',
                          transition: 'all 0.3s ease-in-out'
                        }}
                      >
                        {node.label.length > 8 ? node.label.substring(0, 8) + '...' : node.label}
                      </text>
                    </g>
                  );
                })}
                
                {/* 箭头标记定义和动画 */}
                <defs>
                  <marker
                    id="arrowhead-graph"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#cbd5e1" />
                  </marker>
                  <style>
                    {`
                      @keyframes pulse {
                        0% { opacity: 0.7; }
                        50% { opacity: 0.3; }
                        100% { opacity: 0.7; }
                      }
                    `}
                  </style>
                </defs>
              </svg>
            </Box>
          </Box>
          
          {/* <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#3b82f6' }}></Box>
              <Typography variant="caption">实体</Typography>
            </Box>
          </Box> */}
          
          <Box sx={{ mt: 2 }}>

          </Box>
        </Paper>
        
        {/* Tooltip */}
        {tooltip.show && (
          <Box
            sx={{
              position: 'fixed',
              left: tooltip.x + 15,
              top: tooltip.y - 40,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              zIndex: 1000,
              pointerEvents: 'none',
              maxWidth: '250px',
              wordBreak: 'break-word',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              whiteSpace: 'nowrap',
              transform: 'translateX(-50%)',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: '4px solid rgba(0, 0, 0, 0.9)',
              }
            }}
          >
            {tooltip.content}
          </Box>
        )}
      </Box>
    );
  }
}

export default TripletGraphViewer;