"""
Data structure agent for organizing extracted information
"""

from typing import Dict, Optional

from langchain.llms.base import BaseLLM

from document_qa.agents.base_agent import BaseAgent
from document_qa.core.state import DocumentQAState
from document_qa.utils.task_utils import data_structure_selector

class DataStructureAgent(BaseAgent):
    """Manages data structures for organizing information."""
    
    def execute(self, step_info: Dict) -> Dict:
        """
        Select appropriate data structure for organizing information in a step.
        
        Args:
            step_info: Information about the current step
            
        Returns:
            Dictionary representing the selected data structure
        """
        return data_structure_selector(step_info, self.llm, self.state) 