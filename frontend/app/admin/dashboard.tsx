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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import ChatComponent from '../../components/ChatComponent';

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
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'trips' | 'reports' | 'ratings' | 'messages' | 'chats'>('stats');
  
  // Bulk operations state
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedTrips, setSelectedTrips] = useState<string[]>([]);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<string[]>([]);
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  
  // Modal states
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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

  // Chat states
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [showChatModal, setShowChatModal] = useState(false);

  // Highlighted user for navigation from chat
  const [highlightedUserId, setHighlightedUserId] = useState<string>('');

  useEffect(() => {
    loadUserData();
    loadData();
  }, []);

  // Auto-refresh data every 5 seconds for real-time sync
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(); // Refresh all admin data
    }, 5000); // 5 seconds polling

    return () => clearInterval(interval);
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

      const [statsResponse, usersResponse, tripsResponse, reportsResponse, ratingsResponse, chatsResponse] = await Promise.all([
        axios.get(`${API_URL}/api/admin/stats`, { headers }),
        axios.get(`${API_URL}/api/admin/users`, { headers }),
        axios.get(`${API_URL}/api/admin/trips`, { headers }),
        axios.get(`${API_URL}/api/admin/reports`, { headers }),
        axios.get(`${API_URL}/api/ratings/low`, { headers }),
        axios.get(`${API_URL}/api/admin/chats`, { headers }),
      ]);

      setStats(statsResponse.data);
      setUsers(usersResponse.data);
      setTrips(tripsResponse.data.slice(0, 10)); // Last 10 trips
      setReports(reportsResponse.data);
      setRatings(ratingsResponse.data);
      setChats(chatsResponse.data);
      
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

  const loadChats = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/admin/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChats(response.data);
    } catch (error) {
      console.error('Error loading chats:', error);
    }
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

  const handleSendMessage = async () => {
    if (!adminMessage.trim() || !selectedReport) return;
    
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/reports/${selectedReport.id}/message`,
        { message: adminMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      showAlert('Sucesso', 'Mensagem enviada ao usuário!');
      setShowMessageModal(false);
      setAdminMessage('');
      loadData();
    } catch (error) {
      console.error('Error sending message:', error);
      showAlert('Erro', 'Erro ao enviar mensagem');
    }
  };

  const handleBlockUser = async () => {
    if (!blockReason.trim() || !selectedUser) return;
    
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/users/${selectedUser.id}/block`,
        { user_id: selectedUser.id, reason: blockReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      showAlert('Sucesso', `${selectedUser.name} foi bloqueado(a)!`);
      setShowBlockModal(false);
      setBlockReason('');
      loadData();
    } catch (error) {
      console.error('Error blocking user:', error);
      showAlert('Erro', 'Erro ao bloquear usuário');
    }
  };

  const handleUnblockUser = async (user: User) => {
    showConfirm(
      'Desbloquear Usuário',
      `Tem certeza que deseja desbloquear ${user.name}?`,
      async () => {
        try {
          const token = await AsyncStorage.getItem('access_token');
          await axios.post(
            `${API_URL}/api/admin/users/${user.id}/unblock`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          showAlert('Sucesso', `${user.name} foi desbloqueado(a)!`);
          loadData();
        } catch (error) {
          console.error('Error unblocking user:', error);
          showAlert('Erro', 'Erro ao desbloquear usuário');
        }
      }
    );
  };

  const handleResolveReport = async (report: Report) => {
    showConfirm(
      'Resolver Report',
      'Tem certeza que deseja marcar este report como resolvido?',
      async () => {
        try {
          const token = await AsyncStorage.getItem('access_token');
          await axios.post(
            `${API_URL}/api/admin/reports/${report.id}/resolve`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          showAlert('Sucesso', 'Report resolvido com sucesso!');
          loadData();
        } catch (error) {
          console.error('Error resolving report:', error);
          showAlert('Erro', 'Erro ao resolver report');
        }
      }
    );
  };

  const handleDismissReport = async (report: Report) => {
    showConfirm(
      'Descartar Report',
      'Tem certeza que deseja descartar este report?',
      async () => {
        try {
          const token = await AsyncStorage.getItem('access_token');
          await axios.post(
            `${API_URL}/api/admin/reports/${report.id}/dismiss`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          showAlert('Sucesso', 'Report descartado com sucesso!');
          loadData();
        } catch (error) {
          console.error('Error dismissing report:', error);
          showAlert('Erro', 'Erro ao descartar report');
        }
      }
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
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

  const handleSendAlert = async () => {
    if (!alertMessage.trim() || !selectedRating) return;
    
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/ratings/${selectedRating.id}/alert`,
        { rating_id: selectedRating.id, message: alertMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      showAlert('Sucesso', 'Alerta enviado ao motorista com sucesso!');
      setShowAlertModal(false);
      setAlertMessage('');
      setSelectedRating(null);
      loadData(); // Reload to update button states
    } catch (error) {
      console.error('Error sending alert:', error);
      showAlert('Erro', 'Erro ao enviar alerta');
    }
  };

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'passenger': return '#4CAF50';
      case 'driver': return '#2196F3';
      case 'admin': return '#FF9800';
      default: return '#666';
    }
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

  const handleSelectAllTrips = () => {
    const tripIds = trips.map(trip => trip.id);
    if (selectedTrips.length === tripIds.length) {
      setSelectedTrips([]);
    } else {
      setSelectedTrips(tripIds);
    }
  };

  const handleSelectAllReports = () => {
    const reportIds = reports.map(report => report.id);
    if (selectedReports.length === reportIds.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(reportIds);
    }
  };

  const handleSelectAllRatings = () => {
    const ratingIds = ratings.map(rating => rating.id);
    if (selectedRatings.length === ratingIds.length) {
      setSelectedRatings([]);
    } else {
      setSelectedRatings(ratingIds);
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

  const handleBulkDeleteTrips = async () => {
    if (selectedTrips.length === 0) return;
    
    showConfirm(
      'Deletar Viagens',
      `Tem certeza que deseja deletar ${selectedTrips.length} viagem(ns)? Esta ação não pode ser desfeita.`,
      async () => {
        setBulkOperationLoading(true);
        try {
          const token = await AsyncStorage.getItem('access_token');
          await axios.post(
            `${API_URL}/api/admin/trips/bulk-delete`,
            { ids: selectedTrips },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          showAlert('Sucesso', `${selectedTrips.length} viagem(ns) deletada(s) com sucesso!`);
          setSelectedTrips([]);
          loadData();
        } catch (error) {
          console.error('Error bulk deleting trips:', error);
          showAlert('Erro', 'Erro ao deletar viagens');
        } finally {
          setBulkOperationLoading(false);
        }
      }
    );
  };

  const handleBulkDeleteReports = async () => {
    if (selectedReports.length === 0) return;
    
    showConfirm(
      'Deletar Reports',
      `Tem certeza que deseja deletar ${selectedReports.length} report(s)? Esta ação não pode ser desfeita.`,
      async () => {
        setBulkOperationLoading(true);
        try {
          const token = await AsyncStorage.getItem('access_token');
          await axios.post(
            `${API_URL}/api/admin/reports/bulk-delete`,
            { ids: selectedReports },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          showAlert('Sucesso', `${selectedReports.length} report(s) deletado(s) com sucesso!`);
          setSelectedReports([]);
          loadData();
        } catch (error) {
          console.error('Error bulk deleting reports:', error);
          showAlert('Erro', 'Erro ao deletar reports');
        } finally {
          setBulkOperationLoading(false);
        }
      }
    );
  };

  const handleBulkDeleteRatings = async () => {
    if (selectedRatings.length === 0) return;
    
    showConfirm(
      'Deletar Avaliações',
      `Tem certeza que deseja deletar ${selectedRatings.length} avaliação(ões)? Esta ação não pode ser desfeita.`,
      async () => {
        setBulkOperationLoading(true);
        try {
          const token = await AsyncStorage.getItem('access_token');
          await axios.post(
            `${API_URL}/api/admin/ratings/bulk-delete`,
            { ids: selectedRatings },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          showAlert('Sucesso', `${selectedRatings.length} avaliação(ões) deletada(s) com sucesso!`);
          setSelectedRatings([]);
          loadData();
        } catch (error) {
          console.error('Error bulk deleting ratings:', error);
          showAlert('Erro', 'Erro ao deletar avaliações');
        } finally {
          setBulkOperationLoading(false);
        }
      }
    );
  };

  const handleSendPassengerMessage = async () => {
    if (!passengerMessage.trim() || !selectedPassenger) return;
    
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/messages/send`,
        { user_id: selectedPassenger.id, message: passengerMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      showAlert('Sucesso', 'Mensagem enviada ao passageiro com sucesso!');
      setShowPassengerMessageModal(false);
      setPassengerMessage('');
      setSelectedPassenger(null);
    } catch (error) {
      console.error('Error sending passenger message:', error);
      showAlert('Erro', 'Erro ao enviar mensagem');
    }
  };

  const renderStats = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#4CAF50' }]}>
          <Ionicons name="people" size={32} color="#fff" />
          <Text style={styles.statNumber}>{stats?.total_users || 0}</Text>
          <Text style={styles.statLabel}>Total Usuários</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#2196F3' }]}>
          <Ionicons name="car" size={32} color="#fff" />
          <Text style={styles.statNumber}>{stats?.total_drivers || 0}</Text>
          <Text style={styles.statLabel}>Motoristas</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#FF9800' }]}>
          <Ionicons name="person" size={32} color="#fff" />
          <Text style={styles.statNumber}>{stats?.total_passengers || 0}</Text>
          <Text style={styles.statLabel}>Passageiros</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#9C27B0' }]}>
          <Ionicons name="location" size={32} color="#fff" />
          <Text style={styles.statNumber}>{stats?.total_trips || 0}</Text>
          <Text style={styles.statLabel}>Total Viagens</Text>
        </View>
      </View>

      <View style={styles.additionalStats}>
        <View style={styles.statRow}>
          <Text style={styles.statRowLabel}>Viagens Concluídas:</Text>
          <Text style={styles.statRowValue}>{stats?.completed_trips || 0}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statRowLabel}>Taxa de Conclusão:</Text>
          <Text style={styles.statRowValue}>{stats?.completion_rate || 0}%</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statRowLabel}>Reports Pendentes:</Text>
          <Text style={styles.statRowValue}>{reports.filter(r => r.status === 'pending').length}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Motoristas Online</Text>
        {users.filter(u => u.user_type === 'driver' && u.driver_status === 'online').map(driver => (
          <View key={driver.id} style={styles.onlineDriverCard}>
            <View style={styles.onlineIndicator} />
            <Text style={styles.driverName}>{driver.name}</Text>
            <Text style={styles.driverEmail}>{driver.email}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

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
                <Text style={styles.userCpf}>CPF: {user.cpf}</Text>
                <Text style={styles.userPhone}>Telefone: {user.phone}</Text>
                <Text style={styles.userType}>
                  {user.user_type === 'driver' ? 'Motorista' : 
                   user.user_type === 'passenger' ? 'Passageiro' : 'Admin'}
                  {user.user_type === 'driver' && user.driver_status && (
                    <Text style={[styles.driverStatus, { color: user.driver_status === 'online' ? '#4CAF50' : '#666' }]}>
                      {' • '}{user.driver_status === 'online' ? 'Online' : 'Offline'}
                    </Text>
                  )}
                </Text>
                <Text style={styles.userDate}>Registrado em: {formatDate(user.created_at)}</Text>
                {!user.is_active && (
                  <Text style={styles.blockedText}>Bloqueado: {user.block_reason}</Text>
                )}
              </View>
            </View>
            <View style={styles.userActions}>
              <View style={[styles.statusIndicator, { backgroundColor: user.is_active ? '#4CAF50' : '#f44336' }]} />
              {user.is_active ? (
                <TouchableOpacity
                  style={styles.blockButton}
                  onPress={() => {
                    setSelectedUser(user);
                    setShowBlockModal(true);
                  }}
                >
                  <Ionicons name="ban" size={16} color="#f44336" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.unblockButton}
                  onPress={() => handleUnblockUser(user)}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderReports = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Reports do Sistema</Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={handleSelectAllReports}
            >
              <Ionicons 
                name={selectedReports.length === reports.length ? "checkbox" : "square-outline"} 
                size={20} 
                color="#FF9800" 
              />
              <Text style={styles.selectAllText}>Selecionar Todos</Text>
            </TouchableOpacity>
            {selectedReports.length > 0 && (
              <TouchableOpacity
                style={[styles.bulkActionButton, { backgroundColor: '#f44336' }]}
                onPress={handleBulkDeleteReports}
                disabled={bulkOperationLoading}
              >
                {bulkOperationLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={styles.bulkActionText}>Deletar ({selectedReports.length})</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {reports.map(report => (
          <View key={report.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <View style={styles.reportHeaderLeft}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => {
                    if (selectedReports.includes(report.id)) {
                      setSelectedReports(selectedReports.filter(id => id !== report.id));
                    } else {
                      setSelectedReports([...selectedReports, report.id]);
                    }
                  }}
                >
                  <Ionicons
                    name={selectedReports.includes(report.id) ? "checkbox" : "square-outline"}
                    size={20}
                    color="#FF9800"
                  />
                </TouchableOpacity>
                <View style={[styles.reportStatusBadge, { backgroundColor: getStatusColor(report.status) }]}>
                  <Text style={styles.reportStatusText}>
                    {report.status === 'pending' ? 'Pendente' :
                     report.status === 'under_review' ? 'Em Análise' :
                     report.status === 'resolved' ? 'Resolvido' :
                     report.status === 'dismissed' ? 'Descartado' : report.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.reportDate}>{formatDateTime(report.created_at)}</Text>
            </View>

            <Text style={styles.reportTitle}>{report.title}</Text>
            <Text style={styles.reportDescription}>{report.description}</Text>
            
            <View style={styles.reportUsers}>
              <Text style={styles.reportUserText}>
                <Text style={styles.bold}>Reportado por:</Text> {report.reporter_name}
              </Text>
              <Text style={styles.reportUserText}>
                <Text style={styles.bold}>Reportado:</Text> {report.reported_name} ({report.reported_user_type})
              </Text>
            </View>

            {report.admin_message && (
              <View style={styles.adminMessageBox}>
                <Text style={styles.adminMessageLabel}>Mensagem do Admin:</Text>
                <Text style={styles.adminMessageText}>{report.admin_message}</Text>
              </View>
            )}

            {report.user_response && (
              <View style={styles.userResponseBox}>
                <Text style={styles.userResponseLabel}>Resposta do Usuário:</Text>
                <Text style={styles.userResponseText}>{report.user_response}</Text>
              </View>
            )}

            {report.status === 'pending' || report.status === 'under_review' ? (
              <View style={styles.reportActions}>
                <TouchableOpacity
                  style={styles.reportActionButton}
                  onPress={() => {
                    setSelectedReport(report);
                    setShowMessageModal(true);
                  }}
                >
                  <Ionicons name="mail" size={16} color="#2196F3" />
                  <Text style={styles.reportActionText}>Enviar Mensagem</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.reportActionButton, { backgroundColor: '#4CAF50' }]}
                  onPress={() => handleResolveReport(report)}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={[styles.reportActionText, { color: '#fff' }]}>Resolver</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.reportActionButton, { backgroundColor: '#666' }]}
                  onPress={() => handleDismissReport(report)}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                  <Text style={[styles.reportActionText, { color: '#fff' }]}>Descartar</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderTrips = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Viagens Recentes</Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={handleSelectAllTrips}
            >
              <Ionicons 
                name={selectedTrips.length === trips.length ? "checkbox" : "square-outline"} 
                size={20} 
                color="#FF9800" 
              />
              <Text style={styles.selectAllText}>Selecionar Todos</Text>
            </TouchableOpacity>
            {selectedTrips.length > 0 && (
              <TouchableOpacity
                style={[styles.bulkActionButton, { backgroundColor: '#f44336' }]}
                onPress={handleBulkDeleteTrips}
                disabled={bulkOperationLoading}
              >
                {bulkOperationLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={styles.bulkActionText}>Deletar ({selectedTrips.length})</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {trips.map(trip => (
          <View key={trip.id} style={styles.tripCard}>
            <View style={styles.tripHeader}>
              <View style={styles.tripHeaderLeft}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => {
                    if (selectedTrips.includes(trip.id)) {
                      setSelectedTrips(selectedTrips.filter(id => id !== trip.id));
                    } else {
                      setSelectedTrips([...selectedTrips, trip.id]);
                    }
                  }}
                >
                  <Ionicons
                    name={selectedTrips.includes(trip.id) ? "checkbox" : "square-outline"}
                    size={20}
                    color="#FF9800"
                  />
                </TouchableOpacity>
                <View style={[styles.tripStatusBadge, { backgroundColor: getStatusColor(trip.status) }]}>
                  <Text style={styles.tripStatusText}>
                    {trip.status === 'requested' ? 'Solicitada' :
                     trip.status === 'accepted' ? 'Aceita' :
                     trip.status === 'in_progress' ? 'Em andamento' :
                     trip.status === 'completed' ? 'Concluída' :
                     trip.status === 'cancelled' ? 'Cancelada' : trip.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.tripPrice}>R$ {trip.estimated_price.toFixed(2)}</Text>
            </View>

            <View style={styles.addressRow}>
              <Ionicons name="radio-button-on" size={16} color="#4CAF50" />
              <Text style={styles.addressText}>{trip.pickup_address}</Text>
            </View>
            <View style={styles.addressRow}>
              <Ionicons name="location" size={16} color="#f44336" />
              <Text style={styles.addressText}>{trip.destination_address}</Text>
            </View>

            {/* Users Information Section */}
            {(trip.passenger_name || trip.driver_name) && (
              <View style={styles.tripUsersSection}>
                <Text style={styles.usersTitle}>Participantes</Text>
                <View style={styles.usersContainer}>
                  {/* Passenger Info */}
                  {trip.passenger_name && (
                    <View style={styles.userInfoCard}>
                      <Text style={styles.userTypeLabel}>Passageiro</Text>
                      <View style={styles.userInfo}>
                        <TouchableOpacity
                          onPress={() => handleViewPhoto(trip.passenger_photo, trip.passenger_name)}
                          disabled={!trip.passenger_photo}
                        >
                          {trip.passenger_photo ? (
                            <Image source={{ uri: trip.passenger_photo }} style={styles.userPhoto} />
                          ) : (
                            <View style={styles.defaultUserPhoto}>
                              <Ionicons name="person" size={16} color="#4CAF50" />
                            </View>
                          )}
                        </TouchableOpacity>
                        <View style={styles.userDetails}>
                          <Text style={styles.userName}>{trip.passenger_name}</Text>
                          {trip.passenger_phone && (
                            <Text style={styles.userPhone}>📞 {trip.passenger_phone}</Text>
                          )}
                          {trip.passenger_rating && (
                            <View style={styles.userRatingRow}>
                              <Ionicons name="star" size={12} color="#FF9800" />
                              <Text style={styles.userRatingText}>{trip.passenger_rating.toFixed(1)}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Driver Info */}
                  {trip.driver_name && (
                    <View style={styles.userInfoCard}>
                      <Text style={styles.userTypeLabel}>Motorista</Text>
                      <View style={styles.userInfo}>
                        <TouchableOpacity
                          onPress={() => handleViewPhoto(trip.driver_photo, trip.driver_name)}
                          disabled={!trip.driver_photo}
                        >
                          {trip.driver_photo ? (
                            <Image source={{ uri: trip.driver_photo }} style={styles.userPhoto} />
                          ) : (
                            <View style={styles.defaultUserPhoto}>
                              <Ionicons name="car" size={16} color="#2196F3" />
                            </View>
                          )}
                        </TouchableOpacity>
                        <View style={styles.userDetails}>
                          <Text style={styles.userName}>{trip.driver_name}</Text>
                          {trip.driver_phone && (
                            <Text style={styles.userPhone}>📞 {trip.driver_phone}</Text>
                          )}
                          {trip.driver_rating && (
                            <View style={styles.userRatingRow}>
                              <Ionicons name="star" size={12} color="#FF9800" />
                              <Text style={styles.userRatingText}>{trip.driver_rating.toFixed(1)}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            <Text style={styles.tripDate}>
              {formatDateTime(trip.requested_at)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderRatings = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Avaliações Abaixo de 5 Estrelas</Text>
          {ratings.length > 0 && (
            <View style={styles.bulkActions}>
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={handleSelectAllRatings}
              >
                <Ionicons 
                  name={selectedRatings.length === ratings.length ? "checkbox" : "square-outline"} 
                  size={20} 
                  color="#FF9800" 
                />
                <Text style={styles.selectAllText}>Selecionar Todos</Text>
              </TouchableOpacity>
              {selectedRatings.length > 0 && (
                <TouchableOpacity
                  style={[styles.bulkActionButton, { backgroundColor: '#f44336' }]}
                  onPress={handleBulkDeleteRatings}
                  disabled={bulkOperationLoading}
                >
                  {bulkOperationLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="trash" size={16} color="#fff" />
                      <Text style={styles.bulkActionText}>Deletar ({selectedRatings.length})</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        
        {ratings.length === 0 ? (
          <View style={styles.noDataContainer}>
            <Ionicons name="star" size={60} color="#666" />
            <Text style={styles.noDataText}>Nenhuma avaliação baixa encontrada!</Text>
            <Text style={styles.noDataSubtext}>Todos os motoristas estão bem avaliados</Text>
          </View>
        ) : (
          ratings.map(rating => (
            <View key={rating.id} style={styles.ratingCard}>
              <View style={styles.ratingHeader}>
                <View style={styles.ratingHeaderLeft}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => {
                      if (selectedRatings.includes(rating.id)) {
                        setSelectedRatings(selectedRatings.filter(id => id !== rating.id));
                      } else {
                        setSelectedRatings([...selectedRatings, rating.id]);
                      }
                    }}
                  >
                    <Ionicons
                      name={selectedRatings.includes(rating.id) ? "checkbox" : "square-outline"}
                      size={20}
                      color="#FF9800"
                    />
                  </TouchableOpacity>
                  <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Ionicons
                        key={star}
                        name={star <= rating.rating ? "star" : "star-outline"}
                        size={20}
                        color={star <= rating.rating ? "#FF9800" : "#666"}
                      />
                    ))}
                    <Text style={styles.ratingValue}>({rating.rating})</Text>
                  </View>
                </View>
                <Text style={styles.ratingDate}>
                  {formatDateTime(rating.created_at)}
                </Text>
              </View>

              <View style={styles.ratingDetails}>
                <Text style={styles.ratingDriverName}>
                  Motorista: {rating.rated_user_name}
                </Text>
                <Text style={styles.ratingPassengerName}>
                  Avaliado por: {rating.rater_name}
                </Text>
                <Text style={styles.ratingTrip}>
                  Viagem: {rating.trip_pickup} → {rating.trip_destination}
                </Text>
              </View>

              {rating.reason && (
                <View style={styles.ratingReasonContainer}>
                  <Text style={styles.ratingReasonLabel}>Motivo:</Text>
                  <Text style={styles.ratingReasonText}>{rating.reason}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.alertButton,
                  rating.alert_sent && styles.alertButtonDisabled
                ]}
                onPress={() => {
                  if (!rating.alert_sent) {
                    setSelectedRating(rating);
                    setShowAlertModal(true);
                  }
                }}
                disabled={rating.alert_sent}
              >
                <Ionicons 
                  name={rating.alert_sent ? "checkmark-circle" : "warning"} 
                  size={16} 
                  color={rating.alert_sent ? "#888" : "#fff"} 
                />
                <Text style={[
                  styles.alertButtonText,
                  rating.alert_sent && styles.alertButtonTextDisabled
                ]}>
                  {rating.alert_sent ? "Alerta Enviado" : "Enviar Alerta"}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderMessages = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mensagem para Passageiro</Text>
        <Text style={styles.sectionSubtitle}>Selecione um passageiro para enviar uma mensagem</Text>
        
        {passengers.length === 0 ? (
          <View style={styles.noDataContainer}>
            <Ionicons name="person" size={60} color="#666" />
            <Text style={styles.noDataText}>Nenhum passageiro encontrado!</Text>
            <Text style={styles.noDataSubtext}>Não há passageiros registrados no sistema</Text>
          </View>
        ) : (
          passengers.map(passenger => (
            <View key={passenger.id} style={styles.passengerCard}>
              <View style={styles.passengerInfo}>
                <View style={[styles.userTypeIndicator, { backgroundColor: getUserTypeColor(passenger.user_type) }]} />
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>{passenger.name}</Text>
                  <Text style={styles.userEmail}>{passenger.email}</Text>
                  <Text style={styles.userDate}>Registrado em: {formatDate(passenger.created_at)}</Text>
                  {!passenger.is_active && (
                    <Text style={styles.blockedText}>Usuário bloqueado</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.messagePassengerButton,
                  !passenger.is_active && styles.messagePassengerButtonDisabled
                ]}
                onPress={() => {
                  if (passenger.is_active) {
                    setSelectedPassenger(passenger);
                    setShowPassengerMessageModal(true);
                  }
                }}
                disabled={!passenger.is_active}
              >
                <Ionicons 
                  name="mail" 
                  size={16} 
                  color={passenger.is_active ? "#fff" : "#888"} 
                />
                <Text style={[
                  styles.messagePassengerButtonText,
                  !passenger.is_active && styles.messagePassengerButtonTextDisabled
                ]}>
                  Enviar Mensagem
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
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

  const renderChats = () => (
    <View style={styles.contentContainer}>
      <Text style={styles.sectionTitle}>Histórico de Chat (Passageiro/Motorista)</Text>
      
      {chats.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={60} color="#666" />
          <Text style={styles.emptyStateText}>Nenhuma conversa encontrada</Text>
          <Text style={styles.emptyStateSubtext}>
            Os chats aparecerão quando viagens com conversas forem realizadas
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.trip_id}
          renderItem={({ item }) => (
            <View style={styles.chatCard}>
              <View style={styles.chatHeader}>
                <View style={styles.chatUsers}>
                  {/* Passenger Info */}
                  <View style={styles.chatUser}>
                    <TouchableOpacity
                      onPress={() => handleViewPhoto(item.passenger.profile_photo, item.passenger.name)}
                      disabled={!item.passenger.profile_photo}
                    >
                      <View style={styles.chatUserAvatar}>
                        {item.passenger.profile_photo ? (
                          <Image 
                            source={{ uri: item.passenger.profile_photo }} 
                            style={styles.chatUserPhoto}
                          />
                        ) : (
                          <Ionicons name="person" size={16} color="#4CAF50" />
                        )}
                      </View>
                    </TouchableOpacity>
                    <View>
                      <TouchableOpacity
                        onPress={() => {
                          setActiveTab('users');
                          setHighlightedUserId(item.passenger.id);
                          // Clear highlight after 3 seconds
                          setTimeout(() => setHighlightedUserId(''), 3000);
                        }}
                      >
                        <Text style={[styles.chatUserName, styles.clickableUserName]}>
                          {item.passenger.name}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.chatUserType}>Passageiro</Text>
                    </View>
                  </View>

                  <View style={styles.chatSeparator}>
                    <Ionicons name="chatbubbles" size={20} color="#FF9800" />
                  </View>

                  {/* Driver Info */}
                  <View style={styles.chatUser}>
                    <TouchableOpacity
                      onPress={() => handleViewPhoto(item.driver.profile_photo, item.driver.name)}
                      disabled={!item.driver.profile_photo}
                    >
                      <View style={styles.chatUserAvatar}>
                        {item.driver.profile_photo ? (
                          <Image 
                            source={{ uri: item.driver.profile_photo }} 
                            style={styles.chatUserPhoto}
                          />
                        ) : (
                          <Ionicons name="car" size={16} color="#2196F3" />
                        )}
                      </View>
                    </TouchableOpacity>
                    <View>
                      <Text style={styles.chatUserName}>{item.driver.name}</Text>
                      <Text style={styles.chatUserType}>Motorista</Text>
                    </View>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.viewChatButton}
                  onPress={() => {
                    setSelectedChatId(item.trip_id);
                    setShowChatModal(true);
                  }}
                >
                  <Text style={styles.viewChatButtonText}>Ver Chat</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.chatInfo}>
                <Text style={styles.chatRoute}>
                  {item.pickup_address} → {item.destination_address}
                </Text>
                <Text style={styles.chatStats}>
                  {item.message_count} mensagens • Status: {item.trip_status}
                </Text>
                <Text style={styles.chatDates}>
                  Início: {new Date(item.first_message).toLocaleString('pt-BR')}
                  {item.last_message !== item.first_message && (
                    <Text> • Última: {new Date(item.last_message).toLocaleString('pt-BR')}</Text>
                  )}
                </Text>
              </View>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

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
          style={[styles.tab, activeTab === 'stats' && styles.activeTab]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>
            Estatísticas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.activeTab]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
            Usuários
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.activeTab]}
          onPress={() => setActiveTab('reports')}
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>
            Reports
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ratings' && styles.activeTab]}
          onPress={() => setActiveTab('ratings')}
        >
          <Text style={[styles.tabText, activeTab === 'ratings' && styles.activeTabText]}>
            Avaliações
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
          onPress={() => setActiveTab('messages')}
        >
          <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>
            Mensagens
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'trips' && styles.activeTab]}
          onPress={() => setActiveTab('trips')}
        >
          <Text style={[styles.tabText, activeTab === 'trips' && styles.activeTabText]}>
            Viagens
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chats' && styles.activeTab]}
          onPress={() => setActiveTab('chats')}
        >
          <Text style={[styles.tabText, activeTab === 'chats' && styles.activeTabText]}>
            CHAT P/M
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        {activeTab === 'stats' && renderStats()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'reports' && renderReports()}
        {activeTab === 'ratings' && renderRatings()}
        {activeTab === 'messages' && renderMessages()}
        {activeTab === 'trips' && renderTrips()}
        {activeTab === 'chats' && renderChats()}
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

      {/* Admin Message Modal */}
      <Modal visible={showMessageModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enviar Mensagem</Text>
              <TouchableOpacity onPress={() => setShowMessageModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Dar oportunidade de defesa para: {selectedReport?.reported_name}
            </Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Digite sua mensagem..."
              placeholderTextColor="#666"
              value={adminMessage}
              onChangeText={setAdminMessage}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
              <Text style={styles.sendButtonText}>Enviar Mensagem</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Block User Modal */}
      <Modal visible={showBlockModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bloquear Usuário</Text>
              <TouchableOpacity onPress={() => setShowBlockModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Bloquear usuário: {selectedUser?.name}
            </Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Motivo do bloqueio..."
              placeholderTextColor="#666"
              value={blockReason}
              onChangeText={setBlockReason}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity style={[styles.sendButton, { backgroundColor: '#f44336' }]} onPress={handleBlockUser}>
              <Text style={styles.sendButtonText}>Bloquear Usuário</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Passenger Message Modal */}
      <Modal visible={showPassengerMessageModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enviar Mensagem ao Passageiro</Text>
              <TouchableOpacity onPress={() => setShowPassengerMessageModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Enviar para: {selectedPassenger?.name} ({selectedPassenger?.email})
            </Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Digite sua mensagem para o passageiro..."
              placeholderTextColor="#666"
              value={passengerMessage}
              onChangeText={setPassengerMessage}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSendPassengerMessage}>
              <Text style={styles.sendButtonText}>Enviar Mensagem</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Alert Modal */}
      <Modal visible={showAlertModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enviar Alerta ao Motorista</Text>
              <TouchableOpacity onPress={() => setShowAlertModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Motorista: {selectedRating?.rated_user_name}
            </Text>
            <Text style={styles.modalSubtitle}>
              Avaliação: {selectedRating?.rating} estrelas
            </Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Digite a mensagem de alerta..."
              placeholderTextColor="#666"
              value={alertMessage}
              onChangeText={setAlertMessage}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSendAlert}>
              <Text style={styles.sendButtonText}>Enviar Alerta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Chat Modal */}
      <Modal visible={showChatModal} animationType="slide" presentationStyle="pageSheet">
        <ChatComponent
          tripId={selectedChatId}
          currentUserId={user?.id || ''}
          currentUserType="admin"
          onClose={() => setShowChatModal(false)}
        />
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
  },
  additionalStats: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statRowLabel: {
    fontSize: 16,
    color: '#888',
  },
  statRowValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
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
  onlineDriverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  driverEmail: {
    fontSize: 14,
    color: '#888',
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
  userCpf: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
    fontWeight: '500',
  },
  userPhone: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 2,
    fontWeight: '500',
  },
  userType: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  driverStatus: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  userDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  blockedText: {
    fontSize: 12,
    color: '#f44336',
    fontStyle: 'italic',
    marginTop: 4,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  blockButton: {
    padding: 8,
  },
  unblockButton: {
    padding: 8,
  },
  reportCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  reportDate: {
    fontSize: 12,
    color: '#666',
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  reportDescription: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  reportUsers: {
    marginBottom: 12,
  },
  reportUserText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  bold: {
    fontWeight: 'bold',
    color: '#fff',
  },
  adminMessageBox: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  adminMessageLabel: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  adminMessageText: {
    fontSize: 14,
    color: '#fff',
  },
  userResponseBox: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  userResponseLabel: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userResponseText: {
    fontSize: 14,
    color: '#fff',
  },
  reportActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  reportActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  reportActionText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  tripCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tripStatusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  tripPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
    flex: 1,
  },
  tripDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'right',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
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
  messageInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Rating styles
  ratingCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingValue: {
    color: '#FF9800',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  ratingDate: {
    color: '#888',
    fontSize: 12,
  },
  ratingDetails: {
    marginBottom: 12,
  },
  ratingDriverName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ratingPassengerName: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  ratingTrip: {
    color: '#888',
    fontSize: 14,
  },
  ratingReasonContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  ratingReasonLabel: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  ratingReasonText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  alertButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  alertButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  alertButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  alertButtonTextDisabled: {
    color: '#888',
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noDataText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  noDataSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  // Bulk operations styles
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
  tripHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Messages tab styles
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
    textAlign: 'center',
  },
  passengerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  messagePassengerButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  messagePassengerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messagePassengerButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  messagePassengerButtonTextDisabled: {
    color: '#888',
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
  // Chat styles
  chatCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chatUsers: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#666',
  },
  chatUserPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  chatUserName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  chatUserType: {
    fontSize: 12,
    color: '#888',
  },
  chatSeparator: {
    marginHorizontal: 16,
    alignItems: 'center',
  },
  viewChatButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewChatButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatInfo: {
    marginTop: 8,
  },
  chatRoute: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  chatStats: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  chatDates: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  // Trip users info styles
  tripUsersSection: {
    marginVertical: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
  },
  usersTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 8,
  },
  usersContainer: {
    gap: 8,
  },
  userInfoCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    padding: 8,
  },
  userTypeLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  defaultUserPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  userRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userRatingText: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: 'bold',
  },
});