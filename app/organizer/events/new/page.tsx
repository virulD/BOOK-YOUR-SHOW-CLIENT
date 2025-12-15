'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

// Ensure API_URL is properly formatted
const getApiUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  console.log('Raw NEXT_PUBLIC_API_URL:', envUrl);
  
  if (envUrl) {
    // Remove trailing slashes and whitespace
    let cleaned = envUrl.trim().replace(/\/+$/, '');
    
    // If it starts with : (malformed), fix it
    if (cleaned.startsWith(':')) {
      cleaned = `http://localhost${cleaned}`;
    }
    
    // Ensure it starts with http:// or https://
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      // If it doesn't start with http, add it
      if (cleaned.startsWith('/')) {
        cleaned = `http://localhost:3000${cleaned}`;
      } else if (cleaned.includes(':')) {
        cleaned = `http://${cleaned}`;
      } else {
        cleaned = `http://localhost:3000/api`;
      }
    }
    
    return cleaned;
  }
  return 'http://localhost:3000/api';
};

const API_URL = getApiUrl();
console.log('API_URL configured as:', API_URL);

export default function NewEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successEventId, setSuccessEventId] = useState<string | null>(null);
  
  // Initialize minDateTime immediately
  const getMinDateTime = () => {
    const now = new Date();
    // Format: YYYY-MM-DDTHH:mm (datetime-local format)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  const [minDateTime, setMinDateTime] = useState(getMinDateTime());

  useEffect(() => {
    // Update minimum date/time to current date/time
    const updateMinDateTime = () => {
      setMinDateTime(getMinDateTime());
    };
    updateMinDateTime();

    // Test backend connection on mount
    const testConnection = async () => {
      try {
        const healthUrl = API_URL.replace('/api', '') + '/health';
        const response = await axios.get(healthUrl, { timeout: 3000 });
        console.log('✅ Backend server is running:', response.data);
      } catch (error) {
        console.error('❌ Backend server is not accessible:', error);
        setError('Backend server is not running. Please start the server on http://localhost:3000');
      }
    };
    testConnection();
  }, []);

  const [formData, setFormData] = useState({
    organizerId: 'demo-organizer-1',
    title: '',
    highlightedTitle: '',
    description: '',
    startAt: '',
    endAt: '',
    timezone: 'Asia/Colombo',
    venueName: '',
    venueAddress: '',
    venueCapacity: '',
    eventType: 'reserved',
    startingPrice: '',
    commissionType: 'percentage',
    commissionValue: '10',
    hasSeating: true,
    numberOfRows: '10',
    seatsPerRow: '15',
    ticketSaleStartDate: '',
    ticketSaleEndDate: '',
    isTicketSaleEnabled: false,
  });
  const [ticketTypes, setTicketTypes] = useState<Array<{ name: string; adultPrice: string; childPrice: string }>>([
    { name: 'VVIP', adultPrice: '1500', childPrice: '1200' },
    { name: 'VIP', adultPrice: '1000', childPrice: '800' },
    { name: 'Standard', adultPrice: '550', childPrice: '400' },
  ]);
  const [seatingCategories, setSeatingCategories] = useState<string[]>(['']);
  const [posterImage, setPosterImage] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate required fields
    if (!formData.title.trim()) {
      setError('Event title is required');
      return;
    }
    
    if (!formData.venueName.trim()) {
      setError('Venue name is required');
      return;
    }
    
    if (!formData.startAt || !formData.endAt) {
      setError('Start and end dates are required');
      return;
    }
    
    // Validate dates
    const startDate = new Date(formData.startAt);
    const endDate = new Date(formData.endAt);
    const now = new Date();
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setError('Invalid date format');
      return;
    }
    
    if (startDate < now) {
      setError('Start date cannot be in the past');
      return;
    }
    
    if (endDate <= startDate) {
      setError('End date must be after start date');
      return;
    }
    
    // Validate commission
    const commissionValue = parseFloat(formData.commissionValue);
    if (isNaN(commissionValue) || commissionValue < 0) {
      setError('Commission value must be a valid positive number');
      return;
    }
    
    // Validate seating fields only if hasSeating is true
    if (formData.hasSeating) {
      const numberOfRows = parseInt(formData.numberOfRows);
      const seatsPerRow = parseInt(formData.seatsPerRow);
      
      if (isNaN(numberOfRows) || numberOfRows < 1) {
        setError('Number of rows must be at least 1');
        return;
      }
      
      if (isNaN(seatsPerRow) || seatsPerRow < 1) {
        setError('Seats per row must be at least 1');
        return;
      }
    }

    setLoading(true);

    try {
      // Upload poster image first if provided
      let posterImageUrl: string | undefined;
      if (posterImage) {
        setUploadingImage(true);
        const formDataUpload = new FormData();
        formDataUpload.append('file', posterImage);
        
        const token = localStorage.getItem('token');
        const uploadResponse = await axios.post(`${API_URL}/organizer/events/upload-poster`, formDataUpload, {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
        posterImageUrl = `http://localhost:3000${uploadResponse.data.url}`;
        setUploadingImage(false);
      }

      // Validate and format ticket types - ensure all required fields are present and valid
      const formattedTicketTypes = ticketTypes
        .filter(tt => {
          if (!tt) return false;
          const name = tt.name?.trim();
          const adultPriceStr = tt.adultPrice?.toString().trim();
          const childPriceStr = tt.childPrice?.toString().trim();
          
          // All three fields must be present and non-empty
          if (!name || name.length === 0 || !adultPriceStr || adultPriceStr.length === 0 || !childPriceStr || childPriceStr.length === 0) {
            return false;
          }
          
          const adultPrice = parseFloat(adultPriceStr);
          const childPrice = parseFloat(childPriceStr);
          
          // Both prices must be valid numbers >= 0
          return !isNaN(adultPrice) && 
                 adultPrice >= 0 && 
                 !isNaN(childPrice) && 
                 childPrice >= 0;
        })
        .map(tt => {
          // Ensure we return proper numbers, not strings
          return {
            name: tt.name.trim(),
            adultPrice: Number(parseFloat(tt.adultPrice.toString())),
            childPrice: Number(parseFloat(tt.childPrice.toString())),
          };
        });
      
      console.log('Formatted ticket types:', formattedTicketTypes);

      // Calculate default price: use starting price if provided, otherwise use minimum from ticket types, or 0
      let defaultPrice = 0;
      if (formData.startingPrice && formData.startingPrice.trim()) {
        defaultPrice = parseFloat(formData.startingPrice);
        if (isNaN(defaultPrice) || defaultPrice < 0) {
          setError('Starting price must be a valid positive number');
          setLoading(false);
          return;
        }
      } else if (formattedTicketTypes.length > 0) {
        // Use minimum adult price from ticket types as default
        const minPrice = Math.min(...formattedTicketTypes.map((tt: any) => tt.adultPrice));
        defaultPrice = minPrice;
      }

      const eventData: any = {
        organizerId: formData.organizerId,
        title: formData.title.trim(),
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
        timezone: formData.timezone,
        venue: {
          name: formData.venueName.trim(),
        },
        eventType: formData.eventType,
        defaultPrice: defaultPrice,
        commission: {
          type: formData.commissionType,
          value: commissionValue,
        },
        hasSeating: formData.hasSeating,
      };

      // Only add optional fields if they have values (avoid empty strings)
      if (formData.description?.trim()) {
        eventData.description = formData.description.trim();
      }

      if (formData.venueAddress?.trim()) {
        eventData.venue.address = formData.venueAddress.trim();
      }

      if (formData.venueCapacity && formData.venueCapacity.trim()) {
        const capacity = parseInt(formData.venueCapacity);
        if (!isNaN(capacity)) {
          eventData.venue.capacity = capacity;
        }
      }

      // Only add highlightedTitle if it has a non-empty value
      const highlightedTitleValue = formData.highlightedTitle?.trim();
      if (highlightedTitleValue && highlightedTitleValue.length > 0) {
        eventData.highlightedTitle = highlightedTitleValue;
      }

      // Only add startingPrice if it's a valid positive number
      if (formData.startingPrice && formData.startingPrice.trim()) {
        const startingPrice = parseFloat(formData.startingPrice);
        if (!isNaN(startingPrice) && startingPrice > 0) {
          eventData.startingPrice = startingPrice;
        }
      }

      // Only add ticketTypes if array is not empty and all entries are valid
      if (formattedTicketTypes && formattedTicketTypes.length > 0) {
        // Double-check all ticket types are valid
        const validTicketTypes = formattedTicketTypes.filter(tt => 
          tt.name && 
          typeof tt.adultPrice === 'number' && tt.adultPrice >= 0 &&
          typeof tt.childPrice === 'number' && tt.childPrice >= 0
        );
        if (validTicketTypes.length > 0) {
          eventData.ticketTypes = validTicketTypes;
        }
      }

      if (posterImageUrl) {
        eventData.posterImageUrl = posterImageUrl;
      }

      if (formData.hasSeating) {
        eventData.numberOfRows = parseInt(formData.numberOfRows);
        eventData.seatsPerRow = parseInt(formData.seatsPerRow);
        // Add seating categories (filter out empty strings)
        const validCategories = seatingCategories.filter(cat => cat.trim().length > 0);
        if (validCategories.length > 0) {
          eventData.seatingCategories = validCategories.map(cat => cat.trim().toUpperCase());
        }
      }

      // Add ticket sale timing
      if (formData.ticketSaleStartDate) {
        eventData.ticketSaleStartDate = formData.ticketSaleStartDate;
      }
      if (formData.ticketSaleEndDate) {
        eventData.ticketSaleEndDate = formData.ticketSaleEndDate;
      }
      eventData.isTicketSaleEnabled = formData.isTicketSaleEnabled;

      // Construct the full URL - ensure no double slashes
      const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
      const endpoint = '/organizer/events';
      const fullUrl = `${baseUrl}${endpoint}`;
      
      console.log('API_URL:', API_URL);
      console.log('Base URL:', baseUrl);
      console.log('Full request URL:', fullUrl);
      console.log('Sending event data:', JSON.stringify(eventData, null, 2));
      console.log('Event data keys:', Object.keys(eventData));
      console.log('Has highlightedTitle:', !!eventData.highlightedTitle);
      console.log('Has startingPrice:', !!eventData.startingPrice);
      console.log('Has ticketTypes:', !!eventData.ticketTypes, eventData.ticketTypes?.length);
      
      // Validate URL before making request
      try {
        new URL(fullUrl); // This will throw if URL is invalid
      } catch (urlError) {
        throw new Error(`Invalid API URL: ${fullUrl}. Please check your NEXT_PUBLIC_API_URL environment variable.`);
      }
      
      const token = localStorage.getItem('token');
      const response = await axios.post(fullUrl, eventData, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      }).catch((error) => {
        // Log detailed error information
        console.error('Error creating event:', error);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
          const errorMessage = error.response.data?.message || 
                              (Array.isArray(error.response.data?.message) 
                                ? error.response.data.message.join(', ') 
                                : error.response.data?.error || 
                                  JSON.stringify(error.response.data));
          throw new Error(`Server error: ${errorMessage}`);
        } else if (error.request) {
          throw new Error('No response from server. Please check if the backend is running.');
        } else {
          throw new Error(`Request error: ${error.message}`);
        }
      });
      
      console.log('Event created response:', response);
      console.log('Response data:', response.data);
      console.log('Response status:', response.status);
      
      // Handle different response formats and ensure ID is a string
      let eventId = response.data?._id || response.data?.id;
      
      // If _id is an object (MongoDB ObjectId), extract the string value
      if (eventId && typeof eventId === 'object') {
        eventId = eventId.toString();
      }
      
      // Convert to string
      const eventIdString = eventId ? String(eventId) : null;
      
      if (!eventIdString) {
        console.error('Full response object:', response);
        console.error('Response data keys:', Object.keys(response.data || {}));
        throw new Error('Event ID not found in response. Please check the console for details.');
      }
      
      console.log('Event ID extracted:', eventIdString);
      
      // Auto-generate seats only if hasSeating is true
      if (formData.hasSeating) {
        const numberOfRows = parseInt(formData.numberOfRows);
        const seatsPerRow = parseInt(formData.seatsPerRow);
        
        if (numberOfRows > 0 && seatsPerRow > 0) {
          try {
            console.log('Auto-generating seats...');
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/organizer/events/${eventIdString}/seats/generate`, {
              numberOfRows,
              seatsPerRow,
              defaultPrice: defaultPrice,
            }, {
              headers: {
                ...(token && { Authorization: `Bearer ${token}` }),
              },
            });
            console.log('Seats generated successfully');
          } catch (seatError: any) {
            console.error('Error generating seats:', seatError);
            // Don't fail the whole operation, just log the error
          }
        }
      }
      
      const redirectPath = `/organizer/events/${eventIdString}/seats`;
      console.log('Redirecting to:', redirectPath);
      
      // Store event ID for fallback display
      setSuccessEventId(eventIdString);
      setLoading(false);
      
      // Try router.push first, fallback to window.location
      try {
        router.push(redirectPath);
        // Use a timeout as fallback in case navigation doesn't work
        setTimeout(() => {
          if (window.location.pathname !== redirectPath) {
            console.log('Router push may have failed, using window.location');
            window.location.href = redirectPath;
          }
        }, 1000);
      } catch (navError) {
        console.error('Navigation error:', navError);
        window.location.href = redirectPath;
      }
    } catch (error: any) {
      console.error('Error creating event:', error);
      let errorMessage = 'Error creating event';
      
      if (error.response) {
        // Server responded with error
        if (error.response.data) {
          if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          } else if (error.response.data.message) {
            if (Array.isArray(error.response.data.message)) {
              errorMessage = error.response.data.message.join(', ');
            } else {
              errorMessage = error.response.data.message;
            }
          } else if (error.response.data.error) {
            errorMessage = error.response.data.error;
          }
        }
        errorMessage = `${errorMessage} (Status: ${error.response.status})`;
      } else if (error.request) {
        // Request was made but no response
        errorMessage = 'Unable to connect to server. Please check if the backend is running on http://localhost:3000';
      } else {
        // Something else happened
        errorMessage = error.message || 'An unexpected error occurred';
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-100">
          <h1 className="text-2xl font-bold mb-6 text-slate-800">Create New Event</h1>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border-2 border-rose-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-rose-600 text-xl">⚠️</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-rose-800 mb-1">Error</h3>
                  <p className="text-rose-700 text-sm">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-rose-600 hover:text-rose-800 font-bold"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {successEventId && (
            <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-emerald-600 text-xl">✅</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-emerald-800 mb-1">Event Created Successfully!</h3>
                  <p className="text-emerald-700 text-sm mb-2">
                    Event ID: {successEventId}
                  </p>
                  {formData.hasSeating ? (
                    <a
                      href={`/organizer/events/${successEventId}/seats`}
                      className="text-emerald-600 hover:text-emerald-800 underline font-medium"
                    >
                      Click here to edit seats →
                    </a>
                  ) : (
                    <a
                      href={`/organizer/events`}
                      className="text-emerald-600 hover:text-emerald-800 underline font-medium"
                    >
                      View all events →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-800">Event Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="Sri Lanka Music Festival 2024"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-800">Highlighted Title</label>
              <input
                type="text"
                value={formData.highlightedTitle}
                onChange={(e) => setFormData({ ...formData, highlightedTitle: e.target.value })}
                className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="A brief highlight that appears on event cards (e.g., 'Live Music Extravaganza')"
              />
              <p className="text-xs text-slate-500 mt-1">This will be displayed prominently on event cards to give users a quick idea about the event</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-800">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                rows={4}
                placeholder="Event description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-800">Event Poster Image</label>
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPosterImage(file);
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setPosterPreview(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                {posterPreview && (
                  <div className="mt-2">
                    <img
                      src={posterPreview}
                      alt="Poster preview"
                      className="max-w-xs rounded-lg border-2 border-slate-200"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasSeating}
                  onChange={(e) => setFormData({ ...formData, hasSeating: e.target.checked })}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-slate-800 font-medium">This event has assigned seating</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-800">Start Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  min={minDateTime}
                  value={formData.startAt}
                  onChange={(e) => {
                    const newStartAt = e.target.value;
                    // Auto-update end date if it's before the new start date
                    if (formData.endAt && newStartAt >= formData.endAt) {
                      const endDate = new Date(newStartAt);
                      endDate.setHours(endDate.getHours() + 1);
                      const endYear = endDate.getFullYear();
                      const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
                      const endDay = String(endDate.getDate()).padStart(2, '0');
                      const endHours = String(endDate.getHours()).padStart(2, '0');
                      const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
                      setFormData({ ...formData, startAt: newStartAt, endAt: `${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}` });
                    } else {
                      setFormData({ ...formData, startAt: newStartAt });
                    }
                  }}
                  step="60"
                  className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
                />
                <p className="text-xs text-slate-500 mt-1">Select the event start date and time</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-800">End Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  min={formData.startAt || minDateTime}
                  value={formData.endAt}
                  onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                  step="60"
                  className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
                />
                <p className="text-xs text-slate-500 mt-1">Select the event end date and time</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-800">Venue Name *</label>
              <input
                type="text"
                required
                value={formData.venueName}
                onChange={(e) => setFormData({ ...formData, venueName: e.target.value })}
                className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="Nelum Pokuna Theatre"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-800">Venue Address</label>
              <input
                type="text"
                value={formData.venueAddress}
                onChange={(e) => setFormData({ ...formData, venueAddress: e.target.value })}
                className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="Colombo, Sri Lanka"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-800">Event Type *</label>
              <select
                value={formData.eventType}
                onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                <option value="reserved">Reserved Seating</option>
                <option value="general">General Admission</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-800">Starting Price (LKR)</label>
              <input
                type="number"
                min="0"
                value={formData.startingPrice}
                onChange={(e) => setFormData({ ...formData, startingPrice: e.target.value })}
                className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="3000"
              />
              <p className="text-xs text-slate-500 mt-1">Minimum ticket price to display as "Rs. X onwards" on event cards</p>
            </div>

            <div className="border-2 border-slate-200 rounded-lg p-4 bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-800">Ticket Types</label>
                <button
                  type="button"
                  onClick={() => setTicketTypes([...ticketTypes, { name: '', adultPrice: '0', childPrice: '0' }])}
                  className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  + Add Ticket Type
                </button>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                Define different ticket types (e.g., VVIP, VIP, Balcony) with adult and child prices. These can be assigned to seats during seat configuration.
              </p>
              <div className="space-y-3">
                {ticketTypes.map((ticketType, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg p-3 bg-white">
                    <div className="flex gap-2 items-start mb-2">
                      <input
                        type="text"
                        placeholder="Ticket Type Name (e.g., VVIP)"
                        value={ticketType.name}
                        onChange={(e) => {
                          const updated = [...ticketTypes];
                          updated[index].name = e.target.value;
                          setTicketTypes(updated);
                        }}
                        className="flex-1 border-2 border-slate-300 bg-white rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = ticketTypes.filter((_, i) => i !== index);
                          setTicketTypes(updated);
                        }}
                        className="text-rose-600 hover:text-rose-800 px-3 py-2 font-bold text-xl"
                        disabled={ticketTypes.length === 1}
                        title="Remove this ticket type"
                      >
                        ×
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-slate-700">Adult Price (LKR) *</label>
                        <input
                          type="number"
                          placeholder="Adult Price"
                          min="0"
                          required
                          value={ticketType.adultPrice}
                          onChange={(e) => {
                            const updated = [...ticketTypes];
                            updated[index].adultPrice = e.target.value;
                            setTicketTypes(updated);
                          }}
                          className="w-full border-2 border-slate-300 bg-white rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-slate-700">Child Price (LKR) *</label>
                        <input
                          type="number"
                          placeholder="Child Price"
                          min="0"
                          required
                          value={ticketType.childPrice}
                          onChange={(e) => {
                            const updated = [...ticketTypes];
                            updated[index].childPrice = e.target.value;
                            setTicketTypes(updated);
                          }}
                          className="w-full border-2 border-slate-300 bg-white rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {formData.hasSeating && (
              <>
                <div className="border-2 border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-slate-800">Seating Categories</label>
                    <button
                      type="button"
                      onClick={() => setSeatingCategories([...seatingCategories, ''])}
                      className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      + Add Category
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    Define seating categories (e.g., SUPERIOR, PRIME, CLASSIC) that will be used when assigning rows to categories in the seat editor.
                  </p>
                  <div className="space-y-2">
                    {seatingCategories.map((category, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Category Name (e.g., SUPERIOR)"
                          value={category}
                          onChange={(e) => {
                            const updated = [...seatingCategories];
                            updated[index] = e.target.value.toUpperCase();
                            setSeatingCategories(updated);
                          }}
                          className="flex-1 border-2 border-slate-300 bg-white rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = seatingCategories.filter((_, i) => i !== index);
                            setSeatingCategories(updated.length > 0 ? updated : ['']);
                          }}
                          className="text-rose-600 hover:text-rose-800 px-3 py-2 font-bold text-xl"
                          disabled={seatingCategories.length === 1}
                          title="Remove this category"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-800">Number of Rows *</label>
                  <input
                    type="number"
                    required={formData.hasSeating}
                    min="1"
                    value={formData.numberOfRows}
                    onChange={(e) => setFormData({ ...formData, numberOfRows: e.target.value })}
                    className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="10"
                  />
                  <p className="text-xs text-slate-500 mt-1">Rows will be named A, B, C, ..., Z, AA, AB, AC, etc. (supports unlimited rows)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-800">Seats Per Row *</label>
                  <input
                    type="number"
                    required={formData.hasSeating}
                    min="1"
                    value={formData.seatsPerRow}
                    onChange={(e) => setFormData({ ...formData, seatsPerRow: e.target.value })}
                    className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="15"
                  />
                  <p className="text-xs text-slate-500 mt-1">Seats will be numbered 1, 2, 3, etc.</p>
                </div>
              </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-800">Commission Type *</label>
                <select
                  value={formData.commissionType}
                  onChange={(e) => setFormData({ ...formData, commissionType: e.target.value })}
                  className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                >
                  <option value="percentage">Percentage</option>
                  <option value="flat">Flat Rate</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-800">Commission Value *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.commissionValue}
                  onChange={(e) => setFormData({ ...formData, commissionValue: e.target.value })}
                  className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  placeholder={formData.commissionType === 'percentage' ? '10' : '100'}
                />
              </div>
            </div>

            {/* Ticket Sale Timing */}
            <div className="border-2 border-slate-200 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Ticket Sale Timing</h3>
              <p className="text-sm text-slate-600 mb-4">
                Set when tickets will be available for booking. You can enable ticket sales manually after creating the event.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-800">
                    Ticket Sale Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.ticketSaleStartDate}
                    onChange={(e) => setFormData({ ...formData, ticketSaleStartDate: e.target.value })}
                    min={minDateTime}
                    className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                  <p className="text-xs text-slate-500 mt-1">When ticket sales will start (optional)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-800">
                    Ticket Sale End Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.ticketSaleEndDate}
                    onChange={(e) => setFormData({ ...formData, ticketSaleEndDate: e.target.value })}
                    min={formData.ticketSaleStartDate || minDateTime}
                    className="w-full border-2 border-slate-300 bg-white rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                  <p className="text-xs text-slate-500 mt-1">When ticket sales will end (optional)</p>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isTicketSaleEnabled}
                    onChange={(e) => setFormData({ ...formData, isTicketSaleEnabled: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-slate-800 font-medium">
                    Enable ticket sales immediately after creating event
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1 ml-8">
                  If unchecked, you'll need to manually enable ticket sales later from the event dashboard
                </p>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
              >
                {loading ? 'Creating...' : 'Create Event'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="bg-slate-600 text-white px-6 py-3 rounded-lg hover:bg-slate-700 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

