#!/usr/bin/env python3
"""
Backend Test Suite for Transport App Brasília MVP - Chat Endpoints Focus
Testing the newly implemented chat endpoints as per review request
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime
import sys

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://ridemate-18.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class ChatEndpointsTestSuite:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.tokens = {}
        self.users = {}
        self.trips = {}
        
    async def setup_session(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup_session(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            
    async def make_request(self, method, endpoint, data=None, token=None):
        """Make HTTP request with optional authentication"""
        url = f"{API_BASE}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
            
        try:
            async with self.session.request(method, url, json=data, headers=headers) as response:
                response_data = await response.json()
                return response.status, response_data
        except Exception as e:
            return None, {"error": str(e)}
            
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
            
    async def test_health_check(self):
        """Test basic health check"""
        status, data = await self.make_request('GET', '/health')
        success = status == 200 and data.get('status') == 'healthy'
        self.log_test("Health Check", success, f"Status: {status}, Response: {data}")
        return success
        
    async def register_user(self, user_type, name, email):
        """Register a test user"""
        user_data = {
            "name": name,
            "email": email,
            "phone": f"+55619{user_type[:4]}1234",
            "cpf": f"123.456.789-{user_type[:2]}",
            "user_type": user_type,
            "password": "testpass123"
        }
        
        status, data = await self.make_request('POST', '/auth/register', user_data)
        
        if status == 200:
            self.tokens[user_type] = data['access_token']
            self.users[user_type] = data['user']
            self.log_test(f"Register {user_type.title()}", True, f"User ID: {data['user']['id']}")
            return True
        else:
            self.log_test(f"Register {user_type.title()}", False, f"Status: {status}, Error: {data}")
            return False
            
    async def setup_test_users(self):
        """Setup test users for chat testing"""
        users_to_create = [
            ("passenger", "Maria Silva Santos", "maria.chat@test.com"),
            ("driver", "João Carlos Oliveira", "joao.chat@test.com"),
            ("admin", "Admin Chat Test", "admin.chat@test.com")
        ]
        
        success_count = 0
        for user_type, name, email in users_to_create:
            if await self.register_user(user_type, name, email):
                success_count += 1
                
        return success_count == len(users_to_create)
        
    async def create_test_trip(self):
        """Create a test trip for chat testing"""
        # Passenger requests trip
        trip_data = {
            "passenger_id": self.users['passenger']['id'],
            "pickup_latitude": -15.7801,
            "pickup_longitude": -47.9292,
            "pickup_address": "Asa Norte, Brasília - DF",
            "destination_latitude": -15.8267,
            "destination_longitude": -47.9218,
            "destination_address": "Asa Sul, Brasília - DF",
            "estimated_price": 12.50
        }
        
        status, data = await self.make_request('POST', '/trips/request', trip_data, self.tokens['passenger'])
        
        if status == 200:
            self.trips['test_trip'] = data
            self.log_test("Create Test Trip", True, f"Trip ID: {data['id']}")
            return True
        else:
            self.log_test("Create Test Trip", False, f"Status: {status}, Error: {data}")
            return False
            
    async def accept_trip(self):
        """Driver accepts the test trip"""
        trip_id = self.trips['test_trip']['id']
        status, data = await self.make_request('PUT', f'/trips/{trip_id}/accept', None, self.tokens['driver'])
        
        if status == 200:
            self.log_test("Driver Accept Trip", True, "Trip accepted successfully")
            return True
        else:
            self.log_test("Driver Accept Trip", False, f"Status: {status}, Error: {data}")
            return False
            
    async def test_chat_send_passenger(self):
        """Test passenger sending chat message"""
        trip_id = self.trips['test_trip']['id']
        message_data = {"message": "Olá, estou no local de embarque!"}
        
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', message_data, self.tokens['passenger'])
        
        success = status == 200
        details = f"Status: {status}, Response: {data}"
        self.log_test("Passenger Send Chat Message", success, details)
        return success
        
    async def test_chat_send_driver(self):
        """Test driver sending chat message"""
        trip_id = self.trips['test_trip']['id']
        message_data = {"message": "Oi! Estou chegando, aguarde 2 minutos."}
        
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', message_data, self.tokens['driver'])
        
        success = status == 200
        details = f"Status: {status}, Response: {data}"
        self.log_test("Driver Send Chat Message", success, details)
        return success
        
    async def test_chat_character_limit(self):
        """Test 250 character limit validation"""
        trip_id = self.trips['test_trip']['id']
        # Create a message with exactly 251 characters
        long_message = "A" * 251
        message_data = {"message": long_message}
        
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', message_data, self.tokens['passenger'])
        
        # Should fail with 422 (validation error)
        success = status == 422
        details = f"Status: {status}, Expected: 422 (validation error)"
        self.log_test("Chat Message 250 Character Limit", success, details)
        return success
        
    async def test_chat_access_control_non_participant(self):
        """Test that non-participants cannot send messages"""
        trip_id = self.trips['test_trip']['id']
        message_data = {"message": "Admin trying to send message"}
        
        # Admin should not be able to send messages (only participants)
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', message_data, self.tokens['admin'])
        
        # Should fail with 403 (forbidden) - only participants can send
        success = status == 403
        details = f"Status: {status}, Expected: 403 (forbidden for non-participants)"
        self.log_test("Chat Access Control - Non-Participant", success, details)
        return success
        
    async def test_chat_trip_status_validation(self):
        """Test that chat only works during accepted/in_progress trips"""
        # Create a new trip that's not accepted yet
        trip_data = {
            "passenger_id": self.users['passenger']['id'],
            "pickup_latitude": -15.7801,
            "pickup_longitude": -47.9292,
            "pickup_address": "Test Pickup",
            "destination_latitude": -15.8267,
            "destination_longitude": -47.9218,
            "destination_address": "Test Destination",
            "estimated_price": 10.00
        }
        
        status, trip_response = await self.make_request('POST', '/trips/request', trip_data, self.tokens['passenger'])
        
        if status != 200:
            self.log_test("Chat Trip Status Validation", False, "Failed to create test trip")
            return False
            
        # Try to send message to requested (not accepted) trip
        new_trip_id = trip_response['id']
        message_data = {"message": "This should fail"}
        
        status, data = await self.make_request('POST', f'/trips/{new_trip_id}/chat/send', message_data, self.tokens['passenger'])
        
        # Should fail with 400 (bad request) - trip not in accepted/in_progress status
        success = status == 400
        details = f"Status: {status}, Expected: 400 (trip not active)"
        self.log_test("Chat Trip Status Validation", success, details)
        return success
        
    async def test_get_chat_messages_passenger(self):
        """Test passenger retrieving chat messages"""
        trip_id = self.trips['test_trip']['id']
        
        status, data = await self.make_request('GET', f'/trips/{trip_id}/chat/messages', None, self.tokens['passenger'])
        
        success = status == 200 and isinstance(data, list)
        if success:
            # Check if messages have required fields
            if data:
                message = data[0]
                required_fields = ['id', 'trip_id', 'sender_id', 'sender_name', 'sender_type', 'message', 'timestamp']
                has_all_fields = all(field in message for field in required_fields)
                success = has_all_fields
                details = f"Status: {status}, Messages: {len(data)}, Fields OK: {has_all_fields}"
            else:
                details = f"Status: {status}, No messages found"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Get Chat Messages - Passenger", success, details)
        return success
        
    async def test_get_chat_messages_driver(self):
        """Test driver retrieving chat messages"""
        trip_id = self.trips['test_trip']['id']
        
        status, data = await self.make_request('GET', f'/trips/{trip_id}/chat/messages', None, self.tokens['driver'])
        
        success = status == 200 and isinstance(data, list)
        details = f"Status: {status}, Messages: {len(data) if isinstance(data, list) else 'N/A'}"
        self.log_test("Get Chat Messages - Driver", success, details)
        return success
        
    async def test_get_chat_messages_admin(self):
        """Test admin retrieving chat messages"""
        trip_id = self.trips['test_trip']['id']
        
        status, data = await self.make_request('GET', f'/trips/{trip_id}/chat/messages', None, self.tokens['admin'])
        
        success = status == 200 and isinstance(data, list)
        details = f"Status: {status}, Messages: {len(data) if isinstance(data, list) else 'N/A'}"
        self.log_test("Get Chat Messages - Admin", success, details)
        return success
        
    async def test_chat_message_ordering(self):
        """Test that messages are returned in chronological order (oldest first)"""
        trip_id = self.trips['test_trip']['id']
        
        # Send multiple messages with slight delays
        messages = [
            "Primeira mensagem",
            "Segunda mensagem", 
            "Terceira mensagem"
        ]
        
        for msg in messages:
            await self.make_request('POST', f'/trips/{trip_id}/chat/send', {"message": msg}, self.tokens['passenger'])
            await asyncio.sleep(0.1)  # Small delay to ensure different timestamps
            
        # Get messages
        status, data = await self.make_request('GET', f'/trips/{trip_id}/chat/messages', None, self.tokens['passenger'])
        
        success = False
        if status == 200 and isinstance(data, list) and len(data) >= 3:
            # Check if messages are in chronological order (oldest first)
            timestamps = [msg['timestamp'] for msg in data]
            is_chronological = timestamps == sorted(timestamps)
            success = is_chronological
            details = f"Status: {status}, Messages: {len(data)}, Chronological: {is_chronological}"
        else:
            details = f"Status: {status}, Messages: {len(data) if isinstance(data, list) else 'N/A'}"
            
        self.log_test("Chat Message Chronological Ordering", success, details)
        return success
        
    async def test_admin_chats_aggregation(self):
        """Test admin chat aggregation endpoint"""
        status, data = await self.make_request('GET', '/admin/chats', None, self.tokens['admin'])
        
        success = status == 200 and isinstance(data, list)
        if success and data:
            # Check if aggregation has required fields
            chat = data[0]
            required_fields = ['trip_id', 'trip_status', 'pickup_address', 'destination_address', 
                             'first_message', 'last_message', 'message_count', 'passenger', 'driver']
            has_all_fields = all(field in chat for field in required_fields)
            success = has_all_fields
            details = f"Status: {status}, Chats: {len(data)}, Fields OK: {has_all_fields}"
        else:
            details = f"Status: {status}, Chats: {len(data) if isinstance(data, list) else 'N/A'}"
            
        self.log_test("Admin Chat Aggregation", success, details)
        return success
        
    async def test_nonexistent_trip_chat(self):
        """Test chat endpoints with non-existent trip ID"""
        fake_trip_id = "nonexistent-trip-id"
        
        # Test sending message to non-existent trip
        status, data = await self.make_request('POST', f'/trips/{fake_trip_id}/chat/send', 
                                             {"message": "Test"}, self.tokens['passenger'])
        
        success = status == 404
        details = f"Status: {status}, Expected: 404 (trip not found)"
        self.log_test("Non-existent Trip Chat Validation", success, details)
        return success
        
    async def run_complete_chat_scenario(self):
        """Run the complete chat scenario as requested"""
        print("\n🎯 EXECUTING COMPLETE CHAT SCENARIO")
        print("=" * 60)
        
        # Step 1: Setup users
        print("Step 1: Creating test users...")
        if not await self.setup_test_users():
            return False
            
        # Step 2: Create trip
        print("Step 2: Creating test trip...")
        if not await self.create_test_trip():
            return False
            
        # Step 3: Driver accepts trip
        print("Step 3: Driver accepting trip...")
        if not await self.accept_trip():
            return False
            
        # Step 4: Both participants send messages
        print("Step 4: Testing chat functionality...")
        chat_tests = [
            self.test_chat_send_passenger(),
            self.test_chat_send_driver(),
            self.test_chat_character_limit(),
            self.test_chat_access_control_non_participant(),
            self.test_chat_trip_status_validation(),
            self.test_get_chat_messages_passenger(),
            self.test_get_chat_messages_driver(),
            self.test_get_chat_messages_admin(),
            self.test_chat_message_ordering(),
            self.test_admin_chats_aggregation(),
            self.test_nonexistent_trip_chat()
        ]
        
        results = await asyncio.gather(*chat_tests, return_exceptions=True)
        
        # Count successful tests
        successful_tests = sum(1 for result in results if result is True)
        total_tests = len(results)
        
        print(f"\nChat functionality tests: {successful_tests}/{total_tests} passed")
        return successful_tests == total_tests
        
    async def run_all_tests(self):
        """Run all chat endpoint tests"""
        print("🚀 STARTING CHAT ENDPOINTS TEST SUITE")
        print("=" * 60)
        
        await self.setup_session()
        
        try:
            # Basic health check
            if not await self.test_health_check():
                print("❌ Health check failed, aborting tests")
                return
                
            # Run complete chat scenario
            scenario_success = await self.run_complete_chat_scenario()
            
            # Print summary
            print("\n" + "=" * 60)
            print("📊 CHAT ENDPOINTS TEST SUMMARY")
            print("=" * 60)
            
            passed = sum(1 for result in self.test_results if result['success'])
            total = len(self.test_results)
            success_rate = (passed / total * 100) if total > 0 else 0
            
            print(f"Total Tests: {total}")
            print(f"Passed: {passed}")
            print(f"Failed: {total - passed}")
            print(f"Success Rate: {success_rate:.1f}%")
            
            if scenario_success:
                print("\n🎉 CHAT ENDPOINTS COMPLETELY FUNCTIONAL!")
                print("✅ All chat functionality working as expected")
            else:
                print("\n⚠️  Some chat functionality issues detected")
                
            # Print failed tests
            failed_tests = [result for result in self.test_results if not result['success']]
            if failed_tests:
                print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
                for test in failed_tests:
                    print(f"   • {test['test']}: {test['details']}")
                    
        finally:
            await self.cleanup_session()

async def main():
    """Main test execution"""
    test_suite = ChatEndpointsTestSuite()
    await test_suite.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())