import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import SearchIcon from '@mui/icons-material/Search';
import MemoryIcon from '@mui/icons-material/Memory';
import PsychologyIcon from '@mui/icons-material/Psychology';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { keyframes } from '@mui/system';

interface ReActProcessorProps {
  thoughtProcess: string[];
}

interface ProcessedThought {
  content: string;
  type: string;
  icon: React.ReactNode;
  color: string;
  label: string;
  isTemporary: boolean;
}

// Define pulsing animation for temporary thoughts
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

// Process and categorize thinking steps
const processThoughts = (thoughtProcess: string[]): ProcessedThought[] => {
  if (!thoughtProcess || !Array.isArray(thoughtProcess)) return [];

  return thoughtProcess.map(thought => {
    // Simplified type detection
    let type = 'thinking';
    let icon = <PsychologyIcon fontSize="small" />;
    let color = 'primary';
    let label = 'THINKING';

    // Clear temporary markers
    const cleanedThought = thought.replace('[TEMP:]', '').trim();

    // Detect step type
    if (/\*\*Step\s+\d+:/i.test(cleanedThought)) {
      type = 'step';
      icon = <PsychologyIcon fontSize="small" />;
      color = 'primary';
      label = 'Step';
    } else if (cleanedThought.includes('[SEARCH]')) {
      type = 'search';
      icon = <SearchIcon fontSize="small" />;
      color = 'primary';
      label = 'SEARCH';
    } else if (cleanedThought.includes('[EXTRACT]')) {
      type = 'extract';
      icon = <MemoryIcon fontSize="small" />;
      color = 'info';
      label = 'EXTRACT';
    } else if (cleanedThought.includes('[VERIFY]')) {
      type = 'verify';
      icon = <FactCheckIcon fontSize="small" />;
      color = 'success';
      label = 'VERIFY';
    } else if (cleanedThought.includes('[REASON]')) {
      type = 'reason';
      icon = <AutoFixHighIcon fontSize="small" />;
      color = 'primary';
      label = 'REASON';
    } else if (cleanedThought.includes('[DECISION]') || cleanedThought.includes('[REFINE]')) {
      type = 'action';
      icon = <AutoFixHighIcon fontSize="small" />;
      color = 'info';
      label = 'PROCESS';
    }

    return {
      content: cleanedThought,
      type,
      icon,
      color,
      label,
      isTemporary: thought.includes('[TEMP:]')
    };
  });
};

