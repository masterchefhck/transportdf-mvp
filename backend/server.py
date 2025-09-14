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

class ReportStatus(str, Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"

class ReportType(str, Enum):
    DRIVER_REPORT = "driver_report"  # Driver reporting passenger
    PASSENGER_REPORT = "passenger_report"  # Passenger reporting driver

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
    
    # Rating field (for drivers and passengers)
    rating: Optional[float] = 5.0
    
    # Profile photo (base64 encoded)
    profile_photo: Optional[str] = None

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

class ProfilePhotoUpdate(BaseModel):
    profile_photo: str  # base64 encoded image

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

class ReportCreate(BaseModel):
    reported_user_id: str
    trip_id: Optional[str] = None
    title: str
    description: str
    report_type: ReportType

class Report(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reporter_id: str
    reported_user_id: str
    trip_id: Optional[str] = None
    title: str
    description: str
    report_type: ReportType
    status: ReportStatus = ReportStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    admin_message: Optional[str] = None
    user_response: Optional[str] = None
    response_allowed: bool = True
    resolved_at: Optional[datetime] = None

class AdminMessage(BaseModel):
    message: str

class UserResponse(BaseModel):
    response: str

class UserBlock(BaseModel):
    user_id: str
    reason: str

# Rating and Evaluation Models
class RatingCreate(BaseModel):
    trip_id: str
    rated_user_id: str  # driver being rated by passenger
    rating: int = Field(..., ge=1, le=5)  # 1-5 stars
    reason: Optional[str] = None  # Required when rating < 5

class Rating(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trip_id: str
    rater_id: str  # who gave the rating
    rated_user_id: str  # who received the rating
    rating: int = Field(..., ge=1, le=5)
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AdminAlert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rating_id: str
    driver_id: str
    admin_message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AdminAlertCreate(BaseModel):
    rating_id: str
    message: str

# Admin Message Models
class AdminMessageToUser(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    admin_id: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    read: bool = False

class AdminMessageCreate(BaseModel):
    user_id: str
    message: str

# Bulk Delete Models
class BulkDeleteRequest(BaseModel):
    ids: List[str]

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
    price_per_km = 1.5  # R$ 1.50 per km
    return round(base_price + (distance_km * price_per_km), 2)

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in kilometers"""
    return geodesic((lat1, lon1), (lat2, lon2)).kilometers

async def calculate_user_rating(user_id: str) -> float:
    """Calculate average rating for a user and handle reset after 100 trips"""
    # Count total trips for this user (as driver)
    total_trips = await db.trips.count_documents({
        "driver_id": user_id, 
        "status": TripStatus.COMPLETED
    })
    
    # Reset rating every 100 trips
    if total_trips > 0 and total_trips % 100 == 0:
        # Check if we already reset for this 100-trip milestone
        reset_count = total_trips // 100
        existing_reset = await db.rating_resets.find_one({
            "user_id": user_id,
            "reset_number": reset_count
        })
        
        if not existing_reset:
            # Mark this reset as done
            await db.rating_resets.insert_one({
                "user_id": user_id,
                "reset_number": reset_count,
                "reset_at": datetime.utcnow()
            })
            return 5.0  # Reset to perfect rating
    
    # Get all ratings for this user since last reset
    last_reset = await db.rating_resets.find_one(
        {"user_id": user_id}, 
        sort=[("reset_number", -1)]
    )
    
    query_filter = {"rated_user_id": user_id}
    if last_reset:
        # Only get ratings after last reset
        query_filter["created_at"] = {"$gt": last_reset["reset_at"]}
    
    ratings = await db.ratings.find(query_filter).to_list(None)
    
    if not ratings:
        return 5.0  # Default perfect rating
    
    # Calculate weighted average (5-star ratings maintain 5.0, others lower it proportionally)
    total_ratings = len(ratings)
    sum_ratings = sum(r["rating"] for r in ratings)
    
    return round(sum_ratings / total_ratings, 1)

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

# Report endpoints
@api_router.post("/reports/create")
async def create_report(report_data: ReportCreate, current_user: User = Depends(get_current_user)):
    """Create a new report"""
    report = Report(
        reporter_id=current_user.id,
        reported_user_id=report_data.reported_user_id,
        trip_id=report_data.trip_id,
        title=report_data.title,
        description=report_data.description,
        report_type=report_data.report_type
    )
    
    await db.reports.insert_one(report.dict())
    return {"message": "Report created successfully", "report_id": report.id}

@api_router.get("/reports/my")
async def get_my_reports(current_user: User = Depends(get_current_user)):
    """Get reports where current user is the reported person (to respond)"""
    reports = await db.reports.find({"reported_user_id": current_user.id, "status": {"$in": ["pending", "under_review"]}}).to_list(100)
    return [Report(**report) for report in reports]

@api_router.post("/reports/{report_id}/respond")
async def respond_to_report(report_id: str, response_data: UserResponse, current_user: User = Depends(get_current_user)):
    """User responds to a report against them"""
    report = await db.reports.find_one({"id": report_id, "reported_user_id": current_user.id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if not report.get("response_allowed", True):
        raise HTTPException(status_code=400, detail="Response no longer allowed for this report")
    
    await db.reports.update_one(
        {"id": report_id},
        {
            "$set": {
                "user_response": response_data.response,
                "response_allowed": False,
                "status": "under_review"
            }
        }
    )
    
    return {"message": "Response submitted successfully"}

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

# Admin report management endpoints
@api_router.get("/admin/reports")
async def get_all_reports(current_user: User = Depends(get_current_user)):
    """Get all reports for admin review"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    reports = []
    reports_cursor = db.reports.find({}).sort("created_at", -1)
    async for report in reports_cursor:
        # Get reporter and reported user details
        reporter = await db.users.find_one({"id": report["reporter_id"]})
        reported = await db.users.find_one({"id": report["reported_user_id"]})
        
        report_with_details = Report(**report)
        report_dict = report_with_details.dict()
        report_dict["reporter_name"] = reporter.get("name", "Unknown") if reporter else "Unknown"
        report_dict["reported_name"] = reported.get("name", "Unknown") if reported else "Unknown"
        report_dict["reported_user_type"] = reported.get("user_type", "Unknown") if reported else "Unknown"
        
        reports.append(report_dict)
    
    return reports

@api_router.post("/admin/reports/{report_id}/message")
async def send_admin_message(report_id: str, message_data: AdminMessage, current_user: User = Depends(get_current_user)):
    """Admin sends message to reported user giving them opportunity to respond"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    report = await db.reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    await db.reports.update_one(
        {"id": report_id},
        {
            "$set": {
                "admin_message": message_data.message,
                "response_allowed": True,
                "status": "under_review"
            }
        }
    )
    
    return {"message": "Message sent to user successfully"}

@api_router.post("/admin/reports/{report_id}/resolve")
async def resolve_report(report_id: str, current_user: User = Depends(get_current_user)):
    """Admin resolves a report"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.reports.update_one(
        {"id": report_id},
        {
            "$set": {
                "status": "resolved",
                "resolved_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": "Report resolved successfully"}

@api_router.post("/admin/reports/{report_id}/dismiss")
async def dismiss_report(report_id: str, current_user: User = Depends(get_current_user)):
    """Admin dismisses a report"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.reports.update_one(
        {"id": report_id},
        {
            "$set": {
                "status": "dismissed",
                "resolved_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": "Report dismissed successfully"}

# User blocking endpoints
@api_router.post("/admin/users/{user_id}/block")
async def block_user(user_id: str, block_data: UserBlock, current_user: User = Depends(get_current_user)):
    """Admin blocks a user"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "is_active": False,
                "blocked_at": datetime.utcnow(),
                "block_reason": block_data.reason
            }
        }
    )
    
    return {"message": "User blocked successfully"}

@api_router.post("/admin/users/{user_id}/unblock")
async def unblock_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Admin unblocks a user"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "is_active": True
            },
            "$unset": {
                "blocked_at": "",
                "block_reason": ""
            }
        }
    )
    
    return {"message": "User unblocked successfully"}

