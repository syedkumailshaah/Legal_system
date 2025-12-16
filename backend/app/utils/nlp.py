import os
import hashlib
import logging
import httpx
from typing import List, Dict, Any
import pypdf
import re
from ..config import HF_TOKEN

logger = logging.getLogger(__name__)

# UPDATED: Hugging Face API URLs (New Router Address)
API_URL_QA = "https://router.huggingface.co/hf-inference/models/deepset/roberta-base-squad2"
API_URL_SUM = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-cnn"
API_URL_EMBED = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2"

HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"}

async def query_hf_api(url: str, payload: dict) -> Any:
    """Helper to query Hugging Face API asynchronously"""
    if not HF_TOKEN:
        logger.warning("HF_TOKEN not set. AI features will fail or fallback.")
        return None
        
    try:
        async with httpx.AsyncClient(timeout=20.0) as client: # Increased timeout slightly
            response = await client.post(url, headers=HEADERS, json=payload)
            
            if response.status_code != 200:
                logger.error(f"HF API Error {response.status_code}: {response.text}")
                return None
            return response.json()
    except Exception as e:
        logger.error(f"HF API Connection Error: {e}")
        return None

async def create_vector_embedding(text: str) -> List[float]:
    """Get embeddings via API or fallback to hashing if API fails"""
    vector_size = 384
    
    # 1. Try API
    if HF_TOKEN:
        # Note: 'options': {'wait_for_model': True} helps if the model is sleeping
        result = await query_hf_api(API_URL_EMBED, {"inputs": text, "options": {"wait_for_model": True}})
        if result and isinstance(result, list):
            # API might return list of list for batch, or flat list
            if isinstance(result[0], list): 
                return result[0]
            return result
            
    # 2. Fallback: Hashing (Low RAM usage)
    logger.info("Using fallback hashing for embedding.")
    hash_str = hashlib.sha256(text.encode()).hexdigest()
    vector = []
    for i in range(0, min(len(hash_str), vector_size * 2), 2):
        value = (int(hash_str[i:i + 2], 16) / 255.0) * 2 - 1
        vector.append(value)
    while len(vector) < vector_size:
        vector.append(0.0)
    return vector[:vector_size]

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    # Standard math, no changes needed
    import math
    if len(vec1) != len(vec2): return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 == 0 or norm2 == 0: return 0.0
    return dot / (norm1 * norm2)

def extract_text_from_pdf(file_path: str) -> str:
    # PDF extraction requires very little RAM, keeping local
    try:
        text = ""
        with open(file_path, "rb") as f:
            reader = pypdf.PdfReader(f)
            for page in reader.pages:
                text += (page.extract_text() or "") + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"Error reading PDF: {e}")
        return ""

def parse_legal_document(text: str) -> List[Dict[str, Any]]:
    # Regex parsing is lightweight
    sections = []
    lines = text.split("\n")
    # Simplified regex logic for brevity
    current_sec = None
    content = []
    
    for line in lines:
        if "Section" in line or "Article" in line:
            if current_sec:
                sections.append({"section_number": current_sec, "title": f"Section {current_sec}", "content": "\n".join(content)})
            current_sec = line.strip()[:20] # Take first 20 chars as ID
            content = []
        else:
            content.append(line)
            
    if current_sec:
        sections.append({"section_number": current_sec, "title": f"Section {current_sec}", "content": "\n".join(content)})
    elif not sections and text:
        # Fallback if no sections detected
        sections.append({"section_number": "1", "title": "General", "content": text})
        
    return sections

async def generate_llm_answer(question: str, context: str) -> str:
    """Ask Question via API"""
    if not HF_TOKEN:
        return "AI Token missing. Please set HF_TOKEN in environment."
        
    payload = {
        "inputs": {
            "question": question,
            "context": context
        },
        "options": {"wait_for_model": True}
    }
    
    response = await query_hf_api(API_URL_QA, payload)
    
    if response and 'answer' in response:
        return f"AI Answer: {response['answer']} (Score: {response.get('score', 0):.2f})"
    
    # Handle possible model specific error keys
    if response and 'error' in response:
        return f"AI Error: {response['error']}"

    return "I couldn't generate an answer from the provided context."

async def summarize_text(text: str) -> str:
    """Summarize via API"""
    if not HF_TOKEN:
        return text[:200] + "..."
        
    payload = {
        "inputs": text,
        "options": {"wait_for_model": True}
    }
    response = await query_hf_api(API_URL_SUM, payload)
    
    if response and isinstance(response, list) and 'summary_text' in response[0]:
        return response[0]['summary_text']
        
    return text[:200] + "..."