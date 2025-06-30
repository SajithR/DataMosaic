from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import os
import sys
import time
import json
from werkzeug.utils import secure_filename
import logging
import datetime
import uuid
import re

# Import formula conversion tools
from utils.formula_converter import normalize_formulas

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add parent directory to path to import the document_qa module
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
# Updated import statements using new modular structure
from document_qa.core.workflow import execute_document_qa_workflow, stream_document_qa_workflow, simple_qa_workflow
from document_qa.core.document_manager import DocumentManager
# from enhanced_document_qa import execute_document_qa_workflow, stream_document_qa_workflow, DocumentManager

# Get project root directory (DataMosaic)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def to_relative_path(absolute_path):
    """Convert absolute path to relative path based on project root directory"""
    try:
        # Ensure the path is absolute
        if not os.path.isabs(absolute_path):
            return absolute_path
        
        # Get relative path to project root directory
        relative_path = os.path.relpath(absolute_path, PROJECT_ROOT)
        return relative_path
    except Exception as e:
        logger.warning(f"Failed to convert path to relative: {absolute_path}, error: {e}")
        return absolute_path

def to_absolute_path(relative_path):
    """Convert relative path to absolute path"""
    try:
        # Return directly if already absolute path
        if os.path.isabs(relative_path):
            return relative_path
        
        # Join project root directory and relative path
        absolute_path = os.path.join(PROJECT_ROOT, relative_path)
        return os.path.normpath(absolute_path)
    except Exception as e:
        logger.warning(f"Failed to convert path to absolute: {relative_path}, error: {e}")
        return relative_path

app = Flask(__name__)
# Configure CORS to support credentials and complete cross-origin requests
CORS(app, 
     origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:65150", "http://127.0.0.1:65150"],  # Allowed frontend domains
     supports_credentials=True,  # Support credentials
     allow_headers=["Content-Type", "Authorization", "Access-Control-Allow-Credentials"],  # Allowed headers
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]  # Allowed HTTP methods
)

# Configure upload folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Configure chat history folder
HISTORY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'chat_history')
os.makedirs(HISTORY_DIR, exist_ok=True)

def safe_filename(filename):
    """
    Create a safe filename function that supports Chinese characters
    Keep Chinese characters, only remove truly dangerous characters
    """
    if not filename:
        return filename
    
    # Remove path separators and other dangerous characters, but keep Chinese characters
    dangerous_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\x00']
    safe_name = filename
    
    for char in dangerous_chars:
        safe_name = safe_name.replace(char, '_')
    
    # Remove leading and trailing spaces and dots
    safe_name = safe_name.strip(' .')
    
    # Use default name if filename is empty or contains only dots
    if not safe_name or safe_name == '.' or safe_name == '..':
        safe_name = 'untitled'
    
    # Limit filename length
    if len(safe_name.encode('utf-8')) > 255:
        name, ext = os.path.splitext(safe_name)
        # Keep extension, truncate main filename
        max_name_length = 255 - len(ext.encode('utf-8'))
        name_bytes = name.encode('utf-8')[:max_name_length]
        # Ensure not to truncate in the middle of UTF-8 character
        try:
            name = name_bytes.decode('utf-8')
        except UnicodeDecodeError:
            # If truncation position is not a complete character, search forward for complete character boundary
            for i in range(len(name_bytes), 0, -1):
                try:
                    name = name_bytes[:i].decode('utf-8')
                    break
                except UnicodeDecodeError:
                    continue
        safe_name = name + ext
    
    return safe_name

# Configure allowed file extensions
ALLOWED_EXTENSIONS = {'pdf', 'txt', 'md', 'csv', 'xlsx', 'xls'}

# Initialize document manager with LLM-based retrieval
doc_manager = DocumentManager()
logger.info("Initializing DocumentManager with LLM-based retrieval...")

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/upload', methods=['POST'])
@app.route('/api/projects/<project_id>/upload', methods=['POST'])
def upload_file(project_id=None):
    # Use project-specific upload folder if project_id is provided
    if project_id:
        upload_folder = os.path.join(get_project_path(project_id), 'uploads')
    else:
        upload_folder = app.config['UPLOAD_FOLDER']
    
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if file and allowed_file(file.filename):
        filename = safe_filename(file.filename)
        filepath = os.path.join(upload_folder, filename)
        
        # Check if the file already exists
        if os.path.exists(filepath):
            # Return a status indicating the file already exists
            return jsonify({
                "status": "exists",
                "message": f"File '{filename}' already exists",
                "filename": filename,
                "filepath": to_relative_path(filepath)
            }), 409  # HTTP 409 Conflict
        
        # Save the file if it doesn't exist
        file.save(filepath)
        return jsonify({
            "status": "success",
            "message": "File uploaded successfully",
            "filename": filename,
            "filepath": to_relative_path(filepath)
        }), 200
    else:
        return jsonify({"error": "File type not allowed"}), 400

@app.route('/api/upload/batch', methods=['POST'])
@app.route('/api/projects/<project_id>/upload/batch', methods=['POST'])
def upload_batch_files(project_id=None):
    """
    Batch file upload endpoint for handling folder uploads
    """
    # Use project-specific upload folder if project_id is provided
    if project_id:
        upload_folder = os.path.join(get_project_path(project_id), 'uploads')
    else:
        upload_folder = app.config['UPLOAD_FOLDER']
        
    uploaded_files = []
    failed_files = []
    existing_files = []
    
    # Get all uploaded files
    files = request.files.getlist('files')
    if not files or all(file.filename == '' for file in files):
        return jsonify({"error": "No files selected"}), 400
    
    for file in files:
        if file.filename == '':
            continue
            
        if file and allowed_file(file.filename):
            # Keep original filename and path structure (if any)
            original_filename = file.filename
            # For batch upload, we might need to maintain some directory structure
            # But here we simplify processing and put everything in uploads directory
            
            # If filename contains path separators, only take the filename part
            if '/' in original_filename or '\\' in original_filename:
                # Extract base filename first, then perform safe processing
                base_filename = os.path.basename(original_filename)
                filename = safe_filename(base_filename)
            else:
                filename = safe_filename(original_filename)
                
            filepath = os.path.join(upload_folder, filename)
            
            # Check if file already exists, generate new filename if it does
            if os.path.exists(filepath):
                # Separate filename and extension
                name, ext = os.path.splitext(filename)
                counter = 1
                
                # Find a non-conflicting filename
                while os.path.exists(filepath):
                    new_filename = f"{name}_{counter}{ext}"
                    filepath = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
                    counter += 1
                
                filename = new_filename
                logger.info(f"Filename conflict, renamed to: {filename}")
            
            try:
                file.save(filepath)
                uploaded_files.append({
                    "filename": filename,
                    "original_filename": original_filename,
                    "filepath": filepath,
                    "size": os.path.getsize(filepath)
                })
                logger.info(f"Batch upload successful: {filename}")
            except Exception as e:
                logger.error(f"Failed to save file {filename}: {str(e)}")
                failed_files.append({
                    "filename": original_filename,
                    "error": str(e)
                })
        else:
            failed_files.append({
                "filename": file.filename,
                "error": "File type not allowed"
            })
    
    # Return upload results
    response_data = {
        "status": "completed",
        "uploaded": uploaded_files,
        "failed": failed_files,
        "existing": existing_files,
        "summary": {
            "total": len(files),
            "uploaded_count": len(uploaded_files),
            "failed_count": len(failed_files),
            "existing_count": len(existing_files)
        }
    }
    
    if uploaded_files and not failed_files and not existing_files:
        response_data["status"] = "success"
        response_data["message"] = f"Successfully uploaded {len(uploaded_files)} files"
    elif uploaded_files or existing_files:
        response_data["status"] = "partial"
        message_parts = []
        if uploaded_files:
            message_parts.append(f"Uploaded {len(uploaded_files)} files")
        if existing_files:
            message_parts.append(f"{len(existing_files)} files already exist")
        if failed_files:
            message_parts.append(f"{len(failed_files)} failed")
        response_data["message"] = ", ".join(message_parts)
    else:
        response_data["status"] = "error"
        response_data["message"] = "No files were uploaded successfully"
        return jsonify(response_data), 400
    
    return jsonify(response_data), 200

