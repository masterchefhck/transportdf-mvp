import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Utility functions for cross-platform alerts
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
        const parsedUser = JSON.parse(user);
        setCurrentUser(parsedUser);
        
        // Redirect to appropriate dashboard based on user type
        switch (parsedUser.user_type) {
          case 'passenger':
            router.replace('/passenger');
            break;
          case 'driver':
            router.replace('/driver');
            break;
          case 'admin':
            router.replace('/admin');
            break;
          default:
            // Clear invalid session
            await AsyncStorage.multiRemove(['access_token', 'user']);
        }
      }
    } catch (error) {
      console.log('Error checking session:', error);
    }
  };

  const handleModeSelection = (mode: 'passenger' | 'driver' | 'admin') => {
    router.push(`/${mode}`);
  };

  const handleLogout = async () => {
    showConfirm(
      'Sair',
      'Tem certeza que deseja sair?',
      async () => {
        try {
          await AsyncStorage.multiRemove(['access_token', 'user']);
          setCurrentUser(null);
        } catch (error) {
          console.error('Error during logout:', error);
        }
      }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      <View style={styles.header}>
        <Text style={styles.title}>SkyCab</Text>
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
        <Text style={styles.selectorTitle}>Escolha seu perfil de acesso:</Text>
        
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
        <Text style={styles.footerSubtext}>
          Acesso direto: /passenger • /driver • /admin
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
    paddingVertical: 30,
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
  },
  selectorTitle: {
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
    fontWeight: '600',
  },
  modeCard: {
    padding: 25,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 15,
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    marginBottom: 6,
  },
  modeDescription: {
    fontSize: 14,
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
    marginBottom: 5,
  },
  footerSubtext: {
    color: '#555',
    fontSize: 12,
    fontStyle: 'italic',
  },
});