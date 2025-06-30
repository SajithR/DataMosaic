import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PublicIcon from '@mui/icons-material/Public';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import '../styles/ChatHistoryPanel.css';
import PublicFilesDialog from './PublicFilesDialog';

interface FileItem {
  filename: string;
  filepath: string;
  size: number;
}

interface FileLibraryWithUploadProps {
  files: FileItem[];
  selectable?: boolean;
  onFileSelect?: (filepath: string) => void;
  selectedFiles?: string[];
  onFileUpload?: (files: File[]) => void;
  onDeleteFile?: (filepath: string) => void;
  onRefreshFiles?: () => void;
  onSelectAll?: () => void;
  onFileRead?: (filepath: string) => void;
  onNewChat?: () => void;
  isUploading?: boolean;
  isRefreshing?: boolean;
  onPublicFileImport?: () => void;
  projectId?: string;
}

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const FileLibraryWithUpload: React.FC<FileLibraryWithUploadProps> = ({
  files,
  selectable = false,
  onFileSelect,
  selectedFiles = [],
  onFileUpload,
  onDeleteFile,
  onRefreshFiles,
  onSelectAll,
  onFileRead,
  onNewChat,
  isUploading = false,
  isRefreshing = false,
  onPublicFileImport,
  projectId
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [dragCounter, setDragCounter] = useState<number>(0);
  const [uploadMenuAnchor, setUploadMenuAnchor] = useState<null | HTMLElement>(null);
  const [publicFilesDialogOpen, setPublicFilesDialogOpen] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // 支持的文件格式
  const SUPPORTED_EXTENSIONS = ['pdf', 'txt', 'md', 'csv', 'xlsx', 'xls'];

  // 确保文件夹输入具有正确的属性
  useEffect(() => {
    if (folderInputRef.current) {
      (folderInputRef.current as any).webkitdirectory = true;
      (folderInputRef.current as any).directory = true;
    }
  }, []);

  const isValidFile = (file: File): boolean => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return SUPPORTED_EXTENSIONS.includes(extension);
  };

  const handleFiles = (fileList: FileList) => {
    if (onFileUpload) {
      const fileArray = Array.from(fileList);
      
      // 调试：打印文件信息
      console.log('=== handleFiles 调试信息 ===');
      fileArray.forEach((file, index) => {
        console.log(`文件 ${index + 1}:`, {
          name: file.name,
          webkitRelativePath: (file as any).webkitRelativePath,
          type: file.type,
          size: file.size
        });
      });
      
      // 处理文件夹上传时的文件名问题
      const processedFiles = fileArray.map(file => {
        // 如果是通过 webkitdirectory 选择的文件，需要重新创建文件对象
        if ((file as any).webkitRelativePath) {
          // 从相对路径中提取文件名，支持 Unix 和 Windows 路径分隔符
          const fileName = file.name.split(/[/\\]/).pop() || file.name;
          console.log(`处理文件夹文件: ${file.name} -> ${fileName}`);
          
          // 创建新的 File 对象，只保留文件名，不保留路径
          const newFile = new File([file], fileName, {
            type: file.type,
            lastModified: file.lastModified
          });
          
          return newFile;
        }
        return file;
      });
      
      // 过滤出支持的文件格式
      const validFiles = processedFiles.filter(isValidFile);
      if (validFiles.length > 0) {
        onFileUpload(validFiles);
      }
      if (validFiles.length !== fileArray.length) {
        // 如果有不支持的文件，可以在这里显示警告
        console.warn(`跳过了 ${fileArray.length - validFiles.length} 个不支持的文件`);
      }
    }
  };

  // 处理文件夹选择
  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const fileList = e.target.files;
      handleFiles(fileList);
    }
  };

  // 处理上传按钮点击
  const handleUploadClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setUploadMenuAnchor(event.currentTarget);
  };

  // 关闭上传菜单
  const handleUploadMenuClose = () => {
    setUploadMenuAnchor(null);
  };

  // 选择文件上传
  const handleSelectFiles = () => {
    handleUploadMenuClose();
    inputRef.current?.click();
  };

  // 选择文件夹上传
  const handleSelectFolder = () => {
    handleUploadMenuClose();
    // 确保设置了 webkitdirectory 属性
    if (folderInputRef.current) {
      (folderInputRef.current as any).webkitdirectory = true;
      folderInputRef.current.click();
    }
  };

  // 打开公域文件对话框
  const handleOpenPublicFiles = () => {
    handleUploadMenuClose();
    setPublicFilesDialogOpen(true);
  };

  // 导入公域文件
  const handleImportPublicFiles = async (filepaths: string[]) => {
    try {
      const apiUrl = projectId 
        ? `/api/projects/${projectId}/public-files/import`
        : '/api/public-files/import';
        
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filepaths }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Import failed');
      }

      const result = await response.json();
      
      // 成功导入后刷新文件列表
      if (onRefreshFiles) {
        onRefreshFiles();
      }
      
      // 调用回调函数通知父组件
      if (onPublicFileImport) {
        onPublicFileImport();
      }
      
      console.log('Files imported successfully:', result);
      
      // 可以显示导入结果的摘要信息
      if (result.summary) {
        const { imported_count, existing_count, failed_count } = result.summary;
        let message = '';
        if (imported_count > 0) {
          message += `成功导入 ${imported_count} 个文件`;
        }
        if (existing_count > 0) {
          message += `${message ? '，' : ''}${existing_count} 个文件已存在`;
        }
        if (failed_count > 0) {
          message += `${message ? '，' : ''}${failed_count} 个文件导入失败`;
        }
        console.log('Import summary:', message);
      }
      
    } catch (error) {
      console.error('Import error:', error);
      throw error; // 重新抛出错误以便对话框组件处理
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  // 判断是否为文件夹拖拽
  const isDraggingFolder = (dataTransfer: DataTransfer): boolean => {
    return Array.from(dataTransfer.items).some(item => {
      const entry = item.webkitGetAsEntry?.();
      return entry?.isDirectory;
    });
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

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
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
      
      if (allFiles.length > 0 && onFileUpload) {
        // 调试：打印拖拽文件信息
        console.log('=== 拖拽上传调试信息 ===');
        allFiles.forEach((file, index) => {
          console.log(`拖拽文件 ${index + 1}:`, {
            name: file.name,
            webkitRelativePath: (file as any).webkitRelativePath,
            type: file.type,
            size: file.size
          });
        });
        
        onFileUpload(allFiles);
      }
      
      e.dataTransfer.clearData();
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // 后备处理：直接使用文件列表
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragCounter(prev => prev + 1);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
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
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get icon based on file type
  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    if (extension === 'pdf') {
      return <PictureAsPdfIcon color="error" />;
    } else if (['csv', 'xlsx', 'xls'].includes(extension)) {
      return <TableChartIcon color="success" />;
    } else {
      return <DescriptionIcon color="primary" />;
    }
  };

  const handleToggle = (filepath: string) => {
    if (selectable && onFileSelect && filepath) {
      onFileSelect(filepath);
    }
  };

  // 新增：处理文件阅读点击
  const handleFileRead = (filepath: string) => {
    if (onFileRead) {
      onFileRead(filepath);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* 新建聊天按钮 */}
      {onNewChat && (
        <div className="chat-history-actions">
          <button 
            className="new-chat-button"
            onClick={onNewChat}
            title="新建聊天"
            style={{ backgroundColor: '#000000', color: '#ffffff', fontSize: '12px' }}
          >
            <AddIcon style={{ fontSize: 12 }} />
            新建聊天
          </button>
        </div>
      )}

      {/* 文件库主体 */}
      <Paper
        elevation={1}
        sx={{
          position: 'relative',
          borderRadius: 3,
          border: '1px solid #e1e5e9',
          bgcolor: '#ffffff',
          transition: 'all 0.2s ease',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        {/* 拖拽遮罩层 */}
        {dragActive && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: alpha('#2563eb', 0.1),
              borderRadius: 3,
              border: '2px dashed #2563eb',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              backdropFilter: 'blur(2px)',
              pointerEvents: 'none',
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 60, color: '#2563eb', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#2563eb', fontWeight: 600 }}>
              释放文件或文件夹来上传
            </Typography>
            <Typography variant="body2" sx={{ color: '#2563eb', mt: 1 }}>
              支持 PDF, TXT, MD, CSV, DOCX 等格式
            </Typography>
          </Box>
        )}

        {/* 标题栏 */}
        <Box sx={{ 
          p: 2, 
          borderBottom: '1px solid #f0f2f5',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          bgcolor: '#ffffff'
        }}>
          {/* 文档库标题和操作 */}
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1f2937', fontSize: '14px' }}>
                文档库 ({files.length})
              </Typography>
              {files.length > 0 && selectable && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={onSelectAll}
                  sx={{
                    fontSize: '11px',
                    py: 0.3,
                    px: 1,
                    borderColor: '#e5e7eb',
                    color: '#6b7280',
                    minWidth: 'auto',
                    height: '24px',
                    '&:hover': {
                      borderColor: '#d1d5db',
                      bgcolor: '#f9fafb'
                    }
                  }}
                >
                  {selectedFiles.length === files.length ? '取消全选' : '全选'}
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<CloudUploadIcon sx={{ fontSize: 16 }} />}
                onClick={handleUploadClick}
                sx={{ 
                  fontSize: '12px', 
                  py: 0.5, 
                  px: 1.5,
                  borderRadius: 1.5,
                  bgcolor: '#2563EB',
                  height: '28px',
                  '&:hover': {
                    bgcolor: '#2563EB'
                  },
                  boxShadow: 'none'
                }}
              >
                选择上传
              </Button>
              
              <VisuallyHiddenInput 
                ref={inputRef}
                type="file" 
                multiple 
                onChange={handleChange} 
              />
              <VisuallyHiddenInput 
                ref={folderInputRef}
                type="file" 
                multiple
                onChange={handleFolderChange} 
              />
            <IconButton
              size="small"
              onClick={onRefreshFiles}
              disabled={isRefreshing}
              sx={{ 
                color: '#6b7280',
                bgcolor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 1.5,
                width: 28,
                height: 28,
                '&:hover': { 
                  bgcolor: '#f3f4f6',
                  color: '#374151'
                }
              }}
            >
              {isRefreshing ? (
                <CircularProgress size={14} />
              ) : (
                <RefreshIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
            </Box>
          </Box>
          
          {/* 上传选择菜单 */}
          <Menu
            anchorEl={uploadMenuAnchor}
            open={Boolean(uploadMenuAnchor)}
            onClose={handleUploadMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            <MenuItem onClick={handleSelectFiles}>
              <CloudUploadIcon sx={{ mr: 1, fontSize: 16 }} />
              选择文件
            </MenuItem>
            <MenuItem onClick={handleSelectFolder}>
              <FolderOpenIcon sx={{ mr: 1, fontSize: 16 }} />
              选择文件夹
            </MenuItem>
            <MenuItem onClick={handleOpenPublicFiles}>
              <PublicIcon sx={{ mr: 1, fontSize: 16 }} />
              从公域导入
            </MenuItem>
          </Menu>
        </Box>

        {/* 文件列表 */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, minHeight: 0 }}>
          {files.length === 0 ? (
            <Box sx={{ 
              p: 3, 
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '150px'
            }}>
              <Typography variant="body2" color="#9ca3af" sx={{ fontSize: '12px' }}>
                暂无上传的文件
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
              {files.map((file, index) => (
                <Box
                  key={index}
                  sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    p: 1.2,
                    bgcolor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 1.5,
                    cursor: 'default',  // 修改：移除指针样式，因为不同区域有不同的点击行为
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: '#f8fafc',
                      borderColor: '#d1d5db'
                    }
                  }}
                >
                  {selectable && (
                    <Checkbox
                      checked={selectedFiles.includes(file.filepath)}
                      tabIndex={-1}
                      disableRipple
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(file.filepath);
                      }}
                      sx={{ 
                        mr: 1.5,
                        color: '#d1d5db',
                        padding: '2px',
                        '&.Mui-checked': {
                          color: '#4f46e5'
                        },
                        '& .MuiSvgIcon-root': {
                          fontSize: 18
                        }
                      }}
                    />
                  )}
                  <Box sx={{ minWidth: 24, mr: 1.5 }}>
                    {React.cloneElement(getFileIcon(file.filename), { sx: { fontSize: 20 } })}
                  </Box>
                  <Box 
                    sx={{ 
                      flex: 1, 
                      minWidth: 0,
                      cursor: 'pointer'  // 文件名区域可点击用于阅读
                    }}
                    onClick={() => handleFileRead(file.filepath)}
                  >
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 500,
                        color: '#1f2937',
                        fontSize: '12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.3,
                        '&:hover': {
                          color: '#2563eb'  // 悬停时改变颜色，提示可点击
                        }
                      }}
                    >
                      {file.filename}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: '#9ca3af',
                        fontSize: '10px',
                        lineHeight: 1.2
                      }}
                    >
                      {formatFileSize(file.size)}
                    </Typography>
                  </Box>
                  <IconButton 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile && onDeleteFile(file.filepath);
                    }}
                    sx={{ 
                      color: 'grey',
                      ml: 1,
                      width: 24,
                      height: 24,
                      '&:hover': { 
                        bgcolor: alpha('#ef4444', 0.1)
                      }
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* 底部拖拽提示 */}
        <Box sx={{ 
          p: 1.5, 
          textAlign: 'center'
        }}>
          <Typography 
            variant="caption" 
            sx={{ 
              color: '#9ca3af',
              fontSize: '11px',
              fontStyle: 'italic'
            }}
          >
            将文件拖拽到这里上传
          </Typography>
        </Box>
      </Paper>

      {/* 公域文件导入对话框 */}
      <PublicFilesDialog
        open={publicFilesDialogOpen}
        onClose={() => setPublicFilesDialogOpen(false)}
        onImport={handleImportPublicFiles}
      />
    </Box>
  );
};

export default FileLibraryWithUpload; 