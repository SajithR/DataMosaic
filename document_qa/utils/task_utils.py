"""
Task utilities for document QA system
"""

import os
import re
import json
import logging
from typing import Dict, List, Optional

from langchain.llms.base import BaseLLM

from document_qa.core.state import DocumentQAState
from document_qa.core.document_manager import DocumentManager
from document_qa.utils.llm_utils import get_llm_response, extract_json_from_text

logger = logging.getLogger(__name__)

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

def task_decomposer(query: str, llm: Optional[BaseLLM], state: DocumentQAState, documents: List[str] = None, doc_mode: str = "paths", retrieval_mode: str = "llm") -> Dict:
    """Decomposes a complex query into a series of executable steps with requirements.
    
    Args:
        query: The user query
        llm: Language model
        state: Shared state
        documents: List of document references (paths or contents)
        doc_mode: Mode for document reference - "paths" or "contents"
        retrieval_mode: Method for retrieval - "llm" or "vector"
        
    Returns:
        Dict containing decomposed steps
    """
    
    # Include information about available documents
    document_info = ""
    doc_content = ""

    if doc_mode == "paths":
        if documents and len(documents) > 0:
            document_info = f"\nAvailable documents: {', '.join([os.path.basename(path) for path in documents])}"
    elif doc_mode == "contents":
        if documents and len(documents) > 0:
            document_info = ""
        try:
            doc_content = "DOCUMENT CONTENT: " + documents[0]
        except:
            doc_content = ""
                    
        
    language_instruction = get_language_instruction(query)
    
    prompt = f"""
    Break down this query into simple steps:
    
    QUERY: "{query}"{document_info}

    {doc_content}
    
    For each step:
    1. Description of what to do
    2. Whether documents are needed (true/false)
    3. Search keywords if needed
    4. Any dependencies

    Keep it simple - use as few steps as possible.
    
    Output in JSON format:
    {{
        "steps": [
            {{
                "step_number": 1,
                "description": "...",
                "requires_document": true/false,
                "search_keywords": ["keyword1", "keyword2"],
                "reasoning": "...",
                "depends_on_steps": []
            }}
        ]
    }}{language_instruction}
    """
    
    try:
        response = get_llm_response(prompt)
        result = extract_json_from_text(response)
        
        # Ensure result has the expected structure
        if not isinstance(result, dict) or "steps" not in result:
            state.add_thought("planner", "Task decomposition failed. Using simple plan.")
            # Fallback to a simple plan
            result = {
                "steps": [
                    {
                        "step_number": 1,
                        "description": f"Find information about: {query}",
                        "requires_document": True,
                        "search_keywords": query.split(),
                        "reasoning": "Need to search for relevant information.",
                        "depends_on_steps": []
                    },
                    {
                        "step_number": 2,
                        "description": f"Provide answer based on found information",
                        "requires_document": False,
                        "reasoning": "Need to synthesize the answer.",
                        "depends_on_steps": [1]
                    }
                ]
            }
        
        # Add document_paths to each step if available
        if doc_mode == "paths":
            if documents:
                for step in result["steps"]:
                    if step.get("requires_document", False):
                        step["document_paths"] = documents
                        step["retrieval_mode"] = retrieval_mode
        elif doc_mode == "contents":
            if documents:
                for step in result["steps"]:
                    if step.get("requires_document", False):
                        step["document_contents"] = documents
                        step["retrieval_mode"] = retrieval_mode
        
        # Simple dependency validation
        for step in result["steps"]:
            step_num = step.get("step_number", 0)
            if "depends_on_steps" in step:
                step["depends_on_steps"] = [dep for dep in step["depends_on_steps"] if dep < step_num]
        
        return result
    
    except Exception as e:
        state.add_thought("planner", f"Error in task decomposition: {str(e)}. Using simple plan.")
        # Simple fallback plan
        fallback = {
            "steps": [
                {
                    "step_number": 1,
                    "description": f"Search for information about: {query}",
                    "requires_document": True,
                    "search_keywords": query.split(),
                    "reasoning": "Need to search for relevant information.",
                    "depends_on_steps": []
                },
                {
                    "step_number": 2,
                    "description": f"Provide answer based on found information",
                    "requires_document": False,
                    "reasoning": "Need to synthesize the answer.",
                    "depends_on_steps": [1]
                }
            ]
        }
        
        # Add document_paths to steps if available
        if documents:
            for step in fallback["steps"]:
                if step.get("requires_document", False):
                    if doc_mode == "paths":
                        step["document_paths"] = documents
                        step["retrieval_mode"] = retrieval_mode
                    elif doc_mode == "contents":
                        step["document_contents"] = documents
                        step["retrieval_mode"] = retrieval_mode
        
        return fallback

