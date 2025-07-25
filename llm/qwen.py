import requests
import time
import base64
from dotenv import dotenv_values
import os
import re
import json
import llm.global_config as global_config

current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, ".env")
config = dotenv_values(env_path)




def count_len(text):
    chinese_count = len(re.findall(r'[\u4e00-\u9fa5]', text))
    word_count = len(re.findall(r'[a-zA-Z]+', text))
    total_count = chinese_count + word_count

    return total_count

current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, ".env")
config = dotenv_values(env_path)



def encode_image(image_path: str) -> str:
    """
    Encodes the image at the given path to a base64-encoded string.

    Args:
        image_path (str): The path to the image file.

    Returns:
        str: The base64-encoded image string.
    """
    with open(image_path, "rb") as image_file:
        image_bytes = image_file.read()
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    return base64_image

def get_answer(text, image=None, system_prompt=None, history=None, model=None):

    output = ' '

    # Use global config model if not specified
    if model is None:
        model = global_config.get_model()

    model_list = ['qwen2.5-7b-instruct','qwen2.5-14b-instruct','qwen2.5-32b-instruct','qwen2.5-72b-instruct', 'qwen2.5-14b-instruct-1m', 'qwen2-72b-instruct', 'qwen-long', 'qwen-turbo']

    if model not in model_list:
        model = 'qwen2.5-14b-instruct'




    if history is None:
        if system_prompt is None:
            if image is None:
                messages = [{"role": "user", "content": text}]
            else:
                base64_image = encode_image(image)
                messages = [{"role": "user", "content": [{'type': 'text','text': text},
                    {'type': 'image_url','image_url': {'url': f"data:image/jpeg;base64,{base64_image}"}}]
                    }
                ]
        else:
            if image is None:
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text},
                ]
            else:
                base64_image = encode_image(image)
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text},
                ]
    else:
        if image is None:
            messages = history + [{"role": "user", "content": text}]
        else:
            base64_image = encode_image(image)
            messages = history + [{"role": "user", "content": [{'type': 'text','text': text},
                    {'type': 'image_url','image_url': {'url': f"data:image/jpeg;base64,{base64_image}"}}]
                    }
                ]


    len_text = count_len(text)

    api_url = config.get("QWEN_URL")
    api_key = config.get("QWEN_KEY")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    data = {
        'model': model,
        'messages': messages,
    }
    
    for i in range(3):
        try:
            response = requests.post(api_url, headers=headers, json=data)
            response = response.json()
            output = response['choices'][0]['message']['content']
            return output
        except:
            time.sleep(5)

    return output

def get_answer_stream(text, image=None, system_prompt=None, history=None, model=None, stop_event=None):
    """Streaming version of get_answer that yields chunks of text as they are generated."""
    
    # Use global config model if not specified
    if model is None:
        model = global_config.get_model()
    
    model_list = ['qwen2.5-7b-instruct','qwen2.5-14b-instruct','qwen2.5-32b-instruct','qwen2.5-72b-instruct', 'qwen2.5-14b-instruct-1m', 'qwen2-7b', 'qwen2-72b-instruct', 'qwen-long', 'qwen-turbo']

    if model not in model_list:
        model = 'qwen2.5-14b-instruct'

    if history is None:
        if system_prompt is None:
            if image is None:
                messages = [{"role": "user", "content": text}]
            else:
                base64_image = encode_image(image)
                messages = [{"role": "user", "content": [{'type': 'text','text': text},
                    {'type': 'image_url','image_url': {'url': f"data:image/jpeg;base64,{base64_image}"}}]
                    }
                ]
        else:
            if image is None:
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text},
                ]
            else:
                base64_image = encode_image(image)
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text},
                ]
    else:
        if image is None:
            messages = history + [{"role": "user", "content": text}]
        else:
            base64_image = encode_image(image)
            messages = history + [{"role": "user", "content": [{'type': 'text','text': text},
                    {'type': 'image_url','image_url': {'url': f"data:image/jpeg;base64,{base64_image}"}}]
                    }
                ]

    len_text = count_len(text)

    api_url = config.get("API_URL")
    api_key = config.get("API_KEY")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    data = {
        'model': model,
        'messages': messages,
        'stream': True  # Enable streaming
    }
    
    for i in range(3):
        try:
            # Use shorter timeout for timely response when client disconnects
            response = requests.post(api_url, headers=headers, json=data, stream=True, timeout=30)
            
            # Process the streaming response
            full_response = ""
            try:
                for line in response.iter_lines():
                    # Check if generation should stop
                    if stop_event and stop_event.is_set():
                        return
                        
                    if not line:
                        continue
                        
                    line = line.decode('utf-8')
                    # Skip the "data: " prefix and empty lines
                    if line.startswith('data: '):
                        line = line[6:]  # Remove 'data: ' prefix
                        if line == '[DONE]':
                            break
                        try:
                            json_line = json.loads(line)
                            if 'choices' in json_line and len(json_line['choices']) > 0:
                                delta = json_line['choices'][0].get('delta', {})
                                if 'content' in delta:
                                    content = delta['content']
                                    full_response += content
                                    yield content
                        except json.JSONDecodeError:
                            continue
            except (requests.exceptions.ChunkedEncodingError, requests.exceptions.ConnectionError, 
                    requests.exceptions.ReadTimeout) as e:
                # These exceptions usually indicate client disconnection
                return
            
            # If we got here without yielding anything, yield the full response
            if not full_response:
                yield ' '
            return
        except requests.exceptions.Timeout:
            return
        except requests.exceptions.ConnectionError:
            return
        except Exception as e:
            time.sleep(5)
    
    yield ' '
