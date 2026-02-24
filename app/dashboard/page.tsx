"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import UserAvatar from '@/app/components/UserAvatar';
import { addXP } from '@/lib/progression';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  Timestamp, 
  doc, 
  where, 
  serverTimestamp, 
  arrayUnion, 
  writeBatch,
  increment,
  addDoc,
  getDocs,
  updateDoc,
  arrayRemove,
  FieldValue
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';

interface UserFriend {
  id: string;
  displayName: string;
  photoURL?: string;
  level?: number;
  rank?: string;
}

interface NewsPost {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  authorPhoto?: string; // Legacy support
  content: string;
  imageURL?: string;
  visibility: 'public' | 'friends' | 'private';
  likes?: string[];
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  createdAt: Timestamp;
}

interface UserProfile {
  uid: string;
  kingdomId?: string;
  balance?: number;
  displayName?: string;
  photoURL?: string;
  level?: number;
  rank?: string;
  xp?: number;
  friendsCount?: number;
  friends?: string[];
  bio?: string;
  coverURL?: string;
  role?: string;
}

interface UserTransaction {
  id: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  status: 'pending' | 'completed' | 'rejected' | 'suspended';
  reason?: string;
  updatedAt?: Timestamp;
  createdAt: Timestamp;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'offer' | 'friend_request' | 'transaction' | 'info' | 'gift' | 'loan' | 'social_post' | 'admin_promotion_invite';
  status: 'unread' | 'read';
  senderId?: string; // ID of the person who sent the request
  senderPhoto?: string;
  requestId?: string; // ID of the friend request for rejection tracking
  amount?: number;
  returnDate?: string;
  chatMessageId?: string; // Link to chat message
  createdAt: Timestamp;
  senderName?: string; // Added for friend request notifications
}

interface ActiveOffer {
  id: string;
  value: string;
  expiresAt: Timestamp;
}

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
  type?: 'text' | 'gift' | 'loan' | 'share' | 'voice';
  amount?: number;
  notificationId?: string;
  status?: 'pending' | 'accepted' | 'rejected';
  postId?: string;
  sharedPostAuthor?: string;
  sharedPostContent?: string;
  sharedPostImage?: string;
  audioURL?: string;
  duration?: number;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [friends, setFriends] = useState<UserFriend[]>([]);
  const [news, setNews] = useState<NewsPost[]>([]);
  const [userTransactions, setUserTransactions] = useState<UserTransaction[]>([]);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeOffer, setActiveOffer] = useState<ActiveOffer | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  
  // Chat/Interaction Modal
  const [selectedFriend, setSelectedFriend] = useState<UserFriend | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [interactionType, setInteractionType] = useState<'chat' | 'gift' | 'loan'>('chat');
  const [amount, setAmount] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [feedFilter, setFeedFilter] = useState<'all' | 'friends'>('all');
  const [isRecording, setIsRecording] = useState(false);
  const [requestProcessingIds, setRequestProcessingIds] = useState<string[]>([]);
  
  // Post Creation
  const [postContent, setPostContent] = useState('');
  const [postVisibility, setPostVisibility] = useState<'public' | 'friends' | 'private'>('public');
  
  // Chat Messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Share Modal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingPost, setSharingPost] = useState<NewsPost | null>(null);
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState<'voice' | 'video'>('voice');
  const [activeCallSession, setActiveCallSession] = useState<any | null>(null);
  const [outgoingCallId, setOutgoingCallId] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [activeCallStatus, setActiveCallStatus] = useState<'ringing' | 'active' | 'ended'>('ringing');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState<NewsPost | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isCoronationOpen, setIsCoronationOpen] = useState(false);
  const localVideoRef = React.useRef<HTMLVideoElement>(null);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/');
    } catch (err) {
      console.error("Logout error:", err);
      showStatus("فشل في مغادرة العرش.. حاول مرة أخرى.", "error");
    }
  };

  const showStatus = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);
  
  // Synchronize profile image with Firestore data
  useEffect(() => {
    if (userData?.photoURL) {
      setProfileImage(userData.photoURL);
    } else if (user?.photoURL) {
      setProfileImage(user.photoURL);
    }
  }, [userData, user]);

  // Real-time Notifications
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'), 
      where('recipientId', '==', user.uid),
      limit(50) // Fetch more to allow in-memory sorting
    );
    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[];
      // Sort in-memory to avoid index requirement
      const sortedNotifs = notifs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setNotifications(sortedNotifs);
      setUnreadCount(sortedNotifs.filter(n => n.status === 'unread').length);
    });
    return () => unsub();
  }, [user]);
  
   const handleAcceptFriendRequest = async (notif: Notification) => {
    if (!user || !notif.senderId || requestProcessingIds.includes(notif.id)) return;
    
    setRequestProcessingIds(prev => [...prev, notif.id]);
    try {
      const batch = writeBatch(db);
      
      // 1. Add reciprocally to friends lists
      const myRef = doc(db, 'users', user.uid);
      const friendRef = doc(db, 'users', notif.senderId);
      
      batch.update(myRef, {
        friends: arrayUnion(notif.senderId),
        friendsCount: increment(1)
      });
      
      batch.update(friendRef, {
        friends: arrayUnion(user.uid),
        friendsCount: increment(1)
      });
      
      // 2. Mark notification as read and delete/archive the request
      batch.update(doc(db, 'notifications', notif.id), { status: 'read' });
      
      // 3. Send success notification to the sender
      const senderNotifRef = doc(collection(db, 'notifications'));
      batch.set(senderNotifRef, {
        recipientId: notif.senderId,
        senderId: user.uid,
        senderPhoto: profileImage || '',
        title: '🤝 تم قبول طلب الصداقة',
        message: `لقد قبل ${user.displayName} طلب صداقتك. أنتما الآن أصدقاء!`,
        type: 'info',
        status: 'unread',
        createdAt: serverTimestamp()
      });

      await batch.commit();
      showStatus('تم قبول الصداقة بنجاح! أنتما الآن أصدقاء.', 'success');
      
      // Add XP for making a connection
      await addXP(user.uid, 30);
      showStatus(`🏹 تم تشكيل تحالف مقدس! أنت و ${notif.senderName || 'المحارب'} الآن في خندق واحد. (+30 XP) 🔱`, 'success');

    } catch (err) {
      console.error(err);
      showStatus('فشل في قبول الصداقة.', 'error');
    } finally {
      setRequestProcessingIds(prev => prev.filter(id => id !== notif.id));
    }
  };

   const handleRejectFriendRequest = async (notif: Notification) => {
    if (!user || !notif.senderId || requestProcessingIds.includes(notif.id)) return;
    
    setRequestProcessingIds(prev => [...prev, notif.id]);
    try {
      const batch = writeBatch(db);
      
      // 1. Mark notification as read
      batch.update(doc(db, 'notifications', notif.id), { status: 'read' });
      
      // 2. Send rejection notification to the sender
      const senderNotifRef = doc(collection(db, 'notifications'));
      batch.set(senderNotifRef, {
        recipientId: notif.senderId,
        senderId: user.uid,
        senderPhoto: profileImage || '',
        title: '❌ تم رفض طلب الصداقة',
        message: `عذراً، لقد رفض ${user.displayName} طلب صداقتك.`,
        type: 'info',
        status: 'unread',
        createdAt: serverTimestamp()
      });

      await batch.commit();
      showStatus('تم رفض الطلب بنجاح.', 'info');
    } catch (err) {
      console.error(err);
      showStatus('فشل في رفض الطلب.', 'error');
    } finally {
      setRequestProcessingIds(prev => prev.filter(id => id !== notif.id));
    }
  };

  const handleAcceptAdminPromotion = async (notif: Notification) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      
      // 1. Update user role
      batch.update(doc(db, 'users', user.uid), {
        role: 'admin'
      });
      
      // 2. Delete notification immediately
      batch.delete(doc(db, 'notifications', notif.id));
      
      // 3. Notify the sender (the admin who promoted them)
      if (notif.senderId) {
        const senderNotifRef = doc(collection(db, 'notifications'));
        batch.set(senderNotifRef, {
          recipientId: notif.senderId,
          senderId: user.uid,
          senderPhoto: profileImage || '',
          title: '✅ تم قبول دعوة الإدارة',
          message: `لقد قبل ${user.displayName} دعوة الانضمام لمجلس الإدارة وهو الآن مسؤول جديد.`,
          type: 'info',
          status: 'unread',
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();
      setIsCoronationOpen(true);
      
      // Force reload after some time to refresh UI with admin tabs, but after celebration
      setTimeout(() => window.location.reload(), 8000);
    } catch (err) {
      console.error(err);
      showStatus('فشل في قبول الدعوة.', 'error');
    }
  };

  const handleRejectAdminPromotion = async (notif: Notification) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      // Delete notification so it disappears immediately
      batch.delete(doc(db, 'notifications', notif.id));
      
      if (notif.senderId) {
        const senderNotifRef = doc(collection(db, 'notifications'));
        batch.set(senderNotifRef, {
          recipientId: notif.senderId,
          senderId: user.uid,
          senderPhoto: profileImage || '',
          title: '❌ تم رفض دعوة الإدارة',
          message: `عذراً، لقد رفض ${user.displayName} دعوة الانضمام لمجلس الإدارة.`,
          type: 'info',
          status: 'unread',
          createdAt: serverTimestamp()
        });
      }
      
      await batch.commit();
      showStatus('تم رفض دعوة الإدارة.', 'info');
    } catch (err) {
      console.error(err);
      showStatus('فشل في رفض الدعوة.', 'error');
    }
  };
  
  const handleProcessInteraction = async (notifData: { id: string; senderId: string; amount: number; type: string; returnDate?: string; chatMessageId?: string }, action: 'accept' | 'reject', msgId?: string) => {
    if (!user) return;
    console.log('Processing interaction:', { notifData, action, msgId });
    
    try {
      const batch = writeBatch(db);
      const myRef = doc(db, 'users', user.uid);
      const senderRef = doc(db, 'users', notifData.senderId);
      
      const chatID = [user.uid, notifData.senderId].sort().join('_');
      const targetMsgId = msgId || notifData.chatMessageId;

      if (action === 'accept') {
        // 1. Add balance to recipient
        const amountToAdd = Number(notifData.amount) || 0;
        batch.update(myRef, { balance: increment(amountToAdd) });
        
        // Add XP for processing interaction
        await addXP(user.uid, 20);
        
        // 2. Update chat message status
        if (targetMsgId) {
          batch.update(doc(db, 'chats', chatID, 'messages', targetMsgId), { status: 'accepted' });
        }

        // 3. Notify sender
        const senderNotifRef = doc(collection(db, 'notifications'));
        batch.set(senderNotifRef, {
          recipientId: notifData.senderId,
          senderId: user.uid,
          senderPhoto: profileImage || '',
          title: notifData.type === 'gift' ? '🎁 تم قبول هديتك' : '💰 تم قبول التسليف',
          message: `لقد قبل ${user.displayName} الـ ${notifData.type === 'gift' ? 'هدية' : 'مبلغ'} بقيمة ${amountToAdd} EGP.`,
          type: 'info',
          status: 'unread',
          createdAt: serverTimestamp()
        });
        
        if (notifData.type === 'loan') {
          const loanRef = doc(collection(db, 'loans'));
          batch.set(loanRef, {
            lenderId: notifData.senderId,
            borrowerId: user.uid,
            amount: amountToAdd,
            returnDate: notifData.returnDate || null,
            status: 'active',
            createdAt: serverTimestamp()
          });
        }
      } else {
        // Return balance to sender
        const amountToReturn = Number(notifData.amount) || 0;
        batch.update(senderRef, { balance: increment(amountToReturn) });
        
        if (targetMsgId) {
          batch.update(doc(db, 'chats', chatID, 'messages', targetMsgId), { status: 'rejected' });
        }

        const senderNotifRef = doc(collection(db, 'notifications'));
        batch.set(senderNotifRef, {
          recipientId: notifData.senderId,
          senderId: user.uid,
          senderPhoto: profileImage || '',
          title: notifData.type === 'gift' ? '❌ تم رفض الهدية' : '❌ تم رفض التسليف',
          message: `عذراً، لقد رفض ${user.displayName} استلام الـ ${notifData.type === 'gift' ? 'هدية' : 'مبلغ'} بقيمة ${amountToReturn} EGP وتم إعادة المبلغ إلى رصيدك.`,
          type: 'info',
          status: 'unread',
          createdAt: serverTimestamp()
        });
      }
      
      // Update original notification state
      batch.update(doc(db, 'notifications', notifData.id), { status: 'read' });
      
      await batch.commit();
      showStatus(action === 'accept' ? 'تم استلام الهدية بنجاح! تفقد رصيدك الآن.' : 'تم رفض العملية وإعادة المبالغ.', action === 'accept' ? 'success' : 'info');
    } catch (err) {
      console.error('Interaction error:', err);
      showStatus('حدث خطأ في معالجة العملية الملكية.', 'error');
    }
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(notif => {
        if (notif.status === 'unread') {
          batch.update(doc(db, 'notifications', notif.id), { status: 'read' });
        }
      });
      await batch.commit();
      showStatus('تم تحديد جميع التنبيهات كمقروءة.', 'success');
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
      showStatus('فشل في تحديث التنبيهات.', 'error');
    }
  };

  const clearAllNotifications = async () => {
    if (!user || notifications.length === 0) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const q = query(collection(db, 'notifications'), where('recipientId', '==', user.uid));
      const snap = await getDocs(q);
      
      snap.docs.forEach(d => {
        batch.delete(d.ref);
      });
      
      await batch.commit();
      showStatus('تم مسح جميع التنبيهات بنجاح.', 'info');
    } catch (err) {
      console.error(err);
      showStatus('فشل في مسح التنبيهات.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  /* Profile image upload removed as per request */
  const [games] = useState([
    { id: 1, name: 'بناء الأهرامات', icon: '🧱', members: '1.2k', link: '/games/pyramid' },
    { id: 2, name: 'خنفساء الفرعون', icon: '🪲', members: '850', link: '/games/scarab' },
    { id: 3, name: 'عجلة الحظ', icon: '🎡', members: '3.5k', link: '/games/wheel' },
    { id: 4, name: 'رويال', icon: '👑', members: '2.1k', link: '/games/royale' },
  ]);

  useEffect(() => {
    if (!user) return;
    // For now, fetch latest 20 posts. 
    // In a mature app, this would involve complex queries for visibility.
    const newsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(20));
    const unsubNews = onSnapshot(newsQuery, (snap) => {
      const posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NewsPost[];
      const filteredPosts = posts.filter(post => {
        // Author always sees their own posts
        if (post.authorId === user.uid) return true;

        if (feedFilter === 'all') {
          // "Everyone" tab: Only show public posts
          return post.visibility === 'public';
        } else if (feedFilter === 'friends') {
          // "Friends" tab: Show posts from friends (both public and friends-only)
          const isFriend = userData?.friends?.includes(post.authorId);
          return isFriend && (post.visibility === 'public' || post.visibility === 'friends');
        }
        return false;
      });
      setNews(filteredPosts);
    });

    // Fetch friends for the left side (Only those in userData.friends)
    const unsubFriends = onSnapshot(collection(db, 'users'), (snap) => {
      const allUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserFriend));
      const myFriends = allUsers.filter(u => userData?.friends?.includes(u.id));
      setFriends(myFriends);
    });

    // Fetch user's transactions to show alerts
    const txQuery = query(
      collection(db, 'transactions'), 
      where('userId', '==', user?.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubTx = onSnapshot(txQuery, (snap) => {
      setUserTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserTransaction[]);
    });

    // Fetch active offers
    const offersQuery = query(
      collection(db, 'offers'),
      where('active', '==', true),
      orderBy('expiresAt', 'desc'),
      limit(1)
    );
    const unsubOffers = onSnapshot(offersQuery, (snap) => {
      const now = Timestamp.now();
      const currentOffer = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as ActiveOffer))
        .find(o => o.expiresAt.toMillis() > now.toMillis());
      
    setActiveOffer(currentOffer || null);
    });

    // Listen for Incoming Calls
    const callQuery = query(
      collection(db, 'calls'), 
      where('recipientId', '==', user.uid),
      where('status', '==', 'ringing')
    );
    const unsubCalls = onSnapshot(callQuery, (snap) => {
      if (!snap.empty) {
        setActiveCallSession({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setActiveCallSession(null);
      }
    });

    return () => {
      unsubNews();
      unsubFriends();
      unsubTx();
      unsubOffers();
      unsubCalls();
    };
  }, [user, userData, feedFilter]);

  // Listen for Outgoing Call Status
  useEffect(() => {
    if (!outgoingCallId) return;
    const unsub = onSnapshot(doc(db, 'calls', outgoingCallId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'rejected') {
          showStatus('المحارب مشغول حالياً.', 'info');
          setIsCalling(false);
          setOutgoingCallId(null);
        } else if (data.status === 'accepted') {
          setActiveCallStatus('active');
          showStatus('تم قبول المكالمة! البدء في التشفير الملكي...', 'success');
        } else if (data.status === 'ended') {
          setIsCalling(false);
          setOutgoingCallId(null);
          setActiveCallStatus('ringing');
        }
      }
    });
    return () => unsub();
  }, [outgoingCallId]);

  // Handle Media Stream (Camera/Mic)
  useEffect(() => {
    const startStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: true
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Media access error:", err);
        showStatus('فشل في الوصول إلى الكاميرا أو الميكروفون.', 'error');
        setIsCalling(false);
      }
    };

    if (isCalling) {
      startStream();
    } else {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
    }
  }, [isCalling, callType]);

  // Handle Call Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeCallStatus === 'active') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeCallStatus]);

  // Handle Recording Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Voice Playback Simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (playingMessageId) {
      const msg = messages.find(m => m.id === playingMessageId);
      const duration = msg?.duration || 5;
      
      interval = setInterval(() => {
        setPlaybackProgress(prev => {
          if (prev >= 100) {
            setPlayingMessageId(null);
            return 0;
          }
          return prev + (100 / (duration * 10)); // 10 updates per second
        });
      }, 100);
    } else {
      setPlaybackProgress(0);
    }
    return () => clearInterval(interval);
  }, [playingMessageId, messages]);

  const handleTogglePlayback = (msgId: string) => {
    if (playingMessageId === msgId) {
      setPlayingMessageId(null);
    } else {
      setPlayingMessageId(msgId);
      setPlaybackProgress(0);
    }
  };

  // Handle New Offer Popup
  useEffect(() => {
    if (activeOffer) {
      const lastSeenId = localStorage.getItem(`offer_${user?.uid}`);
      if (lastSeenId !== activeOffer.id) {
        setShowOfferModal(true);
      }
    }
  }, [activeOffer, user]);

  const closeOfferModal = () => {
    if (activeOffer && user) {
      localStorage.setItem(`offer_${user.uid}`, activeOffer.id);
    }
    setShowOfferModal(false);
  };

  useEffect(() => {
    if (!user) return;
    
    // Fetch logged in user's data (balance, etc.)
    const userRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData({
          uid: docSnap.id,
          kingdomId: data.kingdomId,
          balance: data.balance,
          displayName: data.displayName,
          level: data.level,
          rank: data.rank,
          xp: data.xp,
          friendsCount: data.friendsCount,
          friends: data.friends || [],
          photoURL: data.photoURL,
          coverURL: data.coverURL,
          role: data.role
        });
      }
    });

    return () => unsubUser();
  }, [user]);

  // Real-time Chat Listener
  useEffect(() => {
    if (!user || !selectedFriend || !isChatOpen) {
      setMessages([]);
      return;
    }

    const chatID = [user.uid, selectedFriend.id].sort().join('_');
    const q = query(
      collection(db, 'chats', chatID, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
    });

    return () => unsub();
  }, [user, selectedFriend, isChatOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !selectedFriend || !newMessage.trim()) return;

    const chatID = [user.uid, selectedFriend.id].sort().join('_');
    const msg = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'chats', chatID, 'messages'), {
        senderId: user.uid,
        text: msg,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      showStatus('فشل في إرسال الرسالة.', 'error');
    }
  };

  const handleSendInteraction = async () => {
    if (!user || !selectedFriend || !amount || isProcessing) return;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showStatus('الرجاء إدخال مبلغ صحيح.', 'error');
      return;
    }
    
    if ((userData?.balance || 0) < numAmount) {
      showStatus('رصيدك غير كافٍ لهذه العملية الملكية.', 'error');
      return;
    }
    
    if (interactionType === 'loan' && !returnDate) {
      showStatus('الرجاء تحديد موعد رد التسليف.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Escrow money from sender
      const myRef = doc(db, 'users', user.uid);
      batch.update(myRef, { balance: increment(-numAmount) });
      
      // 2. Send notification to friend
      const notifRef = doc(collection(db, 'notifications'));
      const notifId = notifRef.id;
      batch.set(notifRef, {
        id: notifId,
        recipientId: selectedFriend.id,
        senderId: user.uid,
        senderName: user.displayName,
        senderPhoto: profileImage || '',
        title: interactionType === 'gift' ? '🎁 هدية ملكية جديدة' : '🤝 طلب تسليف',
        message: interactionType === 'gift' 
          ? `لقد أرسل لك ${user.displayName} هدية بقيمة ${numAmount} EGP!` 
          : `يطلب ${user.displayName} تسليفك ${numAmount} EGP على أن يتم ردها بتاريخ ${returnDate}.`,
        type: interactionType,
        amount: numAmount,
        returnDate: interactionType === 'loan' ? returnDate : null,
        status: 'unread',
        createdAt: serverTimestamp()
      });

      // 3. Post to chat
      const chatID = [user.uid, selectedFriend.id].sort().join('_');
      const chatMsgRef = doc(collection(db, 'chats', chatID, 'messages'));
      const msgId = chatMsgRef.id;

      // Update notification with msgId
      batch.update(notifRef, { chatMessageId: msgId });

      batch.set(chatMsgRef, {
        senderId: user.uid,
        text: interactionType === 'gift' ? 'أرسل لك هدية ملكية 🎁' : 'أرسل لك طلب تسليف 🤝',
        type: interactionType,
        amount: numAmount,
        notificationId: notifId,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      
      await batch.commit();
      showStatus('تم إرسال العرض بنجاح! ننتظر موافقة الملك الآخر.', 'success');
      setInteractionType('chat');
      setAmount('');
      setReturnDate('');
    } catch (err) {
      console.error(err);
      showStatus('فشل في إرسال العملية.. حاول مرة أخرى.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnfriend = async () => {
    if (!user || !selectedFriend) return;
    setShowUnfriendConfirm(false);

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const myRef = doc(db, 'users', user.uid);
      const friendRef = doc(db, 'users', selectedFriend.id);

      batch.update(myRef, {
        friends: arrayRemove(selectedFriend.id),
        friendsCount: increment(-1)
      });
      batch.update(friendRef, {
        friends: arrayRemove(user.uid),
        friendsCount: increment(-1)
      });

      await batch.commit();
      showStatus('تم إلغاء الصداقة بنجاح.', 'info');
      setIsChatOpen(false);
    } catch (err) {
      console.error(err);
      showStatus('فشل في إلغاء الصداقة.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !postContent.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const postRef = await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: user.displayName || 'محارب مجهول',
        authorPhotoURL: user.photoURL || '',
        content: postContent.trim(),
        visibility: postVisibility,
        likes: [],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: serverTimestamp()
      });

      // Notify friends (Social Post Notification)
      if (userData?.friends && userData.friends.length > 0) {
        const batch = writeBatch(db);
        userData.friends.forEach(friendId => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            recipientId: friendId,
            senderId: user.uid,
            senderPhoto: profileImage || '',
            title: '📜 مرسوم ملكي جديد',
            message: `لقد نشر صديقك ${user.displayName || 'المحارب'} مرسوماً جديداً في ساحة المملكة.`,
            type: 'social_post',
            status: 'unread',
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
      }
      
      // Add XP for publishing a decree
      await addXP(user.uid, 50);

      setPostContent('');
      setPostVisibility('public');
      showStatus('تم نشر مرسومك الملكي في المملكة!', 'success');
    } catch (err) {
      console.error(err);
      showStatus('فشل في نشر البوست.. حاول مرة أخرى.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePost = async (post: NewsPost) => {
    if (!user || (post.authorId !== user.uid && userData?.rank !== 'Pharaoh')) return;
    setPostToDelete(post);
    setShowDeletePostConfirm(true);
  };

  const confirmDeletePost = async () => {
    if (!postToDelete || !user) return;
    setIsProcessing(true);
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'posts', postToDelete.id));
      showStatus('تم مسح المرسوم الملكي بنجاح.', 'info');
      setShowDeletePostConfirm(false);
      setPostToDelete(null);
    } catch (err) {
      console.error(err);
      showStatus('فشل في مسح المرسوم.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleLike = async (post: NewsPost) => {
    if (!user) return;
    const isLiked = post.likes?.includes(user.uid);
    const postRef = doc(db, 'posts', post.id);

    try {
      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(user.uid),
          likesCount: increment(-1)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(user.uid),
          likesCount: increment(1)
        });
        // Add XP for interaction
        await addXP(user.uid, 5);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSharePost = (post: NewsPost) => {
    if (!user) return;
    setSharingPost(post);
    setIsShareModalOpen(true);
  };

  const handlePerformShare = async (friend: UserFriend) => {
    if (!user || !sharingPost) return;
    setIsProcessing(true);

    try {
      const chatID = [user.uid, friend.id].sort().join('_');
      await addDoc(collection(db, 'chats', chatID, 'messages'), {
        senderId: user.uid,
        text: `شاركت معك مرسوماً ملكياً لـ (${sharingPost.authorName}) 📜`,
        type: 'share',
        postId: sharingPost.id,
        sharedPostAuthor: sharingPost.authorName,
        sharedPostContent: sharingPost.content,
        sharedPostImage: sharingPost.imageURL || '',
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'posts', sharingPost.id), {
        sharesCount: increment(1)
      });

      showStatus(`تمت مشاركة المرسوم مع ${friend.displayName}!`, 'success');
      setIsShareModalOpen(false);
      setSharingPost(null);
    } catch (err) {
      console.error(err);
      showStatus('فشل في مشاركة المرسوم.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      {/* Custom Status Notification (Toast) */}
      {statusMessage && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[1000] px-8 py-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border-2 backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-500 flex items-center gap-4 min-w-[320px] justify-center ${
          statusMessage?.type === 'success' ? 'bg-green-500/10 border-green-500/40 text-green-400' :
          statusMessage?.type === 'error' ? 'bg-red-500/10 border-red-500/40 text-red-400' :
          'bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#D4AF37]'
        }`}>
          <span className="text-2xl">
            {statusMessage?.type === 'success' ? '🔱' : statusMessage?.type === 'error' ? '⚠️' : '📜'}
          </span>
          <span className="font-bold text-sm tracking-wide">{statusMessage?.text}</span>
          <button 
            onClick={() => setStatusMessage(null)}
            className="ml-4 hover:scale-110 transition-transform opacity-50 hover:opacity-100"
          >✕</button>
        </div>
      )}

      {/* Top Header */}
      <header className="h-20 bg-black/40 border-b border-[#D4AF37]/20 backdrop-blur-xl sticky top-0 z-50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="Logo" width={45} height={45} />
          <h1 className="text-xl font-black font-pharaoh tracking-widest text-[#FFD700]">HBET</h1>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[8px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest">رصيدك الحالي</span>
            <span className="text-[#FFD700] font-black text-xs md:text-base">{userData?.balance?.toLocaleString() || '0.00'} EGP</span>
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button 
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
              }}
              className="relative p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-[#D4AF37]/10 transition-all"
            >
              <span className="text-xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-black animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute top-14 right-0 w-80 bg-[#0a0a0a] border border-[#D4AF37]/30 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 z-[100]">
                <div className="p-4 bg-[#111] border-b border-white/5 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black uppercase text-[#FFD700] tracking-widest font-pharaoh">تنبيهات الفرعون</h4>
                    <span className="text-[8px] text-gray-500 uppercase font-bold">{notifications.length} إجمالي</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={markAllAsRead}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase rounded-lg border border-white/5 transition-all flex items-center justify-center gap-1"
                    >
                      <span>✔️</span> تم القراءة
                    </button>
                    <button 
                      onClick={clearAllNotifications}
                      className="flex-1 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 text-[9px] font-black uppercase rounded-lg border border-red-600/20 transition-all flex items-center justify-center gap-1"
                    >
                      <span>🗑️</span> مسح الكل
                    </button>
                  </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
                  {notifications.length === 0 ? (
                    <div className="p-10 text-center space-y-2">
                      <p className="text-[20px]">📜</p>
                      <p className="text-xs text-gray-500">لا توجد تنبيهات جديدة</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif.id} className={`p-4 border-b border-white/5 hover:bg-white/[0.04] transition-all relative ${notif.status === 'unread' ? 'bg-gradient-to-l from-[#D4AF37]/5 to-transparent' : ''}`}>
                        {notif.status === 'unread' && (
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#D4AF37] rounded-l-full"></div>
                        )}
                        <div className="flex gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-lg overflow-hidden border-2 ${
                            notif.type === 'offer' ? 'bg-gradient-to-br from-[#FFD700]/20 to-[#D4AF37]/40 border-[#D4AF37]/50 shadow-[0_0_15px_rgba(212,175,55,0.3)] anim-glow' :
                            notif.type === 'friend_request' ? 'bg-gradient-to-br from-blue-600/20 to-blue-400/20 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]' :
                            notif.type === 'admin_promotion_invite' ? 'bg-gradient-to-br from-[#FFD700]/20 to-[#D4AF37]/40 border-[#D4AF37]/50 shadow-[0_0_15px_rgba(212,175,55,0.3)] anim-glow' :
                            notif.type === 'social_post' ? 'bg-gradient-to-br from-orange-600/20 to-yellow-500/20 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.2)]' :
                            notif.type === 'transaction' ? (
                              notif.title.includes('رفض') || notif.title.includes('سحب') ? 'bg-gradient-to-br from-red-600/20 to-pink-500/20 border-red-500/30' :
                              notif.title.includes('تعليق') ? 'bg-gradient-to-br from-yellow-600/20 to-amber-500/20 border-yellow-500/30' :
                              'bg-gradient-to-br from-green-600/20 to-emerald-500/20 border-green-500/30'
                            ) :
                            'bg-white/5 border-white/10'
                          }`}>
                            {notif.senderPhoto ? (
                              <Image src={notif.senderPhoto} alt="Sender" width={48} height={48} className="object-cover w-full h-full" />
                            ) : (
                              notif.type === 'offer' || notif.type === 'admin_promotion_invite' ? '🎁' : 
                              notif.type === 'friend_request' ? '🤝' : 
                              notif.type === 'social_post' ? '📜' :
                              notif.type === 'transaction' ? (
                                notif.title.includes('رفض') || notif.title.includes('سحب') ? '💸' :
                                notif.title.includes('تعليق') ? '⏳' :
                                '💰'
                              ) : '🔔'
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-[11px] font-black text-white tracking-wide uppercase">{notif.title}</p>
                              <p className="text-[8px] text-gray-600 font-bold">{notif.createdAt?.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            
                            <div className="flex items-start gap-4">
                              <p className="flex-1 text-[10px] text-gray-400 leading-relaxed font-medium whitespace-pre-wrap">{notif.message}</p>
                              
                              {notif.type === 'friend_request' && notif.status === 'unread' && (
                                <div className="flex flex-col gap-2 shrink-0">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleAcceptFriendRequest(notif); }}
                                    disabled={requestProcessingIds.includes(notif.id)}
                                    className="px-4 py-1.5 bg-green-500 text-white text-[9px] font-black rounded-lg hover:bg-green-600 transition-all shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                                  >
                                    {requestProcessingIds.includes(notif.id) ? 'جاري...' : 'قبول'}
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleRejectFriendRequest(notif); }}
                                    disabled={requestProcessingIds.includes(notif.id)}
                                    className="px-4 py-1.5 bg-red-600/20 text-red-500 border border-red-500/20 text-[9px] font-black rounded-lg hover:bg-red-600/30 transition-all"
                                  >
                                    رفض
                                  </button>
                                </div>
                              )}

                               {notif.type === 'admin_promotion_invite' && (
                                  <div className="flex flex-col gap-2 shrink-0">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleAcceptAdminPromotion(notif); }}
                                      className="px-4 py-1.5 bg-[#D4AF37] text-black text-[9px] font-black rounded-lg hover:scale-105 transition-all shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                                    >
                                      {requestProcessingIds.includes(notif.id) ? 'جاري...' : 'قبول'} المهمة
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleRejectAdminPromotion(notif); }}
                                      className="px-4 py-1.5 bg-red-600/20 text-red-500 border border-red-500/20 text-[9px] font-black rounded-lg hover:bg-red-600/30 transition-all"
                                    >
                                      الرفض
                                    </button>
                                  </div>
                                )}
                              </div>

                            {(notif.type === 'gift' || notif.type === 'loan') && notif.status === 'unread' && (
                              <div className="flex gap-2 mt-3">
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleProcessInteraction({
                                      id: notif.id,
                                      senderId: notif.senderId || '',
                                      amount: (notif as any).amount || 0,
                                      type: notif.type,
                                      returnDate: (notif as any).returnDate,
                                      chatMessageId: (notif as any).chatMessageId
                                    }, 'accept'); 
                                  }}
                                  className="px-3 py-1 bg-green-500 text-black text-[9px] font-black rounded-lg hover:scale-105 transition-all"
                                >
                                  قبول
                                </button>
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleProcessInteraction({
                                      id: notif.id,
                                      senderId: notif.senderId || '',
                                      amount: (notif as any).amount || 0,
                                      type: notif.type,
                                      returnDate: (notif as any).returnDate,
                                      chatMessageId: (notif as any).chatMessageId
                                    }, 'reject'); 
                                  }}
                                  className="px-3 py-1 bg-red-600/20 text-red-500 border border-red-600/30 text-[9px] font-black rounded-lg hover:bg-red-600 hover:text-white transition-all"
                                >
                                  رفض وإعادة
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <button className="w-full p-3 text-[9px] text-gray-500 font-black uppercase hover:text-white transition-colors bg-white/5">
                    الذهاب إلى الأرشيف
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={`w-12 h-12 rounded-full border-2 transition-all p-0.5 relative group/profile ${isProfileOpen ? 'border-[#FFD700] scale-110 shadow-[0_0_20px_rgba(255,215,0,0.3)]' : 'border-[#D4AF37] hover:border-[#FFD700]'}`}
            >
               <UserAvatar 
                 userId={user?.uid || ''} 
                 fallbackPhoto={profileImage || user?.photoURL || ''} 
                 className="w-full h-full"
               />
            </button>

            {/* Profile Detail Popover */}
            {isProfileOpen && (
              <div className="absolute top-full right-0 mt-4 w-72 bg-[#0a0a0a] border border-[#D4AF37]/30 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 duration-300 z-[100]">
                {/* Header with Rank */}
                <div className="bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#D4AF37] p-4 text-black text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/10 opacity-20 transform -skew-x-12 translate-x-1/2"></div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] font-pharaoh">{userData?.rank || 'Soldier'}</p>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* User Basic Info */}
                  <div className="text-center space-y-1">
                    <h4 className="text-lg font-black text-white">{userData?.displayName}</h4>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">ID: {userData?.kingdomId || '--- --- ---'}</p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                      <p className="text-[8px] text-gray-500 font-bold uppercase mb-1">المستوى</p>
                      <p className="text-sm font-black text-[#D4AF37]">{userData?.level || 1}</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                      <p className="text-[8px] text-gray-500 font-bold uppercase mb-1">الأصدقاء</p>
                      <p className="text-sm font-black text-white">{userData?.friendsCount || 0}</p>
                    </div>
                  </div>
                  
                  {/* XP Bar Detailed */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-end text-[9px] font-black uppercase tracking-tighter">
                      <span className="text-gray-500">خبرة القتال (XP)</span>
                      <span className="text-[#FFD700]">{userData?.xp || 0} / 5000</span>
                    </div>
                    <div className="h-2 bg-black border border-white/10 rounded-full overflow-hidden p-0.5">
                      <div 
                        className="h-full bg-gradient-to-r from-[#D4AF37] to-[#FFD700] rounded-full shadow-[0_0_10px_rgba(212,175,55,0.5)] transition-all duration-1000" 
                        style={{ width: `${Math.min(((userData?.xp || 0) / 5000) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Link href="/settings" className="flex items-center justify-between w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-transparent hover:border-white/10 group">
                      <span className="text-[10px] font-black text-gray-400 group-hover:text-white uppercase tracking-widest">إدارة المملكة</span>
                      <span className="text-lg">⚙️</span>
                    </Link>

                    {(userData?.role === 'admin' || user?.email === 'mohemad123hsak@gmail.com') && (
                      <Link href="/admin" className="flex items-center justify-between w-full p-4 bg-purple-500/10 hover:bg-purple-500/20 rounded-2xl transition-all border border-purple-500/20 group animate-in slide-in-from-top-2 duration-500">
                        <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">لوحة التحكم (الإدارة)</span>
                        <span className="text-lg">🛡️</span>
                      </Link>
                    )}

                    <button 
                      onClick={handleLogout}
                      className="w-full py-4 text-[10px] text-red-500/60 font-black uppercase hover:text-red-500 transition-all text-center border border-white/5 rounded-2xl hover:bg-red-500/5"
                    >
                      مغادرة العرش 🚪
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 p-4 md:p-6">
        
        {/* LEFT SIDEBAR: Friends (visible on LG+, hidden or moved on MD) */}
        <aside className="md:col-span-1 lg:col-span-3 order-2 lg:order-1 space-y-6">
          <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-3xl p-4 md:p-6 sticky top-24">
            <h3 className="text-[#FFD700] font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-2">
              <span>👥</span> الأصدقاء النشطون
            </h3>
            <div className="space-y-4">
              {friends.map((friend) => (
                <Link href={`/profile/${friend.id}`} key={friend.id} className="flex items-center justify-between group cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-all">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 overflow-hidden">
                        {friend.photoURL && <Image src={friend.photoURL} alt={friend.displayName} fill className="object-cover" />}
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full shadow-[0_0_5px_#22c55e]"></div>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white group-hover:text-[#FFD700] transition-colors">{friend.displayName}</h4>
                      <p className="text-[8px] text-gray-500 font-bold uppercase">LVL {friend.level || 1}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all scale-75">
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedFriend(friend);
                        setIsChatOpen(true);
                      }}
                      className="w-8 h-8 rounded-lg bg-[#D4AF37] text-black flex items-center justify-center hover:scale-110 transition-transform"
                    >
                      💬
                    </button>
                  </div>
                </Link>
              ))}
              <Link href="/users" className="w-full py-3 text-xs text-[#D4AF37] font-bold border border-[#D4AF37]/10 rounded-xl hover:bg-[#D4AF37]/5 transition-all text-center block">
                البحث عن أصدقاء جديد
              </Link>
            </div>
          </div>
        </aside>

        {/* MIDDLE SECTION: News Feed (6 columns on LG, full width on MD) */}
        <main className="md:col-span-2 lg:col-span-6 order-1 lg:order-2 space-y-6">
          
          {/* Transaction Alerts */}
          {userTransactions.filter(tx => tx.status === 'rejected' || tx.status === 'suspended').map(tx => (
            <div key={tx.id} className={`p-4 rounded-2xl border flex items-start gap-4 animate-in slide-in-from-top-2 duration-300 ${tx.status === 'rejected' ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
              <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-xl ${tx.status === 'rejected' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                {tx.status === 'rejected' ? '❌' : '⏳'}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className={`text-sm font-black ${tx.status === 'rejected' ? 'text-red-500' : 'text-blue-500'}`}>
                    تنبيه بخصوص طلب {tx.type === 'deposit' ? 'إيداع' : 'سحب'} ({tx.amount} EGP)
                  </h4>
                  <span className="text-[8px] text-gray-500 uppercase">{tx.updatedAt?.toDate().toLocaleString('ar-EG')}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  الحالة: <span className="font-bold underline">{tx.status === 'rejected' ? 'تم الرفض' : 'تم التعليق'}</span>
                </p>
                {tx.reason && (
                  <div className="mt-3 p-3 bg-black/40 rounded-xl border border-white/5">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">سبب الإدارة:</p>
                    <p className="text-xs text-gray-200">{tx.reason}</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Create Post Area */}
          <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent"></div>
            <form onSubmit={handleCreatePost}>
              <div className="space-y-6">
                <div className="flex items-center gap-4 px-2">
                  <div className="w-14 h-14 rounded-full border-2 border-[#D4AF37] p-1 bg-gradient-to-tr from-[#FFD700] via-[#D4AF37] to-transparent shrink-0">
                  <UserAvatar 
                    userId={user?.uid || ''} 
                    fallbackPhoto={profileImage || ''} 
                    className="w-full h-full"
                  />
                  </div>
                  <div>
                    <h3 className="text-lg font-black font-pharaoh tracking-wider text-[#FFD700] leading-none">{user?.displayName}</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">إصدار مرسوم ملكي جديد</p>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <textarea 
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder={`بماذا تفكر يا ${user?.displayName?.split(' ')[0] || 'بطل'}؟`}
                    className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-6 text-sm focus:outline-none focus:border-[#D4AF37]/40 min-h-[120px] transition-all placeholder:text-gray-600 font-arabic leading-relaxed shadow-inner"
                  />
                  <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="flex gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
                      <button 
                        type="button"
                        onClick={() => setPostVisibility('public')}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${postVisibility === 'public' ? 'bg-[#D4AF37] text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                      >
                        🌍 عام
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPostVisibility('friends')}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${postVisibility === 'friends' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                      >
                        👥 أصدقاء
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPostVisibility('private')}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${postVisibility === 'private' ? 'bg-gray-700 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                      >
                         خاص
                      </button>
                    </div>
                    
                    <button 
                      type="submit"
                      disabled={!postContent.trim() || isProcessing}
                      className="px-8 py-3 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black text-xs font-black uppercase rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-[#D4AF37]/40 disabled:opacity-50 disabled:grayscale"
                    >
                      {isProcessing ? 'جاري النشر...' : 'نشر المرسوم 📜'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Posts Feed */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[#FFD700] font-black text-sm uppercase tracking-[0.2em]">آخر أخبار المملكة</h3>
              <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                <button 
                  onClick={() => setFeedFilter('all')}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${feedFilter === 'all' ? 'bg-[#D4AF37] text-black' : 'text-gray-500 hover:text-white'}`}
                >
                  🌍 الجميع
                </button>
                <button 
                  onClick={() => setFeedFilter('friends')}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${feedFilter === 'friends' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                >
                  👥 الأصدقاء
                </button>
              </div>
            </div>
            
            {news.length === 0 ? (
              <div className="text-center py-20 bg-[#0a0a0a] rounded-3xl border border-white/5 space-y-4">
                <span className="text-4xl">📜</span>
                <p className="text-gray-500 text-xs">لا يوجد أخبار حالياً في المملكة.</p>
              </div>
            ) : (
              news.map((post) => (
                <div 
                  key={post.id} 
                  id={`post-${post.id}`}
                  className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden group hover:border-[#D4AF37]/30 transition-all animate-in fade-in slide-in-from-bottom-4 duration-500 target:border-[#D4AF37] target:ring-2 target:ring-[#D4AF37]/20"
                >
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <Link href={`/profile/${post.authorId}`} className="flex items-center gap-3 group/author">
                        <UserAvatar 
                          userId={post.authorId} 
                          fallbackName={post.authorName} 
                          fallbackPhoto={post.authorPhotoURL || post.authorPhoto}
                          className="w-10 h-10 border border-white/10 group-hover/author:border-[#D4AF37] transition-all"
                        />
                        <div>
                          <h4 className="text-sm font-black text-white leading-none group-hover/author:text-[#FFD700] transition-all">{post.authorName}</h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">
                              {post.createdAt?.toDate().toLocaleString('ar-EG', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[8px] px-1.5 py-0.5 bg-white/5 rounded-md text-gray-400 font-bold uppercase tracking-tighter">
                              {post.visibility === 'public' ? '🌍 عام' : post.visibility === 'friends' ? '👥 الأصدقاء' : '🔒 خاص'}
                            </span>
                          </div>
                        </div>
                      </Link>

                      {(post.authorId === user?.uid || userData?.rank === 'Pharaoh') && (
                        <button 
                          onClick={() => handleDeletePost(post)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                        >
                          🗑️
                        </button>
                      )}
                    </div>

                    <p className="text-sm text-gray-200 leading-relaxed font-arabic whitespace-pre-wrap">{post.content}</p>
                    
                    {post.imageURL && (
                      <div className="relative aspect-video rounded-2xl overflow-hidden mt-2 border border-white/5 bg-gray-800">
                        <Image src={post.imageURL} alt="Post Content" fill className="object-cover" />
                      </div>
                    )}

                    <div className="flex items-center gap-6 pt-4 border-t border-white/5">
                      <button 
                        onClick={() => handleToggleLike(post)}
                        className={`flex items-center gap-2 text-[10px] font-black transition-all group/btn ${post.likes?.includes(user?.uid || '') ? 'text-[#D4AF37]' : 'text-gray-500 hover:text-[#D4AF37]'}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${post.likes?.includes(user?.uid || '') ? 'bg-[#D4AF37]/20' : 'bg-white/5 group-hover/btn:bg-[#D4AF37]/10'}`}>
                          {post.likes?.includes(user?.uid || '') ? '🔥' : '👑'}
                        </div>
                        <span>{post.likesCount || 0} تفاعل</span>
                      </button>
                      
                      <button className="flex items-center gap-2 text-[10px] font-black text-gray-500 hover:text-[#D4AF37] transition-all group/btn">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover/btn:bg-[#D4AF37]/10 transition-all">💬</div>
                        <span>{post.commentsCount || 0} تعليق</span>
                      </button>
                      
                      <button 
                        onClick={() => handleSharePost(post)}
                        className="flex items-center gap-2 text-[10px] font-black text-gray-500 hover:text-[#D4AF37] transition-all group/btn"
                      >
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover/btn:bg-[#D4AF37]/10 transition-all">🔱</div>
                        <span>{post.sharesCount || 0} مشاركة</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        {/* RIGHT SIDEBAR: Games (3 columns on LG, half width on MD) */}
        <aside className="md:col-span-1 lg:col-span-3 order-3 space-y-6">
          <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-3xl p-4 md:p-6 lg:sticky lg:top-24">
            <h3 className="text-[#FFD700] font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-2 text-right justify-end">
               ألعاب المملكة <span>🏛️</span>
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {games.map((game) => (
                <Link href={game.link} key={game.id}>
                  <div className="bg-black/40 border border-white/5 p-4 rounded-2xl group hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/5 transition-all cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <p className="text-xs font-bold text-gray-200 group-hover:text-[#FFD700] transition-colors">{game.name}</p>
                        <p className="text-[9px] text-gray-500 uppercase mt-1">{game.members} لاعب الآن</p>
                      </div>
                      <span className="text-3xl group-hover:scale-110 transition-transform">{game.icon}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            
            {activeOffer ? (
              <div className="mt-8 p-4 bg-gradient-to-br from-[#FFD700]/10 to-transparent border border-[#D4AF37]/20 rounded-2xl animate-pulse">
                <p className="text-[10px] text-[#D4AF37] font-black uppercase mb-2">عرض اليوم الملكي 🎁</p>
                <p className="text-xs font-bold text-gray-200 mb-4">{activeOffer.value}</p>
                <Link href="/deposit" className="w-full py-2 bg-[#D4AF37] text-black font-black text-[10px] rounded-lg shadow-lg text-center block">إحصل عليه الآن</Link>
                <p className="text-[8px] text-gray-500 mt-2 text-center uppercase tracking-tighter">
                  ينتهي في: {activeOffer.expiresAt.toDate().toLocaleTimeString('ar-EG')}
                </p>
              </div>
            ) : (
              <div className="mt-8 p-4 bg-white/5 border border-white/5 rounded-2xl text-center">
                <p className="text-[10px] text-gray-500 uppercase font-black">لا توجد عروض حالياً</p>
                <p className="text-[9px] text-gray-400 mt-1">ترقب عروض الفرعون القادمة!</p>
              </div>
            )}
          </div>
        </aside>

      </div>
      {/* Cropping Modal removed */}

      {/* NEW OFFER POPUP MODAL */}
      {showOfferModal && activeOffer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-500 font-sans">
          <div className="bg-[#0a0a0a] border-2 border-[#D4AF37] rounded-[40px] w-full max-w-lg p-10 text-center shadow-[0_0_100px_rgba(212,175,55,0.3)] relative overflow-hidden">
            {/* Egyptian Decorative Patterns */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"></div>
            
            <div className="mb-8 relative">
              <div className="w-24 h-24 bg-gradient-to-br from-[#FFD700] to-[#D4AF37] rounded-full mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.4)] animate-bounce">
                <span className="text-5xl">🎁</span>
              </div>
            </div>

            <h2 className="text-3xl font-black font-pharaoh tracking-widest text-[#FFD700] mb-4 uppercase">منحة من الفرعون!</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">أيها الملك العظيم، لقد أصدر الفرعون مرسوماً ملكياً بمنحك عرضاً خاصاً لفترة محدودة:</p>
            
            <div className="bg-white/5 border border-[#D4AF37]/30 rounded-3xl p-8 mb-8 group hover:bg-[#D4AF37]/10 transition-all duration-500">
              <p className="text-2xl md:text-3xl font-black text-white group-hover:scale-105 transition-transform">{activeOffer.value}</p>
            </div>

            <div className="space-y-4">
              <Link 
                href="/deposit" 
                onClick={closeOfferModal}
                className="w-full py-5 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-black rounded-2xl shadow-xl hover:scale-[1.05] transition-all flex items-center justify-center gap-3 text-lg"
              >
                <span>🔥</span>
                <span>اغتنم الفرصة الآن</span>
              </Link>
              <button 
                onClick={closeOfferModal}
                className="w-full text-gray-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors py-2"
              >
                سأفعل ذلك لاحقاً أيها الوزير
              </button>
            </div>

            {/* Expiry Badge */}
            <div className="mt-8 inline-block px-4 py-1 bg-red-600/20 border border-red-600/30 rounded-full">
              <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">
                تنتهي الصلاحية: {activeOffer.expiresAt.toDate().toLocaleTimeString('ar-EG')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTION / CHAT MODAL */}
      {isChatOpen && selectedFriend && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300 font-sans">
          <div className="bg-[#0a0a0a] border-2 border-[#D4AF37]/30 rounded-[40px] w-full max-w-lg overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#D4AF37] p-6 text-black flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${selectedFriend.id}`} className="w-12 h-12 rounded-full bg-black/20 border-2 border-black/10 overflow-hidden relative hover:scale-110 transition-transform">
                  {selectedFriend?.photoURL && <Image src={selectedFriend.photoURL} alt={selectedFriend.displayName} fill className="object-cover" />}
                </Link>
                <div>
                  <Link href={`/profile/${selectedFriend.id}`} className="font-black text-sm uppercase leading-none hover:underline">{selectedFriend?.displayName}</Link>
                  <p className="text-[9px] font-bold opacity-60 uppercase mt-1">LVL {selectedFriend?.level || 1} • {selectedFriend?.rank || 'Soldier'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex bg-black/10 p-1 rounded-xl border border-black/5 mr-2">
                  <button 
                    onClick={() => setInteractionType('chat')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${interactionType === 'chat' ? 'bg-black text-[#FFD700]' : 'text-black/60 hover:text-black'}`}
                  >💬 محادثة</button>
                  <button 
                    onClick={() => setInteractionType('gift')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${interactionType === 'gift' ? 'bg-black text-[#FFD700]' : 'text-black/60 hover:text-black'}`}
                  >🎁 هدية</button>
                  <button 
                    onClick={() => setInteractionType('loan')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${interactionType === 'loan' ? 'bg-black text-[#FFD700]' : 'text-black/60 hover:text-black'}`}
                  >🤝 تسليف</button>
                </div>

                <button 
                  onClick={() => setShowUnfriendConfirm(true)}
                  disabled={isProcessing}
                  className="w-10 h-10 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 rounded-xl flex items-center justify-center transition-all disabled:opacity-50"
                  title="إلغاء الصداقة"
                >💔</button>
                <div className="w-px h-6 bg-black/10 mx-1"></div>
                <button 
                  onClick={async () => {
                    if (!user || !selectedFriend) return;
                    setCallType('voice');
                    setIsCalling(true);
                    try {
                      const callRef = await addDoc(collection(db, 'calls'), {
                        callerId: user.uid,
                        callerName: user.displayName,
                        callerPhoto: user.photoURL || '',
                        recipientId: selectedFriend.id,
                        type: 'voice',
                        status: 'ringing',
                        createdAt: serverTimestamp()
                      });
                      setOutgoingCallId(callRef.id);
                    } catch (err) {
                      console.error(err);
                      setIsCalling(false);
                    }
                  }}
                  className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center hover:bg-black/20 transition-all text-xl"
                  title="مكالمة صوتية"
                >📞</button>
                <button 
                  onClick={async () => {
                    if (!user || !selectedFriend) return;
                    setCallType('video');
                    setIsCalling(true);
                    try {
                      const callRef = await addDoc(collection(db, 'calls'), {
                        callerId: user.uid,
                        callerName: user.displayName,
                        callerPhoto: user.photoURL || '',
                        recipientId: selectedFriend.id,
                        type: 'video',
                        status: 'ringing',
                        createdAt: serverTimestamp()
                      });
                      setOutgoingCallId(callRef.id);
                    } catch (err) {
                      console.error(err);
                      setIsCalling(false);
                    }
                  }}
                  className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center hover:bg-black/20 transition-all text-xl"
                  title="مكالمة فيديو"
                >📹</button>
                <button 
                  onClick={() => {
                    setIsChatOpen(false);
                    setInteractionType('chat');
                    setIsEmojiPickerOpen(false);
                  }}
                  className="w-10 h-10 rounded-xl bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white transition-all text-xl"
                  title="إغلاق المحادثة"
                >✕</button>
              </div>
            </div>

            <div className="p-8 space-y-6">
                    {/* Check for pending gifts/loans from THIS friend */}
                    {notifications.filter(n => n.senderId === selectedFriend.id && (n.type === 'gift' || n.type === 'loan') && n.status === 'unread').length > 0 && (
                      <div className="space-y-4 mb-6">
                        <p className="text-[10px] text-[#D4AF37] font-black uppercase text-center tracking-widest">لديك عروض معلقة من {selectedFriend.displayName}</p>
                        {notifications
                          .filter(n => n.senderId === selectedFriend.id && (n.type === 'gift' || n.type === 'loan') && n.status === 'unread')
                          .map(notif => (
                            <div key={notif.id} className="bg-white/5 border border-white/10 p-5 rounded-[25px] space-y-4 animate-in zoom-in-95 duration-300">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{notif.type === 'gift' ? '🎁' : '🤝'}</span>
                                <div className="text-right">
                                  <p className="text-xs font-black text-white">{notif.type === 'gift' ? 'هدية ملكية' : 'طلب تسليف'}</p>
                                  <p className="text-[14px] font-black text-[#FFD700]">{notif.amount} EGP</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleProcessInteraction({
                                    id: notif.id,
                                    senderId: notif.senderId || '',
                                    amount: (notif as any).amount || 0,
                                    type: notif.type,
                                    returnDate: (notif as any).returnDate,
                                    chatMessageId: (notif as any).chatMessageId
                                  }, 'accept')}
                                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase hover:scale-105 transition-all"
                                >
                                  ✅ قبول واستلام
                                </button>
                                <button 
                                  onClick={() => handleProcessInteraction({
                                    id: notif.id,
                                    senderId: notif.senderId || '',
                                    amount: (notif as any).amount || 0,
                                    type: notif.type,
                                    returnDate: (notif as any).returnDate,
                                    chatMessageId: (notif as any).chatMessageId
                                  }, 'reject')}
                                  className="flex-1 py-3 bg-red-600/10 text-red-500 border border-red-600/20 rounded-xl font-black text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all"
                                >
                                  رفض
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Main Content Area: Chat or Interaction Form */}
                    {interactionType === 'chat' ? (
                      <div className="flex-1 overflow-y-auto space-y-4 min-h-[300px] max-h-[400px] pr-2 scrollbar-hide py-4 border-t border-white/5">
                        {/* Quick Interaction Cards */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                          <button 
                            onClick={() => setInteractionType('gift')}
                            className="bg-purple-600/10 border border-purple-500/30 p-4 rounded-3xl group hover:bg-purple-600/20 transition-all text-right relative overflow-hidden"
                          >
                            <div className="absolute -right-2 -bottom-2 text-4xl opacity-10 group-hover:scale-110 transition-transform">🎁</div>
                            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">منحة ملكية</p>
                            <p className="text-xs font-bold text-white">إرسال هدية 🎁</p>
                          </button>
                          <button 
                            onClick={() => setInteractionType('loan')}
                            className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-3xl group hover:bg-blue-600/20 transition-all text-right relative overflow-hidden"
                          >
                            <div className="absolute -right-2 -bottom-2 text-4xl opacity-10 group-hover:scale-110 transition-transform">🤝</div>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">تسليف أخوي</p>
                            <p className="text-xs font-bold text-white">طلب تسليف 🤝</p>
                          </button>
                        </div>

                        {messages.length === 0 ? (
                          <div className="text-center py-10 space-y-4">
                            <span className="text-5xl block opacity-20">💬</span>
                            <p className="text-gray-500 text-sm">ابدأ محادثة ملكية مع {selectedFriend.displayName}</p>
                          </div>
                        ) : (
                          messages.map((msg) => {
                            const isMe = msg.senderId === user?.uid;
                            const isInteraction = msg.type === 'gift' || msg.type === 'loan';
                            const isShare = msg.type === 'share';
                            const isClaimed = msg.status === 'accepted';
                            const isRejected = msg.status === 'rejected';

                            return (
                              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div 
                                  onClick={() => {
                                    if (!isMe && msg.status === 'pending' && msg.notificationId) {
                                      handleProcessInteraction({
                                        id: msg.notificationId,
                                        senderId: msg.senderId,
                                        amount: msg.amount || 0,
                                        type: msg.type || 'gift',
                                      }, 'accept', msg.id);
                                    } else if (isShare && msg.postId) {
                                      setIsChatOpen(false);
                                      setTimeout(() => {
                                        const el = document.getElementById(`post-${msg.postId}`);
                                        if (el) {
                                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                          el.classList.add('ring-2', 'ring-[#FFD700]');
                                          setTimeout(() => el.classList.remove('ring-2', 'ring-[#FFD700]'), 3000);
                                        }
                                      }, 300);
                                    }
                                  }}
                                  className={`max-w-[85%] p-4 rounded-2xl text-xs font-medium shadow-lg transition-all ${
                                    isInteraction 
                                      ? (isMe ? 'bg-purple-600/20 border border-purple-500/30' : 'bg-blue-600/20 border border-blue-500/30 cursor-pointer hover:scale-[1.02] hover:bg-blue-600/30') 
                                      : isShare
                                      ? 'bg-[#1a1a1a] border border-[#D4AF37]/40 cursor-pointer hover:bg-[#D4AF37]/10'
                                      : (isMe ? 'bg-[#D4AF37] text-black rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none border border-white/10')
                                  }`}
                                >
                                  {isShare ? (
                                    <div className="space-y-3 min-w-[200px]">
                                      <div className="flex items-center gap-2 pb-2 border-b border-[#D4AF37]/20">
                                        <div className="w-6 h-6 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[10px]">📜</div>
                                        <p className="font-black text-[9px] text-[#D4AF37] uppercase tracking-widest">مرسوم مشترك</p>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <p className="font-bold text-[10px] text-gray-400">كتبه المحارب: {msg.sharedPostAuthor}</p>
                                        <p className="text-white line-clamp-3 leading-relaxed">{msg.sharedPostContent}</p>
                                        {msg.sharedPostImage && (
                                          <div className="relative aspect-video rounded-xl overflow-hidden border border-white/5">
                                            <Image src={msg.sharedPostImage} alt="Shared Post" fill className="object-cover" />
                                          </div>
                                        )}
                                      </div>

                                      <div className="pt-2">
                                        <div className="bg-[#D4AF37] text-black text-center py-2 rounded-lg font-black text-[8px] uppercase tracking-widest">
                                          عرض المرسوم الأصلي ↑
                                        </div>
                                      </div>
                                    </div>
                                    ) : msg.type === 'voice' ? (
                                      <div className="flex items-center gap-3 min-w-[200px] py-1">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleTogglePlayback(msg.id); }}
                                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border border-white/5 ${playingMessageId === msg.id ? 'bg-[#FFD700] text-black scale-110' : 'bg-black/20 hover:bg-black/40'}`}
                                        >
                                          <span className="text-lg">{playingMessageId === msg.id ? '⏸️' : '▶️'}</span>
                                        </button>
                                        
                                        <div className="flex-1 space-y-2">
                                          {/* Waveform Visualization */}
                                          <div className="flex items-end gap-[2px] h-6 relative">
                                            {/* Progress Overlay */}
                                            {playingMessageId === msg.id && (
                                              <div 
                                                className="absolute inset-0 bg-[#FFD700]/20 rounded-full pointer-events-none transition-all duration-100"
                                                style={{ width: `${playbackProgress}%` }}
                                              ></div>
                                            )}
                                            
                                            {[0.3, 0.6, 0.4, 0.8, 0.2, 0.9, 0.5, 0.3, 0.7, 0.4, 0.6, 0.8, 0.3, 0.5, 0.2, 0.6, 0.4, 0.9].map((h, i) => {
                                              const barProgress = (i / 18) * 100;
                                              const isActive = playingMessageId === msg.id && playbackProgress >= barProgress;
                                              return (
                                                <div 
                                                  key={i} 
                                                  className={`w-[3px] rounded-full transition-all duration-300 ${isActive ? 'bg-[#FFD700] h-[90%]' : 'bg-black/20 h-[60%]'}`} 
                                                  style={{ height: isActive ? undefined : `${h * 100}%` }}
                                                ></div>
                                              );
                                            })}
                                          </div>
                                          <div className="flex justify-between items-center text-[8px] font-black uppercase opacity-60">
                                            <span className={playingMessageId === msg.id ? 'text-[#FFD700] animate-pulse' : ''}>
                                              {playingMessageId === msg.id ? 'جاري الاستماع...' : 'برقية صوتية'}
                                            </span>
                                            <span>{formatTime(msg.duration || 0)}</span>
                                          </div>
                                        </div>
                                        
                                        <div className={`text-xl transition-all ${playingMessageId === msg.id ? 'scale-125 rotate-12' : ''}`}>🎤</div>
                                      </div>
                                  ) : isInteraction ? (
                                    <div className="space-y-4 min-w-[220px]">
                                      <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-black/40 rounded-full flex items-center justify-center text-2xl border border-white/10">
                                          {msg.type === 'gift' ? '🎁' : '🤝'}
                                        </div>
                                        <div>
                                          <p className="font-black text-[10px] text-gray-400 uppercase tracking-widest">{msg.type === 'gift' ? 'هدية ملكية' : 'طلب تسليف'}</p>
                                          <p className="text-xl font-black text-[#FFD700]">{msg.amount?.toLocaleString()} EGP</p>
                                        </div>
                                      </div>
                                      
                                      {!isMe && msg.status === 'pending' && (
                                        <div className="flex gap-2 pt-2">
                                          <button 
                                            onClick={(e) => { 
                                              e.stopPropagation(); 
                                              if (msg.notificationId) {
                                                handleProcessInteraction({
                                                  id: msg.notificationId,
                                                  senderId: msg.senderId,
                                                  amount: msg.amount || 0,
                                                  type: msg.type || 'gift',
                                                }, 'accept', msg.id);
                                              }
                                            }}
                                            className="flex-1 py-3 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-green-900/20 hover:bg-green-500 transition-colors"
                                          >
                                            استلام الآن
                                          </button>
                                          <button 
                                            onClick={(e) => { 
                                              e.stopPropagation(); 
                                              if (msg.notificationId) {
                                                handleProcessInteraction({
                                                  id: msg.notificationId,
                                                  senderId: msg.senderId,
                                                  amount: msg.amount || 0,
                                                  type: msg.type || 'gift',
                                                }, 'reject', msg.id);
                                              }
                                            }}
                                            className="flex-1 py-3 bg-red-600/20 text-red-400 border border-red-600/30 rounded-xl font-black text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all"
                                          >
                                            رفض
                                          </button>
                                        </div>
                                      )}

                                      {isClaimed && (
                                        <div className="pt-2 flex items-center justify-center gap-2 py-2 px-4 bg-white/5 rounded-xl border border-white/5">
                                          <span className="text-gray-500 font-bold uppercase text-[9px]">تم الاستلام بنجاح</span>
                                          <span className="text-green-500">✅</span>
                                        </div>
                                      )}

                                      {isRejected && (
                                        <div className="pt-2 flex items-center justify-center gap-2 py-2 px-4 bg-white/5 rounded-xl border border-white/5">
                                          <span className="text-gray-500 font-bold uppercase text-[9px]">تم الرفض</span>
                                          <span className="text-red-500">❌</span>
                                        </div>
                                      )}

                                      {isMe && msg.status === 'pending' && (
                                        <p className="text-[9px] text-gray-500 italic text-center py-2 px-3 bg-black/20 rounded-lg">في انتظار قبول الملك الآخر...</p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="leading-relaxed">{msg.text}</p>
                                  )}
                                  
                                  <p className={`text-[8px] mt-2 font-bold uppercase opacity-50 ${isMe && !isInteraction ? 'text-black' : 'text-gray-400'}`}>
                                    {msg.createdAt?.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-10 space-y-8 animate-in zoom-in-95 duration-500 min-h-[400px]">
                        <div className="w-24 h-24 bg-gradient-to-br from-[#FFD700] to-[#D4AF37] rounded-full flex items-center justify-center text-5xl shadow-[0_0_50px_rgba(212,175,55,0.3)] animate-bounce">
                          {interactionType === 'gift' ? '🎁' : '🤝'}
                        </div>
                        
                        <div className="text-center space-y-2">
                          <h3 className="text-xl font-black text-white uppercase tracking-widest font-pharaoh">
                            {interactionType === 'gift' ? 'إرسال منحة ملكية' : 'طلب تسليف أخوي'}
                          </h3>
                          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-tighter">أدخل المبلغ المطلوب وقم بتأكيد العملية</p>
                        </div>

                        <div className="w-full max-w-xs space-y-6">
                          <div className="relative group">
                            <input 
                              type="number" 
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              placeholder="أدخل المبلغ (EGP)"
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-center text-2xl font-black text-[#FFD700] focus:outline-none focus:border-[#D4AF37] transition-all"
                            />
                            <div className="absolute inset-0 rounded-2xl bg-[#D4AF37]/5 pointer-events-none group-focus-within:bg-transparent transition-colors"></div>
                          </div>

                          {interactionType === 'loan' && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-2">موعد رد التسليف</label>
                              <input 
                                type="date"
                                value={returnDate}
                                onChange={(e) => setReturnDate(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                              />
                            </div>
                          )}

                          <div className="pt-4 flex gap-4">
                            <button 
                              onClick={() => setInteractionType('chat')}
                              className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-gray-400 font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all"
                            >إلغاء</button>
                            <button 
                              onClick={handleSendInteraction}
                              disabled={isProcessing || !amount}
                              className="flex-2 py-4 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-black rounded-2xl shadow-xl hover:scale-105 transition-all text-[12px] uppercase tracking-widest"
                            >
                              {isProcessing ? 'جاري الإرسال...' : (interactionType === 'gift' ? 'إرسال الهدية 🔥' : 'إرسال الطلب 🤝')}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 max-w-sm">
                          <span className="text-xl">🛡️</span>
                          <p className="text-[9px] text-gray-500 leading-relaxed font-bold italic">
                            سيتم خصم المبلغ من رصيدك فوراً وحفظه في خزانة المملكة (Escrow) حتى يقبل الطرف الآخر العملية.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Chat Input Only visible in chat mode */}
                    {interactionType === 'chat' && (
                      <form onSubmit={handleSendMessage} className="relative mt-6 flex items-center gap-3">
                        <div className="flex gap-2 relative">
                          <button 
                            type="button"
                            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                            className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-xl hover:bg-white/10 transition-all"
                          >😊</button>
                          
                          {isEmojiPickerOpen && (
                            <div className="absolute bottom-16 left-0 bg-[#0a0a0a] border border-[#D4AF37]/30 rounded-2xl p-4 shadow-2xl z-[300] grid grid-cols-6 gap-2 w-64 animate-in slide-in-from-bottom-2 duration-300">
                              {['❤️', '🔥', '⚔️', '🦅', '🦁', '👑', '🔱', '📜', '⚖️', '🗝️', '🏺', '🌞', '🌙', '⭐', '✨', '⚡', '💣', '🛡️'].map(emoji => (
                                <button 
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    setNewMessage(prev => prev + emoji);
                                    setIsEmojiPickerOpen(false);
                                  }}
                                  className="text-xl hover:bg-white/5 p-2 rounded-lg transition-all"
                                >{emoji}</button>
                              ))}
                            </div>
                          )}

                          <button 
                            type="button"
                            onMouseDown={() => {
                              setIsRecording(true);
                              // Logic for actual media recording would go here
                              showStatus('جاري تسجيل برقية صوتية... 🎤', 'info');
                            }}
                            onMouseUp={async () => {
                              if (!isRecording || !selectedFriend || !user) {
                                setIsRecording(false);
                                return;
                              }
                              
                              const finalDuration = recordingTime;
                              setIsRecording(false);
                              
                              try {
                                const chatID = [user.uid, selectedFriend.id].sort().join('_');
                                await addDoc(collection(db, 'chats', chatID, 'messages'), {
                                  senderId: user.uid,
                                  text: '🎤 برقية صوتية',
                                  type: 'voice',
                                  duration: finalDuration || 1,
                                  status: 'sent',
                                  createdAt: serverTimestamp()
                                });
                                showStatus('تم إرسال البرقية الصوتية بنجاح 🏹', 'success');
                              } catch (err) {
                                console.error(err);
                                showStatus('فشل في إرسال البرقية.', 'error');
                              }
                            }}
                            className={`w-12 h-12 border rounded-2xl flex items-center justify-center text-xl transition-all ${isRecording ? 'bg-red-500 border-red-400 animate-pulse scale-110 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                          >
                            {isRecording ? <span className="text-[10px] font-black text-white">{formatTime(recordingTime)}</span> : '🎤'}
                          </button>
                        </div>

                        <div className="relative flex-1">
                          <input 
                            type="text" 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="اكتب رسالتك للمحارب..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-[#D4AF37]/40 transition-all"
                          />
                          <button 
                            type="submit"
                            disabled={!newMessage.trim() || isProcessing}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#D4AF37] text-black rounded-xl flex items-center justify-center font-black hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                          >🏹</button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}

      {/* LUXURY CALLING MODAL (Visual Mockup) */}
      {isCalling && selectedFriend && (
        <div className="fixed inset-0 z-[400] bg-black flex flex-col items-center justify-between py-20 px-6 animate-in fade-in duration-500">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            {selectedFriend.photoURL && <Image src={selectedFriend.photoURL} alt="Bg" fill className="object-cover blur-3xl" />}
          </div>

          {/* Caller Info */}
          <div className="relative z-10 text-center space-y-6">
            <div className="relative inline-block">
              {/* Ringing Rings Animation */}
              <div className="absolute inset-0 rounded-full bg-[#D4AF37]/20 animate-ping duration-[3s]"></div>
              <div className="absolute inset-0 rounded-full bg-[#D4AF37]/10 animate-ping duration-[3s] delay-1000"></div>
              
              <div className="w-32 h-32 rounded-full border-4 border-[#D4AF37] overflow-hidden relative shadow-[0_0_50px_rgba(212,175,55,0.4)]">
                {selectedFriend.photoURL ? (
                  <Image src={selectedFriend.photoURL} alt={selectedFriend.displayName} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-4xl text-[#D4AF37]">
                    {selectedFriend.displayName.charAt(0)}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black text-white">{selectedFriend.displayName}</h2>
              <p className="text-[#D4AF37] font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">
                {activeCallStatus === 'ringing' 
                  ? (callType === 'voice' ? 'جاري الاتصال صوياً...' : 'جاري فتح قناة الفيديو...')
                  : `مكالمة نشطة • ${formatTime(callDuration)}`
                }
              </p>
            </div>
          </div>

          {/* Video Placeholder if Video Call */}
          {callType === 'video' && activeCallStatus === 'active' && (
            <div className="w-full max-w-sm aspect-[3/4] bg-white/5 rounded-[40px] border-2 border-[#D4AF37]/30 flex items-center justify-center relative overflow-hidden">
               {/* Remote Video Placeholder */}
               <Image src={selectedFriend.photoURL || ''} alt="Video" fill className="object-cover opacity-50 blur-sm" />
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="text-center space-y-4">
                   <div className="w-20 h-20 rounded-full border-2 border-[#D4AF37] mx-auto overflow-hidden">
                     {selectedFriend.photoURL && <Image src={selectedFriend.photoURL} alt="Friend" width={80} height={80} className="object-cover" />}
                   </div>
                   <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest animate-pulse">جاري استقبال البث الملكي...</p>
                 </div>
               </div>

               {/* Local Self Video */}
               <div className="absolute top-6 right-6 w-24 h-32 bg-black border border-[#D4AF37]/50 rounded-2xl overflow-hidden shadow-2xl z-20">
                 <video 
                   ref={localVideoRef} 
                   autoPlay 
                   playsInline 
                   muted 
                   className="w-full h-full object-cover scale-x-[-1]"
                 />
               </div>
               <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-black to-transparent"></div>
            </div>
          )}

          {/* Call Controls */}
          <div className="relative z-10 w-full max-w-sm grid grid-cols-3 gap-8 items-center justify-center">
            <button className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl hover:bg-white/20 transition-all border border-white/5">
              {callType === 'voice' ? '🔇' : '📷'}
            </button>
            <button 
              onClick={async () => {
                if (outgoingCallId) {
                  await updateDoc(doc(db, 'calls', outgoingCallId), { status: 'ended' });
                }
                setIsCalling(false);
                setOutgoingCallId(null);
                setActiveCallStatus('ringing');
                setCallDuration(0);
              }}
              className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-3xl shadow-[0_0_40px_rgba(220,38,38,0.4)] hover:scale-110 active:scale-90 transition-all"
            >
              🤙
            </button>
            <button className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl hover:bg-white/20 transition-all border border-white/5">
              {callType === 'voice' ? '🔊' : '🔄'}
            </button>
          </div>

          {/* Luxury Footer Decor */}
          <div className="relative z-10 text-center">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <span className="w-8 h-px bg-white/10"></span>
              المكالمة مشفرة ملكياً
              <span className="w-8 h-px bg-white/10"></span>
            </p>
          </div>
        </div>
      )}

      {/* INCOMING CALL MODAL */}
      {activeCallSession && (
        <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-6 animate-in zoom-in duration-500">
          <div className="relative mb-12">
            <div className="absolute inset-0 rounded-full bg-[#D4AF37]/30 animate-ping"></div>
            <div className="w-40 h-40 rounded-full border-4 border-[#D4AF37] overflow-hidden relative shadow-[0_0_80px_rgba(212,175,55,0.6)]">
              {activeCallSession.callerPhoto ? (
                <Image src={activeCallSession.callerPhoto} alt="Caller" fill className="object-cover" />
              ) : (
                <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-5xl font-pharaoh text-[#D4AF37]">
                  {activeCallSession.callerName?.charAt(0)}
                </div>
              )}
            </div>
          </div>

          <div className="text-center space-y-4 mb-20 animate-bounce">
            <h2 className="text-3xl font-black text-white uppercase tracking-widest">{activeCallSession.callerName}</h2>
            <p className="text-[#D4AF37] font-black text-sm uppercase tracking-[0.2em] flex items-center gap-2 justify-center">
              <span>{activeCallSession.type === 'voice' ? '📞' : '📹'}</span>
              مكالمة {activeCallSession.type === 'voice' ? 'صوتية' : 'فيديو'} واردة...
            </p>
          </div>

          <div className="flex gap-12">
            <button 
              onClick={async () => {
                await updateDoc(doc(db, 'calls', activeCallSession.id), { status: 'rejected' });
                setActiveCallSession(null);
              }}
              className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-4xl shadow-[0_0_40px_rgba(220,38,38,0.3)] hover:scale-110 active:scale-95 transition-all outline-none"
            >
              ✖️
            </button>
            <button 
              onClick={async () => {
                await updateDoc(doc(db, 'calls', activeCallSession.id), { status: 'accepted' });
                setActiveCallStatus('active');
                if (!isChatOpen) {
                  const friend = friends.find(f => f.id === activeCallSession.callerId);
                  if (friend) setSelectedFriend(friend);
                }
                setIsCalling(true);
                setCallType(activeCallSession.type);
                setActiveCallSession(null);
              }}
              className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center text-4xl shadow-[0_0_40px_rgba(34,197,94,0.3)] hover:scale-110 active:scale-95 transition-all animate-bounce"
            >
              ✔️
            </button>
          </div>
        </div>
      )}

      {/* CUSTOM UNFRIEND CONFIRMATION MODAL */}
      {showUnfriendConfirm && selectedFriend && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-[#0a0a0a] border-2 border-red-600/30 rounded-[40px] w-full max-w-sm overflow-hidden shadow-[0_0_100px_rgba(220,38,38,0.2)] p-10 text-center relative">
            {/* Egyptian Pattern Overlay */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>
            
            <div className="mb-8">
              <div className="w-20 h-20 bg-red-600/10 border-2 border-red-600/30 rounded-full mx-auto flex items-center justify-center text-4xl animate-pulse">
                💔
              </div>
            </div>

            <h3 className="text-xl font-black text-white uppercase tracking-widest font-pharaoh mb-4">إنهاء التحالف!</h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-8">
              أيها الملك، هل أنت متأكد من إلغاء الصداقة مع المحارب <span className="text-red-500 font-black">{selectedFriend.displayName}</span>؟ 
              هذا القرار سيقطع حبال المودة والتحالف بين مملكتيكما.
            </p>

            <div className="space-y-3">
              <button 
                onClick={handleUnfriend}
                disabled={isProcessing}
                className="w-full py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-500 hover:scale-[1.02] transition-all text-xs uppercase tracking-widest shadow-lg shadow-red-900/20"
              >
                {isProcessing ? 'جاري التنفيذ...' : 'نعم، أقطع التحالف ⚔️'}
              </button>
              <button 
                onClick={() => setShowUnfriendConfirm(false)}
                className="w-full py-4 bg-white/5 text-gray-400 font-black rounded-2xl hover:bg-white/10 transition-all text-xs uppercase tracking-widest"
              >
                تراجع، لازلنا أصدقاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Post Modal */}
      {isShareModalOpen && sharingPost && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsShareModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-[#0a0a0a] border border-[#D4AF37]/30 rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(212,175,55,0.2)] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-white/5 bg-[#111] flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-[#FFD700] uppercase tracking-widest font-pharaoh">مشاركة المرسوم</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">اختر محارباً لإرسال الخبر إليه</p>
              </div>
              <button 
                onClick={() => setIsShareModalOpen(false)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
              >✕</button>
            </div>
            
            <div className="p-4 max-h-[400px] overflow-y-auto space-y-2 scrollbar-hide font-arabic">
              {friends.length === 0 ? (
                <div className="text-center py-10 opacity-50">لا يوجد أصدقاء نشطون حالياً.</div>
              ) : (
                friends.map(friend => (
                  <button
                    key={friend.id}
                    onClick={() => handlePerformShare(friend)}
                    className="w-full flex items-center justify-between p-4 hover:bg-[#D4AF37]/10 rounded-3xl transition-all group border border-transparent hover:border-[#D4AF37]/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full border-2 border-[#D4AF37]/30 overflow-hidden relative group-hover:border-[#FFD700] transition-all bg-gray-800">
                        {friend.photoURL ? <Image src={friend.photoURL} alt={friend.displayName} fill className="object-cover" /> : <div className="w-full h-full bg-gray-800" />}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-white group-hover:text-[#FFD700] transition-colors">{friend.displayName}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">LVL {friend.level || 1}</p>
                      </div>
                    </div>
                    <span className="text-xl group-hover:translate-x-[-10px] transition-transform">🏹</span>
                  </button>
                ))
              )}
            </div>
            
            <div className="p-6 bg-[#111] border-t border-white/5">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                <span className="text-2xl">📜</span>
                <p className="text-[10px] text-gray-400 leading-relaxed italic">
                  سيتم إرسال هذا المرسوم في المحادثة الخاصة بـ {sharingPost.authorName} كرسالة مميزة.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Post Confirmation Modal */}
      {showDeletePostConfirm && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowDeletePostConfirm(false)}></div>
          <div className="relative w-full max-w-sm bg-[#0a0a0a] border border-red-900/40 rounded-[2.5rem] p-8 text-center shadow-[0_0_50px_rgba(220,38,38,0.1)] animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-600/20 shadow-[0_0_30px_rgba(220,38,38,0.1)]">
              <span className="text-4xl">🗑️</span>
            </div>
            <h3 className="text-xl font-black text-white mb-2 font-arabic tracking-tight">مسح المرسوم الملكي؟</h3>
            <p className="text-xs text-gray-500 font-arabic mb-8 leading-relaxed">
              هل أنت متأكد من مسح هذا المرسوم الملكي من سجلات المملكة؟ <br/>
              <span className="text-red-500/80 mt-1 block">تحذير: لا يمكن استعادة المراسيم الممزقة.</span>
            </p>

            <div className="space-y-3">
              <button 
                onClick={confirmDeletePost}
                disabled={isProcessing}
                className="w-full py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-500 hover:scale-[1.02] transition-all text-xs uppercase tracking-widest shadow-lg shadow-red-900/20"
              >
                {isProcessing ? 'جاري التمهيد...' : 'نعم، امسحه للأبد ⚔️'}
              </button>
              <button 
                onClick={() => setShowDeletePostConfirm(false)}
                className="w-full py-4 bg-white/5 text-gray-400 font-black rounded-2xl hover:bg-white/10 transition-all text-xs uppercase tracking-widest"
              >
                تراجع، اترك المرسوم
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Coronation Celebration Modal */}
      {isCoronationOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95 backdrop-blur-2xl">
          {/* Animated Background Rays */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200vw] h-[200vw] bg-[conic-gradient(from_0deg,_transparent_0deg,_rgba(212,175,55,0.1)_180deg,_transparent_360deg)] animate-[spin_8s_linear_infinite]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200vw] h-[200vw] bg-[conic-gradient(from_180deg,_transparent_0deg,_rgba(255,215,0,0.05)_180deg,_transparent_360deg)] animate-[spin_12s_linear_infinite_reverse]"></div>
          </div>

          <div className="relative w-full max-w-2xl p-8 text-center animate-in zoom-in-50 fade-in duration-1000">
            {/* Celebration Content */}
            <div className="space-y-12">
              <div className="relative inline-block">
                <div className="w-48 h-48 mx-auto bg-gradient-to-tr from-[#D4AF37] to-[#FFD700] rounded-full p-2 shadow-[0_0_100px_rgba(212,175,55,0.6)] animate-pulse">
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden border-4 border-black/20 relative">
                    {userData?.photoURL || user?.photoURL ? (
                      <Image src={userData?.photoURL || user?.photoURL || ''} alt="Pharaoh" width={184} height={184} className="object-cover h-full" />
                    ) : (
                      <span className="text-6xl text-[#D4AF37] font-black">{userData?.displayName?.charAt(0)}</span>
                    )}
                  </div>
                </div>
                {/* Floating Icons */}
                <div className="absolute -top-6 -right-6 text-6xl animate-bounce">👑</div>
                <div className="absolute -bottom-6 -left-6 text-6xl animate-bounce delay-500">🛡️</div>
                <div className="absolute top-1/2 -left-12 -translate-y-1/2 text-4xl animate-pulse">✨</div>
                <div className="absolute top-1/2 -right-12 -translate-y-1/2 text-4xl animate-pulse delay-700">✨</div>
              </div>

              <div className="space-y-6">
                <h2 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#FFD700] via-[#D4AF37] to-[#8B7321] font-pharaoh tracking-[0.2em] drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
                  تتويج الملك الجديد
                </h2>
                <div className="h-1 w-64 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto"></div>
                <p className="text-xl md:text-2xl font-black text-white font-arabic tracking-wide">
                  مبارك لك يا <span className="text-[#FFD700] underline underline-offset-8 decoration-[#D4AF37]/50">{userData?.displayName}</span>
                </p>
                <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed font-arabic px-6">
                  لقد أصبحت الآن من الفراعنة الأقوياء في مجلس إدارة المملكة. تم منحك صلاحيات المسؤول المقدسة لإدارة شؤون الرعية.
                </p>
              </div>

              <div className="pt-8 space-y-6">
                <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-[2rem] p-6 backdrop-blur-md max-w-sm mx-auto animate-in slide-in-from-bottom-10 duration-[2s]">
                  <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.5em] mb-4">جاري تحضير لوحة التحكم</p>
                  <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden p-0.5">
                    <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#FFD700] rounded-full animate-[loading_8s_linear_forwards] w-0"></div>
                  </div>
                </div>

                <Link 
                  href="/admin"
                  className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs rounded-2xl hover:scale-105 transition-all shadow-[0_10px_40px_rgba(168,85,247,0.4)] uppercase tracking-[0.2em] border-b-4 border-purple-900 animate-in fade-in zoom-in duration-700 delay-1000"
                >
                  🚀 دخول لوحة التحكم الآن
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
