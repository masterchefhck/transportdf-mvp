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
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'trips' | 'reports' | 'ratings'>('stats');
  
  // Modal states
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [adminMessage, setAdminMessage] = useState('');
  const [blockReason, setBlockReason] = useState('');

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
        <Text style={styles.sectionTitle}>Usuários Registrados</Text>
        {users.map(user => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userInfo}>
              <View style={[styles.userTypeIndicator, { backgroundColor: getUserTypeColor(user.user_type) }]} />
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
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
        <Text style={styles.sectionTitle}>Reports do Sistema</Text>
        {reports.map(report => (
          <View key={report.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <View style={[styles.reportStatusBadge, { backgroundColor: getStatusColor(report.status) }]}>
                <Text style={styles.reportStatusText}>
                  {report.status === 'pending' ? 'Pendente' :
                   report.status === 'under_review' ? 'Em Análise' :
                   report.status === 'resolved' ? 'Resolvido' :
                   report.status === 'dismissed' ? 'Descartado' : report.status}
                </Text>
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
        <Text style={styles.sectionTitle}>Viagens Recentes</Text>
        {trips.map(trip => (
          <View key={trip.id} style={styles.tripCard}>
            <View style={styles.tripHeader}>
              <View style={[styles.tripStatusBadge, { backgroundColor: getStatusColor(trip.status) }]}>
                <Text style={styles.tripStatusText}>
                  {trip.status === 'requested' ? 'Solicitada' :
                   trip.status === 'accepted' ? 'Aceita' :
                   trip.status === 'in_progress' ? 'Em andamento' :
                   trip.status === 'completed' ? 'Concluída' :
                   trip.status === 'cancelled' ? 'Cancelada' : trip.status}
                </Text>
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
        <Text style={styles.sectionTitle}>Avaliações Abaixo de 5 Estrelas</Text>
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
                style={styles.alertButton}
                onPress={() => {
                  setSelectedRating(rating);
                  setShowAlertModal(true);
                }}
              >
                <Ionicons name="warning" size={16} color="#fff" />
                <Text style={styles.alertButtonText}>Enviar Alerta</Text>
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
          style={[styles.tab, activeTab === 'trips' && styles.activeTab]}
          onPress={() => setActiveTab('trips')}
        >
          <Text style={[styles.tabText, activeTab === 'trips' && styles.activeTabText]}>
            Viagens
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        {activeTab === 'stats' && renderStats()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'reports' && renderReports()}
        {activeTab === 'ratings' && renderRatings()}
        {activeTab === 'trips' && renderTrips()}
      </View>

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
});