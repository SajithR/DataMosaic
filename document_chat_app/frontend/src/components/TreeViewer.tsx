import React, { useState, useMemo, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CircleIcon from '@mui/icons-material/Circle';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  level: number;
  isLeaf: boolean;
  type?: 'person' | 'relation' | 'detail' | 'general';
  metadata?: { [key: string]: string };
}

interface TreeViewerProps {
  content: string;
}

const TreeViewer: React.FC<TreeViewerProps> = ({ content }) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // 解析三元组格式的树形数据
  const parseTripletFormat = (text: string): TreeNode[] => {
    console.log('解析树形数据原文:', text);
    
    // 先处理包含引号和键值对的复杂格式
    // 格式如: ("汤南", collaborates_with, "骆昱宇", "focus": "数据科学和人工智能", "details": "理论研究与实际应用...")
    const complexPattern = /\(([^,)]+),\s*([^,)]+),\s*([^,)]+)(?:,\s*([^)]+))?\)/g;
    
    const triplets: { 
      parent: string; 
      relation: string; 
      child: string;
      metadata?: { [key: string]: string };
    }[] = [];
    
    // 先清理文本，移除列表标记，并处理单行格式
    let cleanedText = text.replace(/^-\s*/gm, '').replace(/^\s*\*\s*/gm, '');
    
    // 如果是单行格式，将其分割成多行以便更好地解析
    if (cleanedText.includes('<Tree START>') && cleanedText.includes('<Tree END>')) {
      const startMarker = '<Tree START>';
      const endMarker = '<Tree END>';
      const startIndex = cleanedText.indexOf(startMarker);
      const endIndex = cleanedText.indexOf(endMarker);
      
      if (startIndex !== -1 && endIndex !== -1) {
        const beforeMarker = cleanedText.substring(0, startIndex);
        const afterMarker = cleanedText.substring(endIndex + endMarker.length);
        const treeContent = cleanedText.substring(startIndex + startMarker.length, endIndex).trim();
        
        // 将单行的三元组分割成多行
        const tripletMatches = treeContent.match(/\([^)]+\)/g);
        if (tripletMatches) {
          const formattedTriplets = tripletMatches.join('\n');
          cleanedText = beforeMarker + startMarker + '\n' + formattedTriplets + '\n' + endMarker + afterMarker;
          console.log('TreeViewer - 转换单行格式为多行:', {
            originalLength: text.length,
            cleanedLength: cleanedText.length,
            tripletCount: tripletMatches.length,
            formattedContent: cleanedText.substring(0, 300)
          });
        }
      }
    }
    
    let match;
    while ((match = complexPattern.exec(cleanedText)) !== null) {
      const parent = match[1].trim().replace(/^"/, '').replace(/"$/, '');
      const relation = match[2].trim();
      const child = match[3].trim().replace(/^"/, '').replace(/"$/, '');
      
      // 解析额外的键值对信息
      const metadata: { [key: string]: string } = {};
      if (match[4]) {
        const extraInfo = match[4];
        // 解析键值对: "key": "value"
        const keyValuePattern = /"([^"]+)":\s*"([^"]+)"/g;
        let kvMatch;
        while ((kvMatch = keyValuePattern.exec(extraInfo)) !== null) {
          metadata[kvMatch[1]] = kvMatch[2];
        }
      }
      
      triplets.push({ parent, relation, child, metadata });
    }
    
    if (triplets.length === 0) {
      console.log('没有找到有效的三元组');
      return [];
    }
    
    console.log('解析到的三元组:', triplets);
    
    // 构建节点映射
    const nodeMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];
    
    // 首先创建所有主要实体节点
    const allEntities = new Set<string>();
    triplets.forEach(triplet => {
      allEntities.add(triplet.parent);
      allEntities.add(triplet.child);
    });
    
    allEntities.forEach(entityName => {
      if (!nodeMap.has(entityName)) {
        nodeMap.set(entityName, {
          id: entityName,
          label: entityName,
          level: 0,
          isLeaf: true,
          children: [],
          type: 'person',
          metadata: {}
        });
      }
    });
    
    // 建立关系结构
    triplets.forEach((triplet, index) => {
      const parentNode = nodeMap.get(triplet.parent);
      
      if (parentNode) {
        // 创建关系节点，使用更友好的显示
        const relationId = `${triplet.parent}_${triplet.relation}_${index}`;
        const relationLabel = `${triplet.relation.replace(/_/g, ' ')} → ${triplet.child}`;
        
        const relationNode: TreeNode = {
          id: relationId,
          label: relationLabel,
          level: 0,
          isLeaf: true,
          children: [],
          type: 'relation',
          metadata: triplet.metadata || {}
        };
        
        // 如果有额外的元数据，创建详情子节点
        if (triplet.metadata && Object.keys(triplet.metadata).length > 0) {
          Object.entries(triplet.metadata).forEach(([key, value], metaIndex) => {
            const detailNode: TreeNode = {
              id: `${relationId}_detail_${metaIndex}`,
              label: `${key}: ${value}`,
              level: 0,
              isLeaf: true,
              type: 'detail',
              metadata: {}
            };
            relationNode.children!.push(detailNode);
          });
          relationNode.isLeaf = false;
        }
        
        // 将关系节点添加到父节点
        if (!parentNode.children) {
          parentNode.children = [];
        }
        parentNode.children.push(relationNode);
        parentNode.isLeaf = false;
      }
    });
    
    // 找到根节点（在triplets中作为parent但从不作为child的节点）
    const childEntities = new Set<string>();
    triplets.forEach(triplet => {
      childEntities.add(triplet.child);
    });
    
    nodeMap.forEach((node, nodeName) => {
      if (!childEntities.has(nodeName) && node.children && node.children.length > 0) {
        rootNodes.push(node);
      }
    });
    
    // 如果没有明确的根节点，选择有最多关系的节点作为根节点
    if (rootNodes.length === 0) {
      const nodeRelationCount = new Map<string, number>();
      triplets.forEach(triplet => {
        nodeRelationCount.set(triplet.parent, (nodeRelationCount.get(triplet.parent) || 0) + 1);
      });
      
      let maxRelations = 0;
      let topNode: TreeNode | null = null;
      nodeRelationCount.forEach((count, nodeName) => {
        if (count > maxRelations) {
          maxRelations = count;
          topNode = nodeMap.get(nodeName) || null;
        }
      });
      
      if (topNode) {
        rootNodes.push(topNode);
      }
    }
    
    // 如果还是没有根节点，就把所有有子节点的节点都作为根节点
    if (rootNodes.length === 0) {
      nodeMap.forEach(node => {
        if (node.children && node.children.length > 0) {
          rootNodes.push(node);
        }
      });
    }
    
    // 计算层级
    const calculateLevels = (nodes: TreeNode[], level: number) => {
      nodes.forEach(node => {
        node.level = level;
        if (node.children && node.children.length > 0) {
          calculateLevels(node.children, level + 1);
        }
      });
    };
    
    calculateLevels(rootNodes, 0);
    
    console.log('TreeViewer - 解析三元组格式成功:', {
      tripletsCount: triplets.length,
      rootNodesCount: rootNodes.length,
      rootNodes: rootNodes.map(node => node.label)
    });
    
    return rootNodes;
  };
  
  // 解析树形结构数据
  const parseTreeData = (text: string): TreeNode[] => {
    // 首先尝试解析三元组格式（新的标准格式）
    const tripletResult = parseTripletFormat(text);
    if (tripletResult.length > 0) {
      return tripletResult;
    }
    
    try {
      // 尝试解析JSON格式（向后兼容）
      const jsonData = JSON.parse(text);
      
      // 如果是数组格式
      if (Array.isArray(jsonData)) {
        return jsonData.map((item, index) => parseJsonNode(item, `root-${index}`, 0));
      }
      
      // 如果是对象格式
      if (typeof jsonData === 'object' && jsonData !== null) {
        return [parseJsonNode(jsonData, 'root', 0)];
      }
      
      return [];
    } catch (error) {
      console.log('JSON解析失败，尝试缩进格式');
      
      // 尝试解析缩进格式的文本
      return parseIndentedText(text);
    }
  };
  
  // 解析JSON节点
  const parseJsonNode = (node: any, id: string, level: number): TreeNode => {
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      return {
        id,
        label: String(node),
        level,
        isLeaf: true
      };
    }
    
    if (Array.isArray(node)) {
      const children = node.map((item, index) => 
        parseJsonNode(item, `${id}-${index}`, level + 1)
      );
      
      return {
        id,
        label: `Array (${node.length} items)`,
        children,
        level,
        isLeaf: false
      };
    }
    
    if (typeof node === 'object' && node !== null) {
      const children = Object.entries(node).map(([key, value]) => 
        parseJsonNode(value, `${id}-${key}`, level + 1)
      );
      
      // 如果有name或title字段，优先使用
      const displayName = node.name || node.title || node.label || id;
      
      return {
        id,
        label: String(displayName),
        children: children.length > 0 ? children : undefined,
        level,
        isLeaf: children.length === 0
      };
    }
    
    return {
      id,
      label: String(node),
      level,
      isLeaf: true
    };
  };
  
  // 解析缩进格式的文本
  const parseIndentedText = (text: string): TreeNode[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const nodes: TreeNode[] = [];
    const stack: { node: TreeNode; indent: number }[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (!trimmed) continue;
      
      // 计算缩进级别
      const indent = line.length - line.trimStart().length;
      
      // 创建节点
      const node: TreeNode = {
        id: `node-${i}`,
        label: trimmed.replace(/^[-*+•]\s*/, ''), // 移除列表标记
        level: Math.floor(indent / 2), // 假设每级缩进2个空格
        isLeaf: true,
        children: []
      };
      
      // 调整栈，保持层级关系
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        const popped = stack.pop();
        if (popped && popped.node.children && popped.node.children.length > 0) {
          popped.node.isLeaf = false;
        }
      }
      
      if (stack.length === 0) {
        // 根节点
        nodes.push(node);
      } else {
        // 子节点
        const parent = stack[stack.length - 1].node;
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
        parent.isLeaf = false;
      }
      
      stack.push({ node, indent });
    }
    
    // 处理最后的节点
    while (stack.length > 0) {
      const popped = stack.pop();
      if (popped && popped.node.children && popped.node.children.length > 0) {
        popped.node.isLeaf = false;
      }
    }
    
    return nodes;
  };
  
  const treeData = useMemo(() => parseTreeData(content), [content]);
  
  // 自动展开所有节点
  useEffect(() => {
    const allNodeIds = new Set<string>();
    const collectNodeIds = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          allNodeIds.add(node.id);
          collectNodeIds(node.children);
        }
      });
    };
    
    if (treeData.length > 0) {
      collectNodeIds(treeData);
      setExpandedNodes(allNodeIds);
    }
  }, [treeData]);
  
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };
  
  const renderTreeNode = (node: TreeNode): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <Box key={node.id} sx={{ width: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 0.5,
            px: 1,
            ml: node.level * 2,
            borderRadius: 1,
            cursor: hasChildren ? 'pointer' : 'default',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
            },
            transition: 'background-color 0.2s ease',
          }}
          onClick={() => hasChildren && toggleNode(node.id)}
        >
          {/* 展开/收起图标 */}
          {hasChildren ? (
            <IconButton
              size="small"
              sx={{ 
                p: 0.5, 
                mr: 0.5,
                color: 'text.secondary'
              }}
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          ) : (
            <Box sx={{ width: 32, height: 32, mr: 0.5 }} />
          )}
          
          {/* 节点图标 */}
          <Box sx={{ mr: 1, color: 'text.secondary' }}>
            <CircleIcon sx={{ fontSize: 12 }} />
          </Box>
          
          {/* 节点标签 */}
          <Typography
            variant="body2"
            sx={{
              flexGrow: 1,
              fontWeight: hasChildren ? 500 : 400,
              color: hasChildren ? 'text.primary' : 'text.secondary',
            }}
          >
            {node.label}
          </Typography>
          
          {/* 子节点数量 */}
          {hasChildren && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontSize: '0.75rem',
              }}
            >
              {node.children!.length}
            </Typography>
          )}
        </Box>
        
        {/* 子节点 */}
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box>
              {node.children!.map(child => renderTreeNode(child))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };
  
  const expandAll = () => {
    const allNodeIds = new Set<string>();
    const collectNodeIds = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          allNodeIds.add(node.id);
          collectNodeIds(node.children);
        }
      });
    };
    collectNodeIds(treeData);
    setExpandedNodes(allNodeIds);
  };
  
  const collapseAll = () => {
    setExpandedNodes(new Set());
  };
  
  if (treeData.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          color: 'text.secondary',
        }}
      >
        <AccountTreeIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
        <Typography variant="body2">
          无法解析树形结构数据
        </Typography>
        <Typography variant="caption" sx={{ mt: 1, textAlign: 'center' }}>
          请确保数据是有效的三元组格式、JSON格式或缩进格式的文本
        </Typography>
        <Typography variant="caption" sx={{ mt: 1, textAlign: 'center', fontSize: '0.7rem' }}>
          数据内容：{content.substring(0, 200)}...
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ width: '100%', maxHeight: '600px', overflow: 'auto' }}>
      {/* 操作按钮 */}
      <Box sx={{ 
        display: 'flex', 
        gap: 1, 
        mb: 2,
        pb: 1,
        borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
      }}>
        <IconButton
          size="small"
          onClick={expandAll}
          sx={{ 
            fontSize: '0.875rem',
            color: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.main',
              color: 'white',
            }
          }}
        >
          <ExpandMoreIcon />
        </IconButton>
        <Typography variant="caption" sx={{ pt: 1 }}>
          展开全部
        </Typography>
        
        <IconButton
          size="small"
          onClick={collapseAll}
          sx={{ 
            ml: 2,
            fontSize: '0.875rem',
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'text.secondary',
              color: 'white',
            }
          }}
        >
          <ExpandLessIcon />
        </IconButton>
        <Typography variant="caption" sx={{ pt: 1 }}>
          收起全部
        </Typography>
      </Box>
      
      {/* 树形结构 */}
      <Box>
        {treeData.map(node => renderTreeNode(node))}
      </Box>
    </Box>
  );
};

export default TreeViewer; 