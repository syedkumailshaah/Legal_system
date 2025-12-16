from fastapi import APIRouter
from datetime import datetime
import os
import json
from .. import database as db
from pymongo import DESCENDING
from ..config import HF_TOKEN

router = APIRouter(tags=["System Info"])

@router.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "database": "connected" if db.db is not None else "file-based",
        "ai_mode": "cloud_inference" if HF_TOKEN else "fallback_hashing"
    }

@router.get("/api/stats")
async def get_statistics():
    try:
        if db.db is not None:
            total_documents = db.laws.count_documents({})
            total_sections = db.sections.count_documents({})
            total_queries = db.queries.count_documents({})
            total_vectors = db.vectors.count_documents({})
            
            recent_documents = list(db.laws.find().sort("created_at", DESCENDING).limit(5))
            for doc in recent_documents:
                doc["id"] = str(doc["_id"])
                del doc["_id"]
            
            ai_queries = db.queries.count_documents({
                "search_type": {"$regex": "llm|ai|vector", "$options": "i"}
            })
            
            return {
                "total_documents": total_documents,
                "total_sections": total_sections,
                "total_queries": total_queries,
                "vector_count": total_vectors,
                "ai_queries": ai_queries,
                "recent_documents": recent_documents,
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            # File-based stats fallback
            return {"status": "running", "mode": "file-based", "note": "Connect MongoDB for full stats"}
            
    except Exception as e:
        return {"error": str(e)}