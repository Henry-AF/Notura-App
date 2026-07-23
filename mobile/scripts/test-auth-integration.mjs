/**
 * Integration smoke test for Supabase Auth on React Native (Node simulation).
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const confirmedEmail = process.env.TEST_CONFIRMED_EMAIL;
const confirmedPassword = process.env.TEST_CONFIRMED_PASSWORD;

if (!url || !anonKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

function createInMemoryStorage() {
  const store = new Map();
  return {
    _store: store,
    getItem: async (key) => store.get(key) ?? null,
    setItem: async (key, value) => store.set(key, value),
    removeItem: async (key) => store.delete(key),
    keys: () => Array.from(store.keys()),
    hasToken: async function () {
      const raw = await this.getItem('supabase.auth.token');
      return raw !== null;
    },
  };
}

function createClientWithStorage(storage) {
  return createClient(url, anonKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

async function run() {
  console.log('Supabase URL:', url);

  if (!confirmedEmail || !confirmedPassword) {
    console.log('Set TEST_CONFIRMED_EMAIL and TEST_CONFIRMED_PASSWORD to run login/persistence assertions.');
    process.exit(0);
  }

  console.log(`\n[1/3] Logging in with confirmed account ${confirmedEmail}...`);
  const loginStorage = createInMemoryStorage();
  const loginClient = createClientWithStorage(loginStorage);

  const { data: loginData, error: loginError } = await loginClient.auth.signInWithPassword({
    email: confirmedEmail,
    password: confirmedPassword,
  });

  if (loginError) {
    throw new Error(`Login failed: ${loginError.message}`);
  }

  console.log('  Access token present:', !!loginData.session?.access_token);
  console.log('  Refresh token present:', !!loginData.session?.refresh_token);
  console.log('  User email:', loginData.user?.email);

  console.log('\n[2/3] Confirming tokens are stored in the storage adapter...');
  const storedKeys = loginStorage.keys();
  console.log('  Storage keys:', storedKeys.join(', ') || '(none)');
  if (storedKeys.length === 0) {
    throw new Error('No tokens were persisted to the storage adapter');
  }

  console.log('\n[3/3] Simulating app restart with persisted session...');
  const restoredClient = createClientWithStorage(loginStorage);
  const { data: restoredSession } = await restoredClient.auth.getSession();

  if (!restoredSession.session) {
    throw new Error('Session did not restore from storage after restart');
  }

  console.log('  Restored user email:', restoredSession.session.user.email);
  console.log('  Restored access token present:', !!restoredSession.session.access_token);
  console.log('  Tokens stored in secure storage adapter: YES');

  console.log('\nDone.');
}

run().catch((error) => {
  console.error('\nTest failed:', error.message);
  process.exit(1);
});
