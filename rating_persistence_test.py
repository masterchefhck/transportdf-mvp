#!/usr/bin/env python3
"""
Rating Persistence Testing Suite - SPECIFIC ISSUE INVESTIGATION
Focus: Testing if passenger ratings are actually being saved to the database

PROBLEMA ESPECÍFICO: As avaliações feitas pelo passenger não estão sendo registradas/salvas no sistema.
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

class RatingPersistenceTester:
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
        
    def setup_test_users(self):
        """Setup test users for rating persistence testing"""
        users_data = [
            {
                "name": "Ana Carolina Teste",
                "email": "ana.rating.test@test.com",
                "phone": "+5561999888777",
                "cpf": "11122233344",
                "user_type": "passenger",
                "password": "senha123"
            },
            {
                "name": "Carlos Motorista Teste", 
                "email": "carlos.rating.test@test.com",
                "phone": "+5561999888778",
                "cpf": "11122233355",
                "user_type": "driver",
                "password": "senha123"
            },
            {
                "name": "Admin Rating Test",
                "email": "admin.rating.test@test.com", 
                "phone": "+5561999888779",
                "cpf": "11122233366",
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
                    self.log_test(f"Setup {user_data['user_type']}", True, f"User ID: {data['user']['id']}")
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
                        self.log_test(f"Setup {user_data['user_type']}", False, f"Login failed: {login_response.status_code}")
                        return False
                else:
                    self.log_test(f"Setup {user_data['user_type']}", False, f"Registration failed: {response.status_code}")
                    return False
            except Exception as e:
                self.log_test(f"Setup {user_data['user_type']}", False, f"Error: {str(e)}")
                return False
        
        return True
    
    def create_and_complete_trip(self):
        """Create and complete a trip for rating testing"""
        if "passenger" not in self.tokens or "driver" not in self.tokens:
            self.log_test("Trip Creation Setup", False, "Missing required user tokens")
            return False
            
        # Step 1: Passenger requests trip
        trip_data = {
            "passenger_id": self.users["passenger"]["id"],
            "pickup_latitude": -15.7801,
            "pickup_longitude": -47.9292,
            "pickup_address": "Setor Comercial Norte, Brasília - DF",
            "destination_latitude": -15.8267,
            "destination_longitude": -47.9218,
            "destination_address": "Setor Bancário Sul, Brasília - DF",
            "estimated_price": 18.50
        }
        
        try:
            headers_passenger = {"Authorization": f"Bearer {self.tokens['passenger']}"}
            headers_driver = {"Authorization": f"Bearer {self.tokens['driver']}"}
            
            # Request trip
            response = self.session.post(f"{API_BASE}/trips/request", json=trip_data, headers=headers_passenger)
            if response.status_code != 200:
                self.log_test("Trip Request", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
            trip = response.json()
            self.trips["current"] = trip
            self.log_test("Trip Request", True, f"Trip ID: {trip['id']}")
            
            # Driver goes online
            self.session.put(f"{API_BASE}/drivers/status/online", headers=headers_driver)
            
            # Driver accepts trip
            trip_id = trip["id"]
            accept_response = self.session.put(f"{API_BASE}/trips/{trip_id}/accept", headers=headers_driver)
            if accept_response.status_code != 200:
                self.log_test("Trip Accept", False, f"Status: {accept_response.status_code}")
                return False
            self.log_test("Trip Accept", True, "Trip accepted by driver")
            
            # Driver starts trip
            start_response = self.session.put(f"{API_BASE}/trips/{trip_id}/start", headers=headers_driver)
            if start_response.status_code != 200:
                self.log_test("Trip Start", False, f"Status: {start_response.status_code}")
                return False
            self.log_test("Trip Start", True, "Trip started")
            
            # Driver completes trip
            complete_response = self.session.put(f"{API_BASE}/trips/{trip_id}/complete", headers=headers_driver)
            if complete_response.status_code != 200:
                self.log_test("Trip Complete", False, f"Status: {complete_response.status_code}")
                return False
            
            self.trips["completed"] = trip
            self.log_test("Trip Complete", True, "Trip completed successfully")
            return True
            
        except Exception as e:
            self.log_test("Trip Creation and Completion", False, f"Error: {str(e)}")
            return False
    
    def test_rating_creation_and_persistence(self):
        """Test the core issue: rating creation and database persistence"""
        if "completed" not in self.trips:
            self.log_test("Rating Persistence Setup", False, "No completed trip available")
            return False
            
        trip_id = self.trips["completed"]["id"]
        driver_id = self.users["driver"]["id"]
        
        print(f"\n🎯 TESTING RATING PERSISTENCE FOR TRIP: {trip_id}")
        print(f"🎯 DRIVER ID: {driver_id}")
        print("-" * 60)
        
        # Test 1: Create rating and verify immediate response
        rating_data = {
            "trip_id": trip_id,
            "rated_user_id": driver_id,
            "rating": 3,
            "reason": "Serviço ok mas pode melhorar"
        }
        
        try:
            headers_passenger = {"Authorization": f"Bearer {self.tokens['passenger']}"}
            
            # Create rating
            print(f"📝 Creating rating: {rating_data}")
            rating_response = self.session.post(f"{API_BASE}/ratings/create", json=rating_data, headers=headers_passenger)
            
            print(f"📝 Rating creation response: Status {rating_response.status_code}")
            print(f"📝 Rating creation response body: {rating_response.text}")
            
            if rating_response.status_code == 200:
                response_data = rating_response.json()
                self.log_test("Rating Creation - API Response", True, f"Success message: {response_data.get('message', 'No message')}")
                
                # Extract rating ID if available
                rating_id = response_data.get('rating_id')
                if rating_id:
                    self.trips["rating_id"] = rating_id
                    print(f"📝 Rating ID returned: {rating_id}")
                else:
                    print("⚠️  No rating_id returned in response")
                    
            else:
                self.log_test("Rating Creation - API Response", False, f"Status: {rating_response.status_code}, Response: {rating_response.text}")
                return False
                
        except Exception as e:
            self.log_test("Rating Creation", False, f"Error: {str(e)}")
            return False
        
        # Test 2: Verify rating appears in admin low ratings endpoint
        try:
            headers_admin = {"Authorization": f"Bearer {self.tokens['admin']}"}
            
            print(f"\n🔍 Checking if rating appears in /api/ratings/low...")
            low_ratings_response = self.session.get(f"{API_BASE}/ratings/low", headers=headers_admin)
            
            print(f"🔍 Low ratings response: Status {low_ratings_response.status_code}")
            
            if low_ratings_response.status_code == 200:
                low_ratings = low_ratings_response.json()
                print(f"🔍 Found {len(low_ratings)} low ratings in database")
                
                # Look for our specific rating
                our_rating = None
                for rating in low_ratings:
                    if rating.get("rated_user_id") == driver_id:
                        our_rating = rating
                        break
                
                if our_rating:
                    self.log_test("Rating Persistence - Admin Low Ratings", True, f"Rating found: {our_rating['rating']} stars, reason: {our_rating.get('reason', 'No reason')}")
                    print(f"✅ Rating found in admin panel: {our_rating}")
                else:
                    self.log_test("Rating Persistence - Admin Low Ratings", False, f"Rating NOT found in admin low ratings. Found {len(low_ratings)} total ratings")
                    print(f"❌ Our rating not found. Available ratings: {[r.get('rated_user_id') for r in low_ratings]}")
                    
            else:
                self.log_test("Rating Persistence - Admin Low Ratings", False, f"Failed to get low ratings: {low_ratings_response.status_code}")
                
        except Exception as e:
            self.log_test("Rating Persistence - Admin Low Ratings", False, f"Error: {str(e)}")
        
        # Test 3: Verify rating affects user's rating score
        try:
            headers_driver = {"Authorization": f"Bearer {self.tokens['driver']}"}
            
            print(f"\n🔍 Checking driver's updated rating score...")
            user_rating_response = self.session.get(f"{API_BASE}/users/rating", headers=headers_driver)
            
            print(f"🔍 User rating response: Status {user_rating_response.status_code}")
            
            if user_rating_response.status_code == 200:
                rating_data = user_rating_response.json()
                current_rating = rating_data.get("rating", 0)
                
                print(f"🔍 Driver's current rating: {current_rating}")
                
                # Rating should be less than 5.0 if our 3-star rating was saved
                if current_rating < 5.0:
                    self.log_test("Rating Persistence - User Rating Update", True, f"Driver rating updated to: {current_rating}")
                else:
                    self.log_test("Rating Persistence - User Rating Update", False, f"Driver rating still at {current_rating} (should be < 5.0 after 3-star rating)")
                    
            else:
                self.log_test("Rating Persistence - User Rating Update", False, f"Failed to get user rating: {user_rating_response.status_code}")
                
        except Exception as e:
            self.log_test("Rating Persistence - User Rating Update", False, f"Error: {str(e)}")
        
        return True
    
    def test_duplicate_rating_prevention(self):
        """Test if duplicate ratings are properly prevented"""
        if "completed" not in self.trips:
            self.log_test("Duplicate Rating Test Setup", False, "No completed trip available")
            return False
            
        trip_id = self.trips["completed"]["id"]
        driver_id = self.users["driver"]["id"]
        
        print(f"\n🔄 TESTING DUPLICATE RATING PREVENTION")
        print("-" * 50)
        
        # Try to create multiple ratings for the same trip
        for attempt in range(1, 6):  # Try 5 times
            rating_data = {
                "trip_id": trip_id,
                "rated_user_id": driver_id,
                "rating": 4,
                "reason": f"Tentativa {attempt} de avaliação duplicada"
            }
            
            try:
                headers_passenger = {"Authorization": f"Bearer {self.tokens['passenger']}"}
                
                print(f"🔄 Attempt {attempt}: Creating duplicate rating...")
                rating_response = self.session.post(f"{API_BASE}/ratings/create", json=rating_data, headers=headers_passenger)
                
                print(f"🔄 Attempt {attempt} response: Status {rating_response.status_code}")
                
                if attempt == 1:
                    # First attempt might succeed if no rating exists yet
                    if rating_response.status_code == 200:
                        self.log_test(f"Duplicate Rating Attempt {attempt}", True, "First rating created (expected)")
                    elif rating_response.status_code == 400:
                        self.log_test(f"Duplicate Rating Attempt {attempt}", True, "Duplicate prevented (rating already exists)")
                    else:
                        self.log_test(f"Duplicate Rating Attempt {attempt}", False, f"Unexpected status: {rating_response.status_code}")
                else:
                    # Subsequent attempts should fail with 400
                    if rating_response.status_code == 400:
                        self.log_test(f"Duplicate Rating Attempt {attempt}", True, "Duplicate properly prevented")
                    else:
                        self.log_test(f"Duplicate Rating Attempt {attempt}", False, f"Duplicate NOT prevented! Status: {rating_response.status_code}")
                        print(f"❌ CRITICAL: Duplicate rating was allowed on attempt {attempt}")
                
                # Small delay between attempts
                time.sleep(0.5)
                
            except Exception as e:
                self.log_test(f"Duplicate Rating Attempt {attempt}", False, f"Error: {str(e)}")
    
    def test_mongodb_direct_verification(self):
        """Test MongoDB data persistence by checking admin endpoints"""
        print(f"\n🗄️  TESTING MONGODB DATA PERSISTENCE")
        print("-" * 50)
        
        if "admin" not in self.tokens:
            self.log_test("MongoDB Verification Setup", False, "No admin token available")
            return False
        
        try:
            headers_admin = {"Authorization": f"Bearer {self.tokens['admin']}"}
            
            # Check admin stats to see if ratings are counted
            stats_response = self.session.get(f"{API_BASE}/admin/stats", headers=headers_admin)
            
            if stats_response.status_code == 200:
                stats = stats_response.json()
                print(f"🗄️  Admin stats: {stats}")
                self.log_test("MongoDB - Admin Stats Access", True, f"Stats retrieved: {stats}")
            else:
                self.log_test("MongoDB - Admin Stats Access", False, f"Status: {stats_response.status_code}")
            
            # Check if we can get all ratings through low ratings endpoint
            all_ratings_response = self.session.get(f"{API_BASE}/ratings/low", headers=headers_admin)
            
            if all_ratings_response.status_code == 200:
                all_ratings = all_ratings_response.json()
                print(f"🗄️  Total ratings in database: {len(all_ratings)}")
                
                # Show details of each rating
                for i, rating in enumerate(all_ratings):
                    print(f"🗄️  Rating {i+1}: {rating.get('rating', 'N/A')} stars, User: {rating.get('rated_user_name', 'Unknown')}, Reason: {rating.get('reason', 'No reason')}")
                
                self.log_test("MongoDB - Ratings Data Access", True, f"Found {len(all_ratings)} ratings in database")
                
                # Check if our specific rating is there
                our_driver_name = self.users["driver"]["name"]
                our_rating_found = any(rating.get("rated_user_name") == our_driver_name for rating in all_ratings)
                
                if our_rating_found:
                    self.log_test("MongoDB - Our Rating Found", True, f"Our test rating found in database")
                else:
                    self.log_test("MongoDB - Our Rating Found", False, f"Our test rating NOT found in database")
                    
            else:
                self.log_test("MongoDB - Ratings Data Access", False, f"Status: {all_ratings_response.status_code}")
                
        except Exception as e:
            self.log_test("MongoDB Verification", False, f"Error: {str(e)}")
    
    def run_rating_persistence_investigation(self):
        """Run complete rating persistence investigation"""
        print("🚨 RATING PERSISTENCE INVESTIGATION - SPECIFIC USER ISSUE")
        print("=" * 80)
        print("PROBLEMA: As avaliações feitas pelo passenger não estão sendo registradas/salvas no sistema")
        print("=" * 80)
        
        # Setup
        if not self.setup_test_users():
            print("❌ Failed to setup test users")
            return False
        
        # Create and complete trip
        if not self.create_and_complete_trip():
            print("❌ Failed to create and complete trip")
            return False
        
        # Core rating persistence tests
        self.test_rating_creation_and_persistence()
        self.test_duplicate_rating_prevention()
        self.test_mongodb_direct_verification()
        
        # Summary
        print("\n" + "=" * 80)
        print("🚨 RATING PERSISTENCE INVESTIGATION SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        # Critical analysis
        print(f"\n🔍 CRITICAL ANALYSIS:")
        
        rating_creation_success = any("Rating Creation - API Response" in r["test"] and r["success"] for r in self.test_results)
        admin_persistence_success = any("Rating Persistence - Admin Low Ratings" in r["test"] and r["success"] for r in self.test_results)
        user_rating_update_success = any("Rating Persistence - User Rating Update" in r["test"] and r["success"] for r in self.test_results)
        mongodb_access_success = any("MongoDB - Ratings Data Access" in r["test"] and r["success"] for r in self.test_results)
        
        print(f"✅ Rating API Response: {'SUCCESS' if rating_creation_success else 'FAILED'}")
        print(f"✅ Admin Panel Persistence: {'SUCCESS' if admin_persistence_success else 'FAILED'}")
        print(f"✅ User Rating Update: {'SUCCESS' if user_rating_update_success else 'FAILED'}")
        print(f"✅ MongoDB Data Access: {'SUCCESS' if mongodb_access_success else 'FAILED'}")
        
        # Diagnosis
        if rating_creation_success and not admin_persistence_success:
            print(f"\n🚨 DIAGNOSIS: API returns success but data is NOT persisted to database!")
            print(f"🚨 ISSUE CONFIRMED: Rating endpoint appears to work but doesn't save to MongoDB")
        elif rating_creation_success and admin_persistence_success and not user_rating_update_success:
            print(f"\n🚨 DIAGNOSIS: Rating saved but user rating calculation not working!")
        elif not rating_creation_success:
            print(f"\n🚨 DIAGNOSIS: Rating creation API is failing!")
        else:
            print(f"\n✅ DIAGNOSIS: Rating system appears to be working correctly")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS DETAILS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        return success_rate >= 70

if __name__ == "__main__":
    tester = RatingPersistenceTester()
    success = tester.run_rating_persistence_investigation()
    exit(0 if success else 1)