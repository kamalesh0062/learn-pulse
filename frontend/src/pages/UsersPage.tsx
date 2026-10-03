import React, { useEffect, useState } from 'react';
import { adminApi, getErrorMessage } from '../services/api';
import { User, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '../components/common/LoadingState';
import { UserCheck, Trash2, AlertCircle, ShieldCheck } from 'lucide-react';

const ROLES: UserRole[] = ['student', 'teacher', 'admin'];

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | UserRole>('all');

  const fetchUsers = async () => {
    try {
      setUsers(await adminApi.getUsers());
    } catch (err) {
      console.error("User fetch error:", err);
      setError(getErrorMessage(err, "Could not load users."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (target: User, role: UserRole) => {
    if (role === target.role) return;
    if (!confirm(`Change ${target.name}'s role from ${target.role} to ${role}?`)) return;
    setError(null);
    try {
      await adminApi.updateUserRole(target.id, role);
      await fetchUsers();
    } catch (err) {
      console.error("Role update error:", err);
      setError(getErrorMessage(err, "Could not change the role."));
    }
  };

  const handleDelete = async (target: User) => {
    if (!confirm(`Permanently delete ${target.name} (${target.email}) and all of their recorded activity?`)) return;
    setError(null);
    try {
      await adminApi.deleteUser(target.id);
      await fetchUsers();
    } catch (err) {
      console.error("User delete error:", err);
      setError(getErrorMessage(err, "Could not delete the user."));
    }
  };

  if (loading) return <LoadingState message="Loading user directory..." />;

  const visible = users.filter((u) => filter === 'all' || u.role === filter);

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-3xl border border-dark-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-heading flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-brand-400" />
            User Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {users.length} account(s). Admin accounts can only be created here, by promoting an existing user.
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | UserRole)}
          className="bg-dark-card text-xs text-slate-200 border border-dark-border rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
        >
          <option value="all">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}s</option>)}
        </select>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="glass-card p-6 rounded-3xl border border-dark-border overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-dark-border text-slate-400 uppercase font-mono text-[10px]">
              <th className="pb-3">ID</th>
              <th className="pb-3">Name</th>
              <th className="pb-3">Email</th>
              <th className="pb-3">Department / Enrollment</th>
              <th className="pb-3">Camera</th>
              <th className="pb-3">Role</th>
              <th className="pb-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border/50 text-slate-300">
            {visible.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <tr key={u.id} className="hover:bg-dark-card/50">
                  <td className="py-3 font-mono text-slate-500">#{u.id}</td>
                  <td className="py-3 font-semibold text-white">
                    {u.name} {isSelf && <span className="text-[10px] font-mono text-brand-400">(you)</span>}
                  </td>
                  <td className="py-3">{u.email}</td>
                  <td className="py-3 font-mono">{u.department || u.enrollment_no || '—'}</td>
                  <td className="py-3">
                    {u.camera_consent
                      ? <span className="text-emerald-400 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> on</span>
                      : <span className="text-slate-500">off</span>}
                  </td>
                  <td className="py-3">
                    <select
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                      className="bg-dark-card text-xs text-slate-200 border border-dark-border rounded-lg px-2 py-1 disabled:opacity-50"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="py-3 text-right">
                    {!isSelf && (
                      <button onClick={() => handleDelete(u)} className="text-slate-400 hover:text-rose-400 p-1" title="Delete user">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
