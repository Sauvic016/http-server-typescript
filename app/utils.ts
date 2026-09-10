export const getClientEncoding = (requestLines: string[]): "gzip" | undefined => {
  const encodingLine = requestLines.slice(1).find((line) => line.toLowerCase().startsWith("accept-encoding:"));
  if (!encodingLine) return undefined;

  const encodings = encodingLine
    .slice(encodingLine.indexOf(":") + 1)
    .toLowerCase()
    .split(",")
    .map((encoding) => encoding.trim());

  return encodings.includes("gzip") ? "gzip" : undefined;
};
