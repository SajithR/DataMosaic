import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { keyframes } from '@mui/system';
import SearchIcon from '@mui/icons-material/Search';
import MemoryIcon from '@mui/icons-material/Memory';
import PsychologyIcon from '@mui/icons-material/Psychology';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

interface ThinkingProgressProps {
  thoughtProcess: string[];
  isThinking: boolean;
  onClick?: () => void;
}

// 脉冲动画
const pulse = keyframes`
  0% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.7;
  }
`;

// 过滤掉不需要显示的调试消息
const filterDebugMessages = (thoughts: string[]): string[] => {
  if (!thoughts || !Array.isArray(thoughts)) return [];
  
  return thoughts.filter(thought => {
    // 过滤掉以下格式的消息
    const filterPatterns = [
      /^Starting analysis for query:/i,
      /^Loading and processing documents/i,
      /Structure selection result:/i,
      /Verification Result:/i,
      /^Documents load and process finished/i,
      /^I will use the following query for search/i,
      /^正在检索和问题相关的文档/i,
      /^正在结构化检索到的文档/i,
      /^正在仔细分析文档内容/i,
      /^正在验证信息/i,
      /^执行精炼动作/i,
      /^正在进行推理/i
    ];
    
    return !filterPatterns.some(pattern => pattern.test(thought.trim()));
  });
};

// 获取当前正在进行的步骤
const getCurrentStep = (thoughtProcess: string[]): { label: string; icon: React.ReactNode; color: string } => {
  if (!thoughtProcess || thoughtProcess.length === 0) {
    return { label: 'Thinking', icon: <PsychologyIcon fontSize="small" />, color: 'primary' };
  }

  const lastThought = thoughtProcess[thoughtProcess.length - 1];
  
  // 检查是否是临时思考（包含[TEMP:]标记）
  const isTemporary = lastThought.includes('[TEMP:]');
  
  if (isTemporary || lastThought.includes('[THINKING]')) {
    return { label: 'Thinking', icon: <PsychologyIcon fontSize="small" />, color: 'primary' };
  } else if (lastThought.includes('[SEARCH]')) {
    return { label: 'Searching', icon: <SearchIcon fontSize="small" />, color: 'secondary' };
  } else if (lastThought.includes('[EXTRACT]')) {
    return { label: 'Extracting', icon: <MemoryIcon fontSize="small" />, color: 'info' };
  } else if (lastThought.includes('[VERIFY]')) {
    return { label: 'Verifying', icon: <FactCheckIcon fontSize="small" />, color: 'success' };
  } else if (lastThought.includes('[DECISION]') || lastThought.includes('[REFINE]')) {
    return { label: 'Processing', icon: <AutoFixHighIcon fontSize="small" />, color: 'info' };
  }
  
  return { label: 'Reasoning', icon: <PsychologyIcon fontSize="small" />, color: 'primary' };
};

const ThinkingProgress: React.FC<ThinkingProgressProps> = ({
  thoughtProcess,
  isThinking,
  onClick
}) => {
  if (!isThinking && (!thoughtProcess || thoughtProcess.length === 0)) {
    return null;
  }

  // 过滤掉调试消息
  const filteredThoughtProcess = filterDebugMessages(thoughtProcess);
  
  const currentStep = getCurrentStep(filteredThoughtProcess);
  const stepCount = filteredThoughtProcess ? filteredThoughtProcess.length : 0;
  
  // 呼吸效果：只在思考中且非Processing状态时显示
  const shouldShowPulse = isThinking && currentStep.label !== 'Processing';
  // 加载指示器：只在思考中显示，Processing状态时静态显示
  const shouldShowProgress = isThinking;
  // Processing状态时加载指示器不动画
  const isProcessing = currentStep.label === 'Processing';

  return (
    <Box 
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        mb: 2,
        backgroundColor: '#f8fafc',
        borderRadius: 2,
        border: '1px solid #e2e8f0',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        animation: shouldShowPulse ? `${pulse} 2s infinite ease-in-out` : 'none',
        '&:hover': onClick ? {
          backgroundColor: '#f1f5f9',
          borderColor: '#cbd5e1',
          transform: 'translateY(-1px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        } : {}
      }}
    >
      {/* 加载指示器 */}
      {shouldShowProgress && (
        <CircularProgress 
          size={16} 
          sx={{ 
            color: currentStep.color === 'primary' ? 'primary.main' : 
                   currentStep.color === 'secondary' ? 'secondary.main' :
                   currentStep.color === 'warning' ? 'warning.main' :
                   currentStep.color === 'success' ? 'success.main' :
                   currentStep.color === 'info' ? 'info.main' : 'primary.main',
            // Processing状态时禁用旋转动画
            animation: isProcessing ? 'none' : 'mui-CircularProgress-keyframes-circular-rotate 1.4s linear infinite'
          }} 
        />
      )}
      
      {/* 当前步骤标签 */}
      <Chip
        icon={React.cloneElement(currentStep.icon as React.ReactElement)}
        label={currentStep.label}
        color={currentStep.color as any}
        size="small"
        variant={isThinking ? 'filled' : 'outlined'}
        sx={{ 
          fontSize: '0.875rem',
          height: '24px',
          '& .MuiChip-label': {
            fontSize: '0.875rem',
            fontWeight: 500
          }
        }}
      />
      
      {/* 步骤计数 */}
      <Typography 
        variant="caption" 
        sx={{ 
          color: 'text.secondary',
          fontSize: '0.875rem',
          fontWeight: 400
        }}
      >
        {stepCount > 0 ? `${stepCount} steps` : 'Starting...'}
      </Typography>
      
      {/* 点击提示 */}
      {onClick && (
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'primary.main',
            fontSize: '0.875rem',
            fontWeight: 500,
            fontStyle: 'italic',
            ml: 'auto'
          }}
        >
          View Details
        </Typography>
      )}
    </Box>
  );
};

export default ThinkingProgress; 