def optimize_original_steps(steps: List[Dict]) -> List[Dict]:
    """Optimize the steps from the planner by ensuring proper step numbering and dependencies."""
    # Ensure step numbers are sequential and start from 1
    for i, step in enumerate(steps, start=1):
        step["step_number"] = i
    
    # Ensure dependencies reference valid previous steps
    for step in steps:
        step_num = step.get("step_number", 0)
        if "depends_on_steps" in step:
            # Filter out any dependency on steps with higher or equal numbers
            step["depends_on_steps"] = [dep for dep in step["depends_on_steps"] if dep < step_num]
    
    # For the last step, ensure it depends on at least one previous step
    if len(steps) > 1:
        last_step = steps[-1]
        if not last_step.get("depends_on_steps", []):
            # Set dependency on all or most relevant previous steps
            all_prev_steps = list(range(1, last_step["step_number"]))
            last_step["depends_on_steps"] = all_prev_steps
    
    return steps

def data_structure_selector(step_info: Dict, llm: Optional[BaseLLM], state: DocumentQAState) -> str:
    question = step_info.get("description", "")
    step_num = step_info.get("step_number", state.current_step)
    
    language_instruction = get_language_instruction(question)

    structures = ["Text Description", "Tree", "Table", "Graph"]
    prompt = f"""Choose the best data structure for this question:

Question: {question}

Options: {', '.join(structures)}

Answer format: {{answer: [structure_name]}}{language_instruction}"""

    ans = get_llm_response(prompt)

    ds = None
    match = re.match(r'\{answer:\s*([a-zA-Z\s]+)\}', ans)
    
    if match:
        ds = match.group(1).strip()

    state.data_structure[step_num] = ds
    state.add_thought("structure",f"Selected structure: {ds}")
    return ds

def count_content_length(text):
    # Count Chinese characters (assuming Chinese characters are in Unicode ranges)
    chinese_chars = sum(1 for char in text if '\u4e00' <= char <= '\u9fff')
    
    # For non-Chinese parts, count words (splitting by whitespace)
    non_chinese_text = ''.join(' ' if '\u4e00' <= char <= '\u9fff' else char for char in text)
    english_words = len(non_chinese_text.split())
    
    return english_words, chinese_chars