# Rating endpoints
@api_router.post("/ratings/create")
async def create_rating(rating_data: RatingCreate, current_user: User = Depends(get_current_user)):
    """Create a rating after trip completion (passenger rates driver)"""
    # Verify trip exists and current user is the passenger
    trip = await db.trips.find_one({
        "id": rating_data.trip_id,
        "passenger_id": current_user.id,
        "status": TripStatus.COMPLETED
    })
    
    if not trip:
        raise HTTPException(status_code=404, detail="Completed trip not found")
    
    # Check if rating already exists for this trip
    existing_rating = await db.ratings.find_one({
        "trip_id": rating_data.trip_id,
        "rater_id": current_user.id
    })
    
    if existing_rating:
        raise HTTPException(status_code=400, detail="Rating already exists for this trip")
    
    # Validate reason field for ratings < 5
    if rating_data.rating < 5 and not rating_data.reason:
        raise HTTPException(status_code=400, detail="Reason is required for ratings below 5 stars")
    
    # Create rating
    rating = Rating(
        trip_id=rating_data.trip_id,
        rater_id=current_user.id,
        rated_user_id=rating_data.rated_user_id,
        rating=rating_data.rating,
        reason=rating_data.reason
    )
    
    await db.ratings.insert_one(rating.dict())
    
    # Update user's average rating
    new_average = await calculate_user_rating(rating_data.rated_user_id)
    await db.users.update_one(
        {"id": rating_data.rated_user_id},
        {"$set": {"rating": new_average}}
    )
    
    return {"message": "Rating created successfully", "rating_id": rating.id}

