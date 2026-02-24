"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  deleteDoc, 
  doc, 
  Timestamp 
} from 'firebase/firestore';

const NAMES = ["أحمد", "محمد", "سارة", "ليلى", "عمر", "ياسين", "نور", "مريم", "زياد", "يوسف", "لينا", "خالد", "هدى", "كريم", "علي", "فاطمة"];
const SURNAMES = ["أ.", "م.", "ك.", "س.", "هـ.", "ع.", "ب.", "ط.", "ي.", "ز."];

export default function WinnerTicker() {
  const [latestWinner, setLatestWinner] = useState<{name: string, amount: number} | null>(null);

  useEffect(() => {
    // Listen for the latest winner
    const q = query(collection(db, 'latest_winners'), orderBy('createdAt', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setLatestWinner({
          name: data.name,
          amount: data.amount
        });
      }
    });

    // Strategy: Every 15 seconds, check if we need to generate a new winner
    // We only generate if the last one is older than 15 seconds OR if none exist
    const interval = setInterval(async () => {
      const qCheck = query(collection(db, 'latest_winners'), orderBy('createdAt', 'desc'), limit(1));
      const snap = await getDocs(qCheck);
      
      let shouldAdd = false;
      if (snap.empty) {
        shouldAdd = true;
      } else {
        const lastCreated = snap.docs[0].data().createdAt as Timestamp;
        if (lastCreated) {
          const diff = Date.now() - lastCreated.toMillis();
          if (diff >= 15000) {
            shouldAdd = true;
          }
        }
      }

      if (shouldAdd) {
        const randomName = `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${SURNAMES[Math.floor(Math.random() * SURNAMES.length)]}`;
        const randomAmount = Math.floor(Math.random() * 45000) + 5000;
        
        await addDoc(collection(db, 'latest_winners'), {
          name: randomName,
          amount: randomAmount,
          createdAt: serverTimestamp()
        });

        // Check for cleanup (if count > 100)
        const allSnap = await getDocs(collection(db, 'latest_winners'));
        if (allSnap.size > 100) {
          // Sort manually or perform a query to find oldest
          const sortedDocs = allSnap.docs.sort((a, b) => 
            (b.data().createdAt?.toMillis() || 0) - (a.data().createdAt?.toMillis() || 0)
          );
          
          // Keep top 100, delete others
          const toDelete = sortedDocs.slice(100);
          for (const d of toDelete) {
            await deleteDoc(doc(db, 'latest_winners', d.id));
          }
        }
      }
    }, 15000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  if (!latestWinner) {
    return (
      <div className="flex items-center gap-3 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-gray-800"></div>
        <div className="h-4 w-32 bg-gray-800 rounded"></div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-10 duration-500">
      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(34,197,94,0.3)]">🏆</div>
      <div>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">آخر فائز الآن</p>
        <p className="text-sm font-black text-[#FFD700] drop-shadow-[0_0_5px_#D4AF37]">
          {latestWinner.name} ربح +{latestWinner.amount.toLocaleString()} ج.م
        </p>
      </div>
    </div>
  );
}
