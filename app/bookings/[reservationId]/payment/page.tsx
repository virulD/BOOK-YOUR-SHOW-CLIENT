'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = params.reservationId as string;
  
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [seats, setSeats] = useState<any[]>([]);
  const [seatAssignments, setSeatAssignments] = useState<Record<string, 'adult' | 'child'>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservation();
  }, [reservationId]);

  const fetchReservation = async () => {
    try {
      const response = await axios.get(`${API_URL}/bookings/${reservationId}`);
      setReservation(response.data);
      
      // Fetch event and seats data
      if (response.data.eventId) {
        try {
          const [eventResponse, seatsResponse] = await Promise.all([
            axios.get(`${API_URL}/events/${response.data.eventId}`),
            axios.get(`${API_URL}/events/${response.data.eventId}/seats`),
          ]);
          setEvent(eventResponse.data);
          const allSeats = seatsResponse.data;
          const selectedSeats = allSeats.filter((s: any) => response.data.seatIds.includes(s._id));
          setSeats(selectedSeats);
          
          // Load seat assignments from sessionStorage
          const savedAssignments = sessionStorage.getItem(`seatAssignments_${reservationId}`);
          let assignments: Record<string, 'adult' | 'child'> = {};
          
          console.log('Payment page - Loading seat assignments from sessionStorage:', savedAssignments);
          
          if (savedAssignments) {
            try {
              const parsed = JSON.parse(savedAssignments);
              console.log('Payment page - Parsed assignments:', parsed);
              console.log('Payment page - Selected seats:', selectedSeats.map((s: any) => ({ id: s._id, label: s.label })));
              
              selectedSeats.forEach((seat: any) => {
                const seatId = String(seat._id);
                // Try both string and original format
                assignments[seatId] = parsed[seatId] || parsed[seat._id] || 'adult';
                // Also set with original format for compatibility
                assignments[seat._id] = assignments[seatId];
                console.log(`Payment page - Seat ${seat.label} (${seatId}): ${assignments[seatId]}`);
              });
              console.log('Payment page - Final assignments:', assignments);
            } catch (err) {
              console.error('Error parsing saved seat assignments:', err);
              selectedSeats.forEach((seat: any) => {
                assignments[seat._id] = 'adult';
              });
            }
          } else {
            console.log('Payment page - No saved assignments found, defaulting to adult');
            // Default all to adult if no saved assignments
            selectedSeats.forEach((seat: any) => {
              assignments[seat._id] = 'adult';
            });
          }
          
          // Debug: Log before setting state
          console.log('Payment page - Setting seatAssignments state:', assignments);
          setSeatAssignments(assignments);
          
          // Debug: Verify state was set
          setTimeout(() => {
            console.log('Payment page - seatAssignments after state update:', assignments);
          }, 100);
        } catch (err) {
          console.error('Error fetching event/seats:', err);
        }
      }
    } catch (error) {
      console.error('Error fetching reservation:', error);
      setError('Failed to load reservation details');
    } finally {
      setLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '');
    // Add spaces every 4 digits
    return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiryDate = (value: string) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '');
    // Add slash after 2 digits
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, '').length <= 16) {
      setCardNumber(formatted);
    }
  };

  const handleExpiryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    if (formatted.replace(/\D/g, '').length <= 4) {
      setExpiryDate(formatted);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '');
    if (cleaned.length <= 4) {
      setCvv(cleaned);
    }
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '');
    if (cleaned.length <= 15) {
      setPhoneNumber(cleaned);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProcessing(true);

    try {
      // Process dummy payment
      await axios.post(`${API_URL}/payments/process/${reservationId}`, {
        cardNumber: cardNumber.replace(/\s/g, ''),
        expiryDate,
        cvv,
        phoneNumber: phoneNumber.trim(),
      });

      // Redirect to success page
      router.push(`/bookings/${reservationId}/success`);
    } catch (error: any) {
      console.error('Payment error:', error);
      setError(
        error.response?.data?.message || 
        'Payment processing failed. Please check your card details and try again.'
      );
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-slate-600">Loading payment form...</div>
      </div>
    );
  }

  const amountSummary = reservation?.amountEstimate || {
    subtotal: 0,
    commission: 0,
    taxes: 0,
    total: 0,
  };

  const getSeatPrice = (seat: any) => {
    if (!seat) return 0;
    const seatId = String(seat._id);
    const isChild = seatAssignments[seatId] === 'child' || seatAssignments[seat._id] === 'child';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 border border-slate-100">
          <h1 className="text-3xl font-bold mb-2 text-slate-800">Payment</h1>
          <p className="text-slate-600 mb-6">
            Enter your payment details to complete your booking
          </p>

          {/* Seat Details */}
          {seats.length > 0 && (
            <div className="mb-8 p-5 bg-slate-50 rounded-xl border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 text-slate-800">Your Seats</h2>
              <div className="space-y-3 mb-4">
                {seats.map((seat) => {
                  // Ensure we're using the correct seat ID format (handle both string and ObjectId)
                  const seatId = String(seat._id);
                  const isChild = seatAssignments[seatId] === 'child' || seatAssignments[seat._id] === 'child';
                  const assignment = seatAssignments[seatId] || seatAssignments[seat._id] || 'adult';
                  return (
                    <div
                      key={seat._id}
                      className={`border-2 rounded-lg p-3 ${
                        isChild ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
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
                })}
              </div>
            </div>
          )}

          {/* Payment Summary */}
          <div className="mb-8 p-5 bg-slate-50 rounded-xl border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 text-slate-800">Payment Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-slate-700">
                <span>Subtotal:</span>
                <span className="font-medium">LKR {amountSummary.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Commission:</span>
                <span>LKR {amountSummary.commission.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxes:</span>
                <span>LKR {amountSummary.taxes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-xl pt-3 border-t border-slate-300 text-indigo-600">
                <span>Total:</span>
                <span>LKR {amountSummary.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Dummy Payment Info */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>💳 Dummy Payment Gateway:</strong> Use any card number starting with 3, 4, or 5 (16 digits), 
              a future expiry date (MM/YY), and any 3-4 digit CVV. Example: 4242 4242 4242 4242, 12/25, 123
            </p>
          </div>

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-sm text-rose-800">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">
                Cardholder Name
              </label>
              <input
                type="text"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">
                Phone Number <span className="text-slate-500 text-xs">(for booking confirmation SMS)</span>
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="0771234567"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">
                Card Number
              </label>
              <input
                type="text"
                value={cardNumber}
                onChange={handleCardNumberChange}
                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono text-lg tracking-wider"
                placeholder="4242 4242 4242 4242"
                maxLength={19}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">
                  Expiry Date
                </label>
                <input
                  type="text"
                  value={expiryDate}
                  onChange={handleExpiryDateChange}
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                  placeholder="MM/YY"
                  maxLength={5}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">
                  CVV
                </label>
                <input
                  type="text"
                  value={cvv}
                  onChange={handleCvvChange}
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                  placeholder="123"
                  maxLength={4}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={processing}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 font-semibold text-lg"
            >
              {processing ? 'Processing Payment...' : `Pay LKR ${amountSummary.total.toFixed(2)}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

