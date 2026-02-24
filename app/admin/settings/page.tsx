"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function AdminSettings() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'security' | 'database' | 'system'>('system');

  useEffect(() => {
    if (!user) return;

    // Permissions check
    const checkPermissions = async () => {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (user.email !== 'mohemad123hsak@gmail.com' && (!data.adminPermissions?.manage_settings)) {
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold text-white mb-1">Settings</h2>
        <p className="text-gray-400">Manage system security, database, and website controls.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#D4AF37]/20 overflow-x-auto">
        <button
          onClick={() => setActiveTab('system')}
          className={`px-8 py-4 font-bold transition-all duration-300 relative whitespace-nowrap ${
            activeTab === 'system' ? 'text-[#FFD700]' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span>🎮 System Controls</span>
          {activeTab === 'system' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#D4AF37] shadow-[0_0_10px_#D4AF37]"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-8 py-4 font-bold transition-all duration-300 relative whitespace-nowrap ${
            activeTab === 'security' ? 'text-[#FFD700]' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span>🛡️ Security Settings</span>
          {activeTab === 'security' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#D4AF37] shadow-[0_0_10px_#D4AF37]"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`px-8 py-4 font-bold transition-all duration-300 relative whitespace-nowrap ${
            activeTab === 'database' ? 'text-[#FFD700]' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span>💾 Database Backup</span>
          {activeTab === 'database' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#D4AF37] shadow-[0_0_10px_#D4AF37]"></div>
          )}
        </button>
      </div>

      <div className="mt-8">
        {activeTab === 'system' && <SystemPanel />}
        {activeTab === 'security' && <SecurityPanel />}
        {activeTab === 'database' && <DatabasePanel />}
      </div>
    </div>
  );
}

function SystemPanel() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Betting Controls */}
      <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <span className="text-2xl">🎲</span>
          <h3 className="text-xl font-bold text-[#FFD700]">Betting & Odds Control</h3>
        </div>
        <div className="space-y-6">
          <ToggleSwitch 
            title="Global Betting System" 
            description="Enable or disable all betting activities across the platform." 
            defaultChecked={true} 
          />
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Default Profit Margin (%)</label>
            <input type="number" className="w-full bg-[#151515] border border-[#D4AF37]/20 rounded-lg p-2.5 outline-none focus:border-[#D4AF37]" defaultValue="8" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm text-gray-400">Min Bet</label>
              <input type="number" className="w-full bg-[#151515] border border-[#D4AF37]/20 rounded-lg p-2.5 outline-none" defaultValue="10" />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm text-gray-400">Max Bet</label>
              <input type="number" className="w-full bg-[#151515] border border-[#D4AF37]/20 rounded-lg p-2.5 outline-none" defaultValue="10000" />
            </div>
          </div>
        </div>
      </div>

      {/* Chat & Social Controls */}
      <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <span className="text-2xl">💬</span>
          <h3 className="text-xl font-bold text-[#FFD700]">Chat & Social Settings</h3>
        </div>
        <div className="space-y-6">
          <ToggleSwitch 
            title="Global Chat System" 
            description="Allow users to communicate in public rooms." 
            defaultChecked={true} 
          />
          <ToggleSwitch 
            title="Private Messaging" 
            description="Allow users to send direct messages to each other." 
            defaultChecked={true} 
          />
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Slow Mode (Seconds)</label>
            <input type="number" className="w-full bg-[#151515] border border-[#D4AF37]/20 rounded-lg p-2.5 outline-none" defaultValue="3" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Filtered Words (Separated by comma)</label>
            <textarea className="w-full bg-[#151515] border border-[#D4AF37]/20 rounded-lg p-2.5 outline-none h-20" placeholder="badword1, badword2..."></textarea>
          </div>
        </div>
      </div>

      {/* User Service Management */}
      <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-xl p-6 lg:col-span-2">
        <div className="flex items-center space-x-3 mb-6">
          <span className="text-2xl">⚡</span>
          <h3 className="text-xl font-bold text-[#FFD700]">Service Restrictions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ServiceCard 
            title="Withdrawals" 
            icon="💰" 
            status="active" 
            description="Control user ability to withdraw funds." 
          />
          <ServiceCard 
            title="Deposits" 
            icon="💳" 
            status="maintenance" 
            description="Manage payment gateways availability." 
          />
          <ServiceCard 
            title="Transfers" 
            icon="🔄" 
            status="disabled" 
            description="Allow money transfers between users." 
          />
        </div>
      </div>
      
      <div className="lg:col-span-2 flex justify-end gap-4 mt-4">
        <button className="px-8 py-3 bg-red-600/10 text-red-500 border border-red-600/20 rounded-lg hover:bg-red-600/20 transition-all font-bold">
          Emergency Shutdown
        </button>
        <button className="px-8 py-3 bg-[#D4AF37] text-black rounded-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all font-bold">
          Apply System Changes
        </button>
      </div>
    </div>
  );
}

