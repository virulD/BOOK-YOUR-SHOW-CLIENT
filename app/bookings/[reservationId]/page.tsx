'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = params.reservationId as string;
  const [reservation, setReservation] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [seats, setSeats] = useState<any[]>([]);
  const [seatAssignments, setSeatAssignments] = useState<Record<string, 'adult' | 'child'>>({});
  const [timeLeft, setTimeLeft] = useState(600);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const hasLoadedSavedAssignments = useRef(false);

  // Customer information state
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    billingEmail: '',
    billingAddress1: '',
    billingCity: '',
    billingCountry: 'Sri Lanka',
    billingPostCode: '',
    phoneNumber: '',
  });


  useEffect(() => {
    fetchReservation();
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [reservationId]);

  useEffect(() => {
    if (reservation?.expiresAt) {
      const expiresAt = new Date(reservation.expiresAt).getTime();
      const updateTimeLeft = () => {
        const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        setTimeLeft(remaining);
      };
      updateTimeLeft();
      const timer = setInterval(updateTimeLeft, 1000);
      return () => clearInterval(timer);
    }
  }, [reservation]);

  // Update tickets when seat assignments change (but not on initial mount, unless loaded from saved data)
  const isInitialMount = useRef(true);
  useEffect(() => {
    // Skip initial mount unless we loaded saved assignments from cart
    if (isInitialMount.current && !hasLoadedSavedAssignments.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Only update if we have reservation, not loading, and have seat assignments
    if (reservation && !loading && Object.keys(seatAssignments).length > 0) {
      handleUpdateTickets();
      // Reset the flag after first update from saved assignments
      if (hasLoadedSavedAssignments.current) {
        hasLoadedSavedAssignments.current = false;
      }
      // Mark that initial mount is done
      isInitialMount.current = false;
    }
  }, [seatAssignments, reservation, loading]);


  const fetchReservation = async () => {
    try {
      // First try to get from sessionStorage (if coming from event page)
      const cachedReservation = sessionStorage.getItem(`reservation_${reservationId}`);
      if (cachedReservation) {
        const parsed = JSON.parse(cachedReservation);
        setReservation(parsed);
        sessionStorage.removeItem(`reservation_${reservationId}`); // Clean up
      }
      
      // Always fetch from server to get latest data
      const response = await axios.get(`${API_URL}/bookings/${reservationId}`);
      setReservation(response.data);
      
      // Fetch event and seats data
      if (response.data.eventId) {
        try {
          const eventResponse = await axios.get(`${API_URL}/events/${response.data.eventId}`);
          setEvent(eventResponse.data);
          
          // Fetch seats to get ticket type information
          const seatsResponse = await axios.get(`${API_URL}/events/${response.data.eventId}/seats`);
          const allSeats = seatsResponse.data;
          const selectedSeats = allSeats.filter((s: any) => response.data.seatIds.includes(s._id));
          setSeats(selectedSeats);
          
          // Initialize seat assignments - check if we have saved assignments from cart, otherwise default to adult
          const savedAssignments = sessionStorage.getItem(`seatAssignments_${reservationId}`);
          let initialAssignments: Record<string, 'adult' | 'child'> = {};
          let hasSavedAssignments = false;
          
          if (savedAssignments) {
            try {
              const parsed = JSON.parse(savedAssignments);
              console.log('Loaded saved seat assignments from cart:', parsed);
              hasSavedAssignments = true;
              // Only use saved assignments if they match current seat IDs
              selectedSeats.forEach((seat: any) => {
                const seatId = String(seat._id);
                // Try both string and original format for compatibility
                initialAssignments[seatId] = parsed[seatId] || parsed[seat._id] || 'adult';
                initialAssignments[seat._id] = initialAssignments[seatId]; // Also store with original format
              });
              console.log('Initial assignments after loading saved data:', initialAssignments);
              // Keep seatAssignments in sessionStorage for payment page - only remove after payment is complete
            } catch (err) {
              console.error('Error parsing saved seat assignments:', err);
              // Fall back to default (all adult)
              selectedSeats.forEach((seat: any) => {
                initialAssignments[seat._id] = 'adult';
              });
            }
          } else {
            // Default all to adult
            selectedSeats.forEach((seat: any) => {
              initialAssignments[seat._id] = 'adult';
            });
          }
          setSeatAssignments(initialAssignments);
          
          // Mark that we loaded saved assignments so we can update tickets
          if (hasSavedAssignments && Object.keys(initialAssignments).length > 0) {
            hasLoadedSavedAssignments.current = true;
          }
        } catch (err) {
          console.error('Error fetching event/seats:', err);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reservation:', error);
      alert('Error loading reservation. Please try again.');
      setLoading(false);
    }
  };

  const handleUpdateTickets = async () => {
    try {
      // Use per-seat assignments
      const payload: any = {
        seatAssignments: Object.entries(seatAssignments).map(([seatId, ticketType]) => ({
          seatId,
          ticketType,
        })),
      };
      
      const response = await axios.put(
        `${API_URL}/bookings/${reservationId}/tickets`,
        payload,
      );
      setReservation((prev: any) => ({
        ...prev,
        amountEstimate: response.data.amountSummary,
      }));
    } catch (error) {
      console.error('Error updating tickets:', error);
      alert('Error updating ticket counts');
    }
  };

  const toggleSeatTicketType = (seatId: string) => {
    setSeatAssignments(prev => ({
      ...prev,
      [seatId]: prev[seatId] === 'adult' ? 'child' : 'adult',
    }));
  };

  const handlePayment = async () => {
    if (processing) return;
    
    setProcessing(true);
    try {
    // Save seat assignments to sessionStorage for payment page
    // Normalize seat IDs to strings for consistency
    const normalizedAssignments: Record<string, 'adult' | 'child'> = {};
    Object.entries(seatAssignments).forEach(([seatId, type]) => {
      normalizedAssignments[String(seatId)] = type;
    });
    console.log('Booking page - Saving seat assignments before payment:', normalizedAssignments);
    sessionStorage.setItem(
      `seatAssignments_${reservationId}`,
      JSON.stringify(normalizedAssignments),
    );

      // Validate customer information
      if (!customerInfo.name || !customerInfo.email || !customerInfo.phoneNumber) {
        alert('Please fill in your name, email address, and phone number');
        setProcessing(false);
        return;
      }

      // Create payment intent with Dialog Genie - send customer info in request body
      const paymentPayload: any = {};
      if (customerInfo.name && customerInfo.email) {
        paymentPayload.customer = {
          name: customerInfo.name,
          email: customerInfo.email,
          billingEmail: customerInfo.billingEmail || customerInfo.email,
          billingAddress1: customerInfo.billingAddress1 || '',
          billingCity: customerInfo.billingCity || '',
          billingCountry: customerInfo.billingCountry || 'Sri Lanka',
          billingPostCode: customerInfo.billingPostCode || '',
          phoneNumber: customerInfo.phoneNumber,
        };
      }
      
      console.log('Sending payment intent with payload:', paymentPayload);
      const response = await axios.post(`${API_URL}/payments/intent/${reservationId}`, paymentPayload);
      
      if (response.data.paymentUrl) {
        // Redirect to Dialog Genie payment page
        window.location.href = response.data.paymentUrl;
      } else {
        alert('Payment initialization failed. Please try again.');
        setProcessing(false);
      }
    } catch (error: any) {
      console.error('Error initiating payment:', error);
      alert(error.response?.data?.message || 'Failed to initiate payment. Please try again.');
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading booking...</div>;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const amountSummary = reservation?.amountEstimate || {
    subtotal: 0,
    commission: 0,
    taxes: 0,
    total: 0,
  };

  const getSeatPrice = (seat: any) => {
    if (!seat) return 0;
    const isChild = seatAssignments[seat._id] === 'child';
    const ticketType = seat.ticketType;
    
    if (ticketType && event?.ticketTypes) {
      const ticketTypeInfo = event.ticketTypes.find((tt: any) => tt.name === ticketType);
      if (ticketTypeInfo) {
        return isChild ? ticketTypeInfo.childPrice : ticketTypeInfo.adultPrice;
      }
    }
    
    const basePrice = seat.basePrice && seat.basePrice > 0 ? seat.basePrice : (event?.defaultPrice || 0);
    return basePrice; // Use same price for both adult and child if no ticket type
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold mb-2 text-slate-800">Complete Your Booking</h1>
          <p className="text-slate-600">Review your seats and finish the payment.</p>
        </div>

        {/* Timer */}
        <div className="mb-6">
          {timeLeft > 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 flex items-center justify-center gap-2">
                <span className="text-lg">⏱️</span>
                Time remaining: <span className="font-bold text-amber-900">{formatTime(timeLeft)}</span>
              </p>
            </div>
          ) : (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="text-sm text-rose-800 flex items-center justify-center gap-2">
                <span className="text-lg">⚠️</span>
                Reservation expired
              </p>
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Your Cart</h2>
              <span className="text-sm text-slate-500">{seats.length} seat(s)</span>
            </div>

            <div className="space-y-4 mb-5">
              {seats.length === 0 ? (
                <p className="text-sm text-slate-500">Seat details will appear once loaded.</p>
              ) : (
                seats.map((seat) => {
                  const isChild = seatAssignments[seat._id] === 'child';
                  return (
                    <div
                      key={seat._id}
                      className={`border-2 rounded-lg p-3 ${
                        isChild ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-slate-700">{seat.label || 'Seat'}</span>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              isChild
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-600 text-white'
                            }`}>
                              {isChild ? '👶 Child' : '👤 Adult'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap gap-2">
                            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-full">
                              {seat.ticketType || 'Standard'}
                            </span>
                            {seat.section && (
                              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-full">
                                {seat.section}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-indigo-600 font-semibold">
                            LKR {getSeatPrice(seat).toFixed(2)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {isChild ? 'Child' : 'Adult'} Price
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-2 text-sm text-slate-600 mb-5">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>LKR {amountSummary.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Commission</span>
                <span>LKR {amountSummary.commission.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxes</span>
                <span>LKR {amountSummary.taxes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-indigo-600 pt-2 border-t border-slate-200">
                <span>Total</span>
                <span>LKR {amountSummary.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Customer Information Form */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Customer Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value, billingEmail: customerInfo.billingEmail || e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="your.email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerInfo.phoneNumber}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="+94 77 123 4567"
                  />
                  <p className="text-xs text-slate-500 mt-1">We'll send booking confirmation to this number</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={customerInfo.billingEmail}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, billingEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="billing.email@example.com (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Billing Address
                  </label>
                  <input
                    type="text"
                    value={customerInfo.billingAddress1}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, billingAddress1: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Street address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={customerInfo.billingCity}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, billingCity: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={customerInfo.billingPostCode}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, billingPostCode: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Postal code"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={customerInfo.billingCountry}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, billingCountry: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handlePayment}
              disabled={processing || timeLeft === 0 || !customerInfo.name || !customerInfo.email || !customerInfo.phoneNumber}
              className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 font-semibold text-base"
            >
              {processing ? 'Processing Payment...' : 'Proceed to Payment'}
            </button>
            {timeLeft === 0 && (
              <p className="text-xs text-center text-rose-500 mt-2">
                Reservation expired. Please restart the booking process.
              </p>
            )}
        </div>
      </div>
    </div>
  );
}