# Add a new endpoint to handle overwrite confirmation
@app.route('/api/upload/confirm-overwrite', methods=['POST'])
def confirm_overwrite():
    data = request.json
    
    if not data or 'filepath' not in data or 'file_data' not in data:
        return jsonify({"error": "Missing required data"}), 400
    
    filepath = data['filepath']
    
    try:
        # The file data should be base64 encoded
        import base64
        file_data = base64.b64decode(data['file_data'])
        
        # Write the file data to the filepath
        with open(filepath, 'wb') as f:
            f.write(file_data)
        
        filename = os.path.basename(filepath)
        
        return jsonify({
            "status": "success",
            "message": f"File '{filename}' has been overwritten",
            "filename": filename,
            "filepath": filepath
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/process', methods=['POST'])
@app.route('/api/projects/<project_id>/process', methods=['POST'])
def process_query(project_id=None):
    data = request.json
    
    query = data.get('query', '')
    if not query:
        return jsonify({"error": "No query provided"}), 400
    
    file_paths = data.get('file_paths', [])
    use_all_files = data.get('use_all_files', False)
    data_mosaic_enabled = data.get('data_mosaic_enabled', False)
    chat_id = data.get('chat_id')  # Get chat ID
    is_edit = data.get('is_edit', False)  # Get edit operation flag
    model = data.get('model', 'gpt-4o')  # Get model parameter, default to gpt-4o
    
    # If no model specified in request, try to read from settings file
    if 'model' not in data:
        try:
            settings_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config', 'settings.json')
            if os.path.exists(settings_file):
                with open(settings_file, 'r', encoding='utf-8') as f:
                    settings = json.load(f)
                    model = settings.get('model', 'gpt-4o')
        except Exception as e:
            logger.warning(f"Failed to load model from settings: {str(e)}")
            model = 'gpt-4o'  # Use default model
    
    logger.info(f"Initial request parameters: query={query}, file_paths={file_paths}, use_all_files={use_all_files}, data_mosaic_enabled={data_mosaic_enabled}, chat_id={chat_id}, is_edit={is_edit}, model={model}")
    
    # Get chat history context
    chat_context = []
    if chat_id:
        chat_context = get_chat_context(chat_id, max_history=5, project_id=project_id)  # Get last 5 conversation rounds
        logger.info(f"Retrieved chat context, history rounds: {len(chat_context)}")
    
    # Get selected file information (if sent from frontend)
    selected_files_from_frontend = data.get('selected_files', [])
    
    # Save user message (only for non-edit operations)
    if chat_id and not is_edit:
        # Prioritize using file information sent from frontend, otherwise build from file_paths
        if selected_files_from_frontend:
            selected_files = selected_files_from_frontend
        else:
            selected_files = []
            if file_paths:
                for filepath in file_paths:
                    filename = os.path.basename(filepath)
                    selected_files.append({
                        'filename': filename,
                        'filepath': filepath
                    })
        
        # Convert file paths to relative paths for saving
        relative_file_paths = [to_relative_path(fp) for fp in file_paths] if file_paths else []
        relative_selected_files = []
        for sf in selected_files:
            relative_selected_files.append({
                'filename': sf['filename'],
                'filepath': to_relative_path(sf['filepath'])
            })
        
        save_chat_message(chat_id, 'user', query, {
            'file_paths': relative_file_paths,
            'selected_files': relative_selected_files,  # Add detailed information of selected files
            'use_all_files': use_all_files,
            'data_mosaic_enabled': data_mosaic_enabled,
            'model': model
        }, project_id)
        logger.info("Saved user message to chat history")
    elif is_edit:
        logger.info("Skipped saving user message (edit operation)")
    
    # If user hasn't selected documents and specified to use all documents, get all document paths
    if not file_paths and use_all_files:
        # Get all files in upload folder
        all_files = []
        
        # Use project-specific upload folder if project_id is provided
        if project_id:
            upload_folder = os.path.join(get_project_path(project_id), 'uploads')
        else:
            upload_folder = app.config['UPLOAD_FOLDER']
        
        if os.path.exists(upload_folder):
            for filename in os.listdir(upload_folder):
                if allowed_file(filename):
                    filepath = os.path.join(upload_folder, filename)
                    file_paths.append(filepath)
                    all_files.append(filename)
        
        logger.info(f"File Base switch enabled, getting all files: {len(file_paths)} files")
        logger.info(f"File list: {all_files}")
    # If user hasn't selected documents and hasn't specified to use all documents, keep document list empty
    elif not file_paths and not use_all_files:
        file_paths = []  # Ensure file_paths is empty list instead of using all documents
        logger.info("No files selected and File Base switch disabled, using empty file list")
    else:
        logger.info(f"Using user-selected {len(file_paths)} files")
    
    logger.info(f"Final processing query: query={query}, file_paths length={len(file_paths)}, use_all_files={use_all_files}, data_mosaic_enabled={data_mosaic_enabled}, model={model}")
    
    # For streaming responses
    if data.get('stream', False):
        def generate():
            # Process in chunks for streaming using the streaming workflow
            logger.info("Using streaming processing mode (SSE)")
            # Send SSE header
            yield "event: start\ndata: {}\n\n".encode('utf-8')
            
            final_answer = ""  # For collecting final answer
            thought_process = []  # For collecting thought process
            
            # Choose processing mode based on DataMosaic switch
            if not data_mosaic_enabled:
                # Simple QA mode: use new simple workflow
                logger.info("DataMosaic disabled, using simple QA mode")
                
                # Convert relative paths to absolute paths for document processing
                absolute_file_paths = [to_absolute_path(fp) for fp in file_paths] if file_paths else None
                
                # Use new simple QA workflow, pass in chat context
                for step in simple_qa_workflow(
                    query=query, 
                    documents=absolute_file_paths,
                    doc_manager=doc_manager,
                    model=model,  # Use selected model
                    chat_context=chat_context  # Pass in chat context
                ):
                    if step.startswith("FINAL ANSWER:"):
                        # Send final answer separately
                        final_answer = step.replace("FINAL ANSWER:", "").strip()
                        # Apply formula standardization to final answer
                        try:
                            final_answer = normalize_formulas(final_answer)
                        except Exception as e:
                            logger.warning(f"Formula conversion failed, using original answer: {str(e)}")
                        response_data = {"type": "answer", "content": final_answer}
                        logger.info(f"Sending simple QA answer: {response_data['content'][:50]}...")
                        yield f"event: answer\ndata: {json.dumps(response_data)}\n\n".encode('utf-8')
                    else:
                        # Send simple status updates
                        response_data = {
                            "type": "thinking", 
                            "content": step,
                            "temporary": False  # Simple mode steps are not temporary
                        }
                        # Simple QA mode doesn't collect thought process, these are just status updates
                        # thought_process.append(step)  # Commented out, simple mode doesn't save thought process
                        logger.info(f"Sending simple QA step: {response_data['content']}")
                        yield f"event: thinking\ndata: {json.dumps(response_data)}\n\n".encode('utf-8')
                    
            else:
                # DataMosaic mode: use complete pipeline thought process
                logger.info("DataMosaic enabled, using complete pipeline mode")
                
                # Use a custom wrapper to extract temporary flag if available
                def custom_callback(thought, temporary=False):
                    nonlocal temp_status
                    temp_status = temporary
                    logger.info(f"Custom callback: {thought[:50]}... {'(temporary=True)' if temporary else '(temporary=False)'}")
                    # Record more detailed information
                    if temporary:
                        logger.info(f"Marked as temporary thought: {thought[:100]}")
                    else:
                        logger.info(f"Marked as regular thought: {thought[:100]}")
                
                # Track temporary status
                temp_status = False
                
                # Convert relative paths to absolute paths for document processing
                absolute_file_paths = [to_absolute_path(fp) for fp in file_paths] if file_paths else None
                
                # Use the DataMosaic workflow with the selected model
                for thought in stream_document_qa_workflow(
                    query=query, 
                    documents=absolute_file_paths,
                    model=model,  # Use selected model
                    custom_params={
                        "doc_manager": doc_manager,
                        "chat_context": chat_context
                    },
                    callback=custom_callback
                ):
                    # Extract final answer from thought
                    if thought.startswith("FINAL ANSWER:"):
                        final_answer = thought.replace("FINAL ANSWER:", "").strip()
                        # Apply formula standardization to final answer
                        try:
                            final_answer = normalize_math_formulas(final_answer)
                        except Exception as e:
                            logger.warning(f"Formula conversion failed, using original answer: {str(e)}")
                        response_data = {"type": "answer", "content": final_answer}
                        logger.info(f"Sending final answer: {response_data['content'][:50]}...")
                        yield f"event: answer\ndata: {json.dumps(response_data)}\n\n".encode('utf-8')
                        continue
                        
                    else:
                        # Determine if this is a temporary thought using keyword matching
                        is_temporary = temp_status  # Use the temporary flag from callback
                        matched_keyword = None
                        
                        # Define keywords that indicate temporary thoughts
                        temp_keywords = [
                            "Loading and processing documents",
                            "Document loading and processing",
                            "[TEMP:",
                            "Processing file",
                            "Analyzing content",
                            "Extracting information"
                        ]
                        
                        # Check for temporary keywords only if not already marked as temporary
                        if not is_temporary:
                            for keyword in temp_keywords:
                                if keyword in thought:
                                    matched_keyword = keyword
                                    is_temporary = True
                                    break
                                    
                            logger.info(f"Temporary thought judgment: original temp flag={temp_status}, keyword match={is_temporary}, matched keyword={matched_keyword}")
                        
                        # Stream thinking process - immediately send each thought
                        response_data = {
                            "type": "thinking", 
                            "content": thought,
                            "temporary": is_temporary  # Add the temporary flag
                        }
                        
                        # DataMosaic mode: collect all thought process to history
                        thought_process.append(thought)
                        
                        logger.info(f"Sending thought step: {response_data['content'][:50]}... {'(temporary)' if is_temporary else '(regular)'}")
                        
                        # Send data using SSE format
                        yield f"event: thinking\ndata: {json.dumps(response_data)}\n\n".encode('utf-8')
                        
                        # Reset temporary status for next thought
                        temp_status = False
            
            # Save AI reply to chat history, including thought process
            logger.info(f"Stream processing ended - chat_id: {chat_id}, final_answer length: {len(final_answer) if final_answer else 0}, thought_process steps: {len(thought_process)}")
            
            if chat_id:
                additional_data = {
                    'model': model,
                    'data_mosaic_enabled': data_mosaic_enabled  # Save DataMosaic status
                }
                
                # Determine content to save
                answer_content = final_answer
                
                # Special handling in DataMosaic mode
                if data_mosaic_enabled:
                    additional_data['thought_process'] = thought_process
                    
                    # If no final_answer, use thought process as answer content
                    if not final_answer and thought_process:
                        # Clean thought process, extract pure text content as final answer
                        cleaned_thoughts = []
                        for thought in thought_process:
                            # Remove various markers, keep only pure text
                            cleaned_thought = thought
                            # Remove temporary markers
                            cleaned_thought = cleaned_thought.replace('[TEMP:]', '').strip()
                            # Remove other markers
                            cleaned_thought = cleaned_thought.replace('[THINKING]', '').replace('[REASON]', '').strip()
                            cleaned_thought = cleaned_thought.replace('[SEARCH]', '').strip()
                            cleaned_thought = cleaned_thought.replace('[EXTRACT]', '').strip()
                            cleaned_thought = cleaned_thought.replace('[VERIFY]', '').strip()
                            cleaned_thought = cleaned_thought.replace('[DECISION]', '').strip()
                            cleaned_thought = cleaned_thought.replace('[REFINE]', '').strip()
                            
                            if cleaned_thought:
                                cleaned_thoughts.append(cleaned_thought)
                        
                        # Use cleaned thought process as answer content
                        if cleaned_thoughts:
                            answer_content = '\n\n'.join(cleaned_thoughts)
                            logger.info(f"DataMosaic mode - Using {len(cleaned_thoughts)} thought steps as final answer, total length: {len(answer_content)}")
                        else:
                            answer_content = "[Thought process completed, but no valid content]"
                            logger.warning("DataMosaic mode - Thought process contains no valid content")
                    
                    logger.info(f"DataMosaic mode - Saving {len(thought_process)} thought steps")
                else:
                    logger.info(f"Simple QA mode - No thought process")
                
                # Ensure there is content to save
                if not answer_content:
                    answer_content = "[Reply generation failed]"
                
                save_chat_message(chat_id, 'assistant', answer_content, additional_data, project_id)
                logger.info(f"Saved AI reply to chat history: {chat_id}, content length: {len(answer_content)}")
            else:
                logger.warning("chat_id is empty, unable to save chat history")
            
            # Send end event
            yield "event: end\ndata: {}\n\n".encode('utf-8')
        
        return Response(generate(), mimetype='text/plain')
    
    # For non-streaming responses (fallback)
    else:
        logger.info("Using non-streaming processing mode")
        try:
            # Convert relative paths to absolute paths for document processing
            absolute_file_paths = [to_absolute_path(fp) for fp in file_paths] if file_paths else []
            
            # Use the simple QA workflow for non-streaming
            result = execute_document_qa_workflow(
                query, 
                absolute_file_paths, 
                model=model,  # Use selected model
                custom_params={"doc_manager": doc_manager, "chat_context": chat_context}
            )
            
            # Extract pure text answer
            if isinstance(result, dict) and 'answer' in result:
                answer_text = result['answer']
            else:
                answer_text = str(result)
            
            # Save AI reply to chat history
            if chat_id:
                additional_data = {'model': model}
                # If result contains thought process, also save it
                if isinstance(result, dict) and 'thought_process' in result:
                    additional_data['thought_process'] = result['thought_process']
                save_chat_message(chat_id, 'assistant', answer_text, additional_data, project_id)
                logger.info(f"Saved AI reply to chat history: {chat_id}")
            
            return jsonify({
                "answer": answer_text,
                "status": "success"
            })
        except Exception as e:
            logger.error(f"Non-streaming processing error: {str(e)}")
            return jsonify({"error": str(e)}), 500

@app.route('/api/files', methods=['GET'])
@app.route('/api/projects/<project_id>/files', methods=['GET'])
def list_files(project_id=None):
    files = []
    
    # Use project-specific upload folder if project_id is provided
    if project_id:
        upload_folder = os.path.join(get_project_path(project_id), 'uploads')
    else:
        upload_folder = app.config['UPLOAD_FOLDER']
    
    if os.path.exists(upload_folder):
        for filename in os.listdir(upload_folder):
            if allowed_file(filename):
                filepath = os.path.join(upload_folder, filename)
                files.append({
                    "filename": filename,
                    "filepath": to_relative_path(filepath),
                    "size": os.path.getsize(filepath)
                })
    
    return jsonify({"files": files}), 200

@app.route('/api/files/delete', methods=['POST'])
@app.route('/api/projects/<project_id>/files/delete', methods=['POST'])
def delete_file(project_id=None):
    data = request.json
    
    if not data or 'filepath' not in data:
        return jsonify({"error": "No filepath provided"}), 400
    
    filepath = data['filepath']
    
    try:
        # Convert relative path to absolute path if needed
        absolute_filepath = to_absolute_path(filepath)
        
        # Verify file path is within allowed directory
        if project_id:
            allowed_upload_folder = os.path.join(get_project_path(project_id), 'uploads')
        else:
            allowed_upload_folder = app.config['UPLOAD_FOLDER']
            
        if not os.path.abspath(absolute_filepath).startswith(os.path.abspath(allowed_upload_folder)):
            return jsonify({"error": "File path not allowed"}), 403
            
        if os.path.exists(absolute_filepath) and os.path.isfile(absolute_filepath):
            os.remove(absolute_filepath)
            return jsonify({"message": "File deleted successfully"}), 200
        else:
            return jsonify({"error": "File not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/reload-index', methods=['POST'])
def reload_index():
    """Endpoint to reload documents for LLM-based retrieval (FAISS no longer used)"""
    global doc_manager
    
    try:
        logger.info("Reloading documents for LLM retrieval...")
        
        # Get all uploaded file paths
        all_document_paths = []
        if os.path.exists(app.config['UPLOAD_FOLDER']):
            for filename in os.listdir(app.config['UPLOAD_FOLDER']):
                if allowed_file(filename):
                    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    all_document_paths.append(filepath)
        
        logger.info(f"Found {len(all_document_paths)} document files to load")
        
        if all_document_paths:
            # Reinitialize doc_manager
            doc_manager = DocumentManager()
            
            # Load all documents (no longer need FAISS index)
            documents = doc_manager.load_documents(all_document_paths)
            if documents:
                logger.info(f"Successfully loaded {len(documents)} document chunks for LLM retrieval")
                return jsonify({"message": f"Successfully loaded {len(documents)} document chunks from {len(all_document_paths)} files, using LLM retrieval"}), 200
            else:
                logger.warning("Unable to load any documents")
                return jsonify({"warning": "Unable to load any documents"}), 200
        else:
            logger.warning("No document files found")
            return jsonify({"warning": "No document files found, will load when processing new documents"}), 200
                
    except Exception as e:
        logger.error(f"Error reloading documents: {str(e)}")
        return jsonify({"error": f"Failed to reload documents: {str(e)}"}), 500

@app.route('/api/files/content', methods=['GET'])
@app.route('/api/projects/<project_id>/files/content', methods=['GET'])
def get_file_content(project_id=None):
    """Endpoint to read file content for display in the file reader"""
    filepath = request.args.get('filepath')
    
    if not filepath:
        return jsonify({"error": "No filepath provided"}), 400
    
    try:
        # Convert relative path to absolute path if needed
        absolute_filepath = to_absolute_path(filepath)
        
        # Verify file path is within allowed upload directory
        # Use project-specific upload folder if project_id is provided
        if project_id:
            allowed_upload_folder = os.path.join(get_project_path(project_id), 'uploads')
        else:
            allowed_upload_folder = app.config['UPLOAD_FOLDER']
            
        if not os.path.abspath(absolute_filepath).startswith(os.path.abspath(allowed_upload_folder)):
            return jsonify({"error": "File path not allowed"}), 403
        
        if not os.path.exists(absolute_filepath) or not os.path.isfile(absolute_filepath):
            return jsonify({"error": "File not found"}), 404
        
        # Check file extension
        filename = os.path.basename(absolute_filepath)
        if not allowed_file(filename):
            return jsonify({"error": "File type not supported"}), 400
        
        # Get file extension
        file_extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        
        # Read content based on file type
        if file_extension in ['txt', 'md', 'csv']:
            # Plain text files, read directly
            try:
                # Try multiple encodings
                encodings = ['utf-8', 'gbk', 'gb2312', 'latin-1']
                content = None
                used_encoding = None
                
                for encoding in encodings:
                    try:
                        with open(absolute_filepath, 'r', encoding=encoding) as f:
                            content = f.read()
                        used_encoding = encoding
                        break
                    except UnicodeDecodeError:
                        continue
                
                if content is None:
                    return jsonify({"error": "Unable to decode file"}), 500
                
                logger.info(f"Successfully read file {filename}, using encoding: {used_encoding}")
                
                return jsonify({
                    "content": content,
                    "filename": filename,
                    "file_type": file_extension,
                    "encoding": used_encoding
                }), 200
                
            except Exception as e:
                logger.error(f"Error reading text file: {str(e)}")
                return jsonify({"error": f"Failed to read text file: {str(e)}"}), 500
        
        elif file_extension == 'pdf':
            # PDF files, use document manager to extract text
            try:
                # Use document manager's PDF processing functionality
                text_content = doc_manager.extract_text_from_pdf(absolute_filepath)
                
                if not text_content:
                    return jsonify({"error": "Failed to extract text from PDF"}), 500
                
                logger.info(f"Successfully extracted text content from PDF file {filename}")
                
                return jsonify({
                    "content": text_content,
                    "filename": filename,
                    "file_type": file_extension
                }), 200
                
            except Exception as e:
                logger.error(f"Error extracting PDF text: {str(e)}")
                return jsonify({"error": f"Failed to extract PDF text: {str(e)}"}), 500
        
        elif file_extension in ['xlsx', 'xls']:
            # Excel files, convert to CSV format for display
            try:
                import pandas as pd
                
                # Read Excel file
                df = pd.read_excel(absolute_filepath)
                
                # Convert to CSV string
                csv_content = df.to_csv(index=False)
                
                logger.info(f"Successfully read Excel file {filename} and converted to CSV format")
                
                return jsonify({
                    "content": csv_content,
                    "filename": filename,
                    "file_type": "csv"  # Return csv type so frontend displays table correctly
                }), 200
                
            except Exception as e:
                logger.error(f"Error reading Excel file: {str(e)}")
                return jsonify({"error": f"Failed to read Excel file: {str(e)}"}), 500
        
        else:
            return jsonify({"error": f"Unsupported file type: {file_extension}"}), 400
    
    except Exception as e:
        logger.error(f"Error reading file content: {str(e)}")
        return jsonify({"error": f"Failed to read file: {str(e)}"}), 500

# =================== Chat History Related APIs ===================

@app.route('/api/chat/new', methods=['POST'])
@app.route('/api/projects/<project_id>/chat/new', methods=['POST'])
def create_new_chat(project_id=None):
    """Create new chat session"""
    try:
        # Generate unique chat ID
        chat_id = str(uuid.uuid4())
        
        return jsonify({
            'id': chat_id,
            'title': 'New Conversation',
            'message_count': 0,
            'created_at': datetime.datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error creating new chat: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/history', methods=['GET'])
@app.route('/api/projects/<project_id>/chat/history', methods=['GET'])
def get_chat_history_list(project_id=None):
    """Get list of all chat histories"""
    try:
        history_list = []
        
        # Use project-specific chat history folder if project_id is provided
        if project_id:
            history_dir = os.path.join(get_project_path(project_id), 'chat_history')
        else:
            history_dir = HISTORY_DIR
        
        # Iterate through all files in history directory
        if os.path.exists(history_dir):
            for filename in os.listdir(history_dir):
                # Skip cache files
                if filename == "__history_cache.json":
                    continue
                    
                if filename.endswith('.json'):
                    chat_id = filename[:-5]  # Remove .json extension
                    chat_file = os.path.join(history_dir, filename)
                    
                    try:
                        with open(chat_file, 'r', encoding='utf-8') as f:
                            chat_data = json.load(f)
                        
                        # First check if there's a custom title
                        custom_title = None
                        if chat_data and isinstance(chat_data, list) and len(chat_data) > 0:
                            # Look for system message containing title
                            for message in chat_data:
                                if (isinstance(message, dict) and 
                                    message.get('role') == 'system' and 
                                    'title' in message):
                                    custom_title = message['title']
                                    break
                        
                        # If no custom title, use first user message as title
                        title = "New Conversation"
                        if custom_title:
                            title = custom_title
                        else:
                            for message in chat_data:
                                if (isinstance(message, dict) and 
                                    message.get('role') == 'user' and 
                                    'content' in message):
                                    content = message['content']
                                    title = content[:30] + ('...' if len(content) > 30 else '')
                                    break
                        
                        # Get timestamp of last message as update time
                        updated_at = None
                        if chat_data and isinstance(chat_data, list) and len(chat_data) > 0:
                            for message in reversed(chat_data):
                                if isinstance(message, dict) and 'timestamp' in message:
                                    updated_at = message['timestamp']
                                    break
                        
                        if not updated_at:
                            # If no timestamp, use file modification time
                            updated_at = datetime.datetime.fromtimestamp(
                                os.path.getmtime(chat_file)
                            ).isoformat()
                        
                        history_list.append({
                            'id': chat_id,
                            'title': title,
                            'message_count': len(chat_data),
                            'updated_at': updated_at
                        })
                    except Exception as e:
                        logger.error(f"Error reading chat history file {filename}: {str(e)}")
        
        # Sort by update time, newest first
        history_list.sort(key=lambda x: x['updated_at'] if x['updated_at'] else '', reverse=True)
        
        return jsonify(history_list)
    except Exception as e:
        logger.error(f"Error getting chat history list: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/history/<chat_id>', methods=['GET'])
@app.route('/api/projects/<project_id>/chat/history/<chat_id>', methods=['GET'])
def get_chat_history(chat_id, project_id=None):
    """Get history of specific chat"""
    try:
        # If it's a cache ID, return error directly
        if chat_id == "__history_cache":
            return jsonify({'error': 'Invalid chat ID'}), 400
        
        # Use project-specific chat history folder if project_id is provided
        if project_id:
            history_dir = os.path.join(get_project_path(project_id), 'chat_history')
        else:
            history_dir = HISTORY_DIR
            
        chat_file = os.path.join(history_dir, f"{chat_id}.json")
        
        if not os.path.exists(chat_file):
            return jsonify({'error': 'Chat history does not exist'}), 404
        
        try:
            with open(chat_file, 'r', encoding='utf-8') as f:
                chat_history = json.load(f)
            
            # Validate data format
            if not isinstance(chat_history, list):
                return jsonify({'error': 'Invalid chat history format'}), 500
                
            # Validate each message format
            for i, message in enumerate(chat_history):
                if not isinstance(message, dict):
                    chat_history[i] = {
                        'role': 'system', 
                        'content': 'Message format error', 
                        'timestamp': datetime.datetime.now().isoformat()
                    }
                    continue
                    
                if 'role' not in message:
                    message['role'] = 'system'
                if 'content' not in message:
                    message['content'] = 'Message content missing'
                if 'timestamp' not in message:
                    message['timestamp'] = datetime.datetime.now().isoformat()
                if 'message_id' not in message:
                    message['message_id'] = str(uuid.uuid4())
            
            return jsonify(chat_history)
        except json.JSONDecodeError:
            # JSON parsing error, return empty chat history
            return jsonify([])
    except Exception as e:
        logger.error(f"Error getting chat history: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/rename/<chat_id>', methods=['POST'])
@app.route('/api/projects/<project_id>/chat/rename/<chat_id>', methods=['POST'])
def rename_chat(chat_id, project_id=None):
    """Rename chat session"""
    try:
        data = request.json
        new_title = data.get('title')
        
        if not new_title:
            return jsonify({'error': 'Title cannot be empty'}), 400
        
        # Use project-specific chat history folder if project_id is provided
        if project_id:
            history_dir = os.path.join(get_project_path(project_id), 'chat_history')
        else:
            history_dir = HISTORY_DIR
            
        chat_file = os.path.join(history_dir, f"{chat_id}.json")
        
        if not os.path.exists(chat_file):
            return jsonify({'error': 'Chat history does not exist'}), 404
            
        # Read chat history
        with open(chat_file, 'r', encoding='utf-8') as f:
            chat_history = json.load(f)
            
        # Add or update title metadata
        title_found = False
        for i, message in enumerate(chat_history):
            if (isinstance(message, dict) and 
                message.get('role') == 'system' and 
                'title' in message):
                # If title metadata already exists, update it
                chat_history[i]['title'] = new_title
                title_found = True
                break
                
        if not title_found:
            # Otherwise, add a system message as metadata
            chat_history.insert(0, {
                'role': 'system',
                'content': 'Chat title metadata',
                'title': new_title,
                'timestamp': datetime.datetime.now().isoformat(),
                'message_id': str(uuid.uuid4())
            })
            
        # Save updated chat history
        with open(chat_file, 'w', encoding='utf-8') as f:
            json.dump(chat_history, f, ensure_ascii=False, indent=2)
            
        return jsonify({'success': True, 'title': new_title})
    except Exception as e:
        logger.error(f"Error renaming chat: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/delete/<chat_id>', methods=['DELETE'])
@app.route('/api/projects/<project_id>/chat/delete/<chat_id>', methods=['DELETE'])
def delete_chat(chat_id, project_id=None):
    """Delete chat session"""
    try:
        # Use project-specific chat history folder if project_id is provided
        if project_id:
            history_dir = os.path.join(get_project_path(project_id), 'chat_history')
        else:
            history_dir = HISTORY_DIR
            
        chat_file = os.path.join(history_dir, f"{chat_id}.json")
        
        if not os.path.exists(chat_file):
            return jsonify({'error': 'Chat history does not exist'}), 404
            
        # Delete file
        os.remove(chat_file)
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error deleting chat: {str(e)}")
        return jsonify({'error': str(e)}), 500

def save_chat_message(chat_id, role, content, additional_data=None, project_id=None):
    """Save chat message to history, supporting multi-turn conversations"""
    if not chat_id:
        return None
    
    # Use project-specific chat history folder if project_id is provided
    if project_id:
        history_dir = os.path.join(get_project_path(project_id), 'chat_history')
        os.makedirs(history_dir, exist_ok=True)
    else:
        history_dir = HISTORY_DIR
        
    chat_file = os.path.join(history_dir, f"{chat_id}.json")
    
    # Read existing history
    chat_history = []
    if os.path.exists(chat_file):
        try:
            with open(chat_file, 'r', encoding='utf-8') as f:
                chat_history = json.load(f)
        except Exception as e:
            logger.error(f"Error reading chat history: {e}")
            chat_history = []
    
    # Apply formula standardization to AI assistant replies
    processed_content = content
    if role == 'assistant':
        try:
            processed_content = normalize_formulas(content)
            if processed_content != content:
                logger.info("Successfully converted LaTeX formulas to standard Markdown format")
        except Exception as e:
            logger.warning(f"Formula conversion failed, using original content: {str(e)}")
            processed_content = content
    
    # Create new message
    message = {
        'role': role,
        'content': processed_content,
        'timestamp': datetime.datetime.now().isoformat(),
        'message_id': str(uuid.uuid4())  # Add unique ID for each message
    }
    
    if additional_data:
        message['additional_data'] = additional_data
    
    # Append new message to history
    chat_history.append(message)
    
    # Save updated history
    try:
        with open(chat_file, 'w', encoding='utf-8') as f:
            json.dump(chat_history, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved message to chat {chat_id}, total messages: {len(chat_history)}")
    except Exception as e:
        logger.error(f"Error saving chat message: {e}")
    
    return message

def load_chat_history(chat_id, project_id=None):
    """Load chat history"""
    if not chat_id:
        return []
    
    # Use project-specific chat history folder if project_id is provided
    if project_id:
        history_dir = os.path.join(get_project_path(project_id), 'chat_history')
    else:
        history_dir = HISTORY_DIR
        
    chat_file = os.path.join(history_dir, f"{chat_id}.json")
    
    if not os.path.exists(chat_file):
        return []
        
    try:
        with open(chat_file, 'r', encoding='utf-8') as f:
            chat_history = json.load(f)
        return chat_history
    except Exception as e:
        logger.error(f"Error loading chat history: {e}")
        return []

def get_chat_context(chat_id, max_history=10, project_id=None):
    """Get chat context for constructing conversation history"""
    chat_history = load_chat_history(chat_id, project_id)
    
    # Get recent history, but not more than max_history entries
    recent_history = chat_history[-max_history:] if len(chat_history) > max_history else chat_history
    
    # Build context strings
    context_messages = []
    for msg in recent_history:
        if msg['role'] == 'user':
            context_messages.append(f"User: {msg['content']}")
        elif msg['role'] == 'assistant':
            context_messages.append(f"Assistant: {msg['content']}")
    
    return context_messages

@app.route('/api/chat/edit/<chat_id>/<int:message_index>', methods=['POST'])
@app.route('/api/projects/<project_id>/chat/edit/<chat_id>/<int:message_index>', methods=['POST'])
def edit_message(chat_id, message_index, project_id=None):
    """Edit specified message"""
    try:
        data = request.json
        new_content = data.get('content', '').strip()
        
        if not new_content:
            return jsonify({'error': 'Message content cannot be empty'}), 400
        
        chat_history = load_chat_history(chat_id, project_id)
        
        if message_index < 0 or message_index >= len(chat_history):
            return jsonify({'error': 'Invalid message index'}), 400
        
        target_message = chat_history[message_index]
        
        # Only allow editing user messages
        if target_message['role'] != 'user':
            return jsonify({'error': 'Only user messages can be edited'}), 400
        
        # Truncate history: remove this message and all following messages
        chat_history = chat_history[:message_index]
        
        # Add edited user message
        edited_message = {
            'role': 'user',
            'content': new_content,
            'timestamp': datetime.datetime.now().isoformat(),
            'message_id': str(uuid.uuid4()),
            'edited_at': datetime.datetime.now().isoformat()
        }
        
        # If original message had additional data, keep it
        if 'additional_data' in target_message:
            edited_message['additional_data'] = target_message['additional_data']
            
        chat_history.append(edited_message)
        
        # Save updated history
        if project_id:
            history_dir = os.path.join(get_project_path(project_id), 'chat_history')
        else:
            history_dir = HISTORY_DIR
        chat_file = os.path.join(history_dir, f"{chat_id}.json")
        with open(chat_file, 'w', encoding='utf-8') as f:
            json.dump(chat_history, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True,
            'message': 'Message edited successfully',
            'updated_history': chat_history
        })
        
    except Exception as e:
        logger.error(f"Error editing message: {str(e)}")
        return jsonify({'error': f'Failed to edit message: {str(e)}'}), 500

# =================== Project Management APIs ===================

# Configure projects folder
PROJECTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'projects')
os.makedirs(PROJECTS_DIR, exist_ok=True)

def get_project_path(project_id):
    """Get project file path"""
    return os.path.join(PROJECTS_DIR, project_id)

def get_project_config_path(project_id):
    """Get project config file path"""
    return os.path.join(get_project_path(project_id), 'config.json')

def create_project_structure(project_id):
    """Create project folder structure"""
    project_path = get_project_path(project_id)
    os.makedirs(project_path, exist_ok=True)
    os.makedirs(os.path.join(project_path, 'uploads'), exist_ok=True)
    os.makedirs(os.path.join(project_path, 'chat_history'), exist_ok=True)
    os.makedirs(os.path.join(project_path, 'faiss_index'), exist_ok=True)

@app.route('/api/projects', methods=['GET'])
def get_projects():
    """Get all project list"""
    try:
        projects = []
        
        if not os.path.exists(PROJECTS_DIR):
            return jsonify({'projects': projects})
        
        for project_id in os.listdir(PROJECTS_DIR):
            project_path = get_project_path(project_id)
            config_path = get_project_config_path(project_id)
            
            if os.path.isdir(project_path) and os.path.exists(config_path):
                try:
                    with open(config_path, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                    
                    # Count chat records and get last chat time
                    chat_history_path = os.path.join(project_path, 'chat_history')
                    chat_count = 0
                    last_chat_time = None
                    
                    if os.path.exists(chat_history_path):
                        chat_files = [f for f in os.listdir(chat_history_path) if f.endswith('.json')]
                        chat_count = len(chat_files)
                        
                        # Get last chat time
                        for filename in chat_files:
                            chat_file = os.path.join(chat_history_path, filename)
                            try:
                                with open(chat_file, 'r', encoding='utf-8') as f:
                                    chat_data = json.load(f)
                                
                                # Get last message timestamp
                                if chat_data and isinstance(chat_data, list) and len(chat_data) > 0:
                                    for message in reversed(chat_data):
                                        if isinstance(message, dict) and 'timestamp' in message:
                                            message_time = message['timestamp']
                                            if not last_chat_time or message_time > last_chat_time:
                                                last_chat_time = message_time
                                            break
                            except Exception as e:
                                logger.error(f"Error reading chat file {filename}: {str(e)}")
                                continue
                    
                    # Count document number
                    uploads_path = os.path.join(project_path, 'uploads')
                    document_count = 0
                    if os.path.exists(uploads_path):
                        document_count = len([f for f in os.listdir(uploads_path) if f != '.gitkeep'])
                    
                    project = {
                        'id': project_id,
                        'name': config.get('name', project_id),
                        'description': config.get('description', ''),
                        'created_at': config.get('created_at', ''),
                        'last_modified': config.get('last_modified', ''),
                        'last_chat_time': last_chat_time,  # Add last chat time
                        'chat_count': chat_count,
                        'document_count': document_count
                    }
                    projects.append(project)
                except Exception as e:
                    logger.error(f"Error reading project config {project_id}: {str(e)}")
                    continue
        
        # Sort by last chat time, no chat records project at the end
        def sort_key(project):
            last_chat_time = project.get('last_chat_time')
            if last_chat_time:
                return (1, last_chat_time)  # Chat records project, reverse time
            else:
                return (0, project.get('created_at', ''))  # No chat records project, sort by creation time, at the end
        
        projects.sort(key=sort_key, reverse=True)
        
        return jsonify({'projects': projects})
    
    except Exception as e:
        logger.error(f"Error fetching projects: {str(e)}")
        return jsonify({'error': f'Failed to fetch projects: {str(e)}'}), 500

@app.route('/api/projects', methods=['POST'])
def create_project():
    """Create new project"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        
        if not name:
            return jsonify({'error': 'Project name is required'}), 400
        
        # Generate project ID
        project_id = str(uuid.uuid4())
        
        # Create project structure
        create_project_structure(project_id)
        
        # Create project config
        config = {
            'id': project_id,
            'name': name,
            'description': description,
            'created_at': datetime.datetime.now().isoformat(),
            'last_modified': datetime.datetime.now().isoformat()
        }
        
        config_path = get_project_config_path(project_id)
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Created new project: {name} ({project_id})")
        
        return jsonify({
            'success': True,
            'message': 'Project created successfully',
            'project': config
        })
    
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        return jsonify({'error': f'Failed to create project: {str(e)}'}), 500

@app.route('/api/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    """Update project information"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        
        if not name:
            return jsonify({'error': 'Project name is required'}), 400
        
        config_path = get_project_config_path(project_id)
        
        if not os.path.exists(config_path):
            return jsonify({'error': 'Project not found'}), 404
        
        # Read existing config
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # Update config
        config['name'] = name
        config['description'] = description
        config['last_modified'] = datetime.datetime.now().isoformat()
        
        # Save config
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Updated project: {name} ({project_id})")
        
        return jsonify({
            'success': True,
            'message': 'Project updated successfully',
            'project': config
        })
    
    except Exception as e:
        logger.error(f"Error updating project: {str(e)}")
        return jsonify({'error': f'Failed to update project: {str(e)}'}), 500

@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete project"""
    try:
        project_path = get_project_path(project_id)
        
        if not os.path.exists(project_path):
            return jsonify({'error': 'Project not found'}), 404
        
        # Delete project folder and all contents
        import shutil
        shutil.rmtree(project_path)
        
        logger.info(f"Deleted project: {project_id}")
        
        return jsonify({
            'success': True,
            'message': 'Project deleted successfully'
        })
    
    except Exception as e:
        logger.error(f"Error deleting project: {str(e)}")
        return jsonify({'error': f'Failed to delete project: {str(e)}'}), 500

# =================== Settings Related APIs ===================

@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    """Handle model settings get and update"""
    
    if request.method == 'GET':
        try:
            # Read current model settings from global_config.py
            model_param = request.args.get('model')
            if model_param:
                current_model = model_param
            else:
                # Import global config module
                import sys
                llm_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'llm')
                if llm_path not in sys.path:
                    sys.path.append(llm_path)
                
                try:
                    from global_config import get_model
                    current_model = get_model()
                except ImportError:
                    current_model = 'gpt-4o'  # Default model
            
            # Read .env file to get API key and URL
            env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'llm', '.env')
            env_settings = {}
            if os.path.exists(env_path):
                with open(env_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and '=' in line and not line.startswith('#'):
                            key, value = line.split('=', 1)
                            env_settings[key.strip()] = value.strip()
            
            # Build settings object
            settings = {
                'model': current_model,
                'api_key': env_settings.get('API_KEY', ''),
                'api_url': env_settings.get('API_URL', ''),
                'is_structure': False,
                'is_transform': False
            }
            
            # If there are other config file storage settings, read them here
            config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json')
            if os.path.exists(config_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    saved_settings = json.load(f)
                    # Only update is_structure and is_transform etc other settings
                    for key in saved_settings:
                        if key not in ['model', 'api_key', 'api_url']:
                            settings[key] = saved_settings[key]
            
            logger.info(f"Get settings: {settings}")
            return jsonify(settings)
        except Exception as e:
            logger.error(f"Error reading settings: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.json
            
            # Update model settings to global_config.py
            if 'model' in data:
                import sys
                llm_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'llm')
                if llm_path not in sys.path:
                    sys.path.append(llm_path)
                
                try:
                    from global_config import set_model
                    set_model(data['model'])
                    logger.info(f"Model settings updated to: {data['model']}")
                except ImportError:
                    logger.warning("Cannot import global_config module")
            
            # Update API key and URL to .env file
            if 'api_key' in data or 'api_url' in data:
                env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'llm', '.env')
                env_content = {}
                
                # First read existing content
                if os.path.exists(env_path):
                    with open(env_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            line = line.strip()
                            if line and '=' in line and not line.startswith('#'):
                                key, value = line.split('=', 1)
                                env_content[key.strip()] = value.strip()
                
                # Update content
                if 'api_key' in data:
                    env_content["API_KEY"] = data['api_key']
                if 'api_url' in data:
                    env_content["API_URL"] = data['api_url']
                
                # Ensure directory exists
                os.makedirs(os.path.dirname(env_path), exist_ok=True)
                
                # Write back file
                with open(env_path, 'w', encoding='utf-8') as f:
                    for key, value in env_content.items():
                        f.write(f"{key}={value}\n")
                
                logger.info(f"API settings updated to .env file")
            
            # Save other settings to config.json
            other_settings = {k: v for k, v in data.items() if k not in ['api_key', 'api_url']}
            
            if other_settings:
                config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json')
                existing_config = {}
                if os.path.exists(config_path):
                    with open(config_path, 'r', encoding='utf-8') as f:
                        try:
                            existing_config = json.load(f)
                        except:
                            pass
                
                existing_config.update(other_settings)
                with open(config_path, 'w', encoding='utf-8') as f:
                    json.dump(existing_config, f, ensure_ascii=False, indent=2)
                
                logger.info(f"Other settings updated: {other_settings}")
            
            return jsonify({'success': True})
        except Exception as e:
            logger.error(f"Error updating settings: {str(e)}")
            return jsonify({'error': str(e)}), 500

@app.route('/api/public-files', methods=['GET'])
def list_public_files():
    """Get public_files folder file list"""
    files = []
    public_files_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public_files')
    
    if os.path.exists(public_files_folder):
        for filename in os.listdir(public_files_folder):
            filepath = os.path.join(public_files_folder, filename)
            if os.path.isfile(filepath) and allowed_file(filename):
                files.append({
                    "filename": filename,
                    "filepath": filepath,
                    "size": os.path.getsize(filepath)
                })
    
    return jsonify({"files": files}), 200

@app.route('/api/public-files/import', methods=['POST'])
@app.route('/api/projects/<project_id>/public-files/import', methods=['POST'])
def import_public_files(project_id=None):
    """Import files from public_files folder to user uploads folder"""
    data = request.json
    
    if not data or 'filepaths' not in data:
        return jsonify({"error": "No filepaths provided"}), 400
    
    source_filepaths = data['filepaths']
    if not isinstance(source_filepaths, list) or len(source_filepaths) == 0:
        return jsonify({"error": "Invalid filepaths format"}), 400
    
    public_files_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public_files')
    
    # Get target uploads folder
    if project_id:
        target_folder = os.path.join(get_project_path(project_id), 'uploads')
    else:
        target_folder = app.config['UPLOAD_FOLDER']
    
    # Ensure target folder exists
    os.makedirs(target_folder, exist_ok=True)
    
    imported_files = []
    existing_files = []
    failed_files = []
    
    try:
        import shutil
        
        for source_filepath in source_filepaths:
            try:
                # Verify source file path is in public_files directory
                if not os.path.abspath(source_filepath).startswith(os.path.abspath(public_files_folder)):
                    failed_files.append({
                        "filepath": source_filepath,
                        "error": "Source file path not allowed"
                    })
                    continue
                    
                if not os.path.exists(source_filepath) or not os.path.isfile(source_filepath):
                    failed_files.append({
                        "filepath": source_filepath,
                        "error": "Source file not found"
                    })
                    continue
                
                filename = os.path.basename(source_filepath)
                target_filepath = os.path.join(target_folder, filename)
                
                # Check target file is already exists
                if os.path.exists(target_filepath):
                    existing_files.append({
                        "filename": filename,
                        "filepath": source_filepath,
                        "message": f"File '{filename}' already exists in uploads"
                    })
                    continue
                
                # Copy file to uploads folder
                shutil.copy2(source_filepath, target_filepath)
                
                imported_files.append({
                    "filename": filename,
                    "source_filepath": source_filepath,
                    "target_filepath": target_filepath,
                    "size": os.path.getsize(target_filepath)
                })
                
                logger.info(f"Successfully imported file: {filename}")
                
            except Exception as e:
                failed_files.append({
                    "filepath": source_filepath,
                    "error": str(e)
                })
                logger.error(f"Failed to import file {source_filepath}: {str(e)}")
        
        # Build response
        response_data = {
            "imported": imported_files,
            "existing": existing_files,
            "failed": failed_files,
            "summary": {
                "total": len(source_filepaths),
                "imported_count": len(imported_files),
                "existing_count": len(existing_files),
                "failed_count": len(failed_files)
            }
        }
        
        if imported_files and not existing_files and not failed_files:
            response_data["status"] = "success"
            response_data["message"] = f"Successfully imported {len(imported_files)} files"
        elif imported_files or existing_files:
            response_data["status"] = "partial"
            message_parts = []
            if imported_files:
                message_parts.append(f"Imported {len(imported_files)} files")
            if existing_files:
                message_parts.append(f"{len(existing_files)} files already exist")
            if failed_files:
                message_parts.append(f"{len(failed_files)} failed")
            response_data["message"] = ", ".join(message_parts)
        else:
            response_data["status"] = "error"
            response_data["message"] = "No files were imported successfully"
            return jsonify(response_data), 400
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Import public files error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000) 