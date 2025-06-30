"""
Core document QA workflow implementation
"""

import queue
import threading
import time
import logging
import os
from typing import Callable, Dict, Iterator, List, Optional

from langchain.llms.base import BaseLLM

import llm.main as llm_main
import llm.global_config as llm_config
from document_qa.core.state import DocumentQAState
from document_qa.core.document_manager import DocumentManager
from document_qa.agents.thinking_agent import ThinkingAgent
from document_qa.utils.llm_utils import get_llm_response

logger = logging.getLogger(__name__)

def stream_document_qa_workflow(query: str, documents: List[str], doc_mode: str = "paths",
                               llm: Optional[BaseLLM] = None, 
                               model: str = None, 
                               custom_params: Dict = None,
                               callback: Optional[Callable[[str], None]] = None,
                               task_mode: str = "simple") -> Iterator[str]:
    """Execute the document QA workflow using the multi-agent system and stream results.
    
    This function is the streaming version of execute_document_qa_workflow. It yields
    intermediate thoughts and the final answer as they are generated, allowing for
    real-time display of the reasoning process.
    
    Args:
        query: The user query to process
        document: List of document paths to use for answering the query
        doc_mode: str = "paths" or "contents"
        llm: Optional language model instance to use
        model: Model name to use if llm is not provided
        custom_params: Additional parameters for document processing
        callback: Optional callback function to receive thoughts in real-time
        task_mode: str = "simple" or "wo_verify" or "wo_extract"
    Returns:
        An iterator that yields thoughts and the final answer as strings
    """
    
    # Set the model in global config if specified
    if model:
        llm_config.set_model(model)
    
    # Create a queue for streaming
    thought_queue = queue.Queue()
    
    def streaming_callback(thought, temporary=False):
        """This callback function puts each thinking step into the queue for immediate yielding
        
        Args:
            thought: The thought content
            temporary: If True, this is a temporary status message that should be hidden when new messages arrive
        """
        # Put into queue for immediate availability
        thought_queue.put((thought, temporary))  # Store tuple with thought content and temporary flag
        logger.info(f"Adding thought to queue: {thought[:50]}... {'(temporary thought)' if temporary else '(regular thought)'}")
        if callback:
            # Pass the temporary flag to the client callback if it supports it
            try:
                # Try with temporary flag
                if temporary:
                    logger.info(f"Calling callback with temporary flag: {thought[:50]}...")
                else:
                    logger.info(f"Calling regular thought callback: {thought[:50]}...")
                    
                callback(thought, temporary=temporary)
            except TypeError:
                # Fall back to original signature if callback doesn't accept the temporary parameter
                logger.warning(f"Callback doesn't support temporary flag parameter, using default callback: {thought[:50]}...")
                callback(thought)
    
    # Create state with streaming capability
    state = DocumentQAState(callback=streaming_callback)
    
    # Return the first items to start the stream
    yield f"[TEMP:] Starting analysis for query: {query}\n"
    
    # Handle empty document list case
    if not documents:
        # state.add_thought("planner", "No documents selected, will use LLM to answer directly.")
        
        # Immediately yield thoughts from queue
        while not thought_queue.empty():
            thought_data = thought_queue.get()
            # Extract thought content from tuple
            if isinstance(thought_data, tuple) and len(thought_data) > 0:
                thought = thought_data[0]
            else:
                thought = thought_data
            yield thought if isinstance(thought, str) else str(thought)
            
        # Use LLM directly without document retrieval
        prompt = f"""Please answer the following question based on your own knowledge. Note that the user has not selected any reference documents, 
        so you should rely on your own knowledge to respond. Also, kindly inform the user that if they wish to receive an answer based on specific documents, 
        they should select the relevant documents and ask the question again.

        Question: {query}
        """
        answer = get_llm_response(prompt)
        
        # Ensure all thoughts are yielded
        while not thought_queue.empty():
            thought_data = thought_queue.get()
            # Extract thought content from tuple
            if isinstance(thought_data, tuple) and len(thought_data) > 0:
                thought = thought_data[0]
            else:
                thought = thought_data
            yield thought if isinstance(thought, str) else str(thought)
        
        # Yield the final answer
        yield "FINAL ANSWER:"
        yield answer
        return
    
    # If documents are selected, proceed with normal workflow
    # Prioritize using pre-loaded doc_manager (if available)

    yield "Loading and processing documents...\n"

    if doc_mode == "paths":
        if custom_params and "doc_manager" in custom_params:
            doc_manager = custom_params["doc_manager"]
            logger.info("Using pre-loaded DocumentManager")
    else:
        doc_manager = DocumentManager(**(custom_params or {}))
        logger.info("Creating new DocumentManager")
    
    # Initialize the thinking agent
    thinking_agent = ThinkingAgent(state, doc_manager, llm)
    
    # Load and index documents
    if doc_mode == "paths":
        documents_ctx = doc_manager.load_documents(documents)
    elif doc_mode == "contents":
        documents_ctx = documents
    
    # Immediately yield thoughts from queue
    while not thought_queue.empty():
        thought_data = thought_queue.get()
        # Extract thought content from tuple
        if isinstance(thought_data, tuple) and len(thought_data) > 0:
            thought = thought_data[0]
            is_temporary = thought_data[1] if len(thought_data) > 1 else False
        else:
            thought = thought_data
            is_temporary = False
        
        # Only yield non-temporary thoughts for final output
        if not is_temporary:
            yield thought if isinstance(thought, str) else str(thought)
    
    if not documents_ctx:
        yield "Unable to load documents. Please check if document paths and formats are correct."
        return
    
    # Create or update index - only reload index when not using pre-loaded doc_manager

    if doc_mode == "paths":
        if not custom_params or "doc_manager" not in custom_params:
            # No longer need FAISS indexing - documents are automatically loaded
            doc_manager.add_documents(documents_ctx)
        else:
            doc_manager.add_documents(documents_ctx)
    
    # Immediately yield thoughts from queue
    while not thought_queue.empty():
        thought_data = thought_queue.get()
        # Extract thought content from tuple
        if isinstance(thought_data, tuple) and len(thought_data) > 0:
            thought = thought_data[0]
            is_temporary = thought_data[1] if len(thought_data) > 1 else False
        else:
            thought = thought_data
            is_temporary = False
        
        # Only yield non-temporary thoughts for final output
        if not is_temporary:
            yield thought if isinstance(thought, str) else str(thought)
    
    # Execute the workflow using the thinking agent - pass document_paths
    # Start an execution thread
    execution_thread = threading.Thread(
        target=lambda: thinking_agent.execute(query, documents=documents, doc_mode=doc_mode),
        daemon=True
    )
    execution_thread.start()
    
    # Wait for execution to complete while streaming thought process
    result = None
    while execution_thread.is_alive() or not thought_queue.empty():
        # Output immediately as long as there's content in the queue
        while not thought_queue.empty():
            thought_data = thought_queue.get()
            # Extract thought content from tuple
            if isinstance(thought_data, tuple) and len(thought_data) > 0:
                thought = thought_data[0]
                is_temporary = thought_data[1] if len(thought_data) > 1 else False
            else:
                thought = thought_data
                is_temporary = False
            
            # Send both temporary and non-temporary thoughts during processing
            yield thought if isinstance(thought, str) else str(thought)
        # Wait a bit to avoid high CPU usage
        time.sleep(0.05)
    
    # Get result
    result = thinking_agent.result
    
    # Final check to ensure all thought content is output
    while not thought_queue.empty():
        thought_data = thought_queue.get()
        # Extract thought content from tuple
        if isinstance(thought_data, tuple) and len(thought_data) > 0:
            thought = thought_data[0]
            is_temporary = thought_data[1] if len(thought_data) > 1 else False
        else:
            thought = thought_data
            is_temporary = False
        
        # Only yield non-temporary thoughts for final output
        if not is_temporary:
            yield thought if isinstance(thought, str) else str(thought)
    
    if isinstance(result, dict):
        yield result.get("answer", "No answer generated")


