from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import bcrypt
from enum import Enum
import json
from geopy.distance import geodesic

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = "transport-app-brasilia-mvp-secret-key-2025"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10080  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI(title="Transport App Brasília MVP")
api_router = APIRouter(prefix="/api")

# Enums
class UserType(str, Enum):
    PASSENGER = "passenger"
    DRIVER = "driver"
    ADMIN = "admin"

class TripStatus(str, Enum):
    REQUESTED = "requested"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class DriverStatus(str, Enum):
    OFFLINE = "offline"
    ONLINE = "online"
    BUSY = "busy"

# Models
class UserCreate(BaseModel):
    name: str
    email: str
    phone: str
    cpf: str
    user_type: UserType
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    cpf: str
    user_type: UserType
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Driver specific fields
    driver_license: Optional[str] = None
    vehicle_info: Optional[dict] = None
    driver_status: Optional[DriverStatus] = DriverStatus.OFFLINE
    current_location: Optional[dict] = None

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

class TripRequest(BaseModel):
    passenger_id: str
    pickup_latitude: float
    pickup_longitude: float
    pickup_address: str
    destination_latitude: float
    destination_longitude: float
    destination_address: str
    estimated_price: float

class Trip(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    passenger_id: str
    driver_id: Optional[str] = None
    pickup_latitude: float
    pickup_longitude: float
    pickup_address: str
    destination_latitude: float
    destination_longitude: float
    destination_address: str
    estimated_price: float
    final_price: Optional[float] = None
    status: TripStatus = TripStatus.REQUESTED
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    distance_km: Optional[float] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    return User(**user)

def calculate_trip_price(distance_km: float) -> float:
    """Calculate trip price based on distance (Brasília rates)"""
    base_price = 5.0  # Base fare R$ 5.00
    price_per_km = 2.5  # R$ 2.50 per km
    return round(base_price + (distance_km * price_per_km), 2)

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in kilometers"""
    return geodesic((lat1, lon1), (lat2, lon2)).kilometers

# Authentication endpoints
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"$or": [{"email": user_data.email}, {"cpf": user_data.cpf}]})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Create user
    user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        cpf=user_data.cpf,
        user_type=user_data.user_type
    )
    
    user_dict = user.dict()
    user_dict["hashed_password"] = hashed_password
    
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.dict()
    }

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    
    user_obj = User(**user)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_obj.dict()
    }

# User endpoints
@api_router.get("/users/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/users/location")
async def update_location(location: LocationUpdate, current_user: User = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "current_location": {
                "latitude": location.latitude,
                "longitude": location.longitude,
                "updated_at": datetime.utcnow()
            }
        }}
    )
    return {"message": "Location updated successfully"}

@api_router.put("/drivers/status/{status}")
async def update_driver_status(status: DriverStatus, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can update status")
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"driver_status": status}}
    )
    return {"message": f"Driver status updated to {status}"}

# Trip endpoints
@api_router.post("/trips/request", response_model=Trip)
async def request_trip(trip_data: TripRequest, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.PASSENGER:
        raise HTTPException(status_code=403, detail="Only passengers can request trips")
    
    # Calculate distance and price
    distance_km = calculate_distance(
        trip_data.pickup_latitude, trip_data.pickup_longitude,
        trip_data.destination_latitude, trip_data.destination_longitude
    )
    estimated_price = calculate_trip_price(distance_km)
    
    trip = Trip(
        passenger_id=current_user.id,
        pickup_latitude=trip_data.pickup_latitude,
        pickup_longitude=trip_data.pickup_longitude,
        pickup_address=trip_data.pickup_address,
        destination_latitude=trip_data.destination_latitude,
        destination_longitude=trip_data.destination_longitude,
        destination_address=trip_data.destination_address,
        estimated_price=estimated_price,
        distance_km=distance_km
    )
    
    await db.trips.insert_one(trip.dict())
    return trip

@api_router.get("/trips/available", response_model=List[Trip])
async def get_available_trips(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can view available trips")
    
    trips = await db.trips.find({"status": TripStatus.REQUESTED}).to_list(50)
    return [Trip(**trip) for trip in trips]

@api_router.put("/trips/{trip_id}/accept")
async def accept_trip(trip_id: str, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can accept trips")
    
    trip = await db.trips.find_one({"id": trip_id, "status": TripStatus.REQUESTED})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found or already accepted")
    
    # Update trip
    await db.trips.update_one(
        {"id": trip_id},
        {"$set": {
            "driver_id": current_user.id,
            "status": TripStatus.ACCEPTED,
            "accepted_at": datetime.utcnow()
        }}
    )
    
    # Update driver status
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"driver_status": DriverStatus.BUSY}}
    )
    
    return {"message": "Trip accepted successfully"}

@api_router.put("/trips/{trip_id}/start")
async def start_trip(trip_id: str, current_user: User = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id, "driver_id": current_user.id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    await db.trips.update_one(
        {"id": trip_id},
        {"$set": {"status": TripStatus.IN_PROGRESS}}
    )
    
    return {"message": "Trip started"}

@api_router.put("/trips/{trip_id}/complete")
async def complete_trip(trip_id: str, current_user: User = Depends(get_current_user)):
    trip = await db.trips.find_one({"id": trip_id, "driver_id": current_user.id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    await db.trips.update_one(
        {"id": trip_id},
        {"$set": {
            "status": TripStatus.COMPLETED,
            "completed_at": datetime.utcnow(),
            "final_price": trip["estimated_price"]
        }}
    )
    
    # Update driver status back to online
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"driver_status": DriverStatus.ONLINE}}
    )
    
    return {"message": "Trip completed"}

@api_router.get("/trips/my", response_model=List[Trip])
async def get_my_trips(current_user: User = Depends(get_current_user)):
    if current_user.user_type == UserType.PASSENGER:
        trips = await db.trips.find({"passenger_id": current_user.id}).sort("requested_at", -1).to_list(50)
    elif current_user.user_type == UserType.DRIVER:
        trips = await db.trips.find({"driver_id": current_user.id}).sort("requested_at", -1).to_list(50)
    else:
        raise HTTPException(status_code=403, detail="Invalid user type")
    
    return [Trip(**trip) for trip in trips]

# Admin endpoints
@api_router.get("/admin/users", response_model=List[User])
async def get_all_users(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}).to_list(1000)
    return [User(**user) for user in users]

@api_router.get("/admin/trips", response_model=List[Trip])
async def get_all_trips(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    trips = await db.trips.find({}).sort("requested_at", -1).to_list(1000)
    return [Trip(**trip) for trip in trips]

@api_router.get("/admin/stats")
async def get_stats(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({})
    total_drivers = await db.users.count_documents({"user_type": "driver"})
    total_passengers = await db.users.count_documents({"user_type": "passenger"})
    total_trips = await db.trips.count_documents({})
    completed_trips = await db.trips.count_documents({"status": "completed"})
    
    return {
        "total_users": total_users,
        "total_drivers": total_drivers,
        "total_passengers": total_passengers,
        "total_trips": total_trips,
        "completed_trips": completed_trips,
        "completion_rate": round((completed_trips / total_trips * 100) if total_trips > 0 else 0, 2)
    }

# Basic health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Transport App Brasília MVP"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()