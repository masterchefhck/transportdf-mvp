#!/usr/bin/env python3
"""
Backend Test Suite for Transport App Brasília MVP - Google Maps Integration Testing
Testing Google Maps mock endpoints as per review request:

GOOGLE MAPS ENDPOINTS TO TEST:

1. POST /api/maps/directions - Get route between two points
   - Test with valid Brasília coordinates
   - Test realistic trip scenarios (Asa Norte → Asa Sul, Centro → Taguatinga, Plano Piloto → Gama)
   - Verify authentication requirement
   - Test error handling with invalid coordinates

2. POST /api/maps/distance-matrix - Get distances between multiple points
   - Test with multiple Brasília locations
   - Verify response structure and data accuracy
   - Test authentication requirement

3. GET /api/maps/geocode/{address} - Convert address to coordinates
   - Test with common Brasília addresses
   - Verify realistic coordinate responses
   - Test authentication requirement

4. GET /api/maps/reverse-geocode - Convert coordinates to address
   - Test with Brasília coordinates
   - Verify realistic address responses
   - Test authentication requirement

COMPREHENSIVE TEST SCENARIOS:
1. Trip from Asa Norte to Asa Sul
2. Trip from Centro to Taguatinga  
3. Trip from Plano Piloto to Gama
4. Geocoding of common Brasília locations
5. Error cases with invalid data
6. Authentication validation for all endpoints
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime
import sys

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://brasilia-rider.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class GoogleMapsTestSuite:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.tokens = {}
        self.users = {}
        
    async def setup_session(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup_session(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            
    async def make_request(self, method, endpoint, data=None, token=None, params=None):
        """Make HTTP request with optional authentication"""
        url = f"{API_BASE}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
            
        try:
            async with self.session.request(method, url, json=data, headers=headers, params=params) as response:
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
        """Setup test users for Google Maps testing"""
        import time
        timestamp = str(int(time.time()))
        
        users_to_create = [
            ("passenger", "Maria Brasília Santos", f"maria.maps.{timestamp}@test.com"),
            ("driver", "João Maps Oliveira", f"joao.maps.{timestamp}@test.com"),
            ("admin", "Admin Maps", f"admin.maps.{timestamp}@test.com")
        ]
        
        success_count = 0
        for user_type, name, email in users_to_create:
            if await self.register_user(user_type, name, email):
                success_count += 1
                
        return success_count == len(users_to_create)

    # ==========================================
    # GOOGLE MAPS ENDPOINTS TESTS
    # ==========================================
    
    async def test_maps_directions_asa_norte_to_asa_sul(self):
        """Test POST /api/maps/directions - Asa Norte to Asa Sul"""
        route_data = {
            "origin_lat": -15.7801,
            "origin_lng": -47.8827,
            "destination_lat": -15.8267,
            "destination_lng": -47.8934
        }
        
        status, data = await self.make_request('POST', '/maps/directions', route_data, self.tokens['passenger'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200:
            # Check response structure
            required_fields = ['distance', 'duration', 'steps', 'overview_polyline', 'bounds']
            has_required_fields = all(field in data for field in required_fields)
            
            if has_required_fields:
                # Check if steps contain realistic Brasília directions
                steps = data.get('steps', [])
                has_steps = len(steps) > 0
                
                if has_steps:
                    first_step = steps[0]
                    step_fields = ['instruction', 'distance', 'duration', 'start_location', 'end_location']
                    has_step_structure = all(field in first_step for field in step_fields)
                    
                    # Check for Brasília-specific content
                    instruction = first_step.get('instruction', '').lower()
                    has_brasilia_content = any(term in instruction for term in ['w3', 'norte', 'sul', 'ponte', 'jk'])
                    
                    success = has_step_structure and has_brasilia_content
                    details = f"Status: {status}, Fields: {has_required_fields}, Steps: {len(steps)}, Brasília content: {has_brasilia_content}"
                else:
                    details = f"Status: {status}, No steps in response"
            else:
                missing_fields = [field for field in required_fields if field not in data]
                details = f"Status: {status}, Missing fields: {missing_fields}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Maps Directions - Asa Norte to Asa Sul", success, details)
        return success
        
    async def test_maps_directions_centro_to_taguatinga(self):
        """Test POST /api/maps/directions - Centro to Taguatinga"""
        route_data = {
            "origin_lat": -15.7942,
            "origin_lng": -47.8822,
            "destination_lat": -15.8270,
            "destination_lng": -48.0427
        }
        
        status, data = await self.make_request('POST', '/maps/directions', route_data, self.tokens['driver'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200:
            # Check for longer distance route (Centro to Taguatinga)
            distance_text = data.get('distance', '')
            duration_text = data.get('duration', '')
            steps = data.get('steps', [])
            
            # Should have more steps for longer route
            has_multiple_steps = len(steps) >= 3
            
            # Check for Taguatinga-specific directions
            taguatinga_content = False
            for step in steps:
                instruction = step.get('instruction', '').lower()
                if any(term in instruction for term in ['taguatinga', 'epia', 'central']):
                    taguatinga_content = True
                    break
                    
            success = has_multiple_steps and taguatinga_content
            details = f"Status: {status}, Distance: {distance_text}, Duration: {duration_text}, Steps: {len(steps)}, Taguatinga content: {taguatinga_content}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Maps Directions - Centro to Taguatinga", success, details)
        return success
        
    async def test_maps_directions_plano_piloto_to_gama(self):
        """Test POST /api/maps/directions - Plano Piloto to Gama"""
        route_data = {
            "origin_lat": -15.7942,
            "origin_lng": -47.8822,
            "destination_lat": -16.0209,
            "destination_lng": -48.0647
        }
        
        status, data = await self.make_request('POST', '/maps/directions', route_data, self.tokens['admin'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200:
            # Check for longest distance route (Plano Piloto to Gama)
            distance_text = data.get('distance', '')
            duration_text = data.get('duration', '')
            steps = data.get('steps', [])
            
            # Should have most steps for longest route
            has_many_steps = len(steps) >= 4
            
            # Check for Gama-specific directions
            gama_content = False
            for step in steps:
                instruction = step.get('instruction', '').lower()
                if any(term in instruction for term in ['gama', 'br-060', 's1']):
                    gama_content = True
                    break
                    
            success = has_many_steps and gama_content
            details = f"Status: {status}, Distance: {distance_text}, Duration: {duration_text}, Steps: {len(steps)}, Gama content: {gama_content}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Maps Directions - Plano Piloto to Gama", success, details)
        return success
        
    async def test_maps_directions_authentication_required(self):
        """Test POST /api/maps/directions requires authentication"""
        route_data = {
            "origin_lat": -15.7801,
            "origin_lng": -47.8827,
            "destination_lat": -15.8267,
            "destination_lng": -47.8934
        }
        
        # Test without token
        status, data = await self.make_request('POST', '/maps/directions', route_data, None)
        
        # Should return 401 or 403 for unauthenticated request
        success = status in [401, 403]
        details = f"Status: {status}, Expected: 401 or 403, Response: {data}"
        
        self.log_test("Maps Directions - Authentication Required", success, details)
        return success
        
    async def test_maps_distance_matrix_multiple_locations(self):
        """Test POST /api/maps/distance-matrix with multiple Brasília locations"""
        matrix_data = {
            "origins": [
                {"lat": -15.7801, "lng": -47.8827},  # Asa Norte
                {"lat": -15.8267, "lng": -47.8934}   # Asa Sul
            ],
            "destinations": [
                {"lat": -15.8270, "lng": -48.0427},  # Taguatinga
                {"lat": -16.0209, "lng": -48.0647},  # Gama
                {"lat": -15.6536, "lng": -47.7863}   # Sobradinho
            ]
        }
        
        status, data = await self.make_request('POST', '/maps/distance-matrix', matrix_data, self.tokens['passenger'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200:
            # Check response structure
            rows = data.get('rows', [])
            has_correct_structure = len(rows) == 2  # 2 origins
            
            if has_correct_structure:
                # Check each row has 3 destinations
                all_rows_valid = True
                for row in rows:
                    elements = row.get('elements', [])
                    if len(elements) != 3:  # 3 destinations
                        all_rows_valid = False
                        break
                        
                    # Check element structure
                    for element in elements:
                        required_fields = ['distance', 'duration', 'status']
                        if not all(field in element for field in required_fields):
                            all_rows_valid = False
                            break
                            
                        # Check distance and duration have text and value
                        distance = element.get('distance', {})
                        duration = element.get('duration', {})
                        if not ('text' in distance and 'value' in distance and 'text' in duration and 'value' in duration):
                            all_rows_valid = False
                            break
                            
                success = all_rows_valid
                details = f"Status: {status}, Rows: {len(rows)}, Structure valid: {all_rows_valid}"
            else:
                details = f"Status: {status}, Expected 2 rows, got: {len(rows)}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Maps Distance Matrix - Multiple Locations", success, details)
        return success
        
    async def test_maps_distance_matrix_authentication_required(self):
        """Test POST /api/maps/distance-matrix requires authentication"""
        matrix_data = {
            "origins": [{"lat": -15.7801, "lng": -47.8827}],
            "destinations": [{"lat": -15.8267, "lng": -47.8934}]
        }
        
        # Test without token
        status, data = await self.make_request('POST', '/maps/distance-matrix', matrix_data, None)
        
        # Should return 401 or 403 for unauthenticated request
        success = status in [401, 403]
        details = f"Status: {status}, Expected: 401 or 403, Response: {data}"
        
        self.log_test("Maps Distance Matrix - Authentication Required", success, details)
        return success
        
    async def test_maps_geocode_asa_norte(self):
        """Test GET /api/maps/geocode/{address} - Asa Norte"""
        address = "asa norte"
        
        status, data = await self.make_request('GET', f'/maps/geocode/{address}', None, self.tokens['passenger'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200:
            # Check response structure
            results = data.get('results', [])
            status_field = data.get('status', '')
            
            if status_field == 'OK' and len(results) > 0:
                result = results[0]
                required_fields = ['formatted_address', 'geometry', 'place_id', 'types']
                has_required_fields = all(field in result for field in required_fields)
                
                if has_required_fields:
                    # Check geometry has location with lat/lng
                    geometry = result.get('geometry', {})
                    location = geometry.get('location', {})
                    has_coordinates = 'lat' in location and 'lng' in location
                    
                    # Check coordinates are reasonable for Brasília
                    if has_coordinates:
                        lat = location['lat']
                        lng = location['lng']
                        # Brasília coordinates should be around -15.7 to -16.1 lat, -47.8 to -48.1 lng
                        coords_reasonable = (-16.1 <= lat <= -15.6) and (-48.2 <= lng <= -47.7)
                        
                        # Check address contains Brasília
                        formatted_address = result.get('formatted_address', '').lower()
                        has_brasilia = 'brasília' in formatted_address or 'brasilia' in formatted_address
                        
                        success = coords_reasonable and has_brasilia
                        details = f"Status: {status}, Coords: ({lat}, {lng}), Reasonable: {coords_reasonable}, Has Brasília: {has_brasilia}"
                    else:
                        details = f"Status: {status}, Missing coordinates in geometry"
                else:
                    missing_fields = [field for field in required_fields if field not in result]
                    details = f"Status: {status}, Missing fields: {missing_fields}"
            else:
                details = f"Status: {status}, API Status: {status_field}, Results: {len(results)}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Maps Geocode - Asa Norte", success, details)
        return success
        
    async def test_maps_geocode_taguatinga(self):
        """Test GET /api/maps/geocode/{address} - Taguatinga"""
        address = "taguatinga"
        
        status, data = await self.make_request('GET', f'/maps/geocode/{address}', None, self.tokens['driver'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200:
            results = data.get('results', [])
            status_field = data.get('status', '')
            
            if status_field == 'OK' and len(results) > 0:
                result = results[0]
                geometry = result.get('geometry', {})
                location = geometry.get('location', {})
                
                if 'lat' in location and 'lng' in location:
                    lat = location['lat']
                    lng = location['lng']
                    # Taguatinga should be around -15.8, -48.0
                    coords_reasonable = (-16.0 <= lat <= -15.7) and (-48.2 <= lng <= -47.9)
                    
                    formatted_address = result.get('formatted_address', '').lower()
                    has_taguatinga = 'taguatinga' in formatted_address
                    
                    success = coords_reasonable and has_taguatinga
                    details = f"Status: {status}, Coords: ({lat}, {lng}), Has Taguatinga: {has_taguatinga}"
                else:
                    details = f"Status: {status}, Missing coordinates"
            else:
                details = f"Status: {status}, API Status: {status_field}, Results: {len(results)}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Maps Geocode - Taguatinga", success, details)
        return success
        
    async def test_maps_geocode_authentication_required(self):
        """Test GET /api/maps/geocode/{address} requires authentication"""
        address = "brasilia"
        
        # Test without token
        status, data = await self.make_request('GET', f'/maps/geocode/{address}', None, None)
        
        # Should return 401 or 403 for unauthenticated request
        success = status in [401, 403]
        details = f"Status: {status}, Expected: 401 or 403, Response: {data}"
        
        self.log_test("Maps Geocode - Authentication Required", success, details)
        return success
        
    async def test_maps_reverse_geocode_asa_sul(self):
        """Test GET /api/maps/reverse-geocode - Asa Sul coordinates"""
        params = {
            "lat": -15.8267,
            "lng": -47.8934
        }
        
        status, data = await self.make_request('GET', '/maps/reverse-geocode', None, self.tokens['passenger'], params)
        
        success = False
        details = f"Status: {status}"
        
        if status == 200:
            results = data.get('results', [])
            status_field = data.get('status', '')
            
            if status_field == 'OK' and len(results) > 0:
                result = results[0]
                required_fields = ['formatted_address', 'geometry', 'place_id', 'types']
                has_required_fields = all(field in result for field in required_fields)
                
                if has_required_fields:
                    formatted_address = result.get('formatted_address', '').lower()
                    # Should contain Brasília and some area reference
                    has_brasilia = 'brasília' in formatted_address or 'brasilia' in formatted_address
                    has_area_info = any(term in formatted_address for term in ['quadra', 'asa', 'sul', 'df'])
                    
                    # Check coordinates match input
                    geometry = result.get('geometry', {})
                    location = geometry.get('location', {})
                    coords_match = (location.get('lat') == -15.8267 and location.get('lng') == -47.8934)
                    
                    success = has_brasilia and has_area_info and coords_match
                    details = f"Status: {status}, Address: {formatted_address[:50]}..., Has Brasília: {has_brasilia}, Has area: {has_area_info}, Coords match: {coords_match}"
                else:
                    missing_fields = [field for field in required_fields if field not in result]
                    details = f"Status: {status}, Missing fields: {missing_fields}"
            else:
                details = f"Status: {status}, API Status: {status_field}, Results: {len(results)}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Maps Reverse Geocode - Asa Sul", success, details)
        return success
        
    async def test_maps_reverse_geocode_gama(self):
        """Test GET /api/maps/reverse-geocode - Gama coordinates"""
        params = {
            "lat": -16.0209,
            "lng": -48.0647
        }
        
        status, data = await self.make_request('GET', '/maps/reverse-geocode', None, self.tokens['driver'], params)
        
        success = False
        details = f"Status: {status}"
        
        if status == 200:
            results = data.get('results', [])
            status_field = data.get('status', '')
            
            if status_field == 'OK' and len(results) > 0:
                result = results[0]
                formatted_address = result.get('formatted_address', '').lower()
                
                # Should contain Gama and Brasília
                has_gama = 'gama' in formatted_address
                has_brasilia = 'brasília' in formatted_address or 'brasilia' in formatted_address
                
                success = has_gama and has_brasilia
                details = f"Status: {status}, Address: {formatted_address[:50]}..., Has Gama: {has_gama}, Has Brasília: {has_brasilia}"
            else:
                details = f"Status: {status}, API Status: {status_field}, Results: {len(results)}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Maps Reverse Geocode - Gama", success, details)
        return success
        
    async def test_maps_reverse_geocode_authentication_required(self):
        """Test GET /api/maps/reverse-geocode requires authentication"""
        params = {
            "lat": -15.7942,
            "lng": -47.8822
        }
        
        # Test without token
        status, data = await self.make_request('GET', '/maps/reverse-geocode', None, None, params)
        
        # Should return 401 or 403 for unauthenticated request
        success = status in [401, 403]
        details = f"Status: {status}, Expected: 401 or 403, Response: {data}"
        
        self.log_test("Maps Reverse Geocode - Authentication Required", success, details)
        return success

    # ==========================================
    # ENHANCED GEOCODING TESTS - REVIEW REQUEST
    # ==========================================
    
    async def test_enhanced_geocoding_asa_norte(self):
        """Test enhanced geocoding - Asa Norte"""
        address = "Asa Norte"
        
        status, data = await self.make_request('GET', f'/maps/geocode/{address}', None, self.tokens['passenger'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200:
            results = data.get('results', [])
            status_field = data.get('status', '')
            
            if status_field == 'OK' and len(results) > 0:
                result = results[0]
                geometry = result.get('geometry', {})
                location = geometry.get('location', {})
                
                if 'lat' in location and 'lng' in location:
                    lat = location['lat']
                    lng = location['lng']
                    # Check coordinates are within Brasília bounds
                    coords_valid = (-16.1 <= lat <= -15.6) and (-48.2 <= lng <= -47.7)
                    
                    formatted_address = result.get('formatted_address', '')
                    has_brasilia_ref = 'Brasília' in formatted_address or 'DF' in formatted_address
                    
                    success = coords_valid and has_brasilia_ref
                    details = f"Status: {status}, Coords: ({lat}, {lng}), Valid: {coords_valid}, Address: {formatted_address}"
                else:
                    details = f"Status: {status}, Missing coordinates in response"
            else:
                details = f"Status: {status}, API Status: {status_field}, Results: {len(results)}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Enhanced Geocoding - Asa Norte", success, details)
        return success
        
    async def test_enhanced_geocoding_w3_sul(self):
        """Test enhanced geocoding - W3 Sul"""
        address = "W3 Sul"
        
        status, data = await self.make_request('GET', f'/maps/geocode/{address}', None, self.tokens['driver'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200:
            results = data.get('results', [])
            status_field = data.get('status', '')
            
            if status_field == 'OK' and len(results) > 0:
                result = results[0]
                geometry = result.get('geometry', {})
                location = geometry.get('location', {})
                
                if 'lat' in location and 'lng' in location:
                    lat = location['lat']
                    lng = location['lng']
                    # Check coordinates are within Brasília bounds
                    coords_valid = (-16.1 <= lat <= -15.6) and (-48.2 <= lng <= -47.7)
                    
                    formatted_address = result.get('formatted_address', '')
                    has_brasilia_ref = 'Brasília' in formatted_address or 'DF' in formatted_address
                    
                    success = coords_valid and has_brasilia_ref
                    details = f"Status: {status}, Coords: ({lat}, {lng}), Valid: {coords_valid}, Address: {formatted_address}"
                else:
                    details = f"Status: {status}, Missing coordinates in response"
            else:
                details = f"Status: {status}, API Status: {status_field}, Results: {len(results)}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Enhanced Geocoding - W3 Sul", success, details)
        return success
        
    async def test_enhanced_geocoding_shopping_conjunto_nacional(self):
        """Test enhanced geocoding - Shopping Conjunto Nacional"""
        address = "Shopping Conjunto Nacional"
        
        status, data = await self.make_request('GET', f'/maps/geocode/{address}', None, self.tokens['admin'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200:
            results = data.get('results', [])
            status_field = data.get('status', '')
            
            if status_field == 'OK' and len(results) > 0:
                result = results[0]
                geometry = result.get('geometry', {})
                location = geometry.get('location', {})
                
                if 'lat' in location and 'lng' in location:
                    lat = location['lat']
                    lng = location['lng']
                    # Check coordinates are within Brasília bounds
                    coords_valid = (-16.1 <= lat <= -15.6) and (-48.2 <= lng <= -47.7)
                    
                    formatted_address = result.get('formatted_address', '')
                    has_brasilia_ref = 'Brasília' in formatted_address or 'DF' in formatted_address
                    
                    success = coords_valid and has_brasilia_ref
                    details = f"Status: {status}, Coords: ({lat}, {lng}), Valid: {coords_valid}, Address: {formatted_address}"
                else:
                    details = f"Status: {status}, Missing coordinates in response"
            else:
                details = f"Status: {status}, API Status: {status_field}, Results: {len(results)}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Enhanced Geocoding - Shopping Conjunto Nacional", success, details)
        return success
        
    async def test_enhanced_geocoding_rua_das_palmeiras(self):
        """Test enhanced geocoding - Rua das Palmeiras, 123"""
        address = "Rua das Palmeiras, 123"
        
        status, data = await self.make_request('GET', f'/maps/geocode/{address}', None, self.tokens['passenger'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200:
            results = data.get('results', [])
            status_field = data.get('status', '')
            
            if status_field == 'OK' and len(results) > 0:
                result = results[0]
                geometry = result.get('geometry', {})
                location = geometry.get('location', {})
                
                if 'lat' in location and 'lng' in location:
                    lat = location['lat']
                    lng = location['lng']
                    # Check coordinates are within Brasília bounds
                    coords_valid = (-16.1 <= lat <= -15.6) and (-48.2 <= lng <= -47.7)
                    
                    formatted_address = result.get('formatted_address', '')
                    has_brasilia_ref = 'Brasília' in formatted_address or 'DF' in formatted_address
                    
                    success = coords_valid and has_brasilia_ref
                    details = f"Status: {status}, Coords: ({lat}, {lng}), Valid: {coords_valid}, Address: {formatted_address}"
                else:
                    details = f"Status: {status}, Missing coordinates in response"
            else:
                details = f"Status: {status}, API Status: {status_field}, Results: {len(results)}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Enhanced Geocoding - Rua das Palmeiras, 123", success, details)
        return success
        
    async def test_enhanced_geocoding_quadra_102_norte(self):
        """Test enhanced geocoding - Quadra 102 Norte"""
        address = "Quadra 102 Norte"
        
        status, data = await self.make_request('GET', f'/maps/geocode/{address}', None, self.tokens['driver'])
        
        success = False
        details = f"Status: {status}"
        
        if status == 200:
            results = data.get('results', [])
            status_field = data.get('status', '')
            
            if status_field == 'OK' and len(results) > 0:
                result = results[0]
                geometry = result.get('geometry', {})
                location = geometry.get('location', {})
                
                if 'lat' in location and 'lng' in location:
                    lat = location['lat']
                    lng = location['lng']
                    # Check coordinates are within Brasília bounds
                    coords_valid = (-16.1 <= lat <= -15.6) and (-48.2 <= lng <= -47.7)
                    
                    formatted_address = result.get('formatted_address', '')
                    has_brasilia_ref = 'Brasília' in formatted_address or 'DF' in formatted_address
                    
                    success = coords_valid and has_brasilia_ref
                    details = f"Status: {status}, Coords: ({lat}, {lng}), Valid: {coords_valid}, Address: {formatted_address}"
                else:
                    details = f"Status: {status}, Missing coordinates in response"
            else:
                details = f"Status: {status}, API Status: {status_field}, Results: {len(results)}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Enhanced Geocoding - Quadra 102 Norte", success, details)
        return success
        
    async def test_maps_directions_invalid_coordinates(self):
        """Test POST /api/maps/directions with invalid coordinates"""
        # Test with coordinates outside Brazil
        route_data = {
            "origin_lat": 40.7128,  # New York
            "origin_lng": -74.0060,
            "destination_lat": 34.0522,  # Los Angeles
            "destination_lng": -118.2437
        }
        
        status, data = await self.make_request('POST', '/maps/directions', route_data, self.tokens['passenger'])
        
        # Should still work but return different route data
        success = status == 200
        details = f"Status: {status}"
        
        if success:
            # Check that it still returns valid structure even with non-Brasília coordinates
            required_fields = ['distance', 'duration', 'steps', 'overview_polyline', 'bounds']
            has_required_fields = all(field in data for field in required_fields)
            success = has_required_fields
            details = f"Status: {status}, Valid structure: {has_required_fields}"
        else:
            details = f"Status: {status}, Response: {data}"
            
        self.log_test("Maps Directions - Invalid Coordinates Handling", success, details)
        return success
        
    async def run_google_maps_scenario(self):
        """Run the complete Google Maps testing scenario"""
        print("\n🗺️  EXECUTING GOOGLE MAPS INTEGRATION TESTING SCENARIO")
        print("=" * 70)
        print("Testing: Google Maps mock endpoints with realistic Brasília data")
        print("Focus: Directions, Distance Matrix, Geocoding, Reverse Geocoding")
        
        # Step 1: Setup users
        print("\nStep 1: Creating test users...")
        if not await self.setup_test_users():
            return False
            
        # Step 2: Test all Google Maps endpoints
        print("Step 2: Testing Google Maps endpoints...")
        
        # Test directions endpoints with realistic Brasília trips
        test1_success = await self.test_maps_directions_asa_norte_to_asa_sul()
        test2_success = await self.test_maps_directions_centro_to_taguatinga()
        test3_success = await self.test_maps_directions_plano_piloto_to_gama()
        test4_success = await self.test_maps_directions_authentication_required()
        
        # Test distance matrix endpoint
        test5_success = await self.test_maps_distance_matrix_multiple_locations()
        test6_success = await self.test_maps_distance_matrix_authentication_required()
        
        # Test geocoding endpoints
        test7_success = await self.test_maps_geocode_asa_norte()
        test8_success = await self.test_maps_geocode_taguatinga()
        test9_success = await self.test_maps_geocode_authentication_required()
        
        # Test reverse geocoding endpoints
        test10_success = await self.test_maps_reverse_geocode_asa_sul()
        test11_success = await self.test_maps_reverse_geocode_gama()
        test12_success = await self.test_maps_reverse_geocode_authentication_required()
        
        # Test error handling
        test13_success = await self.test_maps_directions_invalid_coordinates()
        
        # Test enhanced geocoding - Review Request specific addresses
        print("Step 3: Testing enhanced geocoding with specific Brasília addresses...")
        test14_success = await self.test_enhanced_geocoding_asa_norte()
        test15_success = await self.test_enhanced_geocoding_w3_sul()
        test16_success = await self.test_enhanced_geocoding_shopping_conjunto_nacional()
        test17_success = await self.test_enhanced_geocoding_rua_das_palmeiras()
        test18_success = await self.test_enhanced_geocoding_quadra_102_norte()
        
        results = [test1_success, test2_success, test3_success, test4_success, 
                  test5_success, test6_success, test7_success, test8_success,
                  test9_success, test10_success, test11_success, test12_success,
                  test13_success, test14_success, test15_success, test16_success,
                  test17_success, test18_success]
        
        # Count successful tests
        successful_tests = sum(1 for result in results if result is True)
        total_tests = len(results)
        
        print(f"\nGoogle Maps tests: {successful_tests}/{total_tests} passed")
        return successful_tests == total_tests
        
    async def run_all_tests(self):
        """Run all Google Maps tests"""
        print("🚀 STARTING GOOGLE MAPS INTEGRATION TEST SUITE")
        print("=" * 70)
        print("Focus: Testing Google Maps mock endpoints")
        print("Objetivo: Validar directions, distance-matrix, geocode, reverse-geocode")
        
        await self.setup_session()
        
        try:
            # Basic health check
            if not await self.test_health_check():
                print("❌ Health check failed, aborting tests")
                return
                
            # Run Google Maps scenario
            scenario_success = await self.run_google_maps_scenario()
            
            # Print summary
            print("\n" + "=" * 70)
            print("📊 GOOGLE MAPS INTEGRATION TEST SUMMARY")
            print("=" * 70)
            
            passed = sum(1 for result in self.test_results if result['success'])
            total = len(self.test_results)
            success_rate = (passed / total * 100) if total > 0 else 0
            
            print(f"Total Tests: {total}")
            print(f"Passed: {passed}")
            print(f"Failed: {total - passed}")
            print(f"Success Rate: {success_rate:.1f}%")
            
            if scenario_success:
                print("\n🎉 GOOGLE MAPS INTEGRATION COMPLETELY FUNCTIONAL!")
                print("✅ POST /api/maps/directions - Route planning with realistic Brasília directions")
                print("✅ POST /api/maps/distance-matrix - Multiple location distance calculations")
                print("✅ GET /api/maps/geocode/{address} - Address to coordinates conversion")
                print("✅ GET /api/maps/reverse-geocode - Coordinates to address conversion")
                print("✅ Authentication validation - All endpoints properly secured")
                print("✅ Realistic Brasília data - Mock responses contain accurate local information")
                print("\n🗺️  TESTED TRIP SCENARIOS:")
                print("   ✅ Asa Norte → Asa Sul (short urban trip)")
                print("   ✅ Centro → Taguatinga (medium distance trip)")
                print("   ✅ Plano Piloto → Gama (long distance trip)")
                print("   ✅ Common Brasília locations geocoding")
                print("   ✅ Error handling with invalid data")
                print("\n🎯 ENHANCED GEOCODING SYSTEM TESTED:")
                print("   ✅ 'Asa Norte' - Returns valid Brasília coordinates")
                print("   ✅ 'W3 Sul' - Returns valid Brasília coordinates")
                print("   ✅ 'Shopping Conjunto Nacional' - Returns valid Brasília coordinates")
                print("   ✅ 'Rua das Palmeiras, 123' - Returns valid Brasília coordinates")
                print("   ✅ 'Quadra 102 Norte' - Returns valid Brasília coordinates")
                print("\n🔧 BACKEND GOOGLE MAPS FEATURES WORKING:")
                print("   - Realistic turn-by-turn directions for Brasília")
                print("   - Distance and duration calculations")
                print("   - Multi-point distance matrix calculations")
                print("   - Address geocoding with Brasília landmarks")
                print("   - Enhanced geocoding accepts any address and returns valid Brasília location")
                print("   - Coordinate reverse geocoding")
                print("   - Proper authentication on all endpoints")
            else:
                print("\n⚠️  Some Google Maps integration issues detected")
                
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
    test_suite = GoogleMapsTestSuite()
    await test_suite.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())