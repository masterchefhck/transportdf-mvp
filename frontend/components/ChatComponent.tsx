import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface ChatMessage {
  id: string;
  trip_id: string;
  sender_id: string;
  sender_name: string;
  sender_type: 'passenger' | 'driver' | 'admin';
  message: string;
  timestamp: string;
}

interface ChatComponentProps {
  tripId: string;
  currentUserId: string;
  currentUserType: 'passenger' | 'driver' | 'admin';
  onClose?: () => void;
  onNewMessage?: (messageCount: number) => void;
  style?: any;
}

const showAlert = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

export default function ChatComponent({ 
  tripId, 
  currentUserId, 
  currentUserType, 
  onClose,
  onNewMessage,
  style 
}: ChatComponentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [previousMessageCount, setPreviousMessageCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Polling for new messages every 5 seconds
  useEffect(() => {
    loadMessages();
    
    const interval = setInterval(() => {
      loadMessages();
    }, 5000); // 5 seconds as requested

    return () => clearInterval(interval);
  }, [tripId]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const loadMessages = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(
        `${API_URL}/api/trips/${tripId}/chat/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const newMessages = response.data;
      
      // Check for new messages by other users
      if (previousMessageCount > 0 && newMessages.length > previousMessageCount) {
        const newMessagesByOthers = newMessages.slice(previousMessageCount).filter(
          (msg: ChatMessage) => msg.sender_id !== currentUserId
        );
        
        if (newMessagesByOthers.length > 0 && onNewMessage) {
          onNewMessage(newMessagesByOthers.length);
        }
      }
      
      setPreviousMessageCount(newMessages.length);
      setMessages(newMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    if (newMessage.length > 250) {
      showAlert('Erro', 'Mensagem muito longa! Máximo de 250 caracteres.');
      return;
    }

    setSending(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/api/trips/${tripId}/chat/send`,
        { message: newMessage.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setNewMessage('');
      loadMessages(); // Refresh messages immediately after sending
    } catch (error: any) {
      console.error('Error sending message:', error);
      if (error.response?.status === 400) {
        showAlert('Erro', 'Chat disponível apenas durante viagens ativas');
      } else if (error.response?.status === 403) {
        showAlert('Erro', 'Apenas participantes da viagem podem enviar mensagens');
      } else {
        showAlert('Erro', 'Erro ao enviar mensagem');
      }
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isOwnMessage = (message: ChatMessage) => {
    return message.sender_id === currentUserId;
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwn = isOwnMessage(item);
    
    return (
      <View style={[
        styles.messageContainer,
        isOwn ? styles.ownMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isOwn ? styles.ownBubble : styles.otherBubble
        ]}>
          {!isOwn && (
            <Text style={styles.senderName}>
              {item.sender_name} ({item.sender_type === 'passenger' ? 'Passageiro' : item.sender_type === 'driver' ? 'Motorista' : 'Admin'})
            </Text>
          )}
          <Text style={[
            styles.messageText,
            isOwn ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {item.message}
          </Text>
          <Text style={[
            styles.messageTime,
            isOwn ? styles.ownMessageTime : styles.otherMessageTime
          ]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const characterCount = newMessage.length;
  const isNearLimit = characterCount > 200;
  const isAtLimit = characterCount >= 250;

  return (
    <KeyboardAvoidingView 
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="chatbubbles" size={20} color="#4CAF50" />
          <Text style={styles.headerTitle}>Chat da Viagem</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages List */}
      <View style={styles.messagesContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#4CAF50" />
            <Text style={styles.loadingText}>Carregando mensagens...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-outline" size={50} color="#666" />
            <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
            <Text style={styles.emptySubtext}>Inicie a conversa!</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messagesList}
          />
        )}
      </View>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[
              styles.textInput,
              isAtLimit && styles.textInputLimit
            ]}
            placeholder="Digite sua mensagem..."
            placeholderTextColor="#666"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={250}
            editable={!sending}
          />
          <View style={styles.inputFooter}>
            <Text style={[
              styles.characterCount,
              isNearLimit && styles.characterCountWarning,
              isAtLimit && styles.characterCountLimit
            ]}>
              {characterCount}/250
            </Text>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!newMessage.trim() || sending || isAtLimit) && styles.sendButtonDisabled
              ]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending || isAtLimit}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  ownBubble: {
    backgroundColor: '#4CAF50',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#2a2a2a',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#888',
  },
  inputContainer: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  inputWrapper: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  textInputLimit: {
    borderColor: '#f44336',
    borderWidth: 1,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#888',
  },
  characterCountWarning: {
    color: '#FF9800',
  },
  characterCountLimit: {
    color: '#f44336',
    fontWeight: 'bold',
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#666',
  },
});