import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import { keyframes } from '@mui/system';
import SearchIcon from '@mui/icons-material/Search';
import MemoryIcon from '@mui/icons-material/Memory';
import PsychologyIcon from '@mui/icons-material/Psychology';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface LiveThinkingRendererProps {
  thoughtProcess: string[];
  isThinking: boolean;
  finalContent?: string; // 最终的答案内容
  showFinalContent?: boolean; // 是否显示最终内容
  filterConfig?: {
    maxThoughts?: number; // 最大显示思考步骤数
    keywordFilters?: string[]; // 关键词过滤器
    excludeTypes?: string[]; // 排除的类型
    coherenceMode?: boolean; // 是否启用连贯性处理
  };
}

interface ProcessedThought {
  content: string;
  type: string;
  icon: React.ReactNode;
  color: string;
  label: string;
  isKeyPoint: boolean; // 是否是关键点
  extractedContent?: string; // 提取的关键内容
  importance: number; // 重要性评分 (1-10)
}

// 脉冲动画
const pulse = keyframes`
  0% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.8;
  }
`;

// 淡入动画
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;


// 添加连贯性转换词
const getTransitionPhrase = (prevType: string, currentType: string): string => {
  const transitions: { [key: string]: { [key: string]: string } } = {
    'thinking': {
      'search': 'in order to verify this idea, I need to',
      'extract': 'based on this idea, I',
      'verify': 'in order to confirm this, I',
      'action': 'therefore, I decided'
    },
    'search': {
      'thinking': 'I found that',
      'extract': 'I extracted from the search results',
      'verify': 'in order to further confirm',
      'action': 'based on the search results'
    },
    'extract': {
      'thinking': 'after extracting information, I think',
      'search': 'this makes me want to know more',
      'verify': 'in order to verify the extracted information',
      'action': 'based on these information'
    },
    'verify': {
      'thinking': 'the verification result shows',
      'search': 'this requires me to continue to find',
      'extract': 'now I need',
      'action': 'based on the verification result'
    },
    'action': {
      'thinking': 'after executing, I found',
      'search': 'this makes me',
      'extract': 'next I want to',
      'verify': 'in order to ensure correctness'
    }
  };
  
  return transitions[prevType]?.[currentType] || '';
};

// 检测步骤数量，用于判断是否需要显示"Step"
const countSteps = (thoughtProcess: string[]): number => {
  if (!thoughtProcess || !Array.isArray(thoughtProcess)) return 0;
  
  const stepPattern = /\*\*Step\s+\d+:/i;
  const stepCount = thoughtProcess.filter(thought => stepPattern.test(thought)).length;
  return stepCount;
};

// 处理思考过程，提取内容
const processThoughts = (thoughtProcess: string[], filterConfig?: LiveThinkingRendererProps['filterConfig']): ProcessedThought[] => {
  if (!thoughtProcess || !Array.isArray(thoughtProcess)) return [];

  // 简化处理 - 只保留主要步骤
  const filteredThoughtProcess = thoughtProcess.filter(thought => {
    // 保留步骤名称
    if (/\*\*Step\s+\d+:/i.test(thought)) {
      return true;
    }
    
    // 保留抽取结果
    if (thought.includes('[EXTRACT]')) {
      return true;
    }
    
    // 保留推理结果
    if (thought.includes('reasoning result') || thought.includes('推理结果')) {
      return true;
    }
    
    return false;
  });

  const processedThoughts = filteredThoughtProcess.map(thought => {
    // 简化类型检测
    let type = 'thinking';
    let icon = <PsychologyIcon fontSize="small" />;
    let color = 'primary';
    let label = '思考';
    
    if (/\*\*Step\s+\d+:/i.test(thought)) {
      type = 'step';
      label = '步骤';
    } else if (thought.includes('[EXTRACT]')) {
      type = 'extract';
      icon = <MemoryIcon fontSize="small" />;
      color = 'info';
      label = '抽取';
    } else if (thought.includes('reasoning result')) {
      type = 'reason';
      icon = <CheckCircleIcon fontSize="small" />;
      color = 'success';
      label = '推理';
    }

    // 清理内容
    let cleanedContent = thought
      .replace('[TEMP:]', '')
      .replace('[THINKING]', '')
      .replace('[SEARCH]', '')
      .replace('[EXTRACT]', '')
      .replace('[VERIFY]', '')
      .replace('[REASON]', '')
      .replace('[DECISION]', '')
      .replace('[REFINE]', '')
      .trim();

    return {
      content: thought,
      type,
      icon,
      color,
      label,
      isKeyPoint: cleanedContent.length > 0,
      extractedContent: cleanedContent,
      importance: type === 'step' ? 3 : 2
    };
  });

  // 简化过滤
  let filteredThoughts = processedThoughts;
  
  if (filterConfig?.maxThoughts) {
    filteredThoughts = filteredThoughts.slice(0, filterConfig.maxThoughts);
  }
  
  return filteredThoughts.filter(thought => thought.isKeyPoint);
};

