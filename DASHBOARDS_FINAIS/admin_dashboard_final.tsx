import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  name: string;
  email: string;
  phone_number?: string;
  user_type: string;
  is_active: boolean;
  created_at: string;
  driver_status?: string;
  profile_photo?: string;
}

interface Stats {
  total_users: number;
  active_drivers: number;
  total_trips: number;
  completed_trips: number;
  completion_rate: number;
  avg_trip_price: number;
  total_revenue: number;
  pending_reports: number;
}

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reporter_name: string;
  reported_name: string;
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

interface Trip {
  id: string;
  passenger_id: string;
  driver_id?: string;
  pickup_address: string;
  destination_address: string;
  estimated_price: number;
  status: string;
  requested_at: string;
  passenger_name?: string;
  passenger_email?: string;
  passenger_phone?: string;
  passenger_photo?: string;
  passenger_rating?: number;
  driver_name?: string;
  driver_email?: string;
  driver_phone?: string;
  driver_photo?: string;
  driver_rating?: number;
}

interface Rating {
  id: string;
  rated_user_id: string;
  rated_user_name: string;
  rater_name: string;
  trip_pickup: string;
  trip_destination: string;
  rating: number;
  reason?: string;
  created_at: string;
  alert_sent?: boolean;
}

interface ChatConversation {
  trip_id: string;
  passenger_name: string;
  driver_name: string;
  pickup_address: string;
  destination_address: string;
  messages: any[];
  last_message_at: string;
}

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');
  
  // Data states
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [passengers, setPassengers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [chats, setChats] = useState<ChatConversation[]>([]);
  
  // Modal states
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showPassengerMessageModal, setShowPassengerMessageModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  
  // Form states
  const [adminMessage, setAdminMessage] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [passengerMessage, setPassengerMessage] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  
  // Selection states
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPassenger, setSelectedPassenger] = useState<User | null>(null);
  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedPhotoUser, setSelectedPhotoUser] = useState<string>('');
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
  
  // Bulk operations
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [selectedTrips, setSelectedTrips] = useState<string[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<string[]>([]);

  useEffect(() => {
    loadUserData();
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'stats') {
      loadStats();
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'reports') {
      loadReports();
    } else if (activeTab === 'ratings') {
      loadRatings();
    } else if (activeTab === 'messages') {
      loadPassengers();
    } else if (activeTab === 'trips') {
      loadTrips();
    } else if (activeTab === 'chats') {
      loadChats();
    }
  }, [activeTab]);

  const loadUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data);
    } catch (error) {
      console.log('Error loading user data:', error);
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadUsers(),
      ]);
    } catch (error) {
      console.log('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(response.data);
    } catch (error) {
      console.log('Error loading stats:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setUsers(response.data);
      setDrivers(response.data.filter((u: User) => u.user_type === 'driver' && u.driver_status === 'online'));
      setPassengers(response.data.filter((u: User) => u.user_type === 'passenger'));
    } catch (error) {
      console.log('Error loading users:', error);
    }
  };

  const loadReports = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/admin/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReports(response.data);
    } catch (error) {
      console.log('Error loading reports:', error);
    }
  };

  const loadTrips = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/admin/trips`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTrips(response.data);
    } catch (error) {
      console.log('Error loading trips:', error);
    }
  };

  const loadRatings = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/admin/ratings/low`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRatings(response.data);
    } catch (error) {
      console.log('Error loading ratings:', error);
    }
  };

  const loadPassengers = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPassengers(response.data.filter((u: User) => u.user_type === 'passenger'));
    } catch (error) {
      console.log('Error loading passengers:', error);
    }
  };

  const loadChats = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/admin/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChats(response.data);
    } catch (error) {
      console.log('Error loading chats:', error);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedUser || !blockReason.trim()) return;

    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/users/${selectedUser.id}/block`,
        { reason: blockReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowBlockModal(false);
      setBlockReason('');
      loadUsers();
    } catch (error) {
      console.log('Error blocking user:', error);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/users/${userId}/unblock`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadUsers();
    } catch (error) {
      console.log('Error unblocking user:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedReport || !adminMessage.trim()) return;

    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/reports/${selectedReport.id}/message`,
        { message: adminMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowMessageModal(false);
      setAdminMessage('');
      loadReports();
    } catch (error) {
      console.log('Error sending message:', error);
    }
  };

  const handleSendPassengerMessage = async () => {
    if (!selectedPassenger || !passengerMessage.trim()) return;

    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/messages/send`,
        { 
          user_id: selectedPassenger.id,
          message: passengerMessage 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowPassengerMessageModal(false);
      setPassengerMessage('');
      // Show success feedback
    } catch (error) {
      console.log('Error sending passenger message:', error);
    }
  };

  const handleSendAlert = async () => {
    if (!selectedRating || !alertMessage.trim()) return;

    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/ratings/${selectedRating.id}/alert`,
        { message: alertMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowAlertModal(false);
      setAlertMessage('');
      loadRatings();
    } catch (error) {
      console.log('Error sending alert:', error);
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.put(
        `${API_URL}/api/admin/reports/${reportId}/resolve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadReports();
    } catch (error) {
      console.log('Error resolving report:', error);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.put(
        `${API_URL}/api/admin/reports/${reportId}/dismiss`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadReports();
    } catch (error) {
      console.log('Error dismissing report:', error);
    }
  };

  const handleViewPhoto = (photoUrl: string, userName: string) => {
    setSelectedPhotoUrl(photoUrl);
    setSelectedPhotoUser(userName);
    setShowPhotoModal(true);
  };

  const handleViewChat = (chat: ChatConversation) => {
    setSelectedChat(chat);
    setShowChatModal(true);
  };

  // Bulk operations
  const handleSelectAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
  };

  const handleSelectAllReports = () => {
    if (selectedReports.length === reports.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(reports.map(r => r.id));
    }
  };

  const handleSelectAllTrips = () => {
    if (selectedTrips.length === trips.length) {
      setSelectedTrips([]);
    } else {
      setSelectedTrips(trips.map(t => t.id));
    }
  };

  const handleSelectAllRatings = () => {
    if (selectedRatings.length === ratings.length) {
      setSelectedRatings([]);
    } else {
      setSelectedRatings(ratings.map(r => r.id));
    }
  };

  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.length === 0) return;
    
    setBulkOperationLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/users/bulk-delete`,
        { ids: selectedUsers },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSelectedUsers([]);
      loadUsers();
    } catch (error) {
      console.log('Error bulk deleting users:', error);
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const handleBulkDeleteReports = async () => {
    if (selectedReports.length === 0) return;
    
    setBulkOperationLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/reports/bulk-delete`,
        { ids: selectedReports },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSelectedReports([]);
      loadReports();
    } catch (error) {
      console.log('Error bulk deleting reports:', error);
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const handleBulkDeleteTrips = async () => {
    if (selectedTrips.length === 0) return;
    
    setBulkOperationLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/trips/bulk-delete`,
        { ids: selectedTrips },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSelectedTrips([]);
      loadTrips();
    } catch (error) {
      console.log('Error bulk deleting trips:', error);
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const handleBulkDeleteRatings = async () => {
    if (selectedRatings.length === 0) return;
    
    setBulkOperationLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/ratings/bulk-delete`,
        { ids: selectedRatings },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSelectedRatings([]);
      loadRatings();
    } catch (error) {
      console.log('Error bulk deleting ratings:', error);
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'stats') {
      loadStats();
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'reports') {
      loadReports();
    } else if (activeTab === 'ratings') {
      loadRatings();
    } else if (activeTab === 'messages') {
      loadPassengers();
    } else if (activeTab === 'trips') {
      loadTrips();
    } else if (activeTab === 'chats') {
      loadChats();
    }
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['access_token', 'user']);
      router.replace('/admin');
    } catch (error) {
      console.error('Error during logout:', error);
      router.replace('/admin');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'passenger': return '#4CAF50';
      case 'driver': return '#FF9800';
      case 'admin': return '#f44336';
      default: return '#666';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'under_review': return '#2196F3';
      case 'resolved': return '#4CAF50';
      case 'dismissed': return '#666';
      case 'requested': return '#FF9800';
      case 'accepted': return '#2196F3';
      case 'in_progress': return '#9C27B0';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#666';
      default: return '#666';
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
          <Text style={styles.statLabel}>Usuários Total</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#FF9800' }]}>
          <Ionicons name="car" size={32} color="#fff" />
          <Text style={styles.statNumber}>{stats?.active_drivers || 0}</Text>
          <Text style={styles.statLabel}>Motoristas Online</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#2196F3' }]}>
          <Ionicons name="map" size={32} color="#fff" />
          <Text style={styles.statNumber}>{stats?.total_trips || 0}</Text>
          <Text style={styles.statLabel}>Viagens Total</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#9C27B0' }]}>
          <Ionicons name="checkmark-circle" size={32} color="#fff" />
          <Text style={styles.statNumber}>{stats?.completed_trips || 0}</Text>
          <Text style={styles.statLabel}>Viagens Concluídas</Text>
        </View>
      </View>

      <View style={styles.additionalStats}>
        <View style={styles.statRow}>
          <Text style={styles.statRowLabel}>Taxa de Conclusão:</Text>
          <Text style={styles.statRowValue}>{stats?.completion_rate.toFixed(1) || 0}%</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statRowLabel}>Preço Médio por Viagem:</Text>
          <Text style={styles.statRowValue}>R$ {stats?.avg_trip_price.toFixed(2) || '0.00'}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statRowLabel}>Receita Total:</Text>
          <Text style={styles.statRowValue}>R$ {stats?.total_revenue.toFixed(2) || '0.00'}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statRowLabel}>Reports Pendentes:</Text>
          <Text style={[styles.statRowValue, { color: stats?.pending_reports > 0 ? '#f44336' : '#4CAF50' }]}>
            {stats?.pending_reports || 0}
          </Text>
        </View>
      </View>

      {drivers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Motoristas Online</Text>
          {drivers.map(driver => (
            <View key={driver.id} style={styles.onlineDriverCard}>
              <View style={styles.onlineIndicator} />
              <View style={styles.userPhotoContainer}>
                {driver.profile_photo ? (
                  <TouchableOpacity onPress={() => handleViewPhoto(driver.profile_photo!, driver.name)}>
                    <Image source={{ uri: driver.profile_photo }} style={styles.userPhotoThumbnail} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.defaultUserPhoto}>
                    <Ionicons name="person" size={16} color="#666" />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{driver.name}</Text>
                <Text style={styles.driverEmail}>{driver.email}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderUsers = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Usuários ({users.length})</Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={handleSelectAllUsers}
            >
              <Ionicons 
                name={selectedUsers.length === users.length ? "checkbox" : "square-outline"} 
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
              <View style={[styles.userTypeIndicator, { backgroundColor: getUserTypeColor(user.user_type) }]} />
              <View style={styles.userPhotoContainer}>
                {user.profile_photo ? (
                  <TouchableOpacity onPress={() => handleViewPhoto(user.profile_photo!, user.name)}>
                    <Image source={{ uri: user.profile_photo }} style={styles.userPhotoThumbnail} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.defaultUserPhoto}>
                    <Ionicons name="person" size={16} color="#666" />
                  </View>
                )}
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <Text style={styles.userType}>
                  {user.user_type === 'passenger' ? 'Passageiro' : 
                   user.user_type === 'driver' ? 'Motorista' : 'Admin'}
                </Text>
                {user.user_type === 'driver' && (
                  <Text style={[styles.driverStatus, { 
                    color: user.driver_status === 'online' ? '#4CAF50' : '#666' 
                  }]}>
                    {user.driver_status === 'online' ? 'Online' : 'Offline'}
                  </Text>
                )}
                <Text style={styles.userDate}>Registrado em: {formatDate(user.created_at)}</Text>
                {!user.is_active && (
                  <Text style={styles.blockedText}>Usuário bloqueado</Text>
                )}
              </View>
            </View>
            <View style={styles.userActions}>
              <View style={[styles.statusIndicator, { 
                backgroundColor: user.is_active ? '#4CAF50' : '#f44336' 
              }]} />
              {user.is_active ? (
                <TouchableOpacity
                  style={styles.blockButton}
                  onPress={() => {
                    setSelectedUser(user);
                    setShowBlockModal(true);
                  }}
                >
                  <Ionicons name="ban" size={20} color="#f44336" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.unblockButton}
                  onPress={() => handleUnblockUser(user.id)}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
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
          <Text style={styles.sectionTitle}>Reports ({reports.length})</Text>
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
                <Text style={styles.bold}>Usuário reportado:</Text> {report.reported_name}
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
                  onPress={() => handleResolveReport(report.id)}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={[styles.reportActionText, { color: '#fff' }]}>Resolver</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.reportActionButton, { backgroundColor: '#666' }]}
                  onPress={() => handleDismissReport(report.id)}
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

            {/* Passenger Info */}
            {trip.passenger_name && (
              <View style={styles.tripUserInfo}>
                <Text style={styles.tripUserLabel}>Passageiro:</Text>
                <View style={styles.tripUserDetails}>
                  {trip.passenger_photo && (
                    <TouchableOpacity onPress={() => handleViewPhoto(trip.passenger_photo!, trip.passenger_name!)}>
                      <Image source={{ uri: trip.passenger_photo }} style={styles.tripUserPhoto} />
                    </TouchableOpacity>
                  )}
                  <View style={styles.tripUserText}>
                    <Text style={styles.tripUserName}>{trip.passenger_name}</Text>
                    <Text style={styles.tripUserEmail}>{trip.passenger_email}</Text>
                    {trip.passenger_phone && (
                      <Text style={styles.tripUserPhone}>{trip.passenger_phone}</Text>
                    )}
                    {trip.passenger_rating && (
                      <View style={styles.tripUserRating}>
                        <Ionicons name="star" size={12} color="#FF9800" />
                        <Text style={styles.tripUserRatingText}>{trip.passenger_rating.toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Driver Info */}
            {trip.driver_name && (
              <View style={styles.tripUserInfo}>
                <Text style={styles.tripUserLabel}>Motorista:</Text>
                <View style={styles.tripUserDetails}>
                  {trip.driver_photo && (
                    <TouchableOpacity onPress={() => handleViewPhoto(trip.driver_photo!, trip.driver_name!)}>
                      <Image source={{ uri: trip.driver_photo }} style={styles.tripUserPhoto} />
                    </TouchableOpacity>
                  )}
                  <View style={styles.tripUserText}>
                    <Text style={styles.tripUserName}>{trip.driver_name}</Text>
                    <Text style={styles.tripUserEmail}>{trip.driver_email}</Text>
                    {trip.driver_phone && (
                      <Text style={styles.tripUserPhone}>{trip.driver_phone}</Text>
                    )}
                    {trip.driver_rating && (
                      <View style={styles.tripUserRating}>
                        <Ionicons name="star" size={12} color="#FF9800" />
                        <Text style={styles.tripUserRatingText}>{trip.driver_rating.toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
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

  const renderChats = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conversas de Chat</Text>
        <Text style={styles.sectionSubtitle}>Monitorar conversas entre passageiros e motoristas</Text>
        
        {chats.length === 0 ? (
          <View style={styles.noDataContainer}>
            <Ionicons name="chatbubbles" size={60} color="#666" />
            <Text style={styles.noDataText}>Nenhuma conversa encontrada!</Text>
            <Text style={styles.noDataSubtext}>Não há conversas de chat no sistema</Text>
          </View>
        ) : (
          chats.map(chat => (
            <View key={chat.trip_id} style={styles.chatCard}>
              <View style={styles.chatHeader}>
                <Text style={styles.chatTitle}>Viagem: {chat.trip_id.substring(0, 8)}...</Text>
                <Text style={styles.chatDate}>{formatDateTime(chat.last_message_at)}</Text>
              </View>
              
              <View style={styles.chatParticipants}>
                <Text style={styles.chatParticipant}>
                  <Text style={styles.bold}>Passageiro:</Text> {chat.passenger_name}
                </Text>
                <Text style={styles.chatParticipant}>
                  <Text style={styles.bold}>Motorista:</Text> {chat.driver_name}
                </Text>
              </View>
              
              <View style={styles.chatRoute}>
                <Text style={styles.chatRouteText}>
                  {chat.pickup_address} → {chat.destination_address}
                </Text>
              </View>
              
              <View style={styles.chatStats}>
                <Text style={styles.chatStatsText}>
                  {chat.messages.length} mensagem{chat.messages.length !== 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  style={styles.viewChatButton}
                  onPress={() => handleViewChat(chat)}
                >
                  <Ionicons name="eye" size={16} color="#fff" />
                  <Text style={styles.viewChatButtonText}>Ver Chat</Text>
                </TouchableOpacity>
              </View>
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
            Chat M/P
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

      {/* Chat Viewer Modal */}
      <Modal visible={showChatModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Conversa de Chat</Text>
              <TouchableOpacity onPress={() => setShowChatModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {selectedChat && (
              <>
                <Text style={styles.modalSubtitle}>
                  {selectedChat.passenger_name} ↔ {selectedChat.driver_name}
                </Text>
                
                <FlatList
                  data={selectedChat.messages}
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={({ item }) => (
                    <View style={styles.chatMessageItem}>
                      <Text style={styles.chatMessageSender}>{item.sender_name}:</Text>
                      <Text style={styles.chatMessageText}>{item.message}</Text>
                      <Text style={styles.chatMessageTime}>
                        {formatDateTime(item.timestamp)}
                      </Text>
                    </View>
                  )}
                  style={styles.chatMessagesList}
                />
              </>
            )}
          </View>
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
    paddingHorizontal: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#FF9800',
  },
  tabText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
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
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
    textAlign: 'center',
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
  reportHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  tripHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  tripUserInfo: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  tripUserLabel: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  tripUserDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripUserPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  tripUserText: {
    flex: 1,
  },
  tripUserName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  tripUserEmail: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  tripUserPhone: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  tripUserRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  tripUserRatingText: {
    fontSize: 12,
    color: '#FF9800',
    marginLeft: 4,
  },
  tripDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'right',
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
  ratingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  // Messages tab styles
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
    marginBottom: 8,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  chatDate: {
    fontSize: 12,
    color: '#666',
  },
  chatParticipants: {
    marginBottom: 8,
  },
  chatParticipant: {
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  chatRoute: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  chatRouteText: {
    fontSize: 12,
    color: '#fff',
  },
  chatStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatStatsText: {
    fontSize: 12,
    color: '#888',
  },
  viewChatButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  viewChatButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatMessagesList: {
    maxHeight: 300,
  },
  chatMessageItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  chatMessageSender: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  chatMessageText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  chatMessageTime: {
    fontSize: 10,
    color: '#666',
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
    maxHeight: '80%',
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
  },
  photoModalContent: {
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  photoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  photoModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  photoModalCloseButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  photoModalImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
});