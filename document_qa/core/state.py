"""
State management for the document QA system
"""

import logging
from typing import Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

class DocumentQAState:
    """Tracks the state of the thinking process and document operations."""
    
    def __init__(self, callback: Optional[Callable[[str, bool], None]] = None):
        """Initialize state with optional callback for real-time updates."""
        # Basic tracking
        self.steps: List[Dict] = []
        self.current_step: int = 1
        self.step_answers: Dict[int, str] = {}
        
        # Data storage
        self.retrieved_docs: Dict[int, str] = {}
        self.retrieved_context: Dict[int, str] = {}
        self.data_structure: Dict[int, str] = {}
        self.extracted_info: Dict[int, str] = {}
        self.verification_results: Dict[int, Dict] = {}
        
        # Simple thought tracking
        self.thoughts: List[Tuple[str, str]] = []  # (role, content)
        
        # Callback for real-time updates
        self.callback = callback
        
        # Prefixes for different roles
        self.role_prefixes = {
            "planner": "[THINKING]",
            "retriever": "[SEARCH]",
            "structure": "[THINKING]",
            "extractor": "[EXTRACT]",
            "verifier": "[VERIFY]",
            "refinement": "[THINKING]",
            "reasoner": "[REASON]",
            "synthesizer": "[THINKING]"
        }
    
    def add_thought(self, agent_type: str, thought: str, temporary: bool = False):
        """Record a thought from an agent with appropriate flag.
        
        Args:
            agent_type: The type of agent adding the thought
            thought: The thought content
            temporary: If True, this is a temporary status message that should be hidden when new messages arrive
        """
        flag_map = {
            "planner": "[THINKING]",
            "retriever": "[SEARCH]",
            "extractor": "[EXTRACT]",
            "verifier": "[VERIFY]",
            "decision": "[DECISION]",
            "refinement": "[REFINE]",
            "synthesizer": "[DECISION]",
            "reasoner": "[REASON]"
        }
        flag = flag_map.get(agent_type, "")
        thought_entry = f"{flag} {thought}"
        self.thoughts.append((agent_type, thought_entry))
        
        # Track if this thought is temporary
        if temporary:
            self.temporary_thoughts.append(thought_entry)
            
        # Stream the thought in real-time using the callback
        if self.callback:
            try:
                # Include a flag to indicate if this is a temporary thought
                self.callback(thought_entry, temporary=temporary)
            except Exception as e:
                logger.error(f"Error in callback: {str(e)}")
        else:
            # Default to printing if no callback provided  
            pass
    
    
    def add_temp_thought(self, thought: str):
        """Record a temporary thought."""
        self.add_thought("thinking", thought, temporary=True)
    
    def get_thought_trail(self) -> str:
        """Returns the full thought process trail."""
        return "\n".join([f"{role}: {thought}" for role, thought in self.thoughts])
    
    def add_step_answer(self, step_num: int, answer: str):
        """Store the answer for a specific step."""
        self.step_answers[step_num] = answer
        logger.info(f"Step {step_num} answer stored.")
    
    def get_dependent_answers(self, step_info: Dict) -> Dict[int, str]:
        """Get answers from steps this step depends on."""
        dependencies = step_info.get("depends_on_steps", [])
        dependent_answers = {}
        
        for dep_step in dependencies:
            if dep_step in self.step_answers:
                dependent_answers[dep_step] = self.step_answers[dep_step]
            else:
                logger.warning(f"Dependency on step {dep_step} requested but answer not found")
        
        return dependent_answers 