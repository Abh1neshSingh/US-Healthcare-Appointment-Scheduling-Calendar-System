from app.database.connection import sessionLocal
from app.models.user import User
from app.models.enums import UserRole
from app.core.security import hash_password


db = sessionLocal()

try:
    email = "admin@test.com"

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        print("Admin already exists")
    else:
        admin = User(
            name="System Admin",
            email=email,
            password_hash=hash_password("test123"),
            role=UserRole.ADMIN.value,
            is_active=True,
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print(
            f"Initial Admin created: "
            f"ID={admin.id}, Email={admin.email}, Role={admin.role}"
        )

finally:
    db.close()