import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { AUTH0_DOMAIN, AUTH0_CLIENT_ID, discovery } from '../lib/auth0';

WebBrowser.maybeCompleteAuthSession();

interface Props {
  onLogin: (token: string) => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectUri = AuthSession.makeRedirectUri();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: AUTH0_CLIENT_ID,
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
      scopes: ['openid', 'profile', 'email'],
      extraParams: {
        nonce: 'nonce',
      },
    },
    discovery
  );

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      onLogin(access_token);
    } else if (response?.type === 'error') {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  }, [response]);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    await promptAsync();
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>SafetyIQ</Text>
        <Text style={styles.subtitle}>
          OSHA-grounded workplace safety assistant
        </Text>

        <Text style={styles.description}>
          Get instant answers to workplace safety questions, grounded in real
          OSHA documentation with source citations.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={!request || loading}
        >
          {loading ? (
            <ActivityIndicator color="#8B0000" />
          ) : (
            <Text style={styles.loginButtonText}>Sign In to Continue</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By signing in you agree to use this app for informational purposes
          only. Always consult a qualified safety professional for compliance
          decisions.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#8B0000' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
  },
  logo: { width: 120, height: 120 },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#ffcccc',
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#ffdddd',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  error: {
    color: '#ffcccc',
    marginBottom: 16,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  loginButtonDisabled: { backgroundColor: '#ffdddd' },
  loginButtonText: {
    color: '#8B0000',
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 11,
    color: '#ffaaaa',
    textAlign: 'center',
    lineHeight: 16,
  },
});
