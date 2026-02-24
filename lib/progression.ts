import { db } from './firebase';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';

export const MAX_LEVEL = 150;
export const XP_PER_LEVEL = 1000;

export const calculateLevel = (xpValue: number) => {
  return Math.min(MAX_LEVEL, Math.floor(xpValue / XP_PER_LEVEL) + 1);
};

export const addXP = async (userId: string, amount: number) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const data = userSnap.data();
      const currentXP = data.xp || 0;
      const newXP = currentXP + amount;
      const newLevel = calculateLevel(newXP);
      
      const updates: any = {
        xp: increment(amount),
      };
      
      if (newLevel > (data.level || 1)) {
        updates.level = newLevel;
        // Optional: Trigger level up notification or effect
      }
      
      await updateDoc(userRef, updates);
      return { newXP: currentXP + amount, newLevel };
    }
  } catch (err) {
    console.error("Error adding XP:", err);
  }
  return null;
};
