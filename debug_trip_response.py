#!/usr/bin/env python3
"""
Debug script to examine the actual response from GET /api/trips/my
"""

import requests
import json
from pprint import pprint

# Configuration
BASE_URL = "https://brasilia-rideapp.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def make_request(method: str, endpoint: str, data: dict = None, auth_token: str = None) -> tuple:
    """Make HTTP request and return (success, response_data, status_code)"""
    url = f"{BASE_URL}{endpoint}"
    headers = HEADERS.copy()
    
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
        
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=30)
        elif method.upper() == "PUT":
            response = requests.put(url, headers=headers, json=data, timeout=30)
        else:
            return False, f"Unsupported method: {method}", 0
            
        return response.status_code < 400, response.json() if response.content else {}, response.status_code
        
    except requests.exceptions.RequestException as e:
        return False, f"Request failed: {str(e)}", 0
    except json.JSONDecodeError:
        return False, "Invalid JSON response", response.status_code if 'response' in locals() else 0

def debug_trip_response():
    print("🔍 DEBUG: Examining GET /api/trips/my response")
    print("=" * 60)
    
    # Login as passenger
    login_data = {"email": "maria.santos@email.com", "password": "senha123"}
    success, data, status_code = make_request("POST", "/auth/login", login_data)
    
    if not success:
        print(f"❌ Failed to login as passenger: {data}")
        return
    
    passenger_token = data["access_token"]
    passenger_user = data["user"]
    print(f"✅ Logged in as passenger: {passenger_user['name']}")
    print(f"   User ID: {passenger_user['id']}")
    print()
    
    # Login as driver
    driver_login_data = {"email": "joao.motorista@email.com", "password": "motorista456"}
    success, data, status_code = make_request("POST", "/auth/login", driver_login_data)
    
    if not success:
        print(f"❌ Failed to login as driver: {data}")
        return
    
    driver_token = data["access_token"]
    driver_user = data["user"]
    print(f"✅ Logged in as driver: {driver_user['name']}")
    print(f"   User ID: {driver_user['id']}")
    print(f"   Driver Rating: {driver_user.get('rating', 'N/A')}")
    print()
    
    # Get passenger trips BEFORE creating new trip
    print("📋 Current passenger trips:")
    success, trips, status_code = make_request("GET", "/trips/my", auth_token=passenger_token)
    if success:
        print(f"   Found {len(trips)} existing trips")
        for i, trip in enumerate(trips[:2]):  # Show first 2 trips
            print(f"   Trip {i+1}:")
            print(f"     ID: {trip.get('id', 'N/A')[:8]}...")
            print(f"     Status: {trip.get('status', 'N/A')}")
            print(f"     Driver ID: {trip.get('driver_id', 'N/A')}")
            print(f"     Has driver_name: {'driver_name' in trip}")
            print(f"     Has driver_rating: {'driver_rating' in trip}")
            print(f"     Has driver_photo: {'driver_photo' in trip}")
            if 'driver_name' in trip:
                print(f"     Driver Name: {trip['driver_name']}")
            if 'driver_rating' in trip:
                print(f"     Driver Rating: {trip['driver_rating']}")
            print()
    else:
        print(f"   Failed to get trips: {trips}")
    
    # Create a new trip
    print("🚗 Creating new trip...")
    trip_data = {
        "passenger_id": passenger_user["id"],
        "pickup_latitude": -15.7633,
        "pickup_longitude": -47.8719,
        "pickup_address": "SQN 308, Asa Norte, Brasília - DF",
        "destination_latitude": -15.8267,
        "destination_longitude": -47.8978,
        "destination_address": "SQS 116, Asa Sul, Brasília - DF",
        "estimated_price": 15.50
    }
    
    success, trip_response, _ = make_request("POST", "/trips/request", trip_data, auth_token=passenger_token)
    
    if not success:
        print(f"❌ Failed to create trip: {trip_response}")
        return
    
    trip_id = trip_response["id"]
    print(f"✅ Trip created with ID: {trip_id[:8]}...")
    print()
    
    # Accept the trip as driver
    print("✋ Driver accepting trip...")
    success, accept_response, _ = make_request("PUT", f"/trips/{trip_id}/accept", auth_token=driver_token)
    
    if not success:
        print(f"❌ Failed to accept trip: {accept_response}")
        return
    
    print("✅ Trip accepted by driver")
    print()
    
    # Get passenger trips AFTER acceptance
    print("📋 Passenger trips after acceptance:")
    success, trips, status_code = make_request("GET", "/trips/my", auth_token=passenger_token)
    
    if success:
        print(f"   Status Code: {status_code}")
        print(f"   Number of trips: {len(trips)}")
        print()
        
        # Find our specific trip
        our_trip = next((t for t in trips if t.get("id") == trip_id), None)
        
        if our_trip:
            print("🎯 Our specific trip details:")
            print("   Raw trip data:")
            pprint(our_trip, width=80, depth=3)
            print()
            
            print("   Driver information check:")
            print(f"     Status: {our_trip.get('status', 'N/A')}")
            print(f"     Driver ID: {our_trip.get('driver_id', 'N/A')}")
            print(f"     Has driver_name: {'driver_name' in our_trip}")
            print(f"     Has driver_rating: {'driver_rating' in our_trip}")
            print(f"     Has driver_photo: {'driver_photo' in our_trip}")
            
            if 'driver_name' in our_trip:
                print(f"     Driver Name: {our_trip['driver_name']}")
            if 'driver_rating' in our_trip:
                print(f"     Driver Rating: {our_trip['driver_rating']}")
            if 'driver_photo' in our_trip:
                print(f"     Driver Photo: {'Present' if our_trip['driver_photo'] else 'None'}")
        else:
            print("❌ Could not find our trip in the response")
    else:
        print(f"❌ Failed to get trips: {trips}")
    
    print()
    print("=" * 60)

if __name__ == "__main__":
    debug_trip_response()