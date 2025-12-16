import os

# Atlas MongoDB Connection String
# On Render, set this in Environment Variables as MONGO_URL
MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = "legal_rag_db"

# Create directories ensuring they exist for file-based fallback/uploads
os.makedirs("uploads", exist_ok=True)
os.makedirs("data", exist_ok=True)