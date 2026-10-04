import {
  diagnosisCopy,
  limitReachedBody,
  limitReachedTitle,
  radius,
  type DiagnosisResult,
  type QuotaState,
} from '@tendril/core';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  BackBar,
  Button,
  ConfidenceLabel,
  HeroHeader,
  HERO_CONTENT_TOP,
  Note,
  RowsCard,
} from '../../components';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';

export interface DiagnosisScreenProps {
  /** 4q a result with a change to the plan, 4s "not sure", 4r the month's diagnosis used up. */
  state: 'result' | 'not_sure' | 'used_up';
  result?: DiagnosisResult;
  quota?: QuotaState;
  /** The placeholder's words when there is no photo ("Your photo: yellow leaves"). */
  photoLabel: string;
  photoUri?: string | null;
  /** What the back row calls the screen it returns to (4r): the plant's nickname. */
  plantName: string;
  /** Applying the change is in flight. */
  applying?: boolean;
  applyFailed?: boolean;
  onApply: () => void;
  onRetake: () => void;
  onTryPremium: () => void;
  onNotNow: () => void;
  onBack: () => void;
}

/**
 * Diagnosis (4q to 4s). A result sits on its photo with the change it suggests; "not sure" says so
 * plainly and costs nothing; a used-up month says when more arrive. Nothing here is red or urgent.
 */
export function DiagnosisScreen(props: DiagnosisScreenProps) {
  return props.state === 'used_up' ? <UsedUp {...props} /> : <Result {...props} />;
}

function Result({
  state,
  result,
  photoLabel,
  photoUri,
  applying,
  applyFailed,
  onApply,
  onRetake,
  onBack,
}: DiagnosisScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  if (!result) return null;
  const unsure = state === 'not_sure';
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <HeroHeader photoUri={photoUri} photoLabel={photoLabel} onBack={onBack} />
      <View style={[styles.sheet, { top: HERO_CONTENT_TOP, backgroundColor: c.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(42, insets.bottom + 8) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ConfidenceLabel probability={result.probability} compact style={styles.label} />
          <AppText variant="title" accessibilityRole="header" style={styles.title}>
            {result.conditionName}
          </AppText>
          {unsure ? (
            <AppText variant="body" lines="body-24">
              {result.explanation}
            </AppText>
          ) : (
            <AppText variant="sub" color="textSecondary">
              {result.explanation}
            </AppText>
          )}
          {unsure ? (
            <Note text={diagnosisCopy.notSureNote} />
          ) : result.planChange ? (
            <>
              <AppText variant="heading" accessibilityRole="header" style={styles.heading}>
                {diagnosisCopy.changeToPlan}
              </AppText>
              <RowsCard
                rows={[
                  {
                    key: 'change',
                    title: result.planChange.title,
                    subtitle: result.planChange.detail,
                  },
                ]}
              />
            </>
          ) : null}
          {applyFailed ? <Note text={diagnosisCopy.applyFailed} /> : null}
          <View style={styles.spacer} />
          <View style={styles.action}>
            {unsure ? (
              <Button label={diagnosisCopy.closePhoto} onPress={onRetake} />
            ) : (
              <Button label={diagnosisCopy.apply} onPress={onApply} loading={applying} />
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function UsedUp({ quota, plantName, onTryPremium, onNotNow, onBack }: DiagnosisScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  const premium = quota?.plan === 'premium';
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.page,
          { paddingTop: insets.top, paddingBottom: Math.max(42, insets.bottom + 8) },
        ]}
      >
        <View style={styles.back}>
          <BackBar label={plantName} onPress={onBack} />
        </View>
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          {limitReachedTitle('diagnosis', quota?.plan, quota?.limit)}
        </AppText>
        {quota ? (
          <AppText variant="body" lines="body-24">
            {limitReachedBody(quota)}
          </AppText>
        ) : null}
        <View style={styles.spacer} />
        {premium ? null : (
          <View style={styles.action}>
            <Button label={diagnosisCopy.tryPremium} onPress={onTryPremium} />
          </View>
        )}
        <View style={styles.action}>
          <Button label={diagnosisCopy.notNow} variant="text" onPress={onNotNow} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    overflow: 'hidden',
    zIndex: 4,
  },
  content: { flexGrow: 1, paddingTop: 20, paddingHorizontal: 16, gap: 18 },
  page: { flexGrow: 1, paddingHorizontal: 16, gap: 18 },
  // The frames tuck the label, the title and the headings closer to what follows than the rhythm.
  label: { alignSelf: 'flex-start', marginBottom: -8 },
  back: { marginBottom: -6 },
  title: { marginBottom: -10 },
  heading: { marginBottom: -6 },
  spacer: { flex: 1 },
  action: { marginTop: -8 },
});
