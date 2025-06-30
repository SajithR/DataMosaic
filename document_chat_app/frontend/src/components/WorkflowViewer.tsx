import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InsightsIcon from '@mui/icons-material/Insights';
import Tooltip from '@mui/material/Tooltip';
import ReActProcessor from './ReActProcessor';

interface WorkflowViewerProps {
  isCollapsed: boolean;
  onToggle: () => void;
  thoughtProcess: string[] | null;
  onClose: () => void;
}

const WorkflowViewer: React.FC<WorkflowViewerProps> = ({
  isCollapsed,
  onToggle,
  thoughtProcess,
  onClose
}) => {
  return (
    <Box sx={{ 
      width: isCollapsed ? '60px' : '100%',
      height: '100%',
      transition: 'width 0.3s ease-in-out',
      backgroundColor: '#f8fafc',
      borderLeft: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: isCollapsed ? 'none' : '-2px 0 8px rgba(0,0,0,0.1)',
      zIndex: 10
    }}>
      {isCollapsed ? (
        // 折叠状态：只显示展开按钮
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          height: '100%',
          pt: 2
        }}>
          <Tooltip title="思考过程" placement="left">
            <IconButton 
              onClick={onToggle}
              sx={{ 
                bgcolor: 'grey.300',
                color: 'grey.600',
                height: '30px',
                width: '30px',
                mb: 2,
                '&:hover': { 
                  bgcolor: 'grey.400'
                }
              }}
            >
              <InsightsIcon sx={{ fontSize: '15px' }} />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        // 展开状态：显示完整的工作流程查看器
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          height: '100%',
          p: 2
        }}>
          {/* 标题栏 */}
          {/* <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 2,
            pb: 1,
            borderBottom: '1px solid #e2e8f0'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InsightsIcon sx={{ fontSize: '20px', color: 'primary.main' }} />
              <Typography variant="h6" sx={{ 
                fontSize: '1rem', 
                fontWeight: 600,
                color: 'text.primary'
              }}>
                Thinking Process
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="收起" placement="bottom">
                <IconButton 
                  onClick={onToggle}
                  size="small"
                  sx={{ 
                    color: 'text.secondary',
                    '&:hover': { 
                      bgcolor: 'action.hover' 
                    }
                  }}
                >
                  <ChevronRightIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="关闭" placement="bottom">
                <IconButton 
                  onClick={onClose}
                  size="small"
                  sx={{ 
                    color: 'text.secondary',
                    '&:hover': { 
                      bgcolor: 'action.hover' 
                    }
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box> */}
          
          {/* 内容区域 */}
          <Box sx={{ 
            flexGrow: 1,
            overflowY: 'auto',
            minHeight: 0,
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f5f9',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#cbd5e1',
              borderRadius: '3px',
              '&:hover': {
                background: '#94a3b8',
              },
            },
          }}>
            {thoughtProcess && thoughtProcess.length > 0 ? (
              <ReActProcessor thoughtProcess={thoughtProcess} />
            ) : (
              <Box sx={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: 'text.secondary'
              }}>
                <InsightsIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                <Typography variant="body2" align="center" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  暂无思考过程数据
                </Typography>
                <Typography variant="caption" align="center" sx={{ mt: 1, opacity: 0.7, fontSize: '0.875rem', fontWeight: 400 }}>
                  当AI开始处理问题时，思考过程将显示在这里
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default WorkflowViewer; 