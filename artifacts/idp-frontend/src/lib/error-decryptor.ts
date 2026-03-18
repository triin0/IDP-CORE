interface DecryptedError {
  friendly: string;
  emoji: string;
  severity: "info" | "warning" | "error";
}

interface ErrorPattern {
  pattern: RegExp;
  friendly: string;
  emoji: string;
  severity: "info" | "warning" | "error";
}

const ERROR_PATTERNS: ErrorPattern[] = [
  { pattern: /TS2322/i, friendly: "Tidying up how your app handles data types — almost fixed!", emoji: "🔧", severity: "warning" },
  { pattern: /TS2339/i, friendly: "Looking for a feature that hasn't been connected yet.", emoji: "🔍", severity: "warning" },
  { pattern: /TS2304/i, friendly: "Referencing something that hasn't been defined yet.", emoji: "📝", severity: "warning" },
  { pattern: /TS2307/i, friendly: "A required building block is missing — needs to be installed.", emoji: "📦", severity: "warning" },
  { pattern: /TS2345/i, friendly: "Passing the wrong type of information to a function.", emoji: "🔄", severity: "warning" },
  { pattern: /TS18048|TS2532/i, friendly: "Making sure we handle cases where data might be missing.", emoji: "🛡️", severity: "warning" },
  { pattern: /TS\d{4}/i, friendly: "Working through a TypeScript code quality issue.", emoji: "🔧", severity: "warning" },

  { pattern: /401\s*Unauthorized/i, friendly: "Need to double-check your credentials before we go further.", emoji: "🔐", severity: "warning" },
  { pattern: /403\s*Forbidden/i, friendly: "You don't have permission to access this — check your account settings.", emoji: "🚫", severity: "warning" },
  { pattern: /404\s*Not Found/i, friendly: "Couldn't find what we were looking for — it might have moved.", emoji: "🗺️", severity: "warning" },
  { pattern: /500\s*Internal Server/i, friendly: "The server hit a snag — we're working on it!", emoji: "⚡", severity: "error" },
  { pattern: /502\s*Bad Gateway/i, friendly: "The server is refreshing — give it a moment.", emoji: "🔄", severity: "info" },
  { pattern: /503\s*Service Unavailable/i, friendly: "The server is taking a quick break — try again in a moment.", emoji: "☕", severity: "info" },
  { pattern: /ERR_CONNECTION_REFUSED/i, friendly: "The server isn't responding yet — it might still be starting up.", emoji: "🔌", severity: "info" },
  { pattern: /ECONNRESET/i, friendly: "The connection was interrupted — trying again should fix it.", emoji: "🔄", severity: "info" },
  { pattern: /ETIMEDOUT|TIMEOUT/i, friendly: "This is taking longer than expected — the server might be busy.", emoji: "⏳", severity: "warning" },

  { pattern: /npm\s+(install|i)\s+failed|ERR_PNPM/i, friendly: "Grabbing some new tools for your app — organizing them now.", emoji: "📦", severity: "info" },
  { pattern: /ERESOLVE|peer\s+dep/i, friendly: "Some building blocks aren't compatible — finding the right versions.", emoji: "🧩", severity: "warning" },
  { pattern: /Module not found|Cannot find module/i, friendly: "A required piece is missing — it needs to be added to the project.", emoji: "🔍", severity: "warning" },
  { pattern: /npm ERR!/i, friendly: "Package manager ran into a hiccup — usually fixable with a retry.", emoji: "📦", severity: "warning" },

  { pattern: /ZodError|ZodValidation|validation.*failed/i, friendly: "The data doesn't match what was expected — double-check the format.", emoji: "📋", severity: "warning" },
  { pattern: /UNIQUE.*constraint|duplicate.*key/i, friendly: "This item already exists — try using a different name or ID.", emoji: "🔁", severity: "warning" },
  { pattern: /foreign.*key.*constraint/i, friendly: "This item depends on something else that needs to exist first.", emoji: "🔗", severity: "warning" },
  { pattern: /connection.*refused.*5432|ECONNREFUSED.*postgres/i, friendly: "The database isn't responding — it might need a moment to start.", emoji: "🗄️", severity: "info" },
  { pattern: /relation.*does not exist/i, friendly: "The database table hasn't been created yet — run the setup first.", emoji: "🗄️", severity: "warning" },
  { pattern: /syntax.*error.*sql|ERROR.*at.*LINE/i, friendly: "There's a typo in a database command — fixing it now.", emoji: "📝", severity: "warning" },

  { pattern: /CORS|cross.origin/i, friendly: "Security settings are blocking a connection between parts of your app.", emoji: "🛡️", severity: "warning" },
  { pattern: /rate.*limit|too many requests|429/i, friendly: "Too many requests at once — slow down and try again shortly.", emoji: "🐢", severity: "info" },
  { pattern: /out of memory|heap|ENOMEM/i, friendly: "The app needs more memory — it might be doing too much at once.", emoji: "💾", severity: "error" },
  { pattern: /ENOENT|no such file/i, friendly: "Looking for a file that doesn't exist yet.", emoji: "📁", severity: "warning" },
  { pattern: /EACCES|permission denied/i, friendly: "Don't have permission to access this file or folder.", emoji: "🔒", severity: "warning" },
  { pattern: /SyntaxError|Unexpected token/i, friendly: "Found a typo in the code — needs a quick fix.", emoji: "✏️", severity: "warning" },
  { pattern: /ReferenceError/i, friendly: "The code is using something that hasn't been defined.", emoji: "❓", severity: "warning" },
  { pattern: /TypeError/i, friendly: "The code tried to do something with the wrong type of data.", emoji: "🔧", severity: "warning" },
  { pattern: /SIGTERM|SIGKILL|killed/i, friendly: "The process was stopped — it might restart automatically.", emoji: "🔄", severity: "info" },
  { pattern: /build.*fail|compilation.*fail/i, friendly: "The build didn't finish — checking what went wrong.", emoji: "🏗️", severity: "warning" },
];

const FALLBACK: DecryptedError = {
  friendly: "Something unexpected happened — we're looking into it.",
  emoji: "🔍",
  severity: "warning",
};

export function decryptError(rawError: string): DecryptedError {
  if (!rawError || rawError.trim().length === 0) return FALLBACK;

  for (const ep of ERROR_PATTERNS) {
    if (ep.pattern.test(rawError)) {
      return { friendly: ep.friendly, emoji: ep.emoji, severity: ep.severity };
    }
  }

  return FALLBACK;
}

export function decryptErrorLine(line: string): DecryptedError | null {
  if (!line) return null;
  const isError = /\b(error|err[_:]|failed|fatal|exception|panic)\b/i.test(line);
  if (!isError) return null;
  return decryptError(line);
}
