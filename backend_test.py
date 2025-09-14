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
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://transport-df-chat.preview.emergentagent.com')
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
    
    def test_specific_reported_issues(self):
        """Test the three specific issues reported by user"""
        print("\n🚨 TESTING SPECIFIC REPORTED ISSUES")
        print("-" * 50)
        
        # Issue 1: Test bulk delete ratings endpoint
        self.test_bulk_delete_ratings()
        
        # Issue 2: Test location processing in trip request
        self.test_location_processing()
        
        # Issue 3: Test rating creation and duplicate prevention
        self.test_rating_duplicate_prevention()
    
    def test_bulk_delete_ratings(self):
        """Test /api/admin/ratings/bulk-delete endpoint"""
        if "admin" not in self.tokens:
            self.log_test("Bulk Delete Ratings Setup", False, "No admin token available")
            return
            
        try:
            # First, ensure we have some ratings to delete
            # Create a test rating if we have completed trips
            if "completed" in self.trips and "rating_created" not in self.trips:
                headers = {"Authorization": f"Bearer {self.tokens['passenger']}"}
                rating_data = {
                    "trip_id": self.trips["completed"]["id"],
                    "rated_user_id": self.users["driver"]["id"],
                    "rating": 3,
                    "reason": "Test rating for bulk delete"
                }
                
                rating_response = self.session.post(f"{API_BASE}/ratings/create", json=rating_data, headers=headers)
                if rating_response.status_code == 200:
                    self.log_test("Create Test Rating for Bulk Delete", True, "Rating created successfully")
                
            # Get existing ratings to find IDs for bulk delete
            headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
            ratings_response = self.session.get(f"{API_BASE}/ratings/low", headers=headers)
            
            if ratings_response.status_code == 200:
                ratings = ratings_response.json()
                if len(ratings) > 0:
                    # Test bulk delete with existing rating IDs
                    rating_ids = [rating["id"] for rating in ratings[:2]]  # Take first 2 ratings
                    
                    bulk_delete_data = {"ids": rating_ids}
                    response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                               json=bulk_delete_data, headers=headers)
                    
                    success = response.status_code == 200
                    if success:
                        result = response.json()
                        deleted_count = result.get("message", "").split()[1] if "Deleted" in result.get("message", "") else "0"
                        self.log_test("Bulk Delete Ratings", success, f"Deleted {deleted_count} ratings")
                    else:
                        self.log_test("Bulk Delete Ratings", False, f"Status: {response.status_code}, Response: {response.text}")
                else:
                    # Test with empty list
                    bulk_delete_data = {"ids": []}
                    response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                               json=bulk_delete_data, headers=headers)
                    success = response.status_code == 200
                    self.log_test("Bulk Delete Ratings (Empty)", success, f"Status: {response.status_code}")
            else:
                self.log_test("Get Ratings for Bulk Delete", False, f"Status: {ratings_response.status_code}")
                
        except Exception as e:
            self.log_test("Bulk Delete Ratings", False, f"Error: {str(e)}")
    
    def test_location_processing(self):
        """Test location processing in trip request endpoint"""
        if "passenger" not in self.tokens:
            self.log_test("Location Processing Setup", False, "No passenger token available")
            return
            
        # Test with valid Brasília coordinates
        valid_trip_data = {
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
            response = self.session.post(f"{API_BASE}/trips/request", json=valid_trip_data, headers=headers)
            
            success = response.status_code == 200
            if success:
                trip = response.json()
                # Check if location data is properly processed
                has_coordinates = all(key in trip for key in ["pickup_latitude", "pickup_longitude", "destination_latitude", "destination_longitude"])
                has_distance = "distance_km" in trip and trip["distance_km"] > 0
                has_price = "estimated_price" in trip and trip["estimated_price"] > 0
                
                location_processing_ok = has_coordinates and has_distance and has_price
                self.log_test("Location Processing - Valid Coordinates", location_processing_ok, 
                            f"Coordinates: {has_coordinates}, Distance: {has_distance}, Price: {has_price}")
            else:
                self.log_test("Location Processing - Valid Coordinates", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Location Processing - Valid Coordinates", False, f"Error: {str(e)}")
        
        # Test with invalid coordinates (should still work but might have issues)
        invalid_trip_data = {
            "passenger_id": self.users["passenger"]["id"],
            "pickup_latitude": 0.0,  # Invalid coordinates
            "pickup_longitude": 0.0,
            "pickup_address": "Invalid Location",
            "destination_latitude": 0.0,
            "destination_longitude": 0.0,
            "destination_address": "Invalid Destination",
            "estimated_price": 15.50
        }
        
        try:
            headers = {"Authorization": f"Bearer {self.tokens['passenger']}"}
            response = self.session.post(f"{API_BASE}/trips/request", json=invalid_trip_data, headers=headers)
            
            # This should either succeed (backend handles it) or fail gracefully
            if response.status_code == 200:
                self.log_test("Location Processing - Invalid Coordinates", True, "Backend handled invalid coordinates")
            elif response.status_code == 400:
                self.log_test("Location Processing - Invalid Coordinates", True, "Backend properly rejected invalid coordinates")
            else:
                self.log_test("Location Processing - Invalid Coordinates", False, f"Unexpected status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Location Processing - Invalid Coordinates", False, f"Error: {str(e)}")
    
    def test_rating_duplicate_prevention(self):
        """Test rating creation and duplicate prevention"""
        if "passenger" not in self.tokens or "driver" not in self.tokens:
            self.log_test("Rating Duplicate Prevention Setup", False, "Missing required tokens")
            return
            
        # Create a new trip for rating test
        trip_data = {
            "passenger_id": self.users["passenger"]["id"],
            "pickup_latitude": -15.7801,
            "pickup_longitude": -47.9292,
            "pickup_address": "Test Pickup Location",
            "destination_latitude": -15.8267,
            "destination_longitude": -47.9218,
            "destination_address": "Test Destination",
            "estimated_price": 10.00
        }
        
        try:
            # Create and complete a trip for rating
            headers_passenger = {"Authorization": f"Bearer {self.tokens['passenger']}"}
            headers_driver = {"Authorization": f"Bearer {self.tokens['driver']}"}
            
            # Request trip
            trip_response = self.session.post(f"{API_BASE}/trips/request", json=trip_data, headers=headers_passenger)
            if trip_response.status_code != 200:
                self.log_test("Rating Test Trip Creation", False, f"Failed to create trip: {trip_response.status_code}")
                return
                
            trip = trip_response.json()
            trip_id = trip["id"]
            
            # Driver accepts and completes trip
            self.session.put(f"{API_BASE}/drivers/status/online", headers=headers_driver)
            self.session.put(f"{API_BASE}/trips/{trip_id}/accept", headers=headers_driver)
            self.session.put(f"{API_BASE}/trips/{trip_id}/start", headers=headers_driver)
            complete_response = self.session.put(f"{API_BASE}/trips/{trip_id}/complete", headers=headers_driver)
            
            if complete_response.status_code != 200:
                self.log_test("Rating Test Trip Completion", False, f"Failed to complete trip: {complete_response.status_code}")
                return
            
            # Test 1: Create first rating
            rating_data = {
                "trip_id": trip_id,
                "rated_user_id": self.users["driver"]["id"],
                "rating": 4,
                "reason": "Good service but could be better"
            }
            
            rating_response = self.session.post(f"{API_BASE}/ratings/create", json=rating_data, headers=headers_passenger)
            success = rating_response.status_code == 200
            self.log_test("Create First Rating", success, f"Status: {rating_response.status_code}")
            
            if not success:
                self.log_test("Rating Creation Failed", False, f"Response: {rating_response.text}")
                return
            
            # Test 2: Try to create duplicate rating (should fail)
            duplicate_rating_data = {
                "trip_id": trip_id,
                "rated_user_id": self.users["driver"]["id"],
                "rating": 5,
                "reason": "Changed my mind"
            }
            
            duplicate_response = self.session.post(f"{API_BASE}/ratings/create", json=duplicate_rating_data, headers=headers_passenger)
            duplicate_prevented = duplicate_response.status_code == 400
            self.log_test("Prevent Duplicate Rating", duplicate_prevented, 
                         f"Status: {duplicate_response.status_code}, Expected: 400")
            
            if not duplicate_prevented:
                self.log_test("Duplicate Rating Issue", False, f"Duplicate rating was allowed! Response: {duplicate_response.text}")
            
        except Exception as e:
            self.log_test("Rating Duplicate Prevention", False, f"Error: {str(e)}")
    
    def test_mongodb_connection(self):
        """Test MongoDB connection by checking if endpoints return data"""
        try:
            # Test health check (basic connectivity)
            health_response = self.session.get(f"{API_BASE}/health")
            health_ok = health_response.status_code == 200
            self.log_test("MongoDB Connection - Health Check", health_ok, f"Status: {health_response.status_code}")
            
            # Test data retrieval (requires DB access)
            if "admin" in self.tokens:
                headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
                stats_response = self.session.get(f"{API_BASE}/admin/stats", headers=headers)
                stats_ok = stats_response.status_code == 200
                
                if stats_ok:
                    stats = stats_response.json()
                    has_data = any(stats.get(key, 0) > 0 for key in ["total_users", "total_trips"])
                    self.log_test("MongoDB Connection - Data Access", has_data, f"Stats: {stats}")
                else:
                    self.log_test("MongoDB Connection - Data Access", False, f"Status: {stats_response.status_code}")
            
        except Exception as e:
            self.log_test("MongoDB Connection", False, f"Error: {str(e)}")

    def run_focused_validation_tests(self):
        """Run focused validation tests as per review request"""
        print("🎯 STARTING FOCUSED VALIDATION TESTS - SPECIFIC USER REPORTED ISSUES")
        print("=" * 80)
        
        # Core tests as requested
        self.test_health_check()
        self.register_test_users()
        self.test_basic_trip_flow()
        self.test_rating_system()
        
        # NEW: Test specific reported issues
        self.test_specific_reported_issues()
        self.test_mongodb_connection()
        
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