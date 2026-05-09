import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '@/constants';

interface Props {
  formatted: string;
  label?: string;
}

export default function StudyTimer({ formatted, label = '공부 시간' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.time}>{formatted}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  time: {
    fontSize: 64,
    fontWeight: '200',
    color: COLORS.textPrimary,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
});
