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
  driver_earnings: number;
  requested_at: string;
  completed_at: string;
  duration_minutes?: number;
  passenger_name: string;
  passenger_photo?: string;
  driver_rating_given?: number;
}

const showAlert = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

export default function DriverHistory() {
  const [trips, setTrips] = useState<TripHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTripHistory();
  }, []);

  const loadTripHistory = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/drivers/trip-history`, {
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
          <View style={styles.earningsContainer}>
            <Text style={styles.earningsLabel}>Você recebeu</Text>
            <Text style={styles.earningsAmount}>R$ {item.driver_earnings.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.addressContainer}>
        <View style={styles.addressRow}>
          <Ionicons name="radio-button-on" size={16} color="#2196F3" />
          <Text style={styles.addressText}>{item.pickup_address}</Text>
        </View>
        <View style={styles.addressDivider} />
        <View style={styles.addressRow}>
          <Ionicons name="location" size={16} color="#f44336" />
          <Text style={styles.addressText}>{item.destination_address}</Text>
        </View>
      </View>

      <View style={styles.passengerSection}>
        <Text style={styles.sectionTitle}>Passageiro</Text>
        <View style={styles.passengerInfo}>
          {item.passenger_photo ? (
            <Image source={{ uri: item.passenger_photo }} style={styles.passengerPhoto} />
          ) : (
            <View style={styles.defaultPassengerPhoto}>
              <Ionicons name="person" size={20} color="#666" />
            </View>
          )}
          <View style={styles.passengerDetails}>
            <Text style={styles.passengerName}>{item.passenger_name}</Text>
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
        <View style={styles.detailRow}>
          <Ionicons name="cash" size={16} color="#888" />
          <Text style={styles.detailText}>
            Valor total: R$ {item.final_price.toFixed(2)}
          </Text>
        </View>
        {item.driver_rating_given && (
          <View style={styles.detailRow}>
            <Ionicons name="star" size={16} color="#888" />
            <Text style={styles.detailText}>
              Sua avaliação: {item.driver_rating_given}/5
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
          <Text style={styles.headerTitle}>Histórico de Corridas</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Carregando histórico...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalEarnings = trips.reduce((sum, trip) => sum + trip.driver_earnings, 0);
  const totalTrips = trips.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Histórico de Corridas</Text>
      </View>

      {trips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={80} color="#666" />
          <Text style={styles.emptyTitle}>Nenhuma corrida encontrada</Text>
          <Text style={styles.emptySubtitle}>
            Suas corridas concluídas aparecerão aqui
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total de Corridas</Text>
              <Text style={styles.summaryValue}>{totalTrips}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Recebido</Text>
              <Text style={styles.summaryValue}>R$ {totalEarnings.toFixed(2)}</Text>
            </View>
          </View>

          <FlatList
            data={trips}
            renderItem={renderTripItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshing={refreshing}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
          />
        </>
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
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
    alignItems: 'flex-start',
  },
  tripDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  earningsContainer: {
    alignItems: 'flex-end',
  },
  earningsLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
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
  passengerSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 8,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passengerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  defaultPassengerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  passengerDetails: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
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