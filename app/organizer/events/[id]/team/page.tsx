'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface TeamMember {
  id: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  permissions: string[];
  isActive: boolean;
}

const PERMISSIONS = [
  { value: 'manage_bookings', label: 'Manage Bookings' },
  { value: 'view_bookings', label: 'View Bookings' },
  { value: 'edit_seat_layout', label: 'Edit Seat Layout' },
  { value: 'view_seat_layout', label: 'View Seat Layout' },
  { value: 'validate_tickets', label: 'Validate Tickets' },
  { value: 'view_reports', label: 'View Reports' },
  { value: 'view_analytics', label: 'View Analytics' },
  { value: 'view_attendees', label: 'View Attendees' },
  { value: 'support_attendees', label: 'Support Attendees' },
  { value: 'edit_event', label: 'Edit Event' },
  { value: 'view_event', label: 'View Event' },
];

export default function TeamManagementPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'event_staff',
    phoneNumber: '',
    permissions: [] as string[],
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTeamMembers();
  }, [eventId]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  const fetchTeamMembers = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/team-management/events/${eventId}/team`,
        getAuthHeaders()
      );
      setTeamMembers(response.data);
    } catch (err: any) {
      console.error('Error fetching team members:', err);
      if (err.response?.status === 401) {
        router.push('/auth/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await axios.post(
        `${API_URL}/team-management/staff`,
        {
          ...formData,
          eventId,
        },
        getAuthHeaders()
      );
      setShowAddForm(false);
      setFormData({
        email: '',
        name: '',
        role: 'event_staff',
        phoneNumber: '',
        permissions: [],
      });
      fetchTeamMembers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add staff member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePermission = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleRemoveStaff = async (teamMemberId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/team-management/team/${teamMemberId}`, getAuthHeaders());
      fetchTeamMembers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove staff member');
    }
  };

  if (loading) {
    return <div className="p-8">Loading team members...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Team Management</h1>
            <p className="text-gray-600 mt-1">Manage staff members for this event</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              {showAddForm ? 'Cancel' : '+ Add Staff Member'}
            </button>
            <Link
              href={`/organizer/events/${eventId}`}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Back to Event
            </Link>
          </div>
        </div>

        {showAddForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Add Staff Member</h2>
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const role = e.target.value;
                      setFormData({
                        ...formData,
                        role,
                        permissions: role === 'event_admin' 
                          ? PERMISSIONS.filter(p => p.value !== 'validate_tickets' && p.value !== 'support_attendees').map(p => p.value)
                          : PERMISSIONS.filter(p => ['validate_tickets', 'view_attendees', 'support_attendees', 'view_bookings', 'view_seat_layout', 'view_event'].includes(p.value)).map(p => p.value),
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="event_staff">Event Staff</option>
                    <option value="event_admin">Event Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permissions
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PERMISSIONS.map((perm) => (
                    <label key={perm.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.value)}
                        onChange={() => handleTogglePermission(perm.value)}
                        className="rounded"
                      />
                      <span className="text-sm">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add Staff Member'}
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teamMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No team members assigned yet
                  </td>
                </tr>
              ) : (
                teamMembers.map((member) => (
                  <tr key={member.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {member.user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {member.user.role === 'event_admin' ? 'Event Admin' : 'Event Staff'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex flex-wrap gap-1">
                        {member.permissions.slice(0, 3).map((perm) => (
                          <span
                            key={perm}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                          >
                            {PERMISSIONS.find((p) => p.value === perm)?.label || perm}
                          </span>
                        ))}
                        {member.permissions.length > 3 && (
                          <span className="px-2 py-1 text-xs text-gray-500">
                            +{member.permissions.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleRemoveStaff(member.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


