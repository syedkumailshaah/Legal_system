from fastapi import APIRouter, Query, Form, HTTPException
from typing import Optional, List, Dict
from datetime import datetime
import os
import json
from bson import ObjectId
from .. import database as db
from ..utils.nlp import generate_llm_answer, summarize_text, logger
from .search import search_documents

router = APIRouter(tags=["AI & RAG"])

@router.get("/api/rag/ask")
async def ask_question(
    question: str = Query(..., min_length=3),
    detailed: bool = Query(False),
    max_context_length: int = Query(2000, ge=500, le=5000)
):
    try:
        # search_documents is async
        search_results = await search_documents(q=question, search_type="hybrid", limit=5)
        
        if not search_results["results"]:
            return {
                "question": question,
                "answer": "No relevant documents found.",
                "sources": []
            }
        
        context_parts = []
        sources = []
        current_len = 0
        
        for result in search_results["results"]:
            content = result.get("content", "")
            if current_len + len(content) > max_context_length: break
            context_parts.append(content)
            current_len += len(content)
            sources.append(result)
        
        context = "\n\n".join(context_parts)
        
        # ADDED await here
        llm_answer = await generate_llm_answer(question, context)
        
        return {
            "question": question,
            "answer": llm_answer,
            "sources": sources,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"RAG Error: {e}")
        raise HTTPException(500, f"Error: {str(e)}")

@router.get("/api/documents/{doc_id}/summarize")
async def summarize_document(doc_id: str):
    try:
        text = ""
        if db.db is not None:
            document = db.laws.find_one({"_id": ObjectId(doc_id)})
            if document: text = document.get("full_text", "")
        
        if not text: raise HTTPException(404, "Document not found")
        
        # ADDED await here
        summary = await summarize_text(text[:3000]) # Limit text for API
        
        return {"document_id": doc_id, "summary": summary}
    except Exception as e:
        raise HTTPException(500, f"Summarization failed: {str(e)}")

@router.post("/api/ai/chat")
async def chat_with_ai(message: str = Form(...)):
    # simplified chat for free tier
    try:
        response = await generate_llm_answer(message, "General legal context.")
        return {"message": response}
    except Exception as e:
        return {"message": "Service unavailable."}