// =============================================================================
// FRONTEND - INTEGRAÇÃO DO CHAT NO DASHBOARD DO MOTORISTA
// Arquivo: frontend/app/driver/dashboard.tsx
// =============================================================================

// ===== ADIÇÕES NO IMPORT (no topo do arquivo) =====
import ChatComponent from '../../components/ChatComponent';

// ===== ADIÇÃO NOS ESTADOS (após os outros estados) =====
// Chat states
const [showChatModal, setShowChatModal] = useState(false);

// ===== MODIFICAÇÃO NA SEÇÃO DE BOTÕES DE AÇÃO DA VIAGEM ATUAL =====
// Substituir a seção "Report Passenger Button" por:

{/* Action Buttons */}
{(currentTrip.status === 'in_progress' || currentTrip.status === 'accepted') && (
  <View style={styles.actionButtonsContainer}>
    <TouchableOpacity
      style={[styles.chatButton]}
      onPress={() => setShowChatModal(true)}
    >
      <Ionicons name="chatbubble" size={16} color="#fff" />
      <Text style={styles.chatButtonText}>Chat</Text>
    </TouchableOpacity>
    
    <TouchableOpacity
      style={[styles.reportButton]}
      onPress={handleReportPassenger}
    >
      <Ionicons name="flag" size={16} color="#fff" />
      <Text style={styles.reportButtonText}>Reportar Passageiro</Text>
    </TouchableOpacity>
  </View>
)}

// ===== ADIÇÃO DO CHAT COMPONENT (antes do fechamento do SafeAreaView) =====
{/* Chat Component */}
{currentTrip && (
  <ChatComponent
    tripId={currentTrip.id}
    currentUserId={user?.id || ''}
    currentUserType="driver"
    visible={showChatModal}
    onClose={() => setShowChatModal(false)}
  />
)}

// ===== ADIÇÕES NOS ESTILOS (na seção StyleSheet.create) =====
// Adicionar novos estilos:

actionButtonsContainer: {
  flexDirection: 'row',
  gap: 12,
},
chatButton: {
  backgroundColor: '#2196F3',
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 8,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  flex: 1,
},
chatButtonText: {
  fontSize: 14,
  fontWeight: 'bold',
  color: '#fff',
},
// Modificar o reportButton existente para:
reportButton: {
  backgroundColor: '#FF9800',
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 8,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  flex: 1,
},