'use strict';

const ROOMS = [
  {
    id: '101',
    name: 'Room 101',
    type: 'Standard',
    description: 'Comfortable room with city view, ideal for solo travellers or couples.',
    baseRate: 120,
    maxGuests: 2,
    minNights: 1,
    amenities: ['WiFi', 'TV', 'Air Conditioning'],
  },
  {
    id: '102',
    name: 'Room 102',
    type: 'Standard',
    description: 'Cosy room overlooking the garden, quiet and well-appointed.',
    baseRate: 120,
    maxGuests: 2,
    minNights: 1,
    amenities: ['WiFi', 'TV', 'Air Conditioning', 'Mini Fridge'],
  },
  {
    id: '201',
    name: 'Room 201',
    type: 'Deluxe',
    description: 'Spacious deluxe room with panoramic skyline views and premium furnishings.',
    baseRate: 180,
    maxGuests: 3,
    minNights: 1,
    amenities: ['WiFi', 'Smart TV', 'Mini Bar', 'Jacuzzi'],
  },
  {
    id: '202',
    name: 'Room 202',
    type: 'Deluxe',
    description: 'Elegant deluxe room with private balcony and king-size bed.',
    baseRate: 180,
    maxGuests: 3,
    minNights: 1,
    amenities: ['WiFi', 'Smart TV', 'Mini Bar', 'Balcony'],
  },
  {
    id: '301',
    name: 'Room 301',
    type: 'Suite',
    description: 'Luxurious suite with private terrace, butler service, and full dining area.',
    baseRate: 300,
    maxGuests: 4,
    minNights: 3,
    amenities: ['WiFi', '4K TV', 'Full Bar', 'Private Terrace', 'Butler Service', 'Jacuzzi'],
  },
];

let reservations = [];

function getRooms() { return ROOMS; }

function getRoomById(id) { return ROOMS.find(r => r.id === id) || null; }

function getReservations() { return reservations; }

function getReservationById(id) { return reservations.find(r => r.id === id) || null; }

function addReservation(res) { reservations.push(res); return res; }

function updateReservation(id, updates) {
  const idx = reservations.findIndex(r => r.id === id);
  if (idx === -1) return null;
  reservations[idx] = { ...reservations[idx], ...updates };
  return reservations[idx];
}

function resetReservations() { reservations = []; }

function hasConflict(roomId, checkIn, checkOut, excludeId = null) {
  return reservations.some(r => {
    if (r.id === excludeId) return false;
    if (r.roomId !== roomId) return false;
    if (r.status === 'cancelled') return false;
    return r.checkIn < checkOut && r.checkOut > checkIn;
  });
}

module.exports = {
  getRooms, getRoomById,
  getReservations, getReservationById,
  addReservation, updateReservation,
  resetReservations, hasConflict,
};
