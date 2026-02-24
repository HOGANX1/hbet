"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface UserAvatarProps {
  userId: string;
  fallbackName?: string;
  fallbackPhoto?: string;
  className?: string;
  size?: number;
}

export default function UserAvatar({ userId, fallbackName, fallbackPhoto, className = "w-10 h-10", size = 40 }: UserAvatarProps) {
  const [photoURL, setPhotoURL] = useState<string | null>(fallbackPhoto || null);

  useEffect(() => {
    if (!userId) return;

    // Listen to the specific user's document for real-time photo updates
    const userRef = doc(db, 'users', userId);
    const unsub = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.photoURL) {
          setPhotoURL(data.photoURL);
        }
      }
    }, (error) => {
      console.error("Error fetching user photo:", error);
    });

    return () => unsub();
  }, [userId]);

  return (
    <div className={`rounded-full overflow-hidden relative bg-gray-800 ${className}`}>
      {photoURL ? (
        <Image 
          src={photoURL} 
          alt={fallbackName || 'User'} 
          fill 
          className="object-cover"
          unoptimized={photoURL.startsWith('data:')} // Optimization for base64 "hashes"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs font-black text-[#D4AF37] uppercase">
          {fallbackName ? fallbackName[0] : 'U'}
        </div>
      )}
    </div>
  );
}
