export const MAX_LASTFM_USERNAME_LENGTH = 64;

export function validateLastFmUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_LASTFM_USERNAME_LENGTH) {
    return `Last.fm usernames must be ${MAX_LASTFM_USERNAME_LENGTH} characters or fewer.`;
  }
  if (/[\u0000-\u001f\u007f]/u.test(trimmed)) {
    return "Last.fm usernames cannot contain control characters.";
  }
  return null;
}

function codedError(message: string, code: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

export function resolveLastFmUsername(
  request?: Request,
  environment: NodeJS.ProcessEnv = process.env,
  allowedParameters: readonly string[] = ["user"]
): string | undefined {
  const configuredUsername = environment.LASTFM_USERNAME?.trim() || undefined;
  if (!request) return configuredUsername;

  const parameters = new URL(request.url).searchParams;
  const allowed = new Set(allowedParameters);
  for (const parameter of new Set(parameters.keys())) {
    if (!allowed.has(parameter)) {
      throw codedError(`Unsupported query parameter: ${parameter}.`, "INVALID_USERNAME");
    }
    if (parameters.getAll(parameter).length > 1) {
      throw codedError(`Provide only one ${parameter} value.`, "INVALID_USERNAME");
    }
  }

  const requestedValues = parameters.getAll("user");
  const requestedUsername = requestedValues[0]?.trim();
  if (!requestedUsername) return configuredUsername;

  const validationError = validateLastFmUsername(requestedUsername);
  if (validationError) throw codedError(validationError, "INVALID_USERNAME");

  const isConfiguredUser = configuredUsername
    && requestedUsername.toLocaleLowerCase() === configuredUsername.toLocaleLowerCase();
  const customUsersAllowed = /^(?:1|true|yes)$/iu.test(
    environment.ALLOW_CUSTOM_LASTFM_USERS?.trim() ?? ""
  );
  if (!isConfiguredUser && !customUsersAllowed) {
    throw codedError("Custom Last.fm users are disabled on this deployment.", "CUSTOM_USERS_DISABLED");
  }

  return requestedUsername;
}
