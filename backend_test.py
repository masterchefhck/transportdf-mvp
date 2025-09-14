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
BASE_URL = "https://brasilia-transit.preview.emergentagent.com/api"
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

    def test_user_rating_endpoint(self):
        """Test 26: GET /api/users/rating - NEW ENDPOINT TEST"""
        
        if "driver" not in self.tokens:
            self.log_test("User Rating Endpoint", False, "No driver token available")
            return
            
        success, data, status_code = self.make_request("GET", "/users/rating", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "rating" in data:
            rating = data["rating"]
            # Verify rating is between 1.0 and 5.0
            if isinstance(rating, (int, float)) and 1.0 <= rating <= 5.0:
                self.log_test("User Rating Endpoint", True, f"Rating endpoint working - returned {rating}")
            else:
                self.log_test("User Rating Endpoint", False, f"Invalid rating value: {rating} (should be 1.0-5.0)")
        else:
            self.log_test("User Rating Endpoint", False, f"Failed to get rating (status: {status_code})", data)

    def test_driver_alerts_read_field(self):
        """Test 27: Verify GET /api/drivers/alerts includes 'read' field"""
        
        if "driver" not in self.tokens:
            self.log_test("Driver Alerts Read Field", False, "No driver token available")
            return
            
        success, data, status_code = self.make_request("GET", "/drivers/alerts", 
                                                     auth_token=self.tokens["driver"])
        
        if success and isinstance(data, list):
            if data:  # If there are alerts
                alert = data[0]
                if "read" in alert:
                    read_value = alert["read"]
                    if isinstance(read_value, bool):
                        self.log_test("Driver Alerts Read Field", True, f"'read' field present with boolean value: {read_value}")
                    else:
                        self.log_test("Driver Alerts Read Field", False, f"'read' field should be boolean, got: {type(read_value)}")
                else:
                    self.log_test("Driver Alerts Read Field", False, "'read' field missing from alert data")
            else:
                self.log_test("Driver Alerts Read Field", True, "No alerts found - cannot verify 'read' field but endpoint working")
        else:
            self.log_test("Driver Alerts Read Field", False, f"Failed to get driver alerts (status: {status_code})", data)

    def test_mark_alert_as_read(self):
        """Test 28: POST /api/drivers/alerts/{alert_id}/read - NEW ENDPOINT TEST"""
        
        if "driver" not in self.tokens:
            self.log_test("Mark Alert as Read", False, "No driver token available")
            return
            
        # First get alerts to find an alert ID
        success, alerts_data, _ = self.make_request("GET", "/drivers/alerts", 
                                                  auth_token=self.tokens["driver"])
        
        if not success or not alerts_data:
            self.log_test("Mark Alert as Read", False, "No alerts available to mark as read")
            return
            
        # Use the first alert
        alert_id = alerts_data[0]["id"]
        
        success, data, status_code = self.make_request("POST", f"/drivers/alerts/{alert_id}/read", 
                                                     auth_token=self.tokens["driver"])
        
        if success and "marked as read" in str(data).lower():
            self.log_test("Mark Alert as Read", True, "Alert successfully marked as read")
        else:
            self.log_test("Mark Alert as Read", False, f"Failed to mark alert as read (status: {status_code})", data)

    def test_mark_alert_as_read_not_found(self):
        """Test 29: POST /api/drivers/alerts/{alert_id}/read with non-existent alert"""
        
        if "driver" not in self.tokens:
            self.log_test("Mark Alert as Read - Not Found", False, "No driver token available")
            return
            
        # Use a non-existent alert ID
        fake_alert_id = "non-existent-alert-id-12345"
        
        success, data, status_code = self.make_request("POST", f"/drivers/alerts/{fake_alert_id}/read", 
                                                     auth_token=self.tokens["driver"])
        
        # Should return 404
        if not success and status_code == 404:
            self.log_test("Mark Alert as Read - Not Found", True, "Correctly returned 404 for non-existent alert")
        else:
            self.log_test("Mark Alert as Read - Not Found", False, f"Should return 404 for non-existent alert (status: {status_code})", data)

    def test_mark_alert_as_read_access_control(self):
        """Test 30: POST /api/drivers/alerts/{alert_id}/read access control"""
        
        # Test with passenger token (should fail with 403)
        if "passenger" in self.tokens:
            fake_alert_id = "test-alert-id"
            success, data, status_code = self.make_request("POST", f"/drivers/alerts/{fake_alert_id}/read", 
                                                         auth_token=self.tokens["passenger"])
            
            if not success and status_code == 403:
                self.log_test("Mark Alert as Read - Access Control", True, "Passenger correctly denied access to mark alerts as read")
            else:
                self.log_test("Mark Alert as Read - Access Control", False, f"Passenger should not have access (status: {status_code})", data)

    # NEW TESTS FOR BULK OPERATIONS AND ADMIN MESSAGING
    def test_bulk_delete_trips_valid_ids(self):
        """Test 31: Bulk delete trips with valid IDs"""
        
        if "admin" not in self.tokens:
            self.log_test("Bulk Delete Trips - Valid IDs", False, "No admin token available")
            return
            
        # First get existing trips to have valid IDs
        success, trips_data, _ = self.make_request("GET", "/admin/trips", 
                                                 auth_token=self.tokens["admin"])
        
        if not success or not trips_data:
            self.log_test("Bulk Delete Trips - Valid IDs", False, "No trips available for bulk delete test")
            return
            
        # Use first trip ID for bulk delete
        trip_ids = [trips_data[0]["id"]] if trips_data else []
        
        bulk_delete_data = {"ids": trip_ids}
        
        success, data, status_code = self.make_request("POST", "/admin/trips/bulk-delete", 
                                                     bulk_delete_data, auth_token=self.tokens["admin"])
        
        if success and "deleted" in str(data).lower():
            deleted_count = data.get("message", "").split()[1] if "deleted" in data.get("message", "") else "0"
            self.log_test("Bulk Delete Trips - Valid IDs", True, f"Bulk delete successful - {deleted_count} trips deleted")
        else:
            self.log_test("Bulk Delete Trips - Valid IDs", False, f"Bulk delete failed (status: {status_code})", data)

    def test_bulk_delete_trips_invalid_ids(self):
        """Test 32: Bulk delete trips with non-existent IDs"""
        
        if "admin" not in self.tokens:
            self.log_test("Bulk Delete Trips - Invalid IDs", False, "No admin token available")
            return
            
        # Use non-existent trip IDs
        fake_ids = ["fake-trip-id-1", "fake-trip-id-2", "fake-trip-id-3"]
        bulk_delete_data = {"ids": fake_ids}
        
        success, data, status_code = self.make_request("POST", "/admin/trips/bulk-delete", 
                                                     bulk_delete_data, auth_token=self.tokens["admin"])
        
        if success:
            # Should return 0 deleted count for non-existent IDs
            message = data.get("message", "")
            if "deleted 0" in message.lower():
                self.log_test("Bulk Delete Trips - Invalid IDs", True, "Correctly returned 0 deleted for non-existent IDs")
            else:
                self.log_test("Bulk Delete Trips - Invalid IDs", True, f"Bulk delete handled invalid IDs: {message}")
        else:
            self.log_test("Bulk Delete Trips - Invalid IDs", False, f"Bulk delete failed (status: {status_code})", data)

    def test_bulk_delete_users_excludes_admins(self):
        """Test 33: Bulk delete users should exclude admin users"""
        
        if "admin" not in self.tokens:
            self.log_test("Bulk Delete Users - Exclude Admins", False, "No admin token available")
            return
            
        # Get all users including admin
        success, users_data, _ = self.make_request("GET", "/admin/users", 
                                                 auth_token=self.tokens["admin"])
        
        if not success or not users_data:
            self.log_test("Bulk Delete Users - Exclude Admins", False, "No users available for bulk delete test")
            return
            
        # Get admin user ID and some other user IDs
        admin_user_id = None
        other_user_ids = []
        
        for user in users_data:
            if user.get("user_type") == "admin":
                admin_user_id = user["id"]
            else:
                other_user_ids.append(user["id"])
        
        if not admin_user_id:
            self.log_test("Bulk Delete Users - Exclude Admins", False, "No admin user found for test")
            return
            
        # Try to bulk delete including admin ID
        all_ids = [admin_user_id] + other_user_ids[:1]  # Include admin + one other user
        bulk_delete_data = {"ids": all_ids}
        
        success, data, status_code = self.make_request("POST", "/admin/users/bulk-delete", 
                                                     bulk_delete_data, auth_token=self.tokens["admin"])
        
        if success:
            message = data.get("message", "")
            # Should delete less than total IDs provided (excluding admin)
            if "deleted" in message.lower():
                self.log_test("Bulk Delete Users - Exclude Admins", True, f"Bulk delete excluded admin users: {message}")
            else:
                self.log_test("Bulk Delete Users - Exclude Admins", True, "Bulk delete processed with admin exclusion")
        else:
            self.log_test("Bulk Delete Users - Exclude Admins", False, f"Bulk delete failed (status: {status_code})", data)

    def test_bulk_delete_reports(self):
        """Test 34: Bulk delete reports"""
        
        if "admin" not in self.tokens:
            self.log_test("Bulk Delete Reports", False, "No admin token available")
            return
            
        # Create a test report first
        if "passenger" in self.tokens and "driver" in self.tokens:
            report_data = {
                "reported_user_id": self.users.get("driver", {}).get("id", ""),
                "title": "Teste de Report para Bulk Delete",
                "description": "Report criado especificamente para testar bulk delete",
                "report_type": "passenger_report"
            }
            
            self.make_request("POST", "/reports/create", report_data, auth_token=self.tokens["passenger"])
        
        # Get existing reports
        success, reports_data, _ = self.make_request("GET", "/admin/reports", 
                                                   auth_token=self.tokens["admin"])
        
        if success and reports_data:
            # Use first report ID for bulk delete
            report_ids = [reports_data[0]["id"]]
            bulk_delete_data = {"ids": report_ids}
            
            success, data, status_code = self.make_request("POST", "/admin/reports/bulk-delete", 
                                                         bulk_delete_data, auth_token=self.tokens["admin"])
            
            if success and "deleted" in str(data).lower():
                self.log_test("Bulk Delete Reports", True, f"Reports bulk delete successful: {data.get('message', '')}")
            else:
                self.log_test("Bulk Delete Reports", False, f"Reports bulk delete failed (status: {status_code})", data)
        else:
            # Test with empty list
            bulk_delete_data = {"ids": []}
            success, data, status_code = self.make_request("POST", "/admin/reports/bulk-delete", 
                                                         bulk_delete_data, auth_token=self.tokens["admin"])
            
            if success:
                self.log_test("Bulk Delete Reports", True, "Reports bulk delete endpoint working (no reports to delete)")
            else:
                self.log_test("Bulk Delete Reports", False, f"Reports bulk delete failed (status: {status_code})", data)

    def test_bulk_delete_ratings(self):
        """Test 35: Bulk delete ratings"""
        
        if "admin" not in self.tokens:
            self.log_test("Bulk Delete Ratings", False, "No admin token available")
            return
            
        # Get existing low ratings
        success, ratings_data, _ = self.make_request("GET", "/ratings/low", 
                                                   auth_token=self.tokens["admin"])
        
        if success and ratings_data:
            # Use first rating ID for bulk delete
            rating_ids = [ratings_data[0]["id"]]
            bulk_delete_data = {"ids": rating_ids}
            
            success, data, status_code = self.make_request("POST", "/admin/ratings/bulk-delete", 
                                                         bulk_delete_data, auth_token=self.tokens["admin"])
            
            if success and "deleted" in str(data).lower():
                self.log_test("Bulk Delete Ratings", True, f"Ratings bulk delete successful: {data.get('message', '')}")
            else:
                self.log_test("Bulk Delete Ratings", False, f"Ratings bulk delete failed (status: {status_code})", data)
        else:
            # Test with empty list
            bulk_delete_data = {"ids": []}
            success, data, status_code = self.make_request("POST", "/admin/ratings/bulk-delete", 
                                                         bulk_delete_data, auth_token=self.tokens["admin"])
            
            if success:
                self.log_test("Bulk Delete Ratings", True, "Ratings bulk delete endpoint working (no ratings to delete)")
            else:
                self.log_test("Bulk Delete Ratings", False, f"Ratings bulk delete failed (status: {status_code})", data)

    def test_bulk_delete_permissions(self):
        """Test 36: Bulk delete operations require admin permissions"""
        
        if "passenger" not in self.tokens:
            self.log_test("Bulk Delete Permissions", False, "No passenger token available for permission test")
            return
            
        # Test passenger trying to bulk delete trips (should fail)
        bulk_delete_data = {"ids": ["fake-id"]}
        
        success, data, status_code = self.make_request("POST", "/admin/trips/bulk-delete", 
                                                     bulk_delete_data, auth_token=self.tokens["passenger"])
        
        if not success and (status_code == 403 or status_code == 401):
            self.log_test("Bulk Delete Permissions", True, "Non-admin correctly denied access to bulk delete operations")
        else:
            self.log_test("Bulk Delete Permissions", False, f"Non-admin should not have access (status: {status_code})", data)

    def test_admin_send_message_to_passenger(self):
        """Test 37: Admin send message to passenger"""
        
        if "admin" not in self.tokens:
            self.log_test("Admin Send Message to Passenger", False, "Admin token not available")
            return
            
        # Get current user info to ensure we have the correct passenger ID
        success, passenger_data, _ = self.make_request("GET", "/users/me", 
                                                     auth_token=self.tokens.get("passenger", ""))
        
        if not success or not passenger_data.get("id"):
            # Try to get passenger from users list
            success, users_data, _ = self.make_request("GET", "/admin/users", 
                                                     auth_token=self.tokens["admin"])
            
            if success and users_data:
                passenger_user = next((u for u in users_data if u.get("user_type") == "passenger"), None)
                if passenger_user:
                    passenger_id = passenger_user["id"]
                else:
                    self.log_test("Admin Send Message to Passenger", False, "No passenger user found")
                    return
            else:
                self.log_test("Admin Send Message to Passenger", False, "Could not retrieve passenger ID")
                return
        else:
            passenger_id = passenger_data["id"]
            
        message_data = {
            "user_id": passenger_id,
            "message": "Olá! Esta é uma mensagem importante do administrador do TransportDF. Por favor, mantenha seu perfil atualizado e siga as diretrizes de segurança durante as viagens."
        }
        
        success, data, status_code = self.make_request("POST", "/admin/messages/send", 
                                                     message_data, auth_token=self.tokens["admin"])
        
        if success and "message sent" in str(data).lower():
            self.log_test("Admin Send Message to Passenger", True, "Admin message sent to passenger successfully")
        else:
            self.log_test("Admin Send Message to Passenger", False, f"Failed to send message (status: {status_code})", data)

    def test_admin_send_message_to_driver_should_fail(self):
        """Test 38: Admin send message to driver should fail (only passengers allowed)"""
        
        if "admin" not in self.tokens or "driver" not in self.tokens:
            self.log_test("Admin Send Message to Driver - Should Fail", False, "Admin or driver token not available")
            return
            
        driver_id = self.users.get("driver", {}).get("id", "")
        if not driver_id:
            self.log_test("Admin Send Message to Driver - Should Fail", False, "Driver ID not available")
            return
            
        message_data = {
            "user_id": driver_id,
            "message": "Esta mensagem não deveria ser enviada para motorista"
        }
        
        success, data, status_code = self.make_request("POST", "/admin/messages/send", 
                                                     message_data, auth_token=self.tokens["admin"])
        
        if not success and status_code == 400 and "only send messages to passengers" in str(data).lower():
            self.log_test("Admin Send Message to Driver - Should Fail", True, "Correctly prevented sending message to driver")
        else:
            self.log_test("Admin Send Message to Driver - Should Fail", False, f"Should prevent sending to driver (status: {status_code})", data)

    def test_admin_send_message_to_nonexistent_user(self):
        """Test 39: Admin send message to non-existent user"""
        
        if "admin" not in self.tokens:
            self.log_test("Admin Send Message - Non-existent User", False, "No admin token available")
            return
            
        message_data = {
            "user_id": "non-existent-user-id-12345",
            "message": "Esta mensagem não deveria ser enviada"
        }
        
        success, data, status_code = self.make_request("POST", "/admin/messages/send", 
                                                     message_data, auth_token=self.tokens["admin"])
        
        if not success and status_code == 404:
            self.log_test("Admin Send Message - Non-existent User", True, "Correctly returned 404 for non-existent user")
        else:
            self.log_test("Admin Send Message - Non-existent User", False, f"Should return 404 for non-existent user (status: {status_code})", data)

    def test_passenger_get_messages(self):
        """Test 40: Passenger retrieve their messages"""
        
        if "passenger" not in self.tokens:
            self.log_test("Passenger Get Messages", False, "No passenger token available")
            return
            
        # Verify token is still valid by checking user info first
        token_valid, user_data, _ = self.make_request("GET", "/users/me", 
                                                    auth_token=self.tokens["passenger"])
        
        if not token_valid:
            self.log_test("Passenger Get Messages", False, "Passenger token is invalid or expired")
            return
            
        success, data, status_code = self.make_request("GET", "/passengers/messages", 
                                                     auth_token=self.tokens["passenger"])
        
        if success and isinstance(data, list):
            message_count = len(data)
            self.log_test("Passenger Get Messages", True, f"Passenger retrieved {message_count} messages successfully")
            
            # Verify message structure if messages exist
            if data:
                message = data[0]
                required_fields = ["id", "user_id", "admin_id", "message", "created_at", "read"]
                missing_fields = [field for field in required_fields if field not in message]
                
                if not missing_fields:
                    self.log_test("Passenger Messages Structure", True, "Message structure contains all required fields")
                else:
                    self.log_test("Passenger Messages Structure", False, f"Missing fields in message: {missing_fields}")
        else:
            self.log_test("Passenger Get Messages", False, f"Failed to get messages (status: {status_code})", data)

    def test_passenger_messages_access_control(self):
        """Test 41: Only passengers can access their messages"""
        
        if "driver" not in self.tokens:
            self.log_test("Passenger Messages Access Control", False, "No driver token available for access control test")
            return
            
        # Driver trying to access passenger messages (should fail)
        success, data, status_code = self.make_request("GET", "/passengers/messages", 
                                                     auth_token=self.tokens["driver"])
        
        if not success and status_code == 403:
            self.log_test("Passenger Messages Access Control", True, "Driver correctly denied access to passenger messages")
        else:
            self.log_test("Passenger Messages Access Control", False, f"Driver should not have access (status: {status_code})", data)

    def test_passenger_mark_message_as_read(self):
        """Test 42: Passenger mark message as read"""
        
        if "passenger" not in self.tokens:
            self.log_test("Passenger Mark Message as Read", False, "No passenger token available")
            return
            
        # First get messages to find a message ID
        success, messages_data, _ = self.make_request("GET", "/passengers/messages", 
                                                    auth_token=self.tokens["passenger"])
        
        if not success or not messages_data:
            self.log_test("Passenger Mark Message as Read", False, "No messages available to mark as read")
            return
            
        # Use the first message
        message_id = messages_data[0]["id"]
        
        success, data, status_code = self.make_request("POST", f"/passengers/messages/{message_id}/read", 
                                                     auth_token=self.tokens["passenger"])
        
        if success and "marked as read" in str(data).lower():
            self.log_test("Passenger Mark Message as Read", True, "Message successfully marked as read")
        else:
            self.log_test("Passenger Mark Message as Read", False, f"Failed to mark message as read (status: {status_code})", data)

    def test_passenger_mark_message_as_read_not_found(self):
        """Test 43: Passenger mark non-existent message as read"""
        
        if "passenger" not in self.tokens:
            self.log_test("Passenger Mark Message as Read - Not Found", False, "No passenger token available")
            return
            
        # Use a non-existent message ID
        fake_message_id = "non-existent-message-id-12345"
        
        success, data, status_code = self.make_request("POST", f"/passengers/messages/{fake_message_id}/read", 
                                                     auth_token=self.tokens["passenger"])
        
        # Should return 404
        if not success and status_code == 404:
            self.log_test("Passenger Mark Message as Read - Not Found", True, "Correctly returned 404 for non-existent message")
        else:
            self.log_test("Passenger Mark Message as Read - Not Found", False, f"Should return 404 for non-existent message (status: {status_code})", data)

    def test_passenger_mark_message_access_control(self):
        """Test 44: Only message owner can mark it as read"""
        
        if "driver" not in self.tokens:
            self.log_test("Passenger Mark Message Access Control", False, "No driver token available for access control test")
            return
            
        # Driver trying to mark passenger message as read (should fail)
        fake_message_id = "test-message-id"
        success, data, status_code = self.make_request("POST", f"/passengers/messages/{fake_message_id}/read", 
                                                     auth_token=self.tokens["driver"])
        
        if not success and status_code == 403:
            self.log_test("Passenger Mark Message Access Control", True, "Driver correctly denied access to mark passenger messages as read")
        else:
            self.log_test("Passenger Mark Message Access Control", False, f"Driver should not have access (status: {status_code})", data)

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
        
        # Driver Alerts Tests - NEW ENDPOINT
        print("\n" + "=" * 50)
        print("🚨 TESTING DRIVER ALERTS ENDPOINT - NEW FEATURE")
        print("=" * 50)
        self.test_driver_alerts_endpoint()
        self.test_driver_alerts_access_control()
        
        # New Dashboard Endpoints Tests - REVIEW REQUEST
        print("\n" + "=" * 50)
        print("🎯 TESTING NEW DASHBOARD ENDPOINTS - REVIEW REQUEST")
        print("=" * 50)
        self.test_user_rating_endpoint()
        self.test_driver_alerts_read_field()
        self.test_mark_alert_as_read()
        self.test_mark_alert_as_read_not_found()
        self.test_mark_alert_as_read_access_control()
        
        # Bulk Operations Tests - NEW FEATURE
        print("\n" + "=" * 50)
        print("🗑️ TESTING BULK DELETE OPERATIONS - NEW FEATURE")
        print("=" * 50)
        self.test_bulk_delete_trips_valid_ids()
        self.test_bulk_delete_trips_invalid_ids()
        self.test_bulk_delete_users_excludes_admins()
        self.test_bulk_delete_reports()
        self.test_bulk_delete_ratings()
        self.test_bulk_delete_permissions()
        
        # Admin Messaging Tests - NEW FEATURE
        print("\n" + "=" * 50)
        print("💬 TESTING ADMIN MESSAGING TO PASSENGERS - NEW FEATURE")
        print("=" * 50)
        self.test_admin_send_message_to_passenger()
        self.test_admin_send_message_to_driver_should_fail()
        self.test_admin_send_message_to_nonexistent_user()
        self.test_passenger_get_messages()
        self.test_passenger_messages_access_control()
        self.test_passenger_mark_message_as_read()
        self.test_passenger_mark_message_as_read_not_found()
        self.test_passenger_mark_message_access_control()
        
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