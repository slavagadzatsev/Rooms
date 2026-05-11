/**
 * TagAccordion — reusable accordion tag selector.
 * Used in CreateRoomScreen and EditProfileScreen.
 *
 * Props:
 *   selectedTags  string[]          — list of selected tag names
 *   onToggle      (tag) => void     — called when a tag is tapped
 *   palette       object            — theme palette
 *   isDark        bool
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TAG_CATEGORIES } from '../data/mockRooms';
import { colors, radius } from '../theme';

export const CATEGORY_COLORS = {
  learning:   '#6B5CE7',
  projects:   '#0ea5e9',
  content:    '#ef4444',
  networking: '#22c55e',
  hobbies:    '#f59e0b',
};

export const CATEGORY_ICONS = {
  learning:   'book-outline',
  projects:   'code-slash-outline',
  content:    'videocam-outline',
  networking: 'people-outline',
  hobbies:    'game-controller-outline',
};

export default function TagAccordion({ selectedTags, onToggle, palette, isDark }) {
  const [openCats, setOpenCats] = useState([]);

  const toggleCat = (key) =>
    setOpenCats(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );

  return (
    <View style={styles.root}>
      {TAG_CATEGORIES.map((cat) => {
        const isOpen       = openCats.includes(cat.key);
        const catColor     = CATEGORY_COLORS[cat.key] || colors.purple;
        const selectedCount = cat.tags.filter(t => selectedTags.includes(t)).length;

        return (
          <View
            key={cat.key}
            style={[
              styles.catWrap,
              { borderColor: isOpen ? catColor + '55' : palette.glass.border,
                backgroundColor: isOpen ? catColor + '0A' : palette.glass.bg },
            ]}
          >
            {/* Category header */}
            <TouchableOpacity
              style={styles.catHeader}
              onPress={() => toggleCat(cat.key)}
              activeOpacity={0.75}
            >
              <View style={styles.catLeft}>
                <View style={[styles.catIconWrap, { backgroundColor: catColor + '22' }]}>
                  <Ionicons name={CATEGORY_ICONS[cat.key] || 'pricetag-outline'} size={17} color={catColor} />
                </View>
                <Text style={[styles.catLabel, { color: palette.text }]}>{cat.label}</Text>
                {selectedCount > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: catColor }]}>
                    <Text style={styles.countText}>{selectedCount}</Text>
                  </View>
                )}
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={isOpen ? catColor : palette.faint} />
            </TouchableOpacity>

            {/* Tags */}
            {isOpen && (
              <View style={styles.tagsWrap}>
                {cat.tags.map(tag => {
                  const active = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.chip,
                        { borderColor: palette.glass.border,
                          backgroundColor: palette.glass.bgMedium },
                        active && { backgroundColor: catColor, borderColor: catColor },
                      ]}
                      onPress={() => onToggle(tag)}
                      activeOpacity={0.75}
                    >
                      {active && <Ionicons name="checkmark" size={12} color="#fff" />}
                      <Text style={[
                        styles.chipText,
                        { color: active ? '#fff' : palette.text },
                      ]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  catWrap: {
    borderRadius: 16, borderWidth: 1, overflow: 'hidden',
  },
  catHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 13,
  },
  catLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  catLabel: { fontSize: 14, fontWeight: '700' },
  countBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center',
  },
  countText:  { fontSize: 10, fontWeight: '800', color: '#fff' },
  tagsWrap: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 8, paddingHorizontal: 14, paddingBottom: 14,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: radius.pill, borderWidth: 1.5,
  },
  chipText:  { fontSize: 12.5, fontWeight: '600' },
});
