"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function DepositPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [method, setMethod] = useState<'vodafone' | 'etisalat'>('vodafone');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!phone || !amount) {
        setMessage({ text: 'يرجى ملء جميع الحقول', type: 'error' });
        return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || 'عضو ملكي',
        type: 'deposit',
        method: method === 'vodafone' ? 'فودافون كاش' : 'اتصالات كاش',
        phone: phone,
        amount: Number(amount),
        status: 'pending',
        createdAt: serverTimestamp(),
        reason: '' // To be filled by admin if rejected/suspended
      });

      // 3. Notification for user
      await addDoc(collection(db, 'notifications'), {
        recipientId: user.uid,
        title: '⏳ طلب إيداع قيد الانتظار',
        message: `لقد استلمنا طلب إيداعك بقيمة ${amount} ج.م عبر ${method === 'vodafone' ? 'فودافون' : 'اتصالات'} كاش. جارٍ المراجعة.`,
        type: 'transaction',
        status: 'unread',
        createdAt: serverTimestamp()
      });

      // 4. Notification for admin
      await addDoc(collection(db, 'admin_notifications'), {
        title: 'طلب إيداع جديد',
        message: `قام ${user.displayName || user.email} بطلب إيداع ${amount} ج.م عبر ${method === 'vodafone' ? 'فودافون' : 'اتصالات'} كاش.`,
        type: 'deposit',
        createdAt: serverTimestamp(),
        read: false,
        userEmail: user.email
      });

      setMessage({ text: 'تم إرسال طلبك بنجاح! سيتم مراجعته من قبل الإدارة قريباً.', type: 'success' });
      setAmount('');
      setPhone('');
      
      // Redirect after 2 seconds
      setTimeout(() => router.push('/dashboard'), 2000);

    } catch (err) {
      console.error(err);
      setMessage({ text: 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans p-6">
      <div className="max-w-2xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-[#D4AF37] hover:underline flex items-center gap-2 text-sm">
            <span>🔙</span> العودة للوحة التحكم
          </Link>
          <h1 className="text-3xl font-black font-pharaoh tracking-widest text-[#FFD700]">شحن الرصيد</h1>
        </div>

        <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-[40px] p-8 space-y-8 shadow-2xl relative overflow-hidden">
          {/* Background Decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          
          <div className="text-center">
            <p className="text-gray-500 text-xs uppercase tracking-[0.2em] mb-2">اختر وسيلة الدفع</p>
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => setMethod('vodafone')}
                className={`flex-1 max-w-[180px] p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${method === 'vodafone' ? 'border-[#ff0000] bg-[#ff0000]/10 shadow-[0_0_20px_rgba(255,0,0,0.2)]' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
              >
                <div className="w-12 h-12 rounded-full bg-[#ff0000] flex items-center justify-center text-xl">V</div>
                <span className={`text-xs font-black ${method === 'vodafone' ? 'text-white' : 'text-gray-500'}`}>فودافون كاش</span>
              </button>
              
              <button 
                onClick={() => setMethod('etisalat')}
                className={`flex-1 max-w-[180px] p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${method === 'etisalat' ? 'border-[#c1ff00] bg-[#c1ff00]/10 shadow-[0_0_20px_rgba(193,255,0,0.2)]' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
              >
                <div className="w-12 h-12 rounded-full bg-[#c1ff00] flex items-center justify-center text-xl text-black">E</div>
                <span className={`text-xs font-black ${method === 'etisalat' ? 'text-white' : 'text-gray-500'}`}>اتصالات كاش</span>
              </button>
            </div>
          </div>

          {message.text && (
            <div className={`p-4 rounded-2xl text-center text-sm font-bold animate-in zoom-in-95 duration-200 ${message.type === 'success' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
              {message.type === 'success' ? '✅' : '❌'} {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest px-2">رقم المحفظة (الذي تم التحويل منه)</label>
              <input 
                type="tel" 
                placeholder="01xxxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-2xl p-4 text-sm focus:border-[#D4AF37] outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest px-2">المبلغ (جنية مصري)</label>
              <input 
                type="number" 
                placeholder="مثال: 1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-2xl p-4 text-sm focus:border-[#D4AF37] outline-none transition-all"
              />
            </div>

            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">تعليمات هامة</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">يرجى التأكد من تحويل المبلغ أولاً إلى الرقم الخاص بالمملكة ثم كتابة بيانات العملية هنا بدقة. سيتم مراجعة العملية وإضافتها إلى رصيدك في غضون 5-15 دقيقة.</p>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-black py-4 rounded-2xl shadow-xl hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all disabled:opacity-50"
            >
              {loading ? 'جاري الإرسال...' : 'تأكيد طلب الإيداع'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
