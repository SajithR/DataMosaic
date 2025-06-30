import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import LargeContentViewer from './LargeContentViewer';

interface MosaicContentRendererProps {
  content: string;
  thoughtProcess?: string[]; // 添加思考过程，用于提取其中的Graph内容
}

// 智能的内容处理函数 - 用占位符替换Graph标记以保持位置
const smartContentProcessing = (content: string, hasAdditionalGraph: boolean): string => {
  try {
    let result = content;
    
    // 处理JSON转义字符和格式问题
    result = result
      // 移除JSON转义字符
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      // 移除过多的连续空行
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // 清理开头和结尾的多余空白
      .replace(/^\s+/, '')
      .replace(/\s+$/, '');
      
    // 过滤掉调试消息
    const debugPatterns = [
      /^Starting analysis for query:.*?\n/im,
      /^Loading and processing documents.*?\n/im,
      /^Structure selection result:.*?\n/im,
      /^Verification Result:.*?\n/im,
      /^正在检索和问题相关的文档.*?\n/im,
      /^正在结构化检索到的文档.*?\n/im,
      /^正在仔细分析文档内容.*?\n/im,
      /^正在验证信息.*?\n/im,
      /^执行精炼动作.*?\n/im,
      /^正在进行推理.*?\n/im
    ];
    
    for (const pattern of debugPatterns) {
      result = result.replace(pattern, '');
    }
    
    // 如果有从思考过程中提取的Graph内容，用占位符替换原Graph标记以保持位置
    if (hasAdditionalGraph) {
      console.log('MosaicContentRenderer - 检测到额外Graph内容，用占位符替换原Graph标记');
      
      const graphBlockPatterns = [
        // 匹配完整的Graph标记块
        /<Graph\s+START>[\s\S]*?<Graph\s+END>/gi,
        /<Graph START>[\s\S]*?<Graph END>/gi,
        // 匹配[EXTRACT]代码块中的Graph内容
        /\[EXTRACT\]\s*```[\s\S]*?<Graph START>[\s\S]*?<Graph END>[\s\S]*?```/gi,
        /\[EXTRACT\]\s*```[\s\S]*?<Graph\s+START>[\s\S]*?<Graph\s+END>[\s\S]*?```/gi
      ];
      
      // 用简单的占位符替换这些Graph块，保持位置信息
      // 使用不会被Markdown解释的占位符
      for (const pattern of graphBlockPatterns) {
        result = result.replace(pattern, '\n\n**[GRAPH_PLACEHOLDER]**\n\n');
      }
      
      // 再次清理可能产生的多余空行
      result = result.replace(/\n\s*\n\s*\n/g, '\n\n');
    }
    
    console.log('MosaicContentRenderer - smartContentProcessing:', {
      originalLength: content.length,
      processedLength: result.length,
      hasChanges: content !== result,
      hasAdditionalGraph,
      contentPreview: result.substring(0, 300)
    });
    
    return result;
  } catch (error) {
    console.error('MosaicContentRenderer - smartContentProcessing 错误:', error);
    return content; // 出错时返回原内容
  }
};

// 检测是否包含Graph标记（严格按照标记）
const hasGraphMarkers = (content: string): boolean => {
  // 更宽松的检测，包括代码块包装的情况
  const patterns = [
    // **优先级1: Graph占位符检测**
    /\*\*\[GRAPH_PLACEHOLDER\]\*\*/i,
    
    // **优先级2: [EXTRACT] 格式检测 - 关键修复**
    /\[EXTRACT\]\s*```[\s\S]*?<Graph START>[\s\S]*?<Graph END>/i,
    /\[EXTRACT\]\s*```[\s\S]*?<Graph\s+START>[\s\S]*?<Graph\s+END>/i,
    /\[EXTRACT\]\s*```[\s\S]*?\([^)]*?,[\s\S]*?\)/i, // 检测三元组格式
    
    // 简化的[EXTRACT]检测
    /\[EXTRACT\][\s\S]*?<Graph START>/i,
    /\[EXTRACT\][\s\S]*?Graph START/i,
    
    // 原始的Graph START/END标记格式
    /<Graph\s+START>[\s\S]*?<Graph\s+END>/i,
    /Graph\s+START[\s\S]*?Graph\s+END/i,
    /<Graph START>[\s\S]*?<Graph END>/i,
    /Graph START[\s\S]*?Graph END/i
  ];
  
  const result = patterns.some(pattern => pattern.test(content));
  console.log('MosaicContentRenderer - hasGraphMarkers:', {
    result,
    contentLength: content.length,
    contentPreview: content.substring(0, 300) + '...',
    hasStartMarker: content.includes('<Graph START>'),
    hasEndMarker: content.includes('<Graph END>'),
    hasStartMarkerAlt: content.includes('Graph START'),
    hasEndMarkerAlt: content.includes('Graph END'),
    // 新增：检查[EXTRACT]格式
    hasExtractFormat: content.includes('[EXTRACT]') && content.includes('```') && content.includes('('),
    // 显示原始内容的前500个字符以便调试
    rawContent: content.substring(0, 500)
  });
  return result;
};

