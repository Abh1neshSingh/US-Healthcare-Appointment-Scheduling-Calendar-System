from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import app.models
from app.api.users import router as users_router
from app.api.auth import router as auth_router
from app.api.protected import router as protected_router
from app.database.connection import test_database_connection
from app.api.appointments import router as appointments_router


app = FastAPI(title="US Healthcare Appointment Scheduling & Calendar System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

test_database_connection()
app.include_router(auth_router)
app.include_router(protected_router)
app.include_router(users_router)
app.include_router(appointments_router)

@app.get("/")
def root():
    return {"message": "Healthcare Appointment Scheduling API is running"}


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}