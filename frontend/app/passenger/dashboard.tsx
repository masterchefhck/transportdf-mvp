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
  pickup_address: string;
  destination_address: string;
  estimated_price: number;
  status: string;
  requested_at: string;
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

  useEffect(() => {
    loadUserData();
    requestLocationPermission();
    checkCurrentTrip();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.log('Error loading user data:', error);
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

      if (activeTrip) {
        setCurrentTrip(activeTrip);
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
      default: return '#666';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#fff" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.welcomeText}>Olá, {user?.name || 'Usuário'}</Text>
            <Text style={styles.locationText}>
              📍 {location ? 'Brasília, DF' : 'Obtendo localização...'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
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
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="time" size={24} color="#2196F3" />
          <Text style={styles.actionText}>Histórico</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="card" size={24} color="#4CAF50" />
          <Text style={styles.actionText}>Pagamento</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="help-circle" size={24} color="#FF9800" />
          <Text style={styles.actionText}>Ajuda</Text>
        </TouchableOpacity>
      </View>

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
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
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
  locationText: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
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
});