// 提取Graph标记中的内容（严格按照标记）
const extractGraphContent = (content: string): string | null => {
  // 尝试多种模式提取Graph内容
  const patterns = [
    // **优先级1: [EXTRACT] 格式 - 基于实际测试的精确匹配**
    /\[EXTRACT\]\s*```[\s\S]*?<Graph START>\s*\n([\s\S]*?)<Graph END>/i,
    /\[EXTRACT\]\s*```[\s\S]*?<Graph START>\s*([\s\S]*?)<Graph END>/i,
    /\[EXTRACT\][\s\S]*?<Graph START>[\s\S]*?\n([\s\S]*?)<Graph END>/i,
    /<Graph START>\s*\n([\s\S]*?)<Graph END>/i,
    /<Graph START>\s*([\s\S]*?)<Graph END>/i,
    
    // 处理转义的换行符情况
    /\[EXTRACT\]\s*```[\s\S]*?<Graph START>\s*\\n([\s\S]*?)<Graph END>/i,
    /\[EXTRACT\]\s*```[\s\S]*?<Graph\s+START>\s*\\n([\s\S]*?)<Graph\s+END>/i,
    /\[EXTRACT\]\s*```[\s\S]*?<Graph\s+START>\s*\n([\s\S]*?)<Graph\s+END>/i,
    
    // 原始Graph START/END格式
    /<Graph\s+START>([\s\S]*?)<Graph\s+END>/i,
    /<Graph START>([\s\S]*?)<Graph END>/i,
    /Graph\s+START\s*>([\s\S]*?)<\s*Graph\s+END/i,
    /Graph START[\s\S]*?\n([\s\S]*?)Graph END/i,
    
    // 代码块包装格式
    /```[\s\S]*?<Graph START>\s*\n([\s\S]*?)<Graph END>[\s\S]*?```/i,
    /```[\s\S]*?<Graph\s+START>\s*\n([\s\S]*?)<Graph\s+END>[\s\S]*?```/i,
    
    // [EXTRACT]包装格式
    /\[EXTRACT\][\s\S]*?<Graph START>\s*\n([\s\S]*?)<Graph End>/i,
    /\[EXTRACT\][\s\S]*?<Graph\s+START>\s*\n([\s\S]*?)<Graph\s+END>/i,
    
    // 包含换行符的格式
    /<Graph START>\s*\\n([\s\S]*?)\\n\s*<Graph END>/i,
    /<Graph\s+START>\s*\\n([\s\S]*?)\\n\s*<Graph\s+END>/i,
    
    // 非常宽松的格式
    /Graph\s*START[^a-zA-Z]*?([\s\S]*?)Graph\s*END/i,
  ];
  
  let match = null;
  let usedPattern = -1;
  
  // 首先尝试处理JSON转义字符
  const processedContent = content.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  
  for (let i = 0; i < patterns.length; i++) {
    // 先在处理过的内容中尝试
    match = processedContent.match(patterns[i]);
    if (match) {
      usedPattern = i;
      console.log(`MosaicContentRenderer - 使用处理后的内容匹配模式${i}`);
      break;
    }
    
    // 然后在原始内容中尝试
    match = content.match(patterns[i]);
    if (match) {
      usedPattern = i;
      console.log(`MosaicContentRenderer - 使用原始内容匹配模式${i}`);
      break;
    }
  }
  
  const result = match ? match[1].trim() : null;
  console.log('MosaicContentRenderer - extractGraphContent:', {
    hasMatch: !!match,
    usedPattern,
    resultLength: result ? result.length : 0,
    resultPreview: result ? result.substring(0, 300) + '...' : null,
    // 显示匹配到的完整内容
    matchedContent: match ? match[0].substring(0, 500) + '...' : null,
    // 为了调试，也显示原始content的部分信息
    searchIn: content.substring(0, 500) + '...',
    processedSearchIn: processedContent.substring(0, 500) + '...',
    contentHasGraphStart: content.includes('<Graph START>'),
    processedContentHasGraphStart: processedContent.includes('<Graph START>'),
    contentHasExtract: content.includes('[EXTRACT]'),
  });
  return result;
};

// 从思考过程中提取所有Graph内容
const extractAllGraphsFromThoughts = (thoughtProcess: string[]): string[] => {
  if (!thoughtProcess || !Array.isArray(thoughtProcess)) {
    console.log('MosaicContentRenderer - extractAllGraphsFromThoughts: 没有思考过程数据');
    return [];
  }
  
  console.log('MosaicContentRenderer - extractAllGraphsFromThoughts: 开始检查思考过程', {
    thoughtProcessLength: thoughtProcess.length
  });
  
  // 收集所有找到的Graph内容
  const allGraphs: string[] = [];
  
  // 遍历所有思考步骤，收集所有Graph内容
  for (let i = 0; i < thoughtProcess.length; i++) {
    const thought = thoughtProcess[i];
    
    // 检查包含[EXTRACT]的思考步骤
    if (thought.includes('[EXTRACT]') && thought.includes('<Graph START>') && thought.includes('<Graph END>')) {
      console.log(`MosaicContentRenderer - 发现包含Graph标记的步骤${i}`);
      
      try {
        const startMarker = '<Graph START>';
        const endMarker = '<Graph END>';
        const startIndex = thought.indexOf(startMarker);
        const endIndex = thought.indexOf(endMarker);
        
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          let graphContent = thought.substring(startIndex + startMarker.length, endIndex).trim();
          
          // 处理可能的转义字符
          graphContent = graphContent.replace(/\\n/g, '\n');
          
          // 移除开头的换行符和空格
          graphContent = graphContent.replace(/^\s*\n/, '').trim();
          
          if (graphContent && graphContent.includes('(') && graphContent.includes(',')) {
            allGraphs.push(graphContent);
            const tripletCount = (graphContent.match(/\([^)]+\)/g) || []).length;
            console.log(`MosaicContentRenderer - 在步骤${i}中找到Graph，三元组数量: ${tripletCount}`);
          }
        }
      } catch (error) {
        console.log(`MosaicContentRenderer - 步骤${i}Graph提取失败:`, error);
      }
    }
  }
  
  // 如果没有找到任何Graph，尝试用通用方法
  if (allGraphs.length === 0) {
    for (let i = 0; i < thoughtProcess.length; i++) {
      const thought = thoughtProcess[i];
      const graphContent = extractGraphContent(thought);
      if (graphContent) {
        allGraphs.push(graphContent);
        const tripletCount = (graphContent.match(/\([^)]+\)/g) || []).length;
        console.log(`MosaicContentRenderer - 通用方法在思考${i}中找到Graph，三元组数量: ${tripletCount}`);
      }
    }
  }
  
  console.log('MosaicContentRenderer - 找到的Graph总数:', {
    totalGraphsFound: allGraphs.length,
    graphSummaries: allGraphs.map((graph, index) => ({
      index,
      tripletCount: (graph.match(/\([^)]+\)/g) || []).length,
      preview: graph.substring(0, 100) + '...'
    }))
  });
  
  return allGraphs;
};

// 为了保持向后兼容，保留原函数但返回第一个Graph
const extractGraphFromThoughts = (thoughtProcess: string[]): string | null => {
  const allGraphs = extractAllGraphsFromThoughts(thoughtProcess);
  return allGraphs.length > 0 ? allGraphs[0] : null;
};

// 检测Tree标记中的内容
const hasTreeMarkers = (content: string): boolean => {
  const patterns = [
    /<Tree\s+START>[\s\S]*?<Tree\s+END>/i,
    /<Tree START>[\s\S]*?<Tree END>/i,
    /\[TREE\]\s*```[\s\S]*?<Tree START>[\s\S]*?<Tree END>/i,
    /\[TREE\]\s*```[\s\S]*?\{[\s\S]*?\}/i, // JSON格式
    /\[TREE\][\s\S]*?<Tree START>/i,
    /Tree\s+START[\s\S]*?Tree\s+END/i,
    /Tree START[\s\S]*?Tree END/i
  ];
  
  // 增强检测：检测单行Tree标记格式 <Tree START> ... <Tree END>
  const hasBasicTreeMarkers = patterns.some(pattern => pattern.test(content));
  const hasTreeTags = content.includes('<Tree START>') && content.includes('<Tree END>');
  
  // 检测三元组格式（包括各种关系类型）
  const tripletPatterns = [
    /\([^,)]+,\s*(has_child|has_domain|has_content|has_outcome|collaborates_with|relates_to|contains|includes),\s*[^)]+\)/,
    /\([^,)]+,\s*[^,)]+,\s*[^)]+\)/ // 基本三元组格式
  ];
  const hasTriplets = tripletPatterns.some(pattern => pattern.test(content));
  
  // 如果有Tree标记，就认为是Tree内容
  const result = hasBasicTreeMarkers || hasTreeTags || (hasTriplets && hasTreeTags);
  
  console.log('MosaicContentRenderer - hasTreeMarkers:', {
    result,
    hasBasicTreeMarkers,
    hasTreeTags,
    hasTriplets,
    contentLength: content.length,
    contentPreview: content.substring(0, 300) + '...',
    hasStartMarker: content.includes('<Tree START>'),
    hasEndMarker: content.includes('<Tree END>'),
    hasTreeTag: content.includes('[TREE]'),
    rawContent: content.substring(0, 500)
  });
  return result;
};

// 提取Tree标记中的内容
const extractTreeContent = (content: string): string | null => {
  const patterns = [
    // [TREE] 格式
    /\[TREE\]\s*```[\s\S]*?<Tree START>\s*\n([\s\S]*?)<Tree END>/i,
    /\[TREE\]\s*```[\s\S]*?<Tree START>\s*([\s\S]*?)<Tree END>/i,
    /\[TREE\][\s\S]*?<Tree START>[\s\S]*?\n([\s\S]*?)<Tree END>/i,
    
    // 单行格式的Tree标记（重要！）
    /<Tree START>\s*([\s\S]*?)\s*<Tree END>/i,
    /<Tree\s+START>\s*([\s\S]*?)\s*<Tree\s+END>/i,
    
    // 多行格式
    /<Tree START>\s*\n([\s\S]*?)<Tree END>/i,
    
    // JSON格式检测
    /\[TREE\]\s*```[\s\S]*?(\{[\s\S]*?\})/i,
    /\[TREE\]\s*(\{[\s\S]*?\})/i,
    
    // 原始Tree START/END格式
    /Tree\s+START\s*>([\s\S]*?)<\s*Tree\s+END/i,
    /Tree START[\s\S]*?\n([\s\S]*?)Tree END/i,
    
    // 代码块包装格式
    /```[\s\S]*?<Tree START>\s*\n([\s\S]*?)<Tree END>[\s\S]*?```/i,
    /```[\s\S]*?<Tree\s+START>\s*\n([\s\S]*?)<Tree\s+END>[\s\S]*?```/i,
  ];
  
  let match = null;
  let usedPattern = -1;
  
  // 首先尝试处理JSON转义字符
  const processedContent = content.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  
  for (let i = 0; i < patterns.length; i++) {
    // 先在处理过的内容中尝试
    match = processedContent.match(patterns[i]);
    if (match) {
      usedPattern = i;
      console.log(`MosaicContentRenderer - 使用处理后的内容匹配Tree模式${i}`);
      break;
    }
    
    // 然后在原始内容中尝试
    match = content.match(patterns[i]);
    if (match) {
      usedPattern = i;
      console.log(`MosaicContentRenderer - 使用原始内容匹配Tree模式${i}`);
      break;
    }
  }
  
  const result = match ? match[1].trim() : null;
  
  // 如果提取到内容，验证是否包含三元组格式或其他有效格式
  if (result) {
    const tripletPatterns = [
      /\([^,)]+,\s*(has_child|has_domain|has_content|has_outcome|collaborates_with|relates_to|contains|includes),\s*[^)]+\)/,
      /\([^,)]+,\s*[^,)]+,\s*[^)]+\)/ // 基本三元组格式
    ];
    const hasTriplets = tripletPatterns.some(pattern => pattern.test(result));
    
    console.log('MosaicContentRenderer - extractTreeContent:', {
      hasMatch: !!match,
      usedPattern,
      resultLength: result.length,
      hasTriplets,
      resultPreview: result.substring(0, 300) + '...',
      matchedContent: match ? match[0].substring(0, 500) + '...' : null,
      tripletCount: (result.match(/\([^)]+\)/g) || []).length
    });
    
    // 如果包含三元组或者是有效的JSON/缩进格式，返回结果
    if (hasTriplets || result.includes('{') || result.includes('-') || result.includes('*')) {
      return result;
    }
  }
  
  console.log('MosaicContentRenderer - extractTreeContent: 未找到有效的Tree内容');
  return null;
};

