import llm.general as general
import llm.qwen as qwen
import llm.deepseek as deepseek
import llm.gpt as gpt
import llm.global_config as config

from pathlib import Path



def get_answer(question, image=None, history=None, system_prompt=None, model=None):


    if model is None:
        model = config.get_model().lower()

    

    if 'qwen' in model.lower():
        output = qwen.get_answer(question, model=model, history=history)
    elif 'deepseek' in model.lower():
        output = deepseek.get_answer(question, model=model, history=history)
    elif 'gpt' in model.lower() or 'o1' in model.lower():
        output = gpt.get_answer(question, image=image, system_prompt=system_prompt, model=model, history=history)
    else:
        output = general.get_answer(question, model=model, history=history)
    

    return output

def get_answer_stream(question, image=None, history=None, system_prompt=None, model=None, stop_event=None):
    """Streaming version of get_answer that yields chunks of text as they are generated."""
    if model is None:
        model = config.get_model().lower()
    
    if 'qwen' in model.lower():
        output = qwen.get_answer(question, model=model, history=history)
        # Check if we should stop before yielding
        if stop_event and stop_event.is_set():
            return
        yield output
    elif 'deepseek' in model.lower():
        output = deepseek.get_answer(question, model=model, history=history)
        # Check if we should stop before yielding
        if stop_event and stop_event.is_set():
            return
        yield output
    elif 'gpt' in model.lower() or 'o1' in model.lower():
        # Use the streaming version for GPT models
        yield from gpt.get_answer_stream(question, image=image, system_prompt=system_prompt, 
                                        history=history, model=model, stop_event=stop_event)
    else:  
        # Use the streaming version for other models
        yield from general.get_answer_stream(question, image=image, system_prompt=system_prompt, 
                                        history=history, model=model, stop_event=stop_event)


