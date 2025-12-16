from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from typing import Optional, List, Dict
from datetime import datetime
import os
import json
import aiofiles
from bson import ObjectId
from .. import database as db
from ..utils.nlp import extract_text_from_pdf, parse_legal_document, create_vector_embedding
from pymongo import DESCENDING

router = APIRouter(prefix="/api/documents", tags=["Documents"])

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(""),
    category: str = Form("Legal"),
    jurisdiction: str = Form("Pakistan"),
    year: int = Form(None),
    description: str = Form("")
):
    try:
        # 1. Validate File Type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(400, "Only PDF files are allowed")

        # 2. Save File Locally
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = file.filename.replace(" ", "_")
        file_path = f"uploads/{timestamp}_{safe_filename}"
        
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # 3. Extract and Parse Text (Lightweight CPU operations)
        text = extract_text_from_pdf(file_path)
        sections_list = parse_legal_document(text)
        
        # 4. Database Insertion
        if db.db is not None:
            # --- MONGODB PATH ---
            law = {
                "title": title or file.filename.replace('.pdf', ''),
                "original_filename": file.filename,
                "file_path": file_path,
                "category": category,
                "jurisdiction": jurisdiction,
                "year": year or datetime.now().year,
                "description": description,
                "text_preview": text[:500] + "..." if len(text) > 500 else text,
                "full_text": text,
                "sections_count": len(sections_list),
                "file_size": len(content),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            result = db.laws.insert_one(law)
            law_id = str(result.inserted_id)
            
            # Process sections and generate embeddings via API
            for i, section in enumerate(sections_list):
                section_doc = {
                    "law_id": law_id,
                    "section_number": section.get('section_number', str(i + 1)),
                    "title": section.get('title', f"Section {i + 1}"),
                    "content": section['content'],
                    "order": i,
                    "created_at": datetime.utcnow()
                }
                
                section_result = db.sections.insert_one(section_doc)
                section_id = str(section_result.inserted_id)
                
                # IMPORTANT: await the async API call here to prevent RAM crash
                vector = await create_vector_embedding(section['content'])
                
                vector_doc = {
                    "section_id": section_id,
                    "law_id": law_id,
                    "vector": vector,
                    "created_at": datetime.utcnow()
                }
                db.vectors.insert_one(vector_doc)
        else:
            # --- FILE-BASED FALLBACK PATH ---
            laws_file = "data/laws.json"
            sections_file = "data/sections.json"
            vectors_file = "data/vectors.json"
            
            laws_data = []
            if os.path.exists(laws_file):
                with open(laws_file, 'r', encoding='utf-8') as f: laws_data = json.load(f)
            
            sections_data = []
            if os.path.exists(sections_file):
                with open(sections_file, 'r', encoding='utf-8') as f: sections_data = json.load(f)
            
            vectors_data = []
            if os.path.exists(vectors_file):
                with open(vectors_file, 'r', encoding='utf-8') as f: vectors_data = json.load(f)
            
            law_id = str(len(laws_data) + 1)
            law = {
                "id": law_id,
                "title": title or file.filename.replace('.pdf', ''),
                "original_filename": file.filename,
                "file_path": file_path,
                "category": category,
                "jurisdiction": jurisdiction,
                "year": year or datetime.now().year,
                "description": description,
                "sections_count": len(sections_list),
                "file_size": len(content),
                "created_at": datetime.utcnow().isoformat()
            }
            laws_data.append(law)
            
            for i, section in enumerate(sections_list):
                section_id = str(len(sections_data) + 1)
                section_doc = {
                    "id": section_id,
                    "law_id": law_id,
                    "section_number": section.get('section_number', str(i + 1)),
                    "title": section.get('title', f"Section {i + 1}"),
                    "content": section['content'],
                    "order": i
                }
                sections_data.append(section_doc)
                
                # IMPORTANT: await the async API call here
                vector = await create_vector_embedding(section['content'])
                
                vector_doc = {
                    "id": str(len(vectors_data) + 1),
                    "section_id": section_id,
                    "law_id": law_id,
                    "vector": vector
                }
                vectors_data.append(vector_doc)
            
            with open(laws_file, 'w', encoding='utf-8') as f: json.dump(laws_data, f, indent=2, ensure_ascii=False)
            with open(sections_file, 'w', encoding='utf-8') as f: json.dump(sections_data, f, indent=2, ensure_ascii=False)
            with open(vectors_file, 'w', encoding='utf-8') as f: json.dump(vectors_data, f, indent=2, ensure_ascii=False)
        
        return {
            "message": "Document uploaded successfully",
            "document_id": law_id,
            "title": law.get("title") or law.get("id"),
            "sections": len(sections_list),
            "file_size": len(content),
            "file_path": file_path
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")

@router.get("")
async def get_documents(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    category: Optional[str] = None
):
    try:
        if db.db is not None:
            query = {}
            if category:
                query["category"] = category
            
            skip = (page - 1) * limit
            documents = list(db.laws.find(query).sort("created_at", DESCENDING).skip(skip).limit(limit))
            total = db.laws.count_documents(query)
            
            for doc in documents:
                doc["id"] = str(doc["_id"])
                del doc["_id"]
                # Don't send full text in list view to save bandwidth
                if "full_text" in doc:
                    del doc["full_text"]
        else:
            laws_file = "data/laws.json"
            if not os.path.exists(laws_file):
                return {"documents": [], "page": page, "limit": limit, "total": 0, "pages": 0}
            
            with open(laws_file, 'r', encoding='utf-8') as f: all_docs = json.load(f)
            if category:
                all_docs = [doc for doc in all_docs if doc.get("category") == category]
            
            total = len(all_docs)
            skip = (page - 1) * limit
            documents = all_docs[skip:skip + limit]
        
        return {
            "documents": documents,
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to get documents: {str(e)}")

@router.get("/{doc_id}")
async def get_document(doc_id: str):
    try:
        if db.db is not None:
            document = db.laws.find_one({"_id": ObjectId(doc_id)})
            if not document:
                raise HTTPException(404, "Document not found")
            
            document["id"] = str(document["_id"])
            del document["_id"]
            
            sections_list = list(db.sections.find({"law_id": doc_id}))
            document["sections"] = [
                {
                    "id": str(sec["_id"]),
                    "section_number": sec.get("section_number"),
                    "title": sec.get("title"),
                    "content_preview": sec.get("content", "")[:200] + "..." if len(sec.get("content", "")) > 200 else sec.get("content", "")
                }
                for sec in sections_list
            ]
        else:
            laws_file = "data/laws.json"
            sections_file = "data/sections.json"
            if not os.path.exists(laws_file): raise HTTPException(404, "Document not found")
            
            with open(laws_file, 'r', encoding='utf-8') as f: all_docs = json.load(f)
            document = next((doc for doc in all_docs if doc["id"] == doc_id), None)
            if not document: raise HTTPException(404, "Document not found")
            
            if os.path.exists(sections_file):
                with open(sections_file, 'r', encoding='utf-8') as f: all_sections = json.load(f)
                document_sections = [sec for sec in all_sections if sec["law_id"] == doc_id]
                document["sections"] = [
                    {
                        "id": sec["id"],
                        "section_number": sec.get("section_number"),
                        "title": sec.get("title"),
                        "content_preview": sec.get("content", "")[:200] + "..." if len(sec.get("content", "")) > 200 else sec.get("content", "")
                    }
                    for sec in document_sections
                ]
        
        return document
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to get document: {str(e)}")

@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    try:
        if db.db is not None:
            result = db.laws.delete_one({"_id": ObjectId(doc_id)})
            if result.deleted_count == 0:
                raise HTTPException(404, "Document not found")
            
            # Cascade delete sections and vectors
            db.sections.delete_many({"law_id": doc_id})
            db.vectors.delete_many({"law_id": doc_id})
            
            return {"message": "Document deleted successfully"}
        else:
            # File based delete
            laws_file = "data/laws.json"
            if not os.path.exists(laws_file): raise HTTPException(404, "Document not found")
            
            with open(laws_file, 'r', encoding='utf-8') as f: laws_data = json.load(f)
            
            # Filter out the document to be deleted
            new_laws_data = [d for d in laws_data if d["id"] != doc_id]
            
            if len(new_laws_data) == len(laws_data):
                raise HTTPException(404, "Document not found")
                
            with open(laws_file, 'w', encoding='utf-8') as f: json.dump(new_laws_data, f, indent=2, ensure_ascii=False)
            
            # Clean up sections
            sections_file = "data/sections.json"
            if os.path.exists(sections_file):
                with open(sections_file, 'r', encoding='utf-8') as f: sections_data = json.load(f)
                new_sections_data = [s for s in sections_data if s["law_id"] != doc_id]
                with open(sections_file, 'w', encoding='utf-8') as f: json.dump(new_sections_data, f, indent=2, ensure_ascii=False)

            # Clean up vectors
            vectors_file = "data/vectors.json"
            if os.path.exists(vectors_file):
                with open(vectors_file, 'r', encoding='utf-8') as f: vectors_data = json.load(f)
                new_vectors_data = [v for v in vectors_data if v["law_id"] != doc_id]
                with open(vectors_file, 'w', encoding='utf-8') as f: json.dump(new_vectors_data, f, indent=2, ensure_ascii=False)

            return {"message": "Document deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to delete document: {str(e)}")