function ToggleSwitch({ title, description, defaultChecked }: { title: string, description: string, defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
      <div>
        <p className="font-medium text-gray-100">{title}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" className="sr-only peer" defaultChecked={defaultChecked} />
        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4AF37]"></div>
      </label>
    </div>
  );
}

function ServiceCard({ title, icon, status, description }: { title: string, icon: string, status: 'active' | 'maintenance' | 'disabled', description: string }) {
  const statusStyles = {
    active: 'text-green-500 bg-green-500/10 border-green-500/20',
    maintenance: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
    disabled: 'text-red-500 bg-red-500/10 border-red-500/20'
  };

  return (
    <div className="p-5 bg-[#151515] border border-[#D4AF37]/10 rounded-xl hover:border-[#D4AF37]/30 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <span className="text-3xl">{icon}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${statusStyles[status]}`}>
          {status}
        </span>
      </div>
      <h4 className="font-bold text-gray-200 mb-1">{title}</h4>
      <p className="text-xs text-gray-500 mb-4">{description}</p>
      <select className="w-full bg-black border border-white/10 rounded p-2 text-xs outline-none focus:border-[#D4AF37]">
        <option value="active">Active</option>
        <option value="maintenance">Maintenance</option>
        <option value="disabled">Disabled</option>
      </select>
    </div>
  );
}

