import { useState } from 'react';

import { Button } from '@/components/button';

type SubmitButtonProps = {
  title: string;
  onPress: () => Promise<void>;
  disabled?: boolean;
  /** Shown while `onPress` runs. */
  busyTitle?: string;
  variant?: 'primary' | 'secondary' | 'danger';
};

/** Save button that disables itself while saving, so a double tap can't log twice. */
export function SubmitButton({
  title,
  onPress,
  disabled,
  busyTitle = 'Saving…',
  variant,
}: SubmitButtonProps) {
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
    <Button
      title={saving ? busyTitle : title}
      variant={variant}
      onPress={press}
      disabled={disabled || saving}
    />
  );
}
