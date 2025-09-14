#!/usr/bin/env python3
"""
Focused Testing for Driver Trip Passenger Information
Tests the updated driver trip functionality to ensure passenger information is visible throughout all trip stages
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://photo-upload-ride.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class DriverTripPassengerInfoTester:
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
        
        # Test data with realistic Brazilian information - using existing users
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
            
            if success and "access_token" in data and "user" in data:
                user_type = user_data["user_type"]
                self.tokens[user_type] = data["access_token"]
                self.users[user_type] = data["user"]
                print(f"✅ Registered {user_type}: {user_data['name']}")
            else:
                # If registration fails, try login (user might already exist)
                login_data = {"email": user_data["email"], "password": user_data["password"]}
                success, data, status_code = self.make_request("POST", "/auth/login", login_data)
                
                if success and "access_token" in data:
                    user_type = user_data["user_type"]
                    self.tokens[user_type] = data["access_token"]
                    if "user" in data:
                        self.users[user_type] = data["user"]
                    print(f"✅ Logged in {user_type}: {user_data['name']}")
                else:
                    print(f"❌ Failed to setup {user_data['user_type']}: {data}")
                    return False
        
        # Upload profile photos for both users
        self.setup_profile_photos()
        return True

    def setup_profile_photos(self):
        """Upload profile photos for passenger and driver"""
        print("📸 Setting up profile photos...")
        
        # Base64 encoded small JPEG image
        photo_data = {
            "profile_photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
        }
        
        for user_type in ["passenger", "driver"]:
            if user_type in self.tokens:
                success, data, _ = self.make_request("PUT", "/users/profile-photo", 
                                                   photo_data, auth_token=self.tokens[user_type])
                if success:
                    print(f"✅ Profile photo uploaded for {user_type}")
                else:
                    print(f"⚠️ Failed to upload profile photo for {user_type}")

    def test_driver_trips_my_includes_passenger_info_all_statuses(self):
        """Test 1: GET /api/trips/my for drivers includes passenger info for all trip statuses"""
        
        if "driver" not in self.tokens or "passenger" not in self.tokens:
            self.log_test("Driver Trips My - Passenger Info All Statuses", False, "Missing driver or passenger tokens")
            return
            
        print("🚗 Testing driver trip flow with passenger information visibility...")
        
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
            self.log_test("Driver Trips My - Passenger Info All Statuses", False, "Failed to request trip")
            return
            
        trip_id = trip_response["id"]
        print(f"📍 Trip requested: {trip_id[:8]}...")
        
        # Step 2: Driver accepts the trip
        success, _, _ = self.make_request("PUT", f"/trips/{trip_id}/accept", 
                                        auth_token=self.tokens["driver"])
        
        if not success:
            self.log_test("Driver Trips My - Passenger Info All Statuses", False, "Failed to accept trip")
            return
            
        print("✅ Trip accepted by driver")
        
        # Test 2a: Check driver's trips for passenger info when status = 'accepted'
        success, driver_trips, _ = self.make_request("GET", "/trips/my", 
                                                   auth_token=self.tokens["driver"])
        
        if success and driver_trips:
            accepted_trip = next((t for t in driver_trips if t.get("id") == trip_id), None)
            if accepted_trip and accepted_trip.get("status") == "accepted":
                passenger_info_fields = ["passenger_name", "passenger_rating", "passenger_photo"]
                has_passenger_info = all(field in accepted_trip for field in passenger_info_fields)
                
                if has_passenger_info:
                    passenger_name = accepted_trip.get("passenger_name", "Unknown")
                    passenger_rating = accepted_trip.get("passenger_rating", "N/A")
                    has_photo = bool(accepted_trip.get("passenger_photo"))
                    self.log_test("Driver Trips - Accepted Status Passenger Info", True, 
                                f"Passenger info included for accepted trip: name='{passenger_name}', rating={passenger_rating}, photo={has_photo}")
                else:
                    missing_fields = [field for field in passenger_info_fields if field not in accepted_trip]
                    self.log_test("Driver Trips - Accepted Status Passenger Info", False, 
                                f"Missing passenger info fields for accepted trip: {missing_fields}")
            else:
                self.log_test("Driver Trips - Accepted Status Passenger Info", False, 
                            "Accepted trip not found or status incorrect")
        else:
            self.log_test("Driver Trips - Accepted Status Passenger Info", False, 
                        "Failed to get driver trips")
        
        # Step 3: Driver starts the trip
        success, _, _ = self.make_request("PUT", f"/trips/{trip_id}/start", 
                                        auth_token=self.tokens["driver"])
        
        if not success:
            self.log_test("Driver Trips My - Passenger Info All Statuses", False, "Failed to start trip")
            return
            
        print("🚀 Trip started")
        
        # Test 2b: Check driver's trips for passenger info when status = 'in_progress'
        success, driver_trips, _ = self.make_request("GET", "/trips/my", 
                                                   auth_token=self.tokens["driver"])
        
        if success and driver_trips:
            in_progress_trip = next((t for t in driver_trips if t.get("id") == trip_id), None)
            if in_progress_trip and in_progress_trip.get("status") == "in_progress":
                passenger_info_fields = ["passenger_name", "passenger_rating", "passenger_photo"]
                has_passenger_info = all(field in in_progress_trip for field in passenger_info_fields)
                
                if has_passenger_info:
                    passenger_name = in_progress_trip.get("passenger_name", "Unknown")
                    passenger_rating = in_progress_trip.get("passenger_rating", "N/A")
                    has_photo = bool(in_progress_trip.get("passenger_photo"))
                    self.log_test("Driver Trips - In Progress Status Passenger Info", True, 
                                f"Passenger info included for in_progress trip: name='{passenger_name}', rating={passenger_rating}, photo={has_photo}")
                else:
                    missing_fields = [field for field in passenger_info_fields if field not in in_progress_trip]
                    self.log_test("Driver Trips - In Progress Status Passenger Info", False, 
                                f"Missing passenger info fields for in_progress trip: {missing_fields}")
            else:
                self.log_test("Driver Trips - In Progress Status Passenger Info", False, 
                            "In progress trip not found or status incorrect")
        else:
            self.log_test("Driver Trips - In Progress Status Passenger Info", False, 
                        "Failed to get driver trips")
        
        # Step 4: Driver completes the trip
        success, _, _ = self.make_request("PUT", f"/trips/{trip_id}/complete", 
                                        auth_token=self.tokens["driver"])
        
        if not success:
            self.log_test("Driver Trips My - Passenger Info All Statuses", False, "Failed to complete trip")
            return
            
        print("🏁 Trip completed")
        
        # Test 2c: Check driver's trips for passenger info when status = 'completed'
        success, driver_trips, _ = self.make_request("GET", "/trips/my", 
                                                   auth_token=self.tokens["driver"])
        
        if success and driver_trips:
            completed_trip = next((t for t in driver_trips if t.get("id") == trip_id), None)
            if completed_trip and completed_trip.get("status") == "completed":
                passenger_info_fields = ["passenger_name", "passenger_rating", "passenger_photo"]
                has_passenger_info = all(field in completed_trip for field in passenger_info_fields)
                
                if has_passenger_info:
                    passenger_name = completed_trip.get("passenger_name", "Unknown")
                    passenger_rating = completed_trip.get("passenger_rating", "N/A")
                    has_photo = bool(completed_trip.get("passenger_photo"))
                    self.log_test("Driver Trips - Completed Status Passenger Info", True, 
                                f"Passenger info included for completed trip: name='{passenger_name}', rating={passenger_rating}, photo={has_photo}")
                else:
                    missing_fields = [field for field in passenger_info_fields if field not in completed_trip]
                    self.log_test("Driver Trips - Completed Status Passenger Info", False, 
                                f"Missing passenger info fields for completed trip: {missing_fields}")
            else:
                self.log_test("Driver Trips - Completed Status Passenger Info", False, 
                            "Completed trip not found or status incorrect")
        else:
            self.log_test("Driver Trips - Completed Status Passenger Info", False, 
                        "Failed to get driver trips")
        
        # Overall test result
        passed_tests = sum(1 for result in self.test_results[-3:] if result["success"])
        if passed_tests == 3:
            self.log_test("Driver Trips My - Passenger Info All Statuses", True, 
                        f"Passenger information visible throughout entire trip lifecycle ({passed_tests}/3 status tests passed)")
        else:
            self.log_test("Driver Trips My - Passenger Info All Statuses", False, 
                        f"Passenger information not consistently visible ({passed_tests}/3 status tests passed)")

    def test_driver_available_trips_vs_my_trips_consistency(self):
        """Test 2: Verify passenger info consistency between available trips and my trips"""
        
        if "driver" not in self.tokens or "passenger" not in self.tokens:
            self.log_test("Driver Available vs My Trips Consistency", False, "Missing driver or passenger tokens")
            return
            
        print("🔄 Testing consistency between available trips and my trips...")
        
        # Step 1: Passenger requests a trip
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
        
        success, trip_response, _ = self.make_request("POST", "/trips/request", 
                                                    trip_data, auth_token=self.tokens["passenger"])
        
        if not success:
            self.log_test("Driver Available vs My Trips Consistency", False, "Failed to request trip")
            return
            
        trip_id = trip_response["id"]
        
        # Step 2: Check passenger info in available trips
        success, available_trips, _ = self.make_request("GET", "/trips/available", 
                                                      auth_token=self.tokens["driver"])
        
        available_trip_passenger_info = None
        if success and available_trips:
            test_trip = next((t for t in available_trips if t.get("id") == trip_id), None)
            if test_trip:
                available_trip_passenger_info = {
                    "passenger_name": test_trip.get("passenger_name"),
                    "passenger_rating": test_trip.get("passenger_rating"),
                    "passenger_photo": test_trip.get("passenger_photo")
                }
        
        # Step 3: Driver accepts the trip
        success, _, _ = self.make_request("PUT", f"/trips/{trip_id}/accept", 
                                        auth_token=self.tokens["driver"])
        
        if not success:
            self.log_test("Driver Available vs My Trips Consistency", False, "Failed to accept trip")
            return
        
        # Step 4: Check passenger info in my trips
        success, my_trips, _ = self.make_request("GET", "/trips/my", 
                                               auth_token=self.tokens["driver"])
        
        my_trip_passenger_info = None
        if success and my_trips:
            test_trip = next((t for t in my_trips if t.get("id") == trip_id), None)
            if test_trip:
                my_trip_passenger_info = {
                    "passenger_name": test_trip.get("passenger_name"),
                    "passenger_rating": test_trip.get("passenger_rating"),
                    "passenger_photo": test_trip.get("passenger_photo")
                }
        
        # Compare the passenger info
        if available_trip_passenger_info and my_trip_passenger_info:
            if available_trip_passenger_info == my_trip_passenger_info:
                self.log_test("Driver Available vs My Trips Consistency", True, 
                            "Passenger information consistent between available trips and my trips")
            else:
                self.log_test("Driver Available vs My Trips Consistency", False, 
                            f"Passenger info inconsistent - Available: {available_trip_passenger_info}, My: {my_trip_passenger_info}")
        else:
            self.log_test("Driver Available vs My Trips Consistency", False, 
                        f"Missing passenger info - Available: {available_trip_passenger_info}, My: {my_trip_passenger_info}")

    def test_multiple_trips_passenger_info_isolation(self):
        """Test 3: Verify passenger info is correctly isolated for multiple trips"""
        
        if "driver" not in self.tokens or "passenger" not in self.tokens:
            self.log_test("Multiple Trips Passenger Info Isolation", False, "Missing driver or passenger tokens")
            return
            
        print("🔢 Testing passenger info isolation across multiple trips...")
        
        # Create multiple trips
        trip_ids = []
        for i in range(2):
            trip_data = {
                "passenger_id": self.users.get("passenger", {}).get("id", ""),
                "pickup_latitude": -15.7633 + (i * 0.01),
                "pickup_longitude": -47.8719 + (i * 0.01),
                "pickup_address": f"Test Location {i+1}, Brasília - DF",
                "destination_latitude": -15.8267 + (i * 0.01),
                "destination_longitude": -47.8978 + (i * 0.01),
                "destination_address": f"Test Destination {i+1}, Brasília - DF",
                "estimated_price": 10.00 + (i * 2)
            }
            
            success, trip_response, _ = self.make_request("POST", "/trips/request", 
                                                        trip_data, auth_token=self.tokens["passenger"])
            
            if success:
                trip_ids.append(trip_response["id"])
                # Accept the trip
                self.make_request("PUT", f"/trips/{trip_response['id']}/accept", 
                                auth_token=self.tokens["driver"])
        
        if len(trip_ids) < 2:
            self.log_test("Multiple Trips Passenger Info Isolation", False, "Failed to create multiple trips")
            return
        
        # Check driver's trips
        success, driver_trips, _ = self.make_request("GET", "/trips/my", 
                                                   auth_token=self.tokens["driver"])
        
        if success and driver_trips:
            # Find our test trips
            test_trips = [t for t in driver_trips if t.get("id") in trip_ids]
            
            if len(test_trips) >= 2:
                # Verify all trips have passenger info and it's the same passenger
                passenger_names = [t.get("passenger_name") for t in test_trips]
                passenger_ratings = [t.get("passenger_rating") for t in test_trips]
                
                if all(name == passenger_names[0] for name in passenger_names) and \
                   all(rating == passenger_ratings[0] for rating in passenger_ratings):
                    self.log_test("Multiple Trips Passenger Info Isolation", True, 
                                f"Passenger info correctly maintained across {len(test_trips)} trips")
                else:
                    self.log_test("Multiple Trips Passenger Info Isolation", False, 
                                f"Passenger info inconsistent across trips: names={passenger_names}, ratings={passenger_ratings}")
            else:
                self.log_test("Multiple Trips Passenger Info Isolation", False, 
                            f"Expected 2 test trips, found {len(test_trips)}")
        else:
            self.log_test("Multiple Trips Passenger Info Isolation", False, "Failed to get driver trips")

    def run_focused_tests(self):
        """Run focused tests for driver trip passenger information"""
        print("=" * 80)
        print("🚗 TESTING DRIVER TRIP PASSENGER INFORMATION - REVIEW REQUEST")
        print("=" * 80)
        print()
        
        # Setup
        if not self.setup_users():
            print("❌ Failed to setup test users. Aborting tests.")
            return
        
        print()
        print("🧪 Running focused tests...")
        print()
        
        # Run the focused tests
        self.test_driver_trips_my_includes_passenger_info_all_statuses()
        self.test_driver_available_trips_vs_my_trips_consistency()
        self.test_multiple_trips_passenger_info_isolation()
        
        # Summary
        print("=" * 80)
        print("📊 FOCUSED TEST SUMMARY")
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
    tester = DriverTripPassengerInfoTester()
    tester.run_focused_tests()