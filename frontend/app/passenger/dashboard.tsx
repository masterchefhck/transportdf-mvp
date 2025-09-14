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
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [currentRating, setCurrentRating] = useState<number>(5.0);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  
  // Photo modal states
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedPhotoUser, setSelectedPhotoUser] = useState<string>('');
  
  // Admin Messages states
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [showMessagesPanel, setShowMessagesPanel] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  
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

  const loadCurrentRating = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/users/rating`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCurrentRating(response.data.rating || 5.0);
    } catch (error) {
      console.log('Error loading current rating:', error);
    }
  };

  const loadAdminMessages = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/passengers/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAdminMessages(response.data || []);
    } catch (error) {
      console.log('Error loading admin messages:', error);
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
      
      // Update local state
      setAdminMessages(messages => 
        messages.map(msg => 
          msg.id === messageId ? { ...msg, read: true } : msg
        )
      );
    } catch (error) {
      console.log('Error marking message as read:', error);
    }
  };

  const handleViewMessage = (message: any) => {
    setSelectedMessage(message);
    setShowMessageModal(true);
    
    // Mark as read if not already read
    if (!message.read) {
      markMessageAsRead(message.id);
    }
  };

  const handleViewPhoto = (photoUrl: string, userName: string) => {
    setSelectedPhotoUrl(photoUrl);
    setSelectedPhotoUser(userName);
    setShowPhotoModal(true);
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

  const handleRequestTrip = async () => {
    if (!pickupAddress || !destinationAddress) {
      showAlert('Erro', 'Preencha origem e destino');
      return;
    }

    if (!location) {
      showAlert('Erro', 'Localização não encontrada');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      
      // For MVP, using current location as pickup and simulated destination coordinates
      const response = await axios.post(
        `${API_URL}/api/trips/request`,
        {
          passenger_id: user?.id,
          pickup_latitude: location.coords.latitude,
          pickup_longitude: location.coords.longitude,
          pickup_address: pickupAddress,
          destination_latitude: location.coords.latitude + (Math.random() - 0.5) * 0.01,
          destination_longitude: location.coords.longitude + (Math.random() - 0.5) * 0.01,
          destination_address: destinationAddress,
          estimated_price: estimatedPrice,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setCurrentTrip(response.data);
      setShowRequestModal(false);
      showAlert('Sucesso', 'Viagem solicitada! Aguardando motorista...');
    } catch (error) {
      console.error('Error requesting trip:', error);
      showAlert('Erro', 'Erro ao solicitar viagem');
    } finally {
      setLoading(false);
    }
  };

  const handleReportDriver = () => {
    if (!currentTrip || !currentTrip.driver_id) {
      showAlert('Erro', 'Não há motorista para reportar nesta viagem');
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

  const submitRating = async () => {
    if (!completedTrip) {
      showAlert('Erro', 'Viagem não encontrada');
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

  const handleLogout = async () => {
    showConfirm(
      'Sair',
      'Tem certeza que deseja sair?',
      async () => {
        try {
          console.log('Logging out passenger...');
          await AsyncStorage.multiRemove(['access_token', 'user']);
          router.replace('/passenger');
        } catch (error) {
          console.error('Error during logout:', error);
          // Force logout even if there's an error
          router.replace('/passenger');
        }
      }
    );
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'requested': return 'Procurando motorista...';
      case 'accepted': return 'Motorista a caminho';
      case 'in_progress': return 'Viagem em andamento';
      case 'completed': return 'Viagem concluída';
      case 'cancelled': return 'Viagem cancelada';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested': return '#FF9800';
      case 'accepted': return '#2196F3';
      case 'in_progress': return '#4CAF50';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#f44336';
      case 'pending': return '#FF9800';
      case 'under_review': return '#2196F3';
      case 'resolved': return '#4CAF50';
      case 'dismissed': return '#666';
      default: return '#666';
    }
  };

  const handleHistoryPress = () => {
    showAlert('Histórico', 'Funcionalidade de histórico de viagens será implementada em breve.');
  };

  const handlePaymentPress = () => {
    showAlert('Pagamento', 'Funcionalidade de métodos de pagamento será implementada em breve.');
  };

  const handleHelpPress = () => {
    showAlert('Ajuda', 'Entre em contato conosco:\n\nEmail: suporte@transportdf.com\nTelefone: (61) 3333-4444\n\nHorário de atendimento:\nSegunda a Sexta: 8h às 18h\nSábado: 8h às 12h');
  };

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
                <Ionicons name="person" size={32} color="#666" />
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={styles.userDetails}>
            <Text style={styles.welcomeText}>Olá, {user?.name || 'Usuário'}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.locationText}>
                📍 {location ? 'Brasília, DF' : 'Obtendo localização...'}
              </Text>
              <View style={styles.userRating}>
                <Ionicons name="star" size={16} color="#FF9800" />
                <Text style={styles.ratingText}>{currentRating.toFixed(1)}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.headerActions}>
          {adminMessages.filter(msg => !msg.read).length > 0 && (
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => setShowMessagesPanel(true)}
            >
              <Ionicons name="chatbubble" size={24} color="#4CAF50" />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>{adminMessages.filter(msg => !msg.read).length}</Text>
              </View>
            </TouchableOpacity>
          )}
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
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
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

            {/* Driver Info Section */}
            {(currentTrip.status === 'accepted' || currentTrip.status === 'in_progress') && currentTrip.driver_name && (
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
                        <Ionicons name="person" size={20} color="#666" />
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

            <View style={styles.tripStatus}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentTrip.status) }]}>
                <Text style={styles.statusText}>{getStatusText(currentTrip.status)}</Text>
              </View>
              <Text style={styles.priceText}>R$ {currentTrip.estimated_price.toFixed(2)}</Text>
            </View>

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
          </View>
        ) : (
          <View style={styles.noTripContainer}>
            <Ionicons name="location-outline" size={80} color="#666" />
            <Text style={styles.noTripTitle}>Para onde vamos?</Text>
            <Text style={styles.noTripSubtitle}>
              Solicite uma viagem para qualquer lugar em Brasília
            </Text>
            
            <TouchableOpacity
              style={styles.requestButton}
              onPress={() => setShowRequestModal(true)}
            >
              <Ionicons name="add" size={24} color="#fff" />
              <Text style={styles.requestButtonText}>Solicitar Viagem</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleHistoryPress}>
          <Ionicons name="time" size={24} color="#2196F3" />
          <Text style={styles.actionText}>Histórico</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handlePaymentPress}>
          <Ionicons name="card" size={24} color="#4CAF50" />
          <Text style={styles.actionText}>Pagamento</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleHelpPress}>
          <Ionicons name="help-circle" size={24} color="#FF9800" />
          <Text style={styles.actionText}>Ajuda</Text>
        </TouchableOpacity>
      </View>

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

      {/* Request Trip Modal */}
      <Modal
        visible={showRequestModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Solicitar Viagem</Text>
              <TouchableOpacity
                onPress={() => setShowRequestModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="radio-button-on" size={20} color="#4CAF50" />
              <TextInput
                style={styles.input}
                placeholder="Endereço de origem"
                placeholderTextColor="#666"
                value={pickupAddress}
                onChangeText={setPickupAddress}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="location" size={20} color="#f44336" />
              <TextInput
                style={styles.input}
                placeholder="Endereço de destino"
                placeholderTextColor="#666"
                value={destinationAddress}
                onChangeText={setDestinationAddress}
                onEndEditing={calculateEstimatePrice}
              />
            </View>

            {estimatedPrice > 0 && (
              <View style={styles.priceEstimate}>
                <Text style={styles.priceLabel}>Preço estimado:</Text>
                <Text style={styles.priceValue}>R$ {estimatedPrice.toFixed(2)}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleRequestTrip}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirmar Viagem</Text>
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

      {/* Admin Messages Panel Modal */}
      <Modal visible={showMessagesPanel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mensagens do Admin</Text>
              <TouchableOpacity onPress={() => setShowMessagesPanel(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {adminMessages.length === 0 ? (
              <View style={styles.noMessagesContainer}>
                <Ionicons name="chatbubble-outline" size={60} color="#666" />
                <Text style={styles.noMessagesText}>Nenhuma mensagem</Text>
                <Text style={styles.noMessagesSubtext}>Você não tem mensagens do administrador</Text>
              </View>
            ) : (
              <FlatList
                data={adminMessages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.messageItem,
                      !item.read && styles.unreadMessage
                    ]}
                    onPress={() => handleViewMessage(item)}
                  >
                    <View style={styles.messageHeader}>
                      <View style={styles.messageInfo}>
                        <Ionicons 
                          name={item.read ? "mail-open" : "mail"} 
                          size={20} 
                          color={item.read ? "#888" : "#4CAF50"} 
                        />
                        <Text style={[
                          styles.messageDate,
                          !item.read && styles.unreadText
                        ]}>
                          {new Date(item.created_at).toLocaleDateString('pt-BR')}
                        </Text>
                      </View>
                      {!item.read && <View style={styles.unreadIndicator} />}
                    </View>
                    
                    <Text 
                      style={[
                        styles.messagePreview,
                        !item.read && styles.unreadText
                      ]} 
                      numberOfLines={2}
                    >
                      {item.message}
                    </Text>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Message Detail Modal */}
      <Modal visible={showMessageModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mensagem do Admin</Text>
              <TouchableOpacity onPress={() => setShowMessageModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {selectedMessage && (
              <>
                <Text style={styles.modalSubtitle}>
                  {new Date(selectedMessage.created_at).toLocaleString('pt-BR')}
                </Text>
                
                <View style={styles.messageContent}>
                  <Text style={styles.messageText}>{selectedMessage.message}</Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.closeMessageButton} 
                  onPress={() => setShowMessageModal(false)}
                >
                  <Text style={styles.closeMessageButtonText}>Fechar</Text>
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

      {/* Rating Modal */}
      <Modal visible={showRatingModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Avaliar Viagem</Text>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Como foi sua experiência com o motorista?
            </Text>
            
            {/* Star Rating */}
            <View style={styles.starContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={40}
                    color={star <= rating ? "#FF9800" : "#666"}
                  />
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.ratingText}>
              {rating === 5 ? "Excelente!" : 
               rating === 4 ? "Muito bom!" :
               rating === 3 ? "Bom" :
               rating === 2 ? "Regular" : "Ruim"}
            </Text>
            
            {/* Reason field for ratings < 5 */}
            {rating < 5 && (
              <View style={styles.reasonContainer}>
                <Text style={styles.reasonLabel}>Motivo da avaliação (obrigatório):</Text>
                <TextInput
                  style={[styles.reportInput, styles.textArea]}
                  placeholder="Descreva o que pode ser melhorado..."
                  placeholderTextColor="#666"
                  value={ratingReason}
                  onChangeText={setRatingReason}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            )}
            
            <View style={styles.ratingButtons}>
              <TouchableOpacity 
                style={styles.skipButton} 
                onPress={() => {
                  setShowRatingModal(false);
                  setRating(5);
                  setRatingReason('');
                  setCompletedTrip(null);
                }}
              >
                <Text style={styles.skipButtonText}>Pular</Text>
              </TouchableOpacity>
              
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
        </View>
      </Modal>

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
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2a2a2a',
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
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  priceText: {
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
    marginBottom: 40,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 12,
  },
  requestButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#2a2a2a',
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
  },
  actionText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
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
  closeButton: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
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
  priceEstimate: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
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
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
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
  starContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  starButton: {
    padding: 5,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9800',
    textAlign: 'center',
    marginBottom: 20,
  },
  reasonContainer: {
    marginBottom: 20,
  },
  reasonLabel: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ratingButtons: {
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
  // Rating display styles
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Messages styles
  noMessagesContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noMessagesText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  noMessagesSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  messageItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  unreadMessage: {
    backgroundColor: '#2a3a2a',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageDate: {
    color: '#888',
    fontSize: 12,
  },
  unreadText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  messagePreview: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
  },
  messageContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  closeMessageButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeMessageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Driver info styles in trip cards
  driverInfo: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  driverInfoTitle: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
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
    backgroundColor: '#4CAF50',
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