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

export default function PassengerApp() {
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
        if (parsedUser.user_type === 'passenger') {
          setCurrentUser(parsedUser);
          // Redirect to dashboard if already logged in as passenger
          router.replace('/passenger/dashboard');
        } else {
          // Clear session if wrong user type
          await AsyncStorage.multiRemove(['access_token', 'user']);
        }
      }
    } catch (error) {
      console.log('Error checking session:', error);
    }
  };

  const handleLogin = () => {
    router.push('/auth/login?mode=passenger');
  };

  const handleRegister = () => {
    router.push('/auth/register?mode=passenger');
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
        <Text style={styles.title}>TransportDF</Text>
        <Text style={styles.subtitle}>Passageiros</Text>
        
        {currentUser && (
          <View style={styles.userInfo}>
            <Text style={styles.welcomeText}>Olá, {currentUser.name}!</Text>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Sair</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!currentUser ? (
        <View style={styles.authContainer}>
          <View style={styles.appCard}>
            <Ionicons name="person" size={80} color="#4CAF50" />
            <Text style={styles.appTitle}>Área do Passageiro</Text>
            <Text style={styles.appDescription}>
              Solicite viagens para qualquer lugar em Brasília de forma rápida e segura
            </Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                <Text style={styles.loginButtonText}>Fazer Login</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
                <Text style={styles.registerButtonText}>Criar Conta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.loggedInContainer}>
          <TouchableOpacity
            style={styles.dashboardButton}
            onPress={() => router.push('/passenger/dashboard')}
          >
            <Ionicons name="speedometer" size={32} color="#fff" />
            <Text style={styles.dashboardButtonText}>Ir para Dashboard</Text>
          </TouchableOpacity>
        </View>
      )}

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
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '600',
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
  authContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  appCard: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 15,
  },
  appDescription: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  loginButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: 'transparent',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  registerButtonText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loggedInContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  dashboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderRadius: 16,
    gap: 15,
  },
  dashboardButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
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