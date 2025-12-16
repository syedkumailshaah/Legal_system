from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import datetime
import os
import json
from bson import ObjectId
from .. import database as db
from ..utils.nlp import create_vector_embedding, cosine_similarity, qa_pipeline, logger

router = APIRouter(prefix="/api/search", tags=["Search"])

@router.get("")
async def search_documents(
    q: str = Query(..., min_length=2, description="Search query"),
    search_type: str = Query("hybrid", description="Search type: text, vector, or hybrid"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(20, ge=1, le=100, description="Number of results")
):
    try:
        results = []
        # TEXT SEARCH
        if search_type in ["text", "hybrid"]:
            if db.db is not None:
                text_query = {"$text": {"$search": q}}
                if category: text_query["category"] = category
                text_results = list(db.sections.find(text_query).limit(limit * 2))
                
                for section in text_results:
                    law = db.laws.find_one({"_id": ObjectId(section["law_id"])})
                    result = {
                        "id": str(section["_id"]),
                        "section_number": section.get("section_number", "N/A"),
                        "title": section.get("title", ""),
                        "content": section.get("content", "")[:300] + "...",
                        "law_title": law.get("title", "Unknown") if law else "Unknown",
                        "category": law.get("category", "Legal") if law else "Legal",
                        "score": 1.0,
                        "search_type": "text"
                    }
                    results.append(result)
            else:
                # File fallback logic
                pass
        
        # VECTOR SEARCH
        if search_type in ["vector", "hybrid"]:
            query_vector = create_vector_embedding(q)
            if db.db is not None:
                all_vectors = list(db.vectors.find().limit(limit * 3))
                scored_items = []
                for vec_doc in all_vectors:
                    similarity = cosine_similarity(query_vector, vec_doc["vector"])
                    if similarity > 0.1:
                        section = db.sections.find_one({"_id": ObjectId(vec_doc["section_id"])})
                        if section:
                            law = db.laws.find_one({"_id": ObjectId(section["law_id"])})
                            if category and law and law.get("category") != category: continue
                            scored_items.append({"section": section, "law": law, "score": similarity})
                
                scored_items.sort(key=lambda x: x["score"], reverse=True)
                for item in scored_items[:limit]:
                    result = {
                        "id": str(item["section"]["_id"]),
                        "section_number": item["section"].get("section_number", "N/A"),
                        "title": item["section"].get("title", ""),
                        "content": item["section"].get("content", "")[:300] + "...",
                        "law_title": item["law"].get("title", "Unknown") if item["law"] else "Unknown",
                        "category": item["law"].get("category", "Legal") if item["law"] else "Legal",
                        "score": item["score"],
                        "search_type": "vector"
                    }
                    results.append(result)

        # De-duplicate
        seen_ids = set()
        unique_results = []
        for result in results:
            if result["id"] not in seen_ids:
                seen_ids.add(result["id"])
                unique_results.append(result)
        unique_results.sort(key=lambda x: x["score"], reverse=True)
        
        if db.db is not None:
            db.queries.insert_one({
                "query": q,
                "search_type": search_type,
                "results_count": len(unique_results[:limit]),
                "timestamp": datetime.utcnow()
            })
        
        return {
            "query": q,
            "results": unique_results[:limit],
            "count": len(unique_results[:limit]),
            "search_type": search_type
        }
    except Exception as e:
        raise HTTPException(500, f"Search failed: {str(e)}")

@router.get("/advanced")
async def advanced_search(
    q: str = Query(..., min_length=2),
    search_type: str = Query("hybrid"),
    category: Optional[str] = None,
    jurisdiction: Optional[str] = None,
    year_from: Optional[int] = Query(None),
    year_to: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100)
):
    try:
        basic_results = await search_documents(q=q, search_type=search_type, category=category, limit=limit * 2)
        results = basic_results["results"]
        filtered_results = []
        
        for result in results:
            if db.db is not None:
                section = db.sections.find_one({"_id": ObjectId(result["id"])})
                if section:
                    law = db.laws.find_one({"_id": ObjectId(section["law_id"])})
                    if law:
                        if jurisdiction and law.get("jurisdiction") != jurisdiction: continue
                        if year_from and law.get("year", 0) < year_from: continue
                        if year_to and law.get("year", 0) > year_to: continue
                        
                        result["jurisdiction"] = law.get("jurisdiction")
                        result["year"] = law.get("year")
                        result["document_description"] = law.get("description", "")[:200]
                        filtered_results.append(result)
            else:
                filtered_results.append(result)
        
        if qa_pipeline and len(filtered_results) > 1:
            try:
                for result in filtered_results[:10]:
                    context = result.get("content", "")[:500]
                    try:
                        qa_result = qa_pipeline(question=q, context=context, max_answer_len=50, max_question_len=100, max_seq_len=384, handle_impossible_answer=True)
                        if 'score' in qa_result:
                            result["llm_score"] = qa_result['score']
                            result["score"] = (result.get("score", 0) + qa_result['score']) / 2
                    except: pass
                filtered_results.sort(key=lambda x: x.get("llm_score", x.get("score", 0)), reverse=True)
            except Exception as e:
                logger.warning(f"LLM reranking error: {e}")
        
        return {
            "query": q,
            "results": filtered_results[:limit],
            "count": len(filtered_results[:limit]),
            "search_type": search_type,
            "filters_applied": {
                "category": category,
                "jurisdiction": jurisdiction,
                "year_range": f"{year_from}-{year_to}" if year_from or year_to else None
            }
        }
    except Exception as e:
        raise HTTPException(500, f"Advanced search failed: {str(e)}")