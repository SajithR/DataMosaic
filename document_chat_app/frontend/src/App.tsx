import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import DnsIcon from '@mui/icons-material/Dns'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DescriptionIcon from '@mui/icons-material/Description';
import InsightsIcon from '@mui/icons-material/Insights';
import CloseIcon from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import HistoryIcon from '@mui/icons-material/History';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { alpha } from '@mui/material/styles';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import HomeIcon from '@mui/icons-material/Home';

import ChatInput from './ChatInput';
import ChatMessages, { Message } from './components/ChatMessages';
import FileLibraryWithUpload from './components/FileLibraryWithUpload';
import WorkflowViewer from './components/WorkflowViewer';
import FileContentViewer from './components/FileContentViewer';
import ChatHistoryPanel from './components/ChatHistoryPanel';
import './styles/App.css';


const typewriterStyles = document.createElement('style');
typewriterStyles.textContent = `
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.typewriter-cursor {
  animation: blink 1s infinite;
}
`;
document.head.appendChild(typewriterStyles);

// File interface
interface UploadedFile {
  filename: string;
  filepath: string;
  size: number;
  selected?: boolean;  // New property to track selection
}

// Model options
const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o', category: 'gpt' },
  { value: 'gpt-4o-mini', label: 'GPT-4o-mini', category: 'gpt' },
  { value: 'o1', label: 'o1', category: 'gpt' },
  { value: 'deepseek-v3', label: 'DeepSeek-V3', category: 'deepseek' },
  { value: 'deepseek-r1', label: 'DeepSeek-R1', category: 'deepseek' },
  { value: 'claude-3-5-sonnet', label: 'Claude-3.5-Sonnet', category: 'claude' },
  { value: 'qwen-max', label: 'Qwen-Max', category: 'qianwen' },
  { value: 'qwen-long', label: 'Qwen-Long', category: 'qianwen' },
  { value: 'qwen-turbo', label: 'Qwen-Turbo', category: 'qianwen' },
  { value: 'settings', label: '设置', category: 'settings' },
];

// Create a STORM-inspired modern theme
// App props interface
interface AppProps {
  projectId?: string;
  projectName?: string;
  onGoHome?: () => void;
}

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',      // Modern blue like STORM
      light: '#3b82f6',     
      dark: '#1d4ed8',      
    },
    secondary: {
      main: '#64748b',      // Elegant slate gray
      light: '#94a3b8',     
      dark: '#475569',      
    },
    background: {
      default: '#ffffff',   // Pure white background
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',   // Deep slate for text
      secondary: '#64748b', // Medium slate for secondary text
    },
    divider: '#e2e8f0',
    success: {
      main: '#059669',      
    },
    warning: {
      main: '#d97706',      
    },
    error: {
      main: '#dc2626',      
    },
    info: {
      main: '#0284c7',      
    },
    grey: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    h4: {
      fontWeight: 700,
      fontSize: '1.875rem',
      letterSpacing: '-0.025em',
      color: '#0f172a',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.125rem',
      letterSpacing: '-0.01em',
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: '1rem',
      letterSpacing: '0em',
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: '#475569',
    },
    body2: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
      color: '#64748b',
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0em',
    },
  },
  shape: {
    borderRadius: 8,  // STORM uses moderate rounded corners
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#ffffff',
          scrollbarWidth: 'thin',
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
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          border: 'none',
          backgroundImage: 'none',
          '&.chat-messages-container': {
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto',
          },
          '&.multibox-root': {
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto',
          },
          '&.drag-overlay': {
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              borderRadius: '8px',
              border: '2px dashed #2563eb',
              zIndex: 1000,
              backdropFilter: 'blur(2px)',
              pointerEvents: 'none',
            }
          },
        },
        elevation1: {
          boxShadow: 'none',
          border: 'none',
          backgroundImage: 'none',
        },
        elevation2: {
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: '6px',
          boxShadow: 'none',
          padding: '8px 16px',
          fontSize: '0.875rem',
          '&:hover': {
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
          },
          transition: 'all 0.15s ease',
        },
        contained: {
          background: '#2563eb',
          color: '#ffffff',
          '&:hover': {
            background: '#1d4ed8',
            boxShadow: '0 4px 6px -1px rgb(37 99 235 / 0.1), 0 2px 4px -2px rgb(37 99 235 / 0.1)',
          },
        },
        outlined: {
          borderColor: '#e2e8f0',
          color: '#475569',
          '&:hover': {
            borderColor: '#cbd5e1',
            backgroundColor: '#f8fafc',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            fontSize: '0.875rem',
            '& fieldset': {
              borderColor: '#e2e8f0',
              borderWidth: '1px',
            },
            '&:hover fieldset': {
              borderColor: '#cbd5e1',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#2563eb',
              borderWidth: '2px',
            },
            '&.Mui-disabled': {
              backgroundColor: '#f8fafc',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#64748b',
            fontSize: '0.875rem',
            '&.Mui-focused': {
              color: '#2563eb',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          fontWeight: 500,
          fontSize: '0.75rem',
          height: '24px',
          '& .MuiChip-deleteIcon': {
            fontSize: '16px',
            '&:hover': {
              color: '#dc2626',
            },
          },
        },
        colorPrimary: {
          backgroundColor: '#dbeafe',
          color: '#1d4ed8',
          '&:hover': {
            backgroundColor: '#bfdbfe',
          },
        },
        colorSecondary: {
          backgroundColor: '#f1f5f9',
          color: '#475569',
          '&:hover': {
            backgroundColor: '#e2e8f0',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          padding: '8px',
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: '#f1f5f9',
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: '#2563eb',
            '& + .MuiSwitch-track': {
              backgroundColor: '#2563eb',
            },
          },
        },
      },
    },
  },
});

