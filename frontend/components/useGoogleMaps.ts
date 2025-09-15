import { useState, useCallback } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Location {
  lat: number;
  lng: number;
  name?: string;
}

interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  start_location: { lat: number; lng: number };
  end_location: { lat: number; lng: number };
}

interface Route {
  steps: RouteStep[];
  distance: string;
  duration: string;
  overview_polyline: string;
  bounds: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
}

interface GeocodeResult {
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  place_id: string;
  types: string[];
}

interface DistanceMatrixElement {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  status: string;
}

export const useGoogleMaps = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('authToken');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const getDirections = useCallback(async (
    origin: Location,
    destination: Location
  ): Promise<Route | null> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await axios.post(
        `${BACKEND_URL}/api/maps/directions`,
        {
          origin_lat: origin.lat,
          origin_lng: origin.lng,
          destination_lat: destination.lat,
          destination_lng: destination.lng,
        },
        { headers }
      );

      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao obter direções';
      setError(errorMessage);
      console.error('Erro ao obter direções:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getDistanceMatrix = useCallback(async (
    origins: Location[],
    destinations: Location[]
  ): Promise<{ rows: { elements: DistanceMatrixElement[] }[] } | null> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await axios.post(
        `${BACKEND_URL}/api/maps/distance-matrix`,
        {
          origins: origins.map(o => ({ lat: o.lat, lng: o.lng })),
          destinations: destinations.map(d => ({ lat: d.lat, lng: d.lng })),
        },
        { headers }
      );

      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao calcular distâncias';
      setError(errorMessage);
      console.error('Erro ao calcular distâncias:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const geocodeAddress = useCallback(async (address: string): Promise<GeocodeResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(
        `${BACKEND_URL}/api/maps/geocode/${encodeURIComponent(address)}`,
        { headers }
      );

      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0];
      }
      
      return null;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao geocodificar endereço';
      setError(errorMessage);
      console.error('Erro ao geocodificar endereço:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reverseGeocode = useCallback(async (
    lat: number,
    lng: number
  ): Promise<GeocodeResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(
        `${BACKEND_URL}/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`,
        { headers }
      );

      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0];
      }
      
      return null;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Erro ao obter endereço';
      setError(errorMessage);
      console.error('Erro ao obter endereço:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateTripPrice = useCallback((distance: string): number => {
    // Extract numeric distance from string like "5.2 km"
    const distanceValue = parseFloat(distance.replace(/[^\d.]/g, ''));
    const basePrice = 5.0; // Base fare R$ 5.00
    const pricePerKm = 1.5; // R$ 1.50 per km
    return Math.round((basePrice + (distanceValue * pricePerKm)) * 100) / 100;
  }, []);

  return {
    loading,
    error,
    getDirections,
    getDistanceMatrix,
    geocodeAddress,
    reverseGeocode,
    calculateTripPrice,
  };
};