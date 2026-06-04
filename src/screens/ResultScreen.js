import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Animated, ScrollView
} from 'react-native';

export default function ResultScreen({ navigation, route }) {
  const {
    success, userId, confidence,
    photo, livenessChallenge, livenessPassed
  } = route.params || {};

  const percent   = confidence ? Math.round(confidence * 100) : 0;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1, tension: 50,
        friction: 7, useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>

      {/* Animated result icon */}
      <Animated.View style={[
        styles.iconContainer,
        success ? styles.iconSuccess : styles.iconFail,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        <Text style={styles.icon}>{success ? '✅' : '❌'}</Text>
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim, width: '100%', alignItems: 'center' }}>

        <Text style={styles.title}>
          {success ? 'Authentication Successful!' : 'Authentication Failed'}
        </Text>
        <Text style={styles.subtitle}>
          {success
            ? `Welcome, ${userId}! 👋`
            : 'Face match nahi hua — dobara try karo'}
        </Text>

        {/* Photo */}
        {photo && (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photo }} style={styles.photo} />
            {success && (
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeText}>✅ Verified</Text>
              </View>
            )}
          </View>
        )}

        {/* Result card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Authentication Report</Text>

          <Row
            label="Status"
            value={success ? '✅ Verified' : '❌ Rejected'}
            valueColor={success ? '#2ecc71' : '#e74c3c'}
          />
          <Row label="User" value={userId || 'Unknown'} />
          <Row
            label="Confidence"
            value={`${percent}%`}
            valueColor={percent > 85 ? '#2ecc71' : percent > 60 ? '#f39c12' : '#e74c3c'}
          />
          <Row
            label="Liveness"
            value={livenessPassed ? '✅ Passed' : '❌ Failed'}
            valueColor={livenessPassed ? '#2ecc71' : '#e74c3c'}
          />
          <Row label="Challenge" value={livenessChallenge || 'N/A'} />
          <Row label="Mode" value="🔌 Fully Offline" />
          <Row label="AI Engine" value="MediaPipe + Landmarks" />
          <Row label="Timestamp" value={new Date().toLocaleTimeString()} />
        </View>

        {/* Confidence bar */}
        <View style={styles.confBar}>
          <Text style={styles.confLabel}>Match Confidence</Text>
          <View style={styles.confTrack}>
            <Animated.View style={[
              styles.confFill,
              {
                width: `${Math.min(percent, 100)}%`,
                backgroundColor: percent > 85 ? '#2ecc71' : percent > 60 ? '#f39c12' : '#e74c3c',
              }
            ]} />
          </View>
          <Text style={styles.confPercent}>{percent}%</Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.btnText}>🏠 Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.navigate('Auth')}
        >
          <Text style={styles.btnText}>🔄 Try Again</Text>
        </TouchableOpacity>

      </Animated.View>
    </ScrollView>
  );
}

function Row({ label, value, valueColor }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#1a1a2e' },
  container: {
    alignItems: 'center', padding: 24,
    paddingTop: 48, paddingBottom: 40,
  },

  iconContainer: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  iconSuccess: { backgroundColor: 'rgba(46,204,113,0.15)', borderWidth: 2, borderColor: '#2ecc71' },
  iconFail:    { backgroundColor: 'rgba(231,76,60,0.15)',  borderWidth: 2, borderColor: '#e74c3c' },
  icon: { fontSize: 48 },

  title: {
    fontSize: 22, fontWeight: 'bold',
    color: '#ffffff', marginBottom: 6, textAlign: 'center',
  },
  subtitle: {
    fontSize: 14, color: '#888',
    marginBottom: 20, textAlign: 'center',
  },

  photoContainer: {
    position: 'relative', marginBottom: 20,
  },
  photo: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: '#6c63ff',
  },
  photoBadge: {
    position: 'absolute', bottom: -8, left: 0, right: 0,
    alignItems: 'center',
  },
  photoBadgeText: {
    backgroundColor: '#2ecc71', color: '#fff',
    fontSize: 11, fontWeight: 'bold',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8,
  },

  card: {
    width: '100%', backgroundColor: '#16213e',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#333', marginBottom: 16,
  },
  cardTitle: {
    color: '#6c63ff', fontSize: 14,
    fontWeight: '700', marginBottom: 12,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a4a',
  },
  rowLabel: { color: '#888', fontSize: 13 },
  rowValue: { color: '#ffffff', fontSize: 13, fontWeight: '600' },

  confBar: {
    width: '100%', marginBottom: 24,
  },
  confLabel: { color: '#888', fontSize: 12, marginBottom: 6 },
  confTrack: {
    width: '100%', height: 8, backgroundColor: '#16213e',
    borderRadius: 4, overflow: 'hidden', marginBottom: 4,
  },
  confFill: { height: '100%', borderRadius: 4 },
  confPercent: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'right' },

  btnPrimary: {
    width: '100%', padding: 16, borderRadius: 12,
    backgroundColor: '#6c63ff', alignItems: 'center', marginBottom: 12,
  },
  btnSecondary: {
    width: '100%', padding: 16, borderRadius: 12,
    backgroundColor: '#16213e', borderWidth: 1,
    borderColor: '#6c63ff', alignItems: 'center',
  },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});