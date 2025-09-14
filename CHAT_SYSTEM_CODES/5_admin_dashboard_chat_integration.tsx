// =============================================================================
// FRONTEND - INTEGRAÇÃO DO CHAT NO DASHBOARD DO ADMINISTRADOR
// Arquivo: frontend/app/admin/dashboard.tsx
// =============================================================================

// ===== MODIFICAÇÃO NO ESTADO ACTIVE TAB =====
// Alterar a linha do useState do activeTab para:
const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'trips' | 'reports' | 'ratings' | 'messages' | 'chats'>('stats');

// ===== ADIÇÃO DO ESTADO PARA CHATS =====
// Adicionar após os outros estados:
const [chats, setChats] = useState([]);

// ===== ADIÇÃO DA FUNÇÃO PARA CARREGAR CHATS =====
// Adicionar após as outras funções de carregamento:
const loadChats = async () => {
  try {
    const token = await AsyncStorage.getItem('access_token');
    const response = await axios.get(`${API_URL}/api/admin/chats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setChats(response.data);
  } catch (error) {
    console.log('Error loading chats:', error);
  }
};

// ===== MODIFICAÇÃO NO useEffect =====
// Adicionar loadChats() na função useEffect inicial:
useEffect(() => {
  loadUsers();
  loadTrips();
  loadReports();
  loadRatings(); 
  loadMessages();
  loadChats(); // <- ADICIONAR ESTA LINHA
}, []);

// ===== ADIÇÃO DA FUNÇÃO RENDER CHATS =====
// Adicionar após as outras funções render:
const renderChats = () => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Chat Motorista/Passageiro</Text>
    <Text style={styles.sectionSubtitle}>
      Conversas entre motoristas e passageiros durante viagens
    </Text>
    
    {chats.length === 0 ? (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={60} color="#666" />
        <Text style={styles.emptyText}>Nenhuma conversa encontrada</Text>
        <Text style={styles.emptySubtext}>
          As conversas aparecerão aqui quando passageiros e motoristas utilizarem o chat
        </Text>
      </View>
    ) : (
      <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
        {chats.map((chat, index) => (
          <View key={index} style={styles.chatItem}>
            <View style={styles.chatHeader}>
              <View style={styles.tripInfo}>
                <Text style={styles.tripRoute}>
                  {chat.pickup_address} → {chat.destination_address}
                </Text>
                <Text style={styles.tripStatus}>Status: {chat.trip_status}</Text>
              </View>
              <Text style={styles.messageCount}>
                {chat.message_count} mensagens
              </Text>
            </View>
            
            <View style={styles.participantsRow}>
              <View style={styles.participant}>
                <Text style={styles.participantLabel}>👤 Passageiro:</Text>
                <Text style={styles.participantName}>{chat.passenger_name}</Text>
              </View>
              <View style={styles.participant}>
                <Text style={styles.participantLabel}>🚗 Motorista:</Text>
                <Text style={styles.participantName}>{chat.driver_name}</Text>
              </View>
            </View>
            
            <View style={styles.lastMessage}>
              <Text style={styles.lastMessageLabel}>Última mensagem:</Text>
              <Text style={styles.lastMessageText} numberOfLines={2}>
                {chat.last_message}
              </Text>
              <Text style={styles.lastMessageTime}>
                {new Date(chat.last_timestamp).toLocaleString('pt-BR')}
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.viewChatButton}
              onPress={() => {
                showAlert('Chat Detalhado', `Conversa da viagem:\n${chat.pickup_address} → ${chat.destination_address}\n\nPassageiro: ${chat.passenger_name}\nMotorista: ${chat.driver_name}\nMensagens: ${chat.message_count}`);
              }}
            >
              <Ionicons name="eye" size={16} color="#fff" />
              <Text style={styles.viewChatButtonText}>Ver Conversa</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    )}
  </View>
);

// ===== ADIÇÃO DA ABA CHAT M/P NAS TABS =====
// Adicionar após as outras abas, antes da aba "Viagens":
<TouchableOpacity
  style={[styles.tab, activeTab === 'chats' && styles.activeTab]}
  onPress={() => setActiveTab('chats')}
>
  <Text style={[styles.tabText, activeTab === 'chats' && styles.activeTabText]}>
    Chat M/P
  </Text>
</TouchableOpacity>

// ===== ADIÇÃO DO RENDER CHATS NO SWITCH =====
// Adicionar após as outras renderizações:
{activeTab === 'chats' && renderChats()}

// ===== ADIÇÕES NOS ESTILOS (na seção StyleSheet.create) =====
// Adicionar os seguintes estilos:

chatItem: {
  backgroundColor: '#2a2a2a',
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
  borderLeftWidth: 4,
  borderLeftColor: '#2196F3',
},
chatHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 12,
},
tripInfo: {
  flex: 1,
},
tripRoute: {
  color: '#fff',
  fontSize: 14,
  fontWeight: 'bold',
  marginBottom: 4,
},
tripStatus: {
  color: '#4CAF50',
  fontSize: 12,
  textTransform: 'capitalize',
},
messageCount: {
  color: '#2196F3',
  fontSize: 12,
  fontWeight: 'bold',
},
participantsRow: {
  flexDirection: 'row',
  marginBottom: 12,
  gap: 16,
},
participant: {
  flex: 1,
},
participantLabel: {
  color: '#888',
  fontSize: 12,
  marginBottom: 2,
},
participantName: {
  color: '#fff',
  fontSize: 14,
  fontWeight: 'bold',
},
lastMessage: {
  marginBottom: 12,
},
lastMessageLabel: {
  color: '#888',
  fontSize: 12,
  marginBottom: 4,
},
lastMessageText: {
  color: '#fff',
  fontSize: 14,
  marginBottom: 4,
},
lastMessageTime: {
  color: '#666',
  fontSize: 11,
},
viewChatButton: {
  backgroundColor: '#2196F3',
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 6,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  alignSelf: 'flex-start',
},
viewChatButtonText: {
  color: '#fff',
  fontSize: 12,
  fontWeight: 'bold',
},