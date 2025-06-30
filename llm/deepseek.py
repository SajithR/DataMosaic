import requests
import time
from openai import OpenAI
from dotenv import dotenv_values
import os
import llm.global_config as global_config

current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, ".env")
config = dotenv_values(env_path)



def get_answer(content, system_prompt=None, history=None, model=None): #deepseek-chat, deepseek-reasoner

    # Use global config model if not specified
    if model is None:
        model = global_config.get_model()

    if model.lower() == 'deepseek-v3':
        model = 'deepseek-chat'
    elif 'deepseek' in model.lower():
        if 'r1' in model.lower():
            model = 'deepseek-reasoner'
        else:
            model = 'deepseek-chat'
    else:
        model = 'deepseek-reasoner'

    output = ''
    if history is None:
        if system_prompt is None:
            messages = [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": content}
            ]
        else:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content},
            ]
    else:
        if system_prompt is None:
            messages = history + [{"role": "user", "content": content}]
        else:
            messages = [{"role": "system", "content": "You are a helpful assistant."}] + history + [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content},
            ]

 
    api_key = config.get("DEEPSEEK_KEY")
    base_url = config.get("DEEPSEEK_URL")
    client = OpenAI(api_key=api_key, base_url=base_url)
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

    return output