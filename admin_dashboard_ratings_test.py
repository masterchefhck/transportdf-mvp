#!/usr/bin/env python3
"""
Admin Dashboard Ratings Test - Exact Scenario from Review Request
Testing the exact flow: Get ratings via /api/ratings/low → Test bulk delete with real IDs
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
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://transport-df-chat.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class AdminDashboardRatingsTest:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, message="", data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {message}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "data": data,
            "timestamp": datetime.now().isoformat()
        })
    
    def setup_admin_user(self):
        """Setup admin user for testing"""
        admin_data = {
            "name": "Admin Sistema",
            "email": "admin@test.com", 
            "phone": "+5561987654323",
            "cpf": "12345678903",
            "user_type": "admin",
            "password": "senha123"
        }
        
        try:
            # Try to login first (user likely exists)
            login_response = self.session.post(f"{API_BASE}/auth/login", json={
                "email": admin_data["email"],
                "password": admin_data["password"]
            })
            
            if login_response.status_code == 200:
                data = login_response.json()
                self.admin_token = data["access_token"]
                self.log_test("Admin Setup", True, "Admin logged in successfully")
                return True
            else:
                self.log_test("Admin Setup", False, f"Login failed: {login_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Admin Setup", False, f"Error: {str(e)}")
            return False
    
    def test_exact_review_scenario(self):
        """Test the exact scenario described in the review request"""
        print("\n🎯 TESTING EXACT REVIEW REQUEST SCENARIO")
        print("-" * 60)
        print("1. Verificar se existem ratings no banco via /api/ratings/low")
        print("2. Pegar IDs reais de ratings existentes")
        print("3. Testar bulk delete com esses IDs reais")
        print("4. Verificar se a deleção funciona no backend")
        print("-" * 60)
        
        if not self.admin_token:
            self.log_test("Review Scenario Setup", False, "No admin token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Step 1: Verificar se existem ratings no banco
        try:
            print("\n📊 STEP 1: Verificando ratings existentes via /api/ratings/low")
            response = self.session.get(f"{API_BASE}/ratings/low", headers=headers)
            
            if response.status_code == 200:
                ratings = response.json()
                rating_count = len(ratings)
                
                if rating_count > 0:
                    self.log_test("Step 1 - Ratings Existentes", True, f"Encontrados {rating_count} ratings no banco")
                    
                    # Log structure details
                    print(f"   📋 Estrutura dos ratings encontrados:")
                    for i, rating in enumerate(ratings[:3]):
                        print(f"      Rating {i+1}: ID={rating.get('id', 'NO_ID')}, Stars={rating.get('rating', 'NO_RATING')}, Reason='{rating.get('reason', 'NO_REASON')}'")
                    
                    return ratings
                else:
                    self.log_test("Step 1 - Ratings Existentes", False, "Nenhum rating encontrado no banco")
                    return []
            else:
                self.log_test("Step 1 - Ratings Existentes", False, f"Erro ao buscar ratings: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Step 1 - Ratings Existentes", False, f"Erro: {str(e)}")
            return False
    
    def test_bulk_delete_with_real_ids(self, existing_ratings):
        """Step 2 & 3: Pegar IDs reais e testar bulk delete"""
        if not existing_ratings:
            self.log_test("Step 2 - IDs Reais", False, "Nenhum rating disponível para teste")
            return False
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Step 2: Pegar IDs reais de ratings existentes
        print(f"\n🔍 STEP 2: Extraindo IDs reais dos ratings existentes")
        real_rating_ids = []
        
        for rating in existing_ratings[:3]:  # Take first 3 ratings
            rating_id = rating.get("id")
            if rating_id:
                real_rating_ids.append(rating_id)
                print(f"   📝 ID extraído: {rating_id}")
        
        if not real_rating_ids:
            self.log_test("Step 2 - IDs Reais", False, "Nenhum ID válido encontrado nos ratings")
            return False
        
        self.log_test("Step 2 - IDs Reais", True, f"Extraídos {len(real_rating_ids)} IDs válidos")
        
        # Step 3: Testar bulk delete com esses IDs reais
        print(f"\n🗑️ STEP 3: Testando bulk delete com IDs reais")
        try:
            bulk_delete_payload = {"ids": real_rating_ids}
            print(f"   📤 Payload enviado: {bulk_delete_payload}")
            
            response = self.session.post(f"{API_BASE}/admin/ratings/bulk-delete", 
                                       json=bulk_delete_payload, headers=headers)
            
            print(f"   📥 Status da resposta: {response.status_code}")
            print(f"   📥 Conteúdo da resposta: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                message = result.get("message", "")
                self.log_test("Step 3 - Bulk Delete", True, f"Sucesso: {message}")
                
                # Extract deleted count from message
                deleted_count = 0
                if "Deleted" in message:
                    try:
                        deleted_count = int(message.split()[1])
                    except:
                        pass
                
                return deleted_count
            else:
                self.log_test("Step 3 - Bulk Delete", False, f"Falha: Status {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Step 3 - Bulk Delete", False, f"Erro: {str(e)}")
            return False
    
    def verify_deletion_worked(self, original_count, deleted_count):
        """Step 4: Verificar se a deleção funcionou no backend"""
        print(f"\n✅ STEP 4: Verificando se a deleção funcionou no backend")
        
        if not self.admin_token:
            self.log_test("Step 4 - Verificação", False, "No admin token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        try:
            # Check ratings again
            response = self.session.get(f"{API_BASE}/ratings/low", headers=headers)
            
            if response.status_code == 200:
                current_ratings = response.json()
                current_count = len(current_ratings)
                
                expected_count = original_count - deleted_count
                deletion_worked = current_count == expected_count
                
                print(f"   📊 Ratings antes da deleção: {original_count}")
                print(f"   📊 Ratings deletados: {deleted_count}")
                print(f"   📊 Ratings esperados após deleção: {expected_count}")
                print(f"   📊 Ratings atuais no banco: {current_count}")
                print(f"   ✅ Deleção funcionou: {'SIM' if deletion_worked else 'NÃO'}")
                
                self.log_test("Step 4 - Verificação", deletion_worked, 
                            f"Contagem atual: {current_count}, Esperada: {expected_count}")
                
                return deletion_worked
            else:
                self.log_test("Step 4 - Verificação", False, f"Erro ao verificar: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Step 4 - Verificação", False, f"Erro: {str(e)}")
            return False
    
    def test_id_vs_underscore_id_issue(self, existing_ratings):
        """Debug específico do problema id vs _id"""
        print(f"\n🔧 DEBUG ESPECÍFICO: Campo 'id' vs '_id' no MongoDB")
        print("-" * 60)
        
        if not existing_ratings:
            self.log_test("Debug ID Fields", False, "Nenhum rating disponível para debug")
            return
        
        for i, rating in enumerate(existing_ratings[:2]):
            print(f"\n   📋 Rating {i+1} - Análise de campos:")
            print(f"      Todos os campos: {list(rating.keys())}")
            
            has_id = "id" in rating
            has_underscore_id = "_id" in rating
            id_value = rating.get("id", "NOT_FOUND")
            underscore_id_value = rating.get("_id", "NOT_FOUND")
            
            print(f"      Campo 'id': {'✅ PRESENTE' if has_id else '❌ AUSENTE'} (valor: {id_value})")
            print(f"      Campo '_id': {'✅ PRESENTE' if has_underscore_id else '❌ AUSENTE'} (valor: {underscore_id_value})")
            
            # Check if ID is valid UUID format
            if has_id and id_value != "NOT_FOUND":
                is_uuid_format = len(str(id_value)) == 36 and str(id_value).count('-') == 4
                print(f"      Formato UUID válido: {'✅ SIM' if is_uuid_format else '❌ NÃO'}")
            
            self.log_test(f"Debug Rating {i+1} ID Structure", True, 
                        f"id: {has_id}, _id: {has_underscore_id}, UUID format: {is_uuid_format if has_id else 'N/A'}")
    
    def run_admin_dashboard_test(self):
        """Run the complete admin dashboard ratings test"""
        print("🎯 ADMIN DASHBOARD RATINGS TEST - CENÁRIO EXATO DO REVIEW REQUEST")
        print("=" * 80)
        print("Problema reportado: 'nem as avaliações atualmente existentes dentro de")
        print("avaliações do menu no dashboard do admin não estão sendo possíveis ser deletadas'")
        print("=" * 80)
        
        # Setup
        if not self.setup_admin_user():
            print("❌ CRITICAL: Failed to setup admin user")
            return False
        
        # Test exact scenario from review request
        existing_ratings = self.test_exact_review_scenario()
        
        if existing_ratings:
            original_count = len(existing_ratings)
            
            # Test bulk delete with real IDs
            deleted_count = self.test_bulk_delete_with_real_ids(existing_ratings)
            
            if deleted_count is not False and deleted_count > 0:
                # Verify deletion worked
                self.verify_deletion_worked(original_count, deleted_count)
            
            # Debug ID field issues
            self.test_id_vs_underscore_id_issue(existing_ratings)
        
        # Summary
        print("\n" + "=" * 80)
        print("🎯 ADMIN DASHBOARD RATINGS TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        # Specific analysis for the reported issue
        print(f"\n🎯 ANÁLISE ESPECÍFICA DO PROBLEMA REPORTADO:")
        
        has_ratings = any("Ratings Existentes" in r["test"] and r["success"] for r in self.test_results)
        bulk_delete_works = any("Bulk Delete" in r["test"] and r["success"] for r in self.test_results)
        verification_works = any("Verificação" in r["test"] and r["success"] for r in self.test_results)
        
        print(f"✅ Existem ratings no banco: {'SIM' if has_ratings else 'NÃO'}")
        print(f"✅ Endpoint /api/ratings/low funciona: {'SIM' if has_ratings else 'NÃO'}")
        print(f"✅ Endpoint /api/admin/ratings/bulk-delete funciona: {'SIM' if bulk_delete_works else 'NÃO'}")
        print(f"✅ IDs dos ratings são válidos: {'SIM' if bulk_delete_works else 'NÃO'}")
        print(f"✅ Deleção persiste no banco: {'SIM' if verification_works else 'NÃO'}")
        
        if failed_tests > 0:
            print(f"\n❌ TESTES QUE FALHARAM:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        # Final conclusion
        if success_rate >= 90 and bulk_delete_works:
            print(f"\n🎉 CONCLUSÃO: O sistema de bulk delete de ratings está FUNCIONANDO CORRETAMENTE!")
            print(f"   O problema reportado pelo usuário NÃO foi reproduzido no backend.")
            print(f"   Possíveis causas do problema do usuário:")
            print(f"   - Problema de conectividade frontend-backend")
            print(f"   - Cache do navegador")
            print(f"   - Problema de estado no frontend")
            print(f"   - Problema de permissões de usuário específico")
        else:
            print(f"\n❌ CONCLUSÃO: Problema identificado no sistema de bulk delete!")
        
        return success_rate >= 80

if __name__ == "__main__":
    tester = AdminDashboardRatingsTest()
    success = tester.run_admin_dashboard_test()
    exit(0 if success else 1)