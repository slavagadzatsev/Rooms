export function getRoomInviteLink(roomId) {
  if (!roomId) return 'rumo://';
  return `rumo://join/${encodeURIComponent(String(roomId))}`;
}

export function getRoomUniversalInviteLink(roomId) {
  if (!roomId) return 'https://rumo.app';
  return `https://rumo.app/join/${encodeURIComponent(String(roomId))}`;
}
