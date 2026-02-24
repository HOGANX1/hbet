"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { updateProfile, updateEmail, updatePassword, deleteUser } from 'firebase/auth';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id?: string;
  kingdomId?: string;
  balance?: number;
  displayName?: string;
  level?: number;
  rank?: string;
  xp?: number;
  friendsCount?: number;
  isPrivate?: boolean;
  photoURL?: string;
  email?: string;
  location?: string;
  hideFriends?: boolean;
  role?: string;
  lastKingdomIdChange?: { toDate: () => Date };
  bio?: string;
  gender?: string;
  birthday?: string;
  phoneNumber?: string;
  showPhoneNumber?: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // Form States
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [photoURL, setPhotoURL] = useState('');
  const [kingdomId, setKingdomId] = useState('');
  const [location, setLocation] = useState('');
  const [hideFriends, setHideFriends] = useState(false);
  const [role, setRole] = useState('user');
  const [lastIdChange, setLastIdChange] = useState<Date | null>(null);
  const [newKingdomId, setNewKingdomId] = useState('');
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  // New States
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  /* Profile image upload removed as per request */

  useEffect(() => {
    if (!user) return;
    
    async function fetchData() {
      if (!user) return;
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setDisplayName(data.displayName || '');
        setEmail(data.email || '');
        setIsPrivate(data.isPrivate || false);
        setPhotoURL(data.photoURL || '');
        setKingdomId(data.kingdomId || user.uid);
        setNewKingdomId(data.kingdomId || '');
        setLocation(data.location || '');
        setHideFriends(data.hideFriends || false);
        setRole(data.role || 'user');
        setBio(data.bio || '');
        setGender(data.gender || '');
        setBirthday(data.birthday || '');
        setPhoneNumber(data.phoneNumber || '');
        setShowPhoneNumber(data.showPhoneNumber || false);

        if (data.lastKingdomIdChange) {
          setLastIdChange(data.lastKingdomIdChange.toDate());
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [user]);

  const generateRandomId = async () => {
    setIsCheckingId(true);
    let isUnique = false;
    let randomId = '';
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      randomId = Math.floor(100000000 + Math.random() * 900000000).toString();
      const q = query(collection(db, 'users'), where('kingdomId', '==', randomId), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) {
        isUnique = true;
      }
      attempts++;
    }

    if (isUnique) {
      setNewKingdomId(randomId);
      setMessage({ text: 'تم توليد معرف فريد بنجاح!', type: 'success' });
    } else {
      setMessage({ text: 'عذراً، فشل توليد معرف فريد. حاول مرة أخرى.', type: 'error' });
    }
    setIsCheckingId(false);
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

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
    if (!user || !e.target.files?.[0]) return;
    
    const file = e.target.files[0];
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const hash = await compressAndEncode(file, 300, 0.7);
      setLocalPreview(hash);
      setUploadProgress(60);
      setPhotoURL(hash);
      
      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
      setMessage({ text: 'تم تجهيز الصورة الملكية بنجاح! اضغط حفظ التغييرات لاعتمادها.', type: 'info' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'فشل في معالجة الصورة.', type: 'error' });
      setIsUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUpdating(true);
    setMessage({ text: '', type: '' });

    try {
      // Check if Kingdom ID has changed
      const updatePayload: {
        displayName: string;
        photoURL: string;
        isPrivate: boolean;
        kingdomId?: string;
        lastKingdomIdChange?: Date;
        location: string;
        hideFriends: boolean;
        bio?: string;
        gender?: string;
        birthday?: string;
        showPhoneNumber?: boolean;
      } = {
        displayName,
        photoURL: photoURL,
        isPrivate: isPrivate,
        location: location,
        hideFriends: hideFriends,
        bio: bio,
        gender: gender,
        birthday: birthday,
        showPhoneNumber: showPhoneNumber
      };

      if (newKingdomId !== kingdomId) {
        // 48 days logic
        const FORTY_EIGHT_DAYS_MS = 48 * 24 * 60 * 60 * 1000;
        const now = new Date().getTime();
        
        if (lastIdChange && (now - lastIdChange.getTime() < FORTY_EIGHT_DAYS_MS)) {
          const remainingDays = Math.ceil((FORTY_EIGHT_DAYS_MS - (now - lastIdChange.getTime())) / (24 * 60 * 60 * 1000));
          throw new Error(`يمكنك تغيير المعرف مرة كل 48 يوم. متبقي ${remainingDays} يوم.`);
        }

        if (newKingdomId.length < 4) {
          throw new Error('يجب أن يكون المعرف مكوناً من 4 أرقام أو أحرف على الأقل.');
        }

        // Check uniqueness in database
        const q = query(collection(db, 'users'), where('kingdomId', '==', newKingdomId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          throw new Error('عذراً، هذا المعرف مستخدم بالفعل من قبل محارب آخر.');
        }

        updatePayload.kingdomId = newKingdomId;
        updatePayload.lastKingdomIdChange = new Date();
        setKingdomId(newKingdomId);
        setLastIdChange(new Date());
      }

      // Update Firebase Auth Profile (Only Display Name, Hash is too long for Firebase Auth)
      await updateProfile(user, { displayName });
      
      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), updatePayload);

      setMessage({ text: 'تم تحديث البيانات والعرش بنجاح!', type: 'success' });
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUpdating(true);
    setMessage({ text: '', type: '' });

    try {
      if (email !== user.email) {
        await updateEmail(user, email);
        await updateDoc(doc(db, 'users', user.uid), { email });
      }
      if (password) {
        await updatePassword(user, password);
      }
      setMessage({ text: 'تم تحديث البيانات الأمنية بنجاح!', type: 'success' });
      setPassword('');
    } catch (err: unknown) {
      console.error(err);
      setMessage({ text: 'حدث خطأ: قد تحتاج إلى تسجيل الدخول مرة أخرى لتغيير البيانات الحساسة.', type: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (confirm('⚠️ تحذير نهائي: هل أنت متأكد من حذف حسابك تماماً؟ سيتم مسح كافة أرصدتك ونشاطاتك ولا يمكن التراجع عن هذا الفعل.')) {
      try {
        await deleteDoc(doc(db, 'users', user.uid));
        await deleteUser(user);
        router.push('/');
      } catch (err) {
        console.error(err);
        setMessage({ text: 'خطأ: يجب تسجيل الخروج والدخول مرة أخرى قبل حذف الحساب لدواعي أمنية.', type: 'error' });
      }
    }
  };

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-[#D4AF37]">جاري تحميل الإعدادات...</div>;

  const FORTY_EIGHT_DAYS_MS = 48 * 24 * 60 * 60 * 1000;
  const isIdLocked = role !== 'admin' && !!lastIdChange && (new Date().getTime() - lastIdChange.getTime() < FORTY_EIGHT_DAYS_MS);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans p-6 pb-20">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-[#D4AF37] hover:underline flex items-center gap-2 text-sm">
            <span>🔙</span> العودة للوحة التحكم
          </Link>
          <h1 className="text-3xl font-black font-pharaoh tracking-widest text-[#FFD700]">الإعدادات الملكية</h1>
        </div>

        {message.text && (
          <div className={`p-4 rounded-2xl text-center text-sm font-bold ${message.type === 'success' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* General Settings */}
          <section className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-[40px] p-8 space-y-6 shadow-2xl">
            <h2 className="text-[#FFD700] font-black uppercase tracking-widest text-sm flex items-center gap-2">
              <span>👤</span> المعلومات الشخصية
            </h2>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="flex flex-col items-center gap-6 mb-6">
                <div 
                  className="w-32 h-32 rounded-full border-4 border-[#D4AF37]/30 overflow-hidden relative group shadow-[0_0_30px_rgba(212,175,55,0.1)]"
                >
                  {(localPreview || photoURL) ? (
                    <Image src={localPreview || photoURL} alt="Avatar" fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900 text-3xl">🏛️</div>
                  )}
                  
                  <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                    <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-tighter text-center px-2">
                      {isUploading ? 'جاري الرفع...' : 'تغيير الصورة الملكية'}
                    </span>
                    <input type="file" className="hidden" onChange={handlePhotoUpload} disabled={isUploading} accept="image/*" />
                  </label>

                  {isUploading && (
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40 z-20">
                      <div 
                        className="h-full bg-[#D4AF37] shadow-[0_0_10px_#D4AF37] transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
                
                <div className="text-center">
                   <p className="text-[9px] text-[#D4AF37] font-black uppercase tracking-widest mb-1">المعرف الملكي</p>
                   <p className="text-xs text-gray-400 font-mono tracking-widest">{kingdomId}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest px-1">الاسم المستعار</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm focus:border-[#D4AF37] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest px-1">النبذة الشخصية (BIO)</label>
                  <textarea 
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm focus:border-[#D4AF37] outline-none h-24 resize-none"
                    placeholder="أخبرنا عنك..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest px-1">النوع</label>
                    <select 
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm focus:border-[#D4AF37] outline-none appearance-none"
                    >
                      <option value="">اختر</option>
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest px-1">تاريخ الميلاد</label>
                    <input 
                      type="date" 
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm focus:border-[#D4AF37] outline-none scheme-dark"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest px-1">رقم الهاتف (لا يمكن تعديله)</label>
                  <input 
                    type="text" 
                    value={phoneNumber}
                    readOnly
                    className="w-full bg-black border border-white/5 rounded-xl p-4 text-sm text-gray-500 cursor-not-allowed outline-none font-mono"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-[2rem] border border-white/5">
                  <div className="space-y-1">
                    <p className="text-[11px] font-black uppercase text-white tracking-widest">إظهار رقم الهاتف</p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">السماح للآخرين برؤية رقم هاتفك في ملفك</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowPhoneNumber(!showPhoneNumber)}
                    className={`w-12 h-6 rounded-full transition-all relative ${showPhoneNumber ? 'bg-green-600' : 'bg-gray-800'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showPhoneNumber ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] text-[#D4AF37] font-black uppercase tracking-widest">معرف المملكة (ID)</label>
                  {lastIdChange && (
                    <span className="text-[8px] text-gray-500 italic">
                      آخر تغيير: {lastIdChange.toLocaleDateString('ar-EG')}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newKingdomId}
                    onChange={(e) => setNewKingdomId(e.target.value)}
                    disabled={isIdLocked}
                    placeholder={isIdLocked ? "المعرف مغلق حالياً" : "أدخل المعرف الجديد"}
                    className={`flex-1 bg-black border rounded-xl p-4 text-sm outline-none font-mono tracking-widest transition-all ${isIdLocked ? 'border-red-500/20 text-gray-500 cursor-not-allowed' : 'border-[#D4AF37]/10 focus:border-[#D4AF37] text-white'}`}
                  />
                  <button 
                    type="button"
                    onClick={generateRandomId}
                    disabled={isCheckingId || isIdLocked}
                    className={`border px-3 rounded-xl transition-all text-xl ${isIdLocked ? 'bg-gray-900 border-white/5 text-gray-700 cursor-not-allowed' : 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#FFD700] hover:bg-[#D4AF37] hover:text-black'}`}
                    title={isIdLocked ? "لا يمكن التغيير حالياً" : "توليد معرف عشوائي"}
                  >
                    {isCheckingId ? '⏳' : '🎲'}
                  </button>
                </div>
                {isIdLocked ? (
                  <p className="text-[8px] text-red-500/70 px-1 mt-1 font-bold animate-pulse">🔒 المعرف مغلق لمدة 48 يوماً من آخر تغيير.</p>
                ) : (
                  <p className="text-[8px] text-gray-600 px-1 mt-1 font-bold">⚠️ يمكنك تغيير هذا المعرف مرة واحدة فقط كل 48 يوماً.</p>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black px-1">الموقع / الموطن الأصلي</label>
                  <input 
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="مثلاً: مصر، القاهرة..."
                    className="w-full bg-[#111] border border-white/5 rounded-2xl p-4 text-xs font-bold focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-[2rem] border border-white/5">
                  <div className="space-y-1">
                    <p className="text-[11px] font-black uppercase text-white tracking-widest">إخفاء قائمة الأصدقاء</p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">لن يتمكن أحد من رؤية حلفائك على ملفك الشخصي</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setHideFriends(!hideFriends)}
                    className={`w-12 h-6 rounded-full transition-all relative ${hideFriends ? 'bg-blue-600' : 'bg-gray-800'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${hideFriends ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-[2rem] border border-white/5">
                  <div className="space-y-1">
                    <p className="text-[11px] font-black uppercase text-white tracking-widest">ملف شخصي خاص</p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">تقييد رؤية منشوراتك وبياناتك للغرباء</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={`w-12 h-6 rounded-full transition-all relative ${isPrivate ? 'bg-[#D4AF37]' : 'bg-gray-800'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isPrivate ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={updating}
                className="w-full bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-black py-4 rounded-2xl shadow-xl hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all disabled:opacity-50"
              >
                حفظ التغييرات
              </button>
            </form>
          </section>

          {/* Security & Quick Actions */}
          <div className="space-y-8">
            
            <section className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-[40px] p-8 space-y-6 shadow-2xl">
              <h2 className="text-[#FFD700] font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <span>🔐</span> الأمان والحساب
              </h2>
              
              <form onSubmit={handleUpdateSecurity} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest px-1">البريد الإلكتروني</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm focus:border-[#D4AF37] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest px-1">كلمة المرور الجديدة</label>
                  <input 
                    type="password" 
                    placeholder="اتركها فارغة إذا لم ترد التغيير"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm focus:border-[#D4AF37] outline-none"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={updating}
                  className="w-full bg-white/5 border border-white/10 text-white font-bold py-4 rounded-2xl hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  تحديث بيانات الدخول
                </button>
              </form>
            </section>

            {/* Financial Quick Links */}
            <div className="grid grid-cols-2 gap-4">
              <Link href="/deposit" className="bg-green-500/10 border border-green-500/20 p-6 rounded-3xl text-center group hover:bg-green-500/20 transition-all">
                <span className="text-3xl block mb-2">📥</span>
                <span className="text-xs font-black text-green-500 uppercase tracking-widest">إيداع أموال</span>
              </Link>
              <Link href="/withdraw" className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-3xl text-center group hover:bg-blue-500/20 transition-all">
                <span className="text-3xl block mb-2">📤</span>
                <span className="text-xs font-black text-blue-500 uppercase tracking-widest">سحب أرباح</span>
              </Link>
            </div>

            {/* Danger Zone */}
            <button 
              onClick={handleDeleteAccount}
              className="w-full p-4 border border-red-500/20 text-red-500/50 hover:text-red-500 hover:border-red-500 transition-all text-[10px] font-bold uppercase tracking-[0.3em]"
            >
              حذف الحساب نهائياً 🗑️
            </button>

          </div>
        </div>

        {/* Footer Info */}
        <p className="text-center text-[10px] text-gray-600 uppercase tracking-widest">
            HBET Kingdom &copy; 2026 - All Rights Reserved to the Pharaohs
        </p>
      </div>

      {/* Cropping Modal removed */}
    </div>
  );
}
