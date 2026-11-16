import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logic from './logic.cjs';

const { buildDailySlots, isActiveAt } = logic;
const SNOOZE_KEY = 'sponge:snooze-id:v1';
const CHANNEL_ID = 'sponge-breaks';
const CATEGORY_ID = 'SPONGE_ACTIONS';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Hareket molaları',
      description: 'Kalkma ve esneme hatırlatmaları',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 220, 160, 220],
      sound: 'default',
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    {
      identifier: 'START_BREAK',
      buttonTitle: 'Molayı başlat',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'SNOOZE_BREAK',
      buttonTitle: '5 dk ertele',
      options: { opensAppToForeground: true },
    },
  ]);
}

export async function ensureNotificationPermission() {
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
    perm = await Notifications.requestPermissionsAsync();
  }
  if (!perm.granted && perm.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
    throw new Error('Bildirim izni verilmedi. Telefon ayarlarından Sponge bildirimlerini aç.');
  }
}

function message(settings) {
  return {
    title: 'Kalk hadi.',
    body: `${settings.workMinutes} dakika geçti. ${settings.breakMinutes} dakika hareket et, sonra devam.`,
    categoryIdentifier: CATEGORY_ID,
    sound: 'default',
    data: { kind: 'break' },
  };
}

export async function scheduleDailyReminders(settings) {
  // Validates times before canceling any existing notifications.
  const slots = settings.enabled ? buildDailySlots(settings) : [];
  if (slots.length > 60) throw new Error('Çok fazla günlük bildirim oluşturuluyor.');
  if (settings.enabled) await ensureNotificationPermission();
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(SNOOZE_KEY);
  if (!settings.enabled) {
    await Notifications.dismissAllNotificationsAsync();
    return 0;
  }
  for (const slot of slots) {
    await Notifications.scheduleNotificationAsync({
      content: message(settings),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: Math.floor(slot / 60),
        minute: slot % 60,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }
  return slots.length;
}

export async function snoozeFiveMinutes(settings) {
  if (!settings.enabled) throw new Error('Bildirimler kapalı.');
  const date = new Date(Date.now() + 5 * 60 * 1000);
  if (!isActiveAt(date, settings)) {
    throw new Error('5 dakika sonrası sessiz saatlere denk geliyor.');
  }
  const oldId = await AsyncStorage.getItem(SNOOZE_KEY);
  if (oldId) await Notifications.cancelScheduledNotificationAsync(oldId).catch(() => {});
  await ensureNotificationPermission();
  const id = await Notifications.scheduleNotificationAsync({
    content: { ...message(settings), body: 'Erteleme bitti. Kısa bir hareket molası zamanı.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });
  await AsyncStorage.setItem(SNOOZE_KEY, id);
  return date;
}

export async function testReminder() {
  await ensureNotificationPermission();
  return Notifications.scheduleNotificationAsync({
    content: {
      ...message({ workMinutes: 30, breakMinutes: 5 }),
      title: 'Sponge test bildirimi',
      body: 'Bu bildirim telefonun yerel hatırlatma sistemiyle gönderildi.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 8,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });
}
