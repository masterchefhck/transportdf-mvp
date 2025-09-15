import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import ChatComponent from '../../components/ChatComponent';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  name: string;
  email: string;
  user_type: string;
  driver_status?: string;
}

interface Trip {
  id: string;
  passenger_id: string;
  pickup_address: string;
  destination_address: string;
  estimated_price: number;
  status: string;
  requested_at: string;
  distance_km?: number;
  // New fields for passenger info
  passenger_name?: string;
  passenger_rating?: number;
  passenger_photo?: string;
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

export default function DriverDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [currentRating, setCurrentRating] = useState<number>(5.0);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  
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

  // Chat states
  const [showChatModal, setShowChatModal] = useState(false);
  const [newMessageAlert, setNewMessageAlert] = useState(false);

  // Photo modal states
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>('');
  const [selectedPhotoUser, setSelectedPhotoUser] = useState<string>('');

  useEffect(() => {
    loadUserData();
    requestLocationPermission();
    loadMyReports();
    loadMyAlerts();
    loadCurrentRating();
    if (isOnline) {
      loadAvailableTrips();
      checkCurrentTrip();
    }
  }, [isOnline]);

  // Auto-refresh data every 5 seconds for real-time sync
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline) {
        loadAvailableTrips();
        checkCurrentTrip();
      }
      loadMyAlerts(); // Always check for new alerts
    }, 5000); // 5 seconds polling

    return () => clearInterval(interval);
  }, [isOnline]);

  const loadUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data);
      setIsOnline(response.data.driver_status === 'online');
      
      // Load profile photo if exists
      if (response.data.profile_photo) {
        setProfilePhoto(response.data.profile_photo);
      }
    } catch (error) {
      console.log('Error loading user data:', error);
      showAlert('Erro', 'Erro ao carregar dados do usuário');
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

  const loadCurrentRating = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/users/rating`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCurrentRating(response.data.rating);
    } catch (error) {
      console.log('Error loading current rating:', error);
    }
  };

  const markAlertAsRead = async (alertId: string) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(`${API_URL}/api/drivers/alerts/${alertId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      loadMyAlerts(); // Reload alerts to update read status
    } catch (error) {
      console.error('Error marking alert as read:', error);
      showAlert('Erro', 'Erro ao marcar alerta como lido');
    }
  };

  const pickImage = async () => {
    // Request permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      showAlert('Permissão negada', 'É necessário permitir acesso à galeria de fotos');
      return;
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      uploadProfilePhoto(result.assets[0].base64);
    }
  };

  const uploadProfilePhoto = async (base64Image: string) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('access_token');
      
      await axios.put(
        `${API_URL}/api/users/profile-photo`,
        { profile_photo: `data:image/jpeg;base64,${base64Image}` },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setProfilePhoto(`data:image/jpeg;base64,${base64Image}`);
      showAlert('Sucesso', 'Foto de perfil atualizada com sucesso!');
    } catch (error) {
      console.log('Error uploading photo:', error);
      showAlert('Erro', 'Erro ao fazer upload da foto');
    } finally {
      setLoading(false);
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
      setLocation(currentLocation);

      // Update driver location on server
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

  const toggleOnlineStatus = async () => {
    setLoading(true);
    try {
      const newStatus = isOnline ? 'offline' : 'online';
      const token = await AsyncStorage.getItem('access_token');
      
      console.log('Changing driver status to:', newStatus);
      
      await axios.put(
        `${API_URL}/api/drivers/status/${newStatus}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Update local state
      setIsOnline(!isOnline);
      
      // Update user data in AsyncStorage
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        parsedUser.driver_status = newStatus;
        await AsyncStorage.setItem('user', JSON.stringify(parsedUser));
        setUser(parsedUser);
      }
      
      if (newStatus === 'online') {
        loadAvailableTrips();
        showAlert('Status atualizado', 'Você está online e pode receber corridas!');
      } else {
        setAvailableTrips([]);
        showAlert('Status atualizado', 'Você está offline.');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showAlert('Erro', 'Erro ao alterar status. Tente novamente.');
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

      if (activeTrip) {
        setCurrentTrip(activeTrip);
      }
    } catch (error) {
      console.log('Error checking current trip:', error);
    }
  };

  const acceptTrip = async (tripId: string) => {
    setActionLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      console.log('Accepting trip:', tripId);
      
      await axios.put(
        `${API_URL}/api/trips/${tripId}/accept`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showAlert('Sucesso', 'Viagem aceita! Indo buscar o passageiro...');
      loadAvailableTrips();
      checkCurrentTrip();
    } catch (error) {
      console.error('Error accepting trip:', error);
      showAlert('Erro', 'Erro ao aceitar viagem');
    } finally {
      setActionLoading(false);
    }
  };

  const startTrip = async (tripId: string) => {
    setActionLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      console.log('Starting trip:', tripId);
      
      await axios.put(
        `${API_URL}/api/trips/${tripId}/start`,
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
      setActionLoading(false);
    }
  };

  const completeTrip = async (tripId: string) => {
    showConfirm(
      'Finalizar viagem',
      'Tem certeza que deseja finalizar esta viagem?',
      async () => {
        setActionLoading(true);
        try {
          const token = await AsyncStorage.getItem('access_token');
          console.log('Completing trip:', tripId);
          
          await axios.put(
            `${API_URL}/api/trips/${tripId}/complete`,
            {},
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          showAlert('Sucesso', 'Viagem finalizada com sucesso!');
          
          // Clear current trip
          setCurrentTrip(null);
          
          // Update driver status back to online in local state
          setIsOnline(true);
          const userData = await AsyncStorage.getItem('user');
          if (userData) {
            const parsedUser = JSON.parse(userData);
            parsedUser.driver_status = 'online';
            await AsyncStorage.setItem('user', JSON.stringify(parsedUser));
            setUser(parsedUser);
          }
          
          // Reload available trips
          loadAvailableTrips();
          // Reload rating in case passenger rated the driver
          setTimeout(() => loadCurrentRating(), 2000); // Wait 2 seconds for rating to be processed
        } catch (error) {
          console.error('Error completing trip:', error);
          showAlert('Erro', 'Erro ao finalizar viagem. Tente novamente.');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleReportPassenger = () => {
    if (!currentTrip) {
      showAlert('Erro', 'Não há viagem ativa para reportar');
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

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([loadAvailableTrips(), loadMyReports()]).finally(() => setRefreshing(false));
  };

  const handleLogout = async () => {
    const confirmed = window.confirm('Tem certeza que deseja sair?');
    if (!confirmed) return;

    try {
      console.log('Logging out driver...');
      await AsyncStorage.multiRemove(['access_token', 'user']);
      router.replace('/driver');
    } catch (error) {
      console.error('Error during logout:', error);
      // Force logout even if there's an error
      router.replace('/driver');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewPhoto = (photoUrl: string, userName: string) => {
    if (photoUrl) {
      setSelectedPhotoUrl(photoUrl);
      setSelectedPhotoUser(userName);
      setShowPhotoModal(true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'under_review': return '#2196F3';
      case 'resolved': return '#4CAF50';
      case 'dismissed': return '#666';
      default: return '#666';
    }
  };

  const renderTripItem = ({ item }: { item: Trip }) => (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <View style={styles.tripTime}>
          <Ionicons name="time" size={16} color="#888" />
          <Text style={styles.timeText}>{formatDate(item.requested_at)}</Text>
        </View>
        <Text style={styles.priceText}>R$ {item.estimated_price.toFixed(2)}</Text>
      </View>

      {/* Passenger Info Section */}
      {item.passenger_name && (
        <View style={styles.passengerInfo}>
          <View style={styles.passengerDetails}>
            <TouchableOpacity
              onPress={() => handleViewPhoto(item.passenger_photo, item.passenger_name)}
              disabled={!item.passenger_photo}
            >
              {item.passenger_photo ? (
                <Image source={{ uri: item.passenger_photo }} style={styles.passengerPhoto} />
              ) : (
                <View style={styles.defaultPassengerPhoto}>
                  <Ionicons name="person" size={20} color="#666" />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.passengerTextInfo}>
              <Text style={styles.passengerName}>{item.passenger_name}</Text>
              <View style={styles.passengerRating}>
                <Ionicons name="star" size={14} color="#FF9800" />
                <Text style={styles.passengerRatingText}>
                  {item.passenger_rating ? item.passenger_rating.toFixed(1) : '5.0'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <View style={styles.addressRow}>
        <Ionicons name="radio-button-on" size={16} color="#4CAF50" />
        <Text style={styles.addressText}>{item.pickup_address}</Text>
      </View>
      <View style={styles.addressRow}>
        <Ionicons name="location" size={16} color="#f44336" />
        <Text style={styles.addressText}>{item.destination_address}</Text>
      </View>

      {item.distance_km && (
        <Text style={styles.distanceText}>~{item.distance_km.toFixed(1)} km</Text>
      )}

      <TouchableOpacity
        style={[styles.acceptButton, actionLoading && styles.buttonDisabled]}
        onPress={() => acceptTrip(item.id)}
        disabled={actionLoading}
      >
        {actionLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.acceptButtonText}>Aceitar Corrida</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const pendingReports = myReports.filter(report => report.response_allowed && report.admin_message);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.avatar} />
            ) : (
              <View style={styles.defaultAvatar}>
                <Ionicons name="car" size={24} color="#fff" />
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={styles.userDetails}>
            <Text style={styles.welcomeText}>Motorista {user?.name || 'Usuário'}</Text>
            <Text style={styles.locationText}>
              📍 {location ? 'Brasília, DF' : 'Obtendo localização...'}
            </Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#FF9800" />
              <Text style={styles.ratingText}>{currentRating.toFixed(1)}</Text>
            </View>
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
          {myAlerts.filter(alert => !alert.read).length > 0 && (
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => setShowAlertsPanel(true)}
            >
              <Ionicons name="warning" size={24} color="#f44336" />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>{myAlerts.filter(alert => !alert.read).length}</Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusContainer}>
        <TouchableOpacity
          style={[
            styles.statusButton,
            { backgroundColor: isOnline ? '#4CAF50' : '#666' },
          ]}
          onPress={toggleOnlineStatus}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name={isOnline ? 'radio-button-on' : 'radio-button-off'}
                size={24}
                color="#fff"
              />
              <Text style={styles.statusText}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        
        {isOnline && (
          <Text style={styles.statusDescription}>
            Você está disponível para receber corridas
          </Text>
        )}
      </View>

      <View style={styles.mainContent}>
        {currentTrip ? (
          <View style={styles.currentTripCard}>
            <View style={styles.tripHeader}>
              <Text style={styles.currentTripTitle}>Viagem Atual</Text>
              <Text style={styles.priceText}>R$ {currentTrip.estimated_price.toFixed(2)}</Text>
            </View>
            
            <View style={styles.addressRow}>
              <Ionicons name="radio-button-on" size={16} color="#4CAF50" />
              <Text style={styles.addressText}>{currentTrip.pickup_address}</Text>
            </View>
            <View style={styles.addressRow}>
              <Ionicons name="location" size={16} color="#f44336" />
              <Text style={styles.addressText}>{currentTrip.destination_address}</Text>
            </View>

            {/* Passenger Info Section */}
            {currentTrip.passenger_name && (
              <View style={styles.passengerInfoSection}>
                <Text style={styles.sectionTitle}>Passageiro</Text>
                <View style={styles.passengerInfoCard}>
                  <TouchableOpacity
                    onPress={() => handleViewPhoto(currentTrip.passenger_photo, currentTrip.passenger_name)}
                    disabled={!currentTrip.passenger_photo}
                  >
                    {currentTrip.passenger_photo ? (
                      <Image source={{ uri: currentTrip.passenger_photo }} style={styles.currentPassengerPhoto} />
                    ) : (
                      <View style={styles.defaultCurrentPassengerPhoto}>
                        <Ionicons name="person" size={24} color="#666" />
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={styles.currentPassengerDetails}>
                    <Text style={styles.currentPassengerName}>{currentTrip.passenger_name}</Text>
                    <View style={styles.currentPassengerRating}>
                      <Ionicons name="star" size={16} color="#FF9800" />
                      <Text style={styles.currentPassengerRatingText}>
                        {currentTrip.passenger_rating ? currentTrip.passenger_rating.toFixed(1) : '5.0'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.tripActions}>
              {currentTrip.status === 'accepted' && (
                <TouchableOpacity
                  style={[styles.actionButton, actionLoading && styles.buttonDisabled]}
                  onPress={() => startTrip(currentTrip.id)}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>Iniciar Viagem</Text>
                  )}
                </TouchableOpacity>
              )}
              {currentTrip.status === 'in_progress' && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#4CAF50' }, actionLoading && styles.buttonDisabled]}
                  onPress={() => completeTrip(currentTrip.id)}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>Finalizar Viagem</Text>
                  )}
                </TouchableOpacity>
              )}
              
              {/* Chat and Report Buttons */}
              {(currentTrip.status === 'in_progress' || currentTrip.status === 'accepted') && (
                <>
                  <View style={styles.chatButtonContainer}>
                    <TouchableOpacity
                      style={styles.chatButton}
                      onPress={() => {
                        setShowChatModal(true);
                        setNewMessageAlert(false); // Clear alert when opening chat
                      }}
                    >
                      <Ionicons name="chatbubbles" size={16} color="#fff" />
                      <Text style={styles.chatButtonText}>Chat com Passageiro</Text>
                      {newMessageAlert && (
                        <View style={styles.messageAlert}>
                          <Text style={styles.messageAlertText}>Nova!</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.reportButton]}
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
            <Text style={styles.sectionTitle}>Corridas Disponíveis</Text>
            {availableTrips.length > 0 ? (
              <FlatList
                data={availableTrips}
                renderItem={renderTripItem}
                keyExtractor={(item) => item.id}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.noTripsContainer}>
                <Ionicons name="car-outline" size={60} color="#666" />
                <Text style={styles.noTripsText}>
                  Nenhuma corrida disponível no momento
                </Text>
                <Text style={styles.noTripsSubtext}>
                  Aguarde novas solicitações...
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.offlineContainer}>
            <Ionicons name="moon-outline" size={80} color="#666" />
            <Text style={styles.offlineTitle}>Você está offline</Text>
            <Text style={styles.offlineSubtitle}>
              Ative o status online para receber corridas
            </Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.historyButton} 
          onPress={() => router.push('/driver/history')}
        >
          <Ionicons name="time" size={24} color="#2196F3" />
          <Text style={styles.historyButtonText}>Histórico</Text>
        </TouchableOpacity>
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
              style={styles.input}
              placeholder="Título do report"
              placeholderTextColor="#666"
              value={reportTitle}
              onChangeText={setReportTitle}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
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
                  style={[styles.input, styles.textArea]}
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
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                      <Text style={styles.statusText}>
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

                  {!item.read && (
                    <TouchableOpacity
                      style={styles.understoodButton}
                      onPress={() => markAlertAsRead(item.id)}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.understoodButtonText}>Ok, entendido</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* Chat Modal */}
      <Modal visible={showChatModal} animationType="slide" presentationStyle="pageSheet">
        <ChatComponent
          tripId={currentTrip?.id || ''}
          currentUserId={user?.id || ''}
          currentUserType="driver"
          onClose={() => setShowChatModal(false)}
          onNewMessage={() => setNewMessageAlert(true)}
        />
      </Modal>

      {/* Photo Viewer Modal */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity 
            style={styles.photoModalBackground} 
            onPress={() => setShowPhotoModal(false)}
          >
            <View style={styles.photoModalContent}>
              <View style={styles.photoModalHeader}>
                <Text style={styles.photoModalTitle}>{selectedPhotoUser}</Text>
                <TouchableOpacity 
                  onPress={() => setShowPhotoModal(false)}
                  style={styles.photoModalCloseButton}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <Image 
                source={{ uri: selectedPhotoUrl }} 
                style={styles.photoModalImage}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
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
  userDetails: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  locationText: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
    marginLeft: 4,
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
  statusContainer: {
    alignItems: 'center',
    padding: 20,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  statusDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  mainContent: {
    flex: 1,
    padding: 20,
  },
  currentTripCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
  },
  currentTripTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  tripActions: {
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
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
  chatButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chatButtonContainer: {
    position: 'relative',
  },
  messageAlert: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 40,
    alignItems: 'center',
  },
  messageAlertText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chatButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  availableTripsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  tripCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 4,
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
    flex: 1,
  },
  distanceText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
    textAlign: 'right',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonDisabled: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  noTripsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTripsText: {
    fontSize: 18,
    color: '#888',
    marginTop: 16,
    textAlign: 'center',
  },
  noTripsSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
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
  input: {
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
  understoodButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 12,
    gap: 6,
  },
  understoodButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Profile photo styles for driver
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2a2a2a',
  },
  // Passenger info styles in trip cards
  passengerInfo: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  passengerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passengerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  defaultPassengerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  passengerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  passengerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passengerRatingText: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  // Photo modal styles
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  photoModalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: '90%',
    maxHeight: '80%',
  },
  photoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  photoModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  photoModalCloseButton: {
    padding: 4,
  },
  photoModalImage: {
    width: 300,
    height: 400,
    maxWidth: '100%',
    maxHeight: '100%',
  },
  // Quick actions styles
  quickActions: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  historyButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Current trip passenger info styles
  passengerInfoSection: {
    marginTop: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 8,
  },
  passengerInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentPassengerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultCurrentPassengerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentPassengerDetails: {
    flex: 1,
  },
  currentPassengerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  currentPassengerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  currentPassengerRatingText: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: 'bold',
  },
  currentPassengerPhone: {
    fontSize: 12,
    color: '#888',
  },
});