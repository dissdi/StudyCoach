import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { getFocusColor } from '@/services/cvService';
import { COLORS, BORDER_RADIUS } from '@/constants';

interface Props {
  score: number;          // 0~100
  emotion: string;
  emotionEmoji: string;
  emotionLabel: string;
}

export default function FocusIndicator({ score, emotionEmoji, emotionLabel }: Props) {
  const animWidth = useRef(new Animated.Value(0)).current;
  const color = getFocusColor(score);

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: score,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [score]);

  return (
    <View style={styles.container}>
      {/* Score header */}
      <View style={styles.header}>
        <Text style={styles.labelText}>집중도</Text>
        <View style={styles.rightRow}>
          <Text style={styles.emojiText}>{emotionEmoji}</Text>
          <Text style={styles.emotionText}>{emotionLabel}</Text>
          <Text style={[styles.scoreText, { color }]}>{score}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              width: animWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emojiText: { fontSize: 16 },
  emotionText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginLeft: 4,
  },
  barTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
});
