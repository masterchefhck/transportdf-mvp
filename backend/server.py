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
from uuid import uuid4
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
    MANAGER = "manager"
    SUPPORT_COLLABORATOR = "support_collaborator"

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
    age: Optional[int] = None
    gender: Optional[str] = None

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
    
    # Admin Full field
    is_admin_full: Optional[bool] = False
    
    # Additional fields for new user types
    age: Optional[int] = None
    gender: Optional[str] = None

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

# Chat Models
class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trip_id: str
    sender_id: str
    sender_name: str
    sender_type: UserType  # passenger, driver, admin
    message: str = Field(..., max_length=250)  # 250 character limit
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ChatMessageCreate(BaseModel):
    message: str = Field(..., max_length=250)

# Password Reset Models
class PasswordResetRequest(BaseModel):
    email: str
    cpf: str

class PasswordReset(BaseModel):
    email: str
    cpf: str
    new_password: str = Field(..., min_length=6)
    confirm_password: str = Field(..., min_length=6)

# Bulk Delete Models
class BulkDeleteRequest(BaseModel):
    ids: List[str]

# Google Maps Mock Models
class RouteRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float

class RoutePoint(BaseModel):
    lat: float
    lng: float

class RouteStep(BaseModel):
    instruction: str
    distance: str
    duration: str
    start_location: RoutePoint
    end_location: RoutePoint

class RouteResponse(BaseModel):
    distance: str
    duration: str
    steps: List[RouteStep]
    overview_polyline: str  # Encoded polyline for route visualization
    bounds: dict  # Map bounds for centering

class DistanceMatrixRequest(BaseModel):
    origins: List[dict]  # [{"lat": float, "lng": float}]
    destinations: List[dict]  # [{"lat": float, "lng": float}]

class DistanceMatrixElement(BaseModel):
    distance: dict  # {"text": "5.2 km", "value": 5200}
    duration: dict  # {"text": "15 mins", "value": 900}
    status: str = "OK"

class DistanceMatrixResponse(BaseModel):
    rows: List[dict]  # Each row contains elements array

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

# Mock Google Maps functions for demo
def generate_mock_route_steps(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> List[RouteStep]:
    """Generate realistic mock turn-by-turn directions for Brasília"""
    
    # Sample Brasília landmarks and routes
    brasilia_routes = {
        "asa_norte_to_asa_sul": [
            {"instruction": "Siga em direção ao sul pela W3 Norte", "distance": "1.2 km", "duration": "3 mins"},
            {"instruction": "Continue pela Ponte JK", "distance": "800 m", "duration": "2 mins"},
            {"instruction": "Vire à direita na W3 Sul", "distance": "900 m", "duration": "3 mins"},
            {"instruction": "Chegue ao destino à esquerda", "distance": "200 m", "duration": "1 min"}
        ],
        "centro_to_taguatinga": [
            {"instruction": "Siga pela Esplanada dos Ministérios", "distance": "1.5 km", "duration": "4 mins"},
            {"instruction": "Continue pela via EPIA", "distance": "8.2 km", "duration": "12 mins"},
            {"instruction": "Pegue a saída para Taguatinga Centro", "distance": "1.1 km", "duration": "3 mins"},
            {"instruction": "Vire à direita na Avenida Central", "distance": "500 m", "duration": "2 mins"}
        ],
        "plano_piloto_to_gama": [
            {"instruction": "Siga pela via S1", "distance": "2.1 km", "duration": "5 mins"},
            {"instruction": "Continue pela BR-060", "distance": "18.5 km", "duration": "22 mins"},
            {"instruction": "Pegue a saída para Gama", "distance": "2.2 km", "duration": "4 mins"},
            {"instruction": "Chegue ao destino", "distance": "300 m", "duration": "1 min"}
        ]
    }
    
    # Determine route type based on coordinates (simplified logic)
    distance = calculate_distance(origin_lat, origin_lng, dest_lat, dest_lng)
    
    if distance < 3:
        route_key = "asa_norte_to_asa_sul"
    elif distance < 10:
        route_key = "centro_to_taguatinga"
    else:
        route_key = "plano_piloto_to_gama"
    
    steps = []
    current_lat, current_lng = origin_lat, origin_lng
    route_data = brasilia_routes[route_key]
    
    for i, step_data in enumerate(route_data):
        # Calculate intermediate points
        progress = (i + 1) / len(route_data)
        next_lat = origin_lat + (dest_lat - origin_lat) * progress
        next_lng = origin_lng + (dest_lng - origin_lng) * progress
        
        step = RouteStep(
            instruction=step_data["instruction"],
            distance=step_data["distance"],
            duration=step_data["duration"],
            start_location=RoutePoint(lat=current_lat, lng=current_lng),
            end_location=RoutePoint(lat=next_lat, lng=next_lng)
        )
        steps.append(step)
        current_lat, current_lng = next_lat, next_lng
    
    return steps

def generate_mock_polyline(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> str:
    """Generate a simplified encoded polyline for route visualization"""
    # This is a simplified polyline encoding - in real implementation, would use Google's polyline encoding
    # For demo purposes, we'll create a basic route line
    return f"demo_polyline_{origin_lat}_{origin_lng}_to_{dest_lat}_{dest_lng}"

def calculate_realistic_duration(distance_km: float) -> int:
    """Calculate realistic travel time in seconds based on Brasília traffic patterns"""
    base_speed_kmh = 25  # Average speed considering traffic in Brasília
    if distance_km < 2:
        base_speed_kmh = 20  # Slower in city center
    elif distance_km > 15:
        base_speed_kmh = 35  # Faster on highways
    
    duration_seconds = int((distance_km / base_speed_kmh) * 3600)
    return max(duration_seconds, 300)  # Minimum 5 minutes

def format_duration(seconds: int) -> str:
    """Format duration in seconds to human readable format"""
    if seconds < 60:
        return f"{seconds} seg"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        return f"{minutes} min"
    else:
        hours = int(seconds / 3600)
        minutes = int((seconds % 3600) / 60)
        return f"{hours}h {minutes}min"

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

@api_router.put("/users/profile-photo")
async def update_profile_photo(photo: ProfilePhotoUpdate, current_user: User = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"profile_photo": photo.profile_photo}}
    )
    return {"message": "Profile photo updated successfully"}

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

