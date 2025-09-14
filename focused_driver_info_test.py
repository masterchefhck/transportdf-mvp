#!/usr/bin/env python3
"""
Focused Testing for Driver Information in Trip Responses
Tests specifically for the review request: tests 52, 53, and 54
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://brasilia-rideapp.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class DriverInfoTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = HEADERS.copy()
        self.tokens = {}  # Store tokens for different user types
        self.users = {}   # Store user data
        self.trips = {}   # Store trip data
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

    def setup_users(self):
        """Setup test users (passenger and driver)"""
        print("🔧 Setting up test users...")
        
        # Test data with realistic Brazilian information
        test_users = [
            {
                "name": "Maria Silva Santos",
                "email": "maria.santos@email.com",
                "phone": "(61) 99999-1234",
                "cpf": "123.456.789-01",
                "user_type": "passenger",
                "password": "senha123"
            },
            {
                "name": "João Carlos Oliveira",
                "email": "joao.motorista@email.com", 
                "phone": "(61) 98888-5678",
                "cpf": "987.654.321-09",
                "user_type": "driver",
                "password": "motorista456"
            }
        ]
        
        for user_data in test_users:
            # Try to register first
            success, data, status_code = self.make_request("POST", "/auth/register", user_data)
            
            if success and "access_token" in data:
                user_type = user_data["user_type"]
                self.tokens[user_type] = data["access_token"]
                self.users[user_type] = data["user"]
                print(f"✅ {user_type.title()} registered successfully")
            else:
                # If registration fails, try login (user might already exist)
                login_data = {"email": user_data["email"], "password": user_data["password"]}
                success, data, status_code = self.make_request("POST", "/auth/login", login_data)
                
                if success and "access_token" in data:
                    user_type = user_data["user_type"]
                    self.tokens[user_type] = data["access_token"]
                    self.users[user_type] = data["user"]
                    print(f"✅ {user_type.title()} logged in successfully")
                else:
                    print(f"❌ Failed to setup {user_data['user_type']}: {data}")
                    return False
        
        return len(self.tokens) >= 2

    def test_driver_profile_photo_upload(self):
        """Test 51: Driver profile photo upload functionality"""
        
        if "driver" not in self.tokens:
            self.log_test("Driver Profile Photo Upload", False, "No driver token available")
            return
            
        # Upload profile photo for driver
        photo_data = {
            "profile_photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
        }
        
        success, data, status_code = self.make_request("PUT", "/users/profile-photo", 
                                                     photo_data, auth_token=self.tokens["driver"])
        
        if success and "profile photo updated" in str(data).lower():
            self.log_test("Driver Profile Photo Upload", True, "Driver profile photo uploaded successfully")
        else:
            self.log_test("Driver Profile Photo Upload", False, f"Driver profile photo upload failed (status: {status_code})", data)

    def test_trip_with_driver_info_flow(self):
        """Test 52: Complete trip flow with driver information verification"""
        
        if "passenger" not in self.tokens or "driver" not in self.tokens:
            self.log_test("Trip Flow with Driver Info", False, "Missing passenger or driver tokens")
            return
            
        # Step 1: Passenger requests a trip
        trip_data = {
            "passenger_id": self.users.get("passenger", {}).get("id", ""),
            "pickup_latitude": -15.7633,
            "pickup_longitude": -47.8719,
            "pickup_address": "SQN 308, Asa Norte, Brasília - DF",
            "destination_latitude": -15.8267,
            "destination_longitude": -47.8978,
            "destination_address": "SQS 116, Asa Sul, Brasília - DF",
            "estimated_price": 15.50
        }
        
        success, trip_response, _ = self.make_request("POST", "/trips/request", 
                                                    trip_data, auth_token=self.tokens["passenger"])
        
        if not success:
            self.log_test("Trip Flow with Driver Info", False, "Failed to request trip")
            return
            
        trip_id = trip_response["id"]
        
        # Step 2: Driver accepts the trip
        success, accept_response, _ = self.make_request("PUT", f"/trips/{trip_id}/accept", 
                                                      auth_token=self.tokens["driver"])
        
        if not success:
            self.log_test("Trip Flow with Driver Info", False, "Failed to accept trip")
            return
            
        # Step 3: Check passenger's trip list for driver information
        success, passenger_trips, status_code = self.make_request("GET", "/trips/my", 
                                                                auth_token=self.tokens["passenger"])
        
        if success and isinstance(passenger_trips, list) and passenger_trips:
            # Find the accepted trip
            accepted_trip = next((t for t in passenger_trips if t.get("id") == trip_id), None)
            
            if accepted_trip:
                # Check if driver information is included
                has_driver_info = any([
                    "driver_name" in accepted_trip,
                    "driver_rating" in accepted_trip,
                    "driver_photo" in accepted_trip
                ])
                
                if has_driver_info:
                    driver_fields = [k for k in accepted_trip.keys() if k.startswith("driver_")]
                    self.log_test("Trip Flow with Driver Info", True, f"Driver information included in passenger trip: {driver_fields}")
                    # Store trip for later tests
                    self.trips["test_trip"] = accepted_trip
                else:
                    self.log_test("Trip Flow with Driver Info", False, "Driver information NOT included in passenger trip response")
            else:
                self.log_test("Trip Flow with Driver Info", False, "Accepted trip not found in passenger's trip list")
        else:
            self.log_test("Trip Flow with Driver Info", False, f"Failed to get passenger trips (status: {status_code})", passenger_trips)

    def test_trip_status_updates_with_driver_info(self):
        """Test 53: Verify GET /api/trips/my returns driver info for accepted/in_progress trips"""
        
        if "passenger" not in self.tokens or "driver" not in self.tokens:
            self.log_test("Trip Status Updates with Driver Info", False, "Missing passenger or driver tokens")
            return
            
        # Create a new trip for this test
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
        
        # Request trip
        success, trip_response, _ = self.make_request("POST", "/trips/request", 
                                                    trip_data, auth_token=self.tokens["passenger"])
        
        if not success:
            self.log_test("Trip Status Updates with Driver Info", False, "Failed to create test trip")
            return
            
        trip_id = trip_response["id"]
        
        # Accept trip
        self.make_request("PUT", f"/trips/{trip_id}/accept", auth_token=self.tokens["driver"])
        
        # Test 1: Check driver info when trip is 'accepted'
        success, passenger_trips, _ = self.make_request("GET", "/trips/my", 
                                                      auth_token=self.tokens["passenger"])
        
        if success and passenger_trips:
            accepted_trip = next((t for t in passenger_trips if t.get("id") == trip_id), None)
            if accepted_trip and accepted_trip.get("status") == "accepted":
                has_driver_info = any([
                    "driver_name" in accepted_trip,
                    "driver_rating" in accepted_trip,
                    "driver_photo" in accepted_trip
                ])
                
                if has_driver_info:
                    self.log_test("Trip Status - Accepted with Driver Info", True, "Driver info included for accepted trip")
                else:
                    self.log_test("Trip Status - Accepted with Driver Info", False, "Driver info missing for accepted trip")
            else:
                self.log_test("Trip Status - Accepted with Driver Info", False, "Trip not found or status incorrect")
        
        # Start trip
        self.make_request("PUT", f"/trips/{trip_id}/start", auth_token=self.tokens["driver"])
        
        # Test 2: Check driver info when trip is 'in_progress'
        success, passenger_trips, _ = self.make_request("GET", "/trips/my", 
                                                      auth_token=self.tokens["passenger"])
        
        if success and passenger_trips:
            in_progress_trip = next((t for t in passenger_trips if t.get("id") == trip_id), None)
            if in_progress_trip and in_progress_trip.get("status") == "in_progress":
                has_driver_info = any([
                    "driver_name" in in_progress_trip,
                    "driver_rating" in in_progress_trip,
                    "driver_photo" in in_progress_trip
                ])
                
                if has_driver_info:
                    self.log_test("Trip Status - In Progress with Driver Info", True, "Driver info included for in_progress trip")
                else:
                    self.log_test("Trip Status - In Progress with Driver Info", False, "Driver info missing for in_progress trip")
            else:
                self.log_test("Trip Status - In Progress with Driver Info", False, "Trip not found or status incorrect")

    def test_driver_info_completeness(self):
        """Test 54: Verify driver information completeness (name, rating, photo)"""
        
        if "passenger" not in self.tokens or "driver" not in self.tokens:
            self.log_test("Driver Info Completeness", False, "Missing passenger or driver tokens")
            return
            
        # Ensure driver has profile photo
        photo_data = {
            "profile_photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
        }
        self.make_request("PUT", "/users/profile-photo", photo_data, auth_token=self.tokens["driver"])
        
        # Create and accept a trip
        trip_data = {
            "passenger_id": self.users.get("passenger", {}).get("id", ""),
            "pickup_latitude": -15.7600,
            "pickup_longitude": -47.8700,
            "pickup_address": "Asa Norte, Brasília - DF",
            "destination_latitude": -15.8100,
            "destination_longitude": -47.8800,
            "destination_address": "Asa Sul, Brasília - DF",
            "estimated_price": 10.00
        }
        
        success, trip_response, _ = self.make_request("POST", "/trips/request", 
                                                    trip_data, auth_token=self.tokens["passenger"])
        
        if not success:
            self.log_test("Driver Info Completeness", False, "Failed to create test trip")
            return
            
        trip_id = trip_response["id"]
        self.make_request("PUT", f"/trips/{trip_id}/accept", auth_token=self.tokens["driver"])
        
        # Check passenger's trip for complete driver information
        success, passenger_trips, _ = self.make_request("GET", "/trips/my", 
                                                      auth_token=self.tokens["passenger"])
        
        if success and passenger_trips:
            trip = next((t for t in passenger_trips if t.get("id") == trip_id), None)
            if trip:
                # Check for all three required driver info fields
                has_name = "driver_name" in trip and trip["driver_name"]
                has_rating = "driver_rating" in trip and trip["driver_rating"] is not None
                has_photo = "driver_photo" in trip
                
                missing_fields = []
                if not has_name:
                    missing_fields.append("driver_name")
                if not has_rating:
                    missing_fields.append("driver_rating")
                if not has_photo:
                    missing_fields.append("driver_photo")
                
                if not missing_fields:
                    driver_name = trip.get("driver_name", "Unknown")
                    driver_rating = trip.get("driver_rating", "N/A")
                    has_photo_data = bool(trip.get("driver_photo"))
                    self.log_test("Driver Info Completeness", True, 
                                f"Complete driver info: name='{driver_name}', rating={driver_rating}, photo={has_photo_data}")
                else:
                    self.log_test("Driver Info Completeness", False, f"Missing driver info fields: {missing_fields}")
            else:
                self.log_test("Driver Info Completeness", False, "Trip not found in passenger's trip list")
        else:
            self.log_test("Driver Info Completeness", False, "Failed to retrieve passenger trips")

    def run_focused_tests(self):
        """Run the focused tests for driver information in trip responses"""
        print("🚗 FOCUSED TESTING: DRIVER INFO IN TRIP RESPONSES")
        print("=" * 60)
        print("Testing the updated trip functionality to verify driver information")
        print("is included when a passenger views their trips.")
        print("=" * 60)
        print()
        
        # Setup
        if not self.setup_users():
            print("❌ Failed to setup test users. Exiting.")
            return
        
        print()
        print("🧪 Running focused tests...")
        print()
        
        # Run the specific tests mentioned in the review request
        self.test_driver_profile_photo_upload()  # Test 51 (prerequisite)
        self.test_trip_with_driver_info_flow()   # Test 52
        self.test_trip_status_updates_with_driver_info()  # Test 53
        self.test_driver_info_completeness()     # Test 54
        
        # Summary
        print("=" * 60)
        print("📊 FOCUSED TEST SUMMARY")
        print("=" * 60)
        
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
        
        print("=" * 60)
        return passed, failed

if __name__ == "__main__":
    tester = DriverInfoTester()
    passed, failed = tester.run_focused_tests()
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)