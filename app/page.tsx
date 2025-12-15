import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Book Your Show
          </h1>
          <p className="text-xl text-slate-600">
            Sri Lanka Events Booking Platform
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Link
            href="/user"
            className="bg-white rounded-xl shadow-lg p-8 hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-slate-100 group"
          >
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 group-hover:text-indigo-600 transition-colors">Browse Events</h2>
            <p className="text-slate-600 mb-4">
              Find and book tickets for upcoming events in Sri Lanka
            </p>
            <div className="text-indigo-600 font-medium flex items-center gap-2">
              Browse Events 
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>

          <Link
            href="/organizer/events"
            className="bg-white rounded-xl shadow-lg p-8 hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-slate-100 group"
          >
            <h2 className="text-2xl font-semibold mb-4 text-slate-800 group-hover:text-indigo-600 transition-colors">Organizer Portal</h2>
            <p className="text-slate-600 mb-4">
              Create events, design seat maps, and manage bookings
            </p>
            <div className="text-indigo-600 font-medium flex items-center gap-2">
              Go to Organizer Portal 
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