// 从思考过程中提取Tree内容
const extractTreeFromThoughts = (thoughtProcess: string[]): string | null => {
  if (!thoughtProcess || !Array.isArray(thoughtProcess)) {
    console.log('MosaicContentRenderer - extractTreeFromThoughts: 没有思考过程数据');
    return null;
  }
  
  console.log('MosaicContentRenderer - extractTreeFromThoughts: 开始检查思考过程', {
    thoughtProcessLength: thoughtProcess.length
  });
  
  // 遍历思考步骤，查找包含Tree内容的步骤
  for (let i = 0; i < thoughtProcess.length; i++) {
    const thought = thoughtProcess[i];
    
    // 检查包含[TREE]或[EXTRACT]的思考步骤
    if ((thought.includes('[TREE]') || thought.includes('[EXTRACT]')) && 
        (thought.includes('<Tree START>') && thought.includes('<Tree END>'))) {
      console.log(`MosaicContentRenderer - 发现包含Tree标记的步骤${i}`);
      
      const treeContent = extractTreeContent(thought);
      if (treeContent) {
        console.log(`MosaicContentRenderer - 在思考${i}中找到Tree内容`);
        return treeContent;
      }
    }
    
    // 检查JSON格式的树形结构
    if (thought.includes('[TREE]') && (thought.includes('{') && thought.includes('}'))) {
      const jsonMatch = thought.match(/\[TREE\][\s\S]*?(\{[\s\S]*?\})/);
      if (jsonMatch) {
        try {
          JSON.parse(jsonMatch[1]); // 验证是否为有效JSON
          console.log(`MosaicContentRenderer - 在思考${i}中找到JSON格式的Tree内容`);
          return jsonMatch[1];
        } catch (e) {
          console.log(`MosaicContentRenderer - 步骤${i}的JSON格式无效`);
        }
      }
    }
  }
  
  console.log('MosaicContentRenderer - 未在思考过程中找到Tree内容');
  return null;
};

// 生成树形预览
const generateTreePreview = (content: string): string => {
  // 检测是否为三元组格式
  const tripletPattern = /\(([^,)]+),\s*([^,)]+),\s*([^)]+)\)/g;
  const triplets = content.match(tripletPattern);
  
  if (triplets && triplets.length > 0) {
    const preview = triplets.slice(0, 5).join('\n');
    return `🌳 Tree Structure (${triplets.length} relations):\n${preview}${triplets.length > 5 ? '\n...' : ''}`;
  }
  
  try {
    // 尝试解析JSON
    const jsonData = JSON.parse(content);
    const jsonStr = JSON.stringify(jsonData, null, 2);
    const lines = jsonStr.split('\n');
    const preview = lines.slice(0, 8).join('\n');
    return `🌳 Tree Structure (JSON format):\n${preview}${lines.length > 8 ? '\n...' : ''}`;
  } catch (e) {
    // 如果不是JSON，显示缩进格式
    const lines = content.split('\n').filter(line => line.trim());
    const preview = lines.slice(0, 8).join('\n');
    return `🌳 Tree Structure:\n${preview}${lines.length > 8 ? '\n...' : ''}`;
  }
};

