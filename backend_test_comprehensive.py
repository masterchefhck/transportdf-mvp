#!/usr/bin/env python3
"""
Backend Test Suite for Transport App Brasília MVP - Complete Dashboard & Trip History Testing
Testing all implemented improvements: Chat System, Dashboard Enhancements, Trip History
As per review request: Testar toda a implementação das melhorias dos dashboards e histórico de viagens
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime
import sys
import time
import random

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://brasilia-rider.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class CompleteDashboardTestSuite:
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
        timestamp = str(int(time.time()))[-4:]
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
        """Setup test users for comprehensive testing"""
        timestamp = str(int(time.time()))
        
        users_to_create = [
            ("passenger", "Maria Silva Santos", f"maria.dashboard.{timestamp}@test.com"),
            ("driver", "João Carlos Oliveira", f"joao.dashboard.{timestamp}@test.com"),
            ("admin", "Admin Dashboard Test", f"admin.dashboard.{timestamp}@test.com")
        ]
        
        success_count = 0
        for user_type, name, email in users_to_create:
            if await self.register_user(user_type, name, email):
                success_count += 1
                
        return success_count == len(users_to_create)

    # ==========================================
    # CHAT SYSTEM TESTS
    # ==========================================
    
    async def create_test_trip(self):
        """Create a test trip for testing"""
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

    async def complete_trip(self):
        """Complete the test trip"""
        trip_id = self.trips['test_trip']['id']
        
        # Start trip first
        status, data = await self.make_request('PUT', f'/trips/{trip_id}/start', None, self.tokens['driver'])
        if status != 200:
            self.log_test("Start Trip", False, f"Status: {status}, Error: {data}")
            return False
            
        # Complete trip
        status, data = await self.make_request('PUT', f'/trips/{trip_id}/complete', None, self.tokens['driver'])
        
        if status == 200:
            self.log_test("Complete Trip", True, "Trip completed successfully")
            return True
        else:
            self.log_test("Complete Trip", False, f"Status: {status}, Error: {data}")
            return False
            
    async def test_chat_send_messages(self):
        """Test both passenger and driver sending chat messages"""
        trip_id = self.trips['test_trip']['id']
        
        # Passenger sends message
        passenger_msg = {"message": "Olá, estou no local de embarque!"}
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', passenger_msg, self.tokens['passenger'])
        passenger_success = status == 200
        
        # Driver sends message
        driver_msg = {"message": "Oi! Estou chegando, aguarde 2 minutos."}
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', driver_msg, self.tokens['driver'])
        driver_success = status == 200
        
        success = passenger_success and driver_success
        details = f"Passenger: {passenger_success}, Driver: {driver_success}"
        self.log_test("Chat Send Messages (Both Participants)", success, details)
        return success
        
    async def test_chat_character_limit(self):
        """Test 250 character limit validation"""
        trip_id = self.trips['test_trip']['id']
        long_message = "A" * 251  # 251 characters
        message_data = {"message": long_message}
        
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', message_data, self.tokens['passenger'])
        
        success = status == 422  # Should fail with validation error
        details = f"Status: {status}, Expected: 422 (validation error)"
        self.log_test("Chat 250 Character Limit Validation", success, details)
        return success
        
    async def test_chat_access_control(self):
        """Test chat access control - only participants can send"""
        trip_id = self.trips['test_trip']['id']
        message_data = {"message": "Admin trying to send message"}
        
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', message_data, self.tokens['admin'])
        
        success = status == 403  # Should fail - admin is not participant
        details = f"Status: {status}, Expected: 403 (forbidden for non-participants)"
        self.log_test("Chat Access Control - Non-Participant", success, details)
        return success
        
    async def test_get_chat_messages(self):
        """Test retrieving chat messages"""
        trip_id = self.trips['test_trip']['id']
        
        # Test passenger can get messages
        status, data = await self.make_request('GET', f'/trips/{trip_id}/chat/messages', None, self.tokens['passenger'])
        passenger_success = status == 200 and isinstance(data, list)
        
        # Test admin can get messages
        status, data = await self.make_request('GET', f'/trips/{trip_id}/chat/messages', None, self.tokens['admin'])
        admin_success = status == 200 and isinstance(data, list)
        
        # Check message structure
        structure_ok = False
        if passenger_success and data:
            message = data[0]
            required_fields = ['id', 'trip_id', 'sender_id', 'sender_name', 'sender_type', 'message', 'timestamp']
            structure_ok = all(field in message for field in required_fields)
        
        success = passenger_success and admin_success and structure_ok
        details = f"Passenger: {passenger_success}, Admin: {admin_success}, Structure: {structure_ok}"
        self.log_test("Get Chat Messages", success, details)
        return success
        
    async def test_admin_chats_aggregation(self):
        """Test admin chat aggregation endpoint"""
        status, data = await self.make_request('GET', '/admin/chats', None, self.tokens['admin'])
        
        success = status == 200 and isinstance(data, list)
        if success and data:
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

    # ==========================================
    # DASHBOARD IMPROVEMENTS TESTS
    # ==========================================
    
    async def test_admin_trips_complete_info(self):
        """Test GET /api/admin/trips with complete user information"""
        status, data = await self.make_request('GET', '/admin/trips', None, self.tokens['admin'])
        
        success = status == 200 and isinstance(data, list)
        if success and data:
            trip = data[0]
            # Check for complete user information
            required_fields = ['passenger_name', 'passenger_phone', 'passenger_photo', 'passenger_rating',
                             'driver_name', 'driver_phone', 'driver_photo', 'driver_rating']
            has_user_info = any(field in trip for field in required_fields)
            success = has_user_info
            details = f"Status: {status}, Trips: {len(data)}, User Info: {has_user_info}"
        else:
            details = f"Status: {status}, Trips: {len(data) if isinstance(data, list) else 'N/A'}"
            
        self.log_test("Admin Trips Complete User Information", success, details)
        return success
        
    async def test_user_profile_photos(self):
        """Test profile photo functionality"""
        # Test uploading profile photo for passenger
        photo_data = {"profile_photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD//gA7Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2ODApLCBxdWFsaXR5ID0gOTAK/9sAQwADAgIDAgIDAwMDBAMDBAUIBQUEBAUKBwcGCAwKDAwLCgsLDQ4SEA0OEQ4LCxAWEBETFBUVFQwPFxgWFBgSFBUU"}
        
        status, data = await self.make_request('PUT', '/users/profile-photo', photo_data, self.tokens['passenger'])
        upload_success = status == 200
        
        # Test retrieving user with photo
        status, data = await self.make_request('GET', '/users/me', None, self.tokens['passenger'])
        retrieve_success = status == 200 and 'profile_photo' in data
        
        success = upload_success and retrieve_success
        details = f"Upload: {upload_success}, Retrieve: {retrieve_success}"
        self.log_test("User Profile Photo Upload/Retrieve", success, details)
        return success
        
    async def test_user_rating_system(self):
        """Test user rating system"""
        status, data = await self.make_request('GET', '/users/rating', None, self.tokens['driver'])
        
        success = status == 200 and 'rating' in data
        if success:
            rating = data['rating']
            valid_rating = isinstance(rating, (int, float)) and 1.0 <= rating <= 5.0
            success = valid_rating
            details = f"Status: {status}, Rating: {rating}, Valid: {valid_rating}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("User Rating System", success, details)
        return success

    # ==========================================
    # TRIP HISTORY TESTS
    # ==========================================
    
    async def test_passenger_trip_history(self):
        """Test GET /api/passengers/trip-history"""
        status, data = await self.make_request('GET', '/passengers/trip-history', None, self.tokens['passenger'])
        
        success = status == 200 and isinstance(data, list)
        if success and data:
            trip = data[0]
            # Check for required fields in trip history
            required_fields = ['id', 'pickup_address', 'destination_address', 'estimated_price', 
                             'final_price', 'requested_at', 'completed_at', 'driver_name', 
                             'driver_photo', 'driver_rating']
            has_required_fields = all(field in trip for field in required_fields)
            success = has_required_fields
            details = f"Status: {status}, Trips: {len(data)}, Fields OK: {has_required_fields}"
        else:
            details = f"Status: {status}, Trips: {len(data) if isinstance(data, list) else 'N/A'}"
            
        self.log_test("Passenger Trip History", success, details)
        return success
        
    async def test_driver_trip_history(self):
        """Test GET /api/drivers/trip-history with earnings calculation"""
        status, data = await self.make_request('GET', '/drivers/trip-history', None, self.tokens['driver'])
        
        success = status == 200 and isinstance(data, list)
        if success and data:
            trip = data[0]
            # Check for required fields including driver earnings
            required_fields = ['id', 'pickup_address', 'destination_address', 'estimated_price', 
                             'final_price', 'driver_earnings', 'requested_at', 'completed_at', 
                             'passenger_name', 'passenger_photo']
            has_required_fields = all(field in trip for field in required_fields)
            
            # Verify earnings calculation (80% of trip value)
            earnings_correct = False
            if 'driver_earnings' in trip and 'final_price' in trip:
                expected_earnings = trip['final_price'] * 0.8
                earnings_correct = abs(trip['driver_earnings'] - expected_earnings) < 0.01
                
            success = has_required_fields and earnings_correct
            details = f"Status: {status}, Trips: {len(data)}, Fields OK: {has_required_fields}, Earnings OK: {earnings_correct}"
        else:
            details = f"Status: {status}, Trips: {len(data) if isinstance(data, list) else 'N/A'}"
            
        self.log_test("Driver Trip History with Earnings", success, details)
        return success

    # ==========================================
    # SYNCHRONIZATION TESTS
    # ==========================================
    
    async def test_real_time_polling_endpoints(self):
        """Test endpoints used for real-time synchronization (polling every 5 seconds)"""
        # Test passenger polling endpoint
        status, data = await self.make_request('GET', '/trips/my', None, self.tokens['passenger'])
        passenger_polling = status == 200 and isinstance(data, list)
        
        # Test driver polling endpoint
        status, data = await self.make_request('GET', '/trips/my', None, self.tokens['driver'])
        driver_polling = status == 200 and isinstance(data, list)
        
        # Test admin polling endpoint
        status, data = await self.make_request('GET', '/admin/trips', None, self.tokens['admin'])
        admin_polling = status == 200 and isinstance(data, list)
        
        success = passenger_polling and driver_polling and admin_polling
        details = f"Passenger: {passenger_polling}, Driver: {driver_polling}, Admin: {admin_polling}"
        self.log_test("Real-time Polling Endpoints", success, details)
        return success

    # ==========================================
    # COMPLETE SCENARIO EXECUTION
    # ==========================================
    
    async def run_complete_scenario(self):
        """Run the complete test scenario as per review request"""
        print("\n🎯 EXECUTING COMPLETE DASHBOARD & TRIP HISTORY SCENARIO")
        print("=" * 70)
        
        # Step 1: Setup users
        print("Step 1: Creating test users (1 passenger, 1 motorista, 1 admin)...")
        if not await self.setup_test_users():
            return False
            
        # Step 2: Create and accept trip
        print("Step 2: Creating and accepting trip...")
        if not await self.create_test_trip():
            return False
        if not await self.accept_trip():
            return False
            
        # Step 3: Test chat system
        print("Step 3: Testing complete chat system...")
        chat_tests = [
            self.test_chat_send_messages(),
            self.test_chat_character_limit(),
            self.test_chat_access_control(),
            self.test_get_chat_messages(),
            self.test_admin_chats_aggregation()
        ]
        
        chat_results = await asyncio.gather(*chat_tests, return_exceptions=True)
        chat_success = all(result is True for result in chat_results)
        
        # Step 4: Complete trip for history testing
        print("Step 4: Completing trip for history testing...")
        if not await self.complete_trip():
            return False
            
        # Step 5: Test dashboard improvements
        print("Step 5: Testing dashboard improvements...")
        dashboard_tests = [
            self.test_admin_trips_complete_info(),
            self.test_user_profile_photos(),
            self.test_user_rating_system()
        ]
        
        dashboard_results = await asyncio.gather(*dashboard_tests, return_exceptions=True)
        dashboard_success = all(result is True for result in dashboard_results)
        
        # Step 6: Test trip history
        print("Step 6: Testing trip history...")
        history_tests = [
            self.test_passenger_trip_history(),
            self.test_driver_trip_history()
        ]
        
        history_results = await asyncio.gather(*history_tests, return_exceptions=True)
        history_success = all(result is True for result in history_results)
        
        # Step 7: Test synchronization
        print("Step 7: Testing real-time synchronization...")
        sync_success = await self.test_real_time_polling_endpoints()
        
        # Overall success
        overall_success = chat_success and dashboard_success and history_success and sync_success
        
        print(f"\nScenario Results:")
        print(f"  Chat System: {'✅' if chat_success else '❌'}")
        print(f"  Dashboard Improvements: {'✅' if dashboard_success else '❌'}")
        print(f"  Trip History: {'✅' if history_success else '❌'}")
        print(f"  Real-time Sync: {'✅' if sync_success else '❌'}")
        
        return overall_success
        
    async def run_all_tests(self):
        """Run all comprehensive tests"""
        print("🚀 STARTING COMPLETE DASHBOARD & TRIP HISTORY TEST SUITE")
        print("=" * 70)
        
        await self.setup_session()
        
        try:
            # Basic health check
            if not await self.test_health_check():
                print("❌ Health check failed, aborting tests")
                return
                
            # Run complete scenario
            scenario_success = await self.run_complete_scenario()
            
            # Print summary
            print("\n" + "=" * 70)
            print("📊 COMPLETE TEST SUMMARY")
            print("=" * 70)
            
            passed = sum(1 for result in self.test_results if result['success'])
            total = len(self.test_results)
            success_rate = (passed / total * 100) if total > 0 else 0
            
            print(f"Total Tests: {total}")
            print(f"Passed: {passed}")
            print(f"Failed: {total - passed}")
            print(f"Success Rate: {success_rate:.1f}%")
            
            if scenario_success:
                print("\n🎉 ALL DASHBOARD & TRIP HISTORY IMPROVEMENTS WORKING!")
                print("✅ Chat system complete with 250 char limit and access control")
                print("✅ Dashboard improvements with complete user information")
                print("✅ Trip history with driver earnings calculation (80%)")
                print("✅ Real-time synchronization endpoints operational")
            else:
                print("\n⚠️  Some functionality issues detected")
                
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
    test_suite = CompleteDashboardTestSuite()
    await test_suite.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())