import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <RootNavigator />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
