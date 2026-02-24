"use client";

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { storage, db, auth } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import {
  doc,
  updateDoc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  getDocs,
  writeBatch,
  QuerySnapshot,
  DocumentData,
  Timestamp
} from 'firebase/firestore';

interface AdminUserData {
  uid: string;
  displayName: string;
  email: string | null;
  xp: number;
  level: number;
  friendsCount: number;
  rank: string;
  photoURL: string;
  role: string;
  adminPermissions?: {
    manage_users: boolean;
    manage_finance: boolean;
    manage_content: boolean;
    manage_offers: boolean;
    manage_settings: boolean;
  };
}

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'login' | 'deposit' | 'odds' | 'report';
  createdAt: Timestamp;
  userEmail?: string;
  read: boolean;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userData, setUserData] = useState<AdminUserData | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 50, y: 50, size: 200 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [isClearNotifsModalOpen, setIsClearNotifsModalOpen] = useState(false);
  const [isClearingNotifications, setIsClearingNotifications] = useState(false);

  // Fetch real user data from Firestore
  React.useEffect(() => {
    // Reset state on user change to ensure session isolation
    setUserData(null);
    setAuthorized(false);

    if (user === undefined) return; // Wait for auth to initialize

    if (!user) {
      router.push('/login');
      return;
    }

    const fetchUserData = async () => {
      try {
        const directDocRef = doc(db, 'users', user.uid);
        const directSnap = await getDoc(directDocRef);

        if (directSnap.exists()) {
          const data = directSnap.data() as AdminUserData;
          setUserData(data);
          
          // Check if user is authorized (Email check OR Admin role)
          const adminEmail = "mohemad123hsak@gmail.com";
          if (user.email === adminEmail || data.role === 'admin') {
            setAuthorized(true);
          } else {
            console.warn("Unauthorized access attempt to Admin Vault");
            router.push('/');
          }
        } else {
          // If no doc exists and it's the primary king, create it
          const adminEmail = "mohemad123hsak@gmail.com";
          if (user.email === adminEmail) {
            const defaultData = {
              uid: user.uid,
              displayName: 'Supreme Pharaoh',
              email: user.email,
              xp: 9999,
              level: 100,
              friendsCount: 1000,
              rank: 'Grand Pharaoh',
              photoURL: user.photoURL || '',
              role: 'admin'
            };
            await setDoc(directDocRef, defaultData);
            setUserData(defaultData);
            setAuthorized(true);
          } else {
            router.push('/');
          }
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
        router.push('/');
      }
    };
    fetchUserData();
  }, [user, router]);

  // Fetch Notifications
  React.useEffect(() => {
    if (!authorized) return;

    const q = query(
      collection(db, 'admin_notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const notifs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as AdminNotification[];
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [authorized]);

  // Handle outside layout clicks to close popovers
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const handlePhotoUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setIsCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveCroppedImage = async () => {
    console.log("Attempting to capture essence...");
    if (!imageRef.current) {
      console.error("Image ref is null");
      alert("خطأ: لم يتم تحميل الصورة بشكل صحيح.");
      return;
    }
    if (!user) {
      console.error("User is null");
      alert("خطأ: يجب تسجيل الدخول أولاً.");
      return;
    }

    setUploading(true);
    
    try {
      const canvas = document.createElement('canvas');
      const img = imageRef.current;
      
      // Ensure dimensions are valid
      const displayWidth = img.width || img.naturalWidth;
      const displayHeight = img.height || img.naturalHeight;
      
      if (displayWidth === 0 || displayHeight === 0) {
        throw new Error("Invalid image dimensions");
      }

      const scaleX = img.naturalWidth / displayWidth;
      const scaleY = img.naturalHeight / displayHeight;
      
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      console.log("Drawing cropped image to canvas...", { scaleX, scaleY, crop });
      ctx.drawImage(
        img,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.size * scaleX,
        crop.size * scaleY,
        0, 0, 400, 400
      );

      console.time("CaptureTime");
      canvas.toBlob(async (blob) => {
        if (!blob) {
          console.error("Blob creation failed");
          setUploading(false);
          alert("فشل في معالجة الصورة.");
          return;
        }

        try {
          const storageRef = ref(storage, `profiles/${user.uid}`);
          // Simplified upload
          await uploadBytes(storageRef, blob);
          const url = await getDownloadURL(storageRef);
          
          // Parallel updates for speed
          const { updateProfile } = await import('firebase/auth');
          await Promise.all([
            updateDoc(doc(db, 'users', user.uid), { photoURL: url }),
            updateProfile(user, { photoURL: url })
          ]);

          setUserData((prev) => prev ? ({ ...prev, photoURL: url }) : null);
          setIsCropModalOpen(false);
          setImageToCrop(null);
          console.timeEnd("CaptureTime");
          alert('تم حفظ صورتك الجديدة بنجاح!');
        } catch (err: unknown) {
          console.error("Save error:", err);
          const error = err as Error;
          alert(`فشل الحفظ: ${error.message}`);
        } finally {
          setUploading(false);
        }
      }, 'image/jpeg', 0.7); // Reduced quality from 0.9 to 0.7 for faster upload
    } catch (err: unknown) {
      console.error("Crop error:", err);
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const currentStats = {
    xp: userData?.xp || 0,
    maxXp: (userData?.level || 1) * 100,
    level: userData?.level || 1,
    friends: userData?.friendsCount || 0,
    rank: userData?.rank || 'Administrator',
    name: userData?.displayName || 'Administrator'
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex overflow-hidden">
      {/* Sidebar - Persistent on desktop, overlay on mobile */}
      <aside className={`
        fixed inset-y-0 left-0 z-[60] w-64 bg-[#0a0a0a] border-r border-[#D4AF37]/20 flex flex-col shrink-0 transition-transform duration-300 lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0 shadow-[0_0_50px_rgba(0,0,0,1)]' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile Close Button */}
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-4 text-gray-500 hover:text-white text-2xl"
        >
          ×
        </button>

        <div className="p-6 border-b border-[#D4AF37]/20 flex justify-center">
          <Link href="/admin" className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#FFD700]/20 to-[#D4AF37]/20 rounded-lg blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <Image 
              src="/hbet_logo.png" 
              alt="HBET Logo" 
              width={180} 
              height={60} 
              className="relative object-contain transform group-hover:scale-105 transition-transform duration-500"
              priority
            />
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarLink href="/admin" icon="📊">Dashboard</SidebarLink>
          
          {(userData?.adminPermissions?.manage_content || user?.email === "mohemad123hsak@gmail.com") && (
            <SidebarLink href="/admin/pages" icon="📑">Page Manager</SidebarLink>
          )}
          
          {(userData?.adminPermissions?.manage_users || user?.email === "mohemad123hsak@gmail.com") && (
            <SidebarLink href="/admin/users" icon="👥">User Management</SidebarLink>
          )}
          
          {(userData?.adminPermissions?.manage_finance || user?.email === "mohemad123hsak@gmail.com") && (
            <>
              <SidebarLink href="/admin/deposits" icon="📥">Deposit Requests</SidebarLink>
              <SidebarLink href="/admin/withdrawals" icon="📤">Withdrawal Requests</SidebarLink>
              <SidebarLink href="/admin/financial" icon="💰">Financials</SidebarLink>
            </>
          )}
          
          {(userData?.adminPermissions?.manage_settings || user?.email === "mohemad123hsak@gmail.com") && (
            <SidebarLink href="/admin/settings" icon="⚙️">Settings</SidebarLink>
          )}
          
          <div className="pt-4 border-t border-[#D4AF37]/20 mt-4">
            <SidebarLink href="/dashboard" icon="🌍">Public Site</SidebarLink>
          </div>
        </nav>
        
        <div className="p-4 border-t border-[#D4AF37]/20">
          <button 
            onClick={handleLogout}
            className="w-full py-2 px-4 rounded bg-red-600/10 text-red-500 hover:bg-red-600/20 transition-colors text-sm font-medium cursor-pointer"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Cropping Modal */}
      {isCropModalOpen && imageToCrop && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#0a0a0a] border border-[#D4AF37]/30 rounded-3xl w-full max-w-2xl overflow-hidden shadow-[0_0_100px_rgba(212,175,55,0.2)]">
            <div className="p-6 border-b border-[#D4AF37]/20 flex justify-between items-center bg-[#111]">
              <div>
                <h3 className="text-xl font-bold text-[#FFD700] font-pharaoh tracking-widest">Adjust Your Visage</h3>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-tighter">Position the frame over your face.</p>
              </div>
              <button onClick={() => setIsCropModalOpen(false)} className="text-gray-500 hover:text-white text-2xl">×</button>
            </div>
            
            <div className="p-8 flex flex-col items-center">
              <div className="relative max-h-[50vh] overflow-hidden rounded-xl border border-white/10 select-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  ref={imageRef}
                  src={imageToCrop} 
                  alt="To Crop" 
                  className="max-w-full"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    const minDim = Math.min(img.width, img.height);
                    setCrop({ x: (img.width - minDim/2)/2, y: (img.height - minDim/2)/2, size: minDim/2 });
                  }}
                />
                <div 
                  className="absolute border-2 border-[#D4AF37] shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] cursor-move rounded-full"
                  style={{
                    left: `${crop.x}px`,
                    top: `${crop.y}px`,
                    width: `${crop.size}px`,
                    height: `${crop.size}px`,
                  }}
                  onMouseDown={(e) => {
                    const startX = e.clientX - crop.x;
                    const startY = e.clientY - crop.y;
                    const move = (moveEvent: MouseEvent) => {
                      setCrop(prev => ({
                        ...prev,
                        x: Math.max(0, Math.min(moveEvent.clientX - startX, (imageRef.current?.width || 0) - prev.size)),
                        y: Math.max(0, Math.min(moveEvent.clientY - startY, (imageRef.current?.height || 0) - prev.size))
                      }));
                    };
                    const up = () => {
                      window.removeEventListener('mousemove', move);
                      window.removeEventListener('mouseup', up);
                    };
                    window.addEventListener('mousemove', move);
                    window.addEventListener('mouseup', up);
                  }}
                >
                  <div className="absolute inset-0 border border-white/20 rounded-full"></div>
                  {/* Resize handle */}
                  <div 
                    className="absolute bottom-0 right-0 w-6 h-6 bg-[#D4AF37] rounded-full cursor-nwse-resize flex items-center justify-center shadow-lg"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const startSize = crop.size;
                      const startX = e.clientX;
                      const move = (moveEvent: MouseEvent) => {
                        const delta = moveEvent.clientX - startX;
                        const newSize = Math.max(50, Math.min(startSize + delta, Math.min((imageRef.current?.width || 0) - crop.x, (imageRef.current?.height || 0) - crop.y)));
                        setCrop(prev => ({ ...prev, size: newSize }));
                      };
                      const up = () => {
                        window.removeEventListener('mousemove', move);
                        window.removeEventListener('mouseup', up);
                      };
                      window.addEventListener('mousemove', move);
                      window.addEventListener('mouseup', up);
                    }}
                  >
                    <span className="text-[10px] text-black font-bold">↘</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-4 w-full">
                <button 
                  onClick={() => setIsCropModalOpen(false)}
                  className="flex-1 py-3 border border-white/10 rounded-xl text-gray-400 hover:bg-white/5 transition-colors uppercase text-xs font-black tracking-widest"
                >
                  Discard
                </button>
                <button 
                  onClick={saveCroppedImage}
                  disabled={uploading}
                  className="flex-1 py-3 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black rounded-xl font-black uppercase text-xs tracking-widest shadow-[0_0_20px_#D4AF37]/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  {uploading ? 'Sealing...' : 'Capture Essence'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-[#0a0a0a] border-b border-[#D4AF37]/20 flex items-center justify-between px-4 md:px-8 z-40 sticky top-0">
          <div className="flex items-center gap-4">
            {/* Mobile Toggle */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 text-2xl hover:text-[#D4AF37] transition-colors"
            >
              ☰
            </button>
            <div className="hidden sm:flex items-center space-x-4 uppercase tracking-[0.2em] text-[10px] font-black text-gray-500">
              <span>Admin</span>
              <span className="text-gray-800">/</span>
              <span className="text-[#D4AF37]">Management Vault</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="relative" ref={notificationRef}>
              <div 
                className="relative cursor-pointer group"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              >
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-[10px] flex items-center justify-center text-white font-bold animate-pulse">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
                <span className="text-2xl group-hover:scale-110 transition-transform">🔔</span>
              </div>

              {/* Notification Dropdown (Facebook Style) */}
              {isNotificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-[350px] bg-[#0d0d0d] border border-[#D4AF37]/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-[#D4AF37]/20 flex justify-between items-center bg-[#111]">
                    <h3 className="font-bold text-[#FFD700] text-sm tracking-widest uppercase">الإشعارات الملكية</h3>
                    <div className="flex gap-4">
                      <button 
                        className="text-[10px] text-gray-500 hover:text-[#D4AF37]"
                        onClick={async () => {
                          const q = query(collection(db, 'admin_notifications'), where('read', '==', false));
                          const snapshot = await getDocs(q);
                          const batch = writeBatch(db);
                          snapshot.forEach((d) => {
                            batch.update(doc(db, 'admin_notifications', d.id), { read: true });
                          });
                          await batch.commit();
                        }}
                      >
                        تحديد الكل كمقروء
                      </button>
                      <button 
                        className="text-[10px] text-red-500 hover:text-red-400 font-bold"
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          setIsClearNotifsModalOpen(true);
                        }}
                      >
                        مسح الكل
                      </button>
                    </div>
                  </div>
                  
                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-10 text-center text-gray-500 text-xs">لا توجد إشعارات جديدة</div>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          className={`p-4 border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer flex gap-4 ${notif.read ? 'opacity-60' : ''}`}
                          onClick={async () => {
                            await updateDoc(doc(db, 'admin_notifications', notif.id), { read: true });
                          }}
                        >
                          <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-xl ${getNotificationBg(notif.type)}`}>
                            {getNotificationIcon(notif.type)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-200 mb-1">{notif.title}</p>
                            <p className="text-[10px] text-gray-400 line-clamp-2">{notif.message}</p>
                            <span className="text-[8px] text-gray-600 uppercase mt-2 block">
                              {notif.createdAt?.toDate().toLocaleString('ar-EG')}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="p-3 text-center bg-[#111] border-t border-[#D4AF37]/10">
                    <button className="text-[10px] text-[#D4AF37] font-bold hover:underline">عرض كل النشاطات</button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Popover Container */}
            <div 
              className="relative"
              onMouseEnter={() => setShowProfileCard(true)}
              onMouseLeave={() => setShowProfileCard(false)}
            >
              <div className="flex items-center space-x-3 cursor-pointer group py-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#D4AF37] p-[1px] shadow-[0_0_10px_rgba(212,175,55,0.2)]">
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden relative">
                    {userData?.photoURL || user?.photoURL ? (
                      <Image src={userData?.photoURL || user?.photoURL || ''} alt="Admin" width={40} height={40} className="object-cover h-full" />
                    ) : (
                      <span className="text-xs">A</span>
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                </div>
                <span className="group-hover:text-[#D4AF37] transition-colors font-medium text-sm">{currentStats.name}</span>
              </div>

              {/* Profile Card Popover */}
              {showProfileCard && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-[#0d0d0d] border border-[#D4AF37]/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative group">
                      <div className="w-20 h-20 rounded-full border-2 border-[#D4AF37] p-1">
                        <div className="w-full h-full rounded-full bg-black overflow-hidden relative">
                          <Image 
                            src={userData?.photoURL || user?.photoURL || '/logo.png'} 
                            alt="Admin Profile" 
                            width={80} 
                            height={80} 
                            className="object-cover h-full"
                          />
                          {uploading && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="absolute bottom-0 right-0 bg-[#D4AF37] text-black w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
                        title="Edit Picture"
                      >
                        ✏️
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handlePhotoUpdate}
                        accept="image/*"
                      />
                    </div>

                    <div className="text-center">
                      <h4 className="font-bold text-[#FFD700] uppercase tracking-widest text-xs">{currentStats.rank}</h4>
                      <p className="text-gray-400 text-[10px] mt-1 italic">Overseer of the kingdom</p>
                    </div>

                    <div className="w-full space-y-3 pt-2">
                      <div className="flex justify-between text-[10px] font-black uppercase">
                        <span className="text-[#D4AF37]">LEVEL {currentStats.level}</span>
                        <span className="text-gray-500">{currentStats.xp} / {currentStats.maxXp} XP</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-[#D4AF37]/10">
                        <div 
                          className="h-full bg-gradient-to-r from-[#FFD700] to-[#D4AF37] shadow-[0_0_8px_#D4AF37]" 
                          style={{ width: `${(currentStats.xp / currentStats.maxXp) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 w-full gap-4 pt-2">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col items-center">
                        <span className="text-xs font-bold">{currentStats.friends}</span>
                        <span className="text-[8px] text-gray-500 uppercase">Friends</span>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col items-center text-blue-400">
                        <span className="text-xs font-bold uppercase">{currentStats.level > 10 ? 'LEGEND' : 'NOVICE'}</span>
                        <span className="text-[8px] text-gray-500 uppercase tracking-tighter">Status</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>

        {/* Backdrop for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}
      </div>
      {/* Clear Notifications Modal */}
      {isClearNotifsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="relative w-full max-w-sm bg-[#0a0a0a] border border-red-900/50 rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(239,68,68,0.1)] animate-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="bg-gradient-to-b from-red-600 to-red-900 p-8 text-center relative">
               <div className="absolute top-4 left-4 text-2xl opacity-20">🔥</div>
               <div className="absolute top-4 right-4 text-2xl opacity-20">🔥</div>
               <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-black/30 flex items-center justify-center bg-black/20 text-3xl">
                 🗑️
               </div>
               <h3 className="text-xl font-black text-white uppercase tracking-widest font-pharaoh">تطهير السجلات</h3>
            </div>

            <div className="p-8 space-y-6 text-center">
              <div className="space-y-3">
                <p className="text-red-500 font-bold text-sm">هل أنت متأكد من مسح جميع الإشعارات؟</p>
                <p className="text-gray-500 text-[10px] leading-relaxed">
                  هذا الإجراء سيقوم بحذف جميع التنبيهات من سجلاتك الملكية نهائياً. لا يمكن استعادة هذه المعلومات بمجرد حرقها.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    setIsClearingNotifications(true);
                    try {
                      const q = collection(db, 'admin_notifications');
                      const snapshot = await getDocs(q);
                      const batch = writeBatch(db);
                      snapshot.forEach((d) => {
                        batch.delete(doc(db, 'admin_notifications', d.id));
                      });
                      await batch.commit();
                      setIsClearNotifsModalOpen(false);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsClearingNotifications(false);
                    }
                  }}
                  disabled={isClearingNotifications}
                  className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  {isClearingNotifications ? 'جاري التطهير...' : 'تأكيد المسح النهائي'}
                </button>
                <button 
                  onClick={() => setIsClearNotifsModalOpen(false)}
                  disabled={isClearingNotifications}
                  className="w-full py-3 text-gray-500 hover:text-white font-bold text-[9px] uppercase tracking-widest transition-colors"
                >
                  إبقاء الإشعارات
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'login': return '👑';
    case 'deposit': return '💰';
    case 'odds': return '🎲';
    case 'report': return '⚠️';
    default: return '📜';
  }
}

function getNotificationBg(type: string) {
  switch (type) {
    case 'login': return 'bg-blue-500/10 text-blue-500';
    case 'deposit': return 'bg-green-500/10 text-green-500';
    case 'odds': return 'bg-[#D4AF37]/10 text-[#D4AF37]';
    case 'report': return 'bg-red-500/10 text-red-500';
    default: return 'bg-white/5 text-gray-400';
  }
}

function SidebarLink({ href, icon, children, active = false }: { href: string; icon: string; children: React.ReactNode; active?: boolean }) {
  return (
    <Link 
      href={href}
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-300 ${
        active 
          ? 'bg-[#D4AF37]/10 text-[#FFD700] border border-[#D4AF37]/30 shadow-[0_0_15px_rgba(212,175,55,0.1)]' 
          : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{children}</span>
    </Link>
  );
}
