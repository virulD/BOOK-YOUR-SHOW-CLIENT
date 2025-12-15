'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function BookingSuccessPage() {
  const params = useParams();
  const reservationId = params.reservationId as string;
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookingDetails();
  }, [reservationId]);

  const fetchBookingDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/bookings/${reservationId}/details`);
      setBookingDetails(response.data);
    } catch (error) {
      console.error('Error fetching booking details:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = () => {
    if (!bookingDetails) return;

    // Create a printable receipt HTML
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Booking Receipt - ${bookingDetails.reservationId}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #4f46e5;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #4f46e5;
              margin: 0;
            }
            .info-section {
              margin-bottom: 30px;
            }
            .info-section h2 {
              color: #4f46e5;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 10px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #f3f4f6;
            }
            .info-label {
              font-weight: 600;
              color: #6b7280;
            }
            .info-value {
              color: #111827;
            }
            .seats-list {
              margin: 15px 0;
            }
            .seat-item {
              padding: 8px;
              background: #f9fafb;
              margin: 5px 0;
              border-radius: 4px;
            }
            .amount-summary {
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              margin-top: 20px;
            }
            .amount-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
            }
            .total-row {
              border-top: 2px solid #4f46e5;
              margin-top: 10px;
              padding-top: 10px;
              font-size: 1.2em;
              font-weight: bold;
              color: #4f46e5;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 0.9em;
            }
            @media print {
              body {
                padding: 0;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Booking Receipt</h1>
            <p>Thank you for your booking!</p>
          </div>

          <div class="info-section">
            <h2>Reservation Information</h2>
            <div class="info-row">
              <span class="info-label">Reservation ID:</span>
              <span class="info-value">${bookingDetails.reservationId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Booking Date:</span>
              <span class="info-value">${new Date(bookingDetails.createdAt).toLocaleString()}</span>
            </div>
            ${bookingDetails.paymentIntentId ? `
            <div class="info-row">
              <span class="info-label">Payment ID:</span>
              <span class="info-value">${bookingDetails.paymentIntentId}</span>
            </div>
            ` : ''}
          </div>

          <div class="info-section">
            <h2>Event Information</h2>
            <div class="info-row">
              <span class="info-label">Event Name:</span>
              <span class="info-value">${bookingDetails.event?.name || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span class="info-value">${bookingDetails.event?.date ? new Date(bookingDetails.event.date).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Venue:</span>
              <span class="info-value">${bookingDetails.event?.venue?.name || 'N/A'}</span>
            </div>
          </div>

          <div class="info-section">
            <h2>Seats & Tickets</h2>
            <div class="seats-list">
              ${bookingDetails.seats.map((seat: any) => `
                <div class="seat-item">
                  <strong>${seat.label}</strong>
                  ${seat.ticketType ? ` - ${seat.ticketType}` : ''}
                </div>
              `).join('')}
            </div>
            <div class="info-row" style="margin-top: 15px;">
              <span class="info-label">Total Seats:</span>
              <span class="info-value">${bookingDetails.seats.length}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Adults:</span>
              <span class="info-value">${bookingDetails.bookings.reduce((sum: number, b: any) => sum + (b.adultCount || 0), 0)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Kids:</span>
              <span class="info-value">${bookingDetails.bookings.reduce((sum: number, b: any) => sum + (b.kidCount || 0), 0)}</span>
            </div>
          </div>

          <div class="info-section">
            <h2>Payment Summary</h2>
            <div class="amount-summary">
              <div class="amount-row">
                <span>Subtotal:</span>
                <span>LKR ${bookingDetails.amountSummary?.subtotal?.toFixed(2) || '0.00'}</span>
              </div>
              <div class="amount-row">
                <span>Commission:</span>
                <span>LKR ${bookingDetails.amountSummary?.commission?.toFixed(2) || '0.00'}</span>
              </div>
              <div class="amount-row">
                <span>Taxes:</span>
                <span>LKR ${bookingDetails.amountSummary?.taxes?.toFixed(2) || '0.00'}</span>
              </div>
              <div class="amount-row total-row">
                <span>Total Paid:</span>
                <span>LKR ${bookingDetails.amountSummary?.total?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>This is a computer-generated receipt. No signature required.</p>
            <p>For support, please contact the event organizer.</p>
          </div>
        </body>
      </html>
    `;

    // Open print dialog
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-slate-600">Loading receipt...</div>
      </div>
    );
  }

  if (!bookingDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-rose-600">Error loading booking details</div>
      </div>
    );
  }

  const amountSummary = bookingDetails.amountSummary || {
    subtotal: 0,
    commission: 0,
    taxes: 0,
    total: 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 border border-slate-100">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold mb-2 text-slate-800">Booking Confirmed!</h1>
            <p className="text-slate-600">
              Your payment was successful and your tickets have been issued.
            </p>
          </div>

          {/* Receipt */}
          <div className="mb-8 p-6 bg-gradient-to-br from-slate-50 to-indigo-50 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Receipt</h2>
              <button
                onClick={downloadReceipt}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all duration-200 font-medium"
              >
                📄 Download Receipt
              </button>
            </div>

            <div className="space-y-6">
              {/* Reservation Info */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Reservation Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Reservation ID:</span>
                    <span className="font-medium text-slate-800">{bookingDetails.reservationId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Booking Date:</span>
                    <span className="font-medium text-slate-800">
                      {new Date(bookingDetails.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {bookingDetails.paymentIntentId && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Payment ID:</span>
                      <span className="font-medium text-slate-800">{bookingDetails.paymentIntentId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Event Info */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Event Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Event Name:</span>
                    <span className="font-medium text-slate-800">{bookingDetails.event?.name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Date:</span>
                    <span className="font-medium text-slate-800">
                      {bookingDetails.event?.date ? new Date(bookingDetails.event.date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Venue:</span>
                    <span className="font-medium text-slate-800">
                      {bookingDetails.event?.venue?.name || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Seats */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Seats & Tickets</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                  {bookingDetails.seats.map((seat: any) => (
                    <div
                      key={seat._id}
                      className="p-3 bg-white rounded-lg border border-slate-200 text-center"
                    >
                      <div className="font-semibold text-slate-800">{seat.label}</div>
                      {seat.ticketType && (
                        <div className="text-xs text-indigo-600 mt-1">{seat.ticketType}</div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-sm pt-3 border-t border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Seats:</span>
                    <span className="font-medium text-slate-800">{bookingDetails.seats.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Adults:</span>
                    <span className="font-medium text-slate-800">
                      {bookingDetails.bookings.reduce((sum: number, b: any) => sum + (b.adultCount || 0), 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Kids:</span>
                    <span className="font-medium text-slate-800">
                      {bookingDetails.bookings.reduce((sum: number, b: any) => sum + (b.kidCount || 0), 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Payment Summary</h3>
                <div className="p-4 bg-white rounded-lg border border-slate-200">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Subtotal:</span>
                      <span className="font-medium text-slate-800">
                        LKR {amountSummary.subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Commission:</span>
                      <span className="font-medium text-slate-800">
                        LKR {amountSummary.commission.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Taxes:</span>
                      <span className="font-medium text-slate-800">
                        LKR {amountSummary.taxes.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-3 border-t border-slate-300 text-indigo-600">
                      <span>Total Paid:</span>
                      <span>LKR {amountSummary.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Download Tickets */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-700 mb-4">Download Tickets</h3>
            <div className="space-y-3">
              {bookingDetails.bookings.map((booking: any) => (
                <div
                  key={booking.bookingId}
                  className="border border-slate-200 rounded-xl p-4 flex justify-between items-center bg-gradient-to-r from-slate-50 to-indigo-50 hover:shadow-md transition-shadow"
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      Booking ID: {booking.bookingId}
                    </p>
                    <p className="text-sm text-slate-600">
                      Seat: {booking.seatId?.label || 'N/A'}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const response = await axios.get(`${API_URL}/tickets/booking/${booking.bookingId}`, {
                          responseType: 'blob',
                        });
                        const url = window.URL.createObjectURL(new Blob([response.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', `ticket-${booking.bookingId}.pdf`);
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                      } catch (error) {
                        console.error('Error downloading ticket:', error);
                        alert('Error downloading ticket');
                      }
                    }}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                  >
                    Download Ticket
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center pt-6 border-t border-slate-200">
            <Link
              href="/user"
              className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              ← Return to Events
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
