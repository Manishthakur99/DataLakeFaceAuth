import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getAllUsers, logAttendance } from '../storage/database';
import { cosineSimilarity } from '../models/faceMatching';
import FaceProcessor from './FaceProcessor';
import * as ImageManipulator from 'expo-image-manipulator';

const CHALLENGES = [
  { id: 'blink', emoji: '👁️', text: 'Blink karo 2 baar', instruction: 'Dono aankhein band karke kholo' },
  { id: 'smile', emoji: '😄', text: 'Smile karo',         instruction: 'Daant dikha ke smile karo' },
  { id: 'nod',   emoji: '🙆', text: 'Sar hilao',           instruction: 'Haan mein sar hilao' },
];

export default function AuthScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep]             = useState('idle');
  const [challenge, setChallenge]   = useState(null);
  const [countdown, setCountdown]   = useState(3);
  const [statusMsg, setStatusMsg]   = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [livenessStatus, setLivenessStatus] = useState('');
  const [blinkCount, setBlinkCount] = useState(0);

  const cameraRef         = useRef(null);
  const faceProcessorRef  = useRef(null);
  const embeddingRef      = useRef(null);
  const frameInterval     = useRef(null);
  const isCapturing       = useRef(false);
  const pulseAnim         = useRef(new Animated.Value(1)).current;
  const livenessPassedRef = useRef(false);
  const blinkCountRef     = useRef(0);
  const challengeRef      = useRef(null);

  useEffect(() => {
    const c = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    setChallenge(c); challengeRef.current = c;
  }, []);

  useEffect(() => {
    if (step === 'challenge') {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 700, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [step]);

  useEffect(() => {
    if (step !== 'capturing') return;
    if (countdown === 0) { captureAndVerify(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [step, countdown]);

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
        if (resized.base64) faceProcessorRef.current.sendFrame(resized.base64);
      } catch (e) {
        console.log('Frame err:', e.message);
      } finally {
        isCapturing.current = false;
      }
    }, 2000);
  };

  const handleFaceData = (data) => {
  if (data.type === 'FACE_DATA') {
    setFaceDetected(true);
    embeddingRef.current = data.embedding;
    const { landmarks } = data;

    // Blink count update karo
    if (landmarks.blinkDetected) {
      blinkCountRef.current += 1;
      setBlinkCount(blinkCountRef.current);
      console.log('👁️ Blink detected! Count:', blinkCountRef.current);
    }

    if (!livenessPassedRef.current && challengeRef.current) {
      const ch = challengeRef.current;

      if (ch.id === 'blink') {
        // 2 ki jagah 1 blink kaafi hai
        if (blinkCountRef.current >= 1) {
          livenessPassedRef.current = true;
          setLivenessPassed(true);
          setLivenessStatus('✅ Blink detected!');
        }
      } else if (ch.id === 'smile') {
        // MAR threshold kam karo — 0.08 pe detect ho
        if (landmarks.smiling || landmarks.mar > 0.08) {
          livenessPassedRef.current = true;
          setLivenessPassed(true);
          setLivenessStatus('✅ Smile detected!');
        }
      } else if (ch.id === 'nod') {
        // Nod — 10 frames pe pass kar do
        if (landmarks.frameCount >= 10) {
          livenessPassedRef.current = true;
          setLivenessPassed(true);
          setLivenessStatus('✅ Movement detected!');
        }
      }
    }
  } else if (data.type === 'NO_FACE') {
    setFaceDetected(false);
  }
};

  const startChallenge = () => {
    livenessPassedRef.current = false;
    blinkCountRef.current     = 0;
    setBlinkCount(0);
    setLivenessPassed(false);
    setLivenessStatus('');
    faceProcessorRef.current?.resetBlink();

    const c = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    setChallenge(c); challengeRef.current = c;
    setStep('challenge');

    setTimeout(() => { setStep('capturing'); setCountdown(3); }, 5000);
  };

  const captureAndVerify = async () => {
    if (!cameraRef.current) return;
    clearInterval(frameInterval.current);
    try {
      setStatusMsg('📸 Photo le rahe hain...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8, base64: false, exif: false,
      });

      setStep('verifying');
      setStatusMsg('🔍 Face match kar rahe hain...');

      if (!livenessPassedRef.current) {
        setStep('idle');
        Alert.alert('❌ Liveness Failed', `Challenge complete nahi hua!\n${challenge?.text}`, [{ text: 'Try Again' }]);
        startFrameLoop();
        return;
      }

      const users = await getAllUsers();
      if (users.length === 0) {
        Alert.alert('⚠️ No Users', 'Pehle register karo!',
          [{ text: 'Register', onPress: () => navigation.navigate('Enroll') }]
        );
        setStep('idle'); startFrameLoop(); return;
      }

      const liveEmbedding = embeddingRef.current;
      if (!liveEmbedding) {
        Alert.alert('⚠️ Error', 'Face embedding nahi mili');
        setStep('idle'); startFrameLoop(); return;
      }

      let bestScore = -1, bestUser = null;
      for (const user of users) {
        const score = cosineSimilarity(liveEmbedding, user.embedding);
        console.log(`👤 ${user.name}: ${score.toFixed(4)}`);
        if (score > bestScore) { bestScore = score; bestUser = user; }
      }

      console.log(`🏆 Best: ${bestUser?.name} = ${bestScore.toFixed(4)}`);
      const matched = bestScore >= 0.75;

      if (matched) await logAttendance(bestUser.id, bestUser.name, bestScore);

      setStep('done');
      setTimeout(() => {
        navigation.navigate('Result', {
          success: matched,
          userId:  matched ? bestUser.name : 'Unknown',
          confidence: bestScore,
          photo: photo.uri,
          livenessChallenge: challenge?.text,
          livenessPassed: livenessPassedRef.current,
        });
        setStep('idle');
        const c = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
        setChallenge(c); challengeRef.current = c;
        startFrameLoop();
      }, 400);

    } catch (e) {
      Alert.alert('❌ Error', e.message);
      setStep('idle'); startFrameLoop();
    }
  };

  const onCameraReady = () => {
  console.log('📷 Camera ready');
  setTimeout(startFrameLoop, 1000);
};

  if (!permission) return <View style={styles.container}><Text style={styles.subtitle}>Loading...</Text></View>;
  if (!permission.granted) {
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
      <FaceProcessor
        ref={faceProcessorRef}
        onFaceData={handleFaceData}
        onReady={() => console.log('✅ MediaPipe Auth ready')}
      />

      <Text style={styles.title}>✅ Face Authentication</Text>

      <View style={styles.statusBar}>
        {['idle','challenge','capturing','verifying'].map((s, i) => (
          <React.Fragment key={s}>
            <View style={[styles.stepDot, ['challenge','capturing','verifying','done'].indexOf(step) >= i && styles.stepDotActive]} />
            {i < 3 && <View style={styles.stepLine} />}
          </React.Fragment>
        ))}
      </View>
      <Text style={styles.stepLabel}>
        {step === 'idle' ? '① Ready' : step === 'challenge' ? '② Liveness' : step === 'capturing' ? '③ Capturing' : step === 'verifying' ? '④ Verifying' : '✅ Done'}
      </Text>

      <View style={[styles.faceStatus, faceDetected ? styles.faceGood : styles.faceBad]}>
        <Text style={styles.faceStatusText}>{faceDetected ? '✅ Face detected' : '❌ No face detected'}</Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView 
  ref={cameraRef} 
  style={styles.camera} 
  facing="front"
  onCameraReady={onCameraReady}
/>
        <View style={styles.overlay} pointerEvents="none">
          <Animated.View style={[
            styles.faceGuide,
            faceDetected && styles.guideDetected,
            step === 'challenge' && styles.guideChallenge,
            step === 'capturing' && styles.guideCapturing,
            step === 'challenge' && { transform: [{ scale: pulseAnim }] },
          ]} />
          {step === 'capturing' && (
            <View style={styles.countdownBubble}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          )}
          {step === 'verifying' && (
            <View style={styles.countdownBubble}>
              <Text style={styles.countdownText}>🔍</Text>
            </View>
          )}
        </View>
      </View>

      {challenge && step === 'challenge' && (
        <View style={[styles.challengeBox, livenessPassed && styles.challengePassed]}>
          <Text style={styles.challengeEmoji}>{challenge.emoji}</Text>
          <Text style={styles.challengeText}>{challenge.text}</Text>
          <Text style={styles.challengeHint}>{challenge.instruction}</Text>
          {livenessPassed && <Text style={styles.livenessOk}>{livenessStatus}</Text>}
          {challenge.id === 'blink' && <Text style={styles.blinkCount}>Blinks: {blinkCount}/2</Text>}
        </View>
      )}

      {statusMsg !== '' && step === 'verifying' && <Text style={styles.statusMsg}>{statusMsg}</Text>}

      {step === 'idle' && (
        <TouchableOpacity
          style={[styles.btnPrimary, !faceDetected && styles.btnDisabled]}
          onPress={startChallenge}
          disabled={!faceDetected}
        >
          <Text style={styles.btnText}>{faceDetected ? '🚀 Start Verification' : '⏳ Face detect hone do...'}</Text>
        </TouchableOpacity>
      )}

      {(step === 'challenge' || step === 'capturing' || step === 'verifying') && (
        <View style={styles.waitBox}>
          <Text style={styles.waitText}>
            {step === 'challenge' ? `⏳ ${challenge?.text}` : step === 'capturing' ? `📸 ${countdown}s...` : '🔄 Matching...'}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.goBack()}>
        <Text style={styles.btnText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', padding: 20, paddingTop: 32 },
  title:    { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#888' },
  statusBar:     { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stepDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: '#333' },
  stepDotActive: { backgroundColor: '#6c63ff' },
  stepLine:      { width: 36, height: 2, backgroundColor: '#333', marginHorizontal: 4 },
  stepLabel:     { fontSize: 12, color: '#888', marginBottom: 8 },
  faceStatus: { width: '100%', padding: 8, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  faceGood: { backgroundColor: 'rgba(46,204,113,0.15)', borderWidth: 1, borderColor: '#2ecc71' },
  faceBad:  { backgroundColor: 'rgba(231,76,60,0.15)',  borderWidth: 1, borderColor: '#e74c3c' },
  faceStatusText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cameraContainer: { width: 250, height: 300, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#6c63ff', marginBottom: 10, position: 'relative' },
  camera:  { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  faceGuide:     { width: 170, height: 220, borderRadius: 85, borderWidth: 2, borderColor: 'rgba(108,99,255,0.6)', borderStyle: 'dashed' },
  guideDetected: { borderColor: '#2ecc71' },
  guideChallenge:{ borderColor: '#f39c12', borderStyle: 'solid' },
  guideCapturing:{ borderColor: '#2ecc71', borderStyle: 'solid' },
  countdownBubble: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.65)', width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  countdownText: { fontSize: 28, fontWeight: 'bold', color: '#2ecc71' },
  challengeBox:   { width: '100%', padding: 12, borderRadius: 12, backgroundColor: '#16213e', borderWidth: 1, borderColor: '#f39c12', marginBottom: 8, alignItems: 'center' },
  challengePassed:{ borderColor: '#2ecc71' },
  challengeEmoji: { fontSize: 28, marginBottom: 4 },
  challengeText:  { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
  challengeHint:  { fontSize: 12, color: '#888' },
  livenessOk:     { fontSize: 13, color: '#2ecc71', fontWeight: '600', marginTop: 4 },
  blinkCount:     { fontSize: 12, color: '#f39c12', marginTop: 4 },
  statusMsg: { color: '#3498db', fontSize: 14, marginBottom: 8, fontWeight: '600' },
  waitBox:  { width: '100%', padding: 12, borderRadius: 12, backgroundColor: '#16213e', alignItems: 'center', marginBottom: 8 },
  waitText: { fontSize: 14, color: '#6c63ff', fontWeight: '600' },
  btnPrimary:   { width: '100%', padding: 16, borderRadius: 12, backgroundColor: '#6c63ff', alignItems: 'center', marginBottom: 10 },
  btnSecondary: { width: '100%', padding: 16, borderRadius: 12, backgroundColor: '#16213e', borderWidth: 1, borderColor: '#6c63ff', alignItems: 'center' },
  btnDisabled:  { backgroundColor: '#444' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});