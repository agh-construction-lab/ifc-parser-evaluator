type ParserIdentity = {
  parserName: string;
  parserVersion: string;
};

function toSafePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function getCanonicalParserPairIds(
  parserIdA: string,
  parserIdB: string,
): [string, string] {
  return [parserIdA, parserIdB].sort() as [string, string];
}

export function getParserId(parser: ParserIdentity): string {
  return `${parser.parserName}@${parser.parserVersion}`;
}

export function getParserLabel(parser: ParserIdentity): string {
  return `${parser.parserName} ${parser.parserVersion}`;
}

export function getCanonicalParserPairKey(
  parserIdA: string,
  parserIdB: string,
): string {
  return getCanonicalParserPairIds(parserIdA, parserIdB).join("__");
}

export function getParserPairDirectoryName(
  parserIdA: string,
  parserIdB: string,
): string {
  return getCanonicalParserPairIds(parserIdA, parserIdB)
    .map(toSafePathSegment)
    .join("__");
}
