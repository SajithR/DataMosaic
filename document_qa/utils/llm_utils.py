"""
LLM utilities for the document QA system
"""

import re
import json
import logging
from typing import Dict, List, Optional

# Importing llm_main from the expected location
# Note: we assume this module exists in the environment
import llm.main as llm_main
from langchain.llms.base import BaseLLM

logger = logging.getLogger(__name__)

def get_llm_response(prompt: str, model: str = None, history: List = None) -> str:
    """Get response from LLM using llm_main module."""
    # Use global config if model is not specified
    if model is None:
        try:
            import sys
            import os
            sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'llm'))
            from global_config import get_model
            model = get_model()
        except ImportError:
            model = "qwen2-72b-instruct"  # fallback
    
    response = llm_main.get_answer(prompt, history=history, model=model)
    return response

def extract_json_from_text(text: str) -> Dict:
    """Extract JSON object from text string.
    
    Handles cases where the JSON might be embedded within markdown or other text.
    """
    # Try to find JSON-like pattern in the text
    json_pattern = r'({[\s\S]*})'
    match = re.search(json_pattern, text)
    
    if match:
        json_str = match.group(1)
        try:
            # Try parsing the extracted JSON string
            return json.loads(json_str)
        except json.JSONDecodeError:
            # If parsing fails, try to clean the string
            # Remove triple backticks that might be part of markdown
            json_str = re.sub(r'```json|```', '', json_str).strip()
            try:
                return json.loads(json_str)
            except:
                pass
    
    # As a fallback, look for anything that might be a dictionary-like structure
    try:
        # Replace single quotes with double quotes for JSON compatibility
        text = text.replace("'", '"')
        # Try to find dictionary-like pattern
        dict_pattern = r'({[^{}]*})'
        matches = re.findall(dict_pattern, text)
        for potential_json in matches:
            try:
                return json.loads(potential_json)
            except:
                continue
    except:
        pass
    
    # If all parsing attempts fail, return an empty dict
    return {} 