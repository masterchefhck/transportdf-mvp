import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
  FlatList,
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

interface Stats {
  total_users: number;
  total_drivers: number;
  total_passengers: number;
  total_trips: number;
  completed_trips: number;
  completion_rate: number;
}

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reporter_name: string;
  reported_name: string;
  reported_user_type: string;
  title: string;
  description: string;
  report_type: string;
  status: string;
  created_at: string;
  admin_message?: string;
  user_response?: string;
  response_allowed: boolean;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'trips' | 'reports' | 'ratings'>('stats');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

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
    loadData();
  }, []);

  const loadData = async () => {
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
      console.error('Error loading data:', error);
      showAlert('Erro', 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    showConfirm(
      'Sair',
      'Tem certeza que deseja sair?',
      async () => {
        try {
          await AsyncStorage.multiRemove(['access_token', 'user']);
          router.replace('/admin');
        } catch (error) {
          console.error('Error during logout:', error);
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
      
      showAlert('Sucesso', 'Mensagem enviada com sucesso!');
      setShowMessageModal(false);
      setAdminMessage('');
      loadData();
    } catch (error) {
      console.error('Error sending message:', error);
      showAlert('Erro', 'Erro ao enviar mensagem');
    }
  };

  const handleResolveReport = async (reportId: string) => {
    showConfirm(
      'Resolver Report',
      'Tem certeza que deseja resolver este report?',
      async () => {
        try {
          const token = await AsyncStorage.getItem('access_token');
          await axios.post(
            `${API_URL}/api/admin/reports/${reportId}/resolve`,
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

  const handleDismissReport = async (reportId: string) => {
    showConfirm(
      'Descartar Report',
      'Tem certeza que deseja descartar este report?',
      async () => {
        try {
          const token = await AsyncStorage.getItem('access_token');
          await axios.post(
            `${API_URL}/api/admin/reports/${reportId}/dismiss`,
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

  const handleBlockUser = async () => {
    if (!blockReason.trim() || !selectedUser) return;
    
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/admin/users/${selectedUser.id}/block`,
        { user_id: selectedUser.id, reason: blockReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      showAlert('Sucesso', 'Usuário bloqueado com sucesso!');
      setShowBlockModal(false);
      setBlockReason('');
      loadData();
    } catch (error) {
      console.error('Error blocking user:', error);
      showAlert('Erro', 'Erro ao bloquear usuário');
    }
  };

  const handleUnblockUser = async (userId: string) => {
    showConfirm(
      'Desbloquear Usuário',
      'Tem certeza que deseja desbloquear este usuário?',
      async () => {
        try {
          const token = await AsyncStorage.getItem('access_token');
          await axios.post(
            `${API_URL}/api/admin/users/${userId}/unblock`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          showAlert('Sucesso', 'Usuário desbloqueado com sucesso!');
          loadData();
        } catch (error) {
          console.error('Error unblocking user:', error);
          showAlert('Erro', 'Erro ao desbloquear usuário');
        }
      }
    );
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const renderStats = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estatísticas Gerais</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={32} color="#4CAF50" />
            <Text style={styles.statNumber}>{stats?.total_users || 0}</Text>
            <Text style={styles.statLabel}>Usuários Totais</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="car" size={32} color="#2196F3" />
            <Text style={styles.statNumber}>{stats?.total_drivers || 0}</Text>
            <Text style={styles.statLabel}>Motoristas</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="person" size={32} color="#FF9800" />
            <Text style={styles.statNumber}>{stats?.total_passengers || 0}</Text>
            <Text style={styles.statLabel}>Passageiros</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="location" size={32} color="#9C27B0" />
            <Text style={styles.statNumber}>{stats?.total_trips || 0}</Text>
            <Text style={styles.statLabel}>Viagens Totais</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
            <Text style={styles.statNumber}>{stats?.completed_trips || 0}</Text>
            <Text style={styles.statLabel}>Concluídas</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="trending-up" size={32} color="#FF5722" />
            <Text style={styles.statNumber}>{stats?.completion_rate || 0}%</Text>
            <Text style={styles.statLabel}>Taxa Sucesso</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderUsers = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gerenciar Usuários</Text>
        {users.map(user => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userInfo}>
              <View style={[styles.userTypeIndicator, { backgroundColor: getUserTypeColor(user.user_type) }]} />
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <Text style={styles.userType}>
                  {user.user_type === 'passenger' ? 'Passageiro' : 
                   user.user_type === 'driver' ? 'Motorista' : 'Admin'}
                </Text>
              </View>
              <View style={styles.userActions}>
                <View style={[styles.statusBadge, { 
                  backgroundColor: user.is_active ? '#4CAF50' : '#f44336' 
                }]}>
                  <Text style={styles.statusText}>
                    {user.is_active ? 'Ativo' : 'Bloqueado'}
                  </Text>
                </View>
                {user.is_active ? (
                  <TouchableOpacity
                    style={styles.blockButton}
                    onPress={() => {
                      setSelectedUser(user);
                      setShowBlockModal(true);
                    }}
                  >
                    <Ionicons name="ban" size={16} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.unblockButton}
                    onPress={() => handleUnblockUser(user.id)}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
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
        <Text style={styles.sectionTitle}>Gerenciar Reports</Text>
        {reports.map(report => (
          <View key={report.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>{report.title}</Text>
              <View style={[styles.reportStatusBadge, { 
                backgroundColor: report.status === 'pending' ? '#FF9800' : 
                                report.status === 'under_review' ? '#2196F3' :
                                report.status === 'resolved' ? '#4CAF50' : '#666'
              }]}>
                <Text style={styles.reportStatusText}>
                  {report.status === 'pending' ? 'Pendente' :
                   report.status === 'under_review' ? 'Em Análise' :
                   report.status === 'resolved' ? 'Resolvido' : 'Descartado'}
                </Text>
              </View>
            </View>
            
            <Text style={styles.reportDescription}>{report.description}</Text>
            
            <View style={styles.reportInfo}>
              <Text style={styles.reportInfoText}>
                <Text style={styles.reportInfoLabel}>Reportado por:</Text> {report.reporter_name}
              </Text>
              <Text style={styles.reportInfoText}>
                <Text style={styles.reportInfoLabel}>Usuário reportado:</Text> {report.reported_name} ({
                  report.reported_user_type === 'passenger' ? 'Passageiro' :
                  report.reported_user_type === 'driver' ? 'Motorista' : 'Admin'
                })
              </Text>
              <Text style={styles.reportInfoText}>
                <Text style={styles.reportInfoLabel}>Data:</Text> {formatDateTime(report.created_at)}
              </Text>
            </View>

            {report.admin_message && (
              <View style={styles.adminMessageContainer}>
                <Text style={styles.adminMessageLabel}>Mensagem do Admin:</Text>
                <Text style={styles.adminMessageText}>{report.admin_message}</Text>
              </View>
            )}

            {report.user_response && (
              <View style={styles.userResponseContainer}>
                <Text style={styles.userResponseLabel}>Resposta do Usuário:</Text>
                <Text style={styles.userResponseText}>{report.user_response}</Text>
              </View>
            )}

            {report.status === 'pending' && (
              <View style={styles.reportActions}>
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={() => {
                    setSelectedReport(report);
                    setShowMessageModal(true);
                  }}
                >
                  <Ionicons name="mail" size={16} color="#fff" />
                  <Text style={styles.messageButtonText}>Enviar Mensagem</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resolveButton}
                  onPress={() => handleResolveReport(report.id)}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.resolveButtonText}>Resolver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={() => handleDismissReport(report.id)}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                  <Text style={styles.dismissButtonText}>Descartar</Text>
                </TouchableOpacity>
              </View>
            )}
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
        <Text style={styles.sectionTitle}>Últimas Viagens</Text>
        {trips.map(trip => (
          <View key={trip.id} style={styles.tripCard}>
            <View style={styles.tripHeader}>
              <Text style={styles.tripId}>#{trip.id.slice(0, 8)}</Text>
              <Text style={styles.tripPrice}>R$ {trip.estimated_price.toFixed(2)}</Text>
            </View>
            <View style={styles.tripRoute}>
              <Text style={styles.routeText}>
                <Ionicons name="radio-button-on" size={12} color="#4CAF50" /> {trip.pickup_address}
              </Text>
              <Text style={styles.routeText}>
                <Ionicons name="location" size={12} color="#f44336" /> {trip.destination_address}
              </Text>
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

  if (loading && !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Painel Administrativo</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabsContainer}>
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

      {/* Message Modal */}
      <Modal visible={showMessageModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enviar Mensagem</Text>
              <TouchableOpacity onPress={() => setShowMessageModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
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
              Usuário: {selectedUser?.name}
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
            <TouchableOpacity style={styles.blockButtonModal} onPress={handleBlockUser}>
              <Text style={styles.blockButtonText}>Bloquear Usuário</Text>
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
  header: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 10,
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
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  userCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userTypeIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
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
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  userActions: {
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  blockButton: {
    backgroundColor: '#f44336',
    padding: 8,
    borderRadius: 6,
  },
  unblockButton: {
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 6,
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
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
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
  reportDescription: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 12,
    lineHeight: 20,
  },
  reportInfo: {
    marginBottom: 12,
  },
  reportInfoText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  reportInfoLabel: {
    fontWeight: 'bold',
    color: '#FF9800',
  },
  adminMessageContainer: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  adminMessageLabel: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  adminMessageText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 18,
  },
  userResponseContainer: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  userResponseLabel: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  userResponseText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 18,
  },
  reportActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  messageButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resolveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  resolveButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dismissButton: {
    backgroundColor: '#666',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 12,
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
    marginBottom: 8,
  },
  tripId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  tripPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  tripRoute: {
    marginBottom: 8,
  },
  routeText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  tripDate: {
    fontSize: 12,
    color: '#888',
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
    marginBottom: 12,
  },
  messageInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    textAlignVertical: 'top',
    marginBottom: 16,
    minHeight: 80,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  blockButtonModal: {
    backgroundColor: '#f44336',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  blockButtonText: {
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
});