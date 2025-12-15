'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function OrganizerEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    fetchEvents();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found in localStorage');
        router.push('/auth/login');
        return;
      }

      const response = await axios.get(`${API_URL}/organizer/events`, getAuthHeaders());
      setEvents(response.data);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      if (error.response?.status === 401 || !localStorage.getItem('token')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/auth/login');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading events...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">My Events</h1>
          <div className="flex gap-4">
            <button
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                router.push('/auth/login');
              }}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Logout
            </button>
            <Link
              href="/organizer/events/new"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
            >
              Create New Event
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div key={event._id} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-slate-100">
              <h2 className="text-xl font-semibold mb-2 text-slate-800">{event.title}</h2>
              {event.highlightedTitle && (
                <p className="text-indigo-600 font-medium text-sm mb-2">
                  {event.highlightedTitle}
                </p>
              )}
              <p className="text-slate-600 mb-4 line-clamp-2">{event.description}</p>
              <div className="text-sm text-slate-500 mb-4 space-y-1">
                <p className="flex items-center gap-2">
                  <span className="text-indigo-500">📍</span> {event.venue.name}
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-indigo-500">📅</span> {new Date(event.startAt).toLocaleString()}
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-indigo-500">🎫</span> {event.eventType}
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-indigo-500">💰</span> {event.startingPrice ? `Rs. ${event.startingPrice} onwards` : `LKR ${event.defaultPrice}`}
                </p>
              </div>
              <div className="mb-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Ticket Sales:</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    event.isTicketSaleEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {event.isTicketSaleEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('token');
                      await axios.put(
                        `${API_URL}/organizer/events/${event._id}/toggle-ticket-sale`,
                        { enabled: !event.isTicketSaleEnabled },
                        {
                          headers: {
                            Authorization: `Bearer ${token}`,
                          },
                        }
                      );
                      fetchEvents();
                    } catch (error: any) {
                      alert(error.response?.data?.message || 'Failed to toggle ticket sales');
                    }
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    event.isTicketSaleEnabled
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {event.isTicketSaleEnabled ? 'Disable Ticket Sales' : 'Enable Ticket Sales'}
                </button>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100 flex-wrap">
                <Link
                  href={`/organizer/events/${event._id}/seats`}
                  className="flex-1 bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors text-center font-medium text-sm"
                >
                  Edit Seats
                </Link>
                <Link
                  href={`/organizer/events/${event._id}/team`}
                  className="flex-1 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors text-center font-medium text-sm"
                >
                  Team
                </Link>
                <Link
                  href={`/events/${event._id}`}
                  className="flex-1 bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors text-center font-medium text-sm"
                >
                  View Public
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

