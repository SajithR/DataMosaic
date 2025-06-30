import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import EditIcon from '@mui/icons-material/Edit';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import DescriptionIcon from '@mui/icons-material/Description';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import ThinkingProgress from './ThinkingProgress';
import LiveThinkingRenderer from './LiveThinkingRenderer';
import MosaicContentRenderer from './MosaicContentRenderer';
import { verify } from 'crypto';

// 增强的打字机效果组件，支持完整的Markdown渲染
interface TypewriterProps {
  text: string;
  speed?: number; // 打字速度（毫秒）
  punctuationDelay?: number; // 标点符号延迟（毫秒）
  onComplete?: () => void;
}

const Typewriter: React.FC<TypewriterProps> = ({ 
  text, 
  speed = 30, 
  punctuationDelay = 150, 
  onComplete 
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 更精确的markdown语法处理
  const processMarkdownText = React.useMemo(() => {
    // 计算可见字符数，更准确地处理markdown语法
    const patterns = [
      /#+\s/g,                    // 标题符号
      /\*\*(.*?)\*\*/g,          // 粗体
      /\*(.*?)\*/g,              // 斜体
      /~~(.*?)~~/g,              // 删除线
      /`([^`]+)`/g,              // 行内代码
      /```[\s\S]*?```/g,         // 代码块
      /\[([^\]]+)\]\([^)]+\)/g,  // 链接
      />\s*/gm,                  // 引用
      /^[-*+]\s/gm,              // 无序列表
      /^\d+\.\s/gm,              // 有序列表
      /^-\s\[[ x]\]\s/gm,        // 任务列表
      /\|.*?\|/g,                // 表格
      /^---+$/gm,                // 分割线
    ];

    let plainText = text;
    patterns.forEach(pattern => {
      plainText = plainText.replace(pattern, (match, group1) => {
        // 保留内容，去除语法符号
        return group1 || match.replace(/[#*`>|\-\[\]()]/g, '').trim();
      });
    });

    return {
      plainText: plainText.replace(/\s+/g, ' ').trim(),
      totalChars: plainText.replace(/\s+/g, ' ').trim().length
    };
  }, [text]);

  useEffect(() => {
    if (currentIndex < processMarkdownText.totalChars) {
      const currentChar = processMarkdownText.plainText[currentIndex] || '';
      
      // 更智能的标点符号检测
      const isPunctuation = /[。！？，；：""''（）【】,.!?;:()[\]"'\-]/.test(currentChar);
      const isEndOfSentence = /[。！？.!?]/.test(currentChar);
      
      let delay = speed;
      if (isEndOfSentence) {
        delay = punctuationDelay * 2; // 句末停顿更长
      } else if (isPunctuation) {
        delay = punctuationDelay;
      }
      
      timeoutRef.current = setTimeout(() => {
        // 更精确的文本截取算法
        let charCount = 0;
        let displayLength = 0;
        let inCodeBlock = false;
        let inInlineCode = false;
        
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChars = text.slice(i, i + 3);
          
          // 检测代码块
          if (nextChars === '```') {
            inCodeBlock = !inCodeBlock;
            displayLength = i + 3;
            i += 2; // 跳过接下来的两个字符
            continue;
          }
          
          // 检测行内代码
          if (char === '`' && !inCodeBlock) {
            inInlineCode = !inInlineCode;
            displayLength = i + 1;
            continue;
          }
          
          // 在代码块或行内代码中，直接添加字符
          if (inCodeBlock || inInlineCode) {
            displayLength = i + 1;
            continue;
          }
          
          // 跳过markdown语法符号
          if (text.slice(i).match(/^#+\s/) || 
              text.slice(i).match(/^\*\*/) || 
              text.slice(i).match(/^~~/) ||
              text.slice(i).match(/^\[.*?\]\(.*?\)/) ||
              text.slice(i).match(/^>\s/) ||
              text.slice(i).match(/^[-*+]\s/) ||
              text.slice(i).match(/^\d+\.\s/) ||
              text.slice(i).match(/^-\s\[[ x]\]\s/)) {
            
            // 找到语法结束位置
            let skipLength = 1;
            const headingMatch = text.slice(i).match(/^#+\s/);
            if (headingMatch) {
              skipLength = headingMatch[0].length;
            } else if (text.slice(i).match(/^\*\*/)) {
              const match = text.slice(i).match(/^\*\*(.*?)\*\*/);
              skipLength = match ? match[0].length : 2;
            }
            // ... 其他语法处理
            
            displayLength = i + skipLength;
            i += skipLength - 1;
            continue;
          }
          
          // 计算可见字符
          if (charCount >= currentIndex + 1) {
            displayLength = i;
              break;
            }
          
            charCount++;
          displayLength = i + 1;
        }
        
        setDisplayedText(text.slice(0, displayLength));
        setCurrentIndex(prev => prev + 1);
      }, delay);
    } else if (currentIndex === processMarkdownText.totalChars && onComplete) {
      onComplete();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentIndex, text, speed, punctuationDelay, onComplete, processMarkdownText]);

  // 如果文本发生变化，重置状态
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  return (
    <Box 
      sx={{ 
        position: 'relative', 
        width: '100%',
        '& .markdown-content': {
          '& > *:last-child': {
            display: 'inline-block',
            position: 'relative',
            '&::after': currentIndex < processMarkdownText.totalChars ? {
              content: '"▋"',
              color: '#2563eb',
              animation: 'blink 1s infinite',
              fontSize: '1.1em',
              fontWeight: 'bold',
              marginLeft: '2px',
              '@keyframes blink': {
                '0%, 50%': { opacity: 1 },
                '51%, 100%': { opacity: 0 }
              }
            } : {}
          }
        }
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        className="markdown-content typewriter-content"
        components={{
          // 使用简化的组件定义以提高打字机性能
          h1: ({children}) => (
            <Typography variant="h4" component="h1" sx={{ 
              fontWeight: 'bold', 
              mb: 2, 
              mt: 2
            }}>
              {children}
            </Typography>
          ),
          h2: ({children}) => (
            <Typography variant="h5" component="h2" sx={{ 
              fontWeight: 'bold', 
              mb: 1.5, 
              mt: 1.5
            }}>
              {children}
            </Typography>
          ),
          h3: ({children}) => (
            <Typography variant="h6" component="h3" sx={{ 
              fontWeight: 'bold', 
              mb: 1, 
              mt: 1
            }}>
              {children}
            </Typography>
          ),
          p: ({children}) => (
            <Typography 
              variant="body1" 
              sx={{ 
                mb: 1, 
                lineHeight: 1.6
              }}
            >
              {children}
            </Typography>
          ),
          strong: ({children}) => (
            <Box component="strong" sx={{ fontWeight: 'bold' }}>
              {children}
            </Box>
          ),
          em: ({children}) => (
            <Box component="em" sx={{ fontStyle: 'italic' }}>
              {children}
            </Box>
          ),
          code: ({children, className}) => {
            const isInline = !className?.includes('language-');
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
              <Box
                component="pre"
                sx={{
                  backgroundColor: '#1e1e1e',
                  color: '#d4d4d4',
                  padding: 2,
                  borderRadius: 1,
                  overflow: 'auto',
                  mb: 2,
                  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                  fontSize: '0.9em',
                }}
              >
                <code>{children}</code>
              </Box>
            );
          },
        }}
      >
        {displayedText}
      </ReactMarkdown>
    </Box>
  );
};

// Define TypeScript interfaces
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: boolean;
  thoughtProcess?: string[];
  timestamp: string;
  temporary?: boolean;
  dataMosaicEnabledWhenSent?: boolean;
  typewriting?: boolean; // 标记是否正在打字机效果中
  fullContent?: string; // 完整内容，用于打字机效果
  isLoading?: boolean; // 简单加载状态
  liveThinking?: boolean; // 标记是否使用实时思考显示模式
  showThinkingAsContent?: boolean; // 是否将思考过程作为答案内容显示
  selectedFiles?: { filename: string; filepath: string }[]; // 添加选中的文件列表
  uploading?: boolean; // 标记是否为文件上传状态消息
  uploadProgress?: { // 上传进度信息
    total: number;
    completed: number;
    current?: string; // 当前正在上传的文件名
  };
}

interface ChatMessagesProps {
  messages: Message[];
  dataMosaicEnabled?: boolean;
  onFileUpload?: (files: File[]) => void;
  onEditMessage?: (index: number, newContent: string) => void;
  currentChatId?: string | null;
  disableDrag?: boolean;
  onTypewritingComplete?: (index: number) => void; // 新增：打字机完成回调
  onThinkingProgressClick?: (messageIndex?: number) => void; // 新增：点击思考进度的回调
  onFileRead?: (filepath: string) => void; // 添加文件阅读回调
}

// Markdown渲染组件
const MarkdownRenderer: React.FC<{ content: string; className?: string }> = ({ content, className }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        // 自定义组件样式
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
        h4: ({children}) => (
          <Typography variant="subtitle1" component="h4" sx={{ fontWeight: 'bold', mb: 0.5, mt: 0.5 }}>
            {children}
          </Typography>
        ),
        h5: ({children}) => (
          <Typography variant="subtitle2" component="h5" sx={{ fontWeight: 'bold', mb: 0.5, mt: 0.5 }}>
            {children}
          </Typography>
        ),
        h6: ({children}) => (
          <Typography variant="body1" component="h6" sx={{ fontWeight: 'bold', mb: 0.5, mt: 0.5 }}>
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
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2)',
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
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  '& code': {
                    backgroundColor: 'transparent',
                    padding: 0,
                    border: 'none',
                    color: 'inherit',
                    display: 'block',
                    lineHeight: 1.5,
                  },
                  '&:hover': {
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    transition: 'box-shadow 0.3s ease',
                  }
                }}
              >
                <code>{children}</code>
              </Box>
            </Box>
          );
        },
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
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
              position: 'relative',
              '& p:last-child': { mb: 0 },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '-5px',
                left: '10px',
                fontSize: '3em',
                color: '#cbd5e1',
                fontFamily: 'Georgia, serif',
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
              paddingLeft: '20px', // 恢复适当的内边距
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
        ul: ({children}) => (
          <Box
            component="ul"
            sx={{
              marginBottom: 2,
              paddingLeft: '20px', // 恢复适当的内边距
              listStyleType: 'disc',
              listStylePosition: 'outside',
              '& li': {
                marginBottom: 0.5,
                lineHeight: 1.6,
                '&::marker': {
                  color: '#2563eb',
                  fontWeight: 'bold',
                }
              }
            }}
          >
            {children}
          </Box>
        ),
        li: ({children, ...props}) => {
          // 检查是否是任务列表项
          const isTaskList = typeof children === 'object' && 
            Array.isArray(children) && 
            children.some(child => 
              typeof child === 'object' && 
              child?.type === 'input' && 
              child?.props?.type === 'checkbox'
            );

          if (isTaskList) {
            return (
              <Box
                component="li"
                sx={{
                  marginBottom: 0.5,
                  lineHeight: 1.6,
                  listStyleType: 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                {children}
              </Box>
            );
          }

          return (
            <Box
              component="li"
              sx={{
                marginBottom: 0.5,
                lineHeight: 1.6,
                // 移除多余的margin和样式设置，让父元素控制
              }}
            >
              {children}
            </Box>
          );
        },
        // 任务列表复选框
        input: ({type, checked, ...props}) => {
          if (type === 'checkbox') {
            return (
              <input
                type="checkbox"
                checked={checked}
                disabled
                style={{
                  marginRight: '8px',
                  transform: 'scale(1.1)',
                  accentColor: '#2563eb',
                }}
                {...(props as any)}
              />
            );
          }
          return <input type={type} {...(props as any)} />;
        },
        table: ({children}) => (
          <Box
            sx={{
              overflowX: 'auto',
              mb: 2,
              border: '1px solid #e5e7eb',
              borderRadius: 1,
              backgroundColor: '#fff',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
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
        thead: ({children}) => (
          <Box component="thead" sx={{ 
            backgroundColor: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
          }}>
            {children}
          </Box>
        ),
        th: ({children}) => (
          <Box
            component="th"
            sx={{
              border: '1px solid #e5e7eb',
              padding: '16px',
              fontWeight: 'bold',
              textAlign: 'left',
              fontSize: '0.9em',
              backgroundColor: '#f9fafb',
              color: '#374151',
              borderBottom: '2px solid #e5e7eb',
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
              padding: '14px 16px',
              fontSize: '0.9em',
              color: '#4b5563',
              borderBottom: '1px solid #f3f4f6',
              '&:hover': {
                backgroundColor: '#f3f4f6',
                transition: 'background-color 0.2s ease',
              }
            }}
          >
            {children}
          </Box>
        ),
        tr: ({children}) => (
          <Box 
            component="tr" 
            sx={{
              '&:nth-of-type(even) td': {
                backgroundColor: '#f9fafb',
              },
              '&:hover td': {
                backgroundColor: '#f3f4f6',
                transition: 'background-color 0.2s ease',
              }
            }}
          >
            {children}
          </Box>
        ),
        a: ({children, href}) => (
          <Box
            component="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: '#2563eb',
              textDecoration: 'none',
              borderBottom: '1px solid transparent',
              transition: 'all 0.2s ease',
              '&:hover': {
                color: '#1d4ed8',
                borderBottomColor: '#2563eb',
              }
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
        // 支持删除线
        del: ({children}) => (
          <Box component="del" sx={{ 
            textDecoration: 'line-through', 
            color: '#9ca3af',
            opacity: 0.8 
          }}>
            {children}
          </Box>
        ),
      }}
      className={className}
    >
      {content}
    </ReactMarkdown>
  );
};

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, dataMosaicEnabled = true, onFileUpload, onEditMessage, currentChatId, disableDrag, onTypewritingComplete, onThinkingProgressClick, onFileRead }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState<number | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 添加文件折叠状态管理
  const [fileCollapsedState, setFileCollapsedState] = useState<{ [messageIndex: number]: boolean }>({});

  // 文件折叠/展开处理函数
  const toggleFileCollapse = (messageIndex: number) => {
    setFileCollapsedState(prev => ({
      ...prev,
      [messageIndex]: prev[messageIndex] === false ? true : false
    }));
  };

  // 文件阅读处理函数
  const handleFileClick = (filepath: string) => {
    if (onFileRead) {
      onFileRead(filepath);
    }
  };

  // 编辑相关函数
  const handleStartEdit = (index: number, content: string) => {
    setEditingIndex(index);
    setEditingContent(content);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingContent('');
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && onEditMessage && editingContent.trim()) {
      onEditMessage(editingIndex, editingContent.trim());
      setEditingIndex(null);
      setEditingContent('');
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Hover effects for edit button
  const handleMouseEnter = (index: number) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredMessageIndex(index);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredMessageIndex(null);
    }, 100); // 减少延迟时间从300ms到100ms
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // 当currentChatId变化时，自动取消编辑模式
  useEffect(() => {
    if (editingIndex !== null) {
      setEditingIndex(null);
      setEditingContent('');
    }
  }, [currentChatId]);

  // 判断是否应该使用Mosaic渲染
  const shouldUseMosaicRenderer = (message: Message) => {
    // 只有在消息完成生成后才使用MosaicContentRenderer
    if (message.thinking || message.typewriting || message.isLoading) {
      return false;
    }
    
    // 检查思考过程中是否包含Graph内容 - 增强检测
    const hasGraphInThoughts = message.thoughtProcess && message.thoughtProcess.some(thought => {
      // 多种检测方式
      const simpleCheck = thought.includes('[EXTRACT]') && thought.includes('<Graph START>') && thought.includes('<Graph END>');
      const regexCheck = /<Graph\s*START>[\s\S]*?<Graph\s*END>/i.test(thought);
      const tripleCheck = thought.includes('(') && thought.includes(',') && thought.includes(')') && 
                         (thought.includes('Graph') || thought.includes('[EXTRACT]'));
      
      return simpleCheck || regexCheck || tripleCheck;
    });
    
    console.log('ChatMessages - shouldUseMosaicRenderer:', {
      dataMosaicEnabledWhenSent: message.dataMosaicEnabledWhenSent,
      hasGraphInThoughts,
      thoughtProcessLength: message.thoughtProcess?.length || 0,
      // 详细的检测信息
      thoughtAnalysis: message.thoughtProcess?.map((thought, i) => ({
        index: i,
        hasExtract: thought.includes('[EXTRACT]'),
        hasGraphStart: thought.includes('<Graph START>'),
        hasGraphEnd: thought.includes('<Graph END>'),
        hasTriples: thought.includes('(') && thought.includes(',') && thought.includes(')'),
        preview: thought.substring(0, 100) + '...'
      })) || []
    });
    
    // 对于历史消息：如果消息是在Mosaic模式下发送的，或者包含Graph内容，就使用Mosaic渲染
    // 不依赖当前的dataMosaicEnabled状态，以保持历史消息的正确显示
    return message.dataMosaicEnabledWhenSent === true || hasGraphInThoughts;
  };

  // Function to render each type of message
  const renderMessage = (message: Message, index: number) => {
    const { role, content, thinking, thoughtProcess, typewriting, fullContent, isLoading, liveThinking, showThinkingAsContent, uploading, uploadProgress } = message;
    
    // 过滤掉调试消息
    const filterDebugMessages = (content: string): string => {
      if (!content) return '';
      
      let result = content;
      const debugPatterns = [
        /^Starting analysis for query:.*?\n/im,
        /^Loading and processing documents.*?\n/im,
        /^Documents load and process finished.*?\n/im,
        /^I will use the following query for search:.*?\n/im,
        /^Structure selection result:.*?\n/im,
        /^Verification Result:.*?\n/im,
        /^正在检索和问题相关的文档.*?\n/im,
        /^正在结构化检索到的文档.*?\n/im,
        /^正在仔细分析文档内容.*?\n/im,
        /^正在验证信息.*?\n/im,
        /^执行精炼动作.*?\n/im,
        /^正在进行推理.*?\n/im,
        /^Information verification failed.*?\n/im,
        /^Information verification passed.*?\n/im,
      ];
      
      for (const pattern of debugPatterns) {
        result = result.replace(pattern, '');
      }
      
      return result;
    };
    
    // 过滤内容
    const filteredContent = filterDebugMessages(content);
    const filteredFullContent = fullContent ? filterDebugMessages(fullContent) : '';
    
    // 预处理Step标题，将**Step X: 标题**转换为# Step X: 标题
    const preprocessStepTitles = (text: string): string => {
      if (!text) return text;
      
      // 先找到所有Step标题的位置
      const stepMatches = Array.from(text.matchAll(/\*\*Step\s+(\d+):\s*([^*\n]+?)\*\*/gi));
      
      if (stepMatches.length === 0) return text;
      
      let processed = text;
      let offset = 0;
      
      stepMatches.forEach((match, index) => {
        const fullMatch = match[0];
        const stepNumber = match[1];
        const stepTitle = match[2].trim();
        const matchStart = match.index! + offset;
        
        // 检查是否需要添加横线分隔（不是第一个Step）
        const needsSeparator = index > 0;
        const replacement = needsSeparator 
          ? `\n\n---\n\n# Step ${stepNumber}: ${stepTitle}\n\n`
          : `# Step ${stepNumber}: ${stepTitle}\n\n`;
        
        // 执行替换
        const before = processed.substring(0, matchStart);
        const after = processed.substring(matchStart + fullMatch.length);
        processed = before + replacement + after;
        
        // 更新偏移量
        offset += replacement.length - fullMatch.length;
      });
      
      return processed;
    };
    
    const processedContent = preprocessStepTitles(filteredContent);
    const processedFullContent = preprocessStepTitles(filteredFullContent);
    
    return (
      <Box key={index} sx={{ mb: 2 }}>
        {role === 'assistant' ? (
          // AI助手回答：左侧显示，无聊天框，直接显示
          <Box sx={{ mr: 4 }}>
            {/* 显示思考进度条 */}
            {thinking && (
              <ThinkingProgress 
                thoughtProcess={thoughtProcess || []}
                isThinking={true}
                onClick={() => onThinkingProgressClick?.(index)}
              />
            )}

            {/* 实时思考显示模式 */}
            {liveThinking && showThinkingAsContent ? (
              thinking ? (
                <LiveThinkingRenderer
                  thoughtProcess={thoughtProcess || []}
                  isThinking={true}
                  finalContent=""
                  showFinalContent={false}
                  filterConfig={{
                    maxThoughts: undefined, // 不限制数量
                    excludeTypes: [], // 不排除任何类型，因为已经在组件内部进行了筛选
                    coherenceMode: true, // 启用连贯性处理，让文字更连贯
                    keywordFilters: undefined // 不使用内容关键词过滤
                  }}
                />
              ) : (
                // 思考完成后，直接显示包含思考过程的完整答案
                <>
                  {/* Show completed thinking progress if there's a thought process */}
                  {thoughtProcess && thoughtProcess.length > 0 && (
                    <ThinkingProgress 
                      thoughtProcess={thoughtProcess}
                      isThinking={false}
                      onClick={() => onThinkingProgressClick?.(index)}
                    />
                  )}
                  {/* 根据是否启用Mosaic模式来选择渲染方式 */}
                  {shouldUseMosaicRenderer(message) ? (
                    <MosaicContentRenderer content={processedContent} thoughtProcess={thoughtProcess} />
                  ) : (
                    <MarkdownRenderer content={processedContent} className="markdown-content" />
                  )}
                </>
              )
            ) : (
              <>
                {thinking ? (
                  <Box>
                    {/* Show thinking progress */}
                    <ThinkingProgress 
                      thoughtProcess={thoughtProcess || []}
                      isThinking={true}
                      onClick={() => onThinkingProgressClick?.(index)}
                    />
                  </Box>
                ) : isLoading ? (
                  // Simple loading state for non-DataMosaic mode
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1.5,
                    mb: 2,
                    backgroundColor: 'transparent',
                  }}>
                    <CircularProgress size={20} color="primary" />
                  </Box>
                ) : (
                  <>
                    {/* Show completed thinking progress if there's a thought process */}
                    {thoughtProcess && thoughtProcess.length > 0 && (
                      <ThinkingProgress 
                        thoughtProcess={thoughtProcess}
                        isThinking={false}
                        onClick={() => onThinkingProgressClick?.(index)}
                      />
                    )}
                  </>
                )}
                
                {!thinking && (
                  // 根据是否有打字机效果来选择渲染方式
                  typewriting && fullContent ? (
                    <>
                      <Typewriter 
                        text={processedFullContent || fullContent}
                        speed={15}
                        punctuationDelay={70}
                        onComplete={() => {
                          // 当打字机效果完成时，调用回调函数清除typewriting标记
                          if (onTypewritingComplete) {
                            onTypewritingComplete(index);
                          }
                        }}
                      />
                      {/* 如果消息将使用Mosaic模式，在打字机效果期间显示提示 */}
                      {dataMosaicEnabled && message.dataMosaicEnabledWhenSent && (
                        <Box className="loading-indicator">
                          正在分析内容结构...
                        </Box>
                      )}
                    </>
                  ) : (
                    // 根据是否启用Mosaic模式来选择渲染方式
                    shouldUseMosaicRenderer(message) ? (
                      <MosaicContentRenderer content={processedContent} thoughtProcess={thoughtProcess} />
                    ) : (
                      <MarkdownRenderer content={processedContent} className="markdown-content" />
                    )
                  )
                )}
              </>
            )}

          </Box>
        ) : role === 'user' ? (
          // 用户消息：右侧显示
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'flex-end',
              ml: 4
            }}
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
          >
            <Box sx={{ 
              position: 'relative', 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 0.5,
              maxWidth: '70%'
            }}>
              {/* 显示选中的文件 */}
              {message.selectedFiles && message.selectedFiles.length > 0 && (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 0.5,
                  mb: 0.5,
                  width: '100%'
                }}>
                  {/* 文件列表 */}
                  <Box sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    justifyContent: 'flex-end',
                    maxWidth: '100%'
                  }}>
                    {(fileCollapsedState[index] !== false && message.selectedFiles.length > 3 ? 
                      message.selectedFiles.slice(0, 3) : 
                      message.selectedFiles
                    ).map((file, fileIndex) => (
                      <Chip
                        key={fileIndex}
                        icon={<DescriptionIcon />}
                        label={file.filename}
                        size="small"
                        onClick={() => handleFileClick(file.filepath)}
                        sx={{
                          bgcolor: '#e3f2fd',
                          color: '#1976d2',
                          maxWidth: '180px',
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: '#bbdefb',
                          },
                          '& .MuiChip-label': {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }
                        }}
                      />
                    ))}
                    
                    {/* 折叠/展开按钮 */}
                    {message.selectedFiles.length > 3 && (
                      <Chip
                        icon={fileCollapsedState[index] !== false ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                        label={fileCollapsedState[index] !== false ? 
                          `+${message.selectedFiles.length - 3}` : 
                          '收起'
                        }
                        size="small"
                        onClick={() => toggleFileCollapse(index)}
                        sx={{
                          bgcolor: '#f5f5f5',
                          color: '#666',
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: '#eeeeee',
                          }
                        }}
                      />
                    )}
                  </Box>
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                {editingIndex === index ? (
                  // 编辑模式
                  <Box sx={{ flexGrow: 1, minWidth: '300px' }}>
                    <TextField
                      fullWidth
                      multiline
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      autoFocus
                      variant="outlined"
                      size="small"
                      sx={{ mb: 1 }}
                    />
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <Button size="small" onClick={handleCancelEdit}>
                        取消
                      </Button>
                      <Button 
                        size="small" 
                        variant="contained" 
                        onClick={handleSaveEdit}
                        disabled={!editingContent.trim()}
                      >
                        发送
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  // 正常显示模式
                  <>
                    {/* 编辑按钮 - 显示在消息框左侧 */}
                    {onEditMessage && currentChatId && (
                      <IconButton
                        size="small"
                        onClick={() => handleStartEdit(index, content)}
                        sx={{ 
                          opacity: hoveredMessageIndex === index ? 1 : 0,
                          transition: 'opacity 0.1s ease-in-out', // 减少过渡时间从0.2s到0.1s
                          mr: 0.5, // 减少间距从1到0.5，让图标更靠近聊天框
                          mt: 0.5
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    
                    <Paper 
                      elevation={0}
                      sx={{ 
                        px: 2, // 水平padding保持
                        paddingTop: 2,
                        paddingBottom: 0,
                        borderRadius: 2,
                        bgcolor: '#f5f5f5', // 改为灰色背景
                        color: '#333333', // 改为深灰色文字
                        maxWidth: 'fit-content',
                        minWidth: '80px',
                        wordBreak: 'break-word'
                      }}
                    >
                      <MarkdownRenderer content={content} className="markdown-content" />
                    </Paper>
                  </>
                )}
              </Box>
            </Box>
          </Box>
        ) : (
          // 系统消息：居中显示
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Paper 
              elevation={0}
              className={role === 'system' ? 'system-message-fadeout' : ''}
              sx={{ 
                p: 2, 
                borderRadius: 2,
                bgcolor: uploading ? '#e3f2fd' : '#fef3c7', // 上传状态使用蓝色背景
                color: 'inherit',
                maxWidth: '80%',
                wordBreak: 'break-word'
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                {uploading && uploadProgress ? (
                  // 文件上传状态显示
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={20} color="primary" />
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#1976d2' }}>
                        文件正在上传中，请勿操作和退出该页面，否则文件上传失败
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      进度：{uploadProgress.completed} / {uploadProgress.total} 
                      {uploadProgress.current && ` (当前: ${uploadProgress.current})`}
                    </Typography>
                    <Box sx={{ 
                      width: '200px', 
                      height: '4px', 
                      bgcolor: '#e0e0e0', 
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <Box 
                        sx={{ 
                          height: '100%', 
                          bgcolor: '#1976d2',
                          borderRadius: '2px',
                          transition: 'width 0.3s ease',
                          width: `${(uploadProgress.completed / uploadProgress.total) * 100}%`
                        }}
                      />
                    </Box>
                  </Box>
                ) : uploading ? (
                  // 简单的上传状态显示（无进度信息）
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                    <CircularProgress size={20} color="primary" />
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#1976d2' }}>
                      文件正在上传中，请勿操作和退出该页面，否则文件上传失败
                    </Typography>
                  </Box>
                ) : (
                  <MarkdownRenderer content={content} className="markdown-content" />
                )}
              </Box>
            </Paper>
          </Box>
        )}
      </Box>
    );
  };

  // Function to render empty state with logo
  const renderEmptyState = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '400px',
          // opacity: 0.8,
          userSelect: 'none'
        }}
      >
        <Box
          component="img"
          src="/logo_1.png"
          alt="Logo"
          sx={{
            transform: 'scale(0.6)',
            transformOrigin: 'center', // 根据需要改变缩放中心
          }}
        />
        <Typography
          variant="h6"
          sx={{
            color: '#64748b',
            fontSize: '1.1rem',
            fontWeight: 500,
            textAlign: 'center'
          }}
        >
          开始新的对话
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: '#94a3b8',
            fontSize: '0.9rem',
            textAlign: 'center',
            mt: 0.5
          }}
        >
          输入消息或上传文档来开始
        </Typography>
      </Box>
    );
  };

  return (
    <Box 
      sx={{ 
        width: '100%',
        position: 'relative',
        height: '100%'
      }}
    >
      {/* 拖拽遮罩层 */}
      {/* {dragActive && !disableDrag && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: alpha('#2563eb', 0.1),
            borderRadius: 2,
            border: '2px dashed #2563eb',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            backdropFilter: 'blur(2px)',
            pointerEvents: 'none',
            minHeight: '200px'
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 60, color: '#2563eb', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#2563eb', fontWeight: 600 }}>
            释放文件来上传
          </Typography>
          <Typography variant="body2" sx={{ color: '#2563eb', mt: 1 }}>
            支持 PDF, DOCX, TXT, CSV 等格式
          </Typography>
        </Box>
      )} */}
      
      {/* Render empty state or messages */}
      {messages.length === 0 ? (
        renderEmptyState()
      ) : (
        messages.map((message, index) => renderMessage(message, index))
      )}
    </Box>
  );
};

export default ChatMessages; 