const ReActProcessor: React.FC<ReActProcessorProps> = ({ thoughtProcess }) => {
  const processedThoughts = processThoughts(thoughtProcess);
  
  // State to track expanded/collapsed state for each thought
  const [expandedStates, setExpandedStates] = useState<{[key: number]: boolean}>({});

  if (!processedThoughts || processedThoughts.length === 0) {
    return null;
  }
  
  // Toggle expanded/collapsed state
  const toggleExpand = (index: number) => {
    setExpandedStates(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  
  // Count lines in the content
  const countLines = (content: string): number => {
    return content.split('\n').length;
  };
  
  // Check if content should be collapsible
  const shouldBeCollapsible = (thought: ProcessedThought): boolean => {
    // Only make Retrieval and Extract types collapsible
    if (thought.type !== 'search' && thought.type !== 'extract') {
      return false;
    }
    
    // Clean the content first
    const cleanContent = thought.content
      .replace('[THINKING]', '')
      .replace('[SEARCH]', '')
      .replace('[EXTRACT]', '')
      .replace('[VERIFY]', '')
      .replace('[REASON]', '')
      .replace('[DECISION]', '')
      .replace('[REFINE]', '');
    
    // Check if it has more than 3 lines
    return countLines(cleanContent) > 3;
  };
  
  // Get display content based on expanded state
  const getDisplayContent = (thought: ProcessedThought, index: number): string => {
    // First remove the temporary marker if it exists
    let cleanContent = thought.content;
    
    // Clean the content
    cleanContent = cleanContent
      .replace('[THINKING]', '')
      .replace('[SEARCH]', '')
      .replace('[EXTRACT]', '')
      .replace('[VERIFY]', '')
      .replace('[REASON]', '')
      .replace('[DECISION]', '')
      .replace('[REFINE]', '')
      .replace('[TEMP:]', '');  // Remove the temporary marker too
    
    // If not collapsible or expanded, show full content
    if (!shouldBeCollapsible(thought) || expandedStates[index]) {
      return cleanContent;
    }
    
    // Otherwise show first 3 lines
    const lines = cleanContent.split('\n');
    return lines.slice(0, 3).join('\n') + '\n...';
  };

  return (
    <Box sx={{ mt: 2 }}>
      
      <Paper 
        elevation={0} 
        sx={{ 
          p: 2, 
          bgcolor: 'transparent', 
          borderRadius: 2,
          border: '1px solid rgba(0, 0, 0, 0.05)',
          position: 'relative'
        }}
      >
        {/* Vertical connecting line */}
        <Box 
          sx={{ 
            position: 'absolute', 
            left: 32, 
            top: 20, 
            bottom: 20, 
            width: 2, 
            bgcolor: 'divider',
            zIndex: 0
          }}
          className="vertical-connection-line" 
        />
        
        {processedThoughts.map((thought, index) => {
          const isCollapsible = shouldBeCollapsible(thought);
          const isStep = thought.type === 'step';
          
          return (
            <Box 
              key={index} 
              sx={{ 
                            mb: isStep ? 4 : 2, // Step types use larger spacing
            mt: isStep && index > 0 ? 3 : 0, // Also add spacing before Steps
                position: 'relative', 
                zIndex: 1,
                // Apply pulsing animation if this is a temporary thought but not Processing
                animation: (thought.isTemporary && thought.label !== 'Processing') ? `${pulse} 2s infinite ease-in-out` : 'none',
                opacity: thought.isTemporary ? 0.9 : 1
              }}
            >
              {/* Special handling for Step types */}
              {isStep ? (
                <>
                  {/* Step separator line */}
                  {index > 0 && (
                    <Box sx={{ 
                      width: '100%', 
                      height: '1px', 
                      bgcolor: 'divider', 
                      mb: 3,
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: '50%',
                        top: '-4px',
                        transform: 'translateX(-50%)',
                        width: '8px',
                        height: '8px',
                        bgcolor: 'primary.main',
                        borderRadius: '50%'
                      }
                    }} />
                  )}
                  
                  {/* Step title card */}
                  <Box 
                    sx={{ 
                      background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)', 
                      color: '#1f2937',
                      px: 2, 
                      py: 1.5, 
                      border: '1px solid #cbd5e1',
                      borderRadius: 2, 
                      mb: 2,
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ 
                        fontSize: '1rem', 
                        fontWeight: 600,
                        flex: 1,
                        color: '#1f2937',
                        '& strong': { fontWeight: 700 }
                      }}>
                        {(() => {
                          const stepMatch = thought.content.match(/\*\*Step\s+(\d+):\s*(.+?)\*\*/i);
                          if (stepMatch) {
                            const stepNumber = stepMatch[1];
                            const stepTitle = stepMatch[2];
                            return (
                              <>
                                <Box component="span" sx={{ 
                                  display: 'inline-block',
                                  bgcolor: '#2563eb', 
                                  color: 'white',
                                  px: 1.5, 
                                  py: 0.5, 
                                  borderRadius: 1.5, 
                                  mr: 1.5, 
                                  fontSize: '0.875rem',
                                  fontWeight: 600
                                }}>
                                  Step {stepNumber}
                                </Box>
                                {stepTitle}
                              </>
                            );
                          }
                          return thought.content;
                        })()}
                      </Typography>
                    </Box>
                  </Box>
                  
                  {/* Step content */}
                  {(() => {
                    const stepMatch = thought.content.match(/\*\*Step\s+\d+:\s*.+?\*\*\s*([\s\S]*)/i);
                    const remainingContent = stepMatch ? stepMatch[1].trim() : '';
                    
                    if (remainingContent) {
                      return (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            ml: 2, 
                            pl: 2, 
                            borderLeft: '3px solid', 
                            borderColor: 'primary.main',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'inherit',
                            fontSize: '0.875rem',
                            fontWeight: 400,
                            lineHeight: 1.6,
                            bgcolor: 'rgba(37, 99, 235, 0.05)',
                            p: 2,
                            borderRadius: 1
                          }}
                        >
                          {remainingContent}
                        </Typography>
                      );
                    }
                    return null;
                  })()}
                </>
              ) : (
                /* Regular handling for non-Step types */
                <>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
                    <Chip
                      icon={React.cloneElement(thought.icon as React.ReactElement)}
                      label={thought.label}
                      color={thought.color as any}
                      size="small"
                      sx={{ 
                        mr: 1, 
                        mb: 1,
                        position: 'relative',
                        zIndex: 2,
                        '& .MuiChip-label': {
                          fontSize: '0.875rem',
                          fontWeight: 500
                        }
                      }}
                    />
                    
                    {isCollapsible && (
                      <IconButton 
                        size="small" 
                        onClick={() => toggleExpand(index)}
                        sx={{ ml: 1, p: 0.5 }}
                      >
                        {expandedStates[index] ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                    )}
                  </Box>
                  
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      ml: 1, 
                      pl: 2, 
                      borderLeft: '2px solid', 
                      borderColor: 'divider',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      fontSize: '0.875rem',
                      fontWeight: 400,
                      lineHeight: 1.6,
                      // Add a fade effect for temporary thoughts
                      opacity: thought.isTemporary ? 0.8 : 1,
                      fontStyle: thought.isTemporary ? 'italic' : 'normal'
                    }}
                  >
                    {getDisplayContent(thought, index)}
                    {thought.isTemporary && thought.label !== 'Processing' && (
                      <Box component="span" sx={{ display: 'inline-block', ml: 1, animation: `${pulse} 1.5s infinite ease-in-out` }}>
                        ...
                      </Box>
                    )}
                  </Typography>
                </>
              )}
            </Box>
          );
        })}
      </Paper>
    </Box>
  );
};

export default ReActProcessor; 