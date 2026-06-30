import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_TRANSFORM_KEY = 'skipResponseTransform';

// Opt out of the global { success, data } envelope (health, auth passthrough, file downloads).
export const SkipResponseTransform = () =>
  SetMetadata(SKIP_RESPONSE_TRANSFORM_KEY, true);
