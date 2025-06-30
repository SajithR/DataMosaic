"""
Base agent for document question answering
"""

from abc import ABC, abstractmethod
from typing import Optional

from langchain.llms.base import BaseLLM
from document_qa.core.state import DocumentQAState

class BaseAgent(ABC):
    """Abstract base class for all document QA agents."""
    
    def __init__(self, state: DocumentQAState, llm: Optional[BaseLLM] = None):
        """Initialize the agent with state and language model.
        
        Args:
            state: The shared state for all agents
            llm: Optional language model to use for this agent
        """
        self.state = state
        self.llm = llm
    
    @abstractmethod
    def execute(self, *args, **kwargs):
        """Execute the agent's core functionality. Must be implemented by subclasses."""
        pass
    
    def add_thought(self, thought: str):
        """Add a thought to the state's thought trail, with the agent type derived from class name."""
        self.state.add_thought(self.__class__.__name__.lower(), thought)
        
    def add_temp_thought(self, thought: str):
        """Add a temporary thought (like "retrieving", "extracting", "analyzing") that will be hidden when the next message arrives.
        
        Args:
            thought: The temporary thought/status to display
        """
        # Add a special marker [TEMP:] at the beginning of temporary thoughts
        marked_thought = f"[TEMP:] {thought}"
        self.state.add_thought(self.__class__.__name__.lower(), marked_thought, temporary=True) 