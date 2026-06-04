import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { initDatabase } from './src/storage/database';

import HomeScreen   from './src/screens/HomeScreen';
import EnrollScreen from './src/screens/EnrollScreen';
import AuthScreen   from './src/screens/AuthScreen';
import ResultScreen from './src/screens/ResultScreen';
import SyncScreen   from './src/screens/SyncScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
  const init = async () => {
    try {
      await initDatabase();
      setDbReady(true);
    } catch (err) {
      console.error('DB Error:', err);
      // Error ke bawajood app chalao
      setDbReady(true);
    }
  };
  init();
}, []);

  if (!dbReady) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>🔐 DataLake FaceAuth</Text>
        <ActivityIndicator color="#6c63ff" style={{ marginTop: 20 }} />
        <Text style={styles.loadingSubtext}>Initializing secure storage...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: 'bold' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Home"   component={HomeScreen}   options={{ title: 'DataLake FaceAuth', headerShown: false }} />
        <Stack.Screen name="Enroll" component={EnrollScreen} options={{ title: '📷 Register Face' }} />
        <Stack.Screen name="Auth"   component={AuthScreen}   options={{ title: '✅ Authenticate' }} />
        <Stack.Screen name="Result" component={ResultScreen} options={{ title: '🎯 Result', headerShown: false }} />
        <Stack.Screen name="Sync"   component={SyncScreen}   options={{ title: '☁️ AWS Sync' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1, backgroundColor: '#1a1a2e',
    alignItems: 'center', justifyContent: 'center',
  },
  loadingText: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  loadingSubtext: { fontSize: 14, color: '#6c63ff', marginTop: 12 },
});