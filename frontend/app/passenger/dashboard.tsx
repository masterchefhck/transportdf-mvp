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
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import ChatComponent from '../../components/ChatComponent';
import TripMapView from '../../components/TripMapView';
import GoogleMapView from '../../components/GoogleMapView';
import TripTypeModal from '../../components/TripTypeModal';
import { useGoogleMaps } from '../../components/useGoogleMaps';

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
  driver_name?: string;
  driver_photo?: string;
  driver_rating?: number;
  pickup_address: string;
  destination_address: string;
  estimated_price: number;
  status: string;
  requested_at: string;
  rated?: boolean;
  passenger_name?: string;
  requested_by?: string;
  is_for_another_person?: boolean;
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
  const [destinationAddress, setDestinationAddress] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [currentRating, setCurrentRating] = useState<number>(5.0);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  
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

  // Chat states
  const [showChatModal, setShowChatModal] = useState(false);
  const [newMessageAlert, setNewMessageAlert] = useState(false);

  // Google Map states - NOVOS ESTADOS
  const [showTripTypeModal, setShowTripTypeModal] = useState(false);
  const [showGoogleMapModal, setShowGoogleMapModal] = useState(false);
  const [tripIsForMe, setTripIsForMe] = useState(true);
  const [tripPassengerName, setTripPassengerName] = useState('');

  // Photo modal states
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>('');
  const [selectedPhotoUser, setSelectedPhotoUser] = useState<string>('');

  // Track rated trips to prevent modal loops
  const [ratedTripIds, setRatedTripIds] = useState<Set<string>>(new Set());

  // Progress bar animation for "Procurando motorista"
  const [progressAnim] = useState(new Animated.Value(0));
  
  // Autocomplete states
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  
  // Google Maps integration
  const { getDirections, geocodeAddress, reverseGeocode, calculateTripPrice } = useGoogleMaps();

  // Comprehensive Brasília locations for autocomplete
  const brasiliaLocations = [
    // Main Areas
    { name: 'Asa Norte', area: 'Plano Piloto', coords: { lat: -15.7801, lng: -47.8827 } },
    { name: 'Asa Sul', area: 'Plano Piloto', coords: { lat: -15.8267, lng: -47.8934 } },
    { name: 'Taguatinga', area: 'Região Administrativa', coords: { lat: -15.8270, lng: -48.0427 } },
    { name: 'Ceilândia', area: 'Região Administrativa', coords: { lat: -15.8190, lng: -48.1076 } },
    { name: 'Gama', area: 'Região Administrativa', coords: { lat: -16.0209, lng: -48.0647 } },
    { name: 'Sobradinho', area: 'Região Administrativa', coords: { lat: -15.6536, lng: -47.7863 } },
    { name: 'Planaltina', area: 'Região Administrativa', coords: { lat: -15.4523, lng: -47.6142 } },
    
    // Transportation Hubs
    { name: 'Aeroporto Internacional de Brasília (JK)', area: 'Transporte', coords: { lat: -15.8711, lng: -47.9178 } },
    { name: 'Rodoviária do Plano Piloto', area: 'Transporte', coords: { lat: -15.7945, lng: -47.8828 } },
    { name: 'Estação Central do Metrô', area: 'Transporte', coords: { lat: -15.7942, lng: -47.8822 } },
    
    // Shopping Centers
    { name: 'Shopping Conjunto Nacional', area: 'Shopping', coords: { lat: -15.7942, lng: -47.8922 } },
    { name: 'Shopping Brasília', area: 'Shopping', coords: { lat: -15.7642, lng: -47.8822 } },
    { name: 'Shopping Iguatemi', area: 'Shopping', coords: { lat: -15.7842, lng: -47.8922 } },
    { name: 'Shopping Taguatinga', area: 'Shopping', coords: { lat: -15.8370, lng: -48.0527 } },
    { name: 'Shopping JK Iguatemi', area: 'Shopping', coords: { lat: -15.8042, lng: -47.8622 } },
    
    // Government & Landmarks
    { name: 'Esplanada dos Ministérios', area: 'Governo', coords: { lat: -15.7942, lng: -47.8822 } },
    { name: 'Congresso Nacional', area: 'Governo', coords: { lat: -15.7998, lng: -47.8635 } },
    { name: 'Palácio do Planalto', area: 'Governo', coords: { lat: -15.7987, lng: -47.8606 } },
    { name: 'Supremo Tribunal Federal', area: 'Governo', coords: { lat: -15.8016, lng: -47.8616 } },
    { name: 'Catedral de Brasília', area: 'Turismo', coords: { lat: -15.7942, lng: -47.8755 } },
    { name: 'Torre de TV', area: 'Turismo', coords: { lat: -15.7902, lng: -47.8922 } },
    
    // Hospitals
    { name: 'Hospital de Base do DF', area: 'Saúde', coords: { lat: -15.7642, lng: -47.8922 } },
    { name: 'Hospital Sarah Kubitschek', area: 'Saúde', coords: { lat: -15.7742, lng: -47.8822 } },
    { name: 'Hospital Universitário de Brasília (HUB)', area: 'Saúde', coords: { lat: -15.7642, lng: -47.8722 } },
    
    // Universities
    { name: 'Universidade de Brasília (UnB)', area: 'Educação', coords: { lat: -15.7642, lng: -47.8722 } },
    { name: 'Campus Darcy Ribeiro - UnB', area: 'Educação', coords: { lat: -15.7642, lng: -47.8722 } },
    
    // Commercial Areas
    { name: 'W3 Norte', area: 'Comercial', coords: { lat: -15.7701, lng: -47.8827 } },
    { name: 'W3 Sul', area: 'Comercial', coords: { lat: -15.8167, lng: -47.8934 } },
    { name: 'Setor Comercial Norte (SCN)', area: 'Comercial', coords: { lat: -15.7842, lng: -47.8822 } },
    { name: 'Setor Comercial Sul (SCS)', area: 'Comercial', coords: { lat: -15.8042, lng: -47.8822 } },
    
    // Residential Areas
    { name: 'Lago Norte', area: 'Residencial', coords: { lat: -15.7342, lng: -47.8422 } },
    { name: 'Lago Sul', area: 'Residencial', coords: { lat: -15.8442, lng: -47.8422 } },
    { name: 'Sudoeste', area: 'Residencial', coords: { lat: -15.7942, lng: -47.9022 } },
    { name: 'Noroeste', area: 'Residencial', coords: { lat: -15.7642, lng: -47.8822 } },
    
    // Other Areas
    { name: 'Vicente Pires', area: 'Região Administrativa', coords: { lat: -15.8042, lng: -48.0322 } },
    { name: 'Águas Claras', area: 'Região Administrativa', coords: { lat: -15.8342, lng: -48.0122 } },
    { name: 'Guará', area: 'Região Administrativa', coords: { lat: -15.8242, lng: -47.9522 } },
    { name: 'Núcleo Bandeirante', area: 'Região Administrativa', coords: { lat: -15.8642, lng: -47.9622 } },
    { name: 'Candangolândia', area: 'Região Administrativa', coords: { lat: -15.8542, lng: -47.9422 } },
    { name: 'Santa Maria', area: 'Região Administrativa', coords: { lat: -16.0042, lng: -48.0322 } },
    { name: 'São Sebastião', area: 'Região Administrativa', coords: { lat: -15.9042, lng: -47.7822 } },
    { name: 'Paranoá', area: 'Região Administrativa', coords: { lat: -15.7342, lng: -47.7222 } },
    { name: 'Itapoã', area: 'Região Administrativa', coords: { lat: -15.7542, lng: -47.7422 } },
  ];

  // Handle destination input with debounced search (web-compatible)
  const handleDestinationChange = (text: string) => {
    setDestinationAddress(text);
    
    console.log('Destination changed:', text); // Debug log
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Immediate search for better web compatibility
    if (text.length >= 2) {
      searchDestinations(text);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    
    // Also do debounced search
    const timeout = setTimeout(() => {
      if (text.length >= 2) {
        searchDestinations(text);
      }
    }, 300);
    
    setSearchTimeout(timeout);
  };

  // Search suggestions based on user input (improved)
  const searchDestinations = (query: string) => {
    console.log('Searching for:', query); // Debug log
    
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = brasiliaLocations.filter(location =>
      location.name.toLowerCase().includes(query.toLowerCase()) ||
      location.area.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8); // Limit to 8 suggestions

    console.log('Found suggestions:', filtered.length); // Debug log
    
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: any) => {
    setDestinationAddress(suggestion.name);
    setShowSuggestions(false);
    setSuggestions([]);
    
    // Auto-calculate price when destination is selected
    calculateEstimatePrice(suggestion);
  };

  useEffect(() => {
    loadUserData();
    requestLocationPermission();
    checkCurrentTrip();
    loadMyReports();
    loadCurrentRating();
    loadAdminMessages();
  }, []);

  // Auto-refresh data every 5 seconds for real-time sync
  useEffect(() => {
    const interval = setInterval(() => {
      checkCurrentTrip(); // Check for trip status updates
      loadAdminMessages(); // Check for new admin messages
      checkForNewMessages(); // Check for new chat messages
    }, 5000); // 5 seconds polling

    return () => clearInterval(interval);
  }, []);

  // Start progress animation when trip status is "requested"
  useEffect(() => {
    if (currentTrip?.status === 'requested') {
      // Start looping animation
      const startAnimation = () => {
        progressAnim.setValue(0);
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 2000, // 2 seconds for full progress
          useNativeDriver: false,
        }).start(() => {
          // Loop the animation
          startAnimation();
        });
      };
      startAnimation();
    }
  }, [currentTrip?.status]);

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

      // Find completed trips that might need rating
      const completedTrips = response.data.filter(
        (trip: Trip) => trip.status === 'completed'
      );

      // Check for trips that need rating (not already shown or rated)
      const needsRating = completedTrips.find((trip: Trip) => {
        // Trip needs rating if:
        // 1. NOT already rated (rated !== true)
        // 2. NOT has passenger_rating_given 
        // 3. NOT in our local ratedTripIds set (prevents showing again)
        // 4. Modal is not already showing
        const notRated = trip.rated !== true && !trip.passenger_rating_given;
        const notInLocalSet = !ratedTripIds.has(trip.id);
        const modalNotShowing = !showRatingModal;
        
        return notRated && notInLocalSet && modalNotShowing;
      });

      if (activeTrip) {
        setCurrentTrip(activeTrip);
      } else if (needsRating) {
        // Show rating modal for this trip
        setCompletedTrip(needsRating);
        setShowRatingModal(true);
        setCurrentTrip(null);
        
        // Add to local set to prevent showing again
        setRatedTripIds(prev => new Set([...prev, needsRating.id]));
      } else {
        setCurrentTrip(null);
      }
    } catch (error) {
      console.log('Error checking current trip:', error);
    }
  };

  const calculateEstimatePrice = (suggestion?: any) => {  
    // Simulate price calculation (in real app, would use Google Maps Distance Matrix)
    const basePrice = 5.0;
    const randomDistance = Math.random() * 20 + 2; // 2-22 km
    const pricePerKm = 2.5;
    const price = basePrice + (randomDistance * pricePerKm);
    setEstimatedPrice(Math.round(price * 100) / 100);
  };

  const handleRequestTrip = async () => {
    if (!destinationAddress.trim()) {
      showAlert('Erro', 'Por favor, escolha um destino');
      return;
    }

    if (!location) {
      showAlert('Erro', 'Localização atual não disponível. Verifique as permissões de localização.');
      return;
    }

    setLoading(true);
    try {
      // Use current location as pickup (like Uber/99)
      const pickupLat = location.coords.latitude;
      const pickupLng = location.coords.longitude;
      
      // Get formatted address for current location
      const pickupGeocode = await reverseGeocode(pickupLat, pickupLng);
      const pickupFormattedAddress = pickupGeocode?.formatted_address || 'Sua localização atual';

      // Try to find destination in our local database first
      let destinationLat, destinationLng, destinationFormattedAddress;
      
      const localDestination = brasiliaLocations.find(loc => 
        loc.name.toLowerCase() === destinationAddress.toLowerCase()
      );
      
      if (localDestination) {
        // Use local coordinates (more reliable)
        destinationLat = localDestination.coords.lat;
        destinationLng = localDestination.coords.lng;
        destinationFormattedAddress = `${localDestination.name}, Brasília - DF, Brasil`;
      } else {
        // Fallback to geocoding service
        const destinationGeocode = await geocodeAddress(destinationAddress);
        if (!destinationGeocode) {
          showAlert('Erro', 'Destino não encontrado. Tente usar sugestões da lista ou digite um local conhecido de Brasília.');
          return;
        }
        
        destinationLat = destinationGeocode.geometry.location.lat;
        destinationLng = destinationGeocode.geometry.location.lng;
        destinationFormattedAddress = destinationGeocode.formatted_address;
      }

      // Get route for better price calculation
      const route = await getDirections(
        { lat: pickupLat, lng: pickupLng },
        { lat: destinationLat, lng: destinationLng }
      );

      const estimatedPrice = route ? calculateTripPrice(route.distance) : 10.0;

      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.post(
        `${API_URL}/api/trips/request`,
        {
          passenger_id: user?.id,
          pickup_latitude: pickupLat,
          pickup_longitude: pickupLng,
          pickup_address: pickupFormattedAddress,
          destination_latitude: destinationLat,
          destination_longitude: destinationLng,
          destination_address: destinationFormattedAddress,
          estimated_price: estimatedPrice,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data) {
        setCurrentTrip(response.data);
        setDestinationAddress('');
        setShowSuggestions(false);
        setSuggestions([]);
        showAlert(
          'Sucesso', 
          `Corrida solicitada!\nPreço estimado: R$ ${estimatedPrice.toFixed(2)}\n${route ? `Distância: ${route.distance} • Tempo: ${route.duration}` : ''}`
        );
        
        setShowRequestModal(false);
      }
    } catch (error: any) {
      console.error('Erro ao solicitar corrida:', error);
      const errorMessage = error.response?.data?.detail || 'Erro ao solicitar corrida';
      showAlert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // NOVA FUNÇÃO: Handle Trip Type Confirm
  const handleTripTypeConfirm = (isForMe: boolean, passengerName?: string) => {
    setTripIsForMe(isForMe);
    setTripPassengerName(passengerName || '');
    setShowTripTypeModal(false);
    setShowGoogleMapModal(true);
  };

  // FUNÇÃO ATUALIZADA: Handle Google Maps Trip Request
  const handleGoogleMapTripRequest = async (tripData: {
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
    originAddress: string;
    destinationAddress: string;
    estimatedPrice: number;
    distance: string;
    duration: string;
    passengerName?: string;
  }) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      
      // Dados para enviar ao backend
      const requestData = {
        passenger_id: user?.id,
        pickup_latitude: tripData.origin.latitude,
        pickup_longitude: tripData.origin.longitude,
        pickup_address: tripData.originAddress,
        destination_latitude: tripData.destination.latitude,
        destination_longitude: tripData.destination.longitude,
        destination_address: tripData.destinationAddress,
        estimated_price: tripData.estimatedPrice,
        // Se for para outra pessoa, adicionar informações extras
        ...(tripData.passengerName && {
          passenger_name: tripData.passengerName,
          requested_by: user?.name,
          is_for_another_person: true
        })
      };

      const response = await axios.post(
        `${API_URL}/api/trips/request`,
        requestData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data) {
        setCurrentTrip(response.data);
        setShowGoogleMapModal(false);
        
        const successMessage = tripData.passengerName 
          ? `Corrida solicitada para ${tripData.passengerName}!\nPreço estimado: R$ ${tripData.estimatedPrice.toFixed(2)}\nDistância: ${tripData.distance} • Tempo: ${tripData.duration}`
          : `Corrida solicitada!\nPreço estimado: R$ ${tripData.estimatedPrice.toFixed(2)}\nDistância: ${tripData.distance} • Tempo: ${tripData.duration}`;
        
        showAlert('Sucesso', successMessage);
      }
    } catch (error: any) {
      console.error('Erro ao solicitar corrida:', error);
      const errorMessage = error.response?.data?.detail || 'Erro ao solicitar corrida';
      showAlert('Erro', errorMessage);
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

      // Show success message
      showAlert('Sucesso', 'Avaliação enviada com sucesso!');
      
      // Mark this trip as rated in our local state to prevent modal reappearing
      setRatedTripIds(prev => new Set([...prev, completedTrip.id]));
      
      // Clear all rating related states
      setShowRatingModal(false);
      setRating(5);
      setRatingReason('');
      setCompletedTrip(null);
      
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      if (error.response?.status === 400 && error.response?.data?.detail?.includes('already exists')) {
        // If rating already exists, mark as rated and close modal
        showAlert('Aviso', 'Você já avaliou esta viagem');
        setRatedTripIds(prev => new Set([...prev, completedTrip.id]));
        setShowRatingModal(false);
        setCompletedTrip(null);
      } else {
        showAlert('Erro', 'Erro ao enviar avaliação');
      }
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
    router.push('/passenger/history');
  };

  const handlePaymentPress = () => {
    showAlert('Pagamento', 'Funcionalidade de métodos de pagamento será implementada em breve.');
  };

  const handleHelpPress = () => {
    showAlert('Ajuda', 'Entre em contato conosco:\n\nEmail: suporte@transportdf.com\nTelefone: (61) 3333-4444\n\nHorário de atendimento:\nSegunda a Sexta: 8h às 18h\nSábado: 8h às 12h');
  };

  const handleViewPhoto = (photoUrl: string | undefined, driverName: string) => {
    if (photoUrl) {
      setSelectedPhotoUrl(photoUrl);
      setSelectedPhotoUser(driverName);
      setShowPhotoModal(true);
    }
  };

  const checkForNewMessages = async () => {
    if (!currentTrip?.id || showChatModal) return; // Don't check if chat is open
    
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(
        `${API_URL}/api/trips/${currentTrip.id}/chat/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const messages = response.data;
      if (messages.length > 0) {
        // Check for messages from driver (other user)
        const lastMessageFromOther = messages
          .filter((msg: any) => msg.sender_id !== user?.id)
          .pop();
        
        if (lastMessageFromOther) {
          const lastMessageTime = new Date(lastMessageFromOther.timestamp).getTime();
          const currentTime = new Date().getTime();
          const timeDiff = currentTime - lastMessageTime;
          
          // Show alert if message is less than 10 seconds old
          if (timeDiff < 10000) {
            setNewMessageAlert(true);
          }
        }
      }
    } catch (error) {
      // Silently fail - chat might not be available
    }
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
            <Text style={styles.locationText}>
              📍 {location ? 'Brasília, DF' : 'Obtendo localização...'}
            </Text>
            <View style={styles.userRating}>
              <Ionicons name="star" size={16} color="#FF9800" />
              <Text style={styles.ratingText}>{currentRating.toFixed(1)}</Text>
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
          <View style={styles.currentTripContainer}>
            {/* Trip Map View */}
            <TripMapView
              trip={currentTrip}
              currentLocation={location ? {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
              } : undefined}
              showDirections={true}
              style={styles.mapView}
            />

            {/* Current Trip Details */}
            <View style={styles.currentTripCard}>
              <View style={styles.tripHeader}>
                <Text style={styles.currentTripTitle}>
                  {currentTrip.is_for_another_person ? `Viagem de ${currentTrip.passenger_name}` : 'Viagem em Andamento'}
                </Text>
                <View style={styles.tripStatusBadge}>
                  <Text style={styles.tripStatusText}>{getStatusText(currentTrip.status)}</Text>
                </View>
              </View>

              {/* Driver Info Section */}
              {currentTrip.driver_name && (
                <View style={styles.driverInfoSection}>
                  <Text style={styles.sectionTitle}>Motorista</Text>
                  <View style={styles.driverInfoCard}>
                    <TouchableOpacity
                      onPress={() => handleViewPhoto(currentTrip.driver_photo, currentTrip.driver_name)}
                      disabled={!currentTrip.driver_photo}
                    >
                      {currentTrip.driver_photo ? (
                        <Image source={{ uri: currentTrip.driver_photo }} style={styles.currentDriverPhoto} />
                      ) : (
                        <View style={styles.defaultCurrentDriverPhoto}>
                          <Ionicons name="car" size={24} color="#666" />
                        </View>
                      )}
                    </TouchableOpacity>
                    <View style={styles.currentDriverDetails}>
                      <Text style={styles.currentDriverName}>{currentTrip.driver_name}</Text>
                      <View style={styles.currentDriverRating}>
                        <Ionicons name="star" size={16} color="#FF9800" />
                        <Text style={styles.currentDriverRatingText}>
                          {currentTrip.driver_rating ? currentTrip.driver_rating.toFixed(1) : '5.0'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {currentTrip.is_for_another_person && (
                <View style={styles.passengerInfoCard}>
                  <Ionicons name="person" size={16} color="#007AFF" />
                  <Text style={styles.passengerInfoText}>
                    Solicitada por você para: {currentTrip.passenger_name}
                  </Text>
                </View>
              )}

              {/* Trip Status and Actions */}
              <View style={styles.tripActions}>
                {(currentTrip.status === 'accepted' || currentTrip.status === 'in_progress') && (
                  <View style={styles.chatButtonContainer}>
                    <TouchableOpacity
                      style={styles.chatButton}
                      onPress={() => {
                        setShowChatModal(true);
                        setNewMessageAlert(false);
                      }}
                    >
                      <Ionicons name="chatbubbles" size={16} color="#fff" />
                      <Text style={styles.chatButtonText}>Chat com Motorista</Text>
                      {newMessageAlert && (
                        <View style={styles.messageAlert}>
                          <Text style={styles.messageAlertText}>Nova!</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
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
              onPress={() => setShowTripTypeModal(true)}
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
              <Text style={styles.modalTitle}>Para onde vamos?</Text>
              <TouchableOpacity
                onPress={() => setShowRequestModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Current Location Display */}
            <View style={styles.currentLocationCard}>
              <View style={styles.currentLocationRow}>
                <Ionicons name="navigate" size={20} color="#4CAF50" />
                <Text style={styles.currentLocationText}>
                  {location ? 'Sua localização atual' : 'Obtendo localização...'}
                </Text>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              </View>
              {location && (
                <Text style={styles.locationDetails}>
                  📍 {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
                </Text>
              )}
            </View>

            {/* Destination Input with Autocomplete */}
            <View style={styles.destinationInputContainer}>
              <View style={styles.inputContainer}>
                <Ionicons name="location" size={20} color="#f44336" />
                <TextInput
                  style={styles.input}
                  placeholder="Digite o destino..."
                  placeholderTextColor="#666"
                  value={destinationAddress}
                  onChangeText={handleDestinationChange}
                />
                {destinationAddress.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setDestinationAddress('');
                      setShowSuggestions(false);
                      setSuggestions([]);
                    }}
                    style={styles.clearButton}
                  >
                    <Ionicons name="close-circle" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Debug Info */}
              {__DEV__ && (
                <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                  Sugestões: {suggestions.length} | Mostrar: {showSuggestions ? 'Sim' : 'Não'} | Texto: "{destinationAddress}"
                </Text>
              )}

              {/* Autocomplete Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView style={styles.suggestionsList} showsVerticalScrollIndicator={false}>
                    {suggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={`${suggestion.name}-${index}`}
                        style={styles.suggestionItem}
                        onPress={() => handleSuggestionSelect(suggestion)}
                      >
                        <View style={styles.suggestionContent}>
                          <Ionicons name="location-outline" size={16} color="#2196F3" />
                          <View style={styles.suggestionText}>
                            <Text style={styles.suggestionName}>{suggestion.name}</Text>
                            <Text style={styles.suggestionArea}>{suggestion.area}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Fallback: Show first few suggestions as buttons for web */}
              {destinationAddress.length >= 2 && suggestions.length > 0 && (
                <View style={styles.webSuggestionsContainer}>
                  <Text style={styles.webSuggestionsTitle}>Sugestões:</Text>
                  <View style={styles.webSuggestionsGrid}>
                    {suggestions.slice(0, 4).map((suggestion, index) => (
                      <TouchableOpacity
                        key={`web-${suggestion.name}-${index}`}
                        style={styles.webSuggestionButton}
                        onPress={() => handleSuggestionSelect(suggestion)}
                      >
                        <Text style={styles.webSuggestionText}>{suggestion.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Quick Destination Buttons */}
            <View style={styles.quickDestinationsContainer}>
              <Text style={styles.quickDestinationsTitle}>Destinos populares:</Text>
              <View style={styles.quickDestinationsGrid}>
                {['Asa Sul', 'Taguatinga', 'Gama', 'Aeroporto', 'Ceilândia', 'Sobradinho'].map((destination) => (
                  <TouchableOpacity
                    key={destination}
                    style={styles.quickDestinationButton}
                    onPress={() => setDestinationAddress(destination)}
                  >
                    <Text style={styles.quickDestinationText}>{destination}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.addressHint}>
              💡 Sua localização atual será usada como ponto de partida
            </Text>

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
                  // Mark this trip as handled to prevent modal reappearing
                  if (completedTrip) {
                    setRatedTripIds(prev => new Set([...prev, completedTrip.id]));
                  }
                  setShowRatingModal(false);
                  setRating(5);
                  setRatingReason('');
                  setCompletedTrip(null);
                }}
              >
                <Text style={styles.skipButtonText}>Pular</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.submitButton} onPress={submitRating}>
                <Text style={styles.submitButtonText}>Enviar Avaliação</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Chat Modal */}
      <Modal visible={showChatModal} animationType="slide" presentationStyle="pageSheet">
        <ChatComponent
          tripId={currentTrip?.id || ''}
          currentUserId={user?.id || ''}
          currentUserType="passenger"
          onClose={() => setShowChatModal(false)}
          onNewMessage={() => setNewMessageAlert(true)}
        />
      </Modal>

      {/* Trip Type Modal */}
      <TripTypeModal
        visible={showTripTypeModal}
        onClose={() => setShowTripTypeModal(false)}
        onConfirm={handleTripTypeConfirm}
      />

      {/* Google Map Modal */}
      <Modal 
        visible={showGoogleMapModal} 
        animationType="slide" 
        presentationStyle="pageSheet"
      >
        <GoogleMapView
          onTripRequest={handleGoogleMapTripRequest}
          onClose={() => setShowGoogleMapModal(false)}
          isForMe={tripIsForMe}
          passengerName={tripPassengerName}
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
    margin: 20,
    borderRadius: 15,
    padding: 20,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
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
    fontSize: 14,
    color: '#fff',
    marginLeft: 10,
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
  passengerInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    gap: 8,
  },
  passengerInfoText: {
    fontSize: 14,  
    color: '#1976D2',
    fontWeight: '500',
  },
  tripActions: {
    marginTop: 16,
    gap: 12,
  },
  chatButton: {
    backgroundColor: '#4CAF50',
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
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxWidth: 400,
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
  // Driver Info Styles
  driverInfo: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  driverInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
  },
  driverDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  defaultDriverPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverTextInfo: {
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
    backgroundColor: '#4CAF50',
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
  // Searching driver animation styles
  searchingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  searchingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  progressBarContainer: {
    width: 120,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  // New styles for updated layout
  currentTripContainer: {
    flex: 1,
  },
  mapView: {
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  currentTripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  driverInfoSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
  },
  driverInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentDriverPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  defaultCurrentDriverPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  currentDriverDetails: {
    flex: 1,
  },
  currentDriverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  currentDriverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentDriverRatingText: {
    fontSize: 16,
    color: '#FF9800',
    fontWeight: 'bold',
  },
  addressHint: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  currentLocationCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  currentLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currentLocationText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
  },
  locationDetails: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  quickDestinationsContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  quickDestinationsTitle: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
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
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  quickDestinationText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: 'bold',
  },
  destinationInputContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  clearButton: {
    padding: 4,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionText: {
    marginLeft: 12,
    flex: 1,
  },
  suggestionName: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  suggestionArea: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  webSuggestionsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  webSuggestionsTitle: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  webSuggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  webSuggestionButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  webSuggestionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});