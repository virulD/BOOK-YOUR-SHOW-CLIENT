'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

type SeatStatus = 'available' | 'broken' | 'aisle' | 'blocked' | 'vip' | 'standard' | 'payment_pending' | 'booked';
type SeatType = 'regular' | 'vip' | 'accessible';

interface Seat {
  _id?: string;
  label: string;
  row?: string;
  number?: number;
  section?: string;
  state: SeatStatus;
  seatType: SeatType;
  ticketType?: string; // Ticket type name (e.g., "VVIP", "VIP", "Balcony")
  basePrice?: number;
}

const STATUS_COLORS: Record<SeatStatus, string> = {
  available: 'bg-emerald-500 hover:bg-emerald-600',
  broken: 'bg-rose-500 hover:bg-rose-600',
  aisle: 'bg-slate-400 hover:bg-slate-500',
  blocked: 'bg-slate-900 hover:bg-slate-800',
  vip: 'bg-amber-500 hover:bg-amber-600',
  standard: 'bg-blue-500 hover:bg-blue-600',
  payment_pending: 'bg-yellow-500 hover:bg-yellow-600',
  booked: 'bg-slate-600 hover:bg-slate-700',
};

const STATUS_LABELS: Record<SeatStatus, string> = {
  available: 'Available',
  broken: 'Broken',
  aisle: 'Aisle',
  blocked: 'Blocked',
  vip: 'VIP',
  standard: 'Standard',
  payment_pending: 'Payment Pending',
  booked: 'Booked',
};

