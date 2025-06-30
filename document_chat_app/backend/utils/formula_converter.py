import re

def latex_to_markdown(text):
    """
    Convert LaTeX format mathematical formulas to standard Markdown format
    
    Args:
        text (str): Text containing LaTeX format formulas
        
    Returns:
        str: Converted Markdown format text
    """
    # Convert standalone formulas: \[ ... \] -> $$ ... $$
    text = re.sub(r'\\\[(.*?)\\\]', r'$$\1$$', text, flags=re.DOTALL)
    
    # Convert inline formulas: \( ... \) -> $ ... $
    text = re.sub(r'\\\((.*?)\\\)', r'$\1$', text, flags=re.DOTALL)
    
    return text

def normalize_formulas(text):
    """
    Standardize mathematical formula formats to ensure correct Markdown rendering
    
    Args:
        text (str): Original text
        
    Returns:
        str: Standardized text
    """
    # First convert LaTeX format
    text = latex_to_markdown(text)
    
    # Ensure standalone formulas have line breaks before and after
    text = re.sub(r'(?<!\n)\$\$', r'\n$$', text)
    text = re.sub(r'\$\$(?!\n)', r'$$\n', text)
    
    # Clean up extra blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text

 