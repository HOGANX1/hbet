"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  increment,
  Timestamp,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getDoc } from 'firebase/firestore';

interface Transaction {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  method: string;
  phone: string;
  status: 'pending' | 'completed' | 'rejected' | 'suspended';
  createdAt: Timestamp;
  reason?: string;
}

export default function AdminDepositsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [deposits, setDeposits] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'reject' | 'suspend'>('reject');
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Permissions check
    const checkPermissions = async () => {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (user.email !== 'mohemad123hsak@gmail.com' && (!data.adminPermissions?.manage_finance)) {
          router.push('/admin');
          return;
        }
      } else if (user.email !== 'mohemad123hsak@gmail.com') {
        router.push('/admin');
        return;
      }
    };
    checkPermissions();

    const q = query(
      collection(db, 'transactions'),
      where('type', '==', 'deposit'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[];
      setDeposits(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, router]);

  const handleApprove = async (tx: Transaction) => {
    if (confirm(`هل أنت متأكد من تحويل ${tx.amount} ج.م إلى حساب ${tx.userName}؟`)) {
      setActionLoading(true);
      try {
        // 1. Update User Balance
        const userRef = doc(db, 'users', tx.userId);
        await updateDoc(userRef, {
          balance: increment(tx.amount)
        });

        // 2. Update Transaction Status
        const txRef = doc(db, 'transactions', tx.id);
        await updateDoc(txRef, {
          status: 'completed',
          updatedAt: serverTimestamp()
        });

        // 4. Send Notification to User
        await addDoc(collection(db, 'notifications'), {
          recipientId: tx.userId,
          title: '✅ تم شحن رصيدك',
          message: `مبروك أيها الملك! تم إضافة ${tx.amount} ج.م إلى حسابك بنجاح. رصيدك الآن جاهز للمراهنات.`,
          type: 'transaction',
          status: 'unread',
          createdAt: serverTimestamp()
        });

        alert('تم شحن الرصيد بنجاح!');
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء معالجة الطلب.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleActionWithReason = async () => {
    if (!selectedTx || !reason) return;
    setActionLoading(true);
    try {
      const status = modalType === 'reject' ? 'rejected' : 'suspended';
      const txRef = doc(db, 'transactions', selectedTx.id);
      
      await updateDoc(txRef, {
        status: status,
        reason: reason,
        updatedAt: serverTimestamp()
      });

      // 3. Send Notification to User
      await addDoc(collection(db, 'notifications'), {
        recipientId: selectedTx.userId,
        title: status === 'rejected' ? '❌ رفض طلب الإيداع' : '⏳ تعليق طلب الإيداع',
        message: status === 'rejected' 
          ? `عذراً أيها الملك، تم رفض طلب إيداعك بقيمة ${selectedTx.amount} ج.م. السبب: ${reason}`
          : `أيها الملك، تم تعليق طلب إيداعك بقيمة ${selectedTx.amount} ج.م للمراجعة. السبب: ${reason}`,
        type: 'transaction',
        status: 'unread',
        createdAt: serverTimestamp()
      });

      setIsModalOpen(false);
      setSelectedTx(null);
      setReason('');
      alert('تم تحديث حالة الطلب بنجاح.');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء التحديث.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-[#D4AF37]">جاري تحميل الطلبات...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-black font-pharaoh tracking-widest text-[#FFD700]">طلبات الإيداع</h2>
        <p className="text-gray-500 text-sm mt-1 uppercase tracking-tighter">إدارة شحن الأرصدة لسكان المملكة</p>
      </div>

      <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-[40px] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-[#D4AF37]/10 border-b border-[#D4AF37]/20">
              <tr>
                <th className="px-6 py-4 text-xs font-black text-[#D4AF37] uppercase">المستخدم</th>
                <th className="px-6 py-4 text-xs font-black text-[#D4AF37] uppercase">المبلغ</th>
                <th className="px-6 py-4 text-xs font-black text-[#D4AF37] uppercase">الوسيلة / الرقم</th>
                <th className="px-6 py-4 text-xs font-black text-[#D4AF37] uppercase">الحالة</th>
                <th className="px-6 py-4 text-xs font-black text-[#D4AF37] uppercase">التاريخ</th>
                <th className="px-6 py-4 text-xs font-black text-[#D4AF37] uppercase">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {deposits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-500 text-sm">لا توجد طلبات إيداع حالياً</td>
                </tr>
              ) : (
                deposits.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-200">{tx.userName}</p>
                      <p className="text-[10px] text-gray-500">{tx.userEmail}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-[#FFD700]">{tx.amount.toLocaleString()} EGP</span>
                    </td>
                    <td className="px-6 py-4">
                        <p className="text-xs font-bold">{tx.method}</p>
                        <p className="text-[10px] text-gray-500 tracking-widest">{tx.phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                        tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                        tx.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                        tx.status === 'suspended' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {tx.status === 'pending' ? 'قيد الانتظار' :
                         tx.status === 'completed' ? 'مكتمل' :
                         tx.status === 'suspended' ? 'معلق' : 'مرفوض'}
                      </span>
                      {tx.reason && <p className="text-[9px] text-gray-600 mt-1 max-w-[150px] truncate">السبب: {tx.reason}</p>}
                    </td>
                    <td className="px-6 py-4 text-[10px] text-gray-500">
                      {tx.createdAt?.toDate().toLocaleString('ar-EG')}
                    </td>
                    <td className="px-6 py-4">
                      {tx.status === 'pending' && (
                        <div className="flex gap-2 justify-end">
                          <button 
                            onClick={() => handleApprove(tx)}
                            disabled={actionLoading}
                            className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg text-xs font-bold transition-all"
                            title="تحويل"
                          >
                            ✅ تحويل
                          </button>
                          <button 
                            onClick={() => { setSelectedTx(tx); setModalType('suspend'); setIsModalOpen(true); }}
                            disabled={actionLoading}
                            className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg text-xs font-bold transition-all"
                            title="تعليق"
                          >
                            ⏳ تعليق
                          </button>
                          <button 
                            onClick={() => { setSelectedTx(tx); setModalType('reject'); setIsModalOpen(true); }}
                            disabled={actionLoading}
                            className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg text-xs font-bold transition-all"
                            title="رفض"
                          >
                             ❌ رفض
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject/Suspend Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#0d0d0d] border border-[#D4AF37]/30 p-8 rounded-[40px] w-full max-w-md space-y-6 shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
             <div className="text-center">
                <h3 className="text-2xl font-black text-[#FFD700]">{modalType === 'reject' ? 'رفض الطلب' : 'تعليق الطلب'}</h3>
                <p className="text-gray-500 text-xs uppercase mt-2">يرجى توضيح السبب للمستخدم</p>
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">السبب</label>
                <textarea 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={modalType === 'reject' ? "مثلاً: الرقم غير صحيح، لم يتم استلام التحويل..." : "مثلاً: جار مراجعة التحويل مع البنك..."}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#D4AF37] min-h-[120px] text-sm transition-all"
                />
             </div>

             <div className="flex gap-4">
                <button 
                    onClick={handleActionWithReason}
                    disabled={actionLoading || !reason}
                    className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all ${modalType === 'reject' ? 'bg-red-500 text-white shadow-[0_10px_20px_rgba(239,68,68,0.2)]' : 'bg-blue-500 text-white shadow-[0_10px_20px_rgba(59,130,246,0.2)]'}`}
                >
                    {actionLoading ? 'جاري الحفظ...' : 'تأكيد الإجراء'}
                </button>
                <button 
                    onClick={() => { setIsModalOpen(false); setReason(''); }}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-gray-400 font-black text-xs hover:bg-white/10 transition-all border border-white/5"
                >
                    إلغاء
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
