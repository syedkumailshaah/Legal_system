import os
import logging
from openai import OpenAI

# 1. Setup
logger = logging.getLogger(__name__)

# Replace all local model objects with None or the client
qa_pipeline = None  # No local QA model
summarizer = None  # No local Summarizer model
tokenizer = None  # No local Tokenizer
model = None  # No local LLM

# Initialize the OpenAI Client globally
client = None

def initialize_llm_models():
    """Initializes the OpenAI client using the API key from environment variables."""
    global client
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        client = OpenAI(api_key=api_key)
        logger.info("OpenAI client initialized.")
    else:
        logger.warning("OPENAI_API_KEY not found. LLM functions will use fallback.")

# 2. RAG Generation (Replaces 'qa_pipeline')
def generate_llm_answer(question: str, context: str) -> str:
    """Uses OpenAI API to answer a question based on context."""
    if not client:
        return "AI service is unavailable (API key missing)."

    prompt = f"You are a helpful legal assistant that answers questions based ONLY on the provided legal documents. Use a professional tone.\n\nContext:\n---\n{context}\n---\n\nQuestion: {question}"
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # Fast and cost-effective model
            messages=[
                {"role": "system", "content": "You are a legal Q&A assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0 # Keep it factual
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"OpenAI LLM API call failed: {e}")
        return "Error retrieving answer from AI."

# 3. Summarization (Replaces 'summarizer')
def get_summary(text: str, max_length: int) -> str:
    """Uses OpenAI API to summarize a document."""
    if not client:
        return text[:max_length] # Fallback to extractive
        
    prompt = f"Summarize the following legal text into a concise paragraph of less than {max_length} characters:\n\nTEXT:\n---\n{text}"

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a concise summarization assistant."},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"OpenAI Summarization API call failed: {e}")
        return text[:max_length]

# 4. Chat/General Q&A (Replaces 'tokenizer' and 'model')
def generate_chat_response(message: str, history: list) -> str:
    """Uses OpenAI API for a general chat response."""
    if not client:
        return "I am your legal research assistant. How can I assist you today?"
        
    messages = [{"role": "system", "content": "You are a helpful and polite legal research assistant."}]
    # Add conversation history
    # ... (Logic to parse and add history to messages list)
    messages.append({"role": "user", "content": message})

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"OpenAI Chat API call failed: {e}")
        return "I am currently experiencing technical difficulties. Please try again."

# 5. Embedding (Crucial for the 'search_documents' functionality which is RAG)
# You need to update your 'search_documents' function to use OpenAI's embedding model 
# (e.g., 'text-embedding-ada-002') instead of the local 'sentence-transformers' model.
# If you are using an external vector database (like Pinecone/Qdrant free tier), 
# they often have an easy integration for this step.
# If you are sticking to your Mongo/file-based hybrid search, you'll need this function.
def get_embedding(text: str) -> List[float]:
    """Uses OpenAI API to get the embedding vector for a text string."""
    if not client:
        # Fallback needed if you can't use an external vector DB/search
        return [0.0] * 768 # Dummy vector
        
    try:
        response = client.embeddings.create(
            model="text-embedding-ada-002",
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"OpenAI Embedding API call failed: {e}")
        return [0.0] * 768