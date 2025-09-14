#!/usr/bin/env python3
"""
Focused Backend Test for TransportDF MVP - Post Bug Fix Validation
Tests core functionality with fresh user data
"""

import requests
import json
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://transport-df.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class FocusedBackendTester:
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
            self.log_test("Health Check", True, f"Backend is healthy")
            return True
        else:
            self.log_test("Health Check", False, f"Health check failed (status: {status_code})")
            return False

    def test_authentication_with_fresh_users(self):
        """Test 2-4: Authentication with fresh user data"""
        
        # Generate unique identifiers to avoid conflicts
        unique_id = str(uuid.uuid4())[:8]
        
        test_users = [
            {
                "name": f"Passenger Test {unique_id}",
                "email": f"passenger.test.{unique_id}@email.com",
                "phone": f"(61) 9999-{unique_id[:4]}",
                "cpf": f"123.456.{unique_id[:3]}-01",
                "user_type": "passenger",
                "password": "testpass123"
            },
            {
                "name": f"Driver Test {unique_id}",
                "email": f"driver.test.{unique_id}@email.com", 
                "phone": f"(61) 8888-{unique_id[:4]}",
                "cpf": f"987.654.{unique_id[:3]}-09",
                "user_type": "driver",
                "password": "testdriver456"
            }
        ]
        
        auth_success = True
        
        for user_data in test_users:
            success, data, status_code = self.make_request("POST", "/auth/register", user_data)
            
            if success and "access_token" in data and "user" in data:
                user_type = user_data["user_type"]
                self.tokens[user_type] = data["access_token"]
                self.users[user_type] = data["user"]
                self.log_test(f"Register {user_type.title()}", True, 
                            f"User registered successfully")
            else:
                self.log_test(f"Register {user_data['user_type'].title()}", False, 
                            f"Registration failed (status: {status_code}): {data}")
                auth_success = False

        # Test JWT Validation
        if "passenger" in self.tokens:
            success, data, status_code = self.make_request("GET", "/users/me", 
                                                         auth_token=self.tokens["passenger"])
            
            if success and "id" in data and "email" in data:
                self.log_test("JWT Validation", True, "Token validation successful")
            else:
                self.log_test("JWT Validation", False, f"Token validation failed (status: {status_code})")
                auth_success = False
        else:
            auth_success = False
            
        return auth_success

    def test_basic_trip_endpoints(self):
        """Test 5-9: Basic Trip Endpoints"""
        
        if "passenger" not in self.tokens or "driver" not in self.tokens:
            self.log_test("Trip Endpoints", False, "Missing authentication tokens")
            return False
            
        trip_success = True
        
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
            self.log_test("Trip Request", True, f"Trip requested successfully")
        else:
            self.log_test("Trip Request", False, f"Trip request failed (status: {status_code})")
            trip_success = False
            return trip_success
            
        # 2. Driver sees available trips
        success, data, status_code = self.make_request("GET", "/trips/available", 
                                                     auth_token=self.tokens["driver"])
        
        if success and isinstance(data, list):
            self.log_test("Available Trips", True, f"Retrieved {len(data)} available trips")
        else:
            self.log_test("Available Trips", False, f"Failed to get available trips (status: {status_code})")
            trip_success = False
            
        # 3. Driver accepts trip
        trip_id = self.trips["current"]["id"]
        success, data, status_code = self.make_request("PUT", f"/trips/{trip_id}/accept", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "accepted" in data.get("message", "").lower():
            self.log_test("Trip Accept", True, "Trip accepted successfully")
        else:
            self.log_test("Trip Accept", False, f"Trip acceptance failed (status: {status_code})")
            trip_success = False
            return trip_success
            
        # 4. Driver starts trip
        success, data, status_code = self.make_request("PUT", f"/trips/{trip_id}/start", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "started" in data.get("message", "").lower():
            self.log_test("Trip Start", True, "Trip started successfully")
        else:
            self.log_test("Trip Start", False, f"Trip start failed (status: {status_code})")
            trip_success = False
            
        # 5. Driver completes trip
        success, data, status_code = self.make_request("PUT", f"/trips/{trip_id}/complete", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "completed" in data.get("message", "").lower():
            self.log_test("Trip Complete", True, "Trip completed successfully")
        else:
            self.log_test("Trip Complete", False, f"Trip completion failed (status: {status_code})")
            trip_success = False
            
        return trip_success

    def test_rating_system_endpoints(self):
        """Test 10-12: Rating System Endpoints"""
        
        if "passenger" not in self.tokens or "current" not in self.trips:
            self.log_test("Rating System", False, "No passenger token or completed trip available")
            return False
            
        rating_success = True
        
        # 1. Create 5-star rating
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
            self.log_test("Rating Creation", True, "5-star rating created successfully")
        else:
            self.log_test("Rating Creation", False, f"Rating creation failed (status: {status_code})")
            rating_success = False
            
        # 2. Test duplicate prevention
        success, data, status_code = self.make_request("POST", "/ratings/create", 
                                                     rating_data, auth_token=self.tokens["passenger"])
        
        if not success and status_code == 400 and "already exists" in str(data).lower():
            self.log_test("Rating Duplicate Prevention", True, "Duplicate rating correctly prevented")
        else:
            self.log_test("Rating Duplicate Prevention", False, f"Duplicate prevention failed (status: {status_code})")
            rating_success = False
            
        # 3. Check user rating calculation
        success, data, status_code = self.make_request("GET", "/users/rating", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "rating" in data:
            rating = data["rating"]
            if 1.0 <= rating <= 5.0:
                self.log_test("Rating Calculation", True, f"Driver rating: {rating}")
            else:
                self.log_test("Rating Calculation", False, f"Invalid rating value: {rating}")
                rating_success = False
        else:
            self.log_test("Rating Calculation", False, f"Failed to get user rating (status: {status_code})")
            rating_success = False
            
        return rating_success

    def test_admin_endpoints(self):
        """Test 13-14: Admin Endpoints (using existing admin)"""
        
        # Try to login with existing admin credentials
        admin_logins = [
            {"email": "admin@transportdf.com", "password": "admin789"},
            {"email": "admin@email.com", "password": "admin123"}
        ]
        
        admin_authenticated = False
        for login_data in admin_logins:
            success, data, status_code = self.make_request("POST", "/auth/login", login_data)
            if success and "access_token" in data:
                self.tokens["admin"] = data["access_token"]
                admin_authenticated = True
                break
        
        if not admin_authenticated:
            self.log_test("Admin Authentication", False, "Could not authenticate admin user")
            return False
            
        admin_success = True
        
        # 1. Admin Statistics
        success, data, status_code = self.make_request("GET", "/admin/stats", 
                                                     auth_token=self.tokens["admin"])
        
        if success and "total_users" in data and "total_trips" in data:
            stats = f"Users: {data['total_users']}, Trips: {data['total_trips']}"
            self.log_test("Admin Statistics", True, f"Statistics retrieved - {stats}")
        else:
            self.log_test("Admin Statistics", False, f"Failed to get statistics (status: {status_code})")
            admin_success = False
            
        # 2. Admin Users List
        success, data, status_code = self.make_request("GET", "/admin/users", 
                                                     auth_token=self.tokens["admin"])
        
        if success and isinstance(data, list):
            self.log_test("Admin Users List", True, f"Retrieved {len(data)} users")
        else:
            self.log_test("Admin Users List", False, f"Failed to get users list (status: {status_code})")
            admin_success = False
            
        return admin_success

    def run_validation_tests(self):
        """Run focused validation tests"""
        print("=" * 80)
        print("🎯 FOCUSED BACKEND VALIDATION - POST BUG FIX")
        print("Focus: Authentication, Trip Flow, Rating System")
        print("=" * 80)
        print()
        
        # Run tests in sequence
        health_ok = self.test_health_check()
        auth_ok = self.test_authentication_with_fresh_users()
        trip_ok = self.test_basic_trip_endpoints()
        rating_ok = self.test_rating_system_endpoints()
        admin_ok = self.test_admin_endpoints()
        
        # Summary
        print("=" * 80)
        print("📊 VALIDATION SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {total - passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        print()
        
        # Component Status
        components = [
            ("Health Check", health_ok),
            ("Authentication", auth_ok),
            ("Trip Endpoints", trip_ok),
            ("Rating System", rating_ok),
            ("Admin Endpoints", admin_ok)
        ]
        
        print("🔍 COMPONENT STATUS:")
        for component, status in components:
            status_icon = "✅" if status else "❌"
            print(f"  {status_icon} {component}")
        print()
        
        if total - passed > 0:
            print("❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("=" * 80)
        
        # Overall assessment
        critical_components_ok = health_ok and auth_ok and trip_ok and rating_ok
        
        if critical_components_ok:
            print("🎉 CRITICAL COMPONENTS WORKING - NO REGRESSIONS DETECTED")
            print("✅ Backend is functioning properly after bug fix")
        else:
            print("⚠️  ISSUES DETECTED - FURTHER INVESTIGATION NEEDED")
            
        return critical_components_ok

if __name__ == "__main__":
    tester = FocusedBackendTester()
    success = tester.run_validation_tests()
    exit(0 if success else 1)