def context_retriever(step_info: Dict, doc_manager: DocumentManager, state: DocumentQAState, doc_mode: str = "paths", retrieval_mode: str = "llm") -> str:
    """Retrieves relevant document contexts based on step requirements.
    
    Args:
        step_info: Information about the current step
        doc_manager: Document manager for retrieval operations
        state: The shared state object
        doc_mode: Mode for document reference - "paths" or "contents"
        retrieval_mode: Method for retrieval - always "llm" now
        
    Returns:
        String containing the retrieved context
    """
    
    step_num = step_info.get("step_number", state.current_step)
    
    if not step_info.get("requires_document", False):
        state.add_thought("retriever", f"Step {step_num} does not require document retrieval.")
        return "Document retrieval not needed for this step."
    
    keywords = step_info.get("search_keywords", [])
    description = step_info.get("description", "")
    
    if not keywords and not description:
        return "No search keywords available."
    
    # Get document paths or contents from step_info, if available
    if doc_mode == "paths":
        documents = step_info.get("document_paths", None)
    elif doc_mode == "contents":
        documents = step_info.get("document_contents", None)
    
    # Build simple search query
    if keywords:
        search_query = f"{description} {' '.join(keywords)}"
    else:
        search_query = description
    
    state.add_thought("retriever", f"Searching for: \"{search_query}\"")

    # Simple document retrieval
    if doc_mode == "contents":
        # Use document contents directly
        if "retrieve_attempts" in step_info and step_info["retrieve_attempts"] < 2:
            retrieve_content = documents[0]
        else:
            retrieve_content = documents[1] if len(documents) > 1 else documents[0]
        
        # Get counts
        english_words, chinese_chars = count_content_length(retrieve_content)
        
        # Check if content exceeds limits
        if english_words + chinese_chars <= 50000:
            result = retrieve_content
            state.retrieved_docs[step_num] = result
            state.retrieved_context[step_num] = result
            return result
        
        # If content is too long, extract relevant parts
        language_instruction = get_language_instruction(search_query)
        
        retrieve_prompt = f"""Find relevant content for this question:

Question: {search_query}

Document: {retrieve_content}

Return only the most relevant parts.{language_instruction}"""
        
        result = get_llm_response(retrieve_prompt, model="qwen-long")
    
    elif doc_mode == "paths":
        # For path mode, load document contents
        loaded_contents = []
        for doc_path in documents:
            try:
                content = doc_manager.load_document_content(doc_path)
                loaded_contents.append(f"Content from {doc_path}:\n{content}")
            except Exception as e:
                state.add_thought("retriever", f"Error loading document {doc_path}: {str(e)}")
        
        if not loaded_contents:
            return "Could not load document contents."
        
        # Combine all loaded contents
        combined_content = "\n\n".join(loaded_contents)
        
        # Simple content extraction
        language_instruction = get_language_instruction(search_query)
        
        retrieve_prompt = f"""Find relevant content for this question:

Question: {search_query}

Documents: {combined_content}

Return the most relevant parts.{language_instruction}"""
        
        result = get_llm_response(retrieve_prompt, model="qwen-long")
    
    else:
        return "Simple retrieval mode only."
    
    state.retrieved_docs[step_num] = result
    state.retrieved_context[step_num] = result

    state.add_thought("retriever", result)
    
    return result

def information_extractor(step_info: Dict, llm: Optional[BaseLLM], state: DocumentQAState) -> str:
    """Extracts relevant information from retrieved documents for the current step."""
    
    step_num = step_info.get("step_number", state.current_step)

    structure = state.data_structure.get(step_num, "Text Description")
    docs = state.retrieved_docs.get(step_num, "")
    
    if not docs or docs == "Document retrieval not needed for this step.":
        state.add_thought("extractor", f"Step {step_num} has no document content available for extraction.")
        return "No document content available for extraction."
    
    # Simple extraction prompt based on structure type
    if structure == "Graph":
        prompt = f"""Extract relationships from the document:

Task: {step_info['description']}

Document: {docs}

Format relationships as: (Subject, Relation, Object)

<Graph START>
(entity1, relation, entity2)
(entity2, relation, entity3)
<Graph END>
"""
    elif structure == "Tree":
        prompt = f"""Extract hierarchical information from the document:

Task: {step_info['description']}

Document: {docs}

Format as hierarchical relationships:

<Tree START>
(Parent, has_child, Child)
<Tree END>
"""
    elif structure == "Table":
        prompt = f"""Extract information and organize as a table:

Task: {step_info['description']}

Document: {docs}

Return structured data in table format.
"""
    else:  # Text Description
        prompt = f"""Extract relevant information for this task:

Task: {step_info['description']}

Document: {docs}

Extract the key information that answers the task.
"""
    
    extracted_info = get_llm_response(prompt, model="gpt-4o-mini")
    
    # Simple marker enforcement for structured data
    if structure == "Graph":
        extracted_info = enforce_graph_markers(extracted_info)
    elif structure == "Tree":
        extracted_info = enforce_tree_markers(extracted_info)
    
    state.extracted_info[step_num] = extracted_info

    state.add_thought("extractor", extracted_info)
    
    return extracted_info

