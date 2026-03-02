#!/usr/bin/env python3
"""
Create test user and generate JWT token for voice chat testing

Usage:
    python3 create_test_user.py
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / 'backend'))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, text
from app.infrastructure.database.session import get_async_session
from app.core.config import settings
from app.infrastructure.database.models.user import User
from app.core.security import get_password_hash

# Import JWT functions
from jose import jwt
from datetime import datetime, timedelta


async def create_test_user():
    """Create test user if not exists and generate JWT token"""
    
    # Database URL
    db_url = settings.DATABASE_URL_SYNC.replace("postgresql://", "postgresql+asyncpg://")
    
    engine = create_async_engine(db_url, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    test_email = "test@arma.ai"
    test_password = "TestUser123!"
    test_name = "Test User"
    
    try:
        async with async_session() as session:
            # Check if user exists
            result = await session.execute(
                select(User).where(User.email == test_email)
            )
            user = result.scalar_one_or_none()
            
            if user:
                print(f"✅ Test user already exists: {test_email}")
            else:
                # Create new user
                user = User(
                    email=test_email,
                    hashed_password=get_password_hash(test_password),
                    full_name=test_name,
                    is_active=True,
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)
                print(f"✅ Created test user: {test_email}")
            
            # Generate JWT token
            expire = datetime.utcnow() + timedelta(days=7)
            to_encode = {
                "sub": str(user.id),
                "email": user.email,
                "exp": expire,
                "type": "access"
            }
            
            token = jwt.encode(
                to_encode,
                settings.JWT_SECRET_KEY,
                algorithm=settings.JWT_ALGORITHM
            )
            
            # Print credentials
            print("\n" + "="*60)
            print("🔐 TEST USER CREDENTIALS")
            print("="*60)
            print(f"Email:    {test_email}")
            print(f"Password: {test_password}")
            print(f"Name:     {test_name}")
            print(f"User ID:  {user.id}")
            print("\n🎫 JWT TOKEN (valid for 7 days):")
            print("-"*60)
            print(token)
            print("-"*60)
            print("\n💡 Usage:")
            print(f"  1. Login with: {test_email} / {test_password}")
            print(f"  2. Or use token directly in WebSocket URL:")
            print(f"     ws://localhost:8000/api/v1/voice/chat?token={token[:50]}...")
            print("\n⚠️  Save this token! It will be valid for 7 days.")
            print("="*60)
            
            return token
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        await engine.dispose()


if __name__ == "__main__":
    print("🚀 Creating test user for Voice Chat testing...\n")
    token = asyncio.run(create_test_user())
    
    if token:
        # Save token to file
        token_file = Path(__file__).parent / "test_user_token.txt"
        with open(token_file, "w") as f:
            f.write(f"Email: test@arma.ai\n")
            f.write(f"Password: TestUser123!\n")
            f.write(f"Token: {token}\n")
        print(f"\n💾 Token saved to: {token_file}")
    else:
        sys.exit(1)
