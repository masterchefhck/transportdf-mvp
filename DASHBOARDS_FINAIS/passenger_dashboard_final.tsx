import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
  FlatList,
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
  profile_photo?: string;
}

interface Trip {
  id: string;
  driver_id?: string;
  pickup_address: string;
  destination_address: string;
  estimated_price: number;
  status: string;
  requested_at: string;
  // Driver info when trip is accepted
  driver_name?: string;
  driver_rating?: number;
  driver_photo?: string;
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

export default function PassengerDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState(0);
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

  // Rating states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [completedTrip, setCompletedTrip] = useState<Trip | null>(null);
  const [rating, setRating] = useState(5);
  const [ratingReason, setRatingReason] = useState('');
  const [ratedTrips, setRatedTrips] = useState<Set<string>>(new Set());

  // Chat states
  const [showChatModal, setShowChatModal] = useState(false);

  // Admin message states
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  
  // Photo modal states
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedPhotoUser, setSelectedPhotoUser] = useState<string>('');

  useEffect(() => {
    loadUserData();
    requestLocationPermission();
    loadRatedTrips();
    loadMyReports();
    loadCurrentRating();
    loadAdminMessages();
    
    // Set up interval to check trip status
    const interval = setInterval(() => {
      checkCurrentTrip();
    }, 5000);
    
    // Initial check
    checkCurrentTrip();
    
    return () => clearInterval(interval);
  }, []);

  const loadRatedTrips = async () => {
    try {
      const ratedTripsData = await AsyncStorage.getItem('rated_trips');
      if (ratedTripsData) {
        setRatedTrips(new Set(JSON.parse(ratedTripsData)));
      }
    } catch (error) {
      console.log('Error loading rated trips:', error);
    }
  };

  const markTripAsRated = async (tripId: string) => {
    try {
      const newRatedTrips = new Set(ratedTrips);
      newRatedTrips.add(tripId);
      setRatedTrips(newRatedTrips);
      await AsyncStorage.setItem('rated_trips', JSON.stringify(Array.from(newRatedTrips)));
    } catch (error) {
      console.log('Error saving rated trip:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data);
      
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

  const loadAdminMessages = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/passengers/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAdminMessages(response.data);
      
      // Count unread messages
      const unreadCount = response.data.filter((msg: any) => !msg.read).length;
      setUnreadMessageCount(unreadCount);
    } catch (error) {
      console.log('Error loading admin messages:', error);
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

  const handleViewPhoto = (photoUrl: string, userName: string) => {
    setSelectedPhotoUrl(photoUrl);
    setSelectedPhotoUser(userName);
    setShowPhotoModal(true);
  };

  const selectProfilePhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      showAlert('Permissão negada', 'É necessário permitir acesso à galeria de fotos');
      return;
    }

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
    } catch (error) {
      console.log('Error getting location permission:', error);
    }
  };

  const checkCurrentTrip = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/trips/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const activeTrip = response.data.find(
        (trip: Trip) => trip.status === 'requested' || trip.status === 'accepted' || trip.status === 'in_progress'
      );

      // Check for recently completed trips that need rating
      const recentlyCompleted = response.data.find(
        (trip: Trip) => trip.status === 'completed' && !ratedTrips.has(trip.id) && trip.driver_id
      );

      if (activeTrip) {
        setCurrentTrip(activeTrip);
      } else if (recentlyCompleted && currentTrip?.status !== 'completed') {
        // Trip just completed, show rating modal only if not already shown
        setCompletedTrip(recentlyCompleted);
        setShowRatingModal(true);
        setCurrentTrip(null);
      } else {
        setCurrentTrip(null);
      }
    } catch (error) {
      console.log('Error checking current trip:', error);
    }
  };

  const calculateEstimatePrice = () => {
    // Simulate price calculation (in real app, would use Google Maps Distance Matrix)
    const basePrice = 5.0;
    const randomDistance = Math.random() * 20 + 2; // 2-22 km
    const pricePerKm = 2.5;
    const price = basePrice + (randomDistance * pricePerKm);
    setEstimatedPrice(Math.round(price * 100) / 100);
  };

  const requestTrip = async () => {
    if (!pickupAddress.trim() || !destinationAddress.trim()) {
      showAlert('Erro', 'Preencha os endereços de origem e destino');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      
      // Mock coordinates for Brasília
      const mockPickupCoords = { latitude: -15.7801, longitude: -47.9292 };
      const mockDestinationCoords = { latitude: -15.7942, longitude: -47.8822 };

      await axios.post(
        `${API_URL}/api/trips/request`,
        {
          passenger_id: user?.id,
          pickup_latitude: mockPickupCoords.latitude,
          pickup_longitude: mockPickupCoords.longitude,
          pickup_address: pickupAddress,
          destination_latitude: mockDestinationCoords.latitude,
          destination_longitude: mockDestinationCoords.longitude,
          destination_address: destinationAddress,
          estimated_price: estimatedPrice > 0 ? estimatedPrice : 25.0,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showAlert('Sucesso', 'Viagem solicitada! Aguarde um motorista aceitar.');
      setShowRequestModal(false);
      setPickupAddress('');
      setDestinationAddress('');
      setEstimatedPrice(0);
      checkCurrentTrip();
    } catch (error) {
      console.error('Error requesting trip:', error);
      showAlert('Erro', 'Erro ao solicitar viagem');
    } finally {
      setLoading(false);
    }
  };

  const cancelTrip = async () => {
    if (!currentTrip) return;

    showConfirm(
      'Cancelar viagem',
      'Tem certeza que deseja cancelar esta viagem?',
      async () => {
        try {
          const token = await AsyncStorage.getItem('access_token');
          await axios.put(
            `${API_URL}/api/trips/${currentTrip.id}/cancel`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          showAlert('Cancelado', 'Viagem cancelada com sucesso');
          setCurrentTrip(null);
        } catch (error) {
          console.error('Error cancelling trip:', error);
          showAlert('Erro', 'Erro ao cancelar viagem');
        }
      }
    );
  };

  const handleReportDriver = () => {
    if (!currentTrip || !currentTrip.driver_id) {
      showAlert('Erro', 'Não há motorista para reportar');
      return;
    }
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!reportTitle.trim() || !reportDescription.trim() || !currentTrip?.driver_id) {
      showAlert('Erro', 'Preencha todos os campos');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/reports/create`,
        {
          reported_user_id: currentTrip.driver_id,
          trip_id: currentTrip.id,
          title: reportTitle,
          description: reportDescription,
          report_type: 'passenger_report'
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

  const submitRating = async () => {
    if (!completedTrip || !completedTrip.driver_id) {
      showAlert('Erro', 'Erro na avaliação');
      return;
    }

    if (rating < 5 && !ratingReason.trim()) {
      showAlert('Erro', 'Por favor, informe o motivo da avaliação abaixo de 5 estrelas');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/ratings/create`,
        {
          trip_id: completedTrip.id,
          rated_user_id: completedTrip.driver_id,
          rating: rating,
          reason: rating < 5 ? ratingReason : null
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Mark trip as rated to prevent showing modal again
      await markTripAsRated(completedTrip.id);
      
      showAlert('Sucesso', 'Avaliação enviada com sucesso!');
      setShowRatingModal(false);
      setRating(5);
      setRatingReason('');
      setCompletedTrip(null);
    } catch (error) {
      console.error('Error submitting rating:', error);
      showAlert('Erro', 'Erro ao enviar avaliação');
    }
  };

  const skipRating = async () => {
    if (completedTrip) {
      // Mark trip as rated (even if skipped) to prevent showing again
      await markTripAsRated(completedTrip.id);
    }
    setShowRatingModal(false);
    setRating(5);
    setRatingReason('');
    setCompletedTrip(null);
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

  const markMessageAsRead = async (messageId: string) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/passengers/messages/${messageId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadAdminMessages();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleLogout = async () => {
    showConfirm(
      'Sair',
      'Tem certeza que deseja sair?',
      async () => {
        try {
          await AsyncStorage.multiRemove(['access_token', 'user']);
          router.replace('/');
        } catch (error) {
          console.error('Error during logout:', error);
          router.replace('/');
        }
      }
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
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

  const pendingReports = myReports.filter(report => report.response_allowed && report.admin_message);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <TouchableOpacity onPress={selectProfilePhoto} style={styles.avatarContainer}>
            {profilePhoto ? (
              <TouchableOpacity onPress={() => handleViewPhoto(profilePhoto, user?.name || 'Você')}>
                <Image source={{ uri: profilePhoto }} style={styles.avatar} />
              </TouchableOpacity>
            ) : (
              <View style={styles.defaultAvatar}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={styles.userDetails}>
            <Text style={styles.welcomeText}>Olá, {user?.name || 'Usuário'}!</Text>
            <Text style={styles.locationText}>📍 Brasília, DF</Text>
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
          {unreadMessageCount > 0 && (
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => {
                setShowMessagesModal(true);
                loadAdminMessages();
              }}
            >
              <Ionicons name="mail" size={24} color="#4CAF50" />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>{unreadMessageCount}</Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mainContent}>
        {currentTrip ? (
          <View style={styles.currentTripCard}>
            <View style={styles.tripHeader}>
              <Text style={styles.currentTripTitle}>Viagem Atual</Text>
              <Text style={styles.tripStatus}>
                {currentTrip.status === 'requested' && '🔍 Procurando motorista...'}
                {currentTrip.status === 'accepted' && '✅ Motorista a caminho'}
                {currentTrip.status === 'in_progress' && '🚗 Em viagem'}
              </Text>
            </View>

            <View style={styles.addressRow}>
              <Ionicons name="radio-button-on" size={16} color="#4CAF50" />
              <Text style={styles.addressText}>{currentTrip.pickup_address}</Text>
            </View>
            <View style={styles.addressRow}>
              <Ionicons name="location" size={16} color="#f44336" />
              <Text style={styles.addressText}>{currentTrip.destination_address}</Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Preço estimado:</Text>
              <Text style={styles.priceValue}>R$ {currentTrip.estimated_price.toFixed(2)}</Text>
            </View>

            {/* Driver Info Section */}
            {currentTrip.status !== 'requested' && currentTrip.driver_name && (
              <View style={styles.driverInfo}>
                <Text style={styles.driverInfoTitle}>Motorista</Text>
                <View style={styles.driverDetails}>
                  <TouchableOpacity
                    onPress={() => currentTrip.driver_photo && handleViewPhoto(currentTrip.driver_photo, currentTrip.driver_name || 'Motorista')}
                    disabled={!currentTrip.driver_photo}
                  >
                    {currentTrip.driver_photo ? (
                      <Image source={{ uri: currentTrip.driver_photo }} style={styles.driverPhoto} />
                    ) : (
                      <View style={styles.defaultDriverPhoto}>
                        <Ionicons name="car" size={20} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={styles.driverTextInfo}>
                    <Text style={styles.driverName}>{currentTrip.driver_name}</Text>
                    <View style={styles.driverRating}>
                      <Ionicons name="star" size={14} color="#FF9800" />
                      <Text style={styles.driverRatingText}>
                        {currentTrip.driver_rating ? currentTrip.driver_rating.toFixed(1) : '5.0'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

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

            {currentTrip.status === 'requested' && (
              <TouchableOpacity style={styles.cancelButton} onPress={cancelTrip}>
                <Text style={styles.cancelButtonText}>Cancelar Viagem</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.noTripContainer}>
            <Ionicons name="car-outline" size={80} color="#666" />
            <Text style={styles.noTripTitle}>Nenhuma viagem ativa</Text>
            <Text style={styles.noTripSubtitle}>Solicite uma nova viagem para começar</Text>
            <TouchableOpacity
              style={styles.requestButton}
              onPress={() => {
                calculateEstimatePrice();
                setShowRequestModal(true);
              }}
            >
              <Ionicons name="add" size={24} color="#fff" />
              <Text style={styles.requestButtonText}>Solicitar Viagem</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Request Trip Modal */}
      <Modal visible={showRequestModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Solicitar Viagem</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Informe os endereços de origem e destino
            </Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="radio-button-on" size={20} color="#4CAF50" />
              <TextInput
                style={styles.input}
                placeholder="Endereço de origem"
                placeholderTextColor="#666"
                value={pickupAddress}
                onChangeText={(text) => {
                  setPickupAddress(text);
                  if (text && destinationAddress) calculateEstimatePrice();
                }}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Ionicons name="location" size={20} color="#f44336" />
              <TextInput
                style={styles.input}
                placeholder="Endereço de destino"
                placeholderTextColor="#666"
                value={destinationAddress}
                onChangeText={(text) => {
                  setDestinationAddress(text);
                  if (pickupAddress && text) calculateEstimatePrice();
                }}
              />
            </View>
            
            {estimatedPrice > 0 && (
              <View style={styles.priceEstimate}>
                <Text style={styles.priceEstimateLabel}>Preço estimado:</Text>
                <Text style={styles.priceEstimateValue}>R$ {estimatedPrice.toFixed(2)}</Text>
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={requestTrip}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Solicitar Viagem</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Report Driver Modal */}
      <Modal visible={showReportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reportar Motorista</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Descreva o problema ocorrido com o motorista
            </Text>
            
            <TextInput
              style={styles.textInput}
              placeholder="Título do report"
              placeholderTextColor="#666"
              value={reportTitle}
              onChangeText={setReportTitle}
            />
            
            <TextInput
              style={[styles.textInput, styles.textArea]}
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

      {/* Rating Modal */}
      <Modal visible={showRatingModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Avaliar Motorista</Text>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Como foi sua experiência com o motorista?
            </Text>
            
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.star}
                >
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={32}
                    color={star <= rating ? "#FF9800" : "#666"}
                  />
                </TouchableOpacity>
              ))}
            </View>
            
            {rating < 5 && (
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Por favor, descreva o motivo da avaliação..."
                placeholderTextColor="#666"
                value={ratingReason}
                onChangeText={setRatingReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
            
            <View style={styles.ratingModalButtons}>
              <TouchableOpacity style={styles.skipButton} onPress={skipRating}>
                <Text style={styles.skipButtonText}>Pular</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.submitButton} onPress={submitRating}>
                <Text style={styles.submitButtonText}>Enviar Avaliação</Text>
              </TouchableOpacity>
            </View>
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
                  style={[styles.textInput, styles.textArea]}
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

      {/* Admin Messages Modal */}
      <Modal visible={showMessagesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mensagens do Administrador</Text>
              <TouchableOpacity onPress={() => setShowMessagesModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={adminMessages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.messageItem, !item.read && styles.unreadMessage]}
                  onPress={() => !item.read && markMessageAsRead(item.id)}
                >
                  <Text style={styles.messageDate}>{formatDate(item.created_at)}</Text>
                  <Text style={styles.messageText}>{item.message}</Text>
                  {!item.read && <View style={styles.unreadIndicator} />}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* Photo Modal */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={styles.photoModalOverlay}>
          <View style={styles.photoModalContent}>
            <View style={styles.photoModalHeader}>
              <Text style={styles.photoModalTitle}>{selectedPhotoUser}</Text>
              <TouchableOpacity
                onPress={() => setShowPhotoModal(false)}
                style={styles.photoModalCloseButton}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            {selectedPhotoUrl && (
              <Image source={{ uri: selectedPhotoUrl }} style={styles.fullSizePhoto} />
            )}
          </View>
        </View>
      </Modal>

      {/* Chat Component */}
      {currentTrip && (
        <ChatComponent
          visible={showChatModal}
          onClose={() => setShowChatModal(false)}
          tripId={currentTrip.id}
          currentUserId={user?.id || ''}
          otherUserName={currentTrip.driver_name || 'Motorista'}
        />
      )}
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
  mainContent: {
    flex: 1,
    padding: 20,
  },
  currentTripCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentTripTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  tripStatus: {
    fontSize: 14,
    color: '#4CAF50',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 16,
    color: '#888',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
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
  reportButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  cancelButton: {
    backgroundColor: '#f44336',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  noTripContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTripTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  noTripSubtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
  },
  requestButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
  },
  requestButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  textInput: {
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
  priceEstimate: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  priceEstimateLabel: {
    fontSize: 16,
    color: '#888',
  },
  priceEstimateValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    flex: 1,
  },
  submitButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  star: {
    padding: 4,
  },
  ratingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  ratingModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  skipButton: {
    backgroundColor: '#666',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  skipButtonText: {
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
  statusText: {
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
  messageItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  unreadMessage: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  messageDate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  unreadIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  // Profile photo styles
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
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2196F3',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2a2a2a',
  },
  // Driver info styles
  driverInfo: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  driverInfoTitle: {
    fontSize: 16,
    color: '#2196F3',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  driverDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  defaultDriverPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  driverName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverRatingText: {
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
  photoModalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 350,
    alignItems: 'center',
  },
  photoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  photoModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  photoModalCloseButton: {
    padding: 4,
  },
  fullSizePhoto: {
    width: 300,
    height: 400,
    borderRadius: 12,
    resizeMode: 'cover',
  },
});