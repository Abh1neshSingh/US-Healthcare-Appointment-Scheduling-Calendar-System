from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models

from app.api.users import router as users_router
from app.api.auth import router as auth_router
from app.api.protected import router as protected_router
from app.api.appointments import router as appointments_router
from app.api.referrals import router as referrals_router
from app.api.public_calendar import router as public_calendar_router

from app.database.connection import test_database_connection


app = FastAPI(
    title="US Healthcare Appointment Scheduling & Calendar System"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://ushcs-application.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


test_database_connection()


app.include_router(auth_router)
app.include_router(protected_router)
app.include_router(users_router)
app.include_router(appointments_router)
app.include_router(referrals_router)

# Public calendar
app.include_router(public_calendar_router)


@app.get("/")
def root():
    return {
        "message": "Healthcare Appointment Scheduling API is running"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy"
    }