import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MockMapView from './MockMapView';
import { useGoogleMaps } from './useGoogleMaps';

interface Location {
  lat: number;
  lng: number;
  name?: string;
}

interface Trip {
  id: string;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address: string;
  destination_latitude: number;
  destination_longitude: number;
  destination_address: string;
  status: string;
  estimated_price: number;
  driver_name?: string;
  driver_photo?: string;
  driver_rating?: number;
}

interface TripMapViewProps {
  trip: Trip;
  currentLocation?: Location;
  onLocationUpdate?: (location: Location) => void;
  showDirections?: boolean;
  style?: any;
}

const TripMapView: React.FC<TripMapViewProps> = ({
  trip,
  currentLocation,
  onLocationUpdate,
  showDirections = true,
  style,
}) => {
  const { getDirections, calculateTripPrice, loading, error } = useGoogleMaps();
  const [route, setRoute] = useState<any>(null);
  const [estimatedArrival, setEstimatedArrival] = useState<string>('');
  const [mapLoading, setMapLoading] = useState(false);

  const origin: Location = {
    lat: trip.pickup_latitude,
    lng: trip.pickup_longitude,
    name: trip.pickup_address,
  };

  const destination: Location = {
    lat: trip.destination_latitude,
    lng: trip.destination_longitude,
    name: trip.destination_address,
  };

  const fetchRoute = async () => {
    setMapLoading(true);
    try {
      const routeData = await getDirections(origin, destination);
      if (routeData) {
        setRoute(routeData);
        
        // Calculate estimated arrival time
        const now = new Date();
        const durationText = routeData.duration;
        const durationMinutes = parseInt(durationText.replace(/[^\d]/g, '')) || 15;
        const arrivalTime = new Date(now.getTime() + durationMinutes * 60000);
        setEstimatedArrival(arrivalTime.toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }));
      }
    } catch (err) {
      console.error('Erro ao buscar rota:', err);
    } finally {
      setMapLoading(false);
    }
  };

  useEffect(() => {
    fetchRoute();
  }, [trip.id]);

  const handleRefreshRoute = () => {
    fetchRoute();
  };

  const getTripStatusInfo = () => {
    switch (trip.status) {
      case 'requested':
        return {
          icon: 'time-outline',
          text: 'Procurando motorista...',
          color: '#FF9800',
        };
      case 'accepted':
        return {
          icon: 'car-outline',
          text: `Motorista ${trip.driver_name || 'encontrado'} a caminho`,
          color: '#2196F3',
        };
      case 'in_progress':
        return {
          icon: 'navigation-outline',
          text: 'Viagem em andamento',
          color: '#4CAF50',
        };
      case 'completed':
        return {
          icon: 'checkmark-circle-outline',
          text: 'Viagem concluída',
          color: '#4CAF50',
        };
      default:
        return {
          icon: 'help-outline',
          text: 'Status desconhecido',
          color: '#666',
        };
    }
  };

  const statusInfo = getTripStatusInfo();

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Ionicons name="warning-outline" size={48} color="#f44336" />
        <Text style={styles.errorTitle}>Erro no Mapa</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefreshRoute}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Trip Status Header */}
      <View style={styles.statusHeader}>
        <View style={styles.statusInfo}>
          <Ionicons name={statusInfo.icon as any} size={24} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.text}
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefreshRoute} disabled={mapLoading}>
          {mapLoading ? (
            <ActivityIndicator size="small" color="#2196F3" />
          ) : (
            <Ionicons name="refresh" size={20} color="#2196F3" />
          )}
        </TouchableOpacity>
      </View>

      {/* Mock Google Maps View */}
      <MockMapView
        origin={origin}
        destination={destination}
        currentLocation={currentLocation}
        route={route}
        showDirections={showDirections}
        onDirectionsRequest={handleRefreshRoute}
      />

      {/* Trip Details Footer */}
      <View style={styles.tripDetails}>
        <View style={styles.addressContainer}>
          <View style={styles.addressRow}>
            <Ionicons name="radio-button-on" size={16} color="#4CAF50" />
            <Text style={styles.addressText} numberOfLines={1}>
              {trip.pickup_address}
            </Text>
          </View>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color="#f44336" />
            <Text style={styles.addressText} numberOfLines={1}>
              {trip.destination_address}
            </Text>
          </View>
        </View>

        <View style={styles.tripMeta}>
          {route && (
            <>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Distância</Text>
                <Text style={styles.metaValue}>{route.distance}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Tempo</Text>
                <Text style={styles.metaValue}>{route.duration}</Text>
              </View>
              {estimatedArrival && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Chegada</Text>
                  <Text style={styles.metaValue}>{estimatedArrival}</Text>
                </View>
              )}
            </>
          )}
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Preço</Text>
            <Text style={[styles.metaValue, styles.priceValue]}>
              R$ {trip.estimated_price.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  tripDetails: {
    padding: 16,
    backgroundColor: '#2a2a2a',
  },
  addressContainer: {
    marginBottom: 16,
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
  tripMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    alignItems: 'center',
    flex: 1,
  },
  metaLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  priceValue: {
    color: '#4CAF50',
    fontSize: 16,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 200,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f44336',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default TripMapView;