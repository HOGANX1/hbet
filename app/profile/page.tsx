"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, Timestamp, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import UserAvatar from '@/app/components/UserAvatar';

interface UserProfile {
  displayName: string;
  photoURL: string;
  rank: string;
  level: number;
  xp: number;
  maxXp: number;
  bio: string;
  isNewUser: boolean;
  gender?: string;
  birthday?: string;
  phoneNumber?: string;
  showPhoneNumber?: boolean;
}

interface Post {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string; 
  authorPhoto?: string;    
  createdAt: Timestamp;
  likes: string[];
  comments: Comment[];
}

interface Comment {
  authorName: string;
  content: string;
  createdAt: Timestamp;
}

export default function UserProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      setProfile(docSnap.data() as UserProfile);
    } else {
      // Initialize new user profile
      const newProfile: UserProfile = {
        displayName: user.displayName || 'Pharaoh Warrior',
        photoURL: user.photoURL || '/default-avatar.png',
        rank: 'Soldier',
        level: 1,
        xp: 0,
        maxXp: 100,
        bio: 'Welcome to HBET! This is your journey to becoming a Legend.',
        isNewUser: true,
      };
      await setDoc(docRef, newProfile);
      setProfile(newProfile);
    }
    setLoading(false);
  }, [user]);

  const fetchUserPosts = useCallback(async () => {
    if (!user) return;
    const q = query(collection(db, 'posts'), where('authorId', '==', user.uid), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const fetchedPosts: Post[] = [];
    querySnapshot.forEach((doc) => {
      fetchedPosts.push({ id: doc.id, ...doc.data() } as Post);
    });
    setPosts(fetchedPosts);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchUserPosts();
    }
  }, [user, fetchProfile, fetchUserPosts]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && user) {
      setUploading(true);
      const file = e.target.files[0];
      const storageRef = ref(storage, `profiles/${user.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
      setProfile(prev => prev ? { ...prev, photoURL: url } : null);
      setUploading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() || !user || !profile) return;
    const postData = {
      content: newPostContent,
      authorId: user.uid,
      authorName: profile.displayName,
      authorPhotoURL: profile.photoURL,
      createdAt: Timestamp.now(),
      likes: [],
      comments: []
    };
    await addDoc(collection(db, 'posts'), postData);
    setNewPostContent('');
    fetchUserPosts();
  };

  if (authLoading || loading) return <div className="min-h-screen bg-black flex items-center justify-center text-[#D4AF37]">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Profile Card */}
        <div className="glass rounded-3xl p-8 border border-[#D4AF37]/30 shadow-[0_0_30px_rgba(212,175,55,0.1)] relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            {/* Avatar Section */}
            <div className="relative">
              <div className="w-40 h-40 rounded-full border-4 border-[#D4AF37] p-1 bg-gradient-to-tr from-[#FFD700] via-[#D4AF37] to-transparent animate-spin-slow">
                <div className="w-full h-full rounded-full bg-black overflow-hidden relative group">
                  <UserAvatar 
                    userId={user?.uid || ''} 
                    fallbackPhoto={profile?.photoURL || ''} 
                    className="w-full h-full"
                  />
                  <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <span className="text-xs font-bold text-[#D4AF37]">Change Photo</span>
                    <input type="file" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                  </label>
                </div>
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#D4AF37] text-black text-[10px] font-black px-3 py-1 rounded-full border border-black uppercase tracking-tighter">
                {profile?.rank}
              </div>
            </div>

            {/* Info Section */}
            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <h1 className="text-3xl font-bold font-pharaoh tracking-widest text-gold">{profile?.displayName}</h1>
                <p className="text-gray-400 text-sm mt-1">{profile?.bio}</p>

                {/* Social Badges */}
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-4">
                  {profile?.gender && (
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase text-[#D4AF37]">
                      <span>{profile.gender === 'male' ? '👨' : '👩'}</span>
                      <span>{profile.gender === 'male' ? 'محارب' : 'محاربة'}</span>
                    </div>
                  )}
                  {profile?.birthday && (
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase text-[#D4AF37]">
                      <span>🎂</span>
                      <span>{new Date(profile.birthday).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}</span>
                    </div>
                  )}
                  {profile?.showPhoneNumber && profile?.phoneNumber && (
                    <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase text-green-500">
                      <span>📱</span>
                      <span className="font-mono">{profile.phoneNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[#D4AF37]">LEVEL {profile?.level}</span>
                  <span className="text-gray-500">{profile?.xp} / {profile?.maxXp} XP</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-[#D4AF37]/10">
                  <div 
                    className="h-full bg-gradient-to-r from-[#FFD700] to-[#D4AF37] shadow-[0_0_10px_#D4AF37]" 
                    style={{ width: `${(profile!.xp / profile!.maxXp) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Posts Creation */}
        <div className="glass rounded-2xl p-6 border border-[#D4AF37]/20">
          <textarea 
            className="w-full bg-white/5 border border-[#D4AF37]/10 rounded-xl p-4 text-sm focus:outline-none focus:border-[#D4AF37]/50 transition-colors h-24"
            placeholder="Share your thoughts, Pharaoh..."
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
          ></textarea>
          <div className="flex justify-end mt-4">
            <button 
              onClick={handleCreatePost}
              className="bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black px-6 py-2 rounded-lg font-bold hover:scale-105 transition-transform"
            >
              Post to Kingdom
            </button>
          </div>
        </div>

        {/* Post Feed */}
        <div className="space-y-6">
          <h3 className="text-xl font-pharaoh tracking-widest text-[#D4AF37] border-l-4 border-[#D4AF37] pl-4">Your Kingdom Feed</h3>
          {posts.map(post => (
            <div key={post.id} className="glass rounded-2xl p-6 border border-white/5 hover:border-[#D4AF37]/20 transition-all group">
              <div className="flex items-center space-x-4 mb-4">
                <UserAvatar 
                  userId={post.authorId} 
                  fallbackName={post.authorName} 
                  fallbackPhoto={post.authorPhotoURL || post.authorPhoto}
                  className="w-10 h-10 border border-[#D4AF37]/30"
                />
                <div>
                  <h4 className="font-bold text-sm text-gray-200">{post.authorName}</h4>
                  <p className="text-[10px] text-gray-500 uppercase">Recently Shared</p>
                </div>
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed">{post.content}</p>
              
              <div className="flex items-center space-x-6 pt-4 border-t border-white/5">
                <button className="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors">
                  <span className="text-lg">⚔️</span>
                  <span className="text-xs font-bold">{post.likes.length} Praises</span>
                </button>
                <button className="flex items-center space-x-2 text-gray-500 hover:text-[#D4AF37] transition-colors">
                  <span className="text-lg">📜</span>
                  <span className="text-xs font-bold">{post.comments.length} Scrolls</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <style jsx>{`
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
