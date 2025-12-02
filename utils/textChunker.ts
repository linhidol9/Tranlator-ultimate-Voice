// Google Translate TTS often limits requests to around 200 chars.
// We split safely by punctuation or spaces.

export const splitTextForTts = (text: string, maxLength: number = 180): string[] => {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let currentText = text;

  while (currentText.length > maxLength) {
    // Attempt to split at the last punctuation mark within the limit
    let splitIndex = -1;
    
    // Check for standard punctuation first
    const punctuationRegex = /[.,;!?]/g;
    let match;
    while ((match = punctuationRegex.exec(currentText.substring(0, maxLength))) !== null) {
      splitIndex = match.index;
    }

    // If no punctuation, look for the last space
    if (splitIndex === -1) {
      splitIndex = currentText.substring(0, maxLength).lastIndexOf(' ');
    }

    // If no space (extremely long word), force split
    if (splitIndex === -1) {
      splitIndex = maxLength;
    } else {
      splitIndex += 1; // Include the character
    }

    chunks.push(currentText.substring(0, splitIndex).trim());
    currentText = currentText.substring(splitIndex).trim();
  }

  if (currentText.length > 0) {
    chunks.push(currentText);
  }

  return chunks;
};