import { useState } from 'react';

import { Button } from '@/components/button';

type SubmitButtonProps = {
  title: string;
  onPress: () => Promise<void>;
  disabled?: boolean;
};

/** Save button that disables itself while saving, so a double tap can't log twice. */
export function SubmitButton({ title, onPress, disabled }: SubmitButtonProps) {
  const [saving, setSaving] = useState(false);

  const press = async () => {
    setSaving(true);
    try {
      await onPress();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button title={saving ? 'Saving…' : title} onPress={press} disabled={disabled || saving} />
  );
}
