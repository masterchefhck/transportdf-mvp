#!/usr/bin/env python3
"""
Comprehensive Backend Testing for TransportDF MVP
Tests all backend APIs including authentication, user management, trips, and admin functions
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://brasilia-rides.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class TransportDFTester:
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

    def test_health_check(self):
        """Test 1: Health Check"""
        success, data, status_code = self.make_request("GET", "/health")
        
        if success and data.get("status") == "healthy":
            self.log_test("Health Check", True, f"Backend is healthy (status: {status_code})")
        else:
            self.log_test("Health Check", False, f"Health check failed (status: {status_code})", data)

    def test_user_registration(self):
        """Test 2: User Registration for all user types"""
        
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
        
        for user_data in test_users:
            success, data, status_code = self.make_request("POST", "/auth/register", user_data)
            
            if success and "access_token" in data and "user" in data:
                user_type = user_data["user_type"]
                self.tokens[user_type] = data["access_token"]
                self.users[user_type] = data["user"]
                self.log_test(f"Register {user_type.title()}", True, 
                            f"User registered successfully with token")
            else:
                self.log_test(f"Register {user_data['user_type'].title()}", False, 
                            f"Registration failed (status: {status_code})", data)

    def test_user_login(self):
        """Test 3: User Login for all user types"""
        
        login_data = [
            {"email": "maria.santos@email.com", "password": "senha123", "type": "passenger"},
            {"email": "joao.motorista@email.com", "password": "motorista456", "type": "driver"},
            {"email": "admin@transportdf.com", "password": "admin789", "type": "admin"}
        ]
        
        for login in login_data:
            success, data, status_code = self.make_request("POST", "/auth/login", 
                                                         {"email": login["email"], "password": login["password"]})
            
            if success and "access_token" in data:
                # Update token (in case registration failed but login works)
                self.tokens[login["type"]] = data["access_token"]
                if "user" in data:
                    self.users[login["type"]] = data["user"]
                self.log_test(f"Login {login['type'].title()}", True, 
                            f"Login successful with valid token")
            else:
                self.log_test(f"Login {login['type'].title()}", False, 
                            f"Login failed (status: {status_code})", data)

    def test_jwt_validation(self):
        """Test 4: JWT Token Validation"""
        
        if "passenger" not in self.tokens:
            self.log_test("JWT Validation", False, "No passenger token available for testing")
            return
            
        success, data, status_code = self.make_request("GET", "/users/me", 
                                                     auth_token=self.tokens["passenger"])
        
        if success and "id" in data and "email" in data:
            self.log_test("JWT Validation", True, "Token validation successful, user data retrieved")
        else:
            self.log_test("JWT Validation", False, f"Token validation failed (status: {status_code})", data)

    def test_location_update(self):
        """Test 5: Location Update"""
        
        if "driver" not in self.tokens:
            self.log_test("Location Update", False, "No driver token available for testing")
            return
            
        # Brasília coordinates (Plano Piloto)
        location_data = {
            "latitude": -15.7942,
            "longitude": -47.8822
        }
        
        success, data, status_code = self.make_request("PUT", "/users/location", 
                                                     location_data, auth_token=self.tokens["driver"])
        
        if success and data.get("message"):
            self.log_test("Location Update", True, "Driver location updated successfully")
        else:
            self.log_test("Location Update", False, f"Location update failed (status: {status_code})", data)

    def test_driver_status_change(self):
        """Test 6: Driver Status Management"""
        
        if "driver" not in self.tokens:
            self.log_test("Driver Status Change", False, "No driver token available for testing")
            return
            
        # Test changing to online
        success, data, status_code = self.make_request("PUT", "/drivers/status/online", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "status updated" in data.get("message", "").lower():
            self.log_test("Driver Status - Online", True, "Driver status changed to online")
            
            # Test changing to offline
            success2, data2, status_code2 = self.make_request("PUT", "/drivers/status/offline", 
                                                            auth_token=self.tokens["driver"])
            
            if success2 and "status updated" in data2.get("message", "").lower():
                self.log_test("Driver Status - Offline", True, "Driver status changed to offline")
            else:
                self.log_test("Driver Status - Offline", False, f"Failed to change to offline (status: {status_code2})", data2)
        else:
            self.log_test("Driver Status - Online", False, f"Failed to change to online (status: {status_code})", data)

    def test_trip_request(self):
        """Test 7: Trip Request by Passenger"""
        
        if "passenger" not in self.tokens:
            self.log_test("Trip Request", False, "No passenger token available for testing")
            return
            
        # Realistic Brasília trip: Asa Norte to Asa Sul
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
            self.log_test("Trip Request", False, f"Trip request failed (status: {status_code})", data)

    def test_available_trips_for_driver(self):
        """Test 8: Available Trips List for Driver"""
        
        if "driver" not in self.tokens:
            self.log_test("Available Trips List", False, "No driver token available for testing")
            return
            
        success, data, status_code = self.make_request("GET", "/trips/available", 
                                                     auth_token=self.tokens["driver"])
        
        if success and isinstance(data, list):
            trip_count = len(data)
            self.log_test("Available Trips List", True, f"Retrieved {trip_count} available trips")
        else:
            self.log_test("Available Trips List", False, f"Failed to get available trips (status: {status_code})", data)

    def test_trip_acceptance(self):
        """Test 9: Trip Acceptance by Driver"""
        
        if "driver" not in self.tokens or "current" not in self.trips:
            self.log_test("Trip Acceptance", False, "No driver token or trip available for testing")
            return
            
        trip_id = self.trips["current"]["id"]
        success, data, status_code = self.make_request("PUT", f"/trips/{trip_id}/accept", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "accepted" in data.get("message", "").lower():
            self.log_test("Trip Acceptance", True, "Trip accepted by driver successfully")
        else:
            self.log_test("Trip Acceptance", False, f"Trip acceptance failed (status: {status_code})", data)

    def test_trip_start(self):
        """Test 10: Trip Start"""
        
        if "driver" not in self.tokens or "current" not in self.trips:
            self.log_test("Trip Start", False, "No driver token or trip available for testing")
            return
            
        trip_id = self.trips["current"]["id"]
        success, data, status_code = self.make_request("PUT", f"/trips/{trip_id}/start", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "started" in data.get("message", "").lower():
            self.log_test("Trip Start", True, "Trip started successfully")
        else:
            self.log_test("Trip Start", False, f"Trip start failed (status: {status_code})", data)

    def test_trip_completion(self):
        """Test 11: Trip Completion"""
        
        if "driver" not in self.tokens or "current" not in self.trips:
            self.log_test("Trip Completion", False, "No driver token or trip available for testing")
            return
            
        trip_id = self.trips["current"]["id"]
        success, data, status_code = self.make_request("PUT", f"/trips/{trip_id}/complete", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "completed" in data.get("message", "").lower():
            self.log_test("Trip Completion", True, "Trip completed successfully")
        else:
            self.log_test("Trip Completion", False, f"Trip completion failed (status: {status_code})", data)

    def test_trip_history(self):
        """Test 12: Trip History"""
        
        # Test passenger trip history
        if "passenger" in self.tokens:
            success, data, status_code = self.make_request("GET", "/trips/my", 
                                                         auth_token=self.tokens["passenger"])
            
            if success and isinstance(data, list):
                self.log_test("Trip History - Passenger", True, f"Retrieved {len(data)} trips for passenger")
            else:
                self.log_test("Trip History - Passenger", False, f"Failed to get passenger trips (status: {status_code})", data)
        
        # Test driver trip history
        if "driver" in self.tokens:
            success, data, status_code = self.make_request("GET", "/trips/my", 
                                                         auth_token=self.tokens["driver"])
            
            if success and isinstance(data, list):
                self.log_test("Trip History - Driver", True, f"Retrieved {len(data)} trips for driver")
            else:
                self.log_test("Trip History - Driver", False, f"Failed to get driver trips (status: {status_code})", data)

    def test_admin_statistics(self):
        """Test 13: Admin Statistics"""
        
        if "admin" not in self.tokens:
            self.log_test("Admin Statistics", False, "No admin token available for testing")
            return
            
        success, data, status_code = self.make_request("GET", "/admin/stats", 
                                                     auth_token=self.tokens["admin"])
        
        if success and "total_users" in data and "total_trips" in data:
            stats = f"Users: {data['total_users']}, Trips: {data['total_trips']}, Completion Rate: {data.get('completion_rate', 0)}%"
            self.log_test("Admin Statistics", True, f"Statistics retrieved successfully - {stats}")
        else:
            self.log_test("Admin Statistics", False, f"Failed to get statistics (status: {status_code})", data)

    def test_admin_users_list(self):
        """Test 14: Admin Users List"""
        
        if "admin" not in self.tokens:
            self.log_test("Admin Users List", False, "No admin token available for testing")
            return
            
        success, data, status_code = self.make_request("GET", "/admin/users", 
                                                     auth_token=self.tokens["admin"])
        
        if success and isinstance(data, list):
            user_count = len(data)
            self.log_test("Admin Users List", True, f"Retrieved {user_count} users")
        else:
            self.log_test("Admin Users List", False, f"Failed to get users list (status: {status_code})", data)

    def test_admin_trips_list(self):
        """Test 15: Admin Trips List"""
        
        if "admin" not in self.tokens:
            self.log_test("Admin Trips List", False, "No admin token available for testing")
            return
            
        success, data, status_code = self.make_request("GET", "/admin/trips", 
                                                     auth_token=self.tokens["admin"])
        
        if success and isinstance(data, list):
            trip_count = len(data)
            self.log_test("Admin Trips List", True, f"Retrieved {trip_count} trips")
        else:
            self.log_test("Admin Trips List", False, f"Failed to get trips list (status: {status_code})", data)

    def test_rating_5_stars_no_reason(self):
        """Test 16: Create 5-star rating (no reason required)"""
        
        if "passenger" not in self.tokens or "current" not in self.trips:
            self.log_test("Rating 5 Stars", False, "No passenger token or completed trip available")
            return
            
        # Get driver ID from the completed trip
        driver_id = self.users.get("driver", {}).get("id", "")
        trip_id = self.trips["current"]["id"]
        
        rating_data = {
            "trip_id": trip_id,
            "rated_user_id": driver_id,
            "rating": 5
            # No reason field for 5 stars
        }
        
        success, data, status_code = self.make_request("POST", "/ratings/create", 
                                                     rating_data, auth_token=self.tokens["passenger"])
        
        if success and "rating_id" in data:
            self.trips["rating_5_star"] = data
            self.log_test("Rating 5 Stars", True, "5-star rating created successfully without reason")
        else:
            self.log_test("Rating 5 Stars", False, f"5-star rating creation failed (status: {status_code})", data)

    def test_rating_3_stars_with_reason(self):
        """Test 17: Create 3-star rating (reason required)"""
        
        if "passenger" not in self.tokens:
            self.log_test("Rating 3 Stars with Reason", False, "No passenger token available")
            return
            
        # Create another trip for this test
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
            self.log_test("Rating 3 Stars with Reason", False, "Failed to create test trip")
            return
            
        trip_id = trip_response["id"]
        
        # Accept and complete trip
        self.make_request("PUT", f"/trips/{trip_id}/accept", auth_token=self.tokens["driver"])
        self.make_request("PUT", f"/trips/{trip_id}/start", auth_token=self.tokens["driver"])
        self.make_request("PUT", f"/trips/{trip_id}/complete", auth_token=self.tokens["driver"])
        
        # Now create 3-star rating with reason
        driver_id = self.users.get("driver", {}).get("id", "")
        rating_data = {
            "trip_id": trip_id,
            "rated_user_id": driver_id,
            "rating": 3,
            "reason": "Motorista chegou atrasado e dirigiu de forma brusca"
        }
        
        success, data, status_code = self.make_request("POST", "/ratings/create", 
                                                     rating_data, auth_token=self.tokens["passenger"])
        
        if success and "rating_id" in data:
            self.trips["rating_3_star"] = data
            self.log_test("Rating 3 Stars with Reason", True, "3-star rating created successfully with reason")
        else:
            self.log_test("Rating 3 Stars with Reason", False, f"3-star rating creation failed (status: {status_code})", data)

    def test_rating_duplicate_prevention(self):
        """Test 18: Prevent duplicate rating for same trip"""
        
        if "passenger" not in self.tokens or "current" not in self.trips:
            self.log_test("Rating Duplicate Prevention", False, "No passenger token or trip available")
            return
            
        # Try to create another rating for the same trip
        driver_id = self.users.get("driver", {}).get("id", "")
        trip_id = self.trips["current"]["id"]
        
        rating_data = {
            "trip_id": trip_id,
            "rated_user_id": driver_id,
            "rating": 4,
            "reason": "Segunda tentativa de avaliação"
        }
        
        success, data, status_code = self.make_request("POST", "/ratings/create", 
                                                     rating_data, auth_token=self.tokens["passenger"])
        
        # This should fail with 400 status
        if not success and status_code == 400 and "already exists" in str(data).lower():
            self.log_test("Rating Duplicate Prevention", True, "Duplicate rating correctly prevented")
        else:
            self.log_test("Rating Duplicate Prevention", False, f"Duplicate rating not prevented (status: {status_code})", data)

    def test_rating_without_reason_validation(self):
        """Test 19: Require reason for ratings < 5 stars"""
        
        if "passenger" not in self.tokens:
            self.log_test("Rating Reason Validation", False, "No passenger token available")
            return
            
        # Create another trip for this test
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
        
        # Request, accept and complete trip
        success, trip_response, _ = self.make_request("POST", "/trips/request", 
                                                    trip_data, auth_token=self.tokens["passenger"])
        
        if not success:
            self.log_test("Rating Reason Validation", False, "Failed to create test trip")
            return
            
        trip_id = trip_response["id"]
        self.make_request("PUT", f"/trips/{trip_id}/accept", auth_token=self.tokens["driver"])
        self.make_request("PUT", f"/trips/{trip_id}/start", auth_token=self.tokens["driver"])
        self.make_request("PUT", f"/trips/{trip_id}/complete", auth_token=self.tokens["driver"])
        
        # Try to create 2-star rating WITHOUT reason
        driver_id = self.users.get("driver", {}).get("id", "")
        rating_data = {
            "trip_id": trip_id,
            "rated_user_id": driver_id,
            "rating": 2
            # No reason field - this should fail
        }
        
        success, data, status_code = self.make_request("POST", "/ratings/create", 
                                                     rating_data, auth_token=self.tokens["passenger"])
        
        # This should fail with 400 status
        if not success and status_code == 400 and "reason is required" in str(data).lower():
            self.log_test("Rating Reason Validation", True, "Reason requirement correctly enforced for low ratings")
        else:
            self.log_test("Rating Reason Validation", False, f"Reason requirement not enforced (status: {status_code})", data)

    def test_admin_get_low_ratings(self):
        """Test 20: Admin retrieve low ratings (< 5 stars)"""
        
        if "admin" not in self.tokens:
            self.log_test("Admin Get Low Ratings", False, "No admin token available")
            return
            
        success, data, status_code = self.make_request("GET", "/ratings/low", 
                                                     auth_token=self.tokens["admin"])
        
        if success and isinstance(data, list):
            # Should contain at least the 3-star rating we created
            low_ratings = [r for r in data if r.get("rating", 5) < 5]
            self.log_test("Admin Get Low Ratings", True, f"Retrieved {len(low_ratings)} low ratings")
        else:
            self.log_test("Admin Get Low Ratings", False, f"Failed to get low ratings (status: {status_code})", data)

    def test_admin_send_alert(self):
        """Test 21: Admin send alert to driver with low rating"""
        
        if "admin" not in self.tokens:
            self.log_test("Admin Send Alert", False, "No admin token available")
            return
            
        # First get low ratings to find a rating ID
        success, ratings_data, _ = self.make_request("GET", "/ratings/low", 
                                                   auth_token=self.tokens["admin"])
        
        if not success or not ratings_data:
            self.log_test("Admin Send Alert", False, "No low ratings available to send alert")
            return
            
        # Use the first low rating
        rating_id = ratings_data[0]["id"]
        
        alert_data = {
            "rating_id": rating_id,
            "message": "Prezado motorista, recebemos uma avaliação baixa sobre seu atendimento. Por favor, revise suas práticas de direção e atendimento ao cliente para melhorar a experiência dos passageiros."
        }
        
        success, data, status_code = self.make_request("POST", f"/admin/ratings/{rating_id}/alert", 
                                                     alert_data, auth_token=self.tokens["admin"])
        
        if success and "alert sent" in str(data).lower():
            self.log_test("Admin Send Alert", True, "Alert sent to driver successfully")
        else:
            self.log_test("Admin Send Alert", False, f"Failed to send alert (status: {status_code})", data)

    def test_user_rating_calculation(self):
        """Test 22: Verify user rating calculation"""
        
        if "driver" not in self.tokens:
            self.log_test("User Rating Calculation", False, "No driver token available")
            return
            
        success, data, status_code = self.make_request("GET", "/users/rating", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "rating" in data:
            rating = data["rating"]
            # Should be between 1.0 and 5.0
            if 1.0 <= rating <= 5.0:
                self.log_test("User Rating Calculation", True, f"Driver rating calculated: {rating}")
            else:
                self.log_test("User Rating Calculation", False, f"Invalid rating value: {rating}")
        else:
            self.log_test("User Rating Calculation", False, f"Failed to get user rating (status: {status_code})", data)

    def test_user_rating_updated_in_profile(self):
        """Test 23: Verify user rating is updated in user profile"""
        
        if "driver" not in self.tokens:
            self.log_test("User Rating Profile Update", False, "No driver token available")
            return
            
        success, data, status_code = self.make_request("GET", "/users/me", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "rating" in data:
            rating = data["rating"]
            if rating is not None and 1.0 <= rating <= 5.0:
                self.log_test("User Rating Profile Update", True, f"User profile rating updated: {rating}")
            else:
                self.log_test("User Rating Profile Update", False, f"Invalid or missing rating in profile: {rating}")
        else:
            self.log_test("User Rating Profile Update", False, f"Failed to get user profile (status: {status_code})", data)

    def test_driver_alerts_endpoint(self):
        """Test 24: Driver alerts endpoint - NEW ENDPOINT TEST"""
        
        if "driver" not in self.tokens:
            self.log_test("Driver Alerts Endpoint", False, "No driver token available")
            return
            
        success, data, status_code = self.make_request("GET", "/drivers/alerts", 
                                                     auth_token=self.tokens["driver"])
        
        if success and isinstance(data, list):
            self.log_test("Driver Alerts Endpoint", True, f"Driver alerts retrieved successfully - {len(data)} alerts found")
            
            # Verify data structure if alerts exist
            if data:
                alert = data[0]
                required_fields = ["id", "admin_message", "created_at", "rating_stars", "rating_reason", "rating_date"]
                missing_fields = [field for field in required_fields if field not in alert]
                
                if not missing_fields:
                    self.log_test("Driver Alerts Data Structure", True, "All required fields present in alert data")
                else:
                    self.log_test("Driver Alerts Data Structure", False, f"Missing fields: {missing_fields}")
                    
                # Check if alerts are ordered by date (most recent first)
                if len(data) > 1:
                    dates_ordered = all(data[i]["created_at"] >= data[i+1]["created_at"] for i in range(len(data)-1))
                    if dates_ordered:
                        self.log_test("Driver Alerts Ordering", True, "Alerts correctly ordered by date (most recent first)")
                    else:
                        self.log_test("Driver Alerts Ordering", False, "Alerts not properly ordered by date")
            else:
                self.log_test("Driver Alerts Data Structure", True, "No alerts found - endpoint working but no data")
        else:
            self.log_test("Driver Alerts Endpoint", False, f"Failed to get driver alerts (status: {status_code})", data)

    def test_driver_alerts_access_control(self):
        """Test 25: Driver alerts access control - only drivers should access"""
        
        # Test with passenger token (should fail)
        if "passenger" in self.tokens:
            success, data, status_code = self.make_request("GET", "/drivers/alerts", 
                                                         auth_token=self.tokens["passenger"])
            
            if not success and status_code == 403:
                self.log_test("Driver Alerts Access Control - Passenger", True, "Passenger correctly denied access to driver alerts")
            else:
                self.log_test("Driver Alerts Access Control - Passenger", False, f"Passenger should not have access (status: {status_code})", data)
        
        # Test with admin token (should fail)
        if "admin" in self.tokens:
            success, data, status_code = self.make_request("GET", "/drivers/alerts", 
                                                         auth_token=self.tokens["admin"])
            
            if not success and status_code == 403:
                self.log_test("Driver Alerts Access Control - Admin", True, "Admin correctly denied access to driver alerts")
            else:
                self.log_test("Driver Alerts Access Control - Admin", False, f"Admin should not have access (status: {status_code})", data)

    def run_all_tests(self):
        """Run all backend tests in sequence"""
        print("=" * 80)
        print("🚀 STARTING COMPREHENSIVE BACKEND TESTING FOR TRANSPORTDF MVP")
        print("=" * 80)
        print()
        
        # Run tests in logical order
        self.test_health_check()
        self.test_user_registration()
        self.test_user_login()
        self.test_jwt_validation()
        self.test_location_update()
        self.test_driver_status_change()
        self.test_trip_request()
        self.test_available_trips_for_driver()
        self.test_trip_acceptance()
        self.test_trip_start()
        self.test_trip_completion()
        self.test_trip_history()
        self.test_admin_statistics()
        self.test_admin_users_list()
        self.test_admin_trips_list()
        
        # Rating System Tests
        print("\n" + "=" * 50)
        print("🌟 TESTING RATING SYSTEM")
        print("=" * 50)
        self.test_rating_5_stars_no_reason()
        self.test_rating_3_stars_with_reason()
        self.test_rating_duplicate_prevention()
        self.test_rating_without_reason_validation()
        self.test_admin_get_low_ratings()
        self.test_admin_send_alert()
        self.test_user_rating_calculation()
        self.test_user_rating_updated_in_profile()
        
        # Summary
        print("=" * 80)
        print("📊 TEST SUMMARY")
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
    tester = TransportDFTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)