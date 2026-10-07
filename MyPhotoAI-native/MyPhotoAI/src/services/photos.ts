import * as MediaLibrary from 'expo-media-library/legacy';

export async function requestPhotoAccess() {
  const result = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  return result.granted;
}

export async function loadRecentPhotos(limit = 120) {
  const granted = await requestPhotoAccess();
  if (!granted) return [];
  const result = await MediaLibrary.getAssetsAsync({
    first: limit,
    mediaType: MediaLibrary.MediaType.photo,
    sortBy: [MediaLibrary.SortBy.creationTime]
  });
  return result.assets;
}
