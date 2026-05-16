import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../lib/supabase';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/accordion';
import { ArrowLeft, User, MapPin, NavigationArrow, Cube } from '@phosphor-icons/react';

export default function CreatePackagePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    receiver_name: '',
    receiver_phone: '',
    pickup_landmark: '',
    pickup_address: '',
    dropoff_landmark: '',
    dropoff_address: '',
    item_description: '',
    item_value: '',
    package_size: 'small',
    notes: ''
  });
  
  const [landmarks, setLandmarks] = useState([]);
  const [priceInfo, setPriceInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [activeSearchField, setActiveSearchField] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState("recipient");

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [{ data: lmkData }, { data: profile }] = await Promise.all([
        supabase.from('landmarks').select('name'),
        supabase.from('profiles').select('wallet_balance').eq('id', user.id).single()
      ]);
      if (lmkData) setLandmarks(lmkData.map(l => l.name));
      if (profile) setWalletBalance(profile.wallet_balance);
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    const calcPrice = async () => {
      const { pickup_landmark, dropoff_landmark, package_size, item_value } = formData;
      if (!pickup_landmark || !dropoff_landmark || !package_size) return;
      try {
        const { data, error: rpcError } = await supabase.rpc('get_delivery_quote', {
          p_pickup_landmark: pickup_landmark,
          p_dropoff_landmark: dropoff_landmark,
          p_package_size: package_size,
          p_item_value: Number(item_value) || 0
        });
        if (rpcError) throw rpcError;
        setPriceInfo(data);
      } catch (err) {
        console.error('Price calculation failed:', err);
      }
    };
    const timer = setTimeout(calcPrice, 500);
    return () => clearTimeout(timer);
  }, [formData.pickup_landmark, formData.dropoff_landmark, formData.package_size, formData.item_value]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextSection = (section) => {
    setActiveAccordion(section);
  };

  const handleLocationAccess = () => {
    if (!navigator.geolocation) {
      setError("Location services are not supported.");
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (!res.ok) throw new Error("Failed to resolve address");
          
          const data = await res.json();
          const address = data.address?.road 
            ? `${data.address.road}, ${data.address.city || data.address.town || data.address.suburb || ''}`.trim().replace(/,\s*$/, '')
            : data.display_name.split(',').slice(0, 3).join(',');
            
          setFormData(prev => ({ ...prev, pickup_address: address }));
          setError("");
        } catch (err) {
          setError("Could not turn coordinates into an address.");
        } finally {
          setIsLocating(false);
          setActiveSearchField(null);
        }
      },
      () => {
        setError("Location permission denied.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    const required = ['receiver_name', 'receiver_phone', 'pickup_landmark', 'pickup_address', 'dropoff_landmark', 'dropoff_address', 'item_description'];
    const missing = required.filter(f => !formData[f]);
    if (missing.length > 0) {
      setError('Please complete all required fields.');
      if (!formData.receiver_name || !formData.receiver_phone) setActiveAccordion('recipient');
      else if (!formData.pickup_landmark || !formData.pickup_address) setActiveAccordion('pickup');
      else if (!formData.dropoff_landmark || !formData.dropoff_address) setActiveAccordion('dropoff');
      else setActiveAccordion('package');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const pkgToInsert = {
        ...formData,
        sender_id: user.id,
        price: priceInfo?.total_price || priceInfo?.price || 0,
        insurance_fee: priceInfo?.insurance_fee || 0,
        item_value: Number(formData.item_value) || 0,
        distance_km: priceInfo?.distance_km || 0,
        tracking_lat: priceInfo?.pickup_coords?.[0],
        tracking_lng: priceInfo?.pickup_coords?.[1],
        status: 'pending_receiver'
      };

      const { data, error: insertError } = await supabase
        .from('packages')
        .insert(pkgToInsert)
        .select()
        .single();

      if (insertError) throw insertError;

      try {
        const { data: payData, error: payError } = await supabase.rpc('pay_for_package', {
          p_package_id: data.id
        });

        if (payError) throw payError;
        if (!payData.success) {
          // If it's just insufficient funds, we still want to go to the track page 
          // where they can see the "Top Up" prompt.
          if (payData.error === 'Insufficient funds') {
            navigate(`/track/${data.id}`);
            return;
          }
          throw new Error(payData.error);
        }

        navigate(`/track/${data.id}`);
      } catch (payErr) {
        // Payment failed but package was created. Go to tracking page so they can try again after topup.
        console.error('Payment failed after insertion:', payErr);
        navigate(`/track/${data.id}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to create package');
      setLoading(false);
    }
  };

  const getSuggestions = (val) => {
    if (!val || val.length < 2) return [];
    const searchVal = val.toLowerCase();
    return landmarks.filter(l => l.toLowerCase().includes(searchVal)).slice(0, 5);
  };

  return (
    <div className="min-h-screen bg-[#F4F4F5] pb-32">
      <header className="bg-white border-b border-[#E4E4E7] sticky top-0 z-50">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center gap-4">
          <button type="button" onClick={() => navigate('/dashboard')} className="p-2 -ml-2 text-[#52525B] hover:text-[#0A0A0A]">
            <ArrowLeft size={20} weight="bold" />
          </button>
          <h1 className="text-lg font-black tracking-tighter">Deliver Package</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit}>
          <Accordion 
            type="single" 
            collapsible 
            value={activeAccordion} 
            onValueChange={setActiveAccordion}
            className="space-y-4"
          >
            {/* Recipient */}
            <AccordionItem value="recipient" className="bg-white border border-[#E4E4E7] px-5 data-[state=open]:shadow-sm">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-2">
                  <User size={18} weight="bold" className={`${activeAccordion === 'recipient' ? 'text-[#002FA7]' : 'text-[#A1A1AA]'}`} />
                  <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">1. Recipient Information</h2>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-5 space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#52525B] mb-1 block">Full Name</label>
                  <Input 
                    value={formData.receiver_name}
                    onChange={(e) => handleChange('receiver_name', e.target.value)}
                    placeholder="e.g. Ngozi Okafor"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#52525B] mb-1 block">Phone Number</label>
                  <Input 
                    value={formData.receiver_phone}
                    onChange={(e) => handleChange('receiver_phone', e.target.value)}
                    placeholder="+234 801 234 5678"
                    type="tel"
                    required
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={(e) => { e.preventDefault(); nextSection('pickup'); }} className="bg-[#0A0A0A] text-white">Next: Pickup</Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Pickup */}
            <AccordionItem value="pickup" className="bg-white border border-[#E4E4E7] px-5 data-[state=open]:shadow-sm">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-2">
                    <NavigationArrow size={18} weight="bold" className={`${activeAccordion === 'pickup' ? 'text-[#00A859]' : 'text-[#A1A1AA]'}`} />
                    <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">2. Pickup Details</h2>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-5 space-y-4 relative">
                <div className="flex justify-end mb-2">
                  <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLocationAccess(); }}
                    className="text-[10px] uppercase font-bold text-[#002FA7] flex items-center gap-1 hover:underline"
                  >
                    {isLocating ? 'Locating...' : 'Use My Location'}
                  </button>
                </div>
                <div className="relative">
                  <label className="text-[10px] uppercase font-bold text-[#52525B] mb-1 block">Pickup Landmark</label>
                  <Input 
                    value={formData.pickup_landmark}
                    onChange={(e) => handleChange('pickup_landmark', e.target.value)}
                    onFocus={() => setActiveSearchField('pickup')}
                    placeholder="e.g. Shoprite, Ikeja Mall"
                    required
                  />
                  {activeSearchField === 'pickup' && getSuggestions(formData.pickup_landmark).length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-[#E4E4E7] shadow-xl mt-1">
                      {getSuggestions(formData.pickup_landmark).map(s => (
                        <button 
                          key={s}
                          type="button"
                          onClick={(e) => { e.preventDefault(); handleChange('pickup_landmark', s); setActiveSearchField(null); }}
                          className="w-full text-left px-4 py-3 hover:bg-[#F4F4F5] text-sm border-b last:border-0 border-[#E4E4E7]"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#52525B] mb-1 block">Full Address</label>
                  <Input 
                    value={formData.pickup_address}
                    onChange={(e) => handleChange('pickup_address', e.target.value)}
                    placeholder="e.g. 12 Allen Avenue, Ikeja"
                    required
                  />
                </div>
                <div className="flex justify-between pt-2">
                  <Button type="button" variant="outline" onClick={(e) => { e.preventDefault(); nextSection('recipient'); }} className="border-[#E4E4E7]">Back</Button>
                  <Button type="button" onClick={(e) => { e.preventDefault(); nextSection('dropoff'); }} className="bg-[#0A0A0A] text-white">Next: Drop-off</Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Dropoff */}
            <AccordionItem value="dropoff" className="bg-white border border-[#E4E4E7] px-5 data-[state=open]:shadow-sm">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-2">
                  <MapPin size={18} weight="bold" className={`${activeAccordion === 'dropoff' ? 'text-[#FF5B22]' : 'text-[#A1A1AA]'}`} />
                  <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">3. Drop-off Details</h2>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-5 space-y-4 relative">
                <div className="relative">
                  <label className="text-[10px] uppercase font-bold text-[#52525B] mb-1 block">Drop-off Landmark</label>
                  <Input 
                    value={formData.dropoff_landmark}
                    onChange={(e) => handleChange('dropoff_landmark', e.target.value)}
                    onFocus={() => setActiveSearchField('dropoff')}
                    placeholder="e.g. Chicken Republic, Lekki"
                    required
                  />
                  {activeSearchField === 'dropoff' && getSuggestions(formData.dropoff_landmark).length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-[#E4E4E7] shadow-xl mt-1">
                      {getSuggestions(formData.dropoff_landmark).map(s => (
                        <button 
                          key={s}
                          type="button"
                          onClick={(e) => { e.preventDefault(); handleChange('dropoff_landmark', s); setActiveSearchField(null); }}
                          className="w-full text-left px-4 py-3 hover:bg-[#F4F4F5] text-sm border-b last:border-0 border-[#E4E4E7]"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#52525B] mb-1 block">Full Address</label>
                  <Input 
                    value={formData.dropoff_address}
                    onChange={(e) => handleChange('dropoff_address', e.target.value)}
                    placeholder="e.g. 5 Admiralty Way, Lekki"
                    required
                  />
                </div>
                <div className="flex justify-between pt-2">
                  <Button type="button" variant="outline" onClick={(e) => { e.preventDefault(); nextSection('pickup'); }} className="border-[#E4E4E7]">Back</Button>
                  <Button type="button" onClick={(e) => { e.preventDefault(); nextSection('package'); }} className="bg-[#0A0A0A] text-white">Next: Package Info</Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Package Details */}
            <AccordionItem value="package" className="bg-white border border-[#E4E4E7] px-5 data-[state=open]:shadow-sm">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-2">
                  <Cube size={18} weight="bold" className={`${activeAccordion === 'package' ? 'text-[#0A0A0A]' : 'text-[#A1A1AA]'}`} />
                  <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">4. Package Info</h2>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-5 space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#52525B] mb-1 block">Item Description</label>
                  <Input 
                    value={formData.item_description}
                    onChange={(e) => handleChange('item_description', e.target.value)}
                    placeholder="What are you sending?"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#52525B] mb-1 block">Estimated Value (₦)</label>
                    <Input 
                      type="number"
                      value={formData.item_value}
                      onChange={(e) => handleChange('item_value', e.target.value)}
                      placeholder="e.g. 50000"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#52525B] mb-1 block">Size</label>
                    <select 
                      value={formData.package_size}
                      onChange={(e) => handleChange('package_size', e.target.value)}
                      className="w-full h-10 border border-[#E4E4E7] bg-white px-3 text-sm outline-none focus:border-[#0A0A0A]"
                    >
                      <option value="small">Small (Box size)</option>
                      <option value="medium">Medium (Large bag)</option>
                      <option value="large">Large (Multiple items)</option>
                      <option value="extra_large">Extra Large (Huge)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#52525B] mb-1 block">Extra Notes (Optional)</label>
                  <Input 
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    placeholder="e.g. Fragile, handle with care"
                  />
                </div>
                <div className="flex justify-start pt-2">
                  <Button type="button" variant="outline" onClick={(e) => { e.preventDefault(); nextSection('dropoff'); }} className="border-[#E4E4E7]">Back</Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {error && <p className="text-red-600 text-sm font-bold text-center mt-4">{error}</p>}
        </form>
      </main>

      {/* Footer Pricing & Submit */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E4E4E7] p-4 z-50">
        <div className="max-w-xl mx-auto">
          {priceInfo ? (
            <div className="flex items-center justify-between mb-4 px-2">
              <div>
                <p className="text-[10px] uppercase font-bold text-[#52525B]">Total Quote</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-black tracking-tighter text-[#0A0A0A]">
                    ₦{(priceInfo.total_price || priceInfo.price).toLocaleString()}
                  </p>
                  <p className={`text-[10px] font-bold ${walletBalance < (priceInfo.total_price || priceInfo.price) ? 'text-red-600' : 'text-[#00A859]'}`}>
                    Your Balance: ₦{Number(walletBalance).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-[#002FA7]">Distance</p>
                <p className="text-sm font-bold">{priceInfo.distance_km} km</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center mb-4 px-2">
              <p className="text-xs text-[#52525B] italic">Waiting for location details...</p>
              <p className="text-[10px] font-bold text-[#52525B]">Balance: ₦{Number(walletBalance).toLocaleString()}</p>
            </div>
          )}
          
          <Button 
            onClick={handleSubmit} 
            disabled={loading || (priceInfo && walletBalance < (priceInfo.total_price || priceInfo.price))}
            className="w-full h-14 bg-[#0A0A0A] text-white rounded-none text-lg font-black tracking-tighter hover:bg-[#0A0A0A]/90 transition-colors shadow-lg disabled:bg-[#E4E4E7] disabled:text-[#A1A1AA]"
          >
            {loading ? 'Processing...' : (priceInfo && walletBalance < (priceInfo.total_price || priceInfo.price)) ? 'Insufficient Balance' : 'Book Delivery Now'}
          </Button>
        </div>
      </footer>
    </div>
  );
}
