"use client";

import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, query, where, limit, getDocs } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdminChoiceOpen, setIsAdminChoiceOpen] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const adminEmail = "mohemad123hsak@gmail.com";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { setPersistence, browserSessionPersistence } = await import('firebase/auth');
      await setPersistence(auth, browserSessionPersistence);
      
      let loginEmail = identifier;

      // Check if identifier is a Kingdom ID (not an email)
      if (!identifier.includes('@')) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('kingdomId', '==', identifier), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          loginEmail = querySnapshot.docs[0].data().email;
        } else {
          setError('المعرفة الملكية (ID) غير موجودة.');
          setLoading(false);
          return;
        }
      }

      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const user = userCredential.user;
      
      if (user.email === adminEmail) {
        setIsAdminChoiceOpen(true);
      } else {
        // Fetch User Stats from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : null;

        // Check if user is blocked
        if (userData?.isBlocked) {
          const reasonText = userData.blockReason ? `\nالسبب: ${userData.blockReason}` : '';
          if (userData.blockType === 'permanent') {
            await auth.signOut();
            setError(`تم حظر حسابك بشكل أبدي من دخول المملكة. يرجى التواصل مع الإدارة.${reasonText}`);
            setLoading(false);
            return;
          } else if (userData.blockType === 'temporary' && userData.blockUntil) {
            const now = new Date();
            const until = userData.blockUntil.toDate();
            if (now < until) {
              await auth.signOut();
              setError(`حسابك محظور مؤقتاً حتى: ${until.toLocaleString('ar-EG')}${reasonText}`);
              setLoading(false);
              return;
            } else {
              // Time has passed, unblock automatically in background
              await updateDoc(doc(db, 'users', user.uid), {
                isBlocked: false,
                blockType: null,
                blockUntil: null
              });
            }
          }
        }

        // Send notification to admin
        await addDoc(collection(db, 'admin_notifications'), {
          title: 'تسجيل دخول جديد',
          message: `دخل ${user.displayName || 'مستخدم'} (${user.email}) إلى الموقع الآن. المستوي: ${userData?.level || 1} الرتبة: ${userData?.rank || 'Soldier'}`,
          type: 'login',
          createdAt: serverTimestamp(),
          read: false,
          userEmail: user.email
        });

        // Add to Recent Activity
        await addDoc(collection(db, 'recent_activity'), {
          title: 'تسجيل دخول',
          description: `المستخدم ${user.email} دخل المملكة. (Level: ${userData?.level || 1}, Rank: ${userData?.rank || 'Soldier'}${userData?.balance !== undefined ? `, Balance: ${userData.balance} EGP` : ''})`,
          icon: '🔑',
          type: 'login',
          createdAt: serverTimestamp(),
          metadata: {
            email: user.email,
            level: userData?.level || 1,
            rank: userData?.rank || 'Soldier',
            balance: userData?.balance || 0
          }
        });

        router.push('/dashboard'); // Regular users go to Dashboard
      }
    } catch (err: unknown) {
      console.error(err);
      setError('خطأ في البريد أو كلمة المرور. تأكد من صحة بياناتك.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Decorative Background */}
      <div className="absolute inset-0 z-0 opacity-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D4AF37] rounded-full blur-[200px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <Link href="/">
            <div className="inline-block p-4 rounded-full bg-black border border-[#D4AF37]/30 mb-4 shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:scale-110 transition-transform">
              <Image src="/logo.png" alt="HBET Logo" width={60} height={60} />
            </div>
          </Link>
          <h1 className="text-3xl font-black font-pharaoh tracking-widest text-[#FFD700]">دخول الملوك</h1>
          <p className="text-gray-500 mt-2 text-sm uppercase tracking-tighter">عد إلى مملكتك واستكمل رحلة المجد</p>
        </div>

        <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-[#D4AF37]/20 p-8 rounded-3xl shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-[#D4AF37] uppercase tracking-widest mb-2 px-1">البريد الإلكتروني أو المعرفة (ID)</label>
              <input 
                type="text" 
                required 
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="pharaoh@hbet.com أو 123456789"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37] transition-all outline-none"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2 px-1">
                <label className="block text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">كلمة المرور</label>
                <Link href="#" className="text-[10px] text-gray-500 hover:text-[#D4AF37]">نسيت كلمة المرور؟</Link>
              </div>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37] transition-all outline-none"
              />
            </div>

            {error && (
              <p className="text-red-500 text-xs bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-center font-bold">
                {error}
              </p>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-black rounded-xl shadow-[0_10px_20px_rgba(212,175,55,0.2)] hover:shadow-[0_15px_30px_rgba(212,175,55,0.4)] transform hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0"
            >
              {loading ? 'جاري التحقق من الهوية...' : 'دخول إلى المملكة'}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <p className="text-gray-500 text-xs">
              ليس لديك حساب حتى الآن؟{' '}
              <Link href="/register" className="text-[#FFD700] font-bold hover:underline">
                أنشئ حسابك المجاني الآن
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Admin Choice Modal */}
      {isAdminChoiceOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#0a0a0a] border border-[#D4AF37]/30 p-10 rounded-[40px] w-full max-w-lg text-center shadow-[0_0_100px_rgba(212,175,55,0.2)] relative overflow-hidden">
            {/* Pyramid Decor */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#D4AF37] opacity-5 rotate-45"></div>
            
            <div className="mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-[#FFD700] to-[#D4AF37] rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_30px_#D4AF37]/20 mb-6">
                <span className="text-4xl">👑</span>
              </div>
              <h2 className="text-3xl font-black font-pharaoh tracking-widest text-[#FFD700] mb-2 uppercase">مرحباً أيها الفرعون</h2>
              <p className="text-gray-400 text-sm">اختر وجهتك القادمة في المملكة</p>
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => router.push('/admin')}
                className="w-full py-5 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-black rounded-2xl shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
              >
                <span>🏰</span>
                <span>دخول لوحة الإدارة</span>
              </button>
              
              <button 
                onClick={() => router.push('/')}
                className="w-full py-5 bg-white/5 border border-white/10 text-white font-black rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-3"
              >
                <span>🌍</span>
                <span>تصفح الموقع العام</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
