import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Try to import SVG, fall back to View-based rendering if not available
let Svg, Path, Circle, Line, SvgText;
try {
  const svgModule = require('react-native-svg');
  Svg = svgModule.default || svgModule.Svg;
  Path = svgModule.Path;
  Circle = svgModule.Circle;
  Line = svgModule.Line;
  SvgText = svgModule.Text;
} catch (error) {
  console.log('SVG not available, using fallback rendering');
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 300;

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

interface MockMapViewProps {
  origin: Location;
  destination: Location;
  currentLocation?: Location;
  route?: {
    steps: RouteStep[];
    distance: string;
    duration: string;
    overview_polyline: string;
  };
  onDirectionsRequest?: () => void;
  showDirections?: boolean;
  style?: any;
}

const MockMapView: React.FC<MockMapViewProps> = ({
  origin,
  destination,
  currentLocation,
  route,
  onDirectionsRequest,
  showDirections = false,
  style,
}) => {
  const [mapBounds, setMapBounds] = useState({
    minLat: Math.min(origin.lat, destination.lat) - 0.01,
    maxLat: Math.max(origin.lat, destination.lat) + 0.01,
    minLng: Math.min(origin.lng, destination.lng) - 0.01,
    maxLng: Math.max(origin.lng, destination.lng) + 0.01,
  });

  // Convert lat/lng to SVG coordinates
  const latLngToSvg = (lat: number, lng: number) => {
    const x = ((lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * SCREEN_WIDTH;
    const y = ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * MAP_HEIGHT;
    return { x, y };
  };

  const originSvg = latLngToSvg(origin.lat, origin.lng);
  const destinationSvg = latLngToSvg(destination.lat, destination.lng);
  const currentLocationSvg = currentLocation ? latLngToSvg(currentLocation.lat, currentLocation.lng) : null;

  // Generate mock route path for SVG
  const generateRoutePath = () => {
    if (!route) return '';
    
    const points = [originSvg];
    
    // Add some intermediate waypoints for a more realistic route
    const steps = 5;
    for (let i = 1; i < steps; i++) {
      const progress = i / steps;
      // Add some curve to make it look like a real route
      const curveFactor = Math.sin(progress * Math.PI) * 20;
      const x = originSvg.x + (destinationSvg.x - originSvg.x) * progress + curveFactor;
      const y = originSvg.y + (destinationSvg.y - originSvg.y) * progress + curveFactor * 0.5;
      points.push({ x, y });
    }
    
    points.push(destinationSvg);
    
    // Create SVG path
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    
    return path;
  };

  // Fallback map rendering without SVG
  const renderFallbackMap = () => {
    return (
      <View style={styles.fallbackMap}>
        {/* Grid background */}
        <View style={styles.gridContainer}>
          {Array.from({ length: 8 }, (_, i) => (
            <View key={`row-${i}`} style={styles.gridRow}>
              {Array.from({ length: 10 }, (_, j) => (
                <View key={`cell-${i}-${j}`} style={styles.gridCell} />
              ))}
            </View>
          ))}
        </View>

        {/* Origin marker */}
        <View style={[styles.mapMarker, styles.originMarker, {
          left: `${(originSvg.x / SCREEN_WIDTH) * 100}%`,
          top: `${(originSvg.y / MAP_HEIGHT) * 100}%`,
        }]}>
          <Ionicons name="radio-button-on" size={16} color="#4CAF50" />
          <Text style={styles.markerLabel}>ORIGEM</Text>
        </View>

        {/* Destination marker */}
        <View style={[styles.mapMarker, styles.destinationMarker, {
          left: `${(destinationSvg.x / SCREEN_WIDTH) * 100}%`,
          top: `${(destinationSvg.y / MAP_HEIGHT) * 100}%`,
        }]}>
          <Ionicons name="location" size={16} color="#f44336" />
          <Text style={styles.markerLabel}>DESTINO</Text>
        </View>

        {/* Current location marker */}
        {currentLocationSvg && (
          <View style={[styles.mapMarker, styles.currentLocationMarker, {
            left: `${(currentLocationSvg.x / SCREEN_WIDTH) * 100}%`,
            top: `${(currentLocationSvg.y / MAP_HEIGHT) * 100}%`,
          }]}>
            <Ionicons name="navigate" size={16} color="#2196F3" />
          </View>
        )}

        {/* Route line representation */}
        {route && (
          <View style={styles.routeLine}>
            <Text style={styles.routeText}>📍 ──── 🚗 ──── 📍</Text>
          </View>
        )}
      </View>
    );
  };

  // SVG map rendering
  const renderSvgMap = () => {
    if (!Svg) return renderFallbackMap();

    return (
      <Svg width={SCREEN_WIDTH} height={MAP_HEIGHT} style={styles.map}>
        {/* Background */}
        <Path
          d={`M 0 0 L ${SCREEN_WIDTH} 0 L ${SCREEN_WIDTH} ${MAP_HEIGHT} L 0 ${MAP_HEIGHT} Z`}
          fill="#1a1a1a"
          stroke="#333"
          strokeWidth="1"
        />
        
        {/* Grid lines */}
        {Array.from({ length: 10 }, (_, i) => (
          <Line
            key={`v-${i}`}
            x1={(SCREEN_WIDTH / 10) * i}
            y1={0}
            x2={(SCREEN_WIDTH / 10) * i}
            y2={MAP_HEIGHT}
            stroke="#2a2a2a"
            strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <Line
            key={`h-${i}`}
            x1={0}
            y1={(MAP_HEIGHT / 8) * i}
            x2={SCREEN_WIDTH}
            y2={(MAP_HEIGHT / 8) * i}
            stroke="#2a2a2a"
            strokeWidth="0.5"
          />
        ))}

        {/* Route path */}
        {route && (
          <Path
            d={generateRoutePath()}
            fill="none"
            stroke="#2196F3"
            strokeWidth="3"
            strokeDasharray="5,3"
          />
        )}

        {/* Current location marker */}
        {currentLocationSvg && (
          <Circle
            cx={currentLocationSvg.x}
            cy={currentLocationSvg.y}
            r={8}
            fill="#4CAF50"
            stroke="#fff"
            strokeWidth="2"
          />
        )}

        {/* Origin marker */}
        <Circle
          cx={originSvg.x}
          cy={originSvg.y}
          r={6}
          fill="#4CAF50"
          stroke="#fff"
          strokeWidth="2"
        />
        <SvgText
          x={originSvg.x}
          y={originSvg.y - 15}
          fontSize="10"
          fill="#4CAF50"
          textAnchor="middle"
          fontWeight="bold"
        >
          ORIGEM
        </SvgText>

        {/* Destination marker */}
        <Circle
          cx={destinationSvg.x}
          cy={destinationSvg.y}
          r={6}
          fill="#f44336"
          stroke="#fff"
          strokeWidth="2"
        />
        <SvgText
          x={destinationSvg.x}
          y={destinationSvg.y - 15}
          fontSize="10"
          fill="#f44336"
          textAnchor="middle"
          fontWeight="bold"
        >
          DESTINO
        </SvgText>
      </Svg>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* Map Header */}
      <View style={styles.mapHeader}>
        <View style={styles.routeInfo}>
          <Text style={styles.routeDistance}>
            {route ? route.distance : 'Calculando...'}
          </Text>
          <Text style={styles.routeDuration}>
            {route ? route.duration : 'Estimando tempo...'}
          </Text>
        </View>
        {onDirectionsRequest && (
          <TouchableOpacity 
            style={styles.directionsButton}
            onPress={onDirectionsRequest}
          >
            <Ionicons name="navigate" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Mock Map View */}
      <View style={styles.mapContainer}>
        {Svg ? renderSvgMap() : renderFallbackMap()}

        {/* Map overlay info */}
        <View style={styles.mapOverlay}>
          <Text style={styles.mapTitle}>Brasília - DF</Text>
          <Text style={styles.mapSubtitle}>Visualização do mapa (Demo)</Text>
        </View>
      </View>

      {/* Turn-by-turn directions */}
      {showDirections && route && (
        <ScrollView style={styles.directionsContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.directionsTitle}>Direções</Text>
          {route.steps.map((step, index) => (
            <View key={index} style={styles.directionStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepInstruction}>{step.instruction}</Text>
                <View style={styles.stepMeta}>
                  <Text style={styles.stepDistance}>{step.distance}</Text>
                  <Text style={styles.stepDuration}>• {step.duration}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2a2a2a',
  },
  routeInfo: {
    flex: 1,
  },
  routeDistance: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  routeDuration: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  directionsButton: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContainer: {
    position: 'relative',
    height: MAP_HEIGHT,
  },
  map: {
    backgroundColor: '#1a1a1a',
  },
  mapOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mapTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  mapSubtitle: {
    fontSize: 10,
    color: '#888',
  },
  directionsContainer: {
    maxHeight: 200,
    backgroundColor: '#2a2a2a',
  },
  directionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    padding: 16,
    paddingBottom: 8,
  },
  directionStep: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepInstruction: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  stepMeta: {
    flexDirection: 'row',
    marginTop: 4,
  },
  stepDistance: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  stepDuration: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
  },
});

export default MockMapView;