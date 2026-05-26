import React, { useState, useRef, useEffect } from 'react';
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
import { searchOffline, initOfflineDB, OfflineResult } from '../lib/offlineSearch';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceChunk[];
  showSources?: boolean;
}

interface Props {
  onLogout: () => void;
}

export default function ChatScreen({ onLogout}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const isOnline = useNetworkStatus();

  useEffect(() => {
    initOfflineDB();
  }, []);

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
      if (isOnline) {
        const response = await sendQuery(userMessage.content, history);
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
          showSources: false,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const results = await searchOffline(userMessage.content);
        if (results.length === 0) {
          const noResultsMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'No matching OSHA regulations found for your query. Try different keywords.',
          };
          setMessages((prev) => [...prev, noResultsMessage]);
        } else {
          const offlineContent = results
            .map((r: OfflineResult, i: number) =>
              `📄 ${r.document_title} — Page ${r.page_number}\n\n${r.content}`
            )
            .join('\n\n──────────\n\n');
          const offlineMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: offlineContent,
            showSources: false,
          };
          setMessages((prev) => [...prev, offlineMessage]);
        }
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
     finally {
      setLoading(false);
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
        <View>
          <Text style={styles.headerTitle}>🦺 SafetyIQ</Text>
          <Text style={styles.headerSubtitle}>OSHA-grounded safety assistant</Text>
        </View>
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📴 Offline Mode — Showing OSHA regulation text only
          </Text>
        </View>
      )}

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
            <Text style={styles.chipsHeading}>Try asking...</Text>
            <View style={styles.chipsContainer}>
              {[
                'What PPE is required for electrical work?',
                'What are lockout/tagout requirements?',
                'When is fall protection required?',
                'What are confined space entry requirements?',
                'What are the rules for scaffold safety?',
              ].map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.chip}
                  onPress={() => {
                    setInput(suggestion);
                  }}
                >
                  <Text style={styles.chipText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: { color: '#8B0000', fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: '#666666', fontSize: 12, marginTop: 2 },
  logoutText: { color: '#8B0000', fontSize: 13 },
  messageList: { padding: 16, paddingBottom: 8 },
  messageBubble: { marginBottom: 12, maxWidth: '85%', borderRadius: 12, padding: 12 },
  userBubble: { backgroundColor: '#8B0000', alignSelf: 'flex-end' },
  aiBubble: { backgroundColor: '#FFFFFF', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#E0E0E0' },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#FFFFFF' },
  aiText: { color: '#1A1A1A' },
  sourcesToggle: { marginTop: 8 },
  sourcesToggleText: { color: '#8B0000', fontSize: 13, fontWeight: '600' },
  sourceCard: {
    marginTop: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8B0000',
  },
  sourceTitle: { fontSize: 12, fontWeight: '700', color: '#333333' },
  sourceMeta: { fontSize: 11, color: '#666666', marginTop: 2 },
  sourceContent: { fontSize: 12, color: '#444444', marginTop: 4, lineHeight: 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  loadingText: { color: '#666666', fontSize: 14 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sendButton: { backgroundColor: '#8B0000', borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: '#CCCCCC' },
  sendButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  disclaimer: {
    textAlign: 'center',
    fontSize: 10,
    color: '#999999',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#666666', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  chipsContainer: {
    marginTop: 24,
    width: '100%',
    gap: 10,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#8B0000',
    alignItems: 'center',
  },
  chipText: {
    color: '#8B0000',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  chipsHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
    marginTop: 24,
    marginBottom: -4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  offlineBanner: {
    backgroundColor: '#FFF3CD',
    padding: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFD700',
  },
  offlineBannerText: {
    color: '#856404',
    fontSize: 13,
    fontWeight: '600',
  },
});
