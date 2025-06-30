"""
Document management for the QA system - LLM-based retrieval
"""

import os
import logging
from typing import Dict, List, Optional
from pathlib import Path

from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader, TextLoader, UnstructuredMarkdownLoader, 
    CSVLoader, UnstructuredExcelLoader
)

logger = logging.getLogger(__name__)

class DocumentManager:
    """Manages document loading and LLM-based retrieval operations."""
    
    def __init__(self):
        # Remove embedding model and FAISS dependencies
        self.document_store = {}  # Map from document path to content
        # Adjust chunk size and overlap for better document processing
        self.text_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)
        self.document_chunks = []  # Store all document chunks
        # Store mapping between document sources and chunks
        self.document_source_map = {}  # Map from source path to list of chunk indices
        # Store complete document content
        self.document_contents = {}  # Map from source path to full document content
    
    def load_documents(self, document_paths: List[str]) -> List[Document]:
        """Load documents from various file formats and split into chunks."""
        documents = []
        
        for path in document_paths:
            try:
                path_obj = Path(path)
                if not path_obj.exists():
                    logger.warning(f"Document not found: {path}")
                    continue
                
                # Select appropriate loader based on file extension
                if path_obj.suffix.lower() == '.pdf':
                    loader = PyPDFLoader(str(path_obj))
                elif path_obj.suffix.lower() == '.txt':
                    loader = TextLoader(str(path_obj))
                elif path_obj.suffix.lower() == '.md':
                    loader = UnstructuredMarkdownLoader(str(path_obj))
                elif path_obj.suffix.lower() == '.csv':
                    loader = CSVLoader(str(path_obj))
                elif path_obj.suffix.lower() in ['.xlsx', '.xls']:
                    loader = UnstructuredExcelLoader(str(path_obj))
                else:
                    logger.warning(f"Unsupported file format: {path}")
                    continue
                
                # Load and add documents
                doc_objects = loader.load()
                for doc in doc_objects:
                    doc.metadata['source'] = str(path_obj)
                
                documents.extend(doc_objects)
                
                # Store complete document content
                content_parts = [doc.page_content for doc in doc_objects]
                self.document_contents[str(path_obj)] = "\n\n".join(content_parts)
                
                logger.info(f"Loaded {len(doc_objects)} segments from {path}")
            
            except Exception as e:
                logger.error(f"Error loading document {path}: {str(e)}")
        
        # Split documents into chunks
        if documents:
            self.document_chunks = self.text_splitter.split_documents(documents)
            logger.info(f"Split documents into {len(self.document_chunks)} chunks")
            
            # Build mapping between document sources and chunks
            for i, chunk in enumerate(self.document_chunks):
                source = chunk.metadata.get('source')
                if source:
                    if source not in self.document_source_map:
                        self.document_source_map[source] = []
                    self.document_source_map[source].append(i)
        
        return self.document_chunks
    
    def retrieve_relevant_documents(self, query: str, k: int = 5, document_paths: List[str] = None) -> List[Document]:
        """Retrieve the most relevant document chunks using LLM-based search.
        
        Args:
            query: The search query
            k: Number of chunks to retrieve per document
            document_paths: Optional list of document paths to search in. If None, search in all documents.
        """
        try:
            if document_paths:
                # Use user-selected documents for retrieval
                logger.info(f"Retrieving from {len(document_paths)} selected documents using LLM")
                all_docs = []
                
                for path in document_paths:
                    path = str(Path(path))
                    if path in self.document_contents:
                        # Use LLM to retrieve relevant segments from complete document content
                        relevant_content = self._llm_retrieve_from_document(
                            query, self.document_contents[path], path, k
                        )
                        if relevant_content:
                            all_docs.extend(relevant_content)
                            logger.info(f"Retrieved {len(relevant_content)} relevant segments from: {path}")
                
                return all_docs
            else:
                # Use all documents for retrieval
                logger.info("Retrieving from all documents using LLM")
                all_docs = []
                
                for path, content in self.document_contents.items():
                    relevant_content = self._llm_retrieve_from_document(
                        query, content, path, k
                    )
                    if relevant_content:
                        all_docs.extend(relevant_content)
                
                logger.info(f"Retrieved {len(all_docs)} relevant segments from all documents")
                return all_docs
        
        except Exception as e:
            logger.error(f"Error retrieving documents: {str(e)}")
            return []
    
    def _llm_retrieve_from_document(self, query: str, document_content: str, document_path: str, k: int = 5) -> List[Document]:
        """Use LLM to retrieve relevant segments from a document."""
        try:
            # Delayed import to avoid circular import
            from document_qa.utils.llm_utils import get_llm_response
            
            # Build retrieval prompt - require returning original document segments
            retrieval_prompt = f"""
Find the most relevant content segments from the following document that relate to the question. Please directly return the original document content without modification or rephrasing.

Question: {query}

Document content:
{document_content}

Requirements:
1. Select the most relevant {k} segments
2. Each segment should contain complete semantic information (complete paragraphs, sentences, or concepts)
3. Copy the original text directly without modification
4. Moderate length (approximately 100-500 characters)
5. Sort by relevance

Please return in the following format, with each segment separated by "---":

[Original content of segment 1]
---
[Original content of segment 2]
---
[Original content of segment 3]

If there is no relevant content in the document, please return "No relevant content".
"""
            
            # Use LLM for retrieval
            llm_response = get_llm_response(retrieval_prompt, model="qwen-long")
            
            # Parse LLM response and extract original segments
            relevant_docs = []
            if llm_response and "No relevant content" not in llm_response:
                # Split segments by "---" delimiter
                segments = llm_response.strip().split('---')
                
                for i, segment in enumerate(segments):
                    content = segment.strip()
                    
                    # Filter out content that is too short or empty
                    if content and len(content) > 20:
                        doc = Document(
                            page_content=content,
                            metadata={
                                'source': document_path,
                                'chunk_id': i,
                                'retrieval_method': 'llm'
                            }
                        )
                        relevant_docs.append(doc)
                    
                    if len(relevant_docs) >= k:
                        break
            
            return relevant_docs
            
        except Exception as e:
            logger.error(f"Error in LLM retrieval for {document_path}: {str(e)}")
            return []
    
    def add_documents(self, new_documents: List[Document]):
        """Add new documents to the document store."""
        try:
            if not new_documents:
                logger.warning("No new documents to add")
                return
            
            # Check if there are truly new documents to add
            actually_new_documents = []
            for doc in new_documents:
                source = doc.metadata.get('source')
                if source and source not in self.document_source_map:
                    actually_new_documents.append(doc)
                    logger.info(f"Found new document to index: {source}")
                elif source:
                    logger.info(f"Document already indexed, skipping: {source}")
            
            if not actually_new_documents:
                logger.info("All documents are already indexed, skipping add operation")
                return
            
            # Split new documents
            new_chunks = self.text_splitter.split_documents(actually_new_documents)
            orig_chunk_len = len(self.document_chunks)
            self.document_chunks.extend(new_chunks)
            
            # Update mapping between document sources and chunks
            for i, chunk in enumerate(new_chunks, start=orig_chunk_len):
                source = chunk.metadata.get('source')
                if source:
                    if source not in self.document_source_map:
                        self.document_source_map[source] = []
                    self.document_source_map[source].append(i)
            
            # Store complete content of new documents
            for doc in actually_new_documents:
                source = doc.metadata.get('source')
                if source:
                    if source not in self.document_contents:
                        # Collect all content of this document
                        doc_content_parts = []
                        for new_doc in actually_new_documents:
                            if new_doc.metadata.get('source') == source:
                                doc_content_parts.append(new_doc.page_content)
                        self.document_contents[source] = "\n\n".join(doc_content_parts)
            
            logger.info(f"Added {len(new_chunks)} new chunks using LLM-based storage")
        
        except Exception as e:
            logger.error(f"Error adding documents: {str(e)}")
    
    def load_document_content(self, document_path: str) -> str:
        """Load the content of a document directly as a string.
        
        Args:
            document_path: Path to the document file
            
        Returns:
            String containing the document content
            
        Raises:
            FileNotFoundError: If the document doesn't exist
            ValueError: If the document format is unsupported
        """
        try:
            # First check if already loaded
            if document_path in self.document_contents:
                return self.document_contents[document_path]
            
            path_obj = Path(document_path)
            if not path_obj.exists():
                raise FileNotFoundError(f"Document not found: {document_path}")
            
            # Select appropriate loader based on file extension
            if path_obj.suffix.lower() == '.pdf':
                loader = PyPDFLoader(str(path_obj))
            elif path_obj.suffix.lower() == '.txt':
                loader = TextLoader(str(path_obj))
            elif path_obj.suffix.lower() == '.md':
                loader = UnstructuredMarkdownLoader(str(path_obj))
            elif path_obj.suffix.lower() == '.csv':
                loader = CSVLoader(str(path_obj))
            elif path_obj.suffix.lower() in ['.xlsx', '.xls']:
                loader = UnstructuredExcelLoader(str(path_obj))
            else:
                raise ValueError(f"Unsupported file format: {document_path}")
            
            # Load document
            doc_objects = loader.load()
            
            # Combine all document segments into a single string
            content_parts = []
            for doc in doc_objects:
                content_parts.append(doc.page_content)
            
            content = "\n\n".join(content_parts)
            
            # Cache content
            self.document_contents[document_path] = content
            
            logger.info(f"Loaded content from {document_path}: {len(content)} characters")
            return content
            
        except Exception as e:
            logger.error(f"Error loading document {document_path}: {str(e)}")
            raise 
    
    # Keep some compatibility methods, but no longer use FAISS
    def load_faiss_index(self):
        """Compatibility method - no longer uses FAISS."""
        logger.info("FAISS indexing disabled - using LLM-based retrieval")
        return True
    
    def index_documents(self, documents: List[Document]):
        """Compatibility method - documents are now stored directly."""
        logger.info("Documents stored for LLM-based retrieval - no indexing required")
        return True 