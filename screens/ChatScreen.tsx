import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendQuery, Message, SourceChunk } from '../lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceChunk[];
  showSources?: boolean;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    const history: Message[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendQuery(userMessage.content, history);
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        showSources: false,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const toggleSources = (id: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, showSources: !m.showSources } : m
      )
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
          {item.content}
        </Text>
        {item.sources && item.sources.length > 0 && (
          <TouchableOpacity onPress={() => toggleSources(item.id)} style={styles.sourcesToggle}>
            <Text style={styles.sourcesToggleText}>
              {item.showSources ? 'Hide sources' : `View ${item.sources.length} source(s)`}
            </Text>
          </TouchableOpacity>
        )}
        {item.showSources && item.sources?.map((source, index) => (
          <View key={index} style={styles.sourceCard}>
            <Text style={styles.sourceTitle}>{source.document_title}</Text>
            <Text style={styles.sourceMeta}>
              Page {source.page_number} · {Math.round(source.similarity * 100)}% match
            </Text>
            <Text style={styles.sourceContent} numberOfLines={3}>
              {source.content}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🦺 SafetyIQ</Text>
        <Text style={styles.headerSubtitle}>OSHA-grounded safety assistant</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Ask a workplace safety question</Text>
            <Text style={styles.emptySubtitle}>
              Every answer cites its OSHA source so you can verify.
            </Text>
          </View>
        }
      />

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#8B0000" />
          <Text style={styles.loadingText}>Searching OSHA documents...</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask a safety question..."
            placeholderTextColor="#999"
            multiline
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.disclaimer}>
          For informational purposes only. Consult a qualified safety professional for compliance decisions.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#8B0000', padding: 16, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: '#ffcccc', fontSize: 12, marginTop: 2 },
  messageList: { padding: 16, paddingBottom: 8 },
  messageBubble: { marginBottom: 12, maxWidth: '85%', borderRadius: 12, padding: 12 },
  userBubble: { backgroundColor: '#8B0000', alignSelf: 'flex-end' },
  aiBubble: { backgroundColor: '#fff', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#e0e0e0' },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  aiText: { color: '#1a1a1a' },
  sourcesToggle: { marginTop: 8 },
  sourcesToggleText: { color: '#8B0000', fontSize: 13, fontWeight: '600' },
  sourceCard: { marginTop: 8, backgroundColor: '#f9f9f9', borderRadius: 8, padding: 8, borderLeftWidth: 3, borderLeftColor: '#8B0000' },
  sourceTitle: { fontSize: 12, fontWeight: '700', color: '#333' },
  sourceMeta: { fontSize: 11, color: '#666', marginTop: 2 },
  sourceContent: { fontSize: 12, color: '#444', marginTop: 4, lineHeight: 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  loadingText: { color: '#666', fontSize: 14 },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, color: '#1a1a1a' },
  sendButton: { backgroundColor: '#8B0000', borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: '#ccc' },
  sendButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disclaimer: { textAlign: 'center', fontSize: 10, color: '#999', paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#fff' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
