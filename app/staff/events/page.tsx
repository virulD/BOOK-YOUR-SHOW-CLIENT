'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function StaffEventsPage() {
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
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/team-management/my-events`,
        getAuthHeaders()
      );
      setEvents(response.data.map((item: any) => item.event));
    } catch (error) {
      console.error('Error fetching events:', error);
      if ((error as any).response?.status === 401) {
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">My Events</h1>
            <p className="text-gray-600 mt-1">Events you are assigned to</p>
          </div>
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
        </div>

        {events.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">You are not assigned to any events yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event: any) => (
              <Link
                key={event._id}
                href={`/events/${event._id}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
              >
                {event.posterImageUrl && (
                  <img
                    src={event.posterImageUrl}
                    alt={event.title}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">{event.title}</h2>
                  {event.highlightedTitle && (
                    <p className="text-gray-600 text-sm mb-4">{event.highlightedTitle}</p>
                  )}
                  <div className="text-sm text-gray-500">
                    <p>{new Date(event.startAt).toLocaleDateString()}</p>
                    <p>{event.venue?.name}</p>
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


