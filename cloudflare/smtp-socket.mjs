import { Duplex } from 'node:stream';

export async function workerSmtpSocket(hostname, connector = null) {
  const connect = connector || (await import('cloudflare:sockets')).connect;
  let socket;
  // Retry only a failed connection opening, before SMTP authentication or DATA.
  // This cannot duplicate a message that Gmail has already accepted.
  for (let attempt = 0; attempt < 2; attempt++) {
    socket = connect({ hostname, port: 465 }, { secureTransport: 'on' });
    socket.closed.catch(() => {});
    const openingTimeout = setTimeout(() => socket.close().catch(() => {}), 10000);
    try { await socket.opened; break; }
    catch (failure) { await socket.close().catch(() => {}); if (attempt === 1) throw failure; }
    finally { clearTimeout(openingTimeout); }
  }
  const stream = Duplex.fromWeb({ readable: socket.readable, writable: socket.writable });
  let timeout;
  stream.setKeepAlive = () => stream;
  stream.setTimeout = milliseconds => {
    clearTimeout(timeout);
    if (milliseconds) timeout = setTimeout(() => stream.emit('timeout'), milliseconds);
    return stream;
  };
  stream.once('close', () => { clearTimeout(timeout); void socket.close().catch(() => {}); });
  socket.closed.catch(failure => stream.destroy(failure));
  return { connection: stream, secured: true };
}
