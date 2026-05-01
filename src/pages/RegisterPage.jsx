import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { ArrowRight, User, Motorcycle } from '@phosphor-icons/react';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={user.role === 'rider' ? '/rider' : '/dashboard'} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, name, phone, role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12">
        <div className="max-w-sm w-full">
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-2">Get started</p>
          <h1 data-testid="register-heading" className="text-4xl sm:text-5xl font-black tracking-tighter text-[#0A0A0A] mb-6">
            Create account
          </h1>

          {/* Role Selector */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              data-testid="role-user-btn"
              onClick={() => setRole('user')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-2 transition-all ${
                role === 'user'
                  ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                  : 'border-[#E4E4E7] text-[#52525B] hover:border-[#0A0A0A]'
              }`}
            >
              <User size={18} weight="bold" />
              Send / Receive
            </button>
            <button
              type="button"
              data-testid="role-rider-btn"
              onClick={() => setRole('rider')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-2 transition-all ${
                role === 'rider'
                  ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                  : 'border-[#E4E4E7] text-[#52525B] hover:border-[#0A0A0A]'
              }`}
            >
              <Motorcycle size={18} weight="bold" />
              Rider
            </button>
          </div>

          {error && (
            <div data-testid="register-error" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] block mb-1">Full Name</label>
              <Input
                data-testid="register-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-[#E4E4E7] rounded-none h-12 text-base"
                placeholder="Adebayo Tunde"
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] block mb-1">Email</label>
              <Input
                data-testid="register-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-[#E4E4E7] rounded-none h-12 text-base"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] block mb-1">Phone Number</label>
              <Input
                data-testid="register-phone-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-[#E4E4E7] rounded-none h-12 text-base"
                placeholder="+234 801 234 5678"
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] block mb-1">Password</label>
              <Input
                data-testid="register-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#E4E4E7] rounded-none h-12 text-base"
                placeholder="Create a strong password"
                required
              />
            </div>
            <Button
              data-testid="register-submit-button"
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#0A0A0A] text-white rounded-sm text-base font-medium hover:bg-[#0A0A0A]/90 transition-colors"
            >
              {loading ? 'Creating account...' : 'Create account'}
              {!loading && <ArrowRight size={18} weight="bold" className="ml-2" />}
            </Button>
          </form>

          <p className="mt-6 text-sm text-[#52525B]">
            Already have an account?{' '}
            <Link to="/login" data-testid="go-to-login" className="text-[#0A0A0A] font-semibold underline underline-offset-4 hover:text-[#00A859] transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

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
              Your packages, confirmed before dispatch. Zero failed deliveries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

