from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
from datetime import datetime
import logging
from .config import MONGO_URL, DB_NAME

# Global Database Variables
client = None
db = None
users = None
laws = None
sections = None
queries = None
vectors = None

logger = logging.getLogger(__name__)

def connect_db():
    global client, db, users, laws, sections, queries, vectors
    try:
        print("🔄 Attempting to connect to MongoDB...")
        # Connect using the Atlas URL or Localhost
        client = MongoClient(MONGO_URL, 
                           serverSelectionTimeoutMS=5000,
                           connectTimeoutMS=3000,
                           socketTimeoutMS=3000)
        
        client.admin.command('ping')
        print("✅ MongoDB Server is reachable!")
        
        db = client[DB_NAME]
        users = db.users
        laws = db.laws
        sections = db.sections
        queries = db.queries
        vectors = db.vectors
        
        # Create indexes
        print("🔄 Creating database indexes...")
        try:
            users.create_index([("email", ASCENDING)], unique=True)
            laws.create_index([("title", TEXT), ("description", TEXT)], default_language="english")
            sections.create_index([("content", TEXT)], default_language="english")
            sections.create_index([("law_id", ASCENDING)])
            vectors.create_index([("section_id", ASCENDING)])
            queries.create_index([("timestamp", DESCENDING)])
            print("✅ Database indexes created!")
        except Exception as e:
            print(f"⚠️  Index creation warning: {e}")
            
        return True
    except Exception as e:
        print(f" MongoDB Error: {e}")
        print("  Switching to file-based storage...")
        return False

def create_admin_user():
    """Create default admin user if DB is connected"""
    if db is not None:
        try:
            from .utils.security import hash_password
            admin = users.find_one({"email": "admin@legal.com"})
            if not admin:
                users.insert_one({
                    "username": "admin",
                    "email": "admin@legal.com",
                    "full_name": "System Administrator",
                    "password": hash_password("admin123"),
                    "role": "admin",
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                })
                print(" Admin user created: admin@legal.com / admin123")
        except Exception as e:
            print(f"  Could not create admin user: {e}")