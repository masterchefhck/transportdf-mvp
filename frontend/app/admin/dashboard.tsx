import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

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
  is_active: boolean;
  created_at: string;
  driver_status?: string;
  blocked_at?: string;
  block_reason?: string;
  profile_photo?: string;
}

interface Trip {
  id: string;
  passenger_id: string;
  driver_id?: string;
  pickup_address: string;
  destination_address: string;
  estimated_price: number;
  status: string;
  requested_at: string;
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
  reporter_name: string;
  reported_name: string;
  reported_user_type: string;
}

interface Stats {
  total_users: number;
  total_drivers: number;
  total_passengers: number;
  total_trips: number;
  completed_trips: number;
  completion_rate: number;
}

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'trips' | 'reports' | 'ratings' | 'messages'>('stats');
  
  // Bulk operations state
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedTrips, setSelectedTrips] = useState<string[]>([]);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<string[]>([]);
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  
  // Modal states
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminMessage, setAdminMessage] = useState('');
  const [blockReason, setBlockReason] = useState('');
  
  // Photo popup states
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>('');
  const [selectedPhotoUser, setSelectedPhotoUser] = useState<string>('');

  // Admin Message Modal for passenger messaging
  const [showPassengerMessageModal, setShowPassengerMessageModal] = useState(false);
  const [passengerMessage, setPassengerMessage] = useState('');
  const [selectedPassenger, setSelectedPassenger] = useState<User | null>(null);
  const [passengers, setPassengers] = useState<User[]>([]);

  // Rating states
  const [ratings, setRatings] = useState<any[]>([]);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState<any>(null);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    loadUserData();
    loadData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.log('Error loading user data:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsResponse, usersResponse, tripsResponse, reportsResponse, ratingsResponse] = await Promise.all([
        axios.get(`${API_URL}/api/admin/stats`, { headers }),
        axios.get(`${API_URL}/api/admin/users`, { headers }),
        axios.get(`${API_URL}/api/admin/trips`, { headers }),
        axios.get(`${API_URL}/api/admin/reports`, { headers }),
        axios.get(`${API_URL}/api/ratings/low`, { headers }),
      ]);

      setStats(statsResponse.data);
      setUsers(usersResponse.data);
      setTrips(tripsResponse.data.slice(0, 10)); // Last 10 trips
      setReports(reportsResponse.data);
      setRatings(ratingsResponse.data);
      
      // Set passengers for messaging
      setPassengers(usersResponse.data.filter((user: User) => user.user_type === 'passenger'));
    } catch (error) {
      console.error('Error loading admin data:', error);
      showAlert('Erro', 'Erro ao carregar dados administrativos');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  const handleLogout = async () => {
    showConfirm(
      'Sair',
      'Tem certeza que deseja sair?',
      async () => {
        try {
          console.log('Logging out admin...');
          await AsyncStorage.multiRemove(['access_token', 'user']);
          router.replace('/admin');
        } catch (error) {
          console.error('Error during logout:', error);
          // Force logout even if there's an error
          router.replace('/admin');
        }
      }
    );
  };

  const handleViewPhoto = (photoUrl: string, userName: string) => {
    setSelectedPhotoUrl(photoUrl);
    setSelectedPhotoUser(userName);
    setShowPhotoModal(true);
  };

  const handleViewPhoto = (photoUrl: string, userName: string) => {
    setSelectedPhotoUrl(photoUrl);
    setSelectedPhotoUser(userName);
    setShowPhotoModal(true);
  };

  // Bulk operation functions
  const handleSelectAllUsers = () => {
    const adminUsers = users.filter(user => user.user_type !== 'admin').map(user => user.id);
    if (selectedUsers.length === adminUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(adminUsers);
    }
  };

  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.length === 0) return;
    
    showConfirm(
      'Deletar Usuários',
      `Tem certeza que deseja deletar ${selectedUsers.length} usuário(s)? Esta ação não pode ser desfeita.`,
      async () => {
        setBulkOperationLoading(true);
        try {
          const token = await AsyncStorage.getItem('access_token');
          await axios.post(
            `${API_URL}/api/admin/users/bulk-delete`,
            { ids: selectedUsers },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          showAlert('Sucesso', `${selectedUsers.length} usuário(s) deletado(s) com sucesso!`);
          setSelectedUsers([]);
          loadData();
        } catch (error) {
          console.error('Error bulk deleting users:', error);
          showAlert('Erro', 'Erro ao deletar usuários');
        } finally {
          setBulkOperationLoading(false);
        }
      }
    );
  };

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'passenger': return '#4CAF50';
      case 'driver': return '#2196F3';
      case 'admin': return '#FF9800';
      default: return '#666';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const renderUsers = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Usuários Registrados</Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={handleSelectAllUsers}
            >
              <Ionicons 
                name={selectedUsers.length === users.filter(u => u.user_type !== 'admin').length ? "checkbox" : "square-outline"} 
                size={20} 
                color="#FF9800" 
              />
              <Text style={styles.selectAllText}>Selecionar Todos</Text>
            </TouchableOpacity>
            {selectedUsers.length > 0 && (
              <TouchableOpacity
                style={[styles.bulkActionButton, { backgroundColor: '#f44336' }]}
                onPress={handleBulkDeleteUsers}
                disabled={bulkOperationLoading}
              >
                {bulkOperationLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={styles.bulkActionText}>Deletar ({selectedUsers.length})</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {users.map(user => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userInfo}>
              {user.user_type !== 'admin' && (
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => {
                    if (selectedUsers.includes(user.id)) {
                      setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                    } else {
                      setSelectedUsers([...selectedUsers, user.id]);
                    }
                  }}
                >
                  <Ionicons
                    name={selectedUsers.includes(user.id) ? "checkbox" : "square-outline"}
                    size={20}
                    color="#FF9800"
                  />
                </TouchableOpacity>
              )}
              <View style={[styles.userTypeIndicator, { backgroundColor: getUserTypeColor(user.user_type) }]} />
              
              {/* User Avatar/Photo */}
              <TouchableOpacity
                style={styles.userPhotoContainer}
                onPress={() => {
                  if (user.profile_photo) {
                    handleViewPhoto(user.profile_photo, user.name);
                  }
                }}
                disabled={!user.profile_photo}
              >
                {user.profile_photo ? (
                  <Image source={{ uri: user.profile_photo }} style={styles.userPhotoThumbnail} />
                ) : (
                  <View style={styles.defaultUserPhoto}>
                    <Ionicons name="person" size={16} color="#666" />
                  </View>
                )}
              </TouchableOpacity>
              
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <Text style={styles.userType}>
                  {user.user_type === 'driver' ? 'Motorista' : 
                   user.user_type === 'passenger' ? 'Passageiro' : 'Admin'}
                </Text>
                <Text style={styles.userDate}>Registrado em: {formatDate(user.created_at)}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  if (loading && !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>Carregando dados...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="settings" size={24} color="#fff" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.welcomeText}>Admin {user?.name || 'Usuário'}</Text>
            <Text style={styles.locationText}>Painel Administrativo</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.activeTab]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
            Usuários
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        {activeTab === 'users' && renderUsers()}
      </View>

      {/* Photo Viewer Modal */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity 
            style={styles.photoModalBackground} 
            onPress={() => setShowPhotoModal(false)}
            activeOpacity={1}
          >
            <View style={styles.photoModalContent}>
              <View style={styles.photoModalHeader}>
                <Text style={styles.photoModalTitle}>Foto de {selectedPhotoUser}</Text>
                <TouchableOpacity 
                  style={styles.photoModalCloseButton}
                  onPress={() => setShowPhotoModal(false)}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              {selectedPhotoUrl && (
                <Image 
                  source={{ uri: selectedPhotoUrl }} 
                  style={styles.photoModalImage}
                  resizeMode="contain"
                />
              )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#2a2a2a',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF9800',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
  logoutButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#FF9800',
  },
  tabText: {
    fontSize: 14,
    color: '#888',
  },
  activeTabText: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bulkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  selectAllText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bulkActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  bulkActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkbox: {
    padding: 4,
    marginRight: 8,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userTypeIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  userPhotoContainer: {
    marginRight: 12,
  },
  userPhotoThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  defaultUserPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#666',
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  userEmail: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  userType: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  userDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
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
    backgroundColor: '#FF9800',
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
});