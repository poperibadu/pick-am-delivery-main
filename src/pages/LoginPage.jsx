import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { ArrowRight } from '@phosphor-icons/react';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        const dest = user.role === 'rider' ? '/rider' : '/dashboard';
        navigate(dest, { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left: Form */}
      <div className="flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12">
        <div className="max-w-sm w-full">
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-2">Welcome back</p>
          <h1 data-testid="login-heading" className="text-4xl sm:text-5xl font-black tracking-tighter text-[#0A0A0A] mb-8">
            Sign in
          </h1>

          {error && (
            <div data-testid="login-error" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] block mb-1">Email</label>
              <Input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-[#E4E4E7] rounded-none h-12 text-base"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] block mb-1">Password</label>
              <Input
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#E4E4E7] rounded-none h-12 text-base"
                placeholder="Enter password"
                required
              />
            </div>
            <Button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#0A0A0A] text-white rounded-sm text-base font-medium hover:bg-[#0A0A0A]/90 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading && <ArrowRight size={18} weight="bold" className="ml-2" />}
            </Button>
          </form>

          <p className="mt-6 text-sm text-[#52525B]">
            Don't have an account?{' '}
            <Link to="/register" data-testid="go-to-register" className="text-[#0A0A0A] font-semibold underline underline-offset-4 hover:text-[#00A859] transition-colors">
              Create account
            </Link>
          </p>
        </div>
      </div>

      {/* Right: Image */}
      <div className="hidden md:block relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1670506761128-2076c4c881da?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzF8MHwxfHNlYXJjaHwyfHxhZXJpYWwlMjB2aWV3JTIwY2l0eSUyMG1hcHxlbnwwfHx8fDE3NzYwMDA4NTl8MA&ixlib=rb-4.1.0&q=85"
          alt="City aerial view"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50 flex items-end p-12">
          <div>
            <h2 className="text-3xl font-black tracking-tighter text-white mb-2">Pick-Am</h2>
            <p className="text-white/70 text-base max-w-xs leading-relaxed">
              Confirm readiness. Deliver successfully. Nigeria's receiver-first delivery platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

