from fastapi import APIRouter, Form, HTTPException
from datetime import datetime
import json
import os
from .. import database as db
from ..utils.security import hash_password

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register")
async def register_user(
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    full_name: str = Form("")
):
    try:
        if db.db is not None:
            # MongoDB Path
            existing = db.users.find_one({
                "$or": [
                    {"email": email.lower()},
                    {"username": username}
                ]
            })
            if existing:
                raise HTTPException(400, "User already exists with this email or username")

            user = {
                "username": username,
                "email": email.lower(),
                "full_name": full_name,
                "password": hash_password(password),
                "role": "user",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            result = db.users.insert_one(user)
            user_id = str(result.inserted_id)
            
            return {
                "message": "Registration successful",
                "user_id": user_id,
                "username": username
            }
        else:
            # File-based storage
            users_file = "data/users.json"
            users_data = []
            if os.path.exists(users_file):
                with open(users_file, 'r', encoding='utf-8') as f:
                    users_data = json.load(f)
            
            for user in users_data:
                if user["email"].lower() == email.lower() or user["username"] == username:
                    raise HTTPException(400, "User already exists")
            
            user_id = str(len(users_data) + 1)
            user = {
                "id": user_id,
                "username": username,
                "email": email.lower(),
                "full_name": full_name,
                "password": hash_password(password),
                "role": "user",
                "created_at": datetime.utcnow().isoformat()
            }
            users_data.append(user)
            
            with open(users_file, 'w', encoding='utf-8') as f:
                json.dump(users_data, f, indent=2, ensure_ascii=False)
            
            return {
                "message": "Registration successful",
                "user_id": user_id,
                "username": username
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Registration failed: {str(e)}")

@router.post("/login")
async def login_user(
    email: str = Form(...),
    password: str = Form(...)
):
    try:
        hashed_password = hash_password(password)

        if db.db is not None:
            user = db.users.find_one({"email": email.lower()})
            if not user:
                raise HTTPException(400, "Invalid email or password")
            
            if user["password"] != hashed_password:
                raise HTTPException(400, "Invalid email or password")
            
            user_id = str(user["_id"])
            username = user["username"]
        else:
            users_file = "data/users.json"
            if not os.path.exists(users_file):
                raise HTTPException(400, "Invalid email or password")
            
            with open(users_file, 'r', encoding='utf-8') as f:
                users_data = json.load(f)
            
            user = None
            for u in users_data:
                if u["email"].lower() == email.lower() and u["password"] == hashed_password:
                    user = u
                    break
            
            if not user:
                raise HTTPException(400, "Invalid email or password")
            
            user_id = user["id"]
            username = user["username"]
        
        return {
            "message": "Login successful",
            "user_id": user_id,
            "username": username
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Login failed: {str(e)}")