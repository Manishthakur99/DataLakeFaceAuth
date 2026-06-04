import NetInfo from '@react-native-community/netinfo';
import { getPendingLogs, markSynced } from '../storage/database';

const AWS_CONFIG = {
  endpoint: 'https://httpbin.org/post',
  apiKey: 'your-api-key',
  region: 'ap-south-1',
};

export async function checkNetworkStatus() {
  try {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected === true,
      isInternetReachable: state.isInternetReachable !== false,
      type: state.type || 'unknown',
    };
  } catch (e) {
    return { isConnected: false, isInternetReachable: false, type: 'unknown' };
  }
}

async function uploadLog(log) {
  const response = await fetch(`${AWS_CONFIG.endpoint}/attendance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': AWS_CONFIG.apiKey,
    },
    body: JSON.stringify({
      logId:      log.id,
      userId:     log.user_id,
      userName:   log.user_name,
      confidence: log.confidence,
      timestamp:  log.timestamp,
      location:   log.location || 'field',
      liveness:   true,
      deviceInfo: 'React Native — Offline Auth',
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

export async function syncPendingLogs(onProgress) {
  try {
    const network = await checkNetworkStatus();
    if (!network.isConnected) {
      return { success: false, reason: 'No network', synced: 0, failed: 0 };
    }
    const pendingLogs = await getPendingLogs();
    if (!pendingLogs || pendingLogs.length === 0) {
      return { success: true, reason: 'Nothing to sync', synced: 0, failed: 0 };
    }
    let synced = 0, failed = 0;
    const results = [];
    for (const log of pendingLogs) {
      try {
        await uploadLog(log);
        await markSynced(log.id);
        synced++;
        results.push({ id: log.id, status: 'success' });
        console.log('✅ Synced:', log.id);
      } catch (e) {
        failed++;
        results.push({ id: log.id, status: 'failed', error: e.message });
        console.log('❌ Sync failed:', log.id, e.message);
      }
      if (onProgress) onProgress({ synced, failed, total: pendingLogs.length });
      await new Promise(r => setTimeout(r, 300));
    }
    return { success: true, synced, failed, results };
  } catch (e) {
    return { success: false, reason: e.message, synced: 0, failed: 0 };
  }
}

export function startAutoSync(onSyncComplete) {
  return NetInfo.addEventListener(async (state) => {
    try {
      if (state.isConnected === true) {
        console.log('🌐 Network connected — auto sync starting...');
        const result = await syncPendingLogs();
        if (onSyncComplete) onSyncComplete(result);
      }
    } catch (e) {
      console.log('Auto sync error:', e.message);
    }
  });
}