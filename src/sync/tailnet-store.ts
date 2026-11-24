import * as SecureStore from 'expo-secure-store';

import { parseBook, type TailnetBook } from './tailnet';

/**
 * Family phones' Tailscale addresses, kept beside the other sync secrets (not in the
 * database, so never in backups).
 */
const KEY = 'librebaby.sync.tailnet';

export async function loadTailnetBook(): Promise<TailnetBook> {
  return parseBook(await SecureStore.getItemAsync(KEY));
}

export async function saveTailnetBook(book: TailnetBook): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(book));
}

export async function clearTailnetBook(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
