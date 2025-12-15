'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function UserPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      // Use public events endpoint (no authentication required)
      console.log('Fetching events from:', `${API_URL}/events/all`);
      const response = await axios.get(`${API_URL}/events`);
      console.log('Events fetched successfully:', response.data);
      setEvents(response.data);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
      });
      // Set empty array on error so UI shows "No events" message
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-slate-600">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-slate-800">Browse Events</h1>
          <p className="text-slate-600">Find and book tickets for upcoming events in Sri Lanka</p>
        </div>

        {events.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-slate-100">
            <p className="text-slate-600 text-lg">No events available at the moment.</p>
            <p className="text-slate-500 text-sm mt-2">Check back later for new events!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Link
                key={event._id}
                href={`/events/${event._id}`}
                className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-slate-100 overflow-hidden group"
              >
                {event.posterImageUrl && (
                  <div className="w-full h-48 overflow-hidden bg-slate-200">
                    <img
                      src={event.posterImageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2 text-slate-800 group-hover:text-indigo-600 transition-colors">
                    {event.title}
                  </h3>
                  {event.highlightedTitle && (
                    <p className="text-indigo-600 font-medium text-sm mb-2">
                      {event.highlightedTitle}
                    </p>
                  )}
                  <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                    {event.description || 'No description available'}
                  </p>
                  <div className="space-y-2 text-sm text-slate-500">
                    <p className="flex items-center gap-2">
                      <span>📍</span> {event.venue?.name}
                    </p>
                    <p className="flex items-center gap-2">
                      <span>📅</span> {event.startAt ? new Date(event.startAt).toLocaleString() : 'TBA'}
                    </p>
                    <p className="flex items-center gap-2">
                      <span>💰</span> {event.startingPrice ? `Rs. ${event.startingPrice} onwards` : `LKR ${event.defaultPrice}`}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

