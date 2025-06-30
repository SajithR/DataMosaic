"""
Simple decision tree implementation for document QA
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional

@dataclass
class DecisionNode:
    """Simple decision node for basic action selection."""
    state: Any
    parent: Optional['DecisionNode'] = None
    children: List['DecisionNode'] = field(default_factory=list)
    visits: int = 0
    value: float = 0.0
    
    def add_child(self, child_state: Any) -> 'DecisionNode':
        """Add a child node to this node."""
        child = DecisionNode(state=child_state, parent=self)
        self.children.append(child)
        return child
    
    def update(self, reward: float):
        """Update node statistics with a simple average."""
        self.visits += 1
        self.value = (self.value + reward) / 2  # Simple averaging instead of complex calculation 