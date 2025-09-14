// =============================================================================
// FRONTEND - INTEGRAÇÃO DO CHAT NO DASHBOARD DO PASSAGEIRO
// Arquivo: frontend/app/passenger/dashboard.tsx
// =============================================================================

// ===== ADIÇÕES NO IMPORT (no topo do arquivo) =====
import ChatComponent from '../../components/ChatComponent';

// ===== ADIÇÃO NOS ESTADOS (após os outros estados) =====
// Chat states
const [showChatModal, setShowChatModal] = useState(false);

// ===== MODIFICAÇÃO NA SEÇÃO DE BOTÕES DE AÇÃO DA VIAGEM ATUAL =====
// Substituir a seção dos botões de ação por:

{/* Action Buttons */}
{(currentTrip.status === 'accepted' || currentTrip.status === 'in_progress') && currentTrip.driver_id && (
  <View style={styles.tripActions}>
    <TouchableOpacity
      style={styles.chatButton}
      onPress={() => setShowChatModal(true)}
    >
      <Ionicons name="chatbubble" size={16} color="#fff" />
      <Text style={styles.chatButtonText}>Chat</Text>
    </TouchableOpacity>
    
    <TouchableOpacity
      style={styles.reportButton}
      onPress={handleReportDriver}
    >
      <Ionicons name="flag" size={16} color="#fff" />
      <Text style={styles.reportButtonText}>Reportar Motorista</Text>
    </TouchableOpacity>
  </View>
)}

// ===== ADIÇÃO DO CHAT COMPONENT (antes do fechamento do SafeAreaView) =====
{/* Chat Component */}
{currentTrip && (
  <ChatComponent
    tripId={currentTrip.id}
    currentUserId={user?.id || ''}
    currentUserType="passenger"
    visible={showChatModal}
    onClose={() => setShowChatModal(false)}
  />
)}

// ===== ADIÇÕES NOS ESTILOS (na seção StyleSheet.create) =====
// Modificar o estilo tripActions e adicionar novos estilos:

tripActions: {
  marginTop: 16,
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