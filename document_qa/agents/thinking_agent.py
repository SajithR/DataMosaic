"""
Thinking agent that coordinates other agents using simple decision rules
"""

import math
import random
import re
import json
import numpy as np
from typing import Any, Dict, List, Optional, Tuple

from langchain.llms.base import BaseLLM

from document_qa.agents.base_agent import BaseAgent
from document_qa.agents.planner_agent import PlannerAgent
from document_qa.agents.retrieval_agent import RetrievalAgent
from document_qa.agents.data_structure_agent import DataStructureAgent
from document_qa.agents.extraction_agent import ExtractionAgent
from document_qa.agents.reasoning_agent import ReasoningAgent
from document_qa.core.state import DocumentQAState
from document_qa.core.document_manager import DocumentManager
from document_qa.utils.task_utils import (
    optimize_original_steps,
    information_verifier, 
    information_refiner,
    get_llm_response,
    extract_json_from_text
)
from document_qa.utils.mcts import DecisionNode

class ThinkingAgent(BaseAgent):
    """Core controller agent that coordinates all other agents using simple decision rules."""

    
    def __init__(self, state: DocumentQAState, doc_manager: DocumentManager, llm: Optional[BaseLLM] = None):
        super().__init__(state, llm)
        self.planner = PlannerAgent(state, llm)
        self.retriever = RetrievalAgent(state, doc_manager, llm)
        self.data_structure = DataStructureAgent(state, llm)
        self.extractor = ExtractionAgent(state, llm)
        self.reasoner = ReasoningAgent(state, llm)
        self.doc_manager = doc_manager
        self.verifier = None  # Will be initialized in execute
        self.refiner = None   # Will be initialized in execute
        self.result = None    # Store execution result
        
        # Simple decision parameters
        self.max_iterations = 5  # Reduced complexity
        
        # Define available actions and simple sequences
        self.possible_actions = ["retrieve", "structure", "extract", "verify", "refine", "reason", "replan"]
        # Simplified action transitions
        self.action_transitions = {
            "retrieve": ["structure"],
            "structure": ["extract"],
            "extract": ["verify"],
            "verify": ["reason"],  # Simplified: always go to reason after verify
            "refine": ["reason"],
            "reason": ["reason"],
            "replan": ["retrieve"]
        }
    
    def execute(self, query: str, documents: List[str] = None, doc_mode: str = "paths") -> Dict:
        """Execute the complete document QA workflow with simple decision rules."""
        
        # Initialize verifier and refiner
        self.verifier = lambda step_info: information_verifier(step_info, self.llm, self.state)
        self.refiner = lambda step_info: information_refiner(step_info, self.llm, self.state)

        
        # Initial planning - pass document_paths to the planner
        plan = self.planner.execute(query, documents=documents, doc_mode=doc_mode)
        
        # Optimize steps
        plan["steps"] = optimize_original_steps(plan["steps"])
        
        self.state.steps = plan["steps"]
        
        # Process each step in the plan
        step_idx = 0
        while step_idx < len(self.state.steps):

            step = self.state.steps[step_idx]
            self.state.current_step = step_idx + 1
            self.add_thought(f"**Step {step_idx + 1}: {step.get('description', '')}**")
            
            # Simple decision logic instead of complex ReAct framework
            current_action = "retrieve" if step.get("requires_document", False) else "reason"
            max_iterations = 10  # Reduced iterations
            iteration = 0
            
            while iteration < max_iterations:
                iteration += 1
                
                # Execute the current action
                result = self._execute_action(current_action, step, doc_mode=doc_mode)
                
                # Check if we need to break the loop
                if current_action == "reason" and not (result and isinstance(result, dict) and result.get("needs_more_info", False)):
                    break
                
                # Special handling for replan action
                if current_action == "replan":
                    if self.state.steps[step_idx]["requires_document"] == True:
                        current_action = "retrieve"
                    else:
                        current_action = "reason"
                
                # Use simple decision rules instead of complex MCTS
                next_action = self._simple_decision(step, current_action)
                if next_action:
                    current_action = next_action
            
            # Move to the next step only after finishing processing the current one
            step_idx += 1
        
        # The last step should now be the final synthesis step
        last_step = self.state.steps[-1]
        final_result = self.state.step_answers.get(last_step["step_number"], None)
        
        # If we don't have a result from the last step, use extracted info as fallback
        if not final_result:
            self.add_thought("The result of the last step is not available, using an alternative approach to generate the final answer...")
            last_step_idx = self.state.current_step
            final_result = self.reasoner.execute(
                step_info=last_step
            )
        
        # Store the result
        self.result = final_result
        
        return final_result
    
    def _update_search_keywords(self, step: Dict, feedback: Dict):
        """Update search keywords based on feedback."""
        if "refinement_suggestions" in feedback and feedback["refinement_suggestions"]:
            suggestions = feedback["refinement_suggestions"]
            self.add_thought(f"Update the retrieval keywords based on the feedback: {suggestions}")
            
            # Extract potential keywords from suggestions
            keywords = re.findall(r'\b\w+\b', suggestions)
            keywords = [k for k in keywords if len(k) > 3 and k.lower() not in 
                        ['this', 'that', 'there', 'should', 'would', 'could', 'about', 'which']]
            
            if keywords:
                # Add new keywords to the step
                if "search_keywords" not in step:
                    step["search_keywords"] = []
                step["search_keywords"].extend(keywords[:3])  # Add top 3 new keywords
                step["search_keywords"] = list(set(step["search_keywords"]))  # Remove duplicates
                self.add_thought(f"update the retrieval keywords: {', '.join(step['search_keywords'])}")
    
    def _simple_decision(self, step: Dict, current_action: str) -> Optional[str]:
        """Simple decision logic based on verify results."""
        
        # Get verification results
        step_idx = self.state.current_step
        verification_result = self.state.verification_results.get(step_idx, {})
        verification_passed = verification_result.get("verification_passed", False)
        
        # Simple decision logic
        if current_action == "verify":
            if verification_passed:
                return "reason"  # If verification passed, proceed to reasoning
            else:
                # If verification failed, check what to do next
                next_action = verification_result.get("next_action", "reason")
                if next_action == "search":
                    return "retrieve"
                elif next_action == "extract":
                    return "extract"
                else:
                    return "reason"
        
        elif current_action == "retrieve":
            return "structure"  # Normal flow
                
        elif current_action == "structure":
            return "extract"  # Normal flow
            
        elif current_action == "extract":
            return "verify"  # Normal flow
            
        elif current_action == "reason":
            return None  # End the loop
            
        elif current_action == "replan":
            return "retrieve"  # Normal flow after replan
        
        # Default fallback
        return "reason"
    
    def _execute_action(self, current_action: str, step: Dict, doc_mode: str = "paths"):
        """Execute a specific action for the current step."""
        
        step_idx = self.state.current_step
        
        if current_action == "retrieve":
            self.add_thought(f"Searching for relevant documents...")
            result = self.retriever.execute(step_info=step, doc_mode=doc_mode)
            
        elif current_action == "structure":
            self.add_thought(f"Analyzing document structure...")
            result = self.data_structure.execute(step_info=step)
            
        elif current_action == "extract":
            self.add_thought(f"Extracting information...")
            result = self.extractor.execute(step_info=step)
            
        elif current_action == "verify":
            self.add_thought(f"Verifying extracted information...")
            result = self.verifier(step)
            
        elif current_action == "refine":
            self.add_thought(f"Refining information...")
            result = self.refiner(step)
            
        elif current_action == "reason":
            self.add_thought(f"Reasoning and synthesizing answer...")
            result = self.reasoner.execute(step_info=step)
            self.state.step_answers[step_idx] = result
            
        elif current_action == "replan":
            self.add_thought(f"Replanning current step...")
            # Simple replan - just return None for now
            result = None
            
        else:
            self.add_thought(f"Unknown action: {current_action}")
            result = None
        
        return result
    
    def _optimize_step(self, step: Dict) -> Optional[Dict]:
        """Optimize sub-questions for a step."""
        step_idx = self.state.current_step
        step_description = step.get("description", "")
        
        
        # Get current context from state
        extracted_info = self.state.extracted_info.get(step_idx, "")
        retrieved_docs = self.state.retrieved_docs.get(step_idx, "")
        verification_result = self.state.verification_results.get(step_idx, {})
        
        extracted_text = extracted_info if extracted_info else "No information has been extracted yet."

        if retrieved_docs:
            if len(retrieved_docs) > 500:
                retrieved_text = retrieved_docs[:500] + "..."
            else:
                retrieved_text = retrieved_docs
        else:
            retrieved_text = "No documents have been retrieved yet."

        verification_text = json.dumps(verification_result, ensure_ascii=False, indent=2) if verification_result else "No verification has been performed yet."
        original_query = step["description"]

        prompt = f"""
        You are a task optimization expert, assisting in refining the current step to better answer the question.

        Main question: "{original_query}"

        Current step being processed: "{step_description}"

        Information we have already extracted:
        {extracted_text}

        Content we have retrieved from documents:
        {retrieved_text}

        Verification results:
        {verification_text}

        First, you should analyze whether the current step is effective. If it is valid but can be improved, try to:
        1. Improve the step description to make it clearer and more specific
        2. Optimize the search keywords to make them more targeted
        3. Adjust the reasoning process and dependencies of the step

        Only consider generating sub-questions if the current step cannot be optimized.

        Please return your optimization results in the following JSON format:

        {{
            "steps": [
                {{
                    "step_number": {step_idx},
                    "description": "Revised step description",
                    "requires_document": true/false,
                    "search_keywords": ["keyword1", "keyword2", ...],
                    "reasoning": "Justification for why this step needs to be optimized this way",
                }}
            ],
            "optimization_type": "refine_current_step" or "generate_sub_questions"
        }}

        If you choose to generate sub-questions, include 2 to 3 new sub-steps in the `steps` section that will help answer the main question.
        """
        # Get response from LLM
        response = get_llm_response(prompt, self.llm)
        
        # Process response to extract optimized steps
        try:
            result = extract_json_from_text(response)
            
            # Ensure proper formatting
            if result and "steps" in result and result["steps"]:
                optimized_steps = result["steps"]
                
                # Validate optimized steps
                for optimized_step in optimized_steps:
                    # Ensure the step has the essential fields
                    if "description" not in optimized_step:
                        return None
                    
                    # Copy over any existing attempt counters for tracking
                    for action in self.possible_actions:
                        if f"{action}_attempts" in step:
                            optimized_step[f"{action}_attempts"] = 0
                    
                    # Ensure requires_document is consistent with search_keywords
                    if "search_keywords" in optimized_step and optimized_step.get("search_keywords") and not optimized_step.get("requires_document", False):
                        optimized_step["requires_document"] = True
                
                # If we're refining the current step, return just the optimized step
                if result.get("optimization_type", "") == "refine_current_step" and len(optimized_steps) == 1:
                    self.add_thought(f"Optimizing current step: '{optimized_steps[0].get('description', '')}'")
                    return optimized_steps[0]
                
                # If we're generating sub-questions, handle the first one
                elif result.get("optimization_type", "") == "generate_sub_questions" and len(optimized_steps) > 1:
                    # Update the steps in the state and return the first sub-step
                    self.add_thought(f"Generating sub-questions to break down the current step, total {len(optimized_steps)} sub-steps")
                    
                    # Get the current step number
                    step_num = step.get("step_number", 0)
                    
                    # Update step numbers to ensure they're sequential
                    for i, sub_step in enumerate(optimized_steps):
                        sub_step["step_number"] = step_num + i
                    
                    # Find the current step in the steps list and replace it with all sub-steps
                    for i, s in enumerate(self.state.steps):
                        if s.get("step_number", 0) == step_num:
                            self.state.steps = self.state.steps[:i] + optimized_steps + self.state.steps[i+1:]
                            break
                    
                    # Return the first sub-step
                    return optimized_steps[0]
            
        except Exception as e:
            self.add_thought(f"Error occurred while optimizing steps: {str(e)}")
        
        # If optimization failed, just return a copy of the original step with reset attempt counters
        optimized_step = step.copy()
        for action in self.possible_actions:
            if f"{action}_attempts" in optimized_step:
                optimized_step[f"{action}_attempts"] = 0
        
        return optimized_step 