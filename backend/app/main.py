from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import logging

from .database import connect_db, create_admin_user, db
from .utils.nlp import initialize_llm_models, qa_pipeline, summarizer
from .routers import auth, documents, search, rag, stats

# Logging Setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    print("\n" + "="*70)
    print("🚀 LEGAL RAG SYSTEM WITH LLM INTEGRATION")
    print("="*70)

    # Initialize LLM models
    initialize_llm_models()

    # Connect to MongoDB
    connect_db()
    
    database_status = "MongoDB Connected" if db is not None else "File-based Storage"
    print(f" Database: {database_status}")

    # Check LLM status
    if qa_pipeline or summarizer:
        print(" AI Models: ✅ Loaded (Transformers/Hugging Face)")
    else:
        print(" AI Models: ⚠️  Using rule-based fallback")

    # Create default admin user
    create_admin_user()

    print(" API Server: http://localhost:8000")
    print(" API Documentation: http://localhost:8000/docs")
    print("="*70 + "\n")
    
    yield
    
    print("\n🔴 Shutting down Legal RAG System...")

app = FastAPI(
    title="Legal RAG System with LLM",
    description="Advanced Legal Document Search & AI Q&A System with Transformer Models",
    version="6.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(search.router)
app.include_router(rag.router)
app.include_router(stats.router)

@app.get("/")
async def root():
    return {
        "message": "Legal RAG System API with LLM",
        "version": "6.0.0",
        "status": "running"
    }

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)