function SecurityPanel() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* 2FA Section */}
      <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <span className="text-2xl">🔐</span>
          <h3 className="text-xl font-bold text-[#FFD700]">Authentication & Security</h3>
        </div>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
            <div>
              <p className="font-medium">Force Two-Factor Authentication</p>
              <p className="text-xs text-gray-400">Require all admins to use 2FA for access.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4AF37]"></div>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Admin Session Timeout (Minutes)</label>
            <input 
              type="number" 
              className="w-full bg-[#151515] border border-[#D4AF37]/20 rounded-lg p-3 focus:border-[#D4AF37] outline-none" 
              defaultValue="30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Banned IP Addresses</label>
            <textarea 
              className="w-full bg-[#151515] border border-[#D4AF37]/20 rounded-lg p-3 focus:border-[#D4AF37] outline-none h-24"
              placeholder="Enter IP addresses separated by commas..."
            ></textarea>
          </div>

          <button className="w-full py-3 bg-[#D4AF37] text-black font-bold rounded-lg hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all uppercase tracking-wider">
            Save Security Policy
          </button>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <span className="text-2xl">🔑</span>
          <h3 className="text-xl font-bold text-[#FFD700]">System API Keys</h3>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-white/5 rounded-lg border border-white/10 group">
            <p className="text-sm text-gray-400 mb-2">Production API Secret</p>
            <div className="flex items-center justify-between">
              <code className="text-[#D4AF37] font-mono">HBET_PROD_********************</code>
              <button className="text-xs text-gray-500 hover:text-white uppercase">Show</button>
            </div>
          </div>
          <p className="text-xs text-red-500/80 italic">⚠️ Never share these keys with anyone outside the core development team.</p>
          
          <div className="mt-8">
            <h4 className="font-bold mb-4">Login Audit Log</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="text-xs flex justify-between p-2 border-b border-white/5">
                  <span className="text-gray-300">Admin Login from 192.168.1.{i}</span>
                  <span className="text-gray-500">2024-03-21 14:0{i}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DatabasePanel() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Local Backup */}
      <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-xl p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <span className="text-8xl">📦</span>
        </div>
        
        <div className="relative z-10">
          <h3 className="text-2xl font-bold text-[#FFD700] mb-2">Manual Database Backup</h3>
          <p className="text-gray-400 mb-8 max-w-xl">
            Generate an immediate full backup of the system database including users, match history, and financial logs.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="flex-1 py-4 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-black rounded-lg hover:scale-[1.02] transition-transform flex items-center justify-center space-x-2">
              <span>🚀</span>
              <span>START FULL BACKUP (.SQL)</span>
            </button>
            <button className="flex-1 py-4 bg-white/5 border border-[#D4AF37]/30 text-[#D4AF37] font-bold rounded-lg hover:bg-[#D4AF37]/10 transition-colors flex items-center justify-center space-x-2">
              <span>📥</span>
              <span>DOWNLOAD JSON EXPORT</span>
            </button>
          </div>
        </div>
      </div>

      {/* Auto Backup Config */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-xl p-6">
          <h4 className="text-lg font-bold mb-6 flex items-center space-x-2">
            <span className="text-blue-400">⏲️</span>
            <span>Automated Backups</span>
          </h4>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400 tracking-wider uppercase text-[10px]">Frequency</label>
              <select className="w-full bg-[#151515] border border-[#D4AF37]/20 rounded-lg p-3 outline-none">
                <option>Every 12 Hours</option>
                <option>Daily at Midnight</option>
                <option>Weekly on Sunday</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400 tracking-wider uppercase text-[10px]">Retention Policy</label>
              <select className="w-full bg-[#151515] border border-[#D4AF37]/20 rounded-lg p-3 outline-none">
                <option>Keep last 10 backups</option>
                <option>Keep last 30 days</option>
                <option>Unlimited (Not recommended)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-xl p-6">
          <h4 className="text-lg font-bold mb-6 flex items-center space-x-2">
            <span className="text-green-400">☁️</span>
            <span>Cloud Storage</span>
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <span className="text-sm">AWS S3 Integration</span>
              <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded border border-green-500/20 font-bold uppercase">Connected</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg opacity-50">
              <span className="text-sm">Google Cloud Storage</span>
              <span className="text-[10px] bg-gray-500/10 text-gray-500 px-2 py-0.5 rounded border border-gray-500/20 font-bold uppercase">Disabled</span>
            </div>
            <button className="w-full py-2 border border-[#D4AF37]/20 text-[#D4AF37] text-xs rounded hover:bg-[#D4AF37]/5 transition-colors">
              Configure Storage Providers
            </button>
          </div>
        </div>
      </div>

      {/* Recent Backups List */}
      <div className="bg-[#0a0a0a] border border-[#D4AF37]/20 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D4AF37]/20 flex justify-between items-center bg-[#151515]">
          <h4 className="font-bold">Recent Backups Histroy</h4>
          <span className="text-xs text-gray-500 italic">Total Storage: 1.2 GB</span>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-[#D4AF37]/10">
              <th className="px-6 py-3 font-medium">Filename</th>
              <th className="px-6 py-3 font-medium">Size</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[1, 2, 3].map(i => (
              <tr key={i} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-mono text-xs">hbet_db_backup_2024_03_2{4-i}.sql</td>
                <td className="px-6 py-4 text-gray-400">42.{i} MB</td>
                <td className="px-6 py-4">
                  <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full border border-green-500/20">Success</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-[#D4AF37] hover:underline uppercase text-[10px] font-bold">Restore</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
