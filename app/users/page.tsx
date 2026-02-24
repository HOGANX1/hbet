"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection,
  query,
  getDocs,
  doc, 
  where, 
  addDoc, 
  serverTimestamp, 
  limit,
  updateDoc,
  arrayUnion,
  getDoc,
  onSnapshot,
  writeBatch,
  increment,
  Timestamp
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import Link from 'next/link';

interface User {
  id: string;
  kingdomId?: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  level?: number;
}

interface Notification {
  id: string;
  senderId: string;
  recipientId: string;
  title: string;
  message: string;
  type: string;
  status: 'unread' | 'read';
  createdAt: Timestamp;
  senderName?: string;
  senderPhoto?: string;
}

export default function UsersSearchPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<Notification[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<string[]>([]);
  const [myFriends, setMyFriends] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = useState('');

  const showStatus = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const searchUsers = useCallback(async (term: string) => {
    if (!term.trim() || !user) {
      setUsers([]);
      return;
    }
    setLoading(true);
    try {
      const resultsMap = new Map<string, User>();

      // 1. Search by exact UID (Knowledge)
      try {
        const userDoc = await getDoc(doc(db, 'users', term));
        if (userDoc.exists()) {
          resultsMap.set(userDoc.id, { id: userDoc.id, ...userDoc.data() } as User);
        }
      } catch { }

      // 2. Search by exact Email
      const emailQ = query(collection(db, 'users'), where('email', '==', term), limit(5));
      const emailSnap = await getDocs(emailQ);
      emailSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() } as User));

      // 3. Search by exact Kingdom ID
      const kingdomQ = query(collection(db, 'users'), where('kingdomId', '==', term), limit(5));
      const kingdomSnap = await getDocs(kingdomQ);
      kingdomSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() } as User));

      // 4. Search by Name (Prefix)
      const nameQ = query(
        collection(db, 'users'),
        where('displayName', '>=', term),
        where('displayName', '<=', term + '\uf8ff'),
        limit(10)
      );
      const nameSnap = await getDocs(nameQ);
      nameSnap.docs.forEach(d => resultsMap.set(d.id, { id: d.id, ...d.data() } as User));
      
      const found = Array.from(resultsMap.values());
      
      // Filter out current user
      setUsers(found.filter(u => u.id !== user.uid));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    // Listen for incoming and outgoing requests, and current friends
    const incomingQ = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      where('type', '==', 'friend_request'),
      where('status', '==', 'unread')
    );
    const unsubIncoming = onSnapshot(incomingQ, (snap) => {
      setIncomingRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });

    const outgoingQ = query(
      collection(db, 'notifications'),
      where('senderId', '==', user.uid),
      where('type', '==', 'friend_request'),
      where('status', '==', 'unread')
    );
    const unsubOutgoing = onSnapshot(outgoingQ, (snap) => {
      setOutgoingRequests(snap.docs.map(d => (d.data() as Notification).recipientId));
    });

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMyFriends(data.friends || []);
        setCurrentUserPhoto(data.photoURL || '');
      }
    });

    return () => {
      unsubIncoming();
      unsubOutgoing();
      unsubUser();
    };
  }, [user]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      searchUsers(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, searchUsers]);

  const sendFriendRequest = async (targetUser: User) => {
    if (!user) return;
    setRequestingId(targetUser.id);
    try {
      await addDoc(collection(db, 'notifications'), {
        recipientId: targetUser.id,
        senderId: user.uid,
        senderName: user?.displayName || 'محارب',
        senderPhoto: currentUserPhoto || user?.photoURL || '',
        title: '👥 طلب صداقة جديد',
        message: `يرغب ${user?.displayName || 'المحارب'} في الانضمام إلى قائمة أصدقائك.`,
        type: 'friend_request',
        status: 'unread',
        createdAt: serverTimestamp()
      });

      showStatus(`تم إرسال طلب الصداقة إلى ${targetUser.displayName} بنجاح!`, 'success');
    } catch (err) {
      console.error(err);
      showStatus('فشل في إرسال طلب الصداقة.. حاول مرة أخرى أيها المحارب.', 'error');
    } finally {
      setRequestingId(null);
    }
  };

  const handleBlockUser = async (targetUser: User) => {
    if (!user) return;
    if (confirm(`هل أنت متأكد من حظر ${targetUser.displayName}؟ لن يتمكن من التواصل معك.`)) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          blockedUsers: arrayUnion(targetUser.id)
        });
        showStatus(`تم حظر ${targetUser.displayName} بنجاح.`, 'info');
      } catch (err) {
        console.error(err);
        showStatus('فشل في عملية الحظر.', 'error');
      }
    }
  };

  const handleAcceptRequest = async (targetUser: User) => {
    const request = incomingRequests.find(r => r.senderId === targetUser.id);
    if (!user || !request) return;
    
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', user.uid), { friends: arrayUnion(targetUser.id), friendsCount: increment(1) });
      batch.update(doc(db, 'users', targetUser.id), { friends: arrayUnion(user.uid), friendsCount: increment(1) });
      batch.update(doc(db, 'notifications', request.id), { status: 'read' });
      
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        recipientId: targetUser.id,
        title: '🤝 تم قبول طلب الصداقة',
        message: `لقد قبل ${user.displayName} طلب صداقتك. أنتما الآن أصدقاء!`,
        type: 'info',
        status: 'unread',
        createdAt: serverTimestamp()
      });
      
      await batch.commit();
      showStatus('مبارك! أنتما الآن أصدقاء في المملكة.', 'success');
    } catch (err) {
      console.error(err);
      showStatus('فشل في قبول الطلب.', 'error');
    }
  };

  const handleRejectRequest = async (targetUser: User) => {
    const request = incomingRequests.find(r => r.senderId === targetUser.id);
    if (!user || !request) return;
    
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'notifications', request.id), { status: 'read' });
      
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        recipientId: targetUser.id,
        title: '❌ تم رفض طلب الصداقة',
        message: `عذراً، لقد رفض ${user.displayName} (${user.uid}) طلب صداقتك.`,
        type: 'info',
        status: 'unread',
        createdAt: serverTimestamp()
      });
      
      await batch.commit();
      showStatus('تم رفض الطلب بنجاح.', 'info');
    } catch (err) {
      console.error(err);
      showStatus('حدث خطأ أثناء الرفض.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="flex justify-between items-center">
            <h2 className="text-4xl font-black font-pharaoh tracking-widest text-[#FFD700]">البحث عن محاربين</h2>
            <Link href="/dashboard" className="text-sm text-[#D4AF37] hover:underline uppercase font-bold tracking-widest">🔙 العودة للعرش</Link>
        </div>

        {/* Custom Status Notification (Toast) */}
        {statusMessage && (
          <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[1000] px-8 py-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border-2 backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-500 flex items-center gap-4 min-w-[320px] justify-center ${
            statusMessage.type === 'success' ? 'bg-green-500/10 border-green-500/40 text-green-400' :
            statusMessage.type === 'error' ? 'bg-red-500/10 border-red-500/40 text-red-400' :
            'bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#D4AF37]'
          }`}>
            <span className="text-2xl">
              {statusMessage.type === 'success' ? '🔱' : statusMessage.type === 'error' ? '⚠️' : '📜'}
            </span>
            <span className="font-bold text-sm tracking-wide">{statusMessage.text}</span>
            <button 
              onClick={() => setStatusMessage(null)}
              className="ml-4 hover:scale-110 transition-transform opacity-50 hover:opacity-100"
            >✕</button>
          </div>
        )}

        <div className="relative group">
            <input 
                type="text" 
                placeholder="ابحث بالاسم، البريد الإلكتروني، أو المعرف الملكي (ID)..."
                className="w-full bg-[#0a0a0a] border-2 border-[#D4AF37]/20 rounded-3xl p-6 text-xl focus:outline-none focus:border-[#D4AF37] transition-all text-right"
                dir="rtl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl">🔍</span>
        </div>

        {/* Pending Incoming Requests Section */}
        {incomingRequests.length > 0 && !searchTerm && (
          <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3 pb-2 border-b border-[#D4AF37]/20">
              <span className="text-2xl">📥</span>
              <h3 className="text-lg font-black font-pharaoh tracking-widest text-[#FFD700]">طلبات واردة بانتظار ردك</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {incomingRequests.map((req) => (
                <div key={req.id} className="bg-gradient-to-r from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/30 rounded-[30px] p-5 flex items-center justify-between gap-4 shadow-lg">
                  <div className="flex items-center gap-3">
                    <Link href={`/profile/${req.senderId}`} className="w-12 h-12 rounded-full bg-gray-800 border-2 border-[#D4AF37]/40 relative overflow-hidden block hover:scale-105 transition-transform">
                       {req.senderPhoto ? (
                         <Image src={req.senderPhoto} alt="Sender" fill className="object-cover" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center text-xl">👤</div>
                       )}
                    </Link>
                    <Link href={`/profile/${req.senderId}`} className="text-right hover:text-[#FFD700] transition-colors">
                      <p className="font-bold text-gray-100 text-sm">{req.senderName}</p>
                      <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-widest">يريد مصادقتك</p>
                    </Link>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAcceptRequest({ id: req.senderId, displayName: req.senderName || 'محارب' } as User)}
                      className="px-4 py-2 bg-green-500 text-white text-[9px] font-black rounded-xl hover:scale-105 transition-all"
                    >قبول</button>
                    <button 
                      onClick={() => handleRejectRequest({ id: req.senderId, displayName: req.senderName || 'محارب' } as User)}
                      className="px-4 py-2 bg-red-600/20 text-red-500 border border-red-500/20 text-[9px] font-black rounded-xl hover:bg-red-600 transition-all"
                    >رفض</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loading ? (
                <div className="col-span-full py-20 text-center animate-pulse">
                    <p className="text-[#D4AF37] font-black uppercase tracking-widest text-sm">جاري البحث في أرجاء المملكة...</p>
                </div>
            ) : users.length === 0 && searchTerm ? (
                <div className="col-span-full py-20 text-center text-gray-500">
                    <p className="text-4xl mb-4">🏜️</p>
                    <p>لا يوجد محاربين بهذا الاسم حالياً.</p>
                </div>
            ) : (
                users.map((u) => (
                    <div key={u.id} className="bg-[#0a0a0a] border border-[#D4AF37]/10 rounded-[30px] p-6 flex flex-col sm:flex-row items-center justify-between gap-4 hover:border-[#D4AF37]/40 transition-all group shadow-xl">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <div 
                                className="w-16 h-16 rounded-full bg-gray-800 border-2 border-white/5 overflow-hidden relative shrink-0 cursor-help"
                                title={`المعرف: ${u.kingdomId || u.id}`}
                            >
                                {u.photoURL ? (
                                    <Image src={u.photoURL} alt={u.displayName} fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
                                )}
                            </div>
                            <div className="text-right">
                                <Link href={`/profile/${u.id}`} className="hover:text-[#FFD700] transition-colors">
                                    <h3 className="text-lg font-bold text-gray-100">{u.displayName}</h3>
                                </Link>
                                <p className="text-[9px] text-gray-500 mb-1 truncate max-w-[150px]">{u.id}</p>
                                <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-widest">المستوى {u.level || 1} • محارب</p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2 w-full sm:w-auto">
                            {incomingRequests.some(r => r.senderId === u.id) ? (
                                <>
                                    <button 
                                        onClick={() => handleAcceptRequest(u)}
                                        className="flex-1 sm:flex-none px-5 py-3 rounded-2xl font-black text-[10px] uppercase bg-green-600 text-white hover:scale-105 transition-all"
                                    >
                                        قبول
                                    </button>
                                    <button 
                                        onClick={() => handleRejectRequest(u)}
                                        className="flex-1 sm:flex-none px-5 py-3 rounded-2xl font-black text-[10px] uppercase bg-red-600/20 text-red-500 border border-red-600/20 hover:bg-red-600 hover:text-white transition-all"
                                    >
                                        رفض
                                    </button>
                                </>
                            ) : myFriends.includes(u.id) ? (
                                <button 
                                    disabled
                                    className="flex-1 sm:flex-none px-5 py-3 rounded-2xl font-black text-[10px] uppercase bg-green-500/10 text-green-500 border border-green-500/20"
                                >
                                    ✅ صديق
                                </button>
                            ) : outgoingRequests.includes(u.id) ? (
                                <button 
                                    disabled
                                    className="flex-1 sm:flex-none px-5 py-3 rounded-2xl font-black text-[10px] uppercase bg-white/5 text-gray-500"
                                >
                                    ⏳ تم الإرسال
                                </button>
                            ) : (
                                <button 
                                    onClick={() => sendFriendRequest(u)}
                                    disabled={requestingId === u.id}
                                    className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${
                                        requestingId === u.id 
                                        ? 'bg-white/5 text-gray-500' 
                                        : 'bg-[#D4AF37] text-black hover:scale-105'
                                    }`}
                                >
                                    {requestingId === u.id ? 'جاري الإرسال...' : 'إضافة صديق'}
                                </button>
                            )}
                            <button 
                                onClick={() => handleBlockUser(u)}
                                className="px-5 py-3 rounded-2xl font-black text-[10px] uppercase bg-white/5 text-gray-500 border border-white/10 hover:border-red-500 hover:text-red-500 transition-all"
                            >
                                حظر
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
}