@api_router.get("/trips/available")
async def get_available_trips(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Only drivers can view available trips")
    
    trips = await db.trips.find({"status": TripStatus.REQUESTED}).to_list(50)
    
    # Enrich trips with passenger information
    enriched_trips = []
    for trip in trips:
        passenger = await db.users.find_one({"id": trip["passenger_id"]})
        if passenger:
            trip_data = Trip(**trip)
            trip_dict = trip_data.dict()
            trip_dict["passenger_name"] = passenger["name"]
            trip_dict["passenger_rating"] = passenger.get("rating", 5.0)
            trip_dict["passenger_photo"] = passenger.get("profile_photo")
            enriched_trips.append(trip_dict)
    
    return enriched_trips

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

@api_router.get("/trips/my")
async def get_my_trips(current_user: User = Depends(get_current_user)):
    """Get current user's trips with complete user information"""
    if current_user.user_type == UserType.PASSENGER:
        # Get trips with driver details for passenger
        pipeline = [
            {"$match": {"passenger_id": current_user.id}},
            {"$lookup": {
                "from": "users",
                "localField": "driver_id",
                "foreignField": "id",
                "as": "driver"
            }},
            {"$sort": {"requested_at": -1}},
            {"$limit": 50}
        ]
    elif current_user.user_type == UserType.DRIVER:
        # Get trips with passenger details for driver
        pipeline = [
            {"$match": {"driver_id": current_user.id}},
            {"$lookup": {
                "from": "users",
                "localField": "passenger_id",
                "foreignField": "id",
                "as": "passenger"
            }},
            {"$sort": {"requested_at": -1}},
            {"$limit": 50}
        ]
    else:
        raise HTTPException(status_code=403, detail="Invalid user type")
    
    trips = await db.trips.aggregate(pipeline).to_list(50)
    
    # Process results to include user details
    result = []
    for trip in trips:
        # Clean trip data by removing MongoDB ObjectId fields and nested arrays
        trip_clean = {}
        for k, v in trip.items():
            if k not in ["_id", "passenger", "driver"]:
                # Convert datetime objects to ISO strings for JSON serialization
                if isinstance(v, datetime):
                    trip_clean[k] = v.isoformat()
                else:
                    trip_clean[k] = v
        
        if current_user.user_type == UserType.PASSENGER:
            driver = trip["driver"][0] if trip["driver"] else {}
            trip_data = {
                **trip_clean,
                "driver_name": driver.get("name"),
                "driver_photo": driver.get("profile_photo"),
                "driver_rating": driver.get("rating"),
                "driver_phone": driver.get("phone")
            }
        else:  # DRIVER
            passenger = trip["passenger"][0] if trip["passenger"] else {}
            trip_data = {
                **trip_clean,
                "passenger_name": passenger.get("name"),
                "passenger_photo": passenger.get("profile_photo"),
                "passenger_rating": passenger.get("rating")
                # passenger_phone removed as per review request - driver only sees name, photo, rating
            }
        result.append(trip_data)
    
    return result

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

@api_router.get("/admin/trips")
async def get_all_trips(current_user: User = Depends(get_current_user)):
    """Get all trips with complete user information for admin dashboard"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Aggregate trips with user details
    pipeline = [
        {"$lookup": {
            "from": "users",
            "localField": "passenger_id",
            "foreignField": "id",
            "as": "passenger"
        }},
        {"$lookup": {
            "from": "users",
            "localField": "driver_id",
            "foreignField": "id",
            "as": "driver"
        }},
        {"$sort": {"requested_at": -1}},
        {"$limit": 1000}
    ]
    
    trips = await db.trips.aggregate(pipeline).to_list(1000)
    
    # Process results to include user details
    result = []
    for trip in trips:
        passenger = trip["passenger"][0] if trip["passenger"] else {}
        driver = trip["driver"][0] if trip["driver"] else {}
        
        # Clean trip data by removing MongoDB ObjectId fields and nested arrays
        trip_clean = {}
        for k, v in trip.items():
            if k not in ["_id", "passenger", "driver"]:
                # Convert datetime objects to ISO strings for JSON serialization
                if isinstance(v, datetime):
                    trip_clean[k] = v.isoformat()
                else:
                    trip_clean[k] = v
        
        trip_data = {
            **trip_clean,
            "passenger_name": passenger.get("name"),
            "passenger_phone": passenger.get("phone"),
            "passenger_photo": passenger.get("profile_photo"),
            "passenger_rating": passenger.get("rating"),
            "driver_name": driver.get("name"),
            "driver_phone": driver.get("phone"),
            "driver_photo": driver.get("profile_photo"),
            "driver_rating": driver.get("rating")
        }
        result.append(trip_data)
    
    return result

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
    
    # Mark the trip as rated by passenger
    await db.trips.update_one(
        {"id": rating_data.trip_id},
        {"$set": {"passenger_rating_given": rating_data.rating, "rated": True}}
    )
    
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

# Mock Google Maps API endpoints
@api_router.post("/maps/directions", response_model=RouteResponse)
async def get_mock_directions(route_request: RouteRequest, current_user: User = Depends(get_current_user)):
    """Mock Google Maps Directions API - get route between two points"""
    
    distance_km = calculate_distance(
        route_request.origin_lat, route_request.origin_lng,
        route_request.destination_lat, route_request.destination_lng
    )
    
    duration_seconds = calculate_realistic_duration(distance_km)
    
    steps = generate_mock_route_steps(
        route_request.origin_lat, route_request.origin_lng,
        route_request.destination_lat, route_request.destination_lng
    )
    
    polyline = generate_mock_polyline(
        route_request.origin_lat, route_request.origin_lng,
        route_request.destination_lat, route_request.destination_lng
    )
    
    # Calculate map bounds
    lat_min = min(route_request.origin_lat, route_request.destination_lat) - 0.01
    lat_max = max(route_request.origin_lat, route_request.destination_lat) + 0.01
    lng_min = min(route_request.origin_lng, route_request.destination_lng) - 0.01
    lng_max = max(route_request.origin_lng, route_request.destination_lng) + 0.01
    
    return RouteResponse(
        distance=f"{distance_km:.1f} km",
        duration=format_duration(duration_seconds),
        steps=steps,
        overview_polyline=polyline,
        bounds={
            "northeast": {"lat": lat_max, "lng": lng_max},
            "southwest": {"lat": lat_min, "lng": lng_min}
        }
    )

@api_router.post("/maps/distance-matrix", response_model=DistanceMatrixResponse)
async def get_mock_distance_matrix(matrix_request: DistanceMatrixRequest, current_user: User = Depends(get_current_user)):
    """Mock Google Maps Distance Matrix API - get distances and durations between multiple points"""
    
    rows = []
    for origin in matrix_request.origins:
        elements = []
        for destination in matrix_request.destinations:
            distance_km = calculate_distance(
                origin["lat"], origin["lng"],
                destination["lat"], destination["lng"]
            )
            
            duration_seconds = calculate_realistic_duration(distance_km)
            
            element = DistanceMatrixElement(
                distance={
                    "text": f"{distance_km:.1f} km",
                    "value": int(distance_km * 1000)  # Convert to meters
                },
                duration={
                    "text": format_duration(duration_seconds),
                    "value": duration_seconds
                }
            )
            elements.append(element.dict())
        
        rows.append({"elements": elements})
    
    return DistanceMatrixResponse(rows=rows)

@api_router.get("/maps/geocode/{address}")
async def mock_geocode_address(address: str, current_user: User = Depends(get_current_user)):
    """Mock Google Maps Geocoding API - convert address to coordinates"""
    
    # Mock geocoding for common Brasília locations
    brasilia_locations = {
        "asa norte": {"lat": -15.7801, "lng": -47.8827, "area": "Asa Norte"},
        "asa sul": {"lat": -15.8267, "lng": -47.8934, "area": "Asa Sul"},
        "taguatinga": {"lat": -15.8270, "lng": -48.0427, "area": "Taguatinga"},
        "ceilandia": {"lat": -15.8190, "lng": -48.1076, "area": "Ceilândia"},
        "gama": {"lat": -16.0209, "lng": -48.0647, "area": "Gama"},
        "sobradinho": {"lat": -15.6536, "lng": -47.7863, "area": "Sobradinho"},
        "planaltina": {"lat": -15.4523, "lng": -47.6142, "area": "Planaltina"},
        "brasilia": {"lat": -15.7942, "lng": -47.8822, "area": "Brasília"},
        "aeroporto": {"lat": -15.8711, "lng": -47.9178, "area": "Aeroporto JK"},
        "rodoviaria": {"lat": -15.7945, "lng": -47.8828, "area": "Rodoviária do Plano Piloto"},
        # Adicionar mais variações comuns
        "plano piloto": {"lat": -15.7942, "lng": -47.8822, "area": "Plano Piloto"},
        "w3 norte": {"lat": -15.7801, "lng": -47.8827, "area": "W3 Norte"},
        "w3 sul": {"lat": -15.8267, "lng": -47.8934, "area": "W3 Sul"},
        "centro": {"lat": -15.7942, "lng": -47.8822, "area": "Centro de Brasília"},
        "esplanada": {"lat": -15.7942, "lng": -47.8822, "area": "Esplanada dos Ministérios"},
        "sudoeste": {"lat": -15.7942, "lng": -47.9132, "area": "Setor Sudoeste"},
        "noroeste": {"lat": -15.7642, "lng": -47.8822, "area": "Setor Noroeste"},
        "lago norte": {"lat": -15.7542, "lng": -47.8522, "area": "Lago Norte"},
        "lago sul": {"lat": -15.8542, "lng": -47.8522, "area": "Lago Sul"},
    }
    
    address_lower = address.lower().strip()
    
    # Find best match usando correspondência parcial mais flexível
    best_match = None
    best_score = 0
    
    for location_name, location_data in brasilia_locations.items():
        # Verificar correspondência exata
        if location_name == address_lower:
            best_match = location_data
            best_score = 100
            break
        
        # Verificar se o nome da localização está contido no endereço
        if location_name in address_lower:
            score = len(location_name) / len(address_lower) * 100
            if score > best_score:
                best_match = location_data
                best_score = score
        
        # Verificar se palavras-chave do endereço estão na localização
        address_words = address_lower.split()
        location_words = location_name.split()
        
        common_words = set(address_words) & set(location_words)
        if common_words:
            score = len(common_words) / max(len(address_words), len(location_words)) * 50
            if score > best_score:
                best_match = location_data
                best_score = score
    
    if best_match:
        return {
            "results": [{
                "formatted_address": f"{best_match['area']}, Brasília - DF, Brasil",
                "geometry": {
                    "location": {"lat": best_match["lat"], "lng": best_match["lng"]}
                },
                "place_id": f"mock_place_id_{best_match['area'].lower().replace(' ', '_')}",
                "types": ["locality", "political"]
            }],
            "status": "OK"
        }
    
    # Se não encontrou correspondência, gerar coordenadas aleatórias dentro de Brasília
    import random
    
    # Brasília bounds aproximados
    lat_min, lat_max = -16.1, -15.4
    lng_min, lng_max = -48.2, -47.4
    
    random_lat = random.uniform(lat_min, lat_max)
    random_lng = random.uniform(lng_min, lng_max)
    
    # Determinar área baseada nas coordenadas geradas
    if random_lat > -15.75:
        area = "Asa Norte"
    elif random_lat < -15.85:
        area = "Asa Sul"
    elif random_lng < -48.0:
        area = "Taguatinga"
    else:
        area = "Plano Piloto"
    
    return {
        "results": [{
            "formatted_address": f"{address.title()}, {area}, Brasília - DF, Brasil",
            "geometry": {
                "location": {"lat": random_lat, "lng": random_lng}
            },
            "place_id": f"mock_place_id_{random.randint(1000, 9999)}",
            "types": ["street_address"]
        }],
        "status": "OK"
    }

@api_router.get("/maps/reverse-geocode")
async def mock_reverse_geocode(lat: float, lng: float, current_user: User = Depends(get_current_user)):
    """Mock Google Maps Reverse Geocoding API - convert coordinates to address"""
    
    # Determine approximate area based on coordinates
    if lat > -15.75 and lng > -47.9:
        area = "Asa Norte"
    elif lat < -15.82 and lng > -47.9:
        area = "Asa Sul"
    elif lng < -48.0:
        area = "Taguatinga"
    elif lat < -15.9:
        area = "Gama"
    else:
        area = "Plano Piloto"
    
    street_number = int(abs(lat * lng * 1000)) % 999 + 1
    
    return {
        "results": [{
            "formatted_address": f"Quadra {street_number}, {area}, Brasília - DF, Brasil",
            "geometry": {
                "location": {"lat": lat, "lng": lng}
            },
            "place_id": f"mock_place_id_{lat}_{lng}",
            "types": ["street_address"]
        }],
        "status": "OK"
    }

# Password reset endpoints
@api_router.post("/auth/forgot-password")
async def validate_reset_credentials(request: PasswordResetRequest):
    """Validate email and CPF for password reset"""
    user = await db.users.find_one({
        "email": request.email.lower(),
        "cpf": request.cpf
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado com essas credenciais")
    
    return {
        "message": "Credenciais validadas com sucesso",
        "user_id": user["id"],
        "user_type": user["user_type"]
    }

@api_router.post("/auth/reset-password")
async def reset_password(request: PasswordReset):
    """Reset user password after validation"""
    # Validate that passwords match
    if request.new_password != request.confirm_password:
        raise HTTPException(status_code=400, detail="Senhas não coincidem")
    
    # Find user with email and CPF
    user = await db.users.find_one({
        "email": request.email.lower(),
        "cpf": request.cpf
    })
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado com essas credenciais")
    
    # Hash new password
    hashed_password = bcrypt.hashpw(request.new_password.encode('utf-8'), bcrypt.gensalt())
    
    # Update password in database (store as decoded string)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"hashed_password": hashed_password.decode('utf-8')}}
    )
    
    return {"message": "Senha alterada com sucesso"}

# ==========================================
# TRIP HISTORY ENDPOINTS
# ==========================================

@api_router.get("/passengers/trip-history")
async def get_passenger_trip_history(current_user: User = Depends(get_current_user)):
    """Get trip history for passenger"""
    if current_user.user_type != UserType.PASSENGER:
        raise HTTPException(status_code=403, detail="Passenger access required")
    
    # Get trips with driver details
    pipeline = [
        {"$match": {"passenger_id": current_user.id, "status": "completed"}},
        {"$lookup": {
            "from": "users",
            "localField": "driver_id",
            "foreignField": "id",
            "as": "driver"
        }},
        {"$sort": {"completed_at": -1}},
        {"$limit": 50}  # Last 50 trips
    ]
    
    trips = await db.trips.aggregate(pipeline).to_list(50)
    
    # Process results to include driver details
    result = []
    for trip in trips:
        driver = trip["driver"][0] if trip["driver"] else {}
        
        trip_data = {
            "id": trip["id"],
            "pickup_address": trip["pickup_address"],
            "destination_address": trip["destination_address"],
            "estimated_price": trip["estimated_price"],
            "final_price": trip.get("final_price", trip["estimated_price"]),
            "requested_at": trip["requested_at"],
            "completed_at": trip.get("completed_at"),
            "duration_minutes": trip.get("duration_minutes"),
            "driver_name": driver.get("name"),
            "driver_photo": driver.get("profile_photo"),
            "driver_rating": driver.get("rating"),
            "passenger_rating_given": trip.get("passenger_rating_given")
        }
        result.append(trip_data)
    
    return result

@api_router.get("/drivers/trip-history")
async def get_driver_trip_history(current_user: User = Depends(get_current_user)):
    """Get trip history for driver"""
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Driver access required")
    
    # Get trips with passenger details
    pipeline = [
        {"$match": {"driver_id": current_user.id, "status": "completed"}},
        {"$lookup": {
            "from": "users",
            "localField": "passenger_id",
            "foreignField": "id",
            "as": "passenger"
        }},
        {"$sort": {"completed_at": -1}},
        {"$limit": 50}  # Last 50 trips
    ]
    
    trips = await db.trips.aggregate(pipeline).to_list(50)
    
    # Process results
    result = []
    for trip in trips:
        passenger = trip["passenger"][0] if trip["passenger"] else {}
        
        # Calculate driver earnings (assuming 80% of trip value)
        estimated_price = trip["estimated_price"]
        final_price = trip.get("final_price", estimated_price)
        driver_earnings = final_price * 0.8  # 80% for driver, 20% for platform
        
        trip_data = {
            "id": trip["id"],
            "pickup_address": trip["pickup_address"],
            "destination_address": trip["destination_address"],
            "estimated_price": estimated_price,
            "final_price": final_price,
            "driver_earnings": driver_earnings,
            "requested_at": trip["requested_at"],
            "completed_at": trip.get("completed_at"),
            "duration_minutes": trip.get("duration_minutes"),
            "passenger_name": passenger.get("name"),
            "passenger_photo": passenger.get("profile_photo"),
            "driver_rating_given": trip.get("driver_rating_given")
        }
        result.append(trip_data)
    
    return result

# ==========================================
# CHAT ENDPOINTS
# ==========================================

@api_router.post("/trips/{trip_id}/chat/send")
async def send_chat_message(trip_id: str, message_data: ChatMessageCreate, current_user: User = Depends(get_current_user)):
    """Send a chat message during an active trip"""
    # Verify trip exists and user is participant
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Check if user is participant (passenger or driver) - only participants can send messages
    if current_user.id not in [trip["passenger_id"], trip.get("driver_id")]:
        raise HTTPException(status_code=403, detail="Only trip participants can send messages")
    
    # Only allow chat during active trips (accepted or in_progress)
    if trip["status"] not in [TripStatus.ACCEPTED.value, TripStatus.IN_PROGRESS.value]:
        raise HTTPException(status_code=400, detail="Chat is only available during active trips")
    
    # Create chat message
    chat_message = ChatMessage(
        trip_id=trip_id,
        sender_id=current_user.id,
        sender_name=current_user.name,
        sender_type=current_user.user_type,
        message=message_data.message
    )
    
    await db.chat_messages.insert_one(chat_message.dict())
    
    return {"message": "Message sent successfully", "chat_message": chat_message.dict()}

@api_router.get("/trips/{trip_id}/chat/messages")
async def get_chat_messages(trip_id: str, current_user: User = Depends(get_current_user)):
    """Get all chat messages for a trip"""
    # Verify trip exists
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Check if user can view messages (participant or admin)
    if current_user.user_type != UserType.ADMIN and current_user.id not in [trip["passenger_id"], trip.get("driver_id")]:
        raise HTTPException(status_code=403, detail="Only trip participants or admin can view messages")
    
    # Get messages sorted by timestamp (oldest first)
    messages = await db.chat_messages.find(
        {"trip_id": trip_id}, {"_id": 0}  # Exclude MongoDB _id field
    ).sort("timestamp", 1).to_list(1000)  # Limit to 1000 messages
    
    return messages

@api_router.get("/admin/chats")
async def get_admin_chats(current_user: User = Depends(get_current_user)):
    """Get aggregated chat history for admin dashboard"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Aggregate trips that have chat messages with user details
    pipeline = [
        {"$match": {}},  # All chat messages
        {"$group": {
            "_id": "$trip_id",
            "messages": {"$push": "$$ROOT"},
            "first_message": {"$min": "$timestamp"},
            "last_message": {"$max": "$timestamp"},
            "message_count": {"$sum": 1}
        }},
        {"$lookup": {
            "from": "trips",
            "localField": "_id",
            "foreignField": "id",
            "as": "trip"
        }},
        {"$unwind": "$trip"},
        {"$lookup": {
            "from": "users",
            "localField": "trip.passenger_id",
            "foreignField": "id",
            "as": "passenger"
        }},
        {"$lookup": {
            "from": "users",
            "localField": "trip.driver_id", 
            "foreignField": "id",
            "as": "driver"
        }},
        {"$sort": {"last_message": -1}}  # Most recent conversations first
    ]
    
    chats = await db.chat_messages.aggregate(pipeline).to_list(100)
    
    # Process results to include user details
    result = []
    for chat in chats:
        passenger = chat["passenger"][0] if chat["passenger"] else {}
        driver = chat["driver"][0] if chat["driver"] else {}
        
        result.append({
            "trip_id": chat["_id"],
            "trip_status": chat["trip"]["status"],
            "pickup_address": chat["trip"]["pickup_address"],
            "destination_address": chat["trip"]["destination_address"],
            "first_message": chat["first_message"],
            "last_message": chat["last_message"],
            "message_count": chat["message_count"],
            "passenger": {
                "id": passenger.get("id"),
                "name": passenger.get("name"),
                "profile_photo": passenger.get("profile_photo")
            },
            "driver": {
                "id": driver.get("id"),
                "name": driver.get("name"),
                "profile_photo": driver.get("profile_photo")
            }
        })
    
    return result

@api_router.post("/admin/promote-to-full")
async def promote_to_admin_full(promote_data: dict, current_user: User = Depends(get_current_user)):
    """Promote admin user to Admin Full - Admin Full required or self-promotion when no Admin Full exists"""
    
    user_id = promote_data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    # Check if user exists and is admin
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["user_type"] != "admin":
        raise HTTPException(status_code=400, detail="User must be admin to promote")
    
    if user.get("is_admin_full", False):
        raise HTTPException(status_code=400, detail="User is already Admin Full")
    
    # Check if there's already an Admin Full
    existing_admin_full = await db.users.find_one({"user_type": "admin", "is_admin_full": True})
    if existing_admin_full and existing_admin_full["id"] != user_id:
        raise HTTPException(status_code=400, detail="There can only be one Admin Full")
    
    # Allow self-promotion if user is promoting themselves and no Admin Full exists
    if user_id == current_user.id and not existing_admin_full:
        # Self-promotion to Admin Full when none exists is allowed
        pass
    elif current_user.user_type != UserType.ADMIN or not current_user.is_admin_full:
        # For promoting others, must be Admin Full
        raise HTTPException(status_code=403, detail="Admin Full access required")
    
    # Promote user to Admin Full
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_admin_full": True, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"User promoted to Admin Full successfully"}

@api_router.delete("/admin/delete-admin/{user_id}")
async def delete_admin_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Delete admin user - Only Admin Full can do this"""
    if current_user.user_type != UserType.ADMIN or not current_user.is_admin_full:
        raise HTTPException(status_code=403, detail="Admin Full access required")
    
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Check if user exists and is admin
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["user_type"] != "admin":
        raise HTTPException(status_code=400, detail="Can only delete admin users")
    
    # Delete the admin user
    result = await db.users.delete_one({"id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Failed to delete user")
    
    return {"message": f"Admin user deleted successfully"}

@api_router.post("/trips/{trip_id}/rate-passenger")
async def rate_passenger(
    trip_id: str, 
    rating_data: dict, 
    current_user: User = Depends(get_current_user)
):
    """Driver rates passenger after trip completion"""
    if current_user.user_type != UserType.DRIVER:
        raise HTTPException(status_code=403, detail="Driver access required")
    
    rating = rating_data.get("rating")
    reason = rating_data.get("reason")
    
    if not rating or rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    # Find the trip
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Check if driver owns this trip
    if trip["driver_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your trip")
    
    # Check if trip is completed
    if trip["status"] != "completed":
        raise HTTPException(status_code=400, detail="Trip must be completed to rate")
    
    # Check if already rated
    if trip.get("driver_rating_given"):
        raise HTTPException(status_code=400, detail="Trip already rated by driver")
    
    # Update trip with driver rating
    await db.trips.update_one(
        {"id": trip_id},
        {
            "$set": {
                "driver_rating_stars": rating,
                "driver_rating_reason": reason,
                "driver_rating_given": True,
                "driver_rated_at": datetime.utcnow()
            }
        }
    )
    
    # Update passenger's average rating
    passenger_id = trip["passenger_id"]
    
    # Get all completed trips where this passenger was rated
    rated_trips = await db.trips.find({
        "passenger_id": passenger_id,
        "status": "completed",
        "driver_rating_given": True,
        "driver_rating_stars": {"$exists": True}
    }).to_list(length=None)
    
    if rated_trips:
        total_rating = sum(trip["driver_rating_stars"] for trip in rated_trips)
        avg_rating = total_rating / len(rated_trips)
        
        # Update passenger's rating
        await db.users.update_one(
            {"id": passenger_id},
            {"$set": {"rating": avg_rating}}
        )
    
    return {"message": "Passenger rated successfully"}

@api_router.post("/admin/transfer-admin-full")
async def transfer_admin_full(transfer_data: dict, current_user: User = Depends(get_current_user)):
    """Transfer Admin Full status to another admin - Only Admin Full can do this"""
    if current_user.user_type != UserType.ADMIN or not current_user.is_admin_full:
        raise HTTPException(status_code=403, detail="Admin Full access required")
    
    target_user_id = transfer_data.get("target_user_id")
    if not target_user_id:
        raise HTTPException(status_code=400, detail="target_user_id is required")
    
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot transfer to yourself")
    
    # Check if target user exists and is admin
    target_user = await db.users.find_one({"id": target_user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    if target_user["user_type"] != "admin":
        raise HTTPException(status_code=400, detail="Target user must be admin")
    
    if target_user.get("is_admin_full", False):
        raise HTTPException(status_code=400, detail="Target user is already Admin Full")
    
    # Transfer Admin Full status
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"is_admin_full": False, "updated_at": datetime.utcnow()}}
    )
    
    await db.users.update_one(
        {"id": target_user_id},
        {"$set": {"is_admin_full": True, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Admin Full status transferred successfully"}

@api_router.post("/admin/create-user")
async def create_admin_user(user_data: dict, current_user: User = Depends(get_current_user)):
    """Create admin, manager, or support collaborator - Only Admin Full can do this"""
    if current_user.user_type != UserType.ADMIN or not current_user.is_admin_full:
        raise HTTPException(status_code=403, detail="Admin Full access required")
    
    # Extract data
    name = user_data.get("name", "").strip()
    email = user_data.get("email", "").strip().lower()
    phone = user_data.get("phone", "").strip()
    cpf = user_data.get("cpf", "").strip()
    user_type = user_data.get("user_type", "").strip()
    password = user_data.get("password", "").strip()
    age = user_data.get("age")
    gender = user_data.get("gender", "").strip()
    
    # Validation
    if not all([name, email, phone, cpf, user_type, password]):
        raise HTTPException(status_code=400, detail="All required fields must be provided")
    
    if user_type not in ["admin", "manager", "support_collaborator"]:
        raise HTTPException(status_code=400, detail="Invalid user type")
    
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Check limits
    if user_type == "manager":
        manager_count = await db.users.count_documents({"user_type": "manager", "is_active": True})
        if manager_count >= 4:
            raise HTTPException(status_code=400, detail="Maximum of 4 managers allowed")
    
    if user_type == "support_collaborator":
        support_count = await db.users.count_documents({"user_type": "support_collaborator", "is_active": True})
        if support_count >= 30:
            raise HTTPException(status_code=400, detail="Maximum of 30 support collaborators allowed")
    
    # Check if email already exists
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if CPF already exists
    existing_cpf = await db.users.find_one({"cpf": cpf})
    if existing_cpf:
        raise HTTPException(status_code=400, detail="CPF already registered")
    
    # Create user
    user_id = str(uuid4())
    hashed_password = pwd_context.hash(password)
    
    new_user = {
        "id": user_id,
        "name": name,
        "email": email,
        "phone": phone,
        "cpf": cpf,
        "user_type": user_type,
        "password": hashed_password,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "age": age,
        "gender": gender,
        "is_admin_full": False
    }
    
    await db.users.insert_one(new_user)
    
    user_type_names = {
        "admin": "Administrador",
        "manager": "Gerente", 
        "support_collaborator": "Colaborador de Suporte"
    }
    
    return {"message": f"{user_type_names[user_type]} criado com sucesso"}

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