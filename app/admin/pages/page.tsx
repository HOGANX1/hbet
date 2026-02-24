"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { storage, db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface Page {
  id: string;
  title: string;
  slug: string;
  status: 'published' | 'draft' | 'inactive';
  lastModified: string;
}

interface PageFile {
  id: string;
  pageId: string;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: string;
}

export default function PageManager() {
  const { user } = useAuth();
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>([
    { id: '1', title: 'Home Page', slug: '/', status: 'published', lastModified: '2024-03-20' },
    { id: '2', title: 'Sports Betting', slug: '/sports', status: 'published', lastModified: '2024-03-18' },
    { id: '3', title: 'Live Matches', slug: '/live', status: 'published', lastModified: '2024-03-19' },
    { id: '4', title: 'User Profile', slug: '/profile', status: 'draft', lastModified: '2024-03-15' },
    { id: '5', title: 'Terms & Conditions', slug: '/terms', status: 'published', lastModified: '2024-01-10' },
    { id: '6', title: 'Promotion: Welcome Bonus', slug: '/promo/welcome', status: 'inactive', lastModified: '2024-02-28' },
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pageFiles, setPageFiles] = useState<PageFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPage, setNewPage] = useState({ title: '', slug: '' });
  const [tempFiles, setTempFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!user) return;

    // Permissions check
    const checkPermissions = async () => {
      const { getDoc, doc } = await import('firebase/firestore');
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (user.email !== 'mohemad123hsak@gmail.com' && (!data.adminPermissions?.manage_content)) {
          router.push('/admin');
          return;
        }
      } else if (user.email !== 'mohemad123hsak@gmail.com') {
        router.push('/admin');
        return;
      }
    };
    checkPermissions();
  }, [user, router]);

  useEffect(() => {
    if (editingPage) {
      fetchPageFiles(editingPage.id);
    }
  }, [editingPage]);

  const fetchPageFiles = async (pageId: string) => {
    const q = query(collection(db, 'page_files'), where('pageId', '==', pageId));
    const querySnapshot = await getDocs(q);
    const files: PageFile[] = [];
    querySnapshot.forEach((doc) => {
      files.push({ id: doc.id, ...(doc.data() as Omit<PageFile, 'id'>) });
    });
    setPageFiles(files);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !editingPage) return;
    setUploading(true);
    
    const files = Array.from(e.target.files);
    
    try {
      const uploadPromises = files.map(async (file) => {
        const storageRef = ref(storage, `pages/${editingPage.id}/${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        
        return addDoc(collection(db, 'page_files'), {
          pageId: editingPage.id,
          name: file.name,
          url: url,
          type: file.type,
          size: file.size,
          createdAt: new Date().toISOString()
        });
      });
      
      await Promise.all(uploadPromises);
      fetchPageFiles(editingPage.id);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (fileId: string, fileName: string) => {
    if (!editingPage) return;
    try {
      const storageRef = ref(storage, `pages/${editingPage.id}/${fileName}`);
      await deleteObject(storageRef);
      await deleteDoc(doc(db, 'page_files', fileId));
      fetchPageFiles(editingPage.id);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleDeletePage = async (pageId: string, pageTitle: string) => {
    if (confirm(`Are you sure you want to delete the page "${pageTitle}"? This action cannot be undone.`)) {
      try {
        setPages(prev => prev.filter(p => p.id !== pageId));
        alert('Page deleted successfully from the kingdom.');
      } catch (err) {
        console.error("Failed to delete page", err);
      }
    }
  };

  const handleAddNewPage = async () => {
    if (!newPage.title || !newPage.slug) return;
    setUploading(true);
    
    try {
      const pageId = Date.now().toString();
      const newPageEntry: Page = {
        id: pageId,
        title: newPage.title,
        slug: newPage.slug.startsWith('/') ? newPage.slug : `/${newPage.slug}`,
        status: 'draft',
        lastModified: new Date().toISOString().split('T')[0]
      };

      const uploadPromises = tempFiles.map(async (file) => {
        const storageRef = ref(storage, `pages/${pageId}/${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        
        return addDoc(collection(db, 'page_files'), {
          pageId: pageId,
          name: file.name,
          url: url,
          type: file.type,
          size: file.size,
          createdAt: new Date().toISOString()
        });
      });

      await Promise.all(uploadPromises);
      setPages(prev => [...prev, newPageEntry]);
      setIsAddModalOpen(false);
      setNewPage({ title: '', slug: '' });
      setTempFiles([]);
      alert('New page has been scribed into the kingdom scrolls!');
    } catch (err) {
      console.error("Failed to add page", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1 font-pharaoh tracking-wider">Page Manager</h2>
          <p className="text-gray-400">Manage your website&apos;s static and dynamic pages.</p>
        </div>
         <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#D4AF37] hover:bg-[#FFD700] text-black font-bold py-2.5 px-6 rounded-lg shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
        >
          <span className="text-xl">+</span> Add New Page
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Pages" value="24" icon="📄" />
        <StatCard title="Published" value="18" icon="✅" />
        <StatCard title="Drafts" value="6" icon="📝" />
      </div>

      {/* Content Section */}
      <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-xl overflow-hidden backdrop-blur-sm">
        {/* Table Controls */}
        <div className="p-6 border-b border-[#D4AF37]/20 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative w-full md:w-96">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">🔍</span>
            <input 
              type="text" 
              placeholder="Search pages by title or slug..."
              className="w-full bg-[#151515] border border-[#D4AF37]/10 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-[#D4AF37] transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <select className="bg-[#151515] border border-[#D4AF37]/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#D4AF37]">
              <option>All Status</option>
              <option>Published</option>
              <option>Draft</option>
              <option>Inactive</option>
            </select>
            <button className="px-4 py-2 border border-[#D4AF37]/20 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              Filter
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#151515] text-[#D4AF37] uppercase text-xs font-bold tracking-wider">
                <th className="px-6 py-4">Page Title</th>
                <th className="px-6 py-4">Slug</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Modified</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4AF37]/10">
              {pages.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase())).map((page) => (
                <tr key={page.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded bg-[#1a1a1a] border border-[#D4AF37]/10 flex items-center justify-center text-xl">
                        📄
                      </div>
                      <span className="font-medium text-gray-100 group-hover:text-[#FFD700] transition-colors">{page.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-400">{page.slug}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={page.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">{page.lastModified}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => { setEditingPage(page); setIsModalOpen(true); }}
                        className="p-2 text-gray-400 hover:text-[#D4AF37] transition-colors" 
                        title="Edit Files"
                      >
                        ✏️
                      </button>
                      <Link 
                        href={page.slug} 
                        className="p-2 text-gray-400 hover:text-blue-400 transition-colors" 
                        title="Preview"
                        target="_blank"
                      >
                        👁️
                      </Link>
                      <button 
                        onClick={() => handleDeletePage(page.id, page.title)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors" 
                        title="Delete Page"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-6 border-t border-[#D4AF37]/20 flex items-center justify-between">
          <span className="text-sm text-gray-500">Showing 1 to 6 of 24 results</span>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-[#D4AF37]/20 rounded-lg text-gray-400 disabled:opacity-50" disabled>Previous</button>
            <button className="px-4 py-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#FFD700] rounded-lg">1</button>
            <button className="px-4 py-2 border border-[#D4AF37]/20 rounded-lg text-gray-400 hover:bg-white/5 transition-colors">2</button>
            <button className="px-4 py-2 border border-[#D4AF37]/20 rounded-lg text-gray-400 hover:bg-white/5 transition-colors">3</button>
            <button className="px-4 py-2 border border-[#D4AF37]/20 rounded-lg text-gray-400 hover:bg-white/5 transition-colors">Next</button>
          </div>
        </div>
      </div>

      {/* Edit Files Modal */}
      {isModalOpen && editingPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#0a0a0a] border border-[#D4AF37]/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.15)]">
            <div className="p-6 border-b border-[#D4AF37]/20 flex justify-between items-center bg-[#111]">
              <div>
                <h3 className="text-xl font-bold text-[#FFD700] font-pharaoh tracking-widest">Edit Assets: {editingPage.title}</h3>
                <p className="text-xs text-gray-500 mt-1">Manage documents and media for this page.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white text-2xl">×</button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Upload Section */}
              <div className="border-2 border-dashed border-[#D4AF37]/20 rounded-xl p-8 text-center hover:border-[#D4AF37]/40 transition-colors group">
                <input 
                  type="file" 
                  id="file-upload" 
                  className="hidden" 
                  onChange={handleFileUpload}
                  disabled={uploading}
                  multiple
                />
                <label htmlFor="file-upload" className="cursor-pointer space-y-3 block">
                  <div className="text-4xl group-hover:scale-110 transition-transform">{uploading ? '⏳' : '📤'}</div>
                  <div className="text-sm font-medium text-gray-300">
                    {uploading ? 'Uploading to Kingdom...' : 'Click to upload or drag and drop'}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-tighter">Images, PDFs, or Assets (Max 10MB)</div>
                </label>
              </div>

              {/* Files List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-[#D4AF37] uppercase tracking-[0.2em]">Attached Files</h4>
                <div className="max-h-60 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                  {pageFiles.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 italic text-sm">No files attached to this page yet.</div>
                  ) : (
                    pageFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-[#D4AF37]/20 transition-all">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <span className="text-xl text-[#D4AF37]">📄</span>
                          <div className="overflow-hidden">
                            <p className="text-sm font-medium text-gray-200 truncate">{file.name}</p>
                            <p className="text-[10px] text-gray-500">{(file.size / 1024).toFixed(1)} KB • {new Date(file.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <a href={file.url} target="_blank" rel="noreferrer" className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors text-xs">View</a>
                          <button 
                            onClick={() => deleteFile(file.id, file.name)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#111] border-t border-[#D4AF37]/20 flex justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 bg-[#D4AF37] text-black font-bold rounded-lg hover:shadow-[0_0_15px_#D4AF37]/40 transition-all uppercase text-xs"
              >
                Finished
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Page Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#0a0a0a] border border-[#D4AF37]/30 rounded-2xl w-full max-w-xl overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.15)]">
            <div className="p-6 border-b border-[#D4AF37]/20 flex justify-between items-center bg-[#111]">
              <div>
                <h3 className="text-xl font-bold text-[#FFD700] font-pharaoh tracking-widest">Scribe New Page</h3>
                <p className="text-xs text-gray-500 mt-1">Initialize a new section of your kingdom.</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-white text-2xl">×</button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-[#D4AF37] uppercase tracking-wider mb-2">Page Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Ancient Secrets"
                    className="w-full bg-white/5 border border-[#D4AF37]/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#D4AF37]"
                    value={newPage.title}
                    onChange={(e) => setNewPage({...newPage, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-[#D4AF37] uppercase tracking-wider mb-2">Page Slug (URL)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. /ancient-secrets"
                    className="w-full bg-white/5 border border-[#D4AF37]/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#D4AF37]"
                    value={newPage.slug}
                    onChange={(e) => setNewPage({...newPage, slug: e.target.value})}
                  />
                </div>
              </div>

              {/* Temp Files Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-[#D4AF37] uppercase tracking-wider">Initial Assets (Optional)</label>
                <div className="border border-dashed border-[#D4AF37]/20 rounded-xl p-4 text-center">
                  <input 
                    type="file" 
                    id="add-page-files" 
                    className="hidden" 
                    multiple 
                    onChange={(e) => setTempFiles(Array.from(e.target.files || []))}
                  />
                  <label htmlFor="add-page-files" className="cursor-pointer text-sm text-gray-400 hover:text-[#D4AF37] transition-colors">
                    {tempFiles.length > 0 ? `${tempFiles.length} files selected` : 'Click to select files'}
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#111] border-t border-[#D4AF37]/20 flex justify-end gap-3">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="px-6 py-2 border border-[#D4AF37]/20 text-gray-400 rounded-lg hover:bg-white/5 transition-all text-xs uppercase font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddNewPage}
                disabled={uploading || !newPage.title || !newPage.slug}
                className="px-6 py-2 bg-[#D4AF37] text-black font-bold rounded-lg hover:shadow-[0_0_15px_#D4AF37]/40 transition-all uppercase text-xs disabled:opacity-50"
              >
                {uploading ? 'Processing...' : 'Scribe Page'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 p-6 rounded-xl relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <span className="text-4xl">{icon}</span>
        <div className="text-right">
          <p className="text-gray-400 text-sm font-medium tracking-wide uppercase text-[10px]">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent w-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
    </div>
  );
}

function StatusBadge({ status }: { status: Page['status'] }) {
  const styles = {
    published: 'bg-green-500/10 text-green-500 border-green-500/20',
    draft: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    inactive: 'bg-red-500/10 text-red-500 border-red-500/20',
  }[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${styles} uppercase tracking-wider`}>
      {status}
    </span>
  );
}
