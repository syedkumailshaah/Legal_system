from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import datetime
import os
import json
from bson import ObjectId
from .. import database as db
from ..utils.nlp import create_vector_embedding, cosine_similarity, logger

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
        
        # --- 1. TEXT SEARCH ---
        if search_type in ["text", "hybrid"]:
            if db.db is not None:
                text_query = {"$text": {"$search": q}}
                if category:
                    text_query["category"] = category
                
                # Fetch slightly more than limit to allow for filtering/merging
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
                        "score": 1.0, # Base score for text match
                        "search_type": "text"
                    }
                    results.append(result)
            else:
                # File-based fallback (simplified)
                pass
        
        # --- 2. VECTOR SEARCH ---
        if search_type in ["vector", "hybrid"]:
            # IMPORTANT: await the async API call here
            query_vector = await create_vector_embedding(q)
            
            if db.db is not None:
                # Note: In a production App with Atlas, you should use $vectorSearch aggregation.
                # For this free tier/demo setup, we fetch a subset of vectors and calculate manually.
                all_vectors = list(db.vectors.find().limit(200)) # Limit to 200 to prevent slow calculation
                scored_items = []
                
                for vec_doc in all_vectors:
                    similarity = cosine_similarity(query_vector, vec_doc["vector"])
                    if similarity > 0.15: # slightly higher threshold
                        section = db.sections.find_one({"_id": ObjectId(vec_doc["section_id"])})
                        if section:
                            law = db.laws.find_one({"_id": ObjectId(section["law_id"])})
                            
                            # Apply category filter if requested
                            if category and law and law.get("category") != category:
                                continue
                                
                            scored_items.append({"section": section, "law": law, "score": similarity})
                
                # Sort by vector similarity
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

        # --- 3. DEDUPLICATION & RANKING ---
        seen_ids = set()
        unique_results = []
        
        # Sort combined results by score before deduplication
        results.sort(key=lambda x: x["score"], reverse=True)
        
        for result in results:
            if result["id"] not in seen_ids:
                seen_ids.add(result["id"])
                unique_results.append(result)
        
        # Log query stats
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
        logger.error(f"Search Error: {e}")
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
        # Get base results using the main search function
        basic_results = await search_documents(q=q, search_type=search_type, category=category, limit=limit * 2)
        results = basic_results["results"]
        filtered_results = []
        
        # Apply metadata filters (Jurisdiction, Year, etc.)
        for result in results:
            if db.db is not None:
                # We need to fetch the law details to check metadata
                # (Optimized: In a real app, these fields should be denormalized into the Section document)
                section = db.sections.find_one({"_id": ObjectId(result["id"])})
                if section:
                    law = db.laws.find_one({"_id": ObjectId(section["law_id"])})
                    if law:
                        if jurisdiction and law.get("jurisdiction") != jurisdiction:
                            continue
                        if year_from and law.get("year", 0) < year_from:
                            continue
                        if year_to and law.get("year", 0) > year_to:
                            continue
                        
                        # Add extra metadata to result
                        result["jurisdiction"] = law.get("jurisdiction")
                        result["year"] = law.get("year")
                        result["document_description"] = law.get("description", "")[:200]
                        filtered_results.append(result)
            else:
                # Pass through if file-based (or no DB connection)
                filtered_results.append(result)
        
        # Note: Local LLM re-ranking (qa_pipeline) removed to save RAM for Free Tier.
        # We rely solely on Vector cosine similarity and Text score.
        
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
        logger.error(f"Advanced Search Error: {e}")
        raise HTTPException(500, f"Advanced search failed: {str(e)}")