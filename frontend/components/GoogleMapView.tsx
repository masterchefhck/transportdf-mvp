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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

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
    passengerName?: string;
  }) => void;
  onClose: () => void;
  isForMe?: boolean;
  passengerName?: string;
}

const GoogleMapView: React.FC<GoogleMapViewProps> = ({ onTripRequest, onClose, isForMe = true, passengerName }) => {
  const [region, setRegion] = useState({
    latitude: -15.7801, // Brasília default
    longitude: -47.8827,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });
  
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [destination, setDestination] = useState<Coordinates | null>(null);
  const [destinationAddress, setDestinationAddress] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [route, setRoute] = useState<RouteData | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  
  const mapRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [nativeMapComponents, setNativeMapComponents] = useState<any>({});

  const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Helper function to calculate distance between two points (Haversine formula)
  const calculateDistance = (point1: Coordinates, point2: Coordinates): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Load native components only on mobile platforms
  useEffect(() => {
    if (Platform.OS !== 'web') {
      const loadNativeComponents = async () => {
        try {
          const mapModule = await import('react-native-maps');
          const placesModule = await import('react-native-google-places-autocomplete');
          
          setNativeMapComponents({
            MapView: mapModule.default,
            Marker: mapModule.Marker,
            PROVIDER_GOOGLE: mapModule.PROVIDER_GOOGLE,
            Polyline: mapModule.Polyline,
            GooglePlacesAutocomplete: placesModule.GooglePlacesAutocomplete,
          });
        } catch (error) {
          console.warn('Failed to load native map components:', error);
        }
      };
      
      loadNativeComponents();
    }
  }, []);

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
      setRegion({
        ...userCoords,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });

      // Get address for current location
      const reverseGeocode = await Location.reverseGeocodeAsync(userCoords);
      if (reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const formattedAddress = `${address.street || ''} ${address.streetNumber || ''}, ${address.district || ''}, ${address.city || 'Brasília'} - ${address.region || 'DF'}`.trim();
        setOriginAddress(formattedAddress);
      } else {
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
    if (!userLocation || !destination) {
      console.warn('Missing userLocation or destination for route calculation');
      return;
    }

    try {
      setLoading(true);
      
      // Check if we have a valid API key
      if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'SUA_CHAVE_GOOGLE_MAPS_AQUI') {
        console.warn('Google Maps API key not configured, using estimated values');
        
        // Fallback: Calculate estimated distance and duration
        const estimatedDistance = calculateDistance(userLocation, destination);
        const estimatedDuration = Math.ceil(estimatedDistance * 2); // Rough estimate: 2 min per km
        
        const fallbackRoute: RouteData = {
          coordinates: [userLocation, destination], // Simple direct line
          distance: `${estimatedDistance.toFixed(1)} km`,
          duration: `${estimatedDuration} min`,
        };
        
        setRoute(fallbackRoute);
        setLoading(false);
        return;
      }
      
      // Google Directions API
      const origin = `${userLocation.latitude},${userLocation.longitude}`;
      const dest = `${destination.latitude},${destination.longitude}`;
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&key=${GOOGLE_MAPS_API_KEY}&mode=driving&language=pt-BR&region=BR`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        // Decode polyline
        const points = decodePolyline(route.overview_polyline.points);
        
        const routeData: RouteData = {
          coordinates: points,
          distance: leg.distance.text,
          duration: leg.duration.text,
        };
        
        setRoute(routeData);
      } else {
        // API returned error, use fallback
        console.warn('Google Directions API error:', data.status, data.error_message);
        
        const estimatedDistance = calculateDistance(userLocation, destination);
        const estimatedDuration = Math.ceil(estimatedDistance * 2);
        
        const fallbackRoute: RouteData = {
          coordinates: [userLocation, destination],
          distance: `${estimatedDistance.toFixed(1)} km`,
          duration: `${estimatedDuration} min`,
        };
        
        setRoute(fallbackRoute);
        
        // Calculate estimated price for fallback (R$ 2.50 base + R$ 2.50 per km)
        const estimatedDistanceNum = parseFloat(fallbackRoute.distance);
        const price = 2.50 + (estimatedDistanceNum * 2.50);
        setEstimatedPrice(Math.round(price * 100) / 100);
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      Alert.alert('Erro', 'Erro ao calcular rota');
    } finally {
      setLoading(false);
    }
  };

  // Function to decode Google's polyline encoding
  const decodePolyline = (encoded: string): Coordinates[] => {
    const points: Coordinates[] = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b: number;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };

  // Web-compatible place search function with popular destinations fallback
  const searchPlaces = async (input: string) => {
    if (!input.trim()) {
      setShowSuggestions(false);
      return;
    }
    
    // Popular destinations as fallback
    const popularDestinations = [
      { 
        place_id: 'brasilia-1', 
        description: 'Brasília, DF, Brasil',
        geometry: { location: { lat: -15.7942, lng: -47.8822 } }
      },
      { 
        place_id: 'caldas-novas-1', 
        description: 'Caldas Novas, GO, Brasil',
        geometry: { location: { lat: -17.7739, lng: -48.6255 } }
      },
      { 
        place_id: 'goiania-1', 
        description: 'Goiânia, GO, Brasil',
        geometry: { location: { lat: -16.6868, lng: -49.2648 } }
      },
      { 
        place_id: 'anapolis-1', 
        description: 'Anápolis, GO, Brasil',
        geometry: { location: { lat: -16.3267, lng: -48.9530 } }
      },
      { 
        place_id: 'aparecida-1', 
        description: 'Aparecida de Goiânia, GO, Brasil',
        geometry: { location: { lat: -16.8173, lng: -49.2437 } }
      }
    ];

    // Filter popular destinations based on input
    const filteredDestinations = popularDestinations.filter(dest =>
      dest.description.toLowerCase().includes(input.toLowerCase())
    );

    if (filteredDestinations.length > 0) {
      setSearchSuggestions(filteredDestinations);
      setShowSuggestions(true);
      return;
    }

    // If API key is available, try Google Places API
    if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'SUA_CHAVE_GOOGLE_MAPS_AQUI') {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_API_KEY}&language=pt-BR&components=country:br`
        );
        const data = await response.json();
        
        if (data.predictions && data.predictions.length > 0) {
          setSearchSuggestions(data.predictions);
          setShowSuggestions(true);
        } else {
          // Show popular destinations if no API results
          setSearchSuggestions(popularDestinations.slice(0, 3));
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Error searching places:', error);
        // Fallback to popular destinations on error
        setSearchSuggestions(popularDestinations.slice(0, 3));
        setShowSuggestions(true);
      }
    } else {
      // No valid API key, show popular destinations
      setSearchSuggestions(popularDestinations.slice(0, 3));
      setShowSuggestions(true);
    }
  };

  const handlePlaceSelect = async (data: any, details?: any) => {
    if (Platform.OS !== 'web' && details && details.geometry && details.geometry.location) {
      // Native implementation with GooglePlacesAutocomplete
      const destination = {
        latitude: details.geometry.location.lat,
        longitude: details.geometry.location.lng,
      };
      
      setDestination(destination);
      setDestinationAddress(data.description);
      
      if (userLocation) {
        calculateRoute();
      }
    } else {
      // Web/Universal implementation
      let destination: any = null;
      
      // Check if it's a popular destination (with geometry already included)
      if (data.geometry && data.geometry.location) {
        destination = {
          latitude: data.geometry.location.lat,
          longitude: data.geometry.location.lng,
        };
      } else if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'SUA_CHAVE_GOOGLE_MAPS_AQUI') {
        // Try to get place details from Google API
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${data.place_id}&key=${GOOGLE_MAPS_API_KEY}&fields=geometry,name,formatted_address`
          );
          const detailData = await response.json();
          
          if (detailData.result && detailData.result.geometry) {
            destination = {
              latitude: detailData.result.geometry.location.lat,
              longitude: detailData.result.geometry.location.lng,
            };
          }
        } catch (error) {
          console.error('Error getting place details:', error);
        }
      }
      
      if (destination) {
        setDestination(destination);
        setDestinationAddress(data.description);
        setShowSuggestions(false);
        
        if (userLocation) {
          calculateRoute();
        }
      } else {
        Alert.alert('Erro', 'Não foi possível obter detalhes do local selecionado.');
      }
    }
  };

  const handleConfirmTrip = () => {
    if (!userLocation || !destination || !route) {
      Alert.alert('Erro', 'Dados da viagem incompletos');
      return;
    }

    onTripRequest({
      origin: userLocation,
      destination,
      originAddress,
      destinationAddress,
      estimatedPrice,
      distance: route.distance,
      duration: route.duration,
      passengerName: !isForMe ? passengerName : undefined,
    });
  };

  const resetDestination = () => {
    setDestination(null);
    setDestinationAddress('');
    setRoute(null);
    setEstimatedPrice(0);
    if (autocompleteRef.current) {
      autocompleteRef.current.clear();
    }
  };

  if (!GOOGLE_MAPS_API_KEY) {
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
        {false ? ( // Temporarily disabled to avoid issues
          <nativeMapComponents.GooglePlacesAutocomplete
            ref={autocompleteRef}
            placeholder="Digite o destino..."
            onPress={handlePlaceSelect}
            query={{
              key: GOOGLE_MAPS_API_KEY,
              language: 'pt-BR',
              components: 'country:br',
              types: 'establishment',
              // Removed location and radius to allow searches throughout Brazil
            }}
            requestUrl={{
              useOnPlatform: 'web',
              url: 'https://maps.googleapis.com/maps/api/place/autocomplete/json',
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
            debounce={300}
            minLength={2}
            autoFillOnNotFound={false}
            returnKeyType="search"
            listEmptyComponent={() => (
              <View style={styles.emptyResultContainer}>
                <Text style={styles.emptyResultText}>Nenhum resultado encontrado</Text>
              </View>
            )}
            onFail={(error) => {
              console.warn('GooglePlacesAutocomplete error:', error);
            }}
            filterReverseGeocodingByTypes={['locality', 'administrative_area_level_3']}
          />
        ) : (
          // Web-compatible search input
          <View style={styles.webSearchContainer}>
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Digite o destino..."
                placeholderTextColor="#999"
                value={destinationAddress}
                onChangeText={(text) => {
                  setDestinationAddress(text);
                  if (text.length > 2) {
                    searchPlaces(text);
                  } else {
                    setShowSuggestions(false);
                  }
                }}
              />
            </View>
            
            {showSuggestions && searchSuggestions.length > 0 && (
              <FlatList
                data={searchSuggestions}
                keyExtractor={(item) => item.place_id}
                style={styles.suggestionsList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionRow}
                    onPress={() => handlePlaceSelect(item)}
                  >
                    <Text style={styles.suggestionText}>{item.description}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}
        
        {destination && (
          <TouchableOpacity onPress={resetDestination} style={styles.resetButton}>
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
          Platform.OS !== 'web' && nativeMapComponents.MapView ? (
            <nativeMapComponents.MapView
              ref={mapRef}
              style={styles.map}
              provider={nativeMapComponents.PROVIDER_GOOGLE}
              region={region}
              showsUserLocation={true}
              showsMyLocationButton={false}
              toolbarEnabled={false}
              loadingEnabled={true}
            >
              {/* Origin Marker */}
              {userLocation && (
                <nativeMapComponents.Marker
                  coordinate={userLocation}
                  title="Sua localização"
                  description={originAddress}
                  pinColor="#4CAF50"
                />
              )}
              
              {/* Destination Marker */}
              {destination && (
                <nativeMapComponents.Marker
                  coordinate={destination}
                  title="Destino"
                  description={destinationAddress}
                  pinColor="#f44336"
                />
              )}
              
              {/* Route Polyline */}
              {route && (
                <nativeMapComponents.Polyline
                  coordinates={route.coordinates}
                  strokeColor="#2196F3"
                  strokeWidth={4}
                  lineDashPattern={[1]}
                />
              )}
            </nativeMapComponents.MapView>
          ) : (
            // Web-compatible map placeholder
            <View style={[styles.map, styles.webMapPlaceholder]}>
              <Ionicons name="map" size={80} color="#666" />
              <Text style={styles.webMapTitle}>Mapa não disponível na web</Text>
              <Text style={styles.webMapSubtitle}>
                Use o aplicativo mobile para visualizar o mapa interativo
              </Text>
              
              {userLocation && destination && (
                <View style={styles.locationInfo}>
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={16} color="#007AFF" />
                    <Text style={styles.locationText}>Origem: {originAddress}</Text>
                  </View>
                  <View style={styles.locationRow}>
                    <Ionicons name="flag" size={16} color="#FF3B30" />
                    <Text style={styles.locationText}>Destino: {destinationAddress}</Text>
                  </View>
                  {route && (
                    <View style={styles.webRouteInfo}>
                      <Text style={styles.routeText}>Distância: {route.distance}</Text>
                      <Text style={styles.routeText}>Tempo: {route.duration}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )
        )}
      </View>

      {/* Trip Details Card */}
      {destination && route && (
        <View style={styles.tripDetailsCard}>
          <View style={styles.tripInfo}>
            <View style={styles.routeInfo}>
              <Text style={styles.routeDistance}>{route.distance}</Text>
              <Text style={styles.routeDuration}>{route.duration}</Text>
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
    marginRight: 40, // Compensate for back button
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  autocompleteContainer: {
    flex: 1,
  },
  textInputContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 0,
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  listView: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginTop: 4,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
  resetButton: {
    marginLeft: 12,
    padding: 8,
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
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
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
  webSearchContainer: {
    flex: 1,
  },
  suggestionsList: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 200,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  webMapPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    padding: 40,
  },
  webMapTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  webMapSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  locationInfo: {
    marginTop: 30,
    width: '100%',
    maxWidth: 300,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  webRouteInfo: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  routeText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  emptyResultContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyResultText: {
    color: '#888',
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default GoogleMapView;