export default function GridSeatEditorPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  
  const [event, setEvent] = useState<any>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectedTicketType, setSelectedTicketType] = useState<string>('');
  
  // Pending changes that will be applied when Save is clicked
  const [pendingCategory, setPendingCategory] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<SeatStatus | ''>('');
  const [pendingTicketType, setPendingTicketType] = useState<string>('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    fetchEvent();
    fetchSeats();
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const response = await axios.get(`${API_URL}/organizer/events/${eventId}`, getAuthHeaders());
      const eventData = response.data;
      setEvent(eventData);
      console.log('Event data loaded:', eventData);
      console.log('Seating categories:', eventData?.seatingCategories);
      // If no categories, try to get from event object structure
      if (!eventData.seatingCategories || eventData.seatingCategories.length === 0) {
        console.warn('No seating categories found in event data');
      }
    } catch (error: any) {
      console.error('Error fetching event:', error);
      if (error.response?.status === 401) {
        router.push('/auth/login');
      }
    }
  };

  const fetchSeats = async () => {
    try {
      const response = await axios.get(`${API_URL}/events/${eventId}/seats`, getAuthHeaders());
      setSeats(response.data);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching seats:', error);
      if (error.response?.status === 401) {
        router.push('/auth/login');
      }
      setLoading(false);
    }
  };

  // Group seats by section/category first, then by row
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
      seatsByCategory[category][row].sort((a, b) => (a.number || 0) - (b.number || 0));
    });
  });

  // Also keep the old structure for backward compatibility
  const seatsByRow = seats.reduce((acc, seat) => {
    const row = seat.row || 'Unknown';
    if (!acc[row]) {
      acc[row] = [];
    }
    acc[row].push(seat);
    return acc;
  }, {} as Record<string, Seat[]>);

  // Sort rows alphabetically
  const sortedRows = Object.keys(seatsByRow).sort();

  // Helper function to check if a row has a category assigned
  const getRowCategory = (row: string): string | null => {
    const rowSeats = seatsByRow[row] || [];
    if (rowSeats.length === 0) return null;
    // Check if all seats in the row have the same category
    const firstSeatCategory = rowSeats[0].section;
    const allSameCategory = rowSeats.every(seat => seat.section === firstSeatCategory);
    return allSameCategory && firstSeatCategory ? firstSeatCategory : null;
  };

  // Check which rows have categories assigned
  const rowsWithCategories = new Set<string>();
  sortedRows.forEach(row => {
    const category = getRowCategory(row);
    if (category) {
      rowsWithCategories.add(row);
    }
  });

  // Sort seats in each row by number
  sortedRows.forEach((row) => {
    seatsByRow[row].sort((a, b) => (a.number || 0) - (b.number || 0));
  });

  const handleSeatClick = (seat: Seat) => {
    // Don't allow editing booked or payment_pending seats
    if (seat.state === 'booked' || seat.state === 'payment_pending') {
      return;
    }
    setSelectedSeat(seat);
    setShowStatusModal(true);
  };

  const handleStatusChange = async (newStatus: SeatStatus, ticketTypeName?: string) => {
    if (!selectedSeat) return;

    const updatedSeats = seats.map((seat) => {
      if (seat._id === selectedSeat._id) {
        // Map frontend status to backend state and seatType
        let state: SeatStatus = 'available';
        let seatType: SeatType = 'regular';
        let ticketType: string | undefined = undefined;
        
        if (newStatus === 'vip') {
          state = 'available';
          seatType = 'vip';
          ticketType = ticketTypeName || seat.ticketType;
        } else if (newStatus === 'standard') {
          state = 'available';
          seatType = 'regular';
          ticketType = ticketTypeName || seat.ticketType;
        } else if (['available', 'broken', 'aisle', 'blocked', 'payment_pending', 'booked'].includes(newStatus)) {
          state = newStatus;
          seatType = seat.seatType; // Keep existing seatType
          ticketType = seat.ticketType; // Keep existing ticketType
        }
        
        return {
          ...seat,
          state,
          seatType,
          ticketType,
        };
      }
      return seat;
    });

    setSeats(updatedSeats);
    setShowStatusModal(false);
    setSelectedSeat(null);
    setSelectedTicketType('');
  };

  const handleBulkRowAction = async (action: SeatStatus, ticketTypeName?: string, rows?: string[]) => {
    const targetRows = rows || Array.from(selectedRows);
    if (targetRows.length === 0) return;

    const updatedSeats = seats.map((seat) => {
      if (seat.row && targetRows.includes(seat.row)) {
        // Map action to state and seatType
        let state: SeatStatus = 'available';
        let seatType: SeatType = 'regular';
        let ticketType: string | undefined = undefined;
        
        if (action === 'vip') {
          state = 'available';
          seatType = 'vip';
          ticketType = ticketTypeName || seat.ticketType;
        } else if (action === 'standard') {
          state = 'available';
          seatType = 'regular';
          ticketType = ticketTypeName || seat.ticketType;
        } else if (['broken', 'aisle', 'blocked', 'payment_pending', 'booked'].includes(action)) {
          state = action;
          seatType = seat.seatType; // Keep existing seatType
          ticketType = seat.ticketType; // Keep existing ticketType
        } else if (action === 'available') {
          state = 'available';
          seatType = seat.seatType; // Keep existing seatType
          ticketType = seat.ticketType; // Keep existing ticketType
        }
        
        return {
          ...seat,
          state,
          seatType,
          ticketType,
        };
      }
      return seat;
    });

    setSeats(updatedSeats);
    setSelectedRows(new Set());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API_URL}/organizer/events/${eventId}/seats`,
        {
          seats: seats.map((seat) => ({
            _id: seat._id,
            label: seat.label,
            row: seat.row,
            number: seat.number,
            section: seat.section,
            state: seat.state,
            seatType: seat.seatType,
            ticketType: seat.ticketType,
            basePrice: seat.basePrice || event?.defaultPrice || 550,
          })),
        },
        getAuthHeaders()
      );
      
      alert('Seats saved successfully!');
      await fetchSeats();
    } catch (error: any) {
      console.error('Error saving seats:', error);
      alert(`Error saving seats: ${error.response?.data?.message || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSetCategoryForRows = (rows: string[], category: string) => {
    const updatedSeats = seats.map((seat) => {
      if (seat.row && rows.includes(seat.row)) {
        return { ...seat, section: category === 'REMOVE' ? undefined : (category || undefined) };
      }
      return seat;
    });
    setSeats(updatedSeats);
  };

  const handleApplyPendingChanges = () => {
    const rowsArray = Array.from(selectedRows);
    
    if (rowsArray.length === 0) {
      alert('Please select at least one row');
      return;
    }

    let updatedSeats = [...seats];

    // Apply category if selected
    if (pendingCategory) {
      updatedSeats = updatedSeats.map((seat) => {
        if (seat.row && rowsArray.includes(seat.row)) {
          return { 
            ...seat, 
            section: pendingCategory === 'REMOVE' ? undefined : pendingCategory 
          };
        }
        return seat;
      });
    }

    // Apply action/status if selected
    if (pendingAction) {
      updatedSeats = updatedSeats.map((seat) => {
        if (seat.row && rowsArray.includes(seat.row)) {
          let state: SeatStatus = 'available';
          let seatType: SeatType = 'regular';
          let ticketType: string | undefined = seat.ticketType;
          
          if (pendingAction === 'vip') {
            state = 'available';
            seatType = 'vip';
            ticketType = pendingTicketType || seat.ticketType;
          } else if (pendingAction === 'standard') {
            state = 'available';
            seatType = 'regular';
            ticketType = pendingTicketType || seat.ticketType;
          } else if (['broken', 'aisle', 'blocked', 'payment_pending', 'booked'].includes(pendingAction)) {
            state = pendingAction;
            seatType = seat.seatType;
            ticketType = seat.ticketType;
          } else if (pendingAction === 'available') {
            state = 'available';
            seatType = seat.seatType;
            ticketType = seat.ticketType;
          }
          
          return {
            ...seat,
            state,
            seatType,
            ticketType,
          };
        }
        return seat;
      });
    }

    // Apply ticket type if selected (and no action was selected, or action was vip/standard)
    if (pendingTicketType && !pendingAction) {
      updatedSeats = updatedSeats.map((seat) => {
        if (seat.row && rowsArray.includes(seat.row) && (seat.state === 'available' || seat.seatType === 'vip' || seat.seatType === 'regular')) {
          return {
            ...seat,
            ticketType: pendingTicketType,
          };
        }
        return seat;
      });
    }

    setSeats(updatedSeats);
    
    // Clear pending changes and selection
    setPendingCategory('');
    setPendingAction('');
    setPendingTicketType('');
    setSelectedRows(new Set());
  };

  const toggleRowSelection = (row: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(row)) {
        next.delete(row);
      } else {
        next.add(row);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-slate-600">Loading seats...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-4 border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Seat Editor - {event?.title}</h1>
              <p className="text-slate-600 text-sm mt-1">
                Click on a seat to change its status. Total seats: {seats.length}
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
            >
              {saving ? 'Saving...' : 'Save Layout'}
            </button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4 p-4 bg-slate-50 rounded-lg">
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${STATUS_COLORS[status as SeatStatus]}`} />
                <span className="text-sm text-slate-700">{label}</span>
              </div>
            ))}
          </div>


          {/* Bulk Actions */}
          <div className="flex gap-4 mb-4 items-center flex-wrap">
            <div className="border-2 border-slate-300 bg-white rounded-lg p-2 max-h-40 overflow-y-auto min-w-[200px]">
              <div className="text-xs font-semibold text-slate-700 mb-2 px-2">Select Rows (Multiple)</div>
              {sortedRows.map((row) => {
                const hasCategory = rowsWithCategories.has(row);
                const category = getRowCategory(row);
                return (
                  <label 
                    key={row} 
                    className={`flex items-center gap-2 px-2 py-1 ${
                      hasCategory 
                        ? 'bg-gray-100 opacity-60 cursor-not-allowed' 
                        : 'hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row)}
                      onChange={() => !hasCategory && toggleRowSelection(row)}
                      disabled={hasCategory}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <span className={`text-sm ${hasCategory ? 'text-gray-500' : 'text-slate-900'}`}>
                      Row {row}
                      {category && <span className="ml-2 text-xs text-gray-400">({category})</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            {selectedRows.size > 0 && (
              <>
                <select
                  value={pendingCategory}
                  onChange={(e) => setPendingCategory(e.target.value)}
                  className="border-2 border-slate-300 bg-white rounded-lg px-4 py-2 text-slate-900"
                >
                  <option value="">Set Category for Selected Rows</option>
                  {event?.seatingCategories && Array.isArray(event.seatingCategories) && event.seatingCategories.length > 0 ? (
                    event.seatingCategories.map((cat: string) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      {event ? 'No categories defined for this event' : 'Loading...'}
                    </option>
                  )}
                  <option value="REMOVE">Remove Category</option>
                </select>
                <div className="flex gap-2">
                  <select
                    value={pendingAction}
                    onChange={(e) => setPendingAction(e.target.value as SeatStatus | '')}
                    className="border-2 border-slate-300 bg-white rounded-lg px-4 py-2 text-slate-900"
                  >
                    <option value="">Select Action</option>
                    <option value="broken">Broken</option>
                    <option value="aisle">Aisle</option>
                    <option value="blocked">Blocked</option>
                    <option value="vip">VIP</option>
                    <option value="standard">Standard</option>
                    <option value="available">Available</option>
                    <option value="payment_pending">Payment Pending</option>
                    <option value="booked">Booked</option>
                  </select>
                  {event?.ticketTypes && event.ticketTypes.length > 0 && (
                    <select
                      value={pendingTicketType}
                      onChange={(e) => setPendingTicketType(e.target.value)}
                      className="border-2 border-slate-300 bg-white rounded-lg px-4 py-2 text-slate-900"
                    >
                      <option value="">Assign Ticket Type</option>
                      {event.ticketTypes.map((tt: any) => (
                        <option key={tt.name} value={tt.name}>
                          {tt.name} - Adult: LKR {tt.adultPrice}, Child: LKR {tt.childPrice}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  onClick={handleApplyPendingChanges}
                  disabled={selectedRows.size === 0 || (!pendingCategory && !pendingAction && !pendingTicketType)}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                >
                  Apply Changes
                </button>
                <button
                  onClick={() => {
                    setSelectedRows(new Set());
                    setPendingCategory('');
                    setPendingAction('');
                    setPendingTicketType('');
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 font-medium"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {/* Seat Grid - Grouped by Category */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-100">
          <div className="space-y-6">
            {sortedCategories.map((category) => (
              <div key={category} className="border-2 border-slate-200 rounded-lg p-4">
                <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-slate-300">
                  {category}
                </h3>
                <div className="space-y-3">
                  {Object.keys(seatsByCategory[category]).sort().map((row) => (
                    <div key={`${category}-${row}`} className="flex items-center gap-2">
                      <div className="w-12 text-sm font-semibold text-slate-800">Row {row}</div>
                      <div className="flex gap-1 flex-wrap">
                        {seatsByCategory[category][row].map((seat) => {
                    // Determine display color: VIP seats show amber, others show state color
                    const displayStatus = seat.seatType === 'vip' && seat.state === 'available' 
                      ? 'vip' 
                      : seat.state;
                    const colorClass = STATUS_COLORS[displayStatus as SeatStatus] || STATUS_COLORS.available;
                    
                    return (
                      <button
                        key={seat._id || seat.label}
                        onClick={() => handleSeatClick(seat)}
                        disabled={seat.state === 'booked' || seat.state === 'payment_pending'}
                        className={`w-10 h-10 rounded text-xs font-medium text-white transition-all ${colorClass} ${
                          seat.state === 'booked' || seat.state === 'payment_pending'
                            ? 'cursor-not-allowed opacity-75'
                            : 'cursor-pointer'
                        }`}
                        title={`${seat.label} - ${seat.seatType === 'vip' ? 'VIP' : STATUS_LABELS[seat.state]}`}
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
            ))}
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
        </div>
      </div>

      {/* Status Selection Modal */}
      {showStatusModal && selectedSeat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-slate-800">
              Edit Seat: {selectedSeat.label}
            </h2>
            <p className="text-slate-600 mb-4">Select a new status for this seat:</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['available', 'broken', 'aisle', 'blocked', 'vip', 'standard'] as SeatStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    if (status === 'vip' || status === 'standard') {
                      // For VIP/Standard, show ticket type selector
                      setSelectedTicketType(selectedSeat.ticketType || '');
                    } else {
                      handleStatusChange(status);
                    }
                  }}
                  className={`p-3 rounded-lg text-white font-medium transition-all ${
                    STATUS_COLORS[status]
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
            
            {/* Ticket Type Selector (shown when VIP or Standard is selected) */}
            {event?.ticketTypes && event.ticketTypes.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-slate-700">
                  Ticket Type (Optional)
                </label>
                <select
                  value={selectedTicketType}
                  onChange={(e) => setSelectedTicketType(e.target.value)}
                  className="w-full border-2 border-slate-300 bg-white rounded-lg px-3 py-2 text-slate-900"
                >
                  <option value="">None (Use Default Price)</option>
                  {event.ticketTypes.map((tt: any) => (
                    <option key={tt.name} value={tt.name}>
                      {tt.name} - Adult: LKR {tt.adultPrice}, Child: LKR {tt.childPrice}
                    </option>
                  ))}
                </select>
                {(selectedTicketType || selectedSeat.ticketType) && (
                  <button
                    onClick={() => handleStatusChange(selectedSeat.state === 'vip' ? 'vip' : 'standard', selectedTicketType || undefined)}
                    className="mt-2 w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Apply Ticket Type
                  </button>
                )}
              </div>
            )}
            
            <button
              onClick={() => {
                setShowStatusModal(false);
                setSelectedSeat(null);
                setSelectedTicketType('');
              }}
              className="mt-4 w-full bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

