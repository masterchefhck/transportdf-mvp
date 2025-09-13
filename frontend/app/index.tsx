import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    checkUserSession();
  }, []);

  const checkUserSession = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const user = await AsyncStorage.getItem('user');
      
      if (token && user) {
        setCurrentUser(JSON.parse(user));
      }
    } catch (error) {
      console.log('Error checking session:', error);
    }
  };

  const handleModeSelection = (mode: 'passenger' | 'driver' | 'admin') => {
    if (currentUser) {
      // User is logged in, go to appropriate dashboard
      router.push(`/${mode}/dashboard`);
    } else {
      // User not logged in, go to login
      router.push(`/auth/login?mode=${mode}`);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['access_token', 'user']);
            setCurrentUser(null);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      <View style={styles.header}>
        <Text style={styles.title}>TransportDF</Text>
        <Text style={styles.subtitle}>Transporte inteligente em Brasília</Text>
        
        {currentUser && (
          <View style={styles.userInfo}>
            <Text style={styles.welcomeText}>Olá, {currentUser.name}!</Text>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Sair</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.modesContainer}>
        <TouchableOpacity
          style={[styles.modeCard, styles.passengerCard]}
          onPress={() => handleModeSelection('passenger')}
        >
          <Ionicons name="person" size={48} color="#fff" />
          <Text style={styles.modeTitle}>Passageiro</Text>
          <Text style={styles.modeDescription}>
            Solicite uma viagem para onde você quiser
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeCard, styles.driverCard]}
          onPress={() => handleModeSelection('driver')}
        >
          <Ionicons name="car" size={48} color="#fff" />
          <Text style={styles.modeTitle}>Motorista</Text>
          <Text style={styles.modeDescription}>
            Trabalhe como motorista e ganhe dinheiro
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeCard, styles.adminCard]}
          onPress={() => handleModeSelection('admin')}
        >
          <Ionicons name="settings" size={48} color="#fff" />
          <Text style={styles.modeTitle}>Administrador</Text>
          <Text style={styles.modeDescription}>
            Gerencie usuários e operações
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          📍 Brasília/DF • Versão MVP 1.0
        </Text>
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
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    width: '100%',
    justifyContent: 'space-between',
  },
  welcomeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  logoutButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#ff4444',
    borderRadius: 6,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  modesContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    gap: 20,
  },
  modeCard: {
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  passengerCard: {
    backgroundColor: '#4CAF50',
  },
  driverCard: {
    backgroundColor: '#2196F3',
  },
  adminCard: {
    backgroundColor: '#FF9800',
  },
  modeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
    marginBottom: 8,
  },
  modeDescription: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
});