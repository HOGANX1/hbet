"use client";

import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'; 
import { doc, setDoc, collection, addDoc, serverTimestamp, query, where, limit, getDocs } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  // Step Management
  const [step, setStep] = useState(1);
  
  // Step 1: Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [generatedCaptcha, setGeneratedCaptcha] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  
  // Step 2: Gender
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  
  // Step 3: Profile (Optional)
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [isPhotoSelected, setIsPhotoSelected] = useState(false);

  // Step 4: Personal Info
  const [birthday, setBirthday] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const refreshCaptcha = () => {
    setGeneratedCaptcha(Math.floor(1000 + Math.random() * 9000).toString());
    setCaptchaInput('');
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
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const nextStep = () => {
    setError('');
    if (step === 1) {
      if (!displayName || !email || !password || !confirmPassword) {
        setError('يرجى ملء جميع الحقول المطلوبة.');
        return;
      }
      if (password !== confirmPassword) {
        setError('كلمات المرور غير متطابقة.');
        return;
      }
      if (captchaInput !== generatedCaptcha) {
        setError('رمز التأكد غير صحيح.');
        refreshCaptcha();
        return;
      }
    }
    if (step === 2) {
      if (!gender) {
        setError('يرجى تحديد النوع.');
        return;
      }
    }
    if (step === 4) {
      if (!birthday || !phoneNumber) {
        setError('يرجى إدخال تاريخ الميلاد ورقم الهاتف.');
        return;
      }
      handleRegister();
      return;
    }
    setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    try {
      const hash = await compressAndEncode(file, 300, 0.7);
      setPhotoURL(hash);
      setIsPhotoSelected(true);
    } catch (err) {
      console.error(err);
      setError('فشل في معالجة الصورة الملكية.');
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. Create User in Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Generate a unique 9-digit Kingdom ID
      let kingdomId = '';
      let isUnique = false;
      const usersRef = collection(db, 'users');
      
      // Limit retries for safety
      let retries = 0;
      while (!isUnique && retries < 10) {
        kingdomId = Math.floor(100000000 + Math.random() * 900000000).toString();
        const q = query(usersRef, where('kingdomId', '==', kingdomId), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) isUnique = true;
        retries++;
      }

      // 3. Update auth profile (for immediate display)
      await updateProfile(user, { 
        displayName,
        photoURL: photoURL 
      });

      // 4. Create main user document in Firestore
      const userData = {
        uid: user.uid,
        kingdomId,
        email: email.toLowerCase(),
        displayName,
        photoURL: photoURL,
        gender,
        bio: bio || 'Welcome to my kingdom!',
        birthday,
        phoneNumber,
        showPhoneNumber: false,
        xp: 0,
        level: 1,
        balance: 0, // Initial balance
        friendsCount: 0,
        friends: [],
        rank: 'Soldier',
        role: 'user',
        isNewUser: true,
        joinedAt: serverTimestamp(),
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', user.uid), userData);

      // 5. System Notifications & Activity
      try {
        // Universal notification for admin/system
        await addDoc(collection(db, 'notifications'), {
          recipientId: 'admin_broadcast', // Or keep generic
          title: '🔱 محارب جديد ينضم للمملكة',
          message: `انضم ${displayName} إلى صفوفنا الآن.`,
          type: 'system',
          status: 'unread',
          createdAt: serverTimestamp()
        });

        await addDoc(collection(db, 'recent_activity'), {
          title: 'عضو جديد',
          description: `تم انضمام ${displayName} إلى المملكة.`,
          icon: '👤',
          type: 'registration',
          createdAt: serverTimestamp()
        });
      } catch (notifErr) {
        console.warn("Notification error (non-critical):", notifErr);
      }

      router.push('/dashboard'); 
    } catch (err: unknown) {
      console.error("Full Registration Error:", err);
      const errorStr = String(err);
      refreshCaptcha();
      
      const errorCode = (err as { code?: string })?.code;
      if (errorCode === 'auth/email-already-in-use') {
        setError('هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.');
      } else if (errorCode === 'auth/weak-password') {
        setError('كلمة المرور ضعيفة جداً. يرجى اختيار كلمة مرور أقوى.');
      } else if (errorStr.includes('quota')) {
        setError('فشل في حفظ البيانات بسبب حجم الصورة الكبير. يرجى اختيار صورة أصغر.');
      } else {
        setError(`فشل التسجيل: ${(err as Error)?.message || 'خطأ غير معروف'}`);
      }
      setStep(1); 
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase() || 'P';
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#D4AF37] rounded-full blur-[150px] opacity-10"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#FFD700] rounded-full blur-[150px] opacity-10"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-block p-4 rounded-full bg-black border border-[#D4AF37]/30 mb-4 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
            <Image src="/logo.png" alt="HBET Logo" width={60} height={60} />
          </div>
          <h1 className="text-3xl font-black font-pharaoh tracking-widest text-[#FFD700]">انضم للمملكة</h1>
          <p className="text-gray-500 mt-2 text-sm uppercase tracking-tighter">
            {step === 1 && 'سجل الآن وابدأ رحلة الثراء'}
            {step === 2 && 'أخبرنا المزيد عن هويتك'}
            {step === 3 && 'خصص مظهرك في المملكة'}
            {step === 4 && 'الخطوة الأخيرة للانضمام'}
          </p>
        </div>

        <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-[#D4AF37]/20 p-8 rounded-3xl shadow-2xl">
          {/* Progress Indicator */}
          <div className="flex justify-between mb-8 px-2">
            {[1, 2, 3, 4].map((s) => (
              <div 
                key={s} 
                className={`w-3 h-3 rounded-full transition-all duration-500 ${step >= s ? 'bg-[#D4AF37] shadow-[0_0_10px_#D4AF37]' : 'bg-gray-800'}`}
              />
            ))}
          </div>

          <div className="space-y-6">
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <label className="block text-[10px] font-black text-[#D4AF37] uppercase tracking-widest mb-2 px-1 text-right">الاسم الكامل</label>
                  <input 
                    type="text" 
                    required 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="أدخل اسمك الكريم"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37] transition-all outline-none text-right"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#D4AF37] uppercase tracking-widest mb-2 px-1 text-right">البريد الإلكتروني</label>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="pharaoh@hbet.com"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37] transition-all outline-none text-right"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#D4AF37] uppercase tracking-widest mb-2 px-1 text-right">كلمة المرور</label>
                  <input 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37] transition-all outline-none text-right"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#D4AF37] uppercase tracking-widest mb-2 px-1 text-right">تأكيد كلمة المرور</label>
                  <input 
                    type="password" 
                    required 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37] transition-all outline-none text-right"
                  />
                </div>

                <div className="bg-black/40 border border-[#D4AF37]/10 p-4 rounded-2xl">
                  <div className="flex items-center justify-between mb-3 text-right" dir="rtl">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">أدخل الرقم للتأكيد أنك إنسان</label>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={refreshCaptcha}
                        className="text-[#D4AF37] hover:text-[#FFD700] transition-colors p-1"
                        title="تحديث الرمز"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                      </button>
                      <div className="bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-black px-4 py-1 rounded-lg tracking-[0.5em] select-none italic">
                        {generatedCaptcha}
                      </div>
                    </div>
                  </div>
                  <input 
                    type="text" 
                    required 
                    maxLength={4}
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="الرقم الظاهر بجانبك"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-black tracking-widest focus:border-[#D4AF37] transition-all outline-none"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 text-center">
                <label className="block text-sm font-black text-[#D4AF37] uppercase tracking-widest mb-4">اختر النوع</label>
                <div className="grid grid-cols-2 gap-4">
                   <button 
                    onClick={() => setGender('male')}
                    className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-3 ${gender === 'male' ? 'bg-[#D4AF37]/20 border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.2)]' : 'bg-black border-white/10 hover:border-blue-500/50'}`}
                   >
                     <span className="text-4xl text-blue-400">👨</span>
                     <span className="font-bold">ذكر</span>
                   </button>
                   <button 
                    onClick={() => setGender('female')}
                    className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-3 ${gender === 'female' ? 'bg-[#D4AF37]/20 border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.2)]' : 'bg-black border-white/10 hover:border-pink-500/50'}`}
                   >
                     <span className="text-4xl text-pink-400">👩</span>
                     <span className="font-bold">أنثى</span>
                   </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-32 h-32 rounded-full border-4 border-[#D4AF37]/30 bg-black overflow-hidden relative flex items-center justify-center shadow-2xl">
                    {photoURL ? (
                      <Image src={photoURL} alt="Preview" fill className="object-cover" />
                    ) : (
                      <span className="text-5xl font-black text-[#D4AF37]">{getInitials(displayName)}</span>
                    )}
                  </div>
                  <label className="cursor-pointer bg-[#D4AF37] text-black px-4 py-2 rounded-lg font-bold text-xs hover:scale-105 transition-transform">
                    {isPhotoSelected ? 'تغيير الصورة' : 'اختر صورة ملكية'}
                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                  </label>
                  <p className="text-[10px] text-gray-500">سيتم استخدام الحرف الأول من اسمك إذا لم تختر صورة</p>
                </div>

                <div className="space-y-2 mt-6">
                  <label className="block text-[10px] font-black text-[#D4AF37] uppercase tracking-widest text-right px-1">نبذة عنك (BIO)</label>
                  <textarea 
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="من أنت في هذه المملكة؟"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37] transition-all outline-none text-right h-24 resize-none"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 text-right">
                <div>
                  <label className="block text-[10px] font-black text-[#D4AF37] uppercase tracking-widest mb-2 px-1">تاريخ الميلاد</label>
                  <input 
                    type="date" 
                    required 
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37] transition-all outline-none text-right scheme-dark"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#D4AF37] uppercase tracking-widest mb-1 px-1">رقم الهاتف</label>
                  <p className="text-[9px] text-gray-500 mb-2 px-1">مطلوب للتوثيق ولا يمكن حذفه لاحقاً</p>
                  <input 
                    type="tel" 
                    required 
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="01xxxxxxxxx"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37] transition-all outline-none text-right"
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="text-red-500 text-xs bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-center font-bold">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              {step > 1 && (
                <button 
                  onClick={prevStep}
                  className="flex-1 py-4 bg-white/5 border border-white/10 text-white font-black rounded-xl hover:bg-white/10 transition-all"
                >
                  السابق
                </button>
              )}
              <button 
                onClick={nextStep}
                disabled={loading}
                className="flex-[2] py-4 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-black rounded-xl shadow-[0_10px_20px_rgba(212,175,55,0.2)] hover:shadow-[0_15px_30px_rgba(212,175,55,0.4)] transform hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0"
              >
                {loading ? 'جاري فتح الأبواب...' : (step === 4 ? 'إتمام التسجيل' : 'التالي')}
              </button>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-500 text-xs">
              لديك حساب بالفعل؟{' '}
              <Link href="/login" className="text-[#FFD700] font-bold hover:underline">
                سجل دخولك من هنا
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-6 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
           <Image src="/logo.png" alt="HBET" width={30} height={30} />
           <div className="w-px h-8 bg-white/20"></div>
           <p className="text-[10px] flex items-center font-bold uppercase tracking-widest">مملكة المراهنات الأولى</p>
        </div>
      </div>
    </div>
  );
}
