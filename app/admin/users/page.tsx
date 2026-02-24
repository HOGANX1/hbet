"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
  where,
  getDocs
} from 'firebase/firestore';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AdminPermissions {
  manage_users: boolean;
  manage_finance: boolean;
  manage_content: boolean;
  manage_offers: boolean;
  manage_settings: boolean;
}

interface UserData {
  uid: string;
  kingdomId?: string;
  email: string;
  displayName: string;
  photoURL: string;
  level: number;
  rank: string;
  xp: number;
  balance?: number;
  role?: 'user' | 'admin';
  adminPermissions?: AdminPermissions;
  isBlocked?: boolean;
  blockType?: 'permanent' | 'temporary';
  blockUntil?: Timestamp;
  blockReason?: string;
  bio?: string;
  gender?: string;
  birthday?: string;
  phoneNumber?: string;
  showPhoneNumber?: boolean;
}

const RANKS = ['Soldier', 'Warrior', 'Elite', 'Legend', 'Pharaoh', 'LORD'];

export default function UserManagementPage() {
   const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [editRank, setEditRank] = useState('');
  const [editBalance, setEditBalance] = useState<number>(0);
  const [editBio, setEditBio] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Block Modal State
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockUser, setBlockUser] = useState<UserData | null>(null);
  const [blockType, setBlockType] = useState<'permanent' | 'temporary'>('permanent');
  const [blockDuration, setBlockDuration] = useState('24'); // hours
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Permissions Modal State
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<UserData | null>(null);
  const [tempPermissions, setTempPermissions] = useState<AdminPermissions>({
    manage_users: false,
    manage_finance: false,
    manage_content: false,
    manage_offers: false,
    manage_settings: false,
  });
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteUser, setInviteUser] = useState<UserData | null>(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successInviteName, setSuccessInviteName] = useState('');
  const [isPermUpdateSuccessOpen, setIsPermUpdateSuccessOpen] = useState(false);
  const [isDemoteModalOpen, setIsDemoteModalOpen] = useState(false);
  const [demoteUser, setDemoteUser] = useState<UserData | null>(null);
  const [isDemoting, setIsDemoting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserData[];
      
      // Permission Check
      if (currentUser) {
        const me = usersData.find(u => u.uid === currentUser.uid);
        if (me && me.role === 'admin' && currentUser.email !== 'mohemad123hsak@gmail.com') {
          if (!me.adminPermissions?.manage_users) {
            router.push('/admin');
            return;
          }
        }
      }

      setUsers(usersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, router]);

  const openBlockModal = (user: UserData) => {
    setBlockUser(user);
    setIsBlockModalOpen(true);
  };

  const handleConfirmBlock = async () => {
    if (!blockUser) return;
    
    setIsBlocking(true);
    try {
      const userRef = doc(db, 'users', blockUser.uid);
      const updates: {
        isBlocked: boolean;
        blockType: 'permanent' | 'temporary';
        blockUntil: Timestamp | null;
        blockReason: string;
      } = {
        isBlocked: true,
        blockType: blockType,
        blockUntil: null,
        blockReason: blockReason
      };

      if (blockType === 'temporary') {
        const until = new Date();
        until.setHours(until.getHours() + Number(blockDuration));
        updates.blockUntil = Timestamp.fromDate(until);
      }

      await updateDoc(userRef, updates);

      // Record Activity
      await addDoc(collection(db, 'recent_activity'), {
        title: 'حظر مستخدم',
        description: `تم حظر ${blockUser.email} (${blockType === 'permanent' ? 'دائم' : `لمدة ${blockDuration} ساعة`})`,
        icon: '🚫',
        type: 'admin_action',
        createdAt: serverTimestamp()
      });

      setIsBlockModalOpen(false);
      setBlockUser(null);
      setBlockReason('');
    } catch (err) {
      console.error("Error blocking user:", err);
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblockUser = async (uid: string) => {
    if (confirm('هل أنت متأكد من إلغاء حظر هذا المستخدم؟')) {
      try {
        await updateDoc(doc(db, 'users', uid), {
          isBlocked: false,
          blockType: null,
          blockUntil: null
        });
      } catch (err) {
        console.error("Error unblocking user:", err);
      }
    }
  };

    const handleToggleRole = async (targetUser: UserData) => {
    if (!currentUser) return;

    const isCurrentlyAdmin = targetUser.role === 'admin';
    
    if (isCurrentlyAdmin) {
      setDemoteUser(targetUser);
      setIsDemoteModalOpen(true);
    } else {
      setInviteUser(targetUser);
      setIsInviteModalOpen(true);
    }
  };

  const handleConfirmDemote = async () => {
    if (!demoteUser || !currentUser) return;
    setIsDemoting(true);
    try {
      await updateDoc(doc(db, 'users', demoteUser.uid), { 
        role: 'user',
        adminPermissions: null 
      });
      await addDoc(collection(db, 'recent_activity'), {
        title: 'تخفيض صلاحيات',
        description: `تم سحب صلاحيات المسؤول من ${demoteUser.email}`,
        icon: '👤',
        type: 'admin_action',
        createdAt: serverTimestamp()
      });
      setIsDemoteModalOpen(false);
      setDemoteUser(null);
    } catch (err) {
      console.error("Error demoting user:", err);
      alert('فشل في تخفيض الصلاحيات.');
    } finally {
      setIsDemoting(false);
    }
  };

  const handleSendAdminInvite = async () => {
    if (!currentUser || !inviteUser) return;
    
    setIsSendingInvite(true);
    try {
      const q = query(
        collection(db, 'notifications'),
        where('recipientId', '==', inviteUser.uid),
        where('type', '==', 'admin_promotion_invite'),
        where('status', '==', 'unread')
      );
      const existingInvites = await getDocs(q);
      if (!existingInvites.empty) {
        alert('يوجد بالفعل دعوة معلقة لهذا المستخدم.');
        setIsInviteModalOpen(false);
        return;
      }

      await addDoc(collection(db, 'notifications'), {
        recipientId: inviteUser.uid,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'الفرعون الأكبر',
        senderPhoto: currentUser.photoURL || '',
        title: '🔱 دعوة للانضمام إلى مجلس الإدارة',
        message: `لقد تم اختيارك من قبل الفرعون الأكبر لتصبح من المسؤولين الأقوياء في المملكة. هل تقبل هذه المهمة؟`,
        type: 'admin_promotion_invite',
        status: 'unread',
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'recent_activity'), {
        title: 'دعوة مسؤول جديد',
        description: `تم إرسال دعوة مسؤول إلى ${inviteUser.email}`,
        icon: '✉️',
        type: 'admin_action',
        createdAt: serverTimestamp()
      });

      const inviteName = inviteUser.displayName;
      setIsInviteModalOpen(false);
      setInviteUser(null);
      setSuccessInviteName(inviteName);
      setIsSuccessModalOpen(true);
    } catch (err) {
      console.error("Error sending admin invite:", err);
      alert('فشل في إرسال الدعوة.');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const openPermissionsModal = (user: UserData) => {
    setPermissionsUser(user);
    setTempPermissions(user.adminPermissions || {
      manage_users: false,
      manage_finance: false,
      manage_content: false,
      manage_offers: false,
      manage_settings: false,
    });
    setIsPermissionsModalOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!permissionsUser) return;
    setIsSavingPermissions(true);
    try {
      await updateDoc(doc(db, 'users', permissionsUser.uid), {
        adminPermissions: tempPermissions
      });
      setIsPermissionsModalOpen(false);
      setIsPermUpdateSuccessOpen(true);
      setTimeout(() => setIsPermUpdateSuccessOpen(false), 3000);
    } catch (err) {
      console.error("Error saving permissions:", err);
      alert('فشل في حفظ الصلاحيات.');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (confirm('⚠️ تحذير: هل أنت متأكد من حذف هذا المستخدم نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (err) {
        console.error("Error deleting user:", err);
      }
    }
  };

  const openEditModal = (user: UserData) => {
    setSelectedUser(user);
    setEditRank(user.rank || 'Soldier');
    setEditBalance(user.balance || 0);
    setEditBio(user.bio || '');
    setEditGender(user.gender || '');
    setEditBirthday(user.birthday || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    setIsUpdating(true);
    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      await updateDoc(userRef, {
        rank: editRank,
        balance: editBalance,
        bio: editBio,
        gender: editGender,
        birthday: editBirthday
      });

      // Record Activity
      await addDoc(collection(db, 'recent_activity'), {
        title: 'تعديل بيانات',
        description: `تم تعديل بيانات ${selectedUser.email}. الرتبة الجديدة: ${editRank}, الرصيد: ${editBalance} EGP`,
        icon: '📝',
        type: 'admin_action',
        createdAt: serverTimestamp()
      });

      setIsEditModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error("Error updating user:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black font-pharaoh tracking-widest text-[#FFD700]">إدارة المستخدمين</h2>
          <p className="text-gray-500 text-sm mt-1 uppercase tracking-tighter">التحكم الكامل في سكان المملكة</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <input 
            type="text" 
            placeholder="بحث عن مستخدم..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37] outline-none transition-all pr-10"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-[40px] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="bg-black text-[#D4AF37] border-b border-[#D4AF37]/10">
                <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">المستخدم</th>
                <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">المستوى / الرتبة</th>
                <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">الرصيد</th>
                <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">الصلاحية</th>
                <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">الحالة</th>
                <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-500 italic">
                    لا يوجد مستخدمين يطابقون بحثك...
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.uid} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full border border-[#D4AF37]/30 overflow-hidden bg-black flex-shrink-0 cursor-help"
                          title={`المعرف: ${user.kingdomId || user.uid}`}
                        >
                          {user.photoURL ? (
                            <Image src={user.photoURL} alt={user.displayName} width={40} height={40} className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#D4AF37] font-bold">
                              {user.displayName?.charAt(0) || 'U'}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-200">{user.displayName || 'بدون اسم'}</span>
                          <span className="text-[10px] text-gray-500">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[#D4AF37] font-black">LVL {user.level || 1}</span>
                        <span className="text-[10px] text-gray-500 uppercase">{user.rank || 'Soldier'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-green-500">{user.balance?.toLocaleString() || 0} EGP</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter ${user.role === 'admin' ? 'bg-[#D4AF37] text-black' : 'bg-gray-800 text-gray-400'}`}>
                        {user.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.isBlocked ? (
                        <div className="flex flex-col items-end">
                          <span className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-[10px] font-bold">
                            {user.blockType === 'permanent' ? 'حظر أبدي' : 'حظر مؤقت'}
                          </span>
                          {user.blockType === 'temporary' && user.blockUntil && (
                            <span className="text-[8px] text-gray-500 mt-1">
                              حتى: {user.blockUntil.toDate().toLocaleString('ar-EG')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-[10px] font-bold">نشط</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-left">
                      <div className="flex items-center justify-start gap-2">
                        <Link 
                          href={`/profile/${user.uid}`}
                          className="p-2 bg-gray-500/10 border border-gray-500/30 text-gray-500 rounded-lg hover:bg-white/10 transition-all"
                          title="عرض الملف الشخصي"
                        >
                          👁️
                        </Link>
                        <button 
                          onClick={() => handleToggleRole(user)}
                          className={`p-2 rounded-lg border transition-all ${user.role === 'admin' ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/20' : 'bg-gray-500/10 border-gray-500/30 text-gray-500 hover:bg-gray-500/20'}`}
                          title={user.role === 'admin' ? 'تحويل لمستخدم عادي' : 'تعيين كمسؤول'}
                        >
                          {user.role === 'admin' ? '👤' : '🔑'}
                        </button>
                        <button 
                          onClick={() => openEditModal(user)}
                          className="p-2 bg-blue-500/10 border border-blue-500/30 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-all"
                          title="تعديل الرتبة والرصيد"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => user.isBlocked ? handleUnblockUser(user.uid) : openBlockModal(user)}
                          className={`p-2 rounded-lg border transition-all ${user.isBlocked ? 'bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20' : 'bg-orange-500/10 border-orange-500/30 text-orange-500 hover:bg-orange-500/20'}`}
                          title={user.isBlocked ? 'إلغاء الحظر' : 'حظر المستخدم'}
                        >
                          {user.isBlocked ? '🔓' : '🚫'}
                        </button>
                        {user.role === 'admin' && (
                          <button 
                            onClick={() => openPermissionsModal(user)}
                            className="p-2 bg-purple-500/10 border border-purple-500/30 text-purple-500 rounded-lg hover:bg-purple-500/20 transition-all"
                            title="إدارة صلاحيات المسؤول"
                          >
                            🛡️
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteUser(user.uid)}
                          className="p-2 bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg hover:bg-red-500/20 transition-all"
                          title="حذف نهائي"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-red-500/5 to-transparent border border-red-500/10 p-6 rounded-3xl">
          <h4 className="text-red-500 font-bold mb-2 flex items-center gap-2">
            <span>🛡️</span> منطقة الحماية
          </h4>
          <p className="text-gray-500 text-xs leading-relaxed">
            عند حظر مستخدم، لن يتمكن من تسجيل الدخول أو وضع أي رهانات جديدة. حذف المستخدم يزيل كافة بياناته ورصيده نهائياً من قاعدة البيانات.
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-[#D4AF37]/5 to-transparent border border-[#D4AF37]/10 p-6 rounded-3xl">
          <h4 className="text-[#D4AF37] font-bold mb-2 flex items-center gap-2">
            <span>📊</span> إحصائية سريعة
          </h4>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">إجمالي المستخدمين:</span>
            <span className="text-white font-bold">{users.length}</span>
          </div>
          <div className="flex justify-between text-xs mt-2">
            <span className="text-gray-500">المحظورين حالياً:</span>
            <span className="text-red-500 font-bold">{users.filter(u => u.isBlocked).length}</span>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a0a] border border-[#D4AF37]/30 w-full max-w-md rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(212,175,55,0.2)] animate-in zoom-in duration-300">
            <div className="bg-gradient-to-r from-[#D4AF37] to-[#FFD700] p-6 text-black font-black flex justify-between items-center">
              <span className="flex items-center gap-3">
                <span className="text-2xl">⚡</span> تعديل بيانات الحساب
              </span>
              <button onClick={() => setIsEditModalOpen(false)} className="hover:scale-125 transition-transform text-2xl">✕</button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="p-8 space-y-6">
              <div className="text-center space-y-2 mb-4">
                <p className="text-gray-400 text-xs uppercase tracking-tighter">تعديل بيانات المستخدم</p>
                <p className="text-[#FFD700] font-bold">{selectedUser.email}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">الرتبة الملكية</label>
                  <select 
                    value={editRank}
                    onChange={(e) => setEditRank(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#D4AF37] appearance-none"
                  >
                    {RANKS.map(rank => <option key={rank} value={rank}>{rank}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">الرصيد (EGP)</label>
                  <input 
                    type="number" 
                    value={editBalance}
                    onChange={(e) => setEditBalance(Number(e.target.value))}
                    className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">النبذة (Bio)</label>
                  <textarea 
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#D4AF37] h-20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">النوع</label>
                    <select 
                      value={editGender}
                      onChange={(e) => setEditGender(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="">غير محدد</option>
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">الميلاد</label>
                    <input 
                      type="date" 
                      value={editBirthday}
                      onChange={(e) => setEditBirthday(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">الهاتف: {selectedUser.phoneNumber || 'لا يوجد'}</label>
                </div>
              </div>

              <button 
                type="submit"
                disabled={isUpdating}
                className="w-full bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-black py-4 rounded-2xl shadow-xl hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all disabled:opacity-50"
              >
                {isUpdating ? 'جاري الحفظ...' : 'حفظ التغييرات الملكية'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Block User Modal */}
      {isBlockModalOpen && blockUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a0a] border border-[#D4AF37]/30 w-full max-w-sm rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(239,68,68,0.2)] animate-in zoom-in duration-300">
            <div className="bg-gradient-to-r from-red-600 to-red-400 p-6 text-white font-black flex justify-between items-center">
              <span className="flex items-center gap-3 font-pharaoh tracking-widest">
                🚫 حظر الوصول
              </span>
              <button onClick={() => setIsBlockModalOpen(false)} className="hover:scale-125 transition-transform text-2xl">✕</button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="text-center">
                <p className="text-gray-400 text-xs uppercase mb-1">المستخدم المستهدف</p>
                <p className="text-white font-bold">{blockUser.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setBlockType('permanent')}
                  className={`py-4 rounded-2xl font-bold transition-all ${blockType === 'permanent' ? 'bg-red-500 text-white shadow-lg' : 'bg-white/5 border border-white/10 text-gray-500'}`}
                >
                  حظر أبدي
                </button>
                <button 
                  onClick={() => setBlockType('temporary')}
                  className={`py-4 rounded-2xl font-bold transition-all ${blockType === 'temporary' ? 'bg-[#D4AF37] text-black shadow-lg' : 'bg-white/5 border border-white/10 text-gray-500'}`}
                >
                  حظر مؤقت
                </button>
              </div>

              {blockType === 'temporary' && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">المدة بالساعات</label>
                  <select 
                    value={blockDuration}
                    onChange={(e) => setBlockDuration(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#D4AF37] appearance-none"
                  >
                    <option value="1">ساعة واحدة</option>
                    <option value="6">6 ساعات</option>
                    <option value="12">12 ساعة</option>
                    <option value="24">يوم كامل (24س)</option>
                    <option value="168">أسبوع كامل</option>
                    <option value="720">شهر كامل</option>
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest px-1">سبب الحظر</label>
                <textarea 
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="مثلاً: مخالفة قوانين المراهنة، استخدام برامج غش..."
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#D4AF37] min-h-[100px] text-sm"
                />
              </div>

              <button 
                onClick={handleConfirmBlock}
                disabled={isBlocking}
                className="w-full bg-white text-black font-black py-4 rounded-2xl shadow-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
              >
                {isBlocking ? 'جاري التنفيذ...' : 'تأكيد الحظر'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Admin Permissions Modal */}
      {isPermissionsModalOpen && permissionsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a0a] border border-[#D4AF37]/30 w-full max-w-md rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(168,85,247,0.2)] animate-in zoom-in duration-300">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white font-black flex justify-between items-center">
              <span className="flex items-center gap-3 font-pharaoh tracking-widest text-sm">
                🛡️ صلاحيات المسؤول
              </span>
              <button onClick={() => setIsPermissionsModalOpen(false)} className="hover:scale-125 transition-transform text-2xl">✕</button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="text-center">
                <p className="text-gray-400 text-[10px] uppercase mb-1">المسؤول المستهدف</p>
                <p className="text-[#D4AF37] font-bold">{permissionsUser.displayName}</p>
                <p className="text-xs text-gray-600">{permissionsUser.email}</p>
              </div>

              <div className="space-y-4">
                 <PermissionToggle 
                   label="إدارة المستخدمين" 
                   description="القدرة على حظر، حذف، أو تعديل رتب المستخدمين"
                   isActive={tempPermissions.manage_users}
                   onToggle={() => setTempPermissions(p => ({ ...p, manage_users: !p.manage_users }))}
                 />
                 <PermissionToggle 
                   label="إدارة الشؤون المالية" 
                   description="التحكم في طلبات الإيداع والسحب والتقارير المالية"
                   isActive={tempPermissions.manage_finance}
                   onToggle={() => setTempPermissions(p => ({ ...p, manage_finance: !p.manage_finance }))}
                 />
                 <PermissionToggle 
                   label="إدارة الصفحات والمحتوى" 
                   description="تعديل صفحات الموقع الثابتة وإدارة الملفات"
                   isActive={tempPermissions.manage_content}
                   onToggle={() => setTempPermissions(p => ({ ...p, manage_content: !p.manage_content }))}
                 />
                 <PermissionToggle 
                   label="إدارة العروض والإعلانات" 
                   description="إنشاء عروض جديدة وإرسال تنبيهات عامة"
                   isActive={tempPermissions.manage_offers}
                   onToggle={() => setTempPermissions(p => ({ ...p, manage_offers: !p.manage_offers }))}
                 />
                 <PermissionToggle 
                   label="إعدادات النظام" 
                   description="تغيير إعدادات الموقع العامة والصور والقوانين"
                   isActive={tempPermissions.manage_settings}
                   onToggle={() => setTempPermissions(p => ({ ...p, manage_settings: !p.manage_settings }))}
                 />
              </div>

              <button 
                onClick={handleSavePermissions}
                disabled={isSavingPermissions}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl hover:shadow-purple-500/20 transition-all disabled:opacity-50"
              >
                {isSavingPermissions ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Invite Admin Modal */}
      {isInviteModalOpen && inviteUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-[#D4AF37]/50 rounded-[3rem] overflow-hidden shadow-[0_0_150px_rgba(212,175,55,0.2)] animate-in zoom-in-95 duration-500">
            {/* Ornanted Header */}
            <div className="bg-gradient-to-b from-[#D4AF37] to-[#8B7321] p-10 text-center relative">
               <div className="absolute top-4 left-4 text-3xl opacity-20">🔱</div>
               <div className="absolute top-4 right-4 text-3xl opacity-20 rotate-180">🔱</div>
               <div className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-black/30 overflow-hidden bg-black flex items-center justify-center shadow-2xl">
                 {inviteUser.photoURL ? (
                    <Image src={inviteUser.photoURL} alt={inviteUser.displayName} width={96} height={96} className="object-cover" />
                 ) : (
                    <span className="text-4xl text-[#D4AF37] font-black">{inviteUser.displayName?.charAt(0)}</span>
                 )}
               </div>
               <h3 className="text-2xl font-black text-black uppercase tracking-[0.2em] font-pharaoh mb-2">دعوة المجلس المقدس</h3>
               <div className="h-0.5 w-32 bg-black/20 mx-auto"></div>
            </div>

            <div className="p-10 space-y-8 text-center bg-[url('https://www.transparenttextures.com/patterns/egyptian-hieroglyphs.png')] bg-repeat opacity-90">
              <div className="space-y-4">
                <p className="text-gray-400 text-sm uppercase tracking-widest font-bold">هل أنت متأكد من إرسال الدعوة الملكية إلى:</p>
                <div className="py-4 px-6 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-2xl inline-block">
                  <p className="text-2xl font-black text-[#FFD700] drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]">{inviteUser.displayName}</p>
                </div>
                <p className="text-gray-500 text-xs leading-relaxed max-w-sm mx-auto">
                  بمجرد قبول هذه الدعوة، سيمتلك هذا المحارب صلاحيات المسؤول (Admin) وسينضم إلى مجلس حكماء المملكة. تأكد من أنك تضع ثقتك في الشخص المناسب.
                </p>
              </div>

              <div className="flex flex-col gap-4 mt-4">
                <button 
                  onClick={handleSendAdminInvite}
                  disabled={isSendingInvite}
                  className="w-full py-5 bg-[#D4AF37] hover:bg-[#FFD700] text-black font-black text-sm rounded-2xl transition-all shadow-xl hover:shadow-[0_0_40px_rgba(212,175,55,0.4)] disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest border-b-4 border-black/20 active:translate-y-1 active:border-b-0"
                >
                  {isSendingInvite ? (
                    <div className="w-5 h-5 border-3 border-black border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <><span>🔥</span> إرسال الدعوة المقدسة</>
                  )}
                </button>
                <button 
                  onClick={() => setIsInviteModalOpen(false)}
                  disabled={isSendingInvite}
                  className="w-full py-4 text-gray-500 hover:text-white font-bold text-[10px] uppercase tracking-[0.3em] transition-colors"
                >
                  تراجع عن القرار
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Success Invitation Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
          <div className="relative w-full max-w-sm bg-[#0a0a0a] border border-[#D4AF37]/50 rounded-[3rem] overflow-hidden shadow-[0_0_200px_rgba(212,175,55,0.3)] animate-in zoom-in-95 fade-in duration-700">
            {/* Success Animation Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.1)_0%,_transparent_70%)]"></div>
            
            <div className="p-10 text-center relative z-10 space-y-8">
              <div className="relative">
                <div className="w-24 h-24 mx-auto bg-gradient-to-tr from-[#D4AF37] to-[#FFD700] rounded-full flex items-center justify-center text-5xl shadow-[0_0_50px_rgba(212,175,55,0.5)] animate-bounce">
                  ✨
                </div>
                <div className="absolute -top-2 -right-2 text-2xl animate-pulse">👑</div>
                <div className="absolute -bottom-2 -left-2 text-2xl animate-pulse delay-700">📜</div>
              </div>

              <div className="space-y-4">
                <h3 className="text-3xl font-black text-[#FFD700] font-pharaoh tracking-[0.1em]">تم الختم بنجاح!</h3>
                <div className="h-0.5 w-20 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto"></div>
                <p className="text-gray-400 text-sm leading-relaxed px-4">
                  لقد طار صقر المملكة حاملاً دعوتك المقدسة إلى المحارب:
                </p>
                <div className="py-2 px-6 bg-white/5 border border-white/10 rounded-full inline-block">
                  <span className="text-lg font-black text-white">{successInviteName}</span>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] text-gray-600 uppercase tracking-[0.4em] font-black">انتظار قبول المرسل إليه</p>
                <button 
                  onClick={() => setIsSuccessModalOpen(false)}
                  className="w-full py-4 bg-white text-black font-black text-xs rounded-2xl hover:bg-[#D4AF37] transition-all shadow-xl uppercase tracking-widest active:scale-95"
                >
                  عظيم، لقد تم الأمر
                </button>
              </div>
            </div>

            {/* Corner Accents */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-[#D4AF37]/30 rounded-tl-xl"></div>
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-[#D4AF37]/30 rounded-tr-xl"></div>
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-[#D4AF37]/30 rounded-bl-xl"></div>
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-[#D4AF37]/30 rounded-br-xl"></div>
          </div>
        </div>
      )}
      {/* Demotion Confirmation Modal */}
      {isDemoteModalOpen && demoteUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-red-500/30 rounded-[3rem] overflow-hidden shadow-[0_0_150px_rgba(239,68,68,0.15)] animate-in zoom-in-95 duration-500">
            {/* Header - Serious Tone */}
            <div className="bg-gradient-to-b from-[#1a1a1a] to-black p-10 text-center relative border-b border-red-500/20">
               <div className="absolute top-4 left-4 text-3xl opacity-20 filter grayscale">🔱</div>
               <div className="absolute top-4 right-4 text-3xl opacity-20 rotate-180 filter grayscale">🔱</div>
               <div className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-red-500/50 overflow-hidden bg-black flex items-center justify-center shadow-2xl relative group">
                 <div className="absolute inset-0 bg-red-600/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                 {demoteUser.photoURL ? (
                    <Image src={demoteUser.photoURL} alt={demoteUser.displayName} width={96} height={96} className="object-cover" />
                 ) : (
                    <span className="text-4xl text-red-500 font-black">{demoteUser.displayName?.charAt(0)}</span>
                 )}
               </div>
               <h3 className="text-2xl font-black text-white uppercase tracking-[0.2em] font-pharaoh mb-2">تجريد من الرتبة الملكية</h3>
               <div className="h-0.5 w-32 bg-red-500/40 mx-auto"></div>
            </div>

            <div className="p-10 space-y-8 text-center bg-[url('https://www.transparenttextures.com/patterns/egyptian-hieroglyphs.png')] bg-repeat opacity-90 invert">
              <div className="space-y-4">
                <p className="text-gray-500 text-sm uppercase tracking-widest font-bold">هل أنت متأكد من سحب صلاحيات المسؤول من:</p>
                <div className="py-4 px-6 bg-red-600/5 border border-red-600/20 rounded-2xl inline-block">
                  <p className="text-2xl font-black text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.2)]">{demoteUser.displayName}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 max-w-sm mx-auto">
                    <p className="text-gray-400 text-xs leading-relaxed">
                    سيتم سحب جميع صلاحيات الإدارة فوراً. سيعود هذا العضو ليكون مواطناً عادياً في المملكة ولن يتمكن من الوصول إلى لوحة القيادة المقدسة.
                    </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 mt-4">
                <button 
                  onClick={handleConfirmDemote}
                  disabled={isDemoting}
                  className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-2xl transition-all shadow-xl hover:shadow-[0_0_40px_rgba(239,68,68,0.3)] disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest border-b-4 border-black/20 active:translate-y-1 active:border-b-0"
                >
                  {isDemoting ? (
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <><span>💀</span> تنفيذ قرار التجريد</>
                  )}
                </button>
                <button 
                  onClick={() => setIsDemoteModalOpen(false)}
                  disabled={isDemoting}
                  className="w-full py-4 text-gray-500 hover:text-white font-bold text-[10px] uppercase tracking-[0.3em] transition-colors"
                >
                  العدول عن القرار
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Update Success Modal */}
      {isPermUpdateSuccessOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none">
          <div className="bg-[#0a0a0a] border-2 border-purple-500/50 rounded-3xl p-8 flex items-center gap-6 shadow-[0_0_100px_rgba(168,85,247,0.3)] animate-in slide-in-from-bottom-20 zoom-in duration-500 max-w-sm w-full mx-4">
            <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center text-3xl border border-purple-500/30 animate-bounce">
              🛡️
            </div>
            <div>
              <h3 className="text-xl font-black text-purple-400 font-pharaoh tracking-wider">مرسوم ملكي</h3>
              <p className="text-xs text-gray-400 font-bold mt-1">تم توثيق وتحديث الصلاحيات بنجاح!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionToggle({ label, description, isActive, onToggle }: { label: string; description: string; isActive: boolean; onToggle: () => void }) {
  return (
    <div 
      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${isActive ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/10 opacity-60'}`}
      onClick={onToggle}
    >
      <div className="flex-1">
        <p className={`text-xs font-black uppercase ${isActive ? 'text-purple-400' : 'text-gray-400'}`}>{label}</p>
        <p className="text-[9px] text-gray-500 mt-1">{description}</p>
      </div>
      <div className={`w-10 h-5 rounded-full relative transition-colors ${isActive ? 'bg-purple-500' : 'bg-gray-700'}`}>
        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isActive ? 'left-6' : 'right-1'}`}></div>
      </div>
    </div>
  );
}
