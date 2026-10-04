import './componentSheet';
// Every frame of an app area registers itself from `catalog/areas/<area>.tsx` (onboarding.tsx,
// today.tsx, ...), imported here, one line each. They live in `areas/`, not `frames/`, so the
// directory never shadows this file's module path `catalog/frames`.
import './areas/onboarding';
import './areas/today';
import './areas/plants';
import './areas/care';
