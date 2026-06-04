import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { enrollUser } from '../storage/database';
import FaceProcessor from './FaceProcessor';
import * as ImageManipulator from 'expo-image-manipulator';

export default function EnrollScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [name, setName]             = useState('');
  const [step, setStep]             = useState('name');
  const [loading, setLoading]       = useState(false);
  const [statusMsg, setStatusMsg]   = useState('');
  const [faceDetected, setFaceDetected] = useState(false);

  const cameraRef        = useRef(null);
  const faceProcessorRef = useRef(null);
  const embeddingRef     = useRef(null);
  const frameInterval    = useRef(null);
  const isCapturing      = useRef(false);

  const handleFaceData = (data) => {
    if (data.type === 'FACE_DATA') {
      setFaceDetected(true);
      embeddingRef.current = data.embedding;
    } else if (data.type === 'NO_FACE') {
      setFaceDetected(false);
    }
  };

  const startFrameLoop = () => {
    if (frameInterval.current) clearInterval(frameInterval.current);
    frameInterval.current = setInterval(async () => {
      if (isCapturing.current) return;
      if (!cameraRef.current || !faceProcessorRef.current) return;
      isCapturing.current = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.4, base64: false, exif: false, skipProcessing: true,
        });
        const resized = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 224 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        if (resized.base64) {
          faceProcessorRef.current.sendFrame(resized.base64);
        }
      } catch (e) {
        console.log('Frame err:', e.message);
      } finally {
        isCapturing.current = false;
      }
    }, 500);
  };

  useEffect(() => {
    if (step === 'camera') {
      setTimeout(startFrameLoop, 1000);
    } else {
      clearInterval(frameInterval.current);
      frameInterval.current = null;
    }
    return () => clearInterval(frameInterval.current);
  }, [step]);

  const onCameraReady = () => {
    console.log('📷 Camera ready');
  };

  const proceedToCamera = () => {
    if (!name.trim()) {
      Alert.alert('⚠️ Name required', 'Apna naam enter karo');
      return;
    }
    setFaceDetected(false);
    embeddingRef.current = null;
    setStep('camera');
  };

  const takePicture = async () => {
    if (!embeddingRef.current) {
      Alert.alert('⚠️ Face not detected', 'Camera ke saamne aao');
      return;
    }
    clearInterval(frameInterval.current);
    setLoading(true);
    setStatusMsg('📸 Photo le rahe hain...');
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8, base64: false, exif: false,
      });
      setStatusMsg('💾 Saving...');
      const userId = await enrollUser(name.trim(), embeddingRef.current, photo.uri);
      setLoading(false);
      Alert.alert('✅ Registered!', `${name} register ho gaya!\nID: ${userId}`,
        [{ text: 'Home', onPress: () => navigation.navigate('Home') }]
      );
    } catch (e) {
      setLoading(false);
      Alert.alert('❌ Error', e.message);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>📷 Camera Permission</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* FaceProcessor HAMESHA mounted */}
      <FaceProcessor
        ref={faceProcessorRef}
        onFaceData={handleFaceData}
        onReady={() => console.log('✅ MediaPipe ready')}
      />

      {step === 'name' ? (
        <KeyboardAvoidingView
          style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Text style={styles.logo}>👤</Text>
          <Text style={styles.title}>Register New User</Text>
          <Text style={styles.subtitle}>Pehle naam likho, phir face scan hoga</Text>
          <TextInput
            style={styles.input}
            placeholder="Full name (e.g. Ramesh Kumar)"
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={proceedToCamera}
          />
          <TouchableOpacity style={styles.btnPrimary} onPress={proceedToCamera}>
            <Text style={styles.btnText}>Next → Open Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.goBack()}>
            <Text style={styles.btnText}>← Back</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      ) : (
        <>
          <Text style={styles.title}>📷 Scan Face</Text>
          <Text style={styles.subtitle}>
            Registering: <Text style={{ color: '#6c63ff', fontWeight: 'bold' }}>{name}</Text>
          </Text>

          <View style={[styles.faceStatus, faceDetected ? styles.faceStatusGood : styles.faceStatusBad]}>
            <Text style={styles.faceStatusText}>
              {faceDetected ? '✅ Face detected — ready!' : '❌ No face — camera ke saamne aao'}
            </Text>
          </View>

          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="front"
              onCameraReady={onCameraReady}
            />
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
              <View style={[styles.faceGuide, faceDetected && styles.faceGuideActive]} />
            </View>
          </View>

          <View style={styles.tipsBox}>
            <Text style={styles.tipsTitle}>💡 Tips:</Text>
            <Text style={styles.tipsText}>• Seedha camera ki taraf dekho</Text>
            <Text style={styles.tipsText}>• Achhi lighting mein kharo</Text>
            <Text style={styles.tipsText}>• Chehra oval ke andar rakho</Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#6c63ff" size="large" />
              <Text style={styles.statusMsg}>{statusMsg}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.btnPrimary, !faceDetected && styles.btnDisabled]}
              onPress={takePicture}
              disabled={!faceDetected}
            >
              <Text style={styles.btnText}>
                {faceDetected ? '📸 Capture & Register' : '⏳ Face detect hone do...'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep('name')} disabled={loading}>
            <Text style={styles.btnText}>← Change Name</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', padding: 24, paddingTop: 40 },
  logo:     { fontSize: 56, marginBottom: 8 },
  title:    { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#888', marginBottom: 12, textAlign: 'center' },
  faceStatus: { width: '100%', padding: 10, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  faceStatusGood: { backgroundColor: 'rgba(46,204,113,0.15)', borderWidth: 1, borderColor: '#2ecc71' },
  faceStatusBad:  { backgroundColor: 'rgba(231,76,60,0.15)',  borderWidth: 1, borderColor: '#e74c3c' },
  faceStatusText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  input: {
    width: '100%', padding: 16, borderRadius: 12,
    backgroundColor: '#16213e', color: '#ffffff',
    fontSize: 16, borderWidth: 1, borderColor: '#6c63ff', marginBottom: 20,
  },
  cameraContainer: {
    width: 260, height: 300, borderRadius: 20,
    overflow: 'hidden', borderWidth: 2,
    borderColor: '#6c63ff', marginBottom: 12, position: 'relative',
  },
  camera:  { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  faceGuide: { width: 180, height: 230, borderRadius: 90, borderWidth: 2, borderColor: 'rgba(108,99,255,0.6)', borderStyle: 'dashed' },
  faceGuideActive: { borderColor: '#2ecc71', borderStyle: 'solid' },
  cornerTL: { position: 'absolute', top: 12, left: 12,   width: 20, height: 20, borderTopWidth: 3,    borderLeftWidth: 3,  borderColor: '#6c63ff', borderTopLeftRadius: 4 },
  cornerTR: { position: 'absolute', top: 12, right: 12,  width: 20, height: 20, borderTopWidth: 3,    borderRightWidth: 3, borderColor: '#6c63ff', borderTopRightRadius: 4 },
  cornerBL: { position: 'absolute', bottom: 12, left: 12,  width: 20, height: 20, borderBottomWidth: 3, borderLeftWidth: 3,  borderColor: '#6c63ff', borderBottomLeftRadius: 4 },
  cornerBR: { position: 'absolute', bottom: 12, right: 12, width: 20, height: 20, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#6c63ff', borderBottomRightRadius: 4 },
  tipsBox:  { width: '100%', backgroundColor: '#16213e', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#333', marginBottom: 12 },
  tipsTitle:{ color: '#6c63ff', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  tipsText: { color: '#888', fontSize: 12, marginBottom: 2 },
  loadingBox: { alignItems: 'center', marginBottom: 12, gap: 8 },
  statusMsg:  { color: '#6c63ff', fontSize: 14, fontWeight: '600' },
  btnPrimary: { width: '100%', padding: 16, borderRadius: 12, backgroundColor: '#6c63ff', alignItems: 'center', marginBottom: 10 },
  btnSecondary: { width: '100%', padding: 16, borderRadius: 12, backgroundColor: '#16213e', borderWidth: 1, borderColor: '#6c63ff', alignItems: 'center' },
  btnDisabled: { backgroundColor: '#444' },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});