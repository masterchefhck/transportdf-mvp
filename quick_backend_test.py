#!/usr/bin/env python3
"""
Quick Backend Validation Test for TransportDF MVP
Focus on authentication, trip endpoints, and rating system after bug fix
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://transport-df.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class QuickBackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = HEADERS.copy()
        self.tokens = {}
        self.users = {}
        self.trips = {}
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    Details: {details}")
        print()

    def make_request(self, method: str, endpoint: str, data: dict = None, auth_token: str = None) -> tuple:
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

    def test_health_check(self):
        """Test 1: Health Check"""
        success, data, status_code = self.make_request("GET", "/health")
        
        if success and data.get("status") == "healthy":
            self.log_test("Health Check", True, f"Backend is healthy (status: {status_code})")
        else:
            self.log_test("Health Check", False, f"Health check failed (status: {status_code})")

    def test_authentication_flow(self):
        """Test 2-4: Complete Authentication Flow"""
        
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
            },
            {
                "name": "Ana Paula Administradora",
                "email": "admin@transportdf.com",
                "phone": "(61) 97777-9999",
                "cpf": "111.222.333-44",
                "user_type": "admin", 
                "password": "admin789"
            }
        ]
        
        # Test Registration
        for user_data in test_users:
            success, data, status_code = self.make_request("POST", "/auth/register", user_data)
            
            if success and "access_token" in data and "user" in data:
                user_type = user_data["user_type"]
                self.tokens[user_type] = data["access_token"]
                self.users[user_type] = data["user"]
                self.log_test(f"Register {user_type.title()}", True, 
                            f"User registered successfully with token")
            else:
                # Try login instead (user might already exist)
                login_success, login_data, login_status = self.make_request("POST", "/auth/login", 
                                                         {"email": user_data["email"], "password": user_data["password"]})
                
                if login_success and "access_token" in login_data:
                    user_type = user_data["user_type"]
                    self.tokens[user_type] = login_data["access_token"]
                    self.users[user_type] = login_data["user"]
                    self.log_test(f"Register/Login {user_type.title()}", True, 
                                f"User authenticated successfully (existing user)")
                else:
                    self.log_test(f"Register {user_data['user_type'].title()}", False, 
                                f"Registration and login failed (status: {status_code})")

        # Test JWT Validation
        if "passenger" in self.tokens:
            success, data, status_code = self.make_request("GET", "/users/me", 
                                                         auth_token=self.tokens["passenger"])
            
            if success and "id" in data and "email" in data:
                self.log_test("JWT Validation", True, "Token validation successful, user data retrieved")
            else:
                self.log_test("JWT Validation", False, f"Token validation failed (status: {status_code})")

    def test_basic_trip_flow(self):
        """Test 5-8: Basic Trip Flow"""
        
        if "passenger" not in self.tokens or "driver" not in self.tokens:
            self.log_test("Trip Flow", False, "Missing passenger or driver tokens")
            return
            
        # 1. Request Trip
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
        
        success, data, status_code = self.make_request("POST", "/trips/request", 
                                                     trip_data, auth_token=self.tokens["passenger"])
        
        if success and "id" in data and data.get("status") == "requested":
            self.trips["current"] = data
            self.log_test("Trip Request", True, f"Trip requested successfully (ID: {data['id'][:8]}...)")
        else:
            self.log_test("Trip Request", False, f"Trip request failed (status: {status_code})")
            return
            
        # 2. Driver sees available trips
        success, data, status_code = self.make_request("GET", "/trips/available", 
                                                     auth_token=self.tokens["driver"])
        
        if success and isinstance(data, list):
            trip_count = len(data)
            self.log_test("Available Trips List", True, f"Retrieved {trip_count} available trips")
        else:
            self.log_test("Available Trips List", False, f"Failed to get available trips (status: {status_code})")
            
        # 3. Driver accepts trip
        trip_id = self.trips["current"]["id"]
        success, data, status_code = self.make_request("PUT", f"/trips/{trip_id}/accept", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "accepted" in data.get("message", "").lower():
            self.log_test("Trip Acceptance", True, "Trip accepted by driver successfully")
        else:
            self.log_test("Trip Acceptance", False, f"Trip acceptance failed (status: {status_code})")
            return
            
        # 4. Driver starts trip
        success, data, status_code = self.make_request("PUT", f"/trips/{trip_id}/start", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "started" in data.get("message", "").lower():
            self.log_test("Trip Start", True, "Trip started successfully")
        else:
            self.log_test("Trip Start", False, f"Trip start failed (status: {status_code})")
            
        # 5. Driver completes trip
        success, data, status_code = self.make_request("PUT", f"/trips/{trip_id}/complete", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "completed" in data.get("message", "").lower():
            self.log_test("Trip Completion", True, "Trip completed successfully")
        else:
            self.log_test("Trip Completion", False, f"Trip completion failed (status: {status_code})")

    def test_rating_system_sanity_check(self):
        """Test 9-11: Rating System Sanity Check"""
        
        if "passenger" not in self.tokens or "current" not in self.trips:
            self.log_test("Rating System", False, "No passenger token or completed trip available")
            return
            
        # 1. Create 5-star rating (no reason required)
        driver_id = self.users.get("driver", {}).get("id", "")
        trip_id = self.trips["current"]["id"]
        
        rating_data = {
            "trip_id": trip_id,
            "rated_user_id": driver_id,
            "rating": 5
        }
        
        success, data, status_code = self.make_request("POST", "/ratings/create", 
                                                     rating_data, auth_token=self.tokens["passenger"])
        
        if success and "rating_id" in data:
            self.log_test("Rating Creation (5 stars)", True, "5-star rating created successfully")
        else:
            self.log_test("Rating Creation (5 stars)", False, f"5-star rating creation failed (status: {status_code})")
            
        # 2. Test duplicate prevention
        success, data, status_code = self.make_request("POST", "/ratings/create", 
                                                     rating_data, auth_token=self.tokens["passenger"])
        
        if not success and status_code == 400 and "already exists" in str(data).lower():
            self.log_test("Rating Duplicate Prevention", True, "Duplicate rating correctly prevented")
        else:
            self.log_test("Rating Duplicate Prevention", False, f"Duplicate rating not prevented (status: {status_code})")
            
        # 3. Check user rating calculation
        success, data, status_code = self.make_request("GET", "/users/rating", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "rating" in data:
            rating = data["rating"]
            if 1.0 <= rating <= 5.0:
                self.log_test("User Rating Calculation", True, f"Driver rating calculated: {rating}")
            else:
                self.log_test("User Rating Calculation", False, f"Invalid rating value: {rating}")
        else:
            self.log_test("User Rating Calculation", False, f"Failed to get user rating (status: {status_code})")

    def test_admin_endpoints_sanity_check(self):
        """Test 12-13: Admin Endpoints Sanity Check"""
        
        if "admin" not in self.tokens:
            self.log_test("Admin Endpoints", False, "No admin token available")
            return
            
        # 1. Admin Statistics
        success, data, status_code = self.make_request("GET", "/admin/stats", 
                                                     auth_token=self.tokens["admin"])
        
        if success and "total_users" in data and "total_trips" in data:
            stats = f"Users: {data['total_users']}, Trips: {data['total_trips']}, Completion Rate: {data.get('completion_rate', 0)}%"
            self.log_test("Admin Statistics", True, f"Statistics retrieved successfully - {stats}")
        else:
            self.log_test("Admin Statistics", False, f"Failed to get statistics (status: {status_code})")
            
        # 2. Admin Users List
        success, data, status_code = self.make_request("GET", "/admin/users", 
                                                     auth_token=self.tokens["admin"])
        
        if success and isinstance(data, list):
            user_count = len(data)
            self.log_test("Admin Users List", True, f"Retrieved {user_count} users")
        else:
            self.log_test("Admin Users List", False, f"Failed to get users list (status: {status_code})")

    def run_all_tests(self):
        """Run all validation tests"""
        print("=" * 80)
        print("🚀 QUICK BACKEND VALIDATION TEST - POST BUG FIX")
        print("=" * 80)
        print()
        
        self.test_health_check()
        self.test_authentication_flow()
        self.test_basic_trip_flow()
        self.test_rating_system_sanity_check()
        self.test_admin_endpoints_sanity_check()
        
        # Summary
        print("=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {total - passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        print()
        
        if total - passed > 0:
            print("❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        else:
            print("🎉 ALL TESTS PASSED!")
        
        print("=" * 80)
        
        return success_rate >= 90  # Consider successful if 90%+ pass rate

if __name__ == "__main__":
    tester = QuickBackendTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)