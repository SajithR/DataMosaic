import requests
import time
import base64
from openai import OpenAI
from dotenv import dotenv_values
import os
import llm.global_config as global_config

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


def get_answer(content, image=None, system_prompt=None, history=None, model=None): # gpt-4o, gpt-4o-mini, o1

    # Use global config model if not specified
    if model is None:
        model = global_config.get_model()

    # Map model names to OpenAI model names
    if model.lower() == 'gpt':
        model = 'gpt-4o'
    elif 'gpt' in model.lower():
        if 'o1' in model.lower():
            model = 'o1'
        elif '4o-mini' in model.lower():
            model = 'gpt-4o-mini'
        elif '4o' in model.lower():
            model = 'gpt-4o'
        else:
            model = 'gpt-4o'
    else:
        model = 'gpt-4o'

    output = ''
    
    # Build messages array
    if history is None:
        if system_prompt is None:
            if image is None:
                messages = [{"role": "user", "content": content}]
            else:
                base64_image = encode_image(image)
                messages = [{"role": "user", "content": [
                    {'type': 'text', 'text': content},
                    {'type': 'image_url', 'image_url': {'url': f"data:image/jpeg;base64,{base64_image}"}}
                ]}]
        else:
            if image is None:
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content}
                ]
            else:
                base64_image = encode_image(image)
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": [
                        {'type': 'text', 'text': content},
                        {'type': 'image_url', 'image_url': {'url': f"data:image/jpeg;base64,{base64_image}"}}
                    ]}
                ]
    else:
        if system_prompt is None:
            if image is None:
                messages = history + [{"role": "user", "content": content}]
            else:
                base64_image = encode_image(image)
                messages = history + [{"role": "user", "content": [
                    {'type': 'text', 'text': content},
                    {'type': 'image_url', 'image_url': {'url': f"data:image/jpeg;base64,{base64_image}"}}
                ]}]
        else:
            if image is None:
                messages = [{"role": "system", "content": system_prompt}] + history + [
                    {"role": "user", "content": content}
                ]
            else:
                base64_image = encode_image(image)
                messages = [{"role": "system", "content": system_prompt}] + history + [
                    {"role": "user", "content": [
                        {'type': 'text', 'text': content},
                        {'type': 'image_url', 'image_url': {'url': f"data:image/jpeg;base64,{base64_image}"}}
                    ]}
                ]

    # Get API credentials, try new naming first, fallback to old naming
    api_key = config.get("OPENAI_KEY") or config.get("API_KEY")
    base_url = config.get("OPENAI_URL") or config.get("API_URL")
    
    client = OpenAI(api_key=api_key, base_url=base_url)
    
    # Create completion request
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=False
        )
        
        for i in range(3):
            try:
                output = response.choices[0].message.content
                return output
            except:
                time.sleep(5)
    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        for i in range(3):
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    stream=False
                )
                output = response.choices[0].message.content
                return output
            except:
                time.sleep(5)

    return output


def get_answer_stream(content, image=None, system_prompt=None, history=None, model=None, stop_event=None):
    """Streaming version of get_answer that yields chunks of text as they are generated."""
    
    # Use global config model if not specified
    if model is None:
        model = global_config.get_model()

    # Map model names to OpenAI model names
    if model.lower() == 'gpt':
        model = 'gpt-4o'
    elif 'gpt' in model.lower():
        if 'o1' in model.lower():
            model = 'o1'
        elif '4o-mini' in model.lower():
            model = 'gpt-4o-mini'
        elif '4o' in model.lower():
            model = 'gpt-4o'
        else:
            model = 'gpt-4o'
    else:
        model = 'gpt-4o'
    
    # Build messages array (same logic as get_answer)
    if history is None:
        if system_prompt is None:
            if image is None:
                messages = [{"role": "user", "content": content}]
            else:
                base64_image = encode_image(image)
                messages = [{"role": "user", "content": [
                    {'type': 'text', 'text': content},
                    {'type': 'image_url', 'image_url': {'url': f"data:image/jpeg;base64,{base64_image}"}}
                ]}]
        else:
            if image is None:
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content}
                ]
            else:
                base64_image = encode_image(image)
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": [
                        {'type': 'text', 'text': content},
                        {'type': 'image_url', 'image_url': {'url': f"data:image/jpeg;base64,{base64_image}"}}
                    ]}
                ]
    else:
        if system_prompt is None:
            if image is None:
                messages = history + [{"role": "user", "content": content}]
            else:
                base64_image = encode_image(image)
                messages = history + [{"role": "user", "content": [
                    {'type': 'text', 'text': content},
                    {'type': 'image_url', 'image_url': {'url': f"data:image/jpeg;base64,{base64_image}"}}
                ]}]
        else:
            if image is None:
                messages = [{"role": "system", "content": system_prompt}] + history + [
                    {"role": "user", "content": content}
                ]
            else:
                base64_image = encode_image(image)
                messages = [{"role": "system", "content": system_prompt}] + history + [
                    {"role": "user", "content": [
                        {'type': 'text', 'text': content},
                        {'type': 'image_url', 'image_url': {'url': f"data:image/jpeg;base64,{base64_image}"}}
                    ]}
                ]

    # Get API credentials, try new naming first, fallback to old naming
    api_key = config.get("OPENAI_KEY") or config.get("API_KEY")
    base_url = config.get("OPENAI_URL") or config.get("API_URL")
    
    client = OpenAI(api_key=api_key, base_url=base_url)
    
    for i in range(3):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True
            )
            
            for chunk in response:
                # Check if we should stop before yielding
                if stop_event and stop_event.is_set():
                    return
                    
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
            return
            
        except Exception as e:
            print(f"Error in streaming OpenAI API (attempt {i+1}): {e}")
            if i < 2:  # If not the last attempt
                time.sleep(5)
            else:
                yield ' '  # Return empty space if all attempts fail 