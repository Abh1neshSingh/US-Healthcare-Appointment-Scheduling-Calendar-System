from app.database.connection import sessionLocal
from app.models.user import User
from app.schemas.user import UserCreate
from app.services.user_service import create_user


db = sessionLocal()

try:
    user_data = UserCreate(
        name="Test Patient",
        email="patient@test.com",
        password="test123",
        role="PATIENT",
    )

    existing_user = db.query(User).filter(User.email == user_data.email).first()

    if existing_user:
        print("Test user already exists")
    else:
        user = create_user(db, user_data)
        print("Test user created:", user.email)

finally:
    db.close()