import os

# Atlas MongoDB Connection String
# On Render, set this in Environment Variables
MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = "legal_rag_db"

# Hugging Face Token for Free Inference API
HF_TOKEN = os.getenv("HF_TOKEN")

# Create directories ensuring they exist
os.makedirs("uploads", exist_ok=True)
os.makedirs("data", exist_ok=True)