@api_router.get("/ratings/low")
async def get_low_ratings(current_user: User = Depends(get_current_user)):
    """Get ratings below 5 stars for admin panel"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all ratings below 5 stars with user details
    pipeline = [
        {"$match": {"rating": {"$lt": 5}}},
        {"$lookup": {
            "from": "users",
            "localField": "rated_user_id",
            "foreignField": "id",
            "as": "rated_user"
        }},
        {"$lookup": {
            "from": "users", 
            "localField": "rater_id",
            "foreignField": "id",
            "as": "rater"
        }},
        {"$lookup": {
            "from": "trips",
            "localField": "trip_id", 
            "foreignField": "id",
            "as": "trip"
        }},
        {"$sort": {"created_at": -1}}
    ]
    
    ratings = await db.ratings.aggregate(pipeline).to_list(100)
    
    # Process results to include user names and alert status
    result = []
    for rating in ratings:
        rated_user = rating["rated_user"][0] if rating["rated_user"] else {}
        rater = rating["rater"][0] if rating["rater"] else {}
        trip = rating["trip"][0] if rating["trip"] else {}
        
        # Check if alert was already sent for this rating
        existing_alert = await db.admin_alerts.find_one({"rating_id": rating["id"]})
        alert_sent = existing_alert is not None
        
        result.append({
            "id": rating["id"],
            "rating": rating["rating"],
            "reason": rating.get("reason"),
            "created_at": rating["created_at"],
            "rated_user_name": rated_user.get("name", "Unknown"),
            "rated_user_id": rating["rated_user_id"],
            "rater_name": rater.get("name", "Unknown"),
            "trip_pickup": trip.get("pickup_address", "Unknown"),
            "trip_destination": trip.get("destination_address", "Unknown"),
            "alert_sent": alert_sent
        })
    
    return result

@api_router.post("/admin/ratings/{rating_id}/alert")
async def send_driver_alert(rating_id: str, alert_data: AdminAlertCreate, current_user: User = Depends(get_current_user)):
    """Send alert message to driver with low rating"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify rating exists
    rating = await db.ratings.find_one({"id": rating_id})
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    
    # Create admin alert
    alert = AdminAlert(
        rating_id=rating_id,
        driver_id=rating["rated_user_id"],
        admin_message=alert_data.message
    )
    
    await db.admin_alerts.insert_one(alert.dict())
    
    return {"message": "Alert sent to driver successfully"}

@api_router.get("/users/rating")
async def get_user_rating(current_user: User = Depends(get_current_user)):
    """Get current user's rating"""
    rating = await calculate_user_rating(current_user.id)
    return {"rating": rating}

@api_router.get("/drivers/alerts")
async def get_driver_alerts(current_user: User = Depends(get_current_user)):
    """Get alerts sent to current driver"""
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can view alerts")
    
    # Get alerts for this driver with rating details
    pipeline = [
        {"$match": {"driver_id": current_user.id}},
        {"$lookup": {
            "from": "ratings",
            "localField": "rating_id",
            "foreignField": "id",
            "as": "rating"
        }},
        {"$sort": {"created_at": -1}}
    ]
    
    alerts = await db.admin_alerts.aggregate(pipeline).to_list(50)
    
    # Process results to include rating details
    result = []
    for alert in alerts:
        rating = alert["rating"][0] if alert["rating"] else {}
        
        result.append({
            "id": alert["id"],
            "admin_message": alert["admin_message"],
            "created_at": alert["created_at"],
            "rating_stars": rating.get("rating", 0),
            "rating_reason": rating.get("reason", ""),
            "rating_date": rating.get("created_at", ""),
            "read": alert.get("read", False)
        })
    
    return result

