import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  name: string;
  user_type: string;
}

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

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

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
          console.log('Error during logout:', error);
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
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  userInfo: {
    alignItems: 'center',
    marginTop: 10,
  },
  welcomeText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  logoutButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  logoutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modesContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  modeCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
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
    marginTop: 12,
    marginBottom: 8,
  },
  modeDescription: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});