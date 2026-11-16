import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Keyboard,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  setupNotifications,
  scheduleDailyReminders,
  snoozeFiveMinutes,
  testReminder,
} from './src/notifications';
const {
  DEFAULT_SETTINGS,
  buildDailySlots,
  dateKey,
  formatClock,
  mmss,
  nextSlot,
  isActiveAt,
  parseClock,
} = require('./src/logic.cjs');

const SETTINGS_KEY = 'kalk:settings:v1';
const STATS_KEY = 'kalk:stats:v1';
const BREAK_KEY = 'kalk:break-end:v1';
const BG = '#F5F7EC';
const INK = '#17211B';
const MUTED = '#728078';
const GREEN = '#DAF06B';
const LINE = '#DFE5DA';

function Label({ children, style }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

function Pill({ children, selected, onPress, disabled }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.pill, selected && styles.pillSelected]}>
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{children}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress, disabled, secondary = false }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, disabled && { opacity: 0.45 }]}>
      <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{label}</Text>
    </Pressable>
  );
}

function SmallButton({ label, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.smallButton, disabled && { opacity: 0.4 }]}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function SettingSwitch({ title, description, value, onValueChange, disabled }) {
  return (
    <View style={styles.settingRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onValueChange} trackColor={{ false: '#D7DED3', true: '#ADCA49' }} thumbColor="#FFFFFF" />
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const settingsRef = useRef({ ...DEFAULT_SETTINGS });
  const [screen, setScreen] = useState('home');
  const [clockNow, setClockNow] = useState(Date.now());
  const [breakEnd, setBreakEnd] = useState(null);
  const [stats, setStats] = useState({ day: dateKey(), completed: 0, snoozed: 0 });
  const [quietFrom, setQuietFrom] = useState(DEFAULT_SETTINGS.quietStart);
  const [quietTo, setQuietTo] = useState(DEFAULT_SETTINGS.quietEnd);
  const handledRef = useRef('');
  const [feedback, setFeedback] = useState('');

  const incStat = useCallback(async (type) => {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    let s = raw ? JSON.parse(raw) : { day: dateKey(), completed: 0, snoozed: 0 };
    if (s.day !== dateKey()) s = { day: dateKey(), completed: 0, snoozed: 0 };
    s = { ...s, [type]: Number(s[type] || 0) + 1 };
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(s));
    setStats(s);
  }, []);

  const startBreak = useCallback(async () => {
    const end = Date.now() + settingsRef.current.breakMinutes * 60 * 1000;
    setBreakEnd(end);
    await AsyncStorage.setItem(BREAK_KEY, String(end));
    setFeedback('');
    setScreen('home');
  }, []);

  const deferBreak = useCallback(async () => {
    try {
      const when = await snoozeFiveMinutes(settingsRef.current);
      await incStat('snoozed');
      setFeedback(`${formatClock(when.getHours() * 60 + when.getMinutes())} için ertelendi.`);
      setScreen('home');
    } catch (error) {
      Alert.alert('Erteleme yapılamadı', String(error.message || error));
    }
  }, [incStat]);

  const processResponse = useCallback(async (response) => {
    if (!response || response.notification.request.content.data?.kind !== 'break') return;
    const token = `${response.notification.request.identifier}:${response.notification.date}:${response.actionIdentifier}`;
    if (handledRef.current === token) return;
    handledRef.current = token;
    if (response.actionIdentifier === 'SNOOZE_BREAK') {
      await deferBreak();
    } else {
      await startBreak();
    }
    await Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [deferBreak, startBreak]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await setupNotifications();
        const [savedSettings, savedStats, savedBreak] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(STATS_KEY),
          AsyncStorage.getItem(BREAK_KEY),
        ]);
        if (!mounted) return;
        const s = savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : { ...DEFAULT_SETTINGS };
        settingsRef.current = s;
        setSettings(s);
        setQuietFrom(s.quietStart);
        setQuietTo(s.quietEnd);
        if (savedBreak) setBreakEnd(Number(savedBreak));
        const stored = savedStats ? JSON.parse(savedStats) : { day: dateKey(), completed: 0, snoozed: 0 };
        setStats(stored.day === dateKey() ? stored : { day: dateKey(), completed: 0, snoozed: 0 });
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response) await processResponse(response);
      } catch (error) {
        Alert.alert('Başlatma hatası', String(error.message || error));
      } finally {
        if (mounted) setReady(true);
      }
    };
    init();
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      processResponse(response).catch((error) => Alert.alert('Bildirim', String(error.message || error)));
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') setClockNow(Date.now());
    });
    return () => { mounted = false; subscription.remove(); appState.remove(); };
  }, [processResponse]);

  useEffect(() => {
    const id = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const updateSettings = useCallback(async (change) => {
    const next = { ...settingsRef.current, ...change };
    setBusy(true);
    try {
      const count = await scheduleDailyReminders(next);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      settingsRef.current = next;
      setSettings(next);
      setFeedback(next.enabled ? `${count} günlük hatırlatma saati ayarlandı.` : 'Hatırlatmalar kapatıldı.');
      return true;
    } catch (error) {
      Alert.alert('Ayar kaydedilemedi', String(error.message || error));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const finishBreak = useCallback(async () => {
    await AsyncStorage.removeItem(BREAK_KEY);
    setBreakEnd(null);
    await incStat('completed');
    setFeedback('Bir mola tamamlandı.');
  }, [incStat]);

  const saveQuietHours = useCallback(async () => {
    Keyboard.dismiss();
    const from = parseClock(quietFrom);
    const to = parseClock(quietTo);
    if (from === null || to === null || from === to) {
      Alert.alert('Saat biçimi', 'Saatleri 22:00 gibi yaz ve farklı iki saat seç.');
      return;
    }
    await updateSettings({ quietStart: quietFrom, quietEnd: quietTo });
  }, [quietFrom, quietTo, updateSettings]);

  if (!ready) {
    return <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={INK} /><Text style={{ marginTop: 12, color: MUTED }}>KALK. hazırlanıyor</Text></SafeAreaView>;
  }

  const slots = buildDailySlots(settings);
  const upcoming = settings.enabled ? nextSlot(slots, new Date(clockNow)) : null;
  const inBreak = breakEnd !== null;
  const timeLeft = inBreak ? Math.max(0, breakEnd - clockNow) : upcoming ? Math.max(0, upcoming.getTime() - clockNow) : settings.workMinutes * 60000;
  const nextTime = upcoming ? `${String(upcoming.getHours()).padStart(2, '0')}:${String(upcoming.getMinutes()).padStart(2, '0')}` : '—';
  const isQuietNow = settings.enabled && !isActiveAt(new Date(clockNow), settings);
  const dayStats = stats.day === dateKey() ? stats : { completed: 0, snoozed: 0 };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => setScreen('home')}>
            <Text style={styles.wordmark}>KALK<Text style={{ color: '#8AAA2A' }}>.</Text></Text>
            <Text style={styles.headerSubtitle}>OTURMA, HAREKET ET.</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setScreen(screen === 'home' ? 'settings' : 'home'); setFeedback(''); }} style={styles.headerAction}>
            <Text style={styles.headerActionText}>{screen === 'home' ? 'AYARLAR  ↗' : '←  GERİ'}</Text>
          </Pressable>
        </View>

        {screen === 'home' ? (
          <>
            <View style={styles.hero}>
              <View style={styles.statusPill}>
                <View style={[styles.statusDot, { backgroundColor: settings.enabled ? '#7CAA42' : '#B1B9AE' }]} />
                <Text style={styles.statusText}>{!settings.enabled ? 'HATIRLATMALAR KAPALI' : inBreak ? 'MOLA ZAMANI' : isQuietNow ? 'GECE SESSİZ MODU' : 'HATIRLATMALAR AÇIK'}</Text>
              </View>
              <Image source={require('./assets/mascot.png')} style={styles.mascot} resizeMode="contain" accessibilityLabel="KALK uygulamasının çizgi karakteri" />
              <Text style={styles.heroTitle}>{inBreak ? 'Biraz hareket.' : settings.enabled ? 'Azıcık kalk.' : 'Hadi başlayalım.'}</Text>
              <Text style={styles.heroSub}>{inBreak ? `${settings.breakMinutes} dakika da olsa bir tur at.`: 'Çalışırken zamanı unutmak kolay. Ben hatırlatırım.'}</Text>
            </View>

            <View style={styles.timerCard}>
              <View style={styles.timerTop}>
                <Label>{inBreak ? 'MOLA SAYACI' : settings.enabled ? 'BİR SONRAKİ DÜRTMEYE' : 'HAZIR OLDUĞUNDA BAŞLAT'}</Label>
                <Text style={styles.timerTopRight}>{inBreak ? `${settings.breakMinutes} DK MOLA` : settings.enabled ? nextTime : `${settings.workMinutes} DK`}</Text>
              </View>
              <Text style={[styles.timer, timeLeft >= 100 * 60000 && { fontSize: 56, letterSpacing: -2 }]}>{mmss(timeLeft)}</Text>
              <View style={styles.timerTrack}><View style={[styles.timerProgress, { width: `${Math.max(1, Math.min(100, inBreak ? 100 * (1 - timeLeft / (settings.breakMinutes * 60000)) : 100 * (1 - timeLeft / ((settings.workMinutes + settings.breakMinutes) * 60000))))}%` }]} /></View>
              <Text style={styles.timerFoot}>{inBreak ? timeLeft > 0 ? 'Yürü, esne, su iç.' : 'Mola süren doldu. Tamamladıysan kaydet.' : isQuietNow ? `Bildirimler ${settings.quietEnd} itibarıyla devam edecek.` : `${settings.workMinutes} dk çalışma + ${settings.breakMinutes} dk hareket`}</Text>
            </View>

            <View style={styles.actions}>
              {inBreak ? (
                <PrimaryButton label="Molayı tamamladım  ✓" onPress={finishBreak} disabled={busy} />
              ) : settings.enabled ? (
                <>
                  <PrimaryButton label="Molayı şimdi başlat  ↗" onPress={startBreak} disabled={busy} />
                  <PrimaryButton label="5 dk ertele" onPress={deferBreak} disabled={busy} secondary />
                </>
              ) : <PrimaryButton label="Hatırlatmaları başlat  ↗" onPress={() => updateSettings({ enabled: true })} disabled={busy} />}
            </View>

            {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

            <View style={styles.statsRow}>
              <View style={styles.statCard}><Label>BUGÜN TAMAMLANAN</Label><Text style={styles.statNumber}>{dayStats.completed}</Text><Text style={styles.statDesc}>hareket molası</Text></View>
              <View style={styles.statCard}><Label>BUGÜN ERTELENEN</Label><Text style={styles.statNumber}>{dayStats.snoozed}</Text><Text style={styles.statDesc}>hatırlatma</Text></View>
            </View>
            <View style={styles.footerNote}><Text style={styles.footerText}>Gece sessiz modu {settings.quietEnabled ? `${settings.quietStart}–${settings.quietEnd} arasında açık.` : 'kapalı.'}  ·  <Text style={styles.footerLink} onPress={() => setScreen('settings')}>Değiştir</Text></Text></View>
          </>
        ) : (
          <>
            <View style={styles.settingsIntro}><Text style={styles.screenTitle}>İyi bir mola.</Text><Text style={styles.settingsIntroDesc}>İstediğin zaman dürt. Gece ise tamamen sessiz.</Text></View>

            <View style={styles.settingsCard}>
              <SettingSwitch title="Bildirimler" description="Tüm hareket hatırlatmalarını aç veya kapat." value={settings.enabled} disabled={busy} onValueChange={(enabled) => updateSettings({ enabled })} />
              <View style={styles.horizontalLine} />
              <SettingSwitch title="Gece sessiz modu" description="Bu saatler arasında hiçbir otomatik mola bildirimi gönderilmez." value={settings.quietEnabled} disabled={busy} onValueChange={(quietEnabled) => updateSettings({ quietEnabled })} />
              {settings.quietEnabled ? (
                <View style={styles.quietBlock}>
                  <View style={styles.quietTimeRow}>
                    <View style={{ flex: 1 }}><Label>SESSİZ BAŞLAR</Label><TextInput maxLength={5} autoCapitalize="none" value={quietFrom} onChangeText={setQuietFrom} style={styles.clockInput} selectTextOnFocus placeholder="22:00" keyboardType="numbers-and-punctuation" /></View>
                    <Text style={{ fontSize: 20, color: MUTED, marginHorizontal: 12, marginTop: 24 }}>→</Text>
                    <View style={{ flex: 1 }}><Label>BİLDİRİMLER AÇILIR</Label><TextInput maxLength={5} autoCapitalize="none" value={quietTo} onChangeText={setQuietTo} style={styles.clockInput} selectTextOnFocus placeholder="09:00" keyboardType="numbers-and-punctuation" /></View>
                  </View>
                  <SmallButton label="Saatleri kaydet" onPress={saveQuietHours} disabled={busy} />
                </View>
              ) : null}
            </View>

            <View style={styles.settingsCard}>
              <SectionHeader title="Çalışma süresi" subtitle="İki hatırlatma arasındaki odak zamanı." />
              <View style={styles.chips}>{[30, 45, 60].map(n => <Pill key={n} disabled={busy} selected={settings.workMinutes === n} onPress={() => updateSettings({ workMinutes: n })}>{n} dk</Pill>)}</View>
              <View style={[styles.horizontalLine, { marginVertical: 22 }]} />
              <SectionHeader title="Mola süresi" subtitle="Hatırlatmadan sonraki hareket zamanı." />
              <View style={styles.chips}>{[5, 10].map(n => <Pill key={n} disabled={busy} selected={settings.breakMinutes === n} onPress={() => updateSettings({ breakMinutes: n })}>{n} dk</Pill>)}</View>
            </View>

            <View style={styles.settingsCard}>
              <SectionHeader title="Bildirim testi" subtitle="8 saniye sonra test gönderir; sessiz saatler açık olsa bile manuel test yapılır." />
              <SmallButton label="Test bildirimi gönder  ↗" onPress={async () => { try { await setupNotifications(); await testReminder(); Alert.alert('Test hazır', '8 saniye içinde bildirim gelmeli.'); } catch (e) { Alert.alert('Bildirim hatası', String(e.message || e)); } }} />
              <View style={[styles.horizontalLine, { marginVertical: 20 }]} />
              <Text style={styles.helperText}>Sessiz saatler, cihaz üzerinde yalnızca aktif zamanlara günlük yinelenen bildirimler planlanarak uygulanır. Telefonun kendi Odak / Rahatsız Etme ayarları önceliklidir.</Text>
            </View>

            {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
          </>
        )}
        <View style={styles.bottom}><Text style={styles.bottomText}>KALK.  /  Sadece kendin için.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  page: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  wordmark: { fontWeight: '900', fontSize: 30, letterSpacing: -1.8, color: INK },
  headerSubtitle: { fontSize: 8.5, letterSpacing: 2.1, color: MUTED, fontWeight: '700', marginTop: 1 },
  headerAction: { borderWidth: 1, borderColor: LINE, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 30 },
  headerActionText: { fontSize: 10, fontWeight: '800', color: INK, letterSpacing: 0.5 },
  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 26 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 9, backgroundColor: '#E7ECDA', borderRadius: 30 },
  statusDot: { width: 7, height: 7, borderRadius: 10, marginRight: 9 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.1, color: '#344531' },
  mascot: { width: 215, height: 215, marginTop: 5, marginBottom: -5 },
  heroTitle: { fontSize: 33, fontWeight: '800', letterSpacing: -1.35, color: INK },
  heroSub: { fontSize: 13.5, color: MUTED, textAlign: 'center', marginTop: 7, lineHeight: 20, maxWidth: 295 },
  timerCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 23, borderWidth: 1, borderColor: '#E6E9E0' },
  timerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 9, fontWeight: '800', letterSpacing: 1.1, color: MUTED },
  timerTopRight: { fontSize: 10, fontWeight: '700', color: MUTED },
  timer: { fontWeight: '800', fontSize: 75, letterSpacing: -4.4, textAlign: 'center', color: INK, marginTop: 18, marginBottom: 19, fontVariant: ['tabular-nums'] },
  timerTrack: { height: 6, backgroundColor: '#EBEFE6', borderRadius: 8, overflow: 'hidden' },
  timerProgress: { height: 6, borderRadius: 8, backgroundColor: '#A2C04A' },
  timerFoot: { color: MUTED, textAlign: 'center', fontSize: 12, marginTop: 17 },
  actions: { gap: 10, marginTop: 14 },
  button: { backgroundColor: INK, borderRadius: 17, minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonSecondary: { backgroundColor: '#E8ECDF' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
  buttonSecondaryText: { color: INK },
  smallButton: { alignSelf: 'flex-start', paddingHorizontal: 17, paddingVertical: 12, backgroundColor: INK, borderRadius: 12 },
  smallButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  feedback: { textAlign: 'center', color: '#496D2C', fontWeight: '600', fontSize: 12, marginTop: 13 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statCard: { flex: 1, backgroundColor: '#ECF0E4', padding: 19, borderRadius: 18 },
  statNumber: { fontSize: 32, color: INK, fontWeight: '800', marginTop: 12, lineHeight: 36 },
  statDesc: { fontSize: 11.5, color: MUTED, marginTop: 4 },
  footerNote: { paddingTop: 22, alignItems: 'center' },
  footerText: { fontSize: 11.5, color: MUTED, textAlign: 'center', lineHeight: 20 },
  footerLink: { color: INK, textDecorationLine: 'underline', fontWeight: '700' },
  settingsIntro: { paddingTop: 21, marginBottom: 29 },
  screenTitle: { color: INK, fontSize: 35, fontWeight: '800', letterSpacing: -1.3 },
  settingsIntroDesc: { color: MUTED, fontSize: 13, marginTop: 8 },
  settingsCard: { padding: 22, borderRadius: 23, backgroundColor: '#FFFFFF', borderColor: '#E6E9E0', borderWidth: 1, marginBottom: 15 },
  settingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 62 },
  settingTitle: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 4 },
  settingDescription: { fontSize: 11, color: MUTED, lineHeight: 16 },
  horizontalLine: { height: 1, backgroundColor: LINE, marginVertical: 15 },
  quietBlock: { marginTop: 14, backgroundColor: BG, padding: 15, borderRadius: 16 },
  quietTimeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  clockInput: { borderRadius: 11, borderColor: LINE, borderWidth: 1, backgroundColor: '#FFFFFF', color: INK, paddingHorizontal: 11, paddingVertical: 10, marginTop: 8, fontWeight: '700', fontSize: 20, letterSpacing: -0.5 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: INK },
  sectionSubtitle: { fontSize: 11.5, lineHeight: 17, color: MUTED, marginTop: 4 },
  chips: { flexDirection: 'row', gap: 9, flexWrap: 'wrap' },
  pill: { borderRadius: 13, borderWidth: 1, borderColor: LINE, paddingHorizontal: 17, paddingVertical: 12, backgroundColor: BG },
  pillSelected: { backgroundColor: GREEN, borderColor: GREEN },
  pillText: { fontSize: 13, color: MUTED, fontWeight: '700' },
  pillTextSelected: { color: INK },
  helperText: { fontSize: 11.5, lineHeight: 18, color: MUTED },
  bottom: { marginTop: 28, alignItems: 'center' },
  bottomText: { fontSize: 9, letterSpacing: 1, color: '#9AA39A', fontWeight: '700' },
});