def information_verifier(step_info: Dict, llm: Optional[BaseLLM], state: DocumentQAState) -> Dict:
    """Simple verification of extracted information."""
    
    step_num = step_info.get("step_number", state.current_step)
    extracted_info = state.extracted_info.get(step_num, "")
    
    if not extracted_info:
        state.add_thought("verifier", f"No extracted information to verify for step {step_num}")
        return {
            "verification_passed": False,
            "completeness": 0,
            "relevance": 0,
            "accuracy": 0,
            "needs_refinement": True,
            "next_action": "search",
            "refinement_suggestions": "No information was extracted. Try different search keywords."
        }
    
    # Simple LLM-based verification
    prompt = f"""Evaluate this extracted information:

Task: {step_info.get('description', '')}
Extracted Info: {extracted_info}

Is this information adequate for the task? (Yes/No)
Should we search for more documents? (Yes/No)
Should we re-extract from current documents? (Yes/No)

Answer briefly."""
    
    response = get_llm_response(prompt)
    
    # Simple response parsing
    is_adequate = 'yes' in response.lower().split('\n')[0] if response else False
    need_search = 'yes' in response.lower().split('\n')[1] if len(response.split('\n')) > 1 else False
    need_reextract = 'yes' in response.lower().split('\n')[2] if len(response.split('\n')) > 2 else False
    
    # Determine next action based on LLM response
    if is_adequate:
        next_action = "continue"
    elif need_search:
        next_action = "search"
    elif need_reextract:
        next_action = "extract"
    else:
        next_action = "continue"
    
    verification_result = {
        "verification_passed": is_adequate,
        "completeness": 4 if is_adequate else 2,
        "relevance": 4 if is_adequate else 2,
        "accuracy": 4 if is_adequate else 2,
        "needs_refinement": not is_adequate,
        "issue_source": "extraction" if need_reextract else ("retrieval" if need_search else "none"),
        "next_action": next_action,
        "refinement_suggestions": "Try different approach" if not is_adequate else ""
    }

    state.verification_results[step_num] = verification_result
    
    # Add thought based on verification result
    if verification_result.get("verification_passed", False):
        state.add_thought("verifier", f"Information verification passed, continue analysis")
    else:
        state.add_thought("verifier", f"Step {step_num} information verification failed. {verification_result.get('refinement_suggestions', '')}")
    
    return verification_result

def information_refiner(step_info: Dict, llm: Optional[BaseLLM], state: DocumentQAState) -> str:
    """Refines extracted information based on verification feedback."""
    
    step_num = step_info.get("step_number", state.current_step)
    extracted_info = state.extracted_info.get(step_num, "")
    verification = state.verification_results.get(step_num, {})
    docs = state.retrieved_docs.get(step_num, "")
    
    if not verification.get("needs_refinement", False):
        return extracted_info
    
    state.add_thought("refinement", f"Refining step {step_num} information...")
    
    # Simple refinement prompt
    language_instruction = get_language_instruction(step_info.get("description", ""))
    
    # Check structure type for special formatting
    structure = state.data_structure.get(step_num, "Text Description")
    format_instruction = ""
    if structure == "Graph":
        format_instruction = "\nFormat as: <Graph START>\n(subject, relation, object)\n<Graph END>"
    elif structure == "Tree":
        format_instruction = "\nFormat as: <Tree START>\n(parent, has_child, child)\n<Tree END>"
    
    prompt = f"""Improve this extracted information:

Task: {step_info['description']}

Current extraction: {extracted_info}

Document: {docs}

Please provide better, more complete information.{format_instruction}{language_instruction}"""
    
    state.add_thought("refinement", "Reanalyzing document content...")
    refined_info = get_llm_response(prompt)
    
    # Simple marker enforcement for structured data
    if state.data_structure.get(step_num) == "Graph":
        refined_info = enforce_graph_markers(refined_info)
    elif state.data_structure.get(step_num) == "Tree":
        refined_info = enforce_tree_markers(refined_info)
    
    state.extracted_info[step_num] = refined_info
    state.add_thought("extractor", refined_info)
    state.add_thought("refinement", f"Step {step_num} information has been refined.")
    return refined_info

