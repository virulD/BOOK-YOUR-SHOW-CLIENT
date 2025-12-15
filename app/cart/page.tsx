'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface CartPayload {
  eventId: string;
  seatIds: string[];
  seats?: any[];
  eventSummary?: {
    title?: string;
    venue?: string;
    date?: string;
    posterImageUrl?: string | null;
    defaultPrice?: number;
    ticketTypes?: any[];
  };
  createdAt: number;
}

export default function CartPage() {
  const router = useRouter();
  const [cartData, setCartData] = useState<CartPayload | null>(null);
  const [event, setEvent] = useState<any>(null);
  const [seatDetails, setSeatDetails] = useState<any[]>([]);
  const [seatAssignments, setSeatAssignments] = useState<Record<string, 'adult' | 'child'>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem('cartSelection') : null;
    if (!stored) {
      setLoading(false);
      setError('Your cart is empty. Please select seats from an event.');
      return;
    }

    try {
      const parsed: CartPayload = JSON.parse(stored);
      setCartData(parsed);
      
      // Initialize seat assignments early if we have seats in cartData
      if (parsed.seats && parsed.seats.length > 0) {
        const earlyAssignments: Record<string, 'adult' | 'child'> = {};
        parsed.seats.forEach((seat: any) => {
          if (seat._id) {
            earlyAssignments[seat._id] = 'adult';
          }
        });
        if (Object.keys(earlyAssignments).length > 0) {
          setSeatAssignments(earlyAssignments);
        }
      }
    } catch (err) {
      console.error('Failed to parse cart data', err);
      setError('Unable to load cart. Please reselect your seats.');
    }
  }, []);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!cartData?.eventId) {
        setLoading(false);
        return;
      }
      try {
        const [eventResponse, seatsResponse] = await Promise.all([
          axios.get(`${API_URL}/events/${cartData.eventId}`),
          axios.get(`${API_URL}/events/${cartData.eventId}/seats`),
        ]);
        setEvent(eventResponse.data);
        const selectedSeats = seatsResponse.data.filter((seat: any) =>
          cartData.seatIds.includes(seat._id),
        );
        const finalSeats = selectedSeats.length > 0 ? selectedSeats : cartData.seats || [];
        setSeatDetails(finalSeats);
        
        // Initialize or update seat assignments (default all to adult, preserve existing if any)
        setSeatAssignments(prev => {
          const updatedAssignments: Record<string, 'adult' | 'child'> = { ...prev };
          finalSeats.forEach((seat: any) => {
            if (seat._id && !updatedAssignments[seat._id]) {
              updatedAssignments[seat._id] = 'adult';
            }
          });
          return updatedAssignments;
        });
      } catch (err) {
        console.error('Error fetching cart details', err);
        setError('Unable to load event or seat information. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (cartData) {
      fetchDetails();
    }
  }, [cartData]);

  const ticketTypeMap = useMemo(() => {
    const map = new Map<string, { adultPrice: number; childPrice: number }>();
    const ticketTypes = event?.ticketTypes || cartData?.eventSummary?.ticketTypes || [];
    ticketTypes.forEach((tt: any) => {
      if (tt?.name && typeof tt?.adultPrice === 'number' && typeof tt?.childPrice === 'number') {
        map.set(tt.name, { adultPrice: tt.adultPrice, childPrice: tt.childPrice });
      }
    });
    return map;
  }, [event, cartData]);

  const getSeatPrice = (seat: any) => {
    if (!seat) return 0;
    const isChild = seatAssignments[seat._id] === 'child';
    const ticketTypePrices = seat.ticketType ? ticketTypeMap.get(seat.ticketType) : undefined;
    
    if (ticketTypePrices) {
      return isChild ? ticketTypePrices.childPrice : ticketTypePrices.adultPrice;
    }
    
    const basePrice = seat.basePrice && seat.basePrice > 0 
      ? seat.basePrice 
      : (event?.defaultPrice || cartData?.eventSummary?.defaultPrice || 0);
    
    return basePrice; // Use same price for both adult and child if no ticket type
  };

  const toggleSeatTicketType = (seatId: string) => {
    setSeatAssignments(prev => ({
      ...prev,
      [seatId]: prev[seatId] === 'adult' ? 'child' : 'adult',
    }));
  };

  const subtotal = seatDetails.reduce((sum, seat) => sum + getSeatPrice(seat), 0);

  const handleClearCart = () => {
    sessionStorage.removeItem('cartSelection');
    setCartData(null);
    setSeatDetails([]);
    setError('Your cart is empty. Please select seats from an event.');
  };

  const handleProceed = async () => {
    if (!cartData || cartData.seatIds.length === 0) {
      alert('Your cart is empty.');
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/bookings/create`, {
        eventId: String(cartData.eventId),
        seatIds: cartData.seatIds,
        holdSeconds: 600,
      });

      // Store seat assignments for the booking page to use
      console.log('Saving seat assignments to sessionStorage:', seatAssignments);
      sessionStorage.setItem(
        `seatAssignments_${response.data.reservationId}`,
        JSON.stringify(seatAssignments),
      );

      sessionStorage.setItem(
        `reservation_${response.data.reservationId}`,
        JSON.stringify(response.data),
      );
      sessionStorage.removeItem('cartSelection');
      router.push(`/bookings/${response.data.reservationId}`);
    } catch (error: any) {
      console.error('Error creating reservation from cart:', error);
      const apiMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        (Array.isArray(error.response?.data) ? error.response.data.join(', ') : null) ||
        error.message ||
        'Error creating reservation. Please try again.';
      setError(apiMessage);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading cart...</div>;
  }

  if (!cartData || cartData.seatIds.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
        <div className="bg-white rounded-xl shadow p-8 text-center max-w-md">
          <p className="text-slate-700 mb-4">{error || 'Your cart is empty.'}</p>
          <button
            onClick={() => router.push('/user')}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            Browse Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-1">Your Cart</h1>
            <p className="text-slate-600">
              Review your selected seats before proceeding to payment.
            </p>
          </div>
          <button
            onClick={handleClearCart}
            className="text-sm text-rose-600 hover:text-rose-700 font-medium"
          >
            Clear cart
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6 space-y-6">
            {event && (
              <div className="flex flex-col sm:flex-row gap-4">
                {event.posterImageUrl && (
                  <img
                    src={event.posterImageUrl}
                    alt={event.title}
                    className="w-full sm:w-40 h-40 object-cover rounded-lg border border-slate-200"
                  />
                )}
                <div>
                  <h2 className="text-2xl font-semibold text-slate-800 mb-2">{event.title}</h2>
                  <p className="text-slate-600 mb-2">{event.description}</p>
                  <div className="text-sm text-slate-500 space-y-1">
                    <p className="flex items-center gap-2">
                      <span className="text-indigo-500">📍</span>
                      {event.venue?.name}
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-indigo-500">📅</span>
                      {event.startAt ? new Date(event.startAt).toLocaleString() : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Seats ({seatDetails.length})
              </h3>
              <div className="space-y-3">
                {seatDetails.map((seat) => {
                  const isChild = seatAssignments[seat._id] === 'child';
                  return (
                    <div
                      key={seat._id}
                      className={`border-2 rounded-lg p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 ${
                        isChild ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-slate-800">{seat.label || 'Seat'}</p>
                          <button
                            onClick={() => toggleSeatTicketType(seat._id)}
                            className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                              isChild
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-slate-600 text-white hover:bg-slate-700'
                            }`}
                            title={`Click to toggle between ${isChild ? 'Adult' : 'Child'} ticket`}
                          >
                            {isChild ? '👶 Child' : '👤 Adult'}
                          </button>
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap gap-2 mt-1">
                          <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-full">
                            {seat.ticketType || 'Standard'}
                          </span>
                          {seat.row && (
                            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-full">
                              Row {seat.row}
                            </span>
                          )}
                          {seat.section && (
                            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-full">
                              {seat.section}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-indigo-600 font-semibold">
                          LKR {getSeatPrice(seat).toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {isChild ? 'Child' : 'Adult'} Price
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="bg-white rounded-xl shadow-lg border border-slate-100 p-6 space-y-4 h-fit">
            <h3 className="text-lg font-semibold text-slate-800">Order Summary</h3>
            <div className="flex justify-between text-slate-600">
              <span>Seats</span>
              <span>{seatDetails.length}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>LKR {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Fees & Taxes</span>
              <span>Calculated at booking</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between text-lg font-semibold text-indigo-600">
              <span>Estimated Total</span>
              <span>LKR {subtotal.toFixed(2)}</span>
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button
              onClick={handleProceed}
              disabled={processing}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
            >
              {processing ? 'Processing...' : 'Proceed to Payment'}
            </button>

            <button
              onClick={() => router.back()}
              className="w-full text-slate-600 border border-slate-300 rounded-lg px-4 py-3 hover:bg-slate-50 transition"
            >
              Modify Selection
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

