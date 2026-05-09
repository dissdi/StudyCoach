import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { CameraView, CameraType } from 'expo-camera';
import { FaceDetector } from 'expo-face-detector';
import type { FaceDetectionResult } from 'expo-face-detector';
import { COLORS, BORDER_RADIUS } from '@/constants';

interface Props {
  onFacesDetected: (result: FaceDetectionResult) => void;
  isActive: boolean;
}

export default function CameraFeed({ onFacesDetected, isActive }: Props) {
  if (!isActive) {
    return (
      <View style={[styles.container, styles.placeholder]}>
        <Text style={styles.placeholderIcon}>📷</Text>
        <Text style={styles.placeholderText}>카메라 준비 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={'front' as CameraType}
        onFacesDetected={onFacesDetected}
        faceDetectorSettings={{
          mode: FaceDetector.Constants.Mode.fast,
          detectLandmarks: FaceDetector.Constants.Landmarks.none,
          runClassifications: FaceDetector.Constants.Classifications.all,
          minDetectionInterval: 500,
          tracking: true,
        }}
      />
      {/* 모서리 프레임 오버레이 */}
      <View style={styles.cornerTL} />
      <View style={styles.cornerTR} />
      <View style={styles.cornerBL} />
      <View style={styles.cornerBR} />
    </View>
  );
}

const CORNER_SIZE = 18;
const CORNER_WIDTH = 2.5;
const CORNER_COLOR = COLORS.primary;

const cornerBase: object = {
  position: 'absolute',
  width: CORNER_SIZE,
  height: CORNER_SIZE,
  borderColor: CORNER_COLOR,
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  placeholderIcon: { fontSize: 32 },
  placeholderText: { color: COLORS.textMuted, fontSize: 13 },

  // 모서리 꾸미기
  cornerTL: {
    ...cornerBase,
    top: 10,
    left: 10,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    ...cornerBase,
    top: 10,
    right: 10,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    ...cornerBase,
    bottom: 10,
    left: 10,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    ...cornerBase,
    bottom: 10,
    right: 10,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 6,
  },
});