@api_router.post("/drivers/alerts/{alert_id}/read")
async def mark_alert_as_read(alert_id: str, current_user: User = Depends(get_current_user)):
    """Mark alert as read by driver"""
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can mark alerts as read")
    
    # Verify alert belongs to current driver
    alert = await db.admin_alerts.find_one({
        "id": alert_id,
        "driver_id": current_user.id
    })
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # Mark as read
    await db.admin_alerts.update_one(
        {"id": alert_id},
        {"$set": {"read": True, "read_at": datetime.utcnow()}}
    )
    
    return {"message": "Alert marked as read"}

# Admin Messages to Passengers endpoints
@api_router.post("/admin/messages/send")
async def send_message_to_passenger(message_data: AdminMessageCreate, current_user: User = Depends(get_current_user)):
    """Admin sends message to passenger"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify user exists and is a passenger
    user = await db.users.find_one({"id": message_data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["user_type"] != "passenger":
        raise HTTPException(status_code=400, detail="Can only send messages to passengers")
    
    # Create message
    admin_message = AdminMessageToUser(
        user_id=message_data.user_id,
        admin_id=current_user.id,
        message=message_data.message
    )
    
    await db.admin_messages.insert_one(admin_message.dict())
    
    return {"message": "Message sent to passenger successfully"}

@api_router.get("/passengers/messages")
async def get_passenger_messages(current_user: User = Depends(get_current_user)):
    """Get messages sent to current passenger"""
    if current_user.user_type != UserType.PASSENGER:
        raise HTTPException(status_code=403, detail="Only passengers can view their messages")
    
    messages = await db.admin_messages.find({
        "user_id": current_user.id
    }).sort("created_at", -1).to_list(50)
    
    return [AdminMessageToUser(**msg) for msg in messages]

@api_router.post("/passengers/messages/{message_id}/read")
async def mark_message_as_read(message_id: str, current_user: User = Depends(get_current_user)):
    """Mark message as read by passenger"""
    if current_user.user_type != UserType.PASSENGER:
        raise HTTPException(status_code=403, detail="Only passengers can mark messages as read")
    
    # Verify message belongs to current passenger
    message = await db.admin_messages.find_one({
        "id": message_id,
        "user_id": current_user.id
    })
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Mark as read
    await db.admin_messages.update_one(
        {"id": message_id},
        {"$set": {"read": True, "read_at": datetime.utcnow()}}
    )
    
    return {"message": "Message marked as read"}

# Basic health check
# Bulk Delete endpoints
@api_router.post("/admin/trips/bulk-delete")
async def bulk_delete_trips(request: BulkDeleteRequest, current_user: User = Depends(get_current_user)):
    """Admin bulk delete trips"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.trips.delete_many({"id": {"$in": request.ids}})
    return {"message": f"Deleted {result.deleted_count} trips"}

@api_router.post("/admin/users/bulk-delete")
async def bulk_delete_users(request: BulkDeleteRequest, current_user: User = Depends(get_current_user)):
    """Admin bulk delete users"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Don't allow deleting admin users
    result = await db.users.delete_many({
        "id": {"$in": request.ids},
        "user_type": {"$ne": "admin"}
    })
    return {"message": f"Deleted {result.deleted_count} users"}

@api_router.post("/admin/reports/bulk-delete")
async def bulk_delete_reports(request: BulkDeleteRequest, current_user: User = Depends(get_current_user)):
    """Admin bulk delete reports"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.reports.delete_many({"id": {"$in": request.ids}})
    return {"message": f"Deleted {result.deleted_count} reports"}

@api_router.post("/admin/ratings/bulk-delete")
async def bulk_delete_ratings(request: BulkDeleteRequest, current_user: User = Depends(get_current_user)):
    """Admin bulk delete ratings"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.ratings.delete_many({"id": {"$in": request.ids}})
    return {"message": f"Deleted {result.deleted_count} ratings"}

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