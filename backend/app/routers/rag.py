from fastapi import APIRouter, Query, Form, HTTPException
from typing import Optional, List, Dict
from datetime import datetime
import re
import json
import os
from bson import ObjectId
from .. import database as db
from ..utils.nlp import generate_llm_answer, summarizer, tokenizer, model, logger, qa_pipeline
from .search import search_documents

router = APIRouter(tags=["AI & RAG"])

@router.get("/api/rag/ask")
async def ask_question(
    question: str = Query(..., min_length=3),
    detailed: bool = Query(False),
    max_context_length: int = Query(2000, ge=500, le=5000)
):
    try:
        search_results = await search_documents(q=question, search_type="hybrid", limit=8)
        
        if not search_results["results"]:
            return {
                "question": question,
                "answer": "I couldn't find relevant information in the legal documents.",
                "sources": [],
                "confidence": 0.0,
                "model_used": "no_relevant_documents"
            }
        
        context_parts = []
        sources = []
        total_context_length = 0
        
        for i, result in enumerate(search_results["results"]):
            if total_context_length >= max_context_length: break
            law_title = result.get("law_title", "Unknown Law")
            section_num = result.get("section_number", f"Section {i+1}")
            content = result.get("content", "")
            source_entry = f"[{law_title}, {section_num}]: {content}"
            if total_context_length + len(source_entry) <= max_context_length:
                context_parts.append(source_entry)
                total_context_length += len(source_entry)
                sources.append({
                    "law_title": law_title,
                    "section_number": section_num,
                    "content_preview": content[:200] + "...",
                    "relevance_score": result.get("score", 0),
                    "search_type": result.get("search_type", "unknown")
                })
        
        context = "\n\n".join(context_parts)
        llm_answer = generate_llm_answer(question, context)
        
        if detailed:
            citations = "\n\n**Citations:**\n"
            for i, source in enumerate(sources[:5], 1):
                citations += f"{i}. {source['law_title']} (Section {source['section_number']}) - Relevance: {source['relevance_score']:.2%}\n"
            llm_answer += citations
        
        return {
            "question": question,
            "answer": llm_answer,
            "sources": sources,
            "confidence": search_results["results"][0].get("score", 0.5),
            "context_used": len(context),
            "model_used": "transformers_llm" if qa_pipeline else "rule_based",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(500, f"Question answering failed: {str(e)}")

@router.get("/api/documents/{doc_id}/summarize")
async def summarize_document(
    doc_id: str,
    max_length: int = Query(200, ge=50, le=500),
    min_length: int = Query(50, ge=20, le=200)
):
    try:
        text = ""
        title = ""
        if db.db is not None:
            document = db.laws.find_one({"_id": ObjectId(doc_id)})
            if not document: raise HTTPException(404, "Document not found")
            text = document.get("text_preview", document.get("full_text", ""))
            title = document.get("title", "Untitled Document")
        else:
            laws_file = "data/laws.json"
            if os.path.exists(laws_file):
                with open(laws_file, 'r', encoding='utf-8') as f: all_docs = json.load(f)
                document = next((doc for doc in all_docs if doc["id"] == doc_id), None)
                if not document: raise HTTPException(404, "Document not found")
                text = document.get("description", "") + " " + document.get("text_preview", "")
                title = document.get("title", "Untitled Document")
        
        if summarizer and len(text) > 100:
            try:
                summary = summarizer(text, max_length=max_length, min_length=min_length, do_sample=False)[0]['summary_text']
                return {"document_id": doc_id, "title": title, "summary": summary, "model_used": "distilbart-cnn"}
            except Exception as e:
                logger.warning(f"LLM summarization failed: {e}")
        
        sentences = text.split('. ')
        summary = '. '.join(sentences[:3]) + '.' if len(sentences) > 3 else text[:max_length]
        return {"document_id": doc_id, "title": title, "summary": summary, "model_used": "extractive_fallback"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, f"Summarization failed: {str(e)}")

@router.post("/api/ai/analyze")
async def batch_analyze_documents(
    document_ids: List[str] = Form(...),
    analysis_type: str = Form("compare"),
    questions: Optional[List[str]] = Form(None)
):
    try:
        results = []
        for doc_id in document_ids[:10]:
            try:
                if db.db is not None:
                    document = db.laws.find_one({"_id": ObjectId(doc_id)})
                    if document:
                        results.append({
                            "id": str(document["_id"]),
                            "title": document.get("title"),
                            "category": document.get("category"),
                            "jurisdiction": document.get("jurisdiction"),
                            "year": document.get("year"),
                            "sections_count": document.get("sections_count", 0)
                        })
            except Exception as e: logger.error(f"Error processing doc {doc_id}: {e}")
        
        return {"analysis_type": analysis_type, "documents_analyzed": len(results), "results": results, "timestamp": datetime.utcnow().isoformat()}
    except Exception as e: raise HTTPException(500, f"Batch analysis failed: {str(e)}")

@router.post("/api/ai/chat")
async def chat_with_ai(
    message: str = Form(..., min_length=1),
    conversation_history: Optional[List[Dict]] = Form(None),
    use_documents: bool = Form(True)
):
    try:
        response = {"message": "", "sources": [], "confidence": 0.0}
        legal_keywords = ['law', 'legal', 'contract', 'court', 'section', 'article']
        is_legal_query = any(keyword in message.lower() for keyword in legal_keywords)
        
        if use_documents and is_legal_query:
            rag_response = await ask_question(question=message, detailed=True, max_context_length=1500)
            response["message"] = rag_response["answer"]
            response["sources"] = rag_response["sources"]
            response["confidence"] = rag_response["confidence"]
        else:
            if tokenizer and model:
                try:
                    input_text = f"Conversation:\n{conversation_history[-3:] if conversation_history else ''}\nHuman: {message}\nAI:"
                    inputs = tokenizer(input_text, return_tensors="pt", max_length=512, truncation=True)
                    outputs = model.generate(**inputs, max_length=200, min_length=50, temperature=0.8, do_sample=True)
                    ai_response = tokenizer.decode(outputs[0], skip_special_tokens=True)
                    response["message"] = f"I'm your legal research assistant. {ai_response}"
                    response["confidence"] = 0.7
                except Exception as e:
                    logger.error(f"LLM chat error: {e}")
                    response["message"] = "How can I assist you with legal research today?"
            else:
                response["message"] = "I'm your legal research assistant. What would you like to know?"
        
        response["timestamp"] = datetime.utcnow().isoformat()
        response["model_used"] = "transformers" if tokenizer else "rule_based"
        return response
    except Exception as e: raise HTTPException(500, f"Chat failed: {str(e)}")

@router.get("/api/documents/{doc_id}/keywords")
async def extract_keywords(doc_id: str, top_n: int = Query(10, ge=1, le=50)):
    try:
        text = ""
        if db.db is not None:
            document = db.laws.find_one({"_id": ObjectId(doc_id)})
            if not document: raise HTTPException(404, "Document not found")
            text = document.get("full_text", document.get("text_preview", ""))
        
        words = re.findall(r'\b[A-Z][a-z]+\b', text)
        word_counts = {}
        for word in words:
            if len(word) > 3: word_counts[word] = word_counts.get(word, 0) + 1
        sorted_keywords = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
        keywords = [{"term": kw, "frequency": freq} for kw, freq in sorted_keywords[:top_n]]
        
        return {"document_id": doc_id, "keywords": keywords}
    except Exception as e: raise HTTPException(500, f"Keyword extraction failed: {str(e)}")