def execute_document_qa_workflow(query: str, documents: List[str], doc_mode: str = "paths",
                               llm: Optional[BaseLLM] = None, 
                               model: str = None, 
                               custom_params: Dict = None,
                               callback: Optional[Callable[[str], None]] = None,
                               task_mode: str = "simple") -> Dict:
    """Execute the document QA workflow using the multi-agent system.
    
    Args:
        query: The user query to process
        document: List of document paths to use for answering the query
        doc_mode: str = "paths" or "contents"
        llm: Optional language model instance to use
        model: Model name to use if llm is not provided
        custom_params: Additional parameters for document processing
        callback: Optional callback function to receive thoughts in real-time
        
    Returns:
        Dictionary containing the final answer and thought process
    """
    
    # Set the model in global config if specified
    if model:
        llm_config.set_model(model)
    
    # Initialize state and document manager with the callback
    state = DocumentQAState(callback=callback)
    
    # Handle empty document list case
    if not documents:
        # state.add_thought("planner", "No documents selected, will use LLM to answer directly.")
        # Use LLM directly without document retrieval
        prompt = f"""Please answer the following question based on your own knowledge. 
        Since the user has not selected any reference documents, 
        you should rely on your own knowledge to respond. 
        Also, kindly inform the user that if they wish to receive an answer based on specific documents, 
        they should select the relevant documents and ask the question again.

        Question: {query}
        """
        answer = get_llm_response(prompt)
        return {
            "answer": answer,
            "thought_process": state.get_thought_trail()
        }
    
    # If documents are selected, proceed with normal workflow
    # Prioritize using pre-loaded doc_manager (if available)
    if custom_params and "doc_manager" in custom_params:
        doc_manager = custom_params["doc_manager"]
        logger.info("Using pre-loaded DocumentManager")
    else:
        doc_manager = DocumentManager(**(custom_params or {}))
        logger.info("Creating new DocumentManager")
    
    # Initialize the thinking agent
    thinking_agent = ThinkingAgent(state, doc_manager, llm)

    
    # Load and index documents
    if doc_mode == "paths":
        documents_ctx = doc_manager.load_documents(documents)
    elif doc_mode == "contents":
        documents_ctx = documents
    if not documents_ctx:
        return {
            "answer": "Unable to load documents. Please check if document paths and formats are correct.",
            "thought_process": state.get_thought_trail()
        }
    
    # Load documents for LLM-based retrieval - no indexing needed

    if doc_mode == "paths":
        if not custom_params or "doc_manager" not in custom_params:
            # No longer need FAISS indexing - documents are automatically loaded
            doc_manager.add_documents(documents_ctx)
        else:
            # If using preloaded doc_manager, just add new documents
            doc_manager.add_documents(documents_ctx)
    
    
    # Execute the workflow using the thinking agent
    result = thinking_agent.execute(query, document_ctx=documents_ctx, doc_mode=doc_mode)
    
    # Thinking agent already produces a richly structured result
    # Just ensure it has the expected format for API compatibility
    if not isinstance(result, dict):
        result = {
            "answer": str(result),
            "thought_process": state.get_thought_trail()
        }
    elif "answer" not in result:
        # If there's a final_answer but no answer field, use that
        if "final_answer" in result:
            result["answer"] = result["final_answer"]
        else:
            result["answer"] = "No answer was generated."
        
        # Ensure thought process is included
        if "thought_process" not in result:
            result["thought_process"] = state.get_thought_trail()
    
    return result 

