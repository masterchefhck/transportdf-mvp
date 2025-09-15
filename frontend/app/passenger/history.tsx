import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface TripHistory {
  id: string;
  pickup_address: string;
  destination_address: string;
  estimated_price: number;
  final_price: number;
  requested_at: string;
  completed_at: string;
  duration_minutes?: number;
  driver_name: string;
  driver_photo?: string;
  driver_rating?: number;
  passenger_rating_given?: number;
}

const showAlert = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

export default function PassengerHistory() {
  const [trips, setTrips] = useState<TripHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTripHistory();
  }, []);

  const loadTripHistory = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/passengers/trip-history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTrips(response.data);
    } catch (error) {
      console.error('Error loading trip history:', error);
      showAlert('Erro', 'Não foi possível carregar o histórico de viagens');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTripHistory();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  const renderTripItem = ({ item }: { item: TripHistory }) => (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <View style={styles.tripInfo}>
          <Text style={styles.tripDate}>{formatDate(item.completed_at)}</Text>
          <Text style={styles.tripPrice}>R$ {item.final_price.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.addressContainer}>
        <View style={styles.addressRow}>
          <Ionicons name="radio-button-on" size={16} color="#4CAF50" />
          <Text style={styles.addressText}>{item.pickup_address}</Text>
        </View>
        <View style={styles.addressDivider} />
        <View style={styles.addressRow}>
          <Ionicons name="location" size={16} color="#f44336" />
          <Text style={styles.addressText}>{item.destination_address}</Text>
        </View>
      </View>

      <View style={styles.driverSection}>
        <Text style={styles.sectionTitle}>Motorista</Text>
        <View style={styles.driverInfo}>
          {item.driver_photo ? (
            <Image source={{ uri: item.driver_photo }} style={styles.driverPhoto} />
          ) : (
            <View style={styles.defaultDriverPhoto}>
              <Ionicons name="car" size={20} color="#666" />
            </View>
          )}
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{item.driver_name}</Text>
            <View style={styles.driverRating}>
              <Ionicons name="star" size={14} color="#FF9800" />
              <Text style={styles.driverRatingText}>
                {item.driver_rating ? item.driver_rating.toFixed(1) : '5.0'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.tripDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="time" size={16} color="#888" />
          <Text style={styles.detailText}>
            {formatTime(item.requested_at)} - {formatTime(item.completed_at)}
          </Text>
        </View>
        {item.duration_minutes && (
          <View style={styles.detailRow}>
            <Ionicons name="timer" size={16} color="#888" />
            <Text style={styles.detailText}>Duração: {formatDuration(item.duration_minutes)}</Text>
          </View>
        )}
        {item.passenger_rating_given && (
          <View style={styles.detailRow}>
            <Ionicons name="star" size={16} color="#888" />
            <Text style={styles.detailText}>
              Sua avaliação: {item.passenger_rating_given}/5
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Histórico de Viagens</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Carregando histórico...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Histórico de Viagens</Text>
      </View>

      {trips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={80} color="#666" />
          <Text style={styles.emptyTitle}>Nenhuma viagem encontrada</Text>
          <Text style={styles.emptySubtitle}>
            Suas viagens concluídas aparecerão aqui
          </Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTripItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
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
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  tripCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tripHeader: {
    marginBottom: 16,
  },
  tripInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  tripPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  addressContainer: {
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressDivider: {
    width: 2,
    height: 20,
    backgroundColor: '#666',
    marginLeft: 7,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 12,
    flex: 1,
  },
  driverSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  defaultDriverPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  driverRatingText: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: 'bold',
  },
  tripDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#888',
  },
});