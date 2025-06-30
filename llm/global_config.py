# config.py

import json
import os
from pathlib import Path

# Default model value
_model = 'gpt'

def _load_config_from_file():
    """Load configuration from config.json files in known locations"""
    global _model
    
    # Define possible config file locations
    config_locations = [
        # Document chat app backend
        Path(__file__).parent.parent / "document_chat_app" / "backend" / "config.json",
        # Refer code backend
        Path(__file__).parent.parent / "refer_code" / "backend" / "config.json",
        # Current directory
        Path(__file__).parent / "config.json",
        # Parent directory
        Path(__file__).parent.parent / "config.json"
    ]
    
    for config_path in config_locations:
        if config_path.exists():
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    if 'model' in config:
                        _model = config['model']
                        return
            except Exception as e:
                continue

# Load configuration on module import
_load_config_from_file()

def set_model(new_model):
    global _model
    _model = new_model

def get_model():
    """
    Get the current global model value.

    Returns:
        str: The current global model value.
    """
    return _model

def reload_config():
    """Reload configuration from config.json files"""
    _load_config_from_file()
