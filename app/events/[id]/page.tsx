'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface Seat {
  _id: string;
  label: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  state: 'available' | 'payment_pending' | 'booked' | 'broken' | 'aisle' | 'blocked';
  seatType?: 'regular' | 'vip' | 'accessible';
  ticketType?: string; // Ticket type name (e.g., "VVIP", "VIP", "Balcony")
  basePrice?: number;
  section?: string;
  row?: string;
  number?: number;
}

export default function EventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const [event, setEvent] = useState<any>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchEvent();
    fetchSeats();
    
    // Start polling for seat availability updates every 3 seconds
    // This ensures seat colors update after payment callbacks
    pollingIntervalRef.current = setInterval(() => {
      fetchSeats();
    }, 3000);

    return () => {
      // Cleanup polling on unmount
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const response = await axios.get(`${API_URL}/events/${eventId}`);
      setEvent(response.data);
    } catch (error) {
      console.error('Error fetching event:', error);
    }
  };

  // Check if tickets are available for booking
  const isTicketSaleActive = () => {
    if (!event) return false;
    
    // Check if ticket sales are enabled
    if (!event.isTicketSaleEnabled) {
      return false;
    }

    // Check if within sale period
    const now = new Date();
    const saleStart = event.ticketSaleStartDate ? new Date(event.ticketSaleStartDate) : null;
    const saleEnd = event.ticketSaleEndDate ? new Date(event.ticketSaleEndDate) : null;

    if (saleStart && now < saleStart) {
      return false; // Sale hasn't started yet
    }

    if (saleEnd && now > saleEnd) {
      return false; // Sale has ended
    }

    return true;
  };

  const getTicketAvailabilityMessage = () => {
    if (!event) return 'Loading...';

    if (!event.isTicketSaleEnabled) {
      return 'Ticket sales are currently disabled for this event.';
    }

    const now = new Date();
    const saleStart = event.ticketSaleStartDate ? new Date(event.ticketSaleStartDate) : null;
    const saleEnd = event.ticketSaleEndDate ? new Date(event.ticketSaleEndDate) : null;

    if (saleStart && now < saleStart) {
      return `Ticket sales will start on ${new Date(event.ticketSaleStartDate).toLocaleString()}`;
    }

    if (saleEnd && now > saleEnd) {
      return `Ticket sales ended on ${new Date(event.ticketSaleEndDate).toLocaleString()}`;
    }

    return null; // Tickets are available
  };

  const fetchSeats = async () => {
    try {
      const response = await axios.get(`${API_URL}/events/${eventId}/seats`);
      setSeats(response.data);
    } catch (error) {
      console.error('Error fetching seats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeatClick = (seat: Seat) => {
    // Don't allow selection if ticket sales are not active
    if (!isTicketSaleActive()) {
      return;
    }

    // Don't allow selection of booked, broken, aisle, blocked, or payment_pending seats
    if (seat.state === 'booked' || seat.state === 'broken' || seat.state === 'aisle' || seat.state === 'blocked' || seat.state === 'payment_pending') {
      return;
    }

    const newSelected = new Set(selectedSeats);
    if (newSelected.has(seat._id)) {
      newSelected.delete(seat._id);
    } else if (seat.state === 'available') {
      newSelected.add(seat._id);
    }
    setSelectedSeats(newSelected);
  };

  const handleGoToCart = () => {
    if (!isTicketSaleActive()) {
      alert(getTicketAvailabilityMessage() || 'Tickets are not currently available for booking.');
      return;
    }

    if (selectedSeats.size === 0) {
      alert('Please select at least one seat');
      return;
    }

    const seatIds = Array.from(selectedSeats).map(id => String(id));
    const selectedSeatDetails = seats.filter(seat => seatIds.includes(seat._id));

    const cartPayload = {
      eventId,
      seatIds,
      seats: selectedSeatDetails,
      eventSummary: {
        title: event?.title,
        venue: event?.venue?.name,
        date: event?.startAt,
        posterImageUrl: event?.posterImageUrl || null,
        defaultPrice: event?.defaultPrice,
        ticketTypes: event?.ticketTypes || [],
      },
      createdAt: Date.now(),
    };

    sessionStorage.setItem('cartSelection', JSON.stringify(cartPayload));
    router.push('/cart');
  };

  const getSeatColor = (seat: Seat) => {
    // If ticket sales are not active, show all seats as disabled
    if (!isTicketSaleActive()) {
      return 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60';
    }

    // Check seatType first for VIP, then state
    if (seat.seatType === 'vip' && seat.state === 'available') {
      return 'bg-amber-500 hover:bg-amber-600 text-white shadow-md hover:shadow-lg';
    }
    
    switch (seat.state) {
      case 'available':
        return seat.seatType === 'regular' || !seat.seatType
          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md hover:shadow-lg'
          : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg';
      case 'payment_pending':
        return 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-md';
      case 'booked':
        return 'bg-rose-500 text-white cursor-not-allowed opacity-75';
      case 'broken':
        return 'bg-rose-500 text-white cursor-not-allowed opacity-60';
      case 'aisle':
        return 'bg-slate-400 text-white cursor-not-allowed opacity-60';
      case 'blocked':
        return 'bg-slate-900 text-white cursor-not-allowed opacity-60';
      default:
        return 'bg-slate-300 text-slate-700';
    }
  };

  if (loading) {
    return <div className="p-8">Loading event...</div>;
  }

  // Group seats by category/section first, then by row
  const seatsByCategory: Record<string, Record<string, Seat[]>> = {};
  seats.forEach((seat) => {
    const category = seat.section || 'UNCATEGORIZED';
    const row = seat.row || 'Unknown';
    if (!seatsByCategory[category]) {
      seatsByCategory[category] = {};
    }
    if (!seatsByCategory[category][row]) {
      seatsByCategory[category][row] = [];
    }
    seatsByCategory[category][row].push(seat);
  });

  // Sort categories and rows
  const sortedCategories = Object.keys(seatsByCategory).sort();
  sortedCategories.forEach((category) => {
    const rows = Object.keys(seatsByCategory[category]).sort();
    rows.forEach((row) => {
      seatsByCategory[category][row].sort((a, b) => {
        if (a.number && b.number) {
          return a.number - b.number;
        }
        return (a.label || '').localeCompare(b.label || '');
      });
    });
  });

  // Get pricing for category
  const getCategoryPricing = (category: string) => {
    const categorySeats = Object.values(seatsByCategory[category] || {}).flat();
    if (categorySeats.length === 0) return null;
    
    const ticketTypeMap = new Map<string, { adultPrice: number; childPrice: number }>();
    if (event?.ticketTypes) {
      event.ticketTypes.forEach((tt: any) => {
        ticketTypeMap.set(tt.name, { adultPrice: tt.adultPrice, childPrice: tt.childPrice });
      });
    }

    let minAdultPrice = Infinity;
    let minChildPrice = Infinity;
    let maxAdultPrice = 0;
    let maxChildPrice = 0;

    categorySeats.forEach((seat) => {
      let adultPrice = event?.defaultPrice || 0;
      let childPrice = event?.defaultPrice || 0;

      // Priority: ticketType price > event.defaultPrice (ignore seat.basePrice for pricing display)
      if (seat.ticketType && ticketTypeMap.has(seat.ticketType)) {
        const prices = ticketTypeMap.get(seat.ticketType)!;
        adultPrice = prices.adultPrice;
        childPrice = prices.childPrice; // Use organizer-entered child price
      }
      // If no ticketType, use event defaultPrice (don't use seat.basePrice as it might be outdated)

      minAdultPrice = Math.min(minAdultPrice, adultPrice);
      minChildPrice = Math.min(minChildPrice, childPrice);
      maxAdultPrice = Math.max(maxAdultPrice, adultPrice);
      maxChildPrice = Math.max(maxChildPrice, childPrice);
    });

    return {
      adult: minAdultPrice === maxAdultPrice ? minAdultPrice : { min: minAdultPrice, max: maxAdultPrice },
      child: minChildPrice === maxChildPrice ? minChildPrice : { min: minChildPrice, max: maxChildPrice },
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-end mb-4">
          <button
            onClick={handleGoToCart}
            className="relative inline-flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-full px-5 py-2 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-all"
          >
            🛒
            <span className="text-sm font-semibold">Cart</span>
            <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {selectedSeats.size}
            </span>
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-slate-100">
          <h1 className="text-3xl font-bold mb-2 text-slate-800">{event?.title}</h1>
          <p className="text-slate-600 mb-4">{event?.description}</p>
          <div className="text-sm text-slate-500 space-y-1">
            <p className="flex items-center gap-2">
              <span className="text-indigo-500">📍</span> Venue: {event?.venue.name}
            </p>
            <p className="flex items-center gap-2">
              <span className="text-indigo-500">📅</span> Date: {event?.startAt ? new Date(event.startAt).toLocaleString() : ''}
            </p>
          </div>
        </div>

        {/* Ticket Availability Banner */}
        {event && !isTicketSaleActive() && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-800 mb-1">Tickets Not Available</h3>
                <p className="text-yellow-700">{getTicketAvailabilityMessage()}</p>
              </div>
            </div>
          </div>
        )}

        {event && isTicketSaleActive() && (
          <div className="bg-green-50 border-2 border-green-400 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-semibold">✓</span>
              <span className="text-green-800 font-medium">Tickets are now available for booking!</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-slate-100">
          <h2 className="text-xl font-semibold mb-4 text-slate-800">Select Your Seats</h2>
          
          {!isTicketSaleActive() && (
            <div className="mb-4 p-4 bg-gray-100 rounded-lg border border-gray-300">
              <p className="text-gray-600 text-sm">
                Seat selection is disabled. {getTicketAvailabilityMessage()}
              </p>
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-4 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-emerald-500 rounded shadow-sm"></div>
              <span className="text-slate-700 font-medium">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-amber-500 rounded shadow-sm"></div>
              <span className="text-slate-700 font-medium">VIP</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-500 rounded shadow-sm"></div>
              <span className="text-slate-700 font-medium">Standard</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-yellow-500 rounded shadow-sm"></div>
              <span className="text-slate-700 font-medium">Reserved</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-rose-500 rounded shadow-sm"></div>
              <span className="text-slate-700 font-medium">Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-slate-400 rounded shadow-sm"></div>
              <span className="text-slate-700 font-medium">Aisle/Blocked</span>
            </div>
          </div>

          <div className="space-y-6">
            {sortedCategories.map((category) => {
              const pricing = getCategoryPricing(category);
              return (
                <div key={category} className="border-2 border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-slate-300">
                    <h3 className="text-lg font-bold text-slate-800">{category}</h3>
                    {pricing && (
                      <div className="text-sm text-slate-600">
                        <span className="font-semibold">Adult:</span> LKR {typeof pricing.adult === 'number' ? pricing.adult.toFixed(2) : `${pricing.adult.min.toFixed(2)}-${pricing.adult.max.toFixed(2)}`} / 
                        <span className="font-semibold"> Child:</span> LKR {typeof pricing.child === 'number' ? pricing.child.toFixed(2) : `${pricing.child.min.toFixed(2)}-${pricing.child.max.toFixed(2)}`}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {Object.keys(seatsByCategory[category]).sort().map((row) => (
                      <div key={`${category}-${row}`} className="flex items-center gap-2">
                        <div className="w-12 text-sm font-semibold text-slate-800">Row {row}</div>
                        <div className="flex gap-1 flex-wrap">
                          {seatsByCategory[category][row].map((seat) => {
                            const isSelected = selectedSeats.has(seat._id);
                            return (
                              <button
                                key={seat._id}
                                onClick={() => handleSeatClick(seat)}
                                disabled={!isTicketSaleActive() || seat.state === 'booked' || seat.state === 'broken' || seat.state === 'aisle' || seat.state === 'blocked' || seat.state === 'payment_pending'}
                                className={`
                                  w-10 h-10 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center
                                  ${getSeatColor(seat)}
                                  ${isSelected ? 'ring-4 ring-indigo-500 ring-offset-2 scale-110 z-10' : ''}
                                  ${seat.state === 'available' && isTicketSaleActive() ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}
                                `}
                                title={`${seat.label}${seat.ticketType ? ` (${seat.ticketType})` : seat.seatType === 'vip' ? ' (VIP)' : ''} - ${seat.state}`}
                              >
                                {seat.number || seat.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fixed Screen Icon at Bottom */}
          <div className="mt-8 pt-6 border-t-4 border-slate-300">
            <div className="flex items-center justify-center py-4 px-6 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg border-2 border-blue-300 shadow-md">
              <div className="text-center">
                <div className="text-4xl mb-2">🎬</div>
                <div className="text-blue-800 font-bold text-lg">SCREEN / STAGE</div>
                <div className="text-blue-600 text-sm mt-1">All eyes this way please!</div>
              </div>
            </div>
          </div>

          {selectedSeats.size > 0 && (
            <div className="mt-6 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
              <p className="font-semibold mb-4 text-slate-800 text-lg">
                {selectedSeats.size} seat(s) selected
              </p>
              <button
                onClick={handleGoToCart}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
              >
                Go to Cart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

