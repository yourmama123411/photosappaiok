import * as Sharing from 'expo-sharing';

export async function shareLocalFile(uri: string) {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { dialogTitle: 'Share photo' });
  return true;
}