def answer_synthesizer(query: str, llm: Optional[BaseLLM], state: DocumentQAState) -> Dict:
    """Synthesizes a final answer from all the extracted and verified information."""
    
    # Compile all verified information
    state.add_thought("synthesizer", "Synthesizing final answer...")
    
    step_results = []
    for step in state.steps:
        step_num = step.get("step_number", 0)
        description = step.get("description", "")
        
        # Try to get the step answer first
        step_answer = state.step_answers.get(step_num, None)
        
        # If no step answer, fall back to extracted info
        if not step_answer:
            step_answer = state.extracted_info.get(step_num, "No information extracted")
        
        step_results.append(f"STEP {step_num}: {description}\n{step_answer}")
    
    all_extracted_info = "\n\n".join(step_results)
    
    # Get the thought trail
    thought_trail = state.get_thought_trail()
    
    state.add_thought("synthesizer", "Creating comprehensive answer...")
    
    # Simple synthesis prompt
    language_instruction = get_language_instruction(query)
    
    prompt = f"""Create a comprehensive answer to this query:

QUERY: {query}

INFORMATION GATHERED:
{all_extracted_info}

Provide a clear, well-organized response that directly answers the query.

For graph data, use: <Graph START> ... <Graph END>
For tree data, use: <Tree START> ... <Tree END>
For table data, use: <Table START> ... <Table END>{language_instruction}"""
    
    final_answer = get_llm_response(prompt)
    
    # Simple post-processing for graph markers
    final_answer = ensure_graph_markers(final_answer)
    
    result = {
        "query": query,
        "final_answer": final_answer,
        "step_answers": {step["step_number"]: state.step_answers.get(step["step_number"], 
                                         state.extracted_info.get(step["step_number"], ""))
                    for step in state.steps},
        "thought_process": thought_trail
    }
    
    return result

