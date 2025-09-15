#!/usr/bin/env python3
"""
Backend Test Suite for Current Bug Fixes - Review Request Testing
Testing all implemented corrections as per review request:

CORREÇÕES IMPLEMENTADAS PARA TESTE:

1. BUG NA ALTERAÇÃO DE SENHA:
   - Endpoint POST /api/auth/reset-password corrigido
   - Senha salva como string decodificada (.decode('utf-8'))
   - Login deve funcionar com nova senha após reset

2. CPF E TELEFONE NA ABA "USUÁRIOS" DO ADMIN:
   - GET /api/admin/users deve incluir campos user.cpf e user.phone
   - Verificar se dados estão sendo retornados corretamente

3. SISTEMA DE NOTIFICAÇÃO DE CHAT:
   - GET /api/trips/{trip_id}/chat/messages para verificar mensagens
   - Testar polling de mensagens para notificações
   - Verificar estrutura de dados das mensagens

CENÁRIO DE TESTE COMPLETO:
1. Teste reset de senha com login posterior
2. Teste admin dashboard com CPF e telefone
3. Teste sistema de chat para notificações
4. Teste barra de progresso (status 'requested')
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime
import sys

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://ridemate-18.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class CurrentFixesTestSuite:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.tokens = {}
        self.users = {}
        self.trips = {}
        
    async def setup_session(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup_session(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            
    async def make_request(self, method, endpoint, data=None, token=None):
        """Make HTTP request with optional authentication"""
        url = f"{API_BASE}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
            
        try:
            async with self.session.request(method, url, json=data, headers=headers) as response:
                response_data = await response.json()
                return response.status, response_data
        except Exception as e:
            return None, {"error": str(e)}
            
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
            
    async def test_health_check(self):
        """Test basic health check"""
        status, data = await self.make_request('GET', '/health')
        success = status == 200 and data.get('status') == 'healthy'
        self.log_test("Health Check", success, f"Status: {status}, Response: {data}")
        return success
        
    async def register_user(self, user_type, name, email):
        """Register a test user"""
        import time
        import random
        timestamp = str(int(time.time()))[-4:]  # Last 4 digits
        random_suffix = str(random.randint(1000, 9999))
        
        user_data = {
            "name": name,
            "email": email,
            "phone": f"+55619{random_suffix}",
            "cpf": f"123.{random_suffix[:3]}.{timestamp[:3]}-{timestamp[3:]}",
            "user_type": user_type,
            "password": "testpass123"
        }
        
        status, data = await self.make_request('POST', '/auth/register', user_data)
        
        if status == 200:
            self.tokens[user_type] = data['access_token']
            self.users[user_type] = data['user']
            self.log_test(f"Register {user_type.title()}", True, f"User ID: {data['user']['id']}, CPF: {user_data['cpf']}, Phone: {user_data['phone']}")
            return True
        else:
            self.log_test(f"Register {user_type.title()}", False, f"Status: {status}, Error: {data}")
            return False
            
    async def setup_test_users(self):
        """Setup test users for current fixes testing"""
        import time
        timestamp = str(int(time.time()))
        
        users_to_create = [
            ("passenger", "Maria Silva Santos", f"maria.fixes.{timestamp}@test.com"),
            ("driver", "João Carlos Oliveira", f"joao.fixes.{timestamp}@test.com"),
            ("admin", "Admin Current Fixes", f"admin.fixes.{timestamp}@test.com")
        ]
        
        success_count = 0
        for user_type, name, email in users_to_create:
            if await self.register_user(user_type, name, email):
                success_count += 1
                
        return success_count == len(users_to_create)

    # ==========================================
    # BUG FIX 1: PASSWORD RESET TESTING
    # ==========================================
    
    async def test_password_reset_complete_flow(self):
        """Test complete password reset flow with login verification"""
        print("\n🔐 TESTING PASSWORD RESET BUG FIX")
        
        # Step 1: Validate credentials for password reset
        user_email = self.users['passenger']['email']
        user_cpf = self.users['passenger']['cpf']
        
        forgot_request = {
            "email": user_email,
            "cpf": user_cpf
        }
        
        status, data = await self.make_request('POST', '/auth/forgot-password', forgot_request)
        
        if status != 200:
            self.log_test("Password Reset - Validation Step", False, f"Validation failed: {status}, {data}")
            return False
            
        self.log_test("Password Reset - Validation Step", True, f"Credentials validated successfully")
        
        # Step 2: Reset password
        new_password = "newpassword123"
        reset_request = {
            "email": user_email,
            "cpf": user_cpf,
            "new_password": new_password,
            "confirm_password": new_password
        }
        
        status, data = await self.make_request('POST', '/auth/reset-password', reset_request)
        
        if status != 200:
            self.log_test("Password Reset - Reset Step", False, f"Reset failed: {status}, {data}")
            return False
            
        self.log_test("Password Reset - Reset Step", True, f"Password reset successful")
        
        # Step 3: Test login with new password (CRITICAL TEST)
        login_request = {
            "email": user_email,
            "password": new_password
        }
        
        status, data = await self.make_request('POST', '/auth/login', login_request)
        
        success = status == 200 and 'access_token' in data
        details = f"Login Status: {status}, Has token: {'access_token' in data if isinstance(data, dict) else False}"
        
        self.log_test("Password Reset - Login with New Password", success, details)
        
        if success:
            # Update token for future tests
            self.tokens['passenger'] = data['access_token']
            
        return success
        
    async def test_password_reset_mismatch_validation(self):
        """Test password reset with mismatched passwords"""
        reset_request = {
            "email": self.users['driver']['email'],
            "cpf": self.users['driver']['cpf'],
            "new_password": "password123",
            "confirm_password": "differentpassword123"
        }
        
        status, data = await self.make_request('POST', '/auth/reset-password', reset_request)
        
        # Should return 400 for password mismatch
        success = status == 400
        details = f"Status: {status}, Expected: 400, Response: {data}"
        
        self.log_test("Password Reset - Mismatch Validation", success, details)
        return success

    # ==========================================
    # BUG FIX 2: ADMIN USERS WITH CPF AND PHONE
    # ==========================================
    
    async def test_admin_users_with_cpf_phone(self):
        """Test GET /api/admin/users includes CPF and phone fields"""
        print("\n👥 TESTING ADMIN USERS CPF/PHONE BUG FIX")
        
        status, data = await self.make_request('GET', '/admin/users', None, self.tokens['admin'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200 and isinstance(data, list) and len(data) > 0:
            # Check if users have CPF and phone fields
            users_with_cpf_phone = []
            
            for user in data:
                has_cpf = 'cpf' in user and user['cpf'] is not None
                has_phone = 'phone' in user and user['phone'] is not None
                
                if has_cpf and has_phone:
                    users_with_cpf_phone.append({
                        'name': user.get('name', 'Unknown'),
                        'cpf': user['cpf'],
                        'phone': user['phone'],
                        'user_type': user.get('user_type', 'Unknown')
                    })
            
            total_users = len(data)
            users_with_data = len(users_with_cpf_phone)
            
            # Success if all users have CPF and phone
            success = users_with_data == total_users and total_users >= 3  # At least our 3 test users
            
            details = f"Status: {status}, Total users: {total_users}, Users with CPF/Phone: {users_with_data}"
            
            if success:
                details += f", Sample user: {users_with_cpf_phone[0]['name']} - CPF: {users_with_cpf_phone[0]['cpf']}, Phone: {users_with_cpf_phone[0]['phone']}"
        else:
            details = f"Status: {status}, Response type: {type(data)}, Length: {len(data) if isinstance(data, list) else 'N/A'}"
            
        self.log_test("Admin Users - CPF and Phone Fields", success, details)
        return success

    # ==========================================
    # BUG FIX 3: CHAT NOTIFICATION SYSTEM
    # ==========================================
    
    async def create_test_trip_for_chat(self):
        """Create a test trip for chat testing"""
        trip_data = {
            "passenger_id": self.users['passenger']['id'],
            "pickup_latitude": -15.7801,
            "pickup_longitude": -47.9292,
            "pickup_address": "Asa Norte, Brasília - DF",
            "destination_latitude": -15.8267,
            "destination_longitude": -47.9218,
            "destination_address": "Asa Sul, Brasília - DF",
            "estimated_price": 15.50
        }
        
        status, data = await self.make_request('POST', '/trips/request', trip_data, self.tokens['passenger'])
        
        if status == 200:
            self.trips['chat_trip'] = data
            self.log_test("Create Trip for Chat", True, f"Trip ID: {data['id']}")
            return True
        else:
            self.log_test("Create Trip for Chat", False, f"Status: {status}, Error: {data}")
            return False
            
    async def accept_and_start_trip_for_chat(self):
        """Driver accepts and starts trip for chat testing"""
        trip_id = self.trips['chat_trip']['id']
        
        # Accept trip
        status, data = await self.make_request('PUT', f'/trips/{trip_id}/accept', None, self.tokens['driver'])
        if status != 200:
            self.log_test("Accept Trip for Chat", False, f"Accept failed: {status}")
            return False
            
        # Start trip
        status, data = await self.make_request('PUT', f'/trips/{trip_id}/start', None, self.tokens['driver'])
        if status != 200:
            self.log_test("Start Trip for Chat", False, f"Start failed: {status}")
            return False
            
        self.log_test("Accept and Start Trip for Chat", True, "Trip ready for chat")
        return True
        
    async def test_chat_notification_system(self):
        """Test chat system for notifications"""
        print("\n💬 TESTING CHAT NOTIFICATION SYSTEM BUG FIX")
        
        # Create and prepare trip
        if not await self.create_test_trip_for_chat():
            return False
            
        if not await self.accept_and_start_trip_for_chat():
            return False
            
        trip_id = self.trips['chat_trip']['id']
        
        # Test 1: Passenger sends message
        message1 = {
            "message": "Olá, estou no local de embarque!"
        }
        
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', message1, self.tokens['passenger'])
        
        if status != 200:
            self.log_test("Chat - Passenger Send Message", False, f"Send failed: {status}")
            return False
            
        # Test 2: Driver sends message
        message2 = {
            "message": "Perfeito! Estou chegando, aguarde 2 minutos."
        }
        
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', message2, self.tokens['driver'])
        
        if status != 200:
            self.log_test("Chat - Driver Send Message", False, f"Send failed: {status}")
            return False
            
        # Test 3: Retrieve messages for notification checking
        status, messages = await self.make_request('GET', f'/trips/{trip_id}/chat/messages', None, self.tokens['passenger'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200 and isinstance(messages, list) and len(messages) >= 2:
            # Check message structure for notifications
            required_fields = ['id', 'trip_id', 'sender_id', 'sender_name', 'sender_type', 'message', 'timestamp']
            
            all_messages_valid = True
            for msg in messages:
                if not all(field in msg for field in required_fields):
                    all_messages_valid = False
                    break
                    
            # Check if we have messages from both participants
            passenger_messages = [m for m in messages if m['sender_type'] == 'passenger']
            driver_messages = [m for m in messages if m['sender_type'] == 'driver']
            
            has_both_participants = len(passenger_messages) > 0 and len(driver_messages) > 0
            
            success = all_messages_valid and has_both_participants
            details = f"Status: {status}, Messages: {len(messages)}, Valid structure: {all_messages_valid}, Both participants: {has_both_participants}"
            
            if success:
                # Check timestamp for notification timing (messages should be recent)
                latest_message = max(messages, key=lambda x: x['timestamp'])
                details += f", Latest from: {latest_message['sender_name']}"
        else:
            details = f"Status: {status}, Messages count: {len(messages) if isinstance(messages, list) else 'N/A'}"
            
        self.log_test("Chat Notification System", success, details)
        return success
        
    async def test_chat_message_limit_validation(self):
        """Test chat message character limit (250 chars)"""
        trip_id = self.trips['chat_trip']['id']
        
        # Test message over 250 characters
        long_message = {
            "message": "A" * 251  # 251 characters
        }
        
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', long_message, self.tokens['passenger'])
        
        # Should return 422 for validation error
        success = status == 422
        details = f"Status: {status}, Expected: 422, Message length: 251 chars"
        
        self.log_test("Chat - Message Length Validation", success, details)
        return success

    # ==========================================
    # BUG FIX 4: PROGRESS BAR SUPPORT
    # ==========================================
    
    async def test_progress_bar_requested_status(self):
        """Test trip 'requested' status for progress bar animation"""
        print("\n📊 TESTING PROGRESS BAR SUPPORT")
        
        # Create a new trip that stays in 'requested' status
        trip_data = {
            "passenger_id": self.users['passenger']['id'],
            "pickup_latitude": -15.8267,
            "pickup_longitude": -47.9218,
            "pickup_address": "Asa Sul, Brasília - DF",
            "destination_latitude": -15.7801,
            "destination_longitude": -47.9292,
            "destination_address": "Asa Norte, Brasília - DF",
            "estimated_price": 18.00
        }
        
        status, data = await self.make_request('POST', '/trips/request', trip_data, self.tokens['passenger'])
        
        if status != 200:
            self.log_test("Create Trip for Progress Bar", False, f"Failed to create trip: {status}")
            return False
            
        # Check that trip status is 'requested' for progress bar
        status, trips_data = await self.make_request('GET', '/trips/my', None, self.tokens['passenger'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200 and isinstance(trips_data, list):
            # Find trips with 'requested' status
            requested_trips = [t for t in trips_data if t.get('status') == 'requested']
            
            if len(requested_trips) > 0:
                trip = requested_trips[0]
                has_required_fields = all(field in trip for field in ['id', 'status', 'pickup_address', 'destination_address'])
                
                success = has_required_fields and trip['status'] == 'requested'
                details = f"Status: {status}, Requested trips: {len(requested_trips)}, Required fields: {has_required_fields}"
            else:
                all_statuses = [t.get('status') for t in trips_data]
                details = f"Status: {status}, No requested trips found, All statuses: {all_statuses}"
        else:
            details = f"Status: {status}, Response type: {type(trips_data)}"
            
        self.log_test("Progress Bar - Requested Status Support", success, details)
        return success

    # ==========================================
    # COMPREHENSIVE SCENARIO TESTING
    # ==========================================
        
    async def run_current_fixes_scenario(self):
        """Run the complete current fixes testing scenario"""
        print("\n🎯 EXECUTING CURRENT FIXES TESTING SCENARIO")
        print("=" * 70)
        print("Testing: Correções implementadas conforme review request")
        print("Focus: Password reset, admin CPF/phone, chat notifications, progress bar")
        
        # Step 1: Setup users
        print("\nStep 1: Creating test users...")
        if not await self.setup_test_users():
            return False
            
        # Step 2: Test password reset bug fix
        print("\nStep 2: Testing password reset bug fix...")
        test1_success = await self.test_password_reset_complete_flow()
        test2_success = await self.test_password_reset_mismatch_validation()
        
        # Step 3: Test admin users with CPF and phone
        print("\nStep 3: Testing admin users CPF/phone...")
        test3_success = await self.test_admin_users_with_cpf_phone()
        
        # Step 4: Test chat notification system
        print("\nStep 4: Testing chat notification system...")
        test4_success = await self.test_chat_notification_system()
        test5_success = await self.test_chat_message_limit_validation()
        
        # Step 5: Test progress bar support
        print("\nStep 5: Testing progress bar support...")
        test6_success = await self.test_progress_bar_requested_status()
        
        results = [test1_success, test2_success, test3_success, test4_success, test5_success, test6_success]
        
        # Count successful tests
        successful_tests = sum(1 for result in results if result is True)
        total_tests = len(results)
        
        print(f"\nCurrent fixes tests: {successful_tests}/{total_tests} passed")
        return successful_tests == total_tests
        
    async def run_all_tests(self):
        """Run all current fixes tests"""
        print("🚀 STARTING CURRENT FIXES TEST SUITE")
        print("=" * 70)
        print("Focus: Teste das correções implementadas")
        print("Objetivo: Validar password reset, admin CPF/phone, chat notifications, progress bar")
        
        await self.setup_session()
        
        try:
            # Basic health check
            if not await self.test_health_check():
                print("❌ Health check failed, aborting tests")
                return
                
            # Run current fixes scenario
            scenario_success = await self.run_current_fixes_scenario()
            
            # Print summary
            print("\n" + "=" * 70)
            print("📊 CURRENT FIXES TEST SUMMARY")
            print("=" * 70)
            
            passed = sum(1 for result in self.test_results if result['success'])
            total = len(self.test_results)
            success_rate = (passed / total * 100) if total > 0 else 0
            
            print(f"Total Tests: {total}")
            print(f"Passed: {passed}")
            print(f"Failed: {total - passed}")
            print(f"Success Rate: {success_rate:.1f}%")
            
            if scenario_success:
                print("\n🎉 CURRENT FIXES COMPLETELY FUNCTIONAL!")
                print("✅ POST /api/auth/reset-password - Password reset with login working")
                print("✅ GET /api/admin/users - CPF and phone fields included")
                print("✅ POST /api/trips/{trip_id}/chat/send - Chat messages working")
                print("✅ GET /api/trips/{trip_id}/chat/messages - Message retrieval for notifications")
                print("✅ Trip status 'requested' - Progress bar support working")
                print("✅ Chat message validation - 250 character limit enforced")
                print("\n🔧 BACKEND FIXES WORKING:")
                print("   - Password saved as decoded string (.decode('utf-8'))")
                print("   - Admin users endpoint includes CPF and phone")
                print("   - Chat system ready for notification polling")
                print("   - Trip status management for progress bar animation")
            else:
                print("\n⚠️  Some current fixes issues detected")
                
            # Print failed tests
            failed_tests = [result for result in self.test_results if not result['success']]
            if failed_tests:
                print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
                for test in failed_tests:
                    print(f"   • {test['test']}: {test['details']}")
                    
        finally:
            await self.cleanup_session()

async def main():
    """Main test execution"""
    test_suite = CurrentFixesTestSuite()
    await test_suite.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())