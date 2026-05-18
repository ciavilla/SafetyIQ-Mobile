import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ChatScreen from './screens/ChatScreen';
import LoginScreen from './screens/LoginScreen';

export default function App() {
  const [token, setToken] = useState<string | null>(null);

  const handleLogin = (accessToken: string) => {
    setToken(accessToken);
  };

  const handleLogout = () => {
    setToken(null);
  };

  return (
    <SafeAreaProvider>
      {token ? (
        <ChatScreen onLogout={handleLogout} />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </SafeAreaProvider>
  );
}
