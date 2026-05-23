import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [readyToReset, setReadyToReset] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function initializeReset() {
      const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
      if (error) {
        console.error('ResetPasswordPage getSessionFromUrl error:', error);
        setError(error.message || 'Invalid reset link.');
      } else if (!data?.session?.user) {
        setError('Reset link is invalid or expired.');
      } else {
        setReadyToReset(true);
      }
      setInitialized(true);
    }

    initializeReset();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      console.error('ResetPasswordPage updateUser error:', error);
      setError(error.message || 'Unable to update password.');
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate('/login'), 2500);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30 mb-4">
            <Lock className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Reset Password</h1>
          <p className="text-sm text-gray-400 mt-2">Set a new password for your SolarWatch account.</p>
        </div>

        <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to login
          </Link>

          {!initialized ? (
            <div className="text-center text-gray-400 py-10">Loading reset link...</div>
          ) : success ? (
            <div className="flex flex-col gap-4 items-center">
              <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-green-400 font-medium">Password updated successfully.</p>
                  <p className="text-green-400/70 text-xs">Redirecting to login…</p>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
              <Link
                to="/forgot-password"
                className="text-sm text-amber-300 hover:text-amber-200 transition-colors"
              >
                Request a new reset link
              </Link>
            </div>
          ) : readyToReset ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors text-sm"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors text-sm"
                  placeholder="Confirm new password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-all text-sm"
              >
                {loading ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          ) : (
            <div className="text-center text-gray-400 py-10">Preparing password reset…</div>
          )}
        </div>
      </div>
    </div>
  );
}