def enforce_graph_markers(content: str) -> str:
    """Force ensure Graph content is properly surrounded by markers for information extraction stage."""
    
    # If there are already correct markers, check if markers are complete and content is valid
    if '<Graph START>' in content and '<Graph END>' in content:
        # Ensure marker format is correct
        start_pos = content.find('<Graph START>')
        end_pos = content.find('<Graph END>')
        if start_pos < end_pos:
            # Check if Graph content is valid (not empty or default invalid content)
            graph_content = content[start_pos + len('<Graph START>'):end_pos].strip()
            if graph_content and not ('not found' in graph_content and 'triplet' in graph_content and 'data' in graph_content):
                return content  # Markers are correct and content is valid
            # If content is invalid, continue processing to try to extract valid content
    
    # Detect various possible triplet patterns
    triplet_patterns = [
        r'\([^)]+,\s*has_child,\s*[^)]+\)',        # (Parent, has_child, Child)
        r'\([^)]+,\s*collaborates_with,\s*[^)]+\)', # (Person, collaborates_with, Person)
        r'\([^)]+,\s*contains,\s*[^)]+\)',         # (Container, contains, Item)
        r'\([^)]+,\s*includes,\s*[^)]+\)',         # (Group, includes, Member)
        r'\([^,)]+,\s*[^,)]+,\s*[^)]+\)',          # Basic triplet format (A, B, C)
    ]
    
    # Find all triplets
    triplets = []
    for pattern in triplet_patterns:
        matches = re.findall(pattern, content, re.MULTILINE)
        # Filter out invalid placeholder triplets
        valid_matches = [match for match in matches if not ('not found' in match and 'triplet' in match and 'data' in match)]
        triplets.extend(valid_matches)
    
    # Also detect triplet formats in ``` code blocks
    code_block_patterns = [
        r'```\s*\n([^`]+)\n```',  # Standard code block
        r'```([^`]+)```',  # Compact code block
    ]
    
    for code_pattern in code_block_patterns:
        code_matches = re.findall(code_pattern, content, re.DOTALL)
        for code_content in code_matches:
            # Check if code block contains relational expressions
            if ' - ' in code_content and ('_with' in code_content or 'collaborated' in code_content):
                # Convert to standard triplet format
                lines = code_content.strip().split('\n')
                for line in lines:
                    if ' - ' in line:
                        parts = [p.strip() for p in line.split(' - ')]
                        if len(parts) == 3:
                            # Clean up number prefixes
                            subject = re.sub(r'^\d+\.\s*', '', parts[0])
                            predicate = parts[1]
                            obj = re.sub(r'^\d+\.\s*', '', parts[2])
                            
                            triplet = f"({subject}, {predicate}, {obj})"
                            triplets.append(triplet)
    
    # Specifically detect single-line relational expressions (not in code blocks)
    single_line_pattern = r'^([^-\n]+)\s*-\s*([^-\n]+)\s*-\s*([^-\n]+)$'
    lines = content.split('\n')
    for line in lines:
        line = line.strip()
        if ' - ' in line and ('_with' in line or 'collaborated' in line or 'cooperation' in line):
            match = re.match(single_line_pattern, line)
            if match:
                # Clean up number prefixes and extra spaces
                subject = re.sub(r'^\d+\.\s*', '', match.group(1).strip())
                predicate = match.group(2).strip()
                obj = re.sub(r'^\d+\.\s*', '', match.group(3).strip())
                
                triplet = f"({subject}, {predicate}, {obj})"
                triplets.append(triplet)
    
    # If triplets are found, create correct format output
    if triplets:
        # Remove duplicates
        unique_triplets = list(set(triplets))
        
        # Retain original explanatory text (remove triplets and code blocks)
        explanation_text = content
    
    # Remove identified triplets
        for triplet in triplets:
            explanation_text = explanation_text.replace(triplet, '')
            
        # Remove code blocks
        explanation_text = re.sub(r'```[^`]*```', '', explanation_text, flags=re.DOTALL)
        
        # Remove existing Graph marker content
        explanation_text = re.sub(r'<Graph START>.*?<Graph END>', '', explanation_text, flags=re.DOTALL)
        
        # Remove single-line relational expressions to avoid duplication
        for line in content.split('\n'):
            line = line.strip()
            if ' - ' in line and ('_with' in line or 'collaborated' in line or 'cooperation' in line):
                explanation_text = explanation_text.replace(line, '')
        
            # Clean up extra blank lines and punctuation
            explanation_text = re.sub(r'\n\s*\n+', '\n\n', explanation_text).strip()
            explanation_text = re.sub(r'[,，]\s*$', '', explanation_text, flags=re.MULTILINE)
            
            # Build output with markers
        if explanation_text:
            marked_content = f"{explanation_text}\n\n<Graph START>\n"
        else:
            marked_content = "<Graph START>\n"
        
        for triplet in unique_triplets:
            marked_content += f"{triplet}\n"
            marked_content += "<Graph END>"
            
            return marked_content
    
    # If no triplets found, check for other formats of relational expressions
    relation_patterns = [
        r'([^-\n]+)\s*-\s*([^-\n]+)\s*-\s*([^-\n]+)',  # A - B - C format
        r'([^：]+)：([^，]+)，([^。]+)',  # Chinese format
    ]
    
    found_relations = []
    for pattern in relation_patterns:
        matches = re.findall(pattern, content, re.MULTILINE)
        for match in matches:
            if len(match) == 3:
                # Clean up number prefixes and extra spaces
                subject = re.sub(r'^\d+\.\s*', '', match[0].strip())  # Remove number prefix
                predicate = match[1].strip()
                obj = re.sub(r'^\d+\.\s*', '', match[2].strip())  # Remove number prefix
                
                triplet = f"({subject}, {predicate}, {obj})"
                found_relations.append(triplet)
    
    if found_relations:
        # Retain original explanatory text
        explanation_text = re.sub(r'([^-\n]+)\s*-\s*([^-\n]+)\s*-\s*([^-\n]+)', '', content)
        explanation_text = re.sub(r'\n\s*\n+', '\n\n', explanation_text).strip()
        
        if explanation_text:
            marked_content = f"{explanation_text}\n\n<Graph START>\n"
        else:
            marked_content = "<Graph START>\n"
        
        for relation in found_relations:
            marked_content += f"{relation}\n"
        marked_content += "<Graph END>"
        
        return marked_content
    
    # If still no relationships found, but this is Graph extraction, return original content with empty markers
    # if '<Graph START>' not in content:
    #     return f"{content}\n\n<Graph START>\n(not found, triplet, data)\n<Graph END>"
    
        return content 

