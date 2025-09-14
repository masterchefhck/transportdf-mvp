#!/usr/bin/env python3
"""
Focused Chat System Testing for TransportDF MVP
Tests specifically the chat endpoints as requested in the review
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://brasilia-rideapp.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class ChatSystemTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = HEADERS.copy()
        self.tokens = {}
        self.users = {}
        self.trips = {}
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

    def setup_users_and_trip(self):
        """Setup users and create a trip for chat testing"""
        print("🔧 Setting up users and trip for chat testing...")
        
        # Login users
        login_data = [
            {"email": "maria.santos@email.com", "password": "senha123", "type": "passenger"},
            {"email": "joao.motorista@email.com", "password": "motorista456", "type": "driver"},
            {"email": "admin@transportdf.com", "password": "admin789", "type": "admin"}
        ]
        
        for login in login_data:
            success, data, status_code = self.make_request("POST", "/auth/login", 
                                                         {"email": login["email"], "password": login["password"]})
            
            if success and "access_token" in data:
                self.tokens[login["type"]] = data["access_token"]
                if "user" in data:
                    self.users[login["type"]] = data["user"]
                print(f"✅ {login['type'].title()} logged in successfully")
            else:
                print(f"❌ {login['type'].title()} login failed")
                return False
        
        # Create a trip for chat testing
        if "passenger" not in self.tokens:
            print("❌ No passenger token for trip creation")
            return False
            
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
        
        if success and "id" in data:
            self.trips["chat_test"] = data
            trip_id = data["id"]
            print(f"✅ Trip created successfully (ID: {trip_id[:8]}...)")
            
            # Accept the trip
            success, _, _ = self.make_request("PUT", f"/trips/{trip_id}/accept", 
                                            auth_token=self.tokens["driver"])
            if success:
                print("✅ Trip accepted by driver")
                return True
            else:
                print("❌ Failed to accept trip")
                return False
        else:
            print(f"❌ Failed to create trip: {data}")
            return False

    def test_chat_send_message_passenger(self):
        """Test 1: POST /api/trips/{trip_id}/chat/send - Passenger sends message"""
        if "chat_test" not in self.trips:
            self.log_test("Chat Send Message - Passenger", False, "No test trip available")
            return
            
        trip_id = self.trips["chat_test"]["id"]
        message_data = {"message": "Olá motorista! Estou aguardando no local combinado."}
        
        success, data, status_code = self.make_request("POST", f"/trips/{trip_id}/chat/send", 
                                                     message_data, auth_token=self.tokens["passenger"])
        
        if success and "message sent" in str(data).lower():
            self.log_test("Chat Send Message - Passenger", True, "Passenger successfully sent chat message")
        else:
            self.log_test("Chat Send Message - Passenger", False, f"Failed to send message (status: {status_code})", data)

    def test_chat_send_message_driver(self):
        """Test 2: POST /api/trips/{trip_id}/chat/send - Driver sends message"""
        if "chat_test" not in self.trips:
            self.log_test("Chat Send Message - Driver", False, "No test trip available")
            return
            
        trip_id = self.trips["chat_test"]["id"]
        message_data = {"message": "Oi! Estou chegando em 2 minutos. Aguarde por favor!"}
        
        success, data, status_code = self.make_request("POST", f"/trips/{trip_id}/chat/send", 
                                                     message_data, auth_token=self.tokens["driver"])
        
        if success and "message sent" in str(data).lower():
            self.log_test("Chat Send Message - Driver", True, "Driver successfully sent chat message")
        else:
            self.log_test("Chat Send Message - Driver", False, f"Failed to send message (status: {status_code})", data)

    def test_chat_message_character_limit(self):
        """Test 3: Chat message 250 character limit validation"""
        if "chat_test" not in self.trips:
            self.log_test("Chat Message Character Limit", False, "No test trip available")
            return
            
        trip_id = self.trips["chat_test"]["id"]
        # Create a message over 250 characters
        long_message = "A" * 251
        message_data = {"message": long_message}
        
        success, data, status_code = self.make_request("POST", f"/trips/{trip_id}/chat/send", 
                                                     message_data, auth_token=self.tokens["passenger"])
        
        if not success and (status_code == 400 or status_code == 422):
            self.log_test("Chat Message Character Limit", True, "Message over 250 characters correctly rejected")
        else:
            self.log_test("Chat Message Character Limit", False, f"Should reject messages over 250 chars (status: {status_code})", data)

    def test_chat_unauthorized_access(self):
        """Test 4: Chat access control - only trip participants can send messages"""
        if "chat_test" not in self.trips:
            self.log_test("Chat Unauthorized Access", False, "No test trip available")
            return
            
        trip_id = self.trips["chat_test"]["id"]
        message_data = {"message": "Admin trying to send message"}
        
        # Admin should not be able to send messages to trip chat
        success, data, status_code = self.make_request("POST", f"/trips/{trip_id}/chat/send", 
                                                     message_data, auth_token=self.tokens["admin"])
        
        if not success and status_code == 403:
            self.log_test("Chat Unauthorized Access", True, "Admin correctly denied access to send chat messages")
        else:
            self.log_test("Chat Unauthorized Access", False, f"Admin should not have access (status: {status_code})", data)

    def test_chat_get_messages_passenger(self):
        """Test 5: GET /api/trips/{trip_id}/chat/messages - Passenger retrieves messages"""
        if "chat_test" not in self.trips:
            self.log_test("Chat Get Messages - Passenger", False, "No test trip available")
            return
            
        trip_id = self.trips["chat_test"]["id"]
        
        success, data, status_code = self.make_request("GET", f"/trips/{trip_id}/chat/messages", 
                                                     auth_token=self.tokens["passenger"])
        
        if success and isinstance(data, list):
            message_count = len(data)
            self.log_test("Chat Get Messages - Passenger", True, f"Passenger retrieved {message_count} chat messages")
            
            # Verify message structure if messages exist
            if data:
                message = data[0]
                required_fields = ["id", "trip_id", "sender_id", "sender_name", "sender_type", "message", "timestamp"]
                missing_fields = [field for field in required_fields if field not in message]
                
                if not missing_fields:
                    self.log_test("Chat Message Structure", True, "Chat messages have correct structure")
                else:
                    self.log_test("Chat Message Structure", False, f"Missing fields: {missing_fields}")
        else:
            self.log_test("Chat Get Messages - Passenger", False, f"Failed to get messages (status: {status_code})", data)

    def test_chat_get_messages_driver(self):
        """Test 6: GET /api/trips/{trip_id}/chat/messages - Driver retrieves messages"""
        if "chat_test" not in self.trips:
            self.log_test("Chat Get Messages - Driver", False, "No test trip available")
            return
            
        trip_id = self.trips["chat_test"]["id"]
        
        success, data, status_code = self.make_request("GET", f"/trips/{trip_id}/chat/messages", 
                                                     auth_token=self.tokens["driver"])
        
        if success and isinstance(data, list):
            message_count = len(data)
            self.log_test("Chat Get Messages - Driver", True, f"Driver retrieved {message_count} chat messages")
        else:
            self.log_test("Chat Get Messages - Driver", False, f"Failed to get messages (status: {status_code})", data)

    def test_chat_get_messages_admin(self):
        """Test 7: GET /api/trips/{trip_id}/chat/messages - Admin can view all chats"""
        if "chat_test" not in self.trips:
            self.log_test("Chat Get Messages - Admin", False, "No test trip available")
            return
            
        trip_id = self.trips["chat_test"]["id"]
        
        success, data, status_code = self.make_request("GET", f"/trips/{trip_id}/chat/messages", 
                                                     auth_token=self.tokens["admin"])
        
        if success and isinstance(data, list):
            message_count = len(data)
            self.log_test("Chat Get Messages - Admin", True, f"Admin retrieved {message_count} chat messages")
        else:
            self.log_test("Chat Get Messages - Admin", False, f"Failed to get messages (status: {status_code})", data)

    def test_admin_chats_aggregation(self):
        """Test 8: GET /api/admin/chats - Admin views aggregated chat conversations"""
        success, data, status_code = self.make_request("GET", "/admin/chats", 
                                                     auth_token=self.tokens["admin"])
        
        if success and isinstance(data, list):
            chat_count = len(data)
            self.log_test("Admin Chats Aggregation", True, f"Admin retrieved {chat_count} chat conversations")
            
            # Verify structure if chats exist
            if data:
                chat = data[0]
                required_fields = ["trip_id", "trip_status", "pickup_address", "destination_address", 
                                 "passenger_name", "driver_name", "message_count", "last_message", "last_timestamp"]
                missing_fields = [field for field in required_fields if field not in chat]
                
                if not missing_fields:
                    self.log_test("Admin Chats Structure", True, "Chat aggregation has correct structure")
                else:
                    self.log_test("Admin Chats Structure", False, f"Missing fields: {missing_fields}")
        else:
            self.log_test("Admin Chats Aggregation", False, f"Failed to get chat aggregation (status: {status_code})", data)

    def test_admin_trips_enhanced(self):
        """Test 9: GET /api/admin/trips - Enhanced trips endpoint with full user details"""
        success, data, status_code = self.make_request("GET", "/admin/trips", 
                                                     auth_token=self.tokens["admin"])
        
        if success and isinstance(data, list):
            trip_count = len(data)
            self.log_test("Admin Trips Enhanced", True, f"Admin retrieved {trip_count} trips with enhanced data")
            
            # Verify enhanced user data if trips exist
            if data:
                trip = data[0]
                passenger_fields = ["passenger_name", "passenger_email", "passenger_phone", "passenger_rating"]
                driver_fields = ["driver_name", "driver_email", "driver_phone", "driver_rating"]
                
                passenger_complete = all(field in trip for field in passenger_fields)
                driver_complete = all(field in trip for field in driver_fields) if trip.get("driver_id") else True
                
                if passenger_complete and driver_complete:
                    self.log_test("Admin Trips User Data", True, "Complete user details included in trips")
                else:
                    missing = []
                    if not passenger_complete:
                        missing.extend([f for f in passenger_fields if f not in trip])
                    if not driver_complete:
                        missing.extend([f for f in driver_fields if f not in trip])
                    self.log_test("Admin Trips User Data", False, f"Missing user data fields: {missing}")
        else:
            self.log_test("Admin Trips Enhanced", False, f"Failed to get enhanced trips (status: {status_code})", data)

    def test_chat_nonexistent_trip(self):
        """Test 10: Chat operations on non-existent trip should return 404"""
        fake_trip_id = "non-existent-trip-id-12345"
        
        # Test sending message to non-existent trip
        message_data = {"message": "Test message"}
        success, data, status_code = self.make_request("POST", f"/trips/{fake_trip_id}/chat/send", 
                                                     message_data, auth_token=self.tokens["passenger"])
        
        if not success and status_code == 404:
            self.log_test("Chat Non-existent Trip - Send", True, "Correctly returned 404 for non-existent trip")
        else:
            self.log_test("Chat Non-existent Trip - Send", False, f"Should return 404 for non-existent trip (status: {status_code})", data)
        
        # Test getting messages from non-existent trip
        success, data, status_code = self.make_request("GET", f"/trips/{fake_trip_id}/chat/messages", 
                                                     auth_token=self.tokens["passenger"])
        
        if not success and status_code == 404:
            self.log_test("Chat Non-existent Trip - Get Messages", True, "Correctly returned 404 for non-existent trip")
        else:
            self.log_test("Chat Non-existent Trip - Get Messages", False, f"Should return 404 for non-existent trip (status: {status_code})", data)

    def run_all_tests(self):
        """Run all chat system tests"""
        print("=" * 80)
        print("🚀 STARTING FOCUSED CHAT SYSTEM TESTING")
        print("=" * 80)
        print()
        
        # Setup
        if not self.setup_users_and_trip():
            print("❌ Setup failed - cannot proceed with tests")
            return
        
        print()
        print("=" * 50)
        print("💬 TESTING CHAT ENDPOINTS")
        print("=" * 50)
        
        # Run chat tests
        self.test_chat_send_message_passenger()
        self.test_chat_send_message_driver()
        self.test_chat_message_character_limit()
        self.test_chat_unauthorized_access()
        self.test_chat_get_messages_passenger()
        self.test_chat_get_messages_driver()
        self.test_chat_get_messages_admin()
        self.test_admin_chats_aggregation()
        self.test_admin_trips_enhanced()
        self.test_chat_nonexistent_trip()
        
        # Summary
        print("=" * 80)
        print("📊 CHAT SYSTEM TEST SUMMARY")
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
        
        print("=" * 80)

if __name__ == "__main__":
    tester = ChatSystemTester()
    tester.run_all_tests()