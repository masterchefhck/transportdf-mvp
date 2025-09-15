#!/usr/bin/env python3
"""
Debug Chat Synchronization Issue
"""

import asyncio
import aiohttp
import json
import os

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://brasilia-rider.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

async def debug_chat_sync():
    session = aiohttp.ClientSession()
    
    try:
        # Register users
        import time
        timestamp = str(int(time.time()))
        
        # Register passenger
        passenger_data = {
            "name": "Debug Passenger",
            "email": f"debug.passenger.{timestamp}@test.com",
            "phone": "+5561912345678",
            "cpf": "123.456.789-01",
            "user_type": "passenger",
            "password": "testpass123"
        }
        
        async with session.post(f"{API_BASE}/auth/register", json=passenger_data) as response:
            passenger_auth = await response.json()
            print(f"Passenger registration response: {passenger_auth}")
            if response.status != 200:
                print(f"Failed to register passenger: {response.status}")
                return
            passenger_token = passenger_auth['access_token']
            passenger_id = passenger_auth['user']['id']
            print(f"Passenger registered: {passenger_id}")
        
        # Register driver
        driver_data = {
            "name": "Debug Driver",
            "email": f"debug.driver.{timestamp}@test.com",
            "phone": "+5561987654321",
            "cpf": "987.654.321-01",
            "user_type": "driver",
            "password": "testpass123"
        }
        
        async with session.post(f"{API_BASE}/auth/register", json=driver_data) as response:
            driver_auth = await response.json()
            driver_token = driver_auth['access_token']
            driver_id = driver_auth['user']['id']
            print(f"Driver registered: {driver_id}")
        
        # Create trip
        trip_data = {
            "passenger_id": passenger_id,
            "pickup_latitude": -15.7801,
            "pickup_longitude": -47.9292,
            "pickup_address": "Debug Pickup",
            "destination_latitude": -15.8267,
            "destination_longitude": -47.9218,
            "destination_address": "Debug Destination",
            "estimated_price": 10.00
        }
        
        headers = {'Authorization': f'Bearer {passenger_token}'}
        async with session.post(f"{API_BASE}/trips/request", json=trip_data, headers=headers) as response:
            trip = await response.json()
            trip_id = trip['id']
            print(f"Trip created: {trip_id}")
        
        # Driver accepts trip
        headers = {'Authorization': f'Bearer {driver_token}'}
        async with session.put(f"{API_BASE}/trips/{trip_id}/accept", headers=headers) as response:
            print(f"Trip accepted: {response.status}")
        
        # Send messages
        headers = {'Authorization': f'Bearer {passenger_token}'}
        async with session.post(f"{API_BASE}/trips/{trip_id}/chat/send", 
                               json={"message": "Passenger message"}, headers=headers) as response:
            print(f"Passenger message sent: {response.status}")
        
        headers = {'Authorization': f'Bearer {driver_token}'}
        async with session.post(f"{API_BASE}/trips/{trip_id}/chat/send",
                               json={"message": "Driver message"}, headers=headers) as response:
            print(f"Driver message sent: {response.status}")
        
        # Wait a moment
        await asyncio.sleep(1)
        
        # Check messages as passenger
        headers = {'Authorization': f'Bearer {passenger_token}'}
        async with session.get(f"{API_BASE}/trips/{trip_id}/chat/messages", headers=headers) as response:
            passenger_messages = await response.json()
            print(f"Passenger sees {len(passenger_messages)} messages: {response.status}")
            if passenger_messages:
                print(f"First message: {passenger_messages[0]}")
        
        # Check messages as driver
        headers = {'Authorization': f'Bearer {driver_token}'}
        async with session.get(f"{API_BASE}/trips/{trip_id}/chat/messages", headers=headers) as response:
            driver_messages = await response.json()
            print(f"Driver sees {len(driver_messages)} messages: {response.status}")
            if driver_messages:
                print(f"First message: {driver_messages[0]}")
                
    finally:
        await session.close()

if __name__ == "__main__":
    asyncio.run(debug_chat_sync())