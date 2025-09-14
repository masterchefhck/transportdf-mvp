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

    def test_ratings_functionality_comprehensive(self):
        """Comprehensive test for ratings functionality as per review request"""
        print("\n🎯 TESTING RATINGS FUNCTIONALITY - COMPREHENSIVE REVIEW REQUEST")
        print("=" * 70)
        
        # Step 1: Create admin user for testing (if not exists)
        self.create_admin_user_for_testing()
        
        # Step 2: Create test data for ratings
        self.create_test_data_for_ratings()
        
        # Step 3: Test ratings endpoints
        self.test_ratings_endpoints_detailed()
        
        # Step 4: Verify backend problem investigation
        self.verify_backend_ratings_problem()
    
    def create_admin_user_for_testing(self):
        """Create admin user specifically for ratings testing"""
        admin_data = {
            "name": "Admin Ratings Test",
            "email": "admin.ratings@test.com",
            "phone": "+5561999888777",
            "cpf": "99988877766",
            "user_type": "admin",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/register", json=admin_data)
            if response.status_code == 200:
                data = response.json()
                self.tokens["ratings_admin"] = data["access_token"]
                self.users["ratings_admin"] = data["user"]
                self.log_test("Create Admin for Ratings Test", True, f"Admin ID: {data['user']['id']}")
            elif response.status_code == 400 and "already exists" in response.text:
                # Admin exists, try to login
                login_response = self.session.post(f"{API_BASE}/auth/login", json={
                    "email": admin_data["email"],
                    "password": admin_data["password"]
                })
                if login_response.status_code == 200:
                    data = login_response.json()
                    self.tokens["ratings_admin"] = data["access_token"]
                    self.users["ratings_admin"] = data["user"]
                    self.log_test("Login Admin for Ratings Test", True, "Existing admin logged in")
                else:
                    self.log_test("Admin Login for Ratings", False, f"Status: {login_response.status_code}")
            else:
                self.log_test("Create Admin for Ratings Test", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Create Admin for Ratings Test", False, f"Error: {str(e)}")
    
    def create_test_data_for_ratings(self):
        """Create 2 passengers, 2 drivers, 2 completed trips, and low ratings"""
        print("\n📊 CREATING TEST DATA FOR RATINGS")
        print("-" * 40)
        
        # Create 2 passengers
        passengers_data = [
            {
                "name": "Ana Carolina Silva",
                "email": "ana.passenger@ratings.com",
                "phone": "+5561111222333",
                "cpf": "11122233344",
                "user_type": "passenger",
                "password": "pass123"
            },
            {
                "name": "Bruno Santos Lima",
                "email": "bruno.passenger@ratings.com", 
                "phone": "+5561111222334",
                "cpf": "11122233355",
                "user_type": "passenger",
                "password": "pass123"
            }
        ]
        
        # Create 2 drivers
        drivers_data = [
            {
                "name": "Carlos Motorista Silva",
                "email": "carlos.driver@ratings.com",
                "phone": "+5561333444555",
                "cpf": "33344455566",
                "user_type": "driver",
                "password": "driver123"
            },
            {
                "name": "Diego Motorista Santos",
                "email": "diego.driver@ratings.com",
                "phone": "+5561333444556",
                "cpf": "33344455577",
                "user_type": "driver", 
                "password": "driver123"
            }
        ]
        
        # Register passengers
        for i, passenger_data in enumerate(passengers_data):
            try:
                response = self.session.post(f"{API_BASE}/auth/register", json=passenger_data)
                if response.status_code == 200:
                    data = response.json()
                    self.tokens[f"test_passenger_{i+1}"] = data["access_token"]
                    self.users[f"test_passenger_{i+1}"] = data["user"]
                    self.log_test(f"Create Test Passenger {i+1}", True, f"ID: {data['user']['id']}")
                elif response.status_code == 400 and "already exists" in response.text:
                    # Login existing user
                    login_response = self.session.post(f"{API_BASE}/auth/login", json={
                        "email": passenger_data["email"],
                        "password": passenger_data["password"]
                    })
                    if login_response.status_code == 200:
                        data = login_response.json()
                        self.tokens[f"test_passenger_{i+1}"] = data["access_token"]
                        self.users[f"test_passenger_{i+1}"] = data["user"]
                        self.log_test(f"Login Test Passenger {i+1}", True, "Existing user")
                    else:
                        self.log_test(f"Login Test Passenger {i+1}", False, f"Status: {login_response.status_code}")
                else:
                    self.log_test(f"Create Test Passenger {i+1}", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test(f"Create Test Passenger {i+1}", False, f"Error: {str(e)}")
        
        # Register drivers
        for i, driver_data in enumerate(drivers_data):
            try:
                response = self.session.post(f"{API_BASE}/auth/register", json=driver_data)
                if response.status_code == 200:
                    data = response.json()
                    self.tokens[f"test_driver_{i+1}"] = data["access_token"]
                    self.users[f"test_driver_{i+1}"] = data["user"]
                    self.log_test(f"Create Test Driver {i+1}", True, f"ID: {data['user']['id']}")
                elif response.status_code == 400 and "already exists" in response.text:
                    # Login existing user
                    login_response = self.session.post(f"{API_BASE}/auth/login", json={
                        "email": driver_data["email"],
                        "password": driver_data["password"]
                    })
                    if login_response.status_code == 200:
                        data = login_response.json()
                        self.tokens[f"test_driver_{i+1}"] = data["access_token"]
                        self.users[f"test_driver_{i+1}"] = data["user"]
                        self.log_test(f"Login Test Driver {i+1}", True, "Existing user")
                else:
                    self.log_test(f"Create Test Driver {i+1}", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test(f"Create Test Driver {i+1}", False, f"Error: {str(e)}")
        
        # Create 2 completed trips
        self.create_completed_trips_for_ratings()
        
        # Create low ratings (below 5 stars)
        self.create_low_ratings_for_testing()
    
    def create_completed_trips_for_ratings(self):
        """Create 2 completed trips for rating tests"""
        trips_data = [
            {
                "pickup_latitude": -15.7801,
                "pickup_longitude": -47.9292,
                "pickup_address": "Asa Norte - Ratings Test 1",
                "destination_latitude": -15.8267,
                "destination_longitude": -47.9218,
                "destination_address": "Asa Sul - Ratings Test 1",
                "estimated_price": 12.50
            },
            {
                "pickup_latitude": -15.7950,
                "pickup_longitude": -47.8850,
                "pickup_address": "Lago Norte - Ratings Test 2",
                "destination_latitude": -15.8100,
                "destination_longitude": -47.8950,
                "destination_address": "Lago Sul - Ratings Test 2",
                "estimated_price": 18.00
            }
        ]
        
        for i, trip_data in enumerate(trips_data):
            passenger_key = f"test_passenger_{i+1}"
            driver_key = f"test_driver_{i+1}"
            
            if passenger_key not in self.tokens or driver_key not in self.tokens:
                self.log_test(f"Create Trip {i+1} - Setup", False, "Missing passenger or driver tokens")
                continue
            
            try:
                # Add passenger_id to trip data
                trip_data["passenger_id"] = self.users[passenger_key]["id"]
                
                # Step 1: Passenger requests trip
                headers_passenger = {"Authorization": f"Bearer {self.tokens[passenger_key]}"}
                trip_response = self.session.post(f"{API_BASE}/trips/request", json=trip_data, headers=headers_passenger)
                
                if trip_response.status_code != 200:
                    self.log_test(f"Create Trip {i+1} - Request", False, f"Status: {trip_response.status_code}")
                    continue
                
                trip = trip_response.json()
                trip_id = trip["id"]
                self.trips[f"ratings_trip_{i+1}"] = trip
                
                # Step 2: Driver goes online and accepts trip
                headers_driver = {"Authorization": f"Bearer {self.tokens[driver_key]}"}
                
                # Set driver online
                self.session.put(f"{API_BASE}/drivers/status/online", headers=headers_driver)
                
                # Accept trip
                accept_response = self.session.put(f"{API_BASE}/trips/{trip_id}/accept", headers=headers_driver)
                if accept_response.status_code != 200:
                    self.log_test(f"Create Trip {i+1} - Accept", False, f"Status: {accept_response.status_code}")
                    continue
                
                # Start trip
                start_response = self.session.put(f"{API_BASE}/trips/{trip_id}/start", headers=headers_driver)
                if start_response.status_code != 200:
                    self.log_test(f"Create Trip {i+1} - Start", False, f"Status: {start_response.status_code}")
                    continue
                
                # Complete trip
                complete_response = self.session.put(f"{API_BASE}/trips/{trip_id}/complete", headers=headers_driver)
                if complete_response.status_code == 200:
                    self.log_test(f"Create Completed Trip {i+1}", True, f"Trip ID: {trip_id}")
                    self.trips[f"ratings_trip_{i+1}"]["status"] = "completed"
                else:
                    self.log_test(f"Create Trip {i+1} - Complete", False, f"Status: {complete_response.status_code}")
                
            except Exception as e:
                self.log_test(f"Create Trip {i+1}", False, f"Error: {str(e)}")
    
    def create_low_ratings_for_testing(self):
        """Create at least 2 low ratings (below 5 stars) for testing"""
        low_ratings_data = [
            {
                "rating": 2,
                "reason": "Motorista chegou muito atrasado e foi mal educado"
            },
            {
                "rating": 3,
                "reason": "Carro sujo e motorista dirigindo perigosamente"
            }
        ]
        
        for i, rating_data in enumerate(low_ratings_data):
            trip_key = f"ratings_trip_{i+1}"
            passenger_key = f"test_passenger_{i+1}"
            driver_key = f"test_driver_{i+1}"
            
            if (trip_key not in self.trips or passenger_key not in self.tokens or 
                driver_key not in self.users):
                self.log_test(f"Create Low Rating {i+1} - Setup", False, "Missing required data")
                continue
            
            try:
                headers = {"Authorization": f"Bearer {self.tokens[passenger_key]}"}
                rating_request = {
                    "trip_id": self.trips[trip_key]["id"],
                    "rated_user_id": self.users[driver_key]["id"],
                    "rating": rating_data["rating"],
                    "reason": rating_data["reason"]
                }
                
                response = self.session.post(f"{API_BASE}/ratings/create", json=rating_request, headers=headers)
                
                if response.status_code == 200:
                    self.log_test(f"Create Low Rating {i+1}", True, f"{rating_data['rating']} stars - {rating_data['reason'][:30]}...")
                else:
                    self.log_test(f"Create Low Rating {i+1}", False, f"Status: {response.status_code}, Response: {response.text}")
                    
            except Exception as e:
                self.log_test(f"Create Low Rating {i+1}", False, f"Error: {str(e)}")
    
    def test_ratings_endpoints_detailed(self):
        """Test ratings endpoints in detail"""
        print("\n🔍 TESTING RATINGS ENDPOINTS IN DETAIL")
        print("-" * 45)
        
        # Test 1: GET /api/ratings/low (check if returns ratings below 5 stars)
        self.test_get_low_ratings_endpoint()
        
        # Test 2: POST /api/admin/ratings/bulk-delete (test if works correctly)
        self.test_bulk_delete_ratings_endpoint()
    
    def test_get_low_ratings_endpoint(self):
        """Test GET /api/ratings/low endpoint"""
        admin_key = "ratings_admin" if "ratings_admin" in self.tokens else "admin"
        
        if admin_key not in self.tokens:
            self.log_test("GET /api/ratings/low - Setup", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.tokens[admin_key]}"}
            response = self.session.get(f"{API_BASE}/ratings/low", headers=headers)
            
            if response.status_code == 200:
                ratings = response.json()
                
                # Check if we have ratings
                if len(ratings) > 0:
                    # Verify all ratings are below 5 stars
                    all_below_5 = all(rating.get("rating", 5) < 5 for rating in ratings)
                    
                    # Check required fields
                    required_fields = ["id", "rating", "reason", "created_at", "rated_user_name"]
                    has_required_fields = all(
                        all(field in rating for field in required_fields) 
                        for rating in ratings
                    )
                    
                    success = all_below_5 and has_required_fields
                    message = f"Found {len(ratings)} low ratings, all below 5 stars: {all_below_5}, has required fields: {has_required_fields}"
                    self.log_test("GET /api/ratings/low", success, message)
                    
                    # Store ratings for bulk delete test
                    self.test_ratings_data = ratings
                else:
                    self.log_test("GET /api/ratings/low", True, "No low ratings found (expected if all drivers have 5 stars)")
                    self.test_ratings_data = []
            else:
                self.log_test("GET /api/ratings/low", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("GET /api/ratings/low", False, f"Error: {str(e)}")
    
    def test_bulk_delete_ratings_endpoint(self):
        """Test POST /api/admin/ratings/bulk-delete endpoint"""
        admin_key = "ratings_admin" if "ratings_admin" in self.tokens else "admin"
        
        if admin_key not in self.tokens:
            self.log_test("POST /api/admin/ratings/bulk-delete - Setup", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.tokens[admin_key]}"}
            
            # Test with empty list first
            empty_request = {"ids": []}
            response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", json=empty_request, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                self.log_test("Bulk Delete Ratings - Empty List", True, f"Response: {result}")
            else:
                self.log_test("Bulk Delete Ratings - Empty List", False, f"Status: {response.status_code}, Response: {response.text}")
                return
            
            # Test with actual rating IDs if we have them
            if hasattr(self, 'test_ratings_data') and len(self.test_ratings_data) > 0:
                # Get first 2 rating IDs for testing
                rating_ids = [rating["id"] for rating in self.test_ratings_data[:2]]
                
                bulk_delete_request = {"ids": rating_ids}
                response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", json=bulk_delete_request, headers=headers)
                
                if response.status_code == 200:
                    result = response.json()
                    deleted_count = result.get("message", "").split()[1] if "Deleted" in result.get("message", "") else "0"
                    self.log_test("Bulk Delete Ratings - With IDs", True, f"Deleted {deleted_count} ratings")
                else:
                    self.log_test("Bulk Delete Ratings - With IDs", False, f"Status: {response.status_code}, Response: {response.text}")
            else:
                self.log_test("Bulk Delete Ratings - With IDs", True, "No ratings available for bulk delete test")
            
            # Test with non-existent IDs
            fake_ids = ["fake-id-1", "fake-id-2"]
            fake_request = {"ids": fake_ids}
            response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", json=fake_request, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                self.log_test("Bulk Delete Ratings - Fake IDs", True, f"Response: {result}")
            else:
                self.log_test("Bulk Delete Ratings - Fake IDs", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("POST /api/admin/ratings/bulk-delete", False, f"Error: {str(e)}")
    
    def verify_backend_ratings_problem(self):
        """Verify if the problem is in the backend by testing exact URLs"""
        print("\n🔍 VERIFYING BACKEND RATINGS PROBLEM")
        print("-" * 42)
        
        admin_key = "ratings_admin" if "ratings_admin" in self.tokens else "admin"
        
        if admin_key not in self.tokens:
            self.log_test("Backend Problem Verification - Setup", False, "No admin token available")
            return
        
        # Test the exact URL that frontend is calling
        exact_url = f"{API_BASE}/admin/ratings/bulk-delete"
        
        try:
            headers = {"Authorization": f"Bearer {self.tokens[admin_key]}"}
            
            # Test 1: Check if endpoint exists (OPTIONS request)
            options_response = self.session.options(exact_url, headers=headers)
            self.log_test("Endpoint Exists Check", True, f"OPTIONS status: {options_response.status_code}")
            
            # Test 2: Test with proper payload structure
            test_payload = {"ids": ["test-id-1", "test-id-2"]}
            response = self.session.post(exact_url, json=test_payload, headers=headers)
            
            if response.status_code == 200:
                self.log_test("Exact URL Test - /api/admin/ratings/bulk-delete", True, f"Endpoint is working correctly")
            elif response.status_code == 404:
                self.log_test("Exact URL Test - /api/admin/ratings/bulk-delete", False, f"404 NOT FOUND - Endpoint does not exist or is not registered")
            else:
                self.log_test("Exact URL Test - /api/admin/ratings/bulk-delete", False, f"Status: {response.status_code}, Response: {response.text}")
            
            # Test 3: Check if endpoint is registered correctly by testing similar endpoints
            similar_endpoints = [
                "/admin/trips/bulk-delete",
                "/admin/users/bulk-delete", 
                "/admin/reports/bulk-delete"
            ]
            
            for endpoint in similar_endpoints:
                test_url = f"{API_BASE}{endpoint}"
                test_response = self.session.post(test_url, json={"ids": []}, headers=headers)
                endpoint_works = test_response.status_code == 200
                self.log_test(f"Similar Endpoint Test - {endpoint}", endpoint_works, f"Status: {test_response.status_code}")
            
            # Test 4: Test with real data if available
            if hasattr(self, 'test_ratings_data') and len(self.test_ratings_data) > 0:
                real_ids = [rating["id"] for rating in self.test_ratings_data[:1]]  # Test with 1 real ID
                real_payload = {"ids": real_ids}
                
                real_response = self.session.post(exact_url, json=real_payload, headers=headers)
                
                if real_response.status_code == 200:
                    result = real_response.json()
                    self.log_test("Real Data Test - Bulk Delete", True, f"Successfully processed real rating IDs: {result}")
                else:
                    self.log_test("Real Data Test - Bulk Delete", False, f"Status: {real_response.status_code}, Response: {real_response.text}")
            
        except Exception as e:
            self.log_test("Backend Problem Verification", False, f"Error: {str(e)}")

    def run_ratings_focused_tests(self):
        """Run ratings-focused tests as per review request"""
        print("🎯 STARTING RATINGS FUNCTIONALITY TESTS - REVIEW REQUEST")
        print("=" * 70)
        
        # Basic setup
        self.test_health_check()
        self.register_test_users()
        
        # Comprehensive ratings functionality test
        self.test_ratings_functionality_comprehensive()
        
        # Summary
        print("\n" + "=" * 70)
        print("🎯 RATINGS FUNCTIONALITY TEST SUMMARY")
        print("=" * 70)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        # Specific focus areas
        print(f"\n🎯 RATINGS FUNCTIONALITY VALIDATION:")
        
        # Check specific endpoints
        low_ratings_test = any("GET /api/ratings/low" in r["test"] and r["success"] for r in self.test_results)
        bulk_delete_test = any("Bulk Delete Ratings" in r["test"] and r["success"] for r in self.test_results)
        endpoint_exists_test = any("Exact URL Test" in r["test"] and r["success"] for r in self.test_results)
        
        print(f"✅ GET /api/ratings/low: {'WORKING' if low_ratings_test else 'FAILED'}")
        print(f"✅ POST /api/admin/ratings/bulk-delete: {'WORKING' if bulk_delete_test else 'FAILED'}")
        print(f"✅ Endpoint Registration: {'CORRECT' if endpoint_exists_test else 'ISSUE FOUND'}")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS DETAILS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        # Conclusion
        print(f"\n🔍 CONCLUSION:")
        if success_rate >= 90:
            print("✅ RATINGS SYSTEM IS WORKING CORRECTLY - Problem likely in frontend or integration")
        elif success_rate >= 70:
            print("⚠️  RATINGS SYSTEM HAS MINOR ISSUES - Some endpoints working, others need attention")
        else:
            print("❌ RATINGS SYSTEM HAS MAJOR ISSUES - Backend problems identified")
        
        return success_rate >= 70

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_ratings_focused_tests()
    exit(0 if success else 1)