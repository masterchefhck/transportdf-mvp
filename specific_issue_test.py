#!/usr/bin/env python3
"""
Specific Issue Testing for User Reported Problems
Focus on the three specific issues reported by the user
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

class SpecificIssueTester:
    def __init__(self):
        self.session = requests.Session()
        self.tokens = {}
        self.users = {}
        self.issues_found = []
        
    def log_issue(self, issue_name, severity, description, details=None):
        """Log specific issues found"""
        print(f"🚨 {severity} - {issue_name}: {description}")
        if details:
            print(f"   Details: {details}")
        self.issues_found.append({
            "issue": issue_name,
            "severity": severity,
            "description": description,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    def setup_test_users(self):
        """Setup test users for issue testing"""
        users_data = [
            {
                "name": "Test Admin User",
                "email": "test.admin@issue.test",
                "phone": "+5561999999999",
                "cpf": "99999999999",
                "user_type": "admin",
                "password": "testpass123"
            },
            {
                "name": "Test Passenger User",
                "email": "test.passenger@issue.test",
                "phone": "+5561999999998",
                "cpf": "99999999998",
                "user_type": "passenger",
                "password": "testpass123"
            },
            {
                "name": "Test Driver User",
                "email": "test.driver@issue.test",
                "phone": "+5561999999997",
                "cpf": "99999999997",
                "user_type": "driver",
                "password": "testpass123"
            }
        ]
        
        for user_data in users_data:
            try:
                # Try to register or login
                response = self.session.post(f"{API_BASE}/auth/register", json=user_data)
                if response.status_code == 200:
                    data = response.json()
                    self.tokens[user_data["user_type"]] = data["access_token"]
                    self.users[user_data["user_type"]] = data["user"]
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
                    else:
                        self.log_issue("User Setup", "CRITICAL", f"Cannot login {user_data['user_type']}", login_response.text)
                else:
                    self.log_issue("User Setup", "CRITICAL", f"Cannot register {user_data['user_type']}", response.text)
            except Exception as e:
                self.log_issue("User Setup", "CRITICAL", f"Exception during {user_data['user_type']} setup", str(e))
    
    def test_issue_1_bulk_delete_ratings(self):
        """Test Issue 1: Erro ao deletar avaliações"""
        print("\n🔍 TESTING ISSUE 1: Bulk Delete Ratings Error")
        print("-" * 60)
        
        if "admin" not in self.tokens:
            self.log_issue("Bulk Delete Test", "CRITICAL", "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.tokens['admin']}"}
        
        # Test 1: Try bulk delete with empty list
        try:
            response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                       json={"ids": []}, headers=headers)
            if response.status_code != 200:
                self.log_issue("Bulk Delete Empty List", "HIGH", 
                             f"Empty list deletion failed with status {response.status_code}", 
                             response.text)
            else:
                print("✅ Empty list bulk delete works")
        except Exception as e:
            self.log_issue("Bulk Delete Empty List", "CRITICAL", "Exception during empty list test", str(e))
        
        # Test 2: Try bulk delete with non-existent IDs
        try:
            fake_ids = ["fake-id-1", "fake-id-2", "non-existent-id"]
            response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                       json={"ids": fake_ids}, headers=headers)
            if response.status_code != 200:
                self.log_issue("Bulk Delete Non-existent IDs", "HIGH", 
                             f"Non-existent ID deletion failed with status {response.status_code}", 
                             response.text)
            else:
                result = response.json()
                print(f"✅ Non-existent IDs handled: {result}")
        except Exception as e:
            self.log_issue("Bulk Delete Non-existent IDs", "CRITICAL", "Exception during non-existent ID test", str(e))
        
        # Test 3: Try bulk delete with malformed request
        try:
            response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                       json={"invalid_field": ["id1", "id2"]}, headers=headers)
            if response.status_code not in [400, 422]:  # Should fail validation
                self.log_issue("Bulk Delete Malformed Request", "MEDIUM", 
                             f"Malformed request should fail but got status {response.status_code}", 
                             response.text)
            else:
                print("✅ Malformed request properly rejected")
        except Exception as e:
            self.log_issue("Bulk Delete Malformed Request", "CRITICAL", "Exception during malformed request test", str(e))
        
        # Test 4: Try bulk delete without admin permissions
        if "passenger" in self.tokens:
            try:
                passenger_headers = {"Authorization": f"Bearer {self.tokens['passenger']}"}
                response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                           json={"ids": ["test-id"]}, headers=passenger_headers)
                if response.status_code != 403:
                    self.log_issue("Bulk Delete Permission Check", "HIGH", 
                                 f"Non-admin should get 403 but got {response.status_code}", 
                                 response.text)
                else:
                    print("✅ Permission check works correctly")
            except Exception as e:
                self.log_issue("Bulk Delete Permission Check", "CRITICAL", "Exception during permission test", str(e))
    
    def test_issue_2_location_error(self):
        """Test Issue 2: Erro de localização"""
        print("\n🔍 TESTING ISSUE 2: Location Processing Error")
        print("-" * 60)
        
        if "passenger" not in self.tokens:
            self.log_issue("Location Test", "CRITICAL", "No passenger token available")
            return
        
        headers = {"Authorization": f"Bearer {self.tokens['passenger']}"}
        
        # Test 1: Valid Brasília coordinates
        valid_trip = {
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
            response = self.session.post(f"{API_BASE}/trips/request", json=valid_trip, headers=headers)
            if response.status_code != 200:
                self.log_issue("Valid Location Processing", "HIGH", 
                             f"Valid Brasília coordinates failed with status {response.status_code}", 
                             response.text)
            else:
                trip_data = response.json()
                if not trip_data.get("distance_km") or trip_data["distance_km"] <= 0:
                    self.log_issue("Distance Calculation", "HIGH", 
                                 "Distance not calculated properly", 
                                 f"Distance: {trip_data.get('distance_km')}")
                else:
                    print(f"✅ Valid location processed correctly, distance: {trip_data['distance_km']} km")
        except Exception as e:
            self.log_issue("Valid Location Processing", "CRITICAL", "Exception during valid location test", str(e))
        
        # Test 2: Invalid coordinates (zeros)
        invalid_trip = {
            "passenger_id": self.users["passenger"]["id"],
            "pickup_latitude": 0.0,
            "pickup_longitude": 0.0,
            "pickup_address": "Invalid Location",
            "destination_latitude": 0.0,
            "destination_longitude": 0.0,
            "destination_address": "Invalid Destination",
            "estimated_price": 15.50
        }
        
        try:
            response = self.session.post(f"{API_BASE}/trips/request", json=invalid_trip, headers=headers)
            if response.status_code == 200:
                trip_data = response.json()
                if trip_data.get("distance_km", 0) == 0:
                    self.log_issue("Zero Distance Handling", "MEDIUM", 
                                 "Zero coordinates result in zero distance - might confuse users", 
                                 f"Trip data: {trip_data}")
                print(f"✅ Invalid coordinates handled (distance: {trip_data.get('distance_km', 0)} km)")
            elif response.status_code == 400:
                print("✅ Invalid coordinates properly rejected")
            else:
                self.log_issue("Invalid Location Processing", "MEDIUM", 
                             f"Unexpected status for invalid coordinates: {response.status_code}", 
                             response.text)
        except Exception as e:
            self.log_issue("Invalid Location Processing", "CRITICAL", "Exception during invalid location test", str(e))
        
        # Test 3: Missing required fields
        incomplete_trip = {
            "passenger_id": self.users["passenger"]["id"],
            "pickup_latitude": -15.7801,
            # Missing other required fields
        }
        
        try:
            response = self.session.post(f"{API_BASE}/trips/request", json=incomplete_trip, headers=headers)
            if response.status_code not in [400, 422]:
                self.log_issue("Incomplete Trip Data", "MEDIUM", 
                             f"Incomplete data should be rejected but got {response.status_code}", 
                             response.text)
            else:
                print("✅ Incomplete trip data properly rejected")
        except Exception as e:
            self.log_issue("Incomplete Trip Data", "CRITICAL", "Exception during incomplete data test", str(e))
    
    def test_issue_3_rating_loop(self):
        """Test Issue 3: Loop de avaliação continua"""
        print("\n🔍 TESTING ISSUE 3: Rating Loop Prevention")
        print("-" * 60)
        
        if "passenger" not in self.tokens or "driver" not in self.tokens:
            self.log_issue("Rating Loop Test", "CRITICAL", "Missing required tokens")
            return
        
        # Create a complete trip for rating test
        passenger_headers = {"Authorization": f"Bearer {self.tokens['passenger']}"}
        driver_headers = {"Authorization": f"Bearer {self.tokens['driver']}"}
        
        # Step 1: Create and complete a trip
        trip_data = {
            "passenger_id": self.users["passenger"]["id"],
            "pickup_latitude": -15.7801,
            "pickup_longitude": -47.9292,
            "pickup_address": "Test Pickup for Rating",
            "destination_latitude": -15.8267,
            "destination_longitude": -47.9218,
            "destination_address": "Test Destination for Rating",
            "estimated_price": 12.00
        }
        
        try:
            # Create trip
            trip_response = self.session.post(f"{API_BASE}/trips/request", json=trip_data, headers=passenger_headers)
            if trip_response.status_code != 200:
                self.log_issue("Rating Test Trip Creation", "CRITICAL", "Cannot create test trip", trip_response.text)
                return
            
            trip = trip_response.json()
            trip_id = trip["id"]
            
            # Complete the trip flow
            self.session.put(f"{API_BASE}/drivers/status/online", headers=driver_headers)
            self.session.put(f"{API_BASE}/trips/{trip_id}/accept", headers=driver_headers)
            self.session.put(f"{API_BASE}/trips/{trip_id}/start", headers=driver_headers)
            complete_response = self.session.put(f"{API_BASE}/trips/{trip_id}/complete", headers=driver_headers)
            
            if complete_response.status_code != 200:
                self.log_issue("Rating Test Trip Completion", "CRITICAL", "Cannot complete test trip", complete_response.text)
                return
            
            # Test 1: Create first rating
            rating_data = {
                "trip_id": trip_id,
                "rated_user_id": self.users["driver"]["id"],
                "rating": 4,
                "reason": "Good service"
            }
            
            first_rating_response = self.session.post(f"{API_BASE}/ratings/create", json=rating_data, headers=passenger_headers)
            if first_rating_response.status_code != 200:
                self.log_issue("First Rating Creation", "HIGH", 
                             f"First rating failed with status {first_rating_response.status_code}", 
                             first_rating_response.text)
                return
            else:
                print("✅ First rating created successfully")
            
            # Test 2: Try to create duplicate rating (should fail)
            duplicate_rating_data = {
                "trip_id": trip_id,
                "rated_user_id": self.users["driver"]["id"],
                "rating": 5,
                "reason": "Changed my mind"
            }
            
            duplicate_response = self.session.post(f"{API_BASE}/ratings/create", json=duplicate_rating_data, headers=passenger_headers)
            if duplicate_response.status_code != 400:
                self.log_issue("Duplicate Rating Prevention", "CRITICAL", 
                             f"Duplicate rating should fail with 400 but got {duplicate_response.status_code}", 
                             duplicate_response.text)
                print("🚨 CRITICAL: Duplicate ratings are being allowed! This could cause the loop issue.")
            else:
                print("✅ Duplicate rating properly prevented")
            
            # Test 3: Try multiple rapid duplicate attempts (simulate frontend loop)
            print("Testing rapid duplicate attempts...")
            duplicate_attempts = 0
            successful_duplicates = 0
            
            for i in range(5):
                rapid_rating_data = {
                    "trip_id": trip_id,
                    "rated_user_id": self.users["driver"]["id"],
                    "rating": 3,
                    "reason": f"Rapid attempt {i+1}"
                }
                
                rapid_response = self.session.post(f"{API_BASE}/ratings/create", json=rapid_rating_data, headers=passenger_headers)
                duplicate_attempts += 1
                
                if rapid_response.status_code == 200:
                    successful_duplicates += 1
                    self.log_issue("Rapid Duplicate Rating", "CRITICAL", 
                                 f"Rapid duplicate attempt {i+1} succeeded when it should fail", 
                                 rapid_response.text)
                
                time.sleep(0.1)  # Small delay between attempts
            
            if successful_duplicates > 0:
                self.log_issue("Rating Loop Root Cause", "CRITICAL", 
                             f"{successful_duplicates} out of {duplicate_attempts} duplicate attempts succeeded", 
                             "This is likely the cause of the rating loop issue")
            else:
                print(f"✅ All {duplicate_attempts} rapid duplicate attempts properly prevented")
            
        except Exception as e:
            self.log_issue("Rating Loop Test", "CRITICAL", "Exception during rating loop test", str(e))
    
    def run_specific_issue_tests(self):
        """Run all specific issue tests"""
        print("🚨 STARTING SPECIFIC ISSUE TESTING")
        print("=" * 80)
        print("Testing the three specific issues reported by the user:")
        print("1. Erro ao deletar avaliações (Bulk delete ratings error)")
        print("2. Erro de localização (Location not found error)")
        print("3. Loop de avaliação continua (Rating loop continues)")
        print("=" * 80)
        
        # Setup
        self.setup_test_users()
        
        # Run specific tests
        self.test_issue_1_bulk_delete_ratings()
        self.test_issue_2_location_error()
        self.test_issue_3_rating_loop()
        
        # Summary
        print("\n" + "=" * 80)
        print("🚨 SPECIFIC ISSUE TEST SUMMARY")
        print("=" * 80)
        
        if not self.issues_found:
            print("✅ NO CRITICAL ISSUES FOUND!")
            print("All three reported issues appear to be working correctly in the backend.")
            print("\nPossible causes for user-reported issues:")
            print("- Frontend-backend communication issues")
            print("- Frontend state management problems")
            print("- Network connectivity issues")
            print("- Browser/client-side caching issues")
        else:
            print(f"🚨 FOUND {len(self.issues_found)} ISSUES:")
            
            critical_issues = [i for i in self.issues_found if i["severity"] == "CRITICAL"]
            high_issues = [i for i in self.issues_found if i["severity"] == "HIGH"]
            medium_issues = [i for i in self.issues_found if i["severity"] == "MEDIUM"]
            
            if critical_issues:
                print(f"\n🔴 CRITICAL ISSUES ({len(critical_issues)}):")
                for issue in critical_issues:
                    print(f"  - {issue['issue']}: {issue['description']}")
            
            if high_issues:
                print(f"\n🟡 HIGH PRIORITY ISSUES ({len(high_issues)}):")
                for issue in high_issues:
                    print(f"  - {issue['issue']}: {issue['description']}")
            
            if medium_issues:
                print(f"\n🟠 MEDIUM PRIORITY ISSUES ({len(medium_issues)}):")
                for issue in medium_issues:
                    print(f"  - {issue['issue']}: {issue['description']}")
        
        return len([i for i in self.issues_found if i["severity"] in ["CRITICAL", "HIGH"]]) == 0

if __name__ == "__main__":
    tester = SpecificIssueTester()
    success = tester.run_specific_issue_tests()
    exit(0 if success else 1)