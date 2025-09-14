#!/usr/bin/env python3
"""
Focused test for new bulk operations and admin messaging features
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://brasilia-transit.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def make_request(method, endpoint, data=None, auth_token=None):
    """Make HTTP request and return (success, response_data, status_code)"""
    url = f"{BASE_URL}{endpoint}"
    headers = HEADERS.copy()
    
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

def get_tokens():
    """Get authentication tokens for all user types"""
    tokens = {}
    
    # Login as admin
    admin_login = {"email": "admin@transportdf.com", "password": "admin789"}
    success, data, _ = make_request("POST", "/auth/login", admin_login)
    if success and "access_token" in data:
        tokens["admin"] = data["access_token"]
        print("✅ Admin login successful")
    else:
        print("❌ Admin login failed")
    
    # Login as passenger
    passenger_login = {"email": "maria.santos@email.com", "password": "senha123"}
    success, data, _ = make_request("POST", "/auth/login", passenger_login)
    if success and "access_token" in data:
        tokens["passenger"] = data["access_token"]
        print("✅ Passenger login successful")
    else:
        print("❌ Passenger login failed")
    
    # Login as driver
    driver_login = {"email": "joao.motorista@email.com", "password": "motorista456"}
    success, data, _ = make_request("POST", "/auth/login", driver_login)
    if success and "access_token" in data:
        tokens["driver"] = data["access_token"]
        print("✅ Driver login successful")
    else:
        print("❌ Driver login failed")
    
    return tokens

def test_bulk_operations(tokens):
    """Test bulk delete operations"""
    print("\n" + "=" * 50)
    print("🗑️ TESTING BULK DELETE OPERATIONS")
    print("=" * 50)
    
    if "admin" not in tokens:
        print("❌ No admin token available")
        return
    
    admin_token = tokens["admin"]
    
    # Test 1: Bulk delete trips with empty list
    print("\n1. Testing bulk delete trips with empty list...")
    bulk_data = {"ids": []}
    success, data, status = make_request("POST", "/admin/trips/bulk-delete", bulk_data, admin_token)
    if success:
        print(f"✅ Bulk delete trips: {data.get('message', 'Success')}")
    else:
        print(f"❌ Bulk delete trips failed: {data} (status: {status})")
    
    # Test 2: Bulk delete users with fake IDs (should exclude admins)
    print("\n2. Testing bulk delete users...")
    bulk_data = {"ids": ["fake-id-1", "fake-id-2"]}
    success, data, status = make_request("POST", "/admin/users/bulk-delete", bulk_data, admin_token)
    if success:
        print(f"✅ Bulk delete users: {data.get('message', 'Success')}")
    else:
        print(f"❌ Bulk delete users failed: {data} (status: {status})")
    
    # Test 3: Bulk delete reports
    print("\n3. Testing bulk delete reports...")
    bulk_data = {"ids": ["fake-report-id"]}
    success, data, status = make_request("POST", "/admin/reports/bulk-delete", bulk_data, admin_token)
    if success:
        print(f"✅ Bulk delete reports: {data.get('message', 'Success')}")
    else:
        print(f"❌ Bulk delete reports failed: {data} (status: {status})")
    
    # Test 4: Bulk delete ratings
    print("\n4. Testing bulk delete ratings...")
    bulk_data = {"ids": ["fake-rating-id"]}
    success, data, status = make_request("POST", "/admin/ratings/bulk-delete", bulk_data, admin_token)
    if success:
        print(f"✅ Bulk delete ratings: {data.get('message', 'Success')}")
    else:
        print(f"❌ Bulk delete ratings failed: {data} (status: {status})")
    
    # Test 5: Test permissions - passenger trying bulk delete
    print("\n5. Testing bulk delete permissions...")
    if "passenger" in tokens:
        bulk_data = {"ids": ["fake-id"]}
        success, data, status = make_request("POST", "/admin/trips/bulk-delete", bulk_data, tokens["passenger"])
        if not success and (status == 403 or status == 401):
            print("✅ Bulk delete permissions: Non-admin correctly denied access")
        else:
            print(f"❌ Bulk delete permissions: Should deny access (status: {status})")

def test_admin_messaging(tokens):
    """Test admin messaging to passengers"""
    print("\n" + "=" * 50)
    print("💬 TESTING ADMIN MESSAGING TO PASSENGERS")
    print("=" * 50)
    
    if "admin" not in tokens:
        print("❌ No admin token available")
        return
    
    admin_token = tokens["admin"]
    
    # Get passenger ID from users list
    print("\n1. Getting passenger user ID...")
    success, users_data, _ = make_request("GET", "/admin/users", auth_token=admin_token)
    
    passenger_id = None
    if success and users_data:
        for user in users_data:
            if user.get("user_type") == "passenger":
                passenger_id = user["id"]
                print(f"✅ Found passenger ID: {passenger_id[:8]}...")
                break
    
    if not passenger_id:
        print("❌ No passenger found")
        return
    
    # Test 1: Send message to passenger
    print("\n2. Testing admin send message to passenger...")
    message_data = {
        "user_id": passenger_id,
        "message": "Teste de mensagem do admin para passageiro - funcionalidade de bulk operations implementada!"
    }
    success, data, status = make_request("POST", "/admin/messages/send", message_data, admin_token)
    if success:
        print(f"✅ Admin send message: {data.get('message', 'Success')}")
    else:
        print(f"❌ Admin send message failed: {data} (status: {status})")
    
    # Test 2: Try to send message to driver (should fail)
    print("\n3. Testing admin send message to driver (should fail)...")
    # Get driver ID
    driver_id = None
    for user in users_data:
        if user.get("user_type") == "driver":
            driver_id = user["id"]
            break
    
    if driver_id:
        message_data = {
            "user_id": driver_id,
            "message": "Esta mensagem não deveria ser enviada"
        }
        success, data, status = make_request("POST", "/admin/messages/send", message_data, admin_token)
        if not success and status == 400:
            print("✅ Admin send to driver: Correctly prevented")
        else:
            print(f"❌ Admin send to driver: Should be prevented (status: {status})")
    
    # Test 3: Send to non-existent user
    print("\n4. Testing admin send message to non-existent user...")
    message_data = {
        "user_id": "non-existent-user-id",
        "message": "Test message"
    }
    success, data, status = make_request("POST", "/admin/messages/send", message_data, admin_token)
    if not success and status == 404:
        print("✅ Admin send to non-existent: Correctly returned 404")
    else:
        print(f"❌ Admin send to non-existent: Should return 404 (status: {status})")
    
    # Test 4: Passenger get messages
    print("\n5. Testing passenger get messages...")
    if "passenger" in tokens:
        success, data, status = make_request("GET", "/passengers/messages", auth_token=tokens["passenger"])
        if success:
            print(f"✅ Passenger get messages: Retrieved {len(data)} messages")
            if data:
                message = data[0]
                required_fields = ["id", "user_id", "admin_id", "message", "created_at", "read"]
                missing_fields = [field for field in required_fields if field not in message]
                if not missing_fields:
                    print("✅ Message structure: All required fields present")
                    
                    # Test 5: Mark message as read
                    print("\n6. Testing mark message as read...")
                    message_id = message["id"]
                    success, data, status = make_request("POST", f"/passengers/messages/{message_id}/read", 
                                                       auth_token=tokens["passenger"])
                    if success:
                        print("✅ Mark message as read: Success")
                    else:
                        print(f"❌ Mark message as read failed: {data} (status: {status})")
                else:
                    print(f"❌ Message structure: Missing fields {missing_fields}")
        else:
            print(f"❌ Passenger get messages failed: {data} (status: {status})")
    
    # Test 6: Access control - driver trying to access passenger messages
    print("\n7. Testing access control...")
    if "driver" in tokens:
        success, data, status = make_request("GET", "/passengers/messages", auth_token=tokens["driver"])
        if not success and status == 403:
            print("✅ Access control: Driver correctly denied access to passenger messages")
        else:
            print(f"❌ Access control: Driver should be denied (status: {status})")

def main():
    print("=" * 80)
    print("🚀 FOCUSED TESTING: BULK OPERATIONS & ADMIN MESSAGING")
    print("=" * 80)
    
    # Get authentication tokens
    print("\n📋 Getting authentication tokens...")
    tokens = get_tokens()
    
    # Test bulk operations
    test_bulk_operations(tokens)
    
    # Test admin messaging
    test_admin_messaging(tokens)
    
    print("\n" + "=" * 80)
    print("✅ FOCUSED TESTING COMPLETED")
    print("=" * 80)

if __name__ == "__main__":
    main()