def simple_qa_workflow(query: str, documents: List[str] = None, 
                      doc_manager: DocumentManager = None,
                      model: str = None,
                      chat_context: List[str] = None) -> Iterator[str]:
    """Execute a simple QA workflow without complex thinking process.
    
    This function is designed for fast Q&A when DataMosaic mode is disabled.
    It directly loads document content and generates a direct answer using LLM-based retrieval.
    
    Args:
        query: The user query to process
        documents: List of document paths to use for answering the query
        doc_manager: DocumentManager instance for document retrieval
        model: Model name to use
        chat_context: List of previous conversation messages for context
        
    Returns:
        An iterator that yields simple status and the final answer
    """
    
    # Set the model in global config if specified
    if model:
        llm_config.set_model(model)
    
    try:
        if documents and doc_manager:
            # Step 1: Load document content directly (without using FAISS)
            yield "Loading document content..."
            
            all_content = []
            successfully_loaded = []
            
            for doc_path in documents:
                try:
                    # Use DocumentManager's load_document_content method to read complete document content
                    content = doc_manager.load_document_content(doc_path)
                    if content:
                        filename = os.path.basename(doc_path)
                        all_content.append(f"=== File: {filename} ===\n{content}")
                        successfully_loaded.append(filename)
                        logger.info(f"Successfully loaded document content: {filename}, length: {len(content)} characters")
                    else:
                        logger.warning(f"Document content is empty: {doc_path}")
                except Exception as e:
                    logger.error(f"Failed to load document {doc_path}: {str(e)}")
                    continue
            
            if all_content:
                # Merge all document content
                combined_content = "\n\n".join(all_content)
                
                # Build conversation context if available
                conversation_context = ""
                if chat_context and len(chat_context) > 0:
                    conversation_context = f"""

Here is the previous conversation history:
{chr(10).join(chat_context)}

"""
                
                # Notify user of successfully loaded files
                yield f"Successfully loaded {len(successfully_loaded)} files: {', '.join(successfully_loaded)}"
                
                # Create simple prompt with conversation context and full document content
                prompt = f"""Please answer the user's question based on the following document content and conversation history. Please provide an accurate and detailed answer directly.

{conversation_context}

Document content:
{combined_content}

Current user question: {query}

Please answer directly based on the above document content:"""
            else:
                # No documents could be loaded
                conversation_context = ""
                if chat_context and len(chat_context) > 0:
                    conversation_context = f"""

Here is the previous conversation history:
{chr(10).join(chat_context)}

"""
                
                yield "Unable to load any document content"
                prompt = f"""User question: {query}
{conversation_context}
Unable to load the selected document content. Please answer this question directly based on conversation history and your knowledge:"""
        else:
            # No documents provided, answer with general knowledge and conversation context
            conversation_context = ""
            if chat_context and len(chat_context) > 0:
                conversation_context = f"""

Here is the previous conversation history:
{chr(10).join(chat_context)}

"""
            
            yield "No documents selected, will answer based on general knowledge"
            prompt = f"""User question: {query}
{conversation_context}
The user has not provided specific document content. Please answer this question directly based on conversation history and your knowledge:"""
        
        # Step 2: Generate answer
        yield "Generating answer..."
        
        answer = get_llm_response(prompt, model=model)
        
        # Return final answer with proper format
        yield f"FINAL ANSWER:{answer}"
        
    except Exception as e:
        logger.error(f"Error in simple QA workflow: {str(e)}")
        yield f"Error occurred during processing: {str(e)}" 