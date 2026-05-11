/**
 * Shared room utility functions — imported by both AppContext and roomsService
 * to avoid logic drift between the two copies.
 */

/**
 * Returns how many pulses are needed to revive a room based on its max capacity.
 * @param {number} maxMembers — room capacity (not current count)
 */
export function getPulseGoal(maxMembers) {
  const members = Math.max(1, maxMembers || 1);
  if (members <= 2)  return members;
  if (members <= 5)  return 2;
  if (members <= 10) return Math.ceil(members * 0.4);
  return Math.ceil(members * 0.3);
}
