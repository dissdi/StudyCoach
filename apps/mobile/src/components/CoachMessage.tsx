import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import type { CoachMessage as CoachMsg } from '@/types';
import { COLORS, BORDER_RADIUS } from '@/constants';

interface Props {
  message: CoachMsg | null;
}

const TONE_COLOR: Record<string, string> = {
  encouraging: COLORS.success,
  strict: COLORS.warning,
  calm: COLORS.secondary,
};

export default function CoachMessage({ message }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!message) return;

    fadeAnim.setValue(0);
    slideAnim.setValue(16);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 18,
        stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [message?.id]);

  if (!message) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>코치가 지켜보고 있어요 👀</Text>
      </View>
    );
  }

  const accentColor = TONE_COLOR[message.tone] ?? COLORS.primary;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          borderLeftColor: accentColor,
        },
      ]}
    >
      <Text style={styles.coachLabel}>🤖 코치</Text>
      <Text style={styles.messageText}>{message.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  placeholderText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  container: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    padding: 14,
    gap: 6,
  },
  coachLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  messageText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
    fontWeight: '500',
  },
});
