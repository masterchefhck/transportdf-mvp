import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

// Conditional imports for mobile vs web
let MapView: any, Marker: any, PROVIDER_GOOGLE: any, Polyline: any;
let GooglePlacesAutocomplete: any, GooglePlacesAutocompleteRef: any;

if (Platform.OS !== 'web') {
  // Only import react-native-maps on mobile
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  Polyline = Maps.Polyline;
  
  // Only import GooglePlacesAutocomplete on mobile
  const PlacesAPI = require('react-native-google-places-autocomplete');
  GooglePlacesAutocomplete = PlacesAPI.GooglePlacesAutocomplete;
  GooglePlacesAutocompleteRef = PlacesAPI.GooglePlacesAutocompleteRef;
}

const { width, height } = Dimensions.get('window');

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface RouteData {
  coordinates: Coordinates[];
  distance: string;
  duration: string;
}

interface GoogleMapViewProps {
  onTripRequest: (tripData: {
    origin: Coordinates;
    destination: Coordinates;
    originAddress: string;
    destinationAddress: string;
    estimatedPrice: number;
    distance: string;
    duration: string;
  }) => void;
  onClose: () => void;
}

// Brasília locations for web fallback
const brasiliaLocations = [
  { name: 'Asa Norte', area: 'Plano Piloto', coords: { lat: -15.7801, lng: -47.8827 } },
  { name: 'Asa Sul', area: 'Plano Piloto', coords: { lat: -15.8267, lng: -47.8934 } },
  { name: 'Taguatinga', area: 'Região Administrativa', coords: { lat: -15.8270, lng: -48.0427 } },
  { name: 'Ceilândia', area: 'Região Administrativa', coords: { lat: -15.8190, lng: -48.1076 } },
  { name: 'Gama', area: 'Região Administrativa', coords: { lat: -16.0209, lng: -48.0647 } },
  { name: 'Sobradinho', area: 'Região Administrativa', coords: { lat: -15.6536, lng: -47.7863 } },
  { name: 'Planaltina', area: 'Região Administrativa', coords: { lat: -15.4523, lng: -47.6142 } },
  { name: 'Aeroporto Internacional de Brasília (JK)', area: 'Transporte', coords: { lat: -15.8711, lng: -47.9178 } },
  { name: 'Rodoviária do Plano Piloto', area: 'Transporte', coords: { lat: -15.7945, lng: -47.8828 } },
  { name: 'Shopping Conjunto Nacional', area: 'Shopping', coords: { lat: -15.7942, lng: -47.8922 } },
  { name: 'Shopping Brasília', area: 'Shopping', coords: { lat: -15.7642, lng: -47.8822 } },
  { name: 'Universidade de Brasília (UnB)', area: 'Educação', coords: { lat: -15.7642, lng: -47.8722 } },
];

