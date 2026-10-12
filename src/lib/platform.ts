import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * True in an installed build (APK), false in Expo Go. Some native features — scheduled
 * notifications on Android, home-screen widgets — only exist in installed builds, and
 * their libraries error or crash if merely loaded inside Expo Go.
 */
export const isInstalledBuild = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export const widgetsSupported = Platform.OS === 'android' && isInstalledBuild;
