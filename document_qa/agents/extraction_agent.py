"""
Extraction agent for extracting information from documents
"""

from typing import Dict, Optional

from langchain.llms.base import BaseLLM

from document_qa.agents.base_agent import BaseAgent
from document_qa.core.state import DocumentQAState
from document_qa.utils.task_utils import information_extractor

class ExtractionAgent(BaseAgent):
    """Extracts relevant information from retrieved documents."""
    
    def execute(self, step_info: Dict) -> str:
        """
        Extract information from retrieved documents based on step information.
        
        Args:
            step_info: Information about the current step
            
        Returns:
            String containing the extracted information
        """
        return information_extractor(step_info, self.llm, self.state) 