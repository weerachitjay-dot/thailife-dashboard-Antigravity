import React, { useState } from 'react';
import { Users } from 'lucide-react';

const UserManagement = ({ users, onAddUser, onDeleteUser, currentUser }) => {
    const [newUser, setNewUser] = useState({ username: '', pass: '', name: '', role: 'viewer' });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newUser.username || !newUser.pass || !newUser.name) return;
        onAddUser(newUser);
        setNewUser({ username: '', pass: '', name: '', role: 'viewer' });
    };

    return (
        <div className="space-y-6">
            {/* SECURITY LOCK: Only Weerachit Jay can create users */}
            {currentUser.username === 'weerachit.jay' ? (
                <div className="glass-card p-6 rounded-2xl">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" />
                        Create New User
                    </h2>
                    <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Name</label>
                            <input type="text" className="glass-input w-full px-4 py-2 rounded-xl" placeholder="John Doe" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Username</label>
                            <input type="text" className="glass-input w-full px-4 py-2 rounded-xl" placeholder="john.doe" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} required />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Password</label>
                            <input type="text" className="glass-input w-full px-4 py-2 rounded-xl" placeholder="Select a strong password" value={newUser.pass} onChange={e => setNewUser({ ...newUser, pass: e.target.value })} required />
                        </div>
                        <button type="submit" className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30 whitespace-nowrap">
                            Add User
                        </button>
                    </form>
                    <p className="text-xs text-amber-600 mt-3 font-medium bg-amber-50 px-3 py-2 rounded-lg inline-block border border-amber-100">
                        Note: Users created here are saved to your browser (LocalStorage). They will not be visible on other devices unless you manually add them there or we implement a cloud database.
                    </p>
                </div>
            ) : (
                <div className="glass-card p-6 rounded-2xl border-l-4 border-l-rose-500 bg-rose-50/30">
                    <div className="flex items-center gap-3 text-rose-700 font-bold">
                        <Users className="w-5 h-5" />
                        <span>User Management Locked</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-2">
                        Only Super Admin (Weerachit Jay) has permission to create new users to prevent unauthorized access.
                    </p>
                </div>
            )}

            <div className="glass-card p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Existing Users</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-6 py-3 rounded-tl-xl">Name</th>
                                <th className="px-6 py-3">Username</th>
                                <th className="px-6 py-3">Role</th>
                                <th className="px-6 py-3 rounded-tr-xl text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map((u, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4 font-bold text-slate-700">{u.name} {u.username === currentUser.username && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded ml-2">You</span>}</td>
                                    <td className="px-6 py-4 text-slate-500">{u.username}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>{u.role || 'viewer'}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {u.role !== 'admin' && (
                                            <button onClick={() => onDeleteUser(u.id, u.username)} className="text-rose-500 hover:text-rose-700 font-medium text-xs bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors">
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
