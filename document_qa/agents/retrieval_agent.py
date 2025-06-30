"""
Retrieval agent for document retrieval operations
"""

from typing import Dict, Optional

from langchain.llms.base import BaseLLM

from document_qa.agents.base_agent import BaseAgent
from document_qa.core.state import DocumentQAState
from document_qa.core.document_manager import DocumentManager
from document_qa.utils.task_utils import context_retriever

class RetrievalAgent(BaseAgent):
    """Handles document retrieval operations."""
    
    def __init__(self, state: DocumentQAState, doc_manager: DocumentManager, llm: Optional[BaseLLM] = None):
        """
        Initialize the retrieval agent.
        
        Args:
            state: The shared state object
            doc_manager: Document manager for retrieval operations
            llm: Optional language model
        """
        super().__init__(state, llm)
        self.doc_manager = doc_manager
    
    def execute(self, step_info: Dict, doc_mode: str = "paths", retrieval_mode: str = "llm") -> str:
        """
        Retrieve relevant document contexts for a step.
        
        Args:
            step_info: Information about the current step
            doc_mode: Mode for document reference - "paths" or "contents"
            retrieval_mode: Method for retrieval - "llm" or "vector"
            
        Returns:
            String containing the retrieved context
        """
        return context_retriever(step_info, self.doc_manager, self.state, doc_mode, retrieval_mode) 