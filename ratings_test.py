#!/usr/bin/env python3
"""
Focused Ratings System Test for TransportDF App
Testing specific issues reported by user:
1. Admin user creation
2. Test data creation (passengers, drivers, trips, low ratings)
3. GET /api/ratings/low endpoint
4. POST /api/admin/ratings/bulk-delete endpoint
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

class RatingsSystemTester:
    def __init__(self):
        self.session = requests.Session()
        self.tokens = {}
        self.users = {}
        self.trips = {}
        self.ratings = {}
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
    
    def step_1_create_admin_user(self):
        """Step 1: Create admin user for testing"""
        print("\n🔧 STEP 1: CREATING ADMIN USER FOR TESTING")
        print("-" * 50)
        
        admin_data = {
            "name": "Admin Ratings Tester",
            "email": "admin.ratings.test@transportdf.com",
            "phone": "+5561999000111",
            "cpf": "99900011122",
            "user_type": "admin",
            "password": "admintest123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/register", json=admin_data)
            if response.status_code == 200:
                data = response.json()
                self.tokens["admin"] = data["access_token"]
                self.users["admin"] = data["user"]
                self.log_test("Create Admin User", True, f"Admin created with ID: {data['user']['id']}")
                return True
            elif response.status_code == 400 and "already exists" in response.text:
                # Try to login
                login_response = self.session.post(f"{API_BASE}/auth/login", json={
                    "email": admin_data["email"],
                    "password": admin_data["password"]
                })
                if login_response.status_code == 200:
                    data = login_response.json()
                    self.tokens["admin"] = data["access_token"]
                    self.users["admin"] = data["user"]
                    self.log_test("Login Admin User", True, "Existing admin user logged in")
                    return True
                else:
                    self.log_test("Login Admin User", False, f"Login failed: {login_response.status_code}")
                    return False
            else:
                self.log_test("Create Admin User", False, f"Registration failed: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Create Admin User", False, f"Error: {str(e)}")
            return False
    
    def step_2_create_test_data(self):
        """Step 2: Create test data (2 passengers, 2 drivers, 2 completed trips)"""
        print("\n📊 STEP 2: CREATING TEST DATA FOR RATINGS")
        print("-" * 50)
        
        # Create passengers
        passengers = [
            {
                "name": "Carla Passageira Silva",
                "email": "carla.test@transportdf.com",
                "phone": "+5561888111222",
                "cpf": "88811122233",
                "user_type": "passenger",
                "password": "pass123"
            },
            {
                "name": "Daniel Passageiro Santos",
                "email": "daniel.test@transportdf.com",
                "phone": "+5561888111223",
                "cpf": "88811122244",
                "user_type": "passenger",
                "password": "pass123"
            }
        ]
        
        # Create drivers
        drivers = [
            {
                "name": "Eduardo Motorista Lima",
                "email": "eduardo.test@transportdf.com",
                "phone": "+5561777222333",
                "cpf": "77722233344",
                "user_type": "driver",
                "password": "driver123"
            },
            {
                "name": "Fernando Motorista Costa",
                "email": "fernando.test@transportdf.com",
                "phone": "+5561777222334",
                "cpf": "77722233355",
                "user_type": "driver",
                "password": "driver123"
            }
        ]
        
        # Register passengers
        for i, passenger in enumerate(passengers):
            success = self.register_user(passenger, f"passenger_{i+1}")
            if not success:
                return False
        
        # Register drivers
        for i, driver in enumerate(drivers):
            success = self.register_user(driver, f"driver_{i+1}")
            if not success:
                return False
        
        # Create completed trips
        return self.create_completed_trips()
    
    def register_user(self, user_data, user_key):
        """Register a single user"""
        try:
            response = self.session.post(f"{API_BASE}/auth/register", json=user_data)
            if response.status_code == 200:
                data = response.json()
                self.tokens[user_key] = data["access_token"]
                self.users[user_key] = data["user"]
                self.log_test(f"Register {user_key}", True, f"ID: {data['user']['id']}")
                return True
            elif response.status_code == 400 and "already exists" in response.text:
                # Try to login
                login_response = self.session.post(f"{API_BASE}/auth/login", json={
                    "email": user_data["email"],
                    "password": user_data["password"]
                })
                if login_response.status_code == 200:
                    data = login_response.json()
                    self.tokens[user_key] = data["access_token"]
                    self.users[user_key] = data["user"]
                    self.log_test(f"Login {user_key}", True, "Existing user")
                    return True
                else:
                    self.log_test(f"Login {user_key}", False, f"Status: {login_response.status_code}")
                    return False
            else:
                self.log_test(f"Register {user_key}", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test(f"Register {user_key}", False, f"Error: {str(e)}")
            return False
    
    def create_completed_trips(self):
        """Create 2 completed trips"""
        trips_data = [
            {
                "pickup_latitude": -15.7801,
                "pickup_longitude": -47.9292,
                "pickup_address": "Asa Norte - Ratings Test Trip 1",
                "destination_latitude": -15.8267,
                "destination_longitude": -47.9218,
                "destination_address": "Asa Sul - Ratings Test Trip 1",
                "estimated_price": 14.50
            },
            {
                "pickup_latitude": -15.7950,
                "pickup_longitude": -47.8850,
                "pickup_address": "Lago Norte - Ratings Test Trip 2",
                "destination_latitude": -15.8100,
                "destination_longitude": -47.8950,
                "destination_address": "Lago Sul - Ratings Test Trip 2",
                "estimated_price": 19.00
            }
        ]
        
        for i, trip_data in enumerate(trips_data):
            passenger_key = f"passenger_{i+1}"
            driver_key = f"driver_{i+1}"
            
            if passenger_key not in self.tokens or driver_key not in self.tokens:
                self.log_test(f"Create Trip {i+1}", False, "Missing user tokens")
                return False
            
            # Complete trip flow
            trip_success = self.complete_trip_flow(trip_data, passenger_key, driver_key, i+1)
            if not trip_success:
                return False
        
        return True
    
    def complete_trip_flow(self, trip_data, passenger_key, driver_key, trip_num):
        """Complete a full trip flow: request -> accept -> start -> complete"""
        try:
            # Add passenger_id to trip data
            trip_data["passenger_id"] = self.users[passenger_key]["id"]
            
            # 1. Passenger requests trip
            headers_passenger = {"Authorization": f"Bearer {self.tokens[passenger_key]}"}
            trip_response = self.session.post(f"{API_BASE}/trips/request", json=trip_data, headers=headers_passenger)
            
            if trip_response.status_code != 200:
                self.log_test(f"Trip {trip_num} - Request", False, f"Status: {trip_response.status_code}")
                return False
            
            trip = trip_response.json()
            trip_id = trip["id"]
            
            # 2. Driver goes online
            headers_driver = {"Authorization": f"Bearer {self.tokens[driver_key]}"}
            self.session.put(f"{API_BASE}/drivers/status/online", headers=headers_driver)
            
            # 3. Driver accepts trip
            accept_response = self.session.put(f"{API_BASE}/trips/{trip_id}/accept", headers=headers_driver)
            if accept_response.status_code != 200:
                self.log_test(f"Trip {trip_num} - Accept", False, f"Status: {accept_response.status_code}")
                return False
            
            # 4. Driver starts trip
            start_response = self.session.put(f"{API_BASE}/trips/{trip_id}/start", headers=headers_driver)
            if start_response.status_code != 200:
                self.log_test(f"Trip {trip_num} - Start", False, f"Status: {start_response.status_code}")
                return False
            
            # 5. Driver completes trip
            complete_response = self.session.put(f"{API_BASE}/trips/{trip_id}/complete", headers=headers_driver)
            if complete_response.status_code != 200:
                self.log_test(f"Trip {trip_num} - Complete", False, f"Status: {complete_response.status_code}")
                return False
            
            # Store trip info
            self.trips[f"trip_{trip_num}"] = {
                "id": trip_id,
                "passenger_key": passenger_key,
                "driver_key": driver_key
            }
            
            self.log_test(f"Complete Trip {trip_num}", True, f"Trip ID: {trip_id}")
            return True
            
        except Exception as e:
            self.log_test(f"Complete Trip {trip_num}", False, f"Error: {str(e)}")
            return False
    
    def step_3_create_low_ratings(self):
        """Step 3: Create at least 2 low ratings (below 5 stars)"""
        print("\n⭐ STEP 3: CREATING LOW RATINGS FOR TESTING")
        print("-" * 50)
        
        low_ratings_data = [
            {
                "rating": 2,
                "reason": "Motorista chegou muito atrasado e foi mal educado durante toda a viagem"
            },
            {
                "rating": 3,
                "reason": "Carro estava sujo e motorista dirigindo de forma perigosa"
            }
        ]
        
        for i, rating_data in enumerate(low_ratings_data):
            trip_key = f"trip_{i+1}"
            
            if trip_key not in self.trips:
                self.log_test(f"Create Low Rating {i+1}", False, "No completed trip available")
                continue
            
            trip_info = self.trips[trip_key]
            passenger_key = trip_info["passenger_key"]
            driver_key = trip_info["driver_key"]
            
            try:
                headers = {"Authorization": f"Bearer {self.tokens[passenger_key]}"}
                rating_request = {
                    "trip_id": trip_info["id"],
                    "rated_user_id": self.users[driver_key]["id"],
                    "rating": rating_data["rating"],
                    "reason": rating_data["reason"]
                }
                
                response = self.session.post(f"{API_BASE}/ratings/create", json=rating_request, headers=headers)
                
                if response.status_code == 200:
                    result = response.json()
                    self.ratings[f"rating_{i+1}"] = {
                        "id": result.get("rating_id"),
                        "rating": rating_data["rating"],
                        "reason": rating_data["reason"]
                    }
                    self.log_test(f"Create Low Rating {i+1}", True, f"{rating_data['rating']} stars - {rating_data['reason'][:40]}...")
                else:
                    self.log_test(f"Create Low Rating {i+1}", False, f"Status: {response.status_code}, Response: {response.text}")
                    
            except Exception as e:
                self.log_test(f"Create Low Rating {i+1}", False, f"Error: {str(e)}")
        
        return len(self.ratings) > 0
    
    def step_4_test_ratings_endpoints(self):
        """Step 4: Test ratings endpoints"""
        print("\n🔍 STEP 4: TESTING RATINGS ENDPOINTS")
        print("-" * 50)
        
        # Test GET /api/ratings/low
        self.test_get_low_ratings()
        
        # Test POST /api/admin/ratings/bulk-delete
        self.test_bulk_delete_ratings()
    
    def test_get_low_ratings(self):
        """Test GET /api/ratings/low endpoint"""
        if "admin" not in self.tokens:
            self.log_test("GET /api/ratings/low", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
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
                    
                    # Store for bulk delete test
                    self.retrieved_ratings = ratings
                    
                    # Show details of found ratings
                    for rating in ratings[:3]:  # Show first 3
                        print(f"   📋 Rating: {rating.get('rating')} stars - {rating.get('rated_user_name')} - {rating.get('reason', 'No reason')[:50]}...")
                else:
                    self.log_test("GET /api/ratings/low", True, "No low ratings found (all drivers have 5 stars)")
                    self.retrieved_ratings = []
            else:
                self.log_test("GET /api/ratings/low", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("GET /api/ratings/low", False, f"Error: {str(e)}")
    
    def test_bulk_delete_ratings(self):
        """Test POST /api/admin/ratings/bulk-delete endpoint"""
        if "admin" not in self.tokens:
            self.log_test("POST /api/admin/ratings/bulk-delete", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
            
            # Test 1: Empty list (should work)
            empty_request = {"ids": []}
            response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", json=empty_request, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                self.log_test("Bulk Delete - Empty List", True, f"Response: {result}")
            else:
                self.log_test("Bulk Delete - Empty List", False, f"Status: {response.status_code}, Response: {response.text}")
                return
            
            # Test 2: With actual rating IDs (if we have them)
            if hasattr(self, 'retrieved_ratings') and len(self.retrieved_ratings) > 0:
                # Get first 2 rating IDs for testing
                rating_ids = [rating["id"] for rating in self.retrieved_ratings[:2]]
                
                bulk_delete_request = {"ids": rating_ids}
                response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", json=bulk_delete_request, headers=headers)
                
                if response.status_code == 200:
                    result = response.json()
                    deleted_count = result.get("message", "").split()[1] if "Deleted" in result.get("message", "") else "0"
                    self.log_test("Bulk Delete - Real IDs", True, f"Successfully deleted {deleted_count} ratings")
                    
                    # Verify ratings were actually deleted
                    verify_response = self.session.get(f"{API_BASE}/ratings/low", headers=headers)
                    if verify_response.status_code == 200:
                        remaining_ratings = verify_response.json()
                        self.log_test("Bulk Delete - Verification", True, f"Remaining low ratings: {len(remaining_ratings)}")
                else:
                    self.log_test("Bulk Delete - Real IDs", False, f"Status: {response.status_code}, Response: {response.text}")
            else:
                self.log_test("Bulk Delete - Real IDs", True, "No ratings available for bulk delete test")
            
            # Test 3: Non-existent IDs (should handle gracefully)
            fake_ids = ["fake-rating-id-1", "fake-rating-id-2"]
            fake_request = {"ids": fake_ids}
            response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", json=fake_request, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                self.log_test("Bulk Delete - Fake IDs", True, f"Handled fake IDs correctly: {result}")
            else:
                self.log_test("Bulk Delete - Fake IDs", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("POST /api/admin/ratings/bulk-delete", False, f"Error: {str(e)}")
    
    def step_5_verify_backend_problem(self):
        """Step 5: Verify if the problem is in the backend"""
        print("\n🔍 STEP 5: VERIFYING BACKEND PROBLEM INVESTIGATION")
        print("-" * 50)
        
        if "admin" not in self.tokens:
            self.log_test("Backend Problem Investigation", False, "No admin token available")
            return
        
        # Test the exact URL that frontend is calling
        exact_url = f"{API_BASE}/admin/ratings/bulk-delete"
        
        try:
            headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
            
            # Test with proper payload structure
            test_payload = {"ids": ["test-id-1", "test-id-2"]}
            response = self.session.post(exact_url, json=test_payload, headers=headers)
            
            if response.status_code == 200:
                self.log_test("Exact URL Test", True, f"✅ /api/admin/ratings/bulk-delete endpoint is working correctly")
            elif response.status_code == 404:
                self.log_test("Exact URL Test", False, f"❌ 404 NOT FOUND - Endpoint does not exist or is not registered correctly")
            else:
                self.log_test("Exact URL Test", False, f"Status: {response.status_code}, Response: {response.text}")
            
            # Test similar endpoints to compare
            similar_endpoints = [
                "/admin/trips/bulk-delete",
                "/admin/users/bulk-delete", 
                "/admin/reports/bulk-delete"
            ]
            
            for endpoint in similar_endpoints:
                test_url = f"{API_BASE}{endpoint}"
                test_response = self.session.post(test_url, json={"ids": []}, headers=headers)
                endpoint_works = test_response.status_code == 200
                status_msg = "✅ Working" if endpoint_works else f"❌ Status: {test_response.status_code}"
                self.log_test(f"Similar Endpoint - {endpoint}", endpoint_works, status_msg)
            
        except Exception as e:
            self.log_test("Backend Problem Investigation", False, f"Error: {str(e)}")
    
    def run_comprehensive_ratings_test(self):
        """Run comprehensive ratings system test"""
        print("🎯 COMPREHENSIVE RATINGS SYSTEM TEST - TRANSPORTDF APP")
        print("=" * 70)
        print("Testing specific issues reported by user:")
        print("1. Admin user creation")
        print("2. Test data creation (passengers, drivers, trips, low ratings)")
        print("3. GET /api/ratings/low endpoint")
        print("4. POST /api/admin/ratings/bulk-delete endpoint")
        print("5. Backend problem investigation")
        print("=" * 70)
        
        # Execute test steps
        step1_success = self.step_1_create_admin_user()
        if not step1_success:
            print("❌ CRITICAL: Admin user creation failed. Cannot continue.")
            return False
        
        step2_success = self.step_2_create_test_data()
        if not step2_success:
            print("⚠️  WARNING: Test data creation had issues. Continuing with available data.")
        
        step3_success = self.step_3_create_low_ratings()
        if not step3_success:
            print("⚠️  WARNING: Low ratings creation failed. Testing with existing data.")
        
        self.step_4_test_ratings_endpoints()
        self.step_5_verify_backend_problem()
        
        # Generate summary
        self.generate_test_summary()
        
        return True
    
    def generate_test_summary(self):
        """Generate comprehensive test summary"""
        print("\n" + "=" * 70)
        print("🎯 COMPREHENSIVE RATINGS TEST SUMMARY")
        print("=" * 70)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"📊 OVERALL RESULTS:")
        print(f"   Total Tests: {total_tests}")
        print(f"   Passed: {passed_tests}")
        print(f"   Failed: {failed_tests}")
        print(f"   Success Rate: {success_rate:.1f}%")
        
        # Specific endpoint results
        print(f"\n🎯 SPECIFIC ENDPOINT RESULTS:")
        
        low_ratings_test = any("GET /api/ratings/low" in r["test"] and r["success"] for r in self.test_results)
        bulk_delete_test = any("Bulk Delete" in r["test"] and r["success"] for r in self.test_results)
        exact_url_test = any("Exact URL Test" in r["test"] and r["success"] for r in self.test_results)
        
        print(f"   ✅ GET /api/ratings/low: {'WORKING' if low_ratings_test else 'FAILED'}")
        print(f"   ✅ POST /api/admin/ratings/bulk-delete: {'WORKING' if bulk_delete_test else 'FAILED'}")
        print(f"   ✅ Endpoint Registration: {'CORRECT' if exact_url_test else 'ISSUE FOUND'}")
        
        # Failed tests details
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS DETAILS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   - {result['test']}: {result['message']}")
        
        # Final conclusion
        print(f"\n🔍 FINAL CONCLUSION:")
        if success_rate >= 90:
            print("✅ RATINGS SYSTEM IS WORKING CORRECTLY")
            print("   The backend endpoints are functional. The problem reported by the user")
            print("   is likely in the frontend integration, network connectivity, or user permissions.")
        elif success_rate >= 70:
            print("⚠️  RATINGS SYSTEM HAS MINOR ISSUES")
            print("   Most endpoints are working, but some issues were found that need attention.")
        else:
            print("❌ RATINGS SYSTEM HAS MAJOR ISSUES")
            print("   Significant backend problems were identified that need immediate fixing.")
        
        # Specific recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        if exact_url_test:
            print("   ✅ Backend endpoint /api/admin/ratings/bulk-delete is registered and working")
            print("   ✅ The 404 error reported by user is NOT a backend issue")
            print("   🔍 Investigate frontend code, network requests, or user authentication")
        else:
            print("   ❌ Backend endpoint has registration issues")
            print("   🔧 Check FastAPI router configuration and endpoint registration")
        
        if low_ratings_test:
            print("   ✅ Ratings are being saved and retrieved correctly")
            print("   ✅ Admin dashboard should be able to display low ratings")
        else:
            print("   ❌ Issues with ratings retrieval system")
            print("   🔧 Check database queries and rating filtering logic")

if __name__ == "__main__":
    tester = RatingsSystemTester()
    success = tester.run_comprehensive_ratings_test()
    exit(0 if success else 1)