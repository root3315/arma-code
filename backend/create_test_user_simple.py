#!/usr/bin/env python3
"""
Simple test user creator using psycopg2 (sync)
"""
import psycopg2
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta

# Config
DB_HOST = "localhost"
DB_PORT = "5435"
DB_NAME = "eduplatform_dev"
DB_USER = "postgres"  # Use postgres superuser
DB_PASSWORD = ""  # No password for local dev

JWT_SECRET = "dev-jwt-secret-key-not-for-production"
JWT_ALGORITHM = "HS256"

# Test user credentials
TEST_EMAIL = "test@arma.ai"
TEST_PASSWORD = "TestUser123!"
TEST_NAME = "Test User"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_test_user():
    try:
        # Connect to PostgreSQL
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        conn.autocommit = True
        cur = conn.cursor()
        
        # Check if user exists
        cur.execute("SELECT id, email FROM users WHERE email = %s", (TEST_EMAIL,))
        user = cur.fetchone()
        
        if user:
            print(f"✅ Test user already exists: {TEST_EMAIL}")
            user_id = user[0]
        else:
            # Create user
            hashed = pwd_context.hash(TEST_PASSWORD)
            cur.execute(
                """
                INSERT INTO users (email, hashed_password, full_name, is_active, created_at)
                VALUES (%s, %s, %s, %s, NOW())
                RETURNING id
                """,
                (TEST_EMAIL, hashed, TEST_NAME, True)
            )
            user_id = cur.fetchone()[0]
            print(f"✅ Created test user: {TEST_EMAIL}")
        
        # Generate JWT token
        expire = datetime.utcnow() + timedelta(days=7)
        to_encode = {
            "sub": str(user_id),
            "email": TEST_EMAIL,
            "exp": expire,
            "type": "access"
        }
        
        token = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        # Print credentials
        print("\n" + "="*60)
        print("🔐 TEST USER CREDENTIALS")
        print("="*60)
        print(f"Email:    {TEST_EMAIL}")
        print(f"Password: {TEST_PASSWORD}")
        print(f"Name:     {TEST_NAME}")
        print(f"User ID:  {user_id}")
        print("\n🎫 JWT TOKEN (valid for 7 days):")
        print("-"*60)
        print(token)
        print("-"*60)
        print("\n💡 Usage:")
        print(f"  1. Login with: {TEST_EMAIL} / {TEST_PASSWORD}")
        print(f"  2. Or use token directly in WebSocket URL")
        print(f"     ws://localhost:8000/api/v1/voice/chat?token={token[:50]}...")
        print("\n⚠️  Save this token! It will be valid for 7 days.")
        print("="*60)
        
        # Save to file
        with open("test_user_token.txt", "w") as f:
            f.write(f"Email: {TEST_EMAIL}\n")
            f.write(f"Password: {TEST_PASSWORD}\n")
            f.write(f"Token: {token}\n")
        
        print(f"\n💾 Token saved to: test_user_token.txt")
        
        cur.close()
        conn.close()
        
        return token
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    print("🚀 Creating test user for Voice Chat testing...\n")
    create_test_user()
