import React, { useState } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import StopIcon from '@mui/icons-material/Stop';
import Chip from '@mui/material/Chip';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

export interface ChatInputProps {
  onSubmit: (query: string) => void;
  isProcessing: boolean;
  onPause?: () => void;
  uploadedFiles?: {filename: string, filepath: string, size: number}[];
  onFileRemove?: (filename: string) => void;
  dataMosaicEnabled?: boolean;
  onDataMosaicToggle?: (enabled: boolean) => void;
  onFileUpload?: (files: File[]) => void;
  disableDrag?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSubmit, 
  isProcessing, 
  onPause,
  uploadedFiles = [],
  onFileRemove,
  dataMosaicEnabled = false,
  onDataMosaicToggle,
  onFileUpload,
  disableDrag = false
}) => {
  const [input, setInput] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSubmit(input);
      setInput('');
    }
  };

  const handlePause = () => {
    if (onPause) {
      onPause();
    }
  };

  const handleFileRemove = (filename: string) => {
    if (onFileRemove) {
      onFileRemove(filename);
    }
  };

  const handleDataMosaicToggle = () => {
    if (onDataMosaicToggle) {
      onDataMosaicToggle(!dataMosaicEnabled);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isProcessing) {
        onSubmit(input);
        setInput('');
      }
    }
  };

  // Drag handling functions
  const handleFiles = (fileList: FileList) => {
    if (onFileUpload) {
      const fileArray = Array.from(fileList);
      onFileUpload(fileArray);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Box sx={{ 
      p: 2, 
      display: 'flex', 
      justifyContent: 'center',
      position: 'relative'
    }}
    onDrop={disableDrag ? undefined : handleDrop}
    onDragOver={disableDrag ? undefined : handleDragOver}
    onDragEnter={disableDrag ? undefined : handleDragEnter}
    onDragLeave={disableDrag ? undefined : handleDragLeave}
    >
      {/* Drag overlay */}
      {/* {dragActive && !disableDrag && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            bottom: 8,
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
          <CloudUploadIcon sx={{ fontSize: 40, color: '#2563eb', mb: 1 }} />
          <Typography variant="subtitle1" sx={{ color: '#2563eb', fontWeight: 600 }}>
            Release files to upload
          </Typography>
          <Typography variant="body2" sx={{ color: '#2563eb', mt: 0.5, fontSize: '12px' }}>
            Supports PDF, DOCX, TXT, CSV and other formats
          </Typography>
        </Box>
      )} */}
      
      <Box sx={{ 
        width: '800px',
        maxWidth: '90%'
      }}>
        {/* File list area - reserve fixed space to prevent height jumping */}
        <Box sx={{ 
          mb: uploadedFiles.length > 0 ? 2 : 0, // Only have bottom margin when there are files
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 1,
          minHeight: uploadedFiles.length > 0 ? '32px' : '0px', // Reserve at least one line chip height
          transition: 'all 0.2s ease-in-out', // Smooth transition for all properties
          overflow: 'hidden' // Avoid content overflow
        }}>
          {uploadedFiles.map((file, index) => (
            <Chip
              key={index}
              label={file.filename}
              onDelete={() => handleFileRemove(file.filename)}
              size="small"
              variant="outlined"
              icon={<CloudUploadIcon />}
              sx={{
                maxWidth: '200px',
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }
              }}
            />
          ))}
        </Box>

        <Box sx={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <Box component="form" onSubmit={handleSubmit}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '4px 4px'
            }}>
              <TextField
                fullWidth
                variant="standard"
                placeholder="Enter your question here..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isProcessing}
                multiline
                maxRows={3}
                minRows={1}
                sx={{
                  '& .MuiInput-root': {
                    fontSize: '0.85rem',
                    lineHeight: '1.4',
                    '&:before': {
                      display: 'none',
                    },
                    '&:after': {
                      display: 'none',
                    },
                    '&:hover:not(.Mui-disabled):before': {
                      display: 'none',
                    },
                  },
                  '& .MuiInputBase-input': {
                    padding: '6px 20px',
                    fontSize: '0.85rem',
                    height: 'auto',
                    maxHeight: '60px',
                    '&::placeholder': {
                      color: '#999999',
                      opacity: 1,
                    }
                  }
                }}
                onKeyDown={handleKeyDown}
              />
              {isProcessing ? (
                <Button
                  variant="contained"
                  // color="#000000"
                  onClick={handlePause}
                  sx={{ 
                    marginTop: '20px',
                    marginRight: '10px',
                    minWidth: '35px',
                    width: '35px',
                    height: '35px',
                    borderRadius: '50%',
                    p: 0,
                    bgcolor: '#000000',
                    '&:hover': {
                      bgcolor: '#000000',
                    }
                  }}
                >
                  <StopIcon fontSize="small" />
                </Button>
              ) : (
                <Button
                  variant="contained"
                  type="submit"
                  disabled={!input.trim()}
                  sx={{ 
                    marginTop: '20px',
                    marginRight: '10px',
                    minWidth: '35px',
                    width: '35px',
                    height: '35px',
                    borderRadius: '50%',
                    p: 0,
                    bgcolor: '#000000',
                    '&:hover': {
                      bgcolor: '#000000',
                    },
                    '&.Mui-disabled': {
                      bgcolor: '#cccccc',
                      color: '#ffffff',
                    }
                  }}
                >
                  <img src="/arrow.png" alt="Send" style={{ width: '10px', height: '10px' }} />
                </Button>
              )}
            </Box>
          </Box>

          {onDataMosaicToggle && (
            <Box sx={{ 
              display: 'flex',
              alignItems: 'center',
              paddingX: '12px'
            }}>
              <Box
                onClick={handleDataMosaicToggle}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 6px',
                  fontSize: '12px',
                  borderRadius: '20px',
                  border: '1.5px solid #d1d5db',
                  backgroundColor: dataMosaicEnabled ? '#bddcf4' : 'white',
                  color: dataMosaicEnabled ? '#0285ff' : '#6b7280',
                  borderColor: dataMosaicEnabled ? '#aac6db' : '#d1d5db',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: dataMosaicEnabled ? '#a8d0f0' : '#f9fafb'
                  }
                }}
              >
                <Box
                  component="img"
                  src={dataMosaicEnabled ? "/mosaic2.png" : "/mosaic.png"}
                  alt="Mosaic"
                  sx={{
                    width: '18px',
                    height: '18px',
                    marginRight: '3px',
                    verticalAlign: 'middle'
                  }}
                />
                Mosaic
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ChatInput; 