const GoogleMapView: React.FC<GoogleMapViewProps> = ({ onTripRequest, onClose }) => {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [destination, setDestination] = useState<Coordinates | null>(null);
  const [destinationAddress, setDestinationAddress] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  
  const mapRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);

  const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (userLocation && destination) {
      calculateRoute();
    }
  }, [userLocation, destination]);

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Erro', 'Permissão de localização necessária');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const userCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(userCoords);

      // Get address for current location
      try {
        const reverseGeocode = await Location.reverseGeocodeAsync(userCoords);
        if (reverseGeocode.length > 0) {
          const address = reverseGeocode[0];
          const formattedAddress = `${address.street || ''} ${address.streetNumber || ''}, ${address.district || ''}, ${address.city || 'Brasília'} - ${address.region || 'DF'}`.trim();
          setOriginAddress(formattedAddress);
        } else {
          setOriginAddress('Sua localização atual');
        }
      } catch (error) {
        setOriginAddress('Sua localização atual');
      }

    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Erro', 'Não foi possível obter sua localização');
    } finally {
      setLocationLoading(false);
    }
  };

  const calculateRoute = async () => {
    if (!userLocation || !destination) return;

    try {
      setLoading(true);
      
      // Calculate simple distance and price
      const distance = calculateDistance(userLocation, destination);
      const duration = Math.max(10, Math.round(distance * 2)); // Estimate 2 min per km
      
      // Calculate estimated price (R$ 2.50 base + R$ 2.50 per km)
      const price = 2.50 + (distance * 2.50);
      setEstimatedPrice(Math.round(price * 100) / 100);
      
    } catch (error) {
      console.error('Error calculating route:', error);
      Alert.alert('Erro', 'Erro ao calcular rota');
    } finally {
      setLoading(false);
    }
  };

  // Simple distance calculation using Haversine formula
  const calculateDistance = (point1: Coordinates, point2: Coordinates): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleSearchChange = (text: string) => {
    setDestinationAddress(text);
    
    if (text.length >= 2) {
      const filtered = brasiliaLocations.filter(location =>
        location.name.toLowerCase().includes(text.toLowerCase()) ||
        location.area.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 6);
      
      setSearchResults(filtered);
      setShowResults(filtered.length > 0);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleLocationSelect = (location: any) => {
    const coords = {
      latitude: location.coords.lat,
      longitude: location.coords.lng,
    };
    
    setDestination(coords);
    setDestinationAddress(location.name);
    setShowResults(false);
  };

  const handleConfirmTrip = () => {
    if (!userLocation || !destination) {
      Alert.alert('Erro', 'Dados da viagem incompletos');
      return;
    }

    const distance = calculateDistance(userLocation, destination);
    const duration = Math.max(10, Math.round(distance * 2));

    onTripRequest({
      origin: userLocation,
      destination,
      originAddress,
      destinationAddress,
      estimatedPrice,
      distance: `${distance.toFixed(1)} km`,
      duration: `${duration} min`,
    });
  };

  const resetDestination = () => {
    setDestination(null);
    setDestinationAddress('');
    setEstimatedPrice(0);
    setShowResults(false);
  };

  if (!GOOGLE_MAPS_API_KEY && Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={60} color="#FF9800" />
          <Text style={styles.errorTitle}>Configuração Necessária</Text>
          <Text style={styles.errorText}>
            Chave do Google Maps não configurada.{'\n'}
            Adicione EXPO_PUBLIC_GOOGLE_MAPS_API_KEY no arquivo .env
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Web version with simple interface
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Para onde vamos?</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.webContainer}>
          {/* Current Location */}
          <View style={styles.currentLocationCard}>
            <View style={styles.currentLocationRow}>
              <Ionicons name="navigate" size={20} color="#4CAF50" />
              <Text style={styles.currentLocationText}>
                {locationLoading ? 'Obtendo localização...' : originAddress}
              </Text>
              {!locationLoading && <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />}
            </View>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={styles.inputContainer}>
              <Ionicons name="location" size={20} color="#f44336" />
              <TextInput
                style={styles.textInput}
                placeholder="Digite o destino..."
                placeholderTextColor="#666"
                value={destinationAddress}
                onChangeText={handleSearchChange}
              />
              {destinationAddress.length > 0 && (
                <TouchableOpacity onPress={resetDestination} style={styles.resetButton}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Results */}
            {showResults && (
              <View style={styles.resultsContainer}>
                {searchResults.map((location, index) => (
                  <TouchableOpacity
                    key={`${location.name}-${index}`}
                    style={styles.resultItem}
                    onPress={() => handleLocationSelect(location)}
                  >
                    <Ionicons name="location-outline" size={16} color="#2196F3" />
                    <View style={styles.resultText}>
                      <Text style={styles.resultName}>{location.name}</Text>
                      <Text style={styles.resultArea}>{location.area}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Map Placeholder for Web */}
          <View style={styles.webMapPlaceholder}>
            <Ionicons name="map" size={80} color="#666" />
            <Text style={styles.mapPlaceholderText}>
              {destination ? 
                `Rota: ${originAddress} → ${destinationAddress}` : 
                'Selecione um destino para ver a rota'
              }
            </Text>
            {destination && estimatedPrice > 0 && (
              <View style={styles.webRouteInfo}>
                <Text style={styles.webRouteText}>
                  Distância estimada: {calculateDistance(userLocation || {latitude: -15.7801, longitude: -47.8827}, destination).toFixed(1)} km
                </Text>
                <Text style={styles.webPriceText}>
                  Preço estimado: R$ {estimatedPrice.toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          {/* Quick Destinations */}
          <View style={styles.quickDestinations}>
            <Text style={styles.quickDestinationsTitle}>Destinos populares:</Text>
            <View style={styles.quickDestinationsGrid}>
              {brasiliaLocations.slice(0, 6).map((location) => (
                <TouchableOpacity
                  key={location.name}
                  style={styles.quickDestinationButton}
                  onPress={() => handleLocationSelect(location)}
                >
                  <Text style={styles.quickDestinationText}>{location.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Confirm Button */}
          {destination && (
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmTrip}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirmar Viagem</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Mobile version with real maps
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Para onde vamos?</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        {GooglePlacesAutocomplete && (
          <GooglePlacesAutocomplete
            ref={autocompleteRef}
            placeholder="Digite o destino..."
            onPress={(data: any, details: any) => {
              if (details?.geometry?.location) {
                const coords = {
                  latitude: details.geometry.location.lat,
                  longitude: details.geometry.location.lng,
                };
                setDestination(coords);
                setDestinationAddress(data.description);
              }
            }}
            query={{
              key: GOOGLE_MAPS_API_KEY,
              language: 'pt-BR',
              components: 'country:br',
              location: '-15.7801,-47.8827',
              radius: 50000,
            }}
            styles={{
              container: styles.autocompleteContainer,
              textInputContainer: styles.textInputContainer,
              textInput: styles.textInput,
              listView: styles.listView,
              row: styles.suggestionRow,
              description: styles.suggestionText,
            }}
            fetchDetails={true}
            enablePoweredByContainer={false}
            nearbyPlacesAPI="GooglePlacesSearch"
            debounce={200}
          />
        )}
        
        {destination && (
          <TouchableOpacity onPress={resetDestination} style={styles.resetButtonMobile}>
            <Ionicons name="close-circle" size={24} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {locationLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Obtendo sua localização...</Text>
          </View>
        ) : (
          MapView && (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              region={{
                latitude: userLocation?.latitude || -15.7801,
                longitude: userLocation?.longitude || -47.8827,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              showsUserLocation={true}
              showsMyLocationButton={false}
              toolbarEnabled={false}
              loadingEnabled={true}
            >
              {userLocation && Marker && (
                <Marker
                  coordinate={userLocation}
                  title="Sua localização"
                  description={originAddress}
                  pinColor="#4CAF50"
                />
              )}
              
              {destination && Marker && (
                <Marker
                  coordinate={destination}
                  title="Destino"
                  description={destinationAddress}
                  pinColor="#f44336"
                />
              )}
            </MapView>
          )
        )}
      </View>

      {/* Trip Details Card */}
      {destination && estimatedPrice > 0 && (
        <View style={styles.tripDetailsCard}>
          <View style={styles.tripInfo}>
            <View style={styles.routeInfo}>
              <Text style={styles.routeDistance}>
                {userLocation ? `${calculateDistance(userLocation, destination).toFixed(1)} km` : '-- km'}
              </Text>
              <Text style={styles.routeDuration}>
                {userLocation ? `${Math.max(10, Math.round(calculateDistance(userLocation, destination) * 2))} min` : '-- min'}
              </Text>
            </View>
            <View style={styles.priceInfo}>
              <Text style={styles.priceLabel}>Preço estimado</Text>
              <Text style={styles.priceValue}>R$ {estimatedPrice.toFixed(2)}</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmTrip}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmButtonText}>Confirmar Viagem</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Calculando rota...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  webContainer: {
    flex: 1,
    padding: 16,
  },
  currentLocationCard: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  currentLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentLocationText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  searchContainer: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  resetButton: {
    padding: 4,
  },
  resetButtonMobile: {
    marginLeft: 12,
    padding: 8,
  },
  resultsContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 200,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    gap: 12,
  },
  resultText: {
    flex: 1,
  },
  resultName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  resultArea: {
    color: '#888',
    fontSize: 14,
  },
  webMapPlaceholder: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 200,
  },
  mapPlaceholderText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  webRouteInfo: {
    marginTop: 16,
    alignItems: 'center',
  },
  webRouteText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  webPriceText: {
    color: '#4CAF50',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quickDestinations: {
    marginBottom: 20,
  },
  quickDestinationsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  quickDestinationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickDestinationButton: {
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  quickDestinationText: {
    color: '#fff',
    fontSize: 14,
  },
  autocompleteContainer: {
    flex: 1,
  },
  textInputContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 0,
  },
  listView: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginTop: 4,
  },
  suggestionRow: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestionText: {
    color: '#fff',
    fontSize: 14,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  tripDetailsCard: {
    backgroundColor: '#2a2a2a',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  tripInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  routeInfo: {
    flex: 1,
  },
  routeDistance: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  routeDuration: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  priceInfo: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 14,
    color: '#888',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  closeButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default GoogleMapView;