import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import { getStats, clearAllUsers } from '../storage/database';
import { startAutoSync } from '../sync/awsSync';

export default function HomeScreen({ navigation }) {
  const [stats, setStats]               = useState({ totalUsers: 0, totalLogs: 0, pendingSync: 0 });
  const [refreshing, setRefreshing]     = useState(false);
  const [networkStatus, setNetworkStatus] = useState('offline');
  const [lastSync, setLastSync]         = useState(null);

  const loadStats = async () => {
    try {
      const s = await getStats();
      setStats(s);
    } catch (e) {
      console.log('Stats error:', e);
    }
  };

  useFocusEffect(
    useCallback(() => { loadStats(); }, [])
  );

  useEffect(() => {
    // Network status listener
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setNetworkStatus(state.isConnected ? 'online' : 'offline');
    });

    // Auto sync on network reconnect
    const unsubscribeSync = startAutoSync((result) => {
      if (result.synced > 0) {
        setLastSync(new Date().toLocaleTimeString());
        loadStats();
        Alert.alert(
          '☁️ Auto Sync Done!',
          `${result.synced} records AWS pe upload ho gaye!`
        );
      }
    });

    return () => {
      unsubscribeNet();
      if (unsubscribeSync) unsubscribeSync();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const handleClearUsers = () => {
    Alert.alert(
      '🗑️ Clear All Data',
      'Sab users aur logs delete ho jayenge. Sure ho?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All', style: 'destructive',
          onPress: async () => {
            await clearAllUsers();
            await loadStats();
            Alert.alert('✅ Done', 'Fresh start!');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6c63ff" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🔐</Text>
        <Text style={styles.title}>DataLake FaceAuth</Text>
        <Text style={styles.subtitle}>Offline · Secure · Fast</Text>
        <Text style={styles.hackathon}>NHAI Hackathon 7.0</Text>
      </View>

      {/* Network badge */}
      <View style={[
        styles.networkBadge,
        networkStatus === 'online' ? styles.networkOnline : styles.networkOffline
      ]}>
        <View style={[
          styles.dot,
          { backgroundColor: networkStatus === 'online' ? '#2ecc71' : '#e74c3c' }
        ]} />
        <View>
          <Text style={styles.networkText}>
            {networkStatus === 'online' ? '🌐 Online — Sync ready' : '📵 Offline mode active'}
          </Text>
          {lastSync && (
            <Text style={styles.lastSync}>Last sync: {lastSync}</Text>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalUsers}</Text>
          <Text style={styles.statLabel}>👤 Users</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalLogs}</Text>
          <Text style={styles.statLabel}>📋 Logs</Text>
        </View>
        <View style={[styles.statCard, stats.pendingSync > 0 && styles.statWarn]}>
          <Text style={[styles.statNumber, stats.pendingSync > 0 && { color: '#f39c12' }]}>
            {stats.pendingSync}
          </Text>
          <Text style={styles.statLabel}>⏳ Pending</Text>
        </View>
      </View>

      {/* Main buttons */}
      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={() => navigation.navigate('Enroll')}
      >
        <Text style={styles.btnIcon}>📷</Text>
        <View style={styles.btnTextContainer}>
          <Text style={styles.btnTitle}>Register Face</Text>
          <Text style={styles.btnSubtitle}>MediaPipe landmarks enroll karo</Text>
        </View>
        <Text style={styles.btnArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnSecondary}
        onPress={() => navigation.navigate('Auth')}
      >
        <Text style={styles.btnIcon}>✅</Text>
        <View style={styles.btnTextContainer}>
          <Text style={styles.btnTitle}>Authenticate</Text>
          <Text style={styles.btnSubtitle}>Liveness + face match</Text>
        </View>
        <Text style={styles.btnArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnSync}
        onPress={() => navigation.navigate('Sync')}
      >
        <Text style={styles.btnIcon}>☁️</Text>
        <View style={styles.btnTextContainer}>
          <Text style={styles.btnTitle}>AWS Sync</Text>
          <Text style={styles.btnSubtitle}>
            {stats.pendingSync > 0
              ? `${stats.pendingSync} records pending`
              : 'Sab synced hai'}
          </Text>
        </View>
        {stats.pendingSync > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{stats.pendingSync}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Tech stack badges */}
      <View style={styles.techRow}>
        <View style={styles.techBadge}><Text style={styles.techText}>MediaPipe</Text></View>
        <View style={styles.techBadge}><Text style={styles.techText}>SQLite</Text></View>
        <View style={styles.techBadge}><Text style={styles.techText}>Offline-First</Text></View>
        <View style={styles.techBadge}><Text style={styles.techText}>AWS S3</Text></View>
      </View>

      <TouchableOpacity style={styles.btnClear} onPress={handleClearUsers}>
        <Text style={styles.btnIcon}>🗑️</Text>
        <View style={styles.btnTextContainer}>
          <Text style={[styles.btnTitle, { color: '#e74c3c' }]}>Clear All Data</Text>
          <Text style={styles.btnSubtitle}>Fresh start ke liye</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.footer}>
        React Native · MediaPipe · TFLite · AWS{'\n'}
        NHAI Hackathon 7.0 — Team DataLake
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#1a1a2e' },
  container: {
    alignItems: 'center', padding: 24,
    paddingTop: 48, paddingBottom: 40,
  },
  header: { alignItems: 'center', marginBottom: 20 },
  logo: { fontSize: 56, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888' },
  hackathon: {
    fontSize: 11, color: '#6c63ff',
    fontWeight: '600', marginTop: 4,
    letterSpacing: 1,
  },

  networkBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, marginBottom: 20,
    borderWidth: 1, width: '100%', gap: 10,
  },
  networkOnline:  { backgroundColor: 'rgba(46,204,113,0.1)', borderColor: '#2ecc71' },
  networkOffline: { backgroundColor: 'rgba(231,76,60,0.1)',  borderColor: '#e74c3c' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  networkText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  lastSync: { color: '#888', fontSize: 11, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24, width: '100%' },
  statCard: {
    flex: 1, backgroundColor: '#16213e',
    borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  statWarn: { borderColor: '#f39c12' },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: '#6c63ff' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },

  btnPrimary: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    padding: 18, borderRadius: 14, backgroundColor: '#6c63ff',
    marginBottom: 12, gap: 12,
  },
  btnSecondary: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    padding: 18, borderRadius: 14, backgroundColor: '#16213e',
    borderWidth: 1, borderColor: '#6c63ff', marginBottom: 12, gap: 12,
  },
  btnSync: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    padding: 18, borderRadius: 14, backgroundColor: '#16213e',
    borderWidth: 1, borderColor: '#2ecc71', marginBottom: 16, gap: 12,
  },
  btnClear: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 14, backgroundColor: '#16213e',
    borderWidth: 1, borderColor: '#e74c3c', marginBottom: 16, gap: 12,
  },
  btnIcon: { fontSize: 26 },
  btnTextContainer: { flex: 1 },
  btnTitle: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  btnSubtitle: { color: '#888', fontSize: 12, marginTop: 2 },
  btnArrow: { color: '#6c63ff', fontSize: 22, fontWeight: 'bold' },

  badge: {
    backgroundColor: '#e74c3c',
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  techRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 8, marginBottom: 16, justifyContent: 'center',
  },
  techBadge: {
    backgroundColor: '#16213e', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: '#6c63ff',
  },
  techText: { color: '#6c63ff', fontSize: 11, fontWeight: '600' },

  footer: {
    color: '#444', fontSize: 11,
    marginTop: 8, textAlign: 'center', lineHeight: 18,
  },
});