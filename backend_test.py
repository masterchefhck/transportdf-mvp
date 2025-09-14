#!/usr/bin/env python3
"""
Backend API Testing Suite for Transport App Brasília MVP
Focus: Rating system validation and core trip flow regression testing
"""

import requests
import json
import time
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://transport-df.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.tokens = {}
        self.users = {}
        self.trips = {}
        self.test_results = []
        
    def log_test(self, test_name, success, message="", data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {message}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "data": data,
            "timestamp": datetime.now().isoformat()
        })
        
    def test_health_check(self):
        """Test basic health check"""
        try:
            response = self.session.get(f"{API_BASE}/health")
            success = response.status_code == 200
            self.log_test("Health Check", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Health Check", False, f"Error: {str(e)}")
            return False
    
    def register_test_users(self):
        """Register test users for trip flow testing"""
        users_data = [
            {
                "name": "Maria Silva Santos",
                "email": "maria.passenger@test.com",
                "phone": "+5561987654321",
                "cpf": "12345678901",
                "user_type": "passenger",
                "password": "senha123"
            },
            {
                "name": "João Carlos Oliveira", 
                "email": "joao.driver@test.com",
                "phone": "+5561987654322",
                "cpf": "12345678902",
                "user_type": "driver",
                "password": "senha123"
            },
            {
                "name": "Admin Sistema",
                "email": "admin@test.com", 
                "phone": "+5561987654323",
                "cpf": "12345678903",
                "user_type": "admin",
                "password": "senha123"
            }
        ]
        
        for user_data in users_data:
            try:
                response = self.session.post(f"{API_BASE}/auth/register", json=user_data)
                if response.status_code == 200:
                    data = response.json()
                    self.tokens[user_data["user_type"]] = data["access_token"]
                    self.users[user_data["user_type"]] = data["user"]
                    self.log_test(f"Register {user_data['user_type']}", True, f"User ID: {data['user']['id']}")
                elif response.status_code == 400 and "already exists" in response.text:
                    # User exists, try to login
                    login_response = self.session.post(f"{API_BASE}/auth/login", json={
                        "email": user_data["email"],
                        "password": user_data["password"]
                    })
                    if login_response.status_code == 200:
                        data = login_response.json()
                        self.tokens[user_data["user_type"]] = data["access_token"]
                        self.users[user_data["user_type"]] = data["user"]
                        self.log_test(f"Login {user_data['user_type']}", True, f"Existing user logged in")
                    else:
                        self.log_test(f"Register/Login {user_data['user_type']}", False, f"Status: {login_response.status_code}")
                else:
                    self.log_test(f"Register {user_data['user_type']}", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test(f"Register {user_data['user_type']}", False, f"Error: {str(e)}")
    
    def test_basic_trip_flow(self):
        """Test complete trip flow: request → accept → start → complete"""
        if "passenger" not in self.tokens or "driver" not in self.tokens:
            self.log_test("Trip Flow Setup", False, "Missing required user tokens")
            return False
            
        # Step 1: Passenger requests trip
        trip_data = {
            "passenger_id": self.users["passenger"]["id"],
            "pickup_latitude": -15.7801,
            "pickup_longitude": -47.9292,
            "pickup_address": "Asa Norte, Brasília - DF",
            "destination_latitude": -15.8267,
            "destination_longitude": -47.9218,
            "destination_address": "Asa Sul, Brasília - DF",
            "estimated_price": 15.50
        }
        
        try:
            headers = {"Authorization": f"Bearer {self.tokens['passenger']}"}
            response = self.session.post(f"{API_BASE}/trips/request", json=trip_data, headers=headers)
            
            if response.status_code == 200:
                trip = response.json()
                self.trips["current"] = trip
                self.log_test("Trip Request", True, f"Trip ID: {trip['id']}")
            else:
                self.log_test("Trip Request", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Trip Request", False, f"Error: {str(e)}")
            return False
        
        # Step 2: Driver sets status to online
        try:
            headers = {"Authorization": f"Bearer {self.tokens['driver']}"}
            response = self.session.put(f"{API_BASE}/drivers/status/online", headers=headers)
            success = response.status_code == 200
            self.log_test("Driver Online Status", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Driver Online Status", False, f"Error: {str(e)}")
        
        # Step 3: Driver views available trips
        try:
            headers = {"Authorization": f"Bearer {self.tokens['driver']}"}
            response = self.session.get(f"{API_BASE}/trips/available", headers=headers)
            
            if response.status_code == 200:
                trips = response.json()
                available_trip = None
                for trip in trips:
                    if trip["id"] == self.trips["current"]["id"]:
                        available_trip = trip
                        break
                        
                if available_trip:
                    self.log_test("View Available Trips", True, f"Found trip with passenger info")
                else:
                    self.log_test("View Available Trips", False, "Requested trip not found in available trips")
            else:
                self.log_test("View Available Trips", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("View Available Trips", False, f"Error: {str(e)}")
        
        # Step 4: Driver accepts trip
        try:
            headers = {"Authorization": f"Bearer {self.tokens['driver']}"}
            trip_id = self.trips["current"]["id"]
            response = self.session.put(f"{API_BASE}/trips/{trip_id}/accept", headers=headers)
            
            success = response.status_code == 200
            self.log_test("Trip Accept", success, f"Status: {response.status_code}")
            
            if not success:
                return False
                
        except Exception as e:
            self.log_test("Trip Accept", False, f"Error: {str(e)}")
            return False
        
        # Step 5: Driver starts trip
        try:
            headers = {"Authorization": f"Bearer {self.tokens['driver']}"}
            trip_id = self.trips["current"]["id"]
            response = self.session.put(f"{API_BASE}/trips/{trip_id}/start", headers=headers)
            
            success = response.status_code == 200
            self.log_test("Trip Start", success, f"Status: {response.status_code}")
            
        except Exception as e:
            self.log_test("Trip Start", False, f"Error: {str(e)}")
        
        # Step 6: Driver completes trip
        try:
            headers = {"Authorization": f"Bearer {self.tokens['driver']}"}
            trip_id = self.trips["current"]["id"]
            response = self.session.put(f"{API_BASE}/trips/{trip_id}/complete", headers=headers)
            
            success = response.status_code == 200
            self.log_test("Trip Complete", success, f"Status: {response.status_code}")
            
            if success:
                self.trips["completed"] = self.trips["current"]
                
        except Exception as e:
            self.log_test("Trip Complete", False, f"Error: {str(e)}")
        
        return True
    
    def test_rating_system(self):
        """Test rating system functionality"""
        if "completed" not in self.trips:
            self.log_test("Rating System Setup", False, "No completed trip available for rating")
            return False
            
        trip_id = self.trips["completed"]["id"]
        driver_id = self.users["driver"]["id"]
        
        # Test 1: Create 5-star rating (no reason required)
        try:
            headers = {"Authorization": f"Bearer {self.tokens['passenger']}"}
            rating_data = {
                "trip_id": trip_id,
                "rated_user_id": driver_id,
                "rating": 5
            }
            
            response = self.session.post(f"{API_BASE}/ratings/create", json=rating_data, headers=headers)
            success = response.status_code == 200
            self.log_test("Create 5-Star Rating", success, f"Status: {response.status_code}")
            
            if success:
                self.trips["rating_created"] = True
                
        except Exception as e:
            self.log_test("Create 5-Star Rating", False, f"Error: {str(e)}")
        
        # Test 2: Try to create duplicate rating (should fail)
        try:
            headers = {"Authorization": f"Bearer {self.tokens['passenger']}"}
            rating_data = {
                "trip_id": trip_id,
                "rated_user_id": driver_id,
                "rating": 4
            }
            
            response = self.session.post(f"{API_BASE}/ratings/create", json=rating_data, headers=headers)
            success = response.status_code == 400  # Should fail with 400
            self.log_test("Prevent Duplicate Rating", success, f"Status: {response.status_code}")
            
        except Exception as e:
            self.log_test("Prevent Duplicate Rating", False, f"Error: {str(e)}")
        
        # Test 3: Get user rating
        try:
            headers = {"Authorization": f"Bearer {self.tokens['driver']}"}
            response = self.session.get(f"{API_BASE}/users/rating", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                rating = data.get("rating", 0)
                success = rating >= 1.0 and rating <= 5.0
                self.log_test("Get User Rating", success, f"Driver rating: {rating}")
            else:
                self.log_test("Get User Rating", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Get User Rating", False, f"Error: {str(e)}")
    
    def test_trip_endpoints_regression(self):
        """Test core trip endpoints for regressions"""
        
        # Test passenger trip history
        try:
            headers = {"Authorization": f"Bearer {self.tokens['passenger']}"}
            response = self.session.get(f"{API_BASE}/trips/my", headers=headers)
            
            if response.status_code == 200:
                trips = response.json()
                success = len(trips) > 0
                # Check if driver info is included for completed trips
                has_driver_info = False
                for trip in trips:
                    if trip.get("status") in ["accepted", "in_progress", "completed"] and trip.get("driver_name"):
                        has_driver_info = True
                        break
                        
                self.log_test("Passenger Trip History", success, f"Found {len(trips)} trips, driver info: {has_driver_info}")
            else:
                self.log_test("Passenger Trip History", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Passenger Trip History", False, f"Error: {str(e)}")
        
        # Test driver trip history
        try:
            headers = {"Authorization": f"Bearer {self.tokens['driver']}"}
            response = self.session.get(f"{API_BASE}/trips/my", headers=headers)
            
            if response.status_code == 200:
                trips = response.json()
                success = len(trips) > 0
                # Check if passenger info is included
                has_passenger_info = False
                for trip in trips:
                    if trip.get("passenger_name"):
                        has_passenger_info = True
                        break
                        
                self.log_test("Driver Trip History", success, f"Found {len(trips)} trips, passenger info: {has_passenger_info}")
            else:
                self.log_test("Driver Trip History", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Driver Trip History", False, f"Error: {str(e)}")
    
    def test_authentication_regression(self):
        """Test authentication endpoints for regressions"""
        
        # Test get current user info
        for user_type in ["passenger", "driver", "admin"]:
            if user_type in self.tokens:
                try:
                    headers = {"Authorization": f"Bearer {self.tokens[user_type]}"}
                    response = self.session.get(f"{API_BASE}/users/me", headers=headers)
                    
                    success = response.status_code == 200
                    if success:
                        user_data = response.json()
                        success = user_data.get("user_type") == user_type
                        
                    self.log_test(f"Get Current User ({user_type})", success, f"Status: {response.status_code}")
                    
                except Exception as e:
                    self.log_test(f"Get Current User ({user_type})", False, f"Error: {str(e)}")
    
    def test_admin_endpoints_regression(self):
        """Test admin endpoints for regressions"""
        if "admin" not in self.tokens:
            self.log_test("Admin Endpoints Setup", False, "No admin token available")
            return
            
        # Test admin stats
        try:
            headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
            response = self.session.get(f"{API_BASE}/admin/stats", headers=headers)
            
            if response.status_code == 200:
                stats = response.json()
                required_fields = ["total_users", "total_trips", "completed_trips", "completion_rate"]
                success = all(field in stats for field in required_fields)
                self.log_test("Admin Stats", success, f"Stats: {stats}")
            else:
                self.log_test("Admin Stats", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Admin Stats", False, f"Error: {str(e)}")
        
        # Test admin trips view
        try:
            headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
            response = self.session.get(f"{API_BASE}/admin/trips", headers=headers)
            
            success = response.status_code == 200
            if success:
                trips = response.json()
                self.log_test("Admin Trips View", success, f"Found {len(trips)} trips")
            else:
                self.log_test("Admin Trips View", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Admin Trips View", False, f"Error: {str(e)}")
    
    def run_focused_validation_tests(self):
        """Run focused validation tests as per review request"""
        print("🎯 STARTING FOCUSED VALIDATION TESTS - RATING SYSTEM & CORE TRIP FLOW")
        print("=" * 80)
        
        # Core tests as requested
        self.test_health_check()
        self.register_test_users()
        self.test_basic_trip_flow()
        self.test_rating_system()
        
        # Regression tests
        self.test_trip_endpoints_regression()
        self.test_authentication_regression()
        self.test_admin_endpoints_regression()
        
        # Summary
        print("\n" + "=" * 80)
        print("🎯 FOCUSED VALIDATION TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        print(f"\n🎯 FOCUS AREAS VALIDATION:")
        print(f"✅ Basic Trip Flow: {'PASSED' if any('Trip' in r['test'] and r['success'] for r in self.test_results) else 'FAILED'}")
        print(f"✅ Rating System: {'PASSED' if any('Rating' in r['test'] and r['success'] for r in self.test_results) else 'FAILED'}")
        print(f"✅ Core Endpoints: {'PASSED' if success_rate >= 80 else 'NEEDS ATTENTION'}")
        
        return success_rate >= 80

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_focused_validation_tests()
    exit(0 if success else 1)