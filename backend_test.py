#!/usr/bin/env python3
"""
Backend Test Suite for Transport App Brasília MVP - Rating Modal Bug Fix Testing
Testing the bug fix for persistent rating modal in passenger dashboard:

BUG ORIGINAL: Modal de avaliação aparecia repetidamente após o passageiro já ter enviado a avaliação com sucesso.

CORREÇÕES IMPLEMENTADAS:
1. Backend - endpoint POST /api/ratings/create:
   - Agora marca a viagem como "rated": true
   - Adiciona passenger_rating_given com o valor da avaliação
   - Previne criação de avaliações duplicadas

2. Frontend - checkCurrentTrip():
   - Verifica !trip.rated E !trip.passenger_rating_given 
   - Adiciona condição !showRatingModal para evitar modal duplo

3. Frontend - submitRating():
   - Limpa completamente todos os estados relacionados
   - Trata erro de avaliação duplicada
   - Força refresh dos dados após 1 segundo

CENÁRIO DE TESTE COMPLETO:
1. Criar usuários e viagem
2. Completar viagem e testar avaliação
3. Verificar se modal aparece apenas UMA vez
4. Testar proteção contra avaliações duplicadas
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime
import sys

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://ridemate-18.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class RatingModalBugFixTestSuite:
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
        """Setup test users for rating modal bug fix testing"""
        import time
        timestamp = str(int(time.time()))
        
        users_to_create = [
            ("passenger", "Ana Carolina Silva", f"ana.rating.{timestamp}@test.com"),
            ("driver", "Carlos Eduardo Santos", f"carlos.rating.{timestamp}@test.com"),
            ("admin", "Admin Rating Test", f"admin.rating.{timestamp}@test.com")
        ]
        
        success_count = 0
        for user_type, name, email in users_to_create:
            if await self.register_user(user_type, name, email):
                success_count += 1
                
        return success_count == len(users_to_create)
        
    async def create_test_trip(self):
        """Create a test trip for rating modal bug fix testing"""
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
            
    async def complete_trip(self):
        """Driver completes the trip"""
        trip_id = self.trips['test_trip']['id']
        status, data = await self.make_request('PUT', f'/trips/{trip_id}/complete', None, self.tokens['driver'])
        
        if status == 200:
            self.log_test("Driver Complete Trip", True, "Trip completed successfully")
            return True
        else:
            self.log_test("Driver Complete Trip", False, f"Status: {status}, Error: {data}")
            return False
            
    async def test_trip_status_before_rating(self):
        """Test that trip status is 'completed' and no rating fields exist yet"""
        status, data = await self.make_request('GET', '/trips/my', None, self.tokens['passenger'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200 and isinstance(data, list) and len(data) > 0:
            trip = data[0]  # Get the first trip
            
            # Check trip status is completed
            is_completed = trip.get('status') == 'completed'
            
            # Check that rating fields don't exist yet (before rating)
            has_no_rated_flag = trip.get('rated') is None or trip.get('rated') == False
            has_no_passenger_rating = trip.get('passenger_rating_given') is None
            
            if is_completed and has_no_rated_flag and has_no_passenger_rating:
                success = True
                details = f"Status: {status}, Trip completed: {is_completed}, No rating flags: rated={trip.get('rated')}, passenger_rating_given={trip.get('passenger_rating_given')}"
            else:
                details = f"Status: {status}, Trip completed: {is_completed}, rated: {trip.get('rated')}, passenger_rating_given: {trip.get('passenger_rating_given')}"
        else:
            details = f"Status: {status}, Trips count: {len(data) if isinstance(data, list) else 'N/A'}"
            
        self.log_test("Trip Status Before Rating", success, details)
        return success
        
    async def test_create_rating_success(self):
        """Test POST /api/ratings/create successfully creates rating and marks trip"""
        trip_id = self.trips['test_trip']['id']
        driver_id = self.users['driver']['id']
        
        rating_data = {
            "trip_id": trip_id,
            "rated_user_id": driver_id,
            "rating": 5,
            "reason": None  # 5 stars doesn't require reason
        }
        
        status, data = await self.make_request('POST', '/ratings/create', rating_data, self.tokens['passenger'])
        
        success = status == 200
        details = f"Status: {status}, Response: {data}"
        
        if success:
            # Store rating ID for later tests
            self.rating_id = data.get('rating_id')
            
        self.log_test("Create Rating Success", success, details)
        return success
        
    async def test_trip_marked_as_rated(self):
        """Test that trip is now marked as rated=true and has passenger_rating_given"""
        status, data = await self.make_request('GET', '/trips/my', None, self.tokens['passenger'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200 and isinstance(data, list) and len(data) > 0:
            trip = data[0]  # Get the first trip
            
            # Check that trip is now marked as rated
            is_rated = trip.get('rated') == True
            has_passenger_rating = trip.get('passenger_rating_given') == 5
            
            if is_rated and has_passenger_rating:
                success = True
                details = f"Status: {status}, Trip marked as rated: {is_rated}, passenger_rating_given: {has_passenger_rating}"
            else:
                details = f"Status: {status}, rated: {trip.get('rated')}, passenger_rating_given: {trip.get('passenger_rating_given')}"
        else:
            details = f"Status: {status}, Trips count: {len(data) if isinstance(data, list) else 'N/A'}"
            
        self.log_test("Trip Marked as Rated", success, details)
        return success
        
    async def test_duplicate_rating_prevention(self):
        """Test that duplicate rating attempts are prevented (400 error)"""
        trip_id = self.trips['test_trip']['id']
        driver_id = self.users['driver']['id']
        
        # Try to create another rating for the same trip
        rating_data = {
            "trip_id": trip_id,
            "rated_user_id": driver_id,
            "rating": 4,
            "reason": "Segunda tentativa de avaliação"
        }
        
        status, data = await self.make_request('POST', '/ratings/create', rating_data, self.tokens['passenger'])
        
        # Should fail with 400 (duplicate rating)
        success = status == 400
        details = f"Status: {status}, Expected: 400 (duplicate rating), Response: {data}"
        
        self.log_test("Duplicate Rating Prevention", success, details)
        return success
        
    async def test_rating_with_reason_required(self):
        """Test that ratings below 5 stars require a reason"""
        # Create a second trip to test rating with reason
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
        
        # Create second trip
        status, trip_response = await self.make_request('POST', '/trips/request', trip_data, self.tokens['passenger'])
        if status != 200:
            self.log_test("Create Second Trip for Rating Test", False, f"Failed to create trip: {status}")
            return False
            
        trip2_id = trip_response['id']
        
        # Accept, start and complete second trip
        await self.make_request('PUT', f'/trips/{trip2_id}/accept', None, self.tokens['driver'])
        await self.make_request('PUT', f'/trips/{trip2_id}/start', None, self.tokens['driver'])
        await self.make_request('PUT', f'/trips/{trip2_id}/complete', None, self.tokens['driver'])
        
        # Try to rate with 3 stars but no reason (should fail)
        rating_data_no_reason = {
            "trip_id": trip2_id,
            "rated_user_id": self.users['driver']['id'],
            "rating": 3,
            "reason": None
        }
        
        status1, data1 = await self.make_request('POST', '/ratings/create', rating_data_no_reason, self.tokens['passenger'])
        
        # Should fail with 400 (reason required)
        reason_validation_works = status1 == 400
        
        # Now try with reason (should succeed)
        rating_data_with_reason = {
            "trip_id": trip2_id,
            "rated_user_id": self.users['driver']['id'],
            "rating": 3,
            "reason": "Motorista chegou atrasado e dirigiu muito rápido"
        }
        
        status2, data2 = await self.make_request('POST', '/ratings/create', rating_data_with_reason, self.tokens['passenger'])
        
        rating_with_reason_works = status2 == 200
        
        success = reason_validation_works and rating_with_reason_works
        details = f"No reason (3 stars): {status1} (expected 400), With reason: {status2} (expected 200)"
        
        self.log_test("Rating with Reason Required", success, details)
        return success
        
    async def test_admin_can_see_low_ratings(self):
        """Test that admin can see ratings below 5 stars"""
        status, data = await self.make_request('GET', '/ratings/low', None, self.tokens['admin'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200 and isinstance(data, list):
            # Should have at least one low rating (the 3-star rating we just created)
            low_ratings = [r for r in data if r.get('rating', 5) < 5]
            has_low_ratings = len(low_ratings) > 0
            
            if has_low_ratings:
                success = True
                rating_info = {r['rating']: r.get('reason', 'No reason') for r in low_ratings}
                details = f"Status: {status}, Low ratings found: {len(low_ratings)}, Ratings: {rating_info}"
            else:
                details = f"Status: {status}, Total ratings: {len(data)}, Low ratings: 0"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Admin Can See Low Ratings", success, details)
        return success
        
    async def test_driver_rating_updated(self):
        """Test that driver's average rating is updated after receiving ratings"""
        status, data = await self.make_request('GET', '/users/rating', None, self.tokens['driver'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200 and 'rating' in data:
            driver_rating = data['rating']
            # Driver received 5 stars and 3 stars, so average should be 4.0
            expected_rating = 4.0
            rating_is_correct = abs(driver_rating - expected_rating) < 0.1  # Allow small floating point differences
            
            if rating_is_correct:
                success = True
                details = f"Status: {status}, Driver rating: {driver_rating}, Expected: {expected_rating}"
            else:
                details = f"Status: {status}, Driver rating: {driver_rating}, Expected: {expected_rating}, Difference: {abs(driver_rating - expected_rating)}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Driver Rating Updated", success, details)
        return success
        
    async def run_rating_modal_bug_fix_scenario(self):
        """Run the complete rating modal bug fix testing scenario"""
        print("\n🎯 EXECUTING RATING MODAL BUG FIX TESTING SCENARIO")
        print("=" * 70)
        print("Testing: Modal de avaliação persistente no passenger dashboard")
        print("Focus: Verificar que modal aparece apenas UMA vez após avaliação")
        
        # Step 1: Setup users
        print("\nStep 1: Creating test users...")
        if not await self.setup_test_users():
            return False
            
        # Step 2: Create and complete trip
        print("Step 2: Creating test trip...")
        if not await self.create_test_trip():
            return False
            
        print("Step 3: Driver accepting trip...")
        if not await self.accept_trip():
            return False
            
        print("Step 4: Driver starting trip...")
        if not await self.start_trip():
            return False
            
        print("Step 5: Driver completing trip...")
        if not await self.complete_trip():
            return False
            
        # Step 3: Test rating modal bug fix
        print("Step 6: Testing rating modal bug fix...")
        rating_bug_fix_tests = [
            self.test_trip_status_before_rating(),      # Trip completed, no rating flags
            self.test_create_rating_success(),          # First rating succeeds
            self.test_trip_marked_as_rated(),          # Trip marked as rated=true
            self.test_duplicate_rating_prevention(),    # Second rating blocked (400)
            self.test_rating_with_reason_required(),    # Test reason validation
            self.test_admin_can_see_low_ratings(),     # Admin sees low ratings
            self.test_driver_rating_updated()          # Driver rating calculated
        ]
        
        results = await asyncio.gather(*rating_bug_fix_tests, return_exceptions=True)
        
        # Count successful tests
        successful_tests = sum(1 for result in results if result is True)
        total_tests = len(results)
        
        print(f"\nRating modal bug fix tests: {successful_tests}/{total_tests} passed")
        return successful_tests == total_tests
        
    async def run_all_tests(self):
        """Run all rating modal bug fix tests"""
        print("🚀 STARTING RATING MODAL BUG FIX TEST SUITE")
        print("=" * 70)
        print("Focus: Correção do bug do modal de avaliação persistente")
        print("Objetivo: Modal deve aparecer apenas UMA vez após trip completed")
        
        await self.setup_session()
        
        try:
            # Basic health check
            if not await self.test_health_check():
                print("❌ Health check failed, aborting tests")
                return
                
            # Run rating modal bug fix scenario
            scenario_success = await self.run_rating_modal_bug_fix_scenario()
            
            # Print summary
            print("\n" + "=" * 70)
            print("📊 RATING MODAL BUG FIX TEST SUMMARY")
            print("=" * 70)
            
            passed = sum(1 for result in self.test_results if result['success'])
            total = len(self.test_results)
            success_rate = (passed / total * 100) if total > 0 else 0
            
            print(f"Total Tests: {total}")
            print(f"Passed: {passed}")
            print(f"Failed: {total - passed}")
            print(f"Success Rate: {success_rate:.1f}%")
            
            if scenario_success:
                print("\n🎉 RATING MODAL BUG FIX COMPLETELY FUNCTIONAL!")
                print("✅ POST /api/ratings/create marca trip como rated=true")
                print("✅ Adiciona passenger_rating_given com valor da avaliação")
                print("✅ Previne criação de avaliações duplicadas (400 error)")
                print("✅ Validação de motivo obrigatório para ratings < 5 estrelas")
                print("✅ GET /api/trips/my retorna trip com rated=true após avaliação")
                print("✅ Sistema de avaliações funcionando corretamente")
                print("\n🔧 BACKEND CORRECTIONS WORKING:")
                print("   - Trip.rated flag prevents modal from reappearing")
                print("   - Trip.passenger_rating_given stores rating value")
                print("   - Duplicate rating protection active")
            else:
                print("\n⚠️  Some rating modal bug fix issues detected")
                
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
    test_suite = RatingModalBugFixTestSuite()
    await test_suite.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())