// 检测独立的表格区域（精确检测，支持代码块中的表格）
const detectTableRegions = (content: string): Array<{start: number, end: number, content: string}> => {
  const lines = content.split('\n');
  const tableRegions: Array<{start: number, end: number, content: string}> = [];
  
  let currentTableStart = -1;
  let currentTableLines: string[] = [];
  let codeBlockStart = -1;
  
  // 计算每行在原始内容中的起始位置
  const lineStartPositions: number[] = [];
  let position = 0;
  for (let i = 0; i < lines.length; i++) {
    lineStartPositions[i] = position;
    position += lines[i].length + 1; // +1 for newline character
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isCodeBlockMarker = line === '```' || line.startsWith('```');
    const isTableLine = line.includes('|') && line.length > 5;
    
    // 检测代码块
    if (isCodeBlockMarker) {
      if (codeBlockStart === -1) {
        codeBlockStart = i;
      } else {
        // 代码块结束，检查是否包含表格
        if (currentTableStart !== -1) {
          // 代码块内有表格，检查是否为有效的Markdown表格
          const tableCounts = currentTableLines.map(line => {
            return (line.match(/\|/g) || []).length;
          }).filter(count => count > 2);
          
          // 判断是否为有效表格：
          // 1. 至少有3行（包括表头、分隔线、数据行）
          // 2. 至少有一半的行具有一致的列数
          if (currentTableLines.length >= 3 && tableCounts.length >= 2) {
            const firstCount = tableCounts[0];
            const consistentRows = tableCounts.filter(count => count === firstCount).length;
            const consistencyRatio = consistentRows / tableCounts.length;
            
            // 对于代码块中的表格，放宽条件：
            // - 大型表格（>=10行）：保持原有严格条件
            // - 小型表格（<10行）：只要有基本的表格结构就接受
            const isLargeTable = currentTableLines.length >= 10;
            const isValidTable = isLargeTable ? 
              (consistentRows >= 8 || currentTableLines.length >= 15) :
              (consistencyRatio >= 0.6 && currentTableLines.length >= 3);
            
            if (isValidTable) {
              // 确认为有效表格，包含整个代码块
              const startPos = lineStartPositions[codeBlockStart];
              const endPos = lineStartPositions[i] + lines[i].length;
              const tableContent = currentTableLines.join('\n');
              
              tableRegions.push({
                start: startPos,
                end: endPos,
                content: tableContent
              });
            }
          }
          
          // 重置表格状态
          currentTableStart = -1;
          currentTableLines = [];
        }
        
        // 重置代码块状态
        codeBlockStart = -1;
      }
      continue;
    }
    
    if (isTableLine) {
      if (currentTableStart === -1) {
        currentTableStart = i;
        currentTableLines = [lines[i]];
      } else {
        currentTableLines.push(lines[i]);
      }
    } else {
      // 非表格行，检查是否结束当前表格（仅在非代码块中）
      if (currentTableStart !== -1 && codeBlockStart === -1) {
        // 检查累积的表格行是否构成大型表格
        if (currentTableLines.length >= 10) {
          // 检查表格一致性
          const tableCounts = currentTableLines.map(line => {
            return (line.match(/\|/g) || []).length;
          }).filter(count => count > 2);
          
          if (tableCounts.length >= 8) {
            const firstCount = tableCounts[0];
            const consistentRows = tableCounts.filter(count => count === firstCount).length;
            
            if (consistentRows >= 8 || currentTableLines.length >= 15) {
              // 确认为大型表格
              const tableContent = currentTableLines.join('\n');
              const startPos = lineStartPositions[currentTableStart];
              const endLineIndex = currentTableStart + currentTableLines.length - 1;
              const endPos = lineStartPositions[endLineIndex] + lines[endLineIndex].length;
              
              tableRegions.push({
                start: startPos,
                end: endPos,
                content: tableContent
              });
            }
          }
        }
        
        // 重置表格状态
        currentTableStart = -1;
        currentTableLines = [];
      }
    }
  }
  
  // 处理文件末尾的表格
  if (currentTableStart !== -1 && currentTableLines.length >= 10) {
    const tableCounts = currentTableLines.map(line => {
      return (line.match(/\|/g) || []).length;
    }).filter(count => count > 2);
    
    if (tableCounts.length >= 8) {
      const firstCount = tableCounts[0];
      const consistentRows = tableCounts.filter(count => count === firstCount).length;
      
      if (consistentRows >= 8 || currentTableLines.length >= 15) {
        const tableContent = currentTableLines.join('\n');
        
        if (codeBlockStart !== -1) {
          // 表格在代码块中，包含整个代码块
          const startPos = lineStartPositions[codeBlockStart];
          const endPos = content.length;
          
          tableRegions.push({
            start: startPos,
            end: endPos,
            content: tableContent
          });
        } else {
          // 表格不在代码块中
          const startPos = lineStartPositions[currentTableStart];
          const endLineIndex = currentTableStart + currentTableLines.length - 1;
          const endPos = lineStartPositions[endLineIndex] + lines[endLineIndex].length;
          
          tableRegions.push({
            start: startPos,
            end: endPos,
            content: tableContent
          });
        }
      }
    }
  }
  
  console.log('Detected table regions:', tableRegions.length, tableRegions.map(r => ({ 
    start: r.start, 
    end: r.end, 
    contentPreview: r.content.substring(0, 100) + '...'
  })));
  return tableRegions;
};

// 生成表格预览
const generateTablePreview = (content: string): string => {
  const lines = content.split('\n');
  const tableLines = lines.filter(line => line.includes('|'));
  const preview = tableLines.slice(0, 5).join('\n');
  return `📋 Table Data (${tableLines.length} rows):\n${preview}${tableLines.length > 5 ? '\n...' : ''}`;
};

// 生成图形预览
const generateGraphPreview = (content: string): string => {
  // 尝试提取前几个三元组作为预览
  const tripletPatterns = [
    /\([^,)]+,\s*[^,)]+,\s*[^)]+\)/g,
    /\([^,)]+,\s*"[^"]*",\s*"[^"]*"\)/g
  ];
  
  for (const pattern of tripletPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      const preview = matches.slice(0, 3).join('\n');
      return `📊 Graph Data (${matches.length} relations):\n${preview}${matches.length > 3 ? '\n...' : ''}`;
    }
  }
  
  // 如果没有找到三元组，显示内容开头
  const lines = content.split('\n').filter(line => line.trim());
  const preview = lines.slice(0, 3).join('\n');
  return `📊 Graph Data:\n${preview}${lines.length > 3 ? '\n...' : ''}`;
};

