"""
Planner agent for decomposing complex queries into steps
"""

from typing import Dict, List, Optional

from langchain.llms.base import BaseLLM

from document_qa.agents.base_agent import BaseAgent
from document_qa.core.state import DocumentQAState
from document_qa.utils.task_utils import task_decomposer

class PlannerAgent(BaseAgent):
    """Responsible for decomposing user questions into subtasks."""
    
    def execute(self, query: str, documents: List[str] = None, doc_mode: str = "paths") -> Dict:
        """
        Decompose a complex query into executable steps.
        
        Args:
            query: The user's query to decompose
            documents: Optional list of documents available for the query
            doc_mode: str = "paths" or "contents"
            
        Returns:
            Dict containing decomposed steps
        """
        # self.add_thought(f"Analyzing the problem: \"{query}\" and breaking it down into executable steps.")
        return task_decomposer(query, self.llm, self.state, documents, doc_mode) 