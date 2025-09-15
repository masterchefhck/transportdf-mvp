#!/usr/bin/env python3
"""
Backend Test Suite for Transport App Brasília MVP - New Features Testing
Testing all implemented adjustments as per review request:

AJUSTES IMPLEMENTADOS PARA TESTE:

1. ALERTA DE NOVA MENSAGEM NO CHAT:
   - ChatComponent atualizado com callback onNewMessage
   - Dashboards driver/passenger com estado newMessageAlert
   - Notificação visual "Nova!" no botão de chat
   - Sistema funciona via polling a cada 5 segundos

2. REMOÇÃO DO TELEFONE DO PASSAGEIRO:
   - Removido campo passenger_phone do dashboard do driver
   - Mantém apenas nome, foto e rating

3. BARRA DE PROGRESSO "PROCURANDO MOTORISTA":
   - Barra animada azul transparente quando status = 'requested'
   - Animação loop contínua de 2 segundos
   - Substitui botão laranja estático

4. FUNCIONALIDADE "ESQUECI MINHA SENHA":
   - Endpoints: POST /api/auth/forgot-password, POST /api/auth/reset-password
   - Tela /auth/forgot-password com validação email+CPF
   - Link "Esqueci minha senha" na tela de login
   - Processo em 2 etapas: validação → nova senha

CENÁRIO DE TESTE COMPLETO:
1. Teste chat com notificações
2. Teste informações de usuários (sem telefone para driver)
3. Teste barra de progresso
4. Teste "Esqueci minha senha"
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

class NewFeaturesTestSuite:
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
            self.log_test(f"Register {user_type.title()}", True, f"User ID: {data['user']['id']}")
            return True
        else:
            self.log_test(f"Register {user_type.title()}", False, f"Status: {status}, Error: {data}")
            return False
            
    async def setup_test_users(self):
        """Setup test users for new features testing"""
        import time
        timestamp = str(int(time.time()))
        
        users_to_create = [
            ("passenger", "Maria Silva Santos", f"maria.newfeatures.{timestamp}@test.com"),
            ("driver", "João Carlos Oliveira", f"joao.newfeatures.{timestamp}@test.com"),
            ("admin", "Admin New Features", f"admin.newfeatures.{timestamp}@test.com")
        ]
        
        success_count = 0
        for user_type, name, email in users_to_create:
            if await self.register_user(user_type, name, email):
                success_count += 1
                
        return success_count == len(users_to_create)
        
    async def create_test_trip(self):
        """Create a test trip for new features testing"""
        # Passenger requests trip
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
            self.trips['test_trip'] = data
            self.log_test("Create Test Trip", True, f"Trip ID: {data['id']}")
            return True
        else:
            self.log_test("Create Test Trip", False, f"Status: {status}, Error: {data}")
            return False
            
    async def accept_trip(self):
        """Driver accepts the test trip"""
        trip_id = self.trips['test_trip']['id']
        status, data = await self.make_request('PUT', f'/trips/{trip_id}/accept', None, self.tokens['driver'])
        
        if status == 200:
            self.log_test("Driver Accept Trip", True, "Trip accepted successfully")
            return True
        else:
            self.log_test("Driver Accept Trip", False, f"Status: {status}, Error: {data}")
            return False
            
    async def start_trip(self):
        """Driver starts the trip"""
        trip_id = self.trips['test_trip']['id']
        status, data = await self.make_request('PUT', f'/trips/{trip_id}/start', None, self.tokens['driver'])
        
        if status == 200:
            self.log_test("Driver Start Trip", True, "Trip started successfully")
            return True
        else:
            self.log_test("Driver Start Trip", False, f"Status: {status}, Error: {data}")
            return False

    # ==========================================
    # NEW FEATURES TESTS
    # ==========================================
    
    async def test_forgot_password_validation(self):
        """Test POST /api/auth/forgot-password endpoint validation"""
        # Test with valid email and CPF
        valid_request = {
            "email": self.users['passenger']['email'],
            "cpf": self.users['passenger']['cpf']
        }
        
        status, data = await self.make_request('POST', '/auth/forgot-password', valid_request)
        
        success = status == 200 and 'user_id' in data
        details = f"Status: {status}, Response: {data}"
        
        self.log_test("Forgot Password - Valid Credentials", success, details)
        return success
        
    async def test_forgot_password_invalid_credentials(self):
        """Test POST /api/auth/forgot-password with invalid credentials"""
        # Test with invalid email and CPF combination
        invalid_request = {
            "email": "invalid@test.com",
            "cpf": "000.000.000-00"
        }
        
        status, data = await self.make_request('POST', '/auth/forgot-password', invalid_request)
        
        # Should return 404 for invalid credentials
        success = status == 404
        details = f"Status: {status}, Expected: 404, Response: {data}"
        
        self.log_test("Forgot Password - Invalid Credentials", success, details)
        return success
        
    async def test_reset_password_functionality(self):
        """Test POST /api/auth/reset-password endpoint"""
        # First validate credentials
        valid_request = {
            "email": self.users['driver']['email'],
            "cpf": self.users['driver']['cpf']
        }
        
        status, data = await self.make_request('POST', '/auth/forgot-password', valid_request)
        
        if status != 200:
            self.log_test("Reset Password - Validation Failed", False, f"Validation failed: {status}")
            return False
            
        # Now reset password
        reset_request = {
            "email": self.users['driver']['email'],
            "cpf": self.users['driver']['cpf'],
            "new_password": "newpassword123",
            "confirm_password": "newpassword123"
        }
        
        status, data = await self.make_request('POST', '/auth/reset-password', reset_request)
        
        success = status == 200
        details = f"Status: {status}, Response: {data}"
        
        self.log_test("Reset Password - Success", success, details)
        return success
        
    async def test_reset_password_mismatch(self):
        """Test POST /api/auth/reset-password with password mismatch"""
        reset_request = {
            "email": self.users['passenger']['email'],
            "cpf": self.users['passenger']['cpf'],
            "new_password": "newpassword123",
            "confirm_password": "differentpassword123"
        }
        
        status, data = await self.make_request('POST', '/auth/reset-password', reset_request)
        
        # Should return 400 for password mismatch
        success = status == 400
        details = f"Status: {status}, Expected: 400, Response: {data}"
        
        self.log_test("Reset Password - Password Mismatch", success, details)
        return success
        
    async def test_chat_message_send(self):
        """Test POST /api/trips/{trip_id}/chat/send endpoint"""
        trip_id = self.trips['test_trip']['id']
        
        # Passenger sends message
        message_data = {
            "message": "Olá, estou chegando no local de embarque!"
        }
        
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', message_data, self.tokens['passenger'])
        
        success = status == 200
        details = f"Status: {status}, Response: {data}"
        
        self.log_test("Chat - Passenger Send Message", success, details)
        return success
        
    async def test_chat_message_driver_send(self):
        """Test driver sending chat message"""
        trip_id = self.trips['test_trip']['id']
        
        # Driver sends message
        message_data = {
            "message": "Perfeito! Estou a caminho, chego em 5 minutos."
        }
        
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', message_data, self.tokens['driver'])
        
        success = status == 200
        details = f"Status: {status}, Response: {data}"
        
        self.log_test("Chat - Driver Send Message", success, details)
        return success
        
    async def test_chat_message_character_limit(self):
        """Test chat message character limit validation"""
        trip_id = self.trips['test_trip']['id']
        
        # Create message longer than 250 characters
        long_message = "A" * 251
        message_data = {
            "message": long_message
        }
        
        status, data = await self.make_request('POST', f'/trips/{trip_id}/chat/send', message_data, self.tokens['passenger'])
        
        # Should return 422 for validation error
        success = status == 422
        details = f"Status: {status}, Expected: 422, Message length: {len(long_message)}"
        
        self.log_test("Chat - Character Limit Validation", success, details)
        return success
        
    async def test_chat_messages_retrieval(self):
        """Test GET /api/trips/{trip_id}/chat/messages endpoint"""
        trip_id = self.trips['test_trip']['id']
        
        status, data = await self.make_request('GET', f'/trips/{trip_id}/chat/messages', None, self.tokens['passenger'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200 and isinstance(data, list):
            # Should have at least 2 messages from previous tests
            message_count = len(data)
            has_messages = message_count >= 2
            
            if has_messages and len(data) > 0:
                # Check message structure
                first_message = data[0]
                required_fields = ['id', 'trip_id', 'sender_id', 'sender_name', 'sender_type', 'message', 'timestamp']
                has_required_fields = all(field in first_message for field in required_fields)
                
                success = has_required_fields
                details = f"Status: {status}, Messages: {message_count}, Structure valid: {has_required_fields}"
            else:
                details = f"Status: {status}, Messages: {message_count}, Expected: >= 2"
        else:
            details = f"Status: {status}, Response type: {type(data)}"
            
        self.log_test("Chat - Messages Retrieval", success, details)
        return success
        
    async def test_trip_info_without_passenger_phone(self):
        """Test GET /api/trips/my returns driver info without passenger phone for driver"""
        status, data = await self.make_request('GET', '/trips/my', None, self.tokens['driver'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200 and isinstance(data, list) and len(data) > 0:
            trip = data[0]  # Get the first trip
            
            # Check that passenger info is present but phone is excluded
            has_passenger_name = 'passenger_name' in trip
            has_passenger_rating = 'passenger_rating' in trip
            has_no_passenger_phone = 'passenger_phone' not in trip
            
            if has_passenger_name and has_passenger_rating and has_no_passenger_phone:
                success = True
                details = f"Status: {status}, Has name: {has_passenger_name}, Has rating: {has_passenger_rating}, No phone: {has_no_passenger_phone}"
            else:
                details = f"Status: {status}, Name: {has_passenger_name}, Rating: {has_passenger_rating}, Phone present: {not has_no_passenger_phone}"
        else:
            details = f"Status: {status}, Trips count: {len(data) if isinstance(data, list) else 'N/A'}"
            
        self.log_test("Trip Info - No Passenger Phone for Driver", success, details)
        return success
        
    async def test_trip_status_requested_for_progress_bar(self):
        """Test trip with 'requested' status for progress bar animation"""
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
            self.log_test("Create Trip for Progress Bar Test", False, f"Failed to create trip: {status}")
            return False
            
        # Check that trip status is 'requested'
        status, trips_data = await self.make_request('GET', '/trips/my', None, self.tokens['passenger'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200 and isinstance(trips_data, list):
            # Find the newly created trip
            requested_trips = [t for t in trips_data if t.get('status') == 'requested']
            
            if len(requested_trips) > 0:
                success = True
                details = f"Status: {status}, Requested trips found: {len(requested_trips)}"
            else:
                all_statuses = [t.get('status') for t in trips_data]
                details = f"Status: {status}, No requested trips, All statuses: {all_statuses}"
        else:
            details = f"Status: {status}, Response type: {type(trips_data)}"
            
        self.log_test("Trip Status - Requested for Progress Bar", success, details)
        return success
        
    async def test_admin_chat_aggregation(self):
        """Test GET /api/admin/chats endpoint for admin dashboard"""
        status, data = await self.make_request('GET', '/admin/chats', None, self.tokens['admin'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200 and isinstance(data, list):
            # Should have at least one chat conversation
            chat_count = len(data)
            has_chats = chat_count > 0
            
            if has_chats and len(data) > 0:
                # Check chat structure
                first_chat = data[0]
                required_fields = ['trip_id', 'trip_status', 'pickup_address', 'destination_address', 
                                 'message_count', 'passenger', 'driver']
                has_required_fields = all(field in first_chat for field in required_fields)
                
                success = has_required_fields
                details = f"Status: {status}, Chats: {chat_count}, Structure valid: {has_required_fields}"
            else:
                details = f"Status: {status}, Chats: {chat_count}, Expected: > 0"
        else:
            details = f"Status: {status}, Response type: {type(data)}"
            
        self.log_test("Admin - Chat Aggregation", success, details)
        return success
        
    async def run_new_features_scenario(self):
        """Run the complete new features testing scenario"""
        print("\n🎯 EXECUTING NEW FEATURES TESTING SCENARIO")
        print("=" * 70)
        print("Testing: Novos ajustes implementados conforme review request")
        print("Focus: Chat alerts, password reset, progress bar, user info")
        
        # Step 1: Setup users
        print("\nStep 1: Creating test users...")
        if not await self.setup_test_users():
            return False
            
        # Step 2: Create and accept trip for chat testing
        print("Step 2: Creating test trip...")
        if not await self.create_test_trip():
            return False
            
        print("Step 3: Driver accepting trip...")
        if not await self.accept_trip():
            return False
            
        print("Step 4: Driver starting trip...")
        if not await self.start_trip():
            return False
            
        # Step 5: Test new features (sequential execution for proper order)
        print("Step 5: Testing new features...")
        
        # Test password reset functionality
        test1_success = await self.test_forgot_password_validation()
        test2_success = await self.test_forgot_password_invalid_credentials()
        test3_success = await self.test_reset_password_functionality()
        test4_success = await self.test_reset_password_mismatch()
        
        # Test chat functionality with new message alerts
        test5_success = await self.test_chat_message_send()
        test6_success = await self.test_chat_message_driver_send()
        test7_success = await self.test_chat_message_character_limit()
        test8_success = await self.test_chat_messages_retrieval()
        
        # Test user info without passenger phone
        test9_success = await self.test_trip_info_without_passenger_phone()
        
        # Test progress bar status
        test10_success = await self.test_trip_status_requested_for_progress_bar()
        
        # Test admin chat aggregation
        test11_success = await self.test_admin_chat_aggregation()
        
        results = [test1_success, test2_success, test3_success, test4_success, 
                  test5_success, test6_success, test7_success, test8_success,
                  test9_success, test10_success, test11_success]
        
        # Count successful tests
        successful_tests = sum(1 for result in results if result is True)
        total_tests = len(results)
        
        print(f"\nNew features tests: {successful_tests}/{total_tests} passed")
        return successful_tests == total_tests
        
    async def run_all_tests(self):
        """Run all new features tests"""
        print("🚀 STARTING NEW FEATURES TEST SUITE")
        print("=" * 70)
        print("Focus: Teste dos novos ajustes implementados")
        print("Objetivo: Validar chat alerts, reset senha, barra progresso, info usuários")
        
        await self.setup_session()
        
        try:
            # Basic health check
            if not await self.test_health_check():
                print("❌ Health check failed, aborting tests")
                return
                
            # Run new features scenario
            scenario_success = await self.run_new_features_scenario()
            
            # Print summary
            print("\n" + "=" * 70)
            print("📊 NEW FEATURES TEST SUMMARY")
            print("=" * 70)
            
            passed = sum(1 for result in self.test_results if result['success'])
            total = len(self.test_results)
            success_rate = (passed / total * 100) if total > 0 else 0
            
            print(f"Total Tests: {total}")
            print(f"Passed: {passed}")
            print(f"Failed: {total - passed}")
            print(f"Success Rate: {success_rate:.1f}%")
            
            if scenario_success:
                print("\n🎉 NEW FEATURES COMPLETELY FUNCTIONAL!")
                print("✅ POST /api/auth/forgot-password - Validação email+CPF funcionando")
                print("✅ POST /api/auth/reset-password - Reset de senha funcionando")
                print("✅ POST /api/trips/{trip_id}/chat/send - Envio de mensagens funcionando")
                print("✅ GET /api/trips/{trip_id}/chat/messages - Recuperação de mensagens funcionando")
                print("✅ GET /api/trips/my - Informações sem telefone do passageiro para driver")
                print("✅ Trip status 'requested' - Suporte para barra de progresso")
                print("✅ GET /api/admin/chats - Agregação de chats para admin")
                print("\n🔧 BACKEND NEW FEATURES WORKING:")
                print("   - Password reset 2-step process functional")
                print("   - Chat system with character limit validation")
                print("   - User info filtering (no passenger phone for driver)")
                print("   - Trip status management for UI progress indicators")
            else:
                print("\n⚠️  Some new features issues detected")
                
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
    test_suite = NewFeaturesTestSuite()
    await test_suite.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())