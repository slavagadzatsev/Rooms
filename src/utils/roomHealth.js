export function getRoomHealth(room) {
  const daysLeft = room.daysLeft ?? room.lifetime ?? 14;
  const maxMembers = Math.max(1, room.maxMembers || 1);
  const membersCount = room.membersCount || 0;
  const spotsLeft = Math.max(0, maxMembers - membersCount);
  const online = room.online || 0;
  const activeToday = room.activeToday || 0;
  const fillRatio = membersCount / maxMembers;
  const onlineRatio = online / maxMembers;

  if (room.wasInRoom || daysLeft <= 0) {
    return {
      key: 'expired',
      label: 'Expired',
      description: 'This room is no longer active.',
      iconName: 'archive-outline',
      tone: 'muted',
    };
  }

  if (daysLeft <= 3 && !room.hasPulsed) {
    return {
      key: 'needs_pulse',
      label: 'Needs pulse',
      description: 'The room is close to expiring and needs activity.',
      iconName: 'flame-outline',
      tone: 'danger',
    };
  }

  if (spotsLeft <= 2 || fillRatio >= 0.85) {
    return {
      key: 'almost_full',
      label: 'Almost full',
      description: `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left for new people.`,
      iconName: 'people-circle-outline',
      tone: 'warning',
    };
  }

  if (onlineRatio >= 0.35 || activeToday >= Math.ceil(maxMembers * 0.3)) {
    return {
      key: 'active',
      label: 'Active now',
      description: `${online} ${online === 1 ? 'person is' : 'people are'} online.`,
      iconName: 'radio-button-on-outline',
      tone: 'success',
    };
  }

  if (online <= 1 && activeToday <= 1) {
    return {
      key: 'quiet',
      label: 'Quiet',
      description: 'Low activity right now, but the room is still open.',
      iconName: 'moon-outline',
      tone: 'muted',
    };
  }

  return {
    key: 'healthy',
    label: 'Healthy',
    description: 'The room has space and steady activity.',
    iconName: 'pulse-outline',
    tone: 'primary',
  };
}

export function getRoomHealthColors(health, palette, colors) {
  const purple = palette.isDark ? '#c4b8ff' : colors.purple;
  const map = {
    success: { fg: colors.green, bg: colors.green + '16', border: colors.green + '40' },
    danger: { fg: colors.red, bg: colors.red + '14', border: colors.red + '42' },
    warning: { fg: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b44' },
    muted: { fg: palette.muted, bg: palette.glass.bgMedium, border: palette.glass.border },
    primary: { fg: purple, bg: palette.glass.purpleBg, border: palette.glass.purpleBorder },
  };
  return map[health.tone] || map.primary;
}