const App: React.FC<AppProps> = ({ projectId, projectName, onGoHome }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  
  // Overwrite confirmation dialog state
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState<boolean>(false);
  const [fileToOverwrite, setFileToOverwrite] = useState<File | null>(null);
  const [fileOverwritePath, setFileOverwritePath] = useState<string>('');

  // Add state for index reload operation
  const [isReloadingIndex, setIsReloadingIndex] = useState<boolean>(false);

  // Add new state for the abort controller
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // DataMosaic相关状态
  const [dataMosaicEnabled, setDataMosaicEnabled] = useState<boolean>(false);

  // 文档库面板折叠状态
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);

  // 右侧栏相关状态
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState<boolean>(true);
  const [rightPanelType, setRightPanelType] = useState<'reader' | 'workflow'>('reader');
  const [selectedFileForReading, setSelectedFileForReading] = useState<string | null>(null);
  const [currentThoughtProcess, setCurrentThoughtProcess] = useState<string[] | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(500); // 增加默认宽度
  const [isResizing, setIsResizing] = useState<boolean>(false);


  
  // 聊天记录相关状态
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState<number>(0);
  
  // 左侧面板类型切换状态
  const [leftPanelType, setLeftPanelType] = useState<'files' | 'history'>('files');

  // Add new state for unified drag operation
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [dragCounter, setDragCounter] = useState<number>(0);

  // Model selection state - 确保初始值是有效的
  const [currentModel, setCurrentModel] = useState<string>('gpt-4o');

  // 辅助函数：验证并规范化模型值
  const normalizeModelValue = (modelValue: string): string => {
    if (!modelValue) return 'gpt-4o';
    
    // 检查模型值是否在可选项中（排除settings项）
    const isValidModel = MODEL_OPTIONS.some(option => 
      option.value === modelValue && option.value !== 'settings'
    );
    
    return isValidModel ? modelValue : 'gpt-4o';
  };

  // Settings modal state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  // 支持的文件格式
  const SUPPORTED_EXTENSIONS = ['pdf', 'txt', 'md', 'csv', 'xlsx', 'xls', 'docx'];

  // 验证文件格式
  const isValidFile = (file: File): boolean => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return SUPPORTED_EXTENSIONS.includes(extension);
  };

  // 递归处理文件夹内容
  const processDirectoryEntry = async (dirEntry: any): Promise<File[]> => {
    const files: File[] = [];
    
    const readEntries = (dirReader: any): Promise<any[]> => {
      return new Promise((resolve) => {
        dirReader.readEntries((entries: any[]) => {
          resolve(entries);
        });
      });
    };

    const dirReader = dirEntry.createReader();
    const entries = await readEntries(dirReader);
    
    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve) => {
          entry.file((file: File) => resolve(file));
        });
        if (isValidFile(file)) {
          files.push(file);
        }
      } else if (entry.isDirectory) {
        // 递归处理子目录
        const subFiles = await processDirectoryEntry(entry);
        files.push(...subFiles);
      }
    }
    
    return files;
  };

  // Fetch already uploaded files when the app loads
  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  // Fetch current model when app loads
  useEffect(() => {
    fetchCurrentModel();
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-dismiss system messages after 2 seconds
  useEffect(() => {
    // Find system messages in the message list
    const systemMessages = messages.filter(message => message.role === 'system');
    
    if (systemMessages.length === 0) return;
    
    // Create a map to track timeouts for each system message
    const timeoutIds: NodeJS.Timeout[] = [];
    
    // For each system message, set a timeout to remove it after 2 seconds
    systemMessages.forEach(systemMessage => {
      const timeoutId = setTimeout(() => {
        setMessages(prevMessages => 
          prevMessages.filter(message => 
            // Keep all non-system messages and system messages that are not this one
            message.role !== 'system' || message.timestamp !== systemMessage.timestamp
          )
        );
      }, 2000);
      
      timeoutIds.push(timeoutId);
    });
    
    // Cleanup timeouts on unmount or when messages change
    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchUploadedFiles = async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}/files`);
      setUploadedFiles(response.data.files);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleFilesUpload = async (files: File[]) => {
    const newUploadedFiles: UploadedFile[] = [];
    const newMessages: Message[] = [];
    
    // 添加上传开始的状态消息
    const uploadStatusMessage: Message = {
      role: 'system',
      content: '',
      timestamp: new Date().toISOString(),
      uploading: true,
      uploadProgress: {
        total: files.length,
        completed: 0,
        current: undefined
      }
    };
    
    // 立即显示上传状态消息
    setMessages(prev => [...prev, uploadStatusMessage]);
    
    // 更新上传状态消息的函数
    const updateUploadProgress = (completed: number, current?: string) => {
      setMessages(prev => prev.map(msg => 
        msg.uploading && msg.uploadProgress ? {
          ...msg,
          uploadProgress: {
            ...msg.uploadProgress,
            completed,
            current
          }
        } : msg
      ));
    };
    
    // 移除上传状态消息的函数
    const removeUploadMessage = () => {
      setMessages(prev => prev.filter(msg => !msg.uploading));
    };
    
    // 如果文件数量大于等于5个，使用批量上传
    if (files.length >= 5) {
      console.log(`使用批量上传处理 ${files.length} 个文件`);
      
      try {
        updateUploadProgress(0, `准备上传 ${files.length} 个文件...`);
        
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });
        
        updateUploadProgress(0, '文件上传中...');
        
        const response = await axios.post(`/api/projects/${projectId}/upload/batch`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        if (response.data.status === 'success' || response.data.status === 'partial') {
          updateUploadProgress(files.length, '处理上传结果...');
          
          // 处理成功上传的文件
          response.data.uploaded.forEach((fileInfo: any) => {
            newUploadedFiles.push({
              filename: fileInfo.filename,
              filepath: fileInfo.filepath,
              size: fileInfo.size
            });
          });
          
          // 添加批量上传成功消息
          if (response.data.uploaded.length > 0) {
            newMessages.push({
              role: 'system',
              content: `批量上传成功：${response.data.uploaded.length} 个文件已上传并选择用于QA`,
              timestamp: new Date().toISOString()
            });
          }
          
          // 处理失败的文件
          if (response.data.failed && response.data.failed.length > 0) {
            newMessages.push({
              role: 'system',
              content: `部分文件上传失败：${response.data.failed.length} 个文件（可能是格式不支持或其他错误）`,
              timestamp: new Date().toISOString()
            });
            console.warn('批量上传中的失败文件:', response.data.failed);
          }
        }
      } catch (error) {
        console.error('批量上传失败:', error);
        const errorMessage = axios.isAxiosError(error) 
          ? error.response?.data?.error || error.message
          : String(error);
          
        removeUploadMessage(); // 移除上传状态消息
        newMessages.push({
          role: 'system',
          content: `批量上传失败: ${errorMessage}`,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      // 少量文件使用原有的逐个上传逻辑
      console.log(`使用逐个上传处理 ${files.length} 个文件`);
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        updateUploadProgress(i, `上传文件: ${file.name}`);
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const response = await axios.post(`/api/projects/${projectId}/upload`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          
          // Check if the file already exists
          if (response.status === 409 && response.data.status === 'exists') {
            // Save the current file for overwrite confirmation
            setFileToOverwrite(file);
            setFileOverwritePath(response.data.filepath);
            setOverwriteConfirmOpen(true);
            
            // Add message about duplicate file
            newMessages.push({
              role: 'system',
              content: `File "${file.name}" already exists. Please confirm if you want to overwrite it.`,
              timestamp: new Date().toISOString()
            });
            
            // Skip to the next file
            continue;
          }
          
          // Add to the new files array
          newUploadedFiles.push({
            filename: response.data.filename,
            filepath: response.data.filepath,
            size: file.size
          });
          
          // 更新进度
          updateUploadProgress(i + 1, i === files.length - 1 ? '上传完成' : undefined);
          
          // Add to new messages array
          newMessages.push({
            role: 'system',
            content: `File "${file.name}" uploaded successfully and selected for QA.`,
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          // Check if this is the special 409 Conflict status
          if (axios.isAxiosError(error) && error.response?.status === 409) {
            // Save the current file for overwrite confirmation
            setFileToOverwrite(file);
            setFileOverwritePath(error.response.data.filepath);
            setOverwriteConfirmOpen(true);
            
            // Add message about duplicate file
            newMessages.push({
              role: 'system',
              content: `File "${file.name}" already exists. Please confirm if you want to overwrite it.`,
              timestamp: new Date().toISOString()
            });
          } else {
            console.error('Error uploading file:', error);
            const errorMessage = axios.isAxiosError(error) 
              ? error.response?.data?.error || error.message
              : String(error);
              
            newMessages.push({
              role: 'system',
              content: `Error uploading file: ${errorMessage}`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }
    
    // Update state once with all new files
    if (newUploadedFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
      
      // 默认选择新上传的文件
      setSelectedFiles(prev => [...prev, ...newUploadedFiles]);
      console.log('自动选择了新上传的文件:', newUploadedFiles.map(f => f.filename));
      
      // Reload documents for LLM-based retrieval
      setIsReloadingIndex(true);
      try {
        // TODO: Implement project-specific document loading
        await axios.post('/api/reload-index');
        // We don't need an additional message since we already showed upload success messages
      } catch (error) {
        console.error('Error reloading documents after file upload:', error);
        // Show warning message
        newMessages.push({
          role: 'system',
          content: 'Warning: Documents may need reloading after file upload.',
          timestamp: new Date().toISOString()
        });
      } finally {
        setIsReloadingIndex(false);
      }
    }
    
    // 移除上传状态消息
    removeUploadMessage();
    
    // Update messages once with all new messages
    if (newMessages.length > 0) {
      setMessages(prev => [...prev, ...newMessages]);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    // Set the file to delete and open confirmation dialog
    setFileToDelete(fileId);
    setDeleteConfirmOpen(true);
  };
  
  const confirmFileDelete = async () => {
    // Close the dialog
    setDeleteConfirmOpen(false);
    
    if (!fileToDelete) return;
    
    try {
      const fileToDeleteObj = uploadedFiles.find(file => file.filepath === fileToDelete);
      
      if (!fileToDeleteObj) {
        console.error('File not found:', fileToDelete);
        return;
      }
      
      await axios.post(`/api/projects/${projectId}/files/delete`, {
        filepath: fileToDeleteObj.filepath
      });
      
      // Remove the file from the list
      setUploadedFiles(uploadedFiles.filter(file => file.filepath !== fileToDelete));
      setSelectedFiles(selectedFiles.filter(file => file.filepath !== fileToDelete));
      
      // Add a system message about the deletion
      setMessages([...messages, {
        role: 'system',
        content: `File "${fileToDeleteObj.filename}" deleted successfully.`,
        timestamp: new Date().toISOString()
      }]);
      
      // Reset the file to delete
      setFileToDelete(null);
      
      // Reload documents to keep them in sync
      setIsReloadingIndex(true);
      try {
        // TODO: Implement project-specific document loading
        await axios.post('/api/reload-index');
        // We don't need to show this message since we already showed file deletion success
      } catch (error) {
        console.error('Error reloading documents after file deletion:', error);
        // Show warning message
        setMessages(prevMessages => [
          ...prevMessages,
          {
            role: 'system',
            content: 'Warning: Documents may need reloading after file deletion.',
            timestamp: new Date().toISOString()
          }
        ]);
      } finally {
        setIsReloadingIndex(false);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      const errorMessage = axios.isAxiosError(error) 
        ? error.response?.data?.error || error.message
        : String(error);
        
      setMessages([...messages, {
        role: 'system',
        content: `Error deleting file: ${errorMessage}`,
        timestamp: new Date().toISOString()
      }]);
    }
  };
  
  const cancelFileDelete = () => {
    // Close the dialog and reset the file to delete
    setDeleteConfirmOpen(false);
    setFileToDelete(null);
  };

  // 全选/取消全选功能
  const handleSelectAll = () => {
    if (selectedFiles.length === uploadedFiles.length) {
      // 如果已经全选，则取消全选
      setSelectedFiles([]);
    } else {
      // 否则选择所有文件
      setSelectedFiles([...uploadedFiles]);
    }
  };

  const toggleFileSelection = (filepath: string) => {
    const fileIndex = uploadedFiles.findIndex(file => file.filepath === filepath);
    
    if (fileIndex === -1) return;
    
    const file = uploadedFiles[fileIndex];
    const isCurrentlySelected = selectedFiles.some(f => f.filepath === filepath);
    
    if (isCurrentlySelected) {
      // Remove from selected files
      setSelectedFiles(selectedFiles.filter(f => f.filepath !== filepath));
      console.log(`取消选择文件: ${file.filename}`);
    } else {
      // Add to selected files
      setSelectedFiles([...selectedFiles, file]);
      console.log(`选择文件: ${file.filename}`);
    }
  };

  // New handler for pausing generation
  const handlePauseGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsProcessing(false);
      
      // 更新最后一条消息的thinking状态为false
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.thinking) {
          lastMessage.thinking = false;
          
          // 确保保留思考过程
          if (!lastMessage.thoughtProcess) {
            lastMessage.thoughtProcess = [];
          }
        }
        return newMessages;
      });
      
      // Add a system message indicating the generation was paused
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: 'Generation paused by user.',
          timestamp: new Date().toISOString()
        }
      ]);
    }
  };

  // 处理文件移除（从选择列表中移除，不是删除文件）
  const handleFileRemove = (filename: string) => {
    // 从selectedFiles中移除指定的文件
    setSelectedFiles(prevSelected => 
      prevSelected.filter(file => file.filename !== filename)
    );
    console.log(`文件 "${filename}" 已从选择列表中移除`);
  };

  // 处理DataMosaic切换
  const handleDataMosaicToggle = (enabled: boolean) => {
    setDataMosaicEnabled(enabled);
    // 移除强制切换到文档阅读器的逻辑，保持工作流程按钮始终可用
    console.log('DataMosaic功能:', enabled ? '启用' : '禁用');
  };

  // 处理文档库面板折叠/展开
  const handlePanelToggle = () => {
    setIsPanelCollapsed(!isPanelCollapsed);
  };

  // 处理文件阅读器面板折叠/展开
  const handleRightPanelToggle = () => {
    setIsRightPanelCollapsed(!isRightPanelCollapsed);
  };

  // 处理文件阅读点击
  const handleFileRead = (filepath: string) => {
    setSelectedFileForReading(filepath);
    setRightPanelType('reader');
    setIsRightPanelCollapsed(false);  // 自动展开阅读器
  };



  // 关闭工作流查看器
  const handleCloseWorkflow = () => {
    // 不清空currentThoughtProcess，只是收起面板
    setIsRightPanelCollapsed(true);
  };

  // 处理思考进度点击
  const handleThinkingProgressClick = (messageIndex?: number) => {
    // 如果提供了消息索引，使用该消息的思考过程
    if (messageIndex !== undefined) {
      const message = messages[messageIndex];
      if (message && message.role === 'assistant' && message.thoughtProcess) {
        setCurrentThoughtProcess(message.thoughtProcess);
      }
    }
    setRightPanelType('workflow');
    setIsRightPanelCollapsed(false);
  };

  // 处理右侧栏宽度调整
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = window.innerWidth - e.clientX;
    // 限制最小和最大宽度
    const minWidth = 500;
    const maxWidth = 1200;
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setRightPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);



  // 处理左侧面板类型切换
  const handleLeftPanelTypeChange = (newType: 'files' | 'history') => {
    setLeftPanelType(newType);
    // 如果面板是折叠的，切换时自动展开
    if (isPanelCollapsed) {
      setIsPanelCollapsed(false);
    }
  };

  // 处理新建聊天
  const handleNewChat = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/chat/new`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('创建新聊天失败');
      }
      
      const data = await response.json();
      setCurrentChatId(data.id);
      setMessages([]);
      // 注释掉这行，让文件选择在新聊天中保持
      // setSelectedFiles([]);
      
      // 触发历史记录刷新
      setHistoryRefreshTrigger(prev => prev + 1);
      
      console.log('创建新聊天:', data.id);
    } catch (err) {
      console.error('创建新聊天出错:', err);
      alert('创建新聊天失败，请稍后重试');
    }
  };

  // 处理选择历史聊天
  const handleSelectChat = async (chatId: string) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/chat/history/${chatId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('获取聊天历史失败');
      }
      
      const chatHistory = await response.json();
      
      // 转换聊天历史格式以适应当前应用
      const convertedMessages: Message[] = [];
      
      for (const message of chatHistory) {
        // 跳过系统元数据消息（如标题信息）
        if (message.role === 'system' && message.content === 'Chat title metadata') {
          continue;
        }
        
        if (message.role === 'user') {
          convertedMessages.push({
            role: 'user',
            content: message.content,
            timestamp: message.timestamp,
            dataMosaicEnabledWhenSent: message.additional_data?.data_mosaic_enabled || false,
            selectedFiles: message.additional_data?.selected_files || undefined
          });
        } else if (message.role === 'assistant') {
          // 恢复原始的思考过程数据，不管当前DataMosaic状态
          const messageThoughtProcess = message.additional_data?.thought_process || [];
          const messageDataMosaicEnabled = message.additional_data?.data_mosaic_enabled || false;
          
          convertedMessages.push({
            role: 'assistant',
            content: message.content,
            timestamp: message.timestamp,
            thinking: false,
            // 恢复历史消息的完整思考过程
            thoughtProcess: messageThoughtProcess,
            dataMosaicEnabledWhenSent: messageDataMosaicEnabled
          });
        }
      }
      
      // 更新消息列表和当前聊天ID
      setMessages(convertedMessages);
      setCurrentChatId(chatId);
      
      // 检查最新的助手消息是否有思考过程，如果有则设置为当前工作流程（仅在DataMosaic模式下）
      const lastAssistantMessage = convertedMessages
        .filter(msg => msg.role === 'assistant')
        .pop();
      
      if (lastAssistantMessage?.thoughtProcess && lastAssistantMessage.thoughtProcess.length > 0) {
        setCurrentThoughtProcess(lastAssistantMessage.thoughtProcess);
        console.log('恢复工作流程数据，步骤数:', lastAssistantMessage.thoughtProcess.length);
      } else {
        // 如果没有思考过程，重置为null以显示默认内容
        setCurrentThoughtProcess(null);
      }
      // 注释掉清空currentThoughtProcess的逻辑，保持workflow按钮始终显示
      // else {
      //   setCurrentThoughtProcess(null);
      // }
      
      // 清空文件选择（可选，根据需求决定是否保留）
      // setSelectedFiles([]);
      
      console.log('选择聊天:', chatId, '消息数量:', convertedMessages.length);
    } catch (err) {
      console.error('选择聊天出错:', err);
      alert('加载聊天历史失败，请稍后重试');
    }
  };

  // 组件挂载时创建新聊天
  useEffect(() => {
    handleNewChat();
  }, []);

  const handleQuerySubmit = async (query: string) => {
    if (isProcessing) return;
    
    // 追加新的用户消息，而不是重置整个消息列表
    const newUserMessage: Message = {
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
      dataMosaicEnabledWhenSent: dataMosaicEnabled,  // Store the DataMosaic state when the message was sent
      selectedFiles: selectedFiles.length > 0 ? selectedFiles.map(file => ({ 
        filename: file.filename, 
        filepath: file.filepath 
      })) : undefined  // Include selected files with the message
    };
    
    // 追加用户消息到现有消息列表
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    setIsProcessing(true);

    // 使用 EventSource 处理 SSE 流
    let thoughtProcess: string[] = [];
    let temporaryThoughts: string[] = []; // Track temporary thoughts separately
    let lastNonTemporaryTime = Date.now(); // Track when the last non-temporary thought was received
    let finalAnswer = '';
    
    try {
      // Add a "thinking" message 
      setMessages(prevMessages => [
        ...prevMessages, 
        {
          role: 'assistant',
          content: '',
          thinking: dataMosaicEnabled,  // Only show thinking state in DataMosaic mode
          thoughtProcess: [],
          timestamp: new Date().toISOString(),
          dataMosaicEnabledWhenSent: dataMosaicEnabled,  // Store the DataMosaic state when the message was sent
          isLoading: !dataMosaicEnabled,  // Show simple loading in simple mode
          liveThinking: dataMosaicEnabled,  // 启用实时思考显示
          showThinkingAsContent: dataMosaicEnabled  // 将思考过程作为答案内容显示
        } as Message
      ]);

      // Get file paths from selected files
      const filePaths = selectedFiles.length > 0 
        ? selectedFiles.map(file => file.filepath)
        : [];

      console.log('开始处理查询:', { query, filePaths, selectedFilesCount: selectedFiles.length });

      // 重要修改：只有当用户没有选择任何文件时，才进行无文件查询
      // 不再默认使用所有文件
      // 使用 POST 方法创建一个请求对象
      const postData = {
        query,
        file_paths: filePaths,
        selected_files: selectedFiles.length > 0 ? selectedFiles.map(file => ({
          filename: file.filename,
          filepath: file.filepath
        })) : [],  // 添加选中文件的详细信息
        use_all_files: false,  // 修改：不再默认使用所有文件
        stream: true,
        data_mosaic_enabled: dataMosaicEnabled,  // 添加DataMosaic状态
        chat_id: currentChatId,  // 添加当前聊天ID
        is_edit: false,  // 标识这是编辑操作
        model: currentModel  // 添加当前选择的模型
      };
      
      // Create a new AbortController for this request
      const controller = new AbortController();
      setAbortController(controller);
      
      // 创建 EventSource
      // 注意：标准 EventSource 不支持 POST 请求，我们需要使用 fetch API 创建 SSE 连接
      const response = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
        signal: controller.signal // Add the signal to allow aborting
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // 使用 ReadableStream 处理响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      console.log('开始接收 SSE 流...');
      
      while (true) {
        try {
          const { value, done } = await reader.read();
          
          if (done) {
            console.log('SSE 流读取完成');
            break;
          }
          
          // 解码数据块并添加到缓冲区
          const chunk = decoder.decode(value, { stream: true });
          console.log('接收到 SSE 数据块:', chunk);
          
          buffer += chunk;
          
          // 处理 SSE 消息
          // SSE 格式: event: TYPE\ndata: JSON\n\n
          const messages = buffer.split('\n\n');
          
          // 保留可能不完整的最后一条消息
          buffer = messages.pop() || '';
          
          // 使用延时处理多个消息
          for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            if (!message.trim()) continue;
            
            // 根据DataMosaic模式设置不同的延时，简单模式几乎无延时
            if (dataMosaicEnabled) {
              await new Promise(resolve => setTimeout(resolve, 600));
            }
            // 简单模式不使用延时，立即处理
            
            try {
              // 解析 SSE 消息
              const eventMatch = message.match(/^event: (.+)$/m);
              const dataMatch = message.match(/^data: (.+)$/m);
              
              if (eventMatch && dataMatch) {
                const eventType = eventMatch[1];
                const data = JSON.parse(dataMatch[1]);
                
                console.log(`SSE 事件: ${eventType}`, data);
                
                // Special handling for "Loading and processing documents..." message (only in DataMosaic mode)
                if (eventType === 'thinking' && 
                    data.content === "Loading and processing documents...\n") {
                  // 在简单模式下跳过文档加载处理消息
                  if (!dataMosaicEnabled) {
                    continue;
                  }
                  
                  console.log('文档加载处理消息，添加为临时思考');
                  
                  // Create a temporary thought with the special [TEMP:] marker
                  const tempLoadingThought = "[TEMP:] " + data.content;
                  temporaryThoughts = [tempLoadingThought];
                  
                  // Update message display to show the loading thought
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const assistantMsg = newMessages[newMessages.length - 1];
                    if (assistantMsg.role === 'assistant' && assistantMsg.thinking) {
                      assistantMsg.thoughtProcess = [...thoughtProcess, ...temporaryThoughts];
                    }
                    return newMessages;
                  });
                  
                  continue; // Skip the rest of the processing for this message
                }
                
                if (eventType === 'thinking') {
                  // 简单模式下完全忽略思考步骤，用户不需要深度分析功能
                  if (!dataMosaicEnabled) {
                    // 简单模式：完全跳过所有思考处理逻辑，不更新任何状态
                    continue; // 跳过思考处理，不显示工作流程，不更新消息
                  }
                  
                  // 以下是DataMosaic模式的复杂处理逻辑
                  // 第一步：检查是否包含[TEMP:]标记，只有包含这个标记的才视为临时思考
                  const hasSpecialTempMarker = data.content.includes('[TEMP:]');
                  console.log('SSE思考事件:', { 
                    content: data.content.substring(0, 50), 
                    包含TEMP标记: hasSpecialTempMarker,
                    后端临时标记: data.temporary 
                  });
                  
                  // If we had a "Loading and processing documents..." message,
                  // replace it with a "Documents load and process finished" message
                  if (temporaryThoughts.some(t => t.includes("Loading and processing documents"))) {
                    console.log('文档加载完成，添加完成提示');
                    thoughtProcess.push("[TEMP:] Documents load and process finished.");
                    temporaryThoughts = temporaryThoughts.filter(
                      t => !t.includes("Loading and processing documents")
                    );
                  }
                  
                  // 第二步：根据是否包含[TEMP:]标记处理思考
                  if (hasSpecialTempMarker) {
                    console.log('处理临时思考');
                    // 替换现有的临时思考
                    temporaryThoughts = [data.content];
                    lastNonTemporaryTime = Date.now(); // Reset timer for temporary thoughts
                  } else {
                    console.log('处理常规思考');
                    // 这是常规思考，添加到思考过程中
                    thoughtProcess.push(data.content);
                    
                    // 清除临时思考（因为现在有了新的常规思考）
                    temporaryThoughts = [];
                    lastNonTemporaryTime = Date.now();
                  }
                  
                  // 第三步：在界面中更新思考过程显示
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const assistantMsg = newMessages[newMessages.length - 1];
                    if (assistantMsg.role === 'assistant' && assistantMsg.thinking) {
                      // 合并常规思考和临时思考
                      assistantMsg.thoughtProcess = [...thoughtProcess, ...temporaryThoughts];
                      
                      // 在Mosaic模式下，如果是liveThinking模式，实时构建完整答案
                      if (assistantMsg.liveThinking && assistantMsg.showThinkingAsContent) {
                        let completeAnswer = '';
                        
                        // 添加思考过程的文本内容
                        [...thoughtProcess, ...temporaryThoughts].forEach(thought => {
                                                  // 清理标记，只保留纯文本
                        const cleanedThought = thought
                          .replace('[TEMP:]', '')
                          .replace('[THINKING]', '')
                          .replace('[SEARCH]', '')
                          .replace('[EXTRACT]', '')
                          .replace('[VERIFY]', '')
                          .replace('[REASON]', '')
                          .replace('[DECISION]', '')
                          .replace('[REFINE]', '')
                          .trim();
                          
                          if (cleanedThought) {
                            completeAnswer += cleanedThought + '\n\n';
                          }
                        });
                        
                        // 在Mosaic模式下，思考过程就是答案，实时更新content
                        assistantMsg.content = completeAnswer;
                        console.log('Mosaic模式：实时更新content，当前长度：', completeAnswer.length);
                        console.log('Mosaic模式：当前content内容预览：', completeAnswer.substring(0, 100) + '...');
                      }
                    }
                    return newMessages;
                  });
                  
                  // 自动显示工作流程（当有思考过程时）
                  if ((thoughtProcess.length > 0 || temporaryThoughts.length > 0) && dataMosaicEnabled) {
                    const currentThoughts = [...thoughtProcess, ...temporaryThoughts];
                    setCurrentThoughtProcess(currentThoughts);
                    setRightPanelType('workflow');
                    setIsRightPanelCollapsed(false);
                  }
                } else if (eventType === 'answer') {
                  finalAnswer = data.content;
                  console.log('收到最终答案:', finalAnswer.substring(0, 50));
                  
                  // 根据是否启用实时思考显示来处理答案
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.role === 'assistant') {
                      if (lastMessage.liveThinking && lastMessage.showThinkingAsContent && dataMosaicEnabled) {
                        // Mosaic模式下，如果已经有content（思考过程），只需要添加最终答案部分
                        if (lastMessage.content && finalAnswer) {
                          // 如果有额外的finalAnswer，添加分隔符和最终答案
                          lastMessage.content += '---\n\n' + finalAnswer;
                        } else if (finalAnswer) {
                          // 如果没有思考过程内容，直接设置最终答案
                          lastMessage.content = finalAnswer;
                        }
                        lastMessage.thinking = false;
                        lastMessage.thoughtProcess = thoughtProcess; // 保留原始思考过程
                        console.log('Mosaic模式：answer事件处理完成，最终content长度：', lastMessage.content?.length || 0);
                      } else {
                        // 传统模式：启动打字机效果
                        lastMessage.fullContent = finalAnswer; // 设置完整内容用于打字机效果
                        lastMessage.typewriting = true; // 启动打字机效果
                        lastMessage.thinking = false;
                        lastMessage.thoughtProcess = thoughtProcess; // 保留思考过程
                        
                        // 如果不使用打字机效果，直接设置content
                        if (!lastMessage.typewriting) {
                          lastMessage.content = finalAnswer;
                        }
                      }
                      lastMessage.isLoading = false; // 清除加载状态
                    }
                    return newMessages;
                  });
                  
                  // 确保最终的思考过程显示在工作流程中（仅在DataMosaic模式下）
                  if (thoughtProcess.length > 0 && dataMosaicEnabled) {
                    setCurrentThoughtProcess([...thoughtProcess]);
                  }
                }
              }
            } catch (parseError) {
              console.error('解析 SSE 消息失败:', parseError, '原始消息:', message);
            }
          }
        } catch (streamError: any) {
          if (streamError.name === 'AbortError') {
            console.log('请求被中止');
            break;
          } else {
            console.error('读取流时出错:', streamError);
            throw streamError;
          }
        }
      }
      
      // 在Mosaic模式下，如果有思考过程但没有收到answer事件，说明思考过程就是最终答案
      if (!finalAnswer && dataMosaicEnabled && thoughtProcess.length > 0) {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'assistant' && lastMessage.thinking && lastMessage.liveThinking) {
            // 在Mosaic模式下，思考过程就是最终答案，结束思考状态
            lastMessage.thinking = false;
            lastMessage.isLoading = false;
            
            // 确保思考过程内容被保存到content字段（如果还没有的话）
            if (!lastMessage.content || lastMessage.content.trim().length === 0) {
              let completeAnswer = '';
              thoughtProcess.forEach(thought => {
                const cleanedThought = thought
                  .replace('[TEMP:]', '')
                  .replace('[THINKING]', '')
                  .replace('[SEARCH]', '')
                  .replace('[EXTRACT]', '')
                  .replace('[VERIFY]', '')
                  .replace('[REASON]', '')
                  .replace('[DECISION]', '')
                  .replace('[REFINE]', '')
                  .trim();
                
                if (cleanedThought) {
                  completeAnswer += cleanedThought + '\n\n';
                }
              });
              lastMessage.content = completeAnswer;
              console.log('Mosaic模式：流程结束，强制保存content长度：', completeAnswer.length);
              console.log('Mosaic模式：流程结束，content内容预览：', completeAnswer.substring(0, 200) + '...');
            } else {
              console.log('Mosaic模式：流程结束，已有content长度：', lastMessage.content.length);
            }
            console.log('Mosaic模式：思考完成，最终content长度：', lastMessage.content?.length || 0);
          }
          return newMessages;
        });
      } else if (!finalAnswer) {
        // 非Mosaic模式或没有思考过程时的处理
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'assistant' && (lastMessage.thinking || lastMessage.isLoading)) {
            lastMessage.thinking = false;
            lastMessage.isLoading = false;
            
            // 确保content字段有内容
            if (!lastMessage.content) {
              lastMessage.content = lastMessage.fullContent || '处理完成，但未收到最终答案。';
            }
          }
          return newMessages;
        });
      }
      
    } catch (error: any) {
      console.error('查询处理出错:', error);
      
      // 如果不是中止错误，显示错误消息
      if (!error.name || error.name !== 'AbortError') {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'assistant') {
            // 在Mosaic模式下，如果已经有思考过程内容，保留它们并添加错误信息
            if (lastMessage.liveThinking && lastMessage.showThinkingAsContent && lastMessage.content) {
              lastMessage.content += '\n\n---\n\n' + `处理查询时出现错误: ${error.message || error}`;
            } else {
              lastMessage.content = `处理查询时出现错误: ${error.message || error}`;
            }
            lastMessage.thinking = false;
            lastMessage.isLoading = false;
          }
          return newMessages;
        });
      }
    } finally {
      setIsProcessing(false);
      setAbortController(null);
      
      // 答案生成完成后刷新聊天记录列表
      setHistoryRefreshTrigger(prev => prev + 1);
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
    // 同时清空文件选择状态，确保下次对话时状态是干净的
    setSelectedFiles([]);
  };

  // Function to handle file overwrite confirmation
  const confirmFileOverwrite = async () => {
    // Close the dialog
    setOverwriteConfirmOpen(false);
    
    if (!fileToOverwrite || !fileOverwritePath) {
      return;
    }
    
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(fileToOverwrite);
      
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1]; // Remove data URL prefix
        
        // Call the API to overwrite the file
        const response = await axios.post('/api/upload/confirm-overwrite', {
          filepath: fileOverwritePath,
          file_data: base64Data
        });
        
        // Add the overwritten file to the list
        setUploadedFiles(prev => [...prev, {
          filename: response.data.filename,
          filepath: response.data.filepath,
          size: fileToOverwrite.size
        }]);
        
        // Add a system message about the overwrite
        setMessages(prev => [...prev, {
          role: 'system',
          content: `File "${fileToOverwrite.name}" has been overwritten.`,
          timestamp: new Date().toISOString()
        }]);
        
        // Reset the file to overwrite
        setFileToOverwrite(null);
        setFileOverwritePath('');
        
        // Reload documents to update with the overwritten file
        setIsReloadingIndex(true);
        try {
          await axios.post('/api/reload-index');
          // We don't need an additional message since we already showed the overwrite success message
        } catch (error) {
          console.error('Error reloading documents after file overwrite:', error);
          // Show warning message
          setMessages(prev => [...prev, {
            role: 'system',
            content: 'Warning: Documents may need reloading after file overwrite.',
            timestamp: new Date().toISOString()
          }]);
        } finally {
          setIsReloadingIndex(false);
        }
      };
    } catch (error) {
      console.error('Error overwriting file:', error);
      const errorMessage = axios.isAxiosError(error) 
        ? error.response?.data?.error || error.message
        : String(error);
        
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error overwriting file: ${errorMessage}`,
        timestamp: new Date().toISOString()
      }]);
    }
  };
  
  const cancelFileOverwrite = () => {
    // Close the dialog and reset the file to overwrite
    setOverwriteConfirmOpen(false);
    setFileToOverwrite(null);
    setFileOverwritePath('');
    
    setMessages(prev => [...prev, {
      role: 'system',
      content: `File upload cancelled.`,
      timestamp: new Date().toISOString()
    }]);
  };

  // Function to reload documents for LLM-based retrieval
  const handleReloadIndex = async () => {
    setIsReloadingIndex(true);
    try {
      const response = await axios.post('/api/reload-index');
      // Show success message
      setMessages(prevMessages => [
        ...prevMessages,
        {
          role: 'system',
          content: response.data.message || 'Documents reloaded successfully for LLM-based retrieval.',
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Error reloading documents:', error);
      // Show error message
      setMessages(prevMessages => [
        ...prevMessages,
        {
          role: 'system',
          content: 'Error reloading documents. Please try again.',
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsReloadingIndex(false);
    }
  };

  // 处理编辑消息
  const handleEditMessage = async (messageIndex: number, newContent: string) => {
    if (!currentChatId) {
      console.error('No current chat ID for editing message');
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/chat/edit/${currentChatId}/${messageIndex}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: newContent
        })
      });

      if (!response.ok) {
        throw new Error('Failed to edit message');
      }

      const result = await response.json();
      
      if (result.success) {
        // 更新本地消息列表：截断到编辑的消息位置，然后添加编辑后的消息
        setMessages(prevMessages => {
          const newMessages = [...prevMessages];
          // 截断到编辑消息之前
          const truncatedMessages = newMessages.slice(0, messageIndex);
          // 添加编辑后的用户消息
          truncatedMessages.push({
            role: 'user',
            content: newContent,
            timestamp: new Date().toISOString(),
            dataMosaicEnabledWhenSent: dataMosaicEnabled,
            selectedFiles: selectedFiles.length > 0 ? selectedFiles.map(file => ({ 
              filename: file.filename, 
              filepath: file.filepath 
            })) : undefined  // Include selected files with the edited message
          } as Message);
          return truncatedMessages;
        });

        // 直接处理查询，不通过handleQuerySubmit（避免重复添加用户消息）
        setIsProcessing(true);

        // 使用 EventSource 处理 SSE 流
        let thoughtProcess: string[] = [];
        let temporaryThoughts: string[] = []; // Track temporary thoughts separately
        let lastNonTemporaryTime = Date.now(); // Track when the last non-temporary thought was received
        let finalAnswer = '';
        
        try {
          // Add a "thinking" message
          setMessages(prevMessages => [
            ...prevMessages, 
            {
              role: 'assistant',
              content: '',
              thinking: true,
              thoughtProcess: [],
              timestamp: new Date().toISOString(),
              dataMosaicEnabledWhenSent: dataMosaicEnabled  // Store the DataMosaic state when the message was sent
            } as Message
          ]);

          // Get file paths from selected files
          const filePaths = selectedFiles.length > 0 
            ? selectedFiles.map(file => file.filepath)
            : [];

          console.log('开始处理编辑查询:', { query: newContent, filePaths, selectedFilesCount: selectedFiles.length });

          // 创建查询参数
          const postData = {
            query: newContent,
            file_paths: filePaths,
            selected_files: selectedFiles.length > 0 ? selectedFiles.map(file => ({
              filename: file.filename,
              filepath: file.filepath
            })) : [],  // 添加选中文件的详细信息
            use_all_files: false,
            stream: true,
            data_mosaic_enabled: dataMosaicEnabled,
            chat_id: currentChatId,
            is_edit: true,  // 标识这是编辑操作
            model: currentModel  // 添加当前选择的模型
          };
          
          // Create a new AbortController for this request
          const controller = new AbortController();
          setAbortController(controller);
          
          // 创建 EventSource
          const response = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData),
            signal: controller.signal
          });
          
          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }
          
          if (!response.body) {
            throw new Error('Response body is null');
          }
          
          // 使用 ReadableStream 处理响应
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          
          console.log('开始接收编辑查询的 SSE 流...');
          
          while (true) {
            try {
              const { value, done } = await reader.read();
              
              if (done) {
                console.log('编辑查询 SSE 流读取完成');
                break;
              }
              
              // 解码数据块并添加到缓冲区
              const chunk = decoder.decode(value, { stream: true });
              console.log('接收到编辑查询 SSE 数据块:', chunk);
              
              buffer += chunk;
              
              // 处理 SSE 消息
              const messages = buffer.split('\n\n');
              
              // 保留可能不完整的最后一条消息
              buffer = messages.pop() || '';
              
              // 使用延时处理多个消息
              for (let i = 0; i < messages.length; i++) {
                const message = messages[i];
                if (!message.trim()) continue;
                
                // 根据DataMosaic模式设置不同的延时
                if (dataMosaicEnabled) {
                  await new Promise(resolve => setTimeout(resolve, 600));
                }
                
                try {
                  // 解析 SSE 消息
                  const eventMatch = message.match(/^event: (.+)$/m);
                  const dataMatch = message.match(/^data: (.+)$/m);
                  
                  if (eventMatch && dataMatch) {
                    const eventType = eventMatch[1];
                    const data = JSON.parse(dataMatch[1]);
                    
                    console.log(`编辑查询 SSE 事件: ${eventType}`, data);
                    
                    if (eventType === 'thinking') {
                      // 简单模式下直接显示思考步骤
                      if (!dataMosaicEnabled) {
                        thoughtProcess.push(data.content);
                        
                        setMessages(prev => {
                          const newMessages = [...prev];
                          const assistantMsg = newMessages[newMessages.length - 1];
                          if (assistantMsg.role === 'assistant' && assistantMsg.thinking) {
                            assistantMsg.thoughtProcess = [...thoughtProcess];
                          }
                          return newMessages;
                        });
                        
                        continue;
                      }
                      
                      // DataMosaic模式的复杂处理逻辑
                      const hasSpecialTempMarker = data.content.includes('[TEMP:]');
                      
                      if (hasSpecialTempMarker) {
                        temporaryThoughts = [data.content];
                        lastNonTemporaryTime = Date.now();
                      } else {
                        thoughtProcess.push(data.content);
                        temporaryThoughts = [];
                        lastNonTemporaryTime = Date.now();
                      }
                      
                      setMessages(prev => {
                        const newMessages = [...prev];
                        const assistantMsg = newMessages[newMessages.length - 1];
                        if (assistantMsg.role === 'assistant' && assistantMsg.thinking) {
                          assistantMsg.thoughtProcess = [...thoughtProcess, ...temporaryThoughts];
                        }
                        return newMessages;
                      });
                    } else if (eventType === 'answer') {
                      finalAnswer = data.content;
                      console.log('收到编辑查询最终答案:', finalAnswer.substring(0, 50));
                      
                      // 编辑消息的回复也使用打字机效果
                      setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        if (lastMessage.role === 'assistant') {
                          lastMessage.content = ''; // 清空当前内容
                          lastMessage.fullContent = finalAnswer; // 设置完整内容用于打字机效果
                          lastMessage.typewriting = true; // 启动打字机效果
                          lastMessage.thinking = false;
                          lastMessage.thoughtProcess = thoughtProcess;
                        }
                        return newMessages;
                      });
                    }
                  }
                } catch (parseError) {
                  console.error('解析编辑查询 SSE 消息失败:', parseError, '原始消息:', message);
                }
              }
            } catch (streamError: any) {
              if (streamError.name === 'AbortError') {
                console.log('编辑查询请求被中止');
                break;
              } else {
                console.error('读取编辑查询流时出错:', streamError);
                throw streamError;
              }
            }
          }
          
          // 当思考过程完成但还没有最终答案时，移除思考状态
          if (!finalAnswer) {
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage.role === 'assistant' && lastMessage.thinking) {
                lastMessage.thinking = false;
                lastMessage.content = lastMessage.content || '处理完成，但未收到最终答案。';
              }
              return newMessages;
            });
          }
          
        } catch (error: any) {
          console.error('编辑查询处理出错:', error);
          
          if (!error.name || error.name !== 'AbortError') {
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage.role === 'assistant') {
                lastMessage.content = `处理编辑查询时出现错误: ${error.message || error}`;
                lastMessage.thinking = false;
              }
              return newMessages;
            });
          }
        } finally {
          setIsProcessing(false);
          setAbortController(null);
        }
        
        console.log('Message edited successfully');
      } else {
        throw new Error(result.message || 'Failed to edit message');
      }
    } catch (error) {
      console.error('Error editing message:', error);
      alert('编辑消息失败，请稍后重试');
    }
  };

  // 处理拖拽文件上传的统一函数
  const handleFiles = (fileList: FileList) => {
    const fileArray = Array.from(fileList);
    // 过滤出支持的文件格式
    const validFiles = fileArray.filter(isValidFile);
    if (validFiles.length > 0) {
      handleFilesUpload(validFiles);
    }
    if (validFiles.length !== fileArray.length) {
      console.warn(`跳过了 ${fileArray.length - validFiles.length} 个不支持的文件`);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Drop event triggered');
    
    setDragActive(false);
    setDragCounter(0);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const allFiles: File[] = [];
      
      // 处理拖拽的项目
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        const entry = item.webkitGetAsEntry?.();
        
        if (entry) {
          if (entry.isFile) {
            // 处理单个文件
            const file = item.getAsFile();
            if (file && isValidFile(file)) {
              allFiles.push(file);
            }
          } else if (entry.isDirectory) {
            // 处理文件夹
            try {
              const folderFiles = await processDirectoryEntry(entry);
              allFiles.push(...folderFiles);
            } catch (error) {
              console.error('处理文件夹时出错:', error);
            }
          }
        }
      }
      
      if (allFiles.length > 0) {
        handleFilesUpload(allFiles);
      }
      
      e.dataTransfer.clearData();
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // 后备处理：直接使用文件列表
      console.log('Files dropped:', e.dataTransfer.files.length);
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Drag enter event triggered');
    
    setDragCounter(prev => prev + 1);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      console.log('Setting drag active to true');
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Drag leave event triggered');
    
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setDragActive(false);
      }
      return newCounter;
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // console.log('Drag over event triggered'); // 注释掉这个，因为会产生太多日志
  };

  // 处理打字机效果完成的回调
  const handleTypewritingComplete = (messageIndex: number) => {
    setMessages(prev => {
      const newMessages = [...prev];
      if (newMessages[messageIndex] && newMessages[messageIndex].role === 'assistant') {
        newMessages[messageIndex].typewriting = false;
        // 将fullContent的内容设置到content中，添加类型检查
        const fullContent = newMessages[messageIndex].fullContent;
        if (fullContent) {
          newMessages[messageIndex].content = fullContent;
        }
      }
      return newMessages;
    });
  };

  // Function to fetch current model from backend
  const fetchCurrentModel = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/settings');
      if (response.data && response.data.model) {
        const modelFromBackend = response.data.model;
        const normalizedModel = normalizeModelValue(modelFromBackend);
        
        if (normalizedModel !== modelFromBackend) {
          console.warn('Backend returned unknown model:', modelFromBackend, 'Using normalized:', normalizedModel);
        } else {
          console.log('Model fetched successfully:', normalizedModel);
        }
        
        setCurrentModel(normalizedModel);
        
        // 同时更新其他设置
        setApiKey(response.data.api_key || '');
        setApiUrl(response.data.api_url || '');
      } else {
        // 如果后端没有返回有效模型，设置默认值
        console.log('No model found in backend, setting default: gpt-4o');
        setCurrentModel('gpt-4o');
      }
    } catch (error) {
      console.error('Error fetching current model:', error);
      // 如果请求失败，设置默认值
      console.log('Failed to fetch model, setting default: gpt-4o');
      setCurrentModel('gpt-4o');
    }
  };

  // Function to fetch settings when opening modal
  const fetchSettings = async (selectedModel?: string) => {
    try {
      const url = selectedModel 
        ? `http://127.0.0.1:5000/api/settings?model=${selectedModel}` 
        : 'http://127.0.0.1:5000/api/settings';

      const response = await axios.get(url);
      if (response.data) {
        if (response.data.model && !selectedModel) {
          setCurrentModel(response.data.model);
        }
        setApiKey(response.data.api_key || '');
        setApiUrl(response.data.api_url || '');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  // Handle model change
  const handleModelChange = async (newModel: string) => {
    // 如果选择的是"设置"，打开设置模态框
    if (newModel === 'settings') {
      await fetchSettings();
      setIsSettingsModalOpen(true);
      return;
    }
    
    // 验证并规范化新模型
    const normalizedModel = normalizeModelValue(newModel);
    if (normalizedModel !== newModel) {
      console.warn('Invalid model selected:', newModel, 'Using normalized:', normalizedModel);
    }
    
    const previousModel = currentModel;
    setCurrentModel(normalizedModel);
    
    try {
      const response = await axios.post('http://127.0.0.1:5000/api/settings', {
        model: normalizedModel
      });
      
      if (response.data) {
        console.log('Model updated successfully to:', normalizedModel);
      }
    } catch (error) {
      console.error('Error updating model:', error);
      // Revert model selection if update fails
      setCurrentModel(previousModel);
      
      // 可选：显示错误消息给用户
      setMessages(prev => [...prev, {
        role: 'system',
        content: `模型切换失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  // Handle settings save
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      const response = await axios.post('http://127.0.0.1:5000/api/settings', {
        model: currentModel,
        api_key: apiKey,
        api_url: apiUrl
      });

      if (response.data) {
        setSaveMessage('设置已保存');
        setTimeout(() => {
          setSaveMessage('');
          setIsSettingsModalOpen(false);
        }, 500);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage(`保存失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', overflow: 'hidden' }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        {/* Left Sidebar - File Management */}
        <Box sx={{ 
          width: isPanelCollapsed ? '60px' : '360px',
          transition: 'width 0.3s ease-in-out',
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isPanelCollapsed ? 'none' : '2px 0 8px rgba(0,0,0,0.1)',
          zIndex: 10
        }}>
          {isPanelCollapsed ? (
            // 折叠状态：显示新建聊天按钮和两个切换按钮
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              pt: 2,
              gap: 1
            }}>
              <Tooltip title="新建聊天" placement="right">
                <IconButton 
                  onClick={handleNewChat}
                  sx={{ 
                    bgcolor: '#000000',
                    color: '#ffffff',
                    height: '30px',
                    width: '30px',
                    '&:hover': { 
                      bgcolor: '#1a1a1a'
                    }
                  }}
                >
                  <AddIcon sx={{ fontSize: '15px' }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="文档库" placement="right">
                <IconButton 
                  onClick={() => handleLeftPanelTypeChange('files')}
                  sx={{ 
                    bgcolor: 'grey.300',
                    color: 'grey.600',
                    height: '30px',
                    width: '30px',
                    '&:hover': { 
                      bgcolor: 'grey.400'
                    }
                  }}
                >
                  <DnsIcon sx={{ fontSize: '15px' }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="聊天记录" placement="right">
                <IconButton 
                  onClick={() => handleLeftPanelTypeChange('history')}
                  sx={{ 
                    bgcolor: 'grey.300',
                    color: 'grey.600',
                    height: '30px',
                    width: '30px',
                    '&:hover': { 
                      bgcolor: 'grey.400'
                    }
                  }}
                >
                  <HistoryIcon sx={{ fontSize: '15px' }} />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            // 展开状态：显示完整的面板内容
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              height: '100%',
              p: 2
            }}>
              {/* 面板标题栏和切换按钮 */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 2
              }}>
                {/* 左侧：切换按钮组 */}
                <ToggleButtonGroup
                  value={leftPanelType}
                  exclusive
                  onChange={(event, newType) => {
                    if (newType !== null) {
                      setLeftPanelType(newType);
                    }
                  }}
                  size="small"
                  sx={{
                    '& .MuiToggleButton-root': {
                      px: 1.5,
                      py: 0.5,
                      fontSize: '0.75rem',
                      minWidth: 'auto',
                      border: '1px solid #e2e8f0',
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                      },
                    },
                  }}
                >
                  <ToggleButton value="files">
                    <DnsIcon sx={{ fontSize: '14px', mr: 0.5 }} />
                    文档库
                  </ToggleButton>
                  <ToggleButton value="history">
                    <HistoryIcon sx={{ fontSize: '14px', mr: 0.5 }} />
                    聊天记录
                  </ToggleButton>
                </ToggleButtonGroup>
                
                {/* 右侧：收起按钮 */}
                <Tooltip title="" placement="bottom">
                  <IconButton 
                    onClick={handlePanelToggle}
                    size="small"
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': { 
                        bgcolor: 'action.hover' 
                      }
                    }}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              
              {/* 面板内容 */}
              <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                {leftPanelType === 'files' ? (
                  <FileLibraryWithUpload
                    files={uploadedFiles}
                    selectable={true}
                    onFileSelect={toggleFileSelection}
                    selectedFiles={selectedFiles.map(f => f.filepath)}
                    onFileUpload={handleFilesUpload}
                    onDeleteFile={handleFileDelete}
                    onRefreshFiles={handleReloadIndex}
                    onSelectAll={handleSelectAll}
                    onFileRead={handleFileRead}
                    onNewChat={handleNewChat}
                    isUploading={isProcessing}
                    isRefreshing={isReloadingIndex}
                    onPublicFileImport={fetchUploadedFiles}
                    projectId={projectId}
                  />
                ) : (
                  <ChatHistoryPanel
                    onSelectChat={handleSelectChat}
                    onNewChat={handleNewChat}
                    currentChatId={currentChatId}
                    refreshTrigger={historyRefreshTrigger}
                    projectId={projectId}
                  />
                )}
              </Box>
            </Box>
          )}
        </Box>

        {/* Main Content Area - Chat Interface */}
        <Box sx={{ 
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative' // 为遮罩定位添加relative
        }}>
          {/* 统一的拖拽遮罩层 */}
          {dragActive && (
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
                zIndex: 1000,
                backdropFilter: 'blur(2px)',
                pointerEvents: 'none',
              }}
            >
              <CloudUploadIcon sx={{ fontSize: 80, color: '#2563eb', mb: 2 }} />
              <Typography variant="h5" sx={{ color: '#2563eb', fontWeight: 600 }}>
                释放文件或文件夹来上传
              </Typography>
              <Typography variant="body1" sx={{ color: '#2563eb', mt: 1 }}>
                支持 PDF, TXT, MD, CSV, DOCX 等格式，自动递归处理文件夹
              </Typography>
            </Box>
          )}
          
          {/* Model Selection Header */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            px: 1,
            py: 2,
            backgroundColor: '#ffffff',
            zIndex: 5
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {/* Home Button 和 Project Name 靠得更近 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {/* Home Button */}
                {onGoHome && (
                  <Tooltip title="返回主页" placement="bottom">
                    <IconButton
                      onClick={onGoHome}
                      sx={{
                        borderRadius: '50%',
                        color: '#64748b',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          color: '#2563eb',
                          bgcolor: alpha('#2563eb', 0.1),
                          transform: 'scale(1.05)',
                          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.15)'
                        },
                        '&:active': {
                          transform: 'scale(0.95)',
                          transition: 'transform 0.1s ease-in-out'
                        }
                      }}
                    >
                      <HomeIcon />
                    </IconButton>
                  </Tooltip>
                )}

                {/* Project Name Display */}
                {projectName && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      maxWidth: '150px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#555555',
                      ml: 0
                    }}
                    title={projectName} // 悬停时显示完整名称
                  >
                  <Box component="span" sx={{ color: '#aaaaaa', mr: 0.5 }}>{'>'}</Box>
                  {projectName.length > 15 ? `${projectName.substring(0, 15)}...` : projectName}
                  </Typography>
                )}
              </Box>

              {/* Model Selection 与前面的元素间距加大 */}
              <FormControl size="small" sx={{ minWidth: 140, ml: 2 }}>
                <Select
                  value={normalizeModelValue(currentModel)}
                  onChange={(e) => handleModelChange(e.target.value)}
                  sx={{
                    height: '32px',
                    fontSize: '0.75rem',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#e2e8f0',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#cbd5e1',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#2563eb',
                    },
                  }}
                >
                  {MODEL_OPTIONS.map((model) => (
                    <MenuItem key={model.value} value={model.value} sx={{ fontSize: '0.75rem' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {model.value === 'settings' ? (
                          <>
                            <SettingsIcon sx={{ fontSize: '0.875rem', color: '#64748b' }} />
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {model.label}
                            </Typography>
                          </>
                        ) : (
                          <>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                              {model.label}
                            </Typography>
                            <Chip
                              label={model.category.toUpperCase()}
                              size="small"
                              sx={{
                                height: '16px',
                                fontSize: '0.625rem',
                                backgroundColor: 
                                  model.category === 'gpt' ? '#dbeafe' :
                                  model.category === 'deepseek' ? '#dcfce7' :
                                  model.category === 'claude' ? '#fef3c7' :
                                  model.category === 'qianwen' ? '#f3e8ff' : '#f1f5f9',
                                color:
                                  model.category === 'gpt' ? '#1d4ed8' :
                                  model.category === 'deepseek' ? '#166534' :
                                  model.category === 'claude' ? '#92400e' :
                                  model.category === 'qianwen' ? '#7c3aed' : '#475569',
                              }}
                            />
                          </>
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

            </Box>
          </Box>
          
          <Container maxWidth="xl" sx={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            py: 2, 
            px: 3,
            overflow: 'hidden'
          }}>
            <Box sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              // 确保子元素布局稳定，防止高度跳动
              '& > *:first-of-type': {
                flex: '1 1 0',  // 消息区域占据剩余空间
                minHeight: 0   // 允许收缩
              },
              '& > *:last-of-type': {
                flex: '0 0 auto'  // 输入区域固定大小
              }
            }}>
              {/* Chat Messages Area */}
              <Paper elevation={1} sx={{ 
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 2,
                overflow: 'hidden',
                mb: 3,
                border: 'none', // 去除边框
                boxShadow: 'none', // 去除阴影
                // 稳定布局，防止因下方内容变化而产生跳动
                position: 'relative'
              }}>
                <Box sx={{ 
                  flexGrow: 1, 
                  overflowY: 'auto', 
                  p: 3,
                  position: 'relative',
                  height: 0 // 强制flex子元素遵守父容器高度限制
                }}
                className="chat-messages-container"
                >
                  <ChatMessages 
                    messages={messages} 
                    dataMosaicEnabled={dataMosaicEnabled} 
                    onFileUpload={undefined} 
                    onEditMessage={handleEditMessage}
                    currentChatId={currentChatId}
                    disableDrag={true}
                    onTypewritingComplete={handleTypewritingComplete}
                    onThinkingProgressClick={handleThinkingProgressClick}
                    onFileRead={handleFileRead}
                  />
                  <div ref={messagesEndRef} />
                </Box>
              </Paper>
              
              {/* Chat Input */}
              <Paper elevation={1} sx={{ 
                borderRadius: 2,
                position: 'relative',
                // 确保 ChatInput 区域有稳定的布局基础
                '& > *': {
                  transition: 'height 0.2s ease-in-out'
                }
              }}>
                <ChatInput 
                  onSubmit={handleQuerySubmit} 
                  isProcessing={isProcessing} 
                  onPause={handlePauseGeneration}
                  uploadedFiles={selectedFiles}
                  onFileRemove={handleFileRemove}
                  dataMosaicEnabled={dataMosaicEnabled}
                  onDataMosaicToggle={handleDataMosaicToggle}
                  disableDrag={true}
                />
              </Paper>
            </Box>
          </Container>
        </Box>

        {/* Right Sidebar - Dynamic Panel with Toggle */}
        <Box sx={{ 
          width: isRightPanelCollapsed ? '60px' : `${rightPanelWidth}px`,
          transition: isResizing ? 'none' : 'width 0.3s ease-in-out',
          backgroundColor: '#f8fafc',
          borderLeft: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'row',
          boxShadow: isRightPanelCollapsed ? 'none' : '-2px 0 8px rgba(0,0,0,0.1)',
          zIndex: 10,
          position: 'relative'
        }}>
          {/* 拖拽调整器 */}
          {!isRightPanelCollapsed && (
            <Box
              onMouseDown={handleMouseDown}
              sx={{
                width: '4px',
                cursor: 'col-resize',
                backgroundColor: 'transparent',
                '&:hover': {
                  backgroundColor: 'primary.main',
                },
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                zIndex: 11
              }}
            />
          )}
          
          {/* 面板内容 */}
          <Box sx={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}>
          {isRightPanelCollapsed ? (
            // 折叠状态：显示两个按钮
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              pt: 2,
              gap: 1
            }}>
              <Tooltip title="文档阅读器" placement="left">
                <IconButton 
                  onClick={() => {
                    setRightPanelType('reader');
                    setIsRightPanelCollapsed(false);
                  }}
                  sx={{ 
                    bgcolor: 'grey.300', // 收起状态下始终未选中
                    color: 'grey.600',
                    height: '30px',
                    width: '30px',
                    '&:hover': { 
                      bgcolor: 'grey.400'
                    }
                  }}
                >
                  <DescriptionIcon sx={{ fontSize: '15px' }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="思考过程" placement="left">
                <IconButton 
                  onClick={() => {
                    setRightPanelType('workflow');
                    setIsRightPanelCollapsed(false);
                  }}
                  sx={{ 
                    bgcolor: 'grey.300', // 收起状态下始终未选中
                    color: 'grey.600',
                    height: '30px',
                    width: '30px',
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
            // 展开状态：显示完整面板
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              height: '100%',
              p: 2
            }}>
              {/* 面板标题栏和切换按钮 */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 2,
                pb: 1,
                borderBottom: '1px solid #e2e8f0'
              }}>
                {/* 左侧：切换按钮组 */}
                <ToggleButtonGroup
                  value={rightPanelType}
                  exclusive
                  onChange={(event, newType) => {
                    if (newType !== null) {
                      setRightPanelType(newType);
                    }
                  }}
                  size="small"
                  sx={{
                    '& .MuiToggleButton-root': {
                      px: 1.5,
                      py: 0.5,
                      fontSize: '0.75rem',
                      minWidth: 'auto',
                      border: '1px solid #e2e8f0',
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                      },
                    },
                  }}
                >
                  <ToggleButton value="reader">
                    <DescriptionIcon sx={{ fontSize: '14px', mr: 0.5 }} />
                    文档阅读器
                  </ToggleButton>
                  <ToggleButton value="workflow">
                    <InsightsIcon sx={{ fontSize: '14px', mr: 0.5 }} />
                    思考过程
                  </ToggleButton>
                </ToggleButtonGroup>
                
                {/* 右侧：收起按钮 */}
                <Tooltip title="收起" placement="bottom">
                  <IconButton 
                    onClick={handleRightPanelToggle}
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
              </Box>
              
              {/* 面板内容 */}
              <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                {rightPanelType === 'reader' ? (
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {selectedFileForReading ? (
                      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* 文件标题 */}
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          mb: 2,
                          pb: 1,
                          borderBottom: '1px solid #e2e8f0'
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DescriptionIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '14px' }}>
                              {selectedFileForReading.split('/').pop()}
                            </Typography>
                          </Box>
                          <Tooltip title="关闭文件" placement="bottom">
                            <IconButton 
                              onClick={() => setSelectedFileForReading(null)}
                              size="small"
                              sx={{ 
                                color: 'text.secondary',
                                '&:hover': { 
                                  bgcolor: 'action.hover' 
                                }
                              }}
                            >
                              <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        
                        {/* 文件内容组件 */}
                        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                                                      <FileContentViewer filepath={selectedFileForReading} projectId={projectId} />
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '200px',
                        color: 'text.secondary'
                      }}>
                        <DescriptionIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                        <Typography variant="body2" align="center">
                          暂无选择的文档
                        </Typography>
                        <Typography variant="caption" align="center" sx={{ mt: 1, opacity: 0.7 }}>
                          点击文档库中的文档来查看内容
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ) : (
                <Box sx={{ height: '100%' }}>
                  <WorkflowViewer
                    isCollapsed={false}
                    onToggle={() => {}}
                    thoughtProcess={currentThoughtProcess}
                    onClose={handleCloseWorkflow}
                  />
                </Box>
                )}
              </Box>
            </Box>
          )}
          </Box>
        </Box>
      </Box>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={cancelFileDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">{"Confirm File Deletion"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete this file?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelFileDelete}>Cancel</Button>
          <Button onClick={confirmFileDelete} autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Overwrite confirmation dialog */}
      <Dialog
        open={overwriteConfirmOpen}
        onClose={cancelFileOverwrite}
        aria-labelledby="overwrite-dialog-title"
        aria-describedby="overwrite-dialog-description"
      >
        <DialogTitle id="overwrite-dialog-title">{"File Already Exists"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="overwrite-dialog-description">
            {fileToOverwrite ? `"${fileToOverwrite.name}" already exists. Do you want to overwrite it?` : 'File already exists. Do you want to overwrite it?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelFileOverwrite}>Cancel</Button>
          <Button onClick={confirmFileOverwrite} color="warning" autoFocus>
            Overwrite
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Modal */}
      <Dialog
        open={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        aria-labelledby="settings-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="settings-dialog-title">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon />
            设置
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 2 }}>
            {/* Model Settings Section */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2, fontSize: '1rem', fontWeight: 600 }}>
                模型设置
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>模型</Typography>
                <Select
                  value={normalizeModelValue(currentModel)}
                  onChange={(e) => setCurrentModel(e.target.value)}
                  size="small"
                >
                  {MODEL_OPTIONS.filter(model => model.value !== 'settings').map((model) => (
                    <MenuItem key={model.value} value={model.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {model.label}
                        </Typography>
                        <Chip
                          label={model.category.toUpperCase()}
                          size="small"
                          sx={{
                            height: '16px',
                            fontSize: '0.625rem',
                            backgroundColor: 
                              model.category === 'gpt' ? '#dbeafe' :
                              model.category === 'deepseek' ? '#dcfce7' :
                              model.category === 'claude' ? '#fef3c7' :
                              model.category === 'qianwen' ? '#f3e8ff' : '#f1f5f9',
                            color:
                              model.category === 'gpt' ? '#1d4ed8' :
                              model.category === 'deepseek' ? '#166534' :
                              model.category === 'claude' ? '#92400e' :
                              model.category === 'qianwen' ? '#7c3aed' : '#475569',
                          }}
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="API Key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="输入API Key"
                size="small"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="API URL"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="输入API URL"
                size="small"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          {saveMessage && (
            <Typography variant="body2" sx={{ color: 'success.main', mr: 2 }}>
              {saveMessage}
            </Typography>
          )}
          <Button onClick={() => setIsSettingsModalOpen(false)}>
            取消
          </Button>
          <Button 
            onClick={handleSaveSettings} 
            variant="contained"
            disabled={isSaving}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
};

export default App; 