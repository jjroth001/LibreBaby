import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatAge, formatLongDate, parseLocalDate, toLocalDateString } from '@/lib/dates';

export type ChildFormValues = { name: string; birthDate: string };

type ChildFormProps = {
  initialValues?: ChildFormValues;
  submitLabel: string;
  onSubmit: (values: ChildFormValues) => Promise<void>;
};

export function ChildForm({ initialValues, submitLabel, onSubmit }: ChildFormProps) {
  const theme = useTheme();
  const [name, setName] = useState(initialValues?.name ?? '');
  const [birthDate, setBirthDate] = useState(initialValues?.birthDate ?? toLocalDateString(new Date()));
  const [saving, setSaving] = useState(false);

  const trimmedName = name.trim();
  const unchanged =
    initialValues !== undefined &&
    trimmedName === initialValues.name &&
    birthDate === initialValues.birthDate;

  const pickBirthDate = () => {
    DateTimePickerAndroid.open({
      mode: 'date',
      value: parseLocalDate(birthDate),
      maximumDate: new Date(),
      onValueChange: (_event, date) => setBirthDate(toLocalDateString(date)),
    });
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit({ name: trimmedName, birthDate });
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = [styles.field, { backgroundColor: theme.backgroundElement }];

  return (
    <View style={styles.form}>
      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          NAME
        </ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Baby's name"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="words"
          autoComplete="off"
          returnKeyType="done"
          style={[fieldStyle, styles.input, { color: theme.text }]}
        />
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          BIRTH DATE
        </ThemedText>
        <Pressable accessibilityRole="button" onPress={pickBirthDate} style={fieldStyle}>
          <ThemedText style={styles.input}>{formatLongDate(birthDate)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatAge(birthDate)}
          </ThemedText>
        </Pressable>
      </View>

      <Button
        title={saving ? 'Saving…' : submitLabel}
        onPress={submit}
        disabled={saving || trimmedName.length === 0 || unchanged}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.four },
  group: { gap: Spacing.two },
  field: {
    minHeight: 56,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    justifyContent: 'center',
  },
  input: { fontSize: 18 },
});
