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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';

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
  pickup_address: string;
  destination_address: string;
  estimated_price: number;
  status: string;
  requested_at: string;
  distance_km?: number;
}

export default function DriverDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    loadUserData();
    requestLocationPermission();
    if (isOnline) {
      loadAvailableTrips();
      checkCurrentTrip();
    }
  }, [isOnline]);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsOnline(parsedUser.driver_status === 'online');
      }
    } catch (error) {
      console.log('Error loading user data:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Erro', 'Permissão de localização necessária');
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
        Alert.alert('Status atualizado', 'Você está online e pode receber corridas!');
      } else {
        setAvailableTrips([]);
        Alert.alert('Status atualizado', 'Você está offline.');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Erro', 'Erro ao alterar status. Tente novamente.');
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

      Alert.alert('Sucesso', 'Viagem aceita! Indo buscar o passageiro...');
      loadAvailableTrips();
      checkCurrentTrip();
    } catch (error) {
      console.error('Error accepting trip:', error);
      Alert.alert('Erro', 'Erro ao aceitar viagem');
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

      Alert.alert('Sucesso', 'Viagem iniciada!');
      checkCurrentTrip();
    } catch (error) {
      console.error('Error starting trip:', error);
      Alert.alert('Erro', 'Erro ao iniciar viagem');
    } finally {
      setActionLoading(false);
    }
  };

  const completeTrip = async (tripId: string) => {
    const confirmed = window.confirm('Tem certeza que deseja finalizar esta viagem?');
    if (!confirmed) return;

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

      window.alert('Sucesso! Viagem finalizada com sucesso!');
      
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
    } catch (error) {
      console.error('Error completing trip:', error);
      window.alert('Erro ao finalizar viagem. Tente novamente.');
    } finally {
      setActionLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAvailableTrips().finally(() => setRefreshing(false));
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

  const renderTripItem = ({ item }: { item: Trip }) => (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <View style={styles.tripTime}>
          <Ionicons name="time" size={16} color="#888" />
          <Text style={styles.timeText}>{formatDate(item.requested_at)}</Text>
        </View>
        <Text style={styles.priceText}>R$ {item.estimated_price.toFixed(2)}</Text>
      </View>

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="car" size={24} color="#fff" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.welcomeText}>Motorista {user?.name || 'Usuário'}</Text>
            <Text style={styles.locationText}>
              📍 {location ? 'Brasília, DF' : 'Obtendo localização...'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
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
  locationText: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
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
  },
  actionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
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
});