import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, TextInput, Switch,
} from 'react-native';
import { useStudyStore } from '@/store/useStudyStore';
import type { CoachPersonality, LLMProvider } from '@/types';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants';

const PERSONALITY_OPTIONS: { key: CoachPersonality; label: string; desc: string; emoji: string }[] = [
  { key: 'friend', label: '친구', desc: '따뜻하고 편안한 말투', emoji: '🤝' },
  { key: 'teacher', label: '선생님', desc: '명확하고 전문적인 피드백', emoji: '📚' },
  { key: 'trainer', label: '트레이너', desc: '열정적인 동기부여', emoji: '💪' },
];

const PROVIDER_OPTIONS: { key: LLMProvider; label: string; placeholder: string; desc: string }[] = [
  { key: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-api03-...', desc: 'claude-haiku-4-5-20251001' },
  { key: 'openai', label: 'OpenAI (ChatGPT)', placeholder: 'sk-proj-...', desc: 'gpt-4o-mini' },
];

export default function SettingsScreen() {
  const {
    coachPersonality, coachEnabled, ttsEnabled,
    llmProvider, apiKey, openaiApiKey,
    setCoachPersonality, setCoachEnabled, setTtsEnabled,
    setLlmProvider, setApiKey, setOpenaiApiKey,
  } = useStudyStore();

  const [anthropicInput, setAnthropicInput] = useState(apiKey);
  const [openaiInput, setOpenaiInput] = useState(openaiApiKey);
  const [keyVisible, setKeyVisible] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiKey(anthropicInput.trim());
    setOpenaiApiKey(openaiInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const currentInput = llmProvider === 'openai' ? openaiInput : anthropicInput;
  const setCurrentInput = llmProvider === 'openai' ? setOpenaiInput : setAnthropicInput;
  const currentProvider = PROVIDER_OPTIONS.find((p) => p.key === llmProvider);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>설정</Text>

        {/* 코치 ON/OFF */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI 코치</Text>
          <View style={styles.row}>
            <View>
              <Text style={styles.rowLabel}>실시간 코칭 활성화</Text>
              <Text style={styles.rowDesc}>집중도에 따라 메시지를 보내줍니다</Text>
            </View>
            <Switch
              value={coachEnabled}
              onValueChange={setCoachEnabled}
              trackColor={{ false: COLORS.bgElevated, true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.row}>
            <View>
              <Text style={styles.rowLabel}>음성 코칭 (TTS)</Text>
              <Text style={styles.rowDesc}>코치 메시지를 음성으로 읽어드려요</Text>
            </View>
            <Switch
              value={ttsEnabled}
              onValueChange={setTtsEnabled}
              trackColor={{ false: COLORS.bgElevated, true: COLORS.secondary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* 코치 스타일 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>코치 스타일</Text>
          {PERSONALITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.personalityCard, coachPersonality === opt.key && styles.personalityCardActive]}
              onPress={() => setCoachPersonality(opt.key)}
            >
              <Text style={styles.personalityEmoji}>{opt.emoji}</Text>
              <View style={styles.personalityInfo}>
                <Text style={[styles.personalityLabel, coachPersonality === opt.key && { color: COLORS.primary }]}>
                  {opt.label}
                </Text>
                <Text style={styles.personalityDesc}>{opt.desc}</Text>
              </View>
              {coachPersonality === opt.key && <Text style={styles.checkmark}>V</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* AI 모델 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI 모델 설정</Text>
          <Text style={styles.apiDesc}>
            사용할 AI 모델을 선택하고 API 키를 입력하세요.{'\n'}
            키 없이도 기본 메시지로 작동합니다.
          </Text>

          {/* 프로바이더 탭 */}
          <View style={styles.providerTabs}>
            {PROVIDER_OPTIONS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.providerTab, llmProvider === p.key && styles.providerTabActive]}
                onPress={() => setLlmProvider(p.key)}
              >
                <Text style={[styles.providerTabText, llmProvider === p.key && { color: COLORS.textPrimary }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.providerDesc}>{currentProvider?.desc}</Text>

          {/* API 키 입력 */}
          <View style={styles.apiInputRow}>
            <TextInput
              style={styles.apiInput}
              value={currentInput}
              onChangeText={setCurrentInput}
              placeholder={currentProvider?.placeholder ?? ''}
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!keyVisible}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setKeyVisible((v) => !v)} style={styles.eyeBtn}>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>
                {keyVisible ? '숨김' : '표시'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saved && { backgroundColor: COLORS.success }]}
            onPress={handleSave}
          >
            <Text style={styles.saveBtnText}>{saved ? '저장됨' : '저장'}</Text>
          </TouchableOpacity>
        </View>

        {/* 앱 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>앱 정보</Text>
          <View style={styles.infoCard}>
            <Text style={styles.appName}>StudyCoach</Text>
            <Text style={styles.version}>v0.1.0 Beta</Text>
            <Text style={styles.infoDesc}>
              CV + LLM 기반 실시간 공부 코칭 앱{'\n'}
              카메라로 집중도/감정을 분석하고 AI가 맞춤 코칭을 제공합니다.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, paddingBottom: 100, gap: SPACING.xl },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },

  section: { gap: SPACING.sm },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },

  row: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  rowDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  personalityCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  personalityCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  personalityEmoji: { fontSize: 24 },
  personalityInfo: { flex: 1 },
  personalityLabel: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  personalityDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  checkmark: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },

  providerTabs: { flexDirection: 'row', gap: SPACING.sm },
  providerTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  providerTabActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  providerTabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  providerDesc: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },

  apiDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  apiInputRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.bgElevated,
    overflow: 'hidden',
  },
  apiInput: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  eyeBtn: { padding: SPACING.md, justifyContent: 'center' },

  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  infoCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    gap: 4,
    alignItems: 'center',
  },
  appName: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  version: { fontSize: 12, color: COLORS.textMuted },
  infoDesc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
