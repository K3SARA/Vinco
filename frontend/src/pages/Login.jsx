import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Eye, EyeOff, ShieldAlert, Award, ChevronRight } from 'lucide-react';
import api from '../services/api';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Setup Admin states (if backend has no users)
  const [needsSetup, setNeedsSetup] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Check if admin setup is needed
  useEffect(() => {
    async function checkAdminSetup() {
      try {
        const response = await api.get('/auth/setup-status');
        setNeedsSetup(Boolean(response.data?.needsSetup));
      } catch (err) {
        console.error('Setup status check failed:', err);
      }
    }
    checkAdminSetup();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields / කරුණාකර සියලුම ක්ෂේත්‍ර පුරවන්න.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const loggedUser = await login(username, password);
      if (loggedUser.role === 'DELIVERY_STAFF') {
        navigate('/deliveries');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err);
      // Check if it's the "No users found" setup error
      const message = String(err || '');
      if (message.includes('No users found') || message.includes('setup') || message.toLowerCase().includes('initial')) {
        setNeedsSetup(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetupAdmin = async (e) => {
    e.preventDefault();
    if (!adminName || !adminUsername || !adminPassword) {
      setError('All fields are required for setup.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/setup-admin', {
        name: adminName,
        username: adminUsername,
        password: adminPassword,
      });
      // Admin created, now auto login
      await login(adminUsername, adminPassword);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-900 px-4 py-12 sm:px-6 lg:px-8 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(to bottom, rgba(31, 28, 26, 0.95), rgba(12, 10, 9, 0.98)), url('/banner.png')` }}>
      <div className="w-full max-w-md space-y-8 glass-panel p-8 rounded-2xl border border-stone-850/50 shadow-2xl relative">
        
        {/* HEADER */}
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-xl bg-white shadow-lg border border-stone-200 overflow-hidden">
            <img
              src="/logo.png"
              alt="Alight Furniture & Timbers"
              className="h-full w-full object-contain p-1.5"
            />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white font-display">
            {needsSetup ? 'Initial System Setup' : 'Alight Furniture'}
          </h2>
          <p className="mt-2 text-sm text-stone-400 font-medium">
            {needsSetup 
              ? 'Create the primary administrator account'
              : 'Billing & Timber Stock Management Portal'
            }
          </p>
        </div>

        {/* ERROR BOX */}
        {error && (
          <div className="rounded-lg bg-red-950/30 border border-red-800 p-4 text-sm text-red-300 flex items-start gap-2.5">
            <ShieldAlert size={18} className="shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* SETUP FORM */}
        {needsSetup ? (
          <form className="mt-8 space-y-6" onSubmit={handleSetupAdmin}>
            <div className="space-y-4 rounded-md">
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wide">Full Name</label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-950/60 px-3 py-2.5 text-white placeholder-stone-500 focus:border-wood-500 focus:outline-none focus:ring-1 focus:ring-wood-500 text-sm"
                  placeholder="e.g. Navin Rodrigo"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wide">Administrator Username</label>
                <input
                  type="text"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-950/60 px-3 py-2.5 text-white placeholder-stone-500 focus:border-wood-500 focus:outline-none focus:ring-1 focus:ring-wood-500 text-sm"
                  placeholder="e.g. admin"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wide">Secure Password</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-stone-700 bg-stone-950/60 px-3 py-2.5 text-white placeholder-stone-500 focus:border-wood-500 focus:outline-none focus:ring-1 focus:ring-wood-500 text-sm"
                  placeholder="Min 6 characters"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-lg bg-wood-600 px-4 py-3 text-sm font-bold text-white hover:bg-wood-700 focus:outline-none focus:ring-2 focus:ring-wood-500 focus:ring-offset-2 transition-all shadow-md disabled:opacity-50"
              >
                {loading ? 'Initializing Database...' : 'Register Admin & Start App'}
              </button>
            </div>
          </form>
        ) : (
          /* LOGIN FORM */
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4 rounded-md">
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wide">Username / පරිශීලක නාමය</label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-500">
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full rounded-lg border border-stone-700 bg-stone-950/40 pl-10 pr-3 py-2.5 text-white placeholder-stone-600 focus:border-wood-500 focus:outline-none focus:ring-1 focus:ring-wood-500 text-sm transition-all"
                    placeholder="Enter username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wide">Password / මුරපදය</label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-500">
                    <Lock size={18} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-stone-700 bg-stone-950/40 pl-10 pr-10 py-2.5 text-white placeholder-stone-600 focus:border-wood-500 focus:outline-none focus:ring-1 focus:ring-wood-500 text-sm transition-all"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-stone-700 bg-stone-950/30 text-wood-600 focus:ring-wood-500"
                />
                <label htmlFor="remember-me" className="ml-2 block text-xs text-stone-400">
                  Remember this device / මාව මතක තබා ගන්න
                </label>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center items-center gap-1.5 rounded-lg bg-wood-600 px-4 py-3 text-sm font-bold text-white hover:bg-wood-700 focus:outline-none focus:ring-2 focus:ring-wood-500 focus:ring-offset-2 transition-all shadow-md disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In / පද්ධතියට ඇතුළු වන්න'}
                {!loading && <ChevronRight size={16} />}
              </button>
            </div>
          </form>
        )}

        <div className="pt-2 text-center text-[10px] text-stone-500 font-medium border-t border-stone-850/50">
          Alight Furniture Billing System.
        </div>
      </div>
    </div>
  );
}
