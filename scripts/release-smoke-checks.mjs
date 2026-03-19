import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function report(message) {
  console.log(`PASS ${message}`);
}

const indexScreen = read('app/index.tsx');
assert(indexScreen.includes("router.replace('/auth/email')"), 'Index screen must redirect signed-out users to /auth/email.');
report('startup route keeps signed-out users on the email auth flow.');

const authRedirect = read('utils/authRedirect.ts');
assert(authRedirect.includes("return '/(tabs)/dashboard';"), 'Post-auth redirect must land on /(tabs)/dashboard for completed users.');
report('post-auth redirect still lands on the dashboard.');

const rootLayout = read('app/_layout.tsx');
assert(rootLayout.includes('<Stack.Screen name="(tabs)" />'), 'Root layout must register the tabs navigator.');
report('tabs navigator remains registered in the root layout.');

const dashboard = read('app/(tabs)/dashboard.tsx');
assert(
  dashboard.includes("activeTab === 'overview' ? renderOverviewTab() : <TournamentsHome />"),
  'Dashboard screen must continue to render the overview tab as the default landing experience.'
);
report('dashboard still renders the intended overview landing screen.');

const gradleBuild = read('android/app/build.gradle');
const gradleLines = gradleBuild.split('\n');
const buildTypesIndex = gradleLines.findIndex((line) => line.includes('buildTypes {'));
const releaseLineIndex = gradleLines.findIndex((line, index) => index > buildTypesIndex && line.trim() === 'release {');
const releaseEndIndex = gradleLines.findIndex((line, index) => index > releaseLineIndex && line.includes('crunchPngs'));
assert(buildTypesIndex >= 0 && releaseLineIndex >= 0 && releaseEndIndex >= 0, 'Unable to locate the Android release build block.');
const releaseBlock = gradleLines.slice(releaseLineIndex, releaseEndIndex + 1).join('\n');
assert(
  !releaseBlock.includes('signingConfig signingConfigs.debug'),
  'Release build must not use the debug signing config.'
);
assert(gradleBuild.includes("ANDROID_UPLOAD_STORE_FILE"), 'Release signing must be driven by explicit release credential inputs.');
report('release build no longer falls back to debug signing.');

const manifest = read('android/app/src/main/AndroidManifest.xml');
const manifestPermissions = [...manifest.matchAll(/<uses-permission android:name="([^"]+)"/g)].map((match) => match[1]);
assert(
  manifestPermissions.length === 1 && manifestPermissions[0] === 'android.permission.INTERNET',
  `Expected only INTERNET permission in the shipped Android manifest, found: ${manifestPermissions.join(', ') || 'none'}.`
);
report('shipped Android manifest keeps only the INTERNET permission.');

console.log('All release smoke checks passed.');
