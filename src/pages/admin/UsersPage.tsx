import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, CreditCard as Edit2, Trash2, UserCheck, Mail, Phone, Building2, Eye } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { getUsersWithStats } from '../../services/users';
import emailService from '../../lib/emailService';
import { supabase } from '../../lib/supabase';
import type { Profile, UserRole } from '../../lib/database.types';

interface UserWithStats extends Profile {
  installations_count: number;
  created_tickets_count: number;
  assigned_tickets_count: number;
  last_activity: string;
}

function roleVariant(role: UserRole) {
  const map = { admin: 'error', technician: 'info', user: 'success' } as const;
  return map[role];
}

export default function UsersPage() {
  const [profiles, setProfiles] = useState<UserWithStats[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', role: 'user' as UserRole, phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const filtered = profiles.filter(p => {
    const matchesSearch = p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  async function createUser() {
    setLoading(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (sessionError || !session?.access_token) {
        alert('You must be logged in as admin');
        return;
      }

      const allowedRoles = ['user', 'technician', 'admin'] as const;
      if (!form.full_name.trim()) {
        alert('Full name is required');
        return;
      }
      if (!form.email.trim()) {
        alert('Email is required');
        return;
      }
      if (!form.role || !allowedRoles.includes(form.role)) {
        alert('Role is required and must be user, technician, or admin');
        return;
      }

      const payload: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        role: form.role,
      };

      if (form.phone.trim()) {
        payload.phone = form.phone.trim();
      }
      if (form.password.trim()) {
        payload.password = form.password.trim();
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify(payload),
        }
      );

      const text = await response.text();
      let result: any = {};

      if (text) {
        try {
          result = JSON.parse(text);
        } catch {
          throw new Error(text);
        }
      }

      if (!response.ok) {
        throw new Error(result.error || result.message || `HTTP ${response.status}`);
      }

      // User created successfully in Supabase
      const tempPassword = result.temporary_password;

      // Now attempt to send welcome email via mail server (non-blocking)
      let emailSent = false;
      let emailError = '';
      try {
        const emailRes = await emailService.sendWelcomeEmail({
          fullName: form.full_name.trim(),
          email: form.email.trim(),
          password: tempPassword || form.password.trim(),
          role: form.role,
        });
        emailSent = emailRes.success;
        emailError = emailRes.error || '';
      } catch (err) {
        console.error('Email service error:', err);
        emailError = err instanceof Error ? err.message : String(err);
      }

      const messages: string[] = [];
      if (emailSent) {
        messages.push('User created successfully. Welcome email sent.');
      } else {
        messages.push('User created successfully. (Email sending failed - check server logs)');
        if (emailError) {
          messages.push(`Error: ${emailError}`);
        }
      }
      if (tempPassword) {
        messages.push(`Temporary password: ${tempPassword}`);
      }

      alert(messages.join(' '));
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreate(false);
      setForm({ full_name: '', email: '', role: 'user', phone: '', password: '' });
    } catch (error) {
      console.error('createUser error', error);
      alert(`Failed to create user: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  const deleteUser = (id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
  };
  const { data: usersData, isLoading: usersLoading, isError: usersError, error: usersFetchError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsersWithStats,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  function getErrorMessage(error: unknown) {
    if (!error) return 'Unknown error';
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null) {
      return (error as { message?: string }).message || JSON.stringify(error);
    }
    return String(error);
  }

  useEffect(() => {
    setProfiles(usersData ?? []);
  }, [usersData]);

  useEffect(() => {
    if (usersError) {
      console.error('Admin users query failed:', usersFetchError);
    }
  }, [usersError, usersFetchError]);

  useEffect(() => {
    const channel = supabase
      .channel('public:installations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'installations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Load on mount
  useEffect(() => {
    // no-op: loading is managed by React Query above.
  }, []);

  return (
    <AppLayout title="User Management">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">User Management</h2>
            <p className="text-sm text-gray-400 mt-0.5">{profiles.filter(p => p.role === 'user').length} customers, {profiles.filter(p => p.role === 'technician').length} technicians</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'admin', 'technician', 'user'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all capitalize ${roleFilter === r ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-gray-900 text-gray-400 border border-gray-800 hover:border-gray-700'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">User</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3 hidden md:table-cell">Contact</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3 hidden lg:table-cell">Installations</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3 hidden xl:table-cell">Created Tickets</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3 hidden xl:table-cell">Assigned Tickets</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3 hidden xl:table-cell">Last Activity</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-amber-400 text-xs font-bold">{user.full_name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{user.full_name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <div className="space-y-1">
                        {user.phone && (
                          <p className="flex items-center gap-1 text-xs text-gray-400">
                            <Phone className="w-3 h-3" />{user.phone}
                          </p>
                        )}
                        <p className="flex items-center gap-1 text-xs text-gray-400">
                          <Mail className="w-3 h-3" />{user.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={roleVariant(user.role)} dot>{user.role}</Badge>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Building2 className="w-3.5 h-3.5" />
                          {user.installations_count} installations
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden xl:table-cell">
                      <div className="text-xs text-gray-400">{user.created_tickets_count}</div>
                    </td>
                    <td className="px-5 py-4 hidden xl:table-cell">
                      <div className="text-xs text-gray-400">{user.assigned_tickets_count}</div>
                    </td>
                    <td className="px-5 py-4 hidden xl:table-cell">
                      <div className="text-xs text-gray-400">{new Date(user.last_activity).toLocaleString()}</div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={user.is_active ? 'success' : 'neutral'} dot>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/admin/users/${user.id}`)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                          title="View user details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditUser(user)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {usersLoading && (
          <div className="px-5 py-4 text-sm text-gray-400">Loading users…</div>
        )}
        {usersError && (
          <div className="px-5 py-4 text-sm text-red-400">Unable to load users: {getErrorMessage(usersFetchError)}</div>
        )}
      </div>

      {/* Create user modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New User">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Full Name *</label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="Leave blank to auto-generate"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
            >
              <option value="user">User (Customer)</option>
              <option value="technician">Technician</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <UserCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <p className="text-xs text-blue-300">A welcome email with login credentials will be sent to the user.</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">Cancel</button>
            <button onClick={createUser} disabled={!form.full_name || !form.email || loading} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">{loading ? 'Creating...' : 'Create User'}</button>
          </div>
        </div>
      </Modal>

      {/* Edit user modal */}
      {editUser && (
        <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Full Name</label>
              <input
                type="text"
                defaultValue={editUser.full_name}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Role</label>
              <select
                defaultValue={editUser.role}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="user">User</option>
                <option value="technician">Technician</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditUser(null)} className="flex-1 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={() => setEditUser(null)} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-medium transition-all">Save Changes</button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
