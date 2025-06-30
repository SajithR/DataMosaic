"""
Reasoning agent for performing reasoning and information integration
"""

from typing import Dict, Optional

from langchain.llms.base import BaseLLM

from document_qa.agents.base_agent import BaseAgent
from document_qa.core.state import DocumentQAState
from document_qa.utils.task_utils import answer_synthesizer
from document_qa.utils.llm_utils import get_llm_response


def detect_language(text: str) -> str:
    """Detect if the text is primarily in Chinese or English.
    
    Args:
        text: Input text to analyze
        
    Returns:
        'chinese' if Chinese characters are detected, 'english' otherwise
    """
    # Count Chinese characters
    chinese_chars = sum(1 for char in text if '\u4e00' <= char <= '\u9fff')
    # If more than 10% of characters are Chinese, consider it Chinese
    if len(text) > 0 and chinese_chars / len(text) > 0.1:
        return 'chinese'
    return 'english'

def get_language_instruction(query: str) -> str:
    """Get language-specific instruction for prompts based on query language.
    
    Args:
        query: The user query
        
    Returns:
        Language instruction string to be added to prompts
    """
    lang = detect_language(query)
    if lang == 'chinese':
        return "\n\n**Important: Since the user query is in Chinese, please ensure your response is also in Chinese.**"
    else:
        return "\n\n**Important: Please ensure your response is in English.**"


class ReasoningAgent(BaseAgent):
    """Performs reasoning and information integration."""


    
    def execute(self, step_info: Dict = None) -> str:
        """
        Perform reasoning for a specific step, considering dependencies.
        
        Args:
            step_info: The step information including dependencies
            
        Returns:
            String containing the reasoning result
        """
        step_num = step_info.get("step_number", 1) if step_info else 1
        query = step_info.get("description", "") if step_info else ""
        
        # Get answers from dependent steps if available
        dependent_answers = {}
        if step_info and "depends_on_steps" in step_info:
            dependent_answers = self.state.get_dependent_answers(step_info)
            if dependent_answers:
                self.add_thought(f"Consider the results of step(s) {', '.join(map(str, step_info['depends_on_steps']))} as the basis for this step.")
        
        # If this is synthesizing a final answer across steps, use the standard method
        if not step_info:
            return answer_synthesizer(query, self.llm, self.state)
        
        # Otherwise, reason based on this specific step's information
        # self.add_thought(f"Starting reasoning based on extracted information for step {step_num}")
        
        # Extract current step information
        step_description = step_info.get("description", "")
        
        extracted_content = f"EXTRACTED INFORMATION:\n{self.state.extracted_info.get(step_num, 'No information extracted')}"
        
        language_instruction = get_language_instruction(step_description)
        
        # Create a prompt that includes dependent step information
        dependencies_text = ""
        if dependent_answers:
            dependencies_text = "INFORMATION FROM DEPENDENT STEPS:\n"
            for dep_step, answer in dependent_answers.items():
                step_desc = next((s.get("description", f"Step {dep_step}") for s in self.state.steps if s.get("step_number") == dep_step), f"Step {dep_step}")
                dependencies_text += f"Step {dep_step} ({step_desc}): {answer}\n\n"
        
        prompt = f"""Reason about the following information to address this specific step:
        
        STEP DESCRIPTION: {step_description}
        
        {extracted_content}
        
        {dependencies_text}
        
        Based on this information, provide a clear, well-reasoned answer that addresses the step description. 
        Focus specifically on what this step is asking for, while incorporating any relevant information from dependent steps.
        Also, the answer should be concise and to the point.
        
        {language_instruction}
        
        ANSWER:
        """
        
        
        
        step_answer = get_llm_response(prompt)
        # Store this step's answer for potential future use
        self.state.add_step_answer(step_num, step_answer)

        self.add_thought(step_answer)
        
        return step_answer 