const LiveThinkingRenderer: React.FC<LiveThinkingRendererProps> = ({
  thoughtProcess,
  isThinking,
  finalContent,
  showFinalContent = false,
  filterConfig = {
    maxThoughts: undefined, 
    excludeTypes: [], // 不排除任何类型，因为我们已经在processThoughts中进行了筛选
    coherenceMode: true 
  }
}) => {
  const [displayedThoughts, setDisplayedThoughts] = useState<ProcessedThought[]>([]);
  const [showFinal, setShowFinal] = useState(false);

  const processedThoughts = processThoughts(thoughtProcess, filterConfig);

  // 实时更新显示的思考过程
  useEffect(() => {
    if (processedThoughts.length > displayedThoughts.length) {
      // 逐步显示新的思考步骤
      const timer = setTimeout(() => {
        setDisplayedThoughts(processedThoughts.slice(0, displayedThoughts.length + 1));
      }, 300); // 延迟300ms显示下一个步骤

      return () => clearTimeout(timer);
    } else {
      setDisplayedThoughts(processedThoughts);
    }
  }, [processedThoughts.length, displayedThoughts.length]);

  // 当思考完成且有最终内容时，显示最终内容
  useEffect(() => {
    if (!isThinking && showFinalContent && finalContent && displayedThoughts.length > 0) {
      const timer = setTimeout(() => {
        setShowFinal(true);
      }, 500); // 思考完成后延迟500ms显示最终答案

      return () => clearTimeout(timer);
    }
  }, [isThinking, showFinalContent, finalContent, displayedThoughts.length]);

  // 过滤出关键点
  const keyPoints = displayedThoughts.filter(thought => thought.isKeyPoint);

  // 构建连贯的显示内容
  const buildCoherentContent = () => {
    if (!filterConfig?.coherenceMode) {
      return keyPoints.map(thought => thought.extractedContent).join('\n\n');
    }
    
    let content = '';
    let prevType = '';
    
    keyPoints.forEach((thought, index) => {
      if (thought.extractedContent) {
        // 为Step类型添加特殊处理
        if (thought.type === 'step') {
          // 从第二个step开始，在上方画横线区分开
          if (index > 0) {
            content += '\n\n---\n\n';
          }
          
          // 提取Step标题并转换为markdown一级标题
          const stepMatch = thought.extractedContent.match(/\*\*Step\s+(\d+):\s*(.+?)\*\*/i);
          if (stepMatch) {
            const stepNumber = stepMatch[1];
            const stepTitle = stepMatch[2];
            // 使用markdown一级标题格式
            content += `# Step ${stepNumber}: ${stepTitle}\n\n`;
            
            // 添加剩余内容（去掉Step标题部分）
            const remainingContent = thought.extractedContent.replace(/\*\*Step\s+\d+:\s*.+?\*\*\s*/i, '').trim();
            if (remainingContent) {
              content += remainingContent;
            }
          } else {
            // 如果没有匹配到Step格式，直接显示内容
            content += thought.extractedContent;
          }
        } else {
          // 非Step类型的处理
          // 添加过渡语句
          if (index > 0 && prevType && prevType !== 'step') {
            const transition = getTransitionPhrase(prevType, thought.type);
            if (transition) {
              content += transition + '：';
            }
          }
          
          // 添加思考内容
          content += thought.extractedContent;
        }
        
        // 在段落间添加适当的间隔
        if (index < keyPoints.length - 1) {
          const nextThought = keyPoints[index + 1];
          // 如果下一个是Step，不添加额外间隔（Step会自己处理）
          if (nextThought?.type !== 'step') {
            content += '\n\n';
          }
        }
        
        prevType = thought.type;
      }
    });
    
    return content;
  };

  const displayContent = buildCoherentContent();

  return (
    <Box sx={{ width: '100%' }}>
      {/* 如果正在思考且还没有内容 */}
      {isThinking && keyPoints.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1.5,
            animation: `${pulse} 2s infinite ease-in-out`
          }}
        >
          <PsychologyIcon fontSize="small" color="primary" />
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'primary.main',
              fontSize: '0.875rem',
              fontWeight: 500,
              fontStyle: 'italic'
            }}
          >
            正在分析问题...
          </Typography>
        </Box>
      )}

      {/* 显示连贯的思考内容 */}
      {displayContent && (
        <Box
          sx={{
            animation: isThinking ? `${pulse} 2s infinite ease-in-out` : `${fadeIn} 0.5s ease-out`
          }}
        >
          <Box
            sx={{
              lineHeight: 1.6,
              color: '#0f172a',
              fontSize: '0.875rem',
              fontWeight: 400,
              fontFamily: 'inherit',
              whiteSpace: 'pre-wrap',
              // 添加一些样式让文本更加优雅
              '& p': { marginBottom: '0.5rem' },
              '& strong': { fontWeight: 600 },
              '& div[style*="background: linear-gradient"]': {
                borderRadius: '8px !important',
                margin: '16px 0 !important',
                padding: '12px 16px !important',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3) !important'
              },
              textAlign: 'justify'
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                h1: ({children}) => (
                  <Typography variant="h5" component="h1" sx={{ 
                    fontWeight: 'bold', 
                    mb: 2, 
                    mt: 2,
                    borderBottom: '2px solid #e5e7eb',
                    paddingBottom: '8px',
                    color: '#1f2937'
                  }}>
                    {children}
                  </Typography>
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
                p: ({children}) => (
                  <Typography variant="body1" sx={{ mb: 1, lineHeight: 1.6, color: '#0f172a' }}>
                    {children}
                  </Typography>
                ),
                strong: ({children}) => (
                  <Box component="strong" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
                    {children}
                  </Box>
                )
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </Box>
        </Box>
      )}

      {/* 显示过滤统计信息（仅在开发模式下）
      {process.env.NODE_ENV === 'development' && keyPoints.length > 0 && (
        <Box sx={{ mt: 1, opacity: 0.6 }}>
          <Typography variant="caption" color="text.secondary">
            显示 {keyPoints.length} / {thoughtProcess.length} 个思考步骤
          </Typography>
        </Box>
      )} */}
    </Box>
  );
};

export default LiveThinkingRenderer; 