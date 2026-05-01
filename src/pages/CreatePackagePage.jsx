import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, PaperPlaneTilt, Package as PackageIcon, MapPin, Phone, User, Cube, NotePencil, NavigationArrow } from '@phosphor-icons/react';

const STEPS = [
  { key: 'receiver_name', label: "What's the receiver's name?", icon: User, placeholder: 'e.g. Ngozi Okafor' },
  { key: 'receiver_phone', label: "Receiver's phone number?", icon: Phone, placeholder: '+234 801 234 5678' },
  { key: 'pickup_landmark', label: 'Pickup landmark?', icon: MapPin, placeholder: 'e.g. Shoprite, Ikeja City Mall' },
  { key: 'pickup_address', label: 'Full pickup address?', icon: MapPin, placeholder: 'e.g. 12 Allen Avenue, Ikeja, Lagos' },
  { key: 'dropoff_landmark', label: 'Drop-off landmark?', icon: MapPin, placeholder: 'e.g. Chicken Republic, Lekki Phase 1' },
  { key: 'dropoff_address', label: 'Full drop-off address?', icon: MapPin, placeholder: 'e.g. 5 Admiralty Way, Lekki, Lagos' },
  { key: 'item_description', label: 'What are you sending?', icon: Cube, placeholder: 'e.g. Laptop bag with accessories' },
  { key: 'item_value', label: 'What is the estimated value of the item in Naira? (for insurance)', icon: NotePencil, type: 'number', placeholder: 'e.g. 50000' },
  { key: 'package_size', label: 'Package size?', icon: PackageIcon, type: 'select', options: ['small', 'medium', 'large', 'extra_large'] },
  { key: 'notes', label: 'Any special notes? (optional)', icon: NotePencil, placeholder: 'e.g. Handle with care, fragile items' },
];

const SIZE_LABELS = { small: 'Small', medium: 'Medium', large: 'Large', extra_large: 'Extra Large' };

