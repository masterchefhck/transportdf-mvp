import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
  Modal,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Utility functions for cross-platform alerts
const showAlert = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    if (message) {
      window.alert(`${title}\n\n${message}`);
    } else {
      window.alert(title);
    }
  } else {
    Alert.alert(title, message);
  }
};

const showConfirm = (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  } else {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: onCancel },
        { text: 'Confirmar', onPress: onConfirm },
      ]
    );
  }
};

interface User {
  id: string;
  name: string;
  email: string;
  user_type: string;
}

interface Trip {
  id: string;
  passenger_id: string;
  driver_id?: string;
  pickup_address: string;
  destination_address: string;
  estimated_price: number;
  status: string;
  requested_at: string;
}

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  trip_id?: string;
  title: string;
  description: string;
  report_type: string;
  status: string;
  created_at: string;
  admin_message?: string;
  user_response?: string;
  response_allowed: boolean;
}

export default function DriverDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Report states
  const [myReports, setMyReports] = useState<Report[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [showReportsPanel, setShowReportsPanel] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [responseText, setResponseText] = useState('');

  // Alert states
  const [myAlerts, setMyAlerts] = useState<any[]>([]);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);

  useEffect(() => {
    loadUserData();
    requestLocationPermission();
    loadMyReports();
    loadMyAlerts();
    if (isOnline) {
      loadAvailableTrips();
      checkCurrentTrip();
    }
  }, [isOnline]);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }

      // Load saved online status
      const savedStatus = await AsyncStorage.getItem('driver_online_status');
      if (savedStatus) {
        setIsOnline(JSON.parse(savedStatus));
      }
    } catch (error) {
      console.log('Error loading user data:', error);
    }
  };

  const loadMyReports = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/reports/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyReports(response.data);
    } catch (error) {
      console.log('Error loading reports:', error);
    }
  };

  const loadMyAlerts = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/drivers/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyAlerts(response.data);
    } catch (error) {
      console.log('Error loading alerts:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Erro', 'Permissão de localização necessária');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Update user location on server
      const token = await AsyncStorage.getItem('access_token');
      await axios.put(
        `${API_URL}/api/users/location`,
        {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  const handleOnlineToggle = async (value: boolean) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const status = value ? 'online' : 'offline';
      
      await axios.put(
        `${API_URL}/api/drivers/status/${status}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setIsOnline(value);
      await AsyncStorage.setItem('driver_online_status', JSON.stringify(value));

      if (value) {
        loadAvailableTrips();
        checkCurrentTrip();
      } else {
        setAvailableTrips([]);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showAlert('Erro', 'Erro ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTrips = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/trips/available`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAvailableTrips(response.data);
    } catch (error) {
      console.log('Error loading available trips:', error);
    }
  };

  const checkCurrentTrip = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/trips/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const activeTrip = response.data.find(
        (trip: Trip) => trip.status === 'accepted' || trip.status === 'in_progress'
      );

      setCurrentTrip(activeTrip || null);
    } catch (error) {
      console.log('Error checking current trip:', error);
    }
  };

  const handleAcceptTrip = async (tripId: string) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.put(
        `${API_URL}/api/trips/${tripId}/accept`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showAlert('Sucesso', 'Viagem aceita!');
      loadAvailableTrips();
      checkCurrentTrip();
    } catch (error) {
      console.error('Error accepting trip:', error);
      showAlert('Erro', 'Erro ao aceitar viagem');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrip = async () => {
    if (!currentTrip) return;

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.put(
        `${API_URL}/api/trips/${currentTrip.id}/start`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showAlert('Sucesso', 'Viagem iniciada!');
      checkCurrentTrip();
    } catch (error) {
      console.error('Error starting trip:', error);
      showAlert('Erro', 'Erro ao iniciar viagem');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTrip = async () => {
    if (!currentTrip) return;

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.put(
        `${API_URL}/api/trips/${currentTrip.id}/complete`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showAlert('Sucesso', 'Viagem concluída!');
      setCurrentTrip(null);
      loadAvailableTrips();
    } catch (error) {
      console.error('Error completing trip:', error);
      showAlert('Erro', 'Erro ao concluir viagem');
    } finally {
      setLoading(false);
    }
  };

  const handleReportPassenger = () => {
    if (!currentTrip) {
      showAlert('Erro', 'Não há passageiro para reportar nesta viagem');
      return;
    }
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!reportTitle.trim() || !reportDescription.trim() || !currentTrip) {
      showAlert('Erro', 'Preencha todos os campos');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/reports/create`,
        {
          reported_user_id: currentTrip.passenger_id,
          trip_id: currentTrip.id,
          title: reportTitle,
          description: reportDescription,
          report_type: 'driver_report'
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showAlert('Sucesso', 'Report enviado com sucesso!');
      setShowReportModal(false);
      setReportTitle('');
      setReportDescription('');
      loadMyReports();
    } catch (error) {
      console.error('Error submitting report:', error);
      showAlert('Erro', 'Erro ao enviar report');
    }
  };

  const handleRespondToReport = (report: Report) => {
    setSelectedReport(report);
    setShowResponseModal(true);
  };

  const submitResponse = async () => {
    if (!responseText.trim() || !selectedReport) {
      showAlert('Erro', 'Digite sua resposta');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/reports/${selectedReport.id}/respond`,
        { response: responseText },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showAlert('Sucesso', 'Resposta enviada com sucesso!');
      setShowResponseModal(false);
      setResponseText('');
      loadMyReports();
    } catch (error) {
      console.error('Error submitting response:', error);
      showAlert('Erro', 'Erro ao enviar resposta');
    }
  };

  const handleLogout = async () => {
    showConfirm(
      'Sair',
      'Tem certeza que deseja sair?',
      async () => {
        try {
          await AsyncStorage.multiRemove(['access_token', 'user', 'driver_online_status']);
          router.replace('/driver');
        } catch (error) {
          console.error('Error during logout:', error);
          router.replace('/driver');
        }
      }
    );
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted': return 'Viagem aceita - Indo ao local';
      case 'in_progress': return 'Viagem em andamento';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return '#2196F3';
      case 'in_progress': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'under_review': return '#2196F3';
      case 'resolved': return '#4CAF50';
      case 'dismissed': return '#666';
      default: return '#666';
    }
  };

  const pendingReports = myReports.filter(report => report.response_allowed && report.admin_message);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="car" size={24} color="#fff" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.welcomeText}>Olá, {user?.name || 'Motorista'}</Text>
            <Text style={styles.statusText}>
              Status: {isOnline ? '🟢 Online' : '🔴 Offline'}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {pendingReports.length > 0 && (
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => setShowReportsPanel(true)}
            >
              <Ionicons name="notifications" size={24} color="#FF9800" />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>{pendingReports.length}</Text>
              </View>
            </TouchableOpacity>
          )}
          {myAlerts.length > 0 && (
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => setShowAlertsPanel(true)}
            >
              <Ionicons name="warning" size={24} color="#f44336" />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>{myAlerts.length}</Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.onlineToggle}>
        <Text style={styles.toggleLabel}>Disponível para viagens:</Text>
        <Switch
          value={isOnline}
          onValueChange={handleOnlineToggle}
          trackColor={{ false: '#767577', true: '#4CAF50' }}
          thumbColor={isOnline ? '#fff' : '#f4f3f4'}
          disabled={loading}
        />
        {loading && (
          <ActivityIndicator size="small" color="#4CAF50" style={{ marginLeft: 10 }} />
        )}
      </View>

      <View style={styles.mainContent}>
        {currentTrip ? (
          <View style={styles.currentTripCard}>
            <View style={styles.tripHeader}>
              <Ionicons name="car" size={24} color="#4CAF50" />
              <Text style={styles.tripTitle}>Viagem Atual</Text>
            </View>
            
            <View style={styles.tripDetails}>
              <View style={styles.addressRow}>
                <Ionicons name="radio-button-on" size={16} color="#4CAF50" />
                <Text style={styles.addressText}>{currentTrip.pickup_address}</Text>
              </View>
              <View style={styles.addressRow}>
                <Ionicons name="location" size={16} color="#f44336" />
                <Text style={styles.addressText}>{currentTrip.destination_address}</Text>
              </View>
            </View>

            <View style={styles.tripStatus}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentTrip.status) }]}>
                <Text style={styles.statusText}>{getStatusText(currentTrip.status)}</Text>
              </View>
              <Text style={styles.priceText}>R$ {currentTrip.estimated_price.toFixed(2)}</Text>
            </View>

            <View style={styles.tripActions}>
              {currentTrip.status === 'accepted' && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleStartTrip}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>Iniciar Viagem</Text>
                  )}
                </TouchableOpacity>
              )}
              
              {currentTrip.status === 'in_progress' && (
                <>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleCompleteTrip}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.actionButtonText}>Concluir Viagem</Text>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.reportButton}
                    onPress={handleReportPassenger}
                  >
                    <Ionicons name="flag" size={16} color="#fff" />
                    <Text style={styles.reportButtonText}>Reportar Passageiro</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ) : isOnline ? (
          <View style={styles.availableTripsContainer}>
            <Text style={styles.availableTripsTitle}>Viagens Disponíveis</Text>
            {availableTrips.length === 0 ? (
              <View style={styles.noTripsContainer}>
                <Ionicons name="car-outline" size={80} color="#666" />
                <Text style={styles.noTripsText}>Nenhuma viagem disponível</Text>
                <Text style={styles.noTripsSubtext}>Aguarde novas solicitações...</Text>
              </View>
            ) : (
              availableTrips.map(trip => (
                <View key={trip.id} style={styles.tripCard}>
                  <View style={styles.tripRoute}>
                    <View style={styles.addressRow}>
                      <Ionicons name="radio-button-on" size={16} color="#4CAF50" />
                      <Text style={styles.addressText}>{trip.pickup_address}</Text>
                    </View>
                    <View style={styles.addressRow}>
                      <Ionicons name="location" size={16} color="#f44336" />
                      <Text style={styles.addressText}>{trip.destination_address}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.tripMeta}>
                    <Text style={styles.tripPrice}>R$ {trip.estimated_price.toFixed(2)}</Text>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAcceptTrip(trip.id)}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.acceptButtonText}>Aceitar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.offlineContainer}>
            <Ionicons name="car-outline" size={80} color="#666" />
            <Text style={styles.offlineTitle}>Você está offline</Text>
            <Text style={styles.offlineSubtitle}>
              Ative o modo online para receber viagens
            </Text>
          </View>
        )}
      </View>

      {/* Report Passenger Modal */}
      <Modal visible={showReportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reportar Passageiro</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Descreva o problema ocorrido com o passageiro
            </Text>
            
            <TextInput
              style={styles.reportInput}
              placeholder="Título do report"
              placeholderTextColor="#666"
              value={reportTitle}
              onChangeText={setReportTitle}
            />
            
            <TextInput
              style={[styles.reportInput, styles.textArea]}
              placeholder="Descrição detalhada do problema..."
              placeholderTextColor="#666"
              value={reportDescription}
              onChangeText={setReportDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            <TouchableOpacity style={styles.submitButton} onPress={submitReport}>
              <Text style={styles.submitButtonText}>Enviar Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Response Modal */}
      <Modal visible={showResponseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Responder Report</Text>
              <TouchableOpacity onPress={() => setShowResponseModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {selectedReport && (
              <>
                <Text style={styles.modalSubtitle}>Report: {selectedReport.title}</Text>
                
                {selectedReport.admin_message && (
                  <View style={styles.adminMessageBox}>
                    <Text style={styles.adminMessageLabel}>Mensagem do Administrador:</Text>
                    <Text style={styles.adminMessageText}>{selectedReport.admin_message}</Text>
                  </View>
                )}
                
                <TextInput
                  style={[styles.reportInput, styles.textArea]}
                  placeholder="Digite sua resposta/defesa..."
                  placeholderTextColor="#666"
                  value={responseText}
                  onChangeText={setResponseText}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                
                <TouchableOpacity style={styles.submitButton} onPress={submitResponse}>
                  <Text style={styles.submitButtonText}>Enviar Resposta</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Reports Panel Modal */}
      <Modal visible={showReportsPanel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reports Pendentes</Text>
              <TouchableOpacity onPress={() => setShowReportsPanel(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={pendingReports}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.reportItem}>
                  <View style={styles.reportItemHeader}>
                    <Text style={styles.reportItemTitle}>{item.title}</Text>
                    <View style={[styles.reportStatusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                      <Text style={styles.reportStatusText}>
                        {item.status === 'pending' ? 'Pendente' : 'Em Análise'}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.reportItemDescription}>{item.description}</Text>
                  
                  {item.admin_message && item.response_allowed && (
                    <TouchableOpacity
                      style={styles.respondButton}
                      onPress={() => handleRespondToReport(item)}
                    >
                      <Ionicons name="chatbubble" size={16} color="#fff" />
                      <Text style={styles.respondButtonText}>Responder</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* Alerts Panel Modal */}
      <Modal visible={showAlertsPanel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Alertas do Administrador</Text>
              <TouchableOpacity onPress={() => setShowAlertsPanel(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={myAlerts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.alertItem}>
                  <View style={styles.alertHeader}>
                    <View style={styles.alertStarsContainer}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <Ionicons
                          key={star}
                          name={star <= item.rating_stars ? "star" : "star-outline"}
                          size={16}
                          color={star <= item.rating_stars ? "#FF9800" : "#666"}
                        />
                      ))}
                      <Text style={styles.alertRatingText}>({item.rating_stars})</Text>
                    </View>
                    <Text style={styles.alertDate}>
                      {new Date(item.created_at).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>

                  {item.rating_reason && (
                    <View style={styles.alertReasonContainer}>
                      <Text style={styles.alertReasonLabel}>Motivo da avaliação:</Text>
                      <Text style={styles.alertReasonText}>{item.rating_reason}</Text>
                    </View>
                  )}

                  <View style={styles.alertMessageContainer}>
                    <Text style={styles.alertMessageLabel}>Mensagem do Administrador:</Text>
                    <Text style={styles.alertMessageText}>{item.admin_message}</Text>
                  </View>

                  <View style={styles.alertWarning}>
                    <Ionicons name="warning" size={16} color="#f44336" />
                    <Text style={styles.alertWarningText}>
                      Por favor, revise suas práticas para melhorar o atendimento aos passageiros.
                    </Text>
                  </View>
                </View>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#2a2a2a',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusText: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: 8,
  },
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  mainContent: {
    flex: 1,
    padding: 20,
  },
  currentTripCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tripTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  tripDetails: {
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
    flex: 1,
  },
  tripStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  tripActions: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 18,
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
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  availableTripsContainer: {
    flex: 1,
  },
  availableTripsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  noTripsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTripsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  noTripsSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  tripCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tripRoute: {
    marginBottom: 12,
  },
  tripMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  offlineContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  offlineSubtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  reportInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  adminMessageBox: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  adminMessageLabel: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  adminMessageText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  reportItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reportItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  reportStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reportStatusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  reportItemDescription: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  respondButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  respondButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Alert styles
  alertItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertStarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertRatingText: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  alertDate: {
    color: '#888',
    fontSize: 12,
  },
  alertReasonContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  alertReasonLabel: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  alertReasonText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  alertMessageContainer: {
    marginBottom: 12,
  },
  alertMessageLabel: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  alertMessageText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  alertWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  alertWarningText: {
    color: '#f44336',
    fontSize: 12,
    fontStyle: 'italic',
    flex: 1,
  },
});