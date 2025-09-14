# =============================================================================
# BACKEND - ADIÇÕES PARA SISTEMA DE CHAT
# Arquivo: backend/server.py
# =============================================================================

# ===== ADIÇÕES NO INÍCIO DO ARQUIVO (após imports) =====

# Adicionar ao modelo ChatMessage após os outros modelos:
class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trip_id: str
    sender_id: str
    sender_name: str
    sender_type: UserType  # passenger or driver
    message: str = Field(max_length=250)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
class ChatMessageCreate(BaseModel):
    message: str = Field(max_length=250)

# ===== ENDPOINTS DE CHAT (adicionar antes de app.include_router) =====

# Chat endpoints
@api_router.post("/trips/{trip_id}/chat/send")
async def send_chat_message(trip_id: str, message_data: ChatMessageCreate, current_user: User = Depends(get_current_user)):
    """Send a chat message during a trip"""
    # Verify trip exists and user is involved
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Check if user is either passenger or driver of this trip
    if current_user.id not in [trip["passenger_id"], trip.get("driver_id")]:
        raise HTTPException(status_code=403, detail="Not authorized for this trip")
    
    # Check if trip is in active state (accepted or in_progress)
    if trip["status"] not in ["accepted", "in_progress"]:
        raise HTTPException(status_code=400, detail="Chat only available for active trips")
    
    # Create chat message
    chat_message = ChatMessage(
        trip_id=trip_id,
        sender_id=current_user.id,
        sender_name=current_user.name,
        sender_type=current_user.user_type,
        message=message_data.message
    )
    
    await db.chat_messages.insert_one(chat_message.dict())
    
    return {"message": "Message sent successfully", "chat_message": chat_message}

@api_router.get("/trips/{trip_id}/chat/messages")
async def get_chat_messages(trip_id: str, current_user: User = Depends(get_current_user)):
    """Get all chat messages for a trip"""
    # Verify trip exists and user is involved
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Check if user is either passenger or driver of this trip, or admin
    if current_user.user_type == UserType.ADMIN:
        # Admin can view all chats
        pass
    elif current_user.id not in [trip["passenger_id"], trip.get("driver_id")]:
        raise HTTPException(status_code=403, detail="Not authorized for this trip")
    
    # Get messages for this trip
    messages = await db.chat_messages.find({"trip_id": trip_id}).sort("timestamp", 1).to_list(1000)
    
    return [ChatMessage(**message) for message in messages]

# Admin Chat endpoints
@api_router.get("/admin/chats")
async def get_all_chats(current_user: User = Depends(get_current_user)):
    """Get all chat conversations for admin"""
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all trips that have chat messages
    pipeline = [
        {
            "$group": {
                "_id": "$trip_id",
                "message_count": {"$sum": 1},
                "last_message": {"$last": "$message"},
                "last_timestamp": {"$last": "$timestamp"}
            }
        },
        {"$sort": {"last_timestamp": -1}}
    ]
    
    chat_groups = await db.chat_messages.aggregate(pipeline).to_list(1000)
    
    # Get trip details for each chat group
    result = []
    for chat_group in chat_groups:
        trip_id = chat_group["_id"]
        trip = await db.trips.find_one({"id": trip_id})
        if trip:
            # Get passenger and driver details
            passenger = await db.users.find_one({"id": trip["passenger_id"]})
            driver = await db.users.find_one({"id": trip.get("driver_id")}) if trip.get("driver_id") else None
            
            result.append({
                "trip_id": trip_id,
                "trip_status": trip["status"],
                "pickup_address": trip["pickup_address"],
                "destination_address": trip["destination_address"],
                "passenger_name": passenger.get("name", "Unknown") if passenger else "Unknown",
                "driver_name": driver.get("name", "Unknown") if driver else "Unknown",
                "message_count": chat_group["message_count"],
                "last_message": chat_group["last_message"],
                "last_timestamp": chat_group["last_timestamp"]
            })
    
    return result

# ===== MODIFICAÇÃO DO ENDPOINT ADMIN TRIPS =====
# Substituir o endpoint existente @api_router.get("/admin/trips") por:

@api_router.get("/admin/trips")
async def get_all_trips(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    trips = await db.trips.find({}).sort("requested_at", -1).to_list(1000)
    
    # Enrich trips with complete user details
    enriched_trips = []
    for trip in trips:
        # Get passenger details
        passenger = await db.users.find_one({"id": trip["passenger_id"]})
        passenger_data = {
            "passenger_name": passenger.get("name", "Unknown") if passenger else "Unknown",
            "passenger_email": passenger.get("email", "Unknown") if passenger else "Unknown", 
            "passenger_phone": passenger.get("phone", "Unknown") if passenger else "Unknown",
            "passenger_photo": passenger.get("profile_photo") if passenger else None,
            "passenger_rating": passenger.get("rating", 5.0) if passenger else 5.0
        }
        
        # Get driver details if trip has been accepted
        driver_data = {
            "driver_name": "Não atribuído",
            "driver_email": "N/A",
            "driver_phone": "N/A", 
            "driver_photo": None,
            "driver_rating": 5.0
        }
        
        if trip.get("driver_id"):
            driver = await db.users.find_one({"id": trip["driver_id"]})
            if driver:
                driver_data = {
                    "driver_name": driver.get("name", "Unknown"),
                    "driver_email": driver.get("email", "Unknown"),
                    "driver_phone": driver.get("phone", "Unknown"),
                    "driver_photo": driver.get("profile_photo"),
                    "driver_rating": driver.get("rating", 5.0)
                }
        
        # Combine trip data with user details
        trip_data = Trip(**trip).dict()
        trip_data.update(passenger_data)
        trip_data.update(driver_data)
        
        enriched_trips.append(trip_data)
    
    return enriched_trips