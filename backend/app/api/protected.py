from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, require_roles

router = APIRouter(
    prefix="/protected",
    tags=["Protected"]
)

@router.get("/me")
def protected_route(current_user=Depends(require_roles(["DOCTOR"]))):
    return{
        "message": "You have access to the doctor-only route",
        "user": current_user,
    }