// Markdown渲染组件
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        h1: ({children}) => (
          <Typography variant="h4" component="h1" sx={{ 
            fontWeight: 'bold', 
            mb: 2, 
            mt: 2,
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '8px'
          }}>
            {children}
          </Typography>
        ),
        h2: ({children}) => (
          <Typography variant="h5" component="h2" sx={{ 
            fontWeight: 'bold', 
            mb: 1.5, 
            mt: 1.5,
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '6px'
          }}>
            {children}
          </Typography>
        ),
        h3: ({children}) => (
          <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold', mb: 1, mt: 1 }}>
            {children}
          </Typography>
        ),
        p: ({children}) => (
          <Typography variant="body1" sx={{ mb: 1, lineHeight: 1.6, color: '#0f172a' }}>
            {children}
          </Typography>
        ),
        strong: ({children}) => (
          <Box component="strong" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
            {children}
          </Box>
        ),
        em: ({children}) => (
          <Box component="em" sx={{ fontStyle: 'italic', color: '#4b5563' }}>
            {children}
          </Box>
        ),
        code: ({children, className}) => {
          const isInline = !className?.includes('language-');
          const language = className?.replace('language-', '') || '';
          
          return isInline ? (
            <Box
              component="code"
              sx={{
                backgroundColor: '#f8f9fa',
                color: '#e83e8c',
                padding: '3px 6px',
                borderRadius: '4px',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '0.9em',
                border: '1px solid #e9ecef',
              }}
            >
              {children}
            </Box>
          ) : (
            <Box sx={{ mb: 2 }}>
              {language && (
                <Box
                  sx={{
                    backgroundColor: '#f8f9fa',
                    padding: '8px 12px',
                    borderRadius: '6px 6px 0 0',
                    fontSize: '0.8em',
                    color: '#6c757d',
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    borderBottom: '1px solid #e9ecef',
                    fontWeight: 500,
                  }}
                >
                  {language.toUpperCase()}
                </Box>
              )}
              <Box
                component="pre"
                sx={{
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  padding: 2,
                  borderRadius: language ? '0 0 6px 6px' : '6px',
                  overflow: 'auto',
                  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                  fontSize: '0.9em',
                  margin: 0,
                }}
              >
                <code>{children}</code>
              </Box>
            </Box>
          );
        },
        table: ({children}) => (
          <Box
            sx={{
              overflowX: 'auto',
              mb: 2,
              border: '1px solid #e5e7eb',
              borderRadius: 1,
              backgroundColor: '#fff',
            }}
          >
            <Box component="table" sx={{ 
              width: '100%', 
              borderCollapse: 'separate',
              borderSpacing: 0,
            }}>
              {children}
            </Box>
          </Box>
        ),
        th: ({children}) => (
          <Box
            component="th"
            sx={{
              border: '1px solid #e5e7eb',
              padding: '12px 16px',
              fontWeight: 'bold',
              textAlign: 'left',
              fontSize: '0.9em',
              backgroundColor: '#f9fafb',
              color: '#374151',
            }}
          >
            {children}
          </Box>
        ),
        td: ({children}) => (
          <Box
            component="td"
            sx={{
              border: '1px solid #e5e7eb',
              padding: '10px 16px',
              fontSize: '0.9em',
              color: '#4b5563',
            }}
          >
            {children}
          </Box>
        ),
        blockquote: ({children}) => (
          <Box
            sx={{
              borderLeft: '4px solid #2563eb',
              paddingLeft: 2,
              marginLeft: 0,
              marginY: 2,
              backgroundColor: '#f8fafc',
              padding: 2,
              borderRadius: '0 6px 6px 0',
              '& p:last-child': { mb: 0 },
            }}
          >
            {children}
          </Box>
        ),
        hr: () => (
          <Box
            sx={{
              border: 'none',
              height: '2px',
              background: 'linear-gradient(to right, transparent, #e5e7eb, transparent)',
              margin: '24px 0',
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                left: '50%',
                top: '-4px',
                transform: 'translateX(-50%)',
                width: '8px',
                height: '8px',
                background: '#2563eb',
                borderRadius: '50%'
              }
            }}
          />
        ),
        ul: ({children}) => (
          <Box
            component="ul"
            sx={{
              marginBottom: 2,
              paddingLeft: '20px',
              listStyleType: 'disc',
              '& li': {
                marginBottom: 0.5,
                lineHeight: 1.6,
              }
            }}
          >
            {children}
          </Box>
        ),
        ol: ({children}) => (
          <Box
            component="ol"
            sx={{
              marginBottom: 2,
              paddingLeft: '32px', // 增加左边距以适应两位数序号
              listStyleType: 'decimal',
              listStylePosition: 'outside',
              '& li': {
                marginBottom: 0.5,
                lineHeight: 1.6,
                '&::marker': {
                  color: '#2563eb',
                  fontWeight: 600,
                }
              }
            }}
          >
            {children}
          </Box>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

// 处理混合内容的函数
const renderMixedContent = (content: string, additionalGraphContent?: string | null, allGraphsFromThoughts?: string[], additionalTreeContent?: string | null) => {
  const segments: JSX.Element[] = [];
  let segmentIndex = 0;
  
  // 如果从思考过程中提取到了多个Graph内容，需要在原始位置替换它们
  if (allGraphsFromThoughts && allGraphsFromThoughts.length > 0) {
    console.log('MosaicContentRenderer - 多Graph模式: 在原始位置显示所有Graph', {
      totalGraphs: allGraphsFromThoughts.length
    });
    
    // 找到所有Graph标记的位置
    const graphBlockPatterns = [
      /\*\*\[GRAPH_PLACEHOLDER\]\*\*/gi,
      /```[\s\S]*?<Graph START>[\s\S]*?<Graph END>[\s\S]*?```/gi,
      /<Graph START>[\s\S]*?<Graph END>/gi
    ];
    
    let workingContent = content;
    let graphMatches = [];
    
    // 收集所有Graph标记的位置
    for (const pattern of graphBlockPatterns) {
      let match;
      pattern.lastIndex = 0; // 重置正则状态
      while ((match = pattern.exec(workingContent)) !== null) {
        graphMatches.push({
          index: match.index,
          match: match[0],
          length: match[0].length
        });
        
        // 防止无限循环
        if (pattern.lastIndex <= match.index) {
          break;
        }
      }
    }
    
    // 按位置排序
    graphMatches.sort((a, b) => a.index - b.index);
    
    console.log('MosaicContentRenderer - 找到的Graph位置:', {
      graphMatchCount: graphMatches.length,
      availableGraphs: allGraphsFromThoughts.length,
      positions: graphMatches.map(m => ({ index: m.index, preview: m.match.substring(0, 50) + '...' }))
    });
    
    // 替换Graph标记为实际的Graph内容
    let lastIndex = 0;
    let graphIndex = 0;
    
    for (const graphMatch of graphMatches) {
      // 添加Graph前的内容
      if (graphMatch.index > lastIndex) {
        const beforeContent = workingContent.substring(lastIndex, graphMatch.index);
        if (beforeContent.trim()) {
          const tableRegions = detectTableRegions(beforeContent);
          
          if (tableRegions.length > 0) {
            let tableLastIndex = 0;
            
            for (const region of tableRegions) {
              if (region.start > tableLastIndex) {
                const textPart = beforeContent.substring(tableLastIndex, region.start);
                if (textPart.trim()) {
                  segments.push(
                    <MarkdownRenderer key={`text-before-graph-${graphIndex}-${segmentIndex++}`} content={textPart} />
                  );
                }
              }
              
              segments.push(
                <LargeContentViewer
                  key={`table-before-graph-${graphIndex}-${segmentIndex++}`}
                  content={region.content}
                  contentType="table"
                  preview={generateTablePreview(region.content)}
                />
              );
              
              tableLastIndex = region.end;
            }
            
            if (tableLastIndex < beforeContent.length) {
              const remainingText = beforeContent.substring(tableLastIndex);
              if (remainingText.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-remaining-before-graph-${graphIndex}-${segmentIndex++}`} content={remainingText} />
                );
              }
            }
          } else {
            segments.push(
              <MarkdownRenderer key={`text-before-graph-${graphIndex}-${segmentIndex++}`} content={beforeContent} />
            );
          }
        }
      }
      
      // 添加对应的Graph内容
      if (graphIndex < allGraphsFromThoughts.length) {
        const graphContent = allGraphsFromThoughts[graphIndex];
        if (graphContent && graphContent.trim()) {
          segments.push(
            <LargeContentViewer
              key={`graph-${graphIndex}-${segmentIndex++}`}
              content={graphContent}
              contentType="graph"
              preview={generateGraphPreview(graphContent)}
            />
          );
        }
      }
      
      lastIndex = graphMatch.index + graphMatch.length;
      graphIndex++;
    }
    
    // 处理最后剩余的内容
    if (lastIndex < workingContent.length) {
      const remainingContent = workingContent.substring(lastIndex);
      if (remainingContent.trim()) {
        const tableRegions = detectTableRegions(remainingContent);
        
        if (tableRegions.length > 0) {
          let tableLastIndex = 0;
          
          for (const region of tableRegions) {
            if (region.start > tableLastIndex) {
              const textPart = remainingContent.substring(tableLastIndex, region.start);
              if (textPart.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-final-${segmentIndex++}`} content={textPart} />
                );
              }
            }
            
            segments.push(
              <LargeContentViewer
                key={`table-final-${segmentIndex++}`}
                content={region.content}
                contentType="table"
                preview={generateTablePreview(region.content)}
              />
            );
            
            tableLastIndex = region.end;
          }
          
          if (tableLastIndex < remainingContent.length) {
            const finalText = remainingContent.substring(tableLastIndex);
            if (finalText.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-final-remaining-${segmentIndex++}`} content={finalText} />
              );
            }
          }
        } else {
          segments.push(
            <MarkdownRenderer key={`text-final-${segmentIndex++}`} content={remainingContent} />
          );
        }
      }
    }
    
    return (
      <Box>
        {segments}
      </Box>
    );
  }
  
  // 如果只有单个Graph内容，使用原来的逻辑
  if (additionalGraphContent) {
    console.log('MosaicContentRenderer - 单Graph模式: 在内容中查找Graph位置并替换');
    
    // 找到主要内容中Graph代码块的位置（包括占位符）
    const graphBlockPatterns = [
      // 优先查找占位符
      /\*\*\[GRAPH_PLACEHOLDER\]\*\*/gi,
      // 然后查找原始Graph标记
      /```[\s\S]*?<Graph START>[\s\S]*?<Graph END>[\s\S]*?```/gi,
      /<Graph START>[\s\S]*?<Graph END>/gi
    ];
    
    let graphBlockMatch = null;
    let usedPattern = -1;
    
    for (let i = 0; i < graphBlockPatterns.length; i++) {
      const match = content.match(graphBlockPatterns[i]);
      if (match) {
        graphBlockMatch = match;
        usedPattern = i;
        const matchIndex = content.indexOf(match[0]);
        graphBlockMatch.index = matchIndex;
        break;
      }
    }
    
    if (graphBlockMatch && graphBlockMatch.index !== undefined) {
      // 找到了Graph代码块，按位置分段处理
      const beforeGraph = content.substring(0, graphBlockMatch.index);
      const afterGraph = content.substring(graphBlockMatch.index + graphBlockMatch[0].length);
      
      console.log('MosaicContentRenderer - Graph块位置信息:', {
        beforeGraphLength: beforeGraph.length,
        afterGraphLength: afterGraph.length,
        graphBlockLength: graphBlockMatch[0].length,
        usedPattern
      });
      
      // 处理Graph前的内容
      if (beforeGraph.trim()) {
        const tableRegions = detectTableRegions(beforeGraph);
        
        if (tableRegions.length > 0) {
          let lastIndex = 0;
          
          for (const region of tableRegions) {
            if (region.start > lastIndex) {
              const textPart = beforeGraph.substring(lastIndex, region.start);
              if (textPart.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-before-${segmentIndex++}`} content={textPart} />
                );
              }
            }
            
            segments.push(
              <LargeContentViewer
                key={`table-before-${segmentIndex++}`}
                content={region.content}
                contentType="table"
                preview={generateTablePreview(region.content)}
              />
            );
            
            lastIndex = region.end;
          }
          
          if (lastIndex < beforeGraph.length) {
            const remainingText = beforeGraph.substring(lastIndex);
            if (remainingText.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-before-final-${segmentIndex++}`} content={remainingText} />
              );
            }
          }
        } else {
          segments.push(
            <MarkdownRenderer key={`text-before-${segmentIndex++}`} content={beforeGraph} />
          );
        }
      }
      
      // 在正确位置添加Graph内容
      segments.push(
        <LargeContentViewer
          key={`graph-from-thoughts-${segmentIndex++}`}
          content={additionalGraphContent}
          contentType="graph"
          preview={generateGraphPreview(additionalGraphContent)}
        />
      );
      
      // 处理Graph后的内容
      if (afterGraph.trim()) {
        const tableRegions = detectTableRegions(afterGraph);
        
        if (tableRegions.length > 0) {
          let lastIndex = 0;
          
          for (const region of tableRegions) {
            if (region.start > lastIndex) {
              const textPart = afterGraph.substring(lastIndex, region.start);
              if (textPart.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-after-${segmentIndex++}`} content={textPart} />
                );
              }
            }
            
            segments.push(
              <LargeContentViewer
                key={`table-after-${segmentIndex++}`}
                content={region.content}
                contentType="table"
                preview={generateTablePreview(region.content)}
              />
            );
            
            lastIndex = region.end;
          }
          
          if (lastIndex < afterGraph.length) {
            const remainingText = afterGraph.substring(lastIndex);
            if (remainingText.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-after-final-${segmentIndex++}`} content={remainingText} />
              );
            }
          }
        } else {
          segments.push(
            <MarkdownRenderer key={`text-after-${segmentIndex++}`} content={afterGraph} />
          );
        }
      }
      
      return (
        <Box>
          {segments}
        </Box>
      );
    } else {
      // 没有找到Graph代码块，在最前面添加Graph，然后渲染所有内容
      console.log('MosaicContentRenderer - 未找到Graph代码块，在前面添加Graph');
      
      segments.push(
        <LargeContentViewer
          key={`graph-from-thoughts-${segmentIndex++}`}
          content={additionalGraphContent}
          contentType="graph"
          preview={generateGraphPreview(additionalGraphContent)}
        />
      );
      
      // 继续处理原内容
      const tableRegions = detectTableRegions(content);
      
      if (tableRegions.length > 0) {
        let lastIndex = 0;
        
        for (const region of tableRegions) {
          if (region.start > lastIndex) {
            const textPart = content.substring(lastIndex, region.start);
            if (textPart.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-${segmentIndex++}`} content={textPart} />
              );
            }
          }
          
          segments.push(
            <LargeContentViewer
              key={`table-${segmentIndex++}`}
              content={region.content}
              contentType="table"
              preview={generateTablePreview(region.content)}
            />
          );
          
          lastIndex = region.end;
        }
        
        if (lastIndex < content.length) {
          const remainingText = content.substring(lastIndex);
          if (remainingText.trim()) {
            segments.push(
              <MarkdownRenderer key={`text-final-${segmentIndex++}`} content={remainingText} />
            );
          }
        }
      } else {
        segments.push(
          <MarkdownRenderer key={`text-${segmentIndex++}`} content={content} />
        );
      }
      
      return (
        <Box>
          {segments}
        </Box>
      );
    }
  }
  
  // 处理Tree内容
  if (additionalTreeContent) {
    console.log('MosaicContentRenderer - Tree模式: 查找Tree位置并替换');
    
    // 查找Tree标记的位置
    const treeBlockPatterns = [
      /```[\s\S]*?<Tree START>[\s\S]*?<Tree END>[\s\S]*?```/gi,
      /<Tree START>[\s\S]*?<Tree END>/gi,
      /\[TREE\][\s\S]*?```[\s\S]*?```/gi
    ];
    
    let treeBlockMatch = null;
    let usedPattern = -1;
    
    for (let i = 0; i < treeBlockPatterns.length; i++) {
      const match = content.match(treeBlockPatterns[i]);
      if (match) {
        treeBlockMatch = match;
        usedPattern = i;
        const matchIndex = content.indexOf(match[0]);
        treeBlockMatch.index = matchIndex;
        break;
      }
    }
    
    if (treeBlockMatch && treeBlockMatch.index !== undefined) {
      // 找到了Tree代码块，按位置分段处理
      const beforeTree = content.substring(0, treeBlockMatch.index);
      const afterTree = content.substring(treeBlockMatch.index + treeBlockMatch[0].length);
      
      console.log('MosaicContentRenderer - Tree块位置信息:', {
        beforeTreeLength: beforeTree.length,
        afterTreeLength: afterTree.length,
        treeBlockLength: treeBlockMatch[0].length,
        usedPattern
      });
      
      // 处理Tree前的内容
      if (beforeTree.trim()) {
        const tableRegions = detectTableRegions(beforeTree);
        
        if (tableRegions.length > 0) {
          let lastIndex = 0;
          
          for (const region of tableRegions) {
            if (region.start > lastIndex) {
              const textPart = beforeTree.substring(lastIndex, region.start);
              if (textPart.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-before-tree-${segmentIndex++}`} content={textPart} />
                );
              }
            }
            
            segments.push(
              <LargeContentViewer
                key={`table-before-tree-${segmentIndex++}`}
                content={region.content}
                contentType="table"
                preview={generateTablePreview(region.content)}
              />
            );
            
            lastIndex = region.end;
          }
          
          if (lastIndex < beforeTree.length) {
            const remainingText = beforeTree.substring(lastIndex);
            if (remainingText.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-before-tree-final-${segmentIndex++}`} content={remainingText} />
              );
            }
          }
        } else {
          segments.push(
            <MarkdownRenderer key={`text-before-tree-${segmentIndex++}`} content={beforeTree} />
          );
        }
      }
      
      // 在正确位置添加Tree内容
      segments.push(
        <LargeContentViewer
          key={`tree-from-thoughts-${segmentIndex++}`}
          content={additionalTreeContent}
          contentType="tree"
          preview={generateTreePreview(additionalTreeContent)}
        />
      );
      
      // 处理Tree后的内容
      if (afterTree.trim()) {
        const tableRegions = detectTableRegions(afterTree);
        
        if (tableRegions.length > 0) {
          let lastIndex = 0;
          
          for (const region of tableRegions) {
            if (region.start > lastIndex) {
              const textPart = afterTree.substring(lastIndex, region.start);
              if (textPart.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-after-tree-${segmentIndex++}`} content={textPart} />
                );
              }
            }
            
            segments.push(
              <LargeContentViewer
                key={`table-after-tree-${segmentIndex++}`}
                content={region.content}
                contentType="table"
                preview={generateTablePreview(region.content)}
              />
            );
            
            lastIndex = region.end;
          }
          
          if (lastIndex < afterTree.length) {
            const remainingText = afterTree.substring(lastIndex);
            if (remainingText.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-after-tree-final-${segmentIndex++}`} content={remainingText} />
              );
            }
          }
        } else {
          segments.push(
            <MarkdownRenderer key={`text-after-tree-${segmentIndex++}`} content={afterTree} />
          );
        }
      }
      
      return (
        <Box>
          {segments}
        </Box>
      );
    } else {
      // 没有找到Tree代码块，在最前面添加Tree，然后渲染所有内容
      console.log('MosaicContentRenderer - 未找到Tree代码块，在前面添加Tree');
      
      segments.push(
        <LargeContentViewer
          key={`tree-from-thoughts-${segmentIndex++}`}
          content={additionalTreeContent}
          contentType="tree"
          preview={generateTreePreview(additionalTreeContent)}
        />
      );
      
      // 继续处理原内容
      const tableRegions = detectTableRegions(content);
      
      if (tableRegions.length > 0) {
        let lastIndex = 0;
        
        for (const region of tableRegions) {
          if (region.start > lastIndex) {
            const textPart = content.substring(lastIndex, region.start);
            if (textPart.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-${segmentIndex++}`} content={textPart} />
              );
            }
          }
          
          segments.push(
            <LargeContentViewer
              key={`table-${segmentIndex++}`}
              content={region.content}
              contentType="table"
              preview={generateTablePreview(region.content)}
            />
          );
          
          lastIndex = region.end;
        }
        
        if (lastIndex < content.length) {
          const remainingText = content.substring(lastIndex);
          if (remainingText.trim()) {
            segments.push(
              <MarkdownRenderer key={`text-final-${segmentIndex++}`} content={remainingText} />
            );
          }
        }
      } else {
        segments.push(
          <MarkdownRenderer key={`text-${segmentIndex++}`} content={content} />
        );
      }
      
      return (
        <Box>
          {segments}
        </Box>
      );
    }
  }
  
  // 然后处理主要内容中的Graph标记（当没有additionalGraphContent时）
  if (hasGraphMarkers(content)) {
    // 支持多种Graph模式：占位符、原始标记等
    const graphPatterns = [
      // 占位符模式（优先）
      /\*\*\[GRAPH_PLACEHOLDER\]\*\*/gi,
      // 原始Graph标记
      /<Graph\s+START>([\s\S]*?)<Graph\s+END>/gi,
      /<Graph START>([\s\S]*?)<Graph END>/gi
    ];
    
    let graphMatches = [];
    
    // 收集所有Graph匹配
    for (const pattern of graphPatterns) {
      let match;
      pattern.lastIndex = 0; // 重置正则状态
      while ((match = pattern.exec(content)) !== null) {
        graphMatches.push({
          index: match.index,
          match: match[0],
          content: match[1] || '', // 占位符没有内容组
          isPlaceholder: pattern.source.includes('GRAPH_PLACEHOLDER')
        });
        
        // 防止无限循环
        if (pattern.lastIndex <= match.index) {
          break;
        }
      }
    }
    
    // 按位置排序
    graphMatches.sort((a, b) => a.index - b.index);
    
    let lastIndex = 0;
    
    for (const graphMatch of graphMatches) {
      // 处理Graph之前的内容
      if (graphMatch.index > lastIndex) {
        const beforeText = content.substring(lastIndex, graphMatch.index);
        if (beforeText.trim()) {
          // 对前面的内容检测表格
          const tableRegions = detectTableRegions(beforeText);
          
          if (tableRegions.length > 0) {
            // 有表格区域，需要分段处理
            let textLastIndex = 0;
            
            for (const region of tableRegions) {
              // 添加表格前的文本
              if (region.start > textLastIndex) {
                const textPart = beforeText.substring(textLastIndex, region.start);
                if (textPart.trim()) {
                  segments.push(
                    <MarkdownRenderer key={`text-${segmentIndex++}`} content={textPart} />
                  );
                }
              }
              
              // 添加表格
              segments.push(
                <LargeContentViewer
                  key={`table-${segmentIndex++}`}
                  content={region.content}
                  contentType="table"
                  preview={generateTablePreview(region.content)}
                />
              );
              
              textLastIndex = region.end;
            }
            
            // 添加最后剩余的文本
            if (textLastIndex < beforeText.length) {
              const remainingText = beforeText.substring(textLastIndex);
              if (remainingText.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-${segmentIndex++}`} content={remainingText} />
                );
              }
            }
          } else {
            // 没有表格，直接渲染文本
            segments.push(
              <MarkdownRenderer key={`text-${segmentIndex++}`} content={beforeText} />
            );
          }
        }
      }
      
      // 添加Graph内容
      // 如果是占位符，使用additionalGraphContent；否则使用提取的内容
      const graphContent = graphMatch.isPlaceholder ? 
        (additionalGraphContent || 'No graph data available') : 
        graphMatch.content.trim();
        
      if (graphContent && graphContent !== 'No graph data available') {
        segments.push(
          <LargeContentViewer
            key={`graph-${segmentIndex++}`}
            content={graphContent}
            contentType="graph"
            preview={generateGraphPreview(graphContent)}
          />
        );
      }
      
      lastIndex = graphMatch.index + graphMatch.match.length;
    }
    
    // 处理Graph后剩余的内容
    if (lastIndex < content.length) {
      const remainingContent = content.substring(lastIndex);
      if (remainingContent.trim()) {
        const tableRegions = detectTableRegions(remainingContent);
        
        if (tableRegions.length > 0) {
          let textLastIndex = 0;
          
          for (const region of tableRegions) {
            // region.start 和 region.end 是相对于 remainingContent 的位置
            if (region.start > textLastIndex) {
              const textPart = remainingContent.substring(textLastIndex, region.start);
              if (textPart.trim()) {
                segments.push(
                  <MarkdownRenderer key={`text-${segmentIndex++}`} content={textPart} />
                );
              }
            }
            
            segments.push(
              <LargeContentViewer
                key={`table-${segmentIndex++}`}
                content={region.content}
                contentType="table"
                preview={generateTablePreview(region.content)}
              />
            );
            
            textLastIndex = region.end;
          }
          
          if (textLastIndex < remainingContent.length) {
            const finalText = remainingContent.substring(textLastIndex);
            if (finalText.trim()) {
              segments.push(
                <MarkdownRenderer key={`text-${segmentIndex++}`} content={finalText} />
              );
            }
          }
        } else {
          segments.push(
            <MarkdownRenderer key={`text-${segmentIndex++}`} content={remainingContent} />
          );
        }
      }
    }
  } else {
    // 没有Graph标记，只处理表格
    const tableRegions = detectTableRegions(content);
    
    if (tableRegions.length > 0) {
      let lastIndex = 0;
      
      for (const region of tableRegions) {
        // 添加表格前的文本
        if (region.start > lastIndex) {
          const textPart = content.substring(lastIndex, region.start);
          if (textPart.trim()) {
            segments.push(
              <MarkdownRenderer key={`text-${segmentIndex++}`} content={textPart} />
            );
          }
        }
        
        // 添加表格
        segments.push(
          <LargeContentViewer
            key={`table-${segmentIndex++}`}
            content={region.content}
            contentType="table"
            preview={generateTablePreview(region.content)}
          />
        );
        
        lastIndex = region.end;
      }
      
      // 添加最后剩余的文本
      if (lastIndex < content.length) {
        const remainingText = content.substring(lastIndex);
        if (remainingText.trim()) {
          segments.push(
            <MarkdownRenderer key={`text-${segmentIndex++}`} content={remainingText} />
          );
        }
      }
    } else {
      // 没有特殊内容，直接渲染
      return <MarkdownRenderer content={content} />;
    }
  }
  
  return (
    <Box sx={{ 
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
      '& > *': {
        maxWidth: '100%'
      }
    }}>
      {segments}
    </Box>
  );
};

