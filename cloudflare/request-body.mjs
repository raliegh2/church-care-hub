export async function boundedText(request, maximumBytes) {
  const tooLarge = () => Object.assign(new Error('Request is too large'), { status: 413 });
  if (Number(request.headers.get('Content-Length')) > maximumBytes) throw tooLarge();
  if (!request.body) return '';
  const reader = request.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      bytes += chunk.value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel().catch(() => {});
        throw tooLarge();
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}
