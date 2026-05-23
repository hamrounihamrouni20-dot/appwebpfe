import { useState } from 'react';
import { User, Bell, Shield, Save, Eye, EyeOff } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security'>('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);

  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    address: profile?.address ?? '',
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'security' as const, label: 'Security', icon: Shield },
  ];

  return (
    <AppLayout title="Settings">
      <div className="p-6 max-w-3xl">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage your account preferences</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === tab.id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4 pb-4 border-b border-gray-800">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
                <span className="text-amber-400 text-2xl font-bold">
                  {profile?.full_name?.charAt(0) ?? 'U'}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{profile?.full_name}</p>
                <p className="text-xs text-gray-500 capitalize mt-0.5">{profile?.role}</p>
                <button className="text-xs text-amber-400 hover:text-amber-300 transition-colors mt-1">Change photo</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Address</label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={e => setProfileForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${saved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/20'}`}
            >
              <Save className="w-4 h-4" />
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Notification Preferences</h3>
            {[
              { label: 'Critical Alerts', desc: 'Temperature, offline, and system faults', enabled: true },
              { label: 'Production Warnings', desc: 'When production is below expected', enabled: true },
              { label: 'Ticket Updates', desc: 'Status changes and technician assignments', enabled: true },
              { label: 'Weekly Reports', desc: 'Summary of energy production', enabled: false },
              { label: 'Maintenance Reminders', desc: 'Scheduled maintenance notifications', enabled: false },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked={item.enabled} className="sr-only peer" />
                  <div className="w-10 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            ))}
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-amber-500/20">
              <Save className="w-4 h-4" /> Save Preferences
            </button>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Change Password</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Current Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 pr-10 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
                    placeholder="••••••••"
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">New Password</label>
                <input type="password" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors" placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Confirm New Password</label>
                <input type="password" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors" placeholder="••••••••" />
              </div>
            </div>
            <div className="pt-2 border-t border-gray-800">
              <h4 className="text-xs font-semibold text-gray-300 mb-3">Active Sessions</h4>
              <div className="bg-gray-800/50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white">Current session</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Chrome · {new Date().toLocaleDateString()}</p>
                </div>
                <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">Active</span>
              </div>
            </div>
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-amber-500/20">
              <Save className="w-4 h-4" /> Update Password
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
