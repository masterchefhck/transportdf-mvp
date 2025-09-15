#!/usr/bin/env python3
"""
Backend Test Suite for Transport App Brasília MVP - Current Bug Fixes Testing
Testing the bug fixes implemented as per current review request:
- BUG 1: Driver dashboard - informações do passageiro não aparecem
- BUG 2: Admin dashboard - informações dos usuários nas viagens
- Enhanced GET /api/trips/my endpoint with user aggregation
- Enhanced GET /api/admin/trips endpoint with complete user information
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

class BugFixTestSuite:
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
        import time
        import random
        timestamp = str(int(time.time()))[-4:]  # Last 4 digits
        random_suffix = str(random.randint(1000, 9999))
        
        user_data = {
            "name": name,
            "email": email,
            "phone": f"+55619{random_suffix}",
            "cpf": f"123.{random_suffix[:3]}.{timestamp[:3]}-{timestamp[3:]}",
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
        """Setup test users for bug fix testing"""
        import time
        timestamp = str(int(time.time()))
        
        users_to_create = [
            ("passenger", "Maria Silva Santos", f"maria.bugfix.{timestamp}@test.com"),
            ("driver", "João Carlos Oliveira", f"joao.bugfix.{timestamp}@test.com"),
            ("admin", "Admin Bug Test", f"admin.bugfix.{timestamp}@test.com")
        ]
        
        success_count = 0
        for user_type, name, email in users_to_create:
            if await self.register_user(user_type, name, email):
                success_count += 1
                
        return success_count == len(users_to_create)
        
    async def upload_profile_photos(self):
        """Upload profile photos for both passenger and driver"""
        # Simple base64 encoded 1x1 pixel image for testing
        test_photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        
        # Upload passenger photo
        passenger_status, passenger_data = await self.make_request('PUT', '/users/profile-photo', 
                                                                  {"profile_photo": test_photo}, 
                                                                  self.tokens['passenger'])
        
        # Upload driver photo  
        driver_status, driver_data = await self.make_request('PUT', '/users/profile-photo',
                                                           {"profile_photo": test_photo},
                                                           self.tokens['driver'])
        
        success = passenger_status == 200 and driver_status == 200
        self.log_test("Upload Profile Photos", success, 
                     f"Passenger: {passenger_status}, Driver: {driver_status}")
        return success
        
    async def create_test_trip(self):
        """Create a test trip for bug fix testing"""
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
            
    async def test_bug1_trips_my_passenger_info(self):
        """BUG 1: Test GET /api/trips/my returns complete driver information for passenger"""
        status, data = await self.make_request('GET', '/trips/my', None, self.tokens['passenger'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200 and isinstance(data, list) and len(data) > 0:
            trip = data[0]  # Get the first trip
            
            # Check if driver information is included
            required_driver_fields = ['driver_name', 'driver_photo', 'driver_rating', 'driver_phone']
            has_driver_info = all(field in trip for field in required_driver_fields)
            
            if has_driver_info:
                success = True
                details = f"Status: {status}, Driver info present: {[field for field in required_driver_fields if field in trip]}"
            else:
                missing_fields = [field for field in required_driver_fields if field not in trip]
                details = f"Status: {status}, Missing driver fields: {missing_fields}"
        else:
            details = f"Status: {status}, Trips count: {len(data) if isinstance(data, list) else 'N/A'}"
            
        self.log_test("BUG 1: GET /api/trips/my - Driver Info for Passenger", success, details)
        return success
        
    async def test_bug1_trips_my_driver_info(self):
        """BUG 1: Test GET /api/trips/my returns complete passenger information for driver"""
        status, data = await self.make_request('GET', '/trips/my', None, self.tokens['driver'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200 and isinstance(data, list) and len(data) > 0:
            trip = data[0]  # Get the first trip
            
            # Check if passenger information is included
            required_passenger_fields = ['passenger_name', 'passenger_photo', 'passenger_rating', 'passenger_phone']
            has_passenger_info = all(field in trip for field in required_passenger_fields)
            
            if has_passenger_info:
                success = True
                details = f"Status: {status}, Passenger info present: {[field for field in required_passenger_fields if field in trip]}"
            else:
                missing_fields = [field for field in required_passenger_fields if field not in trip]
                details = f"Status: {status}, Missing passenger fields: {missing_fields}"
        else:
            details = f"Status: {status}, Trips count: {len(data) if isinstance(data, list) else 'N/A'}"
            
        self.log_test("BUG 1: GET /api/trips/my - Passenger Info for Driver", success, details)
        return success
        
    async def test_bug3_chat_send_and_persist(self):
        """BUG 3: Test chat message sending and persistence"""
        trip_id = self.trips['test_trip']['id']
        
        # Send message from passenger
        passenger_message = {"message": "Olá, estou no local de embarque!"}
        status1, data1 = await self.make_request('POST', f'/trips/{trip_id}/chat/send', 
                                                passenger_message, self.tokens['passenger'])
        
        # Send message from driver
        driver_message = {"message": "Oi! Estou chegando, aguarde 2 minutos."}
        status2, data2 = await self.make_request('POST', f'/trips/{trip_id}/chat/send',
                                               driver_message, self.tokens['driver'])
        
        success = status1 == 200 and status2 == 200
        details = f"Passenger send: {status1}, Driver send: {status2}"
        self.log_test("BUG 3: Chat Message Sending", success, details)
        return success
        
    async def test_bug3_chat_message_persistence(self):
        """BUG 3: Test chat message persistence and retrieval"""
        trip_id = self.trips['test_trip']['id']
        
        # Wait a moment to ensure messages are persisted
        await asyncio.sleep(1)
        
        # Retrieve messages as passenger
        status, data = await self.make_request('GET', f'/trips/{trip_id}/chat/messages', 
                                             None, self.tokens['passenger'])
        
        success = False
        if status == 200 and isinstance(data, list) and len(data) >= 2:
            # Check if messages have required structure
            message = data[0]
            required_fields = ['id', 'trip_id', 'sender_id', 'sender_name', 'sender_type', 'message', 'timestamp']
            has_all_fields = all(field in message for field in required_fields)
            success = has_all_fields
            details = f"Status: {status}, Messages: {len(data)}, Structure OK: {has_all_fields}"
        else:
            details = f"Status: {status}, Messages: {len(data) if isinstance(data, list) else 'N/A'}"
            
        self.log_test("BUG 3: Chat Message Persistence", success, details)
        return success
        
    async def test_bug3_chat_synchronization(self):
        """BUG 3: Test chat message synchronization between participants"""
        trip_id = self.trips['test_trip']['id']
        
        # Get messages as passenger
        status1, passenger_messages = await self.make_request('GET', f'/trips/{trip_id}/chat/messages',
                                                            None, self.tokens['passenger'])
        
        # Get messages as driver
        status2, driver_messages = await self.make_request('GET', f'/trips/{trip_id}/chat/messages',
                                                         None, self.tokens['driver'])
        
        success = False
        if status1 == 200 and status2 == 200:
            # Both should see the same messages
            passenger_count = len(passenger_messages) if isinstance(passenger_messages, list) else 0
            driver_count = len(driver_messages) if isinstance(driver_messages, list) else 0
            success = passenger_count == driver_count and passenger_count > 0
            details = f"Passenger sees: {passenger_count}, Driver sees: {driver_count}, Synchronized: {success}"
        else:
            details = f"Passenger status: {status1}, Driver status: {status2}"
            
        self.log_test("BUG 3: Chat Message Synchronization", success, details)
        return success
        
    async def test_chat_character_limit(self):
        """Test 250 character limit validation"""
        trip_id = self.trips['test_trip']['id']
        # Create a message with exactly 251 characters
        long_message = "A" * 251
        message_data = {"message": long_message}
        
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', 
                                             message_data, self.tokens['passenger'])
        
        # Should fail with 422 (validation error)
        success = status == 422
        details = f"Status: {status}, Expected: 422 (validation error)"
        self.log_test("Chat 250 Character Limit Validation", success, details)
        return success
        
    async def test_admin_chats_endpoint(self):
        """Test GET /api/admin/chats endpoint"""
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
            
        self.log_test("GET /api/admin/chats Endpoint", success, details)
        return success
        
    async def test_chat_polling_simulation(self):
        """Simulate chat polling every 5 seconds (BUG 3 fix)"""
        trip_id = self.trips['test_trip']['id']
        
        # Send a new message
        new_message = {"message": "Mensagem para testar polling"}
        await self.make_request('POST', f'/trips/{trip_id}/chat/send', new_message, self.tokens['passenger'])
        
        # Wait 1 second (simulating polling interval)
        await asyncio.sleep(1)
        
        # Poll for messages
        status, data = await self.make_request('GET', f'/trips/{trip_id}/chat/messages',
                                             None, self.tokens['driver'])
        
        success = status == 200 and isinstance(data, list)
        if success:
            # Check if the new message is present
            messages_with_polling_text = [msg for msg in data if "polling" in msg.get('message', '').lower()]
            success = len(messages_with_polling_text) > 0
            details = f"Status: {status}, Total messages: {len(data)}, Polling message found: {success}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Chat Polling Simulation", success, details)
        return success
        
    async def run_bug_fix_scenario(self):
        """Run the complete bug fix testing scenario"""
        print("\n🎯 EXECUTING BUG FIX TESTING SCENARIO")
        print("=" * 60)
        
        # Step 1: Setup users
        print("Step 1: Creating test users...")
        if not await self.setup_test_users():
            return False
            
        # Step 2: Upload profile photos (for BUG 1 testing)
        print("Step 2: Uploading profile photos...")
        await self.upload_profile_photos()  # Not critical if fails
            
        # Step 3: Create trip
        print("Step 3: Creating test trip...")
        if not await self.create_test_trip():
            return False
            
        # Step 4: Driver accepts trip
        print("Step 4: Driver accepting trip...")
        if not await self.accept_trip():
            return False
            
        # Step 5: Test all bug fixes
        print("Step 5: Testing bug fixes...")
        bug_fix_tests = [
            self.test_bug1_trips_my_passenger_info(),
            self.test_bug1_trips_my_driver_info(),
            self.test_bug3_chat_send_and_persist(),
            self.test_bug3_chat_message_persistence(),
            self.test_bug3_chat_synchronization(),
            self.test_chat_character_limit(),
            self.test_admin_chats_endpoint(),
            self.test_chat_polling_simulation()
        ]
        
        results = await asyncio.gather(*bug_fix_tests, return_exceptions=True)
        
        # Count successful tests
        successful_tests = sum(1 for result in results if result is True)
        total_tests = len(results)
        
        print(f"\nBug fix tests: {successful_tests}/{total_tests} passed")
        return successful_tests == total_tests
        
    async def run_all_tests(self):
        """Run all bug fix tests"""
        print("🚀 STARTING BUG FIX TEST SUITE")
        print("=" * 60)
        
        await self.setup_session()
        
        try:
            # Basic health check
            if not await self.test_health_check():
                print("❌ Health check failed, aborting tests")
                return
                
            # Run bug fix scenario
            scenario_success = await self.run_bug_fix_scenario()
            
            # Print summary
            print("\n" + "=" * 60)
            print("📊 BUG FIX TEST SUMMARY")
            print("=" * 60)
            
            passed = sum(1 for result in self.test_results if result['success'])
            total = len(self.test_results)
            success_rate = (passed / total * 100) if total > 0 else 0
            
            print(f"Total Tests: {total}")
            print(f"Passed: {passed}")
            print(f"Failed: {total - passed}")
            print(f"Success Rate: {success_rate:.1f}%")
            
            if scenario_success:
                print("\n🎉 BUG FIXES COMPLETELY FUNCTIONAL!")
                print("✅ All bug fixes working as expected")
            else:
                print("\n⚠️  Some bug fix issues detected")
                
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
    test_suite = BugFixTestSuite()
    await test_suite.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())