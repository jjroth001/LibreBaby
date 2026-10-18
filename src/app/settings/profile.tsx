import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { ChildForm } from '@/components/child-form';
import { Screen } from '@/components/screen';
import { updateChild } from '@/db/children';
import { useChild } from '@/db/use-child';
import { successFeedback } from '@/lib/haptics';

/** Settings › the baby's name, birthday and sex. */
export default function ProfileSettings() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  if (!child) return null;

  return (
    <Screen withTabBar={false} belowHeader panel>
      <ChildForm
        key={child.id}
        initialValues={{ name: child.name, birthDate: child.birthDate, sex: child.sex }}
        submitLabel="Save changes"
        onSubmit={async (values) => {
          await updateChild(db, child.id, values);
          successFeedback();
          router.back();
        }}
      />
    </Screen>
  );
}
