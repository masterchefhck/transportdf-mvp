#!/usr/bin/env python3
"""
Specific Endpoints Test - Review Request Focus
Testing the exact endpoints mentioned in the review request:
1. /api/ratings/low (admin endpoint)
2. /api/users/rating (rating do driver)
3. /api/ratings/create (rating creation)
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

class SpecificEndpointsTester:
    def __init__(self):
        self.session = requests.Session()
        self.tokens = {}
        self.users = {}
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
    
    def setup_users(self):
        """Setup existing users by logging in"""
        users_data = [
            {
                "email": "maria.passenger@test.com",
                "password": "senha123",
                "type": "passenger"
            },
            {
                "email": "joao.driver@test.com",
                "password": "senha123",
                "type": "driver"
            },
            {
                "email": "admin@test.com",
                "password": "senha123",
                "type": "admin"
            }
        ]
        
        for user_data in users_data:
            try:
                response = self.session.post(f"{API_BASE}/auth/login", json={
                    "email": user_data["email"],
                    "password": user_data["password"]
                })
                if response.status_code == 200:
                    data = response.json()
                    self.tokens[user_data["type"]] = data["access_token"]
                    self.users[user_data["type"]] = data["user"]
                    self.log_test(f"Login {user_data['type']}", True, f"User ID: {data['user']['id']}")
                else:
                    self.log_test(f"Login {user_data['type']}", False, f"Status: {response.status_code}")
                    return False
            except Exception as e:
                self.log_test(f"Login {user_data['type']}", False, f"Error: {str(e)}")
                return False
        
        return True
    
    def test_ratings_low_endpoint(self):
        """Test /api/ratings/low endpoint (admin endpoint)"""
        print(f"\n🎯 TESTING /api/ratings/low ENDPOINT")
        print("-" * 50)
        
        if "admin" not in self.tokens:
            self.log_test("Ratings Low Endpoint Setup", False, "No admin token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
            response = self.session.get(f"{API_BASE}/ratings/low", headers=headers)
            
            print(f"📊 Response Status: {response.status_code}")
            print(f"📊 Response Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                ratings = response.json()
                print(f"📊 Found {len(ratings)} low ratings")
                
                # Show detailed information about each rating
                for i, rating in enumerate(ratings):
                    print(f"📊 Rating {i+1}:")
                    print(f"   - ID: {rating.get('id', 'N/A')}")
                    print(f"   - Stars: {rating.get('rating', 'N/A')}")
                    print(f"   - Reason: {rating.get('reason', 'N/A')}")
                    print(f"   - Driver: {rating.get('rated_user_name', 'N/A')}")
                    print(f"   - Passenger: {rating.get('rater_name', 'N/A')}")
                    print(f"   - Date: {rating.get('created_at', 'N/A')}")
                    print(f"   - Alert Sent: {rating.get('alert_sent', 'N/A')}")
                
                self.log_test("GET /api/ratings/low", True, f"Retrieved {len(ratings)} low ratings successfully")
                return True
            else:
                print(f"📊 Error Response: {response.text}")
                self.log_test("GET /api/ratings/low", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/ratings/low", False, f"Error: {str(e)}")
            return False
    
    def test_users_rating_endpoint(self):
        """Test /api/users/rating endpoint (rating do driver)"""
        print(f"\n🎯 TESTING /api/users/rating ENDPOINT")
        print("-" * 50)
        
        if "driver" not in self.tokens:
            self.log_test("Users Rating Endpoint Setup", False, "No driver token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.tokens['driver']}"}
            response = self.session.get(f"{API_BASE}/users/rating", headers=headers)
            
            print(f"⭐ Response Status: {response.status_code}")
            print(f"⭐ Response Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                rating_data = response.json()
                current_rating = rating_data.get("rating", 0)
                
                print(f"⭐ Driver's Current Rating: {current_rating}")
                print(f"⭐ Full Response: {rating_data}")
                
                # Validate rating is within expected range
                if 1.0 <= current_rating <= 5.0:
                    self.log_test("GET /api/users/rating", True, f"Driver rating: {current_rating} (valid range)")
                    return True
                else:
                    self.log_test("GET /api/users/rating", False, f"Invalid rating value: {current_rating}")
                    return False
            else:
                print(f"⭐ Error Response: {response.text}")
                self.log_test("GET /api/users/rating", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/users/rating", False, f"Error: {str(e)}")
            return False
    
    def test_ratings_create_endpoint(self):
        """Test /api/ratings/create endpoint with detailed debugging"""
        print(f"\n🎯 TESTING /api/ratings/create ENDPOINT")
        print("-" * 50)
        
        if "passenger" not in self.tokens or "driver" not in self.tokens:
            self.log_test("Ratings Create Endpoint Setup", False, "Missing required tokens")
            return False
        
        # First, create a trip to rate
        trip_data = {
            "passenger_id": self.users["passenger"]["id"],
            "pickup_latitude": -15.7801,
            "pickup_longitude": -47.9292,
            "pickup_address": "Endpoint Test Pickup",
            "destination_latitude": -15.8267,
            "destination_longitude": -47.9218,
            "destination_address": "Endpoint Test Destination",
            "estimated_price": 12.00
        }
        
        try:
            headers_passenger = {"Authorization": f"Bearer {self.tokens['passenger']}"}
            headers_driver = {"Authorization": f"Bearer {self.tokens['driver']}"}
            
            # Create and complete trip
            print(f"🚗 Creating trip for rating test...")
            trip_response = self.session.post(f"{API_BASE}/trips/request", json=trip_data, headers=headers_passenger)
            
            if trip_response.status_code != 200:
                self.log_test("Trip Creation for Rating Test", False, f"Status: {trip_response.status_code}")
                return False
            
            trip = trip_response.json()
            trip_id = trip["id"]
            print(f"🚗 Trip created: {trip_id}")
            
            # Complete the trip flow
            self.session.put(f"{API_BASE}/drivers/status/online", headers=headers_driver)
            self.session.put(f"{API_BASE}/trips/{trip_id}/accept", headers=headers_driver)
            self.session.put(f"{API_BASE}/trips/{trip_id}/start", headers=headers_driver)
            complete_response = self.session.put(f"{API_BASE}/trips/{trip_id}/complete", headers=headers_driver)
            
            if complete_response.status_code != 200:
                self.log_test("Trip Completion for Rating Test", False, f"Status: {complete_response.status_code}")
                return False
            
            print(f"🚗 Trip completed successfully")
            
            # Now test rating creation
            rating_data = {
                "trip_id": trip_id,
                "rated_user_id": self.users["driver"]["id"],
                "rating": 2,
                "reason": "Teste específico do endpoint de avaliação - motorista chegou atrasado"
            }
            
            print(f"📝 Creating rating with data: {rating_data}")
            
            # Test the rating creation endpoint
            rating_response = self.session.post(f"{API_BASE}/ratings/create", json=rating_data, headers=headers_passenger)
            
            print(f"📝 Rating Creation Response Status: {rating_response.status_code}")
            print(f"📝 Rating Creation Response Headers: {dict(rating_response.headers)}")
            print(f"📝 Rating Creation Response Body: {rating_response.text}")
            
            if rating_response.status_code == 200:
                response_data = rating_response.json()
                rating_id = response_data.get("rating_id")
                
                print(f"📝 Rating created successfully!")
                print(f"📝 Rating ID: {rating_id}")
                print(f"📝 Success Message: {response_data.get('message', 'No message')}")
                
                # Verify the rating was actually saved by checking admin endpoint
                print(f"🔍 Verifying rating was saved...")
                time.sleep(1)  # Small delay to ensure data is persisted
                
                headers_admin = {"Authorization": f"Bearer {self.tokens['admin']}"}
                verify_response = self.session.get(f"{API_BASE}/ratings/low", headers=headers_admin)
                
                if verify_response.status_code == 200:
                    all_ratings = verify_response.json()
                    our_rating = None
                    
                    for rating in all_ratings:
                        if rating.get("id") == rating_id:
                            our_rating = rating
                            break
                    
                    if our_rating:
                        print(f"✅ Rating verified in database: {our_rating}")
                        self.log_test("POST /api/ratings/create", True, f"Rating created and verified in database (ID: {rating_id})")
                        
                        # Also verify driver's rating was updated
                        driver_rating_response = self.session.get(f"{API_BASE}/users/rating", headers=headers_driver)
                        if driver_rating_response.status_code == 200:
                            new_rating = driver_rating_response.json().get("rating", 0)
                            print(f"✅ Driver's rating updated to: {new_rating}")
                            self.log_test("Rating Impact on Driver Score", True, f"Driver rating updated to: {new_rating}")
                        
                        return True
                    else:
                        print(f"❌ Rating NOT found in database!")
                        self.log_test("POST /api/ratings/create", False, f"Rating created but NOT found in database verification")
                        return False
                else:
                    print(f"❌ Failed to verify rating in database: {verify_response.status_code}")
                    self.log_test("POST /api/ratings/create", False, f"Rating created but verification failed: {verify_response.status_code}")
                    return False
            else:
                print(f"❌ Rating creation failed!")
                self.log_test("POST /api/ratings/create", False, f"Status: {rating_response.status_code}, Response: {rating_response.text}")
                return False
                
        except Exception as e:
            self.log_test("POST /api/ratings/create", False, f"Error: {str(e)}")
            return False
    
    def run_specific_endpoints_test(self):
        """Run specific endpoints test as per review request"""
        print("🎯 SPECIFIC ENDPOINTS TEST - REVIEW REQUEST FOCUS")
        print("=" * 80)
        print("Testing the exact endpoints mentioned in the review request:")
        print("1. /api/ratings/low (admin endpoint)")
        print("2. /api/users/rating (rating do driver)")
        print("3. /api/ratings/create (rating creation)")
        print("=" * 80)
        
        # Setup
        if not self.setup_users():
            print("❌ Failed to setup users")
            return False
        
        # Test each specific endpoint
        endpoint1_success = self.test_ratings_low_endpoint()
        endpoint2_success = self.test_users_rating_endpoint()
        endpoint3_success = self.test_ratings_create_endpoint()
        
        # Summary
        print("\n" + "=" * 80)
        print("🎯 SPECIFIC ENDPOINTS TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        print(f"\n🎯 SPECIFIC ENDPOINTS RESULTS:")
        print(f"✅ /api/ratings/low: {'SUCCESS' if endpoint1_success else 'FAILED'}")
        print(f"✅ /api/users/rating: {'SUCCESS' if endpoint2_success else 'FAILED'}")
        print(f"✅ /api/ratings/create: {'SUCCESS' if endpoint3_success else 'FAILED'}")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS DETAILS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        # Final diagnosis
        if endpoint1_success and endpoint2_success and endpoint3_success:
            print(f"\n✅ FINAL DIAGNOSIS: All specific endpoints are working correctly!")
            print(f"✅ Rating system is fully functional and persisting data properly.")
        else:
            print(f"\n❌ FINAL DIAGNOSIS: Issues found with specific endpoints!")
        
        return success_rate >= 80

if __name__ == "__main__":
    tester = SpecificEndpointsTester()
    success = tester.run_specific_endpoints_test()
    exit(0 if success else 1)