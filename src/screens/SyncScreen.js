import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getPendingLogs, getStats, getAllLogs } from '../storage/database';
import { syncPendingLogs, checkNetworkStatus } from '../sync/awsSync';

export default function SyncScreen({ navigation }) {
  const [pendingLogs, setPendingLogs]   = useState([]);
  const [allLogs, setAllLogs]           = useState([]);
  const [stats, setStats]               = useState({});
  const [syncing, setSyncing]           = useState(false);
  const [syncResults, setSyncResults]   = useState([]);
  const [network, setNetwork]           = useState({ isConnected: false });
  const [progress, setProgress]         = useState(null);

  const loadData = async () => {
    const [pending, logs, s, net] = await Promise.all([
      getPendingLogs(),
      getAllLogs(),
      getStats(),
      checkNetworkStatus(),
    ]);
    setPendingLogs(pending);
    setAllLogs(logs);
    setStats(s);
    setNetwork(net);
  };

  useFocusEffect(
    useCallback(() => { loadData(); }, [])
  );

  const handleSync = async () => {
    if (!network.isConnected) {
      Alert.alert(
        '📵 Offline',
        'Network nahi hai — connect hone pe auto sync hoga',
        [{ text: 'OK' }]
      );
      return;
    }

    setSyncing(true);
    setSyncResults([]);
    setProgress(null);

    const result = await syncPendingLogs((prog) => {
      setProgress(prog);
    });

    setSyncing(false);
    await loadData();

    if (result.synced > 0) {
      Alert.alert(
        '✅ Sync Complete!',
        `${result.synced} records AWS pe upload ho gaye!\n${result.failed > 0 ? `${result.failed} failed` : 'Sab successful!'}`,
      );
    } else {
      Alert.alert('ℹ️ Info', result.reason || 'Kuch sync nahi hua');
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>☁️ AWS Sync Dashboard</Text>

      {/* Network status */}
      <View style={[styles.networkCard, network.isConnected ? styles.networkOnline : styles.networkOffline]}>
        <View style={[styles.dot, { backgroundColor: network.isConnected ? '#2ecc71' : '#e74c3c' }]} />
        <View>
          <Text style={styles.networkTitle}>
            {network.isConnected ? '🌐 Online' : '📵 Offline'}
          </Text>
          <Text style={styles.networkSub}>
            {network.isConnected
              ? 'AWS sync available'
              : 'Data local mein safe — sync hoga reconnect pe'}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{stats.totalLogs || 0}</Text>
          <Text style={styles.statLabel}>Total Logs</Text>
        </View>
        <View style={[styles.statCard, pendingLogs.length > 0 && styles.statWarn]}>
          <Text style={[styles.statNum, { color: '#f39c12' }]}>{pendingLogs.length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: '#2ecc71' }]}>
            {(stats.totalLogs || 0) - pendingLogs.length}
          </Text>
          <Text style={styles.statLabel}>Synced</Text>
        </View>
      </View>

      {/* Progress */}
      {progress && (
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>📤 Syncing...</Text>
          <View style={styles.progressTrack}>
            <View style={[
              styles.progressFill,
              { width: `${(progress.synced / progress.total) * 100}%` }
            ]} />
          </View>
          <Text style={styles.progressText}>
            {progress.synced}/{progress.total} uploaded
          </Text>
        </View>
      )}

      {/* Pending logs */}
      {pendingLogs.length > 0 ? (
        <View style={styles.logCard}>
          <Text style={styles.logCardTitle}>⏳ Pending Records ({pendingLogs.length})</Text>
          {pendingLogs.slice(0, 10).map((log) => (
            <View key={log.id} style={styles.logItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logId}>{log.id}</Text>
                <Text style={styles.logMeta}>
                  👤 {log.user_name || log.user_id} · {log.timestamp?.split('T')[0]}
                </Text>
                <Text style={styles.logMeta}>
                  Confidence: {log.confidence ? Math.round(log.confidence * 100) : 0}%
                </Text>
              </View>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyText}>Sab records synced hain!</Text>
        </View>
      )}

      {/* Recent logs */}
      {allLogs.length > 0 && (
        <View style={styles.logCard}>
          <Text style={styles.logCardTitle}>📋 Recent Attendance ({allLogs.length})</Text>
          {allLogs.slice(0, 8).map((log) => (
            <View key={log.id} style={styles.logItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logId}>👤 {log.user_name || log.user_id}</Text>
                <Text style={styles.logMeta}>{log.timestamp}</Text>
                <Text style={styles.logMeta}>
                  Match: {log.confidence ? Math.round(log.confidence * 100) : 0}%
                </Text>
              </View>
              <View style={[
                styles.syncedBadge,
                log.synced ? styles.syncedGood : styles.syncedPending
              ]}>
                <Text style={styles.syncedText}>
                  {log.synced ? '☁️ Synced' : '⏳ Pending'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Sync button */}
      <TouchableOpacity
        style={[styles.btnSync, syncing && styles.btnDisabled]}
        onPress={handleSync}
        disabled={syncing}
      >
        {syncing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>
            {network.isConnected
              ? `☁️ Sync ${pendingLogs.length} Records to AWS`
              : '📵 Offline — Cannot Sync'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
        <Text style={styles.btnText}>← Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#1a1a2e' },
  container: { padding: 24, paddingTop: 40, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 16, textAlign: 'center' },

  networkCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 12,
    borderWidth: 1, marginBottom: 16, gap: 12,
  },
  networkOnline: { backgroundColor: 'rgba(46,204,113,0.1)', borderColor: '#2ecc71' },
  networkOffline: { backgroundColor: 'rgba(231,76,60,0.1)', borderColor: '#e74c3c' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  networkTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  networkSub: { color: '#888', fontSize: 12, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: '#16213e',
    borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  statWarn: { borderColor: '#f39c12' },
  statNum: { fontSize: 26, fontWeight: 'bold', color: '#6c63ff' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },

  progressCard: {
    backgroundColor: '#16213e', borderRadius: 12,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#6c63ff',
  },
  progressTitle: { color: '#6c63ff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  progressTrack: {
    height: 8, backgroundColor: '#333',
    borderRadius: 4, overflow: 'hidden', marginBottom: 6,
  },
  progressFill: { height: '100%', backgroundColor: '#6c63ff', borderRadius: 4 },
  progressText: { color: '#888', fontSize: 12 },

  logCard: {
    backgroundColor: '#16213e', borderRadius: 12,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#333',
  },
  logCardTitle: { color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  logItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a4a',
  },
  logId: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logMeta: { color: '#666', fontSize: 11, marginTop: 2 },
  pendingBadge: {
    backgroundColor: 'rgba(243,156,18,0.15)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: '#f39c12',
  },
  pendingText: { color: '#f39c12', fontSize: 11, fontWeight: '600' },
  syncedBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  syncedGood: { backgroundColor: 'rgba(46,204,113,0.1)', borderColor: '#2ecc71' },
  syncedPending: { backgroundColor: 'rgba(243,156,18,0.1)', borderColor: '#f39c12' },
  syncedText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  emptyCard: {
    alignItems: 'center', paddingVertical: 32,
    marginBottom: 16,
  },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { color: '#888', fontSize: 15 },

  btnSync: {
    width: '100%', padding: 16, borderRadius: 12,
    backgroundColor: '#2ecc71', alignItems: 'center', marginBottom: 12,
  },
  btnBack: {
    width: '100%', padding: 16, borderRadius: 12,
    backgroundColor: '#16213e', borderWidth: 1,
    borderColor: '#6c63ff', alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#444' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});