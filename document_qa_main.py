"""
Main module for document QA system

This replaces the original enhanced_document_qa.py with a cleaner interface
that imports the modular package structure.
"""

from typing import Dict, List, Optional, Callable, Iterator
from langchain.llms.base import BaseLLM

from document_qa.core.workflow import (
    execute_document_qa_workflow,
    stream_document_qa_workflow
)

def process_query(
    query: str,
    document: List[str],
    llm: Optional[BaseLLM] = None,
    model: str = None,
    custom_params: Dict = None,
    doc_mode: str = "paths", # paths or contents
    callback: Optional[Callable[[str], None]] = None,
    streaming: bool = False,
    task_mode: str = "simple"  # simple mode for open source
) -> Dict:
    """
    Process a query using the document QA system.
    
    Args:
        query: The user's query to answer
        documents: List of documents to use
        llm: Optional language model to use
        model: Name of model to use if llm is not provided
        custom_params: Additional parameters for processing
        callback: Optional callback for real-time updates
        streaming: Whether to use the streaming API
        
    Returns:
        Dictionary containing the answer and thought process
    """
    if streaming:
        # Return a dictionary with the stream object
        return {
            "stream": stream_document_qa_workflow(
                query=query,
                documents=document,
                doc_mode=doc_mode,
                llm=llm,
                model=model,
                custom_params=custom_params,
                callback=callback,
                task_mode=task_mode
            )
        }
    else:
        # Return the result dictionary directly
        return execute_document_qa_workflow(
            query=query,
            documents=document,
            doc_mode=doc_mode,
            llm=llm,
            model=model,
            custom_params=custom_params,
            callback=callback,
            task_mode=task_mode
        )

 