export default function CreatePackagePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [inputVal, setInputVal] = useState('');
  const [priceInfo, setPriceInfo] = useState(null);
  const [messages, setMessages] = useState([
    { from: 'system', text: "Let's create your delivery. I'll guide you step by step." }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Calculate price when we have pickup, dropoff, and size
  useEffect(() => {
    const calcPrice = async () => {
      const pickup = formData.pickup_landmark;
      const dropoff = formData.dropoff_landmark;
      const size = formData.package_size;
      if (!pickup || !dropoff || !size) return;
      try {
        const { data, error: rpcError } = await supabase.rpc('get_delivery_quote', {
          p_pickup_landmark: pickup,
          p_dropoff_landmark: dropoff,
          p_package_size: size,
          p_item_value: Number(formData.item_value) || 0
        });
        if (rpcError) throw rpcError;
        setPriceInfo(data);
      } catch (err) {
        console.error('Price calculation failed:', err);
      }
    };
    calcPrice();
  }, [formData.pickup_landmark, formData.dropoff_landmark, formData.package_size, formData.item_value]);

  const currentStep = STEPS[step];
  const isComplete = step >= STEPS.length;

  const handleSend = () => {
    if (!inputVal.trim() && currentStep?.key !== 'notes') return;
    const val = inputVal.trim();
    const newFormData = { ...formData, [currentStep.key]: val || '' };
    setFormData(newFormData);

    setMessages(prev => [
      ...prev,
      { from: 'user', text: val || '(skipped)' },
    ]);

    const nextStep = step + 1;
    setInputVal('');

    if (nextStep < STEPS.length) {
      setStep(nextStep);
      setTimeout(() => {
        setMessages(prev => [...prev, { from: 'system', text: STEPS[nextStep].label }]);
      }, 300);
    } else {
      setStep(nextStep);
      setTimeout(() => {
        setMessages(prev => [...prev, {
          from: 'system',
          text: `Package summary:\n📦 ${newFormData.item_description}\n📍 ${newFormData.pickup_landmark} → ${newFormData.dropoff_landmark}\n👤 To: ${newFormData.receiver_name}\n\nPrice will be calculated based on distance.\nReady to send?`
        }]);
      }, 300);
    }
  };

  const handleSizeSelect = (size) => {
    setInputVal(size);
    const newFormData = { ...formData, package_size: size };
    setFormData(newFormData);

    setMessages(prev => [
      ...prev,
      { from: 'user', text: SIZE_LABELS[size] || size }
    ]);

    const nextStep = step + 1;
    setStep(nextStep);

    if (nextStep < STEPS.length) {
      setTimeout(() => {
        setMessages(prev => [...prev, { from: 'system', text: STEPS[nextStep].label }]);
      }, 300);
    } else {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          from: 'system',
          text: `All set! Review and confirm.`
        }]);
      }, 300);
    }
    setInputVal('');
  };

  const handleConfirmSend = async () => {
    if (!user) return;
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

      // Automatically pay for the package
      const { data: payData, error: payError } = await supabase.rpc('pay_for_package', {
        p_package_id: data.id
      });

      if (payError) throw payError;
      if (!payData.success) throw new Error(payData.error);

      setMessages(prev => [
        ...prev, 
        { from: 'system', text: `Confirmed! Payment of ₦${pkgToInsert.price.toLocaleString()} authorized.` },
        { from: 'system', text: `Searching for a rider... Your tracking ID is ${data.id.split('-')[0].toUpperCase()}.` },
        { from: 'system', text: `Delivery PIN: ${payData.otp}\nShare this with the receiver! The rider will need it to complete the delivery.` }
      ]);
      
      setTimeout(() => navigate(`/track/${data.id}`), 2000);
    } catch (err) {
      setError(err.message || 'Failed to create package');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isComplete) handleSend();
  };

  const [landmarks, setLandmarks] = useState([]);
  const [isLocating, setIsLocating] = useState(false);

  // Fetch available landmarks from database on load
  useEffect(() => {
    const fetchLandmarks = async () => {
      const { data } = await supabase.from('landmarks').select('name');
      if (data) setLandmarks(data.map(l => l.name));
    };
    fetchLandmarks();
  }, []);

  const getSuggestions = () => {
    if (!currentStep?.key.includes('landmark') && !currentStep?.key.includes('address')) return [];
    if (!inputVal.trim()) return [];
    const val = inputVal.toLowerCase();
    return landmarks.filter(l => l.toLowerCase().includes(val) && l.toLowerCase() !== val).slice(0, 5);
  };

  const suggestions = getSuggestions();
  const isLocationStep = currentStep?.key.includes('landmark') || currentStep?.key.includes('address');

  const handleLocationAccess = () => {
    if (!navigator.geolocation) {
      setError("Location services are not supported by this browser.");
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Free reverse geocoding via OpenStreetMap 
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (!res.ok) throw new Error("Failed to resolve address");
          
          const data = await res.json();
          // Extract a clean readable address
          const address = data.address?.road 
            ? `${data.address.road}, ${data.address.city || data.address.town || data.address.suburb || ''}`.trim().replace(/,\s*$/, '')
            : data.display_name.split(',').slice(0, 3).join(',');
            
          setInputVal(address);
          setError("");
        } catch (err) {
          setError("Could not turn coordinates into an address.");
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setError("Location permission denied. Please enable it in your browser.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-[#E4E4E7] sticky top-0 bg-white z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button data-testid="back-to-dashboard" onClick={() => navigate('/dashboard')} className="text-[#52525B] hover:text-[#0A0A0A] transition-colors">
            <ArrowLeft size={20} weight="bold" />
          </button>
          <span className="text-sm font-semibold text-[#0A0A0A]">New Delivery</span>
          <span className="ml-auto text-xs text-[#52525B]">{Math.min(step + 1, STEPS.length)}/{STEPS.length}</span>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-[#E4E4E7]">
          <div
            className="h-full bg-[#0A0A0A] transition-all duration-300"
            style={{ width: `${(Math.min(step, STEPS.length) / STEPS.length) * 100}%` }}
          />
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-4 py-3 text-sm whitespace-pre-line ${
                  msg.from === 'user'
                    ? 'bg-[#0A0A0A] text-white'
                    : 'bg-[#F4F4F5] text-[#0A0A0A] border border-[#E4E4E7]'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[#E4E4E7] bg-white sticky bottom-0 relative">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
          
          {!isComplete && isLocationStep && (suggestions.length > 0 || !inputVal) && (
            <div className="absolute bottom-full left-0 w-full px-4 pb-2 z-50">
              <div className="max-w-2xl mx-auto bg-white border border-[#E4E4E7] shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] rounded-md overflow-hidden">
                
                {/* Uber-style location access button always shown for location steps when typing starts (or when empty if we want, but let's show it always when the popover is active) */}
                <button
                  onClick={handleLocationAccess}
                  disabled={isLocating}
                  className="w-full text-left px-4 py-3 hover:bg-[#F4F4F5] flex items-center gap-4 transition-colors border-b border-[#E4E4E7] bg-white"
                >
                  <div className="w-8 h-8 rounded-full bg-[#0A0A0A] flex items-center justify-center shrink-0">
                    <NavigationArrow size={16} weight="bold" className="text-white" />
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold text-[#0A0A0A]">
                      {isLocating ? 'Locating you...' : 'Allow location access'}
                    </div>
                    <div className="text-[13px] text-[#52525B]">It provides your pickup address</div>
                  </div>
                </button>

                {suggestions.length > 0 && (
                  <>
                    <p className="text-[11px] uppercase font-bold text-[#52525B] px-4 py-2 bg-[#F4F4F5] border-b border-[#E4E4E7]">
                      Database Suggestions
                    </p>
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setInputVal(suggestion);
                          handleSend(); // Auto send on click
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-[#F4F4F5] flex items-center gap-4 capitalize transition-colors bg-white border-b border-[#E4E4E7] last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#F4F4F5] flex items-center justify-center shrink-0 border border-[#E4E4E7]">
                          <MapPin size={16} weight="fill" className="text-[#0A0A0A]" />
                        </div>
                        <div className="text-[15px] font-medium text-[#0A0A0A]">{suggestion}</div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {!isComplete && currentStep?.type === 'select' ? (
            <div className="grid grid-cols-2 gap-2">
              {currentStep.options.map(opt => (
                <button
                  key={opt}
                  data-testid={`size-option-${opt}`}
                  onClick={() => handleSizeSelect(opt)}
                  className="border border-[#E4E4E7] px-4 py-3 text-sm font-medium text-left hover:border-[#0A0A0A] hover:bg-[#F4F4F5] transition-colors"
                >
                  {SIZE_LABELS[opt] || opt}
                </button>
              ))}
            </div>
          ) : !isComplete ? (
            <div className="flex gap-2 relative">
              <Input
                data-testid={`chat-input-${currentStep?.key}`}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentStep?.placeholder || 'Type here...'}
                className="flex-1 border border-[#E4E4E7] rounded-none h-12 outline-none focus-visible:ring-1 focus-visible:ring-[#0A0A0A]"
                autoFocus
              />
              <Button
                data-testid="chat-send-button"
                onClick={handleSend}
                className="h-12 px-5 bg-[#0A0A0A] text-white rounded-sm hover:bg-[#0A0A0A]/90"
              >
                <PaperPlaneTilt size={18} weight="bold" />
              </Button>
            </div>
          ) : (
            <div>
              {/* Price Breakdown */}
              {priceInfo && (
                <div data-testid="price-breakdown" className="border border-[#E4E4E7] p-3 mb-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#52525B]">Distance</span>
                    <span className="font-medium flex items-center gap-1">
                      <NavigationArrow size={12} weight="bold" className="text-[#002FA7]" />
                      {priceInfo.distance_km} km
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#52525B]">Base ({formData.package_size})</span>
                    <span className="font-medium">₦{priceInfo.breakdown?.base_price?.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#52525B]">Distance charge</span>
                    <span className="font-medium">₦{priceInfo.breakdown?.distance_charge?.toLocaleString()}</span>
                  </div>
                  {priceInfo.insurance_fee > 0 && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[#52525B]">Insurance (1%)</span>
                      <span className="font-medium text-[#00A859]">₦{priceInfo.insurance_fee?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-[#E4E4E7]">
                    <span className="font-bold text-[#0A0A0A]">Total</span>
                    <span className="font-black text-lg text-[#0A0A0A]">₦{(priceInfo.total_price || priceInfo.price)?.toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  data-testid="confirm-send-package"
                  onClick={handleConfirmSend}
                  disabled={loading}
                  className="flex-1 h-12 bg-[#00A859] text-white rounded-sm text-base font-semibold hover:bg-[#00A859]/90"
                >
                  {loading ? 'Creating...' : `Confirm & Send${priceInfo ? ` — ₦${priceInfo.price?.toLocaleString()}` : ''}`}
                </Button>
                <Button
                  data-testid="cancel-package"
                  onClick={() => navigate('/dashboard')}
                  variant="outline"
                  className="h-12 px-5 rounded-sm border-[#E4E4E7]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

