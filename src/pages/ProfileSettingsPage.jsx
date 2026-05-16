import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  ArrowLeft, User, Phone, PencilSimple, 
  SignOut, ShieldCheck, IdentificationCard 
} from '@phosphor-icons/react';
import { toast } from 'sonner';

export default function ProfileSettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          phone: formData.phone
        })
        .eq('id', user.id);

      if (error) throw error;
      
      await refreshUser();
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F4F4F5]">
      <header className="bg-white border-b border-[#E4E4E7] sticky top-0 z-50">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-[#52525B] hover:text-[#0A0A0A]">
            <ArrowLeft size={20} weight="bold" />
          </button>
          <h1 className="text-lg font-black tracking-tighter">Profile Settings</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {/* Profile Card */}
        <div className="bg-white border border-[#E4E4E7] p-6 text-center">
          <div className="w-20 h-20 bg-[#0A0A0A] text-white rounded-full flex items-center justify-center mx-auto mb-4">
            <User size={40} weight="bold" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-[#0A0A0A]">{user?.name}</h2>
          <p className="text-xs uppercase tracking-widest font-bold text-[#52525B] mt-1">{user?.role} Account</p>
        </div>

        {/* Edit Form */}
        <div className="bg-white border border-[#E4E4E7]">
          <div className="p-4 border-b border-[#E4E4E7] bg-[#F9F9F9]">
            <h3 className="text-[10px] uppercase font-bold text-[#52525B] tracking-wider">Personal Information</h3>
          </div>
          <form onSubmit={handleUpdate} className="p-6 space-y-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-[#52525B] mb-1 block">Full Name</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]">
                  <IdentificationCard size={18} />
                </span>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="pl-10 h-12 rounded-none border-[#E4E4E7] focus:border-[#0A0A0A]"
                  placeholder="Your Name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-[#52525B] mb-1 block">Phone Number</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]">
                  <Phone size={18} />
                </span>
                <Input 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="pl-10 h-12 rounded-none border-[#E4E4E7] focus:border-[#0A0A0A]"
                  placeholder="+234..."
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-12 bg-[#0A0A0A] text-white rounded-none font-bold hover:bg-[#0A0A0A]/90 transition-colors"
            >
              {loading ? 'Saving...' : 'Update Profile'}
            </Button>
          </form>
        </div>

        {/* Security Info */}
        <div className="bg-white border border-[#E4E4E7] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00A859]/10 text-[#00A859] rounded-full flex items-center justify-center">
              <ShieldCheck size={20} weight="bold" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#0A0A0A]">Account Secured</p>
              <p className="text-[10px] text-[#52525B]">Verified via Supabase Auth</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-[#00A859] bg-[#00A859]/10 px-2 py-1 uppercase tracking-tighter">Active</span>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <button 
            onClick={handleLogout}
            className="w-full h-14 bg-white border border-red-200 text-red-600 font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
          >
            <SignOut size={20} weight="bold" />
            Sign Out
          </button>
          
          <p className="text-center text-[10px] text-[#A1A1AA] uppercase tracking-[0.2em] font-medium">
            User ID: {user?.id?.slice(0, 8)}...{user?.id?.slice(-8)}
          </p>
        </div>
      </main>
    </div>
  );
}