def enforce_tree_markers(content: str) -> str:
    """Force ensure Tree content is properly surrounded by markers for information extraction stage."""
    
    # If there are already correct markers, check if markers are complete and content is valid
    if '<Tree START>' in content and '<Tree END>' in content:
        # Ensure marker format is correct
        start_pos = content.find('<Tree START>')
        end_pos = content.find('<Tree END>')
        if start_pos < end_pos:
            # Check if Tree content is valid (not empty or default invalid content)
            tree_content = content[start_pos + len('<Tree START>'):end_pos].strip()
            if tree_content and not ('not found' in tree_content and 'tree' in tree_content and 'data' in tree_content):
                return content  # Markers are correct and content is valid
            # If content is invalid, continue processing to try to extract valid content
    
    # Detect various possible triplet patterns
    triplet_patterns = [
        r'\([^)]+,\s*has_child,\s*[^)]+\)',        # (Parent, has_child, Child)
        r'\([^)]+,\s*collaborates_with,\s*[^)]+\)', # (Person, collaborates_with, Person)
        r'\([^)]+,\s*contains,\s*[^)]+\)',         # (Container, contains, Item)
        r'\([^)]+,\s*includes,\s*[^)]+\)',         # (Group, includes, Member)
        r'\([^,)]+,\s*[^,)]+,\s*[^)]+\)',          # Basic triplet format (A, B, C)
    ]
    
    # Find all triplets
    tree_triplets = []
    for pattern in triplet_patterns:
        matches = re.findall(pattern, content, re.MULTILINE)
        # Filter out invalid placeholder triplets
        valid_matches = [match for match in matches if not ('not found' in match and 'tree' in match and 'data' in match)]
        tree_triplets.extend(valid_matches)
    
    # Detect traditional text tree structure and convert to triplets
    lines = content.split('\n')
    hierarchy_triplets = []
    
    # Detect ASCII art tree structure (├── └── │)
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Skip empty lines and special markers
        if not stripped or stripped.startswith('<') or stripped.startswith('('):
            continue
            
        # Detect tree characters
        if any(char in line for char in ['├', '└', '│', '─']):
            # Clean up tree characters, extract node name
            node_name = re.sub(r'[├└│─\s]+', '', stripped).strip()
            if not node_name:
                continue
                
            # Calculate current node level (based on prefix characters)
            prefix_len = len(line) - len(line.lstrip())
            current_level = prefix_len // 4  # Assume each level has 4 characters
            
            # Find parent node - search for less indented node
            parent_name = "Root"
            for j in range(i - 1, -1, -1):
                prev_line = lines[j]
                prev_stripped = prev_line.strip()
                if prev_stripped and any(char in prev_line for char in ['├', '└', '│', '─']):
                    prev_prefix_len = len(prev_line) - len(prev_line.lstrip())
                    prev_level = prev_prefix_len // 4
                    
                    if prev_level < current_level:
                        parent_name = re.sub(r'[├└│─\s]+', '', prev_stripped).strip()
                        break
            
            if parent_name and node_name:
                hierarchy_triplets.append(f"({parent_name}, has_child, {node_name})")
        
        # Detect simple indentation structure (using spaces or tabs)
        elif stripped.startswith('-') or stripped.startswith('*') or stripped.startswith('+'):
            # Remove list markers
            node_name = re.sub(r'^[-*+\s]+', '', stripped).strip()
            if not node_name:
                continue
                
            # Calculate indentation level
            indent = len(line) - len(line.lstrip())
            
            # Find parent node
            parent_name = "Root"
            for j in range(i - 1, -1, -1):
                prev_line = lines[j]
                prev_stripped = prev_line.strip()
                if prev_stripped and (prev_stripped.startswith('-') or prev_stripped.startswith('*') or prev_stripped.startswith('+')):
                    prev_indent = len(prev_line) - len(prev_line.lstrip())
                    
                    if prev_indent < indent:
                        parent_name = re.sub(r'^[-*+\s]+', '', prev_stripped).strip()
                        break
            
            if parent_name and node_name:
                hierarchy_triplets.append(f"({parent_name}, has_child, {node_name})")
    
    # Merge all found triplets
    all_triplets = tree_triplets + hierarchy_triplets
    
    # If no triplets found, but content looks like tree structure, force conversion
    if not all_triplets and any(char in content for char in ['├', '└', '│', '─', '-', '*', '+']):
        # Extract all possible node names
        potential_nodes = []
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith('<'):
                # Clean up various tree characters and markers
                clean_node = re.sub(r'[├└│─\-\*\+\s]+', ' ', stripped).strip()
                if clean_node and len(clean_node) > 1:
                    potential_nodes.append(clean_node)
        
        # If potential nodes found, create simple hierarchical structure
        if potential_nodes:
            root_name = potential_nodes[0] if potential_nodes else "Root"
            for i, node in enumerate(potential_nodes[1:], 1):
                hierarchy_triplets.append(f"({root_name}, has_child, {node})")
            all_triplets = hierarchy_triplets
    
    # If triplets found, create correct format output
    if all_triplets:
        # Remove duplicates
        unique_triplets = list(set(all_triplets))
        
        # Output only triplets, don't keep explanatory text
        marked_content = "<Tree START>\n"
        for triplet in unique_triplets:
            marked_content += f"{triplet}\n"
        marked_content += "<Tree END>"
        
        return marked_content
    
    # If still no structure found, force create a basic tree structure
    # Extract keywords from content as nodes
    words = re.findall(r'\b[\u4e00-\u9fff\w]+\b', content)
    unique_words = list(set([w for w in words if len(w) > 1]))[:5]  # Take first 5 keywords
    
    if unique_words:
        marked_content = "<Tree START>\n"
        root = unique_words[0]
        for word in unique_words[1:]:
            marked_content += f"({root}, relates_to, {word})\n"
        marked_content += "<Tree END>"
        return marked_content
    
    # Final fallback
    return f"<Tree START>\n(Root, has_child, Unparseable content)\n<Tree END>"

