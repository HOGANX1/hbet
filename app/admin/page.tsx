"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { collection, getCountFromServer, addDoc, serverTimestamp, Timestamp, getDocs, writeBatch, doc } from 'firebase/firestore';

interface Activity {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: string;
  createdAt: Timestamp;
}

export default function AdminDashboard() {
  const [totalUsers, setTotalUsers] = useState<string>('...');
  const [loading, setLoading] = useState(true);
  const [financials, setFinancials] = useState({ deposits: 0, withdrawals: 0, revenue: 0 });
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const router = useRouter();
  
  // Offer Modal State
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerValue, setOfferValue] = useState('');
  const [offerDuration, setOfferDuration] = useState('1'); // In hours
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const { user } = useAuth();
  const [adminPerms, setAdminPerms] = useState<any>(null);

  useEffect(() => {
     async function fetchData() {
      try {
        if (user) {
          const { getDoc, doc } = await import('firebase/firestore');
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setAdminPerms(userDoc.data().adminPermissions);
          }
        }

        // Fetch User Count
        const userColl = collection(db, 'users');
        const userSnapshot = await getCountFromServer(userColl);
        setTotalUsers(userSnapshot.data().count.toLocaleString());

        // Fetch Financials
        const { getDocs } = await import('firebase/firestore');
        const txSnap = await getDocs(collection(db, 'transactions'));
        
        let deps = 0;
        let withs = 0;
        
        txSnap.forEach(doc => {
          const data = doc.data();
          if (data.status === 'completed') {
            if (data.type === 'deposit') deps += Number(data.amount);
            if (data.type === 'withdrawal') withs += Number(data.amount);
          }
        });

        setFinancials({
          deposits: deps,
          withdrawals: withs,
          revenue: deps - withs
        });

        // Fetch Recent Activity
        const { query, orderBy, limit } = await import('firebase/firestore');
        const activityQuery = query(collection(db, 'recent_activity'), orderBy('createdAt', 'desc'), limit(10));
        const activitySnap = await getDocs(activityQuery);
        const activities = activitySnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Activity[];
        setRecentActivity(activities);

      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setTotalUsers('Error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const durationHours = parseInt(offerDuration);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + durationHours);

      await addDoc(collection(db, 'offers'), {
        value: offerValue,
        duration: durationHours,
        createdAt: serverTimestamp(),
        expiresAt: expiresAt,
        active: true
      });

      // 2. Notify all users (Robust chunked implementation)
      const usersSnap = await getDocs(collection(db, 'users'));
      const userDocs = usersSnap.docs;
      
      // Process in chunks of 450 to stay under the 500 operation limit
      for (let i = 0; i < userDocs.length; i += 450) {
        const chunk = userDocs.slice(i, i + 450);
        const batch = writeBatch(db);
        
        chunk.forEach(userDoc => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            recipientId: userDoc.id,
            title: '🎁 عرض ملكي جديد!',
            message: `أيها الملك، هناك عرض جديد متاح الآن: ${offerValue}. ينتهي العرض خلال ${offerDuration} ساعة.`,
            type: 'offer',
            status: 'unread',
            createdAt: serverTimestamp()
          });
        });
        
        await batch.commit();
      }

      setMessage({ type: 'success', text: 'Offer created and all users notified!' });
      setOfferValue('');
      setOfferDuration('1');
      setTimeout(() => {
        setIsOfferModalOpen(false);
        setMessage(null);
      }, 2000);
    } catch (err) {
      console.error("Error creating offer:", err);
      setMessage({ type: 'error', text: 'Failed to create offer. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-1">Admin Dashboard</h2>
      <p className="text-gray-400">Welcome back, Administrator. Here&apos;s what&apos;s happening today.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <DashboardCard 
          title="Total Users" 
          value={totalUsers} 
          change="+12%" 
          icon="👥" 
          isLoading={loading}
        />
        <DashboardCard title="Deposits" value={`${financials.deposits.toLocaleString()} EGP`} change="+5%" icon="📥" />
        <DashboardCard title="Withdrawals" value={`${financials.withdrawals.toLocaleString()} EGP`} change="-2%" icon="📤" />
        <DashboardCard title="Revenue" value={`${financials.revenue.toLocaleString()} EGP`} change="+8%" icon="💰" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
        <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 p-6 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-[#FFD700]">Recent Activity</h3>
            <Link href="/admin/activities" className="text-[10px] text-[#D4AF37] uppercase font-black hover:underline tracking-widest">View All</Link>
          </div>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-10">لا يوجد نشاطات مسجلة حالياً</p>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-3 border-b border-[#D4AF37]/10 last:border-0">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-xs text-[#FFD700]">
                      {activity.icon || '📜'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{activity.description || activity.title}</p>
                      <p className="text-xs text-gray-500">
                        {activity.createdAt?.toDate().toLocaleTimeString('ar-EG')} - {activity.createdAt?.toDate().toLocaleDateString('ar-EG')}
                      </p>
                    </div>
                  </div>
                  <span className="text-[#D4AF37] text-[10px] uppercase font-bold">{activity.title}</span>
                </div>
              ))
            )}
          </div>
        </div>

         <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 p-6 rounded-xl">
          <h3 className="text-xl font-bold text-[#FFD700] mb-4">Quick Shortcuts</h3>
          <div className="grid grid-cols-2 gap-4">
            {(adminPerms?.manage_offers || user?.email === 'mohemad123hsak@gmail.com') && (
              <ShortcutButton label="Create Offer" icon="🎁" onClick={() => setIsOfferModalOpen(true)} />
            )}
            {(adminPerms?.manage_users || user?.email === 'mohemad123hsak@gmail.com') && (
              <ShortcutButton label="User Management" icon="👥" onClick={() => router.push('/admin/users')} />
            )}
            {(adminPerms?.manage_offers || user?.email === 'mohemad123hsak@gmail.com') && (
              <ShortcutButton label="Broadcast" icon="📢" />
            )}
            <ShortcutButton label="Audit Logs" icon="📋" onClick={() => router.push('/admin/activities')} />
          </div>
        </div>
      </div>

      {/* Offer Modal */}
      {isOfferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a0a] border border-[#D4AF37] w-full max-w-md rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.1)]">
            <div className="bg-gradient-to-r from-[#D4AF37] to-[#FFD700] p-4 text-black font-bold flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span>🎁</span> Create New Offer
              </span>
              <button 
                onClick={() => setIsOfferModalOpen(false)}
                className="hover:scale-110 transition-transform"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateOffer} className="p-6 space-y-4">
              {message && (
                <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                  {message.text}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider">Offer Value</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. 50% Bonus on first deposit"
                  value={offerValue}
                  onChange={(e) => setOfferValue(e.target.value)}
                  className="w-full bg-[#151515] border border-[#D4AF37]/20 rounded-lg p-3 text-white focus:outline-none focus:border-[#D4AF37] transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider">Duration (Hours)</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  value={offerDuration}
                  onChange={(e) => setOfferDuration(e.target.value)}
                  className="w-full bg-[#151515] border border-[#D4AF37]/20 rounded-lg p-3 text-white focus:outline-none focus:border-[#D4AF37] transition-colors"
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-bold py-3 rounded-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Creating...' : 'Launch Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardCard({ title, value, change, icon, isLoading = false }: { title: string; value: string; change: string; icon: string; isLoading?: boolean }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 p-6 rounded-xl hover:border-[#D4AF37]/50 transition-all group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl group-hover:scale-110 transition-transform">{icon}</span>
        <span className="text-green-500 text-xs font-bold">{change}</span>
      </div>
      <p className="text-gray-400 text-sm">{title}</p>
      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-bold text-white ${isLoading ? 'animate-pulse' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

function ShortcutButton({ label, icon, onClick }: { label: string; icon: string; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center p-4 bg-[#151515] border border-[#D4AF37]/10 rounded-lg hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/5 transition-all group"
    >
      <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-sm font-medium text-gray-300 group-hover:text-white">{label}</span>
    </button>
  );
}

