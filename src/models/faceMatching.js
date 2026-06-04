export function cosineSimilarity(a, b) {
  // NULL + TYPE CHECK
  if (!a || !b) return 0;
  
  // String hai to parse karo
  const arrA = typeof a === 'string' ? JSON.parse(a) : a;
  const arrB = typeof b === 'string' ? JSON.parse(b) : b;
  
  if (!Array.isArray(arrA) || !Array.isArray(arrB)) return 0;
  if (arrA.length === 0 || arrB.length === 0) return 0;

  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < arrA.length; i++) {
    dot += arrA[i] * arrB[i];
    na  += arrA[i] * arrA[i];
    nb  += arrB[i] * arrB[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function findBestMatch(liveEmbedding, storedUsers, threshold = 0.70) {
  if (!liveEmbedding || !storedUsers || storedUsers.length === 0) {
    return { matched: false, user: null, confidence: 0 };
  }

  // Live embedding bhi parse karo agar string hai
  const liveArr = typeof liveEmbedding === 'string' 
    ? JSON.parse(liveEmbedding) 
    : liveEmbedding;

  let bestScore = -1;
  let bestUser  = null;

  for (const user of storedUsers) {
    try {
      // DB se aaya embedding string hoga
      const storedArr = typeof user.embedding === 'string'
        ? JSON.parse(user.embedding)
        : user.embedding;

      const score = cosineSimilarity(liveArr, storedArr);
      console.log(`👤 ${user.name}: ${score.toFixed(4)}`);
      if (score > bestScore) {
        bestScore = score;
        bestUser  = user;
      }
    } catch(e) {
      console.warn('⚠️ Embedding parse error for', user.name, e.message);
    }
  }

  if (!bestUser) return { matched: false, user: null, confidence: 0 };
  
  console.log(`🏆 Best: ${bestUser?.name} = ${bestScore.toFixed(4)}`);
  return bestScore >= threshold
    ? { matched: true,  user: bestUser, confidence: bestScore }
    : { matched: false, user: bestUser, confidence: bestScore };
}