const MosaicContentRenderer: React.FC<MosaicContentRendererProps> = ({ content, thoughtProcess }) => {
  // 提取所有Graph内容
  const allGraphsFromThoughts = useMemo(() => {
    return thoughtProcess ? extractAllGraphsFromThoughts(thoughtProcess) : [];
  }, [thoughtProcess]);

  // 为了保持向后兼容，仍然提供第一个Graph
  const graphFromThoughts = useMemo(() => {
    return allGraphsFromThoughts.length > 0 ? allGraphsFromThoughts[0] : null;
  }, [allGraphsFromThoughts]);

  // 提取Tree内容
  const treeFromThoughts = useMemo(() => {
    return thoughtProcess ? extractTreeFromThoughts(thoughtProcess) : null;
  }, [thoughtProcess]);

  // 应用智能内容处理
  const normalizedContent = useMemo(() => {
    console.log('MosaicContentRenderer - 应用智能内容处理');
    return smartContentProcessing(content, allGraphsFromThoughts.length > 0);
  }, [content, allGraphsFromThoughts]);

  // 内容分析
  const contentAnalysis = useMemo(() => {
    const hasGraph = hasGraphMarkers(normalizedContent);
    const hasGraphInThoughts = allGraphsFromThoughts.length > 0;
    const hasTree = hasTreeMarkers(normalizedContent);
    const hasTreeInThoughts = treeFromThoughts !== null;
    const tableRegions = detectTableRegions(normalizedContent);
    const hasTable = tableRegions.length > 0;
    
    // 调试信息
    console.log('MosaicContentRenderer - Content analysis:', {
      hasGraph,
      hasGraphInThoughts,
      hasTree,
      hasTreeInThoughts,
      hasTable,
      totalGraphsFromThoughts: allGraphsFromThoughts.length,
      contentPreview: normalizedContent.substring(0, 200),
      graphContentExtracted: hasGraph ? extractGraphContent(normalizedContent) : null,
      treeContentExtracted: hasTree ? extractTreeContent(normalizedContent) : null,
      allGraphsFromThoughts: allGraphsFromThoughts.map((graph, i) => ({
        index: i,
        tripletCount: (graph.match(/\([^)]+\)/g) || []).length,
        preview: graph.substring(0, 50) + '...'
      })),
      treeFromThoughts: treeFromThoughts ? treeFromThoughts.substring(0, 100) + '...' : null,
      contentNormalized: content !== normalizedContent
    });
    
    return {
      hasGraph: hasGraph || hasGraphInThoughts,
      hasTree: hasTree || hasTreeInThoughts,
      hasTable,
      needsSpecialHandling: hasGraph || hasGraphInThoughts || hasTree || hasTreeInThoughts || hasTable,
      graphFromThoughts,
      allGraphsFromThoughts,
      treeFromThoughts
    };
  }, [content, normalizedContent, graphFromThoughts, allGraphsFromThoughts, treeFromThoughts]);

  // 如果没有特殊内容，直接渲染Markdown
  if (!contentAnalysis.needsSpecialHandling) {
    return <MarkdownRenderer content={normalizedContent} />;
  }

  // 有特殊内容，使用混合渲染
  return renderMixedContent(
    normalizedContent, 
    contentAnalysis.graphFromThoughts, 
    contentAnalysis.allGraphsFromThoughts, 
    contentAnalysis.treeFromThoughts
  );
};

export default MosaicContentRenderer; 