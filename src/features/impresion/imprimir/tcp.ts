import net from 'net';

/**
 * Escribe bytes crudos en una impresora ESC/POS de red (`ip:puerto`, típico 9100).
 * Solo informa que el trabajo se **envió**; nunca que el papel salió
 * (`verificar.txt` §11).
 */
export const enviarBytesTcp = ({ ip, puerto, bytes, timeoutMs = 5000 }: {
  ip: string;
  puerto: number;
  bytes: Buffer;
  timeoutMs?: number;
}) => {
  return new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timeout conectando a ${ip}:${puerto}`));
    }, timeoutMs);

    socket.connect(puerto, ip, () => {
      clearTimeout(timeout);
      socket.write(bytes, (err) => {
        if (err) { socket.destroy(); reject(err); }
        else { socket.destroy(); resolve(); }
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};
