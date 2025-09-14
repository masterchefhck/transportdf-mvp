#!/usr/bin/env python3
"""
Focused Profile Photo Upload Testing for TransportDF MVP
Tests the new PUT /api/users/profile-photo endpoint as requested in the review
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://photo-upload-ride.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class ProfilePhotoTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = HEADERS.copy()
        self.tokens = {}  # Store tokens for different user types
        self.users = {}   # Store user data
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    Details: {details}")
        if not success and response_data:
            print(f"    Response: {response_data}")
        print()

    def make_request(self, method: str, endpoint: str, data: Dict = None, auth_token: str = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}{endpoint}"
        headers = self.headers.copy()
        
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
            
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=headers, json=data, timeout=30)
            else:
                return False, f"Unsupported method: {method}", 0
                
            return response.status_code < 400, response.json() if response.content else {}, response.status_code
            
        except requests.exceptions.RequestException as e:
            return False, f"Request failed: {str(e)}", 0
        except json.JSONDecodeError:
            return False, "Invalid JSON response", response.status_code if 'response' in locals() else 0

    def setup_test_users(self):
        """Setup test users for profile photo testing"""
        print("🔧 Setting up test users...")
        
        # Try to login existing users first
        test_logins = [
            {"email": "passenger@test.com", "password": "password123", "type": "passenger"},
            {"email": "driver@test.com", "password": "password123", "type": "driver"}
        ]
        
        for login in test_logins:
            success, data, status_code = self.make_request("POST", "/auth/login", 
                                                         {"email": login["email"], "password": login["password"]})
            
            if success and "access_token" in data:
                self.tokens[login["type"]] = data["access_token"]
                if "user" in data:
                    self.users[login["type"]] = data["user"]
                print(f"✅ Logged in existing {login['type']}")
            else:
                # Try to register new user
                user_data = {
                    "name": f"Test {login['type'].title()}",
                    "email": login["email"],
                    "phone": "(61) 99999-0000",
                    "cpf": "000.000.000-00" if login["type"] == "passenger" else "111.111.111-11",
                    "user_type": login["type"],
                    "password": login["password"]
                }
                
                success, data, status_code = self.make_request("POST", "/auth/register", user_data)
                
                if success and "access_token" in data:
                    self.tokens[login["type"]] = data["access_token"]
                    if "user" in data:
                        self.users[login["type"]] = data["user"]
                    print(f"✅ Registered new {login['type']}")
                else:
                    print(f"❌ Failed to setup {login['type']}: {data}")

    def test_profile_photo_upload_valid(self):
        """Test 1: Valid profile photo upload for authenticated user"""
        
        if "passenger" not in self.tokens:
            self.log_test("Profile Photo Upload - Valid", False, "No passenger token available")
            return
            
        # Simulate base64 image data (JPEG)
        photo_data = {
            "profile_photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
        }
        
        success, data, status_code = self.make_request("PUT", "/users/profile-photo", 
                                                     photo_data, auth_token=self.tokens["passenger"])
        
        if success and "profile photo updated" in str(data).lower():
            self.log_test("Profile Photo Upload - Valid", True, "Profile photo uploaded successfully for authenticated user")
        else:
            self.log_test("Profile Photo Upload - Valid", False, f"Profile photo upload failed (status: {status_code})", data)

    def test_profile_photo_upload_no_auth(self):
        """Test 2: Profile photo upload without authentication token"""
        
        photo_data = {
            "profile_photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
        }
        
        success, data, status_code = self.make_request("PUT", "/users/profile-photo", photo_data)
        
        if not success and (status_code == 401 or status_code == 403):
            self.log_test("Profile Photo Upload - No Auth", True, "Correctly denied access without authentication token")
        else:
            self.log_test("Profile Photo Upload - No Auth", False, f"Should require authentication (status: {status_code})", data)

    def test_profile_photo_upload_invalid_payload(self):
        """Test 3: Profile photo upload with invalid payload"""
        
        if "passenger" not in self.tokens:
            self.log_test("Profile Photo Upload - Invalid Payload", False, "No passenger token available")
            return
            
        # Test with empty payload
        success, data, status_code = self.make_request("PUT", "/users/profile-photo", 
                                                     {}, auth_token=self.tokens["passenger"])
        
        if not success and (status_code == 400 or status_code == 422):
            self.log_test("Profile Photo Upload - Empty Payload", True, "Correctly rejected empty payload")
        else:
            self.log_test("Profile Photo Upload - Empty Payload", False, f"Should reject empty payload (status: {status_code})", data)
            
        # Test with invalid data structure
        invalid_data = {"invalid_field": "some_value"}
        success, data, status_code = self.make_request("PUT", "/users/profile-photo", 
                                                     invalid_data, auth_token=self.tokens["passenger"])
        
        if not success and (status_code == 400 or status_code == 422):
            self.log_test("Profile Photo Upload - Invalid Structure", True, "Correctly rejected invalid data structure")
        else:
            self.log_test("Profile Photo Upload - Invalid Structure", False, f"Should reject invalid structure (status: {status_code})", data)

    def test_profile_photo_retrieval_via_users_me(self):
        """Test 4: Verify profile photo is saved and retrievable via GET /users/me"""
        
        if "passenger" not in self.tokens:
            self.log_test("Profile Photo Retrieval via /users/me", False, "No passenger token available")
            return
            
        success, data, status_code = self.make_request("GET", "/users/me", 
                                                     auth_token=self.tokens["passenger"])
        
        if success and "profile_photo" in data:
            if data["profile_photo"] and data["profile_photo"].startswith("data:image/"):
                self.log_test("Profile Photo Retrieval via /users/me", True, "Profile photo correctly saved and retrieved from user profile")
            else:
                self.log_test("Profile Photo Retrieval via /users/me", False, f"Profile photo field exists but invalid format: {data.get('profile_photo', 'None')[:50]}...")
        else:
            self.log_test("Profile Photo Retrieval via /users/me", False, f"Failed to retrieve user profile or profile_photo field missing (status: {status_code})", data)

    def test_profile_photo_overwrite_existing(self):
        """Test 5: Overwrite existing profile photo"""
        
        if "driver" not in self.tokens:
            self.log_test("Profile Photo Overwrite", False, "No driver token available")
            return
            
        # Upload first photo
        first_photo = {
            "profile_photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
        }
        
        success1, data1, _ = self.make_request("PUT", "/users/profile-photo", 
                                             first_photo, auth_token=self.tokens["driver"])
        
        if not success1:
            self.log_test("Profile Photo Overwrite", False, "Failed to upload first photo")
            return
            
        # Upload second photo (different base64)
        second_photo = {
            "profile_photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA4nEKtAAAAABJRU5ErkJggg=="
        }
        
        success2, data2, status_code = self.make_request("PUT", "/users/profile-photo", 
                                                        second_photo, auth_token=self.tokens["driver"])
        
        if success2 and "profile photo updated" in str(data2).lower():
            # Verify the photo was actually updated
            success3, user_data, _ = self.make_request("GET", "/users/me", 
                                                     auth_token=self.tokens["driver"])
            
            if success3 and user_data.get("profile_photo") == second_photo["profile_photo"]:
                self.log_test("Profile Photo Overwrite", True, "Successfully overwrote existing profile photo")
            else:
                self.log_test("Profile Photo Overwrite", False, "Photo upload succeeded but photo was not updated in database")
        else:
            self.log_test("Profile Photo Overwrite", False, f"Failed to overwrite existing photo (status: {status_code})", data2)

    def test_profile_photo_in_available_trips(self):
        """Test 6: Verify profile photo appears in GET /trips/available with passenger info"""
        
        if "driver" not in self.tokens or "passenger" not in self.tokens:
            self.log_test("Profile Photo in Available Trips", False, "Driver or passenger token not available")
            return
            
        # First ensure passenger has a profile photo
        passenger_photo = {
            "profile_photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
        }
        
        self.make_request("PUT", "/users/profile-photo", 
                         passenger_photo, auth_token=self.tokens["passenger"])
        
        # Create a new trip request
        trip_data = {
            "passenger_id": self.users.get("passenger", {}).get("id", ""),
            "pickup_latitude": -15.7800,
            "pickup_longitude": -47.8900,
            "pickup_address": "Setor Comercial Sul, Brasília - DF",
            "destination_latitude": -15.7500,
            "destination_longitude": -47.8600,
            "destination_address": "Setor Bancário Norte, Brasília - DF",
            "estimated_price": 12.00
        }
        
        trip_success, trip_response, _ = self.make_request("POST", "/trips/request", 
                                                         trip_data, auth_token=self.tokens["passenger"])
        
        if not trip_success:
            self.log_test("Profile Photo in Available Trips", False, "Failed to create test trip")
            return
            
        # Now check available trips as driver
        success, data, status_code = self.make_request("GET", "/trips/available", 
                                                     auth_token=self.tokens["driver"])
        
        if success and isinstance(data, list) and data:
            # Find our trip and check if it has passenger photo
            test_trip = None
            for trip in data:
                if trip.get("id") == trip_response.get("id"):
                    test_trip = trip
                    break
            
            if test_trip:
                required_fields = ["passenger_name", "passenger_rating", "passenger_photo"]
                missing_fields = [field for field in required_fields if field not in test_trip]
                
                if not missing_fields:
                    if test_trip["passenger_photo"] and test_trip["passenger_photo"].startswith("data:image/"):
                        self.log_test("Profile Photo in Available Trips", True, 
                                    f"Available trips correctly include passenger info: name='{test_trip['passenger_name']}', rating={test_trip['passenger_rating']}, photo=present")
                    else:
                        self.log_test("Profile Photo in Available Trips", False, 
                                    f"Passenger photo field present but invalid: {test_trip.get('passenger_photo', 'None')[:50]}...")
                else:
                    self.log_test("Profile Photo in Available Trips", False, 
                                f"Missing passenger fields in available trips: {missing_fields}")
            else:
                self.log_test("Profile Photo in Available Trips", False, "Test trip not found in available trips")
        else:
            self.log_test("Profile Photo in Available Trips", False, f"Failed to get available trips (status: {status_code})", data)

    def run_profile_photo_tests(self):
        """Run all profile photo tests"""
        print("=" * 80)
        print("📸 TESTING PROFILE PHOTO UPLOAD ENDPOINT - REVIEW REQUEST")
        print("=" * 80)
        print()
        
        # Setup test users
        self.setup_test_users()
        print()
        
        # Run profile photo tests
        self.test_profile_photo_upload_valid()
        self.test_profile_photo_upload_no_auth()
        self.test_profile_photo_upload_invalid_payload()
        self.test_profile_photo_retrieval_via_users_me()
        self.test_profile_photo_overwrite_existing()
        self.test_profile_photo_in_available_trips()
        
        # Summary
        print("=" * 80)
        print("📊 PROFILE PHOTO TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result["success"])
        failed = len(self.test_results) - passed
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/len(self.test_results)*100):.1f}%")
        print()
        
        if failed > 0:
            print("❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
            print()
        
        print("=" * 80)
        return passed, failed

if __name__ == "__main__":
    tester = ProfilePhotoTester()
    passed, failed = tester.run_profile_photo_tests()
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)