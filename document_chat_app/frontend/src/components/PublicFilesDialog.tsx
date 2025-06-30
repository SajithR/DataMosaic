import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import PublicIcon from '@mui/icons-material/Public';
import { alpha } from '@mui/material/styles';

interface PublicFile {
  filename: string;
  filepath: string;
  size: number;
}

interface PublicFilesDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (filepaths: string[]) => void;
}

const PublicFilesDialog: React.FC<PublicFilesDialogProps> = ({ open, onClose, onImport }) => {
  const [files, setFiles] = useState<PublicFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  // 获取public_files文件列表
  const fetchPublicFiles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/public-files');
      if (!response.ok) {
        throw new Error('Failed to fetch public files');
      }
      
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // 切换文件选择状态
  const handleToggleFile = (filepath: string) => {
    setSelectedFiles(prev => {
      if (prev.includes(filepath)) {
        return prev.filter(f => f !== filepath);
      } else {
        return [...prev, filepath];
      }
    });
  };

  // 全选/取消全选
  const handleToggleAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(f => f.filepath));
    }
  };

  // 导入选中的文件
  const handleImportSelected = async () => {
    if (selectedFiles.length === 0) {
      setError('请至少选择一个文件');
      return;
    }

    setImporting(true);
    setError(null);
    
    try {
      await onImport(selectedFiles);
      onClose(); // 成功导入后关闭对话框
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取文件图标
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

  useEffect(() => {
    if (open) {
      fetchPublicFiles();
      setSelectedFiles([]); // 重置选择状态
    }
  }, [open]);

  const isAllSelected = files.length > 0 && selectedFiles.length === files.length;
  const isIndeterminate = selectedFiles.length > 0 && selectedFiles.length < files.length;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: '500px'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        borderBottom: '1px solid #e1e5e9',
        pb: 2
      }}>
        <PublicIcon color="primary" />
        从公域导入文件
        {files.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            ({selectedFiles.length}/{files.length} 已选择)
          </Typography>
        )}
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}
        
        {loading ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            py: 4 
          }}>
            <CircularProgress />
          </Box>
        ) : files.length === 0 ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            py: 4,
            color: 'text.secondary'
          }}>
            <PublicIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body2">
              公域文件夹中暂无可用文件
            </Typography>
          </Box>
        ) : (
          <>
            {/* 全选控制 */}
            <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #f0f2f5' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleToggleAll}
                  size="small"
                />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {isAllSelected ? '取消全选' : '全选'}
                </Typography>
              </Box>
            </Box>
            
            {/* 文件列表 */}
            <List sx={{ py: 0, maxHeight: '300px', overflowY: 'auto' }}>
              {files.map((file, index) => (
                <ListItem 
                  key={index} 
                  disablePadding
                  sx={{
                    '&:hover': {
                      bgcolor: alpha('#2563eb', 0.08)
                    }
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      py: 1.5,
                      px: 2,
                      cursor: 'pointer'
                    }}
                    onClick={() => handleToggleFile(file.filepath)}
                  >
                    <Checkbox
                      checked={selectedFiles.includes(file.filepath)}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {getFileIcon(file.filename)}
                    </ListItemIcon>
                    <ListItemText 
                      primary={file.filename}
                      secondary={formatFileSize(file.size)}
                      primaryTypographyProps={{ 
                        variant: 'body2',
                        fontWeight: 500
                      }}
                      secondaryTypographyProps={{ 
                        variant: 'caption',
                        color: 'text.secondary'
                      }}
                    />
                  </Box>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2, borderTop: '1px solid #e1e5e9' }}>
        <Button onClick={onClose} variant="outlined" size="small">
          取消
        </Button>
        <Button 
          onClick={handleImportSelected}
          variant="contained" 
          size="small"
          disabled={selectedFiles.length === 0 || importing}
          startIcon={importing ? <CircularProgress size={16} /> : null}
        >
          {importing ? '导入中...' : `导入 (${selectedFiles.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PublicFilesDialog; 