'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect to grid editor
export default function SeatEditorPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  useEffect(() => {
    router.replace(`/organizer/events/${eventId}/seats/grid-editor`);
  }, [eventId, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <p className="text-slate-600">Redirecting to seat editor...</p>
        </div>
      </div>
    </div>
  );
}
