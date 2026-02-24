"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  Timestamp, 
  deleteDoc, 
  doc, 
  getDocs, 
  writeBatch 
} from 'firebase/firestore';
import Link from 'next/link';

interface Activity {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: string;
  createdAt: Timestamp;
}

export default function AdminActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'recent_activity'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Activity[];
      setActivities(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleClearAll = async () => {
    if (!confirm('هل أنت متأكد من مسح جميع النشاطات؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    
    setIsDeleting(true);
    try {
      const q = query(collection(db, 'recent_activity'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach((d) => {
        batch.delete(doc(db, 'recent_activity', d.id));
      });
      
      await batch.commit();
      alert('تم مسح جميع النشاطات بنجاح!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء مسح النشاطات.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteOne = async (id: string) => {
    if (!confirm('مسح هذا النشاط؟')) return;
    try {
      await deleteDoc(doc(db, 'recent_activity', id));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-10 text-center text-[#D4AF37]">جاري التحميل...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black font-pharaoh tracking-widest text-[#FFD700]">سجل النشاطات</h2>
          <p className="text-gray-500 text-sm mt-1 uppercase tracking-tighter">مراقبة كافة تحركات المملكة</p>
        </div>
        <div className="flex gap-4">
            <button 
                onClick={handleClearAll}
                disabled={isDeleting || activities.length === 0}
                className="bg-red-500/10 border border-red-500/20 text-red-500 px-6 py-2 rounded-xl text-xs font-black uppercase hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
            >
                {isDeleting ? 'جاري المسح...' : '🗑️ مسح الكل'}
            </button>
            <Link href="/admin" className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#FFD700] px-6 py-2 rounded-xl text-xs font-black uppercase hover:bg-[#D4AF37] hover:text-black transition-all">
                العودة
            </Link>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-[40px] overflow-hidden shadow-2xl">
        <div className="p-8">
            <div className="space-y-4">
                {activities.length === 0 ? (
                    <div className="py-20 text-center space-y-4">
                        <span className="text-5xl block grayscale opacity-20">📜</span>
                        <p className="text-gray-500 text-sm">لا توجد أي نشاطات مسجلة حالياً في المملكة.</p>
                    </div>
                ) : (
                    activities.map((activity) => (
                        <div key={activity.id} className="group flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-[#D4AF37]/30 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center text-xl shadow-inner">
                                    {activity.icon || '📜'}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h4 className="text-sm font-black text-gray-200">{activity.title}</h4>
                                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                            activity.type === 'deposit' ? 'bg-green-500/20 text-green-500' :
                                            activity.type === 'withdrawal' ? 'bg-red-500/20 text-red-500' :
                                            'bg-blue-500/20 text-blue-500'
                                        }`}>
                                            {activity.type}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
                                    <p className="text-[9px] text-gray-600 mt-1 uppercase font-bold tracking-widest">
                                        {activity.createdAt?.toDate().toLocaleString('ar-EG')}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleDeleteOne(activity.id)}
                                className="opacity-0 group-hover:opacity-100 p-2 text-gray-600 hover:text-red-500 transition-all text-sm"
                                title="حذف"
                            >
                                ✕
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
