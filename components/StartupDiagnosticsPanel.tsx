import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getStartupEntries, StartupDiagnosticEntry, subscribeToStartupDiagnostics } from '@/utils/startupDiagnostics';

export function StartupDiagnosticsPanel() {
  const [entries, setEntries] = useState<StartupDiagnosticEntry[]>(getStartupEntries());
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    return subscribeToStartupDiagnostics(setEntries);
  }, []);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable style={styles.header} onPress={() => setExpanded((value) => !value)}>
        <Text style={styles.headerText}>Diagnostics ({entries.length}) {expanded ? '▾' : '▸'}</Text>
      </Pressable>
      {expanded && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {entries.length === 0 ? <Text style={styles.emptyText}>No startup logs yet.</Text> : null}
          {entries.map((entry) => (
            <Text key={entry.id} style={[styles.entryText, entry.level === 'error' ? styles.errorText : null]}>
              {entry.timestamp.slice(11, 19)} • {entry.message}
            </Text>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 12,
    right: 12,
    maxHeight: 200,
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  headerText: {
    color: '#f2f2f2',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    maxHeight: 150,
  },
  bodyContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  entryText: {
    color: '#e6e6e6',
    fontSize: 11,
  },
  errorText: {
    color: '#ff9b9b',
  },
  emptyText: {
    color: '#bbbbbb',
    fontSize: 11,
  },
});
