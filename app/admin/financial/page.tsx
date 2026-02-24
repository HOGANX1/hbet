"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getDoc, doc } from 'firebase/firestore';

interface Transaction {
  id: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  method: string;
  status: 'pending' | 'completed' | 'rejected';
  userEmail: string;
  createdAt: Timestamp;
}

export default function FinancialPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTx, setNewTx] = useState({
    amount: '',
    type: 'deposit',
    method: 'Vodafone Cash',
    userEmail: '',
    status: 'completed'
  });

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

    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, router]);

  const totalDeposits = transactions
    .filter(t => t.type === 'deposit' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalWithdrawals = transactions
    .filter(t => t.type === 'withdrawal' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netRevenue = totalDeposits - totalWithdrawals;

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'transactions'), {
        amount: Number(newTx.amount),
        type: newTx.type,
        method: newTx.method,
        userEmail: newTx.userEmail,
        status: newTx.status,
        createdAt: serverTimestamp()
      });

      // Send notification to admin
      await addDoc(collection(db, 'admin_notifications'), {
        title: newTx.type === 'deposit' ? 'إيداع جديد' : 'سحب جديد',
        message: `تم تسجيل ${newTx.type === 'deposit' ? 'إيداع' : 'سحب'} بقيمة ${newTx.amount} EGP للمستخدم ${newTx.userEmail} عبر ${newTx.method}.`,
        type: 'deposit',
        createdAt: serverTimestamp(),
        read: false,
        userEmail: newTx.userEmail
      });

      // Add to Recent Activity
      await addDoc(collection(db, 'recent_activity'), {
        title: newTx.type === 'deposit' ? 'إيداع' : 'سحب',
        description: `تم ${newTx.type === 'deposit' ? 'إيداع' : 'سحب'} مبلغ ${newTx.amount} EGP للمستخدم ${newTx.userEmail}.`,
        icon: newTx.type === 'deposit' ? '💰' : '💸',
        type: 'financial',
        createdAt: serverTimestamp()
      });

      setIsModalOpen(false);
      setNewTx({
        amount: '',
        type: 'deposit',
        method: 'Vodafone Cash',
        userEmail: '',
        status: 'completed'
      });
    } catch (err) {
      console.error("Error adding transaction:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black font-pharaoh tracking-widest text-[#FFD700]">السجلات المالية</h2>
          <p className="text-gray-500 text-sm mt-1 uppercase tracking-tighter">إدارة الإيداعات والسحوبات في المملكة</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-black px-6 py-3 rounded-xl shadow-lg hover:scale-105 transition-all text-sm"
        >
          + إضافة عملية يدوية
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="إجمالي الإيداعات" value={`${totalDeposits.toLocaleString()} EGP`} icon="💰" color="text-green-500" />
        <StatCard title="إجمالي السحوبات" value={`${totalWithdrawals.toLocaleString()} EGP`} icon="💸" color="text-red-500" />
        <StatCard title="صافي الأرباح (Revenue)" value={`${netRevenue.toLocaleString()} EGP`} icon="👑" color="text-[#FFD700]" glow />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Deposits Table */}
        <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-[#D4AF37]/10 bg-[#111] flex justify-between items-center">
            <h3 className="text-lg font-bold text-[#FFD700] flex items-center gap-2">
              <span>📥</span> آخر الإيداعات
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="bg-black/50 text-[#D4AF37] border-b border-[#D4AF37]/10">
                  <th className="px-6 py-4 font-black">المستخدم</th>
                  <th className="px-6 py-4 font-black">المبلغ</th>
                  <th className="px-6 py-4 font-black">الطريقة</th>
                  <th className="px-6 py-4 font-black">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.filter(t => t.type === 'deposit').length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">لا يوجد إيداعات حالياً</td></tr>
                ) : (
                  transactions.filter(t => t.type === 'deposit').slice(0, 10).map(t => (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-300">{t.userEmail}</td>
                      <td className="px-6 py-4 text-green-500 font-bold">+{t.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-gray-400">{t.method}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs">{t.createdAt?.toDate().toLocaleDateString('ar-EG')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Withdrawals Table */}
        <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-[#D4AF37]/10 bg-[#111] flex justify-between items-center">
            <h3 className="text-lg font-bold text-[#FFD700] flex items-center gap-2">
              <span>📤</span> آخر السحوبات
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="bg-black/50 text-[#D4AF37] border-b border-[#D4AF37]/10">
                  <th className="px-6 py-4 font-black">المستخدم</th>
                  <th className="px-6 py-4 font-black">المبلغ</th>
                  <th className="px-6 py-4 font-black">الطريقة</th>
                  <th className="px-6 py-4 font-black">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.filter(t => t.type === 'withdrawal').length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">لا يوجد سحوبات حالياً</td></tr>
                ) : (
                  transactions.filter(t => t.type === 'withdrawal').slice(0, 10).map(t => (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-300">{t.userEmail}</td>
                      <td className="px-6 py-4 text-red-500 font-bold">-{t.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-gray-400">{t.method}</td>
                      <td className="px-6 py-4 text-gray-500 text-xs">{t.createdAt?.toDate().toLocaleDateString('ar-EG')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a0a] border border-[#D4AF37]/30 w-full max-w-md rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(212,175,55,0.2)]">
            <div className="bg-gradient-to-r from-[#D4AF37] to-[#FFD700] p-6 text-black font-black flex justify-between items-center">
              <span className="flex items-center gap-3">
                <span className="text-2xl">🏛️</span> تسجيل عملية جديدة
              </span>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="hover:scale-125 transition-transform text-2xl"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddTransaction} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={() => setNewTx({...newTx, type: 'deposit'})}
                  className={`py-3 rounded-xl font-bold transition-all ${newTx.type === 'deposit' ? 'bg-green-500/20 border-2 border-green-500 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'bg-white/5 border border-white/10 text-gray-500'}`}
                >
                  إيداع 📥
                </button>
                <button 
                  type="button"
                  onClick={() => setNewTx({...newTx, type: 'withdrawal'})}
                  className={`py-3 rounded-xl font-bold transition-all ${newTx.type === 'withdrawal' ? 'bg-red-500/20 border-2 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-white/5 border border-white/10 text-gray-500'}`}
                >
                  سحب 📤
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">البريد الإلكتروني للمستخدم</label>
                <input 
                  type="email" 
                  required
                  placeholder="user@example.com"
                  value={newTx.userEmail}
                  onChange={(e) => setNewTx({...newTx, userEmail: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#D4AF37] transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">المبلغ (EGP)</label>
                <input 
                  type="number" 
                  required
                  placeholder="0.00"
                  value={newTx.amount}
                  onChange={(e) => setNewTx({...newTx, amount: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#D4AF37] transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">طريقة المعاملة</label>
                <select 
                  value={newTx.method}
                  onChange={(e) => setNewTx({...newTx, method: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#D4AF37] transition-colors appearance-none"
                >
                  <option value="Vodafone Cash">Vodafone Cash</option>
                  <option value="Etisalat Cash">Etisalat Cash</option>
                  <option value="Orange Cash">Orange Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-black py-4 rounded-2xl shadow-xl hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all mt-4"
              >
                تأكيد وتسجيل العملية
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color, glow = false }: { title: string; value: string; icon: string; color: string; glow?: boolean }) {
  return (
    <div className={`bg-[#0a0a0a] border border-[#D4AF37]/20 p-8 rounded-[40px] relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all ${glow ? 'shadow-[0_0_40px_rgba(212,175,55,0.1)]' : ''}`}>
      <div className="flex flex-col items-center text-center relative z-10">
        <span className="text-4xl mb-4 group-hover:scale-125 transition-transform duration-500">{icon}</span>
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">{title}</h3>
        <p className={`text-4xl font-black ${color} tracking-tighter`}>{value}</p>
      </div>
      {/* Texture Background */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37] opacity-[0.03] -mr-10 -mt-10 rounded-full blur-3xl"></div>
    </div>
  );
}
