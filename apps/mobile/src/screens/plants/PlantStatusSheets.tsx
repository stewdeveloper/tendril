import { plantsCopy } from '@tendril/core';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, OptionPills, Sheet, TextField } from '../../components';
import { AppText } from '../../theme';

const CAUSES = [
  { value: 'too dry', label: 'Too dry' },
  { value: 'too wet', label: 'Too wet' },
  { value: 'pests', label: 'Pests' },
  { value: 'other', label: 'Other' },
];

/** The "..." menu where the platform has no native action sheet: what can change about a plant. */
export function PlantActionsSheet({
  visible,
  nickname,
  onDied,
  onGivenAway,
  onClose,
}: {
  visible: boolean;
  nickname: string;
  onDied: () => void;
  onGivenAway: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} title={nickname} onClose={onClose}>
      <Button label={plantsCopy.markDied} variant="secondary" onPress={onDied} />
      <Button label={plantsCopy.givenAway} variant="secondary" onPress={onGivenAway} />
    </Sheet>
  );
}

/**
 * "Mark as died" asks what happened, and the answer is optional: a pill, words of the person's
 * own, both or neither. Written words win over the pill. `onConfirm` gets the cause or undefined.
 */
export function DiedCauseSheet({
  visible,
  saving,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  saving?: boolean;
  onConfirm: (cause: string | undefined) => void;
  onClose: () => void;
}) {
  const [pill, setPill] = useState('');
  const [words, setWords] = useState('');
  return (
    <Sheet visible={visible} title={plantsCopy.diedCauseTitle} onClose={onClose}>
      <AppText variant="sub" color="textSecondary">
        {plantsCopy.diedCauseLine}
      </AppText>
      <OptionPills options={CAUSES} value={pill} onChange={setPill} />
      <TextField
        label={plantsCopy.diedCauseOther}
        value={words}
        onChangeText={setWords}
        autoCapitalize="sentences"
      />
      <View>
        <Button
          label={plantsCopy.markDied}
          variant="danger"
          loading={saving}
          onPress={() => onConfirm(words.trim() || pill || undefined)}
        />
      </View>
    </Sheet>
  );
}
