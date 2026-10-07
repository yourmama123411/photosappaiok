import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function configureNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('tasks', {
      name: 'Tasks', importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250], lightColor: '#8AB4FF'
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) await Notifications.requestPermissionsAsync();
}

export async function scheduleTaskNotification(title: string, body: string, date: Date) {
  await configureNotifications();
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: date.getTime() > Date.now() ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date } : null
  });
}