def ensure_graph_markers(content: str) -> str:
    """Ensure graph data is properly wrapped with markers if the LLM missed it."""
    
    # If already has markers, return as is
    if '<Graph START>' in content and '<Graph END>' in content:
        return content
    
    # Look for triplet patterns that should be wrapped
    triplet_patterns = [
        r'```\s*\n(\([^,)]+,\s*[^,)]+,\s*[^,)]+.*?\n)+```',  # Code block with triplets
        r'(\([^,)]+,\s*[^,)]+,\s*[^,)]+.*?\n){3,}',  # Multiple triplets not in code block
    ]
    
    for pattern in triplet_patterns:
        matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)
        for match in matches:
            matched_content = match.group(0)
            
            # Extract the inner content if it's in a code block
            if matched_content.startswith('```'):
                inner_content = re.sub(r'^```.*?\n', '', matched_content)
                inner_content = re.sub(r'\n```$', '', inner_content)
                
                # Replace the code block with marked graph content
                replacement = f"\n<Graph START>\n{inner_content.strip()}\n<Graph END>\n"
                content = content.replace(matched_content, replacement)
            else:
                # Wrap standalone triplets
                replacement = f"\n<Graph START>\n{matched_content.strip()}\n<Graph END>\n"
                content = content.replace(matched_content, replacement)
    
    return content 