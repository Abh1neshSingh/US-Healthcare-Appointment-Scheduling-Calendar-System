from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.database.connection import get_db
from app.schemas.user import LoginRequest
from app.services.user_service import get_user_by_email

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

@router.post("/login")
def login(
    login_data : LoginRequest,
    db: Session =Depends(get_db)
):
    user = get_user_by_email(db,login_data.email)
    
    if not user:
        raise HTTPException(
            status_code= status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    if not verify_password(login_data.password,user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"   
        )
    access_token = create_access_token(
        {
            "sub":str(user.id),
            "role": user.role
        }
    )
    
    return{
        "access_token": access_token,
        "token_type": "bearer"
    }