#!/usr/bin/env python3
"""
Focused Test for Rating Bulk Delete Issue
Testing specifically the admin dashboard bulk delete functionality for ratings
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

class RatingBulkDeleteTester:
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
    
    def setup_test_users(self):
        """Setup required test users"""
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
                # Try to register first
                response = self.session.post(f"{API_BASE}/auth/register", json=user_data)
                if response.status_code == 200:
                    data = response.json()
                    self.tokens[user_data["user_type"]] = data["access_token"]
                    self.users[user_data["user_type"]] = data["user"]
                    self.log_test(f"Setup {user_data['user_type']}", True, f"User registered")
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
                        self.log_test(f"Setup {user_data['user_type']}", True, f"User logged in")
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
    
    def check_ratings_in_database(self):
        """Step 1: Check if there are ratings in the database"""
        print("\n🔍 STEP 1: CHECKING RATINGS IN DATABASE")
        print("-" * 50)
        
        if "admin" not in self.tokens:
            self.log_test("Check Database - Admin Token", False, "No admin token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
            
            # Check via /api/ratings/low endpoint
            response = self.session.get(f"{API_BASE}/ratings/low", headers=headers)
            
            if response.status_code == 200:
                ratings = response.json()
                rating_count = len(ratings)
                
                if rating_count > 0:
                    self.log_test("Database Ratings Check", True, f"Found {rating_count} ratings in database")
                    
                    # Log details of first few ratings for debugging
                    for i, rating in enumerate(ratings[:3]):
                        rating_id = rating.get("id", "NO_ID")
                        rating_stars = rating.get("rating", "NO_RATING")
                        self.log_test(f"Rating {i+1} Structure", True, f"ID: {rating_id}, Stars: {rating_stars}")
                    
                    return ratings
                else:
                    self.log_test("Database Ratings Check", False, "No ratings found in database")
                    return []
            else:
                self.log_test("Database Ratings Check", False, f"Failed to get ratings: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Database Ratings Check", False, f"Error: {str(e)}")
            return False
    
    def create_test_ratings(self):
        """Create some test ratings if none exist"""
        print("\n📝 CREATING TEST RATINGS")
        print("-" * 50)
        
        if "passenger" not in self.tokens or "driver" not in self.tokens:
            self.log_test("Create Test Ratings Setup", False, "Missing required tokens")
            return False
        
        # Create a trip and complete it to generate ratings
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
            # Create trip
            headers_passenger = {"Authorization": f"Bearer {self.tokens['passenger']}"}
            headers_driver = {"Authorization": f"Bearer {self.tokens['driver']}"}
            
            trip_response = self.session.post(f"{API_BASE}/trips/request", json=trip_data, headers=headers_passenger)
            if trip_response.status_code != 200:
                self.log_test("Create Test Trip", False, f"Failed: {trip_response.status_code}")
                return False
            
            trip = trip_response.json()
            trip_id = trip["id"]
            self.log_test("Create Test Trip", True, f"Trip ID: {trip_id}")
            
            # Complete the trip flow
            self.session.put(f"{API_BASE}/drivers/status/online", headers=headers_driver)
            self.session.put(f"{API_BASE}/trips/{trip_id}/accept", headers=headers_driver)
            self.session.put(f"{API_BASE}/trips/{trip_id}/start", headers=headers_driver)
            complete_response = self.session.put(f"{API_BASE}/trips/{trip_id}/complete", headers=headers_driver)
            
            if complete_response.status_code != 200:
                self.log_test("Complete Test Trip", False, f"Failed: {complete_response.status_code}")
                return False
            
            self.log_test("Complete Test Trip", True, "Trip completed successfully")
            
            # Create ratings (both good and bad for testing)
            ratings_to_create = [
                {"rating": 3, "reason": "Serviço mediano, pode melhorar"},
                {"rating": 2, "reason": "Motorista chegou atrasado e foi rude"}
            ]
            
            created_ratings = []
            for i, rating_data in enumerate(ratings_to_create):
                rating_payload = {
                    "trip_id": trip_id,
                    "rated_user_id": self.users["driver"]["id"],
                    "rating": rating_data["rating"],
                    "reason": rating_data["reason"]
                }
                
                rating_response = self.session.post(f"{API_BASE}/ratings/create", json=rating_payload, headers=headers_passenger)
                
                if rating_response.status_code == 200:
                    result = rating_response.json()
                    created_ratings.append(result.get("rating_id"))
                    self.log_test(f"Create Test Rating {i+1}", True, f"{rating_data['rating']} stars")
                elif rating_response.status_code == 400 and "already exists" in rating_response.text:
                    self.log_test(f"Create Test Rating {i+1}", True, "Rating already exists (expected)")
                    break  # Can only rate once per trip
                else:
                    self.log_test(f"Create Test Rating {i+1}", False, f"Failed: {rating_response.status_code}")
            
            return len(created_ratings) > 0
            
        except Exception as e:
            self.log_test("Create Test Ratings", False, f"Error: {str(e)}")
            return False
    
    def test_bulk_delete_endpoint(self, existing_ratings):
        """Step 2: Test the /api/admin/ratings/bulk-delete endpoint"""
        print("\n🗑️ STEP 2: TESTING BULK DELETE ENDPOINT")
        print("-" * 50)
        
        if "admin" not in self.tokens:
            self.log_test("Bulk Delete Test Setup", False, "No admin token available")
            return False
        
        if not existing_ratings:
            self.log_test("Bulk Delete Test Setup", False, "No ratings available for testing")
            return False
        
        headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
        
        # Test 1: Try to delete with real rating IDs
        try:
            # Get real rating IDs from existing ratings
            real_rating_ids = [rating["id"] for rating in existing_ratings[:2]]  # Take first 2
            
            self.log_test("Extracted Rating IDs", True, f"IDs: {real_rating_ids}")
            
            bulk_delete_payload = {"ids": real_rating_ids}
            
            response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                       json=bulk_delete_payload, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                message = result.get("message", "")
                self.log_test("Bulk Delete with Real IDs", True, f"Response: {message}")
                
                # Verify deletion worked by checking if ratings are gone
                verify_response = self.session.get(f"{API_BASE}/ratings/low", headers=headers)
                if verify_response.status_code == 200:
                    remaining_ratings = verify_response.json()
                    remaining_ids = [r["id"] for r in remaining_ratings]
                    
                    deleted_successfully = not any(rid in remaining_ids for rid in real_rating_ids)
                    self.log_test("Verify Deletion Success", deleted_successfully, 
                                f"Ratings deleted from database: {deleted_successfully}")
                
            else:
                self.log_test("Bulk Delete with Real IDs", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Bulk Delete with Real IDs", False, f"Error: {str(e)}")
        
        # Test 2: Try with non-existent IDs
        try:
            fake_ids = ["fake-id-1", "fake-id-2"]
            bulk_delete_payload = {"ids": fake_ids}
            
            response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                       json=bulk_delete_payload, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                message = result.get("message", "")
                # Should report 0 deleted
                self.log_test("Bulk Delete with Fake IDs", True, f"Response: {message}")
            else:
                self.log_test("Bulk Delete with Fake IDs", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Bulk Delete with Fake IDs", False, f"Error: {str(e)}")
        
        # Test 3: Try with empty list
        try:
            bulk_delete_payload = {"ids": []}
            
            response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                       json=bulk_delete_payload, headers=headers)
            
            success = response.status_code == 200
            self.log_test("Bulk Delete with Empty List", success, 
                        f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Bulk Delete with Empty List", False, f"Error: {str(e)}")
        
        # Test 4: Try with malformed request
        try:
            malformed_payload = {"wrong_field": ["id1", "id2"]}
            
            response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                       json=malformed_payload, headers=headers)
            
            # Should fail with 422 (validation error)
            expected_failure = response.status_code == 422
            self.log_test("Bulk Delete with Malformed Request", expected_failure, 
                        f"Status: {response.status_code} (expected 422)")
                
        except Exception as e:
            self.log_test("Bulk Delete with Malformed Request", False, f"Error: {str(e)}")
    
    def debug_id_field_issue(self, existing_ratings):
        """Step 3: Debug the id vs _id field issue"""
        print("\n🔧 STEP 3: DEBUGGING ID FIELD ISSUES")
        print("-" * 50)
        
        if not existing_ratings:
            self.log_test("Debug ID Fields", False, "No ratings available for debugging")
            return
        
        # Analyze the structure of ratings returned by the API
        for i, rating in enumerate(existing_ratings[:2]):
            self.log_test(f"Rating {i+1} Fields", True, f"Available fields: {list(rating.keys())}")
            
            # Check for both 'id' and '_id' fields
            has_id = "id" in rating
            has_underscore_id = "_id" in rating
            id_value = rating.get("id", "NOT_FOUND")
            underscore_id_value = rating.get("_id", "NOT_FOUND")
            
            self.log_test(f"Rating {i+1} ID Analysis", True, 
                        f"has 'id': {has_id} (value: {id_value}), has '_id': {has_underscore_id} (value: {underscore_id_value})")
    
    def test_permissions(self):
        """Test that only admin can perform bulk delete"""
        print("\n🔒 TESTING PERMISSIONS")
        print("-" * 50)
        
        bulk_delete_payload = {"ids": ["test-id"]}
        
        # Test with passenger token (should fail)
        if "passenger" in self.tokens:
            try:
                headers = {"Authorization": f"Bearer {self.tokens['passenger']}"}
                response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                           json=bulk_delete_payload, headers=headers)
                
                expected_failure = response.status_code in [401, 403]
                self.log_test("Bulk Delete - Passenger Permission", expected_failure, 
                            f"Status: {response.status_code} (expected 401/403)")
            except Exception as e:
                self.log_test("Bulk Delete - Passenger Permission", False, f"Error: {str(e)}")
        
        # Test with driver token (should fail)
        if "driver" in self.tokens:
            try:
                headers = {"Authorization": f"Bearer {self.tokens['driver']}"}
                response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                           json=bulk_delete_payload, headers=headers)
                
                expected_failure = response.status_code in [401, 403]
                self.log_test("Bulk Delete - Driver Permission", expected_failure, 
                            f"Status: {response.status_code} (expected 401/403)")
            except Exception as e:
                self.log_test("Bulk Delete - Driver Permission", False, f"Error: {str(e)}")
        
        # Test without token (should fail)
        try:
            response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                       json=bulk_delete_payload)
            
            expected_failure = response.status_code in [401, 403]
            self.log_test("Bulk Delete - No Token", expected_failure, 
                        f"Status: {response.status_code} (expected 401/403)")
        except Exception as e:
            self.log_test("Bulk Delete - No Token", False, f"Error: {str(e)}")
    
    def run_focused_rating_bulk_delete_test(self):
        """Run the complete focused test for rating bulk delete issue"""
        print("🎯 RATING BULK DELETE FOCUSED TEST")
        print("=" * 80)
        print("Testing specifically: Admin dashboard bulk delete ratings functionality")
        print("User Issue: 'nem as avaliações atualmente existentes dentro de avaliações do menu no dashboard do admin não estão sendo possíveis ser deletadas'")
        print("=" * 80)
        
        # Setup
        if not self.setup_test_users():
            print("❌ CRITICAL: Failed to setup test users")
            return False
        
        # Step 1: Check existing ratings
        existing_ratings = self.check_ratings_in_database()
        
        # If no ratings exist, create some
        if not existing_ratings:
            print("\n📝 No existing ratings found, creating test ratings...")
            if self.create_test_ratings():
                existing_ratings = self.check_ratings_in_database()
        
        # Step 2: Test bulk delete endpoint
        if existing_ratings:
            self.test_bulk_delete_endpoint(existing_ratings)
            self.debug_id_field_issue(existing_ratings)
        
        # Step 3: Test permissions
        self.test_permissions()
        
        # Summary
        print("\n" + "=" * 80)
        print("🎯 RATING BULK DELETE TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        # Specific analysis for the user's issue
        bulk_delete_tests = [r for r in self.test_results if "Bulk Delete" in r["test"]]
        bulk_delete_success = any(r["success"] for r in bulk_delete_tests if "Real IDs" in r["test"])
        
        print(f"\n🎯 SPECIFIC ISSUE ANALYSIS:")
        print(f"✅ Database has ratings: {'YES' if existing_ratings else 'NO'}")
        print(f"✅ Bulk delete endpoint accessible: {'YES' if any('Bulk Delete' in r['test'] and r['success'] for r in self.test_results) else 'NO'}")
        print(f"✅ Bulk delete functional: {'YES' if bulk_delete_success else 'NO'}")
        print(f"✅ Permissions working: {'YES' if any('Permission' in r['test'] and r['success'] for r in self.test_results) else 'NO'}")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        return success_rate >= 80

if __name__ == "__main__":
    tester = RatingBulkDeleteTester()
    success = tester.run_focused_rating_bulk_delete_test()
    exit(0 if success else 1)