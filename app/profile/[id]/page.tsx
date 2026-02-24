"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import UserAvatar from '@/app/components/UserAvatar';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';

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
  location?: string;
  hideFriends?: boolean;
  isPrivate?: boolean;
  gender?: string;
  birthday?: string;
  phoneNumber?: string;
  showPhoneNumber?: boolean;
}

interface NewsPost {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  authorPhoto?: string; 
  content: string;
  imageURL?: string;
  visibility: 'public' | 'friends' | 'private';
  likes?: string[];
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  createdAt: Timestamp;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState('');
  const [isUploading, setIsUploading] = useState<'photo' | 'cover' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localPreview, setLocalPreview] = useState<{ photo?: string; cover?: string }>({});
  const [friendsDetails, setFriendsDetails] = useState<UserProfile[]>([]);
  
  const isMe = user?.uid === id;
  const canViewFullProfile = isMe || isFriend || !profileData?.isPrivate;

  useEffect(() => {
    return () => {
      if (localPreview.photo) URL.revokeObjectURL(localPreview.photo);
      if (localPreview.cover) URL.revokeObjectURL(localPreview.cover);
    };
  }, [localPreview]);

  useEffect(() => {
    if (!id) return;

    const userRef = doc(db, 'users', id as string);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfileData({
          uid: docSnap.id,
          ...data
        } as UserProfile);
        
        if (data.bio && !isEditingBio) {
          setEditedBio(data.bio);
        }

        if (user && data.friends?.includes(user.uid)) {
          setIsFriend(true);
        } else {
          setIsFriend(false);
        }
      } else {
        setProfileData(null);
      }
      setLoading(false);
    });

    const postsQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', id),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubPosts = onSnapshot(postsQuery, (snap) => {
      const posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NewsPost[];
      // Filter based on visibility
      const filtered = posts.filter(post => {
        if (post.visibility === 'public') return true;
        if (user && post.authorId === user.uid) return true;
        if (post.visibility === 'friends') {
          return profileData?.friends?.includes(user?.uid || '');
        }
        return false;
      });
      setUserPosts(filtered);
    });

    return () => {
      unsubUser();
      unsubPosts();
    };
  }, [id, user, isEditingBio, profileData?.friends]);

  useEffect(() => {
    // Fetch friends details if not hidden
    const fetchFriends = async () => {
      if (profileData?.friends && profileData.friends.length > 0 && !profileData.hideFriends) {
        try {
          const friendsQ = query(collection(db, 'users'), where('__name__', 'in', profileData.friends.slice(0, 10)));
          const snap = await getDocs(friendsQ);
          setFriendsDetails(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
        } catch (err) {
          console.error("Error fetching friends details:", err);
          setFriendsDetails([]);
        }
      } else {
        setFriendsDetails([]);
      }
    };
    fetchFriends();
  }, [profileData?.friends, profileData?.hideFriends]);

  const compressAndEncode = (file: File, maxWidth: number = 400, quality: number = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && id) {
      const file = e.target.files[0];
      setIsUploading('photo');
      setUploadProgress(10); 

      try {
        const hash = await compressAndEncode(file, 300, 0.7);
        setLocalPreview(prev => ({ ...prev, photo: hash }));
        setUploadProgress(50);
        
        await updateDoc(doc(db, 'users', id as string), { photoURL: hash });
        
        setUploadProgress(100);
        setTimeout(() => {
          setIsUploading(null);
          setUploadProgress(0);
        }, 500);
      } catch (err) {
        console.error("Photo hash error:", err);
        setIsUploading(null);
      }
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && id) {
      const file = e.target.files[0];
      setIsUploading('cover');
      setUploadProgress(10);

      try {
        const hash = await compressAndEncode(file, 800, 0.5); 
        setLocalPreview(prev => ({ ...prev, cover: hash }));
        setUploadProgress(50);
        
        await updateDoc(doc(db, 'users', id as string), { coverURL: hash });
        
        setUploadProgress(100);
        setTimeout(() => {
          setIsUploading(null);
          setUploadProgress(0);
        }, 500);
      } catch (err) {
        console.error("Cover hash error:", err);
        setIsUploading(null);
      }
    }
  };

  const handleBioUpdate = async () => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'users', id as string), { bio: editedBio });
      setIsEditingBio(false);
    } catch (err) {
      console.error("Bio update error:", err);
    }
  };

  const handleFriendRequest = async () => {
    if (!user || !profileData || isMe || isFriend) return;
    try {
      const notifRef = doc(collection(db, 'notifications'));
      const { serverTimestamp } = await import('firebase/firestore');
      const { addXP } = await import('@/lib/progression');
      
      await updateDoc(notifRef, {
        recipientId: profileData.uid,
        senderId: user.uid,
        senderName: user.displayName || 'محارب مجهول',
        senderPhoto: user.photoURL || '',
        title: '🤝 طلب تحالف جديد',
        message: `يرغب ${user.displayName || 'محارب'} في الانضمام إلى حلفائك.`,
        type: 'friend_request',
        status: 'unread',
        createdAt: serverTimestamp()
      });
      
      await addXP(user.uid, 10);
      alert('تم إرسال طلب التحالف للملك! (+10 XP)');
    } catch (err) {
      console.error("Friend request error:", err);
      alert('فشل في إرسال الطلب.');
    }
  };

  const handleReport = () => {
    alert('تم إرسال بلاغك للمراقبين الملكيين. سنتحقق من هذا المحارب قريباً! 🚩');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
        <span className="text-6xl mb-6"> Desert </span>
        <h1 className="text-2xl font-black text-[#D4AF37] uppercase tracking-widest mb-4">المحارب غير موجود</h1>
        <p className="text-gray-500 mb-8 font-arabic">يبدو أن هذا المحارب قد تاه في رمال الصحراء...</p>
        <Link href="/dashboard" className="px-8 py-4 bg-[#D4AF37] text-black font-black rounded-2xl hover:scale-105 transition-all">
          العودة للقلعة
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-20">
      {/* Header / Cover Area */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        {(localPreview.cover || profileData.coverURL) ? (
          <Image src={localPreview.cover || profileData.coverURL!} alt="Cover" fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#D4AF37]/20 to-black/80"></div>
        )}
        
        {isUploading === 'cover' && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10 z-20">
            <div 
              className="h-full bg-[#D4AF37] shadow-[0_0_10px_#D4AF37] transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}
        <div className="absolute inset-0 bg-[url('/egypt-pattern.png')] opacity-10"></div>
        
        <button 
          onClick={() => router.back()}
          className="absolute top-8 left-8 w-12 h-12 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all z-10"
        >
          <span className="text-xl">🔙</span>
        </button>

        {isMe && (
          <div className="absolute top-8 right-8 flex gap-3 z-10">
            <label className="px-6 py-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#D4AF37]/20 hover:border-[#D4AF37]/40 transition-all cursor-pointer flex items-center gap-2">
              <span>{isUploading === 'cover' ? 'جاري الرفع...' : 'تغيير الغلاف 🖼️'}</span>
              <input type="file" className="hidden" onChange={handleCoverUpload} disabled={!!isUploading} />
            </label>
            <Link 
              href="/settings"
              className="px-6 py-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#D4AF37]/20 hover:border-[#D4AF37]/40 transition-all"
            >
              تعديل المملكة ⚔️
            </Link>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 -mt-32 relative z-20">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* LEFT SIDEBAR: Friends (If visible) */}
          <div className="lg:w-1/4 space-y-6 order-3 lg:order-1 pt-32 lg:pt-0">
             {canViewFullProfile && !profileData.hideFriends && (
                <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-6 space-y-6 sticky top-28">
                  <div className="flex justify-between items-center px-2">
                    <h3 className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em]">الحلفاء المقربون ({profileData.friendsCount || 0})</h3>
                    <Link href="/friends" className="text-[8px] text-gray-500 hover:text-white uppercase font-bold">عرض الكل</Link>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {friendsDetails.length === 0 ? (
                      <p className="col-span-2 text-center text-[9px] text-gray-600 py-4 italic uppercase">لا يوجد حلفاء متاحون</p>
                    ) : (
                      friendsDetails.map(friend => (
                        <Link key={friend.uid} href={`/profile/${friend.uid}`} className="flex flex-col items-center gap-2 group">
                          <UserAvatar 
                             userId={friend.uid} 
                             fallbackName={friend.displayName} 
                             fallbackPhoto={friend.photoURL}
                             className="w-14 h-14 rounded-2xl border-2 border-white/5 group-hover:border-[#D4AF37]/50 transition-all"
                          />
                          <span className="text-[9px] font-black text-gray-400 group-hover:text-white truncate w-full text-center">{friend.displayName}</span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
             )}

             {/* Personal Info Card */}
              {canViewFullProfile && (
                <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-6 space-y-4">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] px-2">معلومات المحارب</h3>
                  <div className="space-y-4 text-[10px] font-bold">
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                      <span className="text-lg">📍</span>
                      <div className="flex flex-col">
                        <span className="text-gray-500 uppercase text-[8px]">الموطن</span>
                        <span className="text-gray-200">{profileData.location || 'غير محدد'}</span>
                      </div>
                    </div>
                    {profileData.gender && (
                      <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                        <span className="text-lg">{profileData.gender === 'male' ? '👨' : '👩'}</span>
                        <div className="flex flex-col">
                          <span className="text-gray-500 uppercase text-[8px]">النوع</span>
                          <span className="text-gray-200">{profileData.gender === 'male' ? 'ذكر' : 'أنثى'}</span>
                        </div>
                      </div>
                    )}
                    {profileData.birthday && (
                      <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                        <span className="text-lg">🎂</span>
                        <div className="flex flex-col">
                          <span className="text-gray-500 uppercase text-[8px]">تاريخ الميلاد</span>
                          <span className="text-gray-200">{new Date(profileData.birthday).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                      </div>
                    )}
                    {profileData.showPhoneNumber && profileData.phoneNumber && (
                      <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-2xl">
                        <span className="text-lg">📱</span>
                        <div className="flex flex-col">
                          <span className="text-green-500/70 uppercase text-[8px]">رقم الهاتف</span>
                          <span className="text-green-500 font-mono">{profileData.phoneNumber}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                      <span className="text-lg">🆔</span>
                      <div className="flex flex-col">
                        <span className="text-gray-500 uppercase text-[8px]">Kingdom ID</span>
                        <span className="text-white tracking-widest">{profileData.kingdomId || '--- --- ---'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                      <span className="text-lg">🛡️</span>
                      <div className="flex flex-col">
                        <span className="text-gray-500 uppercase text-[8px]">الرتبة</span>
                        <span className="text-[#D4AF37] font-pharaoh">{profileData.rank || 'Soldier'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* MAIN CENTER: Feed & Progression */}
          <div className="lg:w-2/4 order-2 space-y-8 pt-32 lg:pt-0">
             {!canViewFullProfile ? (
                <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-12 text-center space-y-6 shadow-2xl">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                    <span className="text-5xl">🔒</span>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-black text-white uppercase tracking-widest">هذا الملف الشخصي خاص</h2>
                    <p className="text-xs text-gray-500 font-bold font-arabic leading-relaxed">
                      عذراً، قام هذا المحارب بتفعيل حماية المملكة الخاصة به.<br/>
                      يسمح فقط للأصدقاء والحلفاء المقربين بالاطلاع على المراسيم والبيانات الملكية.
                    </p>
                  </div>
                  {!isMe && !isFriend && (
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleFriendRequest}
                        className="px-10 py-4 bg-[#D4AF37] text-black font-black text-[11px] uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-lg shadow-[#D4AF37]/20"
                      >
                        ➕ إرسال طلب تحالف لرؤية الملف
                      </button>
                      <button 
                        onClick={handleReport}
                        className="px-10 py-4 bg-red-600/10 text-red-500 border border-red-600/20 font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-red-600 hover:text-white transition-all"
                      >
                        🚩 أبلغ عن هذا المحارب
                      </button>
                    </div>
                  )}
                </div>
             ) : (
                <>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    {[
                      { label: 'المستوى', value: profileData.level || 1, icon: '🌟' },
                      { label: 'الأصدقاء', value: profileData.friendsCount || 0, icon: '👥' },
                      { label: 'الخبرة', value: profileData.xp || 0, icon: '⚔️' },
                      { label: 'الرصيد', value: `${profileData.balance?.toLocaleString() || 0}`, icon: '💰', sub: 'EGP', hidden: !isMe }
                    ].map((stat, i) => !stat.hidden && (
                      <div key={i} className="bg-[#0a0a0a] border border-white/5 p-4 rounded-[2rem] text-center hover:border-[#FFD700]/30 transition-all group shadow-xl">
                        <span className="text-xl block mb-2 group-hover:scale-110 transition-transform">{stat.icon}</span>
                        <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-base font-black text-white">{stat.value} <span className="text-[8px] text-gray-500">{stat.sub}</span></p>
                      </div>
                    ))}
                  </div>

                  {/* XP Bar (Detailed) */}
                  <div className="w-full bg-[#0a0a0a] border border-white/5 p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                     <div className="flex justify-between items-end text-[9px] font-black uppercase tracking-[0.2em] mb-3">
                       <span className="text-gray-400">التقدم نحو المستوى التالي</span>
                       <span className="text-[#FFD700]">{profileData.xp || 0} / {(profileData.level || 1) * 1000} XP</span>
                     </div>
                     <div className="h-4 bg-black border border-white/10 rounded-full overflow-hidden p-1 shadow-inner">
                       <div 
                         className="h-full bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#D4AF37] rounded-full shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-1000"
                         style={{ width: `${Math.min(((profileData.xp || 0) / ((profileData.level || 1) * 1000)) * 100, 100)}%` }}
                       ></div>
                     </div>
                     <p className="mt-3 text-[8px] text-gray-500 text-center font-black uppercase tracking-tighter">أقصى مستوى ملكي: 150 👑</p>
                  </div>

                  {/* User Posts Feed */}
                  <div className="space-y-8">
                    <h3 className="text-[#FFD700] font-black text-xs uppercase tracking-[0.4em] flex items-center gap-4">
                      <span className="flex-1 h-px bg-gradient-to-r from-transparent to-[#D4AF37]/20"></span>
                      الأرشيف الملكي
                      <span className="flex-1 h-px bg-gradient-to-l from-transparent to-[#D4AF37]/20"></span>
                    </h3>

                    {userPosts.length === 0 ? (
                      <div className="text-center py-20 bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] opacity-50 border-dashed">
                        <span className="text-4xl block mb-4 opacity-20">📜</span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">لا يوجد مراسيم منشورة لهذا المحارب بعد.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {userPosts.map(post => (
                          <div key={post.id} className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] overflow-hidden group hover:border-[#D4AF37]/30 transition-all shadow-xl">
                            <div className="p-8">
                               <div className="flex items-center gap-4 mb-6">
                                 <UserAvatar 
                                   userId={post.authorId} 
                                   fallbackName={post.authorName} 
                                   fallbackPhoto={post.authorPhotoURL || post.authorPhoto}
                                   className="w-10 h-10 border border-[#D4AF37]/30"
                                 />
                                 <h4 className="font-bold text-sm text-gray-200">{post.authorName}</h4>
                               </div>
                              <p className="text-sm text-gray-200 leading-relaxed font-arabic whitespace-pre-wrap">{post.content}</p>
                              <div className="flex items-center gap-6 mt-8 text-[9px] text-gray-500 font-bold uppercase tracking-widest border-t border-white/5 pt-6">
                                <span className="hover:text-red-500 transition-colors cursor-pointer">🔥 {post.likesCount || 0}</span>
                                <span className="hover:text-blue-500 transition-colors cursor-pointer">💬 {post.commentsCount || 0}</span>
                                <span className="hover:text-[#D4AF37] transition-colors cursor-pointer">🔱 {post.sharesCount || 0}</span>
                                <span className="flex-1 text-left">{post.createdAt?.toDate().toLocaleDateString('ar-EG')}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
             )}
          </div>

          {/* RIGHT SIDEBAR: Profile Picture & Core Info (Order 1) */}
          <div className="lg:w-1/4 space-y-8 order-1 lg:order-3">
             <div className="flex flex-col items-center lg:items-end">
                {/* Avatar - POSITIONED RIGHT */}
                <div className="w-56 h-56 md:w-64 md:h-64 rounded-[4rem] border-8 border-[#D4AF37] p-2 bg-[#050505] shadow-[0_30px_70px_rgba(0,0,0,0.8)] relative group overflow-hidden">
                  <div className="w-full h-full rounded-[3.5rem] bg-gray-900 overflow-hidden relative">
                     <UserAvatar 
                       userId={profileData.uid} 
                       fallbackName={profileData.displayName} 
                       fallbackPhoto={profileData.photoURL}
                       className="w-full h-full"
                     />
                     
                     {isMe && (
                       <label className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer z-10 backdrop-blur-sm">
                         <span className="text-xl mb-2">📸</span>
                         <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">تحديث الصورة</span>
                         <input type="file" className="hidden" onChange={handlePhotoUpload} disabled={!!isUploading} />
                       </label>
                     )}

                     {isUploading === 'photo' && (
                       <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20">
                          <div className="w-20 h-20 rounded-full border-4 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin"></div>
                          <span className="mt-4 text-[12px] font-black text-[#D4AF37] tracking-[0.2em]">{Math.round(uploadProgress)}%</span>
                       </div>
                     )}
                  </div>
                  {/* Level Badge Overlay */}
                  <div className="absolute -bottom-2 -left-2 w-16 h-16 bg-[#D4AF37] text-black border-4 border-[#050505] rounded-3xl flex items-center justify-center font-black shadow-xl z-30">
                    {profileData.level || 1}
                  </div>
                </div>

                {/* Name and Basic Control */}
                <div className="mt-8 text-center lg:text-right space-y-4 w-full">
                   <div className="space-y-1">
                     <h1 className="text-4xl font-black text-white tracking-tight">{profileData.displayName}</h1>
                     <div className="flex items-center justify-center lg:justify-end gap-3 text-[#D4AF37]">
                       <span className="h-px w-8 bg-[#D4AF37]/40 hidden lg:block"></span>
                       <p className="text-xs font-black uppercase tracking-[0.3em] font-pharaoh">{profileData.rank || 'Soldier'}</p>
                     </div>
                   </div>

                   <div className="max-w-xs ml-auto">
                     {isEditingBio ? (
                       <div className="space-y-2">
                         <textarea 
                           value={editedBio}
                           onChange={(e) => setEditedBio(e.target.value)}
                           className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-[11px] text-right focus:outline-none focus:border-[#D4AF37] min-h-[100px] font-arabic"
                         />
                         <div className="flex gap-2 justify-end">
                            <button onClick={() => setIsEditingBio(false)} className="px-5 py-2 bg-white/5 text-gray-500 text-[9px] font-black rounded-xl">إلغاء</button>
                            <button onClick={handleBioUpdate} className="px-5 py-2 bg-[#D4AF37] text-black text-[9px] font-black rounded-xl">حفظ</button>
                         </div>
                       </div>
                     ) : (
                       <div className="group relative">
                         <p className="text-gray-400 text-[11px] leading-relaxed font-arabic italic text-right pl-4">
                           {profileData.bio || 'لا يوجد وصف ملكي لهذا المحارب بعد، يبدو أنه يفضل الصمت والعمل الجاد...'}
                         </p>
                         {isMe && (
                           <button 
                             onClick={() => setIsEditingBio(true)}
                             className="mt-3 text-[9px] text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-all font-black uppercase tracking-widest underline block ml-auto"
                           >
                             تعديل النبذة ✍️
                           </button>
                         )}
                       </div>
                     )}
                   </div>

                   <div className="flex flex-col gap-3 pt-6 w-full">
                     {!isMe && (
                       <>
                         <button 
                           onClick={handleFriendRequest}
                           disabled={isFriend}
                           className={`w-full py-5 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-xl flex items-center justify-center gap-3 ${isFriend ? 'bg-white/5 border border-white/10 text-gray-400 cursor-default' : 'bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black hover:scale-[1.02] shadow-[#D4AF37]/20'}`}
                         >
                           {isFriend ? '✓ أنتما حلفاء الآن' : '➕ إرسال طلب تحالف'}
                         </button>
                         <div className="grid grid-cols-2 gap-3">
                            <button className="py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest text-gray-400">
                              <span>✉️</span> مراسلة
                            </button>
                            <button 
                              onClick={handleReport}
                              className="py-4 bg-red-600/5 border border-red-600/10 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest text-red-500 group"
                            >
                              <span className="group-hover:animate-bounce">🚩</span> ابلغ
                            </button>
                         </div>
                